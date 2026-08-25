import { Notice } from "obsidian";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";

import { t } from "../../lang/helpers";
import {
  nextPerformanceDiagnosticId,
  performanceDiagnosticIncrement,
  performanceDiagnosticLog,
  performanceDiagnosticNow,
  performanceDiagnosticsEnabled,
} from "../../utils/performanceDiagnostics";
import type ExcalidrawView from "../ExcalidrawView";

/** Side effects selected for one save request. */
export interface SaveSideEffectPolicy {
  reason: string;
  triggerAutoexport: boolean;
}

/** Side effects selected for one forced-save request. */
export interface ForceSavePolicy {
  refreshSceneFiles: boolean;
  triggerAutoexport: boolean;
}

export const DIRECT_SAVE_SIDE_EFFECT_POLICY: Readonly<SaveSideEffectPolicy> = {
  reason: "direct",
  triggerAutoexport: true,
};

export const PUBLIC_FORCE_SAVE_POLICY: Readonly<ForceSavePolicy> = {
  refreshSceneFiles: true,
  triggerAutoexport: true,
};

export const WINDOW_BLUR_FORCE_SAVE_POLICY: Readonly<ForceSavePolicy> = {
  refreshSceneFiles: false,
  // Autoexport is a documented save-time contract, including for blur-triggered saves.
  triggerAutoexport: true,
};

/** Private view operations retained by the composition root during the
 * mechanical coordinator extraction. */
export interface ViewSaveCoordinatorDependencies {
  performSave: (
    preventReload: boolean,
    forcesave: boolean,
    overrideEmbeddableIsEditingSelfDebounce: boolean,
    sideEffectPolicy: Readonly<SaveSideEffectPolicy>,
  ) => Promise<void>;
  requestSave: (
    preventReload?: boolean,
    forcesave?: boolean,
    overrideEmbeddableIsEditingSelfDebounce?: boolean,
  ) => Promise<void>;
  isDirty: () => boolean;
  checkSceneVersion: () => void;
  refreshCanvasOffset: () => void;
  getFreedrawLastActiveTimestamp: () => number;
  markDirtyVisuals: () => void;
  clearDirtyVisuals: () => void;
}

/**
 * Coordinates persistence entry points, dirty state, and autosave scheduling
 * for one Excalidraw view.
 *
 * The view retains its public facade and the `TextFileView.save()` disk-write
 * implementation. This first extraction deliberately preserves the existing
 * semaphore and timer behavior; revision and coalescing semantics are a
 * separate checkpoint.
 */
export class ViewSaveCoordinator {
  public autosaveTimer: number | null = null;
  public autosaveFunction: (() => void) | null = null;

  public constructor(
    private readonly view: ExcalidrawView,
    private readonly dependencies: ViewSaveCoordinatorDependencies,
  ) {}

  /** Runs the historical public save policy. */
  public async save(
    preventReload: boolean = true,
    forcesave: boolean = false,
    overrideEmbeddableIsEditingSelfDebounce: boolean = false,
  ): Promise<void> {
    await this.dependencies.performSave(
      preventReload,
      forcesave,
      overrideEmbeddableIsEditingSelfDebounce,
      DIRECT_SAVE_SIDE_EFFECT_POLICY,
    );
  }

  /** Runs the historical public force-save policy. */
  public async forceSave(
    silent: boolean = false,
    waitIfBusy: boolean = false,
    diagnosticReason: string = "unspecified",
  ): Promise<void> {
    await this.forceSaveWithPolicy(
      silent,
      waitIfBusy,
      diagnosticReason,
      PUBLIC_FORCE_SAVE_POLICY,
    );
  }

  /** Runs a forced save with an explicitly selected side-effect policy. */
  public async forceSaveWithPolicy(
    silent: boolean,
    waitIfBusy: boolean,
    diagnosticReason: string,
    policy: Readonly<ForceSavePolicy>,
  ): Promise<void> {
    const diagnosticsEnabled = performanceDiagnosticsEnabled();
    const diagnosticId = diagnosticsEnabled
      ? nextPerformanceDiagnosticId("forceSave")
      : "";
    const start = diagnosticsEnabled ? performanceDiagnosticNow() : 0;
    performanceDiagnosticIncrement(`forceSaveReason.${diagnosticReason}`);
    performanceDiagnosticLog("forceSave.request", {
      id: diagnosticId,
      viewId: this.view.id,
      reason: diagnosticReason,
      silent,
      waitIfBusy,
      refreshSceneFiles: policy.refreshSceneFiles,
      triggerAutoexport: policy.triggerAutoexport,
      autosaving: this.view.semaphores.autosaving,
      saving: this.view.semaphores.saving,
    });
    if (waitIfBusy) {
      let counter = 0;
      while (
        (this.view.semaphores.autosaving || this.view.semaphores.saving) &&
        counter++ < 100
      ) {
        await sleep(50);
      }
    }
    if (this.view.semaphores.autosaving || this.view.semaphores.saving) {
      if (!silent) {
        new Notice(t("FORCE_SAVE_ABORTED"));
      }
      performanceDiagnosticLog("forceSave.skipped", {
        id: diagnosticId,
        viewId: this.view.id,
        requestReason: diagnosticReason,
        reason: "save-in-flight",
        totalMs: diagnosticsEnabled
          ? performanceDiagnosticNow() - start
          : undefined,
      });
      return;
    }
    this.view.clearPreventReloadTimer();
    this.view.semaphores.preventReload = false;
    this.view.semaphores.forceSaving = true;
    const saveStart = diagnosticsEnabled ? performanceDiagnosticNow() : 0;
    await this.dependencies.performSave(false, true, true, {
      reason: diagnosticReason,
      triggerAutoexport: policy.triggerAutoexport,
    });
    const saveMs = diagnosticsEnabled
      ? performanceDiagnosticNow() - saveStart
      : 0;
    this.view.plugin.triggerEmbedUpdates();
    let loadSceneFilesMs = 0;
    if (policy.refreshSceneFiles) {
      const loadSceneFilesStart = diagnosticsEnabled
        ? performanceDiagnosticNow()
        : 0;
      await this.view.loadSceneFiles(
        false,
        undefined,
        undefined,
        undefined,
        `force-save:${diagnosticReason}`,
      );
      loadSceneFilesMs = diagnosticsEnabled
        ? performanceDiagnosticNow() - loadSceneFilesStart
        : 0;
    }
    this.view.semaphores.forceSaving = false;
    performanceDiagnosticLog("forceSave.complete", {
      id: diagnosticId,
      viewId: this.view.id,
      reason: diagnosticReason,
      refreshSceneFiles: policy.refreshSceneFiles,
      triggerAutoexport: policy.triggerAutoexport,
      saveMs: diagnosticsEnabled ? saveMs : undefined,
      loadSceneFilesMs: diagnosticsEnabled ? loadSceneFilesMs : undefined,
      totalMs: diagnosticsEnabled
        ? performanceDiagnosticNow() - start
        : undefined,
    });
    if (!silent) {
      new Notice("Save successful", 1000);
    }
  }

  /** Saves scene changes found during view teardown or navigation. */
  public async forceSaveIfRequired(): Promise<boolean> {
    let watchdog = 0;
    let dirty = false;
    if (!this.view.excalidrawAPI) {
      return false;
    }
    this.dependencies.checkSceneVersion();
    if (!this.dependencies.isDirty()) {
      if (!this.view.semaphores.saving) {
        return false;
      }
      // Preserve the existing Excalibrain unload compatibility check.
      if (
        this.view.hookServer &&
        this.view.hookServer.onViewUnloadHook?.toString() ===
          "e=>{this.scene&&this.scene.leaf===e.leaf&&this.stop()}"
      ) {
        return false;
      }
    }
    while (this.view.semaphores.saving && watchdog++ < 200) {
      dirty = true;
      await sleep(40);
    }
    if (this.view.excalidrawAPI) {
      this.dependencies.checkSceneVersion();
      if (this.dependencies.isDirty()) {
        const path = this.view.file?.path;
        const plugin = this.view.plugin;
        window.setTimeout(() => {
          plugin.triggerEmbedUpdates(path);
        }, 400);
        dirty = true;
        await this.dependencies.requestSave(true, true, true);
      }
    }
    return dirty;
  }

  /** Starts the recursive autosave timer with the existing scheduling rules. */
  public setupAutosaveTimer(): void {
    const timer = () => {
      void (async () => {
        if (!this.view.isLoaded) {
          this.autosaveTimer = window.setTimeout(
            timer,
            this.view.autosaveInterval,
          );
          return;
        }

        const api = this.view.excalidrawAPI;
        if (!api) {
          new Notice(t("WARNING_SERIOUS_ERROR"), 60000);
          return;
        }
        const st = api.getAppState() as AppState;
        const isFreedrawActive =
          st.activeTool?.type === "freedraw" &&
          this.dependencies.getFreedrawLastActiveTimestamp() >
            Date.now() - 2000;
        const isEditingText = st.editingTextElement !== null;
        const isEditingNewElement = st.newElement !== null;
        this.dependencies.refreshCanvasOffset();
        if (
          this.dependencies.isDirty() &&
          this.view.plugin.autosaveEnabled &&
          !this.view.semaphores.forceSaving &&
          !this.view.semaphores.autosaving &&
          !this.view.semaphores.embeddableIsEditingSelf &&
          !isFreedrawActive &&
          !isEditingText &&
          !isEditingNewElement
        ) {
          this.autosaveTimer = null;
          if (this.view.excalidrawAPI) {
            this.view.semaphores.autosaving = true;
            // Preserve the non-blocking save used to avoid lag on large files.
            void this.dependencies
              .requestSave()
              .then(() => (this.view.semaphores.autosaving = false));
          }
          this.autosaveTimer = window.setTimeout(
            timer,
            this.view.autosaveInterval,
          );
        } else {
          this.autosaveTimer = window.setTimeout(
            timer,
            this.view.plugin.activeExcalidrawView === this.view &&
              this.view.semaphores.dirty &&
              this.view.plugin.autosaveEnabled
              ? 1000
              : this.view.autosaveInterval,
          );
        }
      })();
    };

    this.autosaveFunction = timer;
    this.resetAutosaveTimer();
  }

  /** Restarts the autosave interval after a completed save or first edit. */
  public resetAutosaveTimer(): void {
    if (!this.autosaveFunction) {
      return;
    }
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.autosaveTimer = window.setTimeout(
      this.autosaveFunction,
      this.view.autosaveInterval,
    );
  }

  /** Cancels autosave work owned by this view. */
  public destroy(): void {
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.autosaveFunction = null;
  }

  /** Marks the current file dirty unless a save is in progress. */
  public setDirty(): void {
    if (this.view.semaphores.saving) {
      return;
    }
    if (!this.dependencies.isDirty()) {
      this.resetAutosaveTimer();
    }
    this.view.semaphores.dirty = this.view.file?.path;
    this.dependencies.markDirtyVisuals();
  }

  /** Returns whether the dirty marker belongs to the current file. */
  public isDirty(): boolean {
    return (
      Boolean(this.view.semaphores?.dirty) &&
      this.view.semaphores.dirty === this.view.file?.path
    );
  }

  /** Clears the current file's dirty marker and updates its clean baseline. */
  public clearDirty(): void {
    if (this.view.semaphores.viewunload || !this.view.excalidrawAPI) {
      return;
    }
    this.view.semaphores.dirty = null;
    this.dependencies.clearDirtyVisuals();
  }
}
