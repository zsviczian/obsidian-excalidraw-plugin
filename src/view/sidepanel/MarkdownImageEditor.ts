import {
  ButtonComponent,
  MarkdownView,
  Notice,
  Setting,
  type ColorComponent,
  type WorkspaceLeaf,
  type WorkspaceSplit,
  type EventRef,
} from "obsidian";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { ExcalidrawSidepanelTab } from "./SidepanelTab";
import {
  getMarkdownImageRenderSettings,
  getMarkdownImageSource,
  insertMarkdownImage,
  isMarkdownImageElement,
  updateMarkdownImage,
  containsReservedMarkdownImageMarker,
} from "src/shared/MarkdownImage";
import type { MarkdownImageRenderSettings } from "src/types/markdownImageTypes";
import { createLeaf } from "src/utils/customEmbeddableUtils";
import { setStyle } from "src/utils/styleUtils";
import { EmbeddedFile } from "src/shared/EmbeddedFileLoader";
import { ScriptEngine } from "src/shared/Scripts";
import {
  createOrOverwriteFile,
  getNewUniqueFilepath,
  splitFolderAndFilename,
} from "src/utils/fileUtils";
import { t } from "src/lang/helpers";
import { showColorPicker } from "src/shared/Dialogs/ColorPicker";
import { fragWithHTML } from "src/utils/utils";
import { COLOR_NAMES, DEVICE } from "src/constants/constants";

const MARKDOWN_SVG_CONSOLE_COMMAND =
  "ExcalidrawAutomate.mostRecentMarkdownSVG";

const getNativeColorValue = (color: string): string => {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`;
  }
  const namedColor = COLOR_NAMES.get(color.toLowerCase());
  return namedColor && /^#[0-9a-f]{6}/i.test(namedColor)
    ? namedColor.slice(0, 7)
    : "#000000";
};

class MarkdownFragmentView extends MarkdownView {
  private saveFragment: (markdown: string) => Promise<void>;

  constructor(
    leaf: WorkspaceLeaf,
    saveFragment: (markdown: string) => Promise<void>,
  ) {
    super(leaf);
    this.allowNoFile = true;
    this.file = null;
    this.data = "";
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
  private selectionGeneration = 0;
  private lastObservedSelectionId: string | null = null;
  private editorFocusHost: HTMLElement | null = null;
  private editorFocusOutHandler: ((event: FocusEvent) => void) | null = null;
  private scenePointerDocument: Document | null = null;
  private scenePointerDownHandler: ((event: PointerEvent) => void) | null = null;
  private renderStatusEl: HTMLElement | null = null;
  private editorContentDirty = false;
  private editorResizeCleanup: (() => void) | null = null;
  private editorHeight: number | null = null;

  constructor(public view: ExcalidrawView) {}

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
    this.lastObservedSelectionId = element.id;
    this.renderSettings = getMarkdownImageRenderSettings(
      this.view.plugin,
      element,
    );
    const sidepanel = await this.view.plugin.openSidepanel(true);
    if (!sidepanel) {
      return;
    }
    this.tab = await sidepanel.createTab({ title: t("MARKDOWN_IMAGE_TITLE") });
    this.view.setMarkdownImageEditorIsEditing();
    this.tab.onClose = () => this.close();
    this.tab.onFocus = (view) => void this.handleSidepanelFocus(view);
    this.tab.onWindowMigrated = () => void this.rebuildEditor();
    this.renderPanel();
    this.tab.open(true);
  }

  private renderPanel(): void {
    if (!this.tab) {
      return;
    }
    this.removeEditorResizeListener();
    this.tab.clear();
    this.renderStatusEl = null;
    const content = this.tab.contentEl;
    content.addClass("excalidraw-markdown-image-editor");
    if (!this.element || !this.renderSettings) {
      this.renderSelectionPlaceholder();
      return;
    }

    const toolbar = content.createDiv({
      cls: "excalidraw-markdown-image-editor__toolbar",
    });
    new ButtonComponent(toolbar)
      .setIcon("refresh-cw")
      .setTooltip(t("MARKDOWN_IMAGE_RENDER_NOW"))
      .setCta()
      .onClick(() => void this.renderCurrentEditor(true));
    const saveDefaultsButton = new ButtonComponent(toolbar)
      .setIcon("save")
      .setTooltip(t("MARKDOWN_IMAGE_SET_DEFAULT"))
      .onClick(() => this.saveAppearanceDefaults());
    saveDefaultsButton.buttonEl.setAttribute(
      "aria-label",
      t("MARKDOWN_IMAGE_SAVE_DEFAULT_ARIA"),
    );
    this.renderStatusEl = toolbar.createSpan({
      cls: "excalidraw-markdown-image-editor__status",
      text: t("MARKDOWN_IMAGE_UPDATING"),
    });
    this.renderStatusEl.hidden = true;

    const sourceHost = content.createDiv({
      cls: "excalidraw-markdown-image-editor__source",
    });
    void this.renderSourceControls(sourceHost);

    const editorHost = content.createDiv({
      cls: "excalidraw-markdown-image-editor__markdown-view",
    });
    setStyle(editorHost, {
      minHeight: "220px",
      height: this.editorHeight ? `${this.editorHeight}px` : "42vh",
      maxHeight: "75vh",
      overflow: "hidden",
    });
    const editorResizeHandle = content.createDiv({
      cls: "excalidraw-markdown-image-editor__editor-resize-handle",
      attr: {
        role: "separator",
        tabindex: "0",
        "aria-label": t("MARKDOWN_IMAGE_RESIZE_EDITOR"),
        "aria-orientation": "horizontal",
      },
    });
    this.setupEditorResize(editorHost, editorResizeHandle);

    const appearance = content.createDiv({
      cls: "excalidraw-markdown-image-editor__appearance",
    });
    appearance.createEl("h3", {
      cls: "excalidraw-markdown-image-editor__section-title",
      text: t("MARKDOWN_IMAGE_APPEARANCE"),
    });

    let widthSliderEl: HTMLInputElement | null = null;
    let widthTextEl: HTMLInputElement | null = null;
    const setWidth = (width: number, origin: "slider" | "text") => {
      const normalized = Math.min(4000, Math.max(100, Math.round(width)));
      if (!this.renderSettings) {
        return;
      }
      this.renderSettings = { ...this.renderSettings, width: normalized };
      if (origin !== "slider" && widthSliderEl) {
        widthSliderEl.value = String(Math.min(1600, normalized));
      }
      if (origin !== "text" && widthTextEl) {
        widthTextEl.value = String(normalized);
      }
      this.scheduleRender();
    };
    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_WIDTH"))
      .setDesc(t("MARKDOWN_IMAGE_WIDTH_DESC"))
      .addSlider((slider) => {
        widthSliderEl = slider.sliderEl;
        slider
          .setLimits(100, 1600, 10)
          .setValue(Math.min(1600, this.renderSettings.width))
          .setDynamicTooltip()
          .onChange((width) => setWidth(width, "slider"));
      })
      .addText((text) => {
        widthTextEl = text.inputEl;
        text.inputEl.type = "number";
        text.inputEl.min = "100";
        text.inputEl.max = "4000";
        text.inputEl.step = "1";
        text.inputEl.addClass(
          "excalidraw-markdown-image-editor__number-input",
        );
        text.setValue(String(this.renderSettings.width));
        text.onChange((value) => {
          const width = Number.parseInt(value, 10);
          if (!Number.isFinite(width)) {
            return;
          }
          setWidth(width, "text");
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
        if (!this.renderSettings) {
          return;
        }
        this.renderSettings = { ...this.renderSettings, fontFamily };
        void this.view.plugin.initializeFonts();
        this.scheduleRender();
      });
    });

    let fontColorTextEl: HTMLInputElement | null = null;
    let fontColorPicker: ColorComponent | null = null;
    let syncingFontColorPicker = false;
    const setFontColor = (fontColor: string) => {
      if (!this.renderSettings) {
        return;
      }
      this.renderSettings = { ...this.renderSettings, fontColor };
      if (fontColorTextEl && fontColorTextEl.value !== fontColor) {
        fontColorTextEl.value = fontColor;
      }
      if (fontColorPicker !== null) {
        const nativeColor = getNativeColorValue(fontColor);
        if (fontColorPicker.getValue() !== nativeColor) {
          syncingFontColorPicker = true;
          fontColorPicker.setValue(nativeColor);
          syncingFontColorPicker = false;
        }
      }
      this.scheduleRender();
    };
    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_FONT_COLOR"))
      .addText((text) => {
        fontColorTextEl = text.inputEl;
        text.setValue(this.renderSettings.fontColor).onChange(setFontColor);
      })
      .addColorPicker((picker) => {
        fontColorPicker = picker;
        picker
          .setValue(getNativeColorValue(this.renderSettings.fontColor))
          .onChange((fontColor) => {
            if (!syncingFontColorPicker) {
              setFontColor(fontColor);
            }
          });
      })
      .addButton((button) =>
        button
          .setIcon("swatch-book")
          .setTooltip(t("MARKDOWN_IMAGE_FONT_COLOR"))
          .onClick(async () => {
            const selected = await showColorPicker(
              "elementStroke",
              button.buttonEl,
              this.view,
              true,
            );
            if (selected) {
              setFontColor(selected);
            }
          }),
      );

    let borderColorTextEl: HTMLInputElement | null = null;
    let borderColorPicker: ColorComponent | null = null;
    let syncingBorderColorPicker = false;
    const setBorderColor = (color: string) => {
      if (!this.renderSettings) {
        return;
      }
      this.renderSettings = {
        ...this.renderSettings,
        border: { ...this.renderSettings.border, color },
      };
      if (borderColorTextEl && borderColorTextEl.value !== color) {
        borderColorTextEl.value = color;
      }
      if (borderColorPicker !== null) {
        const nativeColor = getNativeColorValue(color);
        if (borderColorPicker.getValue() !== nativeColor) {
          syncingBorderColorPicker = true;
          borderColorPicker.setValue(nativeColor);
          syncingBorderColorPicker = false;
        }
      }
      this.scheduleRender();
    };
    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_BORDER"))
      .addToggle((toggle) => {
        toggle.setValue(this.renderSettings.border.enabled);
        toggle.onChange((enabled) => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = {
            ...this.renderSettings,
            border: { ...this.renderSettings.border, enabled },
          };
          this.scheduleRender();
        });
      })
      .addText((text) => {
        borderColorTextEl = text.inputEl;
        text.setValue(this.renderSettings.border.color).onChange(setBorderColor);
      })
      .addColorPicker((picker) => {
        borderColorPicker = picker;
        picker
          .setValue(getNativeColorValue(this.renderSettings.border.color))
          .onChange((color) => {
            if (!syncingBorderColorPicker) {
              setBorderColor(color);
            }
          });
      });

    new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_THEME"))
      .setDesc(t("MARKDOWN_IMAGE_THEME_DESC"))
      .addDropdown((dropdown) => {
        dropdown.addOption("canvas", t("MARKDOWN_IMAGE_MATCH_CANVAS"));
        dropdown.addOption("light", t("MARKDOWN_IMAGE_LIGHT"));
        dropdown.addOption("dark", t("MARKDOWN_IMAGE_DARK"));
        dropdown.setValue(this.renderSettings.theme);
        dropdown.onChange((theme: "canvas" | "light" | "dark") => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = { ...this.renderSettings, theme };
          this.scheduleRender();
        });
      });

    const developerConsoleHelp = DEVICE.isMobile
      ? t("MARKDOWN_IMAGE_CSS_MOBILE_HELP")
      : t("MARKDOWN_IMAGE_CSS_DESKTOP_HELP").replace(
          "{shortcut}",
          DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i",
        );
    const cssSetting = new Setting(appearance)
      .setName(t("MARKDOWN_IMAGE_CSS"))
      .setDesc(
        fragWithHTML(
          `${t("MARKDOWN_IMAGE_CSS_DESC")} ${developerConsoleHelp}`,
        ),
      )
      .addTextArea((text) => {
        text.setValue(this.renderSettings.css);
        text.inputEl.rows = 5;
        text.onChange((css) => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = { ...this.renderSettings, css };
          this.scheduleRender();
        });
      })
      .addButton((button) => {
        button
          .setIcon("clipboard-copy")
          .setTooltip(t("MARKDOWN_IMAGE_COPY_CSS_COMMAND"))
          .onClick(async () => {
            await navigator.clipboard.writeText(MARKDOWN_SVG_CONSOLE_COMMAND);
            new Notice(t("MARKDOWN_IMAGE_CSS_COMMAND_COPIED"));
          });
        button.buttonEl.setAttribute(
          "aria-label",
          t("MARKDOWN_IMAGE_COPY_CSS_COMMAND"),
        );
      });
    cssSetting.settingEl.addClass(
      "excalidraw-markdown-image-editor__css-setting",
    );

    void this.mountMarkdownView(editorHost);
  }

  private saveAppearanceDefaults(): void {
    if (!this.renderSettings) {
      return;
    }
    this.view.plugin.settings.markdownImageSettings.defaults = {
      ...this.view.plugin.settings.markdownImageSettings.defaults,
      ...this.renderSettings,
      border: { ...this.renderSettings.border },
    };
    void this.view.plugin.saveSettings();
  }

  private renderSelectionPlaceholder(): void {
    if (!this.tab) {
      return;
    }
    this.renderStatusEl = null;
    this.tab.clear();
    this.tab.contentEl.addClass("excalidraw-markdown-image-editor");
    this.tab.contentEl.createDiv({
      cls: "excalidraw-markdown-image-editor__placeholder",
      text: t("MARKDOWN_IMAGE_NO_SELECTION"),
    });
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
          button
            .setIcon("copy")
            .setTooltip(t("MARKDOWN_IMAGE_MAKE_LOCAL"))
            .onClick(() => {
              void this.makeLocalCopy();
            }),
        );
      return;
    }
    new Setting(host).setName(t("MARKDOWN_IMAGE_EXTRACT_LOCAL")).addButton(
      (button) =>
        button
          .setIcon("file-output")
          .setTooltip(t("MARKDOWN_IMAGE_EXTRACT"))
          .onClick(() => {
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

  public handleSceneSelection(
    elements: readonly ExcalidrawElement[],
    selectedElementIds: Record<string, boolean>,
  ): void {
    if (!this.tab || this.closed) {
      return;
    }
    const selectedIds = Object.keys(selectedElementIds ?? {}).filter(
      (id) => selectedElementIds[id],
    );
    const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
    if (selectedId === this.lastObservedSelectionId) {
      return;
    }
    this.lastObservedSelectionId = selectedId;
    const selected =
      selectedId
        ? elements.find((element) => element.id === selectedId)
        : undefined;
    const next =
      selected?.type === "image" && isMarkdownImageElement(this.view, selected)
        ? selected
        : undefined;
    const generation = ++this.selectionGeneration;
    void this.switchElement(next, generation);
  }

  private async switchElement(
    element: ExcalidrawImageElement | undefined,
    generation: number,
  ): Promise<void> {
    this.cancelScheduledRender();
    this.removeEditorFocusListener();
    this.renderSelectionPlaceholder();
    await this.flushAndDetachEditor();
    this.cancelScheduledRender();
    if (generation !== this.selectionGeneration || this.closed) {
      return;
    }
    this.element = element ?? null;
    this.renderSettings = element
      ? getMarkdownImageRenderSettings(this.view.plugin, element)
      : null;
    if (element) {
      this.view.setMarkdownImageEditorIsEditing();
    } else {
      this.view.clearEmbeddableNodeIsEditing();
    }
    this.renderPanel();
  }

  private async handleSidepanelFocus(
    nextView: ExcalidrawView | null,
  ): Promise<void> {
    if (!nextView || nextView === this.view || this.closed) {
      return;
    }
    const generation = ++this.selectionGeneration;
    const previousView = this.view;
    this.cancelScheduledRender();
    this.removeEditorFocusListener();
    this.renderSelectionPlaceholder();
    await this.flushAndDetachEditor();
    if (generation !== this.selectionGeneration || this.closed) {
      return;
    }
    previousView.clearEmbeddableNodeIsEditing();
    this.view = nextView;
    const selectedIds = Object.keys(
      nextView.excalidrawAPI?.getAppState().selectedElementIds ?? {},
    ).filter(
      (id) => nextView.excalidrawAPI.getAppState().selectedElementIds[id],
    );
    const selected =
      selectedIds.length === 1
        ? nextView
            .getViewElements()
            .find((element) => element.id === selectedIds[0])
        : undefined;
    const markdownImage =
      selected?.type === "image" && isMarkdownImageElement(nextView, selected)
        ? selected
        : undefined;
    this.element = markdownImage ?? null;
    this.lastObservedSelectionId = markdownImage?.id ?? null;
    this.renderSettings = markdownImage
      ? getMarkdownImageRenderSettings(nextView.plugin, markdownImage)
      : null;
    if (markdownImage) {
      nextView.setMarkdownImageEditorIsEditing();
    }
    this.renderPanel();
  }

  private async mountMarkdownView(host: HTMLElement): Promise<void> {
    if (!this.element || this.closed) {
      return;
    }
    const element = this.element;
    const source = await getMarkdownImageSource(this.view, element);
    if (!source || this.closed || this.element?.id !== element.id) {
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
      if (
        this.closed ||
        this.element?.id !== element.id ||
        this.editorLeaf !== leaf
      ) {
        leaf.detach();
        return;
      }
      if (leaf.view instanceof MarkdownView) {
        this.editorView = leaf.view;
        this.prepareEditorView(host, leaf.view);
        this.watchEditorChanges();
      }
      return;
    }

    const fragmentView = new MarkdownFragmentView(
      leaf,
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
        this.view.setDirty();
        this.view.setMarkdownImageEditorIsEditing();
      },
    );
    await leaf.open(fragmentView);
    if (
      this.closed ||
      this.element?.id !== element.id ||
      this.editorLeaf !== leaf
    ) {
      leaf.detach();
      return;
    }
    fragmentView.setViewData(source.markdown, true);
    this.editorView = fragmentView;
    this.prepareEditorView(host, fragmentView);
    this.watchEditorChanges();
  }

  private prepareEditorView(host: HTMLElement, editorView: MarkdownView): void {
    editorView.containerEl.addClass("excalidraw-markdown-fragment-view");
    editorView.containerEl
      .querySelectorAll(".inline-title")
      .forEach((title) => title.remove());
    this.removeEditorFocusListener();
    this.editorFocusHost = host;
    this.editorFocusOutHandler = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      const targetWindow = host.ownerDocument.defaultView;
      if (
        nextTarget &&
        targetWindow?.Node &&
        nextTarget instanceof targetWindow.Node &&
        host.contains(nextTarget)
      ) {
        return;
      }
      void this.renderCurrentEditor();
    };
    host.addEventListener("focusout", this.editorFocusOutHandler);

    this.scenePointerDocument = this.view.containerEl.ownerDocument;
    this.scenePointerDownHandler = (event: PointerEvent) => {
      const target = event.target;
      const targetWindow = this.scenePointerDocument?.defaultView;
      if (
        target &&
        targetWindow?.Node &&
        target instanceof targetWindow.Node &&
        this.view.containerEl.contains(target)
      ) {
        void this.renderCurrentEditor();
      }
    };
    this.scenePointerDocument.addEventListener(
      "pointerdown",
      this.scenePointerDownHandler,
      true,
    );
  }

  private removeEditorFocusListener(): void {
    if (this.editorFocusHost && this.editorFocusOutHandler) {
      this.editorFocusHost.removeEventListener(
        "focusout",
        this.editorFocusOutHandler,
      );
    }
    this.editorFocusHost = null;
    this.editorFocusOutHandler = null;
    if (this.scenePointerDocument && this.scenePointerDownHandler) {
      this.scenePointerDocument.removeEventListener(
        "pointerdown",
        this.scenePointerDownHandler,
        true,
      );
    }
    this.scenePointerDocument = null;
    this.scenePointerDownHandler = null;
  }

  private setupEditorResize(
    editorHost: HTMLElement,
    resizeHandle: HTMLElement,
  ): void {
    const setEditorHeight = (height: number) => {
      const viewHeight =
        editorHost.ownerDocument.defaultView?.innerHeight ?? 1000;
      const nextHeight = Math.round(
        Math.min(Math.max(220, viewHeight * 0.75), Math.max(220, height)),
      );
      this.editorHeight = nextHeight;
      editorHost.style.height = `${nextHeight}px`;
    };

    resizeHandle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      event.preventDefault();
      const currentHeight = editorHost.getBoundingClientRect().height;
      setEditorHeight(currentHeight + (event.key === "ArrowDown" ? 20 : -20));
    });

    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.removeEditorResizeListener();
      const pointerId = event.pointerId;
      const startY = event.clientY;
      const startHeight = editorHost.getBoundingClientRect().height;
      const ownerDocument = editorHost.ownerDocument;
      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId === pointerId) {
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
          setEditorHeight(startHeight + moveEvent.clientY - startY);
        }
      };
      const cleanup = () => {
        ownerDocument.removeEventListener("pointermove", onPointerMove);
        ownerDocument.removeEventListener("pointerup", onPointerEnd);
        ownerDocument.removeEventListener("pointercancel", onPointerEnd);
        if (resizeHandle.hasPointerCapture(pointerId)) {
          resizeHandle.releasePointerCapture(pointerId);
        }
        if (this.editorResizeCleanup === cleanup) {
          this.editorResizeCleanup = null;
        }
      };
      const onPointerEnd = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === pointerId) {
          cleanup();
        }
      };
      ownerDocument.addEventListener("pointermove", onPointerMove);
      ownerDocument.addEventListener("pointerup", onPointerEnd);
      ownerDocument.addEventListener("pointercancel", onPointerEnd);
      resizeHandle.setPointerCapture(pointerId);
      this.editorResizeCleanup = cleanup;
    });
  }

  private removeEditorResizeListener(): void {
    this.editorResizeCleanup?.();
    this.editorResizeCleanup = null;
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
        this.editorContentDirty = true;
        this.view.setMarkdownImageEditorIsEditing();
        const source = this.element
          ? this.view.excalidrawData.getMarkdownImage(this.element.fileId)
          : null;
        const markdown = source ? editor.getValue() : undefined;
        if (source && this.element && markdown !== undefined) {
          if (
            containsReservedMarkdownImageMarker(
              this.element.fileId,
              markdown,
            )
          ) {
            return;
          }
          this.view.excalidrawData.setMarkdownImage(this.element.fileId, {
            markdown,
          });
          this.view.setDirty();
        }
      },
    );
  }

  private async renderCurrentEditor(force: boolean = false): Promise<void> {
    if (!force && !this.editorContentDirty) {
      return;
    }
    if (!this.element || !this.editorView) {
      this.scheduleRender(undefined, 0);
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || this.closed) {
      return;
    }
    const markdown = this.editorView.getViewData();
    if (source.source === "external") {
      await this.editorView.save();
      this.scheduleRender(undefined, 0);
      return;
    }
    this.view.excalidrawData.setMarkdownImage(this.element.fileId, {
      markdown,
    });
    this.view.setDirty();
    this.scheduleRender(markdown, 0);
  }

  private scheduleRender(markdown?: string, delay: number = 350): void {
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
    }
    const generation = ++this.renderGeneration;
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.applyRender(generation, markdown);
    }, delay);
  }

  private cancelScheduledRender(): void {
    this.renderGeneration++;
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.setRenderStatus(false);
  }

  private async applyRender(
    generation: number,
    markdown?: string,
  ): Promise<void> {
    if (!this.element || !this.renderSettings || this.closed) {
      return;
    }
    this.setRenderStatus(true);
    try {
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
      const nextElement = this.view
        .getViewElements()
        .find((candidate) => candidate.id === this.element?.id);
      if (nextElement?.type === "image") {
        this.element = nextElement;
      }
      if (
        !this.editorView ||
        liveMarkdown === this.editorView.getViewData()
      ) {
        this.editorContentDirty = false;
      }
    } finally {
      if (generation === this.renderGeneration) {
        this.setRenderStatus(false);
      }
    }
  }

  private setRenderStatus(updating: boolean): void {
    if (this.renderStatusEl?.isConnected) {
      this.renderStatusEl.hidden = !updating;
      this.renderStatusEl.toggleClass("is-updating", updating);
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
    const editorView = this.editorView;
    const editorLeaf = this.editorLeaf;
    this.editorView = null;
    this.editorLeaf = null;
    this.editorRoot = null;
    this.editorContentDirty = false;
    this.removeEditorResizeListener();
    this.removeEditorFocusListener();
    if (this.editorChangeRef) {
      this.view.app.workspace.offref(this.editorChangeRef);
      this.editorChangeRef = null;
    }
    if (editorView) {
      await editorView.save();
    }
    editorLeaf?.detach();
  }

  private close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.selectionGeneration++;
    this.cancelScheduledRender();
    void this.flushAndDetachEditor().finally(() => {
      this.cancelScheduledRender();
      this.view.clearEmbeddableNodeIsEditing();
      this.element = null;
      this.renderSettings = null;
    });
    void this.view.plugin.saveSettings();
    this.tab = null;
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

/** Efficiently forwards selection changes only while the feature panel exists. */
export function handleMarkdownImageEditorSelection(
  view: ExcalidrawView,
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Record<string, boolean>,
): void {
  if (!activeController || activeController.view !== view) {
    return;
  }
  activeController.handleSceneSelection(elements, selectedElementIds);
}
