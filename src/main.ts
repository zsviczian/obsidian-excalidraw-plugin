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
} from 'obsidian';
import { 
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW, 
  EXCALIDRAW_ICON,
  ICON_NAME,
  EXCALIDRAW_FILE_EXTENSION,
  EXCALIDRAW_FILE_EXTENSION_LEN,
  CODEBLOCK_EXCALIDRAW,
  DISK_ICON,
  DISK_ICON_NAME,
  PNG_ICON,
  PNG_ICON_NAME,
  SVG_ICON,
  SVG_ICON_NAME,
  RERENDER_EVENT,
  VIRGIL_FONT,
  CASCADIA_FONT
} from './constants';
import ExcalidrawView, {ExportSettings} from './ExcalidrawView';
import {
  ExcalidrawSettings, 
  DEFAULT_SETTINGS, 
  ExcalidrawSettingTab
} from './settings';
import {
  openDialogAction, 
  OpenFileDialog
} from './openDrawing';
import {
  initExcalidrawAutomate,
  destroyExcalidrawAutomate
} from './ExcalidrawTemplate';
import TransclusionIndex from './TransclusionIndex';

export interface ExcalidrawAutomate extends Window {
  ExcalidrawAutomate: {
    theme: string;
    createNew: Function;
  };
}

export default class ExcalidrawPlugin extends Plugin {
  public settings: ExcalidrawSettings;
  private openDialog: OpenFileDialog;
  private transclusionIndex: TransclusionIndex;
  private activeExcalidrawView: ExcalidrawView;
  public lastActiveExcalidrawFilePath: string;
  /*Excalidraw Sync Begin*/
  private excalidrawSync: Set<string>;
  private syncModifyCreate: any;
  /*Excalidraw Sync Begin*/

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.activeExcalidrawView = null;
    this.lastActiveExcalidrawFilePath = null;
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

    initExcalidrawAutomate(this);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW, 
      (leaf: WorkspaceLeaf) => new ExcalidrawView(leaf, this)
    );

    this.registerExtensions([EXCALIDRAW_FILE_EXTENSION],VIEW_TYPE_EXCALIDRAW);

    this.registerMarkdownCodeBlockProcessor(CODEBLOCK_EXCALIDRAW, async (source,el,ctx) => {
      el.addEventListener(RERENDER_EVENT,async (e) => {
        e.stopPropagation();
        el.empty();
        this.codeblockProcessor(source,el,ctx,this);
      });
      this.codeblockProcessor(source,el,ctx,this);
    }); 

    await this.loadSettings();
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

    this.openDialog = new OpenFileDialog(this.app, this);
    this.addRibbonIcon(ICON_NAME, 'Create a new drawing in Excalidraw', async (e) => {
      this.createDrawing(this.getNextDefaultFilename(), e.ctrlKey);
    });
    
    

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
          this.insertCodeblock(this.lastActiveExcalidrawFilePath);
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

    this.transclusionIndex = new TransclusionIndex(this.app.vault);

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
        if (file instanceof TFolder) {
          menu.addItem((item: MenuItem) => {
            item.setTitle("Create Excalidraw drawing")
              .setIcon(ICON_NAME)
              .onClick(evt => {
                this.createDrawing(this.getNextDefaultFilename(),false,file.path);
              })
          });
        }
      })
    );

    if (this.app.workspace.layoutReady) {
      this.addEventListeners(this);
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => this.addEventListeners(this)));
    }
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
    plugin.transclusionIndex.initialize();

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
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      for (let i=0;i<leaves.length;i++) {
        if((leaves[i].view as ExcalidrawView).file.path == oldPath) {
          (leaves[i].view as ExcalidrawView).setViewData(await plugin.app.vault.read(file),false);
          plugin.triggerEmbedUpdates();
        }
      }
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

    plugin.app.vault.on('create', syncModifyCreate);
    plugin.app.vault.on('modify', syncModifyCreate);
    /*Excalidraw Sync End*/

    //watch filename change to rename .svg
    plugin.app.vault.on('rename',async (file,oldPath) => {
      plugin.transclusionIndex.updateTransclusion(oldPath,file.path);
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
    });

    //watch file delete and delete corresponding .svg
    plugin.app.vault.on('delete',async (file:TFile) => {
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
    });

    //save open drawings when user quits the application
    plugin.app.workspace.on('quit',(tasks) => {
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);      
      for (let i=0;i<leaves.length;i++) {
        (leaves[i].view as ExcalidrawView).save(); 
      }
    });

    //save Excalidraw leaf and update embeds when switching to another leaf
    plugin.app.workspace.on('active-leaf-change',(leaf:WorkspaceLeaf) => {
      if(plugin.activeExcalidrawView) {
        plugin.activeExcalidrawView.save();
        plugin.triggerEmbedUpdates();
      }
      plugin.activeExcalidrawView = (leaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW) ? leaf.view as ExcalidrawView : null;
      if(plugin.activeExcalidrawView)
        plugin.lastActiveExcalidrawFilePath = plugin.activeExcalidrawView.file.path;
    });
  }

  onunload() {
    destroyExcalidrawAutomate();
  }

  private async codeblockProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: ExcalidrawPlugin) {
    const parseError = (message: string) => {
      el.createDiv("excalidraw-error",(el)=> {
        el.createEl("p","Please provide a link to an excalidraw file: [[file."+EXCALIDRAW_FILE_EXTENSION+"]]");
        el.createEl("p",message);
        el.createEl("p",source);
      })  
    }

    const parts = source.match(/\[{2}([^|]*)\|?(\d*)x?(\d*)\|?(.*)\]{2}/m);
    if(!parts) {
      parseError("No link to file found in codeblock.");
      return;
    }
    const fname = parts[1];
    const fwidth = parts[2]? parts[2] : plugin.settings.width;
    const fheight = parts[3];
    const style = "excalidraw-svg" + (parts[4] ? "-" + parts[4] : "");

    if(!fname) {
      parseError("No link to file found in codeblock.");
      return;
    }

    const file = plugin.app.vault.getAbstractFileByPath(fname);
    if(!(file && file instanceof TFile)) {
      parseError("File does not exist. " + fname);
      return;
    }

    if(file.extension != EXCALIDRAW_FILE_EXTENSION) {
      parseError("Not an excalidraw file. Must have extension " + EXCALIDRAW_FILE_EXTENSION);
      return;
    }

    const content = await plugin.app.vault.read(file);
    const exportSettings: ExportSettings = {
      withBackground: plugin.settings.exportWithBackground, 
      withTheme: plugin.settings.exportWithTheme
    }
    const svg = ExcalidrawView.getSVG(content,exportSettings);
    if(!svg) {
      parseError("Parse error. Not a valid Excalidraw file.");
      return;
    }
    el.createDiv(style,(el)=> {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.setProperty('width',fwidth);
      if(fheight) svg.style.setProperty('height',fheight);
      svg.addClass(style);
      el.appendChild(svg);
    });
  }

  public insertCodeblock(data:string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if(activeView) {
      const editor = activeView.editor;
      editor.replaceSelection(
        String.fromCharCode(96,96,96) + 
        CODEBLOCK_EXCALIDRAW +
        "\n[["+data+"]]\n" +
        String.fromCharCode(96,96,96));
      editor.focus();
    }
  
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public triggerEmbedUpdates(){
    const e = document.createEvent("Event")
    e.initEvent(RERENDER_EVENT,true,false);
    document
      .querySelectorAll("svg[class^='excalidraw-svg']")
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
    return 'Drawing ' + window.moment().format('YYYY-MM-DD HH.mm.ss')+'.'+EXCALIDRAW_FILE_EXTENSION;
  }
 
  public async createDrawing(filename: string, onNewPane: boolean, foldername?: string, initData?:string) {
    const folderpath = normalizePath(foldername ? foldername: this.settings.folder);
    const fname = folderpath +'/'+ filename; 
    const folder = this.app.vault.getAbstractFileByPath(folderpath);
    if (!(folder && folder instanceof TFolder)) {
      await this.app.vault.createFolder(folderpath);
    }

    if(initData) {
      this.openDrawing(await this.app.vault.create(fname,initData),onNewPane);
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.templateFilePath));
    if(file && file instanceof TFile) {
      const content = await this.app.vault.read(file);
      this.openDrawing(await this.app.vault.create(fname,content==''?BLANK_DRAWING:content), onNewPane);
    } else {
      this.openDrawing(await this.app.vault.create(fname,BLANK_DRAWING), onNewPane);
    }
  }
}