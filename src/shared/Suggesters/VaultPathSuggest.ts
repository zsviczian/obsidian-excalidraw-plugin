import {
  AbstractInputSuggest,
  App,
  TAbstractFile,
  TFolder,
} from "obsidian";

type VaultPathSuggestionKind = "file" | "folder";

/** Adds reusable Vault-aware completion to settings path inputs. */
export class VaultPathSuggest extends AbstractInputSuggest<TAbstractFile> {
  private readonly candidates: TAbstractFile[];
  private readonly input: HTMLInputElement;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    kind: VaultPathSuggestionKind,
    extensions?: readonly string[],
  ) {
    super(app, inputEl);
    this.input = inputEl;
    const normalizedExtensions = extensions?.map((extension) =>
      extension.toLowerCase().replace(/^\./, ""),
    );
    this.candidates =
      kind === "folder"
        ? app.vault
            .getAllLoadedFiles()
            .filter((file) => file instanceof TFolder)
        : app.vault
            .getFiles()
            .filter(
              (file) =>
                !normalizedExtensions ||
                normalizedExtensions.includes(file.extension.toLowerCase()),
            );
    this.limit = 30;
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
