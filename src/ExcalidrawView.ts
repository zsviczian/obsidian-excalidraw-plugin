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
import { ExcalidrawElement,ExcalidrawImageElement,ExcalidrawTextElement, FileId } from "@zsviczian/excalidraw/types/element/types";
import { 
  AppState,
  BinaryFileData,
  LibraryItems 
} from "@zsviczian/excalidraw/types/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  EXCALIDRAW_LIB_HEADER,
  DISK_ICON_NAME,
  PNG_ICON_NAME,
  SVG_ICON_NAME,
  FRONTMATTER_KEY,
  TEXT_DISPLAY_RAW_ICON_NAME,
  TEXT_DISPLAY_PARSED_ICON_NAME,
  FULLSCREEN_ICON_NAME,
  JSON_parse,
  IMAGE_TYPES
} from './constants';
import ExcalidrawPlugin from './main';
import {ExcalidrawAutomate, repositionElementsToCursor} from './ExcalidrawAutomate';
import { t } from "./lang/helpers";
import { ExcalidrawData, REG_LINKINDEX_HYPERLINK, REGEX_LINK } from "./ExcalidrawData";
import { checkAndCreateFolder, download, embedFontsInSVG, generateSVGString, getNewOrAdjacentLeaf, getNewUniqueFilepath, getPNG, getSVG, loadSceneFiles, rotatedDimensions, scaleLoadedImage, splitFolderAndFilename, svgToBase64, updateEquation, viewportCoordsToSceneCoords } from "./Utils";
import { Prompt } from "./Prompt";
import { ClipboardData } from "@zsviczian/excalidraw/types/clipboard";

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

export const addFiles = (files:any, view: ExcalidrawView) => {
  if(files.length === 0) return;
  const [dirty, scene] = scaleLoadedImage(view.getScene(),files); 

  if(dirty) {
    view.excalidrawAPI.updateScene({
      elements: scene.elements,
      appState: scene.appState,
      commitToHistory: false,
    });
  }

  view.excalidrawAPI.addFiles(files);
}


export default class ExcalidrawView extends TextFileView {
  private excalidrawData: ExcalidrawData;
  public getScene: Function = null;
  public addElements: Function = null; //add elements to the active Excalidraw drawing
  private getSelectedTextElement: Function = null;
  private getSelectedImageElement: Function = null;
  public addText:Function = null;
  private refresh: Function = null;
  public excalidrawRef: React.MutableRefObject<any> = null;
  public excalidrawAPI: any = null;
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
    if(file && file instanceof TFile) this.app.vault.modify(file,JSON.stringify(scene,null,"\t"));
    else this.app.vault.create(filepath,JSON.stringify(scene,null,"\t"));
  }

  public saveSVG(scene?: any) {
    if(!scene) {
      if (!this.getScene) return false;
      scene = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    (async () => {
      const exportSettings: ExportSettings = {
        withBackground: this.plugin.settings.exportWithBackground, 
        withTheme: this.plugin.settings.exportWithTheme
      }
      const svg = await getSVG(scene,exportSettings);
      if(!svg) return;
      let serializer =new XMLSerializer();
      const svgString = serializer.serializeToString(embedFontsInSVG(svg));                  
      if(file && file instanceof TFile) await this.app.vault.modify(file,svgString);
      else await this.app.vault.create(filepath,svgString);
    })();
  }

  public savePNG(scene?: any) {
    if(!scene) {
      if (!this.getScene) return false;
      scene = this.getScene();
    }

    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

    (async () => {
      const exportSettings: ExportSettings = {
        withBackground: this.plugin.settings.exportWithBackground, 
        withTheme: this.plugin.settings.exportWithTheme
      }
      const png = await getPNG(scene,exportSettings,this.plugin.settings.pngExportScale);
      if(!png) return;
      if(file && file instanceof TFile) await this.app.vault.modifyBinary(file,await png.arrayBuffer());
      else await this.app.vault.createBinary(filepath,await png.arrayBuffer());      
    })();
  }

  async save(preventReload:boolean=true) {
    if(!this.getScene) return;
    this.preventReload = preventReload;
    this.dirty = null;
    const scene = this.getScene();

    if(this.compatibilityMode) {
      await this.excalidrawData.syncElements(scene);
    } else {
      if(await this.excalidrawData.syncElements(scene) && !this.autosaving) {
        await this.loadDrawing(false);
      }
      //generate SVG preview snapshot
      this.excalidrawData.svgSnapshot = await generateSVGString(this.getScene(),this.plugin.settings);
    }
    await super.save();
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData () {
    //console.log("ExcalidrawView.getViewData()");
    if(!this.getScene) return this.data;
    if(!this.excalidrawData.loaded) return this.data;
    const scene = this.getScene();
    if(!this.compatibilityMode) {
      let trimLocation = this.data.search(/(^%%\n)?# Text Elements\n/m);
      if(trimLocation == -1) trimLocation = this.data.search(/(%%\n)?# Drawing\n/);
      if(trimLocation == -1) return this.data;

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
      if(!this.autosaving) {
        if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
        if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      }
      return JSON.stringify(scene,null,"\t");
    }
    return this.data;
  }
  
  async handleLinkClick(view: ExcalidrawView, ev:MouseEvent) {
    const selectedText = this.getSelectedTextElement();
    let file = null;
    let lineNum = 0;
    let linkText:string = null;

    if(selectedText?.id) {
      linkText = (this.textMode == TextMode.parsed) 
                ? this.excalidrawData.getRawText(selectedText.id) 
                : selectedText.text;

      linkText = linkText.replaceAll("\n",""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
      if(linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText,"_blank");
        return;    
      }

      const parts = REGEX_LINK.getRes(linkText).next();    
      if(!parts.value) {
        const tags = linkText.matchAll(/#([\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/ug).next();
        if(!tags.value || tags.value.length<2) {
          new Notice(t("TEXT_ELEMENT_EMPTY"),4000); 
          return;
        }
        const search=this.app.workspace.getLeavesOfType("search");
        if(search.length==0) return;
        //@ts-ignore
        search[0].view.setQuery("tag:"+tags.value[1]);
        this.app.workspace.revealLeaf(search[0]);

        if(document.fullscreenElement === this.contentEl) {
          document.exitFullscreen();
          this.zoomToFit();
        }
        return;
      }

      linkText = REGEX_LINK.getLink(parts);

      if(linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText,"_blank");
        return;
      }
      
      if(linkText.search("#")>-1) {
        let t;
        [t,lineNum] = await this.excalidrawData.getTransclusion(linkText);
        linkText = linkText.substring(0,linkText.search("#"));
      }
      if(linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
        new Notice(t("FILENAME_INVALID_CHARS"),4000); 
        return;
      }
      file = view.app.metadataCache.getFirstLinkpathDest(linkText,view.file.path); 
      if (!ev.altKey && !file) {
        new Notice(t("FILE_DOES_NOT_EXIST"), 4000);
        return;
      }
    } else {
      const selectedImage = this.getSelectedImageElement();
      if(selectedImage?.id) {
        if(this.excalidrawData.hasEquation(selectedImage.fileId)) {
          const equation = this.excalidrawData.getEquation(selectedImage.fileId);
          const prompt = new Prompt(this.app, t("ENTER_LATEX"),equation,'');
          prompt.openAndGetValue( async (formula:string)=> {
            if(!formula) return;
            this.excalidrawData.setEquation(selectedImage.fileId,formula);
            await this.save(true);
            await updateEquation(formula,selectedImage.fileId,this,addFiles,this.plugin);
          });
          return;
        }
        await this.save(true); //in case pasted images haven't been saved yet
        if(this.excalidrawData.hasFile(selectedImage.fileId)) {
          linkText = this.excalidrawData.getFile(selectedImage.fileId);
        } 
      }
    }

    if(!linkText) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"),20000); 
      return;
    }


    try {
      const f = view.file;
      if(ev.shiftKey && document.fullscreenElement === this.contentEl) {
        document.exitFullscreen();
        this.zoomToFit();
      }
      const leaf = ev.shiftKey ? getNewOrAdjacentLeaf(this.plugin,view.leaf) : view.leaf;
      view.app.workspace.setActiveLeaf(leaf);
      if(file) {
        leaf.openFile(file,{eState: {line: lineNum-1}}); //if file exists open file and jump to reference
      } else { 
        leaf.view.app.workspace.openLinkText(linkText,view.file.path); 
      }
    } catch (e) {
      new Notice(e,4000);
    }
  }

  onResize() {
    if(!this.plugin.settings.zoomToFitOnResize) return;
    if(!this.excalidrawRef) return;
    this.zoomToFit(false);
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
      this.excalidrawAPI.history.clear(); //to avoid undo replacing links with parsed text
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
    if(this.compatibilityMode) {
      this.dirty = null;
      return;
    }
    if(!this.excalidrawRef) return;
    if(!this.file) return;
    if(file) this.data = await this.app.vault.cachedRead(file);
    if(fullreload) await this.excalidrawData.loadData(this.data, this.file,this.textMode);
    else await this.excalidrawData.setTextMode(this.textMode);
    await this.loadDrawing(false);
    this.dirty = null;
  }

  // clear the view content  
  clear() {
    if(!this.excalidrawRef) return;
    this.excalidrawAPI.resetScene();
    this.excalidrawAPI.history.clear();
  }
  
  async setViewData (data: string, clear: boolean = false) {   
    if(clear) this.clear();
    data = this.data = data.replaceAll("\r\n","\n").replaceAll("\r","\n");
    this.app.workspace.onLayoutReady(async ()=>{
      this.dirty = null;
      this.compatibilityMode = this.file.extension === "excalidraw";
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
        try {
          if(!(await this.excalidrawData.loadData(data, this.file,this.textMode))) return;
        } catch(e) {
          new Notice( "Error loading drawing:\n" 
                     + e.message
                     + ((e.message === "Cannot read property 'index' of undefined") 
                       ? "\n'# Drawing' section is likely missing"
                       : "")
                     + "\nTry manually fixing the file or restoring an earlier version from sync history" ,8000);
          this.setMarkdownView();
          return;
        }
      }
      await this.loadDrawing(true)
    });
  }

  /**
   * 
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded:boolean) {        
    const excalidrawData = this.excalidrawData.scene;
    this.justLoaded = justloaded;
    if(this.excalidrawRef) {
      const viewModeEnabled = this.excalidrawAPI.getAppState().viewModeEnabled;
      const zenModeEnabled = this.excalidrawAPI.getAppState().zenModeEnabled;
      this.excalidrawAPI.updateScene({
        elements: excalidrawData.elements,
        appState: { 
          zenModeEnabled: zenModeEnabled,
          viewModeEnabled: viewModeEnabled,
          ...  excalidrawData.appState, 
        },
        files: excalidrawData.files,
        commitToHistory: true,
      });
      if((this.app.workspace.activeLeaf === this.leaf) && this.excalidrawWrapperRef) {
        this.excalidrawWrapperRef.current.focus();
      }
      loadSceneFiles(
        this.plugin,
        this.excalidrawData,
        this,
        (files:any, view:ExcalidrawView) => addFiles(files,view),
        this.file?.path
      );
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded on excalidrawRef readyPromise
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

  setMarkdownView() {
    this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
    this.plugin.setMarkdownView(this.leaf);
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
              this.setMarkdownView();
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
                  this.app.vault.create(fname,JSON.stringify(this.getScene(),null,"\t"));
                  new Notice("Exported to " + fname,6000);  
                });
                return;
              }
              download('data:text/plain;charset=utf-8',encodeURIComponent(JSON.stringify(this.getScene(),null,"\t")), this.file.basename+'.excalidraw');
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
            if(ev.ctrlKey||ev.metaKey) { 
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground, 
                withTheme: this.plugin.settings.exportWithTheme
              }
              const png = await getPNG(this.getScene(),exportSettings,this.plugin.settings.pngExportScale);
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
            if(ev.ctrlKey||ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground, 
                withTheme: this.plugin.settings.exportWithTheme
              }
              let svg = await getSVG(this.getScene(),exportSettings);
              if(!svg) return null;
              svg = embedFontsInSVG(svg);
              download(null,svgToBase64(svg.outerHTML),this.file.basename+'.svg');
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
      const excalidrawWrapperRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined
      });
      
      //excalidrawRef readypromise based on 
      //https://codesandbox.io/s/eexcalidraw-resolvable-promise-d0qg3?file=/src/App.js:167-760
      const resolvablePromise = () => {
        let resolve;
        let reject;
        const promise = new Promise((_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        //@ts-ignore
        promise.resolve = resolve;
        //@ts-ignore
        promise.reject = reject;
        return promise;
      };
      
      // To memoize value between rerenders
      const excalidrawRef = React.useMemo(
        () => ({
          current: {
            readyPromise: resolvablePromise()
          }
        }),
        []
      );
      
      React.useEffect(() => {
        excalidrawRef.current.readyPromise.then((api) => {
          this.excalidrawAPI = api;
          loadSceneFiles(
            this.plugin,
            this.excalidrawData,
            this,
            (files:any, view:ExcalidrawView)=>addFiles(files,view),
            this.file?.path
          );
        });
      }, [excalidrawRef]);

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
        if(this.excalidrawAPI.getAppState().viewModeEnabled) {
          if(selectedTextElement) {
            const retval = selectedTextElement;
            selectedTextElement = null;
            return retval;
          }
          return {id:null,text:null};
        }
        const selectedElement = this.excalidrawAPI.getSceneElements().filter((el:any)=>el.id==Object.keys(this.excalidrawAPI.getAppState().selectedElementIds)[0]);
        if(selectedElement.length==0) return {id:null,text:null};
        if(selectedElement[0].type == "text") return {id:selectedElement[0].id, text:selectedElement[0].text}; //a text element was selected. Return text
        if(selectedElement[0].groupIds.length == 0) return {id:null,text:null}; //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = this
                            .excalidrawAPI
                            .getSceneElements()
                            .filter((el:any)=>el.groupIds?.includes(group))
                            .filter((el:any)=>el.type=="text"); //filter for text elements of the group
        if(textElement.length==0) return {id:null,text:null}; //the group had no text element member
        return {id:selectedElement[0].id, text:selectedElement[0].text}; //return text element text
      };      

      this.getSelectedImageElement = ():{id: string, fileId:string} => {
        if(!excalidrawRef?.current) return {id:null,fileId:null};
        if(this.excalidrawAPI.getAppState().viewModeEnabled) {
          if(selectedImageElement) {
            const retval = selectedImageElement;
            selectedImageElement = null;
            return retval;
          }
          return {id:null,fileId:null};
        }
        const selectedElement = this.excalidrawAPI.getSceneElements().filter((el:any)=>el.id==Object.keys(this.excalidrawAPI.getAppState().selectedElementIds)[0]);
        if(selectedElement.length===0) return {id:null,fileId:null};
        if(selectedElement[0].type == "image") return {id:selectedElement[0].id, fileId:selectedElement[0].fileId}; //an image element was selected. Return fileId
        if(selectedElement[0].groupIds.length === 0) return {id:null,fileId:null}; //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const imageElement = this
                            .excalidrawAPI
                            .getSceneElements()
                            .filter((el:any)=>el.groupIds?.includes(group))
                            .filter((el:any)=>el.type=="image"); //filter for Image elements of the group
        if(imageElement.length===0) return {id:null,fileId:null}; //the group had no image element member
        return {id:selectedElement[0].id, fileId:selectedElement[0].fileId}; //return image element fileId
      };      

      this.addText = (text:string, fontFamily?:1|2|3) => {
        if(!excalidrawRef?.current) {
          return;
        }       
        const el: ExcalidrawElement[] = this.excalidrawAPI.getSceneElements();
        const st: AppState = this.excalidrawAPI.getAppState();
        const ea = this.plugin.ea;
        ea.reset();
        ea.style.strokeColor = st.currentItemStrokeColor;
        ea.style.opacity = st.currentItemOpacity;
        ea.style.fontFamily = fontFamily ? fontFamily: st.currentItemFontFamily;
        ea.style.fontSize = st.currentItemFontSize;
        ea.style.textAlign = st.currentItemTextAlign;
        const id:string = ea.addText(currentPosition.x, currentPosition.y, text);
        this.addElements(ea.getElements(),false,true);
      }

      this.addElements = async (newElements:ExcalidrawElement[],repositionToCursor:boolean = false, save:boolean=false, images:any):Promise<boolean> => {
        if(!excalidrawRef?.current) return false;    
       
        const textElements = newElements.filter((el)=>el.type=="text");
        for(let i=0;i<textElements.length;i++) {
          //@ts-ignore
          const parseResult = await this.excalidrawData.addTextElement(textElements[i].id,textElements[i].text);
          if(this.textMode==TextMode.parsed) {
            this.excalidrawData.updateTextElement(textElements[i],parseResult);
          }
        };

        const el: ExcalidrawElement[] = this.excalidrawAPI.getSceneElements();
        let st: AppState = this.excalidrawAPI.getAppState();

        if(repositionToCursor) newElements = repositionElementsToCursor(newElements,currentPosition,true);
        this.excalidrawAPI.updateScene({
          elements: el.concat(newElements),
          appState: st,
          commitToHistory: true,
        });
        if(images) {
          let files:BinaryFileData[] = [];
          Object.keys(images).forEach((k)=>{
            files.push({
              mimeType :images[k].mimeType,
              id: images[k].id,
              dataURL: images[k].dataURL,
              created: images[k].created
            });
            if(images[k].file) {
              this.excalidrawData.setFile(images[k].id,images[k].file);
            }
            if(images[k].tex) {
              this.excalidrawData.setEquation(images[k].id,images[k].tex);
            }
          });
          this.excalidrawAPI.addFiles(files);
        }        
        if(save) this.save(); else this.dirty = this.file?.path;
        return true;
      };

      this.getScene = () => {
        if(!excalidrawRef?.current) {
          return null;
        }
        const el: ExcalidrawElement[] = this.excalidrawAPI.getSceneElements();
        const st: AppState = this.excalidrawAPI.getAppState();
        const files = this.excalidrawAPI.getFiles();

        if(files) {
          const imgIds = el.filter((e)=>e.type==="image").map((e:any)=>e.fileId);
          const toDelete = Object.keys(files).filter((k)=>!imgIds.contains(k));
          toDelete.forEach((k)=>delete files[k]);
        }

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
          },
          files: files,
        };
      };

      this.refresh = () => {
        if(!excalidrawRef?.current) return;
        this.excalidrawAPI.refresh();
      };

      //variables used to handle click events in view mode
      let selectedTextElement:{id:string,text:string} = null;
      let selectedImageElement:{id:string,fileId:string} = null;
      let timestamp = 0;
      let blockOnMouseButtonDown = false;

      const getElementsAtPointer = (pointer:any, elements:ExcalidrawElement[], type:string):ExcalidrawElement[] => {
        return elements.filter((e:ExcalidrawElement)=>{
                 if (e.type !== type) return false;
                 const [x,y,w,h] = rotatedDimensions(e);
                 return x<=pointer.x && x+w>=pointer.x
                        && y<=pointer.y && y+h>=pointer.y;
               });
      }

      const getTextElementAtPointer = (pointer:any) => {
        const elements = getElementsAtPointer(pointer,this.excalidrawAPI.getSceneElements(),'text') as ExcalidrawTextElement[];
        if(elements.length==0) return {id:null, text:null};
        if(elements.length===1) return {id:elements[0].id,text:elements[0].text};
        //if more than 1 text elements are at the location, look for one that has a link
        const elementsWithLinks = elements.filter((e:ExcalidrawTextElement)=> {
          const text:string = (this.textMode == TextMode.parsed) 
                              ? this.excalidrawData.getRawText(e.id) 
                              : e.text;                
          if(!text) return false;
          if(text.match(REG_LINKINDEX_HYPERLINK)) return true;   
          const parts = REGEX_LINK.getRes(text).next();    
          if(!parts.value) return false;
          return true; 
        });
        //if there are no text elements with links, return the first element without a link
        if(elementsWithLinks.length==0) return {id:elements[0].id,text:elements[0].text};
        //if there are still multiple text elements with links on top of each other, return the first
        return {id:elementsWithLinks[0].id,text:elementsWithLinks[0].text};
      }

      const getImageElementAtPointer = (pointer:any) => {
        const elements = getElementsAtPointer(pointer,this.excalidrawAPI.getSceneElements(),'image') as ExcalidrawImageElement[];
        if(elements.length===0) return {id:null, fileId:null};
        if(elements.length>=1) return {id:elements[0].id,fileId:elements[0].fileId};
        //if more than 1 image elements are at the location, return the first
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
        let files = (this.app as any).dragManager.draggable?.files;
        if(files) {
          if(files[0] == this.file) {
            files.shift();
            (this.app as any).dragManager.draggable.title = files.length + " files";
          }
        }
        if (['file', 'files'].includes((this.app as any).dragManager.draggable?.type)) return 'link';
        if ( transfer.types?.includes('text/html') 
             || transfer.types?.includes('text/plain')
             || transfer.types?.includes('Files')
           ) return 'copy';
      }                 

      let viewModeEnabled = false;
      const handleLinkClick = () => {
        selectedTextElement = getTextElementAtPointer(currentPosition);
        if(selectedTextElement && selectedTextElement.id) {
          const event = new MouseEvent("click", {ctrlKey:true, metaKey:true, shiftKey:this.shiftKeyDown, altKey:this.altKeyDown});
          this.handleLinkClick(this,event);
          selectedTextElement = null;
        }      
        selectedImageElement = getImageElementAtPointer(currentPosition);
        if(selectedImageElement && selectedImageElement.id) {
          const event = new MouseEvent("click", {ctrlKey:true, metaKey:true, shiftKey:this.shiftKeyDown, altKey:this.altKeyDown});
          this.handleLinkClick(this,event);
          selectedImageElement = null;
        }    
      }
      
      let mouseEvent:any = null;

      const excalidrawDiv = React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
          ref: excalidrawWrapperRef,
          key: "abc",
          tabIndex: 0,
          onKeyDown: (e:any) => {
            //@ts-ignore  
            if(e.target === excalidrawDiv.ref.current) return; //event should originate from the canvas
            if(document.fullscreenEnabled && document.fullscreenElement == this.contentEl && e.keyCode==27) {
              document.exitFullscreen();
              this.zoomToFit();
            }

            this.ctrlKeyDown  = e.ctrlKey||e.metaKey; 
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown   = e.altKey;
           
            if((e.ctrlKey||e.metaKey) && !e.shiftKey && !e.altKey) { 
              const selectedElement = getTextElementAtPointer(currentPosition);
              if(!selectedElement) return;

              const text:string = (this.textMode == TextMode.parsed) 
              ? this.excalidrawData.getRawText(selectedElement.id) 
              : selectedElement.text;                

              if(!text) return;
              if(text.match(REG_LINKINDEX_HYPERLINK)) return;   

              const parts = REGEX_LINK.getRes(text).next();  
              if(!parts.value) return; 
              let linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];

              if(linktext.match(REG_LINKINDEX_HYPERLINK)) return;

              this.plugin.hover.linkText = linktext; 
              this.plugin.hover.sourcePath = this.file.path;
              hoverPreviewTarget = this.contentEl; //e.target;
              this.app.workspace.trigger('hover-link', {
                event: mouseEvent,
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
            this.ctrlKeyDown  = e.ctrlKey||e.metaKey;
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown   = e.altKey;
          },
          onClick: (e:MouseEvent):any => {
            if(!(e.ctrlKey||e.metaKey)) return;
            if(!(this.plugin.settings.allowCtrlClick)) return;
            if(!(this.getSelectedTextElement().id || this.getSelectedImageElement().id)) return;
            this.handleLinkClick(this,e);
          },
          onMouseMove: (e:MouseEvent) => {
            //@ts-ignore
            mouseEvent = e.nativeEvent;
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
            if(!viewModeEnabled) return;
            
            const buttonDown = !blockOnMouseButtonDown && p.button === "down";
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
            if (p.button === "up") { 
              blockOnMouseButtonDown=false;
            }
          },
          onChange: (et:ExcalidrawElement[],st:AppState) => {
            viewModeEnabled = st.viewModeEnabled;
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
          onPaste: (data: ClipboardData, event: ClipboardEvent | null) => {
            if(data.elements) {
              const self = this;
              setTimeout(()=>self.save(false),300);
            }
            return true;
          },
          onDrop: (event: React.DragEvent<HTMLDivElement>):boolean => {
            const st: AppState = this.excalidrawAPI.getAppState();
            currentPosition = viewportCoordsToSceneCoords({ clientX: event.clientX, clientY: event.clientY },st);
            
            const draggable = (this.app as any).dragManager.draggable;
            const onDropHook = (type:"file"|"text"|"unknown", files:TFile[], text:string):boolean => {
              if (this.plugin.ea.onDropHook) {
                try {
                  return this.plugin.ea.onDropHook({
                    //@ts-ignore
                    ea: this.plugin.ea, //the Excalidraw Automate object
                    event: event, //React.DragEvent<HTMLDivElement>
                    draggable: draggable, //Obsidian draggable object
                    type: type, //"file"|"text"
                    payload: {
                      files: files, //TFile[] array of dropped files
                      text: text, //string 
                    },
                    excalidrawFile: this.file, //the file receiving the drop event
                    view: this, //the excalidraw view receiving the drop
                    pointerPosition: currentPosition //the pointer position on canvas at the time of drop
                  });
                } catch (e) {
                  new Notice("on drop hook error. See console log for details");
                  console.log(e);
                  return false;
                }
              } else {
                return false;
              }

            }

            switch(draggable?.type) {
              case "file":
                if (!onDropHook("file",[draggable.file],null)) {
                  if((event.ctrlKey||event.metaKey) 
                     && (IMAGE_TYPES.contains(draggable.file.extension) 
                        || this.plugin.isExcalidrawFile(draggable.file))) {
                    const f = draggable.file;
                    const topX = currentPosition.x;
                    const topY = currentPosition.y;
                    const ea = this.plugin.ea;
                    ea.reset();
                    ea.setView(this);
                    (async () => {
                      await ea.addImage(currentPosition.x,currentPosition.y,draggable.file);
                      ea.addElementsToView(false,false);
                    })();
                    return false;
                  }
                  this.addText(`[[${this.app.metadataCache.fileToLinktext(draggable.file,this.file.path,true)}]]`);
                }
                return false;
              case "files":
                if (!onDropHook("file",draggable.files,null)) {
                  for(const f of draggable.files) {
                    this.addText(`[[${this.app.metadataCache.fileToLinktext(f,this.file.path,true)}]]`);
                    currentPosition.y+=st.currentItemFontSize*2;
                  }
                }
                return false;
            }
            if (event.dataTransfer.types.includes("text/plain")) {
              const text:string = event.dataTransfer.getData("text");
              if(!text) return true;
              if (!onDropHook("text",null,text)) {
                if(this.plugin.settings.iframelyAllowed && text.match(/^https?:\/\/\S*$/)) {
                  let linkAdded = false;
                  const self = this;
                  ajaxPromise({
                    url: `http://iframely.server.crestify.com/iframely?url=${text}`
                  }).then((res) => {
                    if(!res || linkAdded) return false;
                    linkAdded = true;
                    const data = JSON.parse(res);
                    if(!data || !(data.meta?.title)) {
                      this.addText(text);
                      return false;
                    }
                    this.addText(`[${data.meta.title}](${text})`);
                    return false;
                  },()=>{
                    if(linkAdded) return false;
                    linkAdded = true;
                    self.addText(text)
                  });
                  setTimeout(()=>{
                    if(linkAdded) return;
                    linkAdded = true;
                    self.addText(text)
                  },600);
                  return false;
                } 
                this.addText(text.replace(/(!\[\[.*#[^\]]*\]\])/g,"$1{40}"));
              }
              return false;
            }
            if(onDropHook("unknown",null,null)) return false;
            return true;
          },
          onBeforeTextEdit: (textElement: ExcalidrawTextElement) => {
            if(this.autosaveTimer) { //stopping autosave to avoid autosave overwriting text while the user edits it
              clearInterval(this.autosaveTimer);
              this.autosaveTimer = null;
            }
            //if(this.textMode==TextMode.parsed) {
              const raw = this.excalidrawData.getRawText(textElement.id);
              if(!raw) return textElement.rawText;
              return raw;
            /*}
            return null;*/
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
            if(text!=textElement.text || !this.excalidrawData.getRawText(textElement.id)) { //the user made changes to the text or the text is missing from Excalidraw Data (recently copy/pasted)
              //setTextElement will attempt a quick parse (without processing transclusions)
              const parseResult = this.excalidrawData.setTextElement(textElement.id, text,async ()=>{
                await this.save(false);
                //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
                //thus I only check if TextMode.parsed, text is always != with parseResult
                if(this.textMode == TextMode.parsed) this.excalidrawAPI.history.clear(); 
                this.setupAutosaveTimer(); 
              });
              if(parseResult) { //there were no transclusions in the raw text, quick parse was successful
                this.setupAutosaveTimer();
                if(this.textMode == TextMode.raw) return; //text is displayed in raw, no need to clear the history, undo will not create problems
                if(text == parseResult) return; //There were no links to parse, raw text and parsed text are equivalent
                this.excalidrawAPI.history.clear();
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

    ReactDOM.render(reactElement,this.contentEl,()=>{
      this.excalidrawWrapperRef.current.focus();
    });  
  }

  public zoomToFit(delay:boolean = true) {
    if(!this.excalidrawRef) return;
    const maxZoom = this.plugin.settings.zoomToFitMaxLevel;
    const current = this.excalidrawAPI;
    const fullscreen = (document.fullscreenElement==this.contentEl);
    const elements = current.getSceneElements();
    if(delay) { //time for the DOM to render, I am sure there is a more elegant solution
      setTimeout(() => current.zoomToFit(elements,maxZoom,fullscreen?0:0.05),100); 
    } else {
      current.zoomToFit(elements,maxZoom,fullscreen?0:0.05);
    }
  }
}