/** Test-only ESM compilation graph: import whole production modules with explicit boundary substitutes. */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function sourceHarness(mocks = {}) {
  const token = "__sourceHarness_" + randomUUID().replaceAll("-", ""), query = `?${token}`;
  globalThis[token] = mocks;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (Object.hasOwn(mocks, specifier)) {
        const names = Object.keys(mocks[specifier]);
        for (const name of names) if (name !== "default" && !/^[$\w]+$/.test(name)) throw Error("Invalid mock export");
        const source = names.map(name => name === "default"
          ? `export default globalThis[${JSON.stringify(token)}][${JSON.stringify(specifier)}].default;`
          : `export const ${name}=globalThis[${JSON.stringify(token)}][${JSON.stringify(specifier)}][${JSON.stringify(name)}];`).join("\n");
        return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(source) };
      }
      if (specifier.startsWith("src/") || (specifier.startsWith(".") && context.parentURL?.includes(query))) {
        const base = specifier.startsWith("src/") ? pathToFileURL(resolve(root, specifier)).href : new URL(specifier, context.parentURL).href;
        const clean = base.split("?")[0];
        for (const candidate of [clean, clean + ".ts", clean + ".tsx", clean + "/index.ts"]) {
          if (existsSync(fileURLToPath(candidate)) && /\.tsx?$/.test(candidate)) return { shortCircuit: true, url: candidate + query };
        }
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith(query)) {
        const path = fileURLToPath(url), content = readFileSync(path, "utf8");
        const source = ts.transpileModule(content, { fileName: path, compilerOptions: {
          module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
          inlineSourceMap: true, inlineSources: true, esModuleInterop: true,
        } }).outputText;
        return { format: "module", shortCircuit: true, source };
      }
      return next(url, context);
    },
  });
  return { importModule: name => import(name.startsWith("src/") ? pathToFileURL(resolve(root, name)).href + query : name),
    close() { hooks.deregister(); delete globalThis[token]; } };
}
