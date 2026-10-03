/**
 * Mount-time host selection for embedded files.
 *
 * A subpath embed (a back-of-the-note section or a block reference) can only be
 * rendered section-scoped by a native Canvas node. A workspace leaf always
 * renders the whole file, which for a hybrid drawing is the entire drawing.
 * `CanvasNodeFactory` initializes asynchronously on layout ready, so an
 * embeddable can mount before the factory is usable; these helpers wait for it.
 */

/** Minimal `CanvasNodeFactory` surface needed to decide when a node can be created. */
export interface CanvasNodeHost {
  isInitialized: () => boolean;
  /**
   * Settles true when the factory finished initializing, false when it can no
   * longer do so. Absent on a host that does not report its lifecycle, which
   * leaves such a caller on the bounded wait below.
   */
  whenInitialized?: Promise<boolean>;
}

export const CANVAS_NODE_HOST_WAIT_INTERVAL_MS = 25;
/**
 * Bounds the wait only while no factory is visible at all; a factory that
 * reports its lifecycle is waited on through that signal.
 */
export const CANVAS_NODE_HOST_WAIT_TIMEOUT_MS = 2000;

/** Marks a lifecycle race that the poll interval won, i.e. still initializing. */
const STILL_INITIALIZING = Symbol("still-initializing");

/**
 * Decides whether an embeddable must be hosted by a native Canvas node.
 *
 * @param subpath - Section or block reference of the link, null when absent.
 * @param fileExtension - Extension of the embedded file.
 * @returns True when only a Canvas node can render the requested section.
 * @remarks
 * Any non-empty subpath counts, including a bare `#`.
 */
export function requiresCanvasNodeHost(
  subpath: string | null | undefined,
  fileExtension: string | null | undefined,
): boolean {
  return Boolean(subpath) && (fileExtension?.toLowerCase?.() ?? "") === "md";
}

/**
 * Waits for the Canvas node factory to finish its asynchronous initialization.
 *
 * @param getHost - Reads the factory on each poll; it may be absent at first
 * and may be torn down while waiting, so it is re-read rather than captured.
 * @param isCancelled - Signals that the embeddable unmounted; stops the wait.
 * @param timeoutMs - Upper bound on the wait while no factory is visible.
 * @param intervalMs - Delay between polls.
 * @returns True when the factory became usable, false on cancel, on a factory
 * that reported it will not initialize, or on the no-factory timeout.
 */
export async function awaitCanvasNodeHost(
  getHost: () => CanvasNodeHost | null | undefined,
  isCancelled: () => boolean = () => false,
  timeoutMs: number = CANVAS_NODE_HOST_WAIT_TIMEOUT_MS,
  intervalMs: number = CANVAS_NODE_HOST_WAIT_INTERVAL_MS,
  delay: (ms: number) => Promise<void> = sleep,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (isCancelled()) {
      return false;
    }
    const host = getHost();
    if (host?.isInitialized()) {
      return true;
    }
    const lifecycle = host?.whenInitialized;
    if (lifecycle !== undefined) {
      //The lifecycle settles on every terminal path (initialized,
      //initialization failed, destroyed), so this wait needs no deadline of its
      //own; racing the interval keeps cancellation observable meanwhile.
      const settled = await Promise.race([
        lifecycle,
        delay(intervalMs).then(() => STILL_INITIALIZING),
      ]);
      if (settled === STILL_INITIALIZING) {
        continue;
      }
      //One more read decides it: a factory that initialized and was then
      //destroyed still reports true here but can no longer host a node.
      return settled === true && Boolean(getHost()?.isInitialized());
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await delay(intervalMs);
  }
}

/** Host chosen for an embeddable, or "none" when the embeddable unmounted first. */
export type EmbeddableMountHost = "canvas-node" | "workspace-leaf" | "none";

/** Collaborators the mount dispatch needs; injected so the decision stays testable. */
export interface EmbeddableMountOptions {
  subpath: string | null | undefined;
  fileExtension: string | null | undefined;
  getHost: () => CanvasNodeHost | null | undefined;
  isCancelled?: () => boolean;
  createCanvasNode: () => void;
  createWorkspaceLeaf: () => void;
  timeoutMs?: number;
  intervalMs?: number;
  delay?: (ms: number) => Promise<void>;
}

/**
 * Mounts an embeddable into the host that can actually render it.
 *
 * @param options - Link details and the two mount actions.
 * @returns The host that was used, for logging and tests.
 * @remarks
 * A subpath embed waits for the Canvas node factory; the workspace leaf is the
 * fallback when the factory reports it will not initialize.
 */
export async function mountEmbeddableHost(
  options: EmbeddableMountOptions,
): Promise<EmbeddableMountHost> {
  const {
    subpath,
    fileExtension,
    getHost,
    isCancelled = () => false,
    createCanvasNode,
    createWorkspaceLeaf,
    timeoutMs,
    intervalMs,
    delay,
  } = options;

  //Latched: once this invocation has read itself cancelled it stays cancelled.
  let cancelledOnce = false;
  const cancelled = () => {
    cancelledOnce ||= isCancelled();
    return cancelledOnce;
  };

  if (cancelled()) {
    return "none";
  }

  if (!requiresCanvasNodeHost(subpath, fileExtension)) {
    createWorkspaceLeaf();
    return "workspace-leaf";
  }

  if (getHost()?.isInitialized()) {
    createCanvasNode();
    return "canvas-node";
  }

  const ready = await awaitCanvasNodeHost(
    getHost,
    cancelled,
    timeoutMs,
    intervalMs,
    delay,
  );
  if (cancelled()) {
    return "none";
  }
  if (ready) {
    createCanvasNode();
    return "canvas-node";
  }
  createWorkspaceLeaf();
  return "workspace-leaf";
}
