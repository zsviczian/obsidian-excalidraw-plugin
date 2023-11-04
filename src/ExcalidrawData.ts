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
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
  FRONTMATTER_KEY_CUSTOM_URL_PREFIX,
  FRONTMATTER_KEY_DEFAULT_MODE,
  fileid,
  FRONTMATTER_KEY_LINKBUTTON_OPACITY,
  FRONTMATTER_KEY_ONLOAD_SCRIPT,
  FRONTMATTER_KEY_AUTOEXPORT,
  FRONTMATTER_KEY_EMBEDDABLE_THEME,
  DEVICE,
  EMBEDDABLE_THEME_FRONTMATTER_VALUES,
  getBoundTextMaxWidth,
  getDefaultLineHeight,
  getFontString,
  wrapText,
  ERROR_IFRAME_CONVERSION_CANCELED,
  JSON_parse,
} from "./constants";
import { _measureText } from "./ExcalidrawAutomate";
import ExcalidrawPlugin from "./main";
import { TextMode } from "./ExcalidrawView";
import {
  addAppendUpdateCustomData,
  compress,
  debug,
  decompress,
  //getBakPath,
  getBinaryFileFromDataURL,
  getContainerElement,
  getExportTheme,
  getLinkParts,
  hasExportTheme,
  isVersionNewerThanOther,
  LinkParts,
  wrapTextAtCharLength,
} from "./utils/Utils";
import { cleanBlockRef, cleanSectionHeading, getAttachmentsFolderAndFilePath, isObsidianThemeDark } from "./utils/ObsidianUtils";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/types";
import { BinaryFiles, DataURL, SceneData } from "@zsviczian/excalidraw/types/types";
import { EmbeddedFile, MimeType } from "./EmbeddedFileLoader";
import { ConfirmationPrompt } from "./dialogs/Prompt";
import { getMermaidImageElements, getMermaidText, shouldRenderMermaid } from "./utils/MermaidUtils";

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

export const REGEX_LINK = {
  //![[link|alias]] [alias](link){num}
  //      1   2    3           4             5         67         8  9
  EXPR: /(!)?(\[\[([^|\]]+)\|?([^\]]+)?]]|\[([^\]]*)]\(([^)]*)\))(\{(\d+)\})?/g, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
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
const DRAWING_REG = /\n# Drawing\n[^`]*(```json\n)([\s\S]*?)```\n/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_REG_FALLBACK = /\n# Drawing\n(```json\n)?(.*)(```)?(%%)?/gm;
const DRAWING_COMPRESSED_REG =
  /(\n# Drawing\n[^`]*(?:```compressed\-json\n))([\s\S]*?)(```\n)/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_COMPRESSED_REG_FALLBACK =
  /(\n# Drawing\n(?:```compressed\-json\n)?)(.*)((```)?(%%)?)/gm;
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

export function getMarkdownDrawingSection(
  jsonString: string,
  compressed: boolean,
) {
  return compressed
    ? `%%\n# Drawing\n\x60\x60\x60compressed-json\n${compress(
        jsonString,
      )}\n\x60\x60\x60\n%%`
    : `%%\n# Drawing\n\x60\x60\x60json\n${jsonString}\n\x60\x60\x60\n%%`;
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

export class ExcalidrawData {
  public textElements: Map<
    string,
    { raw: string; parsed: string; wrapAt: number | null }
  > = null;
  public elementLinks: Map<string, string> = null;
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
  public files: Map<FileId, EmbeddedFile> = null; //fileId, path
  private equations: Map<FileId, { latex: string; isLoaded: boolean }> = null; //fileId, path
  private mermaids: Map<FileId, { mermaid: string; isLoaded: boolean }> = null; //fileId, path
  private compatibilityMode: boolean = false;
  selectedElementIds: {[key:string]:boolean} = {}; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609

  constructor(
    private plugin: ExcalidrawPlugin,
  ) {
    this.app = plugin.app;
    this.files = new Map<FileId, EmbeddedFile>();
    this.equations = new Map<FileId, { latex: string; isLoaded: boolean }>();
    this.mermaids = new Map<FileId, { mermaid: string; isLoaded: boolean }>();
  }

  /**
   * 1.5.4: for backward compatibility following the release of container bound text elements and the depreciation boundElementIds field
   */
  private initializeNonInitializedFields() {
    if (!this.scene || !this.scene.elements) {
      return;
    }

    const saveVersion = this.scene.source.split("https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/")[1]??"1.8.16";

    const elements = this.scene.elements;
    for (const el of elements) {
      if(el.type === "iframe") {
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
              elements.find((el:ExcalidrawElement)=>el.id===item.id).containerId = null;
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
          //container.customData = {...container.customData, legacyTextWrap: true};
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
      { raw: string; parsed: string; wrapAt: number }
    >();
    this.elementLinks = new Map<string, string>();
    if (this.file != file) {
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

    //once off migration of legacy scenes
    if(this.scene?.elements?.some((el:any)=>el.type==="iframe")) {
        const prompt = new ConfirmationPrompt(
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

    //The Markdown # Text Elements take priority over the JSON text elements. Assuming the scenario in which the link was updated due to filename changes
    //The .excalidraw JSON is modified to reflect the MD in case of difference
    //Read the text elements into the textElements Map
    let position = data.search(/(^%%\n)?# Text Elements\n/m);
    if (position === -1) {
      await this.setTextMode(textMode, false);
      this.loaded = true;
      return true; //Text Elements header does not exist
    }
    position += data.match(/((^%%\n)?# Text Elements\n)/m)[0].length;

    data = data.substring(position);
    position = 0;

    //iterating through all the text elements in .md
    //Text elements always contain the raw value
    const BLOCKREF_LEN: number = " ^12345678\n\n".length;
    let res = data.matchAll(/\s\^(.{8})[\n]+/g);
    let parts;
    while (!(parts = res.next()).done) {
      let text = data.substring(position, parts.value.index);
      const id: string = parts.value[1];
      const textEl = this.scene.elements.filter((el: any) => el.id === id)[0];
      if (textEl) {
        if (textEl.type !== "text") {
          //markdown link attached to elements
          if (textEl.link !== text) {
            textEl.link = text;
            textEl.version++;
            textEl.versionNonce++;
          }
          this.elementLinks.set(id, text);
        } else {
          const wrapAt = estimateMaxLineLen(textEl.text, textEl.originalText);
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566
          const elementLinkRes = text.matchAll(/^%%\*\*\*>>>text element-link:(\[\[[^<*\]]*]])<<<\*\*\*%%/gm); 
          const elementLink = elementLinkRes.next();
          if(!elementLink.done) {
            text = text.replace(/^%%\*\*\*>>>text element-link:\[\[[^<*\]]*]]<<<\*\*\*%%/gm,"");
            textEl.link = elementLink.value[1];
          } 
          const parseRes = await this.parse(text);
          textEl.rawText = text;
          this.textElements.set(id, {
            raw: text,
            parsed: parseRes.parsed,
            wrapAt,
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

    data = data.substring(
      data.indexOf("# Embedded files\n") + "# Embedded files\n".length,
    );
    //Load Embedded files
    const REG_FILEID_FILEPATH = /([\w\d]*):\s*\[\[([^\]]*)]]\s?(\{[^}]*})?\n/gm;
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
      { raw: string; parsed: string; wrapAt: number }
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

  //update a single text element in the scene if the newText is different
  public updateTextElement(
    sceneTextElement: any,
    newText: string,
    newOriginalText: string,
    forceUpdate: boolean = false,
    containerType?: string,
  ) {
    if (forceUpdate || newText != sceneTextElement.text) {
      const measure = _measureText(
        newText,
        sceneTextElement.fontSize,
        sceneTextElement.fontFamily,
        sceneTextElement.lineHeight??getDefaultLineHeight(sceneTextElement.fontFamily),
      );
      sceneTextElement.text = newText;
      sceneTextElement.originalText = newOriginalText;

      if (!sceneTextElement.containerId || containerType==="arrow") {
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/376
        //I leave the setting of text width to excalidraw, when text is in a container
        //because text width is fixed to the container width
        sceneTextElement.width = measure.w;
      }
      sceneTextElement.height = measure.h;
      sceneTextElement.baseline = measure.baseline;
    }
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
    const texts = this.scene.elements?.filter((el: any) => el.type === "text");
    for (const te of texts) {
      const container = getContainerElement(te,this.scene);
      const originalText =
        (await this.getText(te.id)) ?? te.originalText ?? te.text;
      const wrapAt = this.textElements.get(te.id)?.wrapAt;
      try { //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1062
        this.updateTextElement(
          te,
          wrapAt ? wrapText(
            originalText,
            getFontString({fontSize: te.fontSize, fontFamily: te.fontFamily}),
            getBoundTextMaxWidth(container as any)
          ) : originalText,
          originalText,
          forceupdate,
          container?.type,
        ); //(await this.getText(te.id))??te.text serves the case when the whole #Text Elements section is deleted by accident
      } catch(e) {
        debug({where: "ExcalidrawData.updateSceneTextElements", fn: this.updateSceneTextElements, textElement: te});
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
          wrapAt: text.wrapAt,
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
        el.link.startsWith("[[") &&
        !this.elementLinks.has(el.id)
      );
    });
    if (elements.length === 0) {
      return result;
    }

    let jsonString = JSON.stringify(this.scene);

    let id: string; //will be used to hold the new 8 char long ID for textelements that don't yet appear under # Text Elements
    
    for (const el of elements) {
      id = el.id;
      //replacing Excalidraw element IDs with my own nanoid, because default IDs may contain
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if (el.id.length > 8) {
        result = true;
        id = nanoid();
        jsonString = jsonString.replaceAll(el.id, id); //brute force approach to replace all occurances (e.g. links, groups,etc.)
      }
      this.elementLinks.set(id, el.link);
    }
    this.scene = JSON.parse(jsonString);
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
    const texts = this.scene.elements?.filter((el: any) => el.type === "text");

    let jsonString = JSON.stringify(this.scene);

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
        jsonString = jsonString.replaceAll(te.id, id); //brute force approach to replace all occurances (e.g. links, groups,etc.)
        if (this.textElements.has(te.id)) {
          //element was created with onBeforeTextSubmit
          const text = this.textElements.get(te.id);
          this.textElements.set(id, {
            raw: text.raw,
            parsed: text.parsed,
            wrapAt: text.wrapAt,
          });
          this.textElements.delete(te.id); //delete the old ID from the Map
        }
        if (!this.textElements.has(id)) {
          const raw = te.rawText && te.rawText !== "" ? te.rawText : te.text; //this is for compatibility with drawings created before the rawText change on ExcalidrawTextElement
          const wrapAt = estimateMaxLineLen(te.text, te.originalText);
          this.textElements.set(id, { raw, parsed: null, wrapAt });
          this.parseasync(id, raw, wrapAt);
        }
      } else if (!this.textElements.has(te.id)) {
        const raw = te.rawText && te.rawText !== "" ? te.rawText : te.text; //this is for compatibility with drawings created before the rawText change on ExcalidrawTextElement
        const wrapAt = estimateMaxLineLen(te.text, te.originalText);
        this.textElements.set(id, { raw, parsed: null, wrapAt });
        this.parseasync(id, raw, wrapAt);
      }
      
    }
    if (dirty) {
      //reload scene json in case it has changed
      this.scene = JSON.parse(jsonString);
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
          el.link &&
          el.link.startsWith("[["),
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
          const wrapAt = estimateMaxLineLen(el[0].text, el[0].originalText);
          this.textElements.set(key, {
            raw,
            parsed: (await this.parse(raw)).parsed,
            wrapAt,
          });
        }
      }
    }
  }

  private async parseasync(key: string, raw: string, wrapAt: number) {
    this.textElements.set(key, {
      raw,
      parsed: (await this.parse(raw)).parsed,
      wrapAt,
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
  generateMD(deletedElements: ExcalidrawElement[] = []): string {
    let outString = "# Text Elements\n";
    for (const key of this.textElements.keys()) {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566
      const element = this.scene.elements.filter((el:any)=>el.id===key);
      let elementString = this.textElements.get(key).raw;
      if(element && element.length===1 && element[0].link && element[0].rawText === element[0].originalText) {
        if(element[0].link.match(/^\[\[[^\]]*]]$/g)) { //apply this only to markdown links
          elementString = `%%***>>>text element-link:${element[0].link}<<<***%%` + elementString;
        }
      }
      outString += `${elementString} ^${key}\n\n`;
    }

    for (const key of this.elementLinks.keys()) {
      outString += `${this.elementLinks.get(key)} ^${key}\n\n`;
    }

    // deliberately not adding mermaids to here. It is enough to have the mermaidText in the image element's customData
    outString +=
      this.equations.size > 0 || this.files.size > 0
        ? "\n# Embedded files\n"
        : "";
    if (this.equations.size > 0) {
      for (const key of this.equations.keys()) {
        outString += `${key}: $$${this.equations.get(key).latex}$$\n`;
      }
    }
    if (this.files.size > 0) {
      for (const key of this.files.keys()) {
        const PATHREG = /(^[^#\|]*)/;
        const ef = this.files.get(key);
        if(ef.isHyperLink || ef.isLocalLink) {
          outString += `${key}: ${ef.hyperlink}\n`;
        } else {
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/829
          const path = ef.file
            ? ef.linkParts.original.replace(PATHREG,app.metadataCache.fileToLinktext(ef.file,this.file.path))
            : ef.linkParts.original;
          const colorMap = ef.colorMap ? " " + JSON.stringify(ef.colorMap) : "";
          outString += `${key}: [[${path}]]${colorMap}\n`;
        }
      }
    }
    outString += this.equations.size > 0 || this.files.size > 0 ? "\n" : "";

    const sceneJSONstring = JSON.stringify({
      type: this.scene.type,
      version: this.scene.version,
      source: this.scene.source, 
      elements: this.scene.elements.concat(deletedElements),
      appState: this.scene.appState,
      files: this.scene.files
    }, null, "\t");
    return (
      outString +
      getMarkdownDrawingSection(
        sceneJSONstring,
        this.disableCompression ? false : this.plugin.settings.compress,
      )
    );
  }

  public async saveDataURLtoVault(dataURL: DataURL, mimeType: MimeType, key: FileId) {
    const scene = this.scene as SceneDataWithFiles;
    let fname = `Pasted Image ${window
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
    const filepath = (
      await getAttachmentsFolderAndFilePath(this.app, this.file.path, fname)
    ).filepath;

    const arrayBuffer = await getBinaryFileFromDataURL(dataURL);
    if(!arrayBuffer) return null;

    const file = await this.app.vault.createBinary(
      filepath,
      arrayBuffer,
    );

    const embeddedFile = new EmbeddedFile(
      this.plugin,
      this.file.path,
      filepath,
    );
    
    embeddedFile.setImage(
      dataURL,
      mimeType,
      { height: 0, width: 0 },
      scene.appState?.theme === "dark",
      mimeType === "image/svg+xml", //this treat all SVGs as if they had embedded images REF:addIMAGE
    );
    this.setFile(key as FileId, embeddedFile);
    return file;
  }

  /**
   * deletes fileIds from Excalidraw data for files no longer in the scene
   * @returns
   */
  private async syncFiles(): Promise<boolean> {
    let dirty = false;
    const scene = this.scene as SceneDataWithFiles;

    //remove files and equations that no longer have a corresponding image element
    const fileIds = (
      scene.elements.filter(
        (e) => e.type === "image",
      ) as ExcalidrawImageElement[]
    ).map((e) => e.fileId);
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
    fileIds.forEach(fileId=>{
      if(processedIds.has(fileId)) {
        const file = this.getFile(fileId);
        const equation = this.getEquation(fileId);
        const mermaid = this.getMermaid(fileId);

        //images should have a single reference, but equations, and markdown embeds should have as many as instances of the file in the scene
        if(file && (file.isHyperLink || file.isLocalLink || (file.file && (file.file.extension !== "md" || this.plugin.isExcalidrawFile(file.file))))) {
          return;
        }
        if(mermaid) {
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
        if(file) {
          this.setFile(newId as FileId,new EmbeddedFile(this.plugin,this.file.path,file.linkParts.original));
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
          key as FileId
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
  public getParsedText(id: string): [parseResultWrapped: string, parseResultOriginal: string, link: string] {
    const t = this.textElements.get(id);
    if (!t) {
      return [null, null, null];
    }
    return [wrap(t.parsed, t.wrapAt), t.parsed, null];
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
   * @returns [parseResultWrapped: string, parseResultOriginal: string, link: string]
   */
  public setTextElement(
    elementID: string,
    rawText: string,
    rawOriginalText: string,
    updateSceneCallback: Function,
  ): [parseResultWrapped: string, parseResultOriginal: string, link: string] {
    const maxLineLen = estimateMaxLineLen(rawText, rawOriginalText);
    const [parseResult, link] = this.quickParse(rawOriginalText); //will return the parsed result if raw text does not include transclusion
    if (parseResult) {
      //No transclusion
      this.textElements.set(elementID, {
        raw: rawOriginalText,
        parsed: parseResult,
        wrapAt: maxLineLen,
      });
      return [wrap(parseResult, maxLineLen), parseResult, link];
    }
    //transclusion needs to be resolved asynchornously
    this.parse(rawOriginalText).then((parseRes) => {
      const parsedText = parseRes.parsed;
      this.textElements.set(elementID, {
        raw: rawOriginalText,
        parsed: parsedText,
        wrapAt: maxLineLen,
      });
      if (parsedText) {
        updateSceneCallback(wrap(parsedText, maxLineLen), parsedText);
      }
    });
    return [null, null, null];
  }

  public async addTextElement(
    elementID: string,
    rawText: string,
    rawOriginalText: string,
  ): Promise<[string, string, string]> {
    let wrapAt: number = estimateMaxLineLen(rawText, rawOriginalText);
    if (this.textElements.has(elementID)) {
      wrapAt = this.textElements.get(elementID).wrapAt;
    }
    const parseResult = await this.parse(rawOriginalText);
    this.textElements.set(elementID, {
      raw: rawOriginalText,
      parsed: parseResult.parsed,
      wrapAt,
    });
    return [
      wrap(parseResult.parsed, wrapAt),
      parseResult.parsed,
      parseResult.link,
    ];
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
      fileCache.frontmatter[FRONTMATTER_KEY_DEFAULT_MODE] != null
    ) {
      mode = fileCache.frontmatter[FRONTMATTER_KEY_DEFAULT_MODE];
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
      fileCache.frontmatter[FRONTMATTER_KEY_LINKBUTTON_OPACITY] != null
    ) {
      opacity = fileCache.frontmatter[FRONTMATTER_KEY_LINKBUTTON_OPACITY];
    }
    return opacity; 
  }

  public getOnLoadScript(): string {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_ONLOAD_SCRIPT] != null
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEY_ONLOAD_SCRIPT];
    }
    return null; 
  }

  private setLinkPrefix(): boolean {
    const linkPrefix = this.linkPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX] != null
    ) {
      this.linkPrefix = fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX];
    } else {
      this.linkPrefix = this.plugin.settings.linkPrefix;
    }
    return linkPrefix != this.linkPrefix;
  }

  private setUrlPrefix(): boolean {
    const urlPrefix = this.urlPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_URL_PREFIX] != null
    ) {
      this.urlPrefix = fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_URL_PREFIX];
    } else {
      this.urlPrefix = this.plugin.settings.urlPrefix;
    }
    return urlPrefix != this.urlPrefix;
  }

  private setAutoexportPreferences() {
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_AUTOEXPORT] != null
    ) {
      switch ((fileCache.frontmatter[FRONTMATTER_KEY_AUTOEXPORT]).toLowerCase()) {
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
      fileCache.frontmatter[FRONTMATTER_KEY_EMBEDDABLE_THEME] != null
    ) {
      this.embeddableTheme = fileCache.frontmatter[FRONTMATTER_KEY_EMBEDDABLE_THEME].toLowerCase();
      if (!EMBEDDABLE_THEME_FRONTMATTER_VALUES.includes(this.embeddableTheme)) {
        this.embeddableTheme = "default";
      }
    } else {
      this.embeddableTheme = this.plugin.settings.iframeMatchExcalidrawTheme ? "auto" : "default";
    }
    return embeddableTheme != this.embeddableTheme;
  }

  private setShowLinkBrackets(): boolean {
    const showLinkBrackets = this.showLinkBrackets;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS] != null
    ) {
      this.showLinkBrackets =
        fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS] != false;
    } else {
      this.showLinkBrackets = this.plugin.settings.showLinkBrackets;
    }
    return showLinkBrackets != this.showLinkBrackets;
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
        hasSVGwithBitmap: data.isSVGwithBitmap
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
        : masterFile.path
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
    return this.equations.entries();
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
  ).blocks.filter((block: any) => block.node.type != "comment");
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
