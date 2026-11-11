import assert from "node:assert/strict";
import test from "node:test";
import { load } from "js-yaml";
import { sourceHarness } from "./sourceHarness.mjs";

test("frame navigation preserves search and mode, distinguishes unnamed frames and rejects retired owners", async () => {
  const calls = [], graph = sourceHarness({ obsidian: { parseYaml: load, FuzzySuggestModal: class { setPlaceholder() {} onClose() {} } }, "src/lang/helpers": { t: key => key } });
  try {
    const { FrameNavigator } = await graph.importModule("src/shared/Dialogs/FrameNavigator.ts");
    const elements = [{ type: "frame", id: "regular", name: null }, { type: "frame", frameRole: "marker", id: "marker", name: null }, { type: "rectangle", id: "other" }];
    const view = { app: {}, file: {}, excalidrawAPI: {}, getViewElements: () => elements, isClosingOrMigrating: () => false, zoomToElementId: (...args) => calls.push(args), search: "existing search", mode: "edit" };
    const picker = new FrameNavigator(view, () => calls.push("closed"));
    assert.deepEqual(picker.getItems(), elements.slice(0, 2));
    assert.equal(picker.getItemText(elements[0]), "FRAME_UNNAMED (regular)");
    assert.equal(picker.getItemText(elements[1]), "FRAME_UNNAMED_MARKER (marker)");
    picker.onChooseItem(elements[1]); assert.deepEqual(calls, [["marker", false]]);
    assert.equal(view.search, "existing search"); assert.equal(view.mode, "edit");
    view.excalidrawAPI = {}; picker.onChooseItem(elements[0]); assert.equal(calls.length, 1);
    picker.onClose(); assert.equal(calls.at(-1), "closed");
  } finally { graph.close(); }
});
