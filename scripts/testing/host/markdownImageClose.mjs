/** Await feature-owned close work before a test retires its drawing. Never cancel it. */
export async function closeMarkdownImageTab(c, view, {
  timeoutMs = 20000, now = () => Date.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!view?.sameFileEditGate) throw Error("Markdown-image close owner is unavailable");
  c.closingView = view;
  c.tab?.close();
  c.tab = null;
  const end = now() + timeoutMs;
  while (view.sameFileEditGate.hasActiveOwners || view.isSaveInProgress()) {
    if (now() >= end) {
      const error = Error("Markdown-image close is unsettled; preserve its drawing for recovery");
      error.cleanupFailed = true;
      throw error;
    }
    await wait(25);
  }
  c.closingView = null;
}
