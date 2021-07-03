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
  Tasks,
  MarkdownRenderer,
  ViewState,
} from "obsidian";

import { 
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW, 
  EXCALIDRAW_ICON,
  ICON_NAME,
  DISK_ICON,
  DISK_ICON_NAME,
  PNG_ICON,
  PNG_ICON_NAME,
  SVG_ICON,
  SVG_ICON_NAME,
  RERENDER_EVENT,
  FRONTMATTER_KEY,
  FRONTMATTER,
  LOCK_ICON,
  LOCK_ICON_NAME,
  UNLOCK_ICON_NAME,
  UNLOCK_ICON
} from "./constants";
import ExcalidrawView, {ExportSettings} from "./ExcalidrawView";
import {getJSON} from "./ExcalidrawData";
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
  destroyExcalidrawAutomate,
  exportSceneToMD,
} from "./ExcalidrawAutomate";
import { Prompt } from "./Prompt";
import { around } from "monkey-around";
import { t } from "./lang/helpers";

export default class ExcalidrawPlugin extends Plugin {
  public excalidrawFileModes: { [file: string]: string } = {};
  private _loaded: boolean = false;
  public settings: ExcalidrawSettings;
  private openDialog: OpenFileDialog;
  private activeExcalidrawView: ExcalidrawView = null;
  public lastActiveExcalidrawFilePath: string = null;
  private workspaceEventHandlers:Map<string,any> = new Map();
  private vaultEventHandlers:Map<string,any> = new Map();
  private hover: {linkText: string, sourcePath: string} = {linkText: null, sourcePath: null};
  private observer: MutationObserver;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }
  
  async onload() {
    addIcon(ICON_NAME, EXCALIDRAW_ICON);
    addIcon(DISK_ICON_NAME,DISK_ICON);
    addIcon(PNG_ICON_NAME,PNG_ICON);
    addIcon(SVG_ICON_NAME,SVG_ICON);
    addIcon(LOCK_ICON_NAME,LOCK_ICON);
    addIcon(UNLOCK_ICON_NAME,UNLOCK_ICON);
    
    await this.loadSettings();
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

    await initExcalidrawAutomate(this);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW, 
      (leaf: WorkspaceLeaf) => new ExcalidrawView(leaf, this)
    );

    this.addMarkdownPostProcessor();
    this.registerCommands();

    this.registerEventListeners();
    
    //inspiration taken from kanban: https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/main.ts#L267
    this.registerMonkeyPatches();
  }

  /**
   * Displays a transcluded .excalidraw image in markdown preview mode
   */
  private addMarkdownPostProcessor() {
    
    interface imgElementAttributes {
      fname:   string, //Excalidraw filename
      fwidth:  string, //Display width of image
      fheight: string, //Display height of image
      style:   string  //css style to apply to IMG element
    }

    /**
     * Generates an img element with the .excalidraw drawing encoded as a base64 svg
     * @param parts {imgElementAttributes} - display properties of the image
     * @returns {Promise<HTMLElement>} - the IMG HTML element containing the encoded SVG image
     */
    const getIMG = async (parts:imgElementAttributes):Promise<HTMLElement> => {
      const file = this.app.vault.getAbstractFileByPath(parts.fname);
      if(!(file && file instanceof TFile)) {
        return null;
      }
    
      const content = await this.app.vault.read(file);
      const exportSettings: ExportSettings = {
        withBackground: this.settings.exportWithBackground, 
        withTheme: this.settings.exportWithTheme
      }
      let svg = ExcalidrawView.getSVG(getJSON(content),exportSettings);
      if(!svg) return null;
      svg = ExcalidrawView.embedFontsInSVG(svg);
      const img = createEl("img");
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      img.setAttribute("width",parts.fwidth);
      
      if(parts.fheight) img.setAttribute("height",parts.fheight);
      img.addClass(parts.style);
      img.setAttribute("src","data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg.outerHTML))));
      return img;
    }

    /**
     * 
     * @param el 
     * @param ctx 
     */
    const markdownPostProcessor = async (el:HTMLElement,ctx:MarkdownPostProcessorContext) => {
      const drawings = el.querySelectorAll('.internal-embed');
      let attr:imgElementAttributes={fname:"",fheight:"",fwidth:"",style:""};
      let alt:string, img:any, parts, div, file:TFile;
      for (const drawing of drawings) {
        attr.fname = drawing.getAttribute("src");
        file = this.app.metadataCache.getFirstLinkpathDest(attr.fname, ctx.sourcePath); 
        if(file && file instanceof TFile && this.isExcalidrawFile(file)) {  
          attr.fwidth   = drawing.getAttribute("width");
          attr.fheight  = drawing.getAttribute("height");
          alt = drawing.getAttribute("alt");
          if(alt == attr.fname) alt = ""; //when the filename starts with numbers followed by a space Obsidian recognizes the filename as alt-text
          attr.style = "excalidraw-svg";
          if(alt) {
            //for some reason ![]() is rendered in a DIV and ![[]] in a span by Obsidian
            //also the alt text of the DIV does not include the altext of the image
            //thus need to add an additional "|" character when its a span
            if(drawing.tagName.toLowerCase()=="span") alt = "|"+alt;
            parts = alt.match(/[^\|]*\|?(\d*)x?(\d*)\|?(.*)/);
            attr.fwidth = parts[1]? parts[1] : this.settings.width;
            attr.fheight = parts[2];
            if(parts[3]!=attr.fname) attr.style = "excalidraw-svg" + (parts[3] ? "-" + parts[3] : "");
          }
        
          attr.fname = file?.path;
          img = await getIMG(attr);
          div = createDiv(attr.style, (el)=>{
            el.append(img);
            el.setAttribute("src",file.path);
            el.setAttribute("w",attr.fwidth);
            el.setAttribute("h",attr.fheight);
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
          drawing.parentElement.replaceChild(div,drawing);
        } 
      }
    }

    this.registerMarkdownPostProcessor(markdownPostProcessor);

    /**
     * internal-link quick preview 
     * @param e 
     * @returns 
     */
    const hoverEvent = (e:any) => {
      //@ts-ignore
      if(!(e.event.ctrlKey||e.event.metaKey)) return;
      if(!e.linktext) return;
      this.hover.linkText = e.linktext;
      this.hover.sourcePath = e.sourcePath;

      const file = this.app.vault.getAbstractFileByPath(e.linktext);
      if(file && file instanceof TFile && !this.isExcalidrawFile(file)) {
          this.hover.linkText = null;
          return;
      }
      
    };
    //@ts-ignore
    this.app.workspace.on('hover-link',hoverEvent);
    this.workspaceEventHandlers.set('hover-link',hoverEvent);

    //monitoring for div.popover.hover-popover.file-embed.is-loaded to be added to the DOM tree
    this.observer = new MutationObserver((m)=>{
      if(!this.hover.linkText) return;
      if(m.length == 0) return;
      let i=0;
      //@ts-ignore      
      while(i<m.length && m[i].target?.className!="markdown-preview-sizer markdown-preview-section") i++;
      if(i==m.length) return;
      if(m[i].addedNodes.length==0) return;
      //@ts-ignore
      if(m[i].addedNodes[0].childElementCount!=2) return;
      //@ts-ignore
      if(m[i].addedNodes[0].firstElementChild.className.indexOf("frontmatter")==-1) return;
      //@ts-ignore
      if(m[i].addedNodes[0].firstElementChild?.firstElementChild?.className=="excalidraw-svg") return;
      
      const file = this.app.metadataCache.getFirstLinkpathDest(this.hover.linkText, this.hover.sourcePath?this.hover.sourcePath:""); 
      if(file) {  
        //this div will be on top of original DIV. By stopping the propagation of the click
        //I prevent the default Obsidian feature of openning the link in the native app
        const div = createDiv("",async (el)=>{
          const img = await getIMG({fname:file.path,fwidth:"300",fheight:null,style:"excalidraw-svg"});
          el.appendChild(img);
          el.setAttribute("src",file.path);
          el.onClickEvent((ev)=>{
            ev.stopImmediatePropagation();
            let src = el.getAttribute("src");
            if(src) this.openDrawing(this.app.vault.getAbstractFileByPath(src) as TFile,ev.ctrlKey||ev.metaKey);
          });
        });
        m[i].addedNodes[0].insertBefore(div,m[i].addedNodes[0].firstChild)
      }
    });
    this.observer.observe(document, {childList: true, subtree: true});
  }

  private registerCommands() {
    this.openDialog = new OpenFileDialog(this.app, this);

    this.addRibbonIcon(ICON_NAME, t("CREATE_NEW"), async (e) => {
      this.createDrawing(this.getNextDefaultFilename(), e.ctrlKey||e.metaKey);
    });
  
    const fileMenuHandler = (menu: Menu, file: TFile) => {
      if (file instanceof TFolder) {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CREATE_NEW"))
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
      name: t("OPEN_EXISTING_NEW_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, true);
      },
    });

    this.addCommand({
      id: "excalidraw-open-on-current",
      name: t("OPEN_EXISTING_ACTIVE_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, false);
      },
    });

    this.addCommand({
      id: "excalidraw-insert-transclusion",
      name: t("TRANSCLUDE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == "markdown";
        } else {
          this.openDialog.start(openDialogAction.insertLinkToDrawing, false);
          return true;
        }
      },
    });

    this.addCommand({
      id: "excalidraw-insert-last-active-transclusion",
      name: t("TRANSCLUDE_MOST_RECENT"),
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
      name: t("NEW_IN_NEW_PANE"),
      callback: () => {
        this.createDrawing(this.getNextDefaultFilename(), true);
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-on-current",
      name: t("NEW_IN_ACTIVE_PANE"),
      callback: () => {
        this.createDrawing(this.getNextDefaultFilename(), false);
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed",
      name: t("NEW_IN_NEW_PANE_EMBED"),
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
      name: t("NEW_IN_ACTIVE_PANE_EMBED"),
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
      id: "export-svg",
      name: t("EXPORT_SVG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            view.saveSVG();
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: "export-png",
      name: t("EXPORT_PNG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            view.savePNG();
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: "toggle-lock",
      hotkeys: [{modifiers:["Ctrl" || "Meta"], key:"e"}],
      name: t("TOGGLE_LOCK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            view.lock(!view.isTextLocked);
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: "insert-link",
      hotkeys: [{modifiers:["Ctrl" || "Meta"], key:"k"}],
      name: t("INSERT_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return (view instanceof ExcalidrawView);
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            this.openDialog.insertLink(view.file.path,view.addText);
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: "insert-LaTeX-symbol",
      name: t("INSERT_LATEX"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            const prompt = new Prompt(this.app, t("ENTER_LATEX"),'');
            prompt.openAndGetValue( async (formula:string)=> {
              if(!formula) return;
              const el = createEl('p');
              await MarkdownRenderer.renderMarkdown(formula,el,'',this)
              view.addText(el.getText());
              el.empty();
            });
            return true;
          }
          else return false;
        }
      },
    });

    this.addCommand({
      id: "toggle-excalidraw-view",
      name: t("TOGGLE_MODE"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return false;
        const fileIsExcalidraw = this.isExcalidrawFile(activeFile);

        if (checking) {
          return fileIsExcalidraw;
        }

        const activeLeaf = this.app.workspace.activeLeaf;

        if (activeLeaf?.view && activeLeaf.view instanceof ExcalidrawView) {
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            "markdown";
          this.setMarkdownView(activeLeaf);
        } else if (fileIsExcalidraw) {
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            VIEW_TYPE_EXCALIDRAW;
          this.setExcalidrawView(activeLeaf);
        }
      },
    });

    this.addCommand({
      id: "convert-to-excalidraw",
      name: t("CONVERT_NOTE_TO_EXCALIDRAW"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        const activeLeaf = this.app.workspace.activeLeaf;

        if (!activeFile || !activeLeaf) return false;

        const isFileEmpty = activeFile.stat.size === 0;

        if (checking) return isFileEmpty;
        if (isFileEmpty) {
          (async()=>{
            await this.app.vault.modify(activeFile, await this.getBlankDrawing());
            this.setExcalidrawView(activeLeaf);  
          })();
        }
      },
    });
   
    /*1.2 migration command */
    this.addCommand({
      id: "migrate-to-1.2.x",
      name: t("MIGRATE_TO_2"),
      callback: async () => {
        const files = this.app.vault.getFiles().filter((f)=>f.extension=="excalidraw");
        for (const file of files) {
          const data = await this.app.vault.read(file);
          const fname = this.getNewUniqueFilepath(file.name+'.md',normalizePath(file.path.substr(0,file.path.lastIndexOf(file.name))));
          console.log(fname);
          await this.app.vault.create(fname,FRONTMATTER + exportSceneToMD(data));
          this.app.vault.delete(file);
        }
      }
    });
  }
  
  private registerMonkeyPatches() {
    const self = this;

    // Monkey patch WorkspaceLeaf to open Excalidraw drawings with ExcalidrawView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        // Drawings can be viewed as markdown or Excalidraw, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(next) {
          return function () {
            const state = this.view?.getState();

            if (state?.file && self.excalidrawFileModes[this.id || state.file]) {
              delete self.excalidrawFileModes[this.id || state.file];
            }

            return next.apply(this);
          };
        },

        setViewState(next) {
          return function (state: ViewState, ...rest: any[]) {
            if (
              // Don't force excalidraw mode during shutdown
              self._loaded &&
              // If we have a markdown file
              state.type === "markdown" &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              self.excalidrawFileModes[this.id || state.state.file] !== "markdown"
            ) {
              // Then check for the excalidraw frontMatterKey
              const cache = self.app.metadataCache.getCache(state.state.file);
              
              if (cache?.frontmatter && cache.frontmatter[FRONTMATTER_KEY]) {
                // If we have it, force the view type to excalidraw
                const newState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                self.excalidrawFileModes[state.state.file] = VIEW_TYPE_EXCALIDRAW;

                return next.apply(this, [newState, ...rest]);
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      })
    );

    // Add a menu item to go back to Excalidraw view
    this.register(
      around(MarkdownView.prototype, {
        onMoreOptionsMenu(next) {
          return function (menu: Menu) {
            const file = this.file;
            const cache = file
              ? self.app.metadataCache.getFileCache(file)
              : null;

            if (
              !file ||
              !cache?.frontmatter ||
              !cache.frontmatter[FRONTMATTER_KEY]
            ) {
              return next.call(this, menu);
            }

            menu
              .addItem((item) => {
                item
                  .setTitle(t("OPEN_AS_EXCALIDRAW"))
                  .setIcon(ICON_NAME)
                  .onClick(() => {
                    self.excalidrawFileModes[this.leaf.id || file.path] =
                    VIEW_TYPE_EXCALIDRAW;
                    self.setExcalidrawView(this.leaf);
                  });
              })
              .addSeparator();

            next.call(this, menu);
          };
        },
      })
    );
  }

  private registerEventListeners() {
    const self = this;
    this.app.workspace.onLayoutReady(async () => {

      //watch filename change to rename .svg, .png; to sync to .md; to update links
      const renameEventHandler = async (file:TAbstractFile,oldPath:string) => {
        if(!(file instanceof TFile)) return;
        if (!self.isExcalidrawFile(file)) return;
        if (!self.settings.keepInSync) return;
        ['.svg','.png'].forEach(async (ext:string)=>{
          const oldIMGpath = oldPath.substring(0,oldPath.lastIndexOf('.md')) + ext; 
          const imgFile = self.app.vault.getAbstractFileByPath(normalizePath(oldIMGpath));
          if(imgFile && imgFile instanceof TFile) {
            const newIMGpath = file.path.substring(0,file.path.lastIndexOf('.md')) + ext;
            await self.app.vault.rename(imgFile,newIMGpath); 
          }
        });
      };
      self.app.vault.on("rename",renameEventHandler);
      this.vaultEventHandlers.set("rename",renameEventHandler);

      const modifyEventHandler = async (file:TFile) => {
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        leaves.forEach((leaf:WorkspaceLeaf)=> {
          const excalidrawView = (leaf.view as ExcalidrawView); 
          if(excalidrawView.file && excalidrawView.file.path == file.path) {
            excalidrawView.reload(true,file);
          }
        });
      }
      self.app.vault.on("modify",modifyEventHandler);
      this.vaultEventHandlers.set("modify",modifyEventHandler);

      //watch file delete and delete corresponding .svg
      const deleteEventHandler = async (file:TFile) => {
        if (!(file instanceof TFile)) return;
        if (!self.isExcalidrawFile(file)) return;

        //close excalidraw view where this file is open
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        for (let i=0;i<leaves.length;i++) {
          if((leaves[i].view as ExcalidrawView).file.path == file.path) {
            await leaves[i].setViewState({type: VIEW_TYPE_EXCALIDRAW, state: {file: null}});
          }
        }   

        //delete PNG and SVG files as well
        if (self.settings.keepInSync) {
          ['.svg','.png'].forEach(async (ext:string) => {
            const imgPath = file.path.substring(0,file.path.lastIndexOf('.md')) + ext; 
            const imgFile = self.app.vault.getAbstractFileByPath(normalizePath(imgPath));
            if(imgFile && imgFile instanceof TFile) {
              await self.app.vault.delete(imgFile); 
            }
          });
        }
      }
      self.app.vault.on("delete",deleteEventHandler);
      this.vaultEventHandlers.set("delete",deleteEventHandler);

      //save open drawings when user quits the application
      const quitEventHandler = (tasks: Tasks) => {
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);      
        for (let i=0;i<leaves.length;i++) {
          (leaves[i].view as ExcalidrawView).save(); 
        }
      }
      self.app.workspace.on("quit",quitEventHandler);
      this.workspaceEventHandlers.set("quit",quitEventHandler);

      //save Excalidraw leaf and update embeds when switching to another leaf
      const activeLeafChangeEventHandler = async (leaf:WorkspaceLeaf) => {
        const activeview:ExcalidrawView = (leaf.view instanceof ExcalidrawView) ? leaf.view as ExcalidrawView : null;
        if(self.activeExcalidrawView && self.activeExcalidrawView != activeview) {
          //console.log("ExcalidrawPlugin.activeLeafChangeEventHandler()");
          await self.activeExcalidrawView.save();
          self.triggerEmbedUpdates(self.activeExcalidrawView.file?.path);
        }
        self.activeExcalidrawView = activeview;
        if(self.activeExcalidrawView) {
          self.lastActiveExcalidrawFilePath = self.activeExcalidrawView.file?.path;
        }
      };
      self.app.workspace.on("active-leaf-change",activeLeafChangeEventHandler);
      this.workspaceEventHandlers.set("active-leaf-change",activeLeafChangeEventHandler);
    });
  }

  onunload() {
    destroyExcalidrawAutomate();
    for(const key of this.vaultEventHandlers.keys()) 
      this.app.vault.off(key,this.vaultEventHandlers.get(key))
    for(const key of this.workspaceEventHandlers.keys())
      this.app.workspace.off(key,this.workspaceEventHandlers.get(key));
    this.observer.disconnect();

    const excalidrawLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    excalidrawLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });

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
    return this.settings.drawingFilenamePrefix + window.moment().format(this.settings.drawingFilenameDateTime)+'.md';
  }
 

  private async getBlankDrawing():Promise<string> {
    const template = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.templateFilePath));
    if(template && template instanceof TFile) {
      const data = await this.app.vault.read(template);
      if (data) return data;
    }
    return FRONTMATTER + '\n# Drawing\n'+ BLANK_DRAWING;
  }

  public async createDrawing(filename: string, onNewPane: boolean, foldername?: string, initData?:string) {
    const folderpath = normalizePath(foldername ? foldername: this.settings.folder);
    const folder = this.app.vault.getAbstractFileByPath(folderpath);
    if (!(folder && folder instanceof TFolder)) {
      await this.app.vault.createFolder(folderpath);
    }

    const fname = this.getNewUniqueFilepath(filename,folderpath);

    if(initData) {
      this.openDrawing(await this.app.vault.create(fname,initData),onNewPane);
      return;
    }

    this.openDrawing(await this.app.vault.create(fname,await this.getBlankDrawing()), onNewPane);
  }

  public async setMarkdownView(leaf: WorkspaceLeaf) {
    await leaf.setViewState(
      {
        type: "markdown",
        state: leaf.view.getState(),
        popstate: true,
      } as ViewState,
      { focus: true }
    );
  }

  private async setExcalidrawView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

 /**
 * Create new file, if file already exists find first unique filename by adding a number to the end of the filename
 * @param filename 
 * @param folderpath 
 * @returns 
 */
  getNewUniqueFilepath(filename:string, folderpath:string):string {      
    let fname = normalizePath(folderpath +'/'+ filename); 
    let file:TAbstractFile = this.app.vault.getAbstractFileByPath(fname);
    let i = 0;
    while(file) {
      fname = normalizePath(folderpath + '/' + filename.slice(0,filename.lastIndexOf("."))+"_"+i+filename.slice(filename.lastIndexOf(".")));
      i++;
      file = this.app.vault.getAbstractFileByPath(fname);
    }
    return fname;
  }

  isExcalidrawFile(f:TFile) {
    const fileCache = this.app.metadataCache.getFileCache(f);
    return !!fileCache?.frontmatter && !!fileCache.frontmatter[FRONTMATTER_KEY];
  }
}