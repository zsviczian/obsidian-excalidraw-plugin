/** Run the production converter with an XML DOM; no live Obsidian is required. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { DOMParser as XMLParser } from "@xmldom/xmldom";
import * as chroma from "chroma-js";
import * as pathData from "path-data-parser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
class DOMParser {
  parseFromString(source, mime) {
    let doc;
    try {
      doc = new XMLParser({
        onError: (_level, message) => {
          throw Error(message);
        },
      }).parseFromString(source, mime);
    } catch {
      doc = new XMLParser().parseFromString(
        "<parsererror>Invalid XML</parsererror>",
        mime,
      );
    }
    return doc;
  }
}

/** Loads the actual TypeScript module graph with deterministic test identities. */
export function loadConverter() {
  let identity = 0;
  const cache = new Map();
  const externals = {
    "chroma-js": { ...chroma, __esModule: true },
    "path-data-parser": pathData,
    nanoid: { nanoid: () => `test-${++identity}` },
    "roughjs/bin/math": {
      Random: class {
        next() {
          return 0.5;
        }
      },
    },
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const require = (name) => {
      if (externals[name]) return externals[name];
      if (name.endsWith("constants/constants"))
        return {
          ROUNDNESS: { LEGACY: 1 },
          nanoid: () => String(++identity).padStart(8, "0"),
        };
      if (name.endsWith("constants/safeUrls"))
        return {
          URLs: {
            GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG:
              "https://example.test/releases",
          },
        };
      if (name.endsWith("utils/debugHelper")) return { log() {} };
      const target = name.startsWith("src/")
        ? resolve(root, name)
        : resolve(dirname(path), name);
      if (existsSync(`${target}.ts`)) return load(`${target}.ts`);
      throw Error(`Unmapped converter dependency: ${name}`);
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      {
        module,
        exports: module.exports,
        require,
        DOMParser,
        PLUGIN_VERSION: "test",
        console,
      },
      { filename: path },
    );
    return module.exports;
  }
  return load(resolve(root, "src/shared/svgToExcalidraw/parser.ts"))
    .svgToExcalidraw;
}
