import type { FileId } from "@zsviczian/excalidraw/types/element/src/types";

import type {
  DeferredCacheValidation,
  EmbeddedFilesLoader,
} from "../../shared/EmbeddedFileLoader";
import type { FileData } from "../../types/embeddedFileLoaderTypes";
import type ExcalidrawView from "../ExcalidrawView";
import {
  nextPerformanceDiagnosticId,
  performanceDiagnosticIncrement,
  performanceDiagnosticLog,
  performanceDiagnosticNow,
  performanceDiagnosticRecordDuration,
  performanceDiagnosticsEnabled,
} from "../../utils/performanceDiagnostics";

/** Runtime dependencies supplied by the composition root to avoid adding a
 * circular import.
 *
 * `createEmbeddedFilesLoader` mirrors the identically-shaped factory already
 * injected into `ViewExportManager` -- `EmbeddedFilesLoader` sits on the
 * plugin's existing `EmbeddedFileLoader.ts`/`ExcalidrawData.ts` import
 * cycle, so a fresh instance is created by the composition root rather than
 * this file importing the class directly.
 *
 * `addFiles` stays defined in `ExcalidrawView.ts` (it's shared with the
 * unrelated LaTeX-equation-editing flow) and is injected the same way. */
export interface ViewSceneFileManagerDependencies {
  createEmbeddedFilesLoader: (isDark?: boolean) => EmbeddedFilesLoader;
  addFiles: typeof import("../ExcalidrawView").addFiles;
}

/**
 * Owns the embedded-file loading pipeline (RefactorPlan.md Phase 6,
 * "ViewSceneFileManager"): the active/next loader pair, the deferred
 * background revalidation pass and its timer, the request-coalescing queue,
 * and the stale-image retry loop.
 *
 * `loadSceneFiles()` and `scheduleSceneFileDeferredValidation()` are called
 * through thin public delegates kept on `ExcalidrawView` -- both are part of
 * the ExcalidrawAutomate/EventManager public surface
 * (`ExcalidrawAutomate.ts`'s `targetView.loadSceneFiles()` and
 * `EventManager.ts`'s leaf-switch `scheduleSceneFileDeferredValidation()`
 * call) -- so every existing caller keeps calling the view unchanged.
 * `terminateActiveLoaders()` is the single teardown entry point called from
 * `ExcalidrawView.onClose()`, `onunload()`, and `clear()`, replacing what
 * was three identical inlined blocks.
 *
 * Author: zsviczian (extraction); original implementation predates this move.
 */
export class ViewSceneFileManager {
  public activeLoader: EmbeddedFilesLoader = null;
  private nextLoader: EmbeddedFilesLoader = null;
  private deferredValidationLoader: EmbeddedFilesLoader = null;
  private deferredValidationTimer: number | null = null;
  private deferredValidationFilePath: string | null = null;
  private nextLoaderDiagnosticContext: {
    requestId: string;
    reason: string;
  } | null = null;
  private queuedLoadSceneFilesRequest: {
    isThemeChange: boolean;
    fileIDWhiteList?: Set<FileId>;
    forceReloadFileIDs?: Set<FileId>;
    callback?: () => void;
    diagnosticReason: string;
  } | null = null;
  // Cache metadata collected during the stale-first pass. These are the only
  // files that need validation after the scene is already visible.
  private pendingDeferredValidationCandidates = new Map<
    FileId,
    DeferredCacheValidation
  >();

  public constructor(
    private readonly view: ExcalidrawView,
    private readonly dependencies: ViewSceneFileManagerDependencies,
  ) {}

  /** Terminates any in-flight loaders and cancels deferred validation. Called
   * from `ExcalidrawView.onClose()`, `onunload()`, and `clear()`. */
  public terminateActiveLoaders(): void {
    this.cancelDeferredSceneFileValidation();
    if (this.activeLoader) {
      this.activeLoader.terminate = true;
      this.activeLoader.emptyPDFDocsMap();
      this.activeLoader = null;
    }
    if (this.nextLoader) {
      this.nextLoader.terminate = true;
      this.nextLoader.emptyPDFDocsMap();
      this.nextLoader = null;
    }
    this.nextLoaderDiagnosticContext = null;
  }

  private cancelDeferredSceneFileValidation() {
    if (this.deferredValidationTimer) {
      window.clearTimeout(this.deferredValidationTimer);
      this.deferredValidationTimer = null;
    }
    if (this.deferredValidationLoader) {
      this.deferredValidationLoader.terminate = true;
      this.deferredValidationLoader.emptyPDFDocsMap();
      this.deferredValidationLoader = null;
    }
    this.deferredValidationFilePath = null;
    this.queuedLoadSceneFilesRequest = null;
  }

  private addDeferredValidationCandidates(
    candidates?: ReadonlyMap<FileId, DeferredCacheValidation>,
  ) {
    if (!candidates || candidates.size === 0) {
      return;
    }
    candidates.forEach((validation, fileId) =>
      this.pendingDeferredValidationCandidates.set(fileId, validation),
    );
  }

  private scheduleDeferredSceneFileValidation(
    candidates: Map<FileId, DeferredCacheValidation>,
    isThemeChange: boolean,
    emitPolicy: "changed-only" | "all" = "changed-only",
    diagnosticReason: string = "unspecified",
  ) {
    this.cancelDeferredSceneFileValidation();
    if (
      !candidates ||
      candidates.size === 0 ||
      !this.view.file ||
      !this.view.excalidrawAPI
    ) {
      return;
    }

    const fileIDs = new Set(candidates.keys());
    const currentFile = this.view.file.path;
    const loader = this.dependencies.createEmbeddedFilesLoader();
    const diagnosticsEnabled = performanceDiagnosticsEnabled();
    const diagnosticId = diagnosticsEnabled
      ? nextPerformanceDiagnosticId("sceneValidation")
      : "";
    performanceDiagnosticIncrement("sceneFileDeferredValidationScheduled");
    performanceDiagnosticLog("sceneFiles.validationScheduled", {
      id: diagnosticId,
      viewId: this.view.id,
      candidates: fileIDs.size,
      themeChange: isThemeChange,
      emitPolicy,
      reason: diagnosticReason,
    });
    this.deferredValidationFilePath = currentFile;
    this.deferredValidationTimer = window.setTimeout(() => {
      const validationStart = diagnosticsEnabled
        ? performanceDiagnosticNow()
        : 0;
      let emittedFiles = 0;
      let emittedBatches = 0;
      this.deferredValidationTimer = null;
      if (
        !this.view.file ||
        !this.view.excalidrawAPI ||
        this.view.file.path !== currentFile
      ) {
        this.deferredValidationFilePath = null;
        return;
      }

      this.deferredValidationLoader = loader;
      // Second pass is intentionally conservative: revalidate only stale-first
      // candidates, run one at a time, and emit only regenerated images.
      void loader.loadSceneFiles({
        excalidrawData: this.view.excalidrawData,
        sceneElements: this.view.getViewElements(),
        addFiles: (
          files: FileData[],
          isDark: boolean,
          final: boolean = true,
        ) => {
          if (
            !this.view.file ||
            !this.view.excalidrawAPI ||
            this.view.file.path !== currentFile
          ) {
            if (final && this.deferredValidationLoader === loader) {
              this.deferredValidationLoader = null;
              this.deferredValidationFilePath = null;
            }
            return;
          }
          if (files && files.length > 0) {
            emittedFiles += files.length;
            emittedBatches += 1;
            void this.dependencies.addFiles(files, this.view, isDark);
          }
          if (!final) {
            return;
          }
          this.view.lastSceneLoadTime = Date.now();
          if (this.deferredValidationLoader === loader) {
            this.deferredValidationLoader = null;
          }
          this.deferredValidationFilePath = null;
          const validationMs = diagnosticsEnabled
            ? performanceDiagnosticNow() - validationStart
            : 0;
          if (diagnosticsEnabled) {
            performanceDiagnosticRecordDuration(
              "sceneFileDeferredValidation",
              validationMs,
            );
          }
          performanceDiagnosticLog("sceneFiles.validationComplete", {
            id: diagnosticId,
            viewId: this.view.id,
            candidates: fileIDs.size,
            emittedFiles,
            emittedBatches,
            reason: diagnosticReason,
            durationMs: diagnosticsEnabled ? validationMs : undefined,
          });
          const queuedLoad = this.queuedLoadSceneFilesRequest;
          this.queuedLoadSceneFilesRequest = null;
          if (queuedLoad && this.view.file?.path === currentFile) {
            void this.loadSceneFiles(
              queuedLoad.isThemeChange,
              queuedLoad.fileIDWhiteList,
              queuedLoad.callback,
              queuedLoad.forceReloadFileIDs,
              queuedLoad.diagnosticReason,
            );
          }
        },
        depth: 0,
        isThemeChange,
        fileIDWhiteList: fileIDs,
        forceReloadFileIDs: fileIDs,
        cacheValidation: "validated",
        deferredCacheValidation: candidates,
        validationConcurrency: 1,
        emitPolicy,
      });
    }, 250);
  }

  public scheduleSceneFileDeferredValidation(
    fileIDs: Set<FileId>,
    isThemeChange: boolean = false,
    forceEmitFromCache: boolean = false,
    diagnosticReason: string = "unspecified",
  ) {
    if (!this.view.excalidrawAPI || !fileIDs || fileIDs.size === 0) {
      return;
    }
    if (this.activeLoader) {
      this.addDeferredValidationCandidates(
        new Map(
          Array.from(fileIDs, (fileId) => [
            fileId,
            { kind: "reload" } as const,
          ]),
        ),
      );
      return;
    }
    this.scheduleDeferredSceneFileValidation(
      new Map(
        Array.from(fileIDs, (fileId) => [
          fileId,
          { kind: "reload" } as const,
        ]),
      ),
      isThemeChange,
      forceEmitFromCache ? "all" : "changed-only",
      diagnosticReason,
    );
  }

  public async loadSceneFiles(
    isThemeChange: boolean = false,
    fileIDWhiteList?: Set<FileId>,
    callback?: () => void,
    forceReloadFileIDs?: Set<FileId>,
    diagnosticReason: string = "unspecified",
  ) {
    const diagnosticsEnabled = performanceDiagnosticsEnabled();
    const requestId = diagnosticsEnabled
      ? nextPerformanceDiagnosticId("sceneLoad")
      : "";
    const embeddedFileEntries = diagnosticsEnabled
      ? Array.from(this.view.excalidrawData.files.entries())
      : [];
    const apiFileIds = new Set(
      diagnosticsEnabled && this.view.excalidrawAPI
        ? Object.keys(this.view.excalidrawAPI.getFiles())
        : [],
    );
    const unresolvedEmbeddedFiles = diagnosticsEnabled
      ? embeddedFileEntries.filter(([, embeddedFile]) => !embeddedFile?.file)
          .length
      : undefined;
    const unresolvedVaultFiles = diagnosticsEnabled
      ? embeddedFileEntries.filter(
          ([, embeddedFile]) =>
            embeddedFile &&
            !embeddedFile.file &&
            !embeddedFile.isHyperLink &&
            !embeddedFile.isLocalLink,
        ).length
      : undefined;
    const externalOrLocalFiles = diagnosticsEnabled
      ? embeddedFileEntries.filter(
          ([, embeddedFile]) =>
            embeddedFile?.isHyperLink || embeddedFile?.isLocalLink,
        ).length
      : undefined;
    const missingApiBinaryFiles = diagnosticsEnabled
      ? embeddedFileEntries.filter(([fileId]) => !apiFileIds.has(fileId)).length
      : undefined;
    performanceDiagnosticIncrement("loadSceneFilesRequest");
    performanceDiagnosticIncrement(`loadSceneFilesReason.${diagnosticReason}`);
    performanceDiagnosticLog("sceneFiles.request", {
      id: requestId,
      viewId: this.view.id,
      reason: diagnosticReason,
      themeChange: isThemeChange,
      whitelist: fileIDWhiteList?.size ?? 0,
      forceReload: forceReloadFileIDs?.size ?? 0,
      embeddedFiles: this.view.excalidrawData?.getFiles().length ?? 0,
      apiBinaryFiles: diagnosticsEnabled ? apiFileIds.size : undefined,
      missingApiBinaryFiles,
      unresolvedEmbeddedFiles,
      unresolvedVaultFiles,
      externalOrLocalFiles,
      activeLoader: Boolean(this.activeLoader),
      deferredValidation: Boolean(
        this.deferredValidationLoader || this.deferredValidationTimer,
      ),
    });
    if (!this.view.excalidrawAPI) {
      performanceDiagnosticLog("sceneFiles.skipped", {
        id: requestId,
        viewId: this.view.id,
        reason: diagnosticReason,
        skipReason: "api-missing",
      });
      return;
    }

    const requestFilePath = this.view.file?.path ?? null;
    const deferredValidationForSameFile =
      !!requestFilePath &&
      this.deferredValidationFilePath === requestFilePath &&
      (this.deferredValidationTimer !== null ||
        !!this.deferredValidationLoader);

    if (deferredValidationForSameFile) {
      // Keep deferred validation running for the current file and enqueue this request.
      this.queuedLoadSceneFilesRequest = {
        isThemeChange,
        fileIDWhiteList,
        callback,
        forceReloadFileIDs,
        diagnosticReason,
      };
      performanceDiagnosticIncrement("loadSceneFilesQueued");
      performanceDiagnosticLog("sceneFiles.queued", {
        id: requestId,
        viewId: this.view.id,
        reason: diagnosticReason,
        queueReason: "deferred-validation",
      });
      return;
    }

    this.cancelDeferredSceneFileValidation();
    if (!this.activeLoader) {
      this.pendingDeferredValidationCandidates.clear();
    }

    const loader = this.dependencies.createEmbeddedFilesLoader();

    const runLoader = (
      l: EmbeddedFilesLoader,
      effectiveRequestId: string = requestId,
      effectiveReason: string = diagnosticReason,
    ) => {
      this.nextLoader = null;
      this.nextLoaderDiagnosticContext = null;
      this.activeLoader = l;
      const runId = diagnosticsEnabled
        ? nextPerformanceDiagnosticId("sceneLoadRun")
        : "";
      const runStart = diagnosticsEnabled ? performanceDiagnosticNow() : 0;
      let emittedFiles = 0;
      let emittedBatches = 0;
      performanceDiagnosticIncrement("loadSceneFilesRun");
      performanceDiagnosticLog("sceneFiles.runStart", {
        id: runId,
        requestId: effectiveRequestId,
        parameterSourceRequestId: requestId,
        viewId: this.view.id,
        reason: effectiveReason,
        themeChange: isThemeChange,
        whitelist: fileIDWhiteList?.size ?? 0,
        forceReload: forceReloadFileIDs?.size ?? 0,
        sceneElements: this.view.getViewElements().length,
        embeddedFiles: this.view.excalidrawData.getFiles().length,
      });
      void l.loadSceneFiles({
        excalidrawData: this.view.excalidrawData,
        sceneElements: this.view.getViewElements(),
        addFiles: (
          files: FileData[],
          isDark: boolean,
          final: boolean = true,
        ) => {
          if (callback && final) {
            callback();
          }
          if (!this.view.file || !this.view.excalidrawAPI) {
            return; //The view was closed in the mean time
          }
          if (files && files.length > 0) {
            emittedFiles += files.length;
            emittedBatches += 1;
            void this.dependencies.addFiles(files, this.view, isDark);
          }
          if (!final) {
            return;
          }
          const runMs = diagnosticsEnabled
            ? performanceDiagnosticNow() - runStart
            : 0;
          if (diagnosticsEnabled) {
            performanceDiagnosticRecordDuration("loadSceneFiles", runMs);
          }
          performanceDiagnosticLog("sceneFiles.runComplete", {
            id: runId,
            requestId: effectiveRequestId,
            parameterSourceRequestId: requestId,
            viewId: this.view.id,
            reason: effectiveReason,
            emittedFiles,
            emittedBatches,
            terminalState: l.terminalState,
            apiBinaryFiles: Object.keys(this.view.excalidrawAPI.getFiles()).length,
            deferredCandidates: this.pendingDeferredValidationCandidates.size,
            durationMs: diagnosticsEnabled ? runMs : undefined,
          });
          this.view.lastSceneLoadTime = Date.now();
          if (this.activeLoader === l) {
            this.activeLoader = null;
          }
          if (this.nextLoader) {
            const nextLoader = this.nextLoader;
            const nextDiagnosticContext = this.nextLoaderDiagnosticContext;
            runLoader(
              nextLoader,
              nextDiagnosticContext?.requestId ?? effectiveRequestId,
              nextDiagnosticContext?.reason ?? effectiveReason,
            );
          } else {
            // Once the scene is painted, validate cached candidates in the background
            // so unchanged cache hits do not delay the initial scene load.
            if (this.pendingDeferredValidationCandidates.size > 0) {
              this.scheduleDeferredSceneFileValidation(
                new Map(this.pendingDeferredValidationCandidates),
                isThemeChange,
                "changed-only",
                "post-stale-first-load",
              );
              this.pendingDeferredValidationCandidates.clear();
            }
            //in case one or more files have not loaded retry later hoping that sync has delivered the file in the mean time.
            const retryCandidates = Array.from(
              this.view.excalidrawData.getFileEntries(),
            ).filter(
              ([, embeddedFile]) =>
                embeddedFile &&
                !embeddedFile.file &&
                !embeddedFile.isHyperLink &&
                !embeddedFile.isLocalLink &&
                embeddedFile.attemptCounter < 30,
            );
            if (retryCandidates.length > 0) {
              const retryFileIDs = new Set(
                retryCandidates.map(([fileId]) => fileId),
              );
              const retryCandidate = retryCandidates[0][1];
              performanceDiagnosticIncrement("sceneFileRetryScheduled");
              performanceDiagnosticLog("sceneFiles.retryScheduled", {
                viewId: this.view.id,
                reason: "unresolved-embedded-file",
                candidates: diagnosticsEnabled
                  ? retryCandidates.length
                  : undefined,
                attemptCounter: retryCandidate.attemptCounter,
                delayMs: 2000,
              });
              const currentFile = this.view.file.path;
              let deferredWaitCount = 0;
              const retryLoadSceneFiles = () => {
                if (
                  !this ||
                  !this.view.excalidrawAPI ||
                  currentFile !== this.view.file.path
                ) {
                  return;
                }
                // Keep deferred validation uninterrupted. If it is running,
                // retry again once it completes.
                if (
                  this.deferredValidationLoader ||
                  this.deferredValidationTimer
                ) {
                  deferredWaitCount += 1;
                  window.setTimeout(retryLoadSceneFiles, 500);
                  return;
                }
                performanceDiagnosticLog("sceneFiles.retryExecuting", {
                  viewId: this.view.id,
                  reason: "unresolved-embedded-file",
                  deferredWaitMs: deferredWaitCount * 500,
                });
                void this.loadSceneFiles(
                  false,
                  retryFileIDs,
                  undefined,
                  undefined,
                  "retry-unresolved-embedded-file",
                );
              };
              window.setTimeout(() => {
                retryLoadSceneFiles();
              }, 2000);
            }
          }
        },
        depth: 0,
        isThemeChange,
        fileIDWhiteList,
        forceReloadFileIDs,
        cacheValidation: "stale-first",
        onDeferredValidationCandidates: (candidates) => {
          this.addDeferredValidationCandidates(candidates);
        },
      });
    };
    if (!this.activeLoader) {
      runLoader(loader);
    } else {
      this.nextLoader = loader;
      this.nextLoaderDiagnosticContext = {
        requestId,
        reason: diagnosticReason,
      };
      performanceDiagnosticIncrement("loadSceneFilesQueued");
      performanceDiagnosticLog("sceneFiles.queued", {
        id: requestId,
        viewId: this.view.id,
        reason: diagnosticReason,
        queueReason: "active-loader",
      });
    }
  }
}
