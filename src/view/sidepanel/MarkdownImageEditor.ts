import {
  MarkdownView,
  Notice,
  Setting,
  TFile,
  type WorkspaceLeaf,
  type WorkspaceSplit,
  type EventRef,
} from "obsidian";
import type { ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { ExcalidrawSidepanelTab } from "./SidepanelTab";
import {
  getMarkdownImageRenderSettings,
  getMarkdownImageSource,
  insertMarkdownImage,
  updateMarkdownImage,
  containsReservedMarkdownImageMarker,
} from "src/shared/MarkdownImage";
import type { MarkdownImageRenderSettings } from "src/types/markdownImageTypes";
import { createLeaf } from "src/utils/customEmbeddableUtils";
import { setStyle } from "src/utils/styleUtils";
import { InlineLinkSuggester } from "src/shared/Suggesters/InlineLinkSuggester";
import type { KeyBlocker } from "src/types/excalidrawAutomateTypes";
import { EmbeddedFile } from "src/shared/EmbeddedFileLoader";
import { ScriptEngine } from "src/shared/Scripts";
import {
  createOrOverwriteFile,
  getNewUniqueFilepath,
  splitFolderAndFilename,
} from "src/utils/fileUtils";
import { t } from "src/lang/helpers";

class MarkdownFragmentView extends MarkdownView {
  private saveFragment: (markdown: string) => Promise<void>;

  constructor(
    leaf: WorkspaceLeaf,
    sourceFile: TFile,
    saveFragment: (markdown: string) => Promise<void>,
  ) {
    super(leaf);
    this.allowNoFile = true;
    this.file = sourceFile;
    this.saveFragment = saveFragment;
  }

  /** Redirects TextFileView autosave to the managed Markdown-image fragment. */
  public async save(): Promise<void> {
    this.data = this.getViewData();
    await this.saveFragment(this.data);
  }
}

class MarkdownImageEditorController {
  private tab: ExcalidrawSidepanelTab | null = null;
  private element: ExcalidrawImageElement | null = null;
  private editorView: MarkdownView | null = null;
  private editorLeaf: WorkspaceLeaf | null = null;
  private editorRoot: WorkspaceSplit | null = null;
  private renderSettings: MarkdownImageRenderSettings | null = null;
  private renderTimer: number | null = null;
  private renderGeneration = 0;
  private closed = false;
  private editorChangeRef: EventRef | null = null;
  private sourceSuggester: KeyBlocker | null = null;

  constructor(private view: ExcalidrawView) {}

  public async open(element?: ExcalidrawImageElement): Promise<void> {
    if (!element) {
      const id = await insertMarkdownImage(this.view);
      if (!id) {
        new Notice(t("MARKDOWN_IMAGE_INSERT_ERROR"));
        return;
      }
      element = this.view
        .getViewElements()
        .find((candidate) => candidate.id === id) as
        | ExcalidrawImageElement
        | undefined;
    }
    if (!element) {
      return;
    }
    this.element = element;
    this.renderSettings = getMarkdownImageRenderSettings(
      this.view.plugin,
      element,
    );
    const sidepanel = await this.view.plugin.openSidepanel(true);
    if (!sidepanel) {
      return;
    }
    this.tab = await sidepanel.createTab({ title: t("MARKDOWN_IMAGE_TITLE") });
    this.tab.onClose = () => this.close();
    this.tab.onWindowMigrated = () => void this.rebuildEditor();
    this.renderPanel();
    this.tab.open(true);
  }

  private renderPanel(): void {
    if (!this.tab || !this.element || !this.renderSettings) {
      return;
    }
    this.tab.clear();
    const content = this.tab.contentEl;
    content.addClass("excalidraw-markdown-image-editor");

    const editorHost = content.createDiv({
      cls: "excalidraw-markdown-image-editor__markdown-view",
    });
    setStyle(editorHost, { minHeight: "280px", height: "45vh" });

    const sourceHost = content.createDiv({
      cls: "excalidraw-markdown-image-editor__source",
    });
    content.insertBefore(sourceHost, editorHost);
    void this.renderSourceControls(sourceHost);

    const appearance = content.createEl("details", {
      cls: "excalidraw-markdown-image-editor__appearance",
    });
    appearance.open =
      this.view.plugin.settings.markdownImageSettings.editor.activeSection ===
      "appearance";
    appearance.createEl("summary", { text: t("MARKDOWN_IMAGE_APPEARANCE") });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_LIVE_PREVIEW"))
      .addToggle((toggle) => {
      toggle.setValue(
        this.view.plugin.settings.markdownImageSettings.editor.livePreview,
      );
      toggle.onChange((livePreview) => {
        this.view.plugin.settings.markdownImageSettings.editor.livePreview =
          livePreview;
        void this.view.plugin.saveSettings();
        if (livePreview) {
          this.scheduleRender(undefined, true);
        }
      });
      });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_REMEMBER_APPEARANCE"))
      .addToggle((toggle) => {
        toggle.setValue(
          this.view.plugin.settings.markdownImageSettings.editor
            .rememberLastUsedAppearance,
        );
        toggle.onChange((remember) => {
          this.view.plugin.settings.markdownImageSettings.editor.rememberLastUsedAppearance =
            remember;
          void this.view.plugin.saveSettings();
        });
      });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_WIDTH"))
      .setDesc(t("MARKDOWN_IMAGE_WIDTH_DESC"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "100";
        text.inputEl.max = "4000";
        text.setValue(String(this.renderSettings.width));
        text.onChange((value) => {
          const width = Number.parseInt(value, 10);
          if (!Number.isFinite(width) || width < 100) {
            return;
          }
          this.renderSettings = { ...this.renderSettings, width };
          this.scheduleRender();
        });
      });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_FONT"))
      .addDropdown((dropdown) => {
      for (const font of [
        "Virgil",
        "Cascadia",
        "Excalifont",
        "Comic Shanns",
        "Liberation Sans",
      ]) {
        dropdown.addOption(font, font);
      }
      this.view.app.vault
        .getFiles()
        .filter(
          (file) =>
            ["ttf", "woff", "woff2", "otf"].contains(file.extension) &&
            !file.path.startsWith(this.view.plugin.settings.fontAssetsPath),
        )
        .forEach((file) => {
          dropdown.addOption(file.path, file.name);
        });
      dropdown.setValue(this.renderSettings.fontFamily);
      dropdown.onChange((fontFamily) => {
        this.renderSettings = { ...this.renderSettings, fontFamily };
        this.scheduleRender();
      });
    });

    new Setting(appearance).setName(t("MARKDOWN_IMAGE_FONT_COLOR")).addText((text) => {
      text.setValue(this.renderSettings.fontColor);
      text.onChange((fontColor) => {
        this.renderSettings = { ...this.renderSettings, fontColor };
        this.scheduleRender();
      });
    });

    new Setting(appearance).setName(t("MARKDOWN_IMAGE_BORDER")).addToggle((toggle) => {
      toggle.setValue(this.renderSettings.border.enabled);
      toggle.onChange((enabled) => {
        this.renderSettings = {
          ...this.renderSettings,
          border: { ...this.renderSettings.border, enabled },
        };
        this.scheduleRender();
      });
    });

    new Setting(appearance).setName(t("MARKDOWN_IMAGE_BORDER_COLOR")).addText((text) => {
      text.setValue(this.renderSettings.border.color);
      text.onChange((color) => {
        this.renderSettings = {
          ...this.renderSettings,
          border: { ...this.renderSettings.border, color },
        };
        this.scheduleRender();
      });
    });

    new Setting(appearance).setName(t("MARKDOWN_IMAGE_THEME")).addDropdown((dropdown) => {
      dropdown.addOption("canvas", t("MARKDOWN_IMAGE_MATCH_CANVAS"));
      dropdown.addOption("light", t("MARKDOWN_IMAGE_LIGHT"));
      dropdown.addOption("dark", t("MARKDOWN_IMAGE_DARK"));
      dropdown.setValue(this.renderSettings.theme);
      dropdown.onChange((theme: "canvas" | "light" | "dark") => {
        this.renderSettings = { ...this.renderSettings, theme };
        this.scheduleRender();
      });
    });

    new Setting(appearance).setName(t("MARKDOWN_IMAGE_CSS")).addTextArea((text) => {
      text.setValue(this.renderSettings.css);
      text.inputEl.rows = 6;
      text.onChange((css) => {
        this.renderSettings = { ...this.renderSettings, css };
        this.scheduleRender();
      });
    });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_USE_APPEARANCE"))
      .addButton((button) =>
        button.setButtonText(t("MARKDOWN_IMAGE_SET_DEFAULT")).onClick(() => {
          this.view.plugin.settings.markdownImageSettings.defaults = {
            ...this.view.plugin.settings.markdownImageSettings.defaults,
            ...this.renderSettings,
            border: { ...this.renderSettings.border },
          };
          void this.view.plugin.saveSettings();
        }),
      );

    new Setting(appearance).addButton((button) =>
      button.setButtonText(t("MARKDOWN_IMAGE_RENDER_NOW")).setCta().onClick(() => {
        this.scheduleRender(undefined, true);
      }),
    );

    appearance.addEventListener("toggle", () => {
      this.view.plugin.settings.markdownImageSettings.editor.activeSection =
        appearance.open ? "appearance" : "content";
      void this.view.plugin.saveSettings();
    });

    void this.mountMarkdownView(editorHost);
  }

  private async renderSourceControls(host: HTMLElement): Promise<void> {
    if (!this.element || this.closed) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || this.closed || !host.isConnected) {
      return;
    }
    if (source.source === "external" && source.embeddedFile) {
      new Setting(host)
        .setName(t("MARKDOWN_IMAGE_EXTERNAL_SOURCE"))
        .setDesc(source.embeddedFile.linkParts.original)
        .addButton((button) =>
          button.setButtonText(t("MARKDOWN_IMAGE_MAKE_LOCAL")).onClick(() => {
            void this.makeLocalCopy();
          }),
        );
      return;
    }

    const setting = new Setting(host)
      .setName(t("MARKDOWN_IMAGE_EXTERNAL_TARGET"))
      .setDesc(t("MARKDOWN_IMAGE_EXTERNAL_DESC"));
    setting.addText((text) => {
      text.setPlaceholder("[[note#heading]]");
      this.sourceSuggester?.close();
      this.sourceSuggester = new InlineLinkSuggester(
        this.view.app,
        this.view.plugin,
        text.inputEl,
        () => this.view.file.path,
        setting.settingEl,
      );
      setting.addButton((button) =>
        button.setButtonText(t("MARKDOWN_IMAGE_USE_SOURCE")).onClick(() => {
          void this.useExternalSource(text.getValue());
        }),
      );
    });
    new Setting(host).setName(t("MARKDOWN_IMAGE_EXTRACT_LOCAL")).addButton(
      (button) =>
        button.setButtonText(t("MARKDOWN_IMAGE_EXTRACT")).onClick(() => {
          void this.extractToNote();
        }),
    );
  }

  private normalizeExternalLink(value: string): string {
    const wikiLink = value.match(/!?\[\[([^\]]+)]]/)?.[1];
    return (wikiLink ?? value).trim();
  }

  private async useExternalSource(value: string): Promise<void> {
    if (!this.element) {
      return;
    }
    const link = this.normalizeExternalLink(value);
    if (!link) {
      return;
    }
    const embeddedFile = new EmbeddedFile(
      this.view.plugin,
      this.view.file.path,
      link,
    );
    if (
      !embeddedFile.file ||
      embeddedFile.file.extension.toLowerCase() !== "md" ||
      this.view.plugin.isExcalidrawFile(embeddedFile.file)
    ) {
      new Notice(t("MARKDOWN_IMAGE_SELECT_SOURCE"));
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    this.cancelScheduledRender();
    const local = this.view.excalidrawData.getMarkdownImage(this.element.fileId);
    this.view.excalidrawData.setFile(this.element.fileId, embeddedFile);
    this.view.excalidrawData.deleteMarkdownImage(this.element.fileId, true);
    const external = await getMarkdownImageSource(this.view, this.element);
    const updated = Boolean(
      external &&
        this.renderSettings &&
        (await updateMarkdownImage(
          this.view,
          this.element,
          external.markdown,
          this.renderSettings,
          "external",
        )),
    );
    if (!updated) {
      this.view.excalidrawData.deleteFile(this.element.fileId);
      if (local) {
        this.view.excalidrawData.setMarkdownImage(this.element.fileId, local);
      }
      new Notice(t("MARKDOWN_IMAGE_CHANGE_SOURCE_ERROR"));
    }
    this.refreshElementReference();
    this.renderPanel();
  }

  private async makeLocalCopy(): Promise<void> {
    if (!this.element || !this.renderSettings) {
      return;
    }
    const previousExternal = await getMarkdownImageSource(this.view, this.element);
    if (!previousExternal || previousExternal.source !== "external") {
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    this.cancelScheduledRender();
    const external = await getMarkdownImageSource(this.view, this.element);
    if (!external || external.source !== "external") {
      return;
    }
    this.view.excalidrawData.setMarkdownImage(this.element.fileId, {
      markdown: external.markdown,
    });
    this.view.excalidrawData.deleteFile(this.element.fileId);
    const updated = await updateMarkdownImage(
      this.view,
      this.element,
      external.markdown,
      this.renderSettings,
      "local",
    );
    if (!updated) {
      this.view.excalidrawData.deleteMarkdownImage(this.element.fileId, true);
      if (previousExternal.embeddedFile) {
        this.view.excalidrawData.setFile(
          this.element.fileId,
          previousExternal.embeddedFile,
        );
      }
      new Notice(t("MARKDOWN_IMAGE_LOCAL_COPY_ERROR"));
    }
    this.refreshElementReference();
    this.renderPanel();
  }

  private async extractToNote(): Promise<void> {
    if (!this.element) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || source.source !== "local") {
      return;
    }
    let path = await ScriptEngine.inputPrompt(
      this.view,
      this.view.plugin,
      this.view.app,
      t("MARKDOWN_IMAGE_EXTRACT_TITLE"),
      t("MARKDOWN_IMAGE_EXTRACT_PATH"),
      t("MARKDOWN_IMAGE_DEFAULT_NOTE"),
    );
    if (!path) {
      return;
    }
    if (!path.toLowerCase().endsWith(".md")) {
      path += ".md";
    }
    try {
      const { folderpath, filename } = splitFolderAndFilename(path);
      path = getNewUniqueFilepath(
        this.view.app.vault,
        filename,
        folderpath,
      );
      const file = await createOrOverwriteFile(
        this.view.app,
        path,
        this.editorView?.getViewData() ?? source.markdown,
      );
      await this.useExternalSource(file.path);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : t("MARKDOWN_IMAGE_UNKNOWN_ERROR");
      new Notice(`${t("MARKDOWN_IMAGE_CREATE_NOTE_ERROR")}: ${message}`);
    }
  }

  private refreshElementReference(): void {
    if (!this.element) {
      return;
    }
    const current = this.view
      .getViewElements()
      .find((candidate) => candidate.id === this.element?.id);
    if (current?.type === "image") {
      this.element = current;
    }
  }

  private async mountMarkdownView(host: HTMLElement): Promise<void> {
    if (!this.element || this.closed) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || this.closed) {
      host.setText(t("MARKDOWN_IMAGE_SOURCE_UNAVAILABLE"));
      return;
    }
    const { leaf, rootSplit } = createLeaf(this.view);
    this.editorLeaf = leaf;
    this.editorRoot = rootSplit;
    rootSplit.containerEl.addClass("mod-visible");
    setStyle(rootSplit.containerEl, { height: "100%", width: "100%" });
    host.appendChild(rootSplit.containerEl);

    if (source.source === "external" && source.embeddedFile?.file) {
      const ref = source.embeddedFile.linkParts.ref
        ? `#${source.embeddedFile.linkParts.isBlockRef ? "^" : ""}${source.embeddedFile.linkParts.ref}`
        : "";
      await leaf.openFile(source.embeddedFile.file, {
        active: false,
        ...(ref ? { eState: { subpath: ref } } : {}),
      });
      if (this.closed) {
        leaf.detach();
        return;
      }
      if (leaf.view instanceof MarkdownView) {
        this.editorView = leaf.view;
        this.watchEditorChanges();
      }
      return;
    }

    const fragmentView = new MarkdownFragmentView(
      leaf,
      this.view.file,
      async (markdown) => {
        if (!this.element) {
          return;
        }
        if (
          containsReservedMarkdownImageMarker(this.element.fileId, markdown)
        ) {
          new Notice(t("MARKDOWN_IMAGE_RESERVED_MARKER"));
          return;
        }
        this.view.excalidrawData.setMarkdownImage(this.element.fileId, {
          markdown,
        });
        this.scheduleRender(markdown);
      },
    );
    await leaf.open(fragmentView);
    if (this.closed) {
      leaf.detach();
      return;
    }
    fragmentView.setViewData(source.markdown, true);
    this.editorView = fragmentView;
    this.watchEditorChanges();
  }

  private watchEditorChanges(): void {
    if (this.editorChangeRef) {
      this.view.app.workspace.offref(this.editorChangeRef);
    }
    this.editorChangeRef = this.view.app.workspace.on(
      "editor-change",
      (editor, info) => {
        if (info !== this.editorView) {
          return;
        }
        const source = this.element
          ? this.view.excalidrawData.getMarkdownImage(this.element.fileId)
          : null;
        this.scheduleRender(source ? editor.getValue() : undefined);
      },
    );
  }

  private scheduleRender(markdown?: string, force: boolean = false): void {
    if (
      !force &&
      !this.view.plugin.settings.markdownImageSettings.editor.livePreview
    ) {
      return;
    }
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
    }
    const generation = ++this.renderGeneration;
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.applyRender(generation, markdown);
    }, 350);
  }

  private cancelScheduledRender(): void {
    this.renderGeneration++;
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  private async applyRender(
    generation: number,
    markdown?: string,
  ): Promise<void> {
    if (!this.element || !this.renderSettings || this.closed) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || generation !== this.renderGeneration || this.closed) {
      return;
    }
    const liveMarkdown =
      markdown ??
      (source.source === "local" && this.editorView
        ? this.editorView.getViewData()
        : source.markdown);
    const updated = await updateMarkdownImage(
      this.view,
      this.element,
      liveMarkdown,
      this.renderSettings,
      source.source,
    );
    if (!updated || generation !== this.renderGeneration) {
      return;
    }
    if (
      this.view.plugin.settings.markdownImageSettings.editor
        .rememberLastUsedAppearance
    ) {
      this.view.plugin.settings.markdownImageSettings.lastUsedAppearance = {
        ...this.renderSettings,
        border: { ...this.renderSettings.border },
      };
    }
    const nextElement = this.view
      .getViewElements()
      .find((candidate) => candidate.id === this.element?.id);
    if (nextElement?.type === "image") {
      this.element = nextElement;
    }
  }

  private async rebuildEditor(): Promise<void> {
    if (!this.tab || this.closed) {
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    this.cancelScheduledRender();
    this.renderPanel();
  }

  private async flushAndDetachEditor(): Promise<void> {
    if (this.editorView) {
      await this.editorView.save();
    }
    this.editorLeaf?.detach();
    this.sourceSuggester?.close();
    this.sourceSuggester = null;
    if (this.editorChangeRef) {
      this.view.app.workspace.offref(this.editorChangeRef);
      this.editorChangeRef = null;
    }
    this.editorLeaf = null;
    this.editorRoot = null;
    this.editorView = null;
  }

  private close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cancelScheduledRender();
    void this.flushAndDetachEditor().finally(() => this.cancelScheduledRender());
    void this.view.plugin.saveSettings();
    this.tab = null;
    this.element = null;
  }

  public dispose(): void {
    this.tab?.close();
    this.close();
  }
}

let activeController: MarkdownImageEditorController | null = null;

/** Opens the feature-owned Markdown-image sidepanel without changing public sidepanel APIs. */
export async function openMarkdownImageEditor(
  view: ExcalidrawView,
  element?: ExcalidrawImageElement,
): Promise<void> {
  activeController?.dispose();
  activeController = new MarkdownImageEditorController(view);
  await activeController.open(element);
}
