/** Explicit drawing/view ownership and revision snapshots for CLI operations. */
import { TFile } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import ExcalidrawView from "src/view/ExcalidrawView";
import { ExcalidrawData } from "src/shared/ExcalidrawData";
import { getTextMode } from "src/shared/TextMode";
import { VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import { CLIError, fingerprint, vaultPath } from "./cliProtocol";

/** Resolves an exact file; never uses basename/link lookup or the active drawing. */
export function drawingFile(plugin: ExcalidrawPlugin, value: unknown): TFile {
  const path = vaultPath(value);
  const file = plugin.app.vault.getFileByPath(path);
  if (!file) throw new CLIError("NOT_FOUND", "Drawing does not exist.", "path");
  if (!plugin.isExcalidrawFile(file)) throw new CLIError("NOT_EXCALIDRAW", "Target is not an Excalidraw drawing.", "path");
  return file;
}

/** Includes unavailable views so auto cannot silently read stale disk content. */
export function drawingViews(plugin: ExcalidrawPlugin, file: TFile): ExcalidrawView[] {
  return plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).map(leaf => leaf.view)
    .filter((view): view is ExcalidrawView => view instanceof ExcalidrawView && view.file === file);
}

/** Rejects ambiguous or explicitly missing identities instead of choosing the first view. */
export function drawingView(plugin: ExcalidrawPlugin, file: TFile, id?: unknown): ExcalidrawView | null {
  const views = drawingViews(plugin, file);
  if (id !== undefined) {
    if (typeof id !== "string") throw new CLIError("INVALID_INPUT", "Expected a view ID.", "view");
    const view = views.find(view => view.id === id);
    if (!view) throw new CLIError("NOT_FOUND", "Requested view is no longer available.", "view", "Open the drawing and read its current view ID.");
    return view;
  }
  if (views.length > 1) throw new CLIError("AMBIGUOUS_TARGET", `Choose a view: ${views.map(view => view.id).join(", ")}`, "view", "Pass an explicit view ID.");
  return views[0] ?? null;
}

/** Captures authoritative scene, document metadata, assets and settings for optimistic checks. */
export function liveIdentity(view: ExcalidrawView): string {
  if (!view.excalidrawAPI || !view.isLoaded || view.isClosingOrMigrating()) throw new CLIError("BUSY", "Drawing is loading, closing or migrating.", "path");
  const model = view.excalidrawData;
  const exportData = model.exportPreparedSaveData();
  return JSON.stringify({
    elements: view.excalidrawAPI.getSceneElementsIncludingDeleted(),
    files: view.excalidrawAPI.getFiles(),
    scene: view.getScene()?.appState,
    sourceText: view.data,
    textMode: view.textMode,
    text: [...model.textElements],
    filesMetadata: exportData ? [...exportData.files] : null,
    markdown: [...model.markdownImages], equations: [...model.equations], mermaids: [...model.mermaids],
    stat: view.file.stat, settings: view.plugin.settings,
  });
}

/** API identity changes invalidate old revisions even when the content is identical. */
export class CLITargets {
  private generations = new WeakMap<object, number>();
  private nextGeneration = 1;
  public constructor(private readonly session: string) {}

  /** Opaque session/view/runtime/content marker. */
  public revision(view: ExcalidrawView, identity = liveIdentity(view)): string {
    const api = view.excalidrawAPI;
    if (!this.generations.has(api)) this.generations.set(api, this.nextGeneration++);
    return `${this.session}:${view.id}:${this.generations.get(api)}:${fingerprint(identity)}`;
  }
}

/** Parses a single exact Vault read with the existing drawing model and releases it. */
export async function diskSnapshot(plugin: ExcalidrawPlugin, file: TFile, isCurrent: () => boolean) {
  if (file.stat.size > 16 * 1024 * 1024) throw new CLIError("INVALID_INPUT", "Drawing exceeds the 16 MiB inspection limit.", "path");
  const text = await plugin.app.vault.read(file);
  if (!isCurrent()) throw new CLIError("NOT_READY", "Plugin session ended.");
  const data = new ExcalidrawData(plugin);
  try {
    if (file.extension === "excalidraw") await data.loadLegacyData(text, file);
    else if (!await data.loadData(text, file, getTextMode(text), isCurrent)) throw new CLIError("NOT_READY", "Drawing could not be loaded.");
    if (!isCurrent() || plugin.app.vault.getFileByPath(file.path) !== file || !data.scene) throw new CLIError("NOT_READY", "Drawing changed while reading.");
    return { scene: structuredClone(data.scene), revision: `disk:${fingerprint(text)}`,
      dependencies: [...(data.equations.size ? ["mathjax" as const] : []), ...(data.mermaids.size ? ["mermaid" as const] : [])],
      assetPaths: data.scene.elements.filter(element => element.type === "image").map(element => data.getFile(element.fileId)?.file?.path).filter(Boolean),
    };
  } finally { data.destroy(); }
}
