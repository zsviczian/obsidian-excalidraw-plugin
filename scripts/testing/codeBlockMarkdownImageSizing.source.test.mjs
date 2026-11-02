/** Bound natural DOM measurements and clean the temporary style in its owning document. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
const harness = sourceHarness({ "./htmlUtils": { setStyleText: (element, text) => element.textContent = text } });
const { getCodeBlockMarkdownImageWidth } = await harness.importModule("src/utils/codeBlockMarkdownImageUtils.ts");
test.after(() => harness.close());
test("code width uses natural layout plus border, bounded to compact and maximum sizes", () => {
  const before = globalThis.deliberateCreateElement;
  try {
    for (const [natural, border, expected] of [[40, 0, 180], [301.2, 4, 306], [790, 4, 794], [16000, 4, 800]]) {
      const classes = new Set(), styles = new Set();
      const doc = { head: { appendChild: element => styles.add(element) } };
      const container = { ownerDocument: doc, classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        getBoundingClientRect() { assert.equal(classes.size, 1); assert.equal(styles.size, 1); return { width: natural }; } };
      globalThis.deliberateCreateElement = (owner, tag) => { assert.equal(owner, doc); assert.equal(tag, "style"); const element = { remove: () => styles.delete(element) }; return element; };
      assert.equal(getCodeBlockMarkdownImageWidth(container, 800, border), expected);
      assert.equal(classes.size, 0); assert.equal(styles.size, 0);
      container.getBoundingClientRect = () => { throw Error("retired frame"); };
      assert.throws(() => getCodeBlockMarkdownImageWidth(container, 800, border), /retired frame/);
      assert.equal(classes.size, 0); assert.equal(styles.size, 0);
    }
  } finally {
    if (before === undefined) delete globalThis.deliberateCreateElement;
    else globalThis.deliberateCreateElement = before;
  }
});
