import { setIcon, type CloseableComponent } from "obsidian";
import { ICON_NAME } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { getLastActiveExcalidrawView } from "src/utils/excalidrawAutomateUtils";
import type { SidepanelTabOptions } from "src/types/excalidrawAutomateTypes";
import ExcalidrawView from "src/view/ExcalidrawView";

type HostCallbacks = {
	activate: (tab: ExcalidrawSidepanelTab) => void;
	close: (tab: ExcalidrawSidepanelTab) => void;
	plugin: ExcalidrawPlugin;
};

type Containers = {
	tabsEl: HTMLElement;
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
	private buttonEl: HTMLButtonElement;
	private labelEl: HTMLSpanElement;
	private iconEl: HTMLSpanElement;
	private closeEl: HTMLButtonElement;
	private closeCallback?: () => any;
	private isClosed = false;
	private isActive = false;
	public onFocus: (view: ExcalidrawView | null) => void = () => {};

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
		this.buttonEl = this.createButton();
		this.buttonEl.setAttr("aria-controls", this.id);
		this.applyOptions(title, options);
		this.buttonEl.addEventListener("click", () => this.open());
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

	private createButton(): HTMLButtonElement {
		const button = this.containers.tabsEl.createEl("button", {
			cls: "excalidraw-sidepanel-tab__button",
			attr: {
				type: "button",
				role: "tab",
				"aria-selected": "false",
			},
		});
		this.iconEl = button.createSpan({ cls: "excalidraw-sidepanel-tab__icon" });
		this.labelEl = button.createSpan({ cls: "excalidraw-sidepanel-tab__button-label" });
		this.closeEl = button.createEl("button", {
			cls: "excalidraw-sidepanel-tab__close",
			attr: { type: "button", "aria-label": "Close tab" },
		});
		this.closeEl.addEventListener("click", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.close();
		});
		setIcon(this.closeEl, "x");
		return button;
	}

	private applyOptions(title: string, options?: SidepanelTabOptions) {
		this.setTitle(title);
		this.setIcon(options?.icon ?? ICON_NAME);
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
		this.labelEl.setText(title);
		this.buttonEl.setAttr("aria-label", title);
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

	public setIcon(iconId?: string) {
		this.iconEl.empty();
		if (iconId) {
			setIcon(this.iconEl, iconId);
			this.iconEl.removeClass("is-hidden");
		} else {
			this.iconEl.addClass("is-hidden");
		}
	}

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
		this.buttonEl.setAttr("aria-selected", String(active));
		this.buttonEl.toggleClass("is-active", active);
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
		this.buttonEl?.remove();
		this.modalEl?.remove();
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
