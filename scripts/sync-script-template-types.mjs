// Publishes a restricted scripting API projection, never the plugin implementation graph.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { projectScriptApi } from './script-api-projection.mjs';

const log = (...args) => console.log(...args);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function syncScriptTemplateTypes(templateRoot = path.resolve(root, '../ea-script-template')) {
  if (!fs.existsSync(templateRoot)) return;
  const output = path.join(templateRoot, '.template/types');
  const { files: projectedFiles, external } = projectScriptApi(root);
  const declarations = new Map();
  function forkPath(specifier) {
    return specifier
      .replace(/^@zsviczian\/excalidraw\/types\/excalidraw$/, '@zsviczian/excalidraw')
      .replace(/^@zsviczian\/excalidraw\/types\/excalidraw\//, '@zsviczian/excalidraw/')
      .replace(/^@zsviczian\/excalidraw\/types\/(common|element|math|utils)\/src(?:\/index)?$/, '@zsviczian/excalidraw/$1/index')
      .replace(/^@zsviczian\/excalidraw\/types\/(common|element|math|utils)\/src\//, '@zsviczian/excalidraw/$1/')
      .replace(/^@excalidraw\/excalidraw\//, '@zsviczian/excalidraw/')
      .replace(/^@excalidraw\/(common|element|math|utils)$/, '@zsviczian/excalidraw/$1/index')
      .replace(/^@excalidraw\/(common|element|math|utils)\//, '@zsviczian/excalidraw/$1/');
  }
  for (const [name, source] of projectedFiles) {
    let content = source;
    for (const item of ts.preProcessFile(content).importedFiles.toReversed()) {
      content = content.slice(0, item.pos + 1) + forkPath(item.fileName) + content.slice(item.end + 1);
    }
    declarations.set(name, content);
  }
  const pluginPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const pkgPath = path.join(templateRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const forkPackage = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@zsviczian/excalidraw/package.json'), 'utf8'));
  const dependencies = { ...forkPackage.devDependencies, ...pluginPackage.dependencies, ...pluginPackage.devDependencies };
  external.add('@excalidraw/mermaid-to-excalidraw');
  // Retire dependencies added by the old implementation-graph snapshot.
  for (const name of ['react-dom', '@zsviczian/excalidraw-extras-api']) delete pkg.devDependencies[name];
  for (const name of external) {
    if (name === 'react') { pkg.devDependencies['@types/react'] = dependencies['@types/react']; continue; }
    if (name === 'polybooljs') continue; // Included ambient declaration, no runtime dependency.
    if (!dependencies[name]) throw new Error(`No declared version for type dependency ${name}`);
    // Use the template's supported Obsidian baseline; never downgrade it during generation.
    if (name === 'obsidian') continue;
    pkg.devDependencies[name] = dependencies[name];
  }
  fs.rmSync(output, { recursive: true, force: true });
  for (const [name, content] of declarations) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.copyFileSync(path.join(root, 'src/types/polybooljs.d.ts'), path.join(output, 'polybooljs.d.ts'));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(templateRoot, '.template/api-source.json'), JSON.stringify({
    repository: 'https://github.com/zsviczian/obsidian-excalidraw-plugin', revision,
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src', 'package.json', 'manifest.json'], { cwd: root, encoding: 'utf8' }).trim()),
    pluginVersion: manifest.version, excalidrawVersion: dependencies['@zsviczian/excalidraw'],
  }, null, 2) + '\n');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log(`[template-types] Synced ${declarations.size} declaration files from ${revision}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) syncScriptTemplateTypes(process.argv[2]);
