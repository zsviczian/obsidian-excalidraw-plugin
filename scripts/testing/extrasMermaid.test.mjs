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

for (const [version, accepted] of [["2.2.2", false], ["3.0.0", true], ["3.0.1", false]]) {
  test(`Mermaid ${version} is ${accepted ? "accepted" : "rejected"} by the exact-version handshake`, () => {
    const gateway = new exports.ExcalidrawExtrasGateway({
      plugins: { manifests: { "excalidraw-extras": { version: "0.1.2" } } },
    }, {});
    const result = gateway.checkVersion("mermaid", { versions: { mermaid: version } });
    assert.equal(result.valid, accepted);
    if (!accepted) {
      assert.equal(result.isExact, true);
      assert.equal(result.reqVersion, "3.0.0");
      assert.equal(result.currentVersion, version);
    }
  });
}
