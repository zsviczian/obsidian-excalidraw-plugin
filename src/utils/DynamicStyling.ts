import { ColorMaster } from "colormaster";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import ExcalidrawView from "src/ExcalidrawView";
import { DynamicStyle } from "src/types";

export const setDynamicStyle = (
  ea: ExcalidrawAutomate,
  view: ExcalidrawView, //the excalidraw view 
  color: string,
  dynamicStyle: DynamicStyle,
) => {
  if(dynamicStyle === "none") {
    view.excalidrawContainer?.removeAttribute("style");
    setTimeout(()=>view.updateScene({appState:{dynamicStyle: ""}}));
    const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
    if(toolspanel) {
      let toolsStyle = toolspanel.getAttribute("style");
      toolsStyle = toolsStyle.replace(/\-\-color\-primary.*/,"");
      toolspanel.setAttribute("style",toolsStyle);
    }
  

    return;
  }
  const doc = view.ownerDocument;
  const isLightTheme = 
    view?.excalidrawAPI?.getAppState?.()?.theme === "light" ||
    view?.excalidrawData?.scene?.appState?.theme === "light";

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

  
  const gray1 = isGray
    ? isDark ? cmBlack().lighterBy(10) : cmBlack().darkerBy(10)
    : isDark ? cmBG().lighterBy(10).mix({color:cmBlack(),ratio:0.5}) : cmBG().darkerBy(10).mix({color:cmBlack(),ratio:0.5});
  const gray2 = isGray
    ? isDark ? cmBlack().lighterBy(4) : cmBlack().darkerBy(4)
    : isDark ? cmBG().lighterBy(4).mix({color:cmBlack(),ratio:0.5}) : cmBG().darkerBy(4).mix({color:cmBlack(),ratio:0.5});
  const text = cmBG().mix({color:isDark?lighter:darker, ratio:mixRatio});

  const str = (cm: ColorMaster) => cm.stringHEX({alpha:false});
  const styleObject:{[x: string]: string;} = {
    [`--color-primary`]: str(accent()),
    [`--color-surface-low`]: str(gray1),
    [`--color-surface-mid`]: str(gray1),
    [`--color-surface-lowest`]: str(gray2),
    [`--color-surface-high`]: str(gray1.lighterBy(step)),
    [`--color-on-primary-container`]: str(!isDark?accent().darkerBy(15):accent().lighterBy(15)),
    [`--color-surface-primary-container`]: str(isDark?accent().darkerBy(step):accent().lighterBy(step)),
    //[`--color-primary-darker`]: str(accent().darkerBy(step)),
    //[`--color-primary-darkest`]: str(accent().darkerBy(step)),
    [`--button-gray-1`]: str(gray1),
    [`--button-gray-2`]: str(gray2),
    [`--input-border-color`]: str(gray1),
    [`--input-bg-color`]: str(gray2),
    [`--input-label-color`]: str(text),
    [`--island-bg-color`]: gray2.alphaTo(0.93).stringHEX(),
    [`--popup-secondary-bg-color`]: gray2.alphaTo(0.93).stringHEX(),
    [`--icon-fill-color`]: str(text),
    [`--text-primary-color`]: str(text),
    [`--overlay-bg-color`]: gray2.alphaTo(0.6).stringHEX(),
    [`--popup-bg-color`]: str(gray1),
    [`--color-on-surface`]: str(text),
    //[`--color-gray-100`]: str(text),
    [`--color-gray-40`]: str(text), //frame
    [`--color-gray-50`]: str(text), //frame
    [`--color-surface-highlight`]: str(gray1),
    //[`--color-gray-30`]: str(gray1),
    [`--color-gray-80`]: str(isDark?text.lighterBy(15):text.darkerBy(15)), //frame
    [`--sidebar-border-color`]: str(gray1),
    [`--color-primary-light`]: str(accent().lighterBy(step)),
    [`--button-hover-bg`]: str(gray1),
    [`--sidebar-bg-color`]: gray2.alphaTo(0.93).stringHEX(),
    [`--sidebar-shadow`]: str(gray1),
    [`--popup-text-color`]: str(text),
    [`--code-normal`]: str(text),
    [`--code-background`]: str(gray2),
    [`--h1-color`]: str(text),
    [`--h2-color`]: str(text),
    [`--h3-color`]: str(text),
    [`--h4-color`]: str(text),
    [`color`]: str(text), 
    [`--select-highlight-color`]: str(gray1),
  };
  
    const styleString = Object.keys(styleObject)
      .map((property) => `${property}: ${styleObject[property]}`)
      .join("; ");

  /*view.excalidrawContainer?.setAttribute(
    "style",
    styleString
  )*/

  setTimeout(()=>view.updateScene({appState:{
    frameColor: {
      stroke: isDark?str(gray2.lighterBy(15)):str(gray2.darkerBy(15)),
      fill: str((isDark?gray2.lighterBy(30):gray2.darkerBy(30)).alphaTo(0.2)),
    },
    dynamicStyle: styleObject
  }}));
  const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
  if(toolspanel) {
    let toolsStyle = toolspanel.getAttribute("style");
    toolsStyle = toolsStyle.replace(/\-\-color\-primary.*/,"");
    toolspanel.setAttribute("style",toolsStyle+styleString);
  }
}