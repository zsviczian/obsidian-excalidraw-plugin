/** Runtime denominator discovery; this is classification, never execution credit. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
export function isTypeOnlySource(source, fileName) {
  if (fileName.endsWith(".d.ts")) return true;
  const output = ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText;
  return !output.replace(/export\s*\{\s*\};?/g, "").replaceAll(";", "").trim();
}
export function productionModules(root) {
  const runtime = [], typeOnly = [];
  const visit = directory => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error("Redirected production source: " + entry.name);
      const path = directory + "/" + entry.name;
      if (entry.isDirectory()) visit(path);
      else if (/\.tsx?$/.test(path)) (isTypeOnlySource(readFileSync(join(root, path), "utf8"), path) ? typeOnly : runtime).push(path);
    }
  };
  visit("src"); return { runtime: runtime.sort(), typeOnly: typeOnly.sort() };
}
