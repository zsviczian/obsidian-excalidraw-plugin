import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { ColorMaster } from "@zsviczian/colormaster";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";
import { DynamicStyle } from "src/types/types";
import { cloneElement } from "./excalidrawAutomateUtils";
import { ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { addAppendUpdateCustomData } from "./utils";
import { mutateElement } from "src/constants/constants";

export const setDynamicStyle = (
  ea: ExcalidrawAutomate,
  view: ExcalidrawView, //the excalidraw view 
  color: string,
  dynamicStyle: DynamicStyle,
  textBackgroundColor?: string,
) => {
  if(dynamicStyle === "none") {
    view.excalidrawContainer?.removeAttribute("style");
    setTimeout(()=>view.updateScene({appState:{dynamicStyle: ""}, storeAction: "update"}));
    const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
    if(toolspanel) {
      let toolsStyle = toolspanel.getAttribute("style");
      toolsStyle = toolsStyle.replace(/\-\-color\-primary.*/,"");
      toolspanel.setAttribute("style",toolsStyle);
    }
    return;
  }
  //const doc = view.ownerDocument;
  const isLightTheme = 
    view?.excalidrawAPI?.getAppState?.()?.theme === "light" ||
    view?.excalidrawData?.scene?.appState?.theme === "light";

  if (color==="transparent") {
    color = "#ffffff";
  }

  const darker = "#101010";
  const lighter = "#f0f0f0";
  const step = 10;
  const mixRatio = 0.9;

  const invertColor = (c:string) => {
    const cm = ea.getCM(c);
    const lightness = cm.lightness;
    return cm.lightnessTo(Math.abs(lightness-100));
  }
  
  const cmBG = () => isLightTheme
    ? ea.getCM(color)
    : invertColor(color);

  const bgLightness = cmBG().lightness;  
  const isDark = cmBG().darkerBy(step).isDark();
  const isGray = dynamicStyle === "gray";

  //@ts-ignore
  const accentColorString = view.app.getAccentColor();
  const accent = () => isGray
    ? ea.getCM(accentColorString)
    : ea.getCM(accentColorString).mix({color:cmBG(),ratio:0.2});

  const cmBlack = () => ea.getCM("#000000").lightnessTo(bgLightness);

  
  const gray1 = () => isGray
    ? isDark ? cmBlack().lighterBy(10) : cmBlack().darkerBy(10)
    : isDark ? cmBG().lighterBy(10).mix({color:cmBlack(),ratio:0.5}) : cmBG().darkerBy(10).mix({color:cmBlack(),ratio:0.5});
  const gray2 = () => isGray
    ? isDark ? cmBlack().lighterBy(4) : cmBlack().darkerBy(4)
    : isDark ? cmBG().lighterBy(4).mix({color:cmBlack(),ratio:0.5}) : cmBG().darkerBy(4).mix({color:cmBlack(),ratio:0.5});
  
  
  const text = cmBG().mix({color:isDark?lighter:darker, ratio:mixRatio});

  const str = (cm: ColorMaster) => cm.stringHEX({alpha:false});
  const styleObject:{[x: string]: string;} = {
    ['backgroundColor']: str(cmBG()),
    [`--color-primary`]: str(accent()),
    [`--color-surface-low`]: str(gray1()),
    [`--color-surface-mid`]: str(gray1()),
    [`--color-surface-lowest`]: str(gray2()),
    [`--color-surface-high`]: str(gray1().lighterBy(step)),
    [`--color-on-primary-container`]: str(!isDark?accent().darkerBy(15):accent().lighterBy(15)),
    [`--color-surface-primary-container`]: str(isDark?accent().darkerBy(step):accent().lighterBy(step)),
    [`--bold-color`]: str(!isDark?accent().darkerBy(15):accent().lighterBy(15)),
    [`--color-primary-darker`]: str(accent().darkerBy(step)),
    [`--color-primary-darkest`]: str(accent().darkerBy(2*step)),
    ['--button-bg-color']: str(gray1()),
    [`--button-gray-1`]: str(gray1()),
    [`--button-gray-2`]: str(gray2()),
    [`--input-border-color`]: str(gray1()),
    [`--input-bg-color`]: str(gray2()),
    [`--input-label-color`]: str(text),
    [`--island-bg-color`]: gray2().alphaTo(0.93).stringHEX(),
    [`--popup-secondary-bg-color`]: gray2().alphaTo(0.93).stringHEX(),
    [`--icon-fill-color`]: str(text),
    [`--text-primary-color`]: str(text),
    [`--overlay-bg-color`]: gray2().alphaTo(0.6).stringHEX(),
    [`--popup-bg-color`]: str(gray1()),
    [`--color-on-surface`]: str(text),
    [`--default-border-color`]: str(gray1()),
    //[`--color-gray-100`]: str(text),
    [`--color-gray-40`]: str(text), //frame
    [`--color-surface-highlight`]: str(gray1()),
    [`--color-gray-20`]: str(gray1()),
    [`--sidebar-border-color`]: str(gray1()),
    [`--color-primary-light`]: str(accent().lighterBy(step)),
    [`--button-hover-bg`]: str(gray1()),
    [`--sidebar-bg-color`]: gray2().alphaTo(0.93).stringHEX(),
    [`--sidebar-shadow`]: str(gray1()),
    [`--popup-text-color`]: str(text),
    [`--code-normal`]: str(text),
    [`--code-background`]: str(gray2()),
    [`--h1-color`]: str(text),
    [`--h2-color`]: str(text),
    [`--h3-color`]: str(text),
    [`--h4-color`]: str(text),
    [`color`]: str(text),
    ['--excalidraw-caret-color']: textBackgroundColor
      ? str(isLightTheme ? invertColor(textBackgroundColor) : ea.getCM(textBackgroundColor))
      : str(isLightTheme ? text : cmBG()),
    [`--select-highlight-color`]: str(gray1()),
    [`--color-gray-90`]: str(isDark?text.darkerBy(5):text.lighterBy(5)), //search background
    [`--color-gray-80`]: str(isDark?text.darkerBy(10):text.lighterBy(10)), //frame
    [`--color-gray-70`]: str(isDark?text.darkerBy(10):text.lighterBy(10)), //frame
    [`--default-bg-color`]: str(isDark?text.darkerBy(20):text.lighterBy(20)), //search background,
    [`--color-gray-50`]: str(text), //frame
  };
  
    const styleString = Object.keys(styleObject)
      .map((property) => `${property}: ${styleObject[property]}`)
      .join("; ");

  /*view.excalidrawContainer?.setAttribute(
    "style",
    styleString
  )*/

  const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
  if(toolspanel) {
    let toolsStyle = toolspanel.getAttribute("style");
    toolsStyle = toolsStyle.replace(/\-\-color\-primary.*/,"");
    toolspanel.setAttribute("style",toolsStyle+styleString);
  }

  setTimeout(()=>{
    const api = view.excalidrawAPI as ExcalidrawImperativeAPI;
    if(!api) {
      view = null;
      ea = null;
      color = null;
      dynamicStyle = null;
      return;
    }
    const frameColor = {
      stroke: str(isDark?gray2().lighterBy(15):gray2().darkerBy(15)),
      fill: str((isDark?gray2().lighterBy(30):gray2().darkerBy(30)).alphaTo(0.2)),
      nameColor: str(isDark?gray2().lighterBy(50):gray2().darkerBy(50)),
    }
    const scene = api.getSceneElements();
    scene.filter(el=>el.type==="frame").forEach((e:ExcalidrawFrameElement)=>{
      const f = cloneElement(e);
      addAppendUpdateCustomData(f,{frameColor});
      if(
        e.customData && e.customData.frameColor &&
        e.customData.frameColor.stroke    === frameColor.stroke &&
        e.customData.frameColor.fill      === frameColor.fill &&
        e.customData.frameColor.nameColor === frameColor.nameColor
      ) {
        return;
      }
      mutateElement(e,{customData: f.customData});
    });

    view.updateScene({
      appState:{
        frameColor,
        dynamicStyle: styleObject
      },
      storeAction: "update",
    });
    view = null;
    ea = null;
    color = null;
    dynamicStyle = null;
  });
}