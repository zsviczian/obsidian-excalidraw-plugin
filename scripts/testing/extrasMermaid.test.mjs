/** Check the real gateway's version policy before it can serve a converter to the fork. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../src/utils/ExcalidrawExtrasGateway.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports,
  require: name => name === "obsidian" ? { Modal: class {} } : name.includes("lang/helpers")
    ? { t: key => key } : {},
});

// This is the Extras service contract, independent of its bundled converter's version.
for (const [version, accepted] of [["2.2.2", false], ["3.0.0", false], ["3.1.0", false], ["3.6.0", true], ["3.6.1", false]]) {
  test(`Mermaid ${version} is ${accepted ? "accepted" : "rejected"} by the exact-version handshake`, () => {
    const gateway = new exports.ExcalidrawExtrasGateway({
      plugins: { manifests: { "excalidraw-extras": { version: "0.1.2" } } },
    }, {});
    const result = gateway.checkVersion("mermaid", { versions: { mermaid: version } });
    assert.equal(result.valid, accepted);
    if (!accepted) {
      assert.equal(result.isExact, true);
      assert.equal(result.reqVersion, "3.6.0");
      assert.equal(result.currentVersion, version);
    }
  });
}

test('Extras status exposes component versions and compatibility without loading or enabling services', () => {
  const api = { versions: { mermaid: '3.0.0', mathjax: '1.1.0', pdf: '1.0.0', filesystem: '1.0.0' },
    features: { isActive: () => true, enable: () => assert.fail('status enabled a service') },
    mermaid: { getModule: () => assert.fail('status loaded Mermaid') } };
  const app = { plugins: { manifests: { 'excalidraw-extras': { version: '0.1.2' } }, plugins: { 'excalidraw-extras': { api } } } };
  const gateway = new exports.ExcalidrawExtrasGateway(app, {});
  let result = gateway.getStatus();
  assert.equal(result.enabled, true); assert.equal(result.pluginVersion, '0.1.2');
  assert.equal(result.components.mermaid.version, '3.0.0');
  assert.equal(result.components.mermaid.requiredVersion, '3.6.0');
  assert.equal(result.components.mermaid.exact, true); assert.equal(result.components.mermaid.compatible, false);
  assert.equal(result.components.mathjax.compatible, true);
  api.versions.mermaid = '3.6.0'; result = gateway.getStatus();
  assert.equal(result.components.mermaid.compatible, true);
  delete app.plugins.plugins['excalidraw-extras']; result = gateway.getStatus();
  assert.equal(result.enabled, false); assert.equal(result.components.mermaid.version, null); assert.equal(result.components.mermaid.active, false);
});
