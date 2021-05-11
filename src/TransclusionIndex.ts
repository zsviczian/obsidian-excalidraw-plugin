import {Vault,TFile,TAbstractFile} from 'obsidian';

export default class TransclusionIndex {
  private vault: Vault;
  private doc2ex: Map<string, Set<string>>;
  private ex2doc: Map<string, Set<string>>;

  constructor(vault: Vault) {
    this.vault = vault;
    this.doc2ex = new Map<string,Set<string>>(); //markdown document includes these excalidraw drawings
    this.ex2doc = new Map<string,Set<string>>(); //excalidraw drawings are referenced in these markdown documents
  }

  async reloadIndex() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    const doc2ex = new Map<string,Set<string>>(); 
    const ex2doc = new Map<string,Set<string>>();
    const timeStart = new Date().getTime();

    const markdownFiles = this.vault.getMarkdownFiles();
    for (const file of markdownFiles) {
      const drawings = await this.parseTransclusionsInFile(file);
      if (drawings.size > 0) {
        doc2ex.set(file.path, drawings);
        drawings.forEach((drawing)=>{
          if(ex2doc.has(drawing)) ex2doc.set(drawing,ex2doc.get(drawing).add(file.path));
          else ex2doc.set(drawing,(new Set<string>()).add(file.path));
        });
      }
    }

    this.doc2ex = doc2ex;
    this.ex2doc = ex2doc;
    const totalTimeMs = new Date().getTime() - timeStart;
    console.log(
      `Excalidraw: Parsed ${markdownFiles.length} markdown files
       (${totalTimeMs / 1000.0}s)`,
    );
    this.registerEventHandlers();
  }

  private updateMarkdownFile(file:TFile,oldExPath:string,newExPath:string) {
    const fileContents = this.vault.read(file);
    fileContents.then((c: string) => this.vault.modify(file, c.split("[["+oldExPath).join("[["+newExPath)));
    const exlist = this.doc2ex.get(file.path);
    exlist.delete(oldExPath);
    exlist.add(newExPath);
    this.doc2ex.set(file.path,exlist);
  }

  public updateTransclusion(oldExPath: string, newExPath: string): void {
    if(!this.ex2doc.has(oldExPath)) return; //drawing is not transcluded in any markdown document
    for(const filePath of this.ex2doc.get(oldExPath)) {
      this.updateMarkdownFile(this.vault.getAbstractFileByPath(filePath) as TFile,oldExPath,newExPath);
    }
    this.ex2doc.set(newExPath, this.ex2doc.get(oldExPath));
    this.ex2doc.delete(oldExPath);
  }

  private indexAbstractFile(file: TAbstractFile) {
    if (!(file instanceof TFile)) return;
    if (file.extension.toLowerCase() != "md") return; //not a markdown document
    this.indexFile(file as TFile);
  }

  private indexFile(file: TFile) {
    this.clearIndex(file.path);
    this.parseTransclusionsInFile(file).then((drawings) => {
      if(drawings.size == 0) return;
      this.doc2ex.set(file.path, drawings);
      drawings.forEach((drawing)=>{
        if(this.ex2doc.has(drawing)) {
          this.ex2doc.set(drawing,this.ex2doc.get(drawing).add(file.path));
        }
        else this.ex2doc.set(drawing,(new Set<string>()).add(file.path));
      });
    });
  }

  private clearIndex(path: string) {
    if(!this.doc2ex.get(path)) return;
    this.doc2ex.get(path).forEach((ex)=> {
      const files = this.ex2doc.get(ex);
      files.delete(path);
      if(files.size>0) this.ex2doc.set(ex,files);
      else this.ex2doc.delete(ex);
    });
    this.doc2ex.delete(path);
  }

  private async parseTransclusionsInFile(file: TFile): Promise<Set<string>> {
    const fileContents = await this.vault.cachedRead(file);
    const pattern =  new RegExp('('+String.fromCharCode(96,96,96)+'excalidraw\\s+.*\\[{2})([^|\\]]*).*\\]{2}[\\s]+'+String.fromCharCode(96,96,96),'gm');
    const transclusions = new Set<string>();
    for(const transclusion of [...fileContents.matchAll(pattern)]) {
      if(transclusion[2] && transclusion[2].endsWith('.excalidraw'))
        transclusions.add(transclusion[2]);
    }
    return transclusions;
  }

  private registerEventHandlers() {
    this.vault.on('create', (file: TAbstractFile) => {
      this.indexAbstractFile(file);
    });
    this.vault.on('modify', (file: TAbstractFile) => {
      this.indexAbstractFile(file);
    });
    this.vault.on('delete', (file: TAbstractFile) => {
      this.clearIndex(file.path);
    });
    // We could simply change the references to the old path, but parsing again does the trick as well
    this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
      this.clearIndex(oldPath);
      this.indexAbstractFile(file);
    });
  }
}


