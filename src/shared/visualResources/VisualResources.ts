import { FileSystemAdapter, getAllTags, getIcon, Notice, Platform, type TFile } from "obsidian";
import type { LibraryItem } from "@zsviczian/excalidraw/types/excalidraw/types";
import { IMAGE_TYPES, nanoid } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { FRAME_ANCHORS_PROPERTY, getSceneFrames } from "src/utils/frameMetadata";
import { getTemplate } from "src/utils/excalidrawAutomateUtils";
import { repositionElementsToCursor } from "src/utils/excalidrawElementUtils";
import type { VisualDiscoveryCandidate, VisualDiscoveryRule, VisualResource, VisualResourceLocator } from "src/types/visualResourceTypes";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { EmbeddedFile, EmbeddedFilesLoader } from "../EmbeddedFileLoader";
import { getLucideIcons, prepareLucideIcon } from "../lucideIcons";
import { FrameworkCatalog } from "./FrameworkCatalog";
import { ResourceCollections } from "./ResourceCollections";
import { compileVisualExclusions, compileVisualRules, readIconLibrarySettings, visualResourceKey } from "./visualResourceModel";

const DRAG_TYPE = "application/x-obsidian-excalidraw-visual-resource";
const PREVIEW_CACHE_BYTES = 2 * 1024 * 1024;

type ScenePoint = { x: number; y: number };
type MindMapBuilder = {
  ready(): boolean;
  getView(): { ok: boolean; data?: { view: ExcalidrawView } };
  getSelection(): { ok: boolean; data?: { nodeId?: string } };
  addNode(options: { text: string; parentId: string }): Promise<{ ok: boolean }>;
};

/** Coordinates existing vault, library, and Lucide providers for both gallery surfaces. */
export class VisualResources {
  public readonly collections: ResourceCollections;
  public readonly frameworks: FrameworkCatalog;
  private drag: { token: string; resource: VisualResource; file: TFile | null } | null = null;
  private disposed = false;
  private readonly previews = new Map<string, { path: string; data: string }>();
  private readonly framePreviews = new Map<string, { stamp: string; frames: Promise<VisualResource[]> }>();
  private previewBytes = 0;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    this.collections = plugin.addChild(new ResourceCollections(plugin));
    this.frameworks = new FrameworkCatalog(plugin);
    plugin.register(() => { this.disposed = true; this.endDrag(); this.previews.clear(); this.framePreviews.clear(); });
  }

  /** Read compatible script settings as defaults without altering the installed script. */
  public iconSettings(scriptName = "Icon Library") {
    const settings = this.plugin.settings.scriptEngineSettings;
    const stock = Object.keys(settings).find(name => name.startsWith("Downloaded/") && name.endsWith("/Icon Library"));
    return readIconLibrarySettings(settings[scriptName] ?? (stock ? settings[stock] : undefined));
  }

  /** The browser's new rules override imported defaults once explicitly configured. */
  public rules(scriptName?: string): Record<"icon" | "drawing" | "frame", VisualDiscoveryRule[]> {
    return this.plugin.settings.visualResources.rules ?? {
      icon: this.iconSettings(scriptName).rules,
      drawing: [],
      frame: [{ name: t("VR_FRAME"), pattern: "(.+)" }],
    };
  }

  private candidate(file: TFile): VisualDiscoveryCandidate {
    const extension = file.extension.toLowerCase();
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const tags = cache ? getAllTags(cache)?.map(tag => tag.replace(/^#/, "")) : undefined;
    const properties = cache?.frontmatter;
    return {
      path: file.path, folder: file.parent?.path ?? "", basename: file.basename, extension,
      size: file.stat.size, properties: tags ? { ...properties, tags } : properties,
      image: IMAGE_TYPES.includes(extension), drawing: this.plugin.isExcalidrawFile(file),
    };
  }

  /** Enumerate indexed descriptors. Drawings are read when inspecting children or rendering previews. */
  public async list(scriptName?: string, progress?: (resources: VisualResource[]) => void): Promise<VisualResource[]> {
    const rules = this.rules(scriptName);
    const icon = compileVisualRules("icon", rules.icon);
    const drawing = compileVisualRules("drawing", rules.drawing);
    const frame = compileVisualRules("frame", rules.frame);
    const excluded = compileVisualExclusions(this.plugin.settings.visualResources.excludeFolders ?? this.iconSettings(scriptName).exclusion);
    const curated = new Set(this.collections.curated.map(record => visualResourceKey(record.locator)));
    const result: VisualResource[] = [];
    for (const file of this.plugin.app.vault.getFiles()) {
      if (file.extension === "excalidrawlib") continue;
      const locator = { provider: "vault", path: file.path } as const;
      const explicit = curated.has(visualResourceKey(locator));
      if (!explicit && excluded(file.path)) continue;
      const candidate = this.candidate(file);
      const icons = icon(candidate);
      const drawings = drawing(candidate);
      const anchors: unknown = candidate.properties?.[FRAME_ANCHORS_PROPERTY];
      const children = (candidate.drawing && Array.isArray(anchors) ? anchors : []).flatMap((name: unknown) => {
        if (typeof name !== "string" || !name.trim()) return [];
        // An indexed name has no role until the drawing is opened for details.
        const matches = frame({ ...candidate, frame: { name, type: "frame" } }).concat(frame({ ...candidate, frame: { name, type: "magicframe" } }));
        return matches.length ? [this.frameResource(file, name, name, matches.map(match => match.group))] : [];
      });
      if (!candidate.image && !candidate.drawing && !(candidate.extension === "md" && (explicit || icons.length))) continue;
      const matches = [...icons, ...drawings];
      const kind = candidate.drawing && (drawings.length || children.length || !icons.length) ? "drawing"
        : candidate.extension === "md" && !candidate.drawing ? "note"
          : icons.length ? "icon" : "image";
      const keywords = matches.map(match => match.keyword);
      result.push({ locator, kind, title: keywords[0] || file.basename, source: file.path, keywords,
        groups: [...new Set([...matches.map(match => match.group), ...children.flatMap(child => child.groups ?? [])])],
        other: !matches.length && !children.length && !explicit,
        frames: children,
        inspectFrames: children.length > 0 || candidate.drawing && candidate.extension === "excalidraw",
      });
    }
    for (const icon of getLucideIcons()) {
      result.push({ locator: { provider: "lucide", icon: icon.icon }, kind: "icon", title: icon.name, source: "Lucide", keywords: [icon.icon] });
    }
    if (progress) progress([...result].sort((a, b) => a.title.localeCompare(b.title)));
    const [stencils, frameworks] = await Promise.all([this.plugin.stencilLibraryManager.getResourceLibraries(), this.frameworks.list()]);
    for (const { item, path } of stencils.items) {
      result.push({ locator: { provider: "stencil", id: item.id, path }, kind: "stencil",
        title: item.name || item.id, source: path ?? t("VR_DEFAULT_LIBRARY"), keywords: [] });
    }
    for (const { item, path } of frameworks) {
      result.push({ locator: { provider: "framework", id: item.id, path }, kind: "framework",
        title: item.name || item.id, source: path, keywords: [] });
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Load the chosen drawing once to give duplicate names unambiguous native references. */
  public async frames(resource: VisualResource, scriptName?: string): Promise<VisualResource[]> {
    if (resource.locator.provider !== "vault") return [];
    const file = this.sourceFile(resource);
    if (!file || !this.plugin.isExcalidrawFile(file)) return [];
    const frameRules = this.rules(scriptName).frame;
    const stamp = JSON.stringify([file.stat.mtime, frameRules]);
    const cached = this.framePreviews.get(file.path);
    if (cached?.stamp === stamp) return cached.frames;
    const pending = this.inspectFrames(file, frameRules);
    this.framePreviews.set(file.path, { stamp, frames: pending });
    if (this.framePreviews.size > 64) this.framePreviews.delete([...this.framePreviews.keys()][0]);
    try { return await pending; }
    catch (error: unknown) {
      if (this.framePreviews.get(file.path)?.frames === pending) this.framePreviews.delete(file.path);
      throw error;
    }
  }

  private async inspectFrames(file: TFile, frameRules: VisualDiscoveryRule[]): Promise<VisualResource[]> {
    const candidate = this.candidate(file);
    const matches = compileVisualRules("frame", frameRules);
    const data = await getTemplate(this.plugin, file.path, false, null, 0);
    const frames = getSceneFrames(data.elements);
    const nameCounts = new Map<string, number>();
    for (const frame of frames) nameCounts.set(frame.name, (nameCounts.get(frame.name) ?? 0) + 1);
    return frames.flatMap(frame => {
      if (!frame.name?.trim()) return [];
      const rules = matches({ ...candidate, frame: { name: frame.name, type: frame.frameRole === "marker" ? "magicframe" : "frame" } });
      if (!rules.length) return [];
      const resource = this.frameResource(file, frame.id, frame.name, rules.map(rule => rule.group));
      if (nameCounts.get(frame.name) > 1) resource.title += " (" + frame.id.slice(0, 8) + ")";
      return [resource];
    });
  }

  private frameResource(file: TFile, id: string, name: string, groups: string[]): VisualResource {
    return { locator: { provider: "vault", path: file.path, frame: id }, kind: "frame",
      title: name, source: file.path, keywords: [name], groups: [...new Set(groups)] };
  }

  /** Resolve curated frames by stored frame ID, including those no longer matching discovery rules. */
  public async curatedFrames(): Promise<VisualResource[]> {
    const grouped = new Map<string, Set<string>>();
    for (const { locator } of this.collections.curated) {
      if (locator.provider !== "vault" || !locator.frame) continue;
      const frames = grouped.get(locator.path) ?? new Set<string>();
      frames.add(locator.frame);
      grouped.set(locator.path, frames);
    }
    const results: VisualResource[] = [];
    for (const [path, ids] of grouped) {
      const file = this.plugin.app.vault.getFileByPath(path);
      if (!file || !this.plugin.isExcalidrawFile(file)) continue;
      try {
        const data = await getTemplate(this.plugin, path, false, null, 0);
        for (const frame of getSceneFrames(data.elements)) {
          if (ids.has(frame.id) && frame.name?.trim()) results.push(this.frameResource(file, frame.id, frame.name, []));
        }
      } catch { /* A temporarily unreadable source retains its curation. */ }
    }
    return results;
  }

  /** Resolve a library item by its current provider and owner. */
  public async libraryItem(locator: VisualResourceLocator): Promise<LibraryItem | undefined> {
    if (locator.provider === "framework") return (await this.frameworks.items(locator.path)).find(item => item.id === locator.id);
    if (locator.provider !== "stencil") return;
    const library = await this.plugin.stencilLibraryManager.getResourceLibraries();
    return library.items.find(({ item, path }) => item.id === locator.id && locator.path === path)?.item;
  }

  /** Resolve the vault file behind a resource (including a backing library when present). */
  public sourceFile(resource: VisualResource): TFile | null {
    const locator = resource.locator;
    return "path" in locator && locator.path ? this.plugin.app.vault.getFileByPath(locator.path) : null;
  }

  /** Open the source in a new tab, using the existing frame-link navigation route. */
  public async openSource(resource: VisualResource): Promise<void> {
    if (resource.locator.provider !== "vault") return;
    const file = this.sourceFile(resource);
    if (file) await this.plugin.app.workspace.openLinkText(this.link(resource, file), "", "tab");
  }

  private link(resource: VisualResource, file: TFile): string {
    return file.path + (resource.locator.provider === "vault" && resource.locator.frame ? "#^frame=" + resource.locator.frame : "");
  }

  /** A drawing can receive inserts only while the current editor and file are live. */
  public writable(view: ExcalidrawView | null): view is ExcalidrawView {
    return !!view?.file && view.isLoaded && view.leaf.view === view && !!view.excalidrawAPI && !view.excalidrawAPI.isDestroyed &&
      !view.isClosingOrMigrating() && !view.isSameFileEditingActive() && !view.isPersistenceBusy() &&
      !view.excalidrawAPI.getAppState().viewModeEnabled &&
      this.plugin.app.vault.getFileByPath(view.file.path) === view.file;
  }

  /** Insert through the corresponding native engine, revalidating after each asynchronous preparation. */
  public async insert(resource: VisualResource, view: ExcalidrawView | null, active: () => boolean, point?: ScenePoint, scriptName?: string): Promise<void> {
    if (!this.writable(view) || this.disposed || !active()) return;
    const file = view.file, path = file.path, api = view.excalidrawAPI, owner = view.ownerDocument;
    const validate = () => {
      if (this.disposed || !active() || !this.writable(view) || view.file !== file || file.path !== path ||
          view.excalidrawAPI !== api || view.ownerDocument !== owner) throw Error("Visual resource target retired");
    };
    const state = api.getAppState();
    const center = point ?? { x: -state.scrollX + state.width / (2 * state.zoom.value), y: -state.scrollY + state.height / (2 * state.zoom.value) };
    const size = this.plugin.settings.visualResources.iconWidth ?? this.iconSettings(scriptName).iconWidth;
    const ea = this.plugin.ea.getAPI(view);
    try {
      if (resource.locator.provider === "lucide") {
        const lucideSize = this.plugin.lucidePicker.insertionSize;
        const prepared = prepareLucideIcon({ icon: resource.locator.icon, size: lucideSize, x: center.x - lucideSize / 2, y: center.y - lucideSize / 2,
          strokeColor: state.currentItemStrokeColor, roughness: state.currentItemRoughness, opacity: state.currentItemOpacity });
        for (const element of prepared.elements) {
          element.x += (lucideSize - prepared.result.viewport.width) / 2;
          element.y += (lucideSize - prepared.result.viewport.height) / 2;
        }
        if (await view.addElements({ newElements: prepared.elements, newElementsOnTop: true, validateBeforePublish: validate })) {
          api.selectElements(prepared.elements);
          await view.saveWithOutcome();
          if (prepared.result.warnings.length) new Notice(t("LUCIDE_APPROXIMATION"));
        }
        return;
      }
      if (resource.locator.provider !== "vault") {
        const item = await this.libraryItem(resource.locator);
        if (!item) return;
        validate();
        // Native library files can carry display text with empty Obsidian raw text.
        const copies = ea.cloneElements([...item.elements]).map(element =>
          element.type === "text" && !element.rawText
            ? { ...element, rawText: element.originalText || element.text }
            : element,
        );
        const elements = repositionElementsToCursor(copies, center, true);
        if (await view.addElements({ newElements: elements, newElementsOnTop: true, validateBeforePublish: validate })) {
          api.selectElements(elements);
          await view.saveWithOutcome();
        }
        return;
      }
      const source = this.sourceFile(resource);
      if (!source || source === file && this.plugin.isExcalidrawFile(source)) return;
      const frameId = resource.locator.frame;
      if (frameId) {
        const data = await getTemplate(this.plugin, source.path, false, null, 0);
        if (!getSceneFrames(data.elements).some(frame => frame.id === frameId)) return;
        validate();
      }
      const link = this.link(resource, source);
      const isNote = source.extension === "md" && !this.plugin.isExcalidrawFile(source);
      type MindMapWindow = Window & { MindMapBuilderAPI?: MindMapBuilder };
      const mainWindow = this.plugin.app.workspace.containerEl.ownerDocument.defaultView;
      const mindMap = !point && scriptName && !isNote && (
        (owner.defaultView as MindMapWindow).MindMapBuilderAPI ?? (mainWindow as MindMapWindow).MindMapBuilderAPI);
      if (mindMap && typeof mindMap.ready === "function" && mindMap.ready() && mindMap.getView?.().data?.view === view) {
        const selection = mindMap.getSelection();
        if (selection.ok && selection.data?.nodeId && (await mindMap.addNode({ text: "![["
          + link + "|" + size + "]]", parentId: selection.data.nodeId })).ok) return;
        validate();
      }
      if (!isNote && !this.plugin.isExcalidrawFile(source) && !IMAGE_TYPES.includes(source.extension.toLowerCase())) return;
      const id = isNote ? ea.addText(center.x, center.y, "[[" + link + "]]") :
        await ea.addImage(0, 0, resource.locator.frame ? link : source, true);
      const element = ea.getElement(id);
      if (!element) return;
      if ((resource.kind === "icon" || !!scriptName) && !isNote) {
        element.height = size * (element.width ? element.height / element.width : 1);
        element.width = size;
      }
      element.x = center.x - element.width / 2;
      element.y = center.y - element.height / 2;
      validate();
      if (this.sourceFile(resource) !== source) return;
      if (await view.addElements({ newElements: ea.getElements(), images: ea.imagesDict, newElementsOnTop: true, validateBeforePublish: validate })) {
        api.selectElements([element]);
        await view.saveWithOutcome();
      }
    } catch {
      if (active()) new Notice(t("VR_INSERT_FAILED"));
    } finally { ea.destroy(); }
  }

  /** Insert editable SVG geometry and optionally add a vault wikilink to the drawing's properties. */
  public async insertSvgStrokes(resource: VisualResource, view: ExcalidrawView | null, active: () => boolean, retainSource: boolean): Promise<void> {
    if (!this.writable(view) || !active() || resource.locator.provider !== "vault") return;
    const source = this.sourceFile(resource);
    if (source?.extension.toLowerCase() !== "svg" || source.stat.size > 2_000_000) return;
    const vault = this.plugin.app.vault;
    const file = view.file, path = file.path, api = view.excalidrawAPI, owner = view.ownerDocument;
    const stillTarget = () => view.file === file && file.path === path && view.excalidrawAPI === api &&
      view.ownerDocument === owner && view.leaf.view === view && !view.isClosingOrMigrating() && vault.getFileByPath(path) === file;
    const validate = () => {
      if (this.disposed || !active() || !stillTarget() || !this.writable(view) || this.sourceFile(resource) !== source) throw Error("SVG target retired");
    };
    const ea = this.plugin.ea.getAPI(view);
    try {
      const text = await vault.read(source);
      validate();
      if (!ea.importSVG(text) || !ea.getElements().length) return;
      const elements = ea.getElements();
      ea.addToGroup(elements.map(element => element.id));
      view.setCurrentPositionToCenter();
      if (!await view.addElements({ newElements: elements, newElementsOnTop: true, repositionToCursor: true,
        shouldRestoreElements: true, validateBeforePublish: validate })) return;
      api.selectElements(elements);
      const saved = await view.saveWithOutcome();
      if (!retainSource || file.extension !== "md" || !stillTarget() || this.sourceFile(resource) !== source) return;
      if (saved.acknowledgedRevision === null || saved.acknowledgedRevision < saved.requestedRevision) throw Error("SVG insertion save was not acknowledged");
      const link = "[[" + this.plugin.app.metadataCache.fileToLinktext(source, file.path) + "]]";
      await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (!stillTarget()) return;
        const property = "excalidraw-svg-sources";
        const current = frontmatter[property];
        const links: unknown[] = Array.isArray(current) ? current : current === undefined ? [] : [current];
        if (!links.includes(link)) frontmatter[property] = [...links, link];
      });
    } finally { ea.destroy(); }
  }

  /** Start an internal drag with an opaque, one-use token. */
  public startDrag(transfer: DataTransfer, resource: VisualResource): void {
    const token = nanoid();
    this.drag = { token, resource, file: this.sourceFile(resource) };
    transfer.setData(DRAG_TYPE, token);
    transfer.effectAllowed = "copy";
  }

  /** Clear in-memory identity when an internal drag ends or its source retires. */
  public endDrag(): void { this.drag = null; }

  /** Accept only the current in-process drag payload. */
  public isDrag(transfer: DataTransfer): boolean { return !!this.drag && transfer.types.includes(DRAG_TYPE); }

  /** Consume a drop once in the receiving drawing. */
  public drop(transfer: DataTransfer, view: ExcalidrawView, point: ScenePoint): boolean {
    if (!this.drag || transfer.getData(DRAG_TYPE) !== this.drag.token) return false;
    const { resource, file } = this.drag;
    this.endDrag();
    void this.insert(resource, view, () => this.sourceFile(resource) === file, point);
    return true;
  }

  /** Return a local image preview, with SVG markup used only as an image URL. */
  public async preview(resource: VisualResource, dark: boolean): Promise<string | SVGSVGElement | null> {
    if (resource.locator.provider === "lucide") return getIcon(resource.locator.icon);
    const file = this.sourceFile(resource);
    if (resource.locator.provider === "vault" && file && !this.plugin.isExcalidrawFile(file))
      return IMAGE_TYPES.includes(file.extension.toLowerCase()) ? this.plugin.app.vault.getResourcePath(file) : null;
    if (resource.locator.provider === "vault" && file) {
      const loader = new EmbeddedFilesLoader(this.plugin, dark);
      const input = resource.locator.frame ? new EmbeddedFile(this.plugin, file.path, this.link(resource, file)) : file;
      return (await loader.getObsidianImage(input, 0))?.dataURL || null;
    }
    const stamp = file?.stat.mtime;
    const key = JSON.stringify([visualResourceKey(resource.locator), file?.path, stamp, dark]);
    const cached = file && this.previews.get(key);
    if (cached) {
      this.previews.delete(key);
      this.previews.set(key, cached);
      return cached.data;
    }
    const ea = this.plugin.ea.getAPI();
    try {
      const options = { ...ea.getExportSettings(false, false), drawingThumbnail: true };
      const item = await this.libraryItem(resource.locator);
      if (!item) return null;
      const elements = structuredClone(Array.from(item.elements));
      for (const element of elements) ea.elementsDict[element.id] = element;
      const svg = await ea.createSVG(undefined, false, options, undefined, dark ? "dark" : "light", 4);
      if (!svg) return null;
      const data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.outerHTML);
      if (!this.disposed && file && this.sourceFile(resource) === file && file.stat.mtime === stamp && data.length < PREVIEW_CACHE_BYTES) {
        const previous = this.previews.get(key);
        this.previewBytes += data.length - (previous?.data.length ?? 0);
        this.previews.set(key, { path: file.path, data });
        for (const [oldKey, preview] of this.previews) {
          if (this.previewBytes <= PREVIEW_CACHE_BYTES) break;
          this.previews.delete(oldKey);
          this.previewBytes -= preview.data.length;
        }
      }
      return data;
    } finally { ea.destroy(); }
  }

  /** Drop only preview entries owned by the changed path or a moved folder. */
  public invalidatePreview(path: string): void {
    for (const source of this.framePreviews.keys()) if (source === path || source.startsWith(path + "/")) this.framePreviews.delete(source);
    for (const [key, preview] of this.previews) {
      if (preview.path !== path && !preview.path.startsWith(path + "/")) continue;
      this.previews.delete(key);
      this.previewBytes -= preview.data.length;
    }
  }

  /** Reveal a backing file in the system explorer when the desktop adapter exposes that operation. */
  public revealSystem(resource: VisualResource): (() => void) | null {
    const file = this.sourceFile(resource);
    const app = this.plugin.app;
    if (!Platform.isDesktopApp || !file || !(app.vault.adapter instanceof FileSystemAdapter) || !app.showInFolder) return null;
    return () => app.showInFolder?.(file.path);
  }
}
