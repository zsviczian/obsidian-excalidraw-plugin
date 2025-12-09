import { App, FileView, WorkspaceLeaf } from "obsidian";
import { act } from "react";
import { DEVICE, VIEW_TYPE_EXCALIDRAW_LOADING } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { isUnwantedLeaf, setExcalidrawView } from "src/utils/obsidianUtils";

export async function switchToExcalidraw(app: App) {
  const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW_LOADING);
  for(const leaf of leaves) {
    await (leaf.view as ExcalidrawLoading)?.switchToeExcalidraw();
  }
}

export class ExcalidrawLoading extends FileView {
  constructor(leaf: WorkspaceLeaf, private plugin: ExcalidrawPlugin) {
    super(leaf);
  }

  public onload() {
    super.onload();
    this.displayLoadingText();
  }

  public async switchToeExcalidraw() {
    const prevLeaf = this.app.workspace.activeLeaf;
    await setExcalidrawView(this.leaf);
    const activeLeaf = this.app.workspace.activeLeaf;
    if(prevLeaf === this.leaf && activeLeaf !== prevLeaf && isUnwantedLeaf(activeLeaf)) {
      this.app.workspace.activeLeaf.detach();
    }
  }
  
  getViewType(): string {
    return VIEW_TYPE_EXCALIDRAW_LOADING;
  }

  getDisplayText() {
    return "Loading Excalidraw... " + (this.file?.basename ?? "");
  }

  private displayLoadingText() {
    // Create a div element for displaying the text
    const loadingTextEl = this.contentEl.createEl("div", {
      text: this.getDisplayText()
    });
    
    // Apply styling to center the text
    loadingTextEl.style.display = "flex";
    loadingTextEl.style.alignItems = "center";
    loadingTextEl.style.justifyContent = "center";
    loadingTextEl.style.height = "100%";
    loadingTextEl.style.fontSize = "1.5em"; // Adjust size as needed
  }
  
}