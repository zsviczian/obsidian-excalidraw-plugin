/** Native #2894 regression: actual pasted cards and their native Obsidian preview. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";
import { exerciseCodeBlockFormats } from "./codeBlockFormats.mjs";
import { exerciseCodeBlockImageLayout } from "./codeBlockImageLayout.mjs";

export const codeCardCaseIds = ["main", "popout"].flatMap(context => ["native:workflow-code-card-2894:" + context, "native:code-block-format:" + context, "native:code-block-image-layout:" + context]);

export async function runCodeCardScenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      await (${exerciseCodeBlockImageLayout.toString()})(c,env);
      await (${exerciseCodeCards.toString()})(c,env,modifier);
      await (${exerciseCodeBlockFormats.toString()})(c,env,modifier);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute,
      args: [drawingPath, { id, input: "mouse" }, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 240000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli),
    }).catch(error => { error.evidence = [...tests, ...(error.evidence || [])]; throw error; });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0, "Code card emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0, "Code card emitted window errors");
  assert.ok(browserIdle.every(result => result.status === "passed"), "Code card did not settle");
  return { id: "workflow-code-card-2894", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

/** Real insertion, native rendering, scrolling and persisted manual dimensions. */
async function exerciseCodeCards(c, env, modifier) {
  const { p, doc, win, check, openDrawing, saveReopen, geometry, click, key } = env;
  await c.case("native:workflow-code-card-2894:" + geometry().requested.id, ["P02", "P05"], async () => {
    p.settings.pasteCodeBlockAs = "embeddable";
    let view = await openDrawing("pasted-code");
    view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
    const ea = p.ea.getAPI(view);
    let sharedId;
    try { sharedId = await ea.addBackOfTheCardNoteToView("Existing card", false, "Keep shared card defaults."); }
    finally { ea.destroy(); }
    const variants = [], links = new Set();
    const bodies = [
      { name: "one-line", body: "console.log('one line');", type: "js", short: true },
      { name: "multi-line", body: "const x = 1;\nconst y = 2;\nconsole.log(x + y);", type: "js", short: true },
      { name: "long-line", body: "console.log('" + "x".repeat(600) + "');", type: "js" },
      { name: "long-block", body: Array.from({ length: 120 }, (_, i) => "console.log(" + i + ");").join("\n"), type: "js" },
      { name: "plain-crlf", body: "print('plain')\r\nprint('next')", type: "python", plain: true, short: true },
      { name: "fenced-whitespace", body: "one\rtwo\r\nthree", type: "text", whitespace: true, short: true },
    ];
    const prompt = async (title, value) => {
      let modal;
      await c.waitFor(() => modal = [...doc.querySelectorAll(".modal")].find(modal => modal.querySelector(".modal-title")?.textContent === title), "code card " + title);
      const input = modal.querySelector("textarea"); input.value = value;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      await click(modal.querySelector("button.mod-cta"));
      await c.waitFor(() => !modal.isConnected, "code card prompt closes");
    };
    for (const variant of bodies) {
      const api = view.excalidrawAPI, before = new Set(api.getSceneElements().map(element => element.id));
      const source = variant.plain ? variant.body : (variant.whitespace ? " \r\n  " : "") + "```" + variant.type + "\r\n" + variant.body + "\r\n```" + (variant.whitespace ? "  \r\n" : "");
      const pending = view.pasteCodeBlock(source);
      if (variant.plain) await prompt("Code block language", variant.type);
      await prompt("Code Block Title", "Pasted code");
      await pending;
      let element = api.getSceneElements().find(element => element.type === "embeddable" && !before.has(element.id));
      check(element, "pasted code card missing");
      api.zoomToFit([element], 1, 0.05);
      let node, preview, pre;
      await c.waitFor(() => {
        node = view.getEmbeddableLeafElementById(element.id)?.node;
        preview = node?.containerEl.querySelector(".markdown-preview-view"); pre = preview?.querySelector("pre");
        c.observations = { ...c.observations, previewFit: { name: variant.name, element: { width: element.width, height: element.height, scale: element.scale }, node: node?.containerEl.getBoundingClientRect().toJSON(), pre: pre?.getBoundingClientRect().toJSON(), hostHeight: view.containerEl.querySelector('#embed-' + element.id)?.style.getPropertyValue('--embeddable-height'), apiHeight: api.getSceneElements().find(item => item.id === element.id)?.height } };
        return pre?.querySelector("code") && Math.abs(node.containerEl.getBoundingClientRect().height / (node.containerEl.getBoundingClientRect().width / element.width) - element.height) < 3;
      }, "native code preview adopts fitted dimensions");
      const code = pre.querySelector("code"), bounds = node.containerEl.getBoundingClientRect(), scale = bounds.width / element.width;
      const extent = (pre.getBoundingClientRect().bottom - bounds.top) / scale + preview.scrollTop;
      const record = { name: variant.name, width: element.width, height: element.height, renderedExtent: extent, scrollHeight: preview.scrollHeight, clientHeight: preview.clientHeight };
      c.observations = { ...c.observations, cards: [...(c.observations?.cards || []), record] };
      check(element.width === 400 && element.height >= 100 && element.height <= 1000, "code card width or safe initial bounds changed");
      if (variant.short) check(element.height < 350, "short pasted code card retains excessive initial height");
      if (element.height < 1000) {
        check(extent <= element.height + 3, "fitted code content is clipped");
        check(element.height <= Math.max(100, extent + 64), "fitted card retains excessive blank space");
      } else {
        preview.scrollTop = preview.scrollHeight;
        check(preview.scrollTop > 0, "bounded long code cannot scroll to its end"); preview.scrollTop = 0;
      }
      check(code.textContent.trim() === variant.body.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim(), "code text or line endings changed");
      check(element.link.includes("#Pasted code") && !links.has(element.link), "duplicate card title was not made unique"); links.add(element.link);
      check(api.getSceneElements().find(element => element.id === sharedId)?.height === 500, "shared/EA card sizing changed");
      if (variant.name === "one-line") {
        const fitted = { id: element.id, height: element.height, y: element.y };
        view.containerEl.querySelector(".excalidraw").focus();
        await key("z", "KeyZ", 90, modifier);
        await c.waitFor(() => !api.getSceneElements().some(item => item.id === fitted.id), "initial fit adds no extra resize undo step");
        await key("z", "KeyZ", 90, modifier | 8);
        await c.waitFor(() => api.getSceneElements().some(item => item.id === fitted.id), "redo restores pasted code card");
        element = api.getSceneElements().find(item => item.id === fitted.id);
        check(element.height === fitted.height && element.y === fitted.y, "redo lost fitted height or insertion center");
        api.mutateElement(element, { width: 430, height: 333 });
        api.updateScene({ captureUpdate: "IMMEDIATELY" });
      }
      const expected = { width: element.width, height: element.height };
      view = await saveReopen(view);
      const restored = view.excalidrawAPI.getSceneElements().find(item => item.id === element.id);
      check(restored?.width === expected.width && restored?.height === expected.height, "initial/manual code card sizing changed on reopen");
      check(view.excalidrawAPI.getSceneElements().find(element => element.id === sharedId)?.height === 500, "saved shared card sizing changed");
      variants.push({ ...record, reopened: true, manualResize: variant.name === "one-line" });
    }
    return { assertions: ["one/multiple/long lines and bounded long code fit native rendered content", "plain/fenced input, whitespace and line endings", "duplicate titles remain unique and source remains editable", "width and unrelated EA/shared card defaults unchanged", "single-step insertion undo/redo preserves fitted geometry", "manual resizing and initial dimensions persist after reopen"], variants };
  });
}

