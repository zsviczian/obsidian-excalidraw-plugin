import type { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import type { BinaryFileData } from "@zsviczian/excalidraw/types/excalidraw/types";
import { normalizePath, type TFile } from "obsidian";

import type ExcalidrawPlugin from "../main";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  type EmbeddedFilesDataSource,
} from "../../shared/EmbeddedFileLoader";
import type { FileData } from "../../types/embeddedFileLoaderTypes";
import type { ExportSettings } from "../../types/exportUtilTypes";
import type { ExcalidrawViewScene } from "../../types/excalidrawViewTypes";
import { errorlog } from "../../utils/coreUtils";
import { createOrOverwriteFile } from "../../utils/fileUtils";
import { sceneRemoveInternalLinks } from "../../utils/excalidrawViewUtils";
import { getPNG, getSVG } from "../../utils/utils";
import {
  cloneSceneForSave,
  type PreparedSaveExportData,
  type PreparedSaveExportOptions,
  type SaveOperationContext,
} from "../../view/managers/saveSnapshot";
import {
  AutoexportJobQueue,
  type AutoexportJobGuard,
} from "./AutoexportJobQueue";
import {
  AutoexportSaveBatchGate,
  type AutoexportSaveBatchScheduler,
} from "./AutoexportSaveBatchGate";
import { KeyedAsyncLock } from "./KeyedAsyncLock";

const MIGRATION_AUTOEXPORT_TTL_MS = 60_000;
const AUTOEXPORT_SAVE_BATCH_SETTLE_MS = 500;

export type AutoexportFormat = "svg" | "png" | "excalidraw";
export type AutoexportTheme = "light" | "dark" | null;

export interface PreparedAutoexportOutput {
  readonly format: AutoexportFormat;
  readonly theme: AutoexportTheme;
  readonly destinationPath: string;
}

interface PreparedAutoexportRequestBase extends SaveOperationContext {
  readonly sourceFilePath: string;
  readonly sourceFileCtime: number;
  readonly capturedRevision: number;
}

/** Lightweight marker preventing an older revision from writing stale output. */
export interface PreparedAutoexportBarrierRequest extends PreparedAutoexportRequestBase {
  readonly kind: "barrier";
  readonly outputs: readonly [];
}

/** Immutable render intent captured while the originating view is alive. */
export interface PreparedAutoexportRenderRequest extends PreparedAutoexportRequestBase {
  readonly kind: "render";
  readonly scene: ExcalidrawViewScene;
  readonly exportOptions: PreparedSaveExportOptions;
  readonly exportData: PreparedSaveExportData | null;
  readonly outputs: readonly PreparedAutoexportOutput[];
}

export type PreparedAutoexportRequest =
  | PreparedAutoexportBarrierRequest
  | PreparedAutoexportRenderRequest;

interface ThemeExportContext {
  readonly scene: ExcalidrawViewScene;
  readonly overrideFiles: Record<FileId, BinaryFileData> | null;
}

interface AutoexportScheduler extends AutoexportSaveBatchScheduler {
  readonly now: () => number;
}

interface DeferredMigrationAutoexport {
  readonly request: PreparedAutoexportRenderRequest;
  readonly expiresAt: number;
  readonly timer: number;
}

/**
 * Runs automatic exports after successful source persistence.
 *
 * One request is active per source identity and only its newest trailing
 * request is retained. Heavy rendering is serialized globally and yields
 * between formats. Final writes additionally compare the hook-resolved
 * destination, preventing an older render from overwriting newer output.
 */
export class AutoexportCoordinator {
  private readonly queue: AutoexportJobQueue<PreparedAutoexportRequest>;
  private readonly saveBatchGate: AutoexportSaveBatchGate<PreparedAutoexportRequest>;
  private readonly renderExecution = new KeyedAsyncLock();
  private readonly destinationWrites = new KeyedAsyncLock();
  private readonly deferredMigrations = new Map<
    string,
    DeferredMigrationAutoexport
  >();

  public constructor(
    private readonly plugin: ExcalidrawPlugin,
    private readonly scheduler: AutoexportScheduler,
  ) {
    this.queue = new AutoexportJobQueue({
      getSourceKey: (request) => this.getSourceKey(request),
      getDestinationKeys: (request) =>
        request.outputs.map((output) => normalizePath(output.destinationPath)),
      execute: (request, guard) =>
        this.renderExecution.run("autoexport-render", () =>
          this.execute(request, guard),
        ),
      onFailure: (error) => {
        errorlog({
          where: "AutoexportCoordinator",
          fn: "queue",
          error,
        });
      },
      schedule: (callback) => {
        this.scheduler.setTimeout(callback, 0);
      },
    });
    this.saveBatchGate = new AutoexportSaveBatchGate({
      scheduler: this.scheduler,
      settleDelayMs: AUTOEXPORT_SAVE_BATCH_SETTLE_MS,
      getSourceKey: (request) => this.getSourceKey(request),
      shouldRender: (request) => request.kind === "render",
      invalidate: (request) => this.queue.enqueue(this.createBarrier(request)),
      release: (request) => this.queue.enqueue(request),
    });
  }

  /** Accepts one prepared request in successful source-write order. */
  public enqueue(request: PreparedAutoexportRequest): void {
    this.saveBatchGate.publish(request);
  }

  /** Holds automatic rendering while one view drains its save queue. */
  public beginSaveActivity(
    sourceFilePath: string,
    sourceFileCtime: number,
  ): () => void {
    return this.saveBatchGate.beginActivity(
      this.getSourceKeyFromIdentity(sourceFilePath, sourceFileCtime),
    );
  }

  /** Defers migration rendering while immediately invalidating older output. */
  public deferUntilMigrationComplete(
    leafId: string,
    request: PreparedAutoexportRequest,
  ): void {
    this.queue.enqueue(this.createBarrier(request));
    const previous = this.deferredMigrations.get(leafId);
    if (previous) {
      this.scheduler.clearTimeout(previous.timer);
      this.deferredMigrations.delete(leafId);
    }
    if (request.kind === "barrier") {
      return;
    }
    const expiresAt = this.scheduler.now() + MIGRATION_AUTOEXPORT_TTL_MS;
    const deferred: DeferredMigrationAutoexport = {
      request,
      expiresAt,
      timer: this.scheduler.setTimeout(() => {
        if (this.deferredMigrations.get(leafId) === deferred) {
          this.deferredMigrations.delete(leafId);
        }
      }, MIGRATION_AUTOEXPORT_TTL_MS),
    };
    this.deferredMigrations.set(leafId, deferred);
  }

  /** Releases or discards the render after the replacement load settles. */
  public completeMigration(
    leafId: string,
    filePath: string,
    loadSucceeded: boolean,
  ): void {
    const deferred = this.deferredMigrations.get(leafId);
    if (!deferred) {
      return;
    }
    this.deferredMigrations.delete(leafId);
    this.scheduler.clearTimeout(deferred.timer);
    if (
      loadSucceeded &&
      deferred.expiresAt > this.scheduler.now() &&
      deferred.request.sourceFilePath === filePath
    ) {
      this.enqueue(deferred.request);
    }
  }

  /** Prevents work owned by an unloaded plugin runtime from writing later. */
  public destroy(): void {
    for (const deferred of this.deferredMigrations.values()) {
      this.scheduler.clearTimeout(deferred.timer);
    }
    this.deferredMigrations.clear();
    this.saveBatchGate.destroy();
    this.queue.destroy();
  }

  private createBarrier(
    request: PreparedAutoexportRequest,
  ): PreparedAutoexportBarrierRequest {
    return {
      kind: "barrier",
      producerId: request.producerId,
      targetGeneration: request.targetGeneration,
      operationId: request.operationId,
      requestedRevision: request.requestedRevision,
      sourceFilePath: request.sourceFilePath,
      sourceFileCtime: request.sourceFileCtime,
      capturedRevision: request.capturedRevision,
      outputs: [],
    };
  }

  private async execute(
    request: PreparedAutoexportRequest,
    guard: AutoexportJobGuard,
  ): Promise<void> {
    if (!guard.isCurrentSource()) {
      return;
    }
    const sourceFile = this.resolveSourceFile(request);
    if (!sourceFile) {
      return;
    }
    if (request.kind === "barrier") {
      return;
    }

    const themeContexts = new Map<
      "light" | "dark",
      Promise<ThemeExportContext>
    >();
    for (const output of request.outputs) {
      if (!guard.isCurrentSource()) {
        return;
      }
      // Export rendering is main-thread work. Yield between formats so input,
      // paint, and lifecycle tasks can run even when a save requests multiple
      // expensive outputs. The render itself is not preemptible.
      await this.yieldToMainTask();
      if (!guard.isCurrentSource()) {
        return;
      }
      try {
        let content: string | Blob;
        if (output.format === "excalidraw") {
          content = JSON.stringify(request.scene, null, "\t");
        } else {
          const theme = output.theme ?? request.exportOptions.theme;
          let contextPromise = themeContexts.get(theme);
          if (contextPromise === undefined) {
            contextPromise = this.prepareThemeContext(
              request,
              sourceFile,
              theme,
            );
            themeContexts.set(theme, contextPromise);
          }
          const context = await contextPromise;
          if (!guard.isCurrentSource()) {
            return;
          }
          content =
            output.format === "svg"
              ? await this.renderSVG(request, sourceFile, theme, context)
              : await this.renderPNG(request, theme, context);
        }
        await this.writeIfCurrent(request, guard, output, content);
      } catch (error: unknown) {
        errorlog({
          where: "AutoexportCoordinator",
          fn: `${output.format}:${output.theme ?? "scene"}`,
          error,
        });
      }
    }
  }

  private async prepareThemeContext(
    request: PreparedAutoexportRenderRequest,
    sourceFile: TFile,
    theme: "light" | "dark",
  ): Promise<ThemeExportContext> {
    const scene = request.exportOptions.includeInternalLinks
      ? request.scene
      : {
          ...request.scene,
          elements: sceneRemoveInternalLinks(request.scene),
        };
    const sourceTheme = scene.appState.theme === "dark" ? "dark" : "light";
    if (theme === sourceTheme || !request.exportData) {
      return { scene, overrideFiles: null };
    }

    const dataSource = this.createDataSource(
      request.exportData,
      sourceFile,
      scene,
    );
    const loader = new EmbeddedFilesLoader(this.plugin, theme === "dark");
    const collected: Record<FileId, BinaryFileData> = {};
    await new Promise<void>((resolve, reject) => {
      void loader
        .loadSceneFiles({
          excalidrawData: dataSource,
          sceneElements: scene.elements,
          addFiles: (
            files: FileData[],
            _isDark: boolean,
            final: boolean = true,
          ) => {
            for (const file of files ?? []) {
              collected[file.id] = { ...file };
            }
            if (final) {
              resolve();
            }
          },
          depth: 0,
          isThemeChange: true,
          markdownImageRenderDefaults:
            request.exportData.markdownImageRenderDefaults,
          pdfScale: request.exportData.pdfScale,
        })
        .catch(reject);
    });
    return {
      scene,
      overrideFiles: Object.keys(collected).length ? collected : null,
    };
  }

  private createDataSource(
    exportData: PreparedSaveExportData,
    sourceFile: TFile,
    scene: ExcalidrawViewScene,
  ): EmbeddedFilesDataSource {
    const files = new Map(
      Array.from(exportData.files, ([id, state]) => [
        id,
        EmbeddedFile.fromPreparedSaveState(this.plugin, state),
      ]),
    );
    return {
      file: sourceFile,
      scene: scene as EmbeddedFilesDataSource["scene"],
      getFileEntries: () => files.entries(),
      getFile: (fileId) => files.get(fileId),
      getMarkdownImage: (fileId) => exportData.markdownImages.get(fileId),
      getEquationEntries: () => exportData.equations.entries(),
      getEquation: (fileId) => exportData.equations.get(fileId),
    };
  }

  private async renderSVG(
    request: PreparedAutoexportRenderRequest,
    sourceFile: TFile,
    theme: "light" | "dark",
    context: ThemeExportContext,
  ): Promise<string> {
    const scene = this.createRenderScene(request, theme, context.scene);
    const settings = this.getExportSettings(request, true);
    const svg = await getSVG(
      scene,
      settings,
      request.exportOptions.padding,
      sourceFile,
      context.overrideFiles ?? undefined,
    );
    if (!svg) {
      throw new Error("SVG renderer returned no output");
    }
    return svg.outerHTML;
  }

  private async renderPNG(
    request: PreparedAutoexportRenderRequest,
    theme: "light" | "dark",
    context: ThemeExportContext,
  ): Promise<Blob> {
    const png = await getPNG(
      this.createRenderScene(request, theme, context.scene),
      this.getExportSettings(request, false),
      request.exportOptions.padding,
      request.exportOptions.scale,
      context.overrideFiles ?? undefined,
    );
    if (!png) {
      throw new Error("PNG renderer returned no output");
    }
    return png;
  }

  private createRenderScene(
    request: PreparedAutoexportRenderRequest,
    theme: "light" | "dark",
    preparedScene: ExcalidrawViewScene,
  ): ExcalidrawViewScene {
    const scene = cloneSceneForSave(preparedScene);
    scene.appState = {
      ...scene.appState,
      theme,
      exportEmbedScene: request.exportOptions.embedScene,
    };
    return scene;
  }

  private getExportSettings(
    request: PreparedAutoexportRenderRequest,
    isSVG: boolean,
  ): ExportSettings {
    return {
      withBackground: request.exportOptions.withBackground,
      withTheme: true,
      isMask: request.exportOptions.isMask,
      ...(isSVG ? { skipInliningFonts: false } : {}),
    };
  }

  private async writeIfCurrent(
    request: PreparedAutoexportRequest,
    guard: AutoexportJobGuard,
    output: PreparedAutoexportOutput,
    content: string | Blob,
  ): Promise<void> {
    const destinationPath = normalizePath(output.destinationPath);
    await this.destinationWrites.run(destinationPath, async () => {
      if (
        !guard.isCurrentSource() ||
        !guard.isCurrentDestination(destinationPath) ||
        !this.resolveSourceFile(request)
      ) {
        return;
      }
      await createOrOverwriteFile(this.plugin.app, destinationPath, content);
    });
  }

  private resolveSourceFile(request: PreparedAutoexportRequest): TFile | null {
    const file = this.plugin.app.vault.getFileByPath(request.sourceFilePath);
    return file && file.stat.ctime === request.sourceFileCtime ? file : null;
  }

  private getSourceKey(request: PreparedAutoexportRequest): string {
    return this.getSourceKeyFromIdentity(
      request.sourceFilePath,
      request.sourceFileCtime,
    );
  }

  private getSourceKeyFromIdentity(
    sourceFilePath: string,
    sourceFileCtime: number,
  ): string {
    return `${sourceFilePath}\u0000${sourceFileCtime}`;
  }

  private yieldToMainTask(): Promise<void> {
    return new Promise((resolve) => {
      this.scheduler.setTimeout(resolve, 0);
    });
  }
}
