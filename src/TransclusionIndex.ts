import {Vault,TFile,TAbstractFile} from 'obsidian';

class TransclusionItem {
  public excalidrawFilePath: string;
  public sourceFilePath: string;
  public startIndex: number;
  public length: number;

  constructor(excalidrawFilePath: string, sourceFilePath: string, startIndex: number, length: number ) {
    this.excalidrawFilePath = excalidrawFilePath;
    this.sourceFilePath = sourceFilePath;
    this.startIndex = startIndex;
    this.length = length;
  }
}

class TransclusionIndex {
  private vault: Vault;
  private transclusions: Map<string, TransclusionItem[]>;
  private listeners: ((transclusions: TransclusionItem[]) => void)[];

  constructor(vault: Vault, listener: (todos: TransclusionItem[]) => void) {
    this.vault = vault;
    this.transclusions = new Map<string, TransclusionItem[]>();
    this.listeners = [listener];
  }

  async reloadIndex() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    // TODO: persist index & last sync timestamp; only parse files that changed since then.
    const transclusionMap = new Map<string, TransclusionItem[]>();
    let numberOfTransclusions = 0;

    const markdownFiles = this.vault.getMarkdownFiles();
    for (const file of markdownFiles) {     
      const transclusions = await this.parseTransclusionsInFile(file);
      numberOfTransclusions += transclusions.length;
      if (transclusions.length > 0) {
        transclusionMap.set(file.path, transclusions);
      }
    }

    this.transclusions = transclusionMap;
    this.registerEventHandlers();
    this.invokeListeners();
  }

  updateTransclusion(transclusion: TransclusionItem, newFilePath: string): void {
    const file = this.vault.getAbstractFileByPath(transclusion.sourceFilePath) as TFile;
    const fileContents = this.vault.read(file);
    fileContents.then((c: string) => {
      const newContents = c.substring(0, transclusion.startIndex) + newFilePath + c.substring(transclusion.startIndex + transclusion.length);
      this.vault.modify(file, newContents);
    });
  }

  private indexAbstractFile(file: TAbstractFile) {
    if (!(file instanceof TFile)) {
      return;
    }
    this.indexFile(file as TFile);
  }

  private indexFile(file: TFile) {
    this.parseTransclusionsInFile(file).then((transclusions) => {
      this.transclusions.set(file.path, transclusions);
      this.invokeListeners();
    });
  }

  private clearIndex(path: string, silent = false) {
    this.transclusions.delete(path);
    if (!silent) {
      this.invokeListeners();
    }
  }

  private async parseTransclusionsInFile(file: TFile): Promise<TransclusionItem[]> {
    const transclusionParser = new TransclusionParser();
    const fileContents = await this.vault.cachedRead(file);
    return transclusionParser.parseTransclusions(file.path, fileContents);
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

  private invokeListeners() {
    const transclusions = ([] as TransclusionItem[]).concat(...Array.from(this.transclusions.values()));
    this.listeners.forEach((listener) => listener(transclusions));
  }
}

export class TransclusionParser {
  constructor() {    
  }

  async parseTransclusions(filePath: string, fileContents: string): Promise<TransclusionItem[]> {
    const pattern =  new RegExp('('+String.fromCharCode(96,96,96)+'excalidraw\\s+.*\\[{2})([^|\\]]*).*\\]{2}[\\s]+'+String.fromCharCode(96,96,96),'gm');
    return [...fileContents.matchAll(pattern)].map((transclusion) => this.parseTransclusion(filePath, transclusion));
  }

  private parseTransclusion(filePath: string, entry: RegExpMatchArray): TransclusionItem {
    const offset = entry[1].length;
    const excalidrawFilePath = entry[2];
    if(!excalidrawFilePath && !excalidrawFilePath.endsWith('.excalidraw')) {
      return null;
    }

    return new TransclusionItem(
      excalidrawFilePath,
      filePath,
      (entry.index ?? 0) + offset,
      excalidrawFilePath.length,
    );
  }
}
