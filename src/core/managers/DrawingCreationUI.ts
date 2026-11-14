import { Component, setIcon, type WorkspaceLeaf } from "obsidian";
import type ExcalidrawPlugin from "../main";
import { ICON_NAME } from "src/constants/constants";
import { t } from "src/lang/helpers";
import { getDrawingFilename } from "src/utils/fileUtils";
import { hideElement, showElement } from "src/utils/styleUtils";
import { errorlog } from "src/utils/coreUtils";

/** Own the optional empty-tab action and ribbon visibility for one plugin lifetime. */
export class DrawingCreationUI extends Component {
  private ribbon: HTMLElement | null = null;
  private entries = new Map<WorkspaceLeaf, { list: HTMLElement; owner: Component }>();
  private active = false;

  constructor(
    private readonly plugin: ExcalidrawPlugin,
    private readonly onRibbonClick: (event: MouseEvent) => void,
  ) { super(); }

  onload(): void {
    this.active = true;
    this.registerEvent(this.plugin.app.workspace.on("layout-change", () => this.refresh()));
    this.plugin.app.workspace.onLayoutReady(() => this.refresh());
  }

  /** Apply live settings without rebuilding the settings page or touching other plugins' actions. */
  refresh(): void {
    if (!this.active || !this.plugin.settings) return;
    if (!this.ribbon) this.ribbon = this.plugin.addRibbonIcon(ICON_NAME, t("CREATE_NEW"), this.onRibbonClick);
    if (this.plugin.settings.showRibbonIcon) showElement(this.ribbon);
    else hideElement(this.ribbon);

    const leaves = this.plugin.settings.showNewDrawingInEmptyTab
      ? this.plugin.app.workspace.getLeavesOfType("empty") : [];
    for (const [leaf, entry] of this.entries) {
      if (!leaves.includes(leaf) || !leaf.view.containerEl.contains(entry.list)) {
        entry.owner.unload(); this.entries.delete(leaf);
      }
    }
    for (const leaf of leaves) {
      if (this.entries.has(leaf)) continue;
      // Obsidian 1.8.7+ renders this list in EmptyView. If a future host changes
      // it, omit the optional action rather than altering unrelated view DOM.
      const list = leaf.view.containerEl.querySelector<HTMLElement>(".empty-state-action-list");
      if (!list) continue;
      const owner = new Component(); owner.load();
      const button = list.createEl("button", {
        cls: "text-icon-button mod-pill empty-state-action excalidraw-new-drawing",
        attr: { type: "button" },
      });
      setIcon(button.createSpan({ cls: "text-button-icon" }), ICON_NAME);
      button.createSpan({ cls: "text-button-label", text: t("NEW_DRAWING_EMPTY_TAB") });
      let pending = false;
      owner.registerDomEvent(button, "click", () => {
        if (pending || !this.active || !this.plugin.isReady ||
            !this.plugin.settings.showNewDrawingInEmptyTab || leaf.view.getViewType() !== "empty") return;
        pending = true; button.disabled = true;
        this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
        // Same folder, format and template-selection path as the existing command.
        void this.plugin.createAndOpenDrawing(getDrawingFilename(this.plugin.settings), "active-pane")
          .catch((error: unknown) => errorlog({ where: "DrawingCreationUI.createAndOpenDrawing", error }))
          .finally(() => { pending = false; button.disabled = false; });
      });
      // EmptyView rebuilds this list when core plugins are enabled/disabled.
      // Observe only that list, and reattach the same owned action once.
      const observer = new list.ownerDocument.defaultView.MutationObserver(() => {
        if (this.active && this.plugin.settings.showNewDrawingInEmptyTab && !list.contains(button)) list.append(button);
      });
      observer.observe(list, { childList: true });
      owner.register(() => { observer.disconnect(); button.remove(); });
      this.entries.set(leaf, { list, owner });
    }
  }

  onunload(): void {
    this.active = false;
    for (const entry of this.entries.values()) entry.owner.unload();
    this.entries.clear(); this.ribbon?.remove(); this.ribbon = null;
  }
}
