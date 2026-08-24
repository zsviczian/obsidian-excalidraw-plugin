import { Notice } from "obsidian";
import type { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import type { BinaryFileData } from "@zsviczian/excalidraw/types/excalidraw/types";
import { DEVICE } from "../../constants/constants";
import { t } from "../../lang/helpers";
import type { EmbeddedFilesLoader } from "../../shared/EmbeddedFileLoader";
import type { ExportDialog } from "../../shared/Dialogs/ExportDialog";
import { FileAndFolderSelectorModal } from "../../shared/Dialogs/FileAndFolderSelectorModal";
import type {
  AutoexportConfig,
  ExcalidrawViewScene,
} from "../../types/excalidrawViewTypes";
import type {
  ExportSettings,
  PageOrientation,
  PageSize,
} from "../../types/exportUtilTypes";
import type { FileData } from "../../types/embeddedFileLoaderTypes";
import {
  download,
  exportImageToFile,
  getIMGFilename,
  getNewUniqueFilepath,
  splitFolderAndFilename,
} from "../../utils/fileUtils";
import {
  exportPNG,
  exportPNGToClipboard,
  exportSVG,
  exportToPDF,
  getMarginValue,
  getPageDimensions,
} from "../../utils/exportUtils";
import type ExcalidrawView from "../ExcalidrawView";
import {
  performanceDiagnosticLog,
  performanceDiagnosticNow,
  performanceDiagnosticRecordDuration,
  performanceDiagnosticsEnabled,
} from "../../utils/performanceDiagnostics";

/** Runtime dependencies supplied by the view's existing import graph. */
export interface ViewExportDependencies {
  getOrCreateExportDialog: () => ExportDialog | null;
  createEmbeddedFilesLoader: (isDark: boolean) => EmbeddedFilesLoader;
  getExportInternalLinks: typeof import("../../utils/utils").getExportInternalLinks;
  getExportPadding: typeof import("../../utils/utils").getExportPadding;
  getExportTheme: typeof import("../../utils/utils").getExportTheme;
  getPNG: typeof import("../../utils/utils").getPNG;
  getPNGScale: typeof import("../../utils/utils").getPNGScale;
  getSVG: typeof import("../../utils/utils").getSVG;
  getWithBackground: typeof import("../../utils/utils").getWithBackground;
  isMaskFile: typeof import("../../utils/utils").isMaskFile;
  sceneRemoveInternalLinks: typeof import("../../utils/excalidrawViewUtils").sceneRemoveInternalLinks;
}

/**
 * Owns export option resolution and raw, SVG, PNG, clipboard, and PDF export
 * operations for one {@link ExcalidrawView}.
 *
 * The view retains its public export methods as compatibility delegates for
 * scripts, dialogs, commands, and ExcalidrawAutomate. Export dialog state also
 * remains on the view because existing consumers access that field directly.
 */
export class ViewExportManager {
  public constructor(
    private readonly view: ExcalidrawView,
    private readonly dependencies: ViewExportDependencies,
  ) {}

  /** Saves the supplied or current scene beside the Markdown file as JSON. */
  public saveExcalidraw(scene?: ExcalidrawViewScene): void {
    if (!scene) {
      if (!this.view.excalidrawAPI) {
        return;
      }
      scene = this.view.getScene();
    }
    const filepath = `${this.view.file?.path.substring(
      0,
      this.view.file.path.lastIndexOf(".md"),
    )}.excalidraw`;
    void exportImageToFile(
      this.view,
      filepath,
      JSON.stringify(scene, null, "\t"),
      ".excalidraw",
    );
  }

  /** Downloads or saves the current scene as a raw `.excalidraw` file. */
  public async exportExcalidraw(selectedOnly?: boolean): Promise<void> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return;
    }
    if (DEVICE.isMobile) {
      const location = await new FileAndFolderSelectorModal(this.view.app, {
        title: t("FILE_AND_FOLDER_SELECTOR_EXPORT_TITLE"),
        folderLabel: t("FILE_AND_FOLDER_SELECTOR_FOLDER"),
        fileNameLabel: t("FILE_AND_FOLDER_SELECTOR_FILENAME"),
        submitButtonText: t("FILE_AND_FOLDER_SELECTOR_EXPORT"),
        folderPath: splitFolderAndFilename(this.view.file.path).folderpath,
        fileName: `${this.view.file.basename}.excalidraw`,
      }).start();
      if (!location) {
        return;
      }
      const filename = location.fileName.toLowerCase().endsWith(".excalidraw")
        ? location.fileName
        : `${location.fileName}.excalidraw`;
      const path = getNewUniqueFilepath(
        this.view.app.vault,
        filename,
        location.folderPath,
      );
      const file = await exportImageToFile(
        this.view,
        path,
        JSON.stringify(this.view.getScene(), null, "\t"),
        ".excalidraw",
      );
      new Notice(`Exported to ${file?.name}`, 6000);
      return;
    }
    download(
      "data:text/plain;charset=utf-8",
      encodeURIComponent(
        JSON.stringify(this.view.getScene(selectedOnly), null, "\t"),
      ),
      `${this.view.file.basename}.excalidraw`,
    );
  }

  /** Resolves the explicit, dialog, or file-based export theme. */
  public getViewExportTheme(theme?: string): string {
    if (theme) {
      return theme;
    }
    if (!this.view.file) {
      return (
        this.view.excalidrawAPI.getAppState() as unknown as { theme: string }
      ).theme;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return ed
      ? ed.theme
      : this.dependencies.getExportTheme(
          this.view.plugin,
          this.view.file,
          (
            this.view.excalidrawAPI.getAppState() as unknown as {
              theme: string;
            }
          ).theme,
        );
  }

  /** Resolves whether the serialized scene is embedded in an image export. */
  public getViewExportEmbedScene(embedScene?: boolean): boolean {
    if (!this.view.file) {
      return false;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return typeof embedScene === "undefined"
      ? ed
        ? ed.embedScene
        : false
      : embedScene;
  }

  /** Resolves the explicit, dialog, or file-based image padding. */
  public getViewExportPadding(padding?: number): number {
    if (typeof padding !== "undefined") {
      return padding;
    }
    if (!this.view.file) {
      return 0;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return ed
      ? ed.padding
      : this.dependencies.getExportPadding(this.view.plugin, this.view.file);
  }

  /** Resolves the explicit, dialog, or file-based PNG scale. */
  public getViewExportScale(scale?: number): number {
    if (typeof scale !== "undefined") {
      return scale;
    }
    if (!this.view.file) {
      return 1;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return ed
      ? ed.scale
      : this.dependencies.getPNGScale(this.view.plugin, this.view.file);
  }

  /** Resolves whether image exports include the canvas background. */
  public getViewExportWithBackground(
    withBackground?: boolean,
  ): boolean | undefined {
    if (typeof withBackground !== "undefined" || !this.view.file) {
      return withBackground;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return ed
      ? !ed.transparent
      : this.dependencies.getWithBackground(
          this.view.plugin,
          this.view.file,
        );
  }

  /** Resolves whether SVG and PDF exports preserve internal links. */
  public getViewExportIncludeInternalLinks(
    includeInternalLinks?: boolean,
  ): boolean | undefined {
    if (typeof includeInternalLinks !== "undefined" || !this.view.file) {
      return includeInternalLinks;
    }
    const ed = this.dependencies.getOrCreateExportDialog();
    return ed
      ? ed.exportInternalLinks
      : this.dependencies.getExportInternalLinks(
          this.view.plugin,
          this.view.file,
        );
  }

  /** Creates an SVG for the supplied scene using the view's export options. */
  public async svg(
    scene: ExcalidrawViewScene,
    theme?: string,
    embedScene?: boolean,
    embedFont: boolean = false,
  ): Promise<SVGSVGElement> {
    const exportSettings: ExportSettings = {
      withBackground: !!this.getViewExportWithBackground(),
      withTheme: true,
      isMask: this.dependencies.isMaskFile(
        this.view.plugin,
        this.view.file,
      ),
      skipInliningFonts: !embedFont,
    };

    const exportTheme = this.getViewExportTheme(theme) as "dark" | "light";
    const overrideFiles = await this.loadFilesForExport(exportTheme);

    return await this.dependencies.getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: exportTheme,
            exportEmbedScene: this.getViewExportEmbedScene(embedScene),
          },
        },
      },
      exportSettings,
      this.getViewExportPadding(),
      this.view.file,
      overrideFiles ?? undefined,
    );
  }

  /** Saves SVG autoexports for the supplied or current scene. */
  public async saveSVG(data: {
    scene?: ExcalidrawViewScene;
    embedScene?: boolean;
    autoexportConfig?: AutoexportConfig;
  }): Promise<void | false> {
    const diagnosticsEnabled = performanceDiagnosticsEnabled();
    const diagnosticsStart = diagnosticsEnabled
      ? performanceDiagnosticNow()
      : 0;
    if (!data) {
      data = {};
    }
    if (!this.view.file) {
      return;
    }
    let { scene, embedScene, autoexportConfig } = data;
    if (!scene) {
      if (!this.view.excalidrawAPI) {
        return false;
      }
      scene = this.view.getScene();
    }

    const exportImage = async (filepath: string, theme?: string) => {
      const svg = await this.svg(scene, theme, embedScene, true);
      if (!svg) {
        return;
      }
      // Serialize before passing the SVG across Obsidian's file boundary.
      // See https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026.
      const svgString = svg.outerHTML;
      await exportImageToFile(
        this.view,
        filepath,
        svgString,
        theme === "dark"
          ? ".dark.svg"
          : theme === "light"
            ? ".light.svg"
            : ".svg",
      );
    };

    if (
      autoexportConfig?.theme
        ? autoexportConfig.theme === "both"
        : this.view.plugin.settings.autoExportLightAndDark
    ) {
      await exportImage(
        getIMGFilename(this.view.file.path, "dark.svg"),
        "dark",
      );
      await exportImage(
        getIMGFilename(this.view.file.path, "light.svg"),
        "light",
      );
    } else {
      await exportImage(
        getIMGFilename(this.view.file.path, "svg"),
        autoexportConfig?.theme,
      );
    }
    const durationMs = diagnosticsEnabled
      ? performanceDiagnosticNow() - diagnosticsStart
      : 0;
    if (diagnosticsEnabled) {
      performanceDiagnosticRecordDuration("autoexportSvg", durationMs);
    }
    performanceDiagnosticLog("autoexport.complete", {
      viewId: this.view.id,
      kind: "svg",
      durationMs: diagnosticsEnabled ? durationMs : undefined,
      elements: scene.elements.length,
    });
  }

  /** Downloads an SVG export of the current or selected scene. */
  public async exportSVG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<void> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return;
    }

    const scene = this.view.getScene(selectedOnly);
    if (!scene) {
      return;
    }
    if (!this.getViewExportIncludeInternalLinks()) {
      scene.elements = this.dependencies.sceneRemoveInternalLinks(scene);
    }
    const svg = await this.svg(scene, undefined, embedScene, true);
    if (!svg) {
      return;
    }
    exportSVG(svg, this.view.file.basename);
  }

  /** Returns an SVG export of the current or selected scene. */
  public async getSVG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<SVGSVGElement> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return new SVGSVGElement();
    }

    const svg = await this.svg(
      this.view.getScene(selectedOnly),
      undefined,
      embedScene,
      true,
    );
    if (!svg) {
      return new SVGSVGElement();
    }
    return svg;
  }

  /** Downloads a PDF export of the current or selected scene. */
  public async exportPDF(
    selectedOnly?: boolean,
    pageSize: PageSize = "A4",
    orientation: PageOrientation = "portrait",
  ): Promise<void> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return;
    }

    const scene = this.view.getScene(selectedOnly);
    if (!scene) {
      return;
    }
    if (!this.getViewExportIncludeInternalLinks()) {
      scene.elements = this.dependencies.sceneRemoveInternalLinks(scene);
    }

    const svg = await this.svg(scene, undefined, false, true);
    if (!svg) {
      return;
    }

    const boundingBox = this.view.plugin.ea.getBoundingBox(scene.elements);
    const margin = getMarginValue(this.view.exportDialog?.margin ?? "normal");
    const [width, height] = [boundingBox.width, boundingBox.height];

    await exportToPDF({
      SVG: [svg],
      scale: {
        zoom: this.view.exportDialog?.scale ?? 1,
        fitToPage:
          pageSize === "MATCH IMAGE" || pageSize === "HD Screen"
            ? 1
            : (this.view.exportDialog?.fitToPage ?? 1),
      },
      pageProps: {
        dimensions: getPageDimensions(pageSize, orientation, { width, height }),
        backgroundColor:
          this.view.exportDialog?.getPaperColor() ?? "#FFFFFF",
        margin,
        alignment: this.view.exportDialog?.alignment ?? "center",
      },
      filename: `${this.view.file.basename}.pdf`,
    });
  }

  /** Creates a PNG blob for the supplied scene using the view's export options. */
  public async png(
    scene: ExcalidrawViewScene,
    theme?: string,
    embedScene?: boolean,
  ): Promise<Blob> {
    const exportSettings: ExportSettings = {
      withBackground: !!this.getViewExportWithBackground(),
      withTheme: true,
      isMask: this.dependencies.isMaskFile(
        this.view.plugin,
        this.view.file,
      ),
    };

    const exportTheme = this.getViewExportTheme(theme) as "dark" | "light";
    const overrideFiles = await this.loadFilesForExport(exportTheme);

    return await this.dependencies.getPNG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: exportTheme,
            exportEmbedScene: this.getViewExportEmbedScene(embedScene),
          },
        },
      },
      exportSettings,
      this.getViewExportPadding(),
      this.getViewExportScale(),
      overrideFiles ?? undefined,
    );
  }

  /** Saves PNG autoexports for the supplied or current scene. */
  public async savePNG(data: {
    scene?: ExcalidrawViewScene;
    embedScene?: boolean;
    autoexportConfig?: AutoexportConfig;
  }): Promise<void | false> {
    const diagnosticsEnabled = performanceDiagnosticsEnabled();
    const diagnosticsStart = diagnosticsEnabled
      ? performanceDiagnosticNow()
      : 0;
    if (!data) {
      data = {};
    }
    if (!this.view.file) {
      return;
    }
    let { scene, embedScene, autoexportConfig } = data;
    if (!scene) {
      if (!this.view.excalidrawAPI) {
        return false;
      }
      scene = this.view.getScene();
    }

    const exportImage = async (filepath: string, theme?: string) => {
      const png = await this.png(scene, theme, embedScene);
      if (!png) {
        return;
      }
      await exportImageToFile(
        this.view,
        filepath,
        png,
        theme === "dark"
          ? ".dark.png"
          : theme === "light"
            ? ".light.png"
            : ".png",
      );
    };

    if (
      autoexportConfig?.theme
        ? autoexportConfig.theme === "both"
        : this.view.plugin.settings.autoExportLightAndDark
    ) {
      await exportImage(
        getIMGFilename(this.view.file.path, "dark.png"),
        "dark",
      );
      await exportImage(
        getIMGFilename(this.view.file.path, "light.png"),
        "light",
      );
    } else {
      await exportImage(
        getIMGFilename(this.view.file.path, "png"),
        autoexportConfig?.theme,
      );
    }
    const durationMs = diagnosticsEnabled
      ? performanceDiagnosticNow() - diagnosticsStart
      : 0;
    if (diagnosticsEnabled) {
      performanceDiagnosticRecordDuration("autoexportPng", durationMs);
    }
    performanceDiagnosticLog("autoexport.complete", {
      viewId: this.view.id,
      kind: "png",
      durationMs: diagnosticsEnabled ? durationMs : undefined,
      elements: scene.elements.length,
    });
  }

  /** Copies a PNG export of the current or selected scene to the clipboard. */
  public async exportPNGToClipboard(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<void> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return;
    }

    const png = await this.png(
      this.view.getScene(selectedOnly),
      undefined,
      embedScene,
    );
    if (!png) {
      return;
    }

    // Safari requires ClipboardItem creation to remain associated with the
    // originating user gesture. The shared helper preserves the established
    // Promise-based ClipboardItem fallback for that browser behavior.
    await exportPNGToClipboard(png);
  }

  /** Downloads a PNG export of the current or selected scene. */
  public async exportPNG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<void> {
    if (!this.view.excalidrawAPI || !this.view.file) {
      return;
    }

    const png = await this.png(
      this.view.getScene(selectedOnly),
      undefined,
      embedScene,
    );
    if (!png) {
      return;
    }
    exportPNG(png, this.view.file.basename);
  }

  /** Reloads embedded files when an export theme differs from the view theme. */
  private async loadFilesForExport(
    exportTheme: string,
  ): Promise<Record<FileId, BinaryFileData> | null> {
    const api = this.view.excalidrawAPI;
    if (!api || !this.view.excalidrawData) {
      return null;
    }

    const viewTheme = (api.getAppState() as unknown as { theme: string }).theme;
    if (!exportTheme || exportTheme === viewTheme) {
      return null;
    }

    const loader = this.dependencies.createEmbeddedFilesLoader(
      exportTheme === "dark",
    );
    const collected: Record<FileId, BinaryFileData> = {};
    let resolved = false;

    void (await new Promise<void>((resolve) => {
      void loader.loadSceneFiles({
        excalidrawData: this.view.excalidrawData,
        sceneElements: this.view.getViewElements(),
        addFiles: (
          files: FileData[],
          _isDark: boolean,
          final: boolean = true,
        ) => {
          if (files && files.length > 0) {
            files.forEach((f) => {
              const fileId = f.id;
              collected[fileId] = { ...f };
            });
          }
          if (final && !resolved) {
            resolved = true;
            resolve();
          }
        },
        depth: 0,
        isThemeChange: true,
      });
    }));

    return Object.keys(collected).length ? collected : null;
  }
}
