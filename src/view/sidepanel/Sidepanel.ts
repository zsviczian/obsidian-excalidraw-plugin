import { ItemView, WorkspaceLeaf, type EventRef } from "obsidian";
import { ICON_NAME, VIEW_TYPE_SIDEPANEL } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { SidepanelTabOptions } from "src/types/excalidrawAutomateTypes";
import { getLastActiveExcalidrawView } from "src/utils/excalidrawAutomateUtils";
import { ExcalidrawSidepanelTab } from "./SidepanelTab";

type TabCreationConfig = {
  title: string;
	scriptName?: string;
	reuseExisting?: boolean;
	hostEA?: ExcalidrawAutomate;
	options?: SidepanelTabOptions;
};

export class ExcalidrawSidepanelView extends ItemView {
	private static singleton: ExcalidrawSidepanelView | null = null;
	private static restoreSilent = false;

	public static getExisting(reveal: boolean = true): ExcalidrawSidepanelView | null {
		const spView = ExcalidrawSidepanelView.singleton;
    if (spView && reveal && !ExcalidrawSidepanelView.restoreSilent) {
      spView.plugin.app.workspace.revealLeaf(spView.leaf);
    }
    return spView;
	}

	public static async getOrCreate(plugin: ExcalidrawPlugin, reveal: boolean = true): Promise<ExcalidrawSidepanelView | null> {
		const effectiveReveal = reveal && !ExcalidrawSidepanelView.restoreSilent;
		let leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEPANEL)[0];
		if (!leaf) {
			leaf = plugin.app.workspace.getRightLeaf(false);
			if (!leaf) {
				return null;
			}
			await leaf.setViewState({ type: VIEW_TYPE_SIDEPANEL, active: effectiveReveal });
		}
		const spView = leaf.view;
		if (!(spView instanceof ExcalidrawSidepanelView)) {
			return null;
		}
		if (effectiveReveal) {
			plugin.app.workspace.revealLeaf(leaf);
		}
		await spView.waitUntilReady();
		return spView;
	}

	public static onPluginUnload(plugin: ExcalidrawPlugin) {
		ExcalidrawSidepanelView.singleton = null;
		plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_SIDEPANEL);
	}

	private tabs = new Map<string, ExcalidrawSidepanelTab>();
	private scriptTabs = new Map<string, ExcalidrawSidepanelTab>();
	private tabHosts = new Map<string, ExcalidrawAutomate>();
	private persistedScripts = new Map<string, { title: string }>();
	private activeTabId: string | null = null;
	private tabsEl: HTMLDivElement | null = null;
	private bodyEl: HTMLDivElement | null = null;
	private readyPromise: Promise<void>;
	private resolveReady: (() => void) | null = null;
	private restorePromise: Promise<void> | null = null;
	private leafChangeRef: EventRef | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: ExcalidrawPlugin) {
		super(leaf);
		(plugin.settings.sidepanelTabs ?? [])
			.filter((entry) => !!entry)
			.forEach((entry) => {
				let scriptName = "";
				let title = "";
				try {
					const parsed = JSON.parse(entry);
					scriptName = parsed?.script ?? parsed?.name ?? "";
					title = parsed?.title ?? scriptName;
				} catch (e) {
					if (entry.includes("::")) {
						const [namePart, ...rest] = entry.split("::");
						scriptName = namePart;
						title = rest.join("::") || namePart;
					} else {
						scriptName = entry;
						title = entry;
					}
				}
				if (scriptName) {
					this.persistedScripts.set(scriptName, { title: title || scriptName });
				}
			});
		this.readyPromise = new Promise((resolve) => {
			this.resolveReady = resolve;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_SIDEPANEL;
	}

	getDisplayText(): string {
		return t("EXCALIDRAW_SIDEPANEL") ?? "Excalidraw Sidepanel";
	}

	getIcon(): string {
		return ICON_NAME;
	}

	protected async onOpen() {
		await super.onOpen();
		ExcalidrawSidepanelView.singleton = this;
		this.containerEl.empty();
		this.containerEl.addClass("excalidraw-sidepanel-container");
		const wrapper = this.containerEl.createDiv({ cls: "excalidraw-sidepanel" });
		this.tabsEl = wrapper.createDiv({ cls: "excalidraw-sidepanel__tabs" });
		this.tabsEl.setAttr("role", "tablist");
		this.bodyEl = wrapper.createDiv({ cls: "excalidraw-sidepanel__body" });
		this.leafChangeRef = this.app.workspace.on("active-leaf-change", (leaf) => {
			if (leaf === this.leaf) {
				this.triggerActiveTabFocus();
			}
		});
		this.resolveReady?.();
		this.resolveReady = null;
		void this.restorePersistedTabs();
	}

	protected async onClose() {
		await super.onClose();
		if (this.leafChangeRef) {
			this.app.workspace.offref(this.leafChangeRef);
			this.leafChangeRef = null;
		}
		this.tabs.forEach((tab) => tab.destroy());
		this.tabs.clear();
		this.scriptTabs.clear();
		this.activeTabId = null;
		this.tabsEl = null;
		this.bodyEl = null;
		if (ExcalidrawSidepanelView.singleton === this) {
			ExcalidrawSidepanelView.singleton = null;
		}
	}

	public async waitUntilReady(): Promise<void> {
		await this.readyPromise;
	}

	public async createTab(config: TabCreationConfig = { title: "unknown" }): Promise<ExcalidrawSidepanelTab> {
		await this.waitUntilReady();
		const scriptName = config.scriptName;
		const reuse = config.reuseExisting !== false;
		if (scriptName && reuse) {
			const existing = this.scriptTabs.get(scriptName);
			if (existing) {
				existing.reset(config.title, config.options);
				this.setActiveTab(existing);
				if (config.hostEA) {
					this.tabHosts.set(existing.id, config.hostEA);
				}
				return existing;
			}
		}
		const tab = this.createTabInternal(config.title, scriptName, config.options);
		if (config.hostEA) {
			this.tabHosts.set(tab.id, config.hostEA);
		}
		return tab;
	}

	public markTabPersistent(tab: ExcalidrawSidepanelTab) {
		const scriptName = tab.scriptName;
		if (!scriptName) {
			return;
		}
		this.scriptTabs.set(scriptName, tab);
		const title = tab.title;
		const existing = this.persistedScripts.get(scriptName);
		if (!existing || existing.title !== title) {
			this.persistedScripts.set(scriptName, { title });
			this.savePersistentScripts();
		}
	}

	public unmarkTabPersistent(scriptName?: string) {
		if (!scriptName) {
			return;
		}
		if (this.persistedScripts.delete(scriptName)) {
			this.savePersistentScripts();
		}
	}

	public removeTab(tab: ExcalidrawSidepanelTab) {
		tab.notifyWillClose();
		this.tabs.delete(tab.id);
		const scriptName = tab.scriptName;
		if (scriptName && this.scriptTabs.get(scriptName) === tab) {
			this.scriptTabs.delete(scriptName);
			this.unmarkTabPersistent(scriptName);
		}
		const hostEA = this.tabHosts.get(tab.id);
		if (hostEA && hostEA.sidepanelTab === tab) {
			hostEA.sidepanelTab = null;
		}
		this.tabHosts.delete(tab.id);
		tab.destroy();
		if (this.activeTabId === tab.id) {
			this.activeTabId = null;
			const next = this.tabs.values().next().value as ExcalidrawSidepanelTab | undefined;
			if (next) {
				this.setActiveTab(next);
			}
		}
	}

	public setActiveTab(tab: ExcalidrawSidepanelTab | null) {
		if (!tab) {
			return;
		}
		this.activeTabId = tab.id;
		this.tabs.forEach((candidate) => candidate.setActive(candidate === tab));
	}

	public getTabByScript(scriptName: string): ExcalidrawSidepanelTab | null {
		return this.scriptTabs.get(scriptName) ?? null;
	}

	public hasPersistentScript(scriptName: string): boolean {
		return this.persistedScripts.has(scriptName);
	}

	private createTabInternal(title: string, scriptName?: string, options?: SidepanelTabOptions): ExcalidrawSidepanelTab {
		if (!this.tabsEl || !this.bodyEl) {
			throw new Error("Sidepanel DOM is not ready");
		}
		const tab = new ExcalidrawSidepanelTab(
      title,
			{
				activate: (target) => this.setActiveTab(target),
				close: (target) => this.removeTab(target),
				plugin: this.plugin,
			},
			{ tabsEl: this.tabsEl, bodyEl: this.bodyEl },
			scriptName,
			options,
		);
		if (scriptName) {
			this.scriptTabs.set(scriptName, tab);
		}
		this.tabs.set(tab.id, tab);
		this.setActiveTab(tab);
		return tab;
	}

	private async restorePersistedTabs(): Promise<void> {
		if (this.restorePromise) {
			return this.restorePromise;
		}
		this.restorePromise = (async () => {
			if (!this.persistedScripts.size) {
				return;
			}
			ExcalidrawSidepanelView.restoreSilent = true;
			await this.plugin.awaitInit();
			try {
				for (const [scriptName, meta] of Array.from(this.persistedScripts.entries())) {
					if (!scriptName) {
						continue;
					}
					await this.runScriptByName(scriptName, meta.title);
				}
			} finally {
				ExcalidrawSidepanelView.restoreSilent = false;
			}
		})();
		return this.restorePromise;
	}

	private async runScriptByName(scriptName: string, title: string) {
		const scriptEngine = this.plugin.scriptEngine;
		if (!scriptEngine) {
			return;
		}
		const file = scriptEngine.getScriptFileByName(scriptName);
		if (!file) {
			console.warn(`Excalidraw: could not restore sidepanel script '${scriptName}' because the file was not found.`);
			this.persistedScripts.delete(scriptName);
			this.savePersistentScripts();
			return;
		}
		try {
			const script = await this.plugin.app.vault.read(file);
			await scriptEngine.executeScript(undefined, script, scriptName, file);
			const restoredTab = this.scriptTabs.get(scriptName);
			if (restoredTab) {
				restoredTab.setTitle(title);
			}
		} catch (error) {
			console.error(`Excalidraw: error while restoring sidepanel script '${scriptName}'`, error);
		}
	}

	private savePersistentScripts() {
		this.plugin.settings.sidepanelTabs = Array.from(this.persistedScripts.entries()).map(([script, meta]) =>
			JSON.stringify({ script, title: meta.title ?? script }),
		);
		void this.plugin.saveSettings();
	}

	private triggerActiveTabFocus(view = getLastActiveExcalidrawView(this.plugin)) {
		if (!this.activeTabId) {
			return;
		}
		const active = this.tabs.get(this.activeTabId);
		if (active) {
			active.handleFocus(view ?? null);
		}
	}
}
