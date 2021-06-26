import {TFile,TAbstractFile, App} from 'obsidian';
import {EXCALIDRAW_FILE_EXTENSION, REG_LINKINDEX_BRACKETS, REG_LINKINDEX_HYPERLINK, REG_LINKINDEX_INVALIDCHARS } from './constants';
import ExcalidrawPlugin from './main';

export default class ExcalidrawLinkIndex {
  private app: App;
  private plugin: ExcalidrawPlugin;
  public link2ex: Map<string, Set<string>>;
  private ex2link: Map<string, Set<{link:string, text:string}>>;
  private vaultEventHandlers:Map<string,any>;

  constructor(plugin:ExcalidrawPlugin) {
    this.app = plugin.app;
    this.plugin = plugin;
    this.link2ex = new Map<string,Set<string>>(); //file is referenced by set of excalidraw drawings
    this.ex2link = new Map<string,Set<{link:string, text:string}>>(); //excalidraw drawing references these files
    this.vaultEventHandlers = new Map();
    const initialize = async () => {this.initialize()};
    plugin.app.workspace.onLayoutReady(initialize);
  }

  async reloadIndex() {
    this.initialize();
  }

  async initialize(): Promise<void> {
    const link2ex = new Map<string,Set<string>>(); 
    const ex2link = new Map<string,Set<{link:string,text:string}>>();
    const timeStart = new Date().getTime();
    let counter=0;

    const files = this.app.vault.getFiles().filter((f)=>f.extension==EXCALIDRAW_FILE_EXTENSION);
    for (const file of files) {
      const links = await this.parseLinks(file);
      if (links.size > 0) {
        counter += links.size;
        ex2link.set(file.path, links);
        links.forEach((link)=>{
          if(link2ex.has(link.link)) link2ex.set(link.link,link2ex.get(link.link).add(file.path));
          else link2ex.set(link.link,(new Set<string>()).add(file.path));
        });
      }
    }

    this.link2ex = link2ex;
    this.ex2link = ex2link;
    const totalTimeMs = new Date().getTime() - timeStart;
    console.log(
      `Excalidraw: Parsed ${files.length} drawings and indexed ${counter} links 
       (${totalTimeMs / 1000.0}s)`,
    );
    this.registerEventHandlers();
  }

  public indexFile(file: TFile) {
    if(file.extension != EXCALIDRAW_FILE_EXTENSION) return;
    this.clearIndex(file);
    this.parseLinks(file).then((links) => {
      if(links.size == 0) return;
      this.ex2link.set(file.path, links);
      links.forEach((link)=>{
        if(this.link2ex.has(link.link)) {
          this.link2ex.set(link.link,this.link2ex.get(link.link).add(file.path));
        }
        else this.link2ex.set(link.link,(new Set<string>()).add(file.path));
      });
    });
    //console.log("IndexFile: ", file.path, this.ex2link.get(file.path));
  }

  private clearIndex(file?: TFile,path?:string) {
    if(file && file.extension != EXCALIDRAW_FILE_EXTENSION) return;
    if(!path) path = file.path;
    if(!this.ex2link.get(path)) return;
    this.ex2link.get(path).forEach((ex)=> {
      if(!this.link2ex.has(ex.link)) return;  
      const files = this.link2ex.get(ex.link);
      files.delete(path);
      if(files.size>0) this.link2ex.set(ex.link,files);
      else this.link2ex.delete(ex.link);
    });
    this.ex2link.delete(path);
  }


  public static getLinks(textElements:any,filepath:string,app:App,validLinksOnly: boolean): Set<{link:string,text:string}>{
    const links = new Set<{link:string,text:string}>();
    if(!textElements) return links;
    let parts, f, text;
    for (const element of textElements) {
      text = element.text;
      parts = text?.matchAll(REG_LINKINDEX_BRACKETS).next();
      if(validLinksOnly) text = ''; //clear text, if it is a valid link, parts.value[1] will hold a value
      if(parts && parts.value) text = parts.value[1];
      if(text!='' && !text?.match(REG_LINKINDEX_HYPERLINK) && !text?.match(REG_LINKINDEX_INVALIDCHARS)) { //not empty, not a hyperlink and not invalid filename
        f = app.metadataCache.getFirstLinkpathDest(text,filepath); 
        if(f) {
          links.add({link:f.path,text:text});
        }
      }
    }
    return links;
  }

  private async parseLinks(file: TFile): Promise<Set<{link:string, text:string}>> {
    const fileContents = await this.app.vault.read(file);
    const textElements = JSON.parse(fileContents)?.elements?.filter((el:any)=> el.type=="text");
    return ExcalidrawLinkIndex.getLinks(textElements,file.path,this.app, this.plugin.settings.validLinksOnly);
  }

  public updateKey(oldpath:string, newpath:string) {
    if (!this.link2ex.has(oldpath)) return;
    this.link2ex.set(newpath,this.link2ex.get(oldpath));
    this.link2ex.delete(oldpath); //old link2ex will be deleted when the .excalidraw updates trigger
  }

  public getLinkTextForDrawing(drawPath:string, link:string):string {
    if(!this.ex2link.has(drawPath)) return;
    for(const item of this.ex2link.get(drawPath)) {
      if(item.link == link) return item.text;
    }
    return;
  }

  private registerEventHandlers() {

    const indexAbstractFile = (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      if (file.extension != EXCALIDRAW_FILE_EXTENSION) return;
      this.indexFile(file as TFile);
    }
    const clearIndex = (file: TFile) => {
      this.clearIndex(file);
    }
    const rename = (file:TAbstractFile, oldPath: string) => {
      if(!oldPath.endsWith("."+EXCALIDRAW_FILE_EXTENSION)) return;
      this.clearIndex(null,oldPath);
      indexAbstractFile(file);
    }

    this.app.vault.on('create', indexAbstractFile);
    this.vaultEventHandlers.set("create",indexAbstractFile);
    this.app.vault.on('modify', indexAbstractFile);
    this.vaultEventHandlers.set("modify",indexAbstractFile);
    this.app.vault.on('delete', clearIndex);
    this.vaultEventHandlers.set("delete",clearIndex);
    this.app.vault.on('rename', rename);
    this.vaultEventHandlers.set("rename",rename);
  }

  public deregisterEventHandlers() {
    for(const key of this.vaultEventHandlers.keys()) 
      this.app.vault.off(key,this.vaultEventHandlers.get(key))
  }
}