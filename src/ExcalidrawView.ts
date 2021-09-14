import { 
  TextFileView, 
  WorkspaceLeaf, 
  normalizePath,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import Excalidraw, {exportToSvg, getSceneVersion} from "@zsviczian/excalidraw";
import { ExcalidrawElement,ExcalidrawTextElement } from "@zsviczian/excalidraw/types/element/types";
import { 
  AppState,
  LibraryItems 
} from "@zsviczian/excalidraw/types/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  EXCALIDRAW_LIB_HEADER,
  VIRGIL_FONT,
  CASCADIA_FONT,
  DISK_ICON_NAME,
  PNG_ICON_NAME,
  SVG_ICON_NAME,
  FRONTMATTER_KEY,
  TEXT_DISPLAY_RAW_ICON_NAME,
  TEXT_DISPLAY_PARSED_ICON_NAME,
  FULLSCREEN_ICON_NAME,
  JSON_parse
} from './constants';
import ExcalidrawPlugin from './main';
import {estimateBounds, ExcalidrawAutomate, repositionElementsToCursor} from './ExcalidrawAutomate';
import { t } from "./lang/helpers";
import { ExcalidrawData, REG_LINKINDEX_HYPERLINK, REGEX_LINK } from "./ExcalidrawData";
import { checkAndCreateFolder, download, getNewUniqueFilepath, splitFolderAndFilename, viewportCoordsToSceneCoords } from "./Utils";
import { Prompt } from "./Prompt";

declare let window: ExcalidrawAutomate;

export enum TextMode {
  parsed,
  raw
}

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean,
  withTheme: boolean
}

const REG_LINKINDEX_INVALIDCHARS = /[<>:"\\|?*]/g;

export default class ExcalidrawView extends TextFileView {
  private excalidrawData: ExcalidrawData;
  private getScene: Function = null;
  public addElements: Function = null; //add elements to the active Excalidraw drawing
  private getSelectedTextElement: Function = null;
  public addText:Function = null;
  private refresh: Function = null;
  public excalidrawRef: React.MutableRefObject<any> = null;
  private excalidrawWrapperRef: React.MutableRefObject<any> = null;
  private justLoaded: boolean = false;
  private plugin: ExcalidrawPlugin;
  private dirty: string = null;
  public autosaveTimer: any = null;
  public autosaving:boolean = false;
  public textMode:TextMode = TextMode.raw;
  private textIsParsed_Element:HTMLElement;
  private textIsRaw_Element:HTMLElement;
  private preventReload:boolean = true;
  public compatibilityMode: boolean = false;
  //store key state for view mode link resolution
  private ctrlKeyDown = false;
  private shiftKeyDown = false;
  private altKeyDown = false;
  private mouseEvent:any = null;

  id: string = (this.leaf as any).id;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
  }

  public saveExcalidraw(scene?: any){
    if(!scene) {
      if (!this.getScene) return false;
      scene = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.md')) + '.excalidraw';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if(file && file instanceof TFile) this.app.vault.modify(file,JSON.stringify(scene));
    else this.app.vault.create(filepath,JSON.stringify(scene));
  }

  public async saveSVG(scene?: any) {
    if(!scene) {
      if (!this.getScene) return false;
      scene = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const svg = await ExcalidrawView.getSVG(scene,exportSettings);
    if(!svg) return;
    const svgString = ExcalidrawView.embedFontsInSVG(svg).outerHTML;                  
    if(file && file instanceof TFile) await this.app.vault.modify(file,svgString);
    else await this.app.vault.create(filepath,svgString);
  }

  public static embedFontsInSVG(svg:SVGSVGElement):SVGSVGElement {
    //replace font references with base64 fonts
    const includesVirgil = svg.querySelector("text[font-family^='Virgil']") != null;
    const includesCascadia = svg.querySelector("text[font-family^='Cascadia']") != null; 
    const defs = svg.querySelector("defs");
    if (defs && (includesCascadia || includesVirgil)) {
      defs.innerHTML = "<style>" + (includesVirgil ? VIRGIL_FONT : "") + (includesCascadia ? CASCADIA_FONT : "")+"</style>";
    }
    return svg;
  }

  public async savePNG(scene?: any) {
    if(!scene) {
      if (!this.getScene) return false;
      scene = this.getScene();
    }
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const png = await ExcalidrawView.getPNG(scene,exportSettings,this.plugin.settings.pngExportScale);
    if(!png) return;
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if(file && file instanceof TFile) await this.app.vault.modifyBinary(file,await png.arrayBuffer());
    else await this.app.vault.createBinary(filepath,await png.arrayBuffer());    
  }

  async save(preventReload:boolean=true) {
    if(!this.getScene) return;
    this.preventReload = preventReload;
    this.dirty = null;
    
    if(this.compatibilityMode) {
      await this.excalidrawData.syncElements(this.getScene());
    } else {
      if(await this.excalidrawData.syncElements(this.getScene()) && !this.autosaving) {
        await this.loadDrawing(false);
      }
    }
    await super.save();
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData () {
    //console.log("ExcalidrawView.getViewData()");
    if(!this.getScene) return this.data;
    if(!this.compatibilityMode) {
      let trimLocation = this.data.search("# Text Elements\n");
      if(trimLocation == -1) trimLocation = this.data.search("# Drawing\n");
      if(trimLocation == -1) return this.data;

      const scene = this.excalidrawData.scene;
      if(!this.autosaving) {
        if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
        if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
        if(this.plugin.settings.autoexportExcalidraw) this.saveExcalidraw(scene);
      }

      const header = this.data.substring(0,trimLocation)
                              .replace(/excalidraw-plugin:\s.*\n/,FRONTMATTER_KEY+": " + ( (this.textMode == TextMode.raw) ? "raw\n" : "parsed\n"));
      return header + this.excalidrawData.generateMD();
    }
    if(this.compatibilityMode) {
      const scene = this.excalidrawData.scene;
      if(!this.autosaving) {
        if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
        if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      }
      return JSON.stringify(scene);
    }
    return this.data;
  }
  
  handleLinkClick(view: ExcalidrawView, ev:MouseEvent) {
    let text:string = (this.textMode == TextMode.parsed) 
               ? this.excalidrawData.getRawText(this.getSelectedTextElement().id) 
               : this.getSelectedTextElement().text;
    if(!text) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"),20000); 
      return;
    }
    if(text.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(text,"_blank");
      return;    
    }

    const parts = text.matchAll(REGEX_LINK.EXPR).next();    
    if(!parts.value) {
      const tags = text.matchAll(/#([\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/ug).next();
      if(!tags.value || tags.value.length<2) {
        new Notice(t("TEXT_ELEMENT_EMPTY"),4000); 
        return;
      }
      const search=this.app.workspace.getLeavesOfType("search");
      if(search.length==0) return;
      //@ts-ignore
      search[0].view.setQuery("tag:"+tags.value[1]);
      this.app.workspace.revealLeaf(search[0]);
      //if(this.gotoFullscreen.style.display=="none") this.toggleFullscreen();
      document.exitFullscreen();
      this.zoomToFit();
      return;
    }

    text = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];

    if(text.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(text,"_blank");
      return;
    }

    if(text.search("#")>-1) text = text.substring(0,text.search("#"));
    if(text.match(REG_LINKINDEX_INVALIDCHARS)) {
      new Notice(t("FILENAME_INVALID_CHARS"),4000); 
      return;
    }
    if (!ev.altKey) {
      const file = view.app.metadataCache.getFirstLinkpathDest(text,view.file.path); 
      if (!file) {
        new Notice(t("FILE_DOES_NOT_EXIST"), 4000);
        return;
      }
    }
    try {
      const f = view.file;
      if(ev.shiftKey) {
        document.exitFullscreen();
        this.zoomToFit();
      }
      view.app.workspace.openLinkText(text,view.file.path,ev.shiftKey);
    } catch (e) {
      new Notice(e,4000);
    }
  }

  onload() {
    //console.log("ExcalidrawView.onload()");
    this.addAction(DISK_ICON_NAME,t("FORCE_SAVE"),async (ev)=> {
      await this.save(false);
      this.plugin.triggerEmbedUpdates();
    });
    
    this.textIsRaw_Element = this.addAction(TEXT_DISPLAY_RAW_ICON_NAME,t("RAW"), (ev) => this.changeTextMode(TextMode.parsed));
    this.textIsParsed_Element = this.addAction(TEXT_DISPLAY_PARSED_ICON_NAME,t("PARSED"), (ev) => this.changeTextMode(TextMode.raw));
    
    this.addAction("link",t("OPEN_LINK"), (ev)=>this.handleLinkClick(this,ev));

    //@ts-ignore
    if(!this.app.isMobile) {
      this.addAction(FULLSCREEN_ICON_NAME,"Press ESC to exit fullscreen mode",()=>{
        this.contentEl.requestFullscreen();//{navigationUI: "hide"});
        if(this.excalidrawWrapperRef) this.excalidrawWrapperRef.current.focus();
      });
      this.contentEl.onfullscreenchange = () => {
        this.zoomToFit();
      }
    }

    //this is to solve sliding panes bug
    if (this.app.workspace.layoutReady) {
      (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();});
    } else {
      this.app.workspace.onLayoutReady(
       async () => (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();})
      );
    }
    this.setupAutosaveTimer();
  }

  public async changeTextMode(textMode:TextMode,reload:boolean=true) {
    this.textMode = textMode;
    if(textMode == TextMode.parsed) {
      this.textIsRaw_Element.hide(); 
      this.textIsParsed_Element.show();
    } else {
      this.textIsRaw_Element.show(); 
      this.textIsParsed_Element.hide();
    }
    if(reload) {
      await this.save(false);
      this.excalidrawRef.current.history.clear(); //to avoid undo replacing links with parsed text
    }
  }

  public setupAutosaveTimer() {
    const timer = async () => {
      if(this.dirty && (this.dirty == this.file?.path)) {
        this.dirty = null;
        this.autosaving=true;
        if(this.excalidrawRef) await this.save();
        this.autosaving=false;
      }
    }
    if(this.autosaveTimer) clearInterval(this.autosaveTimer); // clear previous timer if one exists
    this.autosaveTimer = setInterval(timer,20000);
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    if(this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  public async reload(fullreload:boolean = false, file?:TFile){
    if(this.preventReload) {
      this.preventReload = false;
      return;
    }
    if(!this.excalidrawRef) return;
    if(!this.file) return;
    if(file) this.data = await this.app.vault.read(file);
    if(fullreload) await this.excalidrawData.loadData(this.data, this.file,this.textMode);
    else await this.excalidrawData.setTextMode(this.textMode);
    await this.loadDrawing(false);
    this.dirty = null;
  }

  // clear the view content  
  clear() {

  }
  
  async setViewData (data: string, clear: boolean = false) {   
    this.app.workspace.onLayoutReady(async ()=>{
      //console.log("ExcalidrawView.setViewData()");
      this.dirty = null;
      this.compatibilityMode = this.file.extension == "excalidraw";
      await this.plugin.loadSettings();
      this.plugin.opencount++;
      if(this.compatibilityMode) {
        this.textIsRaw_Element.hide(); 
        this.textIsParsed_Element.hide();
        await this.excalidrawData.loadLegacyData(data,this.file);
        if (!this.plugin.settings.compatibilityMode) {
          new Notice(t("COMPATIBILITY_MODE"),4000);
        }
      } else {
        const parsed = data.search("excalidraw-plugin: parsed\n")>-1 || data.search("excalidraw-plugin: locked\n")>-1; //locked for backward compatibility
        this.changeTextMode(parsed ? TextMode.parsed : TextMode.raw,false);
        if(!(await this.excalidrawData.loadData(data, this.file,this.textMode))) return;
      }
      if(clear) this.clear();
      await this.loadDrawing(true)
    });
  }

  /**
   * 
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded:boolean) {        
    const excalidrawData = this.excalidrawData.scene;
    if(this.excalidrawRef) {
      const viewModeEnabled = this.excalidrawRef.current.getAppState().viewModeEnabled;
      const zenModeEnabled = this.excalidrawRef.current.getAppState().zenModeEnabled;
      if(justloaded) {        
        this.excalidrawRef.current.resetScene();
        this.excalidrawRef.current.history.clear();
        this.justLoaded = justloaded; //reset screen will clear justLoaded, so need to set it here
      }
      this.excalidrawRef.current.updateScene({
        elements: excalidrawData.elements,
        appState: { 
          zenModeEnabled: zenModeEnabled,
          viewModeEnabled: viewModeEnabled,
          ...  excalidrawData.appState, 
        },
        commitToHistory: true,
      });
      if((this.app.workspace.activeLeaf === this.leaf) && this.excalidrawWrapperRef) {
        this.excalidrawWrapperRef.current.focus();
      }
    } else {
      this.justLoaded = justloaded; 
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        libraryItems: await this.getLibrary(),
      });
    }
  }

  //Compatibility mode with .excalidraw files
  canAcceptExtension(extension: string) {
    return extension == "excalidraw";
  } 

  // gets the title of the document
  getDisplayText() {
    if(this.file) return this.file.basename;
    else return t("NOFILE");
  }

  // the view type name
  getViewType() {
    return VIEW_TYPE_EXCALIDRAW;
  }

  // icon for the view
  getIcon() {
    return ICON_NAME;
  }

  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    if(!this.compatibilityMode) {
      menu
        .addItem((item) => {
          item
            .setTitle(t("OPEN_AS_MD"))
            .setIcon("document")
            .onClick(async () => {
              this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
              this.plugin.setMarkdownView(this.leaf);
            });
        })
        .addItem((item) => {
          item
            .setTitle(t("EXPORT_EXCALIDRAW"))
            .setIcon(ICON_NAME)
            .onClick( async (ev) => {
              if(!this.getScene || !this.file) return;
              //@ts-ignore
              if(this.app.isMobile) {  
                const prompt = new Prompt(this.app, "Please provide filename",this.file.basename,'filename, leave blank to cancel action');
                prompt.openAndGetValue( async (filename:string)=> {
                  if(!filename) return;
                  filename = filename + ".excalidraw";
                  const folderpath = splitFolderAndFilename(this.file.path).folderpath;
                  await checkAndCreateFolder(this.app.vault,folderpath); //create folder if it does not exist         
                  const fname = getNewUniqueFilepath(this.app.vault,filename,folderpath); 
                  this.app.vault.create(fname,JSON.stringify(this.getScene()));
                  new Notice("Exported to " + fname,6000);  
                });
                return;
              }
              download('data:text/plain;charset=utf-8',encodeURIComponent(JSON.stringify(this.getScene())), this.file.basename+'.excalidraw');
            });
        });
    } else {
      menu
        .addItem((item) => {
          item
            .setTitle(t("CONVERT_FILE"))
            .onClick(async () => {
              await this.save();
              this.plugin.openDrawing(await this.plugin.convertSingleExcalidrawToMD(this.file),false);
            });
        });      
    }
    menu
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_PNG"))
          .setIcon(PNG_ICON_NAME)
          .onClick( async (ev)=> {
            if(!this.getScene || !this.file) return;
            if(ev.ctrlKey || ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground, 
                withTheme: this.plugin.settings.exportWithTheme
              }
              const png = await ExcalidrawView.getPNG(this.getScene(),exportSettings,this.plugin.settings.pngExportScale);
              if(!png) return;
              let reader = new FileReader();
              reader.readAsDataURL(png); 
              const self = this;
              reader.onloadend = function() {
                let base64data = reader.result;                
                download(null,base64data,self.file.basename+'.png'); 
              }
              return;
            }
            this.savePNG();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_SVG"))
          .setIcon(SVG_ICON_NAME)
          .onClick(async (ev)=> {
            if(!this.getScene || !this.file) return;
            if(ev.ctrlKey || ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground, 
                withTheme: this.plugin.settings.exportWithTheme
              }
              let svg = await ExcalidrawView.getSVG(this.getScene(),exportSettings);
              if(!svg) return null;
              svg = ExcalidrawView.embedFontsInSVG(svg);
              download("data:image/svg+xml;base64",btoa(unescape(encodeURIComponent(svg.outerHTML))),this.file.basename+'.svg');
              return;
            }
            this.saveSVG()
          });
      })
      .addSeparator();
    super.onMoreOptionsMenu(menu);
  }

  async getLibrary() {
    const data = JSON_parse(this.plugin.getStencilLibrary());
    return data?.library ? data.library : [];
  }

  
  private instantiateExcalidraw(initdata: any) {  
    //console.log("ExcalidrawView.instantiateExcalidraw()");
    this.dirty = null;
    const reactElement = React.createElement(() => {
      let previousSceneVersion = 0;
      let currentPosition = {x:0, y:0};
      const excalidrawRef = React.useRef(null);
      const excalidrawWrapperRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined
      });
      
      this.excalidrawRef = excalidrawRef;
      this.excalidrawWrapperRef = excalidrawWrapperRef;

      React.useEffect(() => {
        setDimensions({
          width: this.contentEl.clientWidth, 
          height: this.contentEl.clientHeight, 
        });
        
        const onResize = () => {
          try {
            setDimensions({
              width: this.contentEl.clientWidth, 
              height: this.contentEl.clientHeight, 
            });
          } catch(err) {console.log ("Excalidraw React-Wrapper, onResize ",err)}
        };
        window.addEventListener("resize", onResize); 
        return () => window.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);


      this.getSelectedTextElement = ():{id: string, text:string} => {
        if(!excalidrawRef?.current) return {id:null,text:null};
        if(this.excalidrawRef.current.getAppState().viewModeEnabled) {
          if(selectedTextElement) {
            const retval = selectedTextElement;
            selectedTextElement == null;
            return retval;
          }
          return {id:null,text:null};
        }
        const selectedElement = excalidrawRef.current.getSceneElements().filter((el:any)=>el.id==Object.keys(excalidrawRef.current.getAppState().selectedElementIds)[0]);
        if(selectedElement.length==0) return {id:null,text:null};
        if(selectedElement[0].type == "text") return {id:selectedElement[0].id, text:selectedElement[0].text}; //a text element was selected. Retrun text
        if(selectedElement[0].groupIds.length == 0) return {id:null,text:null}; //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = excalidrawRef
                            .current
                            .getSceneElements()
                            .filter((el:any)=>el.groupIds?.includes(group))
                            .filter((el:any)=>el.type=="text"); //filter for text elements of the group
        if(textElement.length==0) return {id:null,text:null}; //the group had no text element member
        return {id:selectedElement[0].id, text:selectedElement[0].text}; //return text element text
      };      

      this.addText = (text:string, fontFamily?:1|2|3) => {
        if(!excalidrawRef?.current) {
          return;
        }       
        const el: ExcalidrawElement[] = excalidrawRef.current.getSceneElements();
        const st: AppState = excalidrawRef.current.getAppState();
        window.ExcalidrawAutomate.reset();
        window.ExcalidrawAutomate.style.strokeColor = st.currentItemStrokeColor;
        window.ExcalidrawAutomate.style.opacity = st.currentItemOpacity;
        window.ExcalidrawAutomate.style.fontFamily = fontFamily ? fontFamily: st.currentItemFontFamily;
        window.ExcalidrawAutomate.style.fontSize = st.currentItemFontSize;
        window.ExcalidrawAutomate.style.textAlign = st.currentItemTextAlign;
        const id:string = window.ExcalidrawAutomate.addText(currentPosition.x, currentPosition.y, text);
        this.addElements(window.ExcalidrawAutomate.getElements(),false,true);
      }
      
      this.addElements = async (newElements:ExcalidrawElement[],repositionToCursor:boolean = false, save:boolean=false):Promise<boolean> => {
        if(!excalidrawRef?.current) return false;    
       
        const textElements = newElements.filter((el)=>el.type=="text");
        for(let i=0;i<textElements.length;i++) {
          //@ts-ignore
          const parseResult = await this.excalidrawData.addTextElement(textElements[i].id,textElements[i].text);
          if(this.textMode==TextMode.parsed) {
            this.excalidrawData.updateTextElement(textElements[i],parseResult);
          }
        };

        const el: ExcalidrawElement[] = excalidrawRef.current.getSceneElements();
        const st: AppState = excalidrawRef.current.getAppState();
        if(repositionToCursor) newElements = repositionElementsToCursor(newElements,currentPosition,true);
        this.excalidrawRef.current.updateScene({
          elements: el.concat(newElements),
          appState: st,
          commitToHistory: true,
        });
        if(save) this.save(); else this.dirty = this.file?.path;
        return true;
      };

      this.getScene = () => {
        if(!excalidrawRef?.current) {
          return null;
        }
        const el: ExcalidrawElement[] = excalidrawRef.current.getSceneElements();
        const st: AppState = excalidrawRef.current.getAppState();
        return { 
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: el, 
          appState: {
            theme: st.theme,
            viewBackgroundColor: st.viewBackgroundColor,
            currentItemStrokeColor: st.currentItemStrokeColor,
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemFillStyle: st.currentItemFillStyle,
            currentItemStrokeWidth: st.currentItemStrokeWidth,
            currentItemStrokeStyle: st.currentItemStrokeStyle,
            currentItemRoughness: st.currentItemRoughness,
            currentItemOpacity: st.currentItemOpacity,
            currentItemFontFamily: st.currentItemFontFamily,
            currentItemFontSize: st.currentItemFontSize,
            currentItemTextAlign: st.currentItemTextAlign,
            currentItemStrokeSharpness: st.currentItemStrokeSharpness,
            currentItemStartArrowhead: st.currentItemStartArrowhead,
            currentItemEndArrowhead: st.currentItemEndArrowhead,
            currentItemLinearStrokeSharpness: st.currentItemLinearStrokeSharpness,
            gridSize: st.gridSize,
          }
        };
      };

      this.refresh = () => {
        if(!excalidrawRef?.current) return;
        excalidrawRef.current.refresh();
      };

      //variables used to handle click events in view mode
      let selectedTextElement:{id:string,text:string} = null;
      let timestamp = 0;
      let blockOnMouseButtonDown = false;

      const getTextElementAtPointer = (pointer:any) => {
        const elements = this.excalidrawRef.current.getSceneElements()
                             .filter((e:ExcalidrawElement)=>{
                                return e.type == "text" 
                                       && e.x<=pointer.x && (e.x+e.width)>=pointer.x
                                       && e.y<=pointer.y && (e.y+e.height)>=pointer.y;
                              });
        if(elements.length==0) return null;
        return {id:elements[0].id,text:elements[0].text};
      }
 
      let hoverPoint = {x:0,y:0};
      let hoverPreviewTarget:EventTarget = null;
      const clearHoverPreview = () => {
        if(hoverPreviewTarget) {
          const event = new MouseEvent('click', {
            'view': window,
            'bubbles': true,
            'cancelable': true,
          });
          hoverPreviewTarget.dispatchEvent(event);
          hoverPreviewTarget = null;
        }
      }

      const dropAction = (transfer: DataTransfer) => {
        // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type

        //if (transfer.types.includes('text/uri-list')) return 'link';
        let files = (this.app as any).dragManager.draggable?.files;
        if(files) {
          if(files[0] == this.file) {
            files.shift();
            (this.app as any).dragManager.draggable.title = files.length + " files";
          }
        }
        if (['file', 'files'].includes((this.app as any).dragManager.draggable?.type)) return 'link';
        if (transfer.types?.includes('text/html') || transfer.types?.includes('text/plain')) return 'copy';
      }                 

      const excalidrawDiv = React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
          ref: excalidrawWrapperRef,
          key: "abc",
          tabIndex: 0,
          onKeyDown: (e:any) => {
            if(document.fullscreenEnabled && document.fullscreenElement == this.contentEl && e.keyCode==27) {
              document.exitFullscreen();
              this.zoomToFit();
            }
            this.ctrlKeyDown  = e.ctrlKey;
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown   = e.altKey;

            if(e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
              const selectedElement = getTextElementAtPointer(currentPosition);
              if(!selectedElement) return;

              const text:string = (this.textMode == TextMode.parsed) 
              ? this.excalidrawData.getRawText(selectedElement.id) 
              : selectedElement.text;                

              if(!text) return;
              if(text.match(REG_LINKINDEX_HYPERLINK)) return;   

              const parts = text.matchAll(REGEX_LINK.EXPR).next();    
              if(!parts.value) return; 
              let linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];

              if(linktext.match(REG_LINKINDEX_HYPERLINK)) return;

              this.plugin.hover.linkText = linktext; 
              this.plugin.hover.sourcePath = this.file.path;
              hoverPreviewTarget = this.contentEl; //e.target;
              this.app.workspace.trigger('hover-link', {
                event: this.mouseEvent,
                source: VIEW_TYPE_EXCALIDRAW,
                hoverParent: hoverPreviewTarget,
                targetEl: hoverPreviewTarget,
                linktext: this.plugin.hover.linkText,
                sourcePath: this.plugin.hover.sourcePath
              });
              hoverPoint = currentPosition;
              if(document.fullscreenElement === this.contentEl) {
                const self = this;
                setTimeout(()=>{
                  const popover = document.body.querySelector("div.popover");
                  if(popover) self.contentEl.append(popover);
                },100)
              }
            }
          },
          onKeyUp: (e:any) => {
            this.ctrlKeyDown  = e.ctrlKey;
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown   = e.altKey;
          },
          onClick: (e:MouseEvent):any => {
            //@ts-ignore
            if(!(e.ctrlKey||e.metaKey)) return;
            if(!(this.plugin.settings.allowCtrlClick)) return;
            if(!this.getSelectedTextElement().id) return;
            this.handleLinkClick(this,e);
          },
          onMouseMove: (e:MouseEvent) => {
            //@ts-ignore
            this.mouseEvent = e.nativeEvent;
          },
          onMouseOver: (e:MouseEvent) => {
            clearHoverPreview();
          },
          onDragOver: (e:any) => {
            const action = dropAction(e.dataTransfer);
            if (action) {
              e.dataTransfer.dropEffect = action;
              e.preventDefault();
              return false;
            }
          },
          onDragLeave: () => { },          
        },
        React.createElement(Excalidraw.default, {
          ref: excalidrawRef,
          width: dimensions.width,
          height: dimensions.height,
          UIOptions: {
            canvasActions: {
              loadScene: false,
              saveScene: false,
              saveAsScene: false,
              export: { saveFileToDisk: false },
              saveAsImage: false,
              saveToActiveFile: false,
            },
          },
          initialData: initdata,
          detectScroll: true,
          onPointerUpdate: (p:any) => {
            currentPosition = p.pointer;
            if(hoverPreviewTarget && (Math.abs(hoverPoint.x-p.pointer.x)>50 || Math.abs(hoverPoint.y-p.pointer.y)>50)) clearHoverPreview();
            if(!this.excalidrawRef.current.getAppState().viewModeEnabled) return;
            const handleLinkClick = () => {
              selectedTextElement = getTextElementAtPointer(p.pointer);
              if(selectedTextElement) {
                const event = new MouseEvent("click", {ctrlKey: true, shiftKey: this.shiftKeyDown, altKey:this.altKeyDown});
                this.handleLinkClick(this,event);
                selectedTextElement = null;
              }          
            }

            const buttonDown = !blockOnMouseButtonDown && p.button=="down";
            if(buttonDown) {
              blockOnMouseButtonDown = true;

              //ctrl click
              if(this.ctrlKeyDown) {
                handleLinkClick();
                return;
              }
              
              //dobule click
              const now = (new Date()).getTime();
              if(now-timestamp < 600) {
                handleLinkClick();
              }           
              timestamp = now;
              return;
            }
            if (p.button=="up") { 
              blockOnMouseButtonDown=false;
            }
          },
          onChange: (et:ExcalidrawElement[],st:AppState) => {
            if(this.justLoaded) {
              this.justLoaded = false;             
              this.zoomToFit(false);
              previousSceneVersion = getSceneVersion(et);
              return;
            } 
            if (st.editingElement == null && st.resizingElement == null && 
                st.draggingElement == null && st.editingGroupId == null &&
                st.editingLinearElement == null ) {
              const sceneVersion = getSceneVersion(et);
              if(sceneVersion != previousSceneVersion) {
                previousSceneVersion = sceneVersion;
                this.dirty=this.file?.path;
              }
            }
          },
          onLibraryChange: (items:LibraryItems) => {
            (async () => {
              this.plugin.setStencilLibrary(EXCALIDRAW_LIB_HEADER+JSON.stringify(items)+'}');
              await this.plugin.saveSettings();  
            })();
          },
          /*onPaste: (data: ClipboardData, event: ClipboardEvent | null) => {
            console.log(data,event);
            return true;
          },*/
          onDrop: (event: React.DragEvent<HTMLDivElement>):boolean => {
            const st: AppState = excalidrawRef.current.getAppState();
            currentPosition = viewportCoordsToSceneCoords({ clientX: event.clientX, clientY: event.clientY },st);
            
            const draggable = (this.app as any).dragManager.draggable;
            switch(draggable?.type) {
              case "file":
                this.addText(`[[${this.app.metadataCache.fileToLinktext(draggable.file,this.file.path,true)}]]`);
                return true;
              case "files":
                for(const f of draggable.files) {
                  this.addText(`[[${this.app.metadataCache.fileToLinktext(f,this.file.path,true)}]]`);
                  currentPosition.y+=st.currentItemFontSize*2;
                }
                return true;
            }
            if (event.dataTransfer.types.includes("text/plain")) {
              const text:string = event.dataTransfer.getData("text");
              if(!text) return false;
              this.addText(text.replace(/(!\[\[.*#[^\]]*\]\])/g,"$1{40}"));
              return true;
            }
            return false;
          },
          onBeforeTextEdit: (textElement: ExcalidrawTextElement) => {
            if(this.autosaveTimer) { //stopping autosave to avoid autosave overwriting text while the user edits it
              clearInterval(this.autosaveTimer);
              this.autosaveTimer = null;
            }
            if(this.textMode==TextMode.parsed) return this.excalidrawData.getRawText(textElement.id);
            return null;
          },
          onBeforeTextSubmit: (textElement: ExcalidrawTextElement, text:string, isDeleted:boolean) => {
            if(isDeleted) {
              this.excalidrawData.deleteTextElement(textElement.id);
              this.dirty=this.file?.path;
              this.setupAutosaveTimer();
              return;
            } 
            //If the parsed text is different than the raw text, and if View is in TextMode.parsed
            //Then I need to clear the undo history to avoid overwriting raw text with parsed text and losing links
            if(text!=textElement.text) { //the user made changes to the text
              //setTextElement will attempt a quick parse (without processing transclusions)
              const parseResult = this.excalidrawData.setTextElement(textElement.id, text,async ()=>{
                await this.save(false);
                //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
                //thus I only check if TextMode.parsed, text is always != with parseResult
                if(this.textMode == TextMode.parsed) this.excalidrawRef.current.history.clear(); 
                this.setupAutosaveTimer(); 
              });
              if(parseResult) { //there were no transclusions in the raw text, quick parse was successful
                this.setupAutosaveTimer();
                if(this.textMode == TextMode.raw) return; //text is displayed in raw, no need to clear the history, undo will not create problems
                if(text == parseResult) return; //There were no links to parse, raw text and parsed text are equivalent
                this.excalidrawRef.current.history.clear();
                return parseResult;
              }
              return;
            }
            this.setupAutosaveTimer();
            if(this.textMode==TextMode.parsed) return this.excalidrawData.getParsedText(textElement.id);
          }
        })
      );
      
      return React.createElement(
        React.Fragment,
        null,
        excalidrawDiv
      );

    });
    ReactDOM.render(reactElement,this.contentEl,()=>this.excalidrawWrapperRef.current.focus());  
  }

  public zoomToFit(delay:boolean = true) {
    if(!this.excalidrawRef) return;
    const current = this.excalidrawRef.current;
    const fullscreen = (document.fullscreenElement==this.contentEl);
    const elements = current.getSceneElements();
    if(delay) { //time for the DOM to render, I am sure there is a more elegant solution
      setTimeout(() => current.zoomToFit(elements,10,fullscreen?0:0.05),100);
    } else {
      current.zoomToFit(elements,10,fullscreen?0:0.05);
    }
  }

  public static async getSVG(scene:any, exportSettings:ExportSettings):Promise<SVGSVGElement> {
    try {
      return exportToSvg({
        elements: scene.elements,
        appState: {
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme ? (scene.appState?.theme=="light" ? false : true) : false,
          ... scene.appState,},
        exportPadding:10,
      });
    } catch (error) {
      return null;
    }
  }

  public static async getPNG(scene:any, exportSettings:ExportSettings, scale:number = 1) {
    try {
      return await Excalidraw.exportToBlob({
          elements: scene.elements,
          appState: {
            exportBackground: exportSettings.withBackground,
            exportWithDarkMode: exportSettings.withTheme ? (scene.appState?.theme=="light" ? false : true) : false,
            ... scene.appState,},
          mimeType: "image/png",
          exportWithDarkMode: "true",
          metadata: "Generated by Excalidraw-Obsidian plugin",
          getDimensions: (width:number, height:number) => ({ width:width*scale, height:height*scale, scale:scale })
      });
    } catch (error) {
      return null;
    }
  }
}
