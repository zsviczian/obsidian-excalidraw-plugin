/** Bounded CLI SVG/PNG export with request-local, opt-in image representations (#3004). */
import { TFile } from "obsidian";
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import type { ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import type { ExcalidrawElement, FileId } from "@zsviczian/excalidraw/types/element/src/types";
import { EmbeddedFilesLoader } from "src/shared/EmbeddedFileLoader";
import { getTemplate } from "src/utils/excalidrawAutomateUtils";
import { getSVG, getPNG } from "src/utils/utils";
import { checkAndCreateFolder } from "src/utils/fileUtils";
import { createExportAreaAnchor, getElementsIntersectionArea } from "src/utils/excalidrawElementUtils";
import { cropPNGBlob } from "src/utils/imageExportUtils";
import { CLIError, boolean, canonical, fingerprint, number, object, string } from "./cliProtocol";
import { diskSnapshot, drawingFile, drawingView, liveIdentity } from "./cliTarget";
import { sameCLIIdentity } from "./cliIdentity";
import { fields } from "./cliElements";
import { decideImage, parseImagePolicy, prepareImagePreview, type ImageDecision } from "./cliImages";
import { CLIDiskDependencies } from "./cliDependencies";
import { rasterDimensions } from "./cliImageDimensions";
import { frameExportGeometry } from "./cliExportGeometry";

/** Bounds limit allocation before rendering, including any area intermediate. */
export function exportBounds(width: number, height: number, scale: number): void {
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value * scale <= 16384) || width * height * scale * scale > 16000000) throw new CLIError("INVALID_INPUT", "Export exceeds 16 million pixels or 16384 pixels on either side.");
}

/** Explicit output limits may derive a scale below 0.1; do not silently upscale. */
export function previewScale(width: number, height: number, scale: number, maxWidth?: number, maxHeight?: number, maxPixels?: number): number {
  const effective = Math.min(scale, maxWidth === undefined ? Infinity : maxWidth / width,
    maxHeight === undefined ? Infinity : maxHeight / height,
    maxPixels === undefined ? Infinity : Math.sqrt(maxPixels / (width * height)));
  if (!(effective > 0) || !Number.isFinite(effective)) throw new CLIError("INVALID_INPUT", "Invalid preview output bounds.");
  exportBounds(width, height, effective);
  return effective;
}

/** Filter geometry and retain existing stacking/order semantics. */
function scopedElements(elements: readonly ExcalidrawElement[], rectangle?: { x: number; y: number; width: number; height: number }): ExcalidrawElement[] {
  const visible = elements.filter(element => !element.isDeleted);
  return rectangle ? [...getElementsIntersectionArea(visible, rectangle, { includeBoundElements: true }), createExportAreaAnchor(rectangle)] : visible;
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
  const maxWidth = request.maxWidth === undefined ? undefined : number(request.maxWidth, "maxWidth", 16384, 1, 16384);
  const maxHeight = request.maxHeight === undefined ? undefined : number(request.maxHeight, "maxHeight", 16384, 1, 16384);
  const maxPixels = request.maxPixels === undefined ? undefined : number(request.maxPixels, "maxPixels", 16000000, 1, 16000000);
  const artifactBudget = number(request.maxArtifactBytes, "maxArtifactBytes", 32 * 1024 * 1024, 1024, 32 * 1024 * 1024);
  if ([maxWidth, maxHeight, maxPixels, artifactBudget].some(value => value !== undefined && !Number.isInteger(value))) throw new CLIError("INVALID_INPUT", "Preview bounds must be integers.");
  const policy = parseImagePolicy(request.imagePolicy);
  const theme = request.theme === undefined ? undefined : string(request.theme, "theme");
  if (theme !== undefined && theme !== "light" && theme !== "dark") throw new CLIError("INVALID_INPUT", "Expected light or dark.", "theme");
  const area = request.area === undefined ? undefined : object(request.area, "area");
  if (area) { fields(area, ["x", "y", "width", "height"]); for (const key of ["x", "y", "width", "height"]) if (area[key] === undefined) throw new CLIError("INVALID_INPUT", "Area requires x, y, width and height.", "area"); }
  const rectangle = area ? { x: number(area.x, "area.x", 0, -1000000, 1000000), y: number(area.y, "area.y", 0, -1000000, 1000000), width: number(area.width, "area.width", 1, 0.1, 100000), height: number(area.height, "area.height", 1, 0.1, 100000) } : undefined;
  const api = view?.excalidrawAPI, model = view?.excalidrawData;
  const identity = view ? liveIdentity(view) : null;
  const dependencies = view ? null : new CLIDiskDependencies(vault, cli.isCurrent);
  const releaseDependencies = dependencies ? cli.registerOperationCleanup(dependencies.destroy) : () => {};
  try {
  if (dependencies) await dependencies.observe(file);
  const snapshot = view ? null : await diskSnapshot(plugin, file, cli.isCurrent);
  const firstScene = view ? view.getScene(selectedOnly) : snapshot.scene;
  let elements = scopedElements(firstScene.elements, rectangle);
  if (elements.length > 5000) throw new CLIError("INVALID_INPUT", "Exports are limited to 5000 elements.");
  if (!elements.length) throw new CLIError("INVALID_INPUT", "Nothing to export.");
  // Always check against the complete *original* set, not the scoped/replaced preview.
  const assetPaths = view ? [...model.getFileEntries()].map(([, asset]) => asset?.file?.path).filter(Boolean) : snapshot.assetPaths;
  if (assetPaths.includes(out)) throw new CLIError("INVALID_INPUT", "Output cannot replace a referenced source asset.", "out");
  const decisions = new Map<string, ImageDecision>();
  for (const element of elements) if (element.type === "image") decisions.set(element.id, decideImage(element, element.fileId ? firstScene.files?.[element.fileId] : undefined, policy));
  const required = new Set<FileId>([...decisions.values()]
    .filter(item => item.mode !== "placeholder" && item.fileId !== null)
    .map(item => item.fileId as FileId));
  // Refuse impossible output geometry before decoding/loading any image sources.
  const geometry = async (items: ExcalidrawElement[], appState: typeof firstScene.appState) => {
    const rendered = items.filter(element => !(element.type === "frame" && element.frameRole === "marker"));
    const frames = new Set(rendered.filter(element => element.type === "frame" || element.type === "magicframe").map(element => element.id));
    const roots = rendered.filter(element => !element.frameId || !frames.has(element.frameId));
    if (!roots.length) throw new CLIError("INVALID_INPUT", "Nothing to export.");
    const bounds = plugin.getCLIRuntime().getCommonBounds(roots);
    return frames.size ? frameExportGeometry(rendered, appState, padding, bounds)
      : { x: bounds[0] - padding, y: bounds[1] - padding, width: bounds[2] - bounds[0] + padding * 2, height: bounds[3] - bounds[1] + padding * 2 };
  };
  const initialGeometry = await geometry(elements, firstScene.appState);
  previewScale(initialGeometry.width, initialGeometry.height,
    format === "png" ? scale : 1, maxWidth, maxHeight, maxPixels);
  if (dependencies) {
    const thumbnailAssets = [...decisions.values()].filter(item => item.mode === "thumbnail")
      .map(item => snapshot.assetFiles.get(item.fileId as FileId)).filter(Boolean);
    if (thumbnailAssets.some(asset => !["png", "jpg", "jpeg", "webp"].includes(asset.extension.toLowerCase()))) throw new CLIError("ASSETS_UNAVAILABLE", "Disk thumbnails require direct PNG/JPEG/WebP sources; use loaded live renditions, original or placeholder.");
    const thumbnailPaths = new Set(thumbnailAssets.map(asset => asset.path));
    dependencies.preflight = (asset, bytes) => {
      if (!thumbnailPaths.has(asset.path)) return;
      if (bytes.byteLength > 24 * 1024 * 1024) throw new CLIError("ASSETS_UNAVAILABLE", "Thumbnail source exceeds 24 MiB; choose placeholder.");
      if (["png", "jpg", "jpeg", "webp"].includes(asset.extension.toLowerCase())) rasterDimensions(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 262144)));
    };
  }

  // View-owned assets may still be loading. Do not wait for intentionally omitted images.
  if (view) {
    for (let i = 0; i < 60; i++) {
      const available = api.getFiles();
      if ([...required].every(id => available[id]?.dataURL?.startsWith("data:"))) break;
      if (!cli.isCurrent() || view.file !== file || view.excalidrawAPI !== api || view.isClosingOrMigrating()) throw new CLIError("STALE_REVISION", "Target changed while waiting for assets.");
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
  }
  const revision = view ? cli.targets.revision(view, identity) : snapshot.revision;
  const checkSource = async () => {
    dependencies?.assertCurrent();
    checkOutput();
    if (vault.getFileByPath(file.path) !== file) throw new CLIError("STALE_REVISION", "Source file identity changed.");
    if (view) {
      if (view.file !== file || view.excalidrawAPI !== api || view.excalidrawData !== model || !sameCLIIdentity(liveIdentity(view), identity)) throw new CLIError("STALE_REVISION", "Live scene changed during rendering.");
    } else if ((await diskSnapshot(plugin, file, cli.isCurrent)).revision !== revision) throw new CLIError("STALE_REVISION", "Disk drawing changed during rendering.");
    checkOutput();
  };
  let scene = { ...firstScene, elements, files: { ...firstScene.files } };
  if (!view) {
    if (required.size) {
      // Only the dependencies needed for rendered originals/thumbnails are loaded.
      for (const feature of snapshot.dependencies) {
        if (![...required].some(id => snapshot.featureFiles[feature].has(id))) continue;
        const extras = plugin.extrasGateway.getAPI();
        if (!extras?.features.isActive(feature) || !plugin.extrasGateway.checkVersion(feature, extras).valid) throw new CLIError("DEPENDENCY_UNAVAILABLE", `Enable compatible Excalidraw Extras ${feature} before rendering this drawing.`);
      }
      if (plugin.app.metadataCache.getFirstLinkpathDest(file.path, "") !== file) throw new CLIError("NOT_FOUND", "Exact source is unavailable to the asset loader.");
      const loader = new EmbeddedFilesLoader(plugin, theme === undefined ? undefined : theme === "dark");
      loader.beforeFileRead = dependencies.observe;
      const releaseCleanup = cli.registerOperationCleanup(() => { loader.terminate = true; });
      try {
        const template = await getTemplate(plugin, file.path, true, loader, 0, false, required);
        if (!["idle", "completed"].includes(loader.terminalState)) throw new CLIError("ASSETS_UNAVAILABLE", "Drawing assets did not finish loading.");
        scene = { ...scene, elements: scopedElements(template.elements, rectangle), files: template.files, appState: template.appState };
      } finally { releaseCleanup(); loader.terminate = true; loader.beforeFileRead = undefined; loader.emptyPDFDocsMap(); }
    }
    await checkSource();
  }
  if (scene.elements.length > 5000) throw new CLIError("INVALID_INPUT", "Exports are limited to 5000 elements.");
  // No original image bodies are copied into the preview scene unless needed.
  await checkSource();
  const converted = await prepareImagePreview(scene.elements, scene.files ?? {}, policy, decisions, () => {
    if (!cli.isCurrent()) throw new CLIError("NOT_READY", "Plugin session ended.");
  });
  scene = { ...scene, elements: converted.elements, files: converted.files };
  if (!scene.elements.length) throw new CLIError("INVALID_INPUT", "Nothing to export.");
  const measured = await geometry(scene.elements, scene.appState);
  const minX = measured.x + padding, minY = measured.y + padding;
  const renderWidth = measured.width, renderHeight = measured.height;
  const outputWidth = rectangle ? rectangle.width + padding * 2 : renderWidth;
  const outputHeight = rectangle ? rectangle.height + padding * 2 : renderHeight;
  let effectiveScale = previewScale(renderWidth, renderHeight, format === "png" ? scale : 1,
    maxWidth, maxHeight, maxPixels);
  if (rectangle) exportBounds(outputWidth, outputHeight, effectiveScale);
  const effectiveTheme = theme ?? (view ? view.getViewExportTheme() : scene.appState.theme ?? "light");
  scene.appState = { ...scene.appState, theme: effectiveTheme as "light" | "dark", exportEmbedScene: false };
  const settings = { withBackground: true, withTheme: true, isMask: false };
  let binary: ArrayBuffer, width: number, height: number;
  if (format === "svg") {
    // The largest unavoidable SVG strings are the selected data URLs. Reject
    // them *before* building the SVG rather than stringifying an oversized DOM.
    const estimatedDataBytes = Object.values(scene.files).reduce((total, data) => total + data.dataURL.length, 0);
    if (estimatedDataBytes > artifactBudget - 1024) throw new CLIError("EXPORT_FAILED", "Selected image payloads exceed the SVG artifact budget; use thumbnail/placeholder rules.");
    const svg = await getSVG(scene, settings, padding, file);
    if (!svg) throw new CLIError("EXPORT_FAILED", "SVG rendering failed.");
    if (rectangle) svg.setAttribute("viewBox", `${rectangle.x - minX} ${rectangle.y - minY} ${outputWidth} ${outputHeight}`);
    const baseWidth = rectangle ? outputWidth : Number(svg.getAttribute("width"));
    const baseHeight = rectangle ? outputHeight : Number(svg.getAttribute("height"));
    const svgScale = previewScale(baseWidth, baseHeight, 1, maxWidth, maxHeight, maxPixels);
    effectiveScale = svgScale;
    width = baseWidth * svgScale; height = baseHeight * svgScale;
    svg.setAttribute("width", `${width}`); svg.setAttribute("height", `${height}`);
    binary = new TextEncoder().encode(svg.outerHTML).buffer;
  } else {
    let png = await getPNG(scene, settings, padding, effectiveScale);
    if (!png) throw new CLIError("EXPORT_FAILED", "PNG rendering failed.");
    if (rectangle) png = await cropPNGBlob(png, { x: (rectangle.x - minX) * effectiveScale, y: (rectangle.y - minY) * effectiveScale, width: outputWidth * effectiveScale, height: outputHeight * effectiveScale });
    binary = await png.arrayBuffer(); const header = new DataView(binary);
    width = header.getUint32(16); height = header.getUint32(20);
  }
  exportBounds(width, height, 1);
  if (width > (maxWidth ?? Infinity) + 1e-7 || height > (maxHeight ?? Infinity) + 1e-7 || width * height > (maxPixels ?? Infinity) + 1e-3) throw new CLIError("EXPORT_FAILED", "Rendered dimensions exceed the requested preview bounds.");
  if (binary.byteLength > artifactBudget) throw new CLIError("EXPORT_FAILED", "Artifact exceeds the requested byte budget; choose a cheaper image policy.");
  await checkSource();
  await checkAndCreateFolder(out.split("/").slice(0, -1).join("/"));
  await checkSource();
  await dependencies?.validate();
  checkOutput();
  dependencies?.assertCurrent();
  try {
    if (originalOutput instanceof TFile) await vault.modifyBinary(originalOutput, binary);
    else await vault.createBinary(out, binary);
  } catch {
    throw new CLIError("OUTCOME_UNKNOWN", "Artifact write was interrupted.", "out", "Inspect this exact output before retrying.", { mutation: "unknown", persistence: "unknown" });
  }
  const imageSummary = { original: 0, thumbnail: 0, placeholder: 0 };
  for (const choice of decisions.values()) imageSummary[choice.mode]++;
  return { target: { vault: vault.getName(), path: file.path, ...(view ? { viewId: view.id } : {}) }, revision, mutation: "applied", persistence: "saved", data: {
    path: out, format, bytes: binary.byteLength, width, height, source: view ? "live" : "disk", theme: effectiveTheme,
    revision, effectiveScale, imageSummary,
    imageDecisions: { items: [...decisions.values()].slice(0, 50), total: decisions.size },
    representationId: `preview:${fingerprint(canonical({ revision, format, policy, theme: effectiveTheme, rectangle: rectangle ?? null, selectedOnly, padding, width, height, effectiveScale, decisions: [...decisions.values()] }))}`,
    sceneToPreview: { sceneBounds: { x: (rectangle?.x ?? minX) - padding, y: (rectangle?.y ?? minY) - padding, width: outputWidth, height: outputHeight }, output: { width, height } },
  }, warnings: [] };
  } finally { releaseDependencies(); dependencies?.destroy(); }
}
