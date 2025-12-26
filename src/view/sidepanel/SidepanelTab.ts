import type { CloseableComponent } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { getLastActiveExcalidrawView } from "src/utils/excalidrawAutomateUtils";
import type { SidepanelTab as SidepanelTabType } from "src/types/sidepanelTabTypes";
import ExcalidrawView from "src/view/ExcalidrawView";

type HostCallbacks = {
	activate: (tab: ExcalidrawSidepanelTab) => void;
	close: (tab: ExcalidrawSidepanelTab) => void;
	updateTitle?: (tab: ExcalidrawSidepanelTab) => void;
	plugin: ExcalidrawPlugin;
};

type Containers = {
	bodyEl: HTMLElement;
};

let tabCounter = 0;

export class ExcalidrawSidepanelTab implements CloseableComponent, SidepanelTabType {
	readonly id: string;
	private _scriptName?: string;
	private _title: string;
	readonly containerEl: HTMLDivElement;
	readonly modalEl: HTMLDivElement;
	readonly contentEl: HTMLDivElement;
	readonly titleEl: HTMLDivElement;
	private isClosed = false;
	private isActive = false;
	public onFocus: (view: ExcalidrawView | null) => void = () => {};

  /**
   * Called by ScriptEngine when the Excalidraw view associated with the ExcalidrawAutomate object for this sidepanel tab is closed and ea.targetView becomes null.
   */
  public onExcalidrawViewClosed: () => void = () => {};

	/**
	 * Creates a sidepanel tab instance bound to a host view and container elements.
	 * The tab manages its own DOM nodes (label + content) and delegates lifecycle events back to the host.
	 */
	constructor(
    title: string,
		private host: HostCallbacks,
		private containers: Containers,
		scriptName?: string,
	) {
		this._scriptName = scriptName;
		this._title = title;
		this.id = `excalidraw-sidepanel-tab-${++tabCounter}`;
		this.modalEl = this.containers.bodyEl.createDiv({ cls: "excalidraw-sidepanel-tab" });
		this.modalEl.id = this.id;
		this.containerEl = this.modalEl;
		this.titleEl = this.modalEl.createDiv({ cls: "excalidraw-sidepanel-tab__label" });
		this.contentEl = this.modalEl.createDiv({ cls: "excalidraw-sidepanel-tab__content" });
		this.setTitle(title);
	}

	public get scriptName(): string | undefined {
		return this._scriptName;
	}

	public get title(): string {
		return this._title;
	}

	/**
	 * Assigns a script name used for persistence and lookup without altering the title.
   * This is used by ExcalidrawSidpanel when creating or restoring tabs.
   * Not intended for public use by EA scripts.
	 */
	public setScriptName(scriptName?: string) {
		this._scriptName = scriptName;
	}

	/**
	 * Removes all child nodes from the content container.
	 */
	public clear() {
		this.contentEl.empty();
	}

  public reset(title: string) {
    this.setTitle(title);
    this.clear();
  }

	/**
	 * Updates the tab title label and notifies the host to refresh any UI affordances.
	 */
	public setTitle(title: string) {
		this._title = title;
		this.titleEl.setText(title);
		this.host.updateTitle?.(this);
		return this;
	}

	/**
	 * Replaces the tab content with the provided text or fragment.
	 */
	public setContent(content: string | DocumentFragment) {
		this.clear();
		if (typeof content === "string") {
			this.contentEl.setText(content);
		} else {
			this.contentEl.append(content);
		}
		return this;
	}

	/**
	 * Activates the tab within the host sidepanel.
	 */
	public focus() {
		this.host.activate(this);
	}

	/**
	 * Marks the tab as open/active and triggers its onOpen lifecycle hook.
	 */
	public open() {
		this.isClosed = false;
		this.host.activate(this);
		void this.onOpen();
	}

	/**
	 * Closes the tab via host, firing close handlers first.
	 */
	public close() {
		this.runCloseHandlers();
		this.host.close(this);
	}

	public onOpen(): Promise<void> | void {}

	public onClose(): void {}

	/**
	 * Flags the tab as active/inactive and triggers focus/onOpen when becoming active.
   * This function is called by ExcalidrawSidepanel when the tab's active state changes.
   * Not intended for public use by EA scripts.
	 */
	public setActive(active: boolean) {
		const becameActive = active && !this.isActive;
		this.isActive = active;
		this.modalEl.toggleClass("is-active", active);
		if (becameActive) {
			const view = this.getLastActiveView();
			void this.onOpen();
			this.runFocusHandlers(view);
		}
	}

	/**
	 * Signals the tab will close soon and runs close handlers once.
   * This function is called by ExcalidrawSidepanel when the user attempts to close the tab.
   * Not intended for public use by EA scripts.
	 */
	public notifyWillClose() {
		this.runCloseHandlers();
	}

	/**
	 * Invokes focus handlers with the provided or last active Excalidraw view.
   * This is called by ExcalidrawSidepanel when the tab gains focus.
   * Not intended for public use by EA scripts.
	 */
	public handleFocus(view?: ExcalidrawView | null) {
		this.runFocusHandlers(view);
	}

	/**
	 * Removes DOM nodes and releases references.
   * This is called by ExcalidrawSidepanel when the tab is being destroyed.
   * Not intended for public use by EA scripts.
	 */
	public destroy() {
		this.modalEl?.remove();
	}

	/**
	 * Toggles pointer interactivity and visual opacity for the tab content.
	 */
	public setDisabled(disabled: boolean) {
		this.contentEl.style.pointerEvents = disabled ? "none" : "";
		this.contentEl.style.opacity = disabled ? "0.5" : "";
		return this;
	}

	private runCloseHandlers() {
		if (this.isClosed) {
			return;
		}
		this.isClosed = true;
		this.onClose();
	}

	private runFocusHandlers(view?: ExcalidrawView | null) {
		if (this.isClosed) {
			return;
		}
		this.onFocus(view ?? this.getLastActiveView());
	}

	/**
	 * Resolves the last active Excalidraw view from the plugin host.
	 */
	private getLastActiveView(): ExcalidrawView | null {
		return getLastActiveExcalidrawView(this.host.plugin) ?? null;
	}
}
