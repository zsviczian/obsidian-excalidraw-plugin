import { DataURL } from "@zsviczian/excalidraw/types/types";
import {mathjax} from "mathjax-full/js/mathjax";
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {LiteAdaptor, liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import {AllPackages} from 'mathjax-full/js/input/tex/AllPackages.js';

import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { FileData, MimeType } from "./EmbeddedFileLoader";
import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { getImageSize, svgToBase64 } from "./utils/Utils";
import { fileid } from "./constants/constants";
import { TFile } from "obsidian";
import { MathDocument } from "mathjax-full/js/core/MathDocument";

export const updateEquation = async (
  equation: string,
  fileId: string,
  view: ExcalidrawView,
  addFiles: Function,
  plugin: ExcalidrawPlugin,
) => {
  const data = await tex2dataURL(equation);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType,
      id: fileId as FileId,
      dataURL: data.dataURL,
      created: data.created,
      size: data.size,
      hasSVGwithBitmap: false,
      shouldScale: true,
    });
    addFiles(files, view);
  }
};

let adaptor: LiteAdaptor;
let input: TeX<unknown, unknown, unknown>;
let output: SVG<unknown, unknown, unknown>;
let html: MathDocument<any, any, any>;
let preamble: string;

//https://github.com/xldenis/obsidian-latex/blob/master/main.ts
const loadPreamble = async  () => {
  const file = app.vault.getAbstractFileByPath("preamble.sty");
  preamble = file && file instanceof TFile
    ? await app.vault.read(file)
    : null;
};

export async function tex2dataURL(
  tex: string,
  scale: number = 4 // Default scale value, adjust as needed
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  if(!adaptor) {
    await loadPreamble();
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    input = new TeX({
      packages: AllPackages,
      ...Boolean(preamble) ? {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']]
      } : {},
    });
    output = new SVG({ fontCache: "local" });
    html = mathjax.document("", { InputJax: input, OutputJax: output });
  }
  try {
    const node = html.convert(
      Boolean(preamble) ? `${preamble}${tex}` : tex,
      { display: true, scale }
    );
    const svg = new DOMParser().parseFromString(adaptor.innerHTML(node), "image/svg+xml").firstChild as SVGSVGElement;
    if (svg) {
      if(svg.width.baseVal.valueInSpecifiedUnits < 2) {
        svg.width.baseVal.valueAsString = `${(svg.width.baseVal.valueInSpecifiedUnits+1).toFixed(3)}ex`;
      }
      const dataURL = svgToBase64(svg.outerHTML);
      return {
        mimeType: "image/svg+xml",
        fileId: fileid() as FileId,
        dataURL: dataURL as DataURL,
        created: Date.now(),
        size: await getImageSize(dataURL),
      };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}