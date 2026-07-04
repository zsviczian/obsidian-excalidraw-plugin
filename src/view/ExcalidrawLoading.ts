import { App, FileView, WorkspaceLeaf } from "obsidian";
import {
  DEVICE,
  VIEW_TYPE_EXCALIDRAW,
} from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { setElementDisplay } from "src/utils/htmlUtils";
import { isUnwantedLeaf } from "src/utils/obsidianUtils";

export async function switchToExcalidraw(app: App) {
  const leaves: WorkspaceLeaf[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof ExcalidrawLoading) {
      leaves.push(leaf);
    }
  });
  for (const leaf of leaves) {
    await (leaf.view as ExcalidrawLoading)?.switchToExcalidraw();
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

  public async switchToExcalidraw() {
    const prevLeaf = this.app.workspace.getLeaf();
    const state = this.leaf.view.getState();

    // Force a fresh view instance: switching to the same type can be a no-op.
    await this.leaf.setViewState({
      type: "empty",
      state: {},
    });
    await this.leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state,
    });
    if (DEVICE.isDesktop) {
      return;
    }
    await sleep(100); // added this 2026.04.19 after instances where the hack did not seem to work, but wasn't able to reliably reproduce. This timeout does not seem to cause any issues and may help in cases where the hack was not working due to some sort of race condition
    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf) {
      return;
    }
    if (
      prevLeaf === this.leaf &&
      activeLeaf !== prevLeaf &&
      isUnwantedLeaf(activeLeaf)
    ) {
      activeLeaf.detach();
    }
  }

  getViewType(): string {
    return VIEW_TYPE_EXCALIDRAW;
  }

  getDisplayText() {
    return `Excalidraw is waiting for Obsidian to initialize... ${this.file?.basename ?? ""}`;
  }

  private displayLoadingText() {
    // Create a div element for displaying the text
    const loadingTextEl = this.contentEl.createDiv({
      text: this.getDisplayText(),
    });

    // Apply styling to center the text
    setElementDisplay(loadingTextEl, "flex");
    loadingTextEl.classList.add("excalidraw-loading");
  }
}
