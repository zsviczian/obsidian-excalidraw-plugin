import type {
  AppState,
  BinaryFiles,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

import type { ExcalidrawDataMigrationState } from "../../shared/ExcalidrawData";
import type { TextMode } from "../../shared/TextMode";
import type { ViewSaveMigrationState } from "../../view/managers/ViewSaveCoordinator";

const DEFAULT_HANDOFF_TTL_MS = 15_000;

/** Drawing-owned runtime state that may cross an Obsidian window migration. */
export interface ViewMigrationDrawingState {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  textMode: TextMode;
  compatibilityMode: boolean;
  excalidrawData: ExcalidrawDataMigrationState;
  save: ViewSaveMigrationState;
}

/** Metadata used to register one transient migration handoff. */
export interface ViewMigrationHandoffRegistration {
  leafId: string;
  filePath: string;
  fileMtime: number;
  drawing: ViewMigrationDrawingState;
}

/** Identity and freshness checks required to consume a migration handoff. */
export interface ViewMigrationHandoffRequest {
  token: string;
  leafId: string;
  filePath: string;
  fileMtime: number;
}

interface ViewMigrationHandoffEntry extends ViewMigrationHandoffRegistration {
  token: string;
  expiresAt: number;
}

interface ViewMigrationHandoffScheduler {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
}

interface ViewMigrationHandoffManagerOptions {
  ttlMs?: number;
  scheduler?: ViewMigrationHandoffScheduler;
}

/**
 * Owns bounded, one-shot drawing handoffs between recreated views.
 *
 * Entries contain drawing state only. They never retain an `ExcalidrawView`,
 * React root, DOM node, `Window`, listener, or package lease. Consumption
 * removes the entry before validation so stale or mismatched state cannot be
 * retried, and a single expiry timer bounds abandoned payload lifetime.
 */
export class ViewMigrationHandoffManager {
  private readonly ttlMs: number;
  private readonly scheduler: ViewMigrationHandoffScheduler;
  private readonly entries = new Map<string, ViewMigrationHandoffEntry>();
  private readonly tokensByLeaf = new Map<string, string>();
  private cleanupTimer: number | null = null;
  private tokenSequence = 0;

  public constructor(options: ViewMigrationHandoffManagerOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_HANDOFF_TTL_MS;
    if (!Number.isFinite(this.ttlMs) || this.ttlMs <= 0) {
      throw new Error("View migration handoff TTL must be positive");
    }
    this.scheduler =
      options.scheduler ??
      {
        now: () => Date.now(),
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        clearTimeout: (timer) => window.clearTimeout(timer),
      };
  }

  /** Registers a handoff, replacing any older payload for the same leaf. */
  public register(registration: ViewMigrationHandoffRegistration): string {
    this.pruneExpired();
    const previousToken = this.tokensByLeaf.get(registration.leafId);
    if (previousToken) {
      this.deleteEntry(previousToken);
    }

    const now = this.scheduler.now();
    const token = `view-migration-${now.toString(36)}-${(++this.tokenSequence).toString(36)}`;
    this.entries.set(token, {
      ...registration,
      token,
      expiresAt: now + this.ttlMs,
    });
    this.tokensByLeaf.set(registration.leafId, token);
    this.scheduleCleanup();
    return token;
  }

  /**
   * Consumes a matching handoff exactly once.
   *
   * A token mismatch, leaf/path mismatch, file modification, or TTL expiry
   * returns `null` and discards the candidate so the caller must use its
   * ordinary disk-backed load path.
   */
  public consume(
    request: ViewMigrationHandoffRequest,
  ): ViewMigrationDrawingState | null {
    this.pruneExpired();
    const entry = this.entries.get(request.token);
    if (!entry) {
      return null;
    }
    this.deleteEntry(request.token);
    this.scheduleCleanup();

    if (
      entry.leafId !== request.leafId ||
      entry.filePath !== request.filePath ||
      entry.fileMtime !== request.fileMtime
    ) {
      return null;
    }
    return entry.drawing;
  }

  /** Drops all retained drawing state and cancels expiry work. */
  public destroy(): void {
    if (this.cleanupTimer !== null) {
      this.scheduler.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
    this.tokensByLeaf.clear();
  }

  private deleteEntry(token: string): void {
    const entry = this.entries.get(token);
    if (!entry) {
      return;
    }
    this.entries.delete(token);
    if (this.tokensByLeaf.get(entry.leafId) === token) {
      this.tokensByLeaf.delete(entry.leafId);
    }
  }

  private pruneExpired(): void {
    const now = this.scheduler.now();
    for (const [token, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.deleteEntry(token);
      }
    }
    if (this.entries.size === 0 && this.cleanupTimer !== null) {
      this.scheduler.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer !== null) {
      this.scheduler.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.entries.size === 0) {
      return;
    }
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const entry of this.entries.values()) {
      nextExpiry = Math.min(nextExpiry, entry.expiresAt);
    }
    this.cleanupTimer = this.scheduler.setTimeout(() => {
      this.cleanupTimer = null;
      this.pruneExpired();
      this.scheduleCleanup();
    }, Math.max(0, nextExpiry - this.scheduler.now()));
  }
}
