import { Notice, type TFile } from "obsidian";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "../ExcalidrawView";
import type { MultiOptionConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import { t } from "src/lang/helpers";
import { getSceneFrames, readFrameProperty, resolveThumbnailFrame, writeFrameProperty, FRAME_THUMBNAIL_PROPERTY } from "src/utils/frameMetadata";
import type { ThumbnailRenamePolicy } from "src/types/frameTypes";
import { errorlog } from "src/utils/coreUtils";
import { FrameNavigator } from "src/shared/Dialogs/FrameNavigator";

/** View-owned name tracking, prompts and save-time YAML edits; never owns a scene hook. */
export class FrameThumbnailController {
  private file: TFile | null = null;
  private tracked: { id: string; expected: string; ignored?: string } | null = null;
  private signature = "";
  private generation = 0;
  private running = false;
  private prompt: MultiOptionConfirmationPrompt<unknown> | null = null;
  private patch: { file: TFile; expected: unknown; name: string | undefined; id?: string } | null = null;
  private navigator: FrameNavigator | null = null;

  constructor(private readonly view: ExcalidrawView, private readonly Prompt: typeof MultiOptionConfirmationPrompt) {}

  /** Seed on load; thereafter only actual frame/name or YAML changes invalidate a prompt. */
  update(elements: readonly ExcalidrawElement[], initial = false): void {
    const view = this.view, yaml = readFrameProperty(view.data), frames = getSceneFrames(elements);
    const signature = JSON.stringify([yaml, frames.map(frame => [frame.id, frame.name])]);
    if (initial || this.file !== view.file) {
      this.reset(); this.file = view.file; this.signature = signature;
      const frame = resolveThumbnailFrame(elements, yaml);
      if (frame) this.tracked = { id: frame.id, expected: frame.name };
      return;
    }
    if (signature === this.signature) return;
    this.signature = signature; this.generation++; this.prompt?.close();
    // A Vault write can become visible before forceSave settles. Keep the live
    // frame identity across our own property transition, including rapid undo.
    const ownTransition = this.patch?.file === view.file &&
      (yaml === this.patch.expected || yaml === this.patch.name);
    if (ownTransition) return;
    if (!this.tracked || yaml !== this.tracked.expected) {
      const frame = resolveThumbnailFrame(elements, yaml);
      this.tracked = frame ? { id: frame.id, expected: frame.name } : null;
      return;
    }
    const frame = frames.find(frame => frame.id === this.tracked.id);
    if (!frame) { this.tracked = null; return; }
    void this.reconcile();
  }

  private current(file: TFile, api: ExcalidrawView["excalidrawAPI"]): boolean {
    return this.view.file === file && this.view.excalidrawAPI === api && !this.view.isClosingOrMigrating() &&
      this.view.plugin._loaded && this.view.app.vault.getFileByPath(file.path) === file;
  }

  private async reconcile(): Promise<void> {
    if (this.running || !this.tracked || !this.file) return;
    const track = this.tracked, file = this.file, api = this.view.excalidrawAPI;
    const frame = getSceneFrames(this.view.getViewElements()).find(frame => frame.id === track.id);
    if (!frame?.name?.trim() || frame.name === track.expected || frame.name === track.ignored || !this.current(file, api)) return;
    const generation = this.generation, name = frame.name;
    this.running = true;
    try {
      let policy = this.view.plugin.settings.thumbnailRenamePolicy;
      if (policy === "unset") {
        const prompt = new this.Prompt<ThumbnailRenamePolicy>(this.view.plugin, t("FRAME_RENAME_POLICY"), new Map([
          [t("FRAME_RENAME_ALWAYS"), "always"], [t("FRAME_RENAME_ASK"), "ask"], [t("FRAME_RENAME_NEVER"), "never"],
        ]));
        this.prompt = prompt;
        policy = await prompt.waitForClose;
        this.prompt = null;
        if (!policy) { if (generation === this.generation) track.ignored = name; return; }
        if (generation !== this.generation || !this.current(file, api)) return;
        this.view.plugin.settings.thumbnailRenamePolicy = policy;
        await this.view.plugin.saveSettings();
      }
      if (generation !== this.generation || !this.current(file, api)) return;
      let update = policy === "always";
      if (policy === "ask") {
        const prompt = new this.Prompt<boolean>(this.view.plugin, t("FRAME_RENAME_CONFIRM"));
        this.prompt = prompt; update = await prompt.waitForClose === true; this.prompt = null;
      }
      if (generation !== this.generation || !this.current(file, api)) return;
      track.ignored = name;
      if (update && await this.setThumbnail(name, track.expected, track.id)) {
        track.expected = name; track.ignored = undefined;
      }
    } catch (error: unknown) {
      track.ignored = name;
      errorlog({ where: "FrameThumbnailController.rename", error });
    } finally {
      this.running = false;
      void this.reconcile();
    }
  }

  /** Queue a conditional header edit through this view's existing save coordinator. */
  async setThumbnail(name: string | undefined, expected: unknown = readFrameProperty(this.view.data), id?: string): Promise<boolean> {
    const view = this.view, file = view.file, api = view.excalidrawAPI;
    if (!file || view.compatibilityMode || this.patch || !this.current(file, api)) return false;
    const frame = name === undefined ? null : resolveThumbnailFrame(view.getViewElements(), name);
    if (name !== undefined && !frame) { new Notice(t("FRAME_NEEDS_NAME")); return false; }
    const source = await view.app.vault.read(file);
    if (!this.current(file, api) || source !== view.data || readFrameProperty(source) !== expected) return false;
    const patch = { file, expected, name, id: id ?? frame?.id };
    this.patch = patch;
    try {
      view.setDirty(); await view.forceSave(true, true);
      if (!this.current(file, api)) return false;
      const saved = readFrameProperty(await view.app.vault.read(file)) === name;
      if (saved && this.current(file, api)) {
        if (name === undefined) this.tracked = null;
        else if (this.tracked?.id === patch.id) this.tracked.expected = name;
        else if (patch.id) this.tracked = { id: patch.id, expected: name };
      }
      return saved;
    } finally {
      if (this.patch === patch) this.patch = null;
      void this.reconcile();
    }
  }

  /** Called only with the scene and header captured by the same save operation. */
  applyHeader(header: string, elements: readonly ExcalidrawElement[]): string {
    const patch = this.patch;
    if (!patch || patch.file !== this.view.file || readFrameProperty(header) !== patch.expected) return header;
    if (patch.name !== undefined) {
      const frame = resolveThumbnailFrame(elements, patch.name);
      if (!frame || patch.id && frame.id !== patch.id) return header;
    }
    return writeFrameProperty(header, FRAME_THUMBNAIL_PROPERTY, patch.name);
  }

  /** File changes, migration and unload retire prompts without a late write. */
  reset(): void {
    this.generation++; this.file = null; this.tracked = null; this.patch = null; this.signature = "";
    this.prompt?.close(); this.prompt = null;
    this.navigator?.close(); this.navigator = null;
  }

  /** Open one owned frame navigator in the drawing's active window. */
  navigate(): void {
    this.navigator?.close();
    this.navigator = new FrameNavigator(this.view, () => { this.navigator = null; });
    this.navigator.open();
  }
}
