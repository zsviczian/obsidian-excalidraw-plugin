import { DataURL } from "@zsviczian/excalidraw/types/types";
import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./Main";
import { FileData, MimeType } from "./EmbeddedFileLoader";
import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { getImageSize, sleep, svgToBase64 } from "./Utils";
import { fileid } from "./Constants";
import html2canvas from "html2canvas";

declare let window: any;

export const updateEquation = async (
  equation: string,
  fileId: string,
  view: ExcalidrawView,
  addFiles: Function,
  plugin: ExcalidrawPlugin,
) => {
  const data = await tex2dataURL(equation, plugin);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType,
      id: fileId as FileId,
      dataURL: data.dataURL,
      created: data.created,
      size: data.size,
      hasSVGwithBitmap: false,
    });
    addFiles(files, view);
  }
};

export async function tex2dataURL(
  tex: string,
  plugin: ExcalidrawPlugin,
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  //if network is slow, or not available, or mathjax has not yet fully loaded
  try {
    return await mathjaxSVG(tex, plugin);
  } catch (e) {
    await sleep(200); //grace period for mathjax to load, if not, then we go for the slower fallback
    try {
      return await mathjaxSVG(tex, plugin);
    } catch (e) {
      //fallback
      return await mathjaxImage2html(tex);
    }
  }
}

async function mathjaxSVG(
  tex: string,
  plugin: ExcalidrawPlugin,
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  const eq = plugin.mathjax.tex2svg(tex, { display: true, scale: 4 });
  const svg = eq.querySelector("svg");
  if (svg) {
    const dataURL = svgToBase64(svg.outerHTML);
    return {
      mimeType: "image/svg+xml",
      fileId: fileid() as FileId,
      dataURL: dataURL as DataURL,
      created: Date.now(),
      size: await getImageSize(dataURL),
    };
  }
  return null;
}

async function mathjaxImage2html(tex: string): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  const div = document.body.createDiv();
  div.style.display = "table"; //this will ensure div fits width of formula exactly
  //@ts-ignore

  const eq = window.MathJax.tex2chtml(tex, { display: true, scale: 4 }); //scale to ensure good resolution
  eq.style.margin = "3px";
  eq.style.color = "black";

  //ipad support - removing mml as that was causing phantom double-image blur.
  const el = eq.querySelector("mjx-assistive-mml");
  if (el) {
    el.parentElement.removeChild(el);
  }
  div.appendChild(eq);
  window.MathJax.typeset();
  const canvas = await html2canvas(div, { backgroundColor: null }); //transparent
  document.body.removeChild(div);
  return {
    mimeType: "image/png",
    fileId: fileid() as FileId,
    dataURL: canvas.toDataURL() as DataURL,
    created: Date.now(),
    size: { height: canvas.height, width: canvas.width },
  };
}
