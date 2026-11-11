import { Notice } from "obsidian";
import type { ExcalidrawImageElement, FileId } from "@zsviczian/excalidraw/types/element/src/types";
import type { MultiOptionConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import type ExcalidrawView from "../ExcalidrawView";
import type { EmbeddedFile, EmbeddedFilesLoader } from "src/shared/EmbeddedFileLoader";
import { DrawingImagePreviewPopover } from "src/shared/Dialogs/DrawingImagePreviewPopover";
import { CaptureUpdateAction, fileid, getCommonBoundingBox } from "src/constants/constants";
import { getSceneFrames } from "src/utils/frameMetadata";
import { getDrawingPaddingMax } from "src/utils/drawingPadding";
import { rewriteDrawingPreviewLink, type DrawingPreviewChanges } from "src/utils/drawingPreviewLink";
import type { FileData } from "src/types/embeddedFileLoaderTypes";
import { t } from "src/lang/helpers";
import { errorlog } from "src/utils/coreUtils";

/** Constructor injection keeps the existing view/export/loader import graph intact. */
export interface DrawingImagePreviewDependencies {
  Prompt: typeof MultiOptionConfirmationPrompt;
  EmbeddedFile: typeof import("src/shared/EmbeddedFileLoader").EmbeddedFile;
  EmbeddedFilesLoader: typeof import("src/shared/EmbeddedFileLoader").EmbeddedFilesLoader;
  readScene: typeof import("src/utils/drawingPreviewScene").readDrawingPreviewElements;
  scaleLoadedImage: typeof import("src/utils/utils").scaleLoadedImage;
  getExportPadding: typeof import("src/utils/utils").getExportPadding;
}

/** View-owned drawing-image settings; copy-on-write references make settings undoable. */
export class DrawingImagePreviewController {
  private popover: DrawingImagePreviewPopover | null = null;
  private prompt: MultiOptionConfirmationPrompt<unknown> | null = null;
  private readonly loaders = new Set<EmbeddedFilesLoader>();
  private generation = 0;
  private busy = false;

  constructor(private readonly view: ExcalidrawView, private readonly dependencies: DrawingImagePreviewDependencies) {}

  /** Resolve actual drawing-backed image elements, including shared references. */
  getSource(element: ExcalidrawImageElement): EmbeddedFile | null {
    const source = this.view.excalidrawData?.getFile(element.fileId);
    return source?.file && !source.isMarkdownSection && this.view.plugin.isExcalidrawFile(source.file) ? source : null;
  }

  /** Open one selected-image popover, rechecking the view after reading frame names. */
  async open(elementId: string): Promise<void> {
    if (this.busy) return;
    this.reset();
    const view = this.view, api = view.excalidrawAPI, file = view.file, generation = this.generation;
    if (!api || !file) return;
    const current = () => generation === this.generation && view.file === file && view.excalidrawAPI === api &&
      view.plugin._loaded && !view.isClosingOrMigrating() && !api.getAppState().viewModeEnabled;
    const element = view.getViewElements().find((el): el is ExcalidrawImageElement => el.type === "image" && el.id === elementId);
    const source = element && this.getSource(element);
    if (!source || !current()) return;
    const originalLink = source.linkParts.original;
    const ownsImage = () => current() && source.linkParts.original === originalLink &&
      view.excalidrawData.getFile(element.fileId) === source &&
      view.getViewElements().some(el => el.id === elementId && el.type === "image" && el.fileId === element.fileId);
    try {
      const elements = await this.dependencies.readScene(view.plugin.app.vault, source.file);
      if (!ownsImage()) return;
      this.popover = new DrawingImagePreviewPopover(view, source, getSceneFrames(elements), this.dependencies.getExportPadding(view.plugin, source.file),
        getDrawingPaddingMax(elements, originalLink, getCommonBoundingBox),
        ownsImage,
        link => this.load(source, link),
        changes => this.apply(elementId, source, changes, ownsImage),
        () => { this.popover = null; });
      this.popover.load();
    } catch (error: unknown) { if (current()) { errorlog({ where: "DrawingImagePreviewController.open", error }); new Notice(t("ERROR_TRY_AGAIN")); } }
  }

  private async load(source: EmbeddedFile, link: string) {
    const descriptor = new this.dependencies.EmbeddedFile(this.view.plugin, this.view.file.path, link, source.colorMap ? JSON.stringify(source.colorMap) : undefined);
    const loader = new this.dependencies.EmbeddedFilesLoader(this.view.plugin, this.view.excalidrawAPI.getAppState().theme === "dark");
    this.loaders.add(loader);
    try {
      const image = await loader.getObsidianImage(descriptor, 0);
      if (!image || loader.terminate) throw Error("Drawing preview was retired");
      return { descriptor, image };
    } finally { this.loaders.delete(loader); loader.terminate = true; }
  }

  private async apply(elementId: string, source: EmbeddedFile, changes: DrawingPreviewChanges, current: () => boolean): Promise<boolean> {
    if (this.busy || !current()) return false;
    const view = this.view, api = view.excalidrawAPI;
    const copies = view.getViewElements().filter((el): el is ExcalidrawImageElement =>
      el.type === "image" && this.getSource(el)?.file === source.file);
    let targets = copies.filter(el => el.id === elementId);
    this.busy = true;
    try {
      if (copies.length > 1) {
        const message = t("PREVIEW_SHARED_HELP").replace("{drawing}", source.file.basename).replace("{count}", String(copies.length));
        const escaped = message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const prompt = new this.dependencies.Prompt<"all" | "one" | null>(view.plugin, escaped, new Map<string, "all" | "one" | null>([
          [t("PREVIEW_ALL").replace("{count}", String(copies.length)), "all"], [t("PREVIEW_ONLY"), "one"], [t("PROMPT_BUTTON_CANCEL"), null],
        ]), t("PREVIEW_ONLY"));
        prompt.titleEl.setText(t("PREVIEW_SHARED_TITLE"));
        this.prompt = prompt; const choice = await prompt.waitForClose; this.prompt = null;
        if (!choice || !current()) return false;
        if (choice === "all") targets = copies;
      }
      const snapshots = targets.map(el => ({ element: el, source: this.getSource(el), version: el.version, nonce: el.versionNonce }));
      const prepared = new Map<string, Awaited<ReturnType<DrawingImagePreviewController["load"]>> & { id: FileId }>();
      const replacements = new Map<string, ExcalidrawImageElement>(), files: FileData[] = [];
      for (const snapshot of snapshots) {
        if (!current()) return false;
        const link = rewriteDrawingPreviewLink(snapshot.source.linkParts.original, changes);
        if (link === null) throw Error("Invalid drawing preview link");
        if (link === snapshot.source.linkParts.original) continue;
        const group = link + "\n" + JSON.stringify(snapshot.source.colorMap);
        let data = prepared.get(group);
        if (!data) {
          const loaded = await this.load(snapshot.source, link);
          if (!current()) return false;
          data = { ...loaded, id: fileid() as FileId }; prepared.set(group, data);
          files.push({ ...loaded.image, id: data.id, shouldScale: loaded.descriptor.shouldScale() });
        }
        const element = structuredClone(snapshot.element);
        replacements.set(element.id, { ...element, fileId: data.id, version: element.version + 1 });
      }
      if (!current()) return false;
      const elements = view.getViewElements();
      if (!snapshots.every(snapshot => elements.some(el => el.id === snapshot.element.id && el.type === "image" &&
        el.fileId === snapshot.element.fileId && el.version === snapshot.version && el.versionNonce === snapshot.nonce &&
        view.excalidrawData.getFile(el.fileId) === snapshot.source))) throw Error("Drawing image changed during configuration");
      const resized = this.dependencies.scaleLoadedImage({ elements: elements.map(el => replacements.get(el.id) ?? el) }, files);
      // No await after registration: scene IDs, intrinsic data and geometry form one undo step.
      for (const data of prepared.values()) {
        data.descriptor.setImage({ imgBase64: data.image.dataURL, mimeType: data.image.mimeType, size: data.image.size,
          isDark: api.getAppState().theme === "dark", isSVGwithBitmap: data.image.hasSVGwithBitmap });
        view.excalidrawData.setFile(data.id, data.descriptor);
      }
      api.addFiles({ files, skipSvgNormalization: new Set(files.map(file => file.id)) });
      view.updateScene({ elements: resized.scene.elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      view.setDirty(); return true;
    } catch (error: unknown) { if (current()) { errorlog({ where: "DrawingImagePreviewController.apply", error }); new Notice(t("ERROR_TRY_AGAIN")); } return false; }
    finally { this.busy = false; }
  }

  /** Retire pending renders, prompts and controls on file change, migration or unload. */
  reset(): void {
    this.generation++; this.popover?.unload(); this.popover = null;
    this.prompt?.close(); this.prompt = null;
    for (const loader of this.loaders) loader.terminate = true;
    this.loaders.clear();
  }
}
