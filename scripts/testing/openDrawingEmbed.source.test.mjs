import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

let promptResult, prompts = [];
const graph = sourceHarness({
  "src/utils/modifierkeyHelper": { linkClickModifierType: event => event.modifier },
  "src/utils/utils": { isMaskFile: (_plugin, file) => !!file.mask },
  "src/utils/excalidrawViewUtils": { getExcalidrawFileForwardLinks: () => "[[Forward]]" },
  "src/shared/Dialogs/Prompt": { linkPrompt: async text => { prompts.push(text); return promptResult; } },
});
const { openDrawingEmbed } = await graph.importModule("src/core/managers/openDrawingEmbed.ts");
after(() => graph.close());
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(mask = false) {
  const drawing = { path: "Drawing.excalidraw.md", mask }, calls = [], links = [];
  const plugin = { app: { vault: { getFileByPath: path => path === drawing.path ? drawing : null }, workspace: { openLinkText: async (...args) => links.push(args) } },
    isExcalidrawFile: file => file?.path.endsWith("excalidraw.md"), openDrawing: (...args) => calls.push(args) };
  prompts = []; return { plugin, drawing, calls, links };
}
test("Open drawing preserves all modifier and complete reference semantics of existing gestures", () => {
  for (const modifier of ["active-pane", "new-pane", "popout-window", "new-tab", "md-properties"]) {
    const f = fixture(), reference = "#^clippedframe=Frame name,padding=2";
    openDrawingEmbed(f.plugin, f.drawing.path + reference, { modifier });
    assert.deepEqual(f.calls, [[f.drawing, modifier, true, reference]]);
    openDrawingEmbed(f.plugin, "missing.excalidraw.md", { modifier }); assert.equal(f.calls.length, 1);
  }
});
test("mask link prompts retain drawing selection, Markdown subpath routing and cancellation", async () => {
  for (const [modifier, pane] of [["active-pane", false], ["new-pane", "split"], ["popout-window", "window"], ["new-tab", "tab"], ["md-properties", "tab"]]) {
    const f = fixture(true), target = { path: "Note.md" };
    promptResult = [target, "Note", "#Section"];
    openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.deepEqual(f.links, [["Note", "", pane, { eState: { subpath: "#Section" } }]]);
    assert.match(prompts[0], /\[\[Forward\]\]/);
    promptResult = [f.drawing, f.drawing.path, "#^group=abcdefgh"];
    openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.deepEqual(f.calls, [[f.drawing, modifier, true, "#^group=abcdefgh"]]);
    promptResult = null; openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.links.length, 1);
  }
});
