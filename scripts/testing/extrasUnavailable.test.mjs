import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

test("an enabled Extras plugin with an absent or incomplete API cancels service access cleanly", async () => {
  const notices = [], graph = sourceHarness({
    obsidian: { Modal: class {
      contentEl = { empty() {} };
      open() { this.onOpen(); } close() { this.onClose(); }
    }, Notice: class { constructor(text) { notices.push(text); } }, Setting: class {} },
    "../lang/helpers": { t: key => key }, "src/lang/locale/en": { default: {} },
  });
  try {
    const { ExcalidrawExtrasGateway } = await graph.importModule("src/utils/ExcalidrawExtrasGateway.ts");
    for (const api of [undefined, {}, { versions: {} }, { features: {}, versions: {} }, { versions: {}, features: { isActive() { return true; } } }]) {
      const gateway = new ExcalidrawExtrasGateway({ plugins: {
        manifests: { "excalidraw-extras": { version: "0.1.2" } }, plugins: { "excalidraw-extras": { api } },
      } }, {});
      assert.equal(await gateway.getMermaid(), null);
    }
    assert.equal(notices.length, 5);
    assert.ok(notices.every(text => text === "EXTRAS_GATEWAY_API_MISSING"));
    const gateway = new ExcalidrawExtrasGateway({ plugins: { manifests: { "excalidraw-extras": { version: "0.2.1" } } } }, {});
    for (const versions of [undefined, {}, { mathjax: undefined }, { mathjax: 1 }]) {
      const result = gateway.checkVersion("mathjax", { versions });
      assert.equal(result.valid, false); assert.equal(result.currentVersion, "0.0.0");
    }
  } finally { graph.close(); }
});
