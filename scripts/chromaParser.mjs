import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Builds the private color-parser entry used by SVG import and Lucide preparation.
 * Keep every input registration from the installed full Chroma entry, including
 * CSS/named/wide-gamut formats. Palette generators, interpolation and unrelated
 * color operations are not part of either caller or a public plugin API.
 * Follow Chroma's own custom-entry design instead of replacing its parser or
 * introducing another library. A changed upstream layout must fail the build.
 */
export function createChromaParserEntry(source) {
  const tree = ts.createSourceFile(
    "chroma-entry.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = new Set();
  const inputs = [];
  for (const statement of tree.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      imports.add(statement.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.exportClause &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("./src/io/")
    ) {
      inputs.push(statement.moduleSpecifier.text);
    }
  }
  const required = [
    "./src/chroma.js",
    "./src/io/named/index.js",
    "./src/ops/alpha.js",
    "./src/utils/valid.js",
  ];
  if (required.some((path) => !imports.has(path)) || !inputs.length) {
    throw new Error(
      "Unrecognized Chroma entry: review the parser-only build before upgrading.",
    );
  }
  return [
    'import chroma from "./src/chroma.js";',
    'import "./src/io/named/index.js";',
    'import "./src/ops/alpha.js";',
    ...inputs.map((path) => `import ${JSON.stringify(path)};`),
    'import valid from "./src/utils/valid.js";',
    "chroma.valid = valid;",
    "export default chroma;",
  ].join("\n");
}

/** Apply the same private parser in production, development and library builds. */
export function chromaParserOnly() {
  const entry = fileURLToPath(import.meta.resolve("chroma-js")).replaceAll(
    "\\",
    "/",
  );
  return {
    name: "excalidraw-private-chroma-parser",
    load(id) {
      if (id.replaceAll("\\", "/") !== entry) return null;
      this.addWatchFile(id);
      return createChromaParserEntry(readFileSync(id, "utf8"));
    },
  };
}
