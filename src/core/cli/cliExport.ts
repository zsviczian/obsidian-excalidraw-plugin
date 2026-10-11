/** Visual feedback through the existing asset loader and rendering helpers. */
import { TFile } from "obsidian";
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import type { ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import { EmbeddedFilesLoader } from "src/shared/EmbeddedFileLoader";
import { getTemplate } from "src/utils/excalidrawAutomateUtils";
import { getSVG, getPNG } from "src/utils/utils";
import { checkAndCreateFolder } from "src/utils/fileUtils";
import { createExportAreaAnchor, getElementsIntersectionArea } from "src/utils/excalidrawElementUtils";
import { cropPNGBlob } from "src/utils/imageExportUtils";
import { CLIError, boolean, number, object, string } from "./cliProtocol";
import { diskSnapshot, drawingFile, drawingView, liveIdentity } from "./cliTarget";
import { fields } from "./cliElements";

/** Bounds limit allocation before rendering, including any area intermediate. */
export function exportBounds(width: number, height: number, scale: number): void {
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value * scale <= 16384) || width * height * scale * scale > 16000000) throw new CLIError("INVALID_INPUT", "Export exceeds 16 million pixels or 16384 pixels on either side.");
}

/** Does not save the source drawing; writes only an explicitly named image artifact. */
export async function exportDrawing(cli: ExcalidrawCLI, request: Record<string, unknown>, out: string): Promise<Partial<ExcalidrawCLIResult>> {
  const plugin = cli.plugin, vault = plugin.app.vault, file = drawingFile(plugin, request.path);
  const format = out.endsWith(".svg") ? "svg" : out.endsWith(".png") ? "png" : null;
  if (!format || out === file.path) throw new CLIError("INVALID_INPUT", "Output requires an explicit .svg or .png path distinct from the source.", "out");
  const overwrite = boolean(request.overwrite, "overwrite"), selectedOnly = boolean(request.selectedOnly, "selectedOnly");
  const source = request.source === undefined ? "auto" : string(request.source, "source");
  if (!["auto", "live", "disk"].includes(source)) throw new CLIError("INVALID_INPUT", "Expected auto, live or disk.", "source");
  if (source === "disk" && request.view !== undefined) throw new CLIError("INVALID_INPUT", "Disk export cannot select a view.", "view");
  const view = source === "disk" ? null : drawingView(plugin, file, request.view);
  if ((source === "live" || selectedOnly) && !view) throw new CLIError("NOT_READY", "Export requires a live view for this source/selection.");
  const originalOutput = vault.getAbstractFileByPath(out);
  if (originalOutput && (!(originalOutput instanceof TFile) || !overwrite)) throw new CLIError("ALREADY_EXISTS", "Output exists; replacing a file requires overwrite=true.", "out");
  const outputStat = originalOutput instanceof TFile ? JSON.stringify(originalOutput.stat) : null;
  const checkOutput = () => {
    if (!cli.isCurrent()) throw new CLIError("NOT_READY", "Plugin session ended.");
    const current = vault.getAbstractFileByPath(out);
    if (current !== originalOutput || (current instanceof TFile && JSON.stringify(current.stat) !== outputStat)) throw new CLIError("STALE_REVISION", "Output changed during rendering.", "out");
  };
  const padding = number(request.padding, "padding", 10, 0, 200), scale = number(request.scale, "scale", 1, 0.1, 4);
  const theme = request.theme === undefined ? undefined : string(request.theme, "theme");
  if (theme !== undefined && theme !== "light" && theme !== "dark") throw new CLIError("INVALID_INPUT", "Expected light or dark.", "theme");
  const area = request.area === undefined ? undefined : object(request.area, "area");
  if (area) { fields(area, ["x", "y", "width", "height"]); for (const key of ["x", "y", "width", "height"]) if (area[key] === undefined) throw new CLIError("INVALID_INPUT", "Area requires x, y, width and height.", "area"); }
  const rectangle = area ? { x: number(area.x, "area.x", 0, -1000000, 1000000), y: number(area.y, "area.y", 0, -1000000, 1000000), width: number(area.width, "area.width", 1, 0.1, 100000), height: number(area.height, "area.height", 1, 0.1, 100000) } : undefined;
  const api = view?.excalidrawAPI;
  let identity = view ? liveIdentity(view) : null;
  // Existing view asset loading can finish independently; never publish a
  // placeholder export as complete or initiate optional-feature consent UI.
  if (view) {
    for (let i = 0; i < 60; i++) {
      const missing = view.getScene(selectedOnly).elements.some(element => !element.isDeleted && element.type === "image" && !api.getFiles()[element.fileId]?.dataURL);
      if (!missing) break;
      if (!cli.isCurrent() || view.file !== file || view.excalidrawAPI !== api || view.isClosingOrMigrating()) throw new CLIError("STALE_REVISION", "Target changed while waiting for assets.");
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
    identity = liveIdentity(view);
  }
  const snapshot = view ? null : await diskSnapshot(plugin, file, cli.isCurrent);
  const revision = view ? cli.targets.revision(view, identity) : snapshot.revision;
  const checkSource = async () => {
    checkOutput();
    if (vault.getFileByPath(file.path) !== file) throw new CLIError("STALE_REVISION", "Source file identity changed.");
    if (view) {
      if (view.file !== file || view.excalidrawAPI !== api || liveIdentity(view) !== identity) throw new CLIError("STALE_REVISION", "Live scene changed during rendering.");
    } else if ((await diskSnapshot(plugin, file, cli.isCurrent)).revision !== revision) throw new CLIError("STALE_REVISION", "Disk drawing changed during rendering.");
    checkOutput();
  };
  let scene = view ? structuredClone(view.getScene(selectedOnly)) : { ...snapshot.scene };
  const assetPaths = view ? scene.elements.filter(element => element.type === "image").map(element => view.excalidrawData.getFile(element.fileId)?.file?.path) : snapshot.assetPaths;
  if (assetPaths.includes(out)) throw new CLIError("INVALID_INPUT", "Output cannot replace a referenced source asset.", "out");
  if (!view) {
    for (const feature of snapshot.dependencies) {
      const extras = plugin.extrasGateway.getAPI();
      if (!extras?.features.isActive(feature) || !plugin.extrasGateway.checkVersion(feature, extras).valid) throw new CLIError("DEPENDENCY_UNAVAILABLE", `Enable compatible Excalidraw Extras ${feature} before rendering this drawing.`);
    }
    if (plugin.app.metadataCache.getFirstLinkpathDest(file.path, "") !== file) throw new CLIError("NOT_FOUND", "Exact source is unavailable to the asset loader.");
    const loader = new EmbeddedFilesLoader(plugin, theme === undefined ? undefined : theme === "dark");
    const releaseCleanup = cli.registerOperationCleanup(() => { loader.terminate = true; });
    try {
      const template = await getTemplate(plugin, file.path, true, loader, 0);
      if (!["idle", "completed"].includes(loader.terminalState)) throw new CLIError("ASSETS_UNAVAILABLE", "Drawing assets did not finish loading.");
      scene = { ...scene, elements: template.elements, files: template.files, appState: template.appState };
    } finally { releaseCleanup(); loader.terminate = true; }
    await checkSource();
  }
  scene.elements = scene.elements.filter(element => !element.isDeleted);
  if (scene.elements.length > 5000) throw new CLIError("INVALID_INPUT", "Exports are limited to 5000 elements.");
  if (scene.elements.some(element => element.type === "image" && (element.status === "error" || !scene.files?.[element.fileId]?.dataURL || scene.files[element.fileId].dataURL.startsWith("http")))) throw new CLIError("ASSETS_UNAVAILABLE", "An image is missing or undecoded; retry when its normal loader is ready.");
  if (rectangle) scene.elements = [...getElementsIntersectionArea(scene.elements, rectangle, { includeBoundElements: true }), createExportAreaAnchor(rectangle)];
  if (!scene.elements.length) throw new CLIError("INVALID_INPUT", "Nothing to export.");
  const [minX, minY, maxX, maxY] = plugin.getCLIRuntime().getCommonBounds(scene.elements);
  exportBounds(maxX - minX + padding * 2, maxY - minY + padding * 2, format === "png" ? scale : 1);
  if (rectangle) exportBounds(rectangle.width + padding * 2, rectangle.height + padding * 2, format === "png" ? scale : 1);
  const effectiveTheme = theme ?? (view ? view.getViewExportTheme() : scene.appState.theme ?? "light");
  scene.appState = { ...scene.appState, theme: effectiveTheme as "light" | "dark", exportEmbedScene: false };
  const settings = { withBackground: true, withTheme: true, isMask: false };
  let binary: ArrayBuffer, width: number, height: number;
  if (format === "svg") {
    const svg = await getSVG(scene, settings, padding, file);
    if (!svg) throw new CLIError("EXPORT_FAILED", "SVG rendering failed.");
    if (rectangle) {
      svg.setAttribute("viewBox", `${rectangle.x - minX} ${rectangle.y - minY} ${rectangle.width + padding * 2} ${rectangle.height + padding * 2}`);
      svg.setAttribute("width", `${rectangle.width + padding * 2}`); svg.setAttribute("height", `${rectangle.height + padding * 2}`);
    }
    width = Number(svg.getAttribute("width")); height = Number(svg.getAttribute("height"));
    binary = new TextEncoder().encode(svg.outerHTML).buffer;
  } else {
    let png = await getPNG(scene, settings, padding, scale);
    if (!png) throw new CLIError("EXPORT_FAILED", "PNG rendering failed.");
    if (rectangle) png = await cropPNGBlob(png, { x: (rectangle.x - minX) * scale, y: (rectangle.y - minY) * scale, width: (rectangle.width + padding * 2) * scale, height: (rectangle.height + padding * 2) * scale });
    binary = await png.arrayBuffer(); const header = new DataView(binary);
    width = header.getUint32(16); height = header.getUint32(20);
  }
  exportBounds(width, height, 1);
  if (binary.byteLength > 32 * 1024 * 1024) throw new CLIError("EXPORT_FAILED", "Artifact exceeds 32 MiB.");
  await checkSource();
  await checkAndCreateFolder(out.split("/").slice(0, -1).join("/"));
  await checkSource();
  try {
    if (originalOutput instanceof TFile) await vault.modifyBinary(originalOutput, binary);
    else await vault.createBinary(out, binary);
  } catch {
    throw new CLIError("OUTCOME_UNKNOWN", "Artifact write was interrupted.", "out", "Inspect this exact output before retrying.", { mutation: "unknown", persistence: "unknown" });
  }
  return { target: { vault: vault.getName(), path: file.path, ...(view ? { viewId: view.id } : {}) }, revision, mutation: "applied", persistence: "saved", data: { path: out, format, bytes: binary.byteLength, width, height, source: view ? "live" : "disk", theme: effectiveTheme, revision }, warnings: [] };
}
