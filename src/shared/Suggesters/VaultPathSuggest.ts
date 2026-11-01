/** Vault-backed path completion; callers may require typing before opening suggestions. */
import {
  AbstractInputSuggest,
  App,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";

type VaultPathSuggestionKind = "file" | "folder" | "file-or-folder";

/** Adds reusable Vault-aware completion to settings path inputs. */
export class VaultPathSuggest extends AbstractInputSuggest<TAbstractFile> {
  private readonly candidates: TAbstractFile[];
  private readonly input: HTMLInputElement;
  private readonly openOnFocus: boolean;
  private inputStarted = false;
  private readonly onInput = (): void => { this.inputStarted = true; };
  private readonly onBlur = (): void => { this.inputStarted = false; };

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    kind: VaultPathSuggestionKind,
    extensions?: readonly string[],
    options: {openOnFocus?: boolean} = {},
  ) {
    super(app, inputEl);
    this.input = inputEl;
    this.openOnFocus = options.openOnFocus !== false;
    if (!this.openOnFocus) {
      // Capture precedes AbstractInputSuggest's input listener, including the first edit.
      inputEl.addEventListener("input", this.onInput, true);
      inputEl.addEventListener("blur", this.onBlur);
    }
    const normalizedExtensions = extensions?.map((extension) =>
      extension.toLowerCase().replace(/^\./, ""),
    );
    this.candidates = app.vault.getAllLoadedFiles().filter((file) => {
      if (file instanceof TFolder) {
        return kind !== "file";
      }
      return (
        kind !== "folder" &&
        file instanceof TFile &&
        (!normalizedExtensions ||
          normalizedExtensions.includes(file.extension.toLowerCase()))
      );
    });
    this.limit = 30;
  }

  /** Preserve a displayed default folder on focus; actual input enables the native dropdown. */
  open(): void {
    if (this.openOnFocus || this.inputStarted) super.open();
  }

  /** Release optional input gates when an owning modal closes. */
  destroy(): void {
    this.close();
    this.input.removeEventListener("input", this.onInput, true);
    this.input.removeEventListener("blur", this.onBlur);
  }

  protected getSuggestions(query: string): TAbstractFile[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return this.candidates.slice(0, this.limit);
    }
    const isPathQuery = normalizedQuery.includes("/");
    return this.candidates
      .filter((file) => {
        const path = file.path.toLowerCase();
        return isPathQuery
          ? path.startsWith(normalizedQuery)
          : file.name.toLowerCase().startsWith(normalizedQuery) ||
              path.startsWith(normalizedQuery);
      })
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, this.limit);
  }

  renderSuggestion(file: TAbstractFile, el: HTMLElement): void {
    el.createDiv({ text: file.name });
    if (file.path !== file.name) {
      el.createDiv({ cls: "suggestion-note", text: file.path });
    }
  }

  selectSuggestion(file: TAbstractFile): void {
    this.setValue(file.path);
    const inputEl = this.getInputEl();
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }

  private getInputEl(): HTMLInputElement {
    return this.input;
  }
}
