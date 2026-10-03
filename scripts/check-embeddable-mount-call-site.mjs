// This component imports types that are unavailable to this Node process, so
// these checks inspect its TypeScript syntax. Node identity uses assert.ok because
// serializing a parent-linked AST can exhaust the heap.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/view/components/CustomEmbeddable.tsx", import.meta.url),
  "utf8",
);
const file = ts.createSourceFile(
  "CustomEmbeddable.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const log = (message) => process.stdout.write(`${message}\n`);

const collect = (match) => {
  const found = [];
  const visit = (node) => {
    if (match(node)) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

const enclosingFunction = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) {
      return parent;
    }
  }
  return undefined;
};

const enclosingStatement = (node) => {
  let current = node;
  while (current.parent && !ts.isStatement(current)) {
    current = current.parent;
  }
  return current;
};

assert.equal(
  collect(
    (node) =>
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier.text === "src/utils/embeddableMountPlan",
  ).length,
  1,
  "the component has one embeddable mount-plan import",
);

const dispatches = collect(
  (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "mountEmbeddableHost",
);
assert.equal(
  dispatches.length,
  1,
  "the component has one mountEmbeddableHost call",
);
const [dispatch] = dispatches;
const effect = enclosingFunction(dispatch);
assert.ok(effect, "mountEmbeddableHost is called by a function");

const [options] = dispatch.arguments;
assert.ok(
  options && ts.isObjectLiteralExpression(options),
  "mountEmbeddableHost receives an options object",
);
const option = (name) =>
  options.properties.find(
    (property) =>
      property.name &&
      ts.isIdentifier(property.name) &&
      property.name.text === name,
  );

for (const name of [
  "subpath",
  "fileExtension",
  "getHost",
  "isCancelled",
  "createCanvasNode",
  "createWorkspaceLeaf",
]) {
  assert.ok(option(name), `the options object has ${name}`);
}

assert.ok(
  ts.isShorthandPropertyAssignment(option("subpath")),
  "subpath is a shorthand option",
);
assert.equal(
  option("fileExtension").initializer?.getText(file),
  "file.extension",
  "fileExtension is file.extension",
);
const getHost = option("getHost");
assert.ok(
  ts.isPropertyAssignment(getHost) &&
    ts.isArrowFunction(getHost.initializer) &&
    getHost.initializer.body.getText(file) === "view.canvasNodeFactory",
  "getHost returns view.canvasNodeFactory",
);

const statement = enclosingStatement(dispatch);
assert.ok(
  ts.isExpressionStatement(statement),
  "mountEmbeddableHost is an expression statement",
);
assert.ok(
  statement.parent === effect.body,
  "the expression statement belongs to the function body",
);
const handledDispatch = ts.isVoidExpression(statement.expression)
  ? statement.expression.expression
  : statement.expression;
assert.ok(
  ts.isCallExpression(handledDispatch) &&
    ts.isPropertyAccessExpression(handledDispatch.expression) &&
    handledDispatch.expression.expression === dispatch &&
    handledDispatch.expression.name.text === "catch",
  "the mount dispatch handles rejected promises",
);

assert.equal(
  collect(
    (node) =>
      ts.isIdentifier(node) &&
      node.text === "canvasNodeFactory" &&
      enclosingFunction(node) === effect,
  ).length,
  0,
  "the caller body has no canvasNodeFactory identifier",
);

for (const name of ["createNode", "mountWorkspaceLeaf"]) {
  assert.equal(
    collect(
      (node) =>
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === name &&
        enclosingFunction(node) === effect,
    ).length,
    0,
    `the caller body has no direct ${name} call`,
  );
}

const isCancelled = option("isCancelled");
assert.ok(
  ts.isPropertyAssignment(isCancelled) &&
    ts.isArrowFunction(isCancelled.initializer),
  "isCancelled is an arrow function",
);
let firstOperand = isCancelled.initializer.body;
while (
  ts.isBinaryExpression(firstOperand) &&
  firstOperand.operatorToken.kind === ts.SyntaxKind.BarBarToken
) {
  firstOperand = firstOperand.left;
}
assert.ok(
  ts.isIdentifier(firstOperand) && firstOperand.text === "effectCancelled",
  "the cancellation expression starts with effectCancelled",
);

const declarations = collect(
  (node) =>
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "effectCancelled",
);
assert.equal(
  declarations.length,
  1,
  "effectCancelled has one declaration",
);
assert.ok(
  enclosingFunction(declarations[0]) === effect,
  "effectCancelled is declared by the calling function",
);

const cleanup = effect.body.statements.find(ts.isReturnStatement);
assert.ok(
  cleanup && ts.isArrowFunction(cleanup.expression),
  "the calling function returns an arrow function",
);
const [firstCleanupStatement] = cleanup.expression.body.statements;
assert.equal(
  firstCleanupStatement.getText(file),
  "effectCancelled = true;",
  "the cleanup starts with effectCancelled = true;",
);

assert.equal(
  collect(
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "mountWorkspaceLeaf" &&
      enclosingFunction(node) === effect,
  ).length,
  1,
  "mountWorkspaceLeaf has one declaration in the calling function",
);

log("embeddable mount call site checks passed");
