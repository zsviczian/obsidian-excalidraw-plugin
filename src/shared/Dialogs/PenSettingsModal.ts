import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  ColorComponent,
  DropdownComponent,
  Modal,
  Setting,
  SliderComponent,
  TextComponent,
  ToggleComponent,
} from "obsidian";
import type { StrokeWidthKey } from "@zsviczian/excalidraw/types/common/src/constants";
import { COLOR_NAMES } from "src/constants/constants";
import ExcalidrawView from "src/view/ExcalidrawView";
import ExcalidrawPlugin from "src/core/main";
import { setPen } from "src/view/components/menu/ObsidianMenu";
import { ExtendedFillStyle, PenType, PenStyle } from "src/types/penTypes";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { PENS } from "src/utils/pens";
import { fragWithHTML } from "src/utils/utils";
import { setSanitizedHtml } from "src/utils/htmlUtils";
import { showColorPicker } from "./ColorPicker";
import { hideElement, showElement } from "src/utils/styleUtils";
import { t } from "src/lang/helpers";

const EASINGFUNCTIONS: Record<string, string> = {
  linear: "linear",
  easeInQuad: "easeInQuad",
  easeOutQuad: "easeOutQuad",
  easeInOutQuad: "easeInOutQuad",
  easeInCubic: "easeInCubic",
  easeOutCubic: "easeOutCubic",
  easeInOutCubic: "easeInOutCubic",
  easeInQuart: "easeInQuart",
  easeOutQuart: "easeOutQuart",
  easeInOutQuart: "easeInOutQuart",
  easeInQuint: "easeInQuint",
  easeOutQuint: "easeOutQuint",
  easeInOutQuint: "easeInOutQuint",
  easeInSine: "easeInSine",
  easeOutSine: "easeOutSine",
  easeInOutSine: "easeInOutSine",
  easeInExpo: "easeInExpo",
  easeOutExpo: "easeOutExpo",
  easeInOutExpo: "easeInOutExpo",
  easeInCirc: "easeInCirc",
  easeOutCirc: "easeOutCirc",
  easeInOutCirc: "easeInOutCirc",
  easeInBack: "easeInBack",
  easeOutBack: "easeOutBack",
  easeInOutBack: "easeInOutBack",
  easeInElastic: "easeInElastic",
  easeOutElastic: "easeOutElastic",
  easeInOutElastic: "easeInOutElastic",
  easeInBounce: "easeInBounce",
  easeOutBounce: "easeOutBounce",
  easeInOutBounce: "easeInOutBounce",
};

const FREEDRAW_STROKE_WIDTH_PRESETS: Readonly<Record<StrokeWidthKey, number>> = {
  extraThin: 0.25,
  thin: 0.5,
  medium: 1,
  bold: 2,
  extraBold: 4,
};

const getStrokeWidthPresetKey = (strokeWidth: number): StrokeWidthKey | "" => {
  const normalizedStrokeWidth = Math.round(strokeWidth * 100) / 100;
  const matchedPreset = (Object.entries(FREEDRAW_STROKE_WIDTH_PRESETS) as [
    StrokeWidthKey,
    number,
  ][]).find(([, value]) => value === normalizedStrokeWidth);
  return matchedPreset?.[0] ?? "";
};

export class PenSettingsModal extends Modal {
  private api: ExcalidrawImperativeAPI;
  private isSaved: boolean = false;
  private isDirty: boolean = false;
  private tempPenSettings: PenStyle;

  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
    private pen: number,
  ) {
    super(plugin.app);
    this.api = view.excalidrawAPI;
    // Clone the settings so changes aren't applied unless saved
    this.tempPenSettings = JSON.parse(JSON.stringify(this.plugin.settings.customPens[this.pen])) as PenStyle;
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(t("PEN_SETTINGS_TITLE"));
    void this.createForm();
  }

  onClose() {
    if (this.isSaved && this.isDirty) {
      // Overwrite actual settings with temp settings
      this.plugin.settings.customPens[this.pen] = this.tempPenSettings;
      void this.plugin.saveSettings();
      
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updatePinnedCustomPens(),
      );
      
      const pen = this.plugin.settings.customPens[this.pen];
      const api = this.view.excalidrawAPI;
      setPen(pen, api);
      api.setActiveTool({ type: "freedraw" });
    }
  }

  private addActionButtons(container: HTMLElement) {
    new Setting(container)
      .addButton((bt) =>
        bt
          .setButtonText(t("PEN_SETTINGS_SAVE"))
          .setCta()
          .onClick(() => {
            this.isSaved = true;
            this.close();
          })
      )
      .addButton((bt) =>
        bt.setButtonText(t("PEN_SETTINGS_CANCEL")).onClick(() => {
          this.close();
        })
      );
  }

  async createForm() {
    const hexColor = (color: string): [string, string] => {
      let opacity = "";
      if (COLOR_NAMES.has(color)) {
        return [COLOR_NAMES.get(color), opacity];
      }
      const optionStyle = new Option().style;
      optionStyle.color = color;
      if (optionStyle.color) {
        const digits = optionStyle.color.match(
          /^[^\d]*(\d*)[^\d]*(\d*)[^\d]*(\d*)[^\d]*([\d.]*)?/,
        );
        if (!digits) {
          return [null, opacity];
        }
        opacity = digits[4]
          ? (Math.round(parseFloat(digits[4]) * 255) << 0)
              .toString(16)
              .padStart(2, "0")
          : "";
        return [
          `#${(parseInt(digits[1]) << 0).toString(16).padStart(2, "0")}${(
            parseInt(digits[2]) << 0
          )
            .toString(16)
            .padStart(2, "0")}${(parseInt(digits[3]) << 0)
            .toString(16)
            .padStart(2, "0")}`,
          opacity,
        ];
      }
      return [null, opacity];
    };

    const ps = this.tempPenSettings;
    const ce = this.contentEl;
    ce.empty();

    // Top buttons
    this.addActionButtons(ce);

    ce.createEl("h1", { text: t("PEN_SETTINGS_HEADING") });

    new Setting(ce)
      .setName(t("PEN_SETTINGS_TYPE_NAME"))
      .setDesc(t("PEN_SETTINGS_TYPE_DESC"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("default", t("PEN_SETTINGS_TYPE_DEFAULT"))
          .addOption("highlighter", t("PEN_SETTINGS_TYPE_HIGHLIGHTER"))
          .addOption("finetip", t("PEN_SETTINGS_TYPE_FINETIP"))
          .addOption("fountain", t("PEN_SETTINGS_TYPE_FOUNTAIN"))
          .addOption("marker", t("PEN_SETTINGS_TYPE_MARKER"))
          .addOption("thick-thin", t("PEN_SETTINGS_TYPE_THICK_THIN"))
          .addOption("thin-thick-thin", t("PEN_SETTINGS_TYPE_THIN_THICK_THIN"))
          .setValue(ps.type)
          .onChange((value: PenType) => {
            this.isDirty = true;
            ps.type = value;
          });
      })
      .addButton((button) =>
        button.setButtonText(t("PEN_SETTINGS_APPLY")).onClick(() => {
          this.isDirty = true;
          ps.strokeColor = PENS[ps.type].strokeColor;
          ps.backgroundColor = PENS[ps.type].backgroundColor;
          ps.fillStyle = PENS[ps.type].fillStyle;
          ps.strokeWidth = PENS[ps.type].strokeWidth;
          ps.roughness = PENS[ps.type].roughness;
          ps.penOptions = { ...PENS[ps.type].penOptions };
          void this.createForm();
        }),
      );

    const scopeSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          ps.freedrawOnly
            ? t("PEN_SETTINGS_SCOPE_FREEDRAW_ONLY")
            : t("PEN_SETTINGS_SCOPE_ALL_SHAPES"),
        ),
      )
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_SCOPE_DESC"),
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(ps.freedrawOnly).onChange((value) => {
          this.isDirty = true;
          scopeSetting.setName(
            fragWithHTML(
              value
                ? t("PEN_SETTINGS_SCOPE_FREEDRAW_ONLY")
                : t("PEN_SETTINGS_SCOPE_ALL_SHAPES"),
            ),
          );
          ps.freedrawOnly = value;
        }),
      );

    let sccpComponent: ColorComponent;
    let sctComponent: TextComponent;
    let strokeUseCurrentToggle: ToggleComponent;
    let [sHex, sOpacity] = hexColor(ps.strokeColor);
    let sChangeBounce: boolean = false;

    const strokeSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          !ps.strokeColor
            ? t("PEN_SETTINGS_STROKE_CURRENT")
            : t("PEN_SETTINGS_STROKE_PRESET"),
        ),
      )
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_STROKE_DESC"),
        ),
      )
      .addToggle((toggle) => {
        strokeUseCurrentToggle = toggle;
        toggle.setValue(!ps.strokeColor).onChange((value) => {
          this.isDirty = true;
          if (value) {
            hideElement(scSetting.settingEl);
          } else {
            showElement(scSetting.settingEl);
          }
          strokeSetting.setName(
            fragWithHTML(
              value
                ? t("PEN_SETTINGS_STROKE_CURRENT")
                : t("PEN_SETTINGS_STROKE_PRESET"),
            ),
          );
          if (value) {
            delete ps.strokeColor;
          } else {
            if (!sctComponent.getValue()) {
              [sHex, sOpacity] = hexColor("black");
              sccpComponent.setValue(sHex);
              sctComponent.setValue("black");
            }
            ps.strokeColor = sctComponent.getValue();
          }
        });
      });

    const scSetting = new Setting(ce)
      .setName(t("PEN_SETTINGS_STROKE_SELECT"))
      .addButton((button) =>
        button.setButtonText(t("PEN_SETTINGS_USE_CANVAS_CURRENT")).onClick(() => {
          const st = this.api.getAppState();
          const color =
            st.resetCustomPen?.currentItemStrokeColor ??
            st.currentItemStrokeColor;
          [sHex, sOpacity] = hexColor(color);
          ps.strokeColor = color;
          this.isDirty = true;
          sctComponent.setValue(color);
          sChangeBounce = true;
          sccpComponent.setValue(sHex);
        }),
      )
      .addText((text) => {
        sctComponent = text;
        text.setValue(ps.strokeColor).onChange((value) => {
          sChangeBounce = true;
          this.isDirty = true;
          ps.strokeColor = value;
          [sHex, sOpacity] = hexColor(value);
          if (sHex) {
            sccpComponent.setValue(sHex);
          }
        });
      })
      .addColorPicker((colorpicker) => {
        sccpComponent = colorpicker;
        colorpicker.setValue(sHex ?? "#000000").onChange((value) => {
          if (sChangeBounce) {
            sChangeBounce = false;
            return;
          }
          this.isDirty = true;
          ps.strokeColor = value + sOpacity;
          sctComponent.setValue(value + sOpacity);
        });
      })
      .addButton((button) => {
        button.setIcon("swatch-book").onClick(async () => {
          const selected = await showColorPicker(
            "elementStroke",
            button.buttonEl,
            this.view,
            true,
          );
          if (!selected) {
            return;
          }
          strokeUseCurrentToggle?.setValue(false);
          sChangeBounce = true;
          [sHex, sOpacity] = hexColor(selected);
          ps.strokeColor = selected;
          sctComponent.setValue(selected);
          if (sHex) {
            sccpComponent.setValue(sHex);
          }
        });
      });

    if (ps.strokeColor) {
      showElement(scSetting.settingEl);
    } else {
      hideElement(scSetting.settingEl);
    }

    let bgcpComponent: ColorComponent;
    let bgctComponent: TextComponent;
    let bgtComponent: ToggleComponent;
    let bgUseCurrentToggle: ToggleComponent;
    let [bgHex, bgOpacity] = hexColor(ps.backgroundColor);

    const bgSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          !ps.backgroundColor
            ? t("PEN_SETTINGS_BG_CURRENT")
            : t("PEN_SETTINGS_BG_PRESET"),
        ),
      )
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_BG_DESC"),
        ),
      )
      .addToggle((toggle) => {
        bgUseCurrentToggle = toggle;
        toggle.setValue(!ps.backgroundColor).onChange((value) => {
          this.isDirty = true;
          bgSetting.setName(
            fragWithHTML(
              value
                ? t("PEN_SETTINGS_BG_CURRENT")
                : t("PEN_SETTINGS_BG_PRESET"),
            ),
          );

          if (value) {
            hideElement(bgctSetting.settingEl);
          } else {
            showElement(bgctSetting.settingEl);
          }

          if (value || ps.backgroundColor === "transparent") {
            hideElement(bgcSetting.settingEl);
          } else {
            showElement(bgcSetting.settingEl);
          }
          if (value) {
            delete ps.backgroundColor;
          } else {
            if (!bgctComponent.getValue()) {
              [bgHex, bgOpacity] = hexColor("black");
              bgcpComponent.setValue(bgHex);
              bgctComponent.setValue("black");
            }
            bgtComponent.setValue(false);
          }
        });
      });

    const bgctSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          ps.backgroundColor === "transparent"
            ? t("PEN_SETTINGS_BG_TRANSPARENT")
            : t("PEN_SETTINGS_BG_COLOR_PRESET"),
        ),
      )
      .setDesc(t("PEN_SETTINGS_BG_TRANSPARENT_DESC"))
      .addToggle((toggle) => {
        bgtComponent = toggle;
        toggle
          .setValue(ps.backgroundColor === "transparent")
          .onChange((value) => {
            this.isDirty = true;
            if (value) {
              hideElement(bgcSetting.settingEl);
              hideElement(fsSetting.settingEl);
            } else {
              showElement(bgcSetting.settingEl);
              showElement(fsSetting.settingEl);
            }
            bgctSetting.setName(
              fragWithHTML(
                value
                  ? t("PEN_SETTINGS_BG_TRANSPARENT")
                  : t("PEN_SETTINGS_BG_COLOR_PRESET"),
              ),
            );
            ps.backgroundColor = value
              ? "transparent"
              : bgcpComponent.getValue();
          });
      });

    if (ps.backgroundColor) {
      showElement(bgctSetting.settingEl);
    } else {
      hideElement(bgctSetting.settingEl);
    }
    let bgChangeBounce: boolean = false;
    const bgcSetting = new Setting(ce)
      .setName(t("PEN_SETTINGS_BG_COLOR"))
      .addButton((button) =>
        button.setButtonText(t("PEN_SETTINGS_USE_CANVAS_CURRENT")).onClick(() => {
          const st = this.api.getAppState();
          const color =
            st.resetCustomPen?.currentItemBackgroundColor ??
            st.currentItemBackgroundColor;
          [bgHex, bgOpacity] = hexColor(color);
          ps.backgroundColor = color;
          this.isDirty = true;
          bgctComponent.setValue(color);
          bgChangeBounce = true;
          bgcpComponent.setValue(bgHex);
        }),
      )
      .addText((text) => {
        bgctComponent = text;
        text.setValue(ps.backgroundColor).onChange((value) => {
          bgChangeBounce = true;
          this.isDirty = true;
          ps.backgroundColor = value;
          [bgHex, bgOpacity] = hexColor(value);
          if (bgHex) {
            bgcpComponent.setValue(bgHex);
          }
        });
      })
      .addColorPicker((colorpicker) => {
        bgcpComponent = colorpicker;
        colorpicker.setValue(bgHex ?? "#000000").onChange((value) => {
          if (bgChangeBounce) {
            bgChangeBounce = false;
            return;
          }
          this.isDirty = true;
          ps.backgroundColor = value + bgOpacity;
          bgctComponent.setValue(value + bgOpacity);
        });
      })
      .addButton((button) => {
        button.setIcon("swatch-book").onClick(async () => {
          const selected = await showColorPicker(
            "elementBackground",
            button.buttonEl,
            this.view,
            true,
          );
          if (!selected) {
            return;
          }
          bgUseCurrentToggle?.setValue(false);
          bgtComponent?.setValue(false);
          bgChangeBounce = true;
          [bgHex, bgOpacity] = hexColor(selected);
          ps.backgroundColor = selected;
          bgctComponent.setValue(selected);
          if (bgHex) {
            bgcpComponent.setValue(bgHex);
          }
        });
      });

    if (!ps.backgroundColor || ps.backgroundColor === "transparent") {
      hideElement(bgcSetting.settingEl);
    } else {
      showElement(bgcSetting.settingEl);
    }

    const fsSetting = new Setting(ce)
      .setName(t("PEN_SETTINGS_FILL_STYLE"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("", t("PEN_SETTINGS_FILL_UNSET"))
          .addOption("dots", t("PEN_SETTINGS_FILL_DOTS"))
          .addOption("zigzag", t("PEN_SETTINGS_FILL_ZIGZAG"))
          .addOption("zigzag-line", t("PEN_SETTINGS_FILL_ZIGZAG_LINE"))
          .addOption("dashed", t("PEN_SETTINGS_FILL_DASHED"))
          .addOption("hachure", t("PEN_SETTINGS_FILL_HACHURE"))
          .addOption("cross-hatch", t("PEN_SETTINGS_FILL_CROSS_HATCH"))
          .addOption("solid", t("PEN_SETTINGS_FILL_SOLID"))
          .setValue(ps.fillStyle)
          .onChange((value: ExtendedFillStyle) => {
            this.isDirty = true;
            ps.fillStyle = value;
          }),
      );
    if (!ps.backgroundColor || ps.backgroundColor === "transparent") {
      hideElement(fsSetting.settingEl);
    } else {
      showElement(fsSetting.settingEl);
    }

    const getSloppinessName = (roughness: number | null) => {
      if (roughness === null) return t("PEN_SETTINGS_NOT_SET");
      if (roughness <= 0.5) return `${t("PEN_SETTINGS_SLOPPINESS_ARCHITECT")} (${roughness})`;
      if (roughness <= 1.5) return `${t("PEN_SETTINGS_SLOPPINESS_ARTIST")} (${roughness})`;
      return `${t("PEN_SETTINGS_SLOPPINESS_CARTOONIST")} (${roughness})`;
    };

    const rSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          `${t("PEN_SETTINGS_SLOPPINESS")} <b>${getSloppinessName(ps.roughness)}</b>`,
        ),
      )
      .setDesc(t("PEN_SETTINGS_SLOPPINESS_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(-0.5, 3, 0.5)
          .setValue(ps.roughness === null ? -0.5 : ps.roughness)
          .onChange((value) => {
            this.isDirty = true;
            ps.roughness = value === -0.5 ? null : value;
            rSetting.setName(
              fragWithHTML(
                `${t("PEN_SETTINGS_SLOPPINESS")} <b>${getSloppinessName(ps.roughness)}</b>`,
              ),
            );
          }),
      );

    let strokeWidthSlider: SliderComponent;
    let strokeWidthPresetDropdown: DropdownComponent;
    let strokeWidthPresetUpdateInProgress = false;

    const swSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          `${t("PEN_SETTINGS_STROKE_WIDTH")} <b>${ps.strokeWidth === 0 ? t("PEN_SETTINGS_NOT_SET") : ps.strokeWidth}</b>`,
        ),
      )
      .addDropdown((dropdown) => {
        strokeWidthPresetDropdown = dropdown;
        dropdown
          .addOption("", t("PEN_SETTINGS_STROKE_PRESET_UNSET"))
          .addOption("extraThin", t("PEN_SETTINGS_STROKE_PRESET_EXTRA_THIN"))
          .addOption("thin", t("PEN_SETTINGS_STROKE_PRESET_THIN"))
          .addOption("medium", t("PEN_SETTINGS_STROKE_PRESET_MEDIUM"))
          .addOption("bold", t("PEN_SETTINGS_STROKE_PRESET_BOLD"))
          .addOption("extraBold", t("PEN_SETTINGS_STROKE_PRESET_EXTRA_BOLD"))
          .setValue(getStrokeWidthPresetKey(ps.strokeWidth))
          .onChange((value: StrokeWidthKey | "") => {
            this.isDirty = true;
            if (!value) {
              return;
            }
            const presetStrokeWidth = FREEDRAW_STROKE_WIDTH_PRESETS[value];
            ps.strokeWidth = presetStrokeWidth;
            strokeWidthPresetUpdateInProgress = true;
            strokeWidthSlider?.setValue(presetStrokeWidth);
            swSetting.setName(
              fragWithHTML(
                `${t("PEN_SETTINGS_STROKE_WIDTH")} <b>${ps.strokeWidth === 0 ? t("PEN_SETTINGS_NOT_SET") : ps.strokeWidth}</b>`,
              ),
            );
          });
      })
      .addSlider((slider) => {
        strokeWidthSlider = slider;
        slider
          .setLimits(0.05, 8, 0.05)
          .setValue(ps.strokeWidth)
          .onChange((value) => {
            this.isDirty = true;
            ps.strokeWidth = value;

            if (strokeWidthPresetUpdateInProgress) {
              strokeWidthPresetUpdateInProgress = false;
            } else {
              strokeWidthPresetDropdown.setValue(getStrokeWidthPresetKey(value));
            }

            swSetting.setName(
              fragWithHTML(
                `${t("PEN_SETTINGS_STROKE_WIDTH")} <b>${ps.strokeWidth === 0 ? t("PEN_SETTINGS_NOT_SET") : ps.strokeWidth}</b>`,
              ),
            );
          });
      });

    new Setting(ce).setName(t("PEN_SETTINGS_HIGHLIGHTER")).addToggle((toggle) =>
      toggle.setValue(ps.penOptions.highlighter).onChange((value) => {
        this.isDirty = true;
        ps.penOptions.highlighter = value;
      }),
    );

    new Setting(ce)
      .setName(t("PEN_SETTINGS_PRESSURE"))
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_PRESSURE_DESC"),
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(!ps.penOptions.constantPressure).onChange((value) => {
          this.isDirty = true;
          ps.penOptions.constantPressure = !value;
          if (ps.penOptions.constantPressure) {
            hideElement(spSetting.settingEl);
          } else {
            showElement(spSetting.settingEl);
          }
        }),
      );

    if (ps.penOptions.hasOutline && ps.penOptions.outlineWidth === 0) {
      ps.penOptions.outlineWidth = 0.5;
      this.isDirty = true;
    }

    if (!ps.penOptions.hasOutline && ps.penOptions.outlineWidth > 0) {
      ps.penOptions.outlineWidth = 0;
      this.isDirty = true;
    }

    const owSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          ps.penOptions.outlineWidth === 0
            ? t("PEN_SETTINGS_OUTLINE_NONE")
            : `${t("PEN_SETTINGS_OUTLINE_WIDTH")} <b>${ps.penOptions.outlineWidth}</b>`,
        ),
      )
      .setDesc(t("PEN_SETTINGS_OUTLINE_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 8, 0.1)
          .setValue(ps.penOptions.outlineWidth)
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.outlineWidth = value;
            ps.penOptions.hasOutline = value > 0;
            owSetting.setName(
              fragWithHTML(
                ps.penOptions.outlineWidth === 0
                  ? t("PEN_SETTINGS_OUTLINE_NONE")
                  : `${t("PEN_SETTINGS_OUTLINE_WIDTH")} <b>${ps.penOptions.outlineWidth}</b>`,
              ),
            );
          }),
      );

    ce.createEl("h2", { text: t("PEN_SETTINGS_PF_HEADING") });
    const p = ce.createEl("p");
    setSanitizedHtml(
      p,
      t("PEN_SETTINGS_PF_DOCS"),
    );

    const tSetting = new Setting(ce)
      .setName(
        fragWithHTML(`${t("PEN_SETTINGS_PF_THINNING")} <b>${ps.penOptions.options.thinning}</b>`),
      )
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_PF_THINNING_DESC"),
        ),
      )
      .addSlider((slider) =>
        slider
          .setLimits(-1, 1, 0.05)
          .setValue(ps.penOptions.options.thinning)
          .onChange((value) => {
            this.isDirty = true;
            tSetting.setName(fragWithHTML(`${t("PEN_SETTINGS_PF_THINNING")} <b>${value}</b>`));
            ps.penOptions.options.thinning = value;
          }),
      );

    const sSetting = new Setting(ce)
      .setName(
        fragWithHTML(`${t("PEN_SETTINGS_PF_SMOOTHING")} <b>${ps.penOptions.options.smoothing}</b>`),
      )
      .setDesc(fragWithHTML(t("PEN_SETTINGS_PF_SMOOTHING_DESC")))
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(ps.penOptions.options.smoothing)
          .onChange((value) => {
            this.isDirty = true;
            sSetting.setName(fragWithHTML(`${t("PEN_SETTINGS_PF_SMOOTHING")} <b>${value}</b>`));
            ps.penOptions.options.smoothing = value;
          }),
      );

    const slSetting = new Setting(ce)
      .setName(
        fragWithHTML(`${t("PEN_SETTINGS_PF_STREAMLINE")} <b>${ps.penOptions.options.streamline}</b>`),
      )
      .setDesc(fragWithHTML(t("PEN_SETTINGS_PF_STREAMLINE_DESC")))
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(ps.penOptions.options.streamline)
          .onChange((value) => {
            this.isDirty = true;
            slSetting.setName(fragWithHTML(`${t("PEN_SETTINGS_PF_STREAMLINE")} <b>${value}</b>`));
            ps.penOptions.options.streamline = value;
          }),
      );

    new Setting(ce)
      .setName(t("PEN_SETTINGS_EASING"))
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_EASING_DESC"),
        ),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(EASINGFUNCTIONS)
          .setValue(ps.penOptions.options.easing)
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.options.easing = value;
          }),
      );

    const spSetting = new Setting(ce)
      .setName(t("PEN_SETTINGS_SIMULATE_PRESSURE"))
      .setDesc(t("PEN_SETTINGS_SIMULATE_PRESSURE_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("true", t("PEN_SETTINGS_SIMULATE_PRESSURE_ALWAYS"))
          .addOption("false", t("PEN_SETTINGS_SIMULATE_PRESSURE_NEVER"))
          .addOption("", t("PEN_SETTINGS_SIMULATE_PRESSURE_MOUSE"))
          .setValue(
            ps.penOptions.options.simulatePressure === true
              ? "true"
              : ps.penOptions.options.simulatePressure === false
                ? "false"
                : "",
          )
          .onChange((value) => {
            this.isDirty = true;
            switch (value) {
              case "true":
                ps.penOptions.options.simulatePressure = true;
                break;
              case "false":
                ps.penOptions.options.simulatePressure = false;
                break;
              default:
                delete ps.penOptions.options.simulatePressure;
            }
          }),
      );

    if (ps.penOptions.constantPressure) {
      hideElement(spSetting.settingEl);
    } else {
      showElement(spSetting.settingEl);
    }

    ce.createEl("h3", { text: t("PEN_SETTINGS_START_HEADING") });
    ce.createEl("p", { text: t("PEN_SETTINGS_START_DESC") });

    new Setting(ce)
      .setName(t("PEN_SETTINGS_CAP_START"))
      .setDesc(t("PEN_SETTINGS_CAP_DESC"))
      .addToggle((toggle) =>
        toggle.setValue(ps.penOptions.options.start.cap).onChange((value) => {
          this.isDirty = true;
          ps.penOptions.options.start.cap = value;
        }),
      );

    const stSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          `${t("PEN_SETTINGS_TAPER")} <b>${ps.penOptions.options.start.taper === true ? "true" : ps.penOptions.options.start.taper}</b>`,
        ),
      )
      .setDesc(t("PEN_SETTINGS_TAPER_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 151, 1)
          .setValue(
            typeof ps.penOptions.options.start.taper === "boolean"
              ? 151
              : ps.penOptions.options.start.taper,
          )
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.options.start.taper = value === 151 ? true : value;
            stSetting.setName(
              fragWithHTML(
                `${t("PEN_SETTINGS_TAPER")} <b>${ps.penOptions.options.start.taper === true ? "true" : ps.penOptions.options.start.taper}</b>`,
              ),
            );
          }),
      );

    new Setting(ce)
      .setName(t("PEN_SETTINGS_EASING"))
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_EASING_DESC"),
        ),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(EASINGFUNCTIONS)
          .setValue(ps.penOptions.options.start.easing)
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.options.start.easing = value;
          }),
      );

    ce.createEl("h3", { text: t("PEN_SETTINGS_END_HEADING") });
    ce.createEl("p", { text: t("PEN_SETTINGS_END_DESC") });

    new Setting(ce)
      .setName(t("PEN_SETTINGS_CAP_END"))
      .setDesc(t("PEN_SETTINGS_CAP_DESC"))
      .addToggle((toggle) =>
        toggle.setValue(ps.penOptions.options.end.cap).onChange((value) => {
          this.isDirty = true;
          ps.penOptions.options.end.cap = value;
        }),
      );

    const etSetting = new Setting(ce)
      .setName(
        fragWithHTML(
          `${t("PEN_SETTINGS_TAPER")} <b>${ps.penOptions.options.end.taper === true ? "true" : ps.penOptions.options.end.taper}</b>`,
        ),
      )
      .setDesc(t("PEN_SETTINGS_TAPER_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 151, 1)
          .setValue(
            typeof ps.penOptions.options.end.taper === "boolean"
              ? 151
              : ps.penOptions.options.end.taper,
          )
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.options.end.taper = value === 151 ? true : value;
            etSetting.setName(
              fragWithHTML(
                `${t("PEN_SETTINGS_TAPER")} <b>${ps.penOptions.options.end.taper === true ? "true" : ps.penOptions.options.end.taper}</b>`,
              ),
            );
          }),
      );

    new Setting(ce)
      .setName(t("PEN_SETTINGS_EASING"))
      .setDesc(
        fragWithHTML(
          t("PEN_SETTINGS_EASING_DESC"),
        ),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(EASINGFUNCTIONS)
          .setValue(ps.penOptions.options.end.easing)
          .onChange((value) => {
            this.isDirty = true;
            ps.penOptions.options.end.easing = value;
          }),
      );

    // Bottom buttons
    this.addActionButtons(ce);
  }
}