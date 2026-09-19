// Project only declarations reachable from the supported script surface.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const hidden = (node) => node.modifiers?.some((m) =>
  [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(m.kind));
const names = (statement) => ts.isVariableStatement(statement)
  ? statement.declarationList.declarations.map((item) => item.name.text)
  : statement.name ? [statement.name.text] : [];

export function projectScriptApi(root) {
  const modules = new Map();
  const selected = new Map();
  const pending = [];
  const external = new Set();
  const overrides = new Map([
    ['core/main', `import type { App } from "obsidian";
      /** Compatibility access to the official Obsidian app; plugin internals are not a scripting API. */
      export default interface ExcalidrawPlugin { readonly app: App; }`],
    ['view/ExcalidrawView', `import type { TFile, WorkspaceLeaf } from "obsidian";
      /** View identity and UI ownership for EA hooks. Use EA for drawing operations. */
      export default interface ExcalidrawView {
        readonly file: TFile | null;
        readonly leaf: WorkspaceLeaf;
        readonly contentEl: HTMLDivElement;
        readonly ownerDocument: Document;
        readonly ownerWindow: Window;
      }`],
    ['shared/EmbeddedFileLoader', `declare const embeddedFilesLoader: unique symbol;
      /** Opaque EA-owned handle. Obtain through ea.getEmbeddedFilesLoader(), then pass back to EA. */
      export interface EmbeddedFilesLoader { readonly [embeddedFilesLoader]: never; }`],
    ['view/managers/CanvasNodeFactory', `declare const canvasNode: unique symbol;
      /** Opaque embedded-canvas identity; Obsidian Canvas internals are not a scripting API. */
      export interface ObsidianCanvasNode { readonly [canvasNode]: never; }`],
    ['view/sidepanel/SidepanelTab', `export type { SidepanelTab as ExcalidrawSidepanelTab } from "src/types/sidepanelTabTypes";`],
  ]);
  const outputNames = {
    'core/main': 'scriptPlugin', 'view/ExcalidrawView': 'scriptView',
    'shared/ExcalidrawAutomate': 'excalidrawAutomate',
    'shared/EmbeddedFileLoader': 'embeddedFilesLoader',
    'view/managers/CanvasNodeFactory': 'embeddedCanvasNode',
    'view/sidepanel/SidepanelTab': 'sidepanelTab',
    'shared/Dialogs/FloatingModal': 'floatingModal',
    'types/excalidrawLib': 'excalidrawLib',
    'scriptUtils': 'scriptUtils',
  };
  const outputName = (name) => outputNames[name] ?? `support/${name}`;
  function input(name) {
    const lib = path.join(root, 'lib', `${name}.d.ts`);
    return fs.readFileSync(fs.existsSync(lib) ? lib : path.join(root, 'src', `${name}.d.ts`), 'utf8');
  }
  // Utils are invocation helpers, not the ScriptEngine implementation class.
  const scriptFile = ts.createSourceFile('Scripts.d.ts', input('shared/Scripts'), ts.ScriptTarget.Latest, true);
  const engine = scriptFile.statements.find((node) => ts.isClassDeclaration(node));
  function utility(name, skip) {
    const method = engine.members.find((member) => member.name?.text === name);
    const typeParameters = method.typeParameters?.length
      ? `<${method.typeParameters.map((p) => p.getText(scriptFile)).join(', ')}>` : '';
    const result = name === 'inputPrompt' ? 'Promise<string | undefined>' : method.type.getText(scriptFile);
    return `${name}${typeParameters}(${method.parameters.slice(skip).map((p) => p.getText(scriptFile)).join(', ')}): ${result};`;
  }
  const executionSource = scriptFile.statements.find((node) => node.name?.text === 'ScriptExecutionSource');
  overrides.set('scriptUtils', `import type { TFile, Instruction } from "obsidian";
    import type { ButtonDefinition, InputPromptOptions } from "src/types/promptTypes";
    ${executionSource.getText(scriptFile)}
    export interface ScriptUtils {
      ${utility('inputPrompt', 3)}
      inputPrompt(options: InputPromptOptions): Promise<string | undefined>;
      ${utility('suggester', 1)}
      readonly scriptFile: TFile;
      readonly executionSource: ScriptExecutionSource;
    }`);

  function module(name) {
    if (modules.has(name)) return modules.get(name);
    const file = ts.createSourceFile(`${name}.d.ts`, overrides.get(name) ?? input(name), ts.ScriptTarget.Latest, true);
    const imports = new Map();
    const declarations = new Map();
    const reexports = new Map();
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (clause?.name) imports.set(clause.name.text, { specifier: statement.moduleSpecifier.text, imported: 'default' });
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
          imports.set(item.name.text, { specifier: statement.moduleSpecifier.text, imported: item.propertyName?.text ?? item.name.text });
        }
        if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, { specifier: statement.moduleSpecifier.text, imported: '*' });
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const item of statement.exportClause.elements) reexports.set(item.name.text, { specifier: statement.moduleSpecifier.text, imported: item.propertyName?.text ?? item.name.text });
      } else {
        for (const key of names(statement)) declarations.set(key, statement);
        if (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) declarations.set('default', statement);
      }
    }
    const result = { file, imports, declarations, reexports, usedImports: new Map(), usedExports: new Map(), emitted: new Set() };
    modules.set(name, result);
    return result;
  }
  function resolve(from, specifier) {
    if (!specifier.startsWith('.') && !specifier.startsWith('src/')) {
      external.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);
      return { specifier, local: false };
    }
    let target = specifier.startsWith('src/') ? specifier.slice(4) : path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    if (target.startsWith('../')) throw new Error(`Type import escapes source: ${specifier}`);
    if (fs.existsSync(path.join(root, 'lib', target, 'index.d.ts'))) target += '/index';
    let relative = path.posix.relative(path.posix.dirname(outputName(from)), outputName(target));
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return { specifier: relative, local: true, target };
  }
  function request(name, symbol) {
    if (!selected.has(name)) selected.set(name, new Set());
    if (selected.get(name).has(symbol)) return;
    selected.get(name).add(symbol);
    pending.push([name, symbol]);
  }
  function follow(from, ref) {
    const result = resolve(from, ref.specifier);
    if (result.local) {
      if (ref.imported === '*') throw new Error(`Unreviewed local namespace import in ${from}`);
      request(result.target, ref.imported);
    }
    return result.specifier;
  }
  // Strip implementation-only members before traversing dependencies.
  function project(name, declaration) {
    if (ts.isClassDeclaration(declaration)) {
      const members = declaration.members.filter((member) => !hidden(member) &&
        !(name === 'shared/ExcalidrawAutomate' && ts.isConstructorDeclaration(member)));
      return ts.factory.updateClassDeclaration(declaration, declaration.modifiers, declaration.name,
        declaration.typeParameters, declaration.heritageClauses, members);
    }
    if (name === 'types/excalidrawLib' && ts.isModuleDeclaration(declaration)) {
      const internal = /^(Obsidian.*Host.*|configureObsidian.*Host.*|OBSIDIAN_.*_HOST_PROTOCOL_VERSION)$/;
      const body = ts.factory.updateModuleBlock(declaration.body, declaration.body.statements.filter((node) =>
        !names(node).some((key) => internal.test(key))));
      return ts.factory.updateModuleDeclaration(declaration, declaration.modifiers, declaration.name, body);
    }
    return declaration;
  }
  for (const [name, symbol] of [['shared/ExcalidrawAutomate', 'ExcalidrawAutomate'], ['types/excalidrawLib', 'ExcalidrawLib'], ['scriptUtils', 'ScriptUtils'], ['scriptUtils', 'ScriptExecutionSource']]) request(name, symbol);
  while (pending.length) {
    const [name, symbol] = pending.pop();
    const current = module(name);
    const reexport = current.reexports.get(symbol);
    if (reexport) { current.usedExports.set(symbol, { ...reexport, specifier: follow(name, reexport) }); continue; }
    const declaration = current.declarations.get(symbol);
    if (!declaration) throw new Error(`Unresolved public type ${name}#${symbol}`);
    const projected = project(name, declaration);
    current.emitted.add(projected);
    function visit(node) {
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        const specifier = node.argument.literal.text;
        const result = resolve(name, specifier);
        if (result.local) {
          if (!node.qualifier || !ts.isIdentifier(node.qualifier)) throw new Error(`Unsupported import type: ${node.getText(current.file)}`);
          request(result.target, node.qualifier.text);
        }
      } else if (ts.isIdentifier(node)) {
        const ref = current.imports.get(node.text);
        if (ref) current.usedImports.set(node.text, { ...ref, specifier: follow(name, ref) });
        else if (current.declarations.has(node.text)) request(name, node.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(projected);
  }
  const files = new Map();
  for (const [name, current] of modules) {
    const imports = [...current.usedImports].map(([local, ref]) => {
      const binding = ref.imported === 'default' ? local : ref.imported === '*' ? `* as ${local}` : `{ ${ref.imported === local ? local : `${ref.imported} as ${local}`} }`;
      return `import type ${binding} from ${JSON.stringify(ref.specifier)};`;
    });
    const exports = [...current.usedExports].map(([local, ref]) => `export type { ${ref.imported === local ? local : `${ref.imported} as ${local}`} } from ${JSON.stringify(ref.specifier)};`);
    const declarations = [...current.emitted].map((node) => {
      const transformed = ts.transform(node, [(context) => {
        const visit = (child) => {
          if (ts.isImportTypeNode(child) && ts.isLiteralTypeNode(child.argument)) {
            const specifier = resolve(name, child.argument.literal.text).specifier;
            return ts.factory.updateImportTypeNode(child, ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(specifier)), child.attributes, child.qualifier, child.typeArguments, child.isTypeOf);
          }
          return ts.visitEachChild(child, visit, context);
        };
        return (rootNode) => ts.visitNode(rootNode, visit);
      }]);
      const content = printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], current.file);
      transformed.dispose();
      return content;
    });
    files.set(`${outputName(name)}.d.ts`, '// Generated scripting API. No plugin implementation declarations.\n' + [...imports, ...exports, ...declarations, 'export {};'].join('\n') + '\n');
  }
  return { files, external };
}
