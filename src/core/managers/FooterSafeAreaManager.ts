import type { App } from "obsidian";
import { DEVICE } from "src/constants/constants";
import type { ExcalidrawSettings } from "src/core/settings";
import { isInstanceOfHTMLStyleElement } from "src/utils/typechecks";

declare const mainDocument: Document;
declare const deliberateCreateElement: (
  document: Document,
  tagName: string,
) => HTMLStyleElement;

const FOOTER_SAFE_AREA_STYLE_ID = "excalidraw-phone-footer-safe-area";
const FOOTER_SAFE_AREA_CSS = `
.excalidraw .App-bottom-bar {
  padding-bottom: 50px;
}
`;

interface FooterSafeAreaHost {
  app: App;
  settings: ExcalidrawSettings;
}

/**
 * Owns the optional phone and tablet footer-padding stylesheet across Obsidian
 * documents, including cleanup when the plugin unloads.
 */
export class FooterSafeAreaManager {
  public constructor(private readonly host: FooterSafeAreaHost) {}

  /** Applies or removes footer padding according to the current device and settings. */
  public updateFooterSafeAreaPadding(): void {
    const documents = new Set<Document>([
      mainDocument,
      ...this.getOpenObsidianDocuments(),
    ]);
    const shouldEnable =
      (DEVICE.isPhone && this.host.settings?.phoneFooterSafeAreaPadding) ||
      (DEVICE.isTablet && this.host.settings?.tabletFooterSafeAreaPadding);

    documents.forEach((ownerDocument) => {
      const existingStylesheet = ownerDocument.getElementById(
        FOOTER_SAFE_AREA_STYLE_ID,
      );
      if (!shouldEnable) {
        if (existingStylesheet) {
          ownerDocument.head.removeChild(existingStylesheet);
        }
        return;
      }
      if (isInstanceOfHTMLStyleElement(existingStylesheet)) {
        existingStylesheet.textContent = FOOTER_SAFE_AREA_CSS;
        return;
      }

      const stylesheet = deliberateCreateElement(ownerDocument, "style");
      stylesheet.id = FOOTER_SAFE_AREA_STYLE_ID;
      stylesheet.textContent = FOOTER_SAFE_AREA_CSS;
      ownerDocument.head.appendChild(stylesheet);
    });
  }

  /** Removes every footer-padding stylesheet owned by the plugin. */
  public destroy(): void {
    const documents = new Set<Document>([
      mainDocument,
      ...this.getOpenObsidianDocuments(),
    ]);
    documents.forEach((ownerDocument) => {
      const existingStylesheet = ownerDocument.getElementById(
        FOOTER_SAFE_AREA_STYLE_ID,
      );
      if (existingStylesheet) {
        ownerDocument.head.removeChild(existingStylesheet);
      }
    });
  }

  private getOpenObsidianDocuments(): Document[] {
    const visitedDocuments = new Set<Document>();
    this.host.app.workspace.iterateAllLeaves((leaf) => {
      const ownerDocument = DEVICE.isMobile
        ? mainDocument
        : leaf.view.containerEl.ownerDocument;
      if (!ownerDocument || visitedDocuments.has(ownerDocument)) {
        return;
      }
      visitedDocuments.add(ownerDocument);
    });
    return Array.from(visitedDocuments);
  }
}
