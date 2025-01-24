// LaTeX.ts
import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import ExcalidrawView from "../view/ExcalidrawView";
import { FileData, MimeType } from "./EmbeddedFileLoader";
import { FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import ExcalidrawPlugin from "src/core/main";

declare const loadMathjaxToSVG: Function;
let mathjaxLoaded = false;
let tex2dataURLExternal: Function;
let clearVariables: Function;

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
  addFiles: Function,
) => {
  await loadMathJax();
  const data = await tex2dataURLExternal(equation, 4, view.app);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType as MimeType,
      id: fileId as FileId,
      dataURL: data.dataURL as DataURL,
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