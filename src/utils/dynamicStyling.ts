import CM, { ColorMaster } from "@zsviczian/colormaster";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";
import { DynamicStyle } from "src/types/types";
import { cloneElement } from "./excalidrawViewHelpers";
import { ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/element/src/types";
import { addAppendUpdateCustomData } from "./utils";
import { CaptureUpdateAction } from "src/constants/constants";
import { errorlog } from "./coreUtils";
import { removeStyle, setStyle } from "./styleUtils";

const applyToolsPanelStyle = (
  toolsPanel: HTMLDivElement,
  styleObject: Record<string, string>,
) => {
  // Never rely on parsing inline style text. `style` can be absent or altered by themes/plugins.
  setStyle(toolsPanel, styleObject);
};

const clearToolsPanelDynamicStyle = (
  toolsPanel: HTMLDivElement,
  styleObject: Record<string, string>,
) => {
  removeStyle(toolsPanel, Object.keys(styleObject));
};

const isFrameElement = (el: unknown): el is ExcalidrawFrameElement => {
  if (!el || typeof el !== "object" || !("type" in el)) {
    return false;
  }
  return (el as { type: string }).type === "frame";
};

export const setDynamicStyle = (
  ea: ExcalidrawAutomate,
  view: ExcalidrawView, //the excalidraw view
  color: string,
  dynamicStyle: DynamicStyle,
  textBackgroundColor?: string,
) => {
  try {
    color = color ?? "white";
    // Minimal style contract used to clean up dynamic variables when styling is turned off.
    const emptyStyleObject: Record<string, string> = {
      backgroundColor: "",
      "--color-primary": "",
      "--color-surface-low": "",
      "--color-surface-mid": "",
      "--color-surface-lowest": "",
      "--color-warning": "",
      "--color-surface-high": "",
      "--color-on-primary-container": "",
      "--color-surface-primary-container": "",
      "--bold-color": "",
      "--color-primary-darker": "",
      "--color-brand-hover": "",
      "--color-primary-darkest": "",
      "--button-bg-color": "",
      "--button-gray-1": "",
      "--button-gray-2": "",
      "--input-border-color": "",
      "--input-bg-color": "",
      "--input-label-color": "",
      "--island-bg-color": "",
      "--popup-secondary-bg-color": "",
      "--icon-fill-color": "",
      "--text-primary-color": "",
      "--overlay-bg-color": "",
      "--popup-bg-color": "",
      "--color-on-surface": "",
      "--default-border-color": "",
      "--color-gray-40": "",
      "--color-surface-highlight": "",
      "--color-gray-20": "",
      "--sidebar-border-color": "",
      "--color-primary-light": "",
      "--button-hover-bg": "",
      "--sidebar-bg-color": "",
      "--sidebar-shadow": "",
      "--popup-text-color": "",
      "--code-normal": "",
      "--code-background": "",
      "--h1-color": "",
      "--h2-color": "",
      "--h3-color": "",
      "--h4-color": "",
      color: "",
      "--excalidraw-caret-color": "",
      "--select-highlight-color": "",
      "--color-gray-90": "",
      "--color-gray-80": "",
      "--color-gray-70": "",
      "--default-bg-color": "",
      "--color-gray-50": "",
    };

    const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
    if (dynamicStyle === "none") {
      window.setTimeout(() =>
        view.updateScene({
          appState: { dynamicStyle: {} },
          captureUpdate: CaptureUpdateAction.NEVER,
        }),
      );
      if (toolspanel) {
        clearToolsPanelDynamicStyle(toolspanel, emptyStyleObject);
      }
      return;
    }
    //const doc = view.ownerDocument;
    const st = view?.excalidrawAPI?.getAppState?.();

    const isLightTheme = st?.theme === "light" || st?.theme === "light";

    if (color === "transparent") {
      color = "#ffffff";
    }

    const darker = "#101010";
    const lighter = "#f0f0f0";
    const step = 10;
    const mixRatio = 0.9;

    const invertColor = (c: string) => {
      const cm = ea.getCM(c);
      const lightness = cm.lightness;
      return cm.lightnessTo(Math.abs(lightness - 100));
    };

    const cmBG = () => (isLightTheme ? ea.getCM(color) : invertColor(color));

    const bgLightness = cmBG().lightness;
    const isDark = cmBG().darkerBy(step).isDark();
    const isGray = dynamicStyle === "gray";
    const accentColorString = view.app.getAccentColor();
    const accent = () =>
      isGray
        ? ea.getCM(accentColorString)
        : ea.getCM(accentColorString).mix({ color: cmBG(), ratio: 0.2 });

    const cmBlack = () => ea.getCM("#000000").lightnessTo(bgLightness);
    const cmDarkRed = () => ea.getCM("#8B0000").lightnessTo(bgLightness);

    const gray1 = () =>
      isGray
        ? isDark
          ? cmBlack().lighterBy(12)
          : cmBlack().darkerBy(12)
        : isDark
          ? cmBG().lighterBy(10).mix({ color: cmBlack(), ratio: 0.5 })
          : cmBG().darkerBy(10).mix({ color: cmBlack(), ratio: 0.5 });
    const gray2 = () =>
      isGray
        ? isDark
          ? cmBlack().lighterBy(8)
          : cmBlack().darkerBy(8)
        : isDark
          ? cmBG().lighterBy(4).mix({ color: cmBlack(), ratio: 0.5 })
          : cmBG().darkerBy(4).mix({ color: cmBlack(), ratio: 0.5 });
    const gray3 = () =>
      isGray
        ? isDark
          ? cmBlack().lighterBy(4)
          : cmBlack().darkerBy(4)
        : isDark
          ? cmBG().mix({ color: cmBlack(), ratio: 0.5 })
          : cmBG().mix({ color: cmBlack(), ratio: 0.5 });
    const warning = () =>
      isGray
        ? isDark
          ? cmBlack().lighterBy(2)
          : cmBlack().darkerBy(2)
        : isDark
          ? cmBG().lighterBy(2).mix({ color: cmDarkRed(), ratio: 0.5 })
          : cmBG().darkerBy(2).mix({ color: cmDarkRed(), ratio: 0.5 });

    const text = () =>
      cmBG().mix({ color: isDark ? lighter : darker, ratio: mixRatio });

    const str = (cm: ColorMaster) => cm.stringHEX({ alpha: false });
    const styleObject: { [x: string]: string } = {
      ["backgroundColor"]: str(cmBG()),
      [`--color-primary`]: str(accent()),
      [`--color-surface-low`]: str(gray1()),
      [`--color-surface-mid`]: str(gray1()),
      [`--color-surface-lowest`]: str(gray2()),
      [`--color-warning`]: str(warning()),
      [`--color-surface-high`]: str(gray1().lighterBy(step)),
      [`--color-on-primary-container`]: str(
        !isDark ? accent().darkerBy(15) : accent().lighterBy(15),
      ),
      [`--color-surface-primary-container`]: str(
        isDark ? accent().darkerBy(step) : accent().lighterBy(step),
      ),
      [`--bold-color`]: str(
        !isDark ? accent().darkerBy(15) : accent().lighterBy(15),
      ),
      [`--color-primary-darker`]: str(accent().darkerBy(step)),
      [`--color-brand-hover`]: str(accent().darkerBy(step)),
      [`--color-primary-darkest`]: str(accent().darkerBy(2 * step)),
      ["--button-bg-color"]: str(gray1()),
      [`--button-gray-1`]: str(gray1()),
      [`--button-gray-2`]: str(gray2()),
      [`--input-border-color`]: str(gray1()),
      [`--input-bg-color`]: str(gray2()),
      [`--input-label-color`]: str(text()),
      [`--island-bg-color`]: gray3().alphaTo(0.93).stringHEX(),
      [`--popup-secondary-bg-color`]: gray2().alphaTo(0.93).stringHEX(),
      [`--icon-fill-color`]: str(text()),
      [`--text-primary-color`]: str(text()),
      [`--overlay-bg-color`]: gray2().alphaTo(0.6).stringHEX(),
      [`--popup-bg-color`]: str(gray1()),
      [`--color-on-surface`]: str(text()),
      [`--default-border-color`]: str(gray1()),
      //[`--color-gray-100`]: str(text()),
      [`--color-gray-40`]: str(
        isDark ? text().darkerBy(30) : text().lighterBy(30),
      ), //frame
      [`--color-surface-highlight`]: str(gray1()),
      [`--color-gray-20`]: str(gray1()),
      [`--sidebar-border-color`]: str(gray1()),
      [`--color-primary-light`]: str(accent().lighterBy(step)),
      [`--button-hover-bg`]: str(gray1()),
      [`--sidebar-bg-color`]: gray2().alphaTo(0.93).stringHEX(),
      [`--sidebar-shadow`]: str(gray1()),
      [`--popup-text-color`]: str(text()),
      [`--code-normal`]: str(text()),
      [`--code-background`]: str(gray2()),
      [`--h1-color`]: str(text()),
      [`--h2-color`]: str(text()),
      [`--h3-color`]: str(text()),
      [`--h4-color`]: str(text()),
      [`color`]: str(text()),
      ["--excalidraw-caret-color"]: textBackgroundColor
        ? str(
            isLightTheme
              ? invertColor(textBackgroundColor)
              : ea.getCM(textBackgroundColor),
          )
        : isLightTheme
          ? str(invertColor(color))
          : color,
      [`--select-highlight-color`]: str(gray1()),
      [`--color-gray-90`]: str(
        isDark ? text().darkerBy(5) : text().lighterBy(5),
      ), //search background
      [`--color-gray-80`]: str(
        isDark ? text().darkerBy(9) : text().lighterBy(10),
      ), //frame
      [`--color-gray-70`]: str(
        isDark ? text().darkerBy(13) : text().lighterBy(15),
      ), //frame
      [`--default-bg-color`]: str(
        isDark ? text().darkerBy(20) : text().lighterBy(20),
      ), //search background,
      [`--color-gray-50`]: str(
        isDark ? text().darkerBy(20) : text().lighterBy(25),
      ),
    };

    /*view.excalidrawContainer?.setAttribute(
      "style",
      styleString
    )*/

    if (toolspanel) {
      applyToolsPanelStyle(toolspanel, styleObject);
    }

    window.setTimeout(() => {
      try {
        const api = view.excalidrawAPI;
        if (!api) {
          view = null;
          ea = null;
          color = null;
          dynamicStyle = null;
          return;
        }
        const frameColor = {
          stroke: str(isDark ? gray2().lighterBy(15) : gray2().darkerBy(15)),
          fill: str(
            (isDark ? gray2().lighterBy(30) : gray2().darkerBy(30)).alphaTo(
              0.2,
            ),
          ),
          nameColor: str(isDark ? gray2().lighterBy(50) : gray2().darkerBy(50)),
        };
        const scene = api.getSceneElements() as unknown[];
        scene
          .filter(isFrameElement)
          .forEach((e) => {
            const f = cloneElement(e);
            addAppendUpdateCustomData(f, { frameColor });
            if (
              e.customData &&
              e.customData.frameColor &&
              e.customData.frameColor.stroke === frameColor.stroke &&
              e.customData.frameColor.fill === frameColor.fill &&
              e.customData.frameColor.nameColor === frameColor.nameColor
            ) {
              return;
            }
            view.excalidrawAPI.mutateElement(e, { customData: f.customData });
          });

        view.updateScene({
          appState: {
            frameColor,
            dynamicStyle: styleObject,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      } catch (error: unknown) {
        errorlog({
          where: "setDynamicStyle.window.setTimeout",
          error,
          message: "Dynamic styling deferred update failed",
        });
      } finally {
        view = null;
        ea = null;
        color = null;
        dynamicStyle = null;
      }
    });
  } catch (error: unknown) {
    errorlog({
      where: "setDynamicStyle",
      error,
      message: "Dynamic styling failed",
    });
  }
};

const colorsCache: Map<string, string> = new Map();

export function getHighlightColor(
  ea: ExcalidrawAutomate,
  bgColor: string,
  opacity: number = 1,
): string {
  bgColor = bgColor === "transparent" ? "#ffffff" : bgColor;

  let contrastedRGBA = colorsCache.get(bgColor);
  if (!contrastedRGBA) {
    const bg = ea.getCM(bgColor);
    const bgMix = ea.getCM(bgColor);
    const isDark = bg.isDark();

    const step = 15;
    const candidates = [
      CM((isDark ? bg.lighterBy(step) : bg.darkerBy(step)).stringHEX()),
      CM((isDark ? bg.lighterBy(step) : bg.darkerBy(step)).stringHEX()),
      isDark ? bg.lighterBy(step) : bg.darkerBy(step),
      // Vibrancy boost by mixing toward the opposite theme color
      bgMix.mix({
        color: ea.getCM(isDark ? "#ffffff" : "#000000"),
        ratio: 0.35,
      }),
      ea.getCM(isDark ? "#ffffff" : "#000000"),
      ea.getCM(isDark ? "#000000" : "#ffffff"),
    ];

    const desiredContrast = 2.5;
    const contrasted =
      candidates.find(
        (color) =>
          (color.contrast({ bgColor, ratio: false }) as number) >=
          desiredContrast,
      ) ??
      candidates.reduce((best, color) =>
        color.contrast({ bgColor, ratio: false }) >
        best.contrast({ bgColor, ratio: false })
          ? color
          : best,
      );
    contrastedRGBA = `rgba(${Math.round(
      contrasted.red,
    )},${Math.round(contrasted.green)},${Math.round(contrasted.blue)}`;
    colorsCache.set(bgColor, contrastedRGBA);
  }
  return `${contrastedRGBA},${opacity})`;
}
