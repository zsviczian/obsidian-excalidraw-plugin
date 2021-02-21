import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_STATS_TRACKER } from "./constants";

export default class StatsTrackerView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getDisplayText() {
        return "Daily Stats";
    }

    getIcon() {
        return "calendar-with-checkmark";
    }

    getViewType() {
        return VIEW_TYPE_STATS_TRACKER;
    }

    async onOpen() {
        var modal_content = '<div id="first">Inner content</div>';
        (this as any).contentEl.innerHTML = modal_content;
    }
}