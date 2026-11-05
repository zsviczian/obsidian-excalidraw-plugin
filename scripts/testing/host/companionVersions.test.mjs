import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertConverterInstallation, assertCompanionVersions } from "./companionVersions.mjs";
test("stale installed converter fails before a producer can bundle it", () => {
  const root=mkdtempSync(join(tmpdir(),"extras-dependencies-"));
  try {
    writeFileSync(join(root,"package.json"),JSON.stringify({dependencies:{"@excalidraw/mermaid-to-excalidraw":"3.1.0"}}));
    const installed=join(root,"node_modules/@excalidraw/mermaid-to-excalidraw");mkdirSync(installed,{recursive:true});
    writeFileSync(join(installed,"package.json"),JSON.stringify({version:"2.2.2"}));
    assert.throws(()=>assertConverterInstallation(root,"extras"),/npm ci/);
    writeFileSync(join(installed,"package.json"),JSON.stringify({version:"3.1.0"}));assertConverterInstallation(root,"extras");
  }finally{rmSync(root,{recursive:true,force:true})}
});
test("incompatible live companion cannot be accepted as a prepared vault", () => {
  assert.throws(()=>assertCompanionVersions(()=>JSON.stringify({ready:true,checks:{mermaid:{valid:false,currentVersion:"2.2.2",reqVersion:"3.6.0"}}})),/Prepared companion version mismatch/);
  const result=assertCompanionVersions(()=>JSON.stringify({ready:true,versions:{mermaid:"3.6.0"},checks:{mermaid:{valid:true}}}));assert.equal(result.versions.mermaid,"3.6.0");
});
