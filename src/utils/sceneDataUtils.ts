import type {
  ElementsMap,
  ExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { TFile } from "obsidian";
import { FRONTMATTER_KEYS, getContainerElement } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import LZString from "lz-string";
import { runCompressionWorker } from "src/shared/Workers/compression-worker";
import { arrayToMap } from "./collectionUtils";

export { arrayToMap };
export { getBinaryFileFromDataURL } from "./fileUtils";
export { getLinkParts } from "./linkUtils";
export type { LinkParts } from "./linkUtils";
export { wrapTextAtCharLength } from "./textUtils";

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

export async function decompressAsync(data: string): Promise<string> {
  return await runCompressionWorker(data, "decompress");
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

/**
 * Updates or inserts simple, single-line properties in serialized frontmatter.
 *
 * @param data - Markdown text whose frontmatter should be updated.
 * @param keyValuePairs - Property names and serialized values to apply.
 * @returns The updated text, or the original text when there is nothing to do.
 * @remarks
 * This intentionally preserves the existing string-based behavior: it does not
 * parse YAML, and insertion requires an opening `---` followed by a newline.
 */
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
    return getContainerElement(
      element,
      arrayToMap(scene.elements) as ElementsMap,
    );
  }
  return null;
}
