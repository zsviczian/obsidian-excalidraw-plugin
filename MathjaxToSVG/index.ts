import {mathjax} from "mathjax-full/js/mathjax";
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {LiteAdaptor, liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import {AllPackages} from 'mathjax-full/js/input/tex/AllPackages.js';
import { customAlphabet } from "nanoid";

type DataURL = string & { _brand: "DataURL" };
type FileId = string & { _brand: "FileId" };
const fileid = customAlphabet("1234567890abcdef", 40);

let adaptor: LiteAdaptor;
let html: any;
let preamble: string;

function svgToBase64(svg: string): string {
  const cleanSvg = svg.replaceAll("&nbsp;", " ");
  
  // Convert the string to UTF-8 and handle non-Latin1 characters
  const encodedData = encodeURIComponent(cleanSvg)
    .replace(/%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode(parseInt(p1, 16))
    );
    
  return `data:image/svg+xml;base64,${btoa(encodedData)}`;
}

async function getImageSize(src: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ height: img.naturalHeight, width: img.naturalWidth });
    img.onerror = reject;
    img.src = src;
  });
}

export async function tex2dataURL(
  tex: string,
  scale: number = 4,
  plugin?: any
): Promise<{
  mimeType: string;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
}> {
  let input: TeX<unknown, unknown, unknown>;
  let output: SVG<unknown, unknown, unknown>;

  if(!adaptor) {
    if (plugin) {
      const file = plugin.app.vault.getAbstractFileByPath(plugin.settings.latexPreambleLocation || "preamble.sty");
      preamble = file ? await plugin.app.vault.read(file) : null;
    }
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    input = new TeX({
      packages: AllPackages,
      ...(preamble ? {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']]
      } : {}),
    });
    output = new SVG({ fontCache: "local" });
    html = mathjax.document("", { InputJax: input, OutputJax: output });
  }

  try {
    const node = html.convert(
      preamble ? `${preamble}\n${tex}` : tex,
      { display: true, scale }
    );
    const svg = new DOMParser().parseFromString(adaptor.innerHTML(node), "image/svg+xml").firstChild as SVGSVGElement;
    
	//https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2195
	//https://stackoverflow.com/a/77181931
	let styleNode = document.createElement('style');
    styleNode.setAttribute("type", "text/css");
    styleNode.appendChild(document.createTextNode(".mjx-solid { stroke-width: 80px; }"));
    svg.appendChild(styleNode);

    if (svg) {
      if(svg.width.baseVal.valueInSpecifiedUnits < 2) {
        svg.width.baseVal.valueAsString = `${(svg.width.baseVal.valueInSpecifiedUnits+1).toFixed(3)}ex`;
      }
      const img = svgToBase64(svg.outerHTML);
      svg.width.baseVal.valueAsString = (svg.width.baseVal.valueInSpecifiedUnits * 10).toFixed(3);
      svg.height.baseVal.valueAsString = (svg.height.baseVal.valueInSpecifiedUnits * 10).toFixed(3);
      const dataURL = svgToBase64(svg.outerHTML);
      return {
        mimeType: "image/svg+xml",
        fileId: fileid() as FileId,
        dataURL: dataURL as DataURL,
        created: Date.now(),
        size: await getImageSize(img),
      };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function clearMathJaxVariables(): void {
  adaptor = null;
  html = null;
  preamble = null;
}