import ExcalidrawPlugin from "src/main";
import {
  FillStyle,
  StrokeStyle,
  ExcalidrawElement,
  ExcalidrawBindableElement,
  FileId,
  NonDeletedExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  StrokeRoundness,
  RoundnessType,
} from "@zsviczian/excalidraw/types/element/types";
import { Editor, normalizePath, Notice, OpenViewState, TFile, WorkspaceLeaf } from "obsidian";
import * as obsidian_module from "obsidian";
import ExcalidrawView, { ExportSettings, TextMode } from "src/ExcalidrawView";
import { ExcalidrawData, getMarkdownDrawingSection, REGEX_LINK } from "src/ExcalidrawData";
import {
  FRONTMATTER,
  nanoid,
  VIEW_TYPE_EXCALIDRAW,
  MAX_IMAGE_SIZE,
  COLOR_NAMES,
  fileid,
  GITHUB_RELEASES,
  determineFocusDistance,
  getCommonBoundingBox,
  getDefaultLineHeight,
  getMaximumGroups,
  intersectElementWithLine,
  measureText,
  DEVICE,
  restore,
  REG_LINKINDEX_INVALIDCHARS,
  THEME_FILTER,
  mermaidToExcalidraw,
} from "src/constants";
import { getDrawingFilename, getNewUniqueFilepath, } from "src/utils/FileUtils";
import {
  //debug,
  embedFontsInSVG,
  errorlog,
  getEmbeddedFilenameParts,
  getImageSize,
  getLinkParts,
  getPNG,
  getSVG,
  isVersionNewerThanOther,
  log,
  scaleLoadedImage,
  wrapTextAtCharLength,
} from "src/utils/Utils";
import { getAttachmentsFolderAndFilePath, getLeaf, getNewOrAdjacentLeaf, isObsidianThemeDark } from "src/utils/ObsidianUtils";
import { AppState, BinaryFileData,  DataURL,  ExcalidrawImperativeAPI, Point } from "@zsviczian/excalidraw/types/types";
import { EmbeddedFile, EmbeddedFilesLoader, FileData } from "src/EmbeddedFileLoader";
import { tex2dataURL } from "src/LaTeX";
import { GenericInputPrompt, NewFileActions, Prompt } from "src/dialogs/Prompt";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "src/Scripts";
import { ConnectionPoint, DeviceType  } from "src/types";
import CM, { ColorMaster, extendPlugins } from "colormaster";
import HarmonyPlugin from "colormaster/plugins/harmony";
import MixPlugin from "colormaster/plugins/mix"
import A11yPlugin from "colormaster/plugins/accessibility"
import NamePlugin from "colormaster/plugins/name"
import LCHPlugin from "colormaster/plugins/lch";
import LUVPlugin from "colormaster/plugins/luv";
import LABPlugin from "colormaster/plugins/lab";
import UVWPlugin from "colormaster/plugins/uvw";
import XYZPlugin from "colormaster/plugins/xyz";
import HWBPlugin from "colormaster/plugins/hwb";
import HSVPlugin from "colormaster/plugins/hsv";
import RYBPlugin from "colormaster/plugins/ryb";
import CMYKPlugin from "colormaster/plugins/cmyk";
import { TInput } from "colormaster/types";
import {ConversionResult, svgToExcalidraw} from "src/svgToExcalidraw/parser"
import { ROUNDNESS } from "src/constants";
import { ClipboardData } from "@zsviczian/excalidraw/types/clipboard";
import { emulateKeysForLinkClick, KeyEvent, PaneTarget } from "src/utils/ModifierkeyHelper";
import { Mutable } from "@zsviczian/excalidraw/types/utility-types";
import PolyBool from "polybooljs";
import { compressToBase64, decompressFromBase64 } from "lz-string";

extendPlugins([
  HarmonyPlugin,
  MixPlugin,
  A11yPlugin,
  NamePlugin,
  LCHPlugin,
  LUVPlugin,
  LABPlugin,
  UVWPlugin,
  XYZPlugin,
  HWBPlugin,
  HSVPlugin,
  RYBPlugin,
  CMYKPlugin
]);

declare const PLUGIN_VERSION:string;

const GAP = 4;

export class ExcalidrawAutomate {
  /**
   * Utility function that returns the Obsidian Module object.
   */
  get obsidian() {
    return obsidian_module;
  };

  get LASERPOINTER() {
    return this.plugin.settings.laserSettings;
  }

  get DEVICE():DeviceType {
    return DEVICE;
  }
  
  public async getAttachmentFilepath(filename: string): Promise<string> {
    if (!this.targetView || !this.targetView?.file) {
      errorMessage("targetView not set", "getAttachmentFolderAndFilePath()");
      return null;
    }
    const folderAndPath = await getAttachmentsFolderAndFilePath(app,this.targetView.file.path, filename);
    return getNewUniqueFilepath(app.vault, filename, folderAndPath.folder);
  }

  public compressToBase64(str:string):string {
    return compressToBase64(str);
  }

  public decompressFromBase64(str:string):string {
    return decompressFromBase64(str);
  }

  /**
   * Prompts the user with a dialog to select new file action.
   * - create markdown file
   * - create excalidraw file
   * - cancel action
   * The new file will be relative to this.targetView.file.path, unless parentFile is provided.
   * If shouldOpenNewFile is true, the new file will be opened in a workspace leaf. 
   * targetPane control which leaf will be used for the new file.
   * Returns the TFile for the new file or null if the user cancelled the action.
   * @param newFileNameOrPath 
   * @param shouldOpenNewFile 
   * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
   * @param parentFile 
   * @returns 
   */
  public async newFilePrompt(
    newFileNameOrPath: string,
    shouldOpenNewFile: boolean,
    targetPane?: PaneTarget,
    parentFile?: TFile,
  ): Promise<TFile | null> {
    if (!this.targetView || !this.targetView?.file) {
      errorMessage("targetView not set", "newFileActions()");
      return null;
    }
    const modifierKeys = emulateKeysForLinkClick(targetPane);
    const newFilePrompt = new NewFileActions({
      plugin: this.plugin,
      path: newFileNameOrPath,
      keys: modifierKeys,
      view: this.targetView,
      openNewFile: shouldOpenNewFile,
      parentFile: parentFile
    })
    newFilePrompt.open();
    return await newFilePrompt.waitForClose;
  }

  /**
   * Generates a new Obsidian Leaf following Excalidraw plugin settings such as open in Main Workspace or not, open in adjacent pane if avaialble, etc.
   * @param origo // the currently active leaf, the origin of the new leaf
   * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
   * @returns 
   */
  public getLeaf (
    origo: WorkspaceLeaf,
    targetPane?: PaneTarget,
  ): WorkspaceLeaf {
    const modifierKeys = emulateKeysForLinkClick(targetPane??"new-tab");
    return getLeaf(this.plugin,origo,modifierKeys);
  }

  /**
   * Returns the editor or leaf.view of the currently active embedded obsidian file.
   * If view is not provided, ea.targetView is used.
   * If the embedded file is a markdown document the function will return
   * {file:TFile, editor:Editor} otherwise it will return {view:any}. You can check view type with view.getViewType();
   * @param view 
   * @returns 
   */
  public getActiveEmbeddableViewOrEditor (view?:ExcalidrawView): {view:any}|{file:TFile, editor:Editor}|null {
    if (!this.targetView && !view) {
      return null;
    }
    view = view ?? this.targetView;
    const leafOrNode = view.getActiveEmbeddable();
    if(leafOrNode) {
      if(leafOrNode.node && leafOrNode.node.isEditing) {
        return {file: leafOrNode.node.file, editor: leafOrNode.node.child.editor};
      }
      if(leafOrNode.leaf && leafOrNode.leaf.view) {
        return {view: leafOrNode.leaf.view};
      }
    }
    return null;
  }

  plugin: ExcalidrawPlugin;
  elementsDict: {[key:string]:any}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {[key: FileId]: any}; //the images files including DataURL, indexed by fileId
  mostRecentMarkdownSVG:SVGSVGElement = null; //Markdown renderer will drop a copy of the most recent SVG here for debugging purposes
  style: {
    strokeColor: string; //https://www.w3schools.com/colors/default.asp
    backgroundColor: string;
    angle: number; //radian
    fillStyle: FillStyle; //type FillStyle = "hachure" | "cross-hatch" | "solid"
    strokeWidth: number;
    strokeStyle: StrokeStyle; //type StrokeStyle = "solid" | "dashed" | "dotted"
    roughness: number;
    opacity: number;
    strokeSharpness?: StrokeRoundness; //defaults to undefined, use strokeRoundess and roundess instead. Only kept for legacy script compatibility type StrokeRoundness = "round" | "sharp"
    roundness: null | { type: RoundnessType; value?: number };
    fontFamily: number; //1: Virgil, 2:Helvetica, 3:Cascadia, 4:LocalFont
    fontSize: number;
    textAlign: string; //"left"|"right"|"center"
    verticalAlign: string; //"top"|"bottom"|"middle" :for future use, has no effect currently
    startArrowHead: string; //"triangle"|"dot"|"arrow"|"bar"|null
    endArrowHead: string;
  };
  canvas: {
    theme: string; //"dark"|"light"
    viewBackgroundColor: string;
    gridSize: number;
  };
  colorPalette: {};

  constructor(plugin: ExcalidrawPlugin, view?: ExcalidrawView) {
    this.plugin = plugin;
    this.reset();
    this.targetView = view;
  }

  /**
   * 
   * @returns the last recorded pointer position on the Excalidraw canvas
   */
  public getViewLastPointerPosition(): {x:number, y:number} {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getExcalidrawAPI()");
      return null;
    }
    return this.targetView.currentPosition;
  }

  /**
   * 
   * @returns 
   */
  public getAPI(view?:ExcalidrawView):ExcalidrawAutomate {
    return new ExcalidrawAutomate(this.plugin, view);
  }

  /**
   * @param val //0:"hachure", 1:"cross-hatch" 2:"solid"
   * @returns 
   */
  setFillStyle(val: number) {
    switch (val) {
      case 0:
        this.style.fillStyle = "hachure";
        return "hachure";
      case 1:
        this.style.fillStyle = "cross-hatch";
        return "cross-hatch";
      default:
        this.style.fillStyle = "solid";
        return "solid";
    }
  };

  /**
   * @param val //0:"solid", 1:"dashed", 2:"dotted"
   * @returns 
   */
  setStrokeStyle(val: number) {
    switch (val) {
      case 0:
        this.style.strokeStyle = "solid";
        return "solid";
      case 1:
        this.style.strokeStyle = "dashed";
        return "dashed";
      default:
        this.style.strokeStyle = "dotted";
        return "dotted";
    }
  };

  /**
   * @param val //0:"round", 1:"sharp"
   * @returns 
   */
  setStrokeSharpness(val: number) {
    switch (val) {
      case 0:
        this.style.roundness = {
          type: ROUNDNESS.LEGACY
        }
        return "round";
      default:
        this.style.roundness = null; //sharp
        return "sharp";
    }
  };

  /**
   * @param val //1: Virgil, 2:Helvetica, 3:Cascadia
   * @returns 
   */
  setFontFamily(val: number) {
    switch (val) {
      case 1:
        this.style.fontFamily = 4;
        return getFontFamily(4);
      case 2:
        this.style.fontFamily = 2;
        return getFontFamily(2);
      case 3:
        this.style.fontFamily = 3;
        return getFontFamily(3);
      default:
        this.style.fontFamily = 1;
        return getFontFamily(1);
    }
  };

  /**
   * @param val //0:"light", 1:"dark"
   * @returns 
   */
  setTheme(val: number) {
    switch (val) {
      case 0:
        this.canvas.theme = "light";
        return "light";
      default:
        this.canvas.theme = "dark";
        return "dark";
    }
  };

  /**
   * @param objectIds 
   * @returns 
   */
  addToGroup(objectIds: string[]): string {
    const id = nanoid();
    objectIds.forEach((objectId) => {
      this.elementsDict[objectId]?.groupIds?.push(id);
    });
    return id;
  };

  /**
   * @param templatePath 
   */
  async toClipboard(templatePath?: string) {
    const template = templatePath
      ? await getTemplate(
          this.plugin,
          templatePath,
          false,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    navigator.clipboard.writeText(
      JSON.stringify({
        type: "excalidraw/clipboard",
        elements,
      }),
    );
  };

  /**
   * @param file: TFile
   * @returns ExcalidrawScene
   */
  async getSceneFromFile(file: TFile): Promise<{elements: ExcalidrawElement[]; appState: AppState;}> {
    if(!file) {
      errorMessage("file not found", "getScene()");
      return null;
    }
    if(!this.isExcalidrawFile(file)) {
      errorMessage("file is not an Excalidraw file", "getScene()");
      return null;
    }
    const template = await getTemplate(this.plugin,file.path,false,new EmbeddedFilesLoader(this.plugin),0);
    return {
      elements: template.elements,
      appState: template.appState
    }
  }

  /**
   * get all elements from ExcalidrawAutomate elementsDict
   * @returns elements from elemenetsDict
   */
  getElements(): Mutable<ExcalidrawElement>[] {
    const elements = [];
    const elementIds = Object.keys(this.elementsDict);
    for (let i = 0; i < elementIds.length; i++) {
      elements.push(this.elementsDict[elementIds[i]]);
    }
    return elements;
  };
  
  /**
   * get single element from ExcalidrawAutomate elementsDict
   * @param id 
   * @returns 
   */
  getElement(id: string): Mutable<ExcalidrawElement> {
    return this.elementsDict[id];
  };

  /**
   * create a drawing and save it to filename
   * @param params 
   *   filename: if null, default filename as defined in Excalidraw settings
   *   foldername: if null, default folder as defined in Excalidraw settings
   * @returns 
   */
  async create(params?: {
    filename?: string;
    foldername?: string;
    templatePath?: string;
    onNewPane?: boolean;
    silent?: boolean;
    frontmatterKeys?: {
      "excalidraw-plugin"?: "raw" | "parsed";
      "excalidraw-link-prefix"?: string;
      "excalidraw-link-brackets"?: boolean;
      "excalidraw-url-prefix"?: string;
      "excalidraw-export-transparent"?: boolean;
      "excalidraw-export-dark"?: boolean;
      "excalidraw-export-padding"?: number;
      "excalidraw-export-pngscale"?: number;
      "excalidraw-default-mode"?: "view" | "zen";
      "excalidraw-onload-script"?: string;
      "excalidraw-linkbutton-opacity"?: number;
      "excalidraw-autoexport"?: boolean;
    };
    plaintext?: string; //text to insert above the `# Text Elements` section
  }): Promise<string> {

    const template = params?.templatePath
      ? await getTemplate(
          this.plugin,
          params.templatePath,
          true,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    let frontmatter: string;
    if (params?.frontmatterKeys) {
      const keys = Object.keys(params.frontmatterKeys);
      if (!keys.includes("excalidraw-plugin")) {
        params.frontmatterKeys["excalidraw-plugin"] = "parsed";
      }
      frontmatter = "---\n\n";
      for (const key of Object.keys(params.frontmatterKeys)) {
        frontmatter += `${key}: ${
          //@ts-ignore
          params.frontmatterKeys[key] === ""
            ? '""'
            : //@ts-ignore
              params.frontmatterKeys[key]
        }\n`;
      }
      frontmatter += "\n---\n";
    } else {
      frontmatter = template?.frontmatter
        ? template.frontmatter
        : FRONTMATTER;
    }

    const scene = {
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements,
      appState: {
        theme: template?.appState?.theme ?? this.canvas.theme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ??
          this.canvas.viewBackgroundColor,
        currentItemStrokeColor:
          template?.appState?.currentItemStrokeColor ??
          this.style.strokeColor,
        currentItemBackgroundColor:
          template?.appState?.currentItemBackgroundColor ??
          this.style.backgroundColor,
        currentItemFillStyle:
          template?.appState?.currentItemFillStyle ?? this.style.fillStyle,
        currentItemStrokeWidth:
          template?.appState?.currentItemStrokeWidth ??
          this.style.strokeWidth,
        currentItemStrokeStyle:
          template?.appState?.currentItemStrokeStyle ??
          this.style.strokeStyle,
        currentItemRoughness:
          template?.appState?.currentItemRoughness ?? this.style.roughness,
        currentItemOpacity:
          template?.appState?.currentItemOpacity ?? this.style.opacity,
        currentItemFontFamily:
          template?.appState?.currentItemFontFamily ?? this.style.fontFamily,
        currentItemFontSize:
          template?.appState?.currentItemFontSize ?? this.style.fontSize,
        currentItemTextAlign:
          template?.appState?.currentItemTextAlign ?? this.style.textAlign,
        currentItemStartArrowhead:
          template?.appState?.currentItemStartArrowhead ??
          this.style.startArrowHead,
        currentItemEndArrowhead:
          template?.appState?.currentItemEndArrowhead ??
          this.style.endArrowHead,
        currentItemRoundness: //type StrokeRoundness = "round" | "sharp"
          template?.appState?.currentItemLinearStrokeSharpness ?? //legacy compatibility
          template?.appState?.currentItemStrokeSharpness ?? //legacy compatibility
          template?.appState?.currentItemRoundness ??
          this.style.roundness ? "round":"sharp",
        gridSize: template?.appState?.gridSize ?? this.canvas.gridSize,
        colorPalette: template?.appState?.colorPalette ?? this.colorPalette,
      },
      files: template?.files ?? {},
    };

    const generateMD = ():string => {
      let outString = params.plaintext ? params.plaintext + "\n\n" : "";
      const textElements = this.getElements().filter(el => el.type === "text") as ExcalidrawTextElement[];
      outString += "# Text Elements\n";
      textElements.forEach(te=> {
        outString += `${te.rawText ?? (te.originalText ?? te.text)} ^${te.id}\n\n`;
      });

      const elementsWithLinks = this.getElements().filter( el => el.type !== "text" && el.link)
      elementsWithLinks.forEach(el=>{
        outString += `${el.link} ^${el.id}\n\n`;
      })
  
      outString += Object.keys(this.imagesDict).length > 0
        ? "\n# Embedded files\n"
        : "";
        
      Object.keys(this.imagesDict).forEach((key: FileId)=> {
        const item = this.imagesDict[key];
        if(item.latex) {
          outString += `${key}: $$${item.latex}$$\n`;  
        } else {
          outString += `${key}: [[${item.file}]]\n`;
        }
      })
      return outString;
    }

    const filename = params?.filename
      ? params.filename + (params.filename.endsWith(".md") ? "": ".excalidraw.md")
      : getDrawingFilename(this.plugin.settings);
    const foldername = params?.foldername ? params.foldername : this.plugin.settings.folder;
    const initData = this.plugin.settings.compatibilityMode
      ? JSON.stringify(scene, null, "\t")
      : frontmatter + generateMD() +
        getMarkdownDrawingSection(JSON.stringify(scene, null, "\t"),this.plugin.settings.compress)

    if(params.silent) {
      return (await this.plugin.createDrawing(filename,foldername,initData)).path;
    } else {
      return this.plugin.createAndOpenDrawing(
        filename,
        (params?.onNewPane ? params.onNewPane : false)?"new-pane":"active-pane",
        foldername,
        initData
      );
    }
  };

  /**
   * 
   * @param templatePath 
   * @param embedFont 
   * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
   * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
   * @param theme 
   * @returns 
   */
  async createSVG(
    templatePath?: string,
    embedFont: boolean = false,
    exportSettings?: ExportSettings, 
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<SVGSVGElement> {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createSVG(
      templatePath,
      embedFont,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0,
      padding,
      this.imagesDict
    );
  };

  /**
   * 
   * @param templatePath 
   * @param scale 
   * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
   * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
   * @param theme 
   * @returns 
   */
  async createPNG(
    templatePath?: string,
    scale: number = 1,
    exportSettings?: ExportSettings,
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<any> {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createPNG(
      templatePath,
      scale,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0,
      padding,
      this.imagesDict,
    );
  };

  /**
   * 
   * @param text 
   * @param lineLen 
   * @returns 
   */
  wrapText(text: string, lineLen: number): string {
    return wrapTextAtCharLength(text, lineLen, this.plugin.settings.forceWrap);
  };

  private boxedElement(
    id: string,
    eltype: any,
    x: number,
    y: number,
    w: number,
    h: number,
    link: string | null = null,
  ) {
    return {
      id,
      type: eltype,
      x,
      y,
      width: w,
      height: h,
      angle: this.style.angle,
      strokeColor: this.style.strokeColor,
      backgroundColor: this.style.backgroundColor,
      fillStyle: this.style.fillStyle,
      strokeWidth: this.style.strokeWidth,
      strokeStyle: this.style.strokeStyle,
      roughness: this.style.roughness,
      opacity: this.style.opacity,
      roundness: this.style.strokeSharpness
        ? (this.style.strokeSharpness === "round"
          ? {type: ROUNDNESS.ADAPTIVE_RADIUS}
          : null)
        : this.style.roundness,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000000),
      updated: Date.now(),
      isDeleted: false,
      groupIds: [] as any,
      boundElements: [] as any,
      link,
      locked: false,
    };
  }

  //retained for backward compatibility
  addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string {
    return this.addEmbeddable(topX, topY, width, height, url, file);
  }
  /**
 * 
 * @param topX 
 * @param topY 
 * @param width 
 * @param height 
 * @returns 
 */
  public addEmbeddable(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addEmbeddable()");
      return null;
    }

    if (!url && !file) {
      errorMessage("Either the url or the file must be set. If both are provided the URL takes precedence", "addEmbeddable()");
      return null;
    }

    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "embeddable",
      topX,
      topY,
      width,
      height,
      url ? url : file ? `[[${
        app.metadataCache.fileToLinktext(
          file,
          this.targetView.file.path,
          false, //file.extension === "md", //changed this to false because embedable link navigation in ExcaliBrain
        )
      }]]` : "",
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addRect(topX: number, topY: number, width: number, height: number): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "rectangle",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addDiamond(
    topX: number,
    topY: number,
    width: number,
    height: number,
  ): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "diamond",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addEllipse(
    topX: number,
    topY: number,
    width: number,
    height: number,
  ): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "ellipse",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addBlob(topX: number, topY: number, width: number, height: number): string {
    const b = height * 0.5; //minor axis of the ellipsis
    const a = width * 0.5; //major axis of the ellipsis
    const sx = a / 9;
    const sy = b * 0.8;
    const step = 6;
    const p: any = [];
    const pushPoint = (i: number, dir: number) => {
      const x = i + Math.random() * sx - sx / 2;
      p.push([
        x + Math.random() * sx - sx / 2 + ((i % 2) * sx) / 6 + topX,
        dir * Math.sqrt(b * b * (1 - (x * x) / (a * a))) +
          Math.random() * sy -
          sy / 2 +
          ((i % 2) * sy) / 6 +
          topY,
      ]);
    };
    let i: number;
    for (i = -a + sx / 2; i <= a - sx / 2; i += a / step) {
      pushPoint(i, 1);
    }
    for (i = a - sx / 2; i >= -a + sx / 2; i -= a / step) {
      pushPoint(i, -1);
    }
    p.push(p[0]);
    const scale = (p: [[x: number, y: number]]): [[x: number, y: number]] => {
      const box = getLineBox(p);
      const scaleX = width / box.w;
      const scaleY = height / box.h;
      let i;
      for (i = 0; i < p.length; i++) {
        let [x, y] = p[i];
        x = (x - box.x) * scaleX + box.x;
        y = (y - box.y) * scaleY + box.y;
        p[i] = [x, y];
      }
      return p;
    };
    const id = this.addLine(scale(p));
    this.elementsDict[id] = repositionElementsToCursor(
      [this.getElement(id)],
      { x: topX, y: topY },
      false,
    )[0];
    return id;
  };

  /**
   * Refresh the size of a text element to fit its contents
   * @param id - the id of the text element
   */
  public refreshTextElementSize(id: string) {
    const element = this.getElement(id);
    if (element.type !== "text") {
      return;
    }
    const { w, h, baseline } = _measureText(
      element.text,
      element.fontSize,
      element.fontFamily,
      getDefaultLineHeight(element.fontFamily)
    );
    // @ts-ignore
    element.width = w; element.height = h; element.baseline = baseline;
  }


  /**
   * 
   * @param topX 
   * @param topY 
   * @param text 
   * @param formatting 
   *   box: if !null, text will be boxed
   * @param id 
   * @returns 
   */
  addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      wrapAt?: number;
      width?: number;
      height?: number;
      textAlign?: "left" | "center" | "right";
      box?: boolean | "box" | "blob" | "ellipse" | "diamond";
      boxPadding?: number;
      boxStrokeColor?: string;
      textVerticalAlign?: "top" | "middle" | "bottom";
    },
    id?: string,
  ): string {
    id = id ?? nanoid();
    const originalText = text;
    text = formatting?.wrapAt ? this.wrapText(text, formatting.wrapAt) : text;
    const { w, h, baseline } = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
      getDefaultLineHeight(this.style.fontFamily)
    );
    const width = formatting?.width ? formatting.width : w;
    const height = formatting?.height ? formatting.height : h;

    let boxId: string = null;
    const boxPadding = formatting?.boxPadding ?? 30;
    const strokeColor = this.style.strokeColor;
    this.style.strokeColor = formatting?.boxStrokeColor ?? strokeColor;
    if (formatting?.box) {
      switch (formatting.box) {
        case "ellipse":
          boxId = this.addEllipse(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "diamond":
          boxId = this.addDiamond(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "blob":
          boxId = this.addBlob(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        default:
          boxId = this.addRect(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
      }
    }
    this.style.strokeColor = strokeColor;
    const isContainerBound = boxId && formatting.box !== "blob";
    this.elementsDict[id] = {
      text,
      fontSize: this.style.fontSize,
      fontFamily: this.style.fontFamily,
      textAlign: formatting?.textAlign
        ? formatting.textAlign
        : this.style.textAlign ?? "left",
      verticalAlign: formatting?.textVerticalAlign ?? this.style.verticalAlign,
      baseline,
      ...this.boxedElement(id, "text", topX, topY, width, height),
      containerId: isContainerBound ? boxId : null,
      originalText: isContainerBound ? originalText : text,
      rawText: isContainerBound ? originalText : text,
      lineHeight: getDefaultLineHeight(this.style.fontFamily),
    };
    if (boxId && formatting?.box === "blob") {
      this.addToGroup([id, boxId]);
    }
    if (isContainerBound) {
      const box = this.elementsDict[boxId];
      if (!box.boundElements) {
        box.boundElements = [];
      }
      box.boundElements.push({ type: "text", id });
    }
    return boxId ?? id;
  };

  /**
   * 
   * @param points 
   * @returns 
   */
  addLine(points: [[x: number, y: number]]): string {
    const box = getLineBox(points);
    const id = nanoid();
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      ...this.boxedElement(id, "line", points[0][0], points[0][1], box.w, box.h),
    };
    return id;
  };

  /**
   * 
   * @param points 
   * @param formatting 
   * @returns 
   */
  addArrow(
    points: [x: number, y: number][],
    formatting?: {
      startArrowHead?: string;
      endArrowHead?: string;
      startObjectId?: string;
      endObjectId?: string;
    },
  ): string {
    const box = getLineBox(points);
    const id = nanoid();
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: {
        elementId: formatting?.startObjectId,
        focus: formatting?.startObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.startObjectId) as ExcalidrawBindableElement,
              endPoint,
              startPoint,
            )
          : 0.1,
        gap: GAP,
      },
      endBinding: {
        elementId: formatting?.endObjectId,
        focus: formatting?.endObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.endObjectId) as ExcalidrawBindableElement,
              startPoint,
              endPoint,
            )
          : 0.1,
        gap: GAP,
      },
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/388
      startArrowhead:
        typeof formatting?.startArrowHead !== "undefined"
          ? formatting.startArrowHead
          : this.style.startArrowHead,
      endArrowhead:
        typeof formatting?.endArrowHead !== "undefined"
          ? formatting.endArrowHead
          : this.style.endArrowHead,
      ...this.boxedElement(id, "arrow", points[0][0], points[0][1], box.w, box.h),
    };
    if (formatting?.startObjectId) {
      if (!this.elementsDict[formatting.startObjectId].boundElements) {
        this.elementsDict[formatting.startObjectId].boundElements = [];
      }
      this.elementsDict[formatting.startObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    if (formatting?.endObjectId) {
      if (!this.elementsDict[formatting.endObjectId].boundElements) {
        this.elementsDict[formatting.endObjectId].boundElements = [];
      }
      this.elementsDict[formatting.endObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    return id;
  };

  /**
   * Adds a mermaid diagram to ExcalidrawAutomate elements
   * @param diagram 
   * @returns the ids of the elements that were created
   */
  async addMermaid(
    diagram: string,
  ): Promise<string[]> {
    const result = await mermaidToExcalidraw(diagram, {fontSize: this.style.fontSize});
    const ids:string[] = [];
    if(!result) return ids;

    if(result?.elements) {
      result.elements.forEach(el=>{
        ids.push(el.id);
        this.elementsDict[el.id] = el;
      })
    }

    if(result?.files) {
      for (const key in result.files) {
        this.imagesDict[key as FileId] = {
          ...result.files[key],
          created: Date.now(),
          isHyperLink: false,
          hyperlink: null,
          file: null,
          hasSVGwithBitmap: false,
          latex: null,
        }
      } 
    }
    return ids;
  }

  /**
   * 
   * @param topX 
   * @param topY 
   * @param imageFile 
   * @returns 
   */
  async addImage(
    topX: number,
    topY: number,
    imageFile: TFile | string,
    scale: boolean = true, //default is true which will scale the image to MAX_IMAGE_SIZE, false will insert image at 100% of its size
    anchor: boolean = true, //only has effect if scale is false. If anchor is true the image path will include |100%, if false the image will be inserted at 100%, but if resized by the user it won't pop back to 100% the next time Excalidraw is opened.
  ): Promise<string> {
    const id = nanoid();
    const loader = new EmbeddedFilesLoader(
      this.plugin,
      this.canvas.theme === "dark",
    );
    const image = (typeof imageFile === "string")
      ? await loader.getObsidianImage(new EmbeddedFile(this.plugin, "", imageFile),0)
      : await loader.getObsidianImage(imageFile,0);
      
    if (!image) {
      return null;
    }
    const fileId = typeof imageFile === "string"
      ? image.fileId
      : imageFile.extension === "md" || imageFile.extension.toLowerCase() === "pdf" ? fileid() as FileId : image.fileId;
    this.imagesDict[fileId] = {
      mimeType: image.mimeType,
      id: fileId,
      dataURL: image.dataURL,
      created: image.created,
      isHyperLink: typeof imageFile === "string",
      hyperlink: typeof imageFile === "string"
        ? imageFile
        : null,
      file: typeof imageFile === "string"
        ? null
        : imageFile.path + (scale || !anchor ? "":"|100%"),
      hasSVGwithBitmap: image.hasSVGwithBitmap,
      latex: null,
    };
    if (scale && (Math.max(image.size.width, image.size.height) > MAX_IMAGE_SIZE)) {
      const scale =
        MAX_IMAGE_SIZE / Math.max(image.size.width, image.size.height);
      image.size.width = scale * image.size.width;
      image.size.height = scale * image.size.height;
    }
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = fileId;
    this.elementsDict[id].scale = [1, 1];
    if(!scale && anchor) {
      this.elementsDict[id].customData = {isAnchored: true}
    };
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param tex 
   * @returns 
   */
  async addLaTex(topX: number, topY: number, tex: string): Promise<string> {
    const id = nanoid();
    const image = await tex2dataURL(tex, this.plugin);
    if (!image) {
      return null;
    }
    this.imagesDict[image.fileId] = {
      mimeType: image.mimeType,
      id: image.fileId,
      dataURL: image.dataURL,
      created: image.created,
      file: null,
      hasSVGwithBitmap: false,
      latex: tex,
    };
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = image.fileId;
    this.elementsDict[id].scale = [1, 1];
    return id;
  };

  /**
   * 
   * @param objectA 
   * @param connectionA type ConnectionPoint = "top" | "bottom" | "left" | "right" | null
   * @param objectB 
   * @param connectionB when passed null, Excalidraw will automatically decide
   * @param formatting 
   *   numberOfPoints: points on the line. Default is 0 ie. line will only have a start and end point
   *   startArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
   *   endArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
   *   padding:
   * @returns 
   */
  connectObjects(
    objectA: string,
    connectionA: ConnectionPoint | null,
    objectB: string,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      endArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      padding?: number;
    },
  ): string {
    if (!(this.elementsDict[objectA] && this.elementsDict[objectB])) {
      return;
    }

    if (
      ["line", "arrow", "freedraw"].includes(
        this.elementsDict[objectA].type,
      ) ||
      ["line", "arrow", "freedraw"].includes(this.elementsDict[objectB].type)
    ) {
      return;
    }

    const padding = formatting?.padding ? formatting.padding : 10;
    const numberOfPoints = formatting?.numberOfPoints
      ? formatting.numberOfPoints
      : 0;
    const getSidePoints = (side: string, el: any) => {
      switch (side) {
        case "bottom":
          return [(el.x + (el.x + el.width)) / 2, el.y + el.height + padding];
        case "left":
          return [el.x - padding, (el.y + (el.y + el.height)) / 2];
        case "right":
          return [el.x + el.width + padding, (el.y + (el.y + el.height)) / 2];
        default:
          //"top"
          return [(el.x + (el.x + el.width)) / 2, el.y - padding];
      }
    };
    let aX;
    let aY;
    let bX;
    let bY;
    const elA = this.elementsDict[objectA];
    const elB = this.elementsDict[objectB];
    if (!connectionA || !connectionB) {
      const aCenterX = elA.x + elA.width / 2;
      const bCenterX = elB.x + elB.width / 2;
      const aCenterY = elA.y + elA.height / 2;
      const bCenterY = elB.y + elB.height / 2;
      if (!connectionA) {
        const intersect = intersectElementWithLine(
          elA,
          [bCenterX, bCenterY],
          [aCenterX, aCenterY],
          GAP,
        );
        if (intersect.length === 0) {
          [aX, aY] = [aCenterX, aCenterY];
        } else {
          [aX, aY] = intersect[0];
        }
      }

      if (!connectionB) {
        const intersect = intersectElementWithLine(
          elB,
          [aCenterX, aCenterY],
          [bCenterX, bCenterY],
          GAP,
        );
        if (intersect.length === 0) {
          [bX, bY] = [bCenterX, bCenterY];
        } else {
          [bX, bY] = intersect[0];
        }
      }
    }
    if (connectionA) {
      [aX, aY] = getSidePoints(connectionA, this.elementsDict[objectA]);
    }
    if (connectionB) {
      [bX, bY] = getSidePoints(connectionB, this.elementsDict[objectB]);
    }
    const numAP = numberOfPoints + 2; //number of break points plus the beginning and the end
    const points:[x:number, y:number][] = [];
    for (let i = 0; i < numAP; i++) {
      points.push([
        aX + (i * (bX - aX)) / (numAP - 1),
        aY + (i * (bY - aY)) / (numAP - 1),
      ]);
    }
    return this.addArrow(points, {
      startArrowHead: formatting?.startArrowHead,
      endArrowHead: formatting?.endArrowHead,
      startObjectId: objectA,
      endObjectId: objectB,
    });
  };

  /**
   * Adds a text label to a line or arrow. Currently only works with a straight (2 point - start & end - line)
   * @param lineId id of the line or arrow object in elementsDict
   * @param label the label text
   * @returns undefined (if unsuccessful) or the id of the new text element
   */
  addLabelToLine(lineId: string, label: string): string {
    const line = this.elementsDict[lineId];
    if(!line || !["arrow","line"].includes(line.type) || line.points.length !== 2) {
      return;
    }

    let angle = Math.atan2(line.points[1][1],line.points[1][0]);

    const size = this.measureText(label);
    //let delta = size.height/6;

    if(angle < 0) {
      if(angle < -Math.PI/2) {
        angle+= Math.PI;
      } /*else {
        delta = -delta;
      } */
    } else {
      if(angle > Math.PI/2) {
        angle-= Math.PI;
        //delta = -delta;
      }
    }
    this.style.angle = angle;
    const id = this.addText(
      line.x+line.points[1][0]/2-size.width/2,//+delta,
      line.y+line.points[1][1]/2-size.height,//-5*size.height/6,
      label
    );
    this.style.angle = 0;
    return id;
  }

  /**
   * clear elementsDict and imagesDict only
   */
  clear() {
    this.elementsDict = {};
    this.imagesDict = {};
  };

  /**
   * clear() + reset all style values to default
   */
  reset() {
    this.clear();
    this.activeScript = null;
    this.style = {
      strokeColor: "#000000",
      backgroundColor: "transparent",
      angle: 0,
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      roundness: null,
      fontFamily: 1,
      fontSize: 20,
      textAlign: "left",
      verticalAlign: "top",
      startArrowHead: null,
      endArrowHead: "arrow"
    };
    this.canvas = {
      theme: "light",
      viewBackgroundColor: "#FFFFFF",
      gridSize: 0
    };
  }; 

  /**
   * returns true if MD file is an Excalidraw file
   * @param f 
   * @returns 
   */
  isExcalidrawFile(f: TFile): boolean {
    return this.plugin.isExcalidrawFile(f);
  };
  targetView: ExcalidrawView = null; //the view currently edited
  /**
   * sets the target view for EA. All the view operations and the access to Excalidraw API will be performend on this view
   * if view is null or undefined, the function will first try setView("active"), then setView("first").
   * @param view 
   * @returns targetView
   */
  setView(view?: ExcalidrawView | "first" | "active"): ExcalidrawView {
    if(!view) {
      const v = app.workspace.getActiveViewOfType(ExcalidrawView);
      if (v instanceof ExcalidrawView) {
        this.targetView = v;
      }
      else {
        const leaves =
          app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        if (!leaves || leaves.length == 0) {
          return;
        }
        this.targetView = leaves[0].view as ExcalidrawView;
      }
    }
    if (view == "active") {
      const v = app.workspace.getActiveViewOfType(ExcalidrawView);
      if (!(v instanceof ExcalidrawView)) {
        return;
      }
      this.targetView = v;
    }
    if (view == "first") {
      const leaves =
        app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      if (!leaves || leaves.length == 0) {
        return;
      }
      this.targetView = leaves[0].view as ExcalidrawView;
    }
    if (view instanceof ExcalidrawView) {
      this.targetView = view;
    }
    return this.targetView;
  };

  /**
   * 
   * @returns https://github.com/excalidraw/excalidraw/tree/master/src/packages/excalidraw#ref
   */
  getExcalidrawAPI(): any {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getExcalidrawAPI()");
      return null;
    }
    return (this.targetView as ExcalidrawView).excalidrawAPI;
  };

  /**
   * get elements in View
   * @returns 
   */
  getViewElements(): ExcalidrawElement[] {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewElements()");
      return [];
    }
    return this.targetView.getViewElements();
  };

  /**
   * 
   * @param elToDelete 
   * @returns 
   */
  deleteViewElements(elToDelete: ExcalidrawElement[]): boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "deleteViewElements()");
      return false;
    }
    const current = this.targetView?.excalidrawRef?.current;
    if (!current) {
      return false;
    }
    const el: ExcalidrawElement[] = current.getSceneElements();
    const st: AppState = current.getAppState();
    this.targetView.updateScene({
      elements: el.filter((e: ExcalidrawElement) => !elToDelete.includes(e)),
      appState: st,
      commitToHistory: true,
    });
    //this.targetView.save();
    return true;
  };

  /**
   * get the selected element in the view, if more are selected, get the first
   * @returns 
   */
  getViewSelectedElement(): any {
    const elements = this.getViewSelectedElements();
    return elements ? elements[0] : null;
  };

  /**
   * 
   * @returns 
   */
  getViewSelectedElements(): any[] {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return [];
    }
    return this.targetView.getViewSelectedElements();
  };

  /**
   * 
   * @param el 
   * @returns TFile file handle for the image element
   */
  getViewFileForImageElement(el: ExcalidrawElement): TFile | null {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewFileForImageElement()");
      return null;
    }
    if (!el || el.type !== "image") {
      errorMessage(
        "Must provide an image element as input",
        "getViewFileForImageElement()",
      );
      return null;
    }
    return (this.targetView as ExcalidrawView)?.excalidrawData?.getFile(
      el.fileId,
    )?.file;
  };

  /**
   * copies elements from view to elementsDict for editing
   * @param elements 
   */
  copyViewElementsToEAforEditing(elements: ExcalidrawElement[]): void {
    elements.forEach((el) => {
      this.elementsDict[el.id] = cloneElement(el);
    });
  };

  /**
   * 
   * @param forceViewMode 
   * @returns 
   */
  viewToggleFullScreen(forceViewMode: boolean = false): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    const view = this.targetView as ExcalidrawView;
    const isFullscreen = view.isFullscreen();
    if (forceViewMode) {
      view.updateScene({
        //elements: ref.getSceneElements(),
        appState: {
          viewModeEnabled: !isFullscreen,
        },
        commitToHistory: false,
      });
      this.targetView.toolsPanelRef?.current?.setExcalidrawViewMode(!isFullscreen);
    }
    
    if (isFullscreen) {
      view.exitFullscreen();
    } else {
      view.gotoFullscreen();
    }
  };

  setViewModeEnabled(enabled: boolean): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    const view = this.targetView as ExcalidrawView;
    view.updateScene({appState:{viewModeEnabled: enabled}});
    view.toolsPanelRef?.current?.setExcalidrawViewMode(enabled);
  }

  /**
   * This function gives you a more hands on access to Excalidraw.
   * @param scene - The scene you want to load to Excalidraw
   * @param restore - Use this if the scene includes legacy excalidraw file elements that need to be converted to the latest excalidraw data format (not a typical usecase)
   * @returns 
   */
  viewUpdateScene (
    scene: {
      elements?: ExcalidrawElement[],
      appState?: AppState,
      files?: BinaryFileData,
      commitToHistory?: boolean,
    },
    restore: boolean = false,
  ):void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    this.targetView.updateScene(scene,restore);
  }

  /**
   * connect an object to the selected element in the view
   * @param objectA ID of the element
   * @param connectionA 
   * @param connectionB 
   * @param formatting 
   * @returns 
   */
  connectObjectWithViewSelectedElement(
    objectA: string,
    connectionA: ConnectionPoint | null,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      endArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      padding?: number;
    },
  ): boolean {
    const el = this.getViewSelectedElement();
    if (!el) {
      return false;
    }
    const id = el.id;
    this.elementsDict[id] = el;
    this.connectObjects(objectA, connectionA, id, connectionB, formatting);
    delete this.elementsDict[id];
    return true;
  };

  /**
   * zoom tarteView to fit elements provided as input
   * elements === [] will zoom to fit the entire scene
   * selectElements toggles whether the elements should be in a selected state at the end of the operation
   * @param selectElements 
   * @param elements 
   */
  viewZoomToElements(
    selectElements: boolean,
    elements: ExcalidrawElement[]
  ):void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    this.targetView.zoomToElements(selectElements,elements);
  }

  /**
   * Adds elements from elementsDict to the current view
   * @param repositionToCursor default is false
   * @param save default is true
   * @param newElementsOnTop controls whether elements created with ExcalidrawAutomate
   *   are added at the bottom of the stack or the top of the stack of elements already in the view
   *   Note that elements copied to the view with copyViewElementsToEAforEditing retain their
   *   position in the stack of elements in the view even if modified using EA
   *   default is false, i.e. the new elements get to the bottom of the stack
   * @param shouldRestoreElements - restore elements - auto-corrects broken, incomplete or old elements included in the update
   * @returns 
   */
  async addElementsToView(
    repositionToCursor: boolean = false,
    save: boolean = true,
    newElementsOnTop: boolean = false,
    shouldRestoreElements: boolean = false,
  ): Promise<boolean> {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    const elements = this.getElements();    
    return await this.targetView.addElements(
      elements,
      repositionToCursor,
      save,
      this.imagesDict,
      newElementsOnTop,
      shouldRestoreElements,
    );
  };

  /**
   * Register instance of EA to use for hooks with TargetView
   * By default ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
   * Using this event you can set a different instance of Excalidraw Automate for hooks
   * @returns true if successful
   */
  registerThisAsViewEA():boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * Sets the targetView EA to window.ExcalidrawAutomate
   * @returns true if successful
   */
  deregisterThisAsViewEA():boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * If set, this callback is triggered when the user closes an Excalidraw view.
   */
  onViewUnloadHook: (view: ExcalidrawView) => void = null;

  /**
   * If set, this callback is triggered, when the user changes the view mode.
   * You can use this callback in case you want to do something additional when the user switches to view mode and back.
   */
  onViewModeChangeHook: (isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void = null;

   /**
   * If set, this callback is triggered, when the user hovers a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
   */
  onLinkHoverHook: (
    element: NonDeletedExcalidrawElement,
    linkText: string,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

   /**
   * If set, this callback is triggered, when the user clicks a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
   */
  onLinkClickHook:(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

  /**
   * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
   * You can use this callback in case you want to do something additional when the onDrop event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
   */
  onDropHook: (data: {
    ea: ExcalidrawAutomate;
    event: React.DragEvent<HTMLDivElement>;
    draggable: any; //Obsidian draggable object
    type: "file" | "text" | "unknown";
    payload: {
      files: TFile[]; //TFile[] array of dropped files
      text: string; //string
    };
    excalidrawFile: TFile; //the file receiving the drop event
    view: ExcalidrawView; //the excalidraw view receiving the drop
    pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
  }) => boolean = null;
 
  /**
   * If set, this callback is triggered, when Excalidraw receives an onPaste event.
   * You can use this callback in case you want to do something additional when the
   * onPaste event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onPaste action you must return false,
   * it will stop the native excalidraw onPaste management flow.
   */
   onPasteHook: (data: {
    ea: ExcalidrawAutomate;
    payload: ClipboardData;
    event: ClipboardEvent;
    excalidrawFile: TFile; //the file receiving the paste event
    view: ExcalidrawView; //the excalidraw view receiving the paste
    pointerPosition: { x: number; y: number }; //the pointer position on canvas
   }) => boolean = null;

  /**
   * if set, this callback is triggered, when an Excalidraw file is opened
   * You can use this callback in case you want to do something additional when the file is opened.
   * This will run before the file level script defined in the `excalidraw-onload-script` frontmatter.
   */
  onFileOpenHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being loaded
    view: ExcalidrawView;
  }) => Promise<void>;


  /**
   * if set, this callback is triggered, when an Excalidraw file is created
   * see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124
   */
  onFileCreateHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being created
    view: ExcalidrawView;
  }) => Promise<void>;
    

  /**
   * If set, this callback is triggered whenever the active canvas color changes
   */
  onCanvasColorChangeHook: (
    ea: ExcalidrawAutomate,
    view: ExcalidrawView, //the excalidraw view 
    color: string,
  ) => void = null;

  /**
   * utility function to generate EmbeddedFilesLoader object
   * @param isDark 
   * @returns 
   */
  getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader {
    return new EmbeddedFilesLoader(this.plugin, isDark);
  };

  /**
   * utility function to generate ExportSettings object
   * @param withBackground 
   * @param withTheme 
   * @returns 
   */
  getExportSettings(
    withBackground: boolean,
    withTheme: boolean,
  ): ExportSettings {
    return { withBackground, withTheme };
  };

  /**
   * get bounding box of elements
   * bounding box is the box encapsulating all of the elements completely
   * @param elements 
   * @returns 
   */
  getBoundingBox(elements: ExcalidrawElement[]): {
    topX: number; 
    topY: number;
    width: number;
    height: number;
  } {
    const bb = getCommonBoundingBox(elements);
    return {
      topX: bb.minX,
      topY: bb.minY,
      width: bb.maxX - bb.minX,
      height: bb.maxY - bb.minY,
    };
  };

  /**
   * elements grouped by the highest level groups
   * @param elements 
   * @returns 
   */
  getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][] {
    return getMaximumGroups(elements);
  };

  /**
   * gets the largest element from a group. useful when a text element is grouped with a box, and you want to connect an arrow to the box
   * @param elements 
   * @returns 
   */
  getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement {
    if (!elements || elements.length === 0) {
      return null;
    }
    let largestElement = elements[0];
    const getSize = (el: ExcalidrawElement): Number => {
      return el.height * el.width;
    };
    let largetstSize = getSize(elements[0]);
    for (let i = 1; i < elements.length; i++) {
      const size = getSize(elements[i]);
      if (size > largetstSize) {
        largetstSize = size;
        largestElement = elements[i];
      }
    }
    return largestElement;
  };

  /**
   * @param element 
   * @param a 
   * @param b 
   * @param gap 
   * @returns 2 or 0 intersection points between line going through `a` and `b`
   *   and the `element`, in ascending order of distance from `a`.
   */
  intersectElementWithLine(
    element: ExcalidrawBindableElement,
    a: readonly [number, number],
    b: readonly [number, number],
    gap?: number,
  ): Point[] {
    return intersectElementWithLine(element, a, b, gap);
  };

  /**
   * Gets the groupId for the group that contains all the elements, or null if such a group does not exist
   * @param elements 
   * @returns null or the groupId
   */
  getCommonGroupForElements(elements: ExcalidrawElement[]): string {
    const groupId = elements.map(el=>el.groupIds).reduce((prev,cur)=>cur.filter(v=>prev.includes(v)));
    return groupId.length > 0 ? groupId[0] : null;
  }

  /**
   * Gets all the elements from elements[] that share one or more groupIds with element.
   * @param element 
   * @param elements - typically all the non-deleted elements in the scene 
   * @returns 
   */
  getElementsInTheSameGroupWithElement(element: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[] {
    if(!element || !elements) return [];
    const container = (element.type === "text" && element.containerId)
      ? elements.filter(el=>el.id === element.containerId)
      : [];
    if(element.groupIds.length === 0) {
      if(container.length === 1) return [element,container[0]];
      return [element];
    }

    if(container.length === 1) {
      return elements.filter(el=>
        el.groupIds.some(id=>element.groupIds.includes(id)) ||
        el === container[0]
      );
    }
    
    return elements.filter(el=>el.groupIds.some(id=>element.groupIds.includes(id)));
  }

  /**
   * Gets all the elements from elements[] that are contained in the frame.
   * @param element 
   * @param elements - typically all the non-deleted elements in the scene 
   * @returns 
   */
  getElementsInFrame(frameElement: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[] {
    if(!frameElement || !elements || frameElement.type !== "frame") return [];
    return elements.filter(el=>el.frameId === frameElement.id);
  } 

  /**
   * See OCR plugin for example on how to use scriptSettings
   * Set by the ScriptEngine
   */
  activeScript: string = null; 

  /**
   * 
   * @returns script settings. Saves settings in plugin settings, under the activeScript key
   */
  getScriptSettings(): {} {
    if (!this.activeScript) {
      return null;
    }
    return this.plugin.settings.scriptEngineSettings[this.activeScript] ?? {};
  };

  /**
   * sets script settings.
   * @param settings 
   * @returns 
   */
  async setScriptSettings(settings: any): Promise<void> {
    if (!this.activeScript) {
      return null;
    }
    this.plugin.settings.scriptEngineSettings[this.activeScript] = settings;
    await this.plugin.saveSettings();
  };

  /**
   * Open a file in a new workspaceleaf or reuse an existing adjacent leaf depending on Excalidraw Plugin Settings
   * @param file
   * @param openState - if not provided {active: true} will be used
   * @returns 
   */
  openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf {
    if (!file || !(file instanceof TFile)) {
      return null;
    }
    if (!this.targetView) {
      return null;
    }
    const leaf = getNewOrAdjacentLeaf(this.plugin, this.targetView.leaf);
    leaf.openFile(file, openState ?? {active: true});
    return leaf;
  };

  /**
   * measure text size based on current style settings
   * @param text 
   * @returns 
   */
  measureText(text: string): { width: number; height: number } {
    const size = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
      getDefaultLineHeight(this.style.fontFamily),
    );
    return { width: size.w ?? 0, height: size.h ?? 0 };
  };

  /**
   * Returns the size of the image element at 100% (i.e. the original size)
   * @param imageElement an image element from the active scene on targetView
   */
  async getOriginalImageSize(imageElement: ExcalidrawImageElement): Promise<{width: number; height: number}> {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getOriginalImageSize()");
      return null;
    }
    if(!imageElement || imageElement.type !== "image") {
      errorMessage("Please provide a single image element as input", "getOriginalImageSize()");
      return null;
    }
    const ef = this.targetView.excalidrawData.getFile(imageElement.fileId);
    if(!ef) {
      errorMessage("Please provide a single image element as input", "getOriginalImageSize()");
      return null;
    }
    const isDark = this.getExcalidrawAPI().getAppState().theme === "dark";
    const dataURL = ef.getImage(isDark);
    return await getImageSize(dataURL);
  }

  /**
   * verifyMinimumPluginVersion returns true if plugin version is >= than required
   * recommended use:
   * if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.20")) {new Notice("message");return;}
   * @param requiredVersion 
   * @returns 
   */
  verifyMinimumPluginVersion(requiredVersion: string): boolean {
    return verifyMinimumPluginVersion(requiredVersion);
  };

  /**
   * Check if view is instance of ExcalidrawView
   * @param view 
   * @returns 
   */
  isExcalidrawView(view: any): boolean {
    return view instanceof ExcalidrawView;
  }

  /**
   * sets selection in view
   * @param elements 
   * @returns 
   */
  selectElementsInView(elements: ExcalidrawElement[] | string[]): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "selectElementsInView()");
      return;
    }
    if (!elements || elements.length === 0) {
      return;
    }
    const API: ExcalidrawImperativeAPI = this.getExcalidrawAPI();
    if(typeof elements[0] === "string") {
      const els = this.getViewElements().filter(el=>(elements as string[]).includes(el.id));
      API.selectElements(els);
    } else {
      API.selectElements(elements as ExcalidrawElement[]);
    }
  };

  /**
   * @returns an 8 character long random id
   */
  generateElementId(): string {
    return nanoid();
  };

  /**
   * @param element 
   * @returns a clone of the element with a new id
   */
  cloneElement(element: ExcalidrawElement): ExcalidrawElement {
    const newEl = JSON.parse(JSON.stringify(element));
    newEl.id = nanoid();
    return newEl;
  };

  /**
   * Moves the element to a specific position in the z-index
   */
  moveViewElementToZIndex(elementId: number, newZIndex: number): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "moveViewElementToZIndex()");
      return;
    }
    const API = this.getExcalidrawAPI();
    const elements = this.getViewElements();
    const elementToMove = elements.filter((el: any) => el.id === elementId);
    if (elementToMove.length === 0) {
      errorMessage(
        `Element (id: ${elementId}) not found`,
        "moveViewElementToZIndex",
      );
      return;
    }
    if (newZIndex >= elements.length) {
      API.bringToFront(elementToMove);
      return;
    }
    if (newZIndex < 0) {
      API.sendToBack(elementToMove);
      return;
    }

    const oldZIndex = elements.indexOf(elementToMove[0]);
    elements.splice(newZIndex, 0, elements.splice(oldZIndex, 1)[0]);
    this.targetView.updateScene({
      elements,
      commitToHistory: true,
    });
  };

  /**
   * Depricated. Use getCM / ColorMaster instead
   * @param color 
   * @returns 
   */
  hexStringToRgb(color: string): number[] {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)];
  };

  /**
   * Depricated. Use getCM / ColorMaster instead
   * @param color 
   * @returns 
   */
  rgbToHexString(color: number[]): string {
    const cm = CM({r:color[0], g:color[1], b:color[2]});
    return cm.stringHEX({alpha: false});
  };

  /**
   * Depricated. Use getCM / ColorMaster instead
   * @param color 
   * @returns 
   */
  hslToRgb(color: number[]): number[] {
    const cm = CM({h:color[0], s:color[1], l:color[2]});
    return [cm.red, cm.green, cm.blue];
  };

  /**
   * Depricated. Use getCM / ColorMaster instead
   * @param color 
   * @returns 
   */
  rgbToHsl(color: number[]): number[] {
    const cm = CM({r:color[0], g:color[1], b:color[2]});
    return [cm.hue, cm.saturation, cm.lightness];
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  colorNameToHex(color: string): string {
    if (COLOR_NAMES.has(color.toLowerCase().trim())) {
      return COLOR_NAMES.get(color.toLowerCase().trim());
    }
    return color.trim();
  };

  /**
   * https://github.com/lbragile/ColorMaster
   * @param color 
   * @returns 
   */
  getCM(color:TInput): ColorMaster {
    if(!color) {
      log("Creates a CM object. Visit https://github.com/lbragile/ColorMaster for documentation.");
      return;
    }
    if(typeof color === "string") {
      color = this.colorNameToHex(color);
    }
    
    return CM(color);
  }

  /**
   * Gets the class PolyBool from https://github.com/velipso/polybooljs
   * @returns 
   */
  getPolyBool() {
    const defaultEpsilon = 0.0000000001;
    PolyBool.epsilon(defaultEpsilon);
    return PolyBool;
  }

  importSVG(svgString:string):boolean {
    const res:ConversionResult =  svgToExcalidraw(svgString);
    if(res.hasErrors) {
      new Notice (`There were errors while parsing the given SVG:\n${[...res.errors].map((el) => el.innerHTML)}`);
      return false;
    }
    this.copyViewElementsToEAforEditing(res.content);
    return true;
  }
};

export async function initExcalidrawAutomate(
  plugin: ExcalidrawPlugin,
): Promise<ExcalidrawAutomate> {
  await initFonts();
  const ea = new ExcalidrawAutomate(plugin);
  //@ts-ignore
  window.ExcalidrawAutomate = ea;
  return ea;
}

export function destroyExcalidrawAutomate() {
  delete window.ExcalidrawAutomate;
}

function normalizeLinePoints(
  points: [x: number, y: number][],
  //box: { x: number; y: number; w: number; h: number },
) {
  const p = [];
  const [x, y] = points[0];
  for (let i = 0; i < points.length; i++) {
    p.push([points[i][0] - x, points[i][1] - y]);
  }
  return p;
}

function getLineBox(points: [x: number, y: number][]) {
  const [x1, y1, x2, y2] = estimateLineBound(points);
  return {
    x: x1,
    y: y1,
    w: x2 - x1, //Math.abs(points[points.length-1][0]-points[0][0]),
    h: y2 - y1, //Math.abs(points[points.length-1][1]-points[0][1])
  };
}

function getFontFamily(id: number) {
  switch (id) {
    case 1:
      return "Virgil, Segoe UI Emoji";
    case 2:
      return "Helvetica, Segoe UI Emoji";
    case 3:
      return "Cascadia, Segoe UI Emoji";
    case 4:
      return "LocalFont";
  }
}

async function initFonts() {
  for (let i = 1; i <= 3; i++) {
    await (document as any).fonts.load(`20px ${getFontFamily(i)}`);
  }
}

export function _measureText(
  newText: string,
  fontSize: number,
  fontFamily: number,
  lineHeight: number,
) {
  //following odd error with mindmap on iPad while synchornizing with desktop.
  if (!fontSize) {
    fontSize = 20;
  }
  if (!fontFamily) {
    fontFamily = 1;
    lineHeight = getDefaultLineHeight(fontFamily);
  }
  const metrics = measureText(
    newText,
    `${fontSize.toString()}px ${getFontFamily(fontFamily)}` as any,
    lineHeight
  );
  return { w: metrics.width, h: metrics.height, baseline: metrics.baseline };
}

async function getTemplate(
  plugin: ExcalidrawPlugin,
  fileWithPath: string,
  loadFiles: boolean = false,
  loader: EmbeddedFilesLoader,
  depth: number,
  convertMarkdownLinksToObsidianURLs: boolean = false,
): Promise<{
  elements: any;
  appState: any;
  frontmatter: string;
  files: any;
  hasSVGwithBitmap: boolean;
}> {
  const app = plugin.app;
  const vault = app.vault;
  const filenameParts = getEmbeddedFilenameParts(fileWithPath);
  const templatePath = normalizePath(filenameParts.filepath);
  const file = app.metadataCache.getFirstLinkpathDest(templatePath, "");
  let hasSVGwithBitmap = false;
  if (file && file instanceof TFile) {
    const data = (await vault.read(file))
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n");
    const excalidrawData: ExcalidrawData = new ExcalidrawData(plugin);

    if (file.extension === "excalidraw") {
      await excalidrawData.loadLegacyData(data, file);
      return {
        elements: convertMarkdownLinksToObsidianURLs
          ? updateElementLinksToObsidianLinks({
            elements: excalidrawData.scene.elements,
            hostFile: file,
          }) : excalidrawData.scene.elements,
        appState: excalidrawData.scene.appState,
        frontmatter: "",
        files: excalidrawData.scene.files,
        hasSVGwithBitmap,
      };
    }

    const parsed =
      data.search("excalidraw-plugin: parsed\n") > -1 ||
      data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
    await excalidrawData.loadData(
      data,
      file,
      parsed ? TextMode.parsed : TextMode.raw,
    );

    let trimLocation = data.search("# Text Elements\n");
    if (trimLocation == -1) {
      trimLocation = data.search("# Drawing\n");
    }

    let scene = excalidrawData.scene;
    if (loadFiles) {
      //debug({where:"getTemplate",template:file.name,loader:loader.uid});
      await loader.loadSceneFiles(excalidrawData, (fileArray: FileData[]) => {
        //, isDark: boolean) => {
        if (!fileArray || fileArray.length === 0) {
          return;
        }
        for (const f of fileArray) {
          if (f.hasSVGwithBitmap) {
            hasSVGwithBitmap = true;
          }
          excalidrawData.scene.files[f.id] = {
            mimeType: f.mimeType,
            id: f.id,
            dataURL: f.dataURL,
            created: f.created,
          };
        }
        scene = scaleLoadedImage(excalidrawData.scene, fileArray).scene;
      }, depth);
    }

    let groupElements:ExcalidrawElement[] = scene.elements;
    if(filenameParts.hasGroupref) {
      const el = filenameParts.hasSectionref
      ? getTextElementsMatchingQuery(scene.elements,["# "+filenameParts.sectionref],true)
      : scene.elements.filter((el: ExcalidrawElement)=>el.id===filenameParts.blockref);
      if(el.length > 0) {
        groupElements = plugin.ea.getElementsInTheSameGroupWithElement(el[0],scene.elements)
      }
    }
    if(filenameParts.hasFrameref) {
      const el = scene.elements.filter((el: ExcalidrawElement)=>el.id===filenameParts.blockref)
      if(el.length === 1) {
        groupElements = plugin.ea.getElementsInFrame(el[0],scene.elements)
      }
    }


    if(filenameParts.hasTaskbone) {
      groupElements = groupElements.filter( el => 
        el.type==="freedraw" || 
        ( el.type==="image" &&
          !plugin.isExcalidrawFile(excalidrawData.getFile(el.fileId)?.file)
        ));
    }

    return {
      elements: convertMarkdownLinksToObsidianURLs
        ? updateElementLinksToObsidianLinks({
          elements: groupElements,
          hostFile: file,
        }) : groupElements,
      appState: scene.appState,
      frontmatter: data.substring(0, trimLocation),
      files: scene.files,
      hasSVGwithBitmap,
    };
  }
  return {
    elements: [],
    appState: {},
    frontmatter: null,
    files: [],
    hasSVGwithBitmap,
  };
}

export const generatePlaceholderDataURL = (width: number, height: number): DataURL => {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#E7E7E7" /><text x="${width / 2}" y="${height / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${Math.min(width, height) / 5}" fill="#888">Placeholder</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}` as DataURL;
};

export async function createPNG(
  templatePath: string = undefined,
  scale: number = 1,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
  forceTheme: string = undefined,
  canvasTheme: string = undefined,
  canvasBackgroundColor: string = undefined,
  automateElements: ExcalidrawElement[] = [],
  plugin: ExcalidrawPlugin,
  depth: number,
  padding?: number,
  imagesDict?: any,
) {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  padding = padding ?? plugin.settings.exportPaddingSVG;
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  const files = imagesDict ?? {};
  if(template?.files) {
    Object.values(template.files).forEach((f:any)=>{
      if(!f.dataURL.startsWith("http")) {
        files[f.id]=f;
      };
    });
  }
  
  return await getPNG(
    {
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements,
      appState: {
        theme: forceTheme ?? template?.appState?.theme ?? canvasTheme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
      },
      files,
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme: exportSettings?.withTheme ?? plugin.settings.exportWithTheme,
    },
    padding,
    scale,
  );
}

const updateElementLinksToObsidianLinks = ({elements, hostFile}:{
  elements: ExcalidrawElement[];
  hostFile: TFile;
}): ExcalidrawElement[] => {
  return elements.map((el)=>{
    if(el.type!=="embeddable" && el.link && el.link.startsWith("[")) {
      const partsArray = REGEX_LINK.getResList(el.link)[0];
      if(!partsArray?.value) return el;
      let linkText = REGEX_LINK.getLink(partsArray);
      if (linkText.search("#") > -1) {
        const linkParts = getLinkParts(linkText, hostFile);
        linkText = linkParts.path;
      }
      if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
        return el;
      }
      const file = app.metadataCache.getFirstLinkpathDest(
        linkText,
        hostFile.path,
      );
      if(!file) {
        return el;
      }
      const link = app.getObsidianUrl(file);
      const newElement: Mutable<ExcalidrawElement> = cloneElement(el);
      newElement.link = link;
      return newElement;
    }
    return el;
  })
}

function addFilterToForeignObjects(svg:SVGSVGElement) {
  const foreignObjects = svg.querySelectorAll("foreignObject");
  foreignObjects.forEach((foreignObject) => {
    foreignObject.setAttribute("filter", THEME_FILTER);
  });
}

export async function createSVG(
  templatePath: string = undefined,
  embedFont: boolean = false,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
  forceTheme: string = undefined,
  canvasTheme: string = undefined,
  canvasBackgroundColor: string = undefined,
  automateElements: ExcalidrawElement[] = [],
  plugin: ExcalidrawPlugin,
  depth: number,
  padding?: number,
  imagesDict?: any,
  convertMarkdownLinksToObsidianURLs: boolean = false,
): Promise<SVGSVGElement> {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth, convertMarkdownLinksToObsidianURLs)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  padding = padding ?? plugin.settings.exportPaddingSVG;
  const files = imagesDict ?? {};
  if(template?.files) {
    Object.values(template.files).forEach((f:any)=>{
      files[f.id]=f;
    });
  }

  const theme = forceTheme ?? template?.appState?.theme ?? canvasTheme;
  const withTheme = exportSettings?.withTheme ?? plugin.settings.exportWithTheme;

  const svg = await getSVG(
    {
      //createAndOpenDrawing
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements,
      appState: {
        theme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
      },
      files,
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme,
    },
    padding,
  );

  if (withTheme && theme === "dark") addFilterToForeignObjects(svg);

  const filenameParts = getEmbeddedFilenameParts(templatePath);
  if(
    !(filenameParts.hasGroupref || filenameParts.hasFrameref) && 
    (filenameParts.hasBlockref || filenameParts.hasSectionref)
  ) {
    let el = filenameParts.hasSectionref
      ? getTextElementsMatchingQuery(elements,["# "+filenameParts.sectionref],true)
      : elements.filter((el: ExcalidrawElement)=>el.id===filenameParts.blockref);
    if(el.length>0) {
      const containerId = el[0].containerId;
      if(containerId) {
        el = el.concat(elements.filter((el: ExcalidrawElement)=>el.id === containerId));
      }
      const elBB = plugin.ea.getBoundingBox(el);
      const drawingBB = plugin.ea.getBoundingBox(elements);
      svg.viewBox.baseVal.x = elBB.topX - drawingBB.topX;
      svg.viewBox.baseVal.y = elBB.topY - drawingBB.topY;
      svg.viewBox.baseVal.width = elBB.width + 2*padding; 
      svg.viewBox.baseVal.height = elBB.height + 2*padding;
    }
  }
  if (template?.hasSVGwithBitmap) {
    svg.setAttribute("hasbitmap", "true");
  }
  return embedFont ? embedFontsInSVG(svg, plugin) : svg;
}

function estimateLineBound(points: any): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

export function estimateBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  const bb = getCommonBoundingBox(elements);
  return [bb.minX, bb.minY, bb.maxX, bb.maxY];
}

export function repositionElementsToCursor(
  elements: ExcalidrawElement[],
  newPosition: { x: number; y: number },
  center: boolean = false,
): ExcalidrawElement[] {
  const [x1, y1, x2, y2] = estimateBounds(elements);
  let [offsetX, offsetY] = [0, 0];
  if (center) {
    [offsetX, offsetY] = [
      newPosition.x - (x1 + x2) / 2,
      newPosition.y - (y1 + y2) / 2,
    ];
  } else {
    [offsetX, offsetY] = [newPosition.x - x1, newPosition.y - y1];
  }

  elements.forEach((element: any) => {
    //using any so I can write read-only propery x & y
    element.x = element.x + offsetX;
    element.y = element.y + offsetY;
  });
  
  return restore({elements}, null, null).elements;
}

function errorMessage(message: string, source: string) {
  switch (message) {
    case "targetView not set":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message:
          "targetView not set, or no longer active. Use setView before calling this function",
      });
      break;
    case "mobile not supported":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: "this function is not avalable on Obsidian Mobile",
      });
      break;
    default:
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: message??"unknown error",
      });
  }
}

export const insertLaTeXToView = (view: ExcalidrawView) => {
  const app = view.plugin.app;
  const ea = view.plugin.ea;
  GenericInputPrompt.Prompt(
    view,
    view.plugin,
    app,
    t("ENTER_LATEX"),
    "\\color{red}\\oint_S {E_n dA = \\frac{1}{{\\varepsilon _0 }}} Q_{inside}",
    view.plugin.settings.latexBoilerplate,
    undefined,
    3
  ).then(async (formula: string) => {
    if (!formula) {
      return;
    }
    ea.reset();
    await ea.addLaTex(0, 0, formula);
    ea.setView(view);
    ea.addElementsToView(true, false, true);
  });
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea.getViewElements().filter((el) => el.type === "text" || el.type === "frame");
  if (elements.length === 0) {
    return;
  }
  let text = await ScriptEngine.inputPrompt(
    view,
    view.plugin,
    view.plugin.app,
    "Search for",
    "use quotation marks for exact match",
    "",
  );
  if (!text) {
    return;
  }
  const res = text.matchAll(/"(.*?)"/g);
  let query: string[] = [];
  let parts;
  while (!(parts = res.next()).done) {
    query.push(parts.value[1]);
  }
  text = text.replaceAll(/"(.*?)"/g, "");
  query = query.concat(text.split(" ").filter((s) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getTextElementsMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: any) =>
    el.type === "text" && 
    query.some((q) => {
      if (exactMatch) {
        const text = el.rawText.toLowerCase().split("\n")[0].trim();
        const m = text.match(/^#*(# .*)/);
        if (!m || m.length !== 2) {
          return false;
        }
        return m[1] === q.toLowerCase();
      }
      const text = el.rawText.toLowerCase().replaceAll("\n", " ").trim();
      return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1" https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
    }));
}

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getFrameElementsMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: any) =>
    el.type === "frame" && 
    query.some((q) => {
      if (exactMatch) {
        const text = el.name.toLowerCase().split("\n")[0].trim();
        const m = text.match(/^#*(# .*)/);
        if (!m || m.length !== 2) {
          return false;
        }
        return m[1] === q.toLowerCase();
      }
      const text = el.name
       ? el.name.toLowerCase().replaceAll("\n", " ").trim()
       : "";

      return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1" https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
    }));
}

export const cloneElement = (el: ExcalidrawElement):any => {
  const newEl = JSON.parse(JSON.stringify(el));
  newEl.version = el.version + 1;
  newEl.updated = Date.now();
  newEl.versionNonce = Math.floor(Math.random() * 1000000000);
  return newEl;
}

export const verifyMinimumPluginVersion = (requiredVersion: string): boolean => {
  return PLUGIN_VERSION === requiredVersion || isVersionNewerThanOther(PLUGIN_VERSION,requiredVersion);
}