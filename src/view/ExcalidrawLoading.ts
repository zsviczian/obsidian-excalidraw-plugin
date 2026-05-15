import { App, FileView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW_LOADING } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { setElementDisplay } from "src/utils/htmlUtils";
import { isUnwantedLeaf, setExcalidrawView } from "src/utils/obsidianUtils";

export async function switchToExcalidraw(app: App) {
  const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW_LOADING);
  for (const leaf of leaves) {
    await (leaf.view as ExcalidrawLoading)?.switchToeExcalidraw();
  }
}

export class ExcalidrawLoading extends FileView {
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: ExcalidrawPlugin,
  ) {
    super(leaf);
  }

  public onload() {
    super.onload();
    this.displayLoadingText();
  }

  public async switchToeExcalidraw() {
    const prevLeaf = this.app.workspace.activeLeaf;
    await setExcalidrawView(this.leaf);
    await sleep(100); // added this 2026.04.19 after instances where the hack did not seem to work, but wasn't able to reliably reproduce. This timeout does not seem to cause any issues and may help in cases where the hack was not working due to some sort of race condition
    const activeLeaf = this.app.workspace.activeLeaf;
    if (
      prevLeaf === this.leaf &&
      activeLeaf !== prevLeaf &&
      isUnwantedLeaf(activeLeaf)
    ) {
      activeLeaf.detach();
    }
  }

  getViewType(): string {
    return VIEW_TYPE_EXCALIDRAW_LOADING;
  }

  getDisplayText() {
    return `Loading Excalidraw... ${this.file?.basename ?? ""}`;
  }

  private displayLoadingText() {
    // Create a div element for displaying the text
    const loadingTextEl = this.contentEl.createEl("div", {
      text: this.getDisplayText(),
    });

    // Apply styling to center the text
    setElementDisplay(loadingTextEl, "flex");
    loadingTextEl.style.alignItems = "center";
    loadingTextEl.style.justifyContent = "center";
    loadingTextEl.style.height = "100%";
    loadingTextEl.style.fontSize = "1.5em"; // Adjust size as needed
  }
}
