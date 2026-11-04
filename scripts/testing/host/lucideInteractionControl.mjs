/** Compare the ordinary trusted picker entry point with the exhaustive API/legacy workflow. */
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { settleBrowserDiagnostics } from "./browserDiagnostics.mjs";

export function runLucideInteractionControl({ cli, drawingPath }) {
  const execute = new Function(
    `return async function(c,path,modifier){return (${ordinaryPicker.toString()})(c,path,modifier,${settleBrowserDiagnostics.toString()});}`,
  )();
  return runInAppTask({
    cli,
    execute,
    args: [drawingPath, process.platform === "darwin" ? 4 : 2],
    timeoutMs: 30000,
    onRequest: behaviorInputDriver(cli),
  });
}

async function ordinaryPicker(c, path, modifier, settle) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    doc = app.workspace.containerEl.ownerDocument,
    win = doc.defaultView;
  const leaf = app.workspace
    .getLeavesOfType("excalidraw")
    .find(
      (leaf) =>
        leaf.view.file?.path === path && leaf.view.ownerDocument === doc,
    );
  if (!leaf) throw Error("Ordinary Lucide control has no main drawing");
  const layout = app.workspace.getLayout(),
    errors = [],
    inputEvents = [];
  const onError = (e) =>
    errors.push({
      at: Date.now(),
      message: e.message,
      isTrusted: e.isTrusted,
      hasError: e.error != null,
      stack: e.error?.stack,
    });
  const onInput = (e) =>
    inputEvents.push({ type: e.type, trusted: e.isTrusted });
  win.addEventListener("error", onError);
  doc.addEventListener("pointerdown", onInput, true);
  doc.addEventListener("keydown", onInput, true);
  c.defer(() => {
    win.removeEventListener("error", onError);
    doc.removeEventListener("pointerdown", onInput, true);
    doc.removeEventListener("keydown", onInput, true);
  });
  c.defer(async () => {
    p.lucidePicker.tab?.close();
    await app.workspace.changeLayout(layout);
  });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const contentsId = win.require("@electron/remote").getCurrentWebContents().id;
  const input = (method, params) =>
    c.requestHost("behavior-input", { contentsId, method, params });
  const key = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
    for (const type of ["keyDown", "keyUp"])
      await input("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode,
        modifiers,
      });
  };
  const click = async (el) => {
    if (!el) throw Error("Ordinary picker control is missing");
    const r = el.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    if (!r.width || !r.height) throw Error("Ordinary picker control hidden");
    for (const type of ["mousePressed", "mouseReleased"])
      await input("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      });
  };
  c.phase = "lucide:ordinary-palette";
  await key("p", "KeyP", 80, modifier);
  await c.waitFor(
    () => doc.querySelector(".prompt input.prompt-input"),
    "ordinary Lucide palette",
  );
  await click(doc.querySelector(".prompt input.prompt-input"));
  const command =
    app.commands.commands["obsidian-excalidraw-plugin:insert-lucide-icon"];
  await input("Input.insertText", { text: command.name });
  let item;
  await c.waitFor(() => {
    item = [...doc.querySelectorAll(".prompt .suggestion-item")].find(
      (el) =>
        el.querySelector(".suggestion-content")?.textContent ===
        command.name.replace(": ", ""),
    );
    return item;
  }, "ordinary Lucide command result");
  await click(item);
  await c.waitFor(
    () =>
      p.lucidePicker.tab?.contentEl.isConnected && !p.lucidePicker.revealing,
    "ordinary picker visible",
  );
  c.phase = "lucide:ordinary-open-idle";
  const openIdle = await settle(win, errors, c.phase);
  c.observations = { openIdle, errors, inputEvents };
  const closeButton = p.lucidePicker.tab.contentEl
    .closest(".excalidraw-sidepanel-container")
    .querySelector('button[aria-label="Close sidepanel tab"]');
  await click(closeButton);
  await c.waitFor(() => !p.lucidePicker.tab, "ordinary picker close");
  c.phase = "lucide:ordinary-closed-idle";
  const closedIdle = await settle(win, errors, c.phase);
  c.observations = { openIdle, closedIdle, errors, inputEvents };
  if (!inputEvents.some((e) => e.trusted && e.type === "pointerdown"))
    throw Error("Ordinary picker interaction was not trusted");
  if (openIdle.status !== "passed" || closedIdle.status !== "passed")
    throw Error(
      "Ordinary Lucide picker fails bounded idle: " +
        JSON.stringify({ open: openIdle.status, closed: closedIdle.status }),
    );
  return {
    openIdle,
    closedIdle,
    errors,
    inputEvents,
    assertions: [
      "trusted palette opens the registered Lucide command",
      "picker open and closed geometry settles",
      "trusted close button retires the picker tab",
    ],
  };
}
