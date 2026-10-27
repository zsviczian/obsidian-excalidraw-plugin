/** Existing converted drawings must reopen after reload without regeneration/migration. */
export async function probeSvgReload(key, path, expected) {
  const c = globalThis[key];
  let leaf = app.workspace
    .getLeavesOfType("excalidraw")
    .find((l) => l.view.file?.path === path);
  leaf ??= app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "excalidraw", state: { file: path } });
  for (let i = 0; i < 200; i++) {
    if (globalThis[key] !== c) throw Error("SVG reload cancelled");
    const view = leaf.view;
    if (
      view.excalidrawAPI &&
      view.getViewElements().length === expected.length
    ) {
      for (const snapshot of expected) {
        const actual = view.getViewElements().find((e) => e.id === snapshot.id);
        if (!actual) throw Error("reload lost native SVG element");
        for (const [field, value] of Object.entries(snapshot))
          if (JSON.stringify(actual[field]) !== JSON.stringify(value))
            throw Error(`reload changed SVG ${field}`);
      }
      c.reload = true;
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("SVG reload did not restore drawing");
}
