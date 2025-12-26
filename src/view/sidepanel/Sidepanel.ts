import { ItemView, WorkspaceLeaf, type EventRef, setIcon } from "obsidian";
import { ICON_NAME, VIEW_TYPE_SIDEPANEL } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { getLastActiveExcalidrawView } from "src/utils/excalidrawAutomateUtils";
import { ExcalidrawSidepanelTab } from "./SidepanelTab";

type TabCreationConfig = {
  title: string;
	scriptName?: string;
	reuseExisting?: boolean;
	hostEA?: ExcalidrawAutomate;
};

export class ExcalidrawSidepanelView extends ItemView {
	private static singleton: ExcalidrawSidepanelView | null = null;
	private static restoreSilent = false;

	/**
	 * Returns the singleton sidepanel view if it exists, optionally revealing the leaf unless restoration is running silently.
	 */
	public static getExisting(reveal: boolean = true): ExcalidrawSidepanelView | null {
		const spView = ExcalidrawSidepanelView.singleton;
    if (spView && reveal && !ExcalidrawSidepanelView.restoreSilent) {
      spView.plugin.app.workspace.revealLeaf(spView.leaf);
    }
    return spView;
	}

	/**
	 * Ensures a sidepanel view exists (creating it if needed), optionally revealing it, and waits until DOM is ready.
	 */
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
		let spView = leaf.view;
		if (!(spView instanceof ExcalidrawSidepanelView)) {
			// Obsidian startup sequence. Leaves constructors are not called until they are revealed.
			// So when getOrCreate is called from a script, we may have a leaf of the right type but with a generic ItemView.
			await leaf.setViewState({ type: VIEW_TYPE_SIDEPANEL, active: true });
			spView = leaf.view;
			if (!(spView instanceof ExcalidrawSidepanelView)) {
				return null;
			}
		}
		if (effectiveReveal) {
			plugin.app.workspace.revealLeaf(leaf);
		}
		await spView.waitUntilReady();
		return spView;
	}

	/**
	 * Cleans up singleton references and detaches sidepanel leaves when the plugin unloads.
	 */
	public static onPluginUnload(plugin: ExcalidrawPlugin) {
		ExcalidrawSidepanelView.singleton = null;
		plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_SIDEPANEL);
	}

	private tabs = new Map<string, ExcalidrawSidepanelTab>();
	private scriptTabs = new Map<string, ExcalidrawSidepanelTab>();
	private tabHosts = new Map<string, ExcalidrawAutomate>();
	private tabOptions = new Map<string, HTMLOptionElement>();
	private persistedScripts = new Map<string, { title: string }>();
	private activeTabId: string | null = null;
	private selectEl: HTMLSelectElement | null = null;
	private closeButtonEl: HTMLButtonElement | null = null;
	private bodyEl: HTMLDivElement | null = null;
	private emptyStateEl: HTMLDivElement | null = null;
	private readyPromise: Promise<void>;
	private resolveReady: (() => void) | null = null;
	private restorePromise: Promise<void> | null = null;
	private leafChangeRef: EventRef | null = null;
	private windowMigrationCleanup: (() => void) | null = null;

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
		const hasWindowMigrationAPI = typeof this.containerEl.onWindowMigrated === "function";
		if (hasWindowMigrationAPI) {
			this.windowMigrationCleanup = this.containerEl.onWindowMigrated((win: Window) => {
				this.notifyTabsWindowMigrated(win);
			});
		}
		ExcalidrawSidepanelView.singleton = this;
		this.containerEl.empty();
		this.containerEl.addClass("excalidraw-sidepanel-container");
		const wrapper = this.containerEl.createDiv({ cls: "excalidraw-sidepanel" });
		const controls = wrapper.createDiv({ cls: "excalidraw-sidepanel__controls" });
		this.selectEl = controls.createEl("select", { cls: "excalidraw-sidepanel__select" });
		this.selectEl.addEventListener("change", () => {
			const targetId = this.selectEl?.value ?? null;
			const tab = targetId ? this.tabs.get(targetId) ?? null : null;
			this.setActiveTab(tab ?? null);
		});
		this.closeButtonEl = controls.createEl("button", {
			cls: "excalidraw-sidepanel__close-button",
			attr: { type: "button", "aria-label": "Close sidepanel tab" },
		});
		setIcon(this.closeButtonEl, "x");
		this.closeButtonEl.addEventListener("click", () => {
			if (!this.activeTabId) {
				return;
			}
			const active = this.tabs.get(this.activeTabId);
			if (active) {
				this.removeTab(active);
			}
		});
		this.bodyEl = wrapper.createDiv({ cls: "excalidraw-sidepanel__body" });
		this.emptyStateEl = this.bodyEl.createDiv({ cls: "excalidraw-sidepanel__empty" });
		this.emptyStateEl.setText("Excalidraw sidepanel is empty. Run a panel-enabled Excalidraw script to add a panel.");
		this.selectEl.disabled = true;
		this.closeButtonEl.disabled = true;
		this.leafChangeRef = this.app.workspace.on("active-leaf-change", (leaf) => {
			if (leaf === this.leaf) {
				this.triggerActiveTabFocus();
			}
		});
		this.resolveReady?.();
		this.resolveReady = null;
		void this.restorePersistedTabs();
		this.updateEmptyStateVisibility();
	}

	/**
	 * Tears down listeners, destroys tabs, and clears UI references when the sidepanel closes.
	 */
	protected async onClose() {
		await super.onClose();
		if (this.windowMigrationCleanup) {
			this.windowMigrationCleanup();
			this.windowMigrationCleanup = null;
		}
		if (this.leafChangeRef) {
			this.app.workspace.offref(this.leafChangeRef);
			this.leafChangeRef = null;
		}
		this.tabs.forEach((tab) => {
			tab.notifyWillClose();
			const hostEA = this.tabHosts.get(tab.id);
			if (hostEA && hostEA.sidepanelTab === tab) {
				hostEA.sidepanelTab = null;
			}
			this.tabHosts.delete(tab.id);
			tab.destroy();
		});
		this.tabs.clear();
		this.scriptTabs.clear();
		this.tabOptions.clear();
		this.tabHosts.clear();
		this.activeTabId = null;
		this.selectEl = null;
		this.closeButtonEl = null;
		this.bodyEl = null;
		this.emptyStateEl = null;
		this.containerEl.onWindowMigrated = null;
		if (ExcalidrawSidepanelView.singleton === this) {
			ExcalidrawSidepanelView.singleton = null;
		}
	}

	public async waitUntilReady(): Promise<void> {
		await this.readyPromise;
	}

	/**
	 * Creates or reuses a tab based on script identity and returns the active tab instance.
	 */
	public async createTab(config: TabCreationConfig = { title: "unknown" }): Promise<ExcalidrawSidepanelTab> {
		await this.waitUntilReady();
		const scriptName = config.scriptName;
		const reuse = config.reuseExisting !== false;
		if (scriptName && reuse) {
			const existing = this.scriptTabs.get(scriptName);
			if (existing) {
				existing.reset(config.title);
				this.setActiveTab(existing);
				if (config.hostEA) {
					this.tabHosts.set(existing.id, config.hostEA);
				}
				return existing;
			}
		}
		const tab = this.createTabInternal(config.title, config.hostEA, scriptName);
		if (config.hostEA) {
			this.tabHosts.set(tab.id, config.hostEA);
		}
		return tab;
	}

	/**
	 * Marks a tab as persistent so its script is restored across sessions.
	 */
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

	/**
	 * Removes persistence metadata for a script-backed tab.
	 */
	public unmarkTabPersistent(scriptName?: string) {
		if (!scriptName) {
			return;
		}
		if (this.persistedScripts.delete(scriptName)) {
			this.savePersistentScripts();
		}
	}

	/**
	 * Removes a tab from the UI and state, running close hooks and updating active selection.
	 */
	public removeTab(tab: ExcalidrawSidepanelTab) {
		tab.notifyWillClose();
		this.tabs.delete(tab.id);
		this.removeTabOption(tab);
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
			this.setActiveTab(next ?? null);
		}
		this.updateEmptyStateVisibility();
	}

	/**
	 * Activates the given tab (or clears active selection) and syncs UI controls.
	 */
	public setActiveTab(tab: ExcalidrawSidepanelTab | null) {
		this.activeTabId = tab?.id ?? null;
		this.tabs.forEach((candidate) => candidate.setActive(candidate === tab));
		if (this.selectEl) {
			this.selectEl.value = tab?.id ?? "";
		}
		this.updateEmptyStateVisibility();
	}

	/**
	 * Returns a tab by its backing script name if present.
	 */
	public getTabByScript(scriptName: string): ExcalidrawSidepanelTab | null {
		return this.scriptTabs.get(scriptName) ?? null;
	}

	/**
	 * Checks whether a script has been marked for persistent restoration.
	 */
	public hasPersistentScript(scriptName: string): boolean {
		return this.persistedScripts.has(scriptName);
	}

	private createTabInternal(
		title: string,
		ea: ExcalidrawAutomate,
		scriptName?: string,
	): ExcalidrawSidepanelTab {
		if (!this.bodyEl) {
			throw new Error("Sidepanel DOM is not ready");
		}
		const tab = new ExcalidrawSidepanelTab(
      title,
			{
				activate: (target) => this.setActiveTab(target),
				close: (target) => this.removeTab(target),
				updateTitle: (target) => this.updateTabOptionTitle(target),
				plugin: this.plugin,
				ea,
			},
			{ bodyEl: this.bodyEl },
			scriptName,
		);
		if (scriptName) {
			this.scriptTabs.set(scriptName, tab);
		}
		this.tabs.set(tab.id, tab);
		this.addTabOption(tab);
		this.setActiveTab(tab);
		return tab;
	}

	/**
	 * Restores persisted tabs on startup without revealing the panel, executing scripts to rebuild content.
	 */
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

	/**
	 * Executes a script by name to reconstruct its sidepanel tab, updating title if needed.
	 */
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

	/**
	 * Persists current set of script tabs to plugin settings.
	 */
	private savePersistentScripts() {
		this.plugin.settings.sidepanelTabs = Array.from(this.persistedScripts.entries()).map(([script, meta]) =>
			JSON.stringify({ script, title: meta.title ?? script }),
		);
		void this.plugin.saveSettings();
	}

	/**
	 * Triggers focus handlers for the active tab using the last active Excalidraw view.
	 */
	private triggerActiveTabFocus(view = getLastActiveExcalidrawView(this.plugin)) {
		if (!this.activeTabId) {
			return;
		}
		const active = this.tabs.get(this.activeTabId);
		if (active) {
			active.handleFocus(view ?? null);
		}
	}

	private notifyTabsWindowMigrated(win: Window) {
		this.tabs.forEach((tab) => tab.handleWindowMigration(win));
	}

	private addTabOption(tab: ExcalidrawSidepanelTab) {
		if (!this.selectEl) {
			return;
		}
		const option = this.selectEl.createEl("option", { value: tab.id, text: tab.title });
		this.tabOptions.set(tab.id, option);
		this.selectEl.disabled = false;
		if (this.closeButtonEl) {
			this.closeButtonEl.disabled = false;
		}
	}

	/**
	 * Removes the select option corresponding to a tab and disables controls when empty.
	 */
	private removeTabOption(tab: ExcalidrawSidepanelTab) {
		const option = this.tabOptions.get(tab.id);
		if (option) {
			option.remove();
			this.tabOptions.delete(tab.id);
		}
		if (!this.tabOptions.size && this.selectEl) {
			this.selectEl.disabled = true;
			this.selectEl.value = "";
		}
		if (!this.tabOptions.size && this.closeButtonEl) {
			this.closeButtonEl.disabled = true;
		}
	}

	/**
	 * Syncs the select option label with the tab title.
	 */
	private updateTabOptionTitle(tab: ExcalidrawSidepanelTab) {
		const option = this.tabOptions.get(tab.id);
		if (option) {
			option.text = tab.title;
		}
	}

	/**
	 * Shows empty-state messaging and disables controls when no tabs exist.
	 */
	private updateEmptyStateVisibility() {
		const hasTabs = this.tabs.size > 0;
		if (this.emptyStateEl) {
			this.emptyStateEl.style.display = hasTabs ? "none" : "";
		}
		if (this.closeButtonEl) {
			this.closeButtonEl.disabled = !hasTabs;
		}
		if (this.selectEl) {
			this.selectEl.disabled = !hasTabs;
			if (!hasTabs) {
				this.selectEl.value = "";
			}
		}
	}
}
