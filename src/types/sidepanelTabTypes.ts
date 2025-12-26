import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type ExcalidrawView from "src/view/ExcalidrawView";

/**
 * SidepanelTab defines the public surface of a sidepanel tab as exposed to scripts.
 * Tabs are lightweight modal-like containers with their own DOM (title/content) that the host sidepanel activates, focuses, and closes.
 * Typical flow for scripts:
 * 1) Create the tab via ea.createSidepanelTab(title, persist=false, reveal=true). Note the sidepanelTab is immediately created even if not revealed.
 *    If the sidepanel tab is the first in the sidepanel, then onOpen will not be called becase the tab is already open/active.
 *    Reveal simply opens the obisidan sidepanel and the Excalidraw sidepanel view which already displays the active tab.
 * 2) Render UI into `contentEl` or use `setContent(...)` / `setTitle(...)`.
 * 3) Implement lifecycle hooks: `onOpen` (only runs when the user changes tabs in the Excalidraw sidepanel), `onFocus(view)` (runs on host focus changes), `onClose`/`setCloseCallback` (cleanup), `onExcalidrawViewClosed` (canvas closed).
 * 4) Use `setDisabled`, `focus`, `close`, `reset`, and persistence helpers (from host) as needed.
 * 5) Use ea.sidepanelTab.open() to show the sidepanel tab associated with the script.
 * 6) When the sidepanel is nolonger required the script should call ea.sidepanelTab.close() to close the tab and trigger cleanup.
 * The sidpanel associated with an ea script is available on ea.sidepanelTab. Persisted tabs are restored on Obsidian startup, such that scripts associated with the persisted tabs are
 * loaded and executed on Excalidraw startup, and the scripts are in turn responsible for recreating their sidepanel tabs via ea.createSidepanelTab as per their normal script initiation sequence.
 * This description is intentionally explicit so an LLM can generate sidepanel-aware script code without inspecting the implementation.
 */

export interface SidepanelTab {
	/** Unique tab identifier used by the host sidepanel. */
	readonly id: string;
	/** Optional script name backing this tab (used for persistence and lookup). */
	readonly scriptName?: string;
	/** Current title shown in the sidepanel selector. */
	readonly title: string;
	/** Root container element for the tab (same as modalEl). */
	readonly containerEl: HTMLDivElement;
	/** Wrapper element for the tab. */
	readonly modalEl: HTMLDivElement;
	/** Content element where scripts render their UI. */
	readonly contentEl: HTMLDivElement;
	/** Title element whose text mirrors `title`. */
	readonly titleEl: HTMLDivElement;
	/**
   * Focus hook fired when the host marks this tab active; set by scripts.
   * Because sidpanel tabs may outlive their associated Excalidraw views on focus is designed to notify scripts of the most recently active view.
   * The script can verify if the view has changed by comparing against ea.targetView (ea.targetView === view means no change).
   * The script is responsible for calling ea.setView(view) if it wishes to bind to the new view.
   * The script may also wish to call ea.clear() or ea.reset() to discard state associated with the prior view.
   * In case the script performs view specific actions it should update its UI in onFocus when the received view !== ea.targetView.
   * @param view The most recently active ExcalidrawView, or null if no ExcalidrawViews are present in the workspace.
   */
	onFocus: (view: ExcalidrawView | null) => void;
	/** Hook fired when the associated Excalidraw view closes; set by ScriptEngine. */
	onExcalidrawViewClosed: () => void;
	/** Clears all children from the content element. */
	clear(): void;
	/** Sets the tab title and updates host UI; returns the tab for chaining. */
	setTitle(title: string): this;
	/** Replaces tab content with text or a fragment; returns the tab for chaining. */
	setContent(content: string | DocumentFragment): this;
	/** Activates this tab within the host sidepanel. */
	focus(): void;
	/** Marks the tab open, activates it, and triggers `onOpen`. */
	open(): void;
	/** Runs close handlers then asks the host to remove the tab. */
	close(): void;
	/** Lifecycle hook called when the tab is opened/activated. */
	onOpen(): Promise<void> | void;
	/** Lifecycle hook called once when the tab closes. */
	onClose(): void;
	/** Toggles pointer interactivity and opacity; returns the tab for chaining. */
	setDisabled(disabled: boolean): this;
	/** Returns the ExcalidrawAutomate instance associated with the sidepanel tab */
	getHostEA(): ExcalidrawAutomate;
}
