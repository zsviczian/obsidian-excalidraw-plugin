import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { TFile } from "obsidian";
import { FRONTMATTER_KEYS, getContainerElement } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import {
  getDataURLFromURL,
  getMimeType,
  getURLImageExtension,
} from "./fileUtils";
import { cleanBlockRef, cleanSectionHeading } from "./pathUtils";
import { runCompressionWorker } from "src/shared/Workers/compression-worker";

export function wrapTextAtCharLength(
  text: string,
  lineLen: number,
  forceWrap: boolean = false,
  tolerance: number = 0,
): string {
  if (!lineLen) {
    return text;
  }
  let outstring = "";
  if (forceWrap) {
    for (const t of text.split("\n")) {
      const v = t.match(new RegExp(`(.){1,${lineLen}}`, "g"));
      outstring += v ? `${v.join("\n")}\n` : "\n";
    }
    return outstring.replace(/\n$/, "");
  }

  const reg = new RegExp(
    `(.{1,${lineLen}})(\\s+|$\\n?)|([^\\s]{1,${lineLen + tolerance}})(\\s+|$\\n?)?`,
    "gm",
  );
  const res = text.matchAll(reg);
  let parts;
  while (!(parts = res.next()).done) {
    outstring += parts.value[1]
      ? parts.value[1].trimEnd()
      : parts.value[3].trimEnd();
    const newLine =
      (parts.value[2] ? parts.value[2].split("\n").length - 1 : 0) +
      (parts.value[4] ? parts.value[4].split("\n").length - 1 : 0);
    outstring += "\n".repeat(newLine);
    if (newLine === 0) {
      outstring += "\n";
    }
  }
  return outstring.replace(/\n$/, "");
}

export async function getBinaryFileFromDataURL(
  dataURL: string,
): Promise<ArrayBuffer> {
  if (!dataURL) {
    return null;
  }
  if (dataURL.match(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i)) {
    const hyperlink = dataURL;
    const extension = getURLImageExtension(hyperlink);
    const mimeType = getMimeType(extension);
    dataURL = await getDataURLFromURL(hyperlink, mimeType);
  }
  const parts = dataURL.matchAll(/base64,(.*)/g).next();
  if (!parts.value) {
    return null;
  }
  const binaryString = window.atob(parts.value[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
  page: number;
};

export function getLinkParts(fname: string, file?: TFile): LinkParts {
  const reg = /(^[^#|]*)#?(\^)?([^|]*)?\|?(\d*)x?(\d*)/;
  const parts = fname.match(reg);
  const isBlockRef = parts[2] === "^";
  let page = parseInt(parts[3]?.match(/page=(\d*)/)?.[1]);
  page = isNaN(page) ? null : page;
  return {
    original: fname,
    path: file && parts[1] === "" ? file.path : parts[1],
    isBlockRef,
    ref: parts[3]?.match(/^page=\d*$/i)
      ? parts[3]
      : isBlockRef
        ? cleanBlockRef(parts[3])
        : cleanSectionHeading(parts[3]),
    width: parts[4] ? parseInt(parts[4]) : undefined,
    height: parts[5] ? parseInt(parts[5]) : undefined,
    page,
  };
}

export async function compressAsync(data: string): Promise<string> {
  return await runCompressionWorker(data, "compress");
}

export function compress(data: string): string {
  const compressed = LZString.compressToBase64(data);
  let result = "";
  const chunkSize = 256;
  for (let i = 0; i < compressed.length; i += chunkSize) {
    result += `${compressed.slice(i, i + chunkSize)}\n\n`;
  }

  return result.trim();
}

export function decompress(data: string): string {
  let cleanedData = "";
  const length = data.length;

  for (let i = 0; i < length; i++) {
    const char = data[i];
    if (char !== "\n" && char !== "\r") {
      cleanedData += char;
    }
  }

  return LZString.decompressFromBase64(cleanedData);
}

export function hasExportTheme(plugin: ExcalidrawPlugin, file: TFile): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !==
        "undefined"
    ) {
      return true;
    }
  }
  return false;
}

export function getExportTheme(
  plugin: ExcalidrawPlugin,
  file: TFile,
  theme: string,
): string {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !==
        "undefined"
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name]
        ? "dark"
        : "light";
    }
  }
  return plugin.settings.exportWithTheme ? theme : "light";
}

export function isVersionNewerThanOther(
  version: string,
  otherVersion: string,
): boolean {
  if (!version || !otherVersion) {
    return true;
  }

  const v = version.match(/(\d*)\.(\d*)\.(\d*)/);
  const o = otherVersion.match(/(\d*)\.(\d*)\.(\d*)/);

  return Boolean(
    v &&
    v.length === 4 &&
    o &&
    o.length === 4 &&
    !(
      isNaN(parseInt(v[1])) ||
      isNaN(parseInt(v[2])) ||
      isNaN(parseInt(v[3]))
    ) &&
    !(
      isNaN(parseInt(o[1])) ||
      isNaN(parseInt(o[2])) ||
      isNaN(parseInt(o[3]))
    ) &&
    (parseInt(v[1]) > parseInt(o[1]) ||
      (parseInt(v[1]) >= parseInt(o[1]) && parseInt(v[2]) > parseInt(o[2])) ||
      (parseInt(v[1]) >= parseInt(o[1]) &&
        parseInt(v[2]) >= parseInt(o[2]) &&
        parseInt(v[3]) > parseInt(o[3]))),
  );
}

export function arrayToMap<T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
}

export function updateFrontmatterInString(
  data: string,
  keyValuePairs?: [string, string][],
): string {
  if (!data || !keyValuePairs) {
    return data;
  }
  for (const kvp of keyValuePairs) {
    const r = new RegExp(`${kvp[0]}:\\s.*\\n`, "g");
    data = data.match(r)
      ? data.replaceAll(r, `${kvp[0]}: ${kvp[1]}\n`)
      : data.replace(/^---\n/, `---\n${kvp[0]}: ${kvp[1]}\n`);
  }
  return data;
}

export function _getContainerElement(
  element:
    | (ExcalidrawElement & { containerId: ExcalidrawElement["id"] | null })
    | null,
  scene: { elements?: ExcalidrawElement[]; appState?: AppState },
) {
  if (!element || !scene?.elements || element.type !== "text") {
    return null;
  }
  if (element.containerId) {
    return getContainerElement(element, arrayToMap(scene.elements));
  }
  return null;
}
