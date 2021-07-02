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
import Excalidraw, {exportToSvg, getSceneVersion} from "@excalidraw/excalidraw";
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

} from './constants';
import ExcalidrawPlugin from './main';
import {ExcalidrawAutomate} from './ExcalidrawAutomate';
import { t } from "./lang/helpers";
import { ExcalidrawData, REG_LINK_BACKETS } from "./ExcalidrawData";

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
  private autosaveTimer: any = null;
  private previousSceneVersion: number = 0;
  public  isTextLocked:boolean = false;
  private lockedElement:HTMLElement;
  private unlockedElement:HTMLElement;

  id: string = (this.leaf as any).id;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
  }

  public async saveSVG(data?: string) {
    if(!data) {
      if (!this.getScene) return false;
      data = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.md')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const svg = ExcalidrawView.getSVG(data,exportSettings);
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

  public async savePNG(data?: string) {
    if(!data) {
      if (!this.getScene) return false;
      data = this.getScene();
    }
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const png = await ExcalidrawView.getPNG(data,exportSettings);
    if(!png) return;
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if(file && file instanceof TFile) await this.app.vault.modifyBinary(file,await png.arrayBuffer());
    else await this.app.vault.createBinary(filepath,await png.arrayBuffer());    
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse a.k.a async is not required.
  getViewData () {
    if(this.getScene) {
      const scene = this.getScene();
      if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
      if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      if(this.excalidrawData.syncElements(scene)) {
        this.loadDrawing(false);
      }  
      let trimLocation = this.data.search("# Text Elements\n");
      if(trimLocation == -1) trimLocation = this.data.search("# Drawing\n");
      if(trimLocation == -1) return this.data;
      const header = this.data.substring(0,trimLocation)
                              .replace(/excalidraw-plugin:\s.*\n/,FRONTMATTER_KEY+": " + (this.isTextLocked ? "locked\n" : "unlocked\n"));
      return header + this.excalidrawData.generateMD();
    }
    else return this.data;
  }
  
  handleLinkClick(view: ExcalidrawView, ev:MouseEvent) {
    let text:string = this.isTextLocked
               ? this.excalidrawData.getRawText(this.getSelectedId()) 
               : this.getSelectedText();
    if(!text) {
      new Notice('Select a text element.\n'+
                 'If it is a web link, it will open in a new browser window.\n'+
                 'Else, if it is a valid filename, Excalidraw will handle it as an Obsidian internal link.\n'+
                 'Use Shift+click to open it in a new pane.\n'+
                 'You can also ctrl/meta click on the text element in the drawing as a shortcut to using this button.',20000); 
      return;
    }
    if(text.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(text,"_blank");
      return;    }

    //![[link|alias]]![alias](link)
    //1  2    3      4 5      6
    const parts = text.matchAll(REG_LINK_BACKETS).next();    
    //if(view.plugin.settings.validLinksOnly) text = ''; //clear text, if it is a valid link, parts.value[1] will hold a value
    if(!parts.value) {
      new Notice('Text element is empty, or [[valid-link|alias]] or [alias](valid-link) is not found',4000); 
      return;
    }

    text = parts.value[2] ? parts.value[2]:parts.value[6];

    if(text.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(text,"_blank");
      return;
    }

    if(text.search("#")>-1) text = text.substring(0,text.search("#"));
    if(text.match(REG_LINKINDEX_INVALIDCHARS)) {
      new Notice('File name cannot contain any of the following characters: * " \\  < > : | ?',4000); 
      return;
    }
    if (!ev.altKey) {
      const file = view.app.metadataCache.getFirstLinkpathDest(text,view.file.path); 
      if (!file) {
        new Notice("File does not exist. Hold down ALT (or ALT+SHIFT) and click link button to create a new file.", 4000);
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

  download(encoding:string,data:any,filename:string) {
    let element = document.createElement('a');
    element.setAttribute('href', (encoding ? encoding + ',' : '') + data);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  async onload() {
    this.addAction(DISK_ICON_NAME,"Force-save now to update transclusion visible in adjacent workspace pane\n(Please note, that autosave is always on)",async (ev)=> {
      await this.save();
      this.plugin.triggerEmbedUpdates();
    });
    
    this.unlockedElement = this.addAction(UNLOCK_ICON_NAME,"Text Elements are unlocked. Click to lock.", (ev) => this.lock(true));
    this.lockedElement = this.addAction(LOCK_ICON_NAME,"Text Elements are locked. Click to unlock.", (ev) => this.lock(false));
    
    this.addAction("link",t("Open selected text as link\n(SHIFT+click to open in a new pane)"), (ev)=>this.handleLinkClick(this,ev));

    
    //this is to solve sliding panes bug
    if (this.app.workspace.layoutReady) {
      (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();});
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();})));
    }

    this.setupAutosaveTimer();
  }

  public async lock(locked:boolean) {
    this.isTextLocked = locked;
    if(locked) {
      if(this.getScene) await this.excalidrawData.updateScene(this.getScene());
      this.unlockedElement.hide(); 
      this.lockedElement.show();
    } else {
      this.unlockedElement.show(); 
      this.lockedElement.hide();
    }

    await this.reload();
  }

  private setupAutosaveTimer() {
    const timer = async () => {
      if(this.dirty) {
        this.dirty = false;
        if(this.excalidrawRef) await this.save();
        this.plugin.triggerEmbedUpdates();
      }
    }
    this.autosaveTimer = setInterval(timer,30000);
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    if(this.autosaveTimer) clearInterval(this.autosaveTimer);
    if(this.excalidrawRef) await this.save();
  }

  public async reload(){
    if(!this.excalidrawRef) return;
    if(!this.file) return;
    await this.save();
    await this.excalidrawData.loadData(this.data, this.file,this.isTextLocked);
    this.loadDrawing(false);
  }

  // clear the view content  
  clear() {

  }
  
  async setViewData (data: string, clear: boolean) {   
    this.app.workspace.onLayoutReady(async ()=>{
      this.lock(data.search("excalidraw-plugin: locked\n")>-1);
      if(!(await this.excalidrawData.loadData(data, this.file,this.isTextLocked))) return;
      if(clear) this.clear();
      this.loadDrawing(true)
    });
  }

  private loadDrawing (justloaded:boolean) {        
    this.justLoaded = justloaded; //a flag to trigger zoom to fit after the drawing has been loaded
    const excalidrawData = this.excalidrawData.scene;
    if(this.excalidrawRef) {
      this.excalidrawRef.current.updateScene({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,  
      });
    } else {
      (async() => {
        this.instantiateExcalidraw({
          elements: excalidrawData.elements,
          appState: excalidrawData.appState,
          scrollToContent: true,
          libraryItems: await this.getLibrary(),
        });
      })();
    }
  }


  // gets the title of the document
  getDisplayText() {
    if(this.file) return this.file.basename;
    else return "Excalidraw (no file)";
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
    menu
      .addItem((item) => {
        item
          .setTitle(t("Open as markdown"))
          .setIcon("document")
          .onClick(async () => {
            this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
            this.plugin.setMarkdownView(this.leaf);
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("Export to .Excalidraw file"))
          .setIcon(ICON_NAME)
          .onClick( async (ev) => {
            if(!this.getScene || !this.file) return;
            this.download('data:text/plain;charset=utf-8',encodeURIComponent(this.getScene()), this.file.basename+'.excalidraw');
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("Save as PNG into Vault (CTRL/META+click to export)"))
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
                self.download(null,base64data,self.file.basename+'.png'); 
              }
              return;
            }
            this.savePNG();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("Save as SVG into Vault (CTRL/META+click to export)"))
          .setIcon(SVG_ICON_NAME)
          .onClick(async (ev)=> {
            if(!this.getScene || !this.file) return;
            if(ev.ctrlKey || ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground, 
                withTheme: this.plugin.settings.exportWithTheme
              }
              let svg = ExcalidrawView.getSVG(this.getScene(),exportSettings);
              if(!svg) return null;
              svg = ExcalidrawView.embedFontsInSVG(svg);
              this.download("data:image/svg+xml;base64",btoa(unescape(encodeURIComponent(svg.outerHTML))),this.file.basename+'.svg');
              return;
            }
            this.saveSVG()
          });
      })
      .addSeparator();
    super.onMoreOptionsMenu(menu);
  }

  async getLibrary() {
    const data = JSON.parse(this.plugin.settings.library);
    return data?.library ? data.library : [];
  }

  
  private instantiateExcalidraw(initdata: any) {  
    this.dirty = false;
    this.previousSceneVersion = 0;
    const reactElement = React.createElement(() => {
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
        //console.log(currentPosition,el,st);
      }
      
      this.getScene = () => {
        if(!excalidrawRef?.current) {
          return null;
        }
        const el: ExcalidrawElement[] = excalidrawRef.current.getSceneElements();
        const st: AppState = excalidrawRef.current.getAppState();
        return JSON.stringify({
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
        });
      };

      this.refresh = () => {
        if(!excalidrawRef?.current) return;
        excalidrawRef.current.refresh();
      };
      
      let timestamp = (new Date()).getTime();
      
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            className: "excalidraw-wrapper",
            ref: excalidrawWrapperRef,
            key: "abc",
            onClick: (e:MouseEvent):any => {
              if(this.isTextLocked && (e.target instanceof HTMLCanvasElement) && this.getSelectedText(true)) { //text element is selected
                const now = (new Date()).getTime();
                if(now-timestamp < 600) { //double click
                  var event = new MouseEvent('dblclick', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true,
                  });
                  e.target.dispatchEvent(event);
                  new Notice(t("Unlock text elements to edit"))
                  timestamp = now;
                  return;
                }
                timestamp = now;
              }
              if(!(e.ctrlKey||e.metaKey)) return;
              if(!(this.plugin.settings.allowCtrlClick)) return;
              if(!this.getSelectedId()) return;
              this.handleLinkClick(this,e);
            },
            
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
                export: false
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
                const e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, shiftKey : true, code:"Digit1"});
                this.contentEl.querySelector("canvas")?.dispatchEvent(e);
              } 
              if (st.editingElement == null && st.resizingElement == null && 
                  st.draggingElement == null && st.editingGroupId == null &&
                  st.editingLinearElement == null ) {
                const sceneVersion = Excalidraw.getSceneVersion(et);
                if(sceneVersion != this.previousSceneVersion) {
                  this.previousSceneVersion = sceneVersion;
                  this.dirty=true;
                }
              }
            },
            onLibraryChange: (items:LibraryItems) => {
              (async () => {
                this.plugin.settings.library = EXCALIDRAW_LIB_HEADER+JSON.stringify(items)+'}';
                await this.plugin.saveSettings();  
              })();
            }
          })
        )
      );
    });
    ReactDOM.render(reactElement,(this as any).contentEl);  
  }

  public static getSVG(data:string, exportSettings:ExportSettings):SVGSVGElement {
    try {
      const excalidrawData = JSON.parse(data);
      return exportToSvg({
        elements: excalidrawData.elements,
        appState: {
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme ? (excalidrawData.appState?.theme=="light" ? false : true) : false,
          ... excalidrawData.appState,},
        exportPadding:10,
        metadata: "Generated by Excalidraw-Obsidian plugin",
      });
    } catch (error) {
      return null;
    }
  }

  public static async getPNG(data:string, exportSettings:ExportSettings) {
    try {
      const excalidrawData = JSON.parse(data);      
      return await Excalidraw.exportToBlob({
          elements: excalidrawData.elements,
          appState: {
            exportBackground: exportSettings.withBackground,
            exportWithDarkMode: exportSettings.withTheme ? (excalidrawData.appState?.theme=="light" ? false : true) : false,
            ... excalidrawData.appState,},
          mimeType: "image/png",
          exportWithDarkMode: "true",
          metadata: "Generated by Excalidraw-Obsidian plugin",
      });
    } catch (error) {
      return null;
    }
  }
}