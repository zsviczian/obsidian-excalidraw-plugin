import { Modal, Setting, TFile } from "obsidian";
import ExcalidrawPlugin from "src/main";
import { getIMGFilename } from "src/utils/FileUtils";
import { addIframe } from "src/utils/Utils";

const haveLinkedFilesChanged = (depth: number, mtime: number, path: string, sourceList: Set<string>, plugin: ExcalidrawPlugin):boolean  => {
  if(depth++ > 5) return false;
  sourceList.add(path);
  const links = plugin.app.metadataCache.resolvedLinks[path];
  if(!links) return false;
  for(const link of Object.keys(links)) {
    if(sourceList.has(link)) continue;
    const file = plugin.app.vault.getAbstractFileByPath(link);
    if(!file || !(file instanceof TFile)) continue;
    console.log(path, {mtimeLinked: file.stat.mtime, mtimeSource: mtime, path: file.path});
    if(file.stat.mtime > mtime) return true;
    if(plugin.isExcalidrawFile(file)) {
      if(haveLinkedFilesChanged(depth, mtime, file.path, sourceList, plugin)) return true;
    }
  }
  return false;
}

const listOfOutOfSyncSVGExports = async(plugin: ExcalidrawPlugin, recursive: boolean):Promise<TFile[]> => {
  const app = plugin.app;

  const publish = app.internalPlugins.plugins["publish"].instance;
  if(!publish) return;
  const list = await app.internalPlugins.plugins["publish"].instance.apiList();
  if(!list || !list.files) return;
  const outOfSyncFiles = new Set<TFile>();
  list.files.filter((f:any)=>f.path.endsWith(".svg")).forEach((f:any)=>{
    const maybeExcalidraFilePath = getIMGFilename(f.path,"md");
    const svgFile = app.vault.getAbstractFileByPath(f.path);
    const excalidrawFile = app.vault.getAbstractFileByPath(maybeExcalidraFilePath);
    if(!excalidrawFile || !svgFile || !(excalidrawFile instanceof TFile) || !(svgFile instanceof TFile)) return;
    console.log(excalidrawFile, {mtimeEx: excalidrawFile.stat.mtime, mtimeSVG: svgFile.stat.mtime});
    if(excalidrawFile.stat.mtime <= svgFile.stat.mtime) {
      if(!recursive) return;
      if(!haveLinkedFilesChanged(0, excalidrawFile.stat.mtime, excalidrawFile.path, new Set<string>(), plugin)) return;
    }
    outOfSyncFiles.add(excalidrawFile);
  });
  return Array.from(outOfSyncFiles);
}

export class PublishOutOfDateFilesDialog extends Modal {
  constructor(
    private plugin: ExcalidrawPlugin,
  ) {
    super(plugin.app);
  }

  async onClose() {}

  onOpen() {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(`Out of Date SVG Files`); 
    this.createForm(false);
  }

  async createForm(recursive: boolean) {
    const detailsEl = this.contentEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: "Video about Obsidian Publish support",
    });
    addIframe(detailsEl, "OX5_UYjXEvc");

    const p = this.contentEl.createEl("p",{text: "Collecting data..."});
    const files = await listOfOutOfSyncSVGExports(this.plugin, recursive);

    if(!files || files.length === 0) {
      p.innerText = "No out of date files found.";
      const div = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});
      const bClose = div.createEl("button", { text: "Close", cls: "excalidraw-prompt-button"});
      bClose.onclick = () => {
        this.close();
      };
      if(!recursive) {
        const bRecursive = div.createEl("button", { text: "Check Recursive", cls: "excalidraw-prompt-button"});
        bRecursive.onclick = () => {
          this.contentEl.empty();
          this.createForm(true);
        };
      }
      return;
    }

    const filesMap = new Map<TFile,boolean>();
    p.innerText = "Select files to open.";
    files.forEach((f:TFile) => {
      filesMap.set(f,true);
      new Setting(this.contentEl)
        .setName(f.path)
        .addToggle(toggle => toggle
          .setValue(true)
          .onChange(value => {
            filesMap.set(f,value);
          })
        )
    });

    const div = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});
    const bClose = div.createEl("button", { text: "Close", cls: "excalidraw-prompt-button"});
    bClose.onclick = () => {
      this.close();
    };
    if(!recursive) {
      const bRecursive = div.createEl("button", { text: "Check Recursive", cls: "excalidraw-prompt-button"});
      bRecursive.onclick = () => {
        this.contentEl.empty();
        this.createForm(true);
      };
    }
    const bOpen = div.createEl("button", { text: "Open Selected", cls: "excalidraw-prompt-button" });
    bOpen.onclick = () => {
      filesMap.forEach((value:boolean,key:TFile) => {
        if(value) {
          this.plugin.openDrawing(key,"new-tab",true);
        }
      });
      this.close();
    };
  }
}
