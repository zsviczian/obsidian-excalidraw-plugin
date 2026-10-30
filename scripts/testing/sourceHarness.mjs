/** Test-only ESM compilation graph: import whole production modules with explicit boundary substitutes. */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function sourceHarness(mocks = {}) {
  if (typeof nodeModule.registerHooks !== "function") throw Error("Whole-module source tests require Node 22.15+; use the documented Node 22.22.3 toolchain");
  const token = "__sourceHarness_" + randomUUID().replaceAll("-", ""), query = `?${token}`;
  const compiledRoot = resolve(root, ".test-work/source-graphs", token), sourcePaths = new Map();
  const moduleURL = path => {
    const compiledPath = resolve(compiledRoot, relative(root, path) + ".mjs");
    const url = pathToFileURL(compiledPath).href + query;
    sourcePaths.set(url, path); return url;
  };
  globalThis[token] = mocks;
  const hooks = nodeModule.registerHooks({
    resolve(specifier, context, next) {
      if (sourcePaths.has(specifier)) return { shortCircuit: true, url: specifier };
      if (Object.hasOwn(mocks, specifier)) {
        const names = Object.keys(mocks[specifier]);
        for (const name of names) if (name !== "default" && !/^[$\w]+$/.test(name)) throw Error("Invalid mock export");
        const source = names.map(name => name === "default"
          ? `export default globalThis[${JSON.stringify(token)}][${JSON.stringify(specifier)}].default;`
          : `export const ${name}=globalThis[${JSON.stringify(token)}][${JSON.stringify(specifier)}][${JSON.stringify(name)}];`).join("\n");
        return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(source) };
      }
      if (specifier.startsWith("src/") || (specifier.startsWith(".") && context.parentURL?.includes(query))) {
        const base = specifier.startsWith("src/") ? pathToFileURL(resolve(root, specifier)).href : new URL(specifier, pathToFileURL(sourcePaths.get(context.parentURL))).href;
        const clean = base.split("?")[0];
        for (const candidate of [clean, clean + ".ts", clean + ".tsx", clean + "/index.ts"]) {
          if (existsSync(fileURLToPath(candidate)) && /\.tsx?$/.test(candidate)) return { shortCircuit: true, url: moduleURL(fileURLToPath(candidate)) };
        }
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (sourcePaths.has(url)) {
        const path = sourcePaths.get(url), content = readFileSync(path, "utf8");
        const source = ts.transpileModule(content, { fileName: path, compilerOptions: {
          module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
          inlineSourceMap: true, inlineSources: true, esModuleInterop: true, sourceRoot: pathToFileURL(dirname(path)).href + "/",
        } }).outputText;
        // Distinct compiled paths prevent V8 from merging incompatible offsets
        // from native type stripping and isolated transpilation. Standard c8
        // remaps each graph before merging counts into the original sources.
        const compiledPath = fileURLToPath(url);
        mkdirSync(dirname(compiledPath), { recursive: true }); writeFileSync(compiledPath, source);
        return { format: "module", shortCircuit: true, source };
      }
      return next(url, context);
    },
  });
  return { importModule: name => import(name.startsWith("src/") ? moduleURL(resolve(root, name)) : name),
    close() { hooks.deregister(); delete globalThis[token]; } };
}
