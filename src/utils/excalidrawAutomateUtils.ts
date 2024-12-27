import { ExcalidrawElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { errorlog } from "./utils";
import { ColorMap } from "src/shared/EmbeddedFileLoader";
import { SVGColorInfo } from "src/types/excalidrawAutomateTypes";

export function isSVGColorInfo(obj: ColorMap | SVGColorInfo): boolean {
  return (
    typeof obj === 'object' && 
    obj !== null &&
    'stroke' in obj &&
    'fill' in obj &&
    'mappedTo' in obj
  );
}

export function mergeColorMapIntoSVGColorInfo(
  colorMap: ColorMap,
  svgColorInfo: SVGColorInfo
): SVGColorInfo {
  if(colorMap) {
    for(const key of Object.keys(colorMap)) {
      if(svgColorInfo.has(key)) {
        svgColorInfo.get(key).mappedTo = colorMap[key];
      }
    }
  }
  return svgColorInfo;
}
export function svgColorInfoToColorMap(svgColorInfo: SVGColorInfo): ColorMap {
  const colorMap: ColorMap = {};
  svgColorInfo.forEach((info, color) => {
    if (info.fill || info.stroke) {
      colorMap[color] = info.mappedTo;
    }
  });
  return colorMap;
}

//Remove identical key-value pairs from a ColorMap
export function filterColorMap(colorMap: ColorMap): ColorMap {
  return Object.fromEntries(
    Object.entries(colorMap).filter(([key, value]) => key.toLocaleLowerCase() !== value?.toLocaleLowerCase())
  );
}

export function updateOrAddSVGColorInfo(
  svgColorInfo: SVGColorInfo,
  color: string,
  info: {fill?: boolean, stroke?: boolean, mappedTo?: string}
): SVGColorInfo {
  const {fill, stroke, mappedTo} = info;
  color = color.toLocaleLowerCase();
  const colorData = svgColorInfo.get(color) || {mappedTo: color, fill: false, stroke: false};
  if(fill !== undefined) {
    colorData.fill = fill;
  }
  if(stroke !== undefined) {
    colorData.stroke = stroke;
  }
  if(mappedTo !== undefined) {
    colorData.mappedTo = mappedTo;
  }
  return svgColorInfo.set(color, colorData);
}

export function getEmbeddedFileForImageElment(ea: ExcalidrawAutomate, el: ExcalidrawElement) {
  if (!ea.targetView || !ea.targetView?._loaded) {
    errorMessage("targetView not set", "getViewFileForImageElement()");
    return null;
  }

  if (!el || el.type !== "image") {
    errorMessage(
      "Must provide an image element as input",
      "getViewFileForImageElement()",
    );
    return null;
  }
  return ea.targetView?.excalidrawData?.getFile(el.fileId);
}

export function errorMessage(message: string, source: string):void {
  switch (message) {
    case "targetView not set":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message:
          "targetView not set, or no longer active. Use setView before calling this function",
      });
      break;
    case "mobile not supported":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: "this function is not available on Obsidian Mobile",
      });
      break;
    default:
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: message??"unknown error",
      });
  }
}

export function isColorStringTransparent(color: string): boolean {
  const rgbaHslaTransparentRegex = /^(rgba|hsla)\(.*?,.*?,.*?,\s*0(\.0+)?\)$/i;
  const hexTransparentRegex = /^#[a-fA-F0-9]{8}00$/i;

  return rgbaHslaTransparentRegex.test(color) || hexTransparentRegex.test(color);
}
