import type { TFile } from "obsidian";

export type ViewPersistenceReason = "view-unload";

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
}

export type ViewPersistenceResult =
  | { readonly status: "persisted"; readonly request: ViewPersistenceRequest }
  | {
      readonly status:
        | "invalid-request"
        | "target-missing"
        | "target-changed"
        | "failed";
      readonly request: ViewPersistenceRequest;
      readonly error: unknown;
    };

interface ViewPersistenceQueueOptions {
  readonly resolveFile: (filePath: string) => TFile | null;
  readonly write: (file: TFile, text: string) => Promise<void>;
  readonly onFailure?: (
    result: Exclude<ViewPersistenceResult, { status: "persisted" }>,
  ) => void;
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

/**
 * Persists immutable drawing text after its originating view may be destroyed.
 *
 * Requests for one path execute in accepted order and are never coalesced:
 * independent view revisions do not establish that a later arrival supersedes
 * an earlier snapshot. Queue entries contain no view, DOM, Window, React root,
 * package lease, or callback closing over those objects.
 *
 * There is intentionally no destructive `destroy()`: plugin unload starts
 * asynchronous view conversions before their unload handoffs arrive. The
 * queue owns no timer or listener, and each path chain releases itself after
 * its final accepted write settles.
 */
export class ViewPersistenceQueue {
  private readonly pathTails = new Map<string, Promise<void>>();

  public constructor(private readonly options: ViewPersistenceQueueOptions) {}

  /** Accepts responsibility immediately and resolves after the physical write. */
  public enqueue(
    request: ViewPersistenceRequest,
  ): Promise<ViewPersistenceResult> {
    const reservation = this.reservePath(request.filePath);
    return (async (): Promise<ViewPersistenceResult> => {
      await reservation.ready;
      try {
        return await this.execute(request);
      } finally {
        reservation.release();
      }
    })();
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
      return { status: "persisted", request };
    } catch (error: unknown) {
      return this.fail("failed", request, error);
    }
  }

  private fail(
    status: "invalid-request" | "target-missing" | "target-changed" | "failed",
    request: ViewPersistenceRequest,
    error: unknown,
  ): ViewPersistenceResult {
    const result = { status, request, error } as const;
    this.options.onFailure?.(result);
    return result;
  }
}
