/**
 * Parsing helpers for the "## Drawing" scene section, the user-editable
 * Markdown header that precedes it, and the marker-delimited local
 * Markdown-image blocks stored inside that header. Extracted intact from
 * `ExcalidrawData.ts`, which remains the primary consumer alongside several
 * other modules that read or write the same Markdown structure.
 */
import { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import {
  compress,
  compressAsync,
  decompress,
  updateFrontmatterInString,
} from "../utils/sceneDataUtils";
import { isObsidianThemeDark } from "../utils/obsidianUtils";
import { MD_MARKDOWN_IMAGES } from "../constants/constants";
import { type MarkdownImageData } from "src/types/markdownImageTypes";

type RegExpMatchIteratorResult = IteratorResult<RegExpMatchArray, undefined>;

//added \n at and of DRAWING_REG: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/357
const DRAWING_REG = /\n##? Drawing\n[^`]*(```json\n)([\s\S]*?)```\n/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_REG_FALLBACK = /\n##? Drawing\n(```json\n)?(.*)(```)?(%%)?/gm;
export const DRAWING_COMPRESSED_REG =
  /(\n##? Drawing\n[^`]*(?:```compressed-json\n))([\s\S]*?)(```\n)/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_COMPRESSED_REG_FALLBACK =
  /(\n##? Drawing\n(?:```compressed-json\n)?)(.*)((```)?(%%)?)/gm;

const isCompressedMD = (data: string): boolean => {
  return data.match(/```compressed-json\n/gm) !== null;
};

const getDecompressedScene = (
  data: string,
): [string | null, RegExpMatchIteratorResult] => {
  let res = data.matchAll(DRAWING_COMPRESSED_REG);

  //In case the user adds a text element with the contents "# Drawing\n"
  let parts: RegExpMatchIteratorResult;
  parts = res.next();
  if (parts.done) {
    //did not find a match
    res = data.matchAll(DRAWING_COMPRESSED_REG_FALLBACK);
    parts = res.next();
  }
  if (parts.value && parts.value.length > 1) {
    return [decompress(parts.value[2]), parts];
  }
  return [null, parts];
};

export const changeThemeOfExcalidrawMD = (data: string): string => {
  const compressed = isCompressedMD(data);
  let scene = compressed ? getDecompressedScene(data)[0] : data;
  if (!scene) {
    return data;
  }
  if (isObsidianThemeDark) {
    if ((scene.match(/"theme"\s*:\s*"light"\s*,/g) || []).length === 1) {
      scene = scene.replace(/"theme"\s*:\s*"light"\s*,/, `"theme": "dark",`);
    }
  } else if ((scene.match(/"theme"\s*:\s*"dark"\s*,/g) || []).length === 1) {
    scene = scene.replace(/"theme"\s*:\s*"dark"\s*,/, `"theme": "light",`);
  }
  if (compressed) {
    return data.replace(DRAWING_COMPRESSED_REG, `$1${compress(scene)}$3`);
  }
  return scene;
};

export function getJSON(data: string): { scene: string; pos: number } {
  let res: IterableIterator<RegExpMatchArray>;
  if (isCompressedMD(data)) {
    const [result, parts] = getDecompressedScene(data);
    if (result) {
      return {
        scene: result.substring(0, result.lastIndexOf("}") + 1),
        pos: parts.value.index,
      }; //this is a workaround in case sync merges two files together and one version is still an old version without the ```codeblock
    }
    return { scene: data, pos: parts.value ? parts.value.index : 0 };
  }
  res = data.matchAll(DRAWING_REG);

  //In case the user adds a text element with the contents "# Drawing\n"
  let parts: RegExpMatchIteratorResult;
  parts = res.next();
  if (parts.done) {
    //did not find a match
    res = data.matchAll(DRAWING_REG_FALLBACK);
    parts = res.next();
  }
  if (parts.value && parts.value.length > 1) {
    const result = parts.value[2];
    return {
      scene: result.substring(0, result.lastIndexOf("}") + 1),
      pos: parts.value.index,
    }; //this is a workaround in case sync merges two files together and one version is still an old version without the ```codeblock
  }
  return { scene: data, pos: parts.value ? parts.value.index : 0 };
}

export async function getMarkdownDrawingSectionAsync(
  jsonString: string,
  compressed: boolean,
) {
  const result = compressed
    ? `## Drawing\n\x60\x60\x60compressed-json\n${await compressAsync(
        jsonString,
      )}\n\x60\x60\x60\n%%`
    : `## Drawing\n\x60\x60\x60json\n${jsonString}\n\x60\x60\x60\n%%`;
  return result;
}

export function getMarkdownDrawingSection(
  jsonString: string,
  compressed: boolean,
): string {
  const result = compressed
    ? `## Drawing\n\x60\x60\x60compressed-json\n${compress(
        jsonString,
      )}\n\x60\x60\x60\n%%`
    : `## Drawing\n\x60\x60\x60json\n${jsonString}\n\x60\x60\x60\n%%`;
  return result;
}

const MARKDOWN_IMAGE_OPEN_MARKER =
  /^<!-- excalidraw-markdown-image:([\w-]+) -->$/gm;

type MarkdownImageBlock = {
  fileId: FileId;
  start: number;
  bodyStart: number;
  bodyEnd: number;
  end: number;
};

const getMarkdownImageBlocks = (data: string): MarkdownImageBlock[] => {
  const blocks: MarkdownImageBlock[] = [];
  const openMarker = new RegExp(MARKDOWN_IMAGE_OPEN_MARKER);
  let match: RegExpExecArray | null;
  while ((match = openMarker.exec(data)) !== null) {
    const fileId = match[1] as FileId;
    const bodySeparator = data.startsWith("\r\n\r\n", openMarker.lastIndex)
      ? "\r\n\r\n"
      : "\n\n";
    if (!data.startsWith(bodySeparator, openMarker.lastIndex)) {
      continue;
    }
    const closeMarker = `<!-- /excalidraw-markdown-image:${fileId} -->`;
    const closeIndex = data.indexOf(
      `${bodySeparator}${closeMarker}`,
      openMarker.lastIndex + bodySeparator.length,
    );
    if (closeIndex === -1) {
      continue;
    }
    const end = closeIndex + bodySeparator.length + closeMarker.length;
    blocks.push({
      fileId,
      start: match.index,
      bodyStart: openMarker.lastIndex + bodySeparator.length,
      bodyEnd: closeIndex,
      end,
    });
    openMarker.lastIndex = end;
  }
  return blocks;
};

/**
 * Reads locally stored Markdown-image bodies from marker-delimited blocks.
 * Marker matching is deliberately independent of headings and block position.
 */
export function parseMarkdownImages(data: string): Map<FileId, MarkdownImageData> {
  const result = new Map<FileId, MarkdownImageData>();
  getMarkdownImageBlocks(data).forEach((block) =>
    result.set(block.fileId, {
      markdown: data.substring(block.bodyStart, block.bodyEnd),
    }),
  );
  return result;
}

/**
 * Removes a local Markdown-image block's marker comments while preserving its
 * Markdown body and surrounding document content exactly.
 *
 * @param data - Complete Excalidraw Markdown document.
 * @param fileId - File ID identifying the local Markdown-image block.
 * @param markdown - Optional current in-memory body to preserve instead of a
 * potentially stale body from the document.
 * @returns The document with the matching marker comments removed.
 */
export function unwrapMarkdownImageBlock(
  data: string,
  fileId: FileId,
  markdown?: string,
): string {
  const blocks = getMarkdownImageBlocks(data).filter(
    (block) => block.fileId === fileId,
  );
  let updated = data;
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index];
    updated =
      updated.slice(0, block.start) +
      (markdown ?? updated.slice(block.bodyStart, block.bodyEnd)) +
      updated.slice(block.end);
  }
  return updated;
}

const serializeMarkdownImageBlock = (
  fileId: FileId,
  markdown: string,
): string =>
  `<!-- excalidraw-markdown-image:${fileId} -->\n\n${markdown}\n\n<!-- /excalidraw-markdown-image:${fileId} -->`;

/**
 * Synchronizes local Markdown-image bodies in the user-editable note header.
 * Existing blocks stay where the user placed them; only missing blocks receive
 * the default scaffolding immediately above Excalidraw Data.
 */
export function syncMarkdownImagesInHeader(
  header: string,
  markdownImages: ReadonlyMap<FileId, MarkdownImageData>,
): string {
  const blocks = getMarkdownImageBlocks(header);
  const existingIds = new Set<FileId>();
  let updated = header;
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index];
    const data = markdownImages.get(block.fileId);
    if (!data) {
      updated = updated.slice(0, block.start) + updated.slice(block.end);
      continue;
    }
    existingIds.add(block.fileId);
    updated =
      updated.slice(0, block.bodyStart) +
      data.markdown +
      updated.slice(block.bodyEnd);
  }

  const missing = [...markdownImages.entries()].filter(
    ([fileId]) => !existingIds.has(fileId),
  );
  if (missing.length > 0) {
    const hasExistingBlocks = getMarkdownImageBlocks(updated).length > 0;
    const hasScaffoldingHeading = updated
      .split(/\r?\n/)
      .some((line) => line.trimEnd() === MD_MARKDOWN_IMAGES);
    const blocksToAppend = missing
      .map(([fileId, data]) => serializeMarkdownImageBlock(fileId, data.markdown))
      .join("\n\n");
    updated = `${updated.replace(/\s*$/, "")}${
      hasExistingBlocks || hasScaffoldingHeading
        ? "\n\n"
        : `\n\n${MD_MARKDOWN_IMAGES}\n\n`
    }${blocksToAppend}\n\n`;
  } else if (markdownImages.size === 0) {
    updated = updated.replace(
      new RegExp(`(?:^|\\n)${MD_MARKDOWN_IMAGES}[ \\t]*\\n*$`),
      "\n",
    );
  }
  return updated;
}

//WITHSECTION refers to back of the card note (see this.inputEl.onkeyup in SelectCard.ts)
const RE_EXCALIDRAWDATA_WITHSECTION_OK =
  /^(#\n+)%%\n+# Excalidraw Data(?:\n|$)/m;
const RE_EXCALIDRAWDATA_WITHSECTION_NOTOK =
  /#\n+%%\n+# Excalidraw Data(?:\n|$)/m;
// Also used directly by ExcalidrawData's own text-element-section detection.
export const RE_EXCALIDRAWDATA_NOSECTION_OK =
  /^(%%\n+)?# Excalidraw Data(?:\n|$)/m;

//WITHSECTION refers to back of the card note (see this.inputEl.onkeyup in SelectCard.ts)
const RE_TEXTELEMENTS_WITHSECTION_OK = /^#\n+%%\n+##? Text Elements(?:\n|$)/m;
const RE_TEXTELEMENTS_WITHSECTION_NOTOK = /#\n+%%\n+##? Text Elements(?:\n|$)/m;
// Also used directly by ExcalidrawData's own text-element-section detection.
export const RE_TEXTELEMENTS_NOSECTION_OK =
  /^(%%\n+)?##? Text Elements(?:\n|$)/m;

//The issue is that when editing in markdown embeds the user can delete the last enter causing two sections
//to collide. This is particularly problematic when the user is editing the last section before # Text Elements
const RE_EXCALIDRAWDATA_FALLBACK_1 = /(.*)%%\n+# Excalidraw Data(?:\n|$)/m;
// Also used directly by ExcalidrawData's own text-element-section detection.
export const RE_EXCALIDRAWDATA_FALLBACK_2 = /(.*)# Excalidraw Data(?:\n|$)/m;

const RE_TEXTELEMENTS_FALLBACK_1 = /(.*)%%\n+##? Text Elements(?:\n|$)/m;
// Also used directly by ExcalidrawData's own text-element-section detection.
export const RE_TEXTELEMENTS_FALLBACK_2 = /(.*)##? Text Elements(?:\n|$)/m;

const RE_DRAWING = /^(%%\n+)?##? Drawing\n/m;

export function getExcalidrawMarkdownHeader(data: string): {
  header: string;
  shouldFixTrailingHashtag: boolean;
  processingOk: boolean;
} {
  //The base case scenario is at the top, continued with fallbacks in order of likelihood and file structure
  //change history for sake of backward compatibility

  /* Expected markdown structure:
  bla bla bla
  #
  %%
  # Excalidraw Data
  */

  //trimming the json because in legacy excalidraw files the JSON was a single string resulting in very slow regexp parsing
  const drawingTrimLocation = data.search(RE_DRAWING);
  if (drawingTrimLocation > 0) {
    data = data.substring(0, drawingTrimLocation);
  }

  const m1 = data.match(RE_EXCALIDRAWDATA_WITHSECTION_OK);
  let trimLocation = m1?.index ?? -1; //data.search(RE_EXCALIDRAWDATA_WITHSECTION_OK);
  let shouldFixTrailingHashtag = false;
  if (trimLocation > 0) {
    trimLocation += m1[1].length; //accounts for the "(#\n\s*)" which I want to leave there untouched
  }

  /* Expected markdown structure (this happens when the user deletes the last empty line of the last back-of-the-card note):
  bla bla bla#
  %%
  # Excalidraw Data
  */
  if (trimLocation === -1) {
    trimLocation = data.search(RE_EXCALIDRAWDATA_WITHSECTION_NOTOK);
    if (trimLocation > 0) {
      shouldFixTrailingHashtag = true;
    }
  }
  /* Expected markdown structure
  a)
    bla bla bla
    %%
    # Excalidraw Data
  b)
    bla bla bla
    # Excalidraw Data
  */
  if (trimLocation === -1) {
    trimLocation = data.search(RE_EXCALIDRAWDATA_NOSECTION_OK);
  }
  /* Expected markdown structure:
  bla bla bla%%
  # Excalidraw Data
  */
  if (trimLocation === -1) {
    const res = data.match(RE_EXCALIDRAWDATA_FALLBACK_1);
    if (res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla# Excalidraw Data
  */
  if (trimLocation === -1) {
    const res = data.match(RE_EXCALIDRAWDATA_FALLBACK_2);
    if (res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla
  #
  %%
  # Text Elements
  */
  if (trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_WITHSECTION_OK);
    if (trimLocation > 0) {
      trimLocation += 2; //accounts for the "#\n" which I want to leave there untouched
    }
  }
  /* Expected markdown structure:
  bla bla bla#
  %%
  # Text Elements
  */
  if (trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_WITHSECTION_NOTOK);
    if (trimLocation > 0) {
      shouldFixTrailingHashtag = true;
    }
  }
  /* Expected markdown structure
  a)
    bla bla bla
    %%
    # Text Elements
  b)
    bla bla bla
    # Text Elements
  */
  if (trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_NOSECTION_OK);
  }
  /* Expected markdown structure:
  bla bla bla%%
  # Text Elements
  */
  if (trimLocation === -1) {
    const res = data.match(RE_TEXTELEMENTS_FALLBACK_1);
    if (res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla# Text Elements
  */
  if (trimLocation === -1) {
    const res = data.match(RE_TEXTELEMENTS_FALLBACK_2);
    if (res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  a)
    bla bla bla
    # Drawing
  b)
    bla bla bla
    %%
    # Drawing
  */
  if (trimLocation === -1) {
    if (drawingTrimLocation > 0) {
      trimLocation = drawingTrimLocation;
    }
  }
  if (trimLocation === -1) {
    return {
      header: data.endsWith("\n") ? data : `${data}\n`,
      shouldFixTrailingHashtag,
      processingOk: false,
    };
  }

  return {
    header: data.substring(0, trimLocation),
    shouldFixTrailingHashtag,
    processingOk: true,
  };
}

export const getExcalidrawMarkdownHeaderSection = (
  data: string,
  keys?: [string, string][],
): string => {
  const { header, shouldFixTrailingHashtag, processingOk } =
    getExcalidrawMarkdownHeader(data);
  if (!processingOk) {
    return header;
  }

  const updatedHeader = updateFrontmatterInString(header, keys);
  //this should be removed at a later time. Left it here to remediate 1.4.9 mistake
  /*const REG_IMG = /(^---[\w\W]*?---\n)(!\[\[.*?]]\n(%%\n)?)/m; //(%%\n)? because of 1.4.8-beta... to be backward compatible with anyone who installed that version
  if (header.match(REG_IMG)) {
    header = header.replace(REG_IMG, "$1");
  }*/
  //end of remove
  return shouldFixTrailingHashtag
    ? `${updatedHeader}\n#\n`
    : updatedHeader.endsWith("\n")
      ? header
      : `${header}\n`;
};
