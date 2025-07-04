/** 
 ** About the various text fields of textElements
 ** rawText vs. text vs. original text
    text: The displyed text. This will have linebreaks if wrapped & will be the parsed text or the original-markup depending on Obsidian view mode
    originalText: this is the text without added linebreaks for wrapping. This will be parsed or markup depending on view mode
    rawText: text with original markdown markup and without the added linebreaks for wrapping
 */
import { App, Notice, TFile } from "obsidian";
import {
  nanoid,
  fileid,
  DEVICE,
  EMBEDDABLE_THEME_FRONTMATTER_VALUES,
  getLineHeight,
  ERROR_IFRAME_CONVERSION_CANCELED,
  JSON_parse,
  FRONTMATTER_KEYS,
  refreshTextDimensions,
  getContainerElement,
  loadSceneFonts,
} from "../constants/constants";
import ExcalidrawPlugin from "../core/main";
import ExcalidrawView, { TextMode } from "../view/ExcalidrawView";
import {
  addAppendUpdateCustomData,
  compress,
  decompress,
  //getBakPath,
  getBinaryFileFromDataURL,
  _getContainerElement,
  getExportTheme,
  getLinkParts,
  hasExportTheme,
  isVersionNewerThanOther,
  LinkParts,
  updateFrontmatterInString,
  wrapTextAtCharLength,
  arrayToMap,
  compressAsync,
} from "../utils/utils";
import { cleanBlockRef, cleanSectionHeading, getAttachmentsFolderAndFilePath, isObsidianThemeDark } from "../utils/obsidianUtils";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import { BinaryFiles, DataURL, SceneData } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddedFile, MimeType } from "./EmbeddedFileLoader";
import { MultiOptionConfirmationPrompt } from "./Dialogs/Prompt";
import { getMermaidImageElements, getMermaidText, shouldRenderMermaid } from "../utils/mermaidUtils";
import { DEBUGGING, debug } from "../utils/debugHelper";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { updateElementIdsInScene } from "../utils/excalidrawSceneUtils";
import {  importFileToVault } from "../utils/fileUtils";
import { t } from "../lang/helpers";
import { displayFontMessage } from "../utils/excalidrawViewUtils";
import { getPDFRect } from "../utils/PDFUtils";

type SceneDataWithFiles = SceneData & { files: BinaryFiles };

declare module "obsidian" {
  interface MetadataCache {
    blockCache: {
      getForFile(x: any, f: TAbstractFile): any;
    };
  }
}

export enum AutoexportPreference {
  none,
  both,
  png,
  svg,
  inherit
}

export const REGEX_TAGS = {
  // #[\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+
  //   1                                     
  EXPR: /(#[\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/gu,
  getResList: (text: string): IteratorResult<RegExpMatchArray, any>[] => {
    const res = text.matchAll(REGEX_TAGS.EXPR);
    let parts: IteratorResult<RegExpMatchArray, any>;
    const resultList = [];
    while (!(parts = res.next()).done) {
      resultList.push(parts);
    }
    return resultList;
  },
  getTag: (parts: IteratorResult<RegExpMatchArray, any>): string => {
    return parts.value[1];
  },
  isTag: (parts: IteratorResult<RegExpMatchArray, any>): boolean => {
    return parts.value[1]?.startsWith("#")
  },
};

export const REGEX_LINK = {
  //![[link|alias]] [alias](link){num}
  //      1   2    3           4             5         67         8  9
  //EXPR: /(!)?(\[\[([^|\]]+)\|?([^\]]+)?]]|\[([^\]]*)]\(([^)]*)\))(\{(\d+)\})?/g, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
  //      1   2    3           4             5         67                             8  9
  EXPR: /(!)?(\[\[([^|\]]+)\|?([^\]]+)?]]|\[([^\]]*)]\(((?:[^\(\)]|\([^\(\)]*\))*)\))(\{(\d+)\})?/g,  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1963

  getResList: (text: string): IteratorResult<RegExpMatchArray, any>[] => {
    const res = text.matchAll(REGEX_LINK.EXPR);
    let parts: IteratorResult<RegExpMatchArray, any>;
    const resultList = [];
    while(!(parts = res.next()).done) {
      resultList.push(parts);
    }
    return resultList;
  },
  getRes: (text: string): IterableIterator<RegExpMatchArray> => {
    return text.matchAll(REGEX_LINK.EXPR);
  },
  isTransclusion: (parts: IteratorResult<RegExpMatchArray, any>): boolean => {
    return !!parts.value[1];
  },
  getLink: (parts: IteratorResult<RegExpMatchArray, any>): string => {
    return parts.value[3] ? parts.value[3] : parts.value[6];
  },
  isWikiLink: (parts: IteratorResult<RegExpMatchArray, any>): boolean => {
    return !!parts.value[3];
  },
  getAliasOrLink: (parts: IteratorResult<RegExpMatchArray, any>): string => {
    return REGEX_LINK.isWikiLink(parts)
      ? parts.value[4]
        ? parts.value[4]
        : parts.value[3]
      : parts.value[5]
      ? parts.value[5]
      : parts.value[6];
  },
  getWrapLength: (
    parts: IteratorResult<RegExpMatchArray, any>,
    defaultWrap: number,
  ): number => {
    const len = parseInt(parts.value[8]);
    if (isNaN(len)) {
      return defaultWrap > 0 ? defaultWrap : null;
    }
    return len;
  },
};

//added \n at and of DRAWING_REG: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/357
const DRAWING_REG = /\n##? Drawing\n[^`]*(```json\n)([\s\S]*?)```\n/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_REG_FALLBACK = /\n##? Drawing\n(```json\n)?(.*)(```)?(%%)?/gm;
export const DRAWING_COMPRESSED_REG =
  /(\n##? Drawing\n[^`]*(?:```compressed\-json\n))([\s\S]*?)(```\n)/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_COMPRESSED_REG_FALLBACK =
  /(\n##? Drawing\n(?:```compressed\-json\n)?)(.*)((```)?(%%)?)/gm;
export const REG_LINKINDEX_HYPERLINK = /^\w+:\/\//;

const isCompressedMD = (data: string): boolean => {
  return data.match(/```compressed\-json\n/gm) !== null;
};

const getDecompressedScene = (
  data: string,
): [string, IteratorResult<RegExpMatchArray, any>] => {
  let res = data.matchAll(DRAWING_COMPRESSED_REG);

  //In case the user adds a text element with the contents "# Drawing\n"
  let parts;
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
  let res;
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
  let parts;
  parts = res.next();
  if (parts.done) {
    //did not find a match
    res = data.matchAll(DRAWING_REG_FALLBACK);
    parts = res.next();
  }
  if (parts.value && parts.value.length > 1) {
    const result = parts.value[2];
    return {
      scene: result.substr(0, result.lastIndexOf("}") + 1),
      pos: parts.value.index,
    }; //this is a workaround in case sync merges two files together and one version is still an old version without the ```codeblock
  }
  return { scene: data, pos: parts.value ? parts.value.index : 0 };
}

export async function getMarkdownDrawingSectionAsync (
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

/**
 *
 * @param text - TextElement.text
 * @param originalText - TextElement.originalText
 * @returns null if the textElement is not wrapped or the longest line in the text element
 */
const estimateMaxLineLen = (text: string, originalText: string): number => {
  if (!originalText || !text) {
    return null;
  }
  if (text === originalText) {
    return null;
  } //text will contain extra new line characters if wrapped
  let maxLineLen = 0; //will be non-null if text is container bound and multi line
  const splitText = text.split("\n");
  if (splitText.length === 1) {
    return null;
  }
  for (const line of splitText) {
    const l = line.trim();  
    if (l.length > maxLineLen) {
      maxLineLen = l.length;
    }
  }
  return maxLineLen;
};

const wrap = (text: string, lineLen: number) =>
  lineLen ? wrapTextAtCharLength(text, lineLen, false, 0) : text;

//WITHSECTION refers to back of the card note (see this.inputEl.onkeyup in SelectCard.ts)
const RE_EXCALIDRAWDATA_WITHSECTION_OK = /^(#\n+)%%\n+# Excalidraw Data(?:\n|$)/m;
const RE_EXCALIDRAWDATA_WITHSECTION_NOTOK = /#\n+%%\n+# Excalidraw Data(?:\n|$)/m;
const RE_EXCALIDRAWDATA_NOSECTION_OK = /^(%%\n+)?# Excalidraw Data(?:\n|$)/m;

//WITHSECTION refers to back of the card note (see this.inputEl.onkeyup in SelectCard.ts)
const RE_TEXTELEMENTS_WITHSECTION_OK = /^#\n+%%\n+##? Text Elements(?:\n|$)/m;
const RE_TEXTELEMENTS_WITHSECTION_NOTOK = /#\n+%%\n+##? Text Elements(?:\n|$)/m;
const RE_TEXTELEMENTS_NOSECTION_OK = /^(%%\n+)?##? Text Elements(?:\n|$)/m;


//The issue is that when editing in markdown embeds the user can delete the last enter causing two sections
//to collide. This is particularly problematic when the user is editing the last section before # Text Elements
const RE_EXCALIDRAWDATA_FALLBACK_1 = /(.*)%%\n+# Excalidraw Data(?:\n|$)/m;
const RE_EXCALIDRAWDATA_FALLBACK_2 = /(.*)# Excalidraw Data(?:\n|$)/m;

const RE_TEXTELEMENTS_FALLBACK_1 = /(.*)%%\n+##? Text Elements(?:\n|$)/m;
const RE_TEXTELEMENTS_FALLBACK_2 = /(.*)##? Text Elements(?:\n|$)/m;


const RE_DRAWING = /^(%%\n+)?##? Drawing\n/m;

export const getExcalidrawMarkdownHeaderSection = (data:string, keys?:[string,string][]):string => {
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
  if(drawingTrimLocation>0) { 
    data = data.substring(0, drawingTrimLocation);
  }

  const m1 =  data.match(RE_EXCALIDRAWDATA_WITHSECTION_OK); 
  let trimLocation = m1?.index ?? -1; //data.search(RE_EXCALIDRAWDATA_WITHSECTION_OK);
  let shouldFixTrailingHashtag = false;
  if(trimLocation > 0) {
    trimLocation += m1[1].length; //accounts for the "(#\n\s*)" which I want to leave there untouched
  }

  /* Expected markdown structure (this happens when the user deletes the last empty line of the last back-of-the-card note):
  bla bla bla#
  %%
  # Excalidraw Data
  */
  if(trimLocation === -1) {
    trimLocation = data.search(RE_EXCALIDRAWDATA_WITHSECTION_NOTOK);
    if(trimLocation > 0) {
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
  if(trimLocation === -1) {
    trimLocation = data.search(RE_EXCALIDRAWDATA_NOSECTION_OK);
  }
  /* Expected markdown structure:
  bla bla bla%%
  # Excalidraw Data
  */
  if(trimLocation === -1) {
    const res = data.match(RE_EXCALIDRAWDATA_FALLBACK_1);
    if(res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla# Excalidraw Data
  */
  if(trimLocation === -1) {
    const res = data.match(RE_EXCALIDRAWDATA_FALLBACK_2);
    if(res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla
  #
  %%
  # Text Elements
  */
  if(trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_WITHSECTION_OK);
    if(trimLocation > 0) {
      trimLocation += 2; //accounts for the "#\n" which I want to leave there untouched
    }
  }
  /* Expected markdown structure:
  bla bla bla#
  %%
  # Text Elements
  */
  if(trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_WITHSECTION_NOTOK);
    if(trimLocation > 0) {
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
  if(trimLocation === -1) {
    trimLocation = data.search(RE_TEXTELEMENTS_NOSECTION_OK);
  }
  /* Expected markdown structure:
  bla bla bla%%
  # Text Elements
  */
    if(trimLocation === -1) {
    const res = data.match(RE_TEXTELEMENTS_FALLBACK_1);
    if(res && Boolean(res[1])) {
      trimLocation = res.index + res[1].length;
    }
  }
  /* Expected markdown structure:
  bla bla bla# Text Elements
  */
  if(trimLocation === -1) {
    const res = data.match(RE_TEXTELEMENTS_FALLBACK_2);
    if(res && Boolean(res[1])) {
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
    return data.endsWith("\n") ? data : (data + "\n");
  }

  let header = updateFrontmatterInString(data.substring(0, trimLocation),keys);
  //this should be removed at a later time. Left it here to remediate 1.4.9 mistake
  /*const REG_IMG = /(^---[\w\W]*?---\n)(!\[\[.*?]]\n(%%\n)?)/m; //(%%\n)? because of 1.4.8-beta... to be backward compatible with anyone who installed that version
  if (header.match(REG_IMG)) {
    header = header.replace(REG_IMG, "$1");
  }*/
  //end of remove
  return shouldFixTrailingHashtag
    ? header + "\n#\n"
    : header.endsWith("\n") ? header : (header + "\n");
}


export class ExcalidrawData {
  public textElements: Map<
    string,
    { raw: string; parsed: string}
  > = null;
  public scene: any = null;
  public deletedElements: ExcalidrawElement[] = [];
  public file: TFile = null;
  private app: App;
  private showLinkBrackets: boolean;
  private linkPrefix: string;
  public embeddableTheme: "light" | "dark" | "auto" | "default" = "auto";
  private urlPrefix: string;
  public autoexportPreference: AutoexportPreference = AutoexportPreference.inherit;
  private textMode: TextMode = TextMode.raw;
  public loaded: boolean = false;
  public elementLinks: Map<string, string> = null;
  public files: Map<FileId, EmbeddedFile> = null; //fileId, path
  private equations: Map<FileId, { latex: string; isLoaded: boolean }> = null; //fileId, path
  private mermaids: Map<FileId, { mermaid: string; isLoaded: boolean }> = null; //fileId, path
  private compatibilityMode: boolean = false;
  private textElementCommentedOut: boolean = false;
  selectedElementIds: {[key:string]:boolean} = {}; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609

  constructor(
    private plugin: ExcalidrawPlugin, private view?: ExcalidrawView,
  ) {
    this.app = this.plugin.app;
    this.files = new Map<FileId, EmbeddedFile>();
    this.equations = new Map<FileId, { latex: string; isLoaded: boolean }>();
    this.mermaids = new Map<FileId, { mermaid: string; isLoaded: boolean }>();
  }

  public destroy() {
    this.textElements = null;
    this.scene = null;
    this.deletedElements = [];
    this.file = null;
    this.app = null;
    this.showLinkBrackets = null;
    this.linkPrefix = null;
    this.embeddableTheme = null;
    this.urlPrefix = null;
    this.autoexportPreference = null;
    this.textMode = null; 
    this.loaded = false;  
    this.elementLinks = null;
    this.files = null;
    this.equations = null;
    this.mermaids = null;
    this.compatibilityMode = null;
    this.textElementCommentedOut = null;
    this.selectedElementIds = null;
  }

  /**
   * 1.5.4: for backward compatibility following the release of container bound text elements and the depreciation boundElementIds field
   */
  private initializeNonInitializedFields() {
    if (!this.scene || !this.scene.elements) {
      return;
    }

    const saveVersion = this.scene.source?.split("https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/")[1]??"1.8.16";

    const elements = this.scene.elements;
    for (const el of elements) {
      if(el.type === "iframe" && !el.customData) {
        el.type = "embeddable";
      }

      if (el.boundElements) {
        const map = new Map<string, string>();
        let alreadyHasText:boolean = false;
        el.boundElements.forEach((item: { id: string; type: string }) => {
          if(item.type === "text") {
            if(!alreadyHasText) {
              map.set(item.id, item.type);
              alreadyHasText = true;
            } else {
              const elementToClean = elements.find((el:ExcalidrawElement)=>el.id===item.id);
              if(elementToClean) { //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1600
                elementToClean.containerId = null;
              }
            }
          } else {
            map.set(item.id, item.type);
          }
        });
        const boundElements = Array.from(map, ([id, type]) => ({ id, type }));
        if (boundElements.length !== el.boundElements.length) {
          el.boundElements = boundElements;
        }
      }

      //convert .boundElementIds to boundElements
      if (el.boundElementIds) {
        if (!el.boundElements) {
          el.boundElements = [];
        }
        el.boundElements = el.boundElements.concat(
          el.boundElementIds.map((id: string) => ({
            type: "arrow",
            id,
          })),
        );
        delete el.boundElementIds;
      }

      //add containerId to TextElements if missing
      if (el.type === "text" && !el.containerId) {
        el.containerId = null;
      }

      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/494
      if (el.x === null) {
        el.x = 0;
      }
      if (el.y === null) {
        el.y = 0;
      }
      if (el.startBinding?.focus === null) {
        el.startBinding.focus = 0;
      }
      if (el.endBinding?.focus === null) {
        el.endBinding.focus = 0;
      }

      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/497
      if (el.fontSize === null) {
        el.fontSize = 20;
      }

      if (el.type === "text" && !el.hasOwnProperty("autoResize")) {
        el.autoResize = true;
      }

      if (el.type === "text" && !el.hasOwnProperty("lineHeight")) {
        el.lineHeight = getLineHeight(el.fontFamily);
      }

      if (el.type === "image" && !el.hasOwnProperty("roundness")) {
        el.roundness = null;
      }
    }

    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/569
    try {
      //Fix text elements that point to a container, but the container does not point back
      const textElWithOneWayLinkToContainer = elements.filter(
        (textEl: any) =>
          textEl.type === "text" &&
          textEl.containerId &&
          elements.some(
            (container: any) =>
              container.id === textEl.containerId &&
              container.boundElements.length > 0 &&
              container.boundElements.some(
                (boundEl: any) =>
                  boundEl.type === "text" &&
                  boundEl.id !== textEl.id &&
                  boundEl.id.length > 8,
              ),
          ),
      );
      //if(textElWithOneWayLinkToContainer.length>0) log({message: "cleanup", textElWithOneWayLinkToContainer});
      textElWithOneWayLinkToContainer.forEach((textEl: any) => {
        try {
          const container = elements.filter(
            (container: any) => container.id === textEl.containerId,
          )[0];
          const boundEl = container.boundElements.filter(
            (boundEl: any) =>
              !(
                boundEl.type === "text" &&
                !elements.some((el: any) => el.id === boundEl.id)
              ),
          );
          container.boundElements = [{ id: textEl.id, type: "text" }].concat(
            boundEl,
          );
        } catch (e) {}
      });

      const ellipseAndRhombusContainerWrapping = !isVersionNewerThanOther(saveVersion,"1.8.16");

      //Remove from bound elements references that do not exist in the scene
      const containers = elements.filter(
        (container: any) =>
          container.boundElements && container.boundElements.length > 0,
      );
      containers.forEach((container: any) => {
        if(ellipseAndRhombusContainerWrapping && !container.customData?.legacyTextWrap) {
          addAppendUpdateCustomData(container, {legacyTextWrap: true});
        }
        const filteredBoundElements = container.boundElements.filter(
          (boundEl: any) => elements.some((el: any) => el.id === boundEl.id),
        );
        if (filteredBoundElements.length !== container.boundElements.length) {
          //log({message: "cleanup",oldBound: container.boundElements, newBound: filteredBoundElements});
          container.boundElements = filteredBoundElements;
        }
      });

      //Clear the containerId for textElements if the referenced container does not exist in the scene
      elements
        .filter(
          (textEl: any) =>
            textEl.type === "text" &&
            textEl.containerId &&
            !elements.some(
              (container: any) => container.id === textEl.containerId,
            ),
        )
        .forEach((textEl: any) => {
          textEl.containerId = null;
        }); // log({message:"cleanup",textEl})});
    } catch {}
  }

  /**
   * Loads a new drawing
   * @param {TFile} file - the MD file containing the Excalidraw drawing
   * @returns {boolean} - true if file was loaded, false if there was an error
   */
  public async loadData(
    data: string,
    file: TFile,
    textMode: TextMode
  ): Promise<boolean> {
    if (!file) {
      return false;
    }
    this.loaded = false;
    this.selectedElementIds = {};
    this.textElements = new Map<
      string,
      { raw: string; parsed: string}
    >();
    this.elementLinks = new Map<string, string>();
    if (this.file !== file) {
      //this is a reload - files, equations and mermaids will take care of reloading when needed
      this.files.clear();
      this.equations.clear();
      this.mermaids.clear();
    }
    this.file = file;
    this.compatibilityMode = false;

    //I am storing these because if the settings change while a drawing is open parsing will run into errors during save
    //The drawing will use these values until next drawing is loaded or this drawing is re-loaded
    this.setShowLinkBrackets();
    this.setLinkPrefix();
    this.setUrlPrefix();
    this.setAutoexportPreferences();
    this.setembeddableThemePreference();

    this.scene = null;

    //In compatibility mode if the .excalidraw file was more recently updated than the .md file, then the .excalidraw file
    //should be loaded as the scene.
    //This feature is mostly likely only relevant to people who use Obsidian and Logseq on the same vault and edit .excalidraw
    //drawings in Logseq.
    if (this.plugin.settings.syncExcalidraw) {
      const excalfile = `${file.path.substring(
        0,
        file.path.lastIndexOf(".md"),
      )}.excalidraw`;
      const f = this.app.vault.getAbstractFileByPath(excalfile);
      if (f && f instanceof TFile && f.stat.mtime > file.stat.mtime) {
        //the .excalidraw file is newer then the .md file
        const d = await this.app.vault.read(f);
        this.scene = JSON.parse(d);
      }
    }

    // https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/396
    let sceneJSONandPOS = null;
    const loadJSON = (): { scene: string; pos: number } => {
      //Load scene: Read the JSON string after "# Drawing"
      const sceneJSONandPOS = getJSON(data);
      if (sceneJSONandPOS.pos === -1) {
        throw new Error("Excalidraw JSON not found in the file");
      }
      if (!this.scene) {
        this.scene = JSON_parse(sceneJSONandPOS.scene); //this is a workaround to address when files are mereged by sync and one version is still an old markdown without the codeblock ```
      }
      return sceneJSONandPOS;
    };
    sceneJSONandPOS = loadJSON();

    this.deletedElements = this.scene.elements.filter((el:ExcalidrawElement)=>el.isDeleted);
    this.scene.elements = this.scene.elements.filter((el:ExcalidrawElement)=>!el.isDeleted);
    
    const timer = window.setTimeout(()=>{
      const notice = new Notice(t("FONT_LOAD_SLOW"),15000);
      notice.noticeEl.oncontextmenu = () => {
        displayFontMessage(this.app);
      }
    },5000);
    const fontFaces = await loadSceneFonts(this.scene.elements);
    clearTimeout(timer);

    if (!this.scene.files) {
      this.scene.files = {}; //loading legacy scenes that do not yet have the files attribute.
    }

    if (hasExportTheme(this.plugin, this.file)) {
      this.scene.appState.theme = getExportTheme(
        this.plugin,
        this.file,
        "light",
      );
    } else if (this.plugin.settings.matchThemeAlways) {
      this.scene.appState.theme = isObsidianThemeDark() ? "dark" : "light";
    }

    //girdSize, gridStep, previousGridSize, gridModeEnabled migration
    if(this.scene.appState.hasOwnProperty("previousGridSize")) { //if previousGridSize was present this is legacy data
      if(this.scene.appState.gridSize === null) {
        this.scene.appState.gridSize = this.scene.appState.previousGridSize;
        this.scene.appState.gridModeEnabled = false;
      } else {
        this.scene.appState.gridModeEnabled = true; 
      }
      delete this.scene.appState.previousGridSize;
    }

    if(this.scene.appState?.gridColor?.hasOwnProperty("MajorGridFrequency")) { //if this is present, this is legacy data
      if(this.scene.appState.gridColor.MajorGridFrequency>1) {
        this.scene.gridStep = this.scene.appState.gridColor.MajorGridFrequency;
      }
      delete this.scene.appState.gridColor.MajorGridFrequency;
    }

    //once off migration of legacy scenes
    if(this.scene?.elements?.some((el:any)=>el.type==="iframe" && !el.customData)) {
        const prompt = new MultiOptionConfirmationPrompt(
          this.plugin,
          "This file contains embedded frames " +
          "which will be migrated to a newer version for compatibility with " +
          "<a href='https://excalidraw.com'>excalidraw.com</a>.<br>🔄 If you're using Obsidian on " + 
          "multiple devices, you may proceed now, but please, before opening this " +
          "file on your other devices, update Excalidraw on those as well.<br>🔍 More info is available "+
          "<a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.9.9'>here</a>.<br>🌐 " +
          "<a href='https://translate.google.com/?sl=en&tl=zh-CN&text=This%20file%20contains%20embedded%20frames%20which%20will%20be%20migrated%20to%20a%20newer%20version%20for%20compatibility%20with%20excalidraw.com.%0A%0AIf%20you%27re%20using%20Obsidian%20on%20multiple%20devices%2C%20you%20may%20proceed%20now%2C%20but%20please%2C%20before%20opening%20this%20file%20on%20your%20other%20devices%2C%20update%20Excalidraw%20on%20those%20as%20well.%0A%0AMore%20info%20is%20available%20here%3A%20https%3A%2F%2Fgithub.com%2Fzsviczian%2Fobsidian-excalidraw-plugin%2Freleases%2Ftag%2F1.9.9%27%3Ehere%3C%2Fa%3E.&op=translate'>" +
          "Translate</a>.",
        );
        prompt.contentEl.focus();
        const confirmation = await prompt.waitForClose
        if(!confirmation) {
          throw new Error(ERROR_IFRAME_CONVERSION_CANCELED);
        }
    }
    this.initializeNonInitializedFields();

    data = data.substring(0, sceneJSONandPOS.pos);

    //The Markdown # Text Elements take priority over the JSON text elements. Assuming the scenario in which the 
    //link was updated due to filename changes
    //The .excalidraw JSON is modified to reflect the MD in case of difference
    //Read the text elements into the textElements Map
    let position = data.search(RE_EXCALIDRAWDATA_NOSECTION_OK);
    if (position === -1) {
      //resillience in case back of the note was saved right on top of text elements 
      // # back of note section
      // ....# Excalidraw Data
      // ....
      // --------------
      // instead of 
      // --------------
      // # back of note section
      // ....
      // # Excalidraw Data
      position = data.search(RE_EXCALIDRAWDATA_FALLBACK_2);
    }

    if(position === -1) {
      // # back of note section
      // ....
      // # Text Elements
      position = data.search(RE_TEXTELEMENTS_NOSECTION_OK);
    }

    if (position === -1) {
      //resillience in case back of the note was saved right on top of text elements 
      // # back of note section
      // ....# Text Elements
      // ....
      // --------------
      // instead of 
      // --------------
      // # back of note section
      // ....
      // # Text Elements
      position = data.search(RE_TEXTELEMENTS_FALLBACK_2);
    }
    if (position === -1) {
      await this.setTextMode(textMode, false);
      this.loaded = true;
      return true; //Text Elements header does not exist
    }
    data = data.slice(position);
    const normalMatch = data.match(/^((%%\n*)?# Excalidraw Data\n\n?## Text Elements(?:\n|$))/m)
      ?? data.match(/^((%%\n*)?##? Text Elements(?:\n|$))/m);

    const textElementsMatch = normalMatch
      ? normalMatch[0]
      : data.match(/(.*##? Text Elements(?:\n|$))/m)[0];
    
    data = data.slice(textElementsMatch.length);
    this.textElementCommentedOut = textElementsMatch.startsWith("%%\n");
    position = 0;
    let parts;
    
    //load element links
    const elementLinkMap = new Map<string,string>();
    const indexOfNewElementLinks = data.indexOf("## Element Links\n");
    const lengthOfNewElementLinks = 17; //`## Element Links\n`.length
    const indexOfOldElementLinks = data.indexOf("# Element Links\n");
    const lengthOfOldElementLinks = 16; //`# Element Links\n`.length
    const elementLinksData = indexOfNewElementLinks>-1
      ? data.substring(indexOfNewElementLinks + lengthOfNewElementLinks)
      : data.substring(indexOfOldElementLinks + lengthOfOldElementLinks);
    //Load Embedded files
    const RE_ELEMENT_LINKS = /^(.{8}):\s*(.*)$/gm;
    const linksRes = elementLinksData.matchAll(RE_ELEMENT_LINKS);
    while (!(parts = linksRes.next()).done) {
      elementLinkMap.set(parts.value[1], parts.value[2]);
    }

    //iterating through all the text elements in .md
    //Text elements always contain the raw value
    const BLOCKREF_LEN: number = 12; // " ^12345678\n\n".length;
    const RE_TEXT_ELEMENT_LINK = /^%%\*\*\*>>>text element-link:(\[\[[^<*\]]*]])<<<\*\*\*%%/gm;
    let res = data.matchAll(/\s\^(.{8})[\n]+/g);
    while (!(parts = res.next()).done) {
      let text = data.substring(position, parts.value.index);
      const id: string = parts.value[1];
      const textEl = this.scene.elements.filter((el: any) => el.id === id)[0];
      if (textEl) {
        if (textEl.type !== "text") {
          //markdown link attached to elements
          //legacy fileformat support as of 2.0.26
          if (textEl.link !== text) {
            textEl.link = text;
            textEl.version++;
            textEl.versionNonce++;
          }
          this.elementLinks.set(id, text);
        } else {
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566
          const elementLinkRes = text.matchAll(RE_TEXT_ELEMENT_LINK);
          const elementLink = elementLinkRes.next();
          if(!elementLink.done) {
            text = text.replace(RE_TEXT_ELEMENT_LINK,"");
            textEl.link = elementLink.value[1];
          }
          if(elementLinkMap.has(id)) {
            textEl.link = elementLinkMap.get(id);
            elementLinkMap.delete(id);
          }
          const parseRes = await this.parse(text);
          textEl.rawText = text;
          this.textElements.set(id, {
            raw: text,
            parsed: parseRes.parsed,
          });
          if (parseRes.link) {
            textEl.link = parseRes.link;
          }
          //this will set the rawText field of text elements imported from files before 1.3.14, and from other instances of Excalidraw
          if (textEl && (!textEl.rawText || textEl.rawText === "")) {
            textEl.rawText = text;
          }
        }
      }
      position = parts.value.index + BLOCKREF_LEN;
    }

    //In theory only non-text elements should be left in the elementLinkMap
    //new file format from 2.0.26
    for (const [id, link] of elementLinkMap) {
      const textEl = this.scene.elements.filter((el: any) => el.id === id)[0];
      if (textEl) {
        textEl.link = link;
        textEl.version++;
        textEl.versionNonce++;
        this.elementLinks.set(id, link);
      }
    }

    const indexOfNewEmbeddedFiles = data.indexOf("## Embedded Files\n");
    const embeddedFilesNewLength = 18; //"## Embedded Files\n".length
    const indexOfOldEmbeddedFiles = data.indexOf("# Embedded files\n");
    const embeddedFilesOldLength = 17; //"# Embedded files\n".length

    if(indexOfNewEmbeddedFiles>-1 || indexOfOldEmbeddedFiles>-1) {
      data = indexOfNewEmbeddedFiles>-1
        ? data.substring(indexOfNewEmbeddedFiles + embeddedFilesNewLength)
        : data.substring(indexOfOldEmbeddedFiles + embeddedFilesOldLength);
      //Load Embedded files
      const REG_FILEID_FILEPATH = /([\w\d]*):\s*\!?\[\[([^\]]*)]]\s*(\{[^}]*})?\n/gm;
      res = data.matchAll(REG_FILEID_FILEPATH);
      while (!(parts = res.next()).done) {
        const embeddedFile = new EmbeddedFile(
          this.plugin,
          this.file.path,
          parts.value[2],
          parts.value[3],
        );
        this.setFile(parts.value[1] as FileId, embeddedFile);
      }

      //Load links
      const REG_LINKID_FILEPATH = /([\w\d]*):\s*((?:https?|file|ftps?):\/\/[^\s]*)\n/gm;
      res = data.matchAll(REG_LINKID_FILEPATH);
      while (!(parts = res.next()).done) {
        const embeddedFile = new EmbeddedFile(
          this.plugin,
          null,
          parts.value[2],
        );
        this.setFile(parts.value[1] as FileId, embeddedFile);
      }

      //Load Equations
      const REG_FILEID_EQUATION = /([\w\d]*):\s*\$\$([\s\S]*?)(\$\$\s*\n)/gm;
      res = data.matchAll(REG_FILEID_EQUATION);
      while (!(parts = res.next()).done) {
        this.setEquation(parts.value[1] as FileId, {
          latex: parts.value[2],
          isLoaded: false,
        });
      }

      //Load Mermaids
      const mermaidElements = getMermaidImageElements(this.scene.elements);
      if(mermaidElements.length>0 && !shouldRenderMermaid()) {
        new Notice ("Mermaid images are only supported in Obsidian 1.4.14 and above. Please update Obsidian to see the mermaid images in this drawing. Obsidian mobile 1.4.14 currently only avaiable to Obsidian insiders", 5000);
      } else {
        mermaidElements.forEach(el => 
          this.setMermaid(el.fileId, {mermaid: getMermaidText(el), isLoaded: false})
        );
      }
    }
    //Check to see if there are text elements in the JSON that were missed from the # Text Elements section
    //e.g. if the entire text elements section was deleted.
    this.findNewTextElementsInScene();
    this.findNewElementLinksInScene(); //non-text element links
    await this.setTextMode(textMode, true);
    this.loaded = true;
    return true;
  }

  public async loadLegacyData(data: string, file: TFile): Promise<boolean> {
    if (!file) {
      return false;
    }
    this.loaded = false;
    this.selectedElementIds = {};
    this.compatibilityMode = true;
    this.file = file;
    this.textElements = new Map<
      string,
      { raw: string; parsed: string}
    >();
    this.elementLinks = new Map<string, string>();
    this.setShowLinkBrackets();
    this.setLinkPrefix();
    this.setUrlPrefix();
    this.setembeddableThemePreference();
    this.scene = JSON.parse(data);
    if (!this.scene.files) {
      this.scene.files = {}; //loading legacy scenes without the files element
    }
    this.initializeNonInitializedFields();
    if (this.plugin.settings.matchThemeAlways) {
      this.scene.appState.theme = isObsidianThemeDark() ? "dark" : "light";
    }
    this.files.clear();
    this.equations.clear();
    this.mermaids.clear();
    this.findNewTextElementsInScene();
    this.findNewElementLinksInScene();
    await this.setTextMode(TextMode.raw, true); //legacy files are always displayed in raw mode.
    this.loaded = true;
    return true;
  }

  public async setTextMode(textMode: TextMode, forceupdate: boolean = false) {
    if(!this.scene) return;
    this.textMode = textMode;
    await this.updateSceneTextElements(forceupdate);
  }


  /**
   * Updates the TextElements in the Excalidraw scene based on textElements MAP in ExcalidrawData
   * Depending on textMode, TextElements will receive their raw or parsed values
   * @param forceupdate : will update text elements even if text contents has not changed, this will
   * correct sizing issues
   */
  private async updateSceneTextElements(forceupdate: boolean = false) {
    //update text in scene based on textElements Map
    //first get scene text elements
    const elementsMap = arrayToMap(this.scene.elements);
    const texts = this.scene.elements?.filter((el: any) => el.type === "text" && !el.isDeleted) as Mutable<ExcalidrawTextElement>[];
    for (const te of texts) {
      const container = getContainerElement(te, elementsMap);
      const originalText =
        (await this.getText(te.id)) ?? te.originalText ?? te.text;
      const {text, x, y, width, height} = refreshTextDimensions(
        te,
        container,
        elementsMap,
        originalText,
      )
      try { //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1062
        te.originalText = originalText;
        te.text = text;
        te.x = x;
        te.y = y;
        te.width = width;
        te.height = height;
      } catch(e) {
        (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateSceneTextElements, `ExcalidrawData.updateSceneTextElements, textElement:${te?.id}`, te, this.updateSceneTextElements);
      }
    }
  }

  private async getText(
    id: string,
  ): Promise<string> {
    const text = this.textElements.get(id);
    if (!text) {
      return null;
    }
    if (this.textMode === TextMode.parsed) {
      if (!text.parsed) {
        this.textElements.set(id, {
          raw: text.raw,
          parsed: (await this.parse(text.raw)).parsed,
        });
      }
      //console.log("parsed",this.textElements.get(id).parsed);
      return text.parsed;
    }
    //console.log("raw",this.textElements.get(id).raw);
    return text.raw;
  }

  private findNewElementLinksInScene(): boolean {
    let result = false;
    const elements = this.scene.elements?.filter((el: any) => {
      return (
        el.type !== "text" &&
        el.link &&
        //el.link.startsWith("[[") &&
        !this.elementLinks.has(el.id)
      );
    });
    if (elements.length === 0) {
      return result;
    }

    let id: string; //will be used to hold the new 8 char long ID for textelements that don't yet appear under # Text Elements
    
    for (const el of elements) {
      id = el.id;
      //replacing Excalidraw element IDs with my own nanoid, because default IDs may contain
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if (el.id.length > 8) {
        result = true;
        id = nanoid();
        updateElementIdsInScene(this.scene, el, id);
      }
      this.elementLinks.set(id, el.link);
    }
    return result;
  }

  /**
   * check for textElements in Scene missing from textElements Map
   * @returns {boolean} - true if there were changes
   */
  private findNewTextElementsInScene(selectedElementIds: {[key: string]: boolean} = {}): boolean {
    //console.log("Excalidraw.Data.findNewTextElementsInScene()");
    //get scene text elements
    this.selectedElementIds = selectedElementIds;
    const texts = this.scene.elements?.filter((el: any) => el.type === "text") as ExcalidrawTextElement[];

    let dirty: boolean = false; //to keep track if the json has changed
    let id: string; //will be used to hold the new 8 char long ID for textelements that don't yet appear under # Text Elements
    for (const te of texts) {
      id = te.id;
      //replacing Excalidraw text IDs with my own nanoid, because default IDs may contain
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if (te.id.length > 8) {
        dirty = true;
        id = nanoid();
        if(this.selectedElementIds[te.id]) { //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609
          delete this.selectedElementIds[te.id];
          this.selectedElementIds[id] = true;
        }
        updateElementIdsInScene(this.scene, te, id);
        if (this.textElements.has(te.id)) {
          //element was created with onBeforeTextSubmit
          const text = this.textElements.get(te.id);
          this.textElements.set(id, {
            raw: text.raw,
            parsed: text.parsed,
          });
          this.textElements.delete(te.id); //delete the old ID from the Map
        }
        if (!this.textElements.has(id)) {
          const raw = te.rawText && te.rawText !== "" ? te.rawText : te.text; //this is for compatibility with drawings created before the rawText change on ExcalidrawTextElement
          this.textElements.set(id, { raw, parsed: null});
          this.parseasync(id, raw);
        }
      } else if (!this.textElements.has(te.id)) {
        const raw = te.rawText && te.rawText !== "" ? te.rawText : te.text; //this is for compatibility with drawings created before the rawText change on ExcalidrawTextElement
        this.textElements.set(id, { raw, parsed: null});
        this.parseasync(id, raw);
      }
      
    }
    return dirty;
  }

  private updateElementLinksFromScene() {
    for (const key of this.elementLinks.keys()) {
      //find element in the scene
      const el = this.scene.elements?.filter(
        (el: any) =>
          el.type !== "text" &&
          el.id === key &&
          el.link, //&&
          //el.link.startsWith("[["),
      );
      if (el.length === 0) {
        this.elementLinks.delete(key); //if no longer in the scene, delete the text element
      } else {
        this.elementLinks.set(key, el[0].link);
      }
    }
  }

  /**
   * update text element map by deleting entries that are no long in the scene
   * and updating the textElement map based on the text updated in the scene
   */
  private async updateTextElementsFromScene() {
    for (const key of this.textElements.keys()) {
      //find text element in the scene
      const el = this.scene.elements?.filter(
        (el: any) => el.type === "text" && el.id === key,
      );
      if (el.length === 0) {
        this.textElements.delete(key); //if no longer in the scene, delete the text element
      } else {
        const text = await this.getText(key);
        const raw = this.scene.prevTextMode === TextMode.parsed
          ? el[0].rawText
          : (el[0].originalText ?? el[0].text);
        if (text !== (el[0].originalText ?? el[0].text)) {
          this.textElements.set(key, {
            raw,
            parsed: (await this.parse(raw)).parsed,
          });
        }
      }
    }
  }

  private async parseasync(key: string, raw: string) {
    this.textElements.set(key, {
      raw,
      parsed: (await this.parse(raw)).parsed,
    });
  }

  private parseLinks(text: string, position: number, parts: any): string {
    return (
      text.substring(position, parts.value.index) +
      (this.showLinkBrackets ? "[[" : "") +
      REGEX_LINK.getAliasOrLink(parts) +
      (this.showLinkBrackets ? "]]" : "")
    );
  }

  /**
   *
   * @param text
   * @returns [string,number] - the transcluded text, and the line number for the location of the text
   */
  public async getTransclusion(
    link: string,
  ): Promise<{ contents: string; lineNum: number }> {
    const linkParts = getLinkParts(link, this.file);
    const file = this.app.metadataCache.getFirstLinkpathDest(
      linkParts.path,
      this.file.path,
    );
    return await getTransclusion(
      linkParts,
      this.app,
      file,
      this.plugin.settings.pageTransclusionCharLimit,
    );
  }

  /**
   * Process aliases and block embeds
   * @param text
   * @returns
   */
  private async parse(text: string): Promise<{ parsed: string; link: string }> {
    text = this.parseCheckbox(text);
    let outString = "";
    let link = null;
    let position = 0;
    const res = REGEX_LINK.getRes(text);
    let linkIcon = false;
    let urlIcon = false;
    let parts;
    if (text.match(REG_LINKINDEX_HYPERLINK)) {
      link = text;
      urlIcon = true;
    }
    while (!(parts = res.next()).done) {
      if (!link) {
        const l = REGEX_LINK.getLink(parts);
        if (l.match(REG_LINKINDEX_HYPERLINK)) {
          link = l;
        } else {
          link = `[[${l}]]`;
        }
      }
      if (REGEX_LINK.isTransclusion(parts)) {
        //transclusion //parts.value[1] || parts.value[4]
        let contents = this
          .parseCheckbox((await this.getTransclusion(REGEX_LINK.getLink(parts))).contents)
          .replaceAll(/%%[^%]*%%/gm,""); //remove comments, consequence of https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566
        if(this.plugin.settings.removeTransclusionQuoteSigns) {
          //remove leading > signs from transcluded quotations; the first > sign is not explicitlyl removed becuse 
          //Obsidian app.metadataCache.blockCache returns the block position already discarding the first '> '
          contents = contents.replaceAll(/\n\s*>\s?/gm,"\n"); 
        }
        outString +=
          text.substring(position, parts.value.index) +
          wrapTextAtCharLength(
            contents,
            REGEX_LINK.getWrapLength(
              parts,
              this.plugin.settings.wordWrappingDefault,
            ),
            this.plugin.settings.forceWrap,
          );
      } else {
        const parsedLink = this.parseLinks(text, position, parts);
        if (parsedLink) {
          outString += parsedLink;
          if (!(urlIcon || linkIcon)) {
            const linkText = REGEX_LINK.getLink(parts);
            if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
              urlIcon = !linkText.startsWith("cmd://"); //don't display the url icon for cmd:// links
            } else {
              linkIcon = true;
            }
          }
        }
      }
      position = parts.value.index + parts.value[0].length;
    }
    outString += text.substring(position, text.length);
    if (linkIcon) {
      outString = this.linkPrefix + outString;
    }
    if (urlIcon) {
      outString = this.urlPrefix + outString;
    }

    return { parsed: outString, link };
  }

  private parseCheckbox(text:string):string {
    return this.plugin.settings.parseTODO 
      ? text
        .replaceAll(/^- \[\s] /g,`${this.plugin.settings.todo} `)
        .replaceAll(/\n- \[\s] /g,`\n${this.plugin.settings.todo} `)
        .replaceAll(/^- \[[^\s]] /g,`${this.plugin.settings.done} `)
        .replaceAll(/\n- \[[^\s]] /g,`\n${this.plugin.settings.done} `)
      : text;
  }

  /**
   * Does a quick parse of the raw text. Returns the parsed string if raw text does not include a transclusion.
   * Return null if raw text includes a transclusion.
   * This is implemented in a separate function, because by nature resolving a transclusion is an asynchronious
   * activity. Quick parse gets the job done synchronously if possible.
   * @param text
   */
  private quickParse(text: string): [string, string] {
    const hasTransclusion = (text: string): boolean => {
      const res = REGEX_LINK.getRes(text);
      let parts;
      while (!(parts = res.next()).done) {
        if (REGEX_LINK.isTransclusion(parts)) {
          return true;
        }
      }
      return false;
    };
    if (hasTransclusion(text)) {
      return [null, null];
    }
    text = this.parseCheckbox(text);
    let outString = "";
    let link = null;
    let position = 0;
    const res = REGEX_LINK.getRes(text);
    let linkIcon = false;
    let urlIcon = false;
    let parts;
    if (text.match(REG_LINKINDEX_HYPERLINK)) {
      link = text;
      urlIcon = true;
    }
    while (!(parts = res.next()).done) {
      if (!link) {
        const l = REGEX_LINK.getLink(parts);
        if (l.match(REG_LINKINDEX_HYPERLINK)) {
          link = l;
        } else {
          link = `[[${l}]]`;
        }
      }
      const parsedLink = this.parseLinks(text, position, parts);
      if (parsedLink) {
        outString += parsedLink;
        if (!(urlIcon || linkIcon)) {
          const linkText = REGEX_LINK.getLink(parts);
          if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
            urlIcon = !linkText.startsWith("cmd://"); //don't display the url icon for cmd:// links
          } else {
            linkIcon = true;
          }
        }
      }
      position = parts.value.index + parts.value[0].length;
    }
    outString += text.substring(position, text.length);
    if (linkIcon) {
      outString = this.linkPrefix + outString;
    }
    if (urlIcon) {
      outString = this.urlPrefix + outString;
    }
    return [outString, link];
  }

  /**
   * Generate markdown file representation of excalidraw drawing
   * @returns markdown string
   */
  disableCompression: boolean = false;
  generateMDBase(deletedElements: ExcalidrawElement[] = []) {
    let outString = this.textElementCommentedOut ? "%%\n" : "";
    outString += `# Excalidraw Data\n\n## Text Elements\n`;
    if (this.plugin.settings.addDummyTextElement) {
      outString += `\n^_dummy!_\n\n`;
    }
    const textElementLinks = new Map<string, string>();
    for (const key of this.textElements.keys()) {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566
      const element = this.scene.elements.filter((el:any)=>el.id===key);
      let elementString = this.textElements.get(key).raw;
      if(element && element.length===1 && element[0].link && element[0].rawText === element[0].originalText) {
        //if(element[0].link.match(/^\[\[[^\]]*]]$/g)) { //apply this only to markdown links
          textElementLinks.set(key, element[0].link);
          //elementString = `%%***>>>text element-link:${element[0].link}<<<***%%` + elementString;
        //}
      }
      outString += `${elementString} ^${key}\n\n`;
    }

    if (this.elementLinks.size > 0  || textElementLinks.size > 0) {
      outString += `## Element Links\n`;
      for (const key of this.elementLinks.keys()) {
        outString += `${key}: ${this.elementLinks.get(key)}\n\n`;
      }
      for (const key of textElementLinks.keys()) {
        outString += `${key}: ${textElementLinks.get(key)}\n\n`;
      }
    }

    // deliberately not adding mermaids to here. It is enough to have the mermaidText in the image element's customData
    outString +=
      this.equations.size > 0 || this.files.size > 0
        ? "## Embedded Files\n"
        : "";
    if (this.equations.size > 0) {
      for (const key of this.equations.keys()) {
        outString += `${key}: $$${this.equations.get(key).latex.trim()}$$\n\n`;
      }
    }
    if (this.files.size > 0) {
      for (const key of this.files.keys()) {
        const PATHREG = /(^[^#\|]*)/;
        const ef = this.files.get(key);
        if(ef.isHyperLink || ef.isLocalLink) {
          outString += `${key}: ${ef.hyperlink}\n\n`;
        } else {
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/829
          const path = ef.file
            ? ef.linkParts.original.replace(PATHREG,this.app.metadataCache.fileToLinktext(ef.file,this.file.path))
            : ef.linkParts.original;
          const colorMap = ef.colorMap ? " " + JSON.stringify(ef.colorMap) : "";
          outString += `${key}: [[${path}]]${colorMap}\n\n`;
        }
      }
    }
    //outString += this.equations.size > 0 || this.files.size > 0 ? "\n" : "";

    const sceneJSONstring = JSON.stringify({
      type: this.scene.type,
      version: this.scene.version,
      source: this.scene.source, 
      elements: this.scene.elements.concat(deletedElements),
      appState: this.scene.appState,
      files: this.scene.files
    }, null, "\t");
    return { outString, sceneJSONstring };
  }

  async generateMDAsync(deletedElements: ExcalidrawElement[] = []): Promise<string> {
    const { outString, sceneJSONstring } = this.generateMDBase(deletedElements);
    const result = (
      outString +
      (this.textElementCommentedOut ? "" : "%%\n") +
      (await getMarkdownDrawingSectionAsync(
        sceneJSONstring,
        this.disableCompression ? false : this.plugin.settings.compress,
      ))
    );
    return result;
  }

  generateMDSync(deletedElements: ExcalidrawElement[] = []): string {
    const { outString, sceneJSONstring } = this.generateMDBase(deletedElements);
    const result = (
      outString +
      (this.textElementCommentedOut ? "" : "%%\n") +
      (getMarkdownDrawingSection(
        sceneJSONstring,
        this.disableCompression ? false : this.plugin.settings.compress,
      ))
    );
    return result;
  }

  public async saveDataURLtoVault(dataURL: DataURL, mimeType: MimeType, key: FileId, name?:string) {
    const scene = this.scene as SceneDataWithFiles;
    let fname = name;

    if(!fname) {
      fname = `Pasted Image ${window
        .moment()
        .format("YYYYMMDDHHmmss_SSS")}`;
    
      switch (mimeType) {
        case "image/png":
          fname += ".png";
          break;
        case "image/jpeg":
          fname += ".jpg";
          break;
        case "image/svg+xml":
          fname += ".svg";
          break;
        case "image/gif":
          fname += ".gif";
          break;
        default:
          fname += ".png";
      }
    }

    const arrayBuffer = await getBinaryFileFromDataURL(dataURL);
    if(!arrayBuffer) return null;

    const file = await importFileToVault(this.app, fname, arrayBuffer, this.file, this.view);

    const embeddedFile = new EmbeddedFile(
      this.plugin,
      this.file.path,
      file.path,
    );
    
    embeddedFile.setImage({
      imgBase64: dataURL,
      mimeType,
      size: { height: 0, width: 0 },
      isDark: scene.appState?.theme === "dark",
      isSVGwithBitmap: mimeType === "image/svg+xml", //this treat all SVGs as if they had embedded images REF:addIMAGE
    });
    this.setFile(key as FileId, embeddedFile);
    return file;
  }

  private syncCroppedPDFs() {
    let dirty = false;
    const scene = this.scene as SceneDataWithFiles;
    const pdfScale = this.plugin.settings.pdfScale;
    scene.elements
    .filter(el=>el.type === "image" && el.crop && !el.isDeleted)
    .forEach((el: Mutable<ExcalidrawImageElement>)=>{
      const ef = this.getFile(el.fileId);
      if(!ef.file) return;
      if(ef.file.extension !== "pdf") return;
      const pageRef = ef.linkParts.original.split("#")?.[1];
      if(!pageRef || !pageRef.startsWith("page=") || pageRef.includes("rect")) return;
      const restOfLink = el.link ? el.link.match(/&rect=\d*,\d*,\d*,\d*(.*)/)?.[1] : "";
      const link = ef.linkParts.original +
        getPDFRect({elCrop: el.crop, scale: pdfScale, customData: el.customData}) +
        (restOfLink ? restOfLink : "]]");
      el.link = `[[${link}`;
      this.elementLinks.set(el.id, el.link);
      dirty = true;
    });
  }

  /**
   * deletes fileIds from Excalidraw data for files no longer in the scene
   * @returns
   */
  private async syncFiles(): Promise<boolean> {
    let dirty = false;
    const scene = this.scene as SceneDataWithFiles;

    //remove files and equations that no longer have a corresponding image element
    const images = scene.elements.filter((e) => e.type === "image") as ExcalidrawImageElement[];
    const fileIds = (images).map((e) => e.fileId);
    this.files.forEach((value, key) => {
      if (!fileIds.contains(key)) {
        this.files.delete(key);
        dirty = true;
      }
    });

    this.equations.forEach((value, key) => {
      if (!fileIds.contains(key)) {
        this.equations.delete(key);
        dirty = true;
      }
    });

    this.mermaids.forEach((value, key) => {
      if (!fileIds.contains(key)) {
        this.mermaids.delete(key);
        dirty = true;
      }
    });

    
    //check if there are any images that need to be processed in the new scene
    if (!scene.files || Object.keys(scene.files).length === 0) {
      return false;
    }


    //assing new fileId to duplicate equation and markdown files
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/601
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/593
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/297
    const processedIds = new Set<string>();
    fileIds.forEach((fileId,idx)=>{
      if(processedIds.has(fileId)) {
        const embeddedFile = this.getFile(fileId);
        const equation = this.getEquation(fileId);
        const mermaid = this.getMermaid(fileId);

        //images should have a single reference, but equations, and markdown embeds should have as many as instances of the file in the scene
        if (embeddedFile &&
            (embeddedFile.isHyperLink || embeddedFile.isLocalLink ||
             (embeddedFile.file &&
              (embeddedFile.file.extension !== "md" || this.plugin.isExcalidrawFile(embeddedFile.file))
             )
            )
        ) {
          return;
        }
        if(mermaid) {
          return;
        }

        if(getMermaidText(images[idx])) {
          this.setMermaid(fileId, {mermaid: getMermaidText(images[idx]), isLoaded: true});
          return;
        }

        if(!embeddedFile && !equation && !mermaid) {
          //processing freshly pasted images from likely anotehr instance of excalidraw (e.g. Excalidraw.com, or another Obsidian instance)
          return;
        }

        const newId = fileid();
        (scene
          .elements
          .filter((el:ExcalidrawImageElement)=>el.fileId === fileId)
          .sort((a,b)=>a.updated<b.updated ? 1 : -1)[0] as any)
          .fileId = newId;
        dirty = true;
        processedIds.add(newId);
        if(embeddedFile) {
          this.setFile(newId as FileId,new EmbeddedFile(this.plugin,this.file.path,embeddedFile.linkParts.original));
        }
        if(equation) {
          this.setEquation(newId as FileId, {latex:equation.latex, isLoaded:false});
        }
      }
      processedIds.add(fileId);
    });


    for (const key of Object.keys(scene.files)) {
      const mermaidElements = getMermaidImageElements(scene.elements.filter((el:ExcalidrawImageElement)=>el.fileId === key));
      if (!(this.hasFile(key as FileId) || this.hasEquation(key as FileId) || this.hasMermaid(key as FileId) || mermaidElements.length > 0)) {
        dirty = true;
        await this.saveDataURLtoVault(
          scene.files[key].dataURL,
          scene.files[key].mimeType,
          key as FileId,
          //@ts-ignore
          scene.files[key].name,
        );
      }
    }

    return dirty;
  }

  public async syncElements(newScene: any, selectedElementIds?: {[key: string]: boolean}): Promise<boolean> {
    this.scene = newScene;
    let result = false;
    if (!this.compatibilityMode) {
      result = await this.syncFiles();
      this.scene.files = {}; //files contains the dataURLs of files. Once synced these are all saved to disk
    }
    this.updateElementLinksFromScene();
    result =
      result ||
      this.syncCroppedPDFs() ||
      this.setLinkPrefix() ||
      this.setUrlPrefix() ||
      this.setShowLinkBrackets() ||
      this.findNewElementLinksInScene();
    await this.updateTextElementsFromScene();
    return result || this.findNewTextElementsInScene(selectedElementIds);
  }

  public async updateScene(newScene: any) {
    //console.log("Excalidraw.Data.updateScene()");
    this.scene = JSON_parse(newScene);
    this.updateElementLinksFromScene();
    const result =
      this.setLinkPrefix() ||
      this.setUrlPrefix() ||
      this.setShowLinkBrackets() ||
      this.setembeddableThemePreference() ||
      this.findNewElementLinksInScene();
    await this.updateTextElementsFromScene();
    if (result || this.findNewTextElementsInScene()) {
      await this.updateSceneTextElements();
      return true;
    }
    return false;
  }

  public getRawText(id: string) {
    return this.textElements.get(id)?.raw;
  }

  /**
   * returns parsed text with the correct line length
   * @param id 
   * @returns 
   */
  public getParsedText(id: string): string {
    const t = this.textElements.get(id);
    if (!t) {
      return null;
    }
    return t.parsed;
  }

  /**
   * Attempts to quickparse (sycnhronously) the raw text.
   * 
   * If successful: 
   *   - it will set the textElements cache with the parsed result, and
   *   - return the parsed result as an array of 3 values: [parsedTextWrapped, parsedText, link]
   * 
   * If the text contains a transclusion:
   *   - it will initiate the async parse, and
   *   - it will return [null,null,null].
   * @param elementID 
   * @param rawText 
   * @param rawOriginalText 
   * @param updateSceneCallback 
   * @returns [parseResultOriginal: string, link: string]
   */
  public setTextElement(
    elementID: string,
    rawOriginalText: string,
    updateSceneCallback: Function,

  ): [parseResultOriginal: string, link: string] {
    //const maxLineLen = estimateMaxLineLen(rawText, rawOriginalText);
    const [parseResult, link] = this.quickParse(rawOriginalText); //will return the parsed result if raw text does not include transclusion
    if (parseResult) {
      //No transclusion
      this.textElements.set(elementID, {
        raw: rawOriginalText,
        parsed: parseResult,
      });
      return [parseResult, link];
    }
    //transclusion needs to be resolved asynchornously
    this.parse(rawOriginalText).then((parseRes) => {
      const parsedText = parseRes.parsed;
      this.textElements.set(elementID, {
        raw: rawOriginalText,
        parsed: parsedText,
      });
      if (parsedText) {
        updateSceneCallback(parsedText);
      }
    });
    return [null, null];
  }

  public async addTextElement(
    elementID: string,
    rawText: string,
    rawOriginalText: string,
  ): Promise<{parseResult: string, link:string}> {
    const parseResult = await this.parse(rawOriginalText);
    this.textElements.set(elementID, {
      raw: rawOriginalText,
      parsed: parseResult.parsed,
    });
    return {
      parseResult: parseResult.parsed,
      link: parseResult.link,
    };
  }

  public deleteTextElement(id: string) {
    this.textElements.delete(id);
  }

  public getOpenMode(): { viewModeEnabled: boolean; zenModeEnabled: boolean } {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    let mode = this.plugin.settings.defaultMode === "view-mobile"
      ? (DEVICE.isPhone ? "view" : "normal")
      : this.plugin.settings.defaultMode;
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["default-mode"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["default-mode"].name] !== "undefined")
    ) {
      mode = fileCache.frontmatter[FRONTMATTER_KEYS["default-mode"].name];
    }

    switch (mode) {
      case "zen":
        return { viewModeEnabled: false, zenModeEnabled: true };
      case "view":
        return { viewModeEnabled: true, zenModeEnabled: false };
      default:
        return { viewModeEnabled: false, zenModeEnabled: false };
    }
  }

  public getLinkOpacity(): number {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    let opacity = this.plugin.settings.linkOpacity;
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["linkbutton-opacity"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["linkbutton-opacity"].name] !== "undefined")
    ) {
      opacity = fileCache.frontmatter[FRONTMATTER_KEYS["linkbutton-opacity"].name];
    }
    return opacity; 
  }

  public getOnLoadScript(): string {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["onload-script"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["onload-script"].name] !== "undefined")
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["onload-script"].name];
    }
    return null; 
  }

  private setLinkPrefix(): boolean {
    const linkPrefix = this.linkPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["link-prefix"].name] !== "undefined")
    ) {
      this.linkPrefix = fileCache.frontmatter[FRONTMATTER_KEYS["link-prefix"].name]??"";
    } else {
      this.linkPrefix = this.plugin.settings.linkPrefix;
    }
    return linkPrefix !== this.linkPrefix;
  }

  private setUrlPrefix(): boolean {
    const urlPrefix = this.urlPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["url-prefix"].name] !== "undefined")
    ) {
      this.urlPrefix = fileCache.frontmatter[FRONTMATTER_KEYS["url-prefix"].name]??"";
    } else {
      this.urlPrefix = this.plugin.settings.urlPrefix;
    }
    return urlPrefix !== this.urlPrefix;
  }

  private setAutoexportPreferences() {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["autoexport"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["autoexport"].name] !== "undefined")
    ) {
      switch ((fileCache.frontmatter[FRONTMATTER_KEYS["autoexport"].name]).toLowerCase()) {
        case "none": this.autoexportPreference = AutoexportPreference.none; break;
        case "both": this.autoexportPreference = AutoexportPreference.both; break;
        case "png": this.autoexportPreference = AutoexportPreference.png; break;
        case "svg": this.autoexportPreference = AutoexportPreference.svg; break;
        default: this.autoexportPreference = AutoexportPreference.inherit;
      };
    } else {
      this.autoexportPreference = AutoexportPreference.inherit;
    }
  }

  private setembeddableThemePreference(): boolean {
    const embeddableTheme = this.embeddableTheme;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["embeddable-theme"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["embeddable-theme"].name] !== "undefined")
    ) {
      this.embeddableTheme = fileCache.frontmatter[FRONTMATTER_KEYS["embeddable-theme"].name].toLowerCase();
      if (!EMBEDDABLE_THEME_FRONTMATTER_VALUES.includes(this.embeddableTheme)) {
        this.embeddableTheme = "default";
      }
    } else {
      if ( //backwards compatibility
        fileCache?.frontmatter &&
        fileCache.frontmatter[FRONTMATTER_KEYS["iframe-theme"].name] !== null &&
        (typeof fileCache.frontmatter[FRONTMATTER_KEYS["iframe-theme"].name] !== "undefined")
      ) {
        this.embeddableTheme = fileCache.frontmatter[FRONTMATTER_KEYS["iframe-theme"].name].toLowerCase();
        if (!EMBEDDABLE_THEME_FRONTMATTER_VALUES.includes(this.embeddableTheme)) {
          this.embeddableTheme = "default";
        }
      } else {
        this.embeddableTheme = this.plugin.settings.iframeMatchExcalidrawTheme ? "auto" : "default";
      }
    }
    return embeddableTheme !== this.embeddableTheme;
  }

  private setShowLinkBrackets(): boolean {
    const showLinkBrackets = this.showLinkBrackets;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["link-brackets"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["link-brackets"].name] !== "undefined")
    ) {
      this.showLinkBrackets =
        fileCache.frontmatter[FRONTMATTER_KEYS["link-brackets"].name] !== false;
    } else {
      this.showLinkBrackets = this.plugin.settings.showLinkBrackets;
    }
    return showLinkBrackets !== this.showLinkBrackets;
  }

  /** 
   Files, equations and mermaid copy/paste support
   This is not a complete solution, it assumes the source document is opened first
   at that time the fileId is stored in the master files/equations map
   when pasted the map is checked if the file already exists
   This will not work if pasting from one vault to another, but for the most common usecase 
   of copying an image or equation from one drawing to another within the same vault
   this is going to do the job
  */
  public setFile(fileId: FileId, data: EmbeddedFile) {
    //always store absolute path because in case of paste, relative path may not resolve ok
    if (!data) {
      return;
    }
    this.files.set(fileId, data);

    if(data.isHyperLink || data.isLocalLink) {
      this.plugin.filesMaster.set(fileId, {
        isHyperLink: data.isHyperLink,
        isLocalLink: data.isLocalLink,
        path: data.hyperlink,
        blockrefData: null,
        hasSVGwithBitmap: data.isSVGwithBitmap,
      });
      return;
    }

    if (!data.file) {
      return;
    }

    const parts = data.linkParts.original.split("#");
    this.plugin.filesMaster.set(fileId, {
      isHyperLink: false,
      isLocalLink: false,
      path:data.file.path + (data.shouldScale()?"":"|100%"),
      blockrefData: parts.length === 1
        ? null
        : parts[1],
      hasSVGwithBitmap: data.isSVGwithBitmap,
      colorMapJSON: data.colorMap ? JSON.stringify(data.colorMap) : null,
    });
  }

  public getFiles(): EmbeddedFile[] {
    return Object.values(this.files);
  }

  public getFile(fileId: FileId): EmbeddedFile {
    let embeddedFile = this.files.get(fileId);
    if(embeddedFile) return embeddedFile;
    const masterFile = this.plugin.filesMaster.get(fileId);
    if(!masterFile) return embeddedFile;
    embeddedFile = new EmbeddedFile(
      this.plugin,
      this.file.path,
      masterFile.blockrefData
        ? masterFile.path + "#" + masterFile.blockrefData
        : masterFile.path,
      masterFile.colorMapJSON
    );
    this.files.set(fileId,embeddedFile);
    return embeddedFile;
  }

  public getFileEntries() {
    return this.files.entries();
  }

  public deleteFile(fileId: FileId) {
    this.files.delete(fileId);
    //deliberately not deleting from plugin.filesMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasFile(fileId: FileId): boolean {
    if (this.files.has(fileId)) {
      return true;
    }
    if (this.plugin.filesMaster.has(fileId)) {
      const masterFile = this.plugin.filesMaster.get(fileId);
      if(masterFile.isHyperLink || masterFile.isLocalLink) {
        this.files.set(
          fileId,
          new EmbeddedFile(this.plugin,this.file.path,masterFile.path)
        );
        return true;
      }
      const path = masterFile.path.split("|")[0].split("#")[0];
      if (!this.app.vault.getAbstractFileByPath(path)) {
        this.plugin.filesMaster.delete(fileId);
        return true;
      } // the file no longer exists
      const fixScale = masterFile.path.endsWith("100%");
      const embeddedFile = new EmbeddedFile(
        this.plugin,
        this.file.path,
        (masterFile.blockrefData
          ? path + "#" + masterFile.blockrefData
          : path) + (fixScale?"|100%":""),
        masterFile.colorMapJSON
      );
      this.files.set(fileId, embeddedFile);
      return true;
    }
    return false;
  }

  //--------------
  //Equations
  //--------------
  public setEquation(
    fileId: FileId,
    data: { latex: string; isLoaded: boolean },
  ) {
    this.equations.set(fileId, { latex: data.latex, isLoaded: data.isLoaded });
    this.plugin.equationsMaster.set(fileId, data.latex);
  }

  public getEquation(fileId: FileId): { latex: string; isLoaded: boolean } {
    let result = this.equations.get(fileId);
    if(result) return result;
    const latex = this.plugin.equationsMaster.get(fileId);
    if(!latex) return result;
    this.equations.set(fileId, {latex, isLoaded: false});
    return {latex, isLoaded: false};
  }

  public getEquationEntries() {
    return this.equations?.entries();
  }

  public deleteEquation(fileId: FileId) {
    this.equations.delete(fileId);
    //deliberately not deleting from plugin.equationsMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasEquation(fileId: FileId): boolean {
    if (this.equations.has(fileId)) {
      return true;
    }
    if (this.plugin.equationsMaster.has(fileId)) {
      this.equations.set(fileId, {
        latex: this.plugin.equationsMaster.get(fileId),
        isLoaded: false,
      });
      return true;
    }
    return false;
  }

  //--------------
  //Mermaids
  //--------------
  public setMermaid(
    fileId: FileId,
    data: { mermaid: string; isLoaded: boolean },
  ) {
    this.mermaids.set(fileId, { mermaid: data.mermaid, isLoaded: data.isLoaded });
    this.plugin.mermaidsMaster.set(fileId, data.mermaid);
  }

  public getMermaid(fileId: FileId): { mermaid: string; isLoaded: boolean } {
    let result = this.mermaids.get(fileId);
    if(result) return result;
    const mermaid = this.plugin.mermaidsMaster.get(fileId);
    if(!mermaid) return result;
    this.mermaids.set(fileId, {mermaid, isLoaded: false});
    return {mermaid, isLoaded: false};
  }

  public getMermaidEntries() {
    return this.mermaids.entries();
  }

  public deleteMermaid(fileId: FileId) {
    this.mermaids.delete(fileId);
    //deliberately not deleting from plugin.mermaidsMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasMermaid(fileId: FileId): boolean {
    if (this.mermaids.has(fileId)) {
      return true;
    }
    if (this.plugin.mermaidsMaster.has(fileId)) {
      this.mermaids.set(fileId, {
        mermaid: this.plugin.mermaidsMaster.get(fileId),
        isLoaded: false,
      });
      return true;
    }
    return false;
  }
}

export const getTransclusion = async (
  linkParts: LinkParts,
  app: App,
  file: TFile,
  charCountLimit?: number,
): Promise<{ contents: string; lineNum: number; leadingHashes?: string; }> => {
  //file-name#^blockref
  //1         2 3

  if (!linkParts.path) {
    return { contents: linkParts.original.trim(), lineNum: 0 };
  } //filename not found

  if (!file || !(file instanceof TFile)) {
    return { contents: linkParts.original.trim(), lineNum: 0 };
  }

  const contents = await app.vault.read(file);

  if (!linkParts.ref) {
    //no blockreference
    return charCountLimit
      ? { contents: contents.substring(0, charCountLimit).trim(), lineNum: 0 }
      : { contents: contents.trim(), lineNum: 0 };
  }

  const blocks = (
    await app.metadataCache.blockCache.getForFile(
      { isCancelled: () => false },
      file,
    )
  ).blocks.filter((block: any) => block.node.type !== "comment");
  if (!blocks) {
    return { contents: linkParts.original.trim(), lineNum: 0 };
  }

  if (linkParts.isBlockRef) {
    let para = blocks.filter((block: any) => block.node.id == linkParts.ref)[0]
      ?.node;
    if (!para) {
      return { contents: linkParts.original.trim(), lineNum: 0 };
    }
    if (["blockquote"].includes(para.type)) {
      para = para.children[0];
    } //blockquotes are special, they have one child, which has the paragraph
    const startPos = para.position.start.offset;
    const lineNum = para.position.start.line;
    const endPos = para.position.end.offset; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/853
      //para.children[para.children.length - 1]?.position.start.offset - 1; //!not clear what the side effect of the #853 change is
    return {
      contents: contents.substring(startPos, endPos).replaceAll(/ \^\S*$|^\^\S*$/gm,"").trim(), //remove the block reference from the end of the line, or from the beginning of a new line
      lineNum,
    };
  }

  const headings = blocks.filter(
    (block: any) => block.display.search(/^#+\s/) === 0,
  ); // startsWith("#"));
  let startPos: number = null;
  let lineNum: number = 0;
  let endPos: number = null;
  let depth:number = 1;
  for (let i = 0; i < headings.length; i++) {
    if (startPos && !endPos) {
      let j = i;
      while (j<headings.length && headings[j].node.depth>depth) {j++};
      if(j === headings.length && headings[j-1].node.depth > depth) {
        return {
          leadingHashes: "#".repeat(depth)+" ",
          contents: contents.substring(startPos).trim(),
          lineNum
        };    
      }
      endPos = headings[j].node.position.start.offset - 1;
      return {
        leadingHashes: "#".repeat(depth)+" ",
        contents: contents.substring(startPos, endPos).trim(),
        lineNum,
      };
    }
    const c = headings[i].node.children[0];
    const dataHeading = headings[i].node.data?.hProperties?.dataHeading;
    const cc = c?.children;
    //const refNoSpace = linkParts.ref.replaceAll(" ","");
    if (
      !startPos &&
      ((cleanBlockRef(c?.value) === linkParts.ref ||
        cleanBlockRef(c?.title) === linkParts.ref ||
        cleanBlockRef(dataHeading) === linkParts.ref ||
        (cc
          ? cleanBlockRef(cc[0]?.value) === linkParts.ref
          : false)) || 
        (cleanSectionHeading(c?.value) === linkParts.ref ||
         cleanSectionHeading(c?.title) === linkParts.ref ||
         cleanSectionHeading(dataHeading) === linkParts.ref ||
          (cc
            ? cleanSectionHeading(cc[0]?.value) === linkParts.ref
            : false))
        )
    ) {
      startPos = headings[i].node.children[0]?.position.start.offset; //
      depth = headings[i].node.depth;
      lineNum = headings[i].node.children[0]?.position.start.line; //
    }
  }
  if (startPos) {
    return {
      leadingHashes: "#".repeat(depth) + " ",
      contents: contents.substring(startPos).trim(),
      lineNum
    };
  }
  return { contents: linkParts.original.trim(), lineNum: 0 };
};
