/** Source-linked public surface inventory. AST inspection here is discovery, never behavioral test evidence. */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "./contracts.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = [
  "src/core/managers/CommandManager.ts",
  "src/core/main.ts",
  "src/shared/ExcalidrawAutomate.ts",
  "src/core/settingsDefaults.ts",
  "src/types/excalidrawCliTypes.ts",
  "src/constants/constants.ts",
];
export function discoverPublicSurface(projectRoot = root) {
  const commands = [],
    ea = [],
    settings = [],
    cli = [],
    hooks = [],
    frontmatter = [];
  for (const path of sources) {
    const text = readFileSync(join(projectRoot, path), "utf8"),
      file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const ref = (node, name) => ({
      name,
      path,
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    });
    function visit(node) {
      if (
        path.endsWith("constants.ts") &&
        ts.isVariableDeclaration(node) &&
        node.name.getText(file) === "FRONTMATTER_KEYS"
      ) {
        const value = ts.isAsExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        for (const property of value.properties) {
          const name = property.initializer.properties.find(
            (p) => p.name?.getText(file) === "name",
          )?.initializer;
          if (name && ts.isStringLiteral(name))
            frontmatter.push(ref(property, name.text));
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "addCommand"
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          const id = arg.properties.find(
            (p) => ts.isPropertyAssignment(p) && p.name.getText(file) === "id",
          );
          if (id)
            commands.push(
              ref(
                id,
                ts.isStringLiteralLike(id.initializer)
                  ? id.initializer.text
                  : `dynamic:${id.initializer.getText(file)}`,
              ),
            );
        }
      }
      if (
        path.endsWith("ExcalidrawAutomate.ts") &&
        ts.isClassDeclaration(node) &&
        node.name?.text === "ExcalidrawAutomate"
      ) {
        for (const member of node.members) {
          if (
            !member.name ||
            member.modifiers?.some((m) =>
              [
                ts.SyntaxKind.PrivateKeyword,
                ts.SyntaxKind.ProtectedKeyword,
              ].includes(m.kind),
            )
          )
            continue;
          const name = member.name.getText(file);
          if (
            ts.isMethodDeclaration(member) ||
            ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)
          )
            ea.push(ref(member, name));
          if (name.startsWith("on")) hooks.push(ref(member, name));
        }
      }
      if (
        path.endsWith("settingsDefaults.ts") &&
        ts.isInterfaceDeclaration(node) &&
        node.name.text === "ExcalidrawSettings"
      ) {
        for (const member of node.members)
          if (member.name)
            settings.push(ref(member, member.name.getText(file)));
      }
      if (
        path.endsWith("excalidrawCliTypes.ts") &&
        ts.isTypeAliasDeclaration(node) &&
        node.name.text === "CLICommand" &&
        ts.isUnionTypeNode(node.type)
      ) {
        for (const type of node.type.types)
          if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal))
            cli.push(ref(type, type.literal.text));
      }
      if (
        path.endsWith("excalidrawCliTypes.ts") &&
        ts.isPropertySignature(node) &&
        node.name.getText(file) === "command" &&
        node.type &&
        ts.isLiteralTypeNode(node.type) &&
        ts.isStringLiteral(node.type.literal)
      )
        cli.push(ref(node, node.type.literal.text));
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  const tests = ["scripts/testing", "tests"].flatMap((base) =>
    walkFiles(join(projectRoot, base))
      .filter((p) => p.endsWith(".test.mjs"))
      .map((path) => {
        const source = readFileSync(join(projectRoot, base, path), "utf8");
        return {
          path: `${base}/${path}`,
          mode: /createSourceFile|new Function|runInNewContext|runInContext|vm\./.test(
            source,
          )
            ? "isolated-or-extracted"
            : "direct-module-or-tooling",
        };
      }),
  );
  return {
    schemaVersion: 2,
    commands,
    publicEA: ea,
    settings,
    frontmatter,
    cliCommands: cli,
    hooks,
    testFiles: tests,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const file = join(root, "tests/inventory.json"),
    content = JSON.stringify(discoverPublicSurface(), null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(file, "utf8") !== content)
      throw Error(
        "Public/test inventory drift: regenerate and review feature obligations",
      );
  } else writeFileSync(file, content);
  process.stdout.write(
    "Public API, command, setting, hook and test inventory verified\n",
  );
}
