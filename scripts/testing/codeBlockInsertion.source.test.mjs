/** Execute the shared clipboard/context-menu workflow, including deferred UI decisions. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

let fixture;
const harness = sourceHarness({
  "../../shared/Dialogs/Prompt": {
    GenericInputPrompt: { Prompt: async (...args) => fixture.input(args[3]) },
    MultiOptionConfirmationPrompt: class {
      constructor(plugin, message, buttons, cta, toggle) {
        fixture.prompts.push({ message, buttons, cta, toggle });
        this.toggleValue = fixture.remember;
        this.waitForClose = Promise.resolve().then(() => fixture.choose());
      }
    },
  },
  "../../shared/MarkdownImage": { insertCodeBlockMarkdownImage: async (...args) => fixture.images.push(args) },
  "../../utils/excalidrawViewUtils": { addBackOfTheNoteCard: async (...args) => { fixture.cards.push(args); return "card"; } },
  "../../constants/constants": { CaptureUpdateAction: { EVENTUALLY: "EVENTUALLY" } },
  "./pastedCodeCardSizing": { fitPastedCodeBlockCard: async (...args) => fixture.fits.push(args) },
  "../../lang/helpers": { t: key => key },
});
const { insertCodeBlock } = await harness.importModule("src/view/managers/codeBlockInsertion.ts");
test.after(() => harness.close());
const fenced = "```js\nconsole.log(1);\n```";
function setup(preference = "ask") {
  fixture = { prompts: [], cards: [], images: [], fits: [], inputs: [], saves: 0, remember: false,
    choose: () => "embeddable", input(title) { this.inputs.push(title); return title === "PASTE_CODEBLOCK_LANGUAGE" ? "js" : "Code"; } };
  const view = { file: {}, excalidrawAPI: {}, currentPosition: { x: 12, y: 34 }, isClosingOrMigrating: () => false,
    getBackOfTheNoteSections: async () => ["Code", "Code 1"],
    plugin: { app: {}, settings: { pasteCodeBlockAs: preference }, async saveSettings() { fixture.saves++; } } };
  return { view, f: fixture };
}
test("code insertion asks by default and inserts the chosen Markdown image without a card title", async () => {
  const { view, f } = setup(); f.choose = () => "markdown-image";
  await insertCodeBlock(view, " \r\n```js\r\nconsole.log(1);\r\n```  ");
  assert.equal(f.prompts.length, 1); assert.equal(f.cards.length, 0); assert.equal(f.inputs.length, 0);
  assert.deepEqual(f.images, [[view, fenced, { x: 12, y: 34 }]]); assert.equal(f.saves, 0);
});
test("remembering either format serializes the preference and avoids the next prompt", async () => {
  for (const decision of ["embeddable", "markdown-image"]) {
    const { view, f } = setup(); f.choose = () => decision; f.remember = true;
    await insertCodeBlock(view, fenced); await insertCodeBlock(view, fenced);
    assert.equal(view.plugin.settings.pasteCodeBlockAs, decision); assert.equal(f.saves, 1); assert.equal(f.prompts.length, 1);
    assert.equal((decision === "embeddable" ? f.cards : f.images).length, 2);
  }
});
test("unremembered choices keep asking and closing the dialog makes no changes", async () => {
  const { view, f } = setup(); await insertCodeBlock(view, fenced);
  f.choose = () => null; f.remember = true; await insertCodeBlock(view, fenced);
  assert.equal(f.prompts.length, 2); assert.equal(f.cards.length, 1); assert.equal(f.images.length, 0);
  assert.equal(view.plugin.settings.pasteCodeBlockAs, "ask"); assert.equal(f.saves, 0);
});
test("configured formats bypass the chooser and preserve language, unique card title and initial-fit history", async () => {
  for (const preference of ["embeddable", "markdown-image"]) {
    const { view, f } = setup(preference); await insertCodeBlock(view, "console.log(1);");
    assert.equal(f.prompts.length, 0); assert.equal(f.inputs[0], "PASTE_CODEBLOCK_LANGUAGE");
    if (preference === "embeddable") {
      assert.equal(f.cards[0][1], "Code 2"); assert.equal(f.cards[0][3], fenced);
      assert.equal(f.cards[0][7], "EVENTUALLY"); assert.deepEqual(f.fits, [[view, "card"]]);
    } else { assert.equal(f.images[0][1], fenced); assert.equal(f.inputs.length, 1); assert.deepEqual(f.fits, []); }
  }
});
test("missing and unfamiliar preferences safely ask without deleting persisted keys", async () => {
  for (const preference of [undefined, "future-format"]) {
    const { view, f } = setup(preference); view.plugin.settings.pasteCodeBlockAs = preference;
    f.choose = () => null; await insertCodeBlock(view, fenced);
    assert.equal(f.prompts.length, 1); assert.equal(view.plugin.settings.pasteCodeBlockAs, preference);
  }
});
test("a file switch, API replacement or migration during a dialog cancels insertion and remembering", async () => {
  for (const retire of [view => view.file = {}, view => view.excalidrawAPI = {}, view => view.isClosingOrMigrating = () => true]) {
    const { view, f } = setup(); f.remember = true; f.choose = () => { retire(view); return "markdown-image"; };
    await insertCodeBlock(view, fenced);
    assert.deepEqual(f.cards, []); assert.deepEqual(f.images, []); assert.equal(f.saves, 0);
  }
});
test("cancelled language and title prompts and empty clipboard content are no-ops", async () => {
  for (const source of ["plain code", fenced]) {
    const { view, f } = setup("embeddable"); f.input = () => { throw "No input given."; };
    await insertCodeBlock(view, source);
    assert.deepEqual(f.cards, []); assert.deepEqual(f.images, []); assert.equal(f.saves, 0);
  }
  const { view, f } = setup(); await insertCodeBlock(view, " \r\n ");
  assert.deepEqual(f.prompts, []); assert.deepEqual(f.cards, []);
});
test("deferred language, title, settings writes and section lookup retain the exact drawing owner", async () => {
  for (const phase of ["language", "title", "save", "sections"]) {
    const { view, f } = setup(phase === "save" ? "ask" : "embeddable");
    if (phase === "language" || phase === "title") f.input = () => { view.file = {}; return "value"; };
    if (phase === "save") { f.remember = true; view.plugin.saveSettings = async () => { view.file = {}; }; }
    if (phase === "sections") view.getBackOfTheNoteSections = async () => { view.file = {}; return []; };
    await insertCodeBlock(view, phase === "language" ? "plain code" : fenced);
    assert.deepEqual(f.cards, []); assert.deepEqual(f.images, []);
  }
});
