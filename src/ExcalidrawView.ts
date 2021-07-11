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
import Excalidraw, {exportToSvg, getSceneVersion, loadLibraryFromBlob} from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { 
  AppState,
  LibraryItems 
} from "@excalidraw/excalidraw/types/types";
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
  UNLOCK_ICON_NAME,
  LOCK_ICON_NAME,
  JSON_parse
} from './constants';
import ExcalidrawPlugin from './main';
import {ExcalidrawAutomate} from './ExcalidrawAutomate';
import { t } from "./lang/helpers";
import { ExcalidrawData, REG_LINK_BACKETS } from "./ExcalidrawData";
import { download } from "./Utils";

declare let window: ExcalidrawAutomate;

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean,
  withTheme: boolean
}

const REG_LINKINDEX_HYPERLINK = /^\w+:\/\//;
const REG_LINKINDEX_INVALIDCHARS = /[<>:"\\|?*]/g;

export default class ExcalidrawView extends TextFileView {
  private excalidrawData: ExcalidrawData;
  private getScene: Function = null;
  private getSelectedText: Function = null;
  private getSelectedId: Function = null;
  public addText:Function = null;
  private refresh: Function = null;
  private excalidrawRef: React.MutableRefObject<any> = null;
  private justLoaded: boolean = false;
  private plugin: ExcalidrawPlugin;
  private dirty: boolean = false;
  public autosaveTimer: any = null;
  public  isTextLocked:boolean = false;
  private lockedElement:HTMLElement;
  private unlockedElement:HTMLElement;
  private preventReload:boolean = true;
  public compatibilityMode: boolean = false;

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
    if(file && file instanceof TFile) this.app.vault.modify(file,JSON.stringify(scene));//data.replaceAll("&#91;","["));
    else this.app.vault.create(filepath,JSON.stringify(scene));//.replaceAll("&#91;","["));
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
    const png = await ExcalidrawView.getPNG(scene,exportSettings);
    if(!png) return;
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if(file && file instanceof TFile) await this.app.vault.modifyBinary(file,await png.arrayBuffer());
    else await this.app.vault.createBinary(filepath,await png.arrayBuffer());    
  }

  async save(preventReload:boolean=true) {
    this.preventReload = preventReload;
    await super.save();
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData () {
    //console.log("ExcalidrawView.getViewData()");
    if(this.getScene && !this.compatibilityMode) {
      
      if(this.excalidrawData.syncElements(this.getScene())) {
        this.loadDrawing(false);
      }  
      let trimLocation = this.data.search("# Text Elements\n");
      if(trimLocation == -1) trimLocation = this.data.search("# Drawing\n");
      if(trimLocation == -1) return this.data;

      const scene = this.excalidrawData.scene;
      if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
      if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      if(this.plugin.settings.autoexportExcalidraw) this.saveExcalidraw(scene);

      const header = this.data.substring(0,trimLocation)
                              .replace(/excalidraw-plugin:\s.*\n/,FRONTMATTER_KEY+": " + (this.isTextLocked ? "locked\n" : "unlocked\n"));
      return header + this.excalidrawData.generateMD();
    }
    if(this.getScene && this.compatibilityMode) {
      this.excalidrawData.syncElements(this.getScene());
      const scene = this.excalidrawData.scene;
      if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
      if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      return JSON.stringify(scene);
    }
    else return this.data;
  }
  
  handleLinkClick(view: ExcalidrawView, ev:MouseEvent) {
    let text:string = this.isTextLocked
               ? this.excalidrawData.getRawText(this.getSelectedId()) 
               : this.getSelectedText();
    if(!text) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"),20000); 
      return;
    }
    if(text.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(text,"_blank");
      return;    }

    //![[link|alias]]![alias](link)
    //1  2    3      4 5      6
    const parts = text.matchAll(REG_LINK_BACKETS).next();    
    if(!parts.value) {
      new Notice(t("TEXT_ELEMENT_EMPTY"),4000); 
      return;
    }

    text = parts.value[2] ? parts.value[2]:parts.value[6];

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
      view.app.workspace.openLinkText(text,view.file.path,ev.shiftKey);
    } catch (e) {
      new Notice(e,4000);
    }
  }

  onload() {
    //console.log("ExcalidrawView.onload()");
    this.addAction(DISK_ICON_NAME,t("FORCE_SAVE"),async (ev)=> {
      await this.save();
      this.plugin.triggerEmbedUpdates();
    });
    
    this.unlockedElement = this.addAction(UNLOCK_ICON_NAME,t("LOCK"), (ev) => this.lock(true));
    this.lockedElement = this.addAction(LOCK_ICON_NAME,t("UNLOCK"), (ev) => this.lock(false));
    
    this.addAction("link",t("OPEN_LINK"), (ev)=>this.handleLinkClick(this,ev));
    
    //this is to solve sliding panes bug
    if (this.app.workspace.layoutReady) {
      (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();});
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();})));
    }
    this.setupAutosaveTimer();
  }

  public async lock(locked:boolean,reload:boolean=true) {
    //console.log("ExcalidrawView.lock(), locked",locked, "reload",reload);
    this.isTextLocked = locked;
    if(locked) {
      this.unlockedElement.hide(); 
      this.lockedElement.show();
    } else {
      this.unlockedElement.show(); 
      this.lockedElement.hide();
    }
    if(reload) {
      await this.save(false);
    }
  }

  public setupAutosaveTimer() {
    const timer = async () => {
      //console.log("ExcalidrawView.autosaveTimer(), dirty", this.dirty);
      if(this.dirty) {
        console.log("autosave",Date.now());
        this.dirty = false;
        if(this.excalidrawRef) await this.save();
        this.plugin.triggerEmbedUpdates();
      }
    }
    if(this.plugin.settings.autosave) {
      this.autosaveTimer = setInterval(timer,30000);
    }
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    //console.log("ExcalidrawView.onunload()");
    if(this.autosaveTimer) clearInterval(this.autosaveTimer);
    //if(this.excalidrawRef) await this.save();
  }

  public async reload(fullreload:boolean = false, file?:TFile){
    //console.log("ExcalidrawView.reload(), fullreload",fullreload,"preventReload",this.preventReload);
    if(this.preventReload) {
      this.preventReload = false;
      return;
    }
    if(!this.excalidrawRef) return;
    if(!this.file) return;
    if(file) this.data = await this.app.vault.read(file);
    if(fullreload) await this.excalidrawData.loadData(this.data, this.file,this.isTextLocked);
    else await this.excalidrawData.setAllowParse(this.isTextLocked);
    this.loadDrawing(false);
  }

  // clear the view content  
  clear() {

  }
  
  async setViewData (data: string, clear: boolean = false) {   
    this.app.workspace.onLayoutReady(async ()=>{
      //console.log("ExcalidrawView.setViewData()");
      this.compatibilityMode = this.file.extension == "excalidraw";
      await this.plugin.loadSettings();
      this.plugin.opencount++;
      if(this.compatibilityMode) {
        this.unlockedElement.hide(); 
        this.lockedElement.hide();
        await this.excalidrawData.loadLegacyData(data,this.file);
        if (!this.plugin.settings.compatibilityMode) {
          new Notice(t("COMPATIBILITY_MODE"),4000);
        }
      } else {
        this.lock(data.search("excalidraw-plugin: locked\n")>-1,false);
        if(!(await this.excalidrawData.loadData(data, this.file,this.isTextLocked))) return;
      }
      if(clear) this.clear();
      this.loadDrawing(true)
      this.dirty = false;
    });
  }

  private loadDrawing(justloaded:boolean) {        
    //console.log("ExcalidrawView.loadDrawing, justloaded", justloaded);
    this.justLoaded = justloaded; //a flag to trigger zoom to fit after the drawing has been loaded
    const excalidrawData = this.excalidrawData.scene;
    if(this.excalidrawRef) {
      if(justloaded) this.excalidrawRef.current.resetScene();
      this.excalidrawRef.current.updateScene({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,  
        commitToHistory: false,
      });
      if(justloaded) this.excalidrawRef.current.scrollToContent();
    } else {
      (async() => {
        this.instantiateExcalidraw({
          elements: excalidrawData.elements,
          appState: excalidrawData.appState,
//          scrollToContent: true,
          libraryItems: await this.getLibrary(),
        });
      })();
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
              const png = await ExcalidrawView.getPNG(this.getScene(),exportSettings);
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
    this.dirty = false;
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


      this.getSelectedId = ():string => {
        if(!excalidrawRef?.current) return null;
        const selectedElement = excalidrawRef.current.getSceneElements().filter((el:any)=>el.id==Object.keys(excalidrawRef.current.getAppState().selectedElementIds)[0]);
        if(selectedElement.length==0) return null;
        if(selectedElement[0].type == "text") return selectedElement[0].id; //a text element was selected. Retrun text
        if(selectedElement[0].groupIds.length == 0) return null; //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = excalidrawRef
                            .current
                            .getSceneElements()
                            .filter((el:any)=>el.groupIds?.includes(group))
                            .filter((el:any)=>el.type=="text"); //filter for text elements of the group
        if(textElement.length==0) return null; //the group had no text element member
        return textElement[0].id; //return text element text
      };      

      this.getSelectedText = (textonly:boolean=false):string => {
        if(!excalidrawRef?.current) return null;
        const selectedElement = excalidrawRef.current.getSceneElements().filter((el:any)=>el.id==Object.keys(excalidrawRef.current.getAppState().selectedElementIds)[0]);
        if(selectedElement.length==0) return null;
        if(selectedElement[0].type == "text") return selectedElement[0].text; //a text element was selected. Retrun text
        if(textonly) return null;
        if(selectedElement[0].groupIds.length == 0) return null; //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = excalidrawRef
                            .current
                            .getSceneElements()
                            .filter((el:any)=>el.groupIds?.includes(group))
                            .filter((el:any)=>el.type=="text"); //filter for text elements of the group
        if(textElement.length==0) return null; //the group had no text element member
        return textElement[0].text; //return text element text
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
        const id = window.ExcalidrawAutomate.addText(currentPosition.x, currentPosition.y, text);
        //@ts-ignore
        el.push(window.ExcalidrawAutomate.elementsDict[id]);
        excalidrawRef.current.updateScene({
          elements: el,
          appState: st,  
        });
      }
      
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

      /*
      const dropAction = (transfer: DataTransfer) => {
        // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
        if (transfer.types.includes('text/uri-list')) return 'link';
        if (['file', 'files', 'link'].includes((this.app as any).dragManager.draggable?.type)) return 'link';
        if (transfer.types.includes('text/html') || transfer.types.includes('text/plain')) return 'copy';
      }

      const linkTo = (f: TFile, subpath?: string) => { 
        this.addText(this.app.metadataCache.fileToLinktext(f,subpath ? subpath : this.file.path,true));
      };

      const fixBulletsAndLInks = (text: string) => {
        // Internal links from e.g. dataview plugin incorrectly begin with `app://obsidian.md/`, and
        // we also want to remove bullet points and task markers from text and markdown
        return text.replace(/^\s*[-+*]\s+(\[.]\s+)?/, "").trim().replace(/^\[(.*)\]\(app:\/\/obsidian.md\/(.*)\)$/, "[$1]($2)");
      }

      const getMarkdown = (transfer: DataTransfer ) => {
        // crude hack to use Obsidian's html-to-markdown converter (replace when Obsidian exposes it in API):
        console.log(transfer);
        
      }

      let importLines = (transfer: DataTransfer, forcePlaintext: boolean = false) => {
        const draggable = (this.app as any).dragManager.draggable;
        const html  = transfer.getData("text/html");
        const plain = transfer.getData("text/plain");
        const uris  = transfer.getData("text/uri-list");
        
        switch(draggable?.type) {
          case "file":
            linkTo(draggable.file);
            break;
          case "files":
            for(const f of draggable.files) {
              linkTo(f);
            }
            break;
          case "link":
            if(draggable.file) {
              linkTo(draggable.file, parseLinktext(draggable.linktext).subpath);
              break;
            }
            console.log(`[[${draggable.linktext}]]`);
            break;
          default:
            const text = forcePlaintext ? (plain||html) :  getMarkdown(transfer);
            // Split lines and strip leading bullets/task indicators
            const lines: string[] = (text || html || uris || plain || "").split(/\r\n?|\n/).map(fixBulletsAndLInks);
            console.log( lines.filter(line => line));
            break;
        }
      }*/

      let timestamp = 0;

      const dblclickEvent = (e: Event):boolean => {
        if((e.target instanceof HTMLCanvasElement) && this.getSelectedText(true)) { //text element is selected
          const now = (new Date()).getTime();
          if(now-timestamp < 600) { //double click
            if(this.isTextLocked) {
              e.preventDefault();
              e.stopPropagation();
              new Notice(t("UNLOCK_TO_EDIT"));
            }
            timestamp = 0;
            this.lock(false);
            return true;
          }
          timestamp = now;
        }        
        return false;
      }

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            className: "excalidraw-wrapper",
            ref: excalidrawWrapperRef,
            key: "abc",
            onTouchEnd: (e: TouchEvent) => {
              if (dblclickEvent(e)) return;
            },
            onClick: (e:MouseEvent):any => {
              //@ts-ignore
              if(this.app.isMobile) return;
              if(this.isTextLocked && dblclickEvent(e)) return;
              if(!(e.ctrlKey||e.metaKey)) return;
              if(!(this.plugin.settings.allowCtrlClick)) return;
              if(!this.getSelectedId()) return;
              this.handleLinkClick(this,e);
            },
            onKeyDown: (ev:any) => {
              if(!this.isTextLocked) return; //text is not locked
              if(ev.keyCode!=13) return; //not an enter
              if(!(ev.target instanceof HTMLDivElement)) return;
              if(!this.getSelectedId()) return;
/*              const event = new MouseEvent('dblclick', {
                'view': window,
                'bubbles': true,
                'cancelable': true,
              });
              ev.target.querySelector("canvas").dispatchEvent(event);*/
              this.lock(false);
              new Notice(t("UNLOCK_TO_EDIT"));
            }, 
/*            onDragOver: (e:any) => {
              const action = dropAction(e.dataTransfer);
              if (action) {
                e.dataTransfer.dropEffect = action;
                e.preventDefault();
                return false;
              }
            },
            onDragLeave: () => { },
            onDrop: (e:any) => {
              importLines(e.dataTransfer);
              e.preventDefault();
              // shift key to force plain text, the same way Obsidian does it
            },*/
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
            },
            onChange: (et:ExcalidrawElement[],st:AppState) => {
              if(this.justLoaded) {
                this.justLoaded = false;             
                excalidrawRef.current.scrollToContent();
                previousSceneVersion = getSceneVersion(et);
              } 
              if (st.editingElement == null && st.resizingElement == null && 
                  st.draggingElement == null && st.editingGroupId == null &&
                  st.editingLinearElement == null ) {
                const sceneVersion = getSceneVersion(et);
                if(sceneVersion != previousSceneVersion) {
                  previousSceneVersion = sceneVersion;
                  this.dirty=true;
                }
              }
            },
            onLibraryChange: (items:LibraryItems) => {
              (async () => {
                this.plugin.setStencilLibrary(EXCALIDRAW_LIB_HEADER+JSON.stringify(items)+'}');
                await this.plugin.saveSettings();  
              })();
            }
          })
        )
      );
    });
    ReactDOM.render(reactElement,(this as any).contentEl);  
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

  public static async getPNG(scene:any, exportSettings:ExportSettings) {
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
      });
    } catch (error) {
      return null;
    }
  }
}