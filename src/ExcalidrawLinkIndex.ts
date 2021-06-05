import {TFile,TAbstractFile, App} from 'obsidian';
import {EXCALIDRAW_FILE_EXTENSION } from './constants';

export default class ExcalidrawLinkIndex {
  private app: App;
  private link2ex: Map<string, Set<string>>;
  private ex2link: Map<string, Set<string>>;

  constructor(app: App) {
    this.app = app;
    this.link2ex = new Map<string,Set<string>>(); //file is referenced by set of excalidraw drawings
    this.ex2link = new Map<string,Set<string>>(); //excalidraw drawing references these files
  }

  async reloadIndex() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    const link2ex = new Map<string,Set<string>>(); 
    const ex2link = new Map<string,Set<string>>();
    const timeStart = new Date().getTime();
    let counter=0;

    const files = this.app.vault.getFiles().filter((f)=>f.extension==EXCALIDRAW_FILE_EXTENSION);
    for (const file of files) {
      const links = await this.parseLinks(file);
      if (links.size > 0) {
        counter += links.size;
        ex2link.set(file.path, links);
        links.forEach((link)=>{
          if(link2ex.has(link)) link2ex.set(link,link2ex.get(link).add(file.path));
          else link2ex.set(link,(new Set<string>()).add(file.path));
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

  private indexAbstractFile(file: TAbstractFile) {
    if (!(file instanceof TFile)) return;
    if (file.extension != EXCALIDRAW_FILE_EXTENSION) return;
    this.indexFile(file as TFile);
  }

  private indexFile(file: TFile) {
    this.clearIndex(file.path);
    this.parseLinks(file).then((links) => {
      if(links.size == 0) return;
      this.ex2link.set(file.path, links);
      links.forEach((link)=>{
        if(this.link2ex.has(link)) {
          this.link2ex.set(link,this.link2ex.get(link).add(file.path));
        }
        else this.link2ex.set(link,(new Set<string>()).add(file.path));
      });
    });
  }

  private clearIndex(path: string) {
    if(!this.ex2link.get(path)) return;
    this.ex2link.get(path).forEach((ex)=> {
      const files = this.link2ex.get(ex);
      files.delete(path);
      if(files.size>0) this.link2ex.set(ex,files);
      else this.link2ex.delete(ex);
    });
    this.ex2link.delete(path);
  }

  public static getLinks(textElements:any,filepath:string,app:App): Set<string>{
    const links = new Set<string>();
    if(!textElements) return links;
    let parts, f, text;
    for (const element of textElements) {
      text = element.text;
      parts = text?.matchAll(/\[\[(.+)]]/g).next();
      if(parts && parts.value) text = parts.value[1];
      if(!text?.match(/^\w+:\/\//) && !text?.match(/[<>:"\\|?*]/g)) { //not a hyperlink and not invalid filename
        f = app.metadataCache.getFirstLinkpathDest(text,filepath); 
        if(f) {
          links.add(f.path);
        }
      }
    }
    return links;
  }

  private async parseLinks(file: TFile): Promise<Set<string>> {
    const fileContents = await this.app.vault.cachedRead(file);
    const textElements = JSON.parse(fileContents)?.elements?.filter((el:any)=> el.type=="text");
    return ExcalidrawLinkIndex.getLinks(textElements,file.path,this.app);
  }

  private registerEventHandlers() {
    this.app.vault.on('create', (file: TAbstractFile) => {
      this.indexAbstractFile(file);
    });
    this.app.vault.on('modify', (file: TAbstractFile) => {
      this.indexAbstractFile(file);
    });
    this.app.vault.on('delete', (file: TAbstractFile) => {
      this.clearIndex(file.path);
    });
    // We could simply change the references to the old path, but parsing again does the trick as well
    this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
      this.clearIndex(oldPath);
      this.indexAbstractFile(file);
    });
  }
}