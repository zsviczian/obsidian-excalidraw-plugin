import type { Packages } from "src/types/types";
import { Notice, normalizePath, TFile } from "obsidian";
import {
  CJK_STYLE_ID,
  DEVICE,
  FONTS_STYLE_ID,
} from "src/constants/constants";
import { t } from "src/lang/helpers";
import { getCJKFontFaceData } from "src/utils/CJKLoader";
import { getFontDataURL } from "src/utils/utils";
import { getFontMetrics } from "src/utils/fontMetrics";
import type ExcalidrawPlugin from "src/core/main";

declare const mainDocument: Document;

type RuntimePackageProvider = () => Packages;

interface RuntimeFontFaceDefinition {
  family: string;
  source: string | ArrayBuffer;
  descriptors?: FontFaceDescriptors;
}

/**
 * Owns CJK and custom-font discovery, document registration, and
 * readiness state while preserving the plugin's existing public font facade.
 */
export class FontManager {
  private isLocalCJKFontAvailabe: boolean = undefined;
  // Intentionally true to preserve the existing startup race behavior.
  private fontsReady = true;
  private readonly registeredFontFaces = new WeakMap<
    Document,
    Map<string, FontFace[]>
  >();

  public constructor(
    private readonly plugin: ExcalidrawPlugin,
    private readonly getRuntimePackage: RuntimePackageProvider,
  ) {}

  /** Whether font initialization permits the plugin readiness wait to finish. */
  public get isReady(): boolean {
    return this.fontsReady;
  }

  /** Returns the enabled CJK ranges when local CJK font assets are available. */
  public getCJKFontSettings(): { c: boolean; j: boolean; k: boolean } {
    const assetsFoler = this.plugin.settings.fontAssetsPath;
    if (typeof this.isLocalCJKFontAvailabe === "undefined") {
      this.isLocalCJKFontAvailabe = this.plugin.app.vault
        .getFiles()
        .some((file) => file.path.startsWith(assetsFoler));
    }
    if (!this.isLocalCJKFontAvailabe) {
      return { c: false, j: false, k: false };
    }
    return {
      c: this.plugin.settings.loadChineseFonts,
      j: this.plugin.settings.loadJapaneseFonts,
      k: this.plugin.settings.loadKoreanFonts,
    };
  }

  /** Reads a configured CJK font asset from the vault. */
  public async loadFontFromFile(
    fontName: string,
  ): Promise<ArrayBuffer | undefined> {
    const assetsFoler = this.plugin.settings.fontAssetsPath;

    if (!this.isLocalCJKFontAvailabe) {
      return;
    }
    const file = this.plugin.app.vault.getFileByPath(
      normalizePath(`${assetsFoler}/${fontName}`),
    );
    if (!file || !(file instanceof TFile)) {
      return;
    }
    return await this.plugin.app.vault.readBinary(file);
  }

  /**
   * Loads configured CJK and custom fonts into every open Obsidian document
   * and registers custom font metrics with the shared Excalidraw runtime.
   */
  public async initializeFonts(): Promise<void> {
    const cjkFontFaceData = await getCJKFontFaceData(this.plugin);
    if (cjkFontFaceData === false) {
      new Notice(
        t("FONTS_LOAD_ERROR") + this.plugin.settings.fontAssetsPath,
        6000,
      );
    }

    if (cjkFontFaceData) {
      const fontDefinitions: RuntimeFontFaceDefinition[] = cjkFontFaceData.map(
        ({ dataURL, descriptors }) => ({
          family: "Xiaolai",
          source: `url(${JSON.stringify(dataURL)})`,
          descriptors: {
            ...descriptors,
            display: "swap",
            weight: "400",
          },
        }),
      );
      for (const ownerDocument of this.getOpenObsidianDocuments()) {
        await this.registerFontFaces(
          fontDefinitions,
          ownerDocument,
          CJK_STYLE_ID,
        );
      }
      new Notice(t("FONTS_LOADED"));
    }

    const font = await getFontDataURL(
      this.plugin.app,
      this.plugin.settings.experimantalFourthFont,
      "",
      "Local Font",
    );

    if (font.dataURL === "") {
      this.plugin.fourthFontLoaded = true;
      return;
    }

    const fourthFontDataURL = font.dataURL;

    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
      this.plugin.settings.experimantalFourthFont,
      "",
    );
    let fontMetrics = file.extension.startsWith("woff") || !font.arrayBuffer
      ? undefined
      : getFontMetrics(font.arrayBuffer);

    if (!fontMetrics) {
      fontMetrics = {
        unitsPerEm: 1000,
        ascender: 750,
        descender: -250,
        lineHeight: 1.2,
      };
    }
    const { excalidrawLib } = this.getRuntimePackage();
    if (fontMetrics) {
      excalidrawLib.registerLocalFont(
        { metrics: fontMetrics },
        fourthFontDataURL,
      );
    }
    for (const ownerDocument of this.getOpenObsidianDocuments()) {
      await this.registerFontFaces(
        [
          {
            family: "Local Font",
            source: `url(${JSON.stringify(fourthFontDataURL)})`,
            descriptors: {
              display: "swap",
              weight: "400",
            },
          },
        ],
        ownerDocument,
        FONTS_STYLE_ID,
        true,
      );
    }
    if (!this.plugin.fourthFontLoaded) {
      window.setTimeout(() => {
        this.plugin.fourthFontLoaded = true;
      }, 100);
    }
    this.fontsReady = true;
  }

  private async registerFontFaces(
    definitions: RuntimeFontFaceDefinition[],
    ownerDocument: Document,
    registrationId: string,
    preload = false,
  ): Promise<void> {
    const ownerWindow = ownerDocument.defaultView;
    const FontFaceConstructor: typeof FontFace | undefined = ownerWindow
      ? Reflect.get(ownerWindow, "FontFace")
      : undefined;
    if (!FontFaceConstructor) {
      throw new Error("FontFace is unavailable in the target document.");
    }

    const newFaces = definitions.map(
      ({ family, source, descriptors }) =>
        new FontFaceConstructor(family, source, descriptors),
    );
    if (preload) {
      await Promise.all(newFaces.map((face) => face.load()));
    }

    let registrations = this.registeredFontFaces.get(ownerDocument);
    if (!registrations) {
      registrations = new Map<string, FontFace[]>();
      this.registeredFontFaces.set(ownerDocument, registrations);
    }
    const oldFaces = registrations.get(registrationId) ?? [];
    newFaces.forEach((face) => ownerDocument.fonts.add(face));
    oldFaces.forEach((face) => ownerDocument.fonts.delete(face));
    registrations.set(registrationId, newFaces);

    // Remove a stylesheet left by an earlier in-session implementation.
    ownerDocument.getElementById(registrationId)?.remove();
  }

  /** Removes custom and CJK font registrations from all open documents. */
  public removeFonts(): void {
    this.getOpenObsidianDocuments().forEach((ownerDocument) => {
      const registrations = this.registeredFontFaces.get(ownerDocument);
      registrations?.forEach((faces) => {
        faces.forEach((face) => ownerDocument.fonts.delete(face));
      });
      this.registeredFontFaces.delete(ownerDocument);
      const oldCustomFontStylesheet =
        ownerDocument.getElementById(FONTS_STYLE_ID);
      if (oldCustomFontStylesheet) {
        ownerDocument.head.removeChild(oldCustomFontStylesheet);
      }
      const oldCJKFontStylesheet = ownerDocument.getElementById(CJK_STYLE_ID);
      if (oldCJKFontStylesheet) {
        ownerDocument.head.removeChild(oldCJKFontStylesheet);
      }
    });
  }

  private getOpenObsidianDocuments(): Document[] {
    const visitedDocuments = new Set<Document>();
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
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
