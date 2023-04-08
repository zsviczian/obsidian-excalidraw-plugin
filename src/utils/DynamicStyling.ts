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
  const isLightTheme = view?.excalidrawData?.scene?.appState?.theme === "light";

  const darker = "#202020";
  const lighter = "#fbfbfb";
  const step = 5;
  const mixRatio = 0.8;

  const invertColor = (c:string) => {
    const cm = ea.getCM(c);
    const lightness = cm.lightness;
    return cm.lightnessTo(Math.abs(lightness-100));
  }
  
  const cmBG = () => isLightTheme
    ? ea.getCM(color)
    : invertColor(color);

  const bgLightness = cmBG().lightness;  
  const isDark = cmBG().isDark();
  
  const docStyle = doc.querySelector("body").style;
  const accentColorString = `hsl(${
    docStyle.getPropertyValue("--accent-h")},${
    docStyle.getPropertyValue("--accent-s")},${
    docStyle.getPropertyValue("--accent-l")})`;
  const accent = () => ea.getCM(accentColorString);

  const cmBlack = () => ea.getCM("#000000").lightnessTo(bgLightness);

  const isGray = dynamicStyle === "gray";
  const gray1 = isGray
    ? isDark ? cmBlack().lighterBy(15) : cmBlack().darkerBy(15)
    : isDark ? cmBG().lighterBy(15).mix({color:cmBlack(),ratio:0.6}) : cmBG().darkerBy(15).mix({color:cmBlack(),ratio:0.6});
  const gray2 = isGray
    ? isDark ? cmBlack().lighterBy(5) : cmBlack().darkerBy(5)
    : isDark ? cmBG().lighterBy(5).mix({color:cmBlack(),ratio:0.6}) : cmBG().darkerBy(5).mix({color:cmBlack(),ratio:0.6});
  const text = cmBG().mix({color:isDark?lighter:darker, ratio:mixRatio});

  const str = (cm: ColorMaster) => cm.stringHEX({alpha:false});
  const style = `--color-primary: ${str(accent())};` +
    `--color-primary-darker: ${str(accent().darkerBy(step))};` +
    `--color-primary-darkest: ${str(accent().darkerBy(step))};` +
    `--button-gray-1: ${str(gray1)};` +
    `--button-gray-2: ${str(gray2)};` +
    `--input-border-color: ${str(gray1)};` +
    `--input-bg-color: ${str(gray2)};` +
    `--input-label-color: ${str(text)};` +
    `--island-bg-color: ${gray2.alphaTo(0.93).stringHEX()};` +
    `--popup-secondary-bg-color: ${gray2.alphaTo(0.93).stringHEX()};` +
    `--icon-fill-color: ${str(text)};` +
    `--text-primary-color: ${str(text)};` +
    `--overlay-bg-color: ${gray2.alphaTo(0.6).stringHEX()};` +
    `--popup-bg-color: ${str(gray1)};` +
    `--color-gray-100: ${str(text)};` +
    `--color-gray-40: ${str(text)};` +
    `--color-gray-30: ${str(gray1)};` +
    `--color-gray-80: ${str(gray1)};` +
    `--sidebar-border-color: ${str(gray1)};` +
    `--color-primary-light: ${str(gray1)};` +
    `--button-hover-bg: ${str(gray1)};` +
    `--sidebar-bg-color: ${gray2.alphaTo(0.93).stringHEX()};` +
    `--sidebar-shadow: ${str(gray1)};` +
    `--popup-text-color: ${str(text)};` +
    `--code-normal: ${str(text)};` +
    `--h1-color: ${str(text)};` +
    `--h2-color: ${str(text)};` +
    `--h3-color: ${str(text)};` +
    `--h4-color: ${str(text)};` +
    `color: ${str(text)};` + 
    `--select-highlight-color: ${str(gray1)};` + 
    `--popup-bg-color: ${str(text)};`;
  
  view.excalidrawContainer?.setAttribute(
    "style",
    style
  )

  setTimeout(()=>view.updateScene({appState:{dynamicStyle: style}}));
  const toolspanel = view.toolsPanelRef?.current?.containerRef?.current;
  if(toolspanel) {
    let toolsStyle = toolspanel.getAttribute("style");
    toolsStyle = toolsStyle.replace(/\-\-color\-primary.*/,"");
    toolspanel.setAttribute("style",toolsStyle+style);
  }

}