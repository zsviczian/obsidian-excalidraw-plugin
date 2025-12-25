import { setIcon } from "obsidian";
import { ICON_NAME } from "src/constants/constants";
import type { SidepanelTabOptions } from "src/types/excalidrawAutomateTypes";

type HostCallbacks = {
	activate: (tab: ExcalidrawSidepanelTab) => void;
	close: (tab: ExcalidrawSidepanelTab) => void;
};

type Containers = {
	tabsEl: HTMLElement;
	bodyEl: HTMLElement;
};

let tabCounter = 0;

export class ExcalidrawSidepanelTab {
	readonly id: string;
	private _scriptName?: string;
	private _title: string;
	readonly containerEl: HTMLDivElement;
	readonly modalEl: HTMLDivElement;
	readonly contentEl: HTMLDivElement;
	readonly titleEl: HTMLDivElement;
	private buttonEl: HTMLButtonElement;
	private labelEl: HTMLSpanElement;
	private iconEl: HTMLSpanElement;
	private closeEl: HTMLButtonElement;

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
		this.buttonEl.addEventListener("click", () => this.host.activate(this));
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
			this.host.close(this);
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

	public close() {
		this.host.close(this);
	}

	public setActive(active: boolean) {
		this.modalEl.toggleClass("is-active", active);
		this.buttonEl.setAttr("aria-selected", String(active));
		this.buttonEl.toggleClass("is-active", active);
	}

	public destroy() {
		this.buttonEl?.remove();
		this.modalEl?.remove();
	}
}
