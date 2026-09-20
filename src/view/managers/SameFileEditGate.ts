export type SameFileEditOwnerId = string;

interface GraceRelease {
  readonly ownerWindow: Window;
  readonly timer: number;
}

/**
 * Coordinates editors that temporarily own Markdown belonging to one view's
 * drawing file. Owners are idempotent and each release has an independent
 * grace period, so one stale timer cannot unblock another active editor.
 */
export class SameFileEditGate {
  private readonly activeOwners = new Set<SameFileEditOwnerId>();
  private readonly graceReleases = new Map<
    SameFileEditOwnerId,
    GraceRelease
  >();

  public constructor(private readonly getOwnerWindow: () => Window) {}

  public acquire(ownerId: SameFileEditOwnerId): void {
    this.cancelGrace(ownerId);
    this.activeOwners.add(ownerId);
  }

  /**
   * Releases one owner and starts or refreshes only that owner's grace period.
   * Releasing an unknown owner is an idempotent no-op.
   */
  public release(ownerId: SameFileEditOwnerId, graceMs: number): void {
    const wasActive = this.activeOwners.delete(ownerId);
    const hadGrace = this.cancelGrace(ownerId);
    if (!wasActive && !hadGrace) {
      return;
    }
    if (graceMs <= 0) {
      return;
    }
    const ownerWindow = this.getOwnerWindow();
    const timer = ownerWindow.setTimeout(() => {
      if (this.graceReleases.get(ownerId)?.timer === timer) {
        this.graceReleases.delete(ownerId);
      }
    }, graceMs);
    this.graceReleases.set(ownerId, { ownerWindow, timer });
  }

  public get hasActiveOwners(): boolean {
    return this.activeOwners.size > 0;
  }

  public get isInGracePeriod(): boolean {
    return this.graceReleases.size > 0;
  }

  public get isBlocked(): boolean {
    return this.hasActiveOwners || this.isInGracePeriod;
  }

  /**
   * Cancels a pending release and restores that owner to active ownership.
   * An owner without a pending release remains unchanged.
   */
  public cancelRelease(ownerId: SameFileEditOwnerId): void {
    if (this.cancelGrace(ownerId)) {
      this.activeOwners.add(ownerId);
    }
  }

  public destroy(): void {
    for (const release of this.graceReleases.values()) {
      release.ownerWindow.clearTimeout(release.timer);
    }
    this.graceReleases.clear();
    this.activeOwners.clear();
  }

  private cancelGrace(ownerId: SameFileEditOwnerId): boolean {
    const release = this.graceReleases.get(ownerId);
    if (!release) {
      return false;
    }
    release.ownerWindow.clearTimeout(release.timer);
    this.graceReleases.delete(ownerId);
    return true;
  }
}
