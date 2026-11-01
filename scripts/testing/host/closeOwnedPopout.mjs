/** Retire a single test-owned popout using workspace and editor lifetime evidence. */
export async function closeOwnedPopout(c, leaf) {
  const view = leaf.view, doc = view.containerEl.ownerDocument;
  const main = app.workspace.containerEl.ownerDocument;
  if (doc === main) throw Error("Expected an owned popout, refusing to close the main window");
  let shared = false;
  app.workspace.iterateAllLeaves(other => {
    if (other !== leaf && other.view.containerEl.isConnected && other.view.containerEl.ownerDocument === doc) shared = true;
  });
  if (shared) throw Error("Owned popout contains another leaf; refusing to close shared work");
  if (view.excalidrawAPI && view.isDirty()) {
    const saved = await view.saveWithOutcome();
    if (saved.status !== "persisted") throw Error("Owned popout save did not persist");
  }
  if (leaf.view !== view) throw Error("Owned popout view changed during cleanup");
  if (view.excalidrawAPI || view.containerEl.isConnected) leaf.detach();
  // Electron can retain a Window proxy with closed=false after Obsidian retires it.
  // Registration, connected DOM and a live API are independent teardown evidence.
  if (app.workspace.floatingSplit.children.some(child => child.doc === doc)) doc.defaultView.close();
  await c.waitForCleanup(() => !view.excalidrawAPI && !view.containerEl.isConnected
    && !app.workspace.floatingSplit.children.some(child => child.doc === doc), "owned popout editor and workspace teardown");
}
