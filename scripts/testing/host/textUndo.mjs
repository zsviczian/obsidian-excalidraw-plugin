/** Issue #2976: exercise actual text input and history on the runner's owned drawing. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureTextUndoState } from "./textUndoDiagnostics.mjs";
import { runTextCreationHistory } from "./textCreationHistory.mjs";

/** Use the real mode transition; reload=false changes only the view, not its model. */
export async function prepareTextUndoFixture(view, mode) {
  if (view.compatibilityMode)
    throw Error("text undo regression requires a Markdown drawing");
  const modes = () => ({ view: view.textMode, model: view.excalidrawData.textMode });
  const before = modes();
  if (before.view !== mode || before.model !== mode)
    await view.changeTextMode(mode);
  const after = modes();
  if (after.view !== mode || after.model !== mode)
    throw Error("text fixture mode transition did not synchronize view and model");
  // Mode switching saves/reloads the previous drawing. Clear the next fixture
  // only afterwards, using the current API, so that reload cannot restore it.
  const api = view.excalidrawAPI;
  api.updateScene({ elements: [], appState: { viewModeEnabled: false, selectedElementIds: {} }, captureUpdate: "NEVER" });
  api.history.clear();
  api.setActiveTool({ type: "text" });
  const canvas = view.containerEl.querySelector("canvas.interactive");
  if (!canvas) throw Error("interactive canvas missing");
  const r = canvas.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2,
    modeSetup: { requested: mode, before, after } };
}

/**
 * Verify scene source survives reopening and unchanged submission after undo/redo.
 * Uses native CDP input in the main window and the toolbar's stable test IDs.
 * The parent runner owns target guards, deployment, drawing cleanup and error checks.
 */
export async function runTextUndoScenario({ cli, drawingPath, reportDir }) {
  const viewCode = `app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===${JSON.stringify(drawingPath)})?.view`;
  const evaluate = (code) =>
    JSON.parse(
      cli("eval", `code=${code}`)
        .trim()
        .replace(/^=>\s*/, ""),
    );
  const cdp = (method, params) =>
    cli("dev:cdp", `method=${method}`, `params=${JSON.stringify(params)}`);
  const snapshotCode = `(()=>{const v=${viewCode};const a=v?.excalidrawAPI;return JSON.stringify({elements:a?.getSceneElements().filter(e=>e.type==="text").map(e=>({id:e.id,text:e.text,originalText:e.originalText,rawText:e.rawText,cache:v.excalidrawData.getParsedResult(e.id)})),selected:a?.getAppState().selectedElementIds,editor:v?.containerEl.querySelector("textarea.excalidraw-wysiwyg")?.value??null})})()`;
  const snapshot = () => evaluate(snapshotCode);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const observations = { version: 2, setups: [], actions: [], completedVariants: [] };
  let variantLabel, actionLabel;
  const inspect = () =>
    evaluate(
      `JSON.stringify((${captureTextUndoState.toString()})(${viewCode},app.workspace))`,
    );
  const persist = () => {
    if (reportDir)
      writeFileSync(
        join(reportDir, "text-history-evidence.json"),
        JSON.stringify(observations, null, 2) + "\n",
      );
  };
  async function poll(predicate, label) {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const value = snapshot();
      if (predicate(value)) return value;
      if (Date.now() >= deadline)
        throw new Error(`${label}: ${JSON.stringify(value)}`);
      await wait(100);
    }
  }
  function key(key, code, keyCode, modifiers = 0) {
    for (const type of ["keyDown", "keyUp"]) {
      cdp("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        modifiers,
      });
    }
  }
  const modifier = process.platform === "darwin" ? 4 : 2;
  const enter = async () => {
    // Toolbar history can leave focus on a button or restore an unselected scene.
    // Select the fixture's text before testing a new editing session.
    evaluate(
      `(()=>{const v=${viewCode};const a=v.excalidrawAPI;const e=a.getSceneElements().find(e=>e.type==="text");if(!e)throw Error("fixture text missing");a.updateScene({appState:{selectedElementIds:{[e.id]:true}},captureUpdate:"NEVER"});v.containerEl.querySelector(".excalidraw")?.focus();return JSON.stringify({selected:true})})()`,
    );
    await poll(
      (value) => value.selected?.[value.elements[0]?.id],
      "fixture selection did not settle",
    );
    key("Enter", "Enter", 13);
  };
  const escape = () => key("Escape", "Escape", 27);
  function click(point) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      cdp("Input.dispatchMouseEvent", {
        type,
        ...point,
        button: "left",
        clickCount: 1,
      });
    }
  }
  function history(action, input, stage) {
    actionLabel = stage;
    const state = inspect();
    observations.actions.push({
      variant: variantLabel,
      action,
      input,
      stage,
      state,
    });
    persist();
    if (input === "keyboard") {
      key("z", "KeyZ", 90, modifier | (action === "redo" ? 8 : 0));
    } else {
      const button = state.controls[action];
      if (!button.present || button.disabled)
        throw Error(`${variantLabel}: ${stage}: history button unavailable`);
      const point = {
        x: button.bounds.x + button.bounds.width / 2,
        y: button.bounds.y + button.bounds.height / 2,
      };
      click(point);
    }
  }
  function assertSource(
    value,
    expected,
    label,
    cache = false,
    display = expected,
  ) {
    assert.equal(value.elements.length, 1, label);
    const element = value.elements[0];
    assert.equal(element.text, display, `${label}: rendered text`);
    assert.equal(element.originalText, display, `${label}: original text`);
    assert.equal(element.rawText, expected, `${label}: raw source`);
    if (cache) {
      assert.equal(element.cache.raw, expected, `${label}: cached source`);
      if (display !== expected)
        assert.equal(element.cache.parsed, display, `${label}: cached display`);
    }
  }
  async function reopenAndSubmit(expected, label, display = expected) {
    await enter();
    const opened = await poll(
      (value) => value.editor !== null,
      `${label}: editor did not open`,
    );
    assert.equal(opened.editor, expected, `${label}: editor source`);
    assertSource(opened, expected, label);
    escape();
    const submitted = await poll(
      (value) => value.editor === null,
      `${label}: editor did not close`,
    );
    assertSource(
      submitted,
      expected,
      `${label}: unchanged submission`,
      true,
      display,
    );
  }
  const cases = [];
  const variants = [
    { name: "plain", first: "one", second: "two", third: "three" },
    {
      name: "wikilink",
      first: "[[link]]",
      second: "[[other]]",
      third: "[[changed]]",
    },
    {
      name: "extra-bracket",
      first: "[[link]]]",
      second: "[[other]]]",
      third: "[[changed]]]",
    },
    {
      name: "alias",
      first: "[[link|one]]",
      second: "[[other|two]]",
      third: "[[changed|three]]",
    },
  ];
  try {
    observations.creationHistory = await runTextCreationHistory({
      cli, drawingPath, reportDir, prepareFixture: prepareTextUndoFixture,
    });
    for (const mode of ["parsed", "raw"]) {
      for (const input of ["keyboard", "button"]) {
        for (const variant of variants) {
          const label = `${mode}/${input}/${variant.name}`;
          variantLabel = label;
          actionLabel = "create/edit text";
          const point = evaluate(
            `(${prepareTextUndoFixture.toString()})(${viewCode},${JSON.stringify(mode)}).then(JSON.stringify)`,
          );
          observations.setups.push({ variant: label, ...point.modeSetup });
          persist();
          click({ x: point.x, y: point.y });
          await poll(
            (value) => value.editor !== null,
            `${label}: new text editor`,
          );
          cdp("Input.insertText", { text: variant.first });
          escape();
          const first = await poll(
            (value) => value.editor === null,
            `${label}: first submission`,
          );
          const firstDisplay =
            mode === "parsed" ? first.elements[0].cache.parsed : variant.first;
          assertSource(first, variant.first, label, true, firstDisplay);
          await enter();
          await poll(
            (value) => value.editor === variant.first,
            `${label}: edit first text`,
          );
          cdp("Input.insertText", { text: variant.second });
          escape();
          const second = await poll(
            (value) => value.editor === null,
            `${label}: second submission`,
          );
          const secondDisplay =
            mode === "parsed"
              ? second.elements[0].cache.parsed
              : variant.second;
          assertSource(second, variant.second, label, true, secondDisplay);
          history("undo", input, "first undo");
          assertSource(
            await poll(
              (value) => value.elements[0]?.rawText === variant.first,
              `${label}: undo`,
            ),
            variant.first,
            label,
            false,
            firstDisplay,
          );
          await reopenAndSubmit(
            variant.first,
            `${label}: after undo`,
            firstDisplay,
          );
          history("redo", input, "redo after unchanged undo submission");
          assertSource(
            await poll(
              (value) => value.elements[0]?.rawText === variant.second,
              `${label}: redo`,
            ),
            variant.second,
            label,
            false,
            secondDisplay,
          );
          await reopenAndSubmit(
            variant.second,
            `${label}: after redo`,
            secondDisplay,
          );
          history("undo", input, "second undo after unchanged redo submission");
          await poll(
            (value) => value.elements[0]?.rawText === variant.first,
            `${label}: second undo`,
          );
          await enter();
          await poll(
            (value) => value.editor === variant.first,
            `${label}: edit after undo`,
          );
          cdp("Input.insertText", { text: variant.third });
          escape();
          const third = await poll(
            (value) => value.editor === null,
            `${label}: edited submission`,
          );
          const thirdDisplay =
            mode === "parsed" ? third.elements[0].cache.parsed : variant.third;
          assertSource(third, variant.third, label, true, thirdDisplay);
          cases.push(label);
          observations.completedVariants.push(label);
          persist();
        }
      }
    }
    const source = snapshot().elements[0].rawText;
    const fallback = evaluate(
      `(()=>{const v=${viewCode};const e=v.excalidrawAPI.getSceneElements().find(e=>e.type==="text");return JSON.stringify({legacy:v.onBeforeTextEdit({...e,rawText:undefined},true),empty:v.onBeforeTextEdit({...e,rawText:""},true)})})()`,
    );
    assert.equal(fallback.legacy, source, "legacy cache fallback");
    assert.equal(
      fallback.empty,
      "",
      "empty scene source remains authoritative",
    );
    observations.status = "passed";
    persist();
    return {
      id: "text-undo-2976",
      status: "passed",
      cases,
      observations,
      assertions: [
        "undo past bound/standalone link creation to an empty drawing and redo the complete scene",
        "reopened source after undo/redo",
        "unchanged submission refreshes cache",
        "editing after undo",
        "parsed Markdown source",
        "legacy and empty source",
      ],
    };
  } catch (error) {
    observations.status = "failed";
    observations.failure = {
      variant: variantLabel,
      stage: actionLabel,
      message: error.message,
    };
    // Observe eventual readiness without issuing input or converting the failed
    // immediate check into a pass. This establishes evidence for a later wait.
    try {
      observations.terminal = inspect();
      observations.passiveAfterFailure = [];
      for (const delay of [50, 200, 750]) {
        await wait(delay);
        observations.passiveAfterFailure.push(inspect());
      }
    } catch (captureError) {
      observations.captureError = String(captureError);
    }
    error.observations = observations;
    persist();
    throw error;
  }
}
