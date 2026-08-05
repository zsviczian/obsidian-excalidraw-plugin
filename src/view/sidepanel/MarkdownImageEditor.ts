import {
  addIcon,
  ButtonComponent,
  MarkdownView,
  Notice,
  resolveSubpath,
  Setting,
  type App,
  type ColorComponent,
  type TFile,
  type WorkspaceLeaf,
  type EventRef,
  type MarkdownFileInfo,
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
  duplicateLocalMarkdownImageElement,
  isMarkdownImageElement,
  updateMarkdownImage,
  containsReservedMarkdownImageMarker,
  type MarkdownImageSourceData,
} from "src/shared/MarkdownImage";
import type { MarkdownImageRenderSettings } from "src/types/markdownImageTypes";
import {
  createLeaf,
  patchMobileView,
} from "src/utils/customEmbeddableUtils";
import { setStyle } from "src/utils/styleUtils";
import { EmbeddedFile } from "src/shared/EmbeddedFileLoader";
import {
  createOrOverwriteFile,
  getNewUniqueFilepath,
  splitFolderAndFilename,
} from "src/utils/fileUtils";
import { getAttachmentsFolderAndFilePath } from "src/utils/pathUtils";
import { t } from "src/lang/helpers";
import { showColorPicker } from "src/shared/Dialogs/ColorPicker";
import { getBinaryFileFromDataURL } from "src/utils/utils";
import {
  COLOR_NAMES,
  DEVICE,
  VIEW_TYPE_EXCALIDRAW,
} from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { errorlog } from "src/utils/coreUtils";
import { getSelectableFontOptions } from "src/utils/fontUtils";
import { FontPickerComponent } from "src/shared/components/FontPickerComponent";
import {
  selectMarkdownBlockSubpath,
  selectMarkdownHeadingSubpath,
} from "src/shared/Suggesters/markdownSubpathSuggester";
import {
  CSSCodeEditor,
  MARKDOWN_IMAGE_CSS_BOILERPLATE,
  MARKDOWN_IMAGE_CSS_BOILERPLATE_MARKER,
  TRANSCLUSION_CSS_BOILERPLATE,
  TRANSCLUSION_CSS_BOILERPLATE_MARKER,
} from "./CSSCodeEditor";
import {
  BLOCK_REFERENCE_ICON_ID,
  BLOCK_REFERENCE_ICON_REGISTRY_SVG,
} from "src/constants/blockReferenceIcon";
import { FileAndFolderSelectorModal } from "src/shared/Dialogs/FileAndFolderSelectorModal";

let blockReferenceIconRegistered = false;

type MarkdownImageAppearanceStyle = Pick<
  MarkdownImageRenderSettings,
  "fontFamily" | "fontColor" | "border" | "css"
>;

type AppearanceControlsOptions = {
  scope: "image" | "transclusion";
  cssName: string;
  cssDescription: string | DocumentFragment;
  cssEditorAria: string;
  cssBoilerplate: string;
  cssBoilerplateMarker: string;
  includeSVGCopy: boolean;
};

const setBlockReferenceIcon = (button: ButtonComponent): void => {
  if (!blockReferenceIconRegistered) {
    addIcon(
      BLOCK_REFERENCE_ICON_ID,
      BLOCK_REFERENCE_ICON_REGISTRY_SVG,
    );
    blockReferenceIconRegistered = true;
  }
  button.setIcon(BLOCK_REFERENCE_ICON_ID);
};

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
  private closing = false;

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

  /**
   * Marks this fragment as done - called right after flushAndDetachEditor() has explicitly
   * flushed it and is about to detach its leaf. leaf.detach() is not awaited, and Obsidian's own
   * TextFileView teardown can still invoke save() on this instance later, after its CodeMirror
   * editor has already been torn down; at that point getViewData() returns an empty string, and
   * without this guard that empty content would silently overwrite the just-flushed Markdown.
   */
  public markClosing(): void {
    this.closing = true;
  }

  /** Redirects TextFileView autosave to the managed Markdown-image fragment. */
  public async save(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.data = this.getViewData();
    await this.saveFragment(this.data);
  }
}

class MarkdownImageEditorController {
  private readonly app: App;
  private readonly plugin: ExcalidrawPlugin;
  private ownerLeaf: WorkspaceLeaf;
  private ownerFile: TFile | null;
  private tab: ExcalidrawSidepanelTab | null = null;
  private element: ExcalidrawImageElement | null = null;
  private editorView: MarkdownView | null = null;
  private editorLeaf: WorkspaceLeaf | null = null;
  private renderSettings: MarkdownImageRenderSettings | null = null;
  private renderTimer: number | null = null;
  private renderGeneration = 0;
  private closed = false;
  private editorChangeRef: EventRef | null = null;
  private selectionGeneration = 0;
  private initializing = false;
  private lastObservedSelectionId: string | null = null;
  private editorFocusHost: HTMLElement | null = null;
  private editorFocusInHandler: (() => void) | null = null;
  private editorFocusOutHandler: ((event: FocusEvent) => void) | null = null;
  private editorCommandView: MarkdownView | null = null;
  private previousActiveEditor: MarkdownFileInfo | null = null;
  private editorCommandRoutingActive = false;
  private editorCommandScopeActive = false;
  private focusEditorOnMount = false;
  private sidepanelRevealComplete = false;
  private editorFocusStabilizationWindow: Window | null = null;
  private editorFocusStabilizationFrame: number | null = null;
  private scenePointerDocument: Document | null = null;
  private scenePointerDownHandler: ((event: PointerEvent) => void) | null = null;
  private renderStatusEl: HTMLElement | null = null;
  private editorContentDirty = false;
  private editorRenderPromise: Promise<void> | null = null;
  private editorResizeCleanup: (() => void) | null = null;
  private editorHeight: number | null = null;
  private ownerInvalid = false;
  private ownerInvalidation: Promise<void> | null = null;
  private ownerAttachmentGeneration = 0;
  private selectionSwitchQueue: Promise<void> = Promise.resolve();
  private activeLeafChangeRef: EventRef | null = null;
  private cssEditors: CSSCodeEditor[] = [];
  private fontPickers: FontPickerComponent[] = [];
  private focusOwnerButtonEl: HTMLButtonElement | null = null;
  private ownerStatusEl: HTMLElement | null = null;
  private mobileViewPatchCleanup: (() => void) | null = null;

  constructor(public view: ExcalidrawView) {
    this.app = view.app;
    this.plugin = view.plugin;
    this.ownerLeaf = view.leaf;
    this.ownerFile = view.file;
  }

  private get ownerFilePath(): string {
    return this.ownerFile?.path ?? "";
  }

  private get ownerFileName(): string {
    return this.ownerFile?.basename ?? this.ownerFilePath;
  }

  public async open(element?: ExcalidrawImageElement): Promise<boolean> {
    if (!this.ensureOwnerValid()) {
      return false;
    }
    this.initializing = true;
    this.focusEditorOnMount = true;
    try {
      // Establish and reveal the feature tab before inserting a new image. The
      // insertion renders Markdown asynchronously; leaving the prior script tab
      // active during that work lets its delayed focus handlers win the race.
      patchMobileView(this.view);
      const sidepanel = await this.view.plugin.openSidepanel(false);
      if (!sidepanel || !this.ensureOwnerValid()) {
        return false;
      }
      this.tab = await sidepanel.createTab({
        title: t("MARKDOWN_IMAGE_TITLE"),
      });
      this.tab.onClose = () => void this.close();
      this.tab.onFocus = (view) => void this.handleSidepanelFocus(view);
      this.tab.onWindowMigrated = () => void this.rebuildEditor();
      this.tab.onExcalidrawViewClosed = () => void this.invalidateOwner(false);
      this.watchActiveExcalidrawView();
      this.renderPanel();
      await this.app.workspace.revealLeaf(sidepanel.leaf);
      if (!this.tab || this.closed || !this.ensureOwnerValid()) {
        return false;
      }
      this.sidepanelRevealComplete = true;

      if (!element) {
        element = await insertMarkdownImage(this.view);
        if (!this.ensureOwnerValid()) {
          return false;
        }
        if (!element) {
          new Notice(t("MARKDOWN_IMAGE_INSERT_ERROR"));
          return false;
        }
      }

      this.element = element;
      this.lastObservedSelectionId = element.id;
      this.renderSettings = getMarkdownImageRenderSettings(
        this.view.plugin,
        element,
      );
      this.view.setMarkdownImageEditorIsEditing();
      this.renderPanel();
      this.focusEditorIfRequested();
      return true;
    } finally {
      this.initializing = false;
    }
  }

  public isEditingElement(
    view: ExcalidrawView,
    element: ExcalidrawImageElement,
  ): boolean {
    return (
      !this.closed &&
      this.tab !== null &&
      this.view === view &&
      this.element?.id === element.id &&
      this.isOwnerViewValid()
    );
  }

  public async revealAndFocus(): Promise<void> {
    if (!this.tab || !this.ensureOwnerValid()) {
      return;
    }
    const sidepanel = await this.plugin.openSidepanel(false);
    if (!sidepanel || !this.tab || !this.ensureOwnerValid()) {
      return;
    }
    this.focusEditorOnMount = true;
    this.sidepanelRevealComplete = false;
    this.tab.open(false);
    await this.app.workspace.revealLeaf(sidepanel.leaf);
    if (!this.tab || !this.ensureOwnerValid()) {
      return;
    }
    this.sidepanelRevealComplete = true;
    this.focusEditorIfRequested();
  }

  private renderPanel(): void {
    if (!this.tab) {
      return;
    }
    if (!this.ensureOwnerValid()) {
      return;
    }
    this.removeEditorResizeListener();
    this.destroyCSSEditors();
    this.destroyFontPickers();
    this.focusOwnerButtonEl = null;
    this.ownerStatusEl = null;
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
    this.renderOwnerControls(toolbar);
    new ButtonComponent(toolbar)
      .setIcon("refresh-cw")
      .setTooltip(t("MARKDOWN_IMAGE_RENDER_NOW"))
      .setCta()
      .onClick(() => void this.renderCurrentEditor(true));
    const saveDefaultsButton = new ButtonComponent(toolbar)
      .setButtonText(t("MARKDOWN_IMAGE_SET_DEFAULT"))
      .setTooltip(t("MARKDOWN_IMAGE_SET_DEFAULT"))
      .onClick(() => void this.saveAppearanceDefaults());
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
      .setClass("excalidraw-markdown-image-editor__setting--wide")
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
      .setClass("excalidraw-markdown-image-editor__setting--wide")
      .setName(t("MARKDOWN_IMAGE_BOTTOM_PADDING"))
      .setDesc(t("MARKDOWN_IMAGE_BOTTOM_PADDING_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.renderSettings.paddingBottom)
          .setDynamicTooltip()
          .onChange((paddingBottom) => {
            if (!this.renderSettings) {
              return;
            }
            this.renderSettings = {
              ...this.renderSettings,
              paddingBottom,
            };
            this.scheduleRender();
          }),
      );

    this.renderAppearanceControls(appearance, {
      scope: "image",
      cssName: t("MARKDOWN_IMAGE_CSS"),
      cssDescription: `${t("MARKDOWN_IMAGE_CSS_DESC")} ${t("MARKDOWN_IMAGE_CSS_IMPORTANT_HINT")}`,
      cssEditorAria: t("MARKDOWN_IMAGE_CSS_EDITOR_ARIA"),
      cssBoilerplate: MARKDOWN_IMAGE_CSS_BOILERPLATE,
      cssBoilerplateMarker: MARKDOWN_IMAGE_CSS_BOILERPLATE_MARKER,
      includeSVGCopy: true,
    });

    const transclusionToggleSetting = new Setting(content)
      .setName(t("MARKDOWN_IMAGE_TRANSCLUSION_DIFFERENT_STYLE"))
      .setDesc(t("MARKDOWN_IMAGE_TRANSCLUSION_DIFFERENT_STYLE_DESC"))
      .addToggle((toggle) => {
        toggle.setValue(this.renderSettings.transclusion.enabled);
        toggle.onChange((enabled) => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = {
            ...this.renderSettings,
            transclusion: {
              ...this.renderSettings.transclusion,
              enabled,
            },
          };
          transclusionAppearance.hidden = !enabled;
          this.scheduleRender();
        });
      });
    transclusionToggleSetting.settingEl.addClass(
      "excalidraw-markdown-image-editor__transclusion-toggle",
    );

    const transclusionAppearance = content.createDiv({
      cls: "excalidraw-markdown-image-editor__appearance excalidraw-markdown-image-editor__transclusion-appearance",
    });
    transclusionAppearance.hidden =
      !this.renderSettings.transclusion.enabled;
    transclusionAppearance.createEl("h3", {
      cls: "excalidraw-markdown-image-editor__section-title",
      text: t("MARKDOWN_IMAGE_TRANSCLUSION_APPEARANCE"),
    });
    transclusionAppearance.createDiv({
      cls: "excalidraw-markdown-image-editor__section-description",
      text: t("MARKDOWN_IMAGE_TRANSCLUSION_APPEARANCE_DESC"),
    });

    this.renderAppearanceControls(transclusionAppearance, {
      scope: "transclusion",
      cssName: t("MARKDOWN_IMAGE_TRANSCLUSION_CSS"),
      cssDescription: `${t("MARKDOWN_IMAGE_TRANSCLUSION_CSS_DESC")} ${t("MARKDOWN_IMAGE_CSS_IMPORTANT_HINT")}`,
      cssEditorAria: t("MARKDOWN_IMAGE_TRANSCLUSION_CSS_EDITOR_ARIA"),
      cssBoilerplate: TRANSCLUSION_CSS_BOILERPLATE,
      cssBoilerplateMarker: TRANSCLUSION_CSS_BOILERPLATE_MARKER,
      includeSVGCopy: false,
    });

    void this.mountMarkdownView(editorHost);
  }

  private getAppearanceStyle(
    scope: AppearanceControlsOptions["scope"],
  ): MarkdownImageAppearanceStyle | null {
    if (!this.renderSettings) {
      return null;
    }
    return scope === "image"
      ? this.renderSettings
      : this.renderSettings.transclusion;
  }

  private updateAppearanceStyle(
    scope: AppearanceControlsOptions["scope"],
    changes: Partial<MarkdownImageAppearanceStyle>,
  ): void {
    if (!this.renderSettings) {
      return;
    }
    const current = this.getAppearanceStyle(scope);
    if (!current) {
      return;
    }
    const next = {
      ...current,
      ...changes,
      border: changes.border ? { ...changes.border } : { ...current.border },
    };
    this.renderSettings =
      scope === "image"
        ? { ...this.renderSettings, ...next }
        : {
            ...this.renderSettings,
            transclusion: { ...this.renderSettings.transclusion, ...next },
          };
    this.scheduleRender();
  }

  private renderAppearanceControls(
    host: HTMLElement,
    options: AppearanceControlsOptions,
  ): void {
    const style = this.getAppearanceStyle(options.scope);
    if (!style || !this.renderSettings) {
      return;
    }

    const fontSetting = new Setting(host)
      .setClass("excalidraw-markdown-image-editor__setting--font")
      .setName(t("MARKDOWN_IMAGE_FONT"));
    const fontPicker = new FontPickerComponent(
      fontSetting.controlEl,
      this.view.app,
      () =>
        getSelectableFontOptions(
          this.view.app,
          this.view.plugin.settings.fontAssetsPath,
        ),
    )
      .setAriaLabel(t("MARKDOWN_IMAGE_FONT"))
      .setValue(style.fontFamily)
      .onChange((fontFamily) => {
        this.updateAppearanceStyle(options.scope, { fontFamily });
      });
    this.fontPickers.push(fontPicker);

    let fontColorTextEl: HTMLInputElement | null = null;
    let fontColorPicker: ColorComponent | null = null;
    let syncingFontColorPicker = false;
    const setFontColor = (fontColor: string) => {
      this.updateAppearanceStyle(options.scope, { fontColor });
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
    };
    new Setting(host)
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setName(t("MARKDOWN_IMAGE_FONT_COLOR"))
      .addText((text) => {
        fontColorTextEl = text.inputEl;
        text.setValue(style.fontColor).onChange(setFontColor);
        text.inputEl.addEventListener("blur", () => {
          if (text.inputEl.value.trim() === "") {
            setFontColor("black");
          }
        });
      })
      .addColorPicker((picker) => {
        fontColorPicker = picker;
        picker
          .setValue(getNativeColorValue(style.fontColor))
          .onChange((fontColor) => {
            if (!syncingFontColorPicker) {
              setFontColor(fontColor);
            }
          });
      })
      .addButton((button) =>
        button
          .setIcon("swatch-book")
          .setClass("excalidraw-markdown-image-editor__compact-button")
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
      const current = this.getAppearanceStyle(options.scope);
      if (!current) {
        return;
      }
      this.updateAppearanceStyle(options.scope, {
        border: { ...current.border, color },
      });
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
    };
    new Setting(host)
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setClass("excalidraw-markdown-image-editor__setting--border")
      .setName(t("MARKDOWN_IMAGE_BORDER"))
      .addToggle((toggle) =>
        toggle.setValue(style.border.enabled).onChange((enabled) => {
          const current = this.getAppearanceStyle(options.scope);
          if (current) {
            this.updateAppearanceStyle(options.scope, {
              border: { ...current.border, enabled },
            });
          }
        }),
      )
      .addText((text) => {
        borderColorTextEl = text.inputEl;
        text.setValue(style.border.color).onChange(setBorderColor);
      })
      .addColorPicker((picker) => {
        borderColorPicker = picker;
        picker
          .setValue(getNativeColorValue(style.border.color))
          .onChange((color) => {
            if (!syncingBorderColorPicker) {
              setBorderColor(color);
            }
          });
      })
      .addButton((button) =>
        button
          .setIcon("swatch-book")
          .setClass("excalidraw-markdown-image-editor__compact-button")
          .setTooltip(t("MARKDOWN_IMAGE_BORDER_COLOR"))
          .onClick(async () => {
            const selected = await showColorPicker(
              "elementStroke",
              button.buttonEl,
              this.view,
              true,
            );
            if (selected) {
              setBorderColor(selected);
            }
          }),
      );

    const cssSetting = new Setting(host)
      .setName(options.cssName)
      .setDesc(options.cssDescription);
    cssSetting.settingEl.addClass(
      "excalidraw-markdown-image-editor__css-setting",
    );
    const cssEditorHost = cssSetting.controlEl.createDiv({
      cls: "excalidraw-markdown-image-editor__css-editor",
    });
    const cssEditor = new CSSCodeEditor(
      cssEditorHost,
      style.css,
      options.cssEditorAria,
      (css) => this.updateAppearanceStyle(options.scope, { css }),
    );
    this.cssEditors.push(cssEditor);
    const cssActions = cssSetting.controlEl.createDiv({
      cls: "excalidraw-markdown-image-editor__css-actions",
    });
    const insertCSSBoilerplateButton = new ButtonComponent(cssActions)
      .setIcon("file-code-2")
      .setClass("excalidraw-markdown-image-editor__css-action-button")
      .setTooltip(t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"))
      .onClick(() =>
        cssEditor.insertBoilerplate(
          options.cssBoilerplate,
          options.cssBoilerplateMarker,
        ),
      );
    insertCSSBoilerplateButton.buttonEl.setAttribute(
      "aria-label",
      t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"),
    );
    if (options.includeSVGCopy) {
      const copySVGButton = new ButtonComponent(cssActions)
        .setIcon("clipboard-copy")
        .setClass("excalidraw-markdown-image-editor__css-action-button")
        .setTooltip(t("MARKDOWN_IMAGE_COPY_SVG"))
        .onClick(() => void this.copyCurrentMarkdownSVG());
      copySVGButton.buttonEl.setAttribute(
        "aria-label",
        t("MARKDOWN_IMAGE_COPY_SVG"),
      );
    }
  }

  private async copyCurrentMarkdownSVG(): Promise<void> {
    if (!this.ensureOwnerValid() || !this.element?.fileId) {
      new Notice(t("MARKDOWN_IMAGE_SVG_COPY_ERROR"));
      return;
    }
    try {
      const file = this.view.excalidrawAPI?.getFiles()[this.element.fileId];
      if (!file?.dataURL.startsWith("data:image/svg+xml")) {
        new Notice(t("MARKDOWN_IMAGE_SVG_COPY_ERROR"));
        return;
      }
      const data = await getBinaryFileFromDataURL(file.dataURL);
      const clipboard =
        this.tab?.contentEl.ownerDocument.defaultView?.navigator.clipboard ??
        navigator.clipboard;
      if (!data || !clipboard) {
        new Notice(t("MARKDOWN_IMAGE_SVG_COPY_ERROR"));
        return;
      }
      await clipboard.writeText(new TextDecoder().decode(data));
      new Notice(t("MARKDOWN_IMAGE_SVG_COPIED"));
    } catch (error: unknown) {
      errorlog({
        where: "MarkdownImageEditor.copyCurrentMarkdownSVG",
        error,
      });
      new Notice(t("MARKDOWN_IMAGE_SVG_COPY_ERROR"));
    }
  }

  private async saveAppearanceDefaults(): Promise<void> {
    if (!this.ensureOwnerValid() || !this.renderSettings) {
      return;
    }
    this.view.plugin.settings.markdownImageSettings.defaults = {
      ...this.view.plugin.settings.markdownImageSettings.defaults,
      ...this.renderSettings,
      border: { ...this.renderSettings.border },
      transclusion: {
        ...this.renderSettings.transclusion,
        border: { ...this.renderSettings.transclusion.border },
      },
    };
    await this.view.plugin.saveSettings();
    new Notice(t("MARKDOWN_IMAGE_DEFAULT_SAVED"), 2500);
  }

  private renderSelectionPlaceholder(): void {
    if (!this.tab) {
      return;
    }
    this.renderStatusEl = null;
    this.destroyCSSEditors();
    this.destroyFontPickers();
    this.focusOwnerButtonEl = null;
    this.ownerStatusEl = null;
    this.tab.clear();
    this.tab.contentEl.addClass("excalidraw-markdown-image-editor");
    if (this.isOwnerViewValid()) {
      const toolbar = this.tab.contentEl.createDiv({
        cls: "excalidraw-markdown-image-editor__toolbar",
      });
      this.renderOwnerControls(toolbar);
    }
    this.tab.contentEl.createDiv({
      cls: "excalidraw-markdown-image-editor__placeholder",
      text: t("MARKDOWN_IMAGE_NO_SELECTION"),
    });
  }

  private renderOwnerControls(toolbar: HTMLElement): void {
    const ownerEl = toolbar.createSpan({
      cls: "excalidraw-markdown-image-editor__owner",
      text: this.ownerFileName,
    });
    ownerEl.setAttribute(
      "title",
      t("MARKDOWN_IMAGE_ATTACHED_TO").replace("{file}", this.ownerFilePath),
    );
    this.ownerStatusEl = ownerEl;
    const focusOwnerLabel = t("MARKDOWN_IMAGE_FOCUS_OWNER").replace(
      "{file}",
      this.ownerFilePath,
    );
    const focusOwnerButton = new ButtonComponent(toolbar)
      .setIcon("locate-fixed")
      .setTooltip(focusOwnerLabel)
      .onClick(() => void this.focusOwner());
    focusOwnerButton.buttonEl.setAttribute("aria-label", focusOwnerLabel);
    this.focusOwnerButtonEl = focusOwnerButton.buttonEl;
    this.updateFocusOwnerButtonVisibility();
  }

  private updateFocusOwnerButtonVisibility(): void {
    if (!this.focusOwnerButtonEl?.isConnected) {
      return;
    }
    const ownerIsFocused =
      this.app.workspace.getMostRecentLeaf() === this.ownerLeaf;
    this.focusOwnerButtonEl.hidden = ownerIsFocused;
    if (this.ownerStatusEl?.isConnected) {
      this.ownerStatusEl.hidden = ownerIsFocused;
    }
  }

  private renderOwnerUnavailablePlaceholder(): void {
    if (!this.tab) {
      return;
    }
    this.renderStatusEl = null;
    this.destroyCSSEditors();
    this.destroyFontPickers();
    this.focusOwnerButtonEl = null;
    this.ownerStatusEl = null;
    this.tab.clear();
    this.tab.setDisabled(false);
    this.tab.contentEl.addClass("excalidraw-markdown-image-editor");
    this.tab.contentEl.createDiv({
      cls: "excalidraw-markdown-image-editor__placeholder",
      text: t("MARKDOWN_IMAGE_OWNER_UNAVAILABLE"),
    });
  }

  private isOwnerIdentityValid(): boolean {
    return Boolean(
      this.ownerFilePath &&
        this.ownerLeaf.view === this.view &&
        this.view._plugin === this.plugin &&
        this.view.file === this.ownerFile &&
        this.view.excalidrawData?.file === this.ownerFile &&
        this.view.excalidrawAPI,
    );
  }

  private isOwnerViewValid(): boolean {
    return !this.closed && !this.ownerInvalid && this.isOwnerIdentityValid();
  }

  private ensureOwnerValid(): boolean {
    if (this.isOwnerViewValid()) {
      return true;
    }
    if (!this.closed && !this.ownerInvalid) {
      void this.invalidateOwner(false);
    }
    return false;
  }

  private async focusOwner(): Promise<void> {
    if (!this.ensureOwnerValid()) {
      return;
    }
    await this.app.workspace.revealLeaf(this.ownerLeaf);
  }

  public invalidateOwner(
    saveEditor: boolean,
    cancelPendingAttachment: boolean = true,
  ): Promise<void> {
    if (cancelPendingAttachment) {
      this.ownerAttachmentGeneration++;
    }
    if (this.ownerInvalidation !== null) {
      return this.ownerInvalidation;
    }
    const invalidatedView = this.view;
    const canClearOwnerEditing = this.isOwnerIdentityValid();
    this.ownerInvalid = true;
    this.selectionGeneration++;
    this.cancelScheduledRender();
    this.removeEditorFocusListener();
    this.tab?.setDisabled(true);
    this.ownerInvalidation = (async () => {
      try {
        await this.flushAndDetachEditor(saveEditor);
        // flushAndDetachEditor() only writes the flushed edit into excalidrawData (in memory).
        // This controller is about to stop tracking invalidatedView (it's being handed off to a
        // different view, or torn down), so nothing else is guaranteed to persist that edit to
        // disk afterward - force it now while we still have a definite reference to the view.
        if (saveEditor && canClearOwnerEditing) {
          await invalidatedView.forceSave(true, true);
          await invalidatedView.reload(false, invalidatedView.file);
          // reload() clears semaphores.embeddableIsEditingSelf as soon as a debounce timer is
          // pending, opening a window (spanning its vault.read() await) where a concurrently
          // polling autosave can slip in - see the matching comment in
          // persistOwnerAfterEditorFlush() for why this is a real, tight race. Re-arm it; the
          // finally block below calls clearEmbeddableNodeIsEditing() right after, which is the
          // intended graceful (debounced) wind-down instead of reload()'s abrupt one.
          invalidatedView.setMarkdownImageEditorIsEditing();
        }
      } catch (error: unknown) {
        errorlog({
          where: "MarkdownImageEditorController.invalidateOwner",
          error,
        });
      } finally {
        if (canClearOwnerEditing) {
          invalidatedView.clearEmbeddableNodeIsEditing();
        }
        this.element = null;
        this.renderSettings = null;
        this.lastObservedSelectionId = null;
        this.renderOwnerUnavailablePlaceholder();
      }
    })();
    return this.ownerInvalidation;
  }

  private watchActiveExcalidrawView(): void {
    if (this.activeLeafChangeRef !== null) {
      return;
    }
    this.activeLeafChangeRef = this.app.workspace.on(
      "active-leaf-change",
      (leaf) => {
        this.updateFocusOwnerButtonVisibility();
        if (leaf?.view?.getViewType?.() !== VIEW_TYPE_EXCALIDRAW) {
          return;
        }
        void this.attachToView(leaf.view as ExcalidrawView);
      },
    );
  }

  private isAttachableView(view: ExcalidrawView): boolean {
    return Boolean(
      view._plugin === this.plugin &&
        view.file &&
        view.excalidrawData?.file === view.file &&
        view.excalidrawAPI &&
        view.leaf.view === view,
    );
  }

  private isPreferredOwnerCandidate(view: ExcalidrawView): boolean {
    return (
      this.app.workspace.getMostRecentLeaf() === view.leaf ||
      this.plugin.lastActiveExcalidrawLeafID === view.leaf.id
    );
  }

  private getSelectedMarkdownImage(
    view: ExcalidrawView,
    elements?: readonly ExcalidrawElement[],
    selectedElementIds?: Record<string, boolean>,
  ): { element?: ExcalidrawImageElement; selectedId: string | null } {
    const ids =
      selectedElementIds ??
      view.excalidrawAPI?.getAppState().selectedElementIds ??
      {};
    const selectedIds = Object.keys(ids).filter((id) => ids[id]);
    const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
    const selected = selectedId
      ? (elements ?? view.getViewElements()).find(
          (element) => element.id === selectedId,
        )
      : undefined;
    return {
      element:
        selected?.type === "image" && isMarkdownImageElement(view, selected)
          ? selected
          : undefined,
      selectedId,
    };
  }

  private async attachToView(
    nextView: ExcalidrawView,
    elements?: readonly ExcalidrawElement[],
    selectedElementIds?: Record<string, boolean>,
  ): Promise<void> {
    if (
      this.closed ||
      !this.tab ||
      !this.isAttachableView(nextView) ||
      !this.isPreferredOwnerCandidate(nextView)
    ) {
      return;
    }
    if (nextView === this.view && this.isOwnerViewValid()) {
      if (elements && selectedElementIds) {
        this.handleSceneSelection(nextView, elements, selectedElementIds);
      }
      return;
    }

    const generation = ++this.ownerAttachmentGeneration;
    if (!this.ownerInvalid || this.ownerInvalidation === null) {
      await this.invalidateOwner(true, false);
    } else {
      await this.ownerInvalidation;
    }
    if (
      generation !== this.ownerAttachmentGeneration ||
      this.closed ||
      !this.isAttachableView(nextView)
    ) {
      return;
    }

    this.view = nextView;
    this.ownerLeaf = nextView.leaf;
    this.ownerFile = nextView.file;
    this.ownerInvalid = false;
    this.ownerInvalidation = null;
    this.tab.setDisabled(false);

    const selection = this.getSelectedMarkdownImage(
      nextView,
      elements,
      selectedElementIds,
    );
    this.element = selection.element ?? null;
    this.lastObservedSelectionId = selection.selectedId;
    this.renderSettings = selection.element
      ? getMarkdownImageRenderSettings(this.plugin, selection.element)
      : null;
    if (selection.element) {
      nextView.setMarkdownImageEditorIsEditing();
    }
    this.renderPanel();
  }

  private async renderSourceControls(host: HTMLElement): Promise<void> {
    if (!this.ensureOwnerValid() || !this.element || this.closed) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (
      !source ||
      this.closed ||
      !host.isConnected ||
      !this.ensureOwnerValid()
    ) {
      return;
    }
    if (source.source === "external" && source.embeddedFile) {
      const elementId = this.element.id;
      new Setting(host)
        .setClass("excalidraw-markdown-image-editor__setting--wide")
        .setName(t("MARKDOWN_IMAGE_EXTERNAL_SOURCE"))
        .setDesc(source.embeddedFile.linkParts.original)
        .addButton((button) =>
          button
            .setIcon("hash")
            .setClass("excalidraw-markdown-image-editor__compact-button")
            .setTooltip(t("NARROW_TO_HEADING"))
            .onClick(() => {
              void this.narrowExternalSourceToHeading(source, elementId);
            }),
        )
        .addButton((button) => {
          button
            .setClass("excalidraw-markdown-image-editor__compact-button")
            .setTooltip(t("NARROW_TO_BLOCK"))
            .onClick(() => {
              void this.narrowExternalSourceToBlock(source, elementId);
            });
          setBlockReferenceIcon(button);
        })
        .addButton((button) =>
          button
            .setIcon("external-link")
            .setClass("excalidraw-markdown-image-editor__compact-button")
            .setTooltip(
              t("MARKDOWN_IMAGE_OPEN_EXTERNAL_SOURCE_NEW_TAB"),
            )
            .onClick(() => {
              void this.openExternalSourceInNewTab(source, elementId);
            }),
        )
        .addButton((button) =>
          button
            .setIcon("copy")
            .setClass("excalidraw-markdown-image-editor__compact-button")
            .setTooltip(t("MARKDOWN_IMAGE_MAKE_LOCAL"))
            .onClick(() => {
              void this.makeLocalCopy();
            }),
        );
      return;
    }
    new Setting(host)
      .setClass("excalidraw-markdown-image-editor__setting--wide")
      .setName(t("MARKDOWN_IMAGE_EXTRACT_LOCAL"))
      .addButton((button) =>
        button
          .setIcon("file-output")
          .setClass("excalidraw-markdown-image-editor__compact-button")
          .setTooltip(t("MARKDOWN_IMAGE_EXTRACT"))
          .onClick(() => {
            void this.extractToNote();
          }),
      )
      .addButton((button) =>
        button
          .setIcon("copy-plus")
          .setClass("excalidraw-markdown-image-editor__compact-button")
          .setTooltip(t("DUPLICATE_IMAGE"))
          .onClick(() => {
            void this.duplicateLocalMarkdownImage();
          }),
      );
  }

  private getExternalSourceSubpath(source: MarkdownImageSourceData): string {
    const linkParts = source.embeddedFile?.linkParts;
    return linkParts?.ref
      ? `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`
      : "";
  }

  private isCurrentExternalSourceAction(elementId: string): boolean {
    return this.ensureOwnerValid() && this.element?.id === elementId;
  }

  private async updateExternalSourceSubpath(
    source: MarkdownImageSourceData,
    subpath: string,
    elementId: string,
  ): Promise<void> {
    const file = source.embeddedFile?.file;
    if (!file || !this.isCurrentExternalSourceAction(elementId)) {
      return;
    }
    const path = this.app.metadataCache.fileToLinktext(
      file,
      this.view.file.path,
      true,
    );
    await this.useExternalSource(`${path}${subpath}`);
  }

  private async narrowExternalSourceToHeading(
    source: MarkdownImageSourceData,
    elementId: string,
  ): Promise<void> {
    const file = source.embeddedFile?.file;
    if (!file || !this.isCurrentExternalSourceAction(elementId)) {
      return;
    }
    const subpath = await selectMarkdownHeadingSubpath(
      this.app,
      file,
      false,
      () => !this.isCurrentExternalSourceAction(elementId),
    );
    if (
      subpath === null ||
      subpath === this.getExternalSourceSubpath(source) ||
      !this.isCurrentExternalSourceAction(elementId)
    ) {
      return;
    }
    await this.updateExternalSourceSubpath(source, subpath, elementId);
  }

  private async narrowExternalSourceToBlock(
    source: MarkdownImageSourceData,
    elementId: string,
  ): Promise<void> {
    const file = source.embeddedFile?.file;
    if (!file || !this.isCurrentExternalSourceAction(elementId)) {
      return;
    }
    const subpath = await selectMarkdownBlockSubpath(
      this.app,
      file,
      () => !this.isCurrentExternalSourceAction(elementId),
    );
    if (
      subpath === null ||
      subpath === this.getExternalSourceSubpath(source) ||
      !this.isCurrentExternalSourceAction(elementId)
    ) {
      return;
    }
    await this.updateExternalSourceSubpath(source, subpath, elementId);
  }

  private async openExternalSourceInNewTab(
    source: MarkdownImageSourceData,
    elementId: string,
  ): Promise<void> {
    const file = source.embeddedFile?.file;
    if (!file || !this.isCurrentExternalSourceAction(elementId)) {
      return;
    }
    const subpath = this.getExternalSourceSubpath(source);
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, {
      active: true,
      ...(subpath ? { eState: { subpath } } : {}),
    });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private normalizeExternalLink(value: string): string {
    const wikiLink = value.match(/!?\[\[([^\]]+)]]/)?.[1];
    return (wikiLink ?? value).trim();
  }

  private async useExternalSource(value: string): Promise<void> {
    if (!this.ensureOwnerValid() || !this.element) {
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
      embeddedFile.file.extension.toLowerCase() !== "md"
    ) {
      new Notice(t("MARKDOWN_IMAGE_SELECT_SOURCE"));
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    if (!this.ensureOwnerValid()) {
      return;
    }
    this.cancelScheduledRender();
    const local = this.view.excalidrawData.getMarkdownImage(this.element.fileId);
    this.view.excalidrawData.setFile(this.element.fileId, embeddedFile);
    this.view.excalidrawData.deleteMarkdownImage(this.element.fileId, true);
    const external = await getMarkdownImageSource(this.view, this.element);
    if (!this.ensureOwnerValid()) {
      return;
    }
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
    if (!this.ensureOwnerValid()) {
      return;
    }
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
    if (!this.ensureOwnerValid() || !this.element || !this.renderSettings) {
      return;
    }
    const previousExternal = await getMarkdownImageSource(this.view, this.element);
    if (
      !this.ensureOwnerValid() ||
      !previousExternal ||
      previousExternal.source !== "external"
    ) {
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    if (!this.ensureOwnerValid()) {
      return;
    }
    this.cancelScheduledRender();
    const external = await getMarkdownImageSource(this.view, this.element);
    if (
      !this.ensureOwnerValid() ||
      !external ||
      external.source !== "external"
    ) {
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
    if (!this.ensureOwnerValid()) {
      return;
    }
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
    if (!this.ensureOwnerValid() || !this.element) {
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!this.ensureOwnerValid() || !source || source.source !== "local") {
      return;
    }
    const attachmentLocation = await getAttachmentsFolderAndFilePath(
      this.app,
      this.view.file.path,
      t("MARKDOWN_IMAGE_DEFAULT_NOTE"),
    );
    if (!this.ensureOwnerValid()) {
      return;
    }
    const defaultLocation = splitFolderAndFilename(
      attachmentLocation.filepath,
    );
    const location = await new FileAndFolderSelectorModal(this.app, {
      title: t("MARKDOWN_IMAGE_EXTRACT_TITLE"),
      folderLabel: t("FILE_AND_FOLDER_SELECTOR_FOLDER"),
      fileNameLabel: t("FILE_AND_FOLDER_SELECTOR_FILENAME"),
      submitButtonText: t("MARKDOWN_IMAGE_EXTRACT"),
      folderPath: defaultLocation.folderpath,
      fileName: defaultLocation.filename,
    }).start();
    if (!location || !this.ensureOwnerValid()) {
      return;
    }
    try {
      const filename = location.fileName.toLowerCase().endsWith(".md")
        ? location.fileName
        : `${location.fileName}.md`;
      const path = getNewUniqueFilepath(
        this.view.app.vault,
        filename,
        location.folderPath,
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

  private async duplicateLocalMarkdownImage(): Promise<void> {
    if (!this.ensureOwnerValid() || !this.element) {
      return;
    }
    await this.renderCurrentEditor();
    if (!this.ensureOwnerValid() || !this.element) {
      return;
    }
    if (!(await duplicateLocalMarkdownImageElement(this.view, this.element))) {
      new Notice(t("MARKDOWN_IMAGE_DUPLICATE_ERROR"));
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
    sourceView: ExcalidrawView,
    elements: readonly ExcalidrawElement[],
    selectedElementIds: Record<string, boolean>,
  ): void {
    if (!this.tab || this.closed || this.initializing) {
      return;
    }
    if (sourceView !== this.view || !this.isOwnerViewValid()) {
      if (this.isPreferredOwnerCandidate(sourceView)) {
        void this.attachToView(sourceView, elements, selectedElementIds);
      }
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
      selected?.type === "image" && isMarkdownImageElement(sourceView, selected)
        ? selected
        : undefined;
    const generation = ++this.selectionGeneration;
    this.selectionSwitchQueue = this.selectionSwitchQueue
      .catch(() => {
        // Keep the queue alive after any prior failure.
      })
      .then(() => this.switchElement(next, generation));
  }

  private async waitForOwnerSaveIdle(maxFrames: number = 180): Promise<void> {
    const ownerView = this.view;
    const ownerWindow = ownerView.ownerWindow ?? window;
    for (let frame = 0; frame < maxFrames; frame++) {
      if (!this.ensureOwnerValid() || this.view !== ownerView) {
        return;
      }
      const semaphores = ownerView.semaphores;
      if (!semaphores?.saving && !semaphores?.autosaving) {
        return;
      }
      await new Promise<void>((resolve) => {
        ownerWindow.requestAnimationFrame(() => resolve());
      });
    }
  }

  /**
   * Forces a disk save of the owner view, retrying if a concurrent save (autosave, or another
   * controller flushing during a handoff) claims the saving semaphore between
   * waitForOwnerSaveIdle() resolving and the save() call below. save() silently no-ops when
   * semaphores.saving is already true when it is entered, and awaiting an already-resolved
   * promise still yields a microtask turn, so a single poll-then-call attempt cannot guarantee
   * persistence on its own.
   */
  private async persistOwnerAfterEditorFlush(maxAttempts: number = 5): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!this.ensureOwnerValid()) {
        return;
      }
      await this.waitForOwnerSaveIdle();
      if (!this.ensureOwnerValid()) {
        return;
      }
      if (this.view.semaphores.saving) {
        continue;
      }
      await this.view.save(true, true, true);
      // save() does not refresh view.data, so prepareGetViewData() would keep rebuilding the
      // Markdown-image header section from a stale copy on every later save in this same view
      // (e.g. switching directly from one Markdown image to another via switchElement()). Reuse
      // the same reload(false, file) call invalidateOwner() uses for the cross-view handoff case.
      if (this.ensureOwnerValid()) {
        await this.view.reload(false, this.view.file);
        // reload() clears semaphores.embeddableIsEditingSelf as soon as a debounce timer is
        // pending (it assumes editing has ended). It hasn't: flushCurrentElement() runs mid-session,
        // and switchElement()/flushPendingEditsBeforeHandoff() decide the real end state right
        // after this returns. Re-arm it immediately so nothing else can misread editing as finished
        // in that gap; the caller's own clear/set call right after this resolves is what should
        // decide the final state, not reload()'s side effect.
        if (this.ensureOwnerValid()) {
          this.view.setMarkdownImageEditorIsEditing();
        }
      }
      return;
    }
  }

  /**
   * Flushes the current editor's content into excalidrawData and force-persists it to disk.
   * Shared by switchElement() (selection changes within this controller) and
   * flushPendingEditsBeforeHandoff() (handoff to a brand new controller in
   * openMarkdownImageEditor()) so a previous element's edits are always guaranteed to be flushed
   * and saved before anything else starts editing a different element.
   */
  private async flushCurrentElement(): Promise<void> {
    await this.renderCurrentEditor();
    this.cancelScheduledRender();
    this.removeEditorFocusListener();
    await this.flushAndDetachEditor();
    await this.persistOwnerAfterEditorFlush();
    this.cancelScheduledRender();
  }

  /**
   * Flushes and force-persists the currently edited element before this controller is replaced
   * by a brand new controller instance for a different element (see openMarkdownImageEditor()).
   * Without this, dispose()/close() detach and save the editor via a fire-and-forget call, so the
   * previous element's edits can still be in flight after the new controller has already started
   * editing (and locking, via embeddableIsEditingSelf) a different element.
   */
  public async flushPendingEditsBeforeHandoff(): Promise<void> {
    if (this.closed || !this.element) {
      return;
    }
    try {
      await this.flushCurrentElement();
    } catch (error: unknown) {
      errorlog({
        where: "MarkdownImageEditorController.flushPendingEditsBeforeHandoff",
        error,
      });
    }
  }

  private async switchElement(
    element: ExcalidrawImageElement | undefined,
    generation: number,
  ): Promise<void> {
    if (generation !== this.selectionGeneration || this.closed) {
      return;
    }
    await this.flushCurrentElement();
    if (generation !== this.selectionGeneration || this.closed) {
      return;
    }
    this.renderSelectionPlaceholder();
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

  private handleSidepanelFocus(
    nextView: ExcalidrawView | null,
  ): void {
    const ownerIsValid = this.isOwnerViewValid();
    const nextViewIsActive =
      nextView !== null &&
      this.app.workspace.getMostRecentLeaf() === nextView.leaf;
    if (
      nextView &&
      (!ownerIsValid || nextView === this.view || nextViewIsActive)
    ) {
      void this.attachToView(nextView).then(() => {
        this.focusEditorIfRequested();
      });
      return;
    }
    // Focusing the sidepanel makes its own leaf the most recent one. In that
    // transition, the plugin's last-active Excalidraw leaf can briefly be
    // stale. Keep the owner established by the active-leaf listener instead
    // of tearing down a valid editor in favor of the stale view.
    if (this.ensureOwnerValid()) {
      this.focusEditorIfRequested();
    }
  }

  private async mountMarkdownView(host: HTMLElement): Promise<void> {
    if (!this.ensureOwnerValid() || !this.element || this.closed) {
      return;
    }
    const element = this.element;
    const source = await getMarkdownImageSource(this.view, element);
    if (
      !source ||
      this.closed ||
      this.element?.id !== element.id ||
      !this.ensureOwnerValid()
    ) {
      host.setText(t("MARKDOWN_IMAGE_SOURCE_UNAVAILABLE"));
      return;
    }
    const ownerView = this.view;
    const ownerFile = this.ownerFile;
    const elementFileId = element.fileId;
    const { leaf, rootSplit } = createLeaf(this.view, host.ownerDocument);
    this.editorLeaf = leaf;
    this.startMobileViewPatch(leaf);
    rootSplit.containerEl.addClass("mod-visible");
    setStyle(rootSplit.containerEl, { height: "100%", width: "100%" });
    host.appendChild(rootSplit.containerEl);

    if (source.source === "external" && source.embeddedFile?.file) {
      const sourceFile = source.embeddedFile.file;
      const ref = source.embeddedFile.linkParts.ref
        ? `#${source.embeddedFile.linkParts.isBlockRef ? "^" : ""}${source.embeddedFile.linkParts.ref}`
        : "";
      if (this.view.plugin.isExcalidrawFile(sourceFile)) {
        this.view.plugin.excalidrawFileModes[leaf.id || sourceFile.path] =
          "markdown";
        await leaf.setViewState(
          {
            type: "markdown",
            state: { file: sourceFile.path, mode: "source" },
            active: false,
          },
          { history: false },
        );
        await leaf.loadIfDeferred();
      } else {
        await leaf.openFile(sourceFile, {
          active: false,
        });
      }
      if (
        this.closed ||
        !this.ensureOwnerValid() ||
        this.element?.id !== element.id ||
        this.editorLeaf !== leaf
      ) {
        leaf.detach();
        return;
      }
      if (leaf.view instanceof MarkdownView) {
        this.editorView = leaf.view;
        this.prepareEditorView(host, leaf.view);
        this.revealExternalSourceSubpath(leaf.view, sourceFile, ref);
        this.watchEditorChanges();
        this.focusEditorIfRequested(leaf.view);
      }
      return;
    }

    const fragmentView = new MarkdownFragmentView(
      leaf,
      async (markdown) => {
        if (containsReservedMarkdownImageMarker(markdown)) {
          new Notice(t("MARKDOWN_IMAGE_RESERVED_MARKER"));
          return;
        }
        const excalidrawData = ownerView.excalidrawData;
        if (
          !excalidrawData ||
          excalidrawData.file !== ownerFile ||
          ownerView.file !== ownerFile
        ) {
          return;
        }
        excalidrawData.setMarkdownImage(elementFileId, {
          markdown,
        });
        ownerView.setDirty();
        ownerView.setMarkdownImageEditorIsEditing();
      },
    );
    await leaf.open(fragmentView);
    if (
      this.closed ||
      !this.ensureOwnerValid() ||
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
    this.focusEditorIfRequested(fragmentView);
  }

  private revealExternalSourceSubpath(
    editorView: MarkdownView,
    sourceFile: TFile,
    subpath: string,
  ): void {
    if (!subpath) {
      return;
    }
    const cache = this.app.metadataCache.getFileCache(sourceFile);
    const location = cache ? resolveSubpath(cache, subpath) : null;
    if (!location) {
      return;
    }
    const position = {
      line: location.start.line,
      ch: location.start.col,
    };
    // A collapsed cursor reveals the referenced content without leaving the
    // detached MarkdownView in Obsidian's persistent subpath-selection state.
    editorView.editor.setCursor(position);
    editorView.editor.scrollIntoView({ from: position, to: position }, true);
  }

  private prepareEditorView(host: HTMLElement, editorView: MarkdownView): void {
    if (!this.ensureOwnerValid()) {
      return;
    }
    editorView.containerEl.addClass("excalidraw-markdown-fragment-view");
    editorView.containerEl
      .querySelectorAll(".inline-title")
      .forEach((title) => title.remove());
    this.removeEditorFocusListener();
    this.editorFocusHost = host;
    this.editorCommandView = editorView;
    this.editorFocusInHandler = () => {
      this.activateEditorCommandRouting(editorView);
    };
    this.editorFocusOutHandler = () => {
      const finishFocusTransition = () => {
        if (this.editorView !== editorView || !this.ensureOwnerValid()) {
          return;
        }
        if (host.contains(host.ownerDocument.activeElement)) {
          this.activateEditorCommandRouting(editorView);
          return;
        }
        this.restorePreviousActiveEditor();
        void this.renderCurrentEditor();
      };
      const targetWindow = host.ownerDocument.defaultView;
      if (targetWindow) {
        targetWindow.setTimeout(finishFocusTransition, 0);
      } else {
        finishFocusTransition();
      }
    };
    host.addEventListener("focusin", this.editorFocusInHandler);
    host.addEventListener("focusout", this.editorFocusOutHandler);
    const viewContainer = this.view.containerEl;
    if (!viewContainer) {
      void this.invalidateOwner(false);
      return;
    }
    this.scenePointerDocument = viewContainer.ownerDocument;
    this.scenePointerDownHandler = (event: PointerEvent) => {
      if (!this.ensureOwnerValid()) {
        return;
      }
      const target = event.target;
      const targetWindow = this.scenePointerDocument?.defaultView;
      const currentViewContainer = this.view.containerEl;
      if (
        target &&
        targetWindow?.Node &&
        target instanceof targetWindow.Node &&
        currentViewContainer?.contains(target)
      ) {
        this.restorePreviousActiveEditor();
        void this.renderCurrentEditor();
      }
    };
    this.scenePointerDocument.addEventListener(
      "pointerdown",
      this.scenePointerDownHandler,
      true,
    );
  }

  private activateEditorCommandRouting(editorView: MarkdownView): void {
    if (!this.editorCommandRoutingActive) {
      this.previousActiveEditor =
        this.app.workspace.activeEditor === editorView
          ? null
          : this.app.workspace.activeEditor;
      this.editorCommandRoutingActive = true;
    }
    if (!this.editorCommandScopeActive && editorView.scope) {
      this.app.keymap.pushScope(editorView.scope);
      this.editorCommandScopeActive = true;
    }
    this.app.workspace.activeEditor = editorView;
  }

  private focusEditorIfRequested(
    editorView: MarkdownView | null = this.editorView,
  ): void {
    if (
      !this.focusEditorOnMount ||
      !this.sidepanelRevealComplete ||
      !editorView ||
      !this.tab?.isActiveTab()
    ) {
      return;
    }
    if (this.editorView !== editorView || !this.ensureOwnerValid()) {
      return;
    }

    // Pre-emptively route commands and update Obsidian's active editor state.
    // This ensures the mobile toolbar sees the correct state the exact moment 
    // the virtual keyboard starts opening, fixing the "first tap" bug.
    this.activateEditorCommandRouting(editorView);

    if (DEVICE.isMobile) {
      this.app.workspace.setActiveLeaf(editorView.leaf, { focus: false });
      editorView.editor.focus();
      window.setTimeout(() => {
        this.focusEditorOnMount = false;
      }, 500);
      return;
    }

    this.app.workspace.setActiveLeaf(editorView.leaf, { focus: true });
    editorView.editor.focus();
    const targetWindow = editorView.containerEl.ownerDocument.defaultView;
    if (targetWindow) {
      this.stabilizeActiveEditor(editorView, targetWindow);
    }
  }

  private stabilizeActiveEditor(
    editorView: MarkdownView,
    targetWindow: Window,
  ): void {
    this.stopEditorFocusStabilization();
    this.editorFocusStabilizationWindow = targetWindow;
    const deadline = targetWindow.performance.now() + 500;
    const stabilize = () => {
      if (
        this.editorView !== editorView ||
        !this.ensureOwnerValid() ||
        !this.tab?.isActiveTab() ||
        !this.editorFocusHost?.contains(
          editorView.containerEl.ownerDocument.activeElement,
        )
      ) {
        this.stopEditorFocusStabilization();
        return;
      }
      this.activateEditorCommandRouting(editorView);
      if (targetWindow.performance.now() >= deadline) {
        this.editorFocusStabilizationFrame = null;
        this.editorFocusStabilizationWindow = null;
        this.focusEditorOnMount = false;
        return;
      }
      this.editorFocusStabilizationFrame = targetWindow.requestAnimationFrame(
        stabilize,
      );
    };
    stabilize();
  }

  private stopEditorFocusStabilization(): void {
    if (
      this.editorFocusStabilizationWindow &&
      this.editorFocusStabilizationFrame !== null
    ) {
      this.editorFocusStabilizationWindow.cancelAnimationFrame(
        this.editorFocusStabilizationFrame,
      );
    }
    this.editorFocusStabilizationWindow = null;
    this.editorFocusStabilizationFrame = null;
  }

  private removeEditorFocusListener(): void {
    this.stopEditorFocusStabilization();
    if (this.editorFocusHost && this.editorFocusInHandler) {
      this.editorFocusHost.removeEventListener(
        "focusin",
        this.editorFocusInHandler,
      );
    }
    if (this.editorFocusHost && this.editorFocusOutHandler) {
      this.editorFocusHost.removeEventListener(
        "focusout",
        this.editorFocusOutHandler,
      );
    }
    this.restorePreviousActiveEditor();
    this.editorFocusHost = null;
    this.editorFocusInHandler = null;
    this.editorFocusOutHandler = null;
    this.editorCommandView = null;
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

  private restorePreviousActiveEditor(): void {
    if (this.editorCommandScopeActive && this.editorCommandView?.scope) {
      this.app.keymap.popScope(this.editorCommandView.scope);
    }
    this.editorCommandScopeActive = false;
    if (
      this.editorCommandRoutingActive &&
      this.editorCommandView &&
      this.app.workspace.activeEditor === this.editorCommandView
    ) {
      this.app.workspace.activeEditor = this.previousActiveEditor;
    }
    this.previousActiveEditor = null;
    this.editorCommandRoutingActive = false;
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

  private destroyCSSEditors(): void {
    for (const editor of this.cssEditors) {
      editor.destroy();
    }
    this.cssEditors = [];
  }

  private destroyFontPickers(): void {
    for (const picker of this.fontPickers) {
      picker.destroy();
    }
    this.fontPickers = [];
  }

  private watchEditorChanges(): void {
    if (this.editorChangeRef) {
      this.app.workspace.offref(this.editorChangeRef);
    }
    this.editorChangeRef = this.app.workspace.on(
      "editor-change",
      (editor, info) => {
        if (info !== this.editorView || !this.ensureOwnerValid()) {
          return;
        }
        this.editorContentDirty = true;
        this.view.setMarkdownImageEditorIsEditing();
        const source = this.element
          ? this.view.excalidrawData.getMarkdownImage(this.element.fileId)
          : null;
        const markdown = source ? editor.getValue() : undefined;
        if (source && this.element && markdown !== undefined) {
          if (containsReservedMarkdownImageMarker(markdown)) {
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

  private renderCurrentEditor(force: boolean = false): Promise<void> {
    if (this.editorRenderPromise !== null) {
      return this.editorRenderPromise;
    }
    if (!this.ensureOwnerValid()) {
      return Promise.resolve();
    }
    if (!force && !this.editorContentDirty) {
      return Promise.resolve();
    }
    if (!this.element || !this.editorView || !this.renderSettings) {
      if (force) {
        this.scheduleRender(undefined, 0);
      }
      return Promise.resolve();
    }
    const element = this.element;
    const editorView = this.editorView;
    const renderSettings = this.renderSettings;
    const markdown = editorView.getViewData();
    this.cancelScheduledRender();
    this.setRenderStatus(true);
    const renderPromise = (async () => {
      try {
        const source = await getMarkdownImageSource(this.view, element);
        if (!source || this.closed || !this.ensureOwnerValid()) {
          return;
        }
        let renderMarkdown = markdown;
        if (source.source === "external") {
          await editorView.save();
          if (!this.ensureOwnerValid()) {
            return;
          }
          const refreshedSource = await getMarkdownImageSource(
            this.view,
            element,
          );
          if (
            !refreshedSource ||
            refreshedSource.source !== "external" ||
            !this.ensureOwnerValid()
          ) {
            return;
          }
          renderMarkdown = refreshedSource.markdown;
        } else {
          this.view.excalidrawData.setMarkdownImage(element.fileId, {
            markdown,
          });
          this.view.setDirty();
        }
        const updated = await updateMarkdownImage(
          this.view,
          element,
          renderMarkdown,
          renderSettings,
          source.source,
        );
        if (!updated || !this.ensureOwnerValid()) {
          return;
        }
        if (this.element?.id === element.id) {
          this.refreshElementReference();
        }
        if (
          this.editorView === editorView &&
          markdown === editorView.getViewData()
        ) {
          this.editorContentDirty = false;
        }
      } finally {
        this.setRenderStatus(false);
      }
    })();
    const trackedRenderPromise = renderPromise.finally(() => {
      if (this.editorRenderPromise === trackedRenderPromise) {
        this.editorRenderPromise = null;
      }
    });
    this.editorRenderPromise = trackedRenderPromise;
    return this.editorRenderPromise;
  }

  private scheduleRender(markdown?: string, delay: number = 350): void {
    if (!this.ensureOwnerValid()) {
      return;
    }
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
    if (
      !this.ensureOwnerValid() ||
      !this.element ||
      !this.renderSettings ||
      this.closed
    ) {
      return;
    }
    this.setRenderStatus(true);
    try {
      const source = await getMarkdownImageSource(this.view, this.element);
      if (
        !source ||
        generation !== this.renderGeneration ||
        this.closed ||
        !this.ensureOwnerValid()
      ) {
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
      if (
        !this.ensureOwnerValid() ||
        !updated ||
        generation !== this.renderGeneration
      ) {
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
    if (!this.tab || this.closed || !this.ensureOwnerValid()) {
      return;
    }
    this.cancelScheduledRender();
    await this.flushAndDetachEditor();
    this.cancelScheduledRender();
    this.renderPanel();
  }

  private startMobileViewPatch(editorLeaf: WorkspaceLeaf): void {
    this.stopMobileViewPatch();
    const ownerView = this.view;
    const cleanup = patchMobileView(ownerView, {
      keepAlive: true,
      isActive: () =>
        !this.closed &&
        !this.ownerInvalid &&
        this.view === ownerView &&
        this.editorLeaf === editorLeaf &&
        this.isOwnerIdentityValid(),
    });
    this.mobileViewPatchCleanup =
      typeof cleanup === "function" ? cleanup : null;
  }

  private stopMobileViewPatch(): void {
    if (!this.mobileViewPatchCleanup) {
      return;
    }
    try {
      this.mobileViewPatchCleanup();
    } catch (error: unknown) {
      errorlog({
        where: "MarkdownImageEditorController.stopMobileViewPatch",
        error,
      });
    }
    this.mobileViewPatchCleanup = null;
  }

  private async flushAndDetachEditor(saveEditor: boolean = true): Promise<void> {
    const editorView = this.editorView;
    const editorLeaf = this.editorLeaf;
    this.stopMobileViewPatch();
    this.editorView = null;
    this.editorLeaf = null;
    this.editorContentDirty = false;
    this.removeEditorResizeListener();
    this.removeEditorFocusListener();
    if (this.editorChangeRef) {
      this.app.workspace.offref(this.editorChangeRef);
      this.editorChangeRef = null;
    }
    try {
      if (editorView && saveEditor) {
        await editorView.save();
      }
    } finally {
      // leaf.detach() below is not awaited; Obsidian's own TextFileView teardown can still call
      // save() on editorView again afterward, once its CodeMirror editor is already gone. Without
      // markClosing(), that later call would silently overwrite the flush above with "".
      if (editorView instanceof MarkdownFragmentView) {
        editorView.markClosing();
      }
      editorLeaf?.detach();
    }
  }

  /**
   * Flushes and force-persists the editing session, then tears down the controller. Awaited by
   * dispose() so that closing the sidepanel (the whole panel, not just switching elements/views)
   * reliably reaches disk even if the user never returns focus to the owning Excalidraw view -
   * previously this flushed into excalidrawData via a fire-and-forget call with no forced save,
   * so data could sit unsaved indefinitely, which is especially risky on mobile.
   */
  private async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    const canClearOwnerEditing = this.isOwnerIdentityValid();
    this.closed = true;
    this.sidepanelRevealComplete = false;
    if (activeController === this) {
      activeController = null;
    }
    this.ownerAttachmentGeneration++;
    this.selectionGeneration++;
    if (this.activeLeafChangeRef) {
      this.app.workspace.offref(this.activeLeafChangeRef);
      this.activeLeafChangeRef = null;
    }
    this.cancelScheduledRender();
    this.destroyCSSEditors();
    this.destroyFontPickers();
    this.focusOwnerButtonEl = null;
    this.ownerStatusEl = null;
    try {
      await this.flushAndDetachEditor();
      if (canClearOwnerEditing) {
        await this.view.forceSave(true, true);
        await this.view.reload(false, this.view.file);
      }
    } catch (error: unknown) {
      errorlog({
        where: "MarkdownImageEditorController.close",
        error,
      });
    } finally {
      this.cancelScheduledRender();
      if (canClearOwnerEditing) {
        this.view.clearEmbeddableNodeIsEditing();
      }
      this.element = null;
      this.renderSettings = null;
    }
    void this.plugin.saveSettings();
    this.tab = null;
  }

  public async dispose(): Promise<void> {
    this.tab?.close();
    await this.close();
  }
}

let activeController: MarkdownImageEditorController | null = null;

/** Opens the feature-owned Markdown-image sidepanel without changing public sidepanel APIs. */
export async function openMarkdownImageEditor(
  view: ExcalidrawView,
  element?: ExcalidrawImageElement,
): Promise<void> {
  if (element && activeController?.isEditingElement(view, element)) {
    await activeController.revealAndFocus();
    return;
  }
  const previousController = activeController;
  // Guarantee the previously edited element's changes are flushed and persisted before this
  // handoff: otherwise dispose() below would save the old element in the background while the
  // new controller has already started editing (and locking) a different element.
  await previousController?.flushPendingEditsBeforeHandoff();
  const controller = new MarkdownImageEditorController(view);
  activeController = controller;
  try {
    if (!(await controller.open(element))) {
      void controller.dispose();
      if (activeController === null && previousController) {
        activeController = previousController;
      }
      return;
    }
    void previousController?.dispose();
  } catch (error: unknown) {
    void controller.dispose();
    if (activeController === null && previousController) {
      activeController = previousController;
    }
    throw error;
  }
}

/** Efficiently forwards selection changes only while the feature panel exists. */
export function handleMarkdownImageEditorSelection(
  view: ExcalidrawView,
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Record<string, boolean>,
): void {
  if (!activeController) {
    return;
  }
  activeController.handleSceneSelection(view, elements, selectedElementIds);
}

/**
 * Detaches the feature-owned editor before its Excalidraw host unloads.
 *
 * @param view - Excalidraw view whose file or view instance is being unloaded.
 */
export async function handleMarkdownImageEditorViewUnload(
  view: ExcalidrawView,
): Promise<void> {
  if (!activeController || activeController.view !== view) {
    return;
  }
  await activeController.invalidateOwner(true);
}

/**
 * Flushes and force-persists the active Markdown-image editing session before the sidepanel view
 * itself closes. Without this, closing the whole side panel (e.g. collapsing it, or closing the
 * leaf) without ever returning focus to the owning Excalidraw view left the edit flushed only into
 * excalidrawData in memory, with no forced disk save - especially risky on mobile, where the app
 * can be suspended shortly after. The sidepanel is a plugin-wide singleton (see
 * ExcalidrawSidepanelView.getExisting()), and so is activeController, so there is no separate
 * "which sidepanel" identity to check here.
 */
export async function handleMarkdownImageEditorSidepanelClosing(): Promise<void> {
  if (!activeController) {
    return;
  }
  await activeController.dispose();
}
