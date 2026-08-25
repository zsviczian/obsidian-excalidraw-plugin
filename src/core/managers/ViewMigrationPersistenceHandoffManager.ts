const DEFAULT_HANDOFF_TTL_MS = 15_000;

export interface ViewMigrationPersistenceHandoff {
  leafId: string;
  filePath: string;
  data: string;
}

interface ViewMigrationPersistenceHandoffEntry extends ViewMigrationPersistenceHandoff {
  expiresAt: number;
}

/**
 * Owns bounded serialized drawing handoffs from a destroyed popout view to
 * the replacement view in Obsidian's main window.
 *
 * Entries contain drawing text and stable identifiers only. They never retain
 * a view, DOM node, React runtime, package lease, or Window. Consumption is
 * one-shot, and abandoned entries expire promptly.
 */
export class ViewMigrationPersistenceHandoffManager {
  private readonly entries = new Map<
    string,
    ViewMigrationPersistenceHandoffEntry
  >();
  private cleanupTimer: number | null = null;

  /** Registers or replaces the pending drawing text for one workspace leaf. */
  public register(handoff: ViewMigrationPersistenceHandoff): void {
    this.pruneExpired();
    this.entries.set(handoff.leafId, {
      ...handoff,
      expiresAt: Date.now() + DEFAULT_HANDOFF_TTL_MS,
    });
    this.scheduleCleanup();
  }

  /** Consumes matching drawing text exactly once. */
  public consume(leafId: string, filePath: string): string | null {
    this.pruneExpired();
    const entry = this.entries.get(leafId);
    if (!entry) {
      return null;
    }
    this.entries.delete(leafId);
    this.scheduleCleanup();
    return entry.filePath === filePath ? entry.data : null;
  }

  /** Discards an abandoned handoff after a failed view replacement. */
  public discard(leafId: string): void {
    this.entries.delete(leafId);
    this.scheduleCleanup();
  }

  /** Clears retained text and its main-window cleanup timer. */
  public destroy(): void {
    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [leafId, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(leafId);
      }
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.entries.size === 0) {
      return;
    }
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const entry of this.entries.values()) {
      nextExpiry = Math.min(nextExpiry, entry.expiresAt);
    }
    this.cleanupTimer = window.setTimeout(
      () => {
        this.cleanupTimer = null;
        this.pruneExpired();
        this.scheduleCleanup();
      },
      Math.max(0, nextExpiry - Date.now()),
    );
  }
}
