// LaTeX.ts
import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { App } from "obsidian";
import ExcalidrawView from "../view/ExcalidrawView";
import { FileData, MimeType } from "src/types/embeddedFileLoaderTypes";
import { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import ExcalidrawPlugin from "src/core/main";

type MathJaxData = {
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
};

type MathJaxContext = App | ExcalidrawPlugin;

type MathJaxModule = {
  tex2dataURL: (
    tex: string,
    scale: number,
    pluginOrApp: MathJaxContext,
  ) => Promise<MathJaxData>;
  clearMathJaxVariables: () => void;
};

declare const loadMathjaxToSVG: () => Promise<MathJaxModule>;
let mathjaxLoaded = false;
let tex2dataURLExternal:
  | ((
      tex: string,
      scale: number,
      pluginOrApp: MathJaxContext,
    ) => Promise<MathJaxData>)
  | null = null;
let clearVariables: (() => void) | null = null;

let loadMathJaxPromise: Promise<void> | null = null;

const loadMathJax = async () => {
  if (!loadMathJaxPromise) {
    loadMathJaxPromise = (async () => {
      if (!mathjaxLoaded) {
        const module = await loadMathjaxToSVG();
        tex2dataURLExternal = module.tex2dataURL;
        clearVariables = module.clearMathJaxVariables;
        mathjaxLoaded = true;
      }
    })();
  }
  return loadMathJaxPromise;
};

export const updateEquation = async (
  equation: string,
  fileId: string,
  view: ExcalidrawView,
  addFiles: (files: FileData[], view: ExcalidrawView) => void,
) => {
  await loadMathJax();
  const data = await tex2dataURLExternal?.(equation, 4, view.app);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType,
      id: fileId,
      dataURL: data.dataURL,
      created: data.created,
      size: data.size,
      hasSVGwithBitmap: false,
      shouldScale: true,
    });
    addFiles(files, view);
  }
};

export async function tex2dataURL(
  tex: string,
  scale: number = 4,
  plugin: ExcalidrawPlugin,
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  await loadMathJax();
  return tex2dataURLExternal(tex, scale, plugin);
}

export const clearMathJaxVariables = () => {
  if (clearVariables) {
    clearVariables();
  }
};
