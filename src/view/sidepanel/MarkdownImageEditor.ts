import {
  ButtonComponent,
  MarkdownView,
  Notice,
  Setting,
  type App,
  type ColorComponent,
  type TFile,
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
import {
  COLOR_NAMES,
  DEVICE,
  VIEW_TYPE_EXCALIDRAW,
} from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { errorlog } from "src/utils/coreUtils";
import {
  CSSCodeEditor,
  MARKDOWN_IMAGE_CSS_BOILERPLATE,
  MARKDOWN_IMAGE_CSS_BOILERPLATE_MARKER,
  TRANSCLUSION_CSS_BOILERPLATE,
  TRANSCLUSION_CSS_BOILERPLATE_MARKER,
} from "./CSSCodeEditor";

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
  private readonly app: App;
  private readonly plugin: ExcalidrawPlugin;
  private ownerLeaf: WorkspaceLeaf;
  private ownerFile: TFile | null;
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
  private ownerInvalid = false;
  private ownerInvalidation: Promise<void> | null = null;
  private ownerAttachmentGeneration = 0;
  private activeLeafChangeRef: EventRef | null = null;
  private cssEditors: CSSCodeEditor[] = [];
  private focusOwnerButtonEl: HTMLButtonElement | null = null;
  private ownerStatusEl: HTMLElement | null = null;

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

  public async open(element?: ExcalidrawImageElement): Promise<void> {
    if (!this.ensureOwnerValid()) {
      return;
    }
    if (!element) {
      const id = await insertMarkdownImage(this.view);
      if (!this.ensureOwnerValid()) {
        return;
      }
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
    if (!sidepanel || !this.ensureOwnerValid()) {
      return;
    }
    this.tab = await sidepanel.createTab({ title: t("MARKDOWN_IMAGE_TITLE") });
    this.view.setMarkdownImageEditorIsEditing();
    this.tab.onClose = () => this.close();
    this.tab.onFocus = (view) => void this.handleSidepanelFocus(view);
    this.tab.onWindowMigrated = () => void this.rebuildEditor();
    this.tab.onExcalidrawViewClosed = () => void this.invalidateOwner(false);
    this.watchActiveExcalidrawView();
    this.renderPanel();
    this.tab.open(true);
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
      .setClass("excalidraw-markdown-image-editor__setting--font")
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
      .setClass("excalidraw-markdown-image-editor__setting--color")
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
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setClass("excalidraw-markdown-image-editor__setting--border")
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
      .setClass("excalidraw-markdown-image-editor__setting--wide")
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
          `${t("MARKDOWN_IMAGE_CSS_DESC")} ${t("MARKDOWN_IMAGE_CSS_IMPORTANT_HINT")} ${developerConsoleHelp}`,
        ),
      );
    cssSetting.settingEl.addClass(
      "excalidraw-markdown-image-editor__css-setting",
    );
    const cssEditorHost = cssSetting.controlEl.createDiv({
      cls: "excalidraw-markdown-image-editor__css-editor",
    });
    const cssEditor = new CSSCodeEditor(
      cssEditorHost,
      this.renderSettings.css,
      t("MARKDOWN_IMAGE_CSS_EDITOR_ARIA"),
      (css) => {
        if (!this.renderSettings) {
          return;
        }
        this.renderSettings = { ...this.renderSettings, css };
        this.scheduleRender();
      },
    );
    this.cssEditors.push(cssEditor);
    const cssActions = cssSetting.controlEl.createDiv({
      cls: "excalidraw-markdown-image-editor__css-actions",
    });
    const insertCSSBoilerplateButton = new ButtonComponent(
      cssActions,
    )
      .setIcon("file-code-2")
      .setClass("excalidraw-markdown-image-editor__css-action-button")
      .setTooltip(t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"))
      .onClick(() =>
        cssEditor.insertBoilerplate(
          MARKDOWN_IMAGE_CSS_BOILERPLATE,
          MARKDOWN_IMAGE_CSS_BOILERPLATE_MARKER,
        ),
      );
    insertCSSBoilerplateButton.buttonEl.setAttribute(
      "aria-label",
      t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"),
    );
    const copyCSSCommandButton = new ButtonComponent(cssActions)
      .setIcon("clipboard-copy")
      .setClass("excalidraw-markdown-image-editor__css-action-button")
      .setTooltip(t("MARKDOWN_IMAGE_COPY_CSS_COMMAND"))
      .onClick(async () => {
        await navigator.clipboard.writeText(MARKDOWN_SVG_CONSOLE_COMMAND);
        new Notice(t("MARKDOWN_IMAGE_CSS_COMMAND_COPIED"));
      });
    copyCSSCommandButton.buttonEl.setAttribute(
      "aria-label",
      t("MARKDOWN_IMAGE_COPY_CSS_COMMAND"),
    );

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

    new Setting(transclusionAppearance)
      .setClass("excalidraw-markdown-image-editor__setting--font")
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
        dropdown.setValue(this.renderSettings.transclusion.fontFamily);
        dropdown.onChange((fontFamily) => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = {
            ...this.renderSettings,
            transclusion: {
              ...this.renderSettings.transclusion,
              fontFamily,
            },
          };
          void this.view.plugin.initializeFonts();
          this.scheduleRender();
        });
      });

    let transclusionFontColorTextEl: HTMLInputElement | null = null;
    let transclusionFontColorPicker: ColorComponent | null = null;
    let syncingTransclusionFontColorPicker = false;
    const setTransclusionFontColor = (fontColor: string) => {
      if (!this.renderSettings) {
        return;
      }
      this.renderSettings = {
        ...this.renderSettings,
        transclusion: {
          ...this.renderSettings.transclusion,
          fontColor,
        },
      };
      if (
        transclusionFontColorTextEl &&
        transclusionFontColorTextEl.value !== fontColor
      ) {
        transclusionFontColorTextEl.value = fontColor;
      }
      if (transclusionFontColorPicker !== null) {
        const nativeColor = getNativeColorValue(fontColor);
        if (transclusionFontColorPicker.getValue() !== nativeColor) {
          syncingTransclusionFontColorPicker = true;
          transclusionFontColorPicker.setValue(nativeColor);
          syncingTransclusionFontColorPicker = false;
        }
      }
      this.scheduleRender();
    };
    new Setting(transclusionAppearance)
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setName(t("MARKDOWN_IMAGE_FONT_COLOR"))
      .addText((text) => {
        transclusionFontColorTextEl = text.inputEl;
        text
          .setValue(this.renderSettings.transclusion.fontColor)
          .onChange(setTransclusionFontColor);
      })
      .addColorPicker((picker) => {
        transclusionFontColorPicker = picker;
        picker
          .setValue(
            getNativeColorValue(this.renderSettings.transclusion.fontColor),
          )
          .onChange((fontColor) => {
            if (!syncingTransclusionFontColorPicker) {
              setTransclusionFontColor(fontColor);
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
              setTransclusionFontColor(selected);
            }
          }),
      );

    let transclusionBorderColorTextEl: HTMLInputElement | null = null;
    let transclusionBorderColorPicker: ColorComponent | null = null;
    let syncingTransclusionBorderColorPicker = false;
    const setTransclusionBorderColor = (color: string) => {
      if (!this.renderSettings) {
        return;
      }
      this.renderSettings = {
        ...this.renderSettings,
        transclusion: {
          ...this.renderSettings.transclusion,
          border: {
            ...this.renderSettings.transclusion.border,
            color,
          },
        },
      };
      if (
        transclusionBorderColorTextEl &&
        transclusionBorderColorTextEl.value !== color
      ) {
        transclusionBorderColorTextEl.value = color;
      }
      if (transclusionBorderColorPicker !== null) {
        const nativeColor = getNativeColorValue(color);
        if (transclusionBorderColorPicker.getValue() !== nativeColor) {
          syncingTransclusionBorderColorPicker = true;
          transclusionBorderColorPicker.setValue(nativeColor);
          syncingTransclusionBorderColorPicker = false;
        }
      }
      this.scheduleRender();
    };
    new Setting(transclusionAppearance)
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setName(t("MARKDOWN_IMAGE_BORDER"))
      .addToggle((toggle) => {
        toggle.setValue(this.renderSettings.transclusion.border.enabled);
        toggle.onChange((enabled) => {
          if (!this.renderSettings) {
            return;
          }
          this.renderSettings = {
            ...this.renderSettings,
            transclusion: {
              ...this.renderSettings.transclusion,
              border: {
                ...this.renderSettings.transclusion.border,
                enabled,
              },
            },
          };
          this.scheduleRender();
        });
      });
    new Setting(transclusionAppearance)
      .setClass("excalidraw-markdown-image-editor__setting--color")
      .setName(t("MARKDOWN_IMAGE_BORDER_COLOR"))
      .addText((text) => {
        transclusionBorderColorTextEl = text.inputEl;
        text
          .setValue(this.renderSettings.transclusion.border.color)
          .onChange(setTransclusionBorderColor);
      })
      .addColorPicker((picker) => {
        transclusionBorderColorPicker = picker;
        picker
          .setValue(
            getNativeColorValue(
              this.renderSettings.transclusion.border.color,
            ),
          )
          .onChange((color) => {
            if (!syncingTransclusionBorderColorPicker) {
              setTransclusionBorderColor(color);
            }
          });
      });

    const transclusionCSSSetting = new Setting(transclusionAppearance)
      .setName(t("MARKDOWN_IMAGE_TRANSCLUSION_CSS"))
      .setDesc(
        `${t("MARKDOWN_IMAGE_TRANSCLUSION_CSS_DESC")} ${t("MARKDOWN_IMAGE_CSS_IMPORTANT_HINT")}`,
      );
    transclusionCSSSetting.settingEl.addClass(
      "excalidraw-markdown-image-editor__css-setting",
    );
    const transclusionCSSEditorHost =
      transclusionCSSSetting.controlEl.createDiv({
        cls: "excalidraw-markdown-image-editor__css-editor",
      });
    const transclusionCSSEditor = new CSSCodeEditor(
      transclusionCSSEditorHost,
      this.renderSettings.transclusion.css,
      t("MARKDOWN_IMAGE_TRANSCLUSION_CSS_EDITOR_ARIA"),
      (css) => {
        if (!this.renderSettings) {
          return;
        }
        this.renderSettings = {
          ...this.renderSettings,
          transclusion: {
            ...this.renderSettings.transclusion,
            css,
          },
        };
        this.scheduleRender();
      },
    );
    this.cssEditors.push(transclusionCSSEditor);
    const transclusionCSSActions =
      transclusionCSSSetting.controlEl.createDiv({
        cls: "excalidraw-markdown-image-editor__css-actions",
      });
    const insertTransclusionCSSBoilerplateButton = new ButtonComponent(
      transclusionCSSActions,
    )
      .setIcon("file-code-2")
      .setClass("excalidraw-markdown-image-editor__css-action-button")
      .setTooltip(t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"))
      .onClick(() =>
        transclusionCSSEditor.insertBoilerplate(
          TRANSCLUSION_CSS_BOILERPLATE,
          TRANSCLUSION_CSS_BOILERPLATE_MARKER,
        ),
      );
    insertTransclusionCSSBoilerplateButton.buttonEl.setAttribute(
      "aria-label",
      t("MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE"),
    );

    void this.mountMarkdownView(editorHost);
  }

  private saveAppearanceDefaults(): void {
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
    void this.view.plugin.saveSettings();
  }

  private renderSelectionPlaceholder(): void {
    if (!this.tab) {
      return;
    }
    this.renderStatusEl = null;
    this.destroyCSSEditors();
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
      this.app.workspace.getLeaf(false) === view.leaf ||
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
      new Setting(host)
        .setClass("excalidraw-markdown-image-editor__setting--wide")
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
      embeddedFile.file.extension.toLowerCase() !== "md" ||
      this.view.plugin.isExcalidrawFile(embeddedFile.file)
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
    let path = await ScriptEngine.inputPrompt(
      this.view,
      this.view.plugin,
      this.view.app,
      t("MARKDOWN_IMAGE_EXTRACT_TITLE"),
      t("MARKDOWN_IMAGE_EXTRACT_PATH"),
      t("MARKDOWN_IMAGE_DEFAULT_NOTE"),
    );
    if (!path || !this.ensureOwnerValid()) {
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
    sourceView: ExcalidrawView,
    elements: readonly ExcalidrawElement[],
    selectedElementIds: Record<string, boolean>,
  ): void {
    if (!this.tab || this.closed) {
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

  private handleSidepanelFocus(
    nextView: ExcalidrawView | null,
  ): void {
    if (nextView) {
      void this.attachToView(nextView);
      return;
    }
    this.ensureOwnerValid();
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

  private destroyCSSEditors(): void {
    for (const editor of this.cssEditors) {
      editor.destroy();
    }
    this.cssEditors = [];
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
    if (!this.ensureOwnerValid()) {
      return;
    }
    if (!force && !this.editorContentDirty) {
      return;
    }
    if (!this.element || !this.editorView) {
      this.scheduleRender(undefined, 0);
      return;
    }
    const source = await getMarkdownImageSource(this.view, this.element);
    if (!source || this.closed || !this.ensureOwnerValid()) {
      return;
    }
    const markdown = this.editorView.getViewData();
    if (source.source === "external") {
      await this.editorView.save();
      if (!this.ensureOwnerValid()) {
        return;
      }
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

  private async flushAndDetachEditor(saveEditor: boolean = true): Promise<void> {
    const editorView = this.editorView;
    const editorLeaf = this.editorLeaf;
    this.editorView = null;
    this.editorLeaf = null;
    this.editorRoot = null;
    this.editorContentDirty = false;
    this.removeEditorResizeListener();
    this.removeEditorFocusListener();
    if (this.editorChangeRef) {
      this.app.workspace.offref(this.editorChangeRef);
      this.editorChangeRef = null;
    }
    if (editorView && saveEditor) {
      await editorView.save();
    }
    editorLeaf?.detach();
  }

  private close(): void {
    if (this.closed) {
      return;
    }
    const canClearOwnerEditing = this.isOwnerIdentityValid();
    this.closed = true;
    this.ownerAttachmentGeneration++;
    this.selectionGeneration++;
    if (this.activeLeafChangeRef) {
      this.app.workspace.offref(this.activeLeafChangeRef);
      this.activeLeafChangeRef = null;
    }
    this.cancelScheduledRender();
    this.destroyCSSEditors();
    this.focusOwnerButtonEl = null;
    this.ownerStatusEl = null;
    void this.flushAndDetachEditor().finally(() => {
      this.cancelScheduledRender();
      if (canClearOwnerEditing) {
        this.view.clearEmbeddableNodeIsEditing();
      }
      this.element = null;
      this.renderSettings = null;
    });
    void this.plugin.saveSettings();
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
