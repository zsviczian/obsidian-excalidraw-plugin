/**
 * Owns the four per-drawing embedded-data registries on `ExcalidrawData`:
 * embedded files, LaTeX equations, local Markdown images, and Mermaid
 * diagrams. Each registry mirrors its entries into a matching plugin-wide
 * "master" map (`ExcalidrawPlugin.filesMaster`/`equationsMaster`/
 * `markdownImagesMaster`/`mermaidsMaster`) so intra-vault copy/paste can
 * restore a fileId's data in a drawing that never natively loaded it.
 * Extracted intact from `ExcalidrawData.ts`; `ExcalidrawData` keeps every
 * method below as a public delegate for compatibility with its existing
 * callers.
 */
import type { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import type { MarkdownImageData } from "src/types/markdownImageTypes";
import type { EmbeddedFile } from "./EmbeddedFileLoader";
import type { ExcalidrawData, EquationItem, MermaidItem } from "./ExcalidrawData";

export class EmbeddedDataRegistries {
  /**
   * `embeddedFileCtor` is constructor-injected (rather than imported as a
   * value) so this module stays type-only with respect to
   * `EmbeddedFileLoader.ts`, matching the existing pattern used to avoid
   * adding new circular-import edges around the `ExcalidrawData` cluster
   * (see `ViewLinkNavigationManager`/`ViewExcalidrawExtensionRenderer`).
   */
  constructor(
    private host: ExcalidrawData,
    private embeddedFileCtor: typeof EmbeddedFile,
  ) {}

  //--------------
  //Files
  //--------------
  public setFile(fileId: FileId, data: EmbeddedFile) {
    //always store absolute path because in case of paste, relative path may not resolve ok
    if (!data) {
      return;
    }
    this.host.files.set(fileId, data);

    if (data.isHyperLink || data.isLocalLink) {
      this.host.plugin.filesMaster.set(fileId, {
        isHyperLink: data.isHyperLink,
        isLocalLink: data.isLocalLink,
        path: data.hyperlink,
        blockrefData: null,
        hasSVGwithBitmap: data.isSVGwithBitmap,
      });
      return;
    }

    if (!data.file) {
      return;
    }

    const parts = data.linkParts.original.split("#");
    this.host.plugin.filesMaster.set(fileId, {
      isHyperLink: false,
      isLocalLink: false,
      path: data.file.path + (data.shouldScale() ? "" : "|100%"),
      blockrefData: parts.length === 1 ? null : parts[1],
      hasSVGwithBitmap: data.isSVGwithBitmap,
      colorMapJSON: data.colorMap ? JSON.stringify(data.colorMap) : null,
    });
  }

  public getFiles(): EmbeddedFile[] {
    return Array.from(this.host.files.values());
  }

  public getFile(fileId: FileId): EmbeddedFile {
    let embeddedFile = this.host.files.get(fileId);
    if (embeddedFile) {
      return embeddedFile;
    }
    const masterFile = this.host.plugin.filesMaster.get(fileId);
    if (!masterFile) {
      return embeddedFile;
    }
    embeddedFile = new this.embeddedFileCtor(
      this.host.plugin,
      this.host.file.path,
      masterFile.blockrefData
        ? `${masterFile.path}#${masterFile.blockrefData}`
        : masterFile.path,
      masterFile.colorMapJSON,
    );
    this.host.files.set(fileId, embeddedFile);
    return embeddedFile;
  }

  public getFileEntries() {
    return this.host.files.entries();
  }

  public deleteFile(fileId: FileId) {
    this.host.files.delete(fileId);
    //deliberately not deleting from plugin.filesMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasFile(fileId: FileId): boolean {
    if (this.host.files.has(fileId)) {
      return true;
    }
    if (this.host.plugin.filesMaster.has(fileId)) {
      const masterFile = this.host.plugin.filesMaster.get(fileId);
      if (masterFile.isHyperLink || masterFile.isLocalLink) {
        this.host.files.set(
          fileId,
          new this.embeddedFileCtor(
            this.host.plugin,
            this.host.file.path,
            masterFile.path,
          ),
        );
        return true;
      }
      const path = masterFile.path.split("|")[0].split("#")[0];
      if (!this.host.app.vault.getAbstractFileByPath(path)) {
        this.host.plugin.filesMaster.delete(fileId);
        return true;
      } // the file no longer exists
      const fixScale = masterFile.path.endsWith("100%");
      const embeddedFile = new this.embeddedFileCtor(
        this.host.plugin,
        this.host.file.path,
        (masterFile.blockrefData
          ? `${path}#${masterFile.blockrefData}`
          : path) + (fixScale ? "|100%" : ""),
        masterFile.colorMapJSON,
      );
      this.host.files.set(fileId, embeddedFile);
      return true;
    }
    return false;
  }

  //--------------
  //Equations
  //--------------
  public setEquation(
    fileId: FileId,
    data: { latex: string; isLoaded: boolean },
  ) {
    this.host.equations.set(fileId, {
      latex: data.latex,
      isLoaded: data.isLoaded,
    });
    this.host.plugin.equationsMaster.set(fileId, data.latex);
  }

  public getEquation(fileId: FileId): EquationItem {
    const result = this.host.equations.get(fileId);
    if (result) {
      return result;
    }
    const latex = this.host.plugin.equationsMaster.get(fileId);
    if (!latex) {
      return result;
    }
    this.host.equations.set(fileId, { latex, isLoaded: false });
    return { latex, isLoaded: false };
  }

  public getEquationEntries() {
    return this.host.equations?.entries();
  }

  public deleteEquation(fileId: FileId) {
    this.host.equations.delete(fileId);
    //deliberately not deleting from plugin.equationsMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasEquation(fileId: FileId): boolean {
    if (this.host.equations.has(fileId)) {
      return true;
    }
    if (this.host.plugin.equationsMaster.has(fileId)) {
      this.host.equations.set(fileId, {
        latex: this.host.plugin.equationsMaster.get(fileId),
        isLoaded: false,
      });
      return true;
    }
    return false;
  }

  //--------------
  //Local Markdown images
  //--------------

  /** Stores a local Markdown-image source and makes it available for intra-vault copy/paste. */
  public setMarkdownImage(fileId: FileId, data: MarkdownImageData): void {
    if (!data) {
      return;
    }
    const value = { markdown: data.markdown ?? "" };
    this.host.markdownImages.set(fileId, value);
    this.host.plugin.markdownImagesMaster.set(fileId, value);
  }

  /** Returns local Markdown, restoring it from the intra-vault copy master. */
  public getMarkdownImage(fileId: FileId): MarkdownImageData | undefined {
    const local = this.host.markdownImages.get(fileId);
    if (local) {
      return local;
    }
    const master = this.host.plugin.markdownImagesMaster.get(fileId);
    if (master) {
      const value = { ...master };
      this.host.markdownImages.set(fileId, value);
      return value;
    }
    return undefined;
  }

  /** Returns whether local Markdown exists, restoring intra-vault clipboard data. */
  public hasMarkdownImage(fileId: FileId): boolean {
    return Boolean(this.getMarkdownImage(fileId));
  }

  /** Removes a local source, optionally discarding its clipboard master entry. */
  public deleteMarkdownImage(fileId: FileId, clearMaster = false): void {
    this.host.markdownImages.delete(fileId);
    if (clearMaster) {
      this.host.plugin.markdownImagesMaster.delete(fileId);
    }
    // Normally retain the master entry for copies already on the clipboard.
  }

  //--------------
  //Mermaids
  //--------------
  public setMermaid(
    fileId: FileId,
    data: { mermaid: string; isLoaded: boolean },
  ) {
    this.host.mermaids.set(fileId, {
      mermaid: data.mermaid,
      isLoaded: data.isLoaded,
    });
    this.host.plugin.mermaidsMaster.set(fileId, data.mermaid);
  }

  public getMermaid(fileId: FileId): MermaidItem {
    const result = this.host.mermaids.get(fileId);
    if (result) {
      return result;
    }
    const mermaid = this.host.plugin.mermaidsMaster.get(fileId);
    if (!mermaid) {
      return result;
    }
    this.host.mermaids.set(fileId, { mermaid, isLoaded: false });
    return { mermaid, isLoaded: false };
  }

  public getMermaidEntries() {
    return this.host.mermaids.entries();
  }

  public deleteMermaid(fileId: FileId) {
    this.host.mermaids.delete(fileId);
    //deliberately not deleting from plugin.mermaidsMaster
    //could be present in other drawings as well
  }

  //Image copy/paste support
  public hasMermaid(fileId: FileId): boolean {
    if (this.host.mermaids.has(fileId)) {
      return true;
    }
    if (this.host.plugin.mermaidsMaster.has(fileId)) {
      this.host.mermaids.set(fileId, {
        mermaid: this.host.plugin.mermaidsMaster.get(fileId),
        isLoaded: false,
      });
      return true;
    }
    return false;
  }
}
