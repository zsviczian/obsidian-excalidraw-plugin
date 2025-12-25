import type { CloseableComponent } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { getLastActiveExcalidrawView } from "src/utils/excalidrawAutomateUtils";
import type { SidepanelTabOptions } from "src/types/excalidrawAutomateTypes";
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

export class ExcalidrawSidepanelTab implements CloseableComponent {
	readonly id: string;
	private _scriptName?: string;
	private _title: string;
	readonly containerEl: HTMLDivElement;
	readonly modalEl: HTMLDivElement;
	readonly contentEl: HTMLDivElement;
	readonly titleEl: HTMLDivElement;
	public shouldRestoreSelection = false;
	private closeCallback?: () => any;
	private isClosed = false;
	private isActive = false;
	public onFocus: (view: ExcalidrawView | null) => void = () => {};

  /**
   * Called by ScriptEngine when the Excalidraw view associated with the ExcalidrawAutomate object for this sidepanel tab is closed and ea.targetView becomes null.
   */
  public onExcalidrawViewClosed: () => void = () => {};

	constructor(
    title: string,
		private host: HostCallbacks,
		private containers: Containers,
		scriptName?: string,
		options?: SidepanelTabOptions,
	) {
		this._scriptName = scriptName;
		this._title = title;
		this.id = `excalidraw-sidepanel-tab-${++tabCounter}`;
		this.modalEl = this.containers.bodyEl.createDiv({ cls: "excalidraw-sidepanel-tab" });
		this.modalEl.id = this.id;
		this.containerEl = this.modalEl;
		this.titleEl = this.modalEl.createDiv({ cls: "excalidraw-sidepanel-tab__label" });
		this.contentEl = this.modalEl.createDiv({ cls: "excalidraw-sidepanel-tab__content" });
		this.applyOptions(title, options);
	}

	public get scriptName(): string | undefined {
		return this._scriptName;
	}

	public get title(): string {
		return this._title;
	}

	public setScriptName(scriptName?: string) {
		this._scriptName = scriptName;
	}

	private applyOptions(title: string, options?: SidepanelTabOptions) {
		this.setTitle(title);
		this.clear();
	}

	public reset(title: string, options?: SidepanelTabOptions) {
		this.applyOptions(title, options);
	}

	public clear() {
		this.contentEl.empty();
	}

	public setTitle(title: string) {
		this._title = title;
		this.titleEl.setText(title);
		this.host.updateTitle?.(this);
		return this;
	}

	public setContent(content: string | DocumentFragment) {
		this.clear();
		if (typeof content === "string") {
			this.contentEl.setText(content);
		} else {
			this.contentEl.append(content);
		}
		return this;
	}

	public setCloseCallback(callback: () => any) {
		this.closeCallback = callback;
		return this;
	}

	public setIcon(_iconId?: string) {}

	public focus() {
		this.host.activate(this);
	}

	public open() {
		this.isClosed = false;
		this.host.activate(this);
		void this.onOpen();
	}

	public close() {
		this.runCloseHandlers();
		this.host.close(this);
	}

	public onOpen(): Promise<void> | void {}

	public onClose(): void {}

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

	public notifyWillClose() {
		this.runCloseHandlers();
	}

	public handleFocus(view?: ExcalidrawView | null) {
		this.runFocusHandlers(view);
	}

	public destroy() {
		this.modalEl?.remove();
	}

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
		if (this.closeCallback) {
			this.closeCallback();
		}
		this.onClose();
	}

	private runFocusHandlers(view?: ExcalidrawView | null) {
		if (this.isClosed) {
			return;
		}
		this.onFocus(view ?? this.getLastActiveView());
	}

	private getLastActiveView(): ExcalidrawView | null {
		return getLastActiveExcalidrawView(this.host.plugin) ?? null;
	}
}
