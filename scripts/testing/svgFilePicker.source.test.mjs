import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

async function setup(t, throws = false) {
  const handlers = new Map(),
    children = new Set(),
    picked = [];
  let clicks = 0,
    removed = 0,
    options;
  const input = {
    files: [],
    addEventListener: (name, callback) => handlers.set(name, callback),
    removeEventListener: (name) => handlers.delete(name),
    remove: () => {
      removed++;
    },
    click: () => {
      clicks++;
      if (throws) throw Error("Chooser failed");
    },
  };
  const view = {
    ownerDocument: {
      body: {
        createEl(tag, value) {
          assert.equal(tag, "input");
          options = value;
          return input;
        },
      },
    },
    addChild(child) {
      children.add(child);
      return child;
    },
    removeChild(child) {
      children.delete(child);
      child.unload();
    },
  };
  const graph = sourceHarness({
    obsidian: {
      Component: class {
        cleanups = [];
        register(callback) {
          this.cleanups.push(callback);
        }
        registerDomEvent(element, name, callback) {
          element.addEventListener(name, callback);
          this.register(() => element.removeEventListener(name, callback));
        }
        unload() {
          this.cleanups
            .splice(0)
            .reverse()
            .forEach((fn) => fn());
        }
      },
    },
    "./styleUtils": {
      hideElement: (element) => {
        assert.equal(element, input);
      },
    },
  });
  t.after(() => graph.close());
  const { openSVGFilePicker } = await graph.importModule(
    "src/utils/svgFilePicker.ts",
  );
  return {
    input,
    children,
    handlers,
    view,
    picked,
    open: () =>
      openSVGFilePicker(view, async (file) => {
        picked.push(file);
      }),
    get clicks() {
      return clicks;
    },
    get removed() {
      return removed;
    },
    get options() {
      return options;
    },
  };
}

test("system SVG picker opens synchronously with SVG filter and returns the selected File", async (t) => {
  const f = await setup(t);
  f.open();
  assert.equal(f.clicks, 1);
  assert.equal(f.options.type, "file");
  assert.equal(f.options.attr.accept, ".svg,image/svg+xml");
  const file = { name: "outside-vault.svg" };
  f.input.files = [file];
  f.handlers.get("change")();
  assert.deepEqual(f.picked, [file]);
  assert.equal(f.children.size, 0);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.removed, 1);
});
test("system SVG picker cancellation and empty selection leave no input or callback", async (t) => {
  for (const event of ["cancel", "change"]) {
    const f = await setup(t);
    f.open();
    f.handlers.get(event)();
    assert.equal(f.children.size, 0);
    assert.equal(f.handlers.size, 0);
    assert.equal(f.removed, 1);
    assert.equal(f.picked.length, 0);
  }
});
test("system SVG picker belongs to the initiating view and is removed on unload", async (t) => {
  const f = await setup(t);
  f.open();
  for (const child of f.children) f.view.removeChild(child);
  assert.equal(f.removed, 1);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.picked.length, 0);
});
test("system SVG picker cleans up if opening the chooser throws", async (t) => {
  const f = await setup(t, true);
  assert.throws(f.open, /Chooser failed/);
  assert.equal(f.removed, 1);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.children.size, 0);
});
