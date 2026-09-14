import type { TFile } from "obsidian";
import type { PreparedAutoexportRequest } from "./AutoexportCoordinator";

const DEFAULT_HANDOFF_TTL_MS = 15_000;

export type ViewPersistenceReason = "view-unload" | "window-migration";

/** Immutable drawing text accepted from a view that may immediately retire. */
export interface ViewPersistenceRequest {
  readonly producerId: string;
  readonly targetGeneration: number;
  readonly operationId: number;
  readonly requestedRevision: number;
  readonly capturedRevision: number;
  readonly filePath: string;
  readonly expectedFileCtime: number;
  readonly text: string;
  readonly hasNonDeletedElements: boolean;
  readonly reason: ViewPersistenceReason;
  /** Required by window migration so autoexport waits for its replacement. */
  readonly migrationLeafId?: string;
  readonly autoexportRequest?: PreparedAutoexportRequest;
}

export type ViewPersistenceResult =
  | { readonly status: "persisted"; readonly request: ViewPersistenceRequest }
  | {
      readonly status:
        | "invalid-request"
        | "target-missing"
        | "target-changed"
        | "handoff-expired"
        | "failed";
      readonly request: ViewPersistenceRequest;
      readonly error: unknown;
    };

interface ViewPersistenceQueueOptions {
  readonly resolveFile: (filePath: string) => TFile | null;
  readonly write: (file: TFile, text: string) => Promise<void>;
  readonly scheduleBackup: (filePath: string, text: string) => void;
  readonly now: () => number;
  readonly scheduleCleanup: (callback: () => void, delayMs: number) => number;
  readonly cancelCleanup: (timer: number) => void;
  readonly handoffTtlMs?: number;
  readonly onFailure?: (
    result: Exclude<ViewPersistenceResult, { status: "persisted" }>,
  ) => void;
  readonly onBackupScheduleFailure?: (
    error: unknown,
    request: ViewPersistenceRequest,
  ) => void;
  readonly onPersisted?: (request: ViewPersistenceRequest) => void;
  readonly onPersistedCallbackFailure?: (
    error: unknown,
    request: ViewPersistenceRequest,
  ) => void;
  readonly beginPersistenceActivity?: (
    request: ViewPersistenceRequest,
  ) => () => void;
}

/**
 * A data-only reservation for one drawing path. The owner must release it in
 * `finally`; the queue never retains the live view performing the write.
 */
export interface ViewPersistenceWriteLease {
  release(): void;
}

interface PathReservation {
  readonly ready: Promise<void>;
  readonly release: () => void;
}

export interface ViewMigrationPersistenceHandoff {
  readonly leafId: string;
  readonly request: ViewPersistenceRequest;
}

export interface ViewMigrationPersistenceConsumption {
  readonly request: ViewPersistenceRequest;
  readonly completion: Promise<ViewPersistenceResult>;
}

interface ViewMigrationPersistenceEntry extends ViewMigrationPersistenceHandoff {
  readonly reservation: PathReservation;
  readonly expiresAt: number;
}

/**
 * Persists immutable drawing text after its originating view may be destroyed.
 *
 * Requests for one path execute in accepted order and are never coalesced:
 * independent view revisions do not establish that a later arrival supersedes
 * an earlier snapshot. Queue entries contain no view, DOM, Window, React root,
 * package lease, or callback closing over those objects. Successful writes
 * schedule their exact text for BAK before releasing the path reservation.
 *
 * There is intentionally no destructive `destroy()`: plugin unload starts
 * asynchronous view conversions before their unload handoffs arrive. Each
 * path chain releases itself after its final accepted write settles, and the
 * plugin-main-window cleanup timer releases abandoned migration reservations.
 */
export class ViewPersistenceQueue {
  private readonly pathTails = new Map<string, Promise<void>>();
  private readonly migrationHandoffs = new Map<
    string,
    ViewMigrationPersistenceEntry
  >();
  private cleanupTimer: number | null = null;

  public constructor(private readonly options: ViewPersistenceQueueOptions) {}

  /** Accepts responsibility immediately and resolves after the physical write. */
  public enqueue(
    request: ViewPersistenceRequest,
  ): Promise<ViewPersistenceResult> {
    const reservation = this.reservePath(request.filePath);
    return this.executeReservation(request, reservation);
  }

  /**
   * Reserves the same per-path write boundary for a live `TextFileView` save.
   * Only the gate is retained here; the caller keeps and invokes its own live
   * write after acquisition.
   */
  public async acquireWriteLease(
    filePath: string,
  ): Promise<ViewPersistenceWriteLease> {
    const reservation = this.reservePath(filePath);
    await reservation.ready;
    return { release: reservation.release };
  }

  /**
   * Reserves persistence order for immutable text supplied by a source popout.
   * No Vault write starts until the replacement view consumes the handoff.
   */
  public registerMigrationHandoff(
    handoff: ViewMigrationPersistenceHandoff,
  ): void {
    this.pruneExpiredHandoffs();
    const reservation = this.reservePath(handoff.request.filePath);
    const previous = this.migrationHandoffs.get(handoff.leafId);
    this.migrationHandoffs.set(handoff.leafId, {
      ...handoff,
      reservation,
      expiresAt:
        this.options.now() +
        (this.options.handoffTtlMs ?? DEFAULT_HANDOFF_TTL_MS),
    });
    previous?.reservation.release();
    this.scheduleHandoffCleanup();
  }

  /**
   * Transfers execution ownership to the replacement main-window view. The
   * returned completion represents the physical Vault write.
   */
  public consumeMigrationHandoff(
    leafId: string,
    filePath: string,
  ): ViewMigrationPersistenceConsumption | null {
    this.pruneExpiredHandoffs();
    const entry = this.migrationHandoffs.get(leafId);
    if (!entry) {
      return null;
    }
    this.migrationHandoffs.delete(leafId);
    this.scheduleHandoffCleanup();
    if (entry.request.filePath !== filePath) {
      this.rejectMigrationTarget(entry);
      return null;
    }
    const completion = this.executeReservation(
      entry.request,
      entry.reservation,
    );
    return { request: entry.request, completion };
  }

  /** Releases ordering after a failed source-view replacement. */
  public discardMigrationHandoff(leafId: string): void {
    const entry = this.migrationHandoffs.get(leafId);
    if (!entry) {
      return;
    }
    this.migrationHandoffs.delete(leafId);
    entry.reservation.release();
    this.scheduleHandoffCleanup();
  }

  /** Waits for all requests accepted for one path before this call. */
  public async flush(filePath: string): Promise<void> {
    await this.pathTails.get(filePath);
  }

  private reservePath(filePath: string): PathReservation {
    const previous = this.pathTails.get(filePath) ?? Promise.resolve();
    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const tail = previous.then(() => gate);
    this.pathTails.set(filePath, tail);
    void tail.finally(() => {
      if (this.pathTails.get(filePath) === tail) {
        this.pathTails.delete(filePath);
      }
    });
    let released = false;
    return {
      ready: previous,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        releaseGate();
      },
    };
  }

  private async executeReservation(
    request: ViewPersistenceRequest,
    reservation: PathReservation,
  ): Promise<ViewPersistenceResult> {
    await reservation.ready;
    const endPersistenceActivity =
      this.options.beginPersistenceActivity?.(request) ?? (() => undefined);
    try {
      return await this.execute(request);
    } finally {
      endPersistenceActivity();
      reservation.release();
    }
  }

  private rejectMigrationTarget(entry: ViewMigrationPersistenceEntry): void {
    entry.reservation.release();
    this.fail(
      "target-changed",
      entry.request,
      new Error("Migration persistence handoff target no longer matches"),
    );
  }

  private pruneExpiredHandoffs(): void {
    const now = this.options.now();
    for (const [leafId, entry] of this.migrationHandoffs) {
      if (entry.expiresAt > now) {
        continue;
      }
      this.migrationHandoffs.delete(leafId);
      entry.reservation.release();
      this.fail(
        "handoff-expired",
        entry.request,
        new Error("Migration persistence handoff expired before replacement"),
      );
    }
  }

  private scheduleHandoffCleanup(): void {
    if (this.cleanupTimer !== null) {
      this.options.cancelCleanup(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.migrationHandoffs.size === 0) {
      return;
    }
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const entry of this.migrationHandoffs.values()) {
      nextExpiry = Math.min(nextExpiry, entry.expiresAt);
    }
    this.cleanupTimer = this.options.scheduleCleanup(
      () => {
        this.cleanupTimer = null;
        this.pruneExpiredHandoffs();
        this.scheduleHandoffCleanup();
      },
      Math.max(0, nextExpiry - this.options.now()),
    );
  }

  private async execute(
    request: ViewPersistenceRequest,
  ): Promise<ViewPersistenceResult> {
    if (!request.text) {
      return this.fail(
        "invalid-request",
        request,
        new Error("Detached drawing persistence payload is empty"),
      );
    }
    const file = this.options.resolveFile(request.filePath);
    if (!file) {
      return this.fail(
        "target-missing",
        request,
        new Error("Detached drawing persistence target no longer exists"),
      );
    }
    if (file.stat.ctime !== request.expectedFileCtime) {
      return this.fail(
        "target-changed",
        request,
        new Error("Detached drawing persistence target was recreated"),
      );
    }
    try {
      await this.options.write(file, request.text);
    } catch (error: unknown) {
      return this.fail("failed", request, error);
    }
    if (request.hasNonDeletedElements) {
      try {
        this.options.scheduleBackup(request.filePath, request.text);
      } catch (error: unknown) {
        this.options.onBackupScheduleFailure?.(error, request);
      }
    }
    try {
      this.options.onPersisted?.(request);
    } catch (error: unknown) {
      try {
        this.options.onPersistedCallbackFailure?.(error, request);
      } catch {
        // Secondary diagnostics cannot change a completed source write.
      }
    }
    return { status: "persisted", request };
  }

  private fail(
    status:
      | "invalid-request"
      | "target-missing"
      | "target-changed"
      | "handoff-expired"
      | "failed",
    request: ViewPersistenceRequest,
    error: unknown,
  ): ViewPersistenceResult {
    const result = { status, request, error } as const;
    this.options.onFailure?.(result);
    return result;
  }
}
