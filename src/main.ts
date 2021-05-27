import { 
  TFile, 
  TFolder,
  Plugin, 
  WorkspaceLeaf, 
  addIcon, 
  App, 
  PluginManifest, 
  MarkdownView,
  normalizePath,
  MarkdownPostProcessorContext,
  Menu,
  MenuItem,
  TAbstractFile,
  Notice,
  Tasks,
} from "obsidian";

import { 
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW, 
  EXCALIDRAW_ICON,
  ICON_NAME,
  EXCALIDRAW_FILE_EXTENSION,
  EXCALIDRAW_FILE_EXTENSION_LEN,
  DISK_ICON,
  DISK_ICON_NAME,
  PNG_ICON,
  PNG_ICON_NAME,
  SVG_ICON,
  SVG_ICON_NAME,
  RERENDER_EVENT,
  VIRGIL_FONT,
  CASCADIA_FONT
} from "./constants";
import ExcalidrawView, {ExportSettings} from "./ExcalidrawView";
import {
  ExcalidrawSettings, 
  DEFAULT_SETTINGS, 
  ExcalidrawSettingTab
} from "./settings";
import {
  openDialogAction, 
  OpenFileDialog
} from "./openDrawing";
import {
  initExcalidrawAutomate,
  destroyExcalidrawAutomate
} from "./ExcalidrawTemplate";

export interface ExcalidrawAutomate extends Window {
  ExcalidrawAutomate: {
    theme: string;
    createNew: Function;
  };
}

export default class ExcalidrawPlugin extends Plugin {
  public settings: ExcalidrawSettings;
  private openDialog: OpenFileDialog;
  private activeExcalidrawView: ExcalidrawView;
  public lastActiveExcalidrawFilePath: string;
  private workspaceEventHandlers:Map<string,any>;
  private vaultEventHandlers:Map<string,any>;
  /*Excalidraw Sync Begin*/
  private excalidrawSync: Set<string>;
  private syncModifyCreate: any;
  /*Excalidraw Sync Begin*/

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.activeExcalidrawView = null;
    this.lastActiveExcalidrawFilePath = null;
    this.workspaceEventHandlers = new Map();
    this.vaultEventHandlers = new Map();
    /*Excalidraw Sync Begin*/
    this.excalidrawSync = new Set<string>();
    this.syncModifyCreate = null;
    /*Excalidraw Sync End*/
  }
  
  async onload() {
    addIcon(ICON_NAME, EXCALIDRAW_ICON);
    addIcon(DISK_ICON_NAME,DISK_ICON);
    addIcon(PNG_ICON_NAME,PNG_ICON);
    addIcon(SVG_ICON_NAME,SVG_ICON);
    
    const myFonts = document.createElement('style');
    myFonts.appendChild(document.createTextNode(VIRGIL_FONT));
    myFonts.appendChild(document.createTextNode(CASCADIA_FONT));
    document.head.appendChild(myFonts);

    await this.loadSettings();
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_EXCALIDRAW, 
      (leaf: WorkspaceLeaf) => new ExcalidrawView(leaf, this)
    );

    initExcalidrawAutomate(this);
    this.registerExtensions([EXCALIDRAW_FILE_EXTENSION],VIEW_TYPE_EXCALIDRAW);
    this.addMarkdownPostProcessor();
    this.addCommands();

    if (this.app.workspace.layoutReady) {
      this.addEventListeners(this);
    } else {
      this.registerEvent(this.app.workspace.on("layout-ready", async () => this.addEventListeners(this)));
    }
  }

  private addMarkdownPostProcessor() {

    const getIMG = async (parts:any) => {
      const file = this.app.vault.getAbstractFileByPath(parts.fname);
      if(!(file && file instanceof TFile)) {
        return null;
      }
    
      const content = await this.app.vault.read(file);
      const exportSettings: ExportSettings = {
        withBackground: this.settings.exportWithBackground, 
        withTheme: this.settings.exportWithTheme
      }
      let svg = ExcalidrawView.getSVG(content,exportSettings);
      if(!svg) return null;
      svg = ExcalidrawView.embedFontsInSVG(svg);
      const img = createEl("img");
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      img.setAttribute("width",parts.fwidth);
      
      if(parts.fheight) img.setAttribute("height",parts.fheight);//img.style.setProperty('height',parts.fheight);
      img.addClass(parts.style);
      img.setAttribute("src","data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg.outerHTML))));
      return img;
    }

    const markdownPostProcessor = async (el:HTMLElement,ctx:MarkdownPostProcessorContext) => {
      const drawings = el.querySelectorAll('.internal-embed[src$=".excalidraw"]');
      let fname:string, fwidth:string,fheight:string, alt:string, divclass:string, img:any, parts, div, file:TFile;
      for (const drawing of drawings) {
        fname    = drawing.getAttribute("src");
        fwidth   = drawing.getAttribute("width");
        fheight  = drawing.getAttribute("height");
        alt      = drawing.getAttribute("alt");
        if(alt == fname) alt = ""; //when the filename starts with numbers followed by a space Obsidian recognizes the filename as alt-text
        divclass = "excalidraw-svg";
        if(alt) {
          //for some reason ![]() is rendered in a DIV and ![[]] in a span by Obsidian
          //also the alt text of the DIV follows does not include the altext of the image
          //thus need to add an additional | when its a span
          if(drawing.tagName.toLowerCase()=="span") alt = "|"+alt;
          parts = alt.match(/[^\|]*\|?(\d*)x?(\d*)\|?(.*)/);
          fwidth = parts[1]? parts[1] : this.settings.width;
          fheight = parts[2];
          if(parts[3]!=fname) divclass = "excalidraw-svg" + (parts[3] ? "-" + parts[3] : "");
        }
        file = this.app.metadataCache.getFirstLinkpathDest(fname, ctx.sourcePath); 
        if(file) {  //file exists. Display drawing
          fname = file?.path;
          img = await getIMG({fname:fname,fwidth:fwidth,fheight:fheight,style:divclass});
          div = createDiv(divclass, (el)=>{
            el.append(img);
            el.setAttribute("src",file.path);
            el.setAttribute("w",fwidth);
            el.setAttribute("h",fheight);
            el.onClickEvent((ev)=>{
              if(ev.target instanceof Element && ev.target.tagName.toLowerCase() != "img") return;
              let src = el.getAttribute("src");
              if(src) this.openDrawing(this.app.vault.getAbstractFileByPath(src) as TFile,ev.ctrlKey||ev.metaKey);
            });
            el.addEventListener(RERENDER_EVENT, async(e) => {
              e.stopPropagation;
              el.empty();
              const img = await getIMG({ 
                fname:el.getAttribute("src"),
                fwidth:el.getAttribute("w"),
                fheight:el.getAttribute("h"),
                style:el.getAttribute("class")
              });
              el.append(img);
            });
          });
        } else { //file does not exist. Replace standard Obsidian div, with mine to create a drawing on click
          div = createDiv("excalidraw-new",(el)=> {
            el.setAttribute("src",fname);
            el.createSpan("internal-embed file-embed mod-empty is-loaded", (el) => {
              el.setText('"'+fname+'" is not created yet. Click to create.');
            });
            el.onClickEvent(async (ev)=> {
              const fname = el.getAttribute("src");
              if(!fname) return;
              const i = fname.lastIndexOf("/");
              if(i>-1) 
                this.createDrawing(fname.substring(i+1),false,fname.substring(0,i));
              else
                this.createDrawing(fname,false); 
            });
          }); 
        }
        drawing.parentElement.replaceChild(div,drawing);
      }
    }

    this.registerMarkdownPostProcessor(markdownPostProcessor);

  }

  private addCommands() {
    this.openDialog = new OpenFileDialog(this.app, this);

    this.addRibbonIcon(ICON_NAME, 'Create a new drawing in Excalidraw', async (e) => {
      this.createDrawing(this.getNextDefaultFilename(), e.ctrlKey||e.metaKey);
    });
  
    const fileMenuHandler = (menu: Menu, file: TFile) => {
      if (file instanceof TFolder) {
        menu.addItem((item: MenuItem) => {
          item.setTitle("Create Excalidraw drawing")
            .setIcon(ICON_NAME)
            .onClick(evt => {
              this.createDrawing(this.getNextDefaultFilename(),false,file.path);
            })
        });
      }
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandler)
    );

    this.workspaceEventHandlers.set("file-menu",fileMenuHandler);

    this.addCommand({
      id: "excalidraw-open",
      name: "Open an existing drawing - IN A NEW PANE",
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, true);
      },
    });

    this.addCommand({
      id: "excalidraw-open-on-current",
      name: "Open an existing drawing - IN THE CURRENT ACTIVE PANE",
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, false);
      },
    });

    this.addCommand({
      id: "excalidraw-insert-transclusion",
      name: "Transclude (embed) an Excalidraw drawing",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == "markdown";
        } else {
          this.openDialog.start(openDialogAction.insertLink, false);
          return true;
        }
      },
    });

    this.addCommand({
      id: "excalidraw-insert-last-active-transclusion",
      name: "Transclude (embed) the most recently edited Excalidraw drawing",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (this.app.workspace.activeLeaf.view.getViewType() == "markdown") && (this.lastActiveExcalidrawFilePath!=null);
        } else {
          this.embedDrawing(this.lastActiveExcalidrawFilePath);
          return true;
        }
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate",
      name: "Create a new drawing - IN A NEW PANE",
      callback: () => {
        this.createDrawing(this.getNextDefaultFilename(), true);
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-on-current",
      name: "Create a new drawing - IN THE CURRENT ACTIVE PANE",
      callback: () => {
        this.createDrawing(this.getNextDefaultFilename(), false);
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed",
      name: "Create a new drawing - IN A NEW PANE - and embed in current document",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (this.app.workspace.activeLeaf.view.getViewType() == "markdown");
        } else {
          const filename = this.getNextDefaultFilename();
          this.embedDrawing(filename);
          this.createDrawing(filename, true);
          return true;
        }
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-on-current",
      name: "Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed in current document",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (this.app.workspace.activeLeaf.view.getViewType() == "markdown");
        } else {
          const filename = this.getNextDefaultFilename();
          this.embedDrawing(filename);
          this.createDrawing(filename, false);
          return true;
        }
      },
    });

    this.addCommand({
      id: 'export-svg',
      name: 'Export SVG. Save it next to the current file',
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if(view.getViewType() == VIEW_TYPE_EXCALIDRAW) {
            (this.app.workspace.activeLeaf.view as ExcalidrawView).saveSVG();
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: 'export-png',
      name: 'Export PNG. Save it next to the current file',
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if(view.getViewType() == VIEW_TYPE_EXCALIDRAW) {
            (this.app.workspace.activeLeaf.view as ExcalidrawView).savePNG();
            return true;
          }
          else return false;
        }
      },
    });

    /*1.1 migration command*/
    const migrateCodeblock = async () => {
      const timeStart = new Date().getTime();
      let counter = 0;
      const markdownFiles = this.app.vault.getMarkdownFiles();
      let fileContents:string;
      const pattern =  new RegExp(String.fromCharCode(96,96,96)+'excalidraw\\s+([^`]*)\\s+'+String.fromCharCode(96,96,96),'gms');
      for (const file of markdownFiles) {
        fileContents = await this.app.vault.read(file);
        for(const match of [...fileContents.matchAll(pattern)]) {
          if(match[0] && match[1]) {
            fileContents = fileContents.split(match[0]).join("!"+match[1]);
            counter++;
          }
        }
        await this.app.vault.modify(file,fileContents)
      }
      const totalTimeMs = new Date().getTime() - timeStart;
      console.log(`Excalidraw: Parsed ${markdownFiles.length} markdown files 
                   and made ${counter} replacements in ${totalTimeMs / 1000.0} seconds.`);      
    }

    this.addCommand({
      id: "migrate-codeblock-transclusions",
      name: "MIGRATE to version 1.1: Replace codeblocks with ![[...]] style embedments",
      callback: async () => migrateCodeblock(),  
    });
  }
  
  /*Excalidraw Sync Begin*/
  public initiateSync() {
    if(!this.syncModifyCreate) return;
    const files = this.app.vault.getFiles();
    (files || [])
      .filter((f:TFile) => (f.path.startsWith(this.settings.syncFolder) && f.extension == "md"))
      .forEach((f)=>this.syncModifyCreate(f));
    (files || [])
      .filter((f:TFile) => (!f.path.startsWith(this.settings.syncFolder) && f.extension == EXCALIDRAW_FILE_EXTENSION))
      .forEach((f)=>this.syncModifyCreate(f));
  }
  /*Excalidraw Sync End*/

  private async addEventListeners(plugin: ExcalidrawPlugin) {

    const closeDrawing = async (filePath:string) => {
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      for (let i=0;i<leaves.length;i++) {
        if((leaves[i].view as ExcalidrawView).file.path == filePath) {
          await leaves[i].setViewState({
            type: VIEW_TYPE_EXCALIDRAW,
            state: {file: null}}
          );
        }
      }   
    }

    /*Excalidraw Sync Begin*/
    const reloadDrawing = async (oldPath:string, newPath: string) => {
      const file = plugin.app.vault.getAbstractFileByPath(newPath);
      if(!(file && file instanceof TFile)) return;
      let leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      for (let i=0;i<leaves.length;i++) {
        if((leaves[i].view as ExcalidrawView).file.path == oldPath) {
          (leaves[i].view as ExcalidrawView).setViewData(await plugin.app.vault.read(file),false);
        }
      }
      plugin.triggerEmbedUpdates(oldPath);
    }

    const createPathIfNotThere = async (path:string) => {
      const folderArray = path.split("/");
      folderArray.pop();
      const folderPath = folderArray.join("/");
      const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
      if(!folder)
        await plugin.app.vault.createFolder(folderPath); 
    }

    const getSyncFilepath = (excalidrawPath:string):string => {
      return normalizePath(plugin.settings.syncFolder)+'/'+excalidrawPath.slice(0,excalidrawPath.length-EXCALIDRAW_FILE_EXTENSION_LEN)+"md";
    }

    const getExcalidrawFilepath = (syncFilePath:string):string => {
      const syncFolder = normalizePath(plugin.settings.syncFolder)+'/';
      const normalFilePath = syncFilePath.slice(syncFolder.length);
      return normalFilePath.slice(0,normalFilePath.length-2)+EXCALIDRAW_FILE_EXTENSION; //2=="md".length
    }

    const syncCopy = async (source:TFile, targetPath: string) => {
      await createPathIfNotThere(targetPath);
      const target = plugin.app.vault.getAbstractFileByPath(targetPath);
      plugin.excalidrawSync.add(targetPath);
      if(target && target instanceof TFile) {
        await plugin.app.vault.modify(target,await plugin.app.vault.read(source));
      } else {
        await plugin.app.vault.create(targetPath,await plugin.app.vault.read(source))
        //await plugin.app.vault.copy(source,targetPath);
      }
    }

    const syncModifyCreate = async (file:TAbstractFile) => {
      if(!(file instanceof TFile)) return;
      if(plugin.excalidrawSync.has(file.path)) {
        plugin.excalidrawSync.delete(file.path);
        return;
      }
      if(plugin.settings.excalidrawSync) {
        switch (file.extension) {
          case EXCALIDRAW_FILE_EXTENSION: 
            const syncFilePath = getSyncFilepath(file.path); 
            await syncCopy(file,syncFilePath);
            break;
          case 'md':
            if(file.path.startsWith(normalizePath(plugin.settings.syncFolder))) {
              const excalidrawNewPath = getExcalidrawFilepath(file.path); 
              await syncCopy(file,excalidrawNewPath);
              reloadDrawing(excalidrawNewPath,excalidrawNewPath);
            }
            break;
        }
      }
    };
    this.syncModifyCreate = syncModifyCreate;

    plugin.app.vault.on("create", syncModifyCreate);
    plugin.app.vault.on("modify", syncModifyCreate);
    this.vaultEventHandlers.set("create",syncModifyCreate);
    this.vaultEventHandlers.set("modify",syncModifyCreate);
    /*Excalidraw Sync End*/

    //watch filename change to rename .svg
    const renameEventHandler = async (file:TAbstractFile,oldPath:string) => {
      if(!(file instanceof TFile)) return;
      /*Excalidraw Sync Begin*/
      if(plugin.settings.excalidrawSync) {
        if(plugin.excalidrawSync.has(file.path)) {
          plugin.excalidrawSync.delete(file.path);
        } else {
          switch (file.extension) {
            case EXCALIDRAW_FILE_EXTENSION: 
              const syncOldPath = getSyncFilepath(oldPath);
              const syncNewPath = getSyncFilepath(file.path); 
              const oldFile = plugin.app.vault.getAbstractFileByPath(syncOldPath);
              if(oldFile && oldFile instanceof TFile) {
                plugin.excalidrawSync.add(syncNewPath);
                await createPathIfNotThere(syncNewPath);
                await plugin.app.vault.rename(oldFile,syncNewPath);
              } else {
                await syncCopy(file,syncNewPath);
              }
              break;
            case 'md':
              if(file.path.startsWith(normalizePath(plugin.settings.syncFolder))) {
                const excalidrawOldPath = getExcalidrawFilepath(oldPath);
                const excalidrawNewPath = getExcalidrawFilepath(file.path); 
                const excalidrawOldFile = plugin.app.vault.getAbstractFileByPath(excalidrawOldPath);
                if(excalidrawOldFile && excalidrawOldFile instanceof TFile) {
                  plugin.excalidrawSync.add(excalidrawNewPath);
                  await createPathIfNotThere(excalidrawNewPath);
                  await plugin.app.vault.rename(excalidrawOldFile,excalidrawNewPath);
                } else {
                  await syncCopy(file,excalidrawNewPath);
                }
                reloadDrawing(excalidrawOldFile.path,excalidrawNewPath);
              }
              break;
          }
        }
      }
      /*Excalidraw Sync End*/
      if (file.extension != EXCALIDRAW_FILE_EXTENSION) return;
      if (!plugin.settings.keepInSync) return;
      const oldSVGpath = oldPath.substring(0,oldPath.lastIndexOf('.'+EXCALIDRAW_FILE_EXTENSION)) + '.svg'; 
      const svgFile = plugin.app.vault.getAbstractFileByPath(normalizePath(oldSVGpath));
      if(svgFile && svgFile instanceof TFile) {
        const newSVGpath = file.path.substring(0,file.path.lastIndexOf('.'+EXCALIDRAW_FILE_EXTENSION)) + '.svg';
        await plugin.app.vault.rename(svgFile,newSVGpath); 
      }
    };
    plugin.app.vault.on("rename",renameEventHandler);
    this.vaultEventHandlers.set("rename",renameEventHandler);


    //watch file delete and delete corresponding .svg
    const deleteEventHandler = async (file:TFile) => {
      if (!(file instanceof TFile)) return;
      /*Excalidraw Sync Begin*/
      if(plugin.settings.excalidrawSync) {
        if(plugin.excalidrawSync.has(file.path)) {
          plugin.excalidrawSync.delete(file.path);
        } else { 
          switch (file.extension) {
            case EXCALIDRAW_FILE_EXTENSION: 
              const syncFilePath = getSyncFilepath(file.path);
              const oldFile = plugin.app.vault.getAbstractFileByPath(syncFilePath);
              if(oldFile && oldFile instanceof TFile) {
                plugin.excalidrawSync.add(oldFile.path);
                plugin.app.vault.delete(oldFile);
              }
              break;
            case "md":
              if(file.path.startsWith(normalizePath(plugin.settings.syncFolder))) {
                const excalidrawPath = getExcalidrawFilepath(file.path); 
                const excalidrawFile = plugin.app.vault.getAbstractFileByPath(excalidrawPath);
                if(excalidrawFile && excalidrawFile instanceof TFile) {
                  plugin.excalidrawSync.add(excalidrawFile.path);
                  await closeDrawing(excalidrawFile.path);
                  plugin.app.vault.delete(excalidrawFile);
                } 
              }
              break;
          }
        }
      }
      /*Excalidraw Sync End*/
      if (file.extension != EXCALIDRAW_FILE_EXTENSION) return;      
      closeDrawing(file.path);
      
      if (plugin.settings.keepInSync) {
        const svgPath = file.path.substring(0,file.path.lastIndexOf('.'+EXCALIDRAW_FILE_EXTENSION)) + '.svg'; 
        const svgFile = plugin.app.vault.getAbstractFileByPath(normalizePath(svgPath));
        if(svgFile && svgFile instanceof TFile) {
          await plugin.app.vault.delete(svgFile); 
        }
      }
    }
    plugin.app.vault.on("delete",deleteEventHandler);
    this.vaultEventHandlers.set("delete",deleteEventHandler);

    //save open drawings when user quits the application
    const quitEventHandler = (tasks: Tasks) => {
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);      
      for (let i=0;i<leaves.length;i++) {
        (leaves[i].view as ExcalidrawView).save(); 
      }
    }
    plugin.app.workspace.on("quit",quitEventHandler);
    this.workspaceEventHandlers.set("quit",quitEventHandler);

    //save Excalidraw leaf and update embeds when switching to another leaf
    const activeLeafChangeEventHandler = (leaf:WorkspaceLeaf) => {
      if(plugin.activeExcalidrawView) {
        plugin.activeExcalidrawView.save();
        plugin.triggerEmbedUpdates(plugin.activeExcalidrawView.file?.path);
      }
      plugin.activeExcalidrawView = (leaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW) ? leaf.view as ExcalidrawView : null;
      if(plugin.activeExcalidrawView)
        plugin.lastActiveExcalidrawFilePath = plugin.activeExcalidrawView.file?.path;
    };
    plugin.app.workspace.on("active-leaf-change",activeLeafChangeEventHandler);
    this.workspaceEventHandlers.set("active-leaf-change",activeLeafChangeEventHandler);
  }

  onunload() {
    destroyExcalidrawAutomate();
    for(const key of this.vaultEventHandlers.keys()) 
      this.app.vault.off(key,this.vaultEventHandlers.get(key))
    for(const key of this.workspaceEventHandlers.keys())
      this.app.workspace.off(key,this.workspaceEventHandlers.get(key));
  }

  public embedDrawing(data:string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if(activeView) {
      const editor = activeView.editor;
      editor.replaceSelection("![["+data+"]]");
      editor.focus();
    }
  
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public triggerEmbedUpdates(filepath?:string){
    const e = document.createEvent("Event")
    e.initEvent(RERENDER_EVENT,true,false);
    document
      .querySelectorAll("div[class^='excalidraw-svg']"+ (filepath ? "[src='"+filepath.replaceAll("'","\\'")+"']" : ""))
      .forEach((el) => el.dispatchEvent(e));
  }

  public openDrawing(drawingFile: TFile, onNewPane: boolean) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    let leaf:WorkspaceLeaf = null;

    if (leaves?.length > 0) {
      leaf = leaves[0];
    }
    if(!leaf) {
      leaf = this.app.workspace.activeLeaf;
    }

    if(!leaf) {
      leaf = this.app.workspace.getLeaf();
    }
    
    if(onNewPane) {
      leaf = this.app.workspace.createLeafBySplit(leaf);
    }    

    leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: {file: drawingFile.path}}
    );
  }

  private getNextDefaultFilename():string {
    return this.settings.drawingFilenamePrefix + window.moment().format(this.settings.drawingFilenameDateTime)+'.'+EXCALIDRAW_FILE_EXTENSION;
  }
 
  public async createDrawing(filename: string, onNewPane: boolean, foldername?: string, initData?:string) {
    const folderpath = normalizePath(foldername ? foldername: this.settings.folder);
    let fname = folderpath +'/'+ filename; 
    const folder = this.app.vault.getAbstractFileByPath(folderpath);
    if (!(folder && folder instanceof TFolder)) {
      await this.app.vault.createFolder(folderpath);
    }

    let file:TAbstractFile = this.app.vault.getAbstractFileByPath(fname);
    let i = 0;
    while(file) {
      fname = folderpath + '/' + filename.slice(0,filename.lastIndexOf("."))+"_"+i+filename.slice(filename.lastIndexOf("."));
      i++;
      file = this.app.vault.getAbstractFileByPath(fname);
    }

    if(initData) {
      this.openDrawing(await this.app.vault.create(fname,initData),onNewPane);
      return;
    }

    const template = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.templateFilePath));
    if(template && template instanceof TFile) {
      const content = await this.app.vault.read(template);
      this.openDrawing(await this.app.vault.create(fname,content==''?BLANK_DRAWING:content), onNewPane);
    } else {
      this.openDrawing(await this.app.vault.create(fname,BLANK_DRAWING), onNewPane);
    }
  }
}