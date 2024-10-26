import { FileView, TextFileView, View, WorkspaceLeaf } from "obsidian";
import ExcalidrawPlugin from "src/main";
import { setExcalidrawView } from "src/utils/ObsidianUtils";

export default class ExcalidrawLoading extends FileView {
  constructor(leaf: WorkspaceLeaf, private plugin: ExcalidrawPlugin) {
    super(leaf);
    this.switchToeExcalidraw();
    this.displayLoadingText();
  }

  public onload() {
    super.onload();
    this.displayLoadingText();
  }

  private async switchToeExcalidraw() {
    await this.plugin.awaitInit();
    setExcalidrawView(this.leaf);
  }
  
  getViewType(): string {
    return "excalidra-loading";
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