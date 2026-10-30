/** Native cold-start phases are serialized into the isolated host; never shipped. */
export const prepareColdDrawing = async (c, path, fixture) => {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    file = await app.vault.create(path, fixture),
    leaf = app.workspace.getLeaf("tab");
  await c.waitFor(() => p.isExcalidrawFile(file), "cold fixture metadata");
  await leaf.openFile(file);
  await c.waitFor(
    () =>
      leaf.view.excalidrawAPI &&
      leaf.view.isLoaded &&
      !leaf.view.semaphores.justLoaded,
    "cold fixture readiness",
  );
  const api = leaf.view.excalidrawAPI;
  api.updateScene({
    elements: api.getSceneElements().map((el, i) =>
      i
        ? el
        : {
            ...el,
            x: 234,
            version: el.version + 1,
            versionNonce: el.versionNonce + 1,
          },
    ),
    captureUpdate: "IMMEDIATELY",
    forceFlushSync: true,
  });
  if ((await leaf.view.saveWithOutcome()).status !== "persisted")
    throw Error("Cold fixture save not acknowledged");
  return { saved: true };
};

export const verifyColdDrawing = async (c, path) => {
  let leaf;
  await c.waitFor(() => {
    leaf = app.workspace
      .getLeavesOfType("excalidraw")
      .find((l) => l.view.file?.path === path);
    return (
      leaf?.view.excalidrawAPI &&
      leaf.view.isLoaded &&
      !leaf.view.semaphores.justLoaded
    );
  }, "cold workspace drawing restoration");
  const scene = leaf.view.excalidrawAPI.getSceneElements(),
    text = await app.vault.read(leaf.view.file);
  if (
    scene.length !== 2 ||
    scene[0].x !== 234 ||
    scene[1].customData?.retainedUnknown?.value !== 1 ||
    !text.includes("User Markdown retained.")
  )
    throw Error("Cold restart lost durable drawing content");
  return {
    assertions: [
      "official whole-app restart produces a new main-process PID",
      "same isolated application and vault identity",
      "workspace drawing restores with a new runtime",
      "saved edit, unknown custom data and Markdown survive",
    ],
  };
};

export const cleanupColdDrawing = async (c, path, layout) => {
  if (!/^__excalidraw_cli_smoke_cold_[a-f0-9-]{36}\.excalidraw\.md$/.test(path))
    throw Error("Unowned cold fixture");
  const file = app.vault.getFileByPath(path),
    leaf = app.workspace
      .getLeavesOfType("excalidraw")
      .find((l) => l.view.file?.path === path);
  if (file) await app.vault.delete(file);
  if (leaf) {
    await c.waitForCleanup(
      () =>
        leaf.view.getViewType() !== "excalidraw" ||
        !leaf.view.containerEl.isConnected,
      "cold fixture retirement",
    );
    if (leaf.view.containerEl.isConnected) leaf.detach();
  }
  await app.workspace.changeLayout(layout);
  return { removed: true };
};
