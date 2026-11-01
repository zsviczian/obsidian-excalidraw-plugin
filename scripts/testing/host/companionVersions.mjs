/** Reject stale dependency installations and incompatible live services before native UI work. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCLIJSON } from "./inAppTask.mjs";

export function assertConverterInstallation(root, kind) {
  const name = "@excalidraw/mermaid-to-excalidraw";
  const pkg = JSON.parse(readFileSync(join(root, kind === "fork" ? "packages/excalidraw/package.json" : "package.json"), "utf8"));
  const expected = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (!expected || !/^\d+\.\d+\.\d+$/.test(expected)) return;
  let installed;
  try { installed = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version; } catch { installed = "missing"; }
  assert.equal(installed, expected, `${kind} converter installation is stale (${installed}; source requires ${expected}). Run ${kind === "fork" ? "yarn install --frozen-lockfile" : "npm ci"} in ${root}, then rebuild; existing dist files are not acceptance evidence.`);
}

export function assertCompanionVersions(cli) {
  const evidence = parseCLIJSON(cli("eval", "code=JSON.stringify((()=>{const p=app.plugins.plugins['obsidian-excalidraw-plugin'],extras=app.plugins.plugins['excalidraw-extras'];if(!p?.extrasGateway||!extras?.api)return {ready:false};return {ready:true,versions:extras.api.versions,checks:Object.fromEntries(['mathjax','mermaid','pdf','filesystem'].map(component=>[component,p.extrasGateway.checkVersion(component,extras.api)]))}})())"));
  assert.equal(evidence.ready, true, "Prepared plugin/Extras API unavailable; inspect enablement and startup errors before testing");
  const invalid = Object.entries(evidence.checks).filter(([, result]) => !result.valid);
  assert.equal(invalid.length, 0, `Prepared companion version mismatch: ${JSON.stringify(invalid)}. Refresh the selected workspace dependencies, build and deploy Extras main.js/styles.css/manifest.json, then verify the live API again.`);
  return evidence;
}
