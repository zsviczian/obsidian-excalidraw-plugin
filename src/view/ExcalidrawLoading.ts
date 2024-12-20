import { App, FileView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW_LOADING } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { setExcalidrawView } from "src/utils/obsidianUtils";

export function switchToExcalidraw(app: App) {
  const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW_LOADING).filter(l=>l.view instanceof ExcalidrawLoading);
  leaves.forEach(l=>(l.view as ExcalidrawLoading).switchToeExcalidraw());
}

export class ExcalidrawLoading extends FileView {
  constructor(leaf: WorkspaceLeaf, private plugin: ExcalidrawPlugin) {
    super(leaf);
    this.displayLoadingText();
  }

  public onload() {
    super.onload();
    this.displayLoadingText();
  }

  public switchToeExcalidraw() {
    setExcalidrawView(this.leaf);
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