/** Exercise the actual protocol/dispatcher with only Obsidian boundaries replaced. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, createSourceFile, ScriptTarget, SyntaxKind } from 'typescript';

function harness({ supported = true, desktop = true, native = true } = {}) {
  const cache = new Map(), registrations = new Map(), versionChecks = []; let nextId = 0;
  class View {}
  class File { constructor(path) { this.path = path; this.extension = path.split('.').at(-1); this.stat = { size: 1 }; } }
  const files = [new File('a.excalidraw.md'), new File('Drawings/b.excalidraw.md')];
  const plugin = {
    manifest: { id: 'obsidian-excalidraw-plugin', version: 'test' }, isReady: true,
    app: { vault: { getName: () => 'Test', getFileByPath: path => files.find(file => file.path === path), getFiles: () => files,
      read: async file => file.content ?? '{}' }, workspace: { getLeavesOfType: () => [] } },
    isExcalidrawFile: file => file.path.endsWith('.excalidraw.md'), getCLIRuntime: () => ({ convertToExcalidrawElements() {} }),
    ...(native ? { registerCliHandler: (name, desc, flags, fn) => { assert.ok(desc); assert.ok(flags); registrations.set(name, fn); } } : {}),
  };
  const mocks = {
    obsidian: { Platform: { isDesktop: desktop }, TFile: File, requireApiVersion: version => { versionChecks.push(version); return supported; } },
    'src/core/main': {}, 'src/view/ExcalidrawView': { default: View }, 'src/shared/ExcalidrawData': { ExcalidrawData: class {} },
    'src/shared/TextMode': { getTextMode() {} }, 'src/constants/constants': { VIEW_TYPE_EXCALIDRAW: 'excalidraw', nanoid: () => String(++nextId).padStart(8, '0') },
    'src/lang/helpers': { t: key => key }, 'src/shared/Dialogs/SuggesterInfo': { EXCALIDRAW_AUTOMATE_INFO: [{ field: 'addText', code: 'addText(x,y,text)', desc: 'Add text' }, { field: 'addRect', code: 'addRect(x,y,width,height)', desc: null }] },
    'src/shared/EmbeddedFileLoader': {}, 'src/utils/excalidrawAutomateUtils': {}, 'src/utils/fileUtils': {},
    'src/utils/utils': {}, 'src/utils/excalidrawElementUtils': {}, 'src/utils/imageExportUtils': {},
  };
  function load(name, parent = resolve('.')) {
    if (mocks[name]) return mocks[name];
    const file = resolve(name.startsWith('src/') ? '.' : parent, name) + '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const compiled = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: 9 } }).outputText;
    new Function('require', 'exports', 'module', compiled)(specifier => load(specifier, resolve(file, '..')), module.exports, module);
    return module.exports;
  }
  const protocol = load('src/core/cli/cliProtocol');
  const { ExcalidrawCLI } = load('src/core/managers/ExcalidrawCLI');
  return { manager: new ExcalidrawCLI(plugin), protocol, elements: load('src/core/cli/cliElements'), apply: load('src/core/cli/cliApply'), exporting: load('src/core/cli/cliExport'), plugin, registrations, versionChecks, files, View };
}
const request = (command, values = {}) => ({ apiVersion: 1, command, ...values });

test('registration validates minimum API, optional method and desktop without bumping the baseline', () => {
  for (const options of [{ supported: false }, { native: false }, { desktop: false }]) {
    const h = harness(options); h.manager.initialize(); assert.equal(h.registrations.size, 0);
  }
  const h = harness(); h.manager.initialize(); assert.equal(h.registrations.size, 14);
  assert.deepEqual(h.versionChecks, ['1.12.2']);
});

test('plain JSON guards reject executable values, prototype keys, nonfinite values and excessive depth', () => {
  const { protocol: p } = harness();
  for (const value of [() => {}, NaN, new Date(), JSON.parse('{"__proto__":{}}'), { constructor: 'x' }, { value: undefined }]) assert.throws(() => p.jsonValue(value));
  let value = {}; for (let i = 0; i < 32; i++) value = { value };
  assert.throws(() => p.jsonValue(value));
  assert.deepEqual(p.jsonValue({ x: 0, empty: '', flag: false }), { x: 0, empty: '', flag: false });
  assert.throws(() => p.jsonValue('a'.repeat(200), 100));
});

test('vault paths preserve exact root, nested, spaces and Unicode while rejecting traversal and hidden config', () => {
  const { protocol: p } = harness();
  for (const path of ['Flow.excalidraw.md', 'Folder/Árvíz Flow.excalidraw.md']) assert.equal(p.vaultPath(path), path);
  for (const path of ['/a.md', '../a.md', 'a/../b.md', './a.md', 'a//b.md', 'a\\b.md', '.obsidian/a.json', 'a\u0000.md', 'C:/a.md']) assert.throws(() => p.vaultPath(path));
});

test('dispatcher returns stable failures for unknown fields, commands and versions', async () => {
  const { manager } = harness();
  assert.equal((await manager.execute(request('missing'))).error.code, 'UNSUPPORTED_COMMAND');
  assert.equal((await manager.execute({ apiVersion: 2, command: 'status' })).error.field, 'apiVersion');
  assert.equal((await manager.execute(request('status', { secret: true }))).error.field, 'secret');
  assert.equal((await manager.execute(request('read', { path: 'missing.md' }))).error.code, 'NOT_FOUND');
});

test('native file/inline JSON is exclusive and values must agree with flags', async () => {
  const h = harness(); h.manager.initialize(); const run = h.registrations.get('obsidian-excalidraw-plugin:read');
  assert.equal(JSON.parse(await run({ input: 'a.excalidraw.md', json: '{}' })).error.code, 'INVALID_INPUT');
  assert.equal(JSON.parse(await run({ json: JSON.stringify({ apiVersion: 1, path: 'a.excalidraw.md' }), path: 'Drawings/b.excalidraw.md' })).error.field, 'path');
  assert.equal(JSON.parse(await run({ path: 'a.excalidraw.md', selectedOnly: 'yes' })).error.field, 'selectedOnly');
  assert.equal(JSON.parse(await run({ json: '{broken' })).ok, false);
});

test('discovery remains available before readiness and never opens a drawing', async () => {
  const { manager, plugin } = harness(); plugin.isReady = false;
  for (const command of ['help', 'status', 'skill', 'api']) assert.equal((await manager.execute(request(command))).ok, true);
  assert.equal((await manager.execute(request('schema', { action: 'create' }))).data.example.apiVersion, 1);
  assert.equal((await manager.execute(request('list'))).error.code, 'NOT_READY');
});

test('portable skill stays aligned with native output and schema describes finite operations', async () => {
  const h = harness();
  assert.equal((await h.manager.execute(request('skill'))).data.markdown, readFileSync('docs/AITrainingData/excalidraw-cli/SKILL.md', 'utf8'));
  assert.equal((await h.manager.execute(request('api', { name: 'addRect' }))).data.entries[0].description, '');
  const schema = (await h.manager.execute(request('schema', { action: 'apply' }))).data.jsonSchema;
  assert.ok(schema.required.includes('expectedRevision'));
  assert.deepEqual(schema.$defs.operation.oneOf.map(option => option.properties.op.const), ['add', 'update', 'delete', 'connect', 'group', 'ungroup', 'image', 'latex']);
});

test('multiple views require explicit identity; disk ignores ambiguity and refuses view selection', async () => {
  const h = harness(); const a = Object.assign(new h.View(), { file: h.files[0], id: 'one' }), b = Object.assign(new h.View(), { file: h.files[0], id: 'two' });
  h.plugin.app.workspace.getLeavesOfType = () => [{ view: a }, { view: b }];
  assert.equal((await h.manager.execute(request('read', { path: a.file.path }))).error.code, 'AMBIGUOUS_TARGET');
  assert.equal((await h.manager.execute(request('read', { path: a.file.path, view: 'gone' }))).error.code, 'NOT_FOUND');
  assert.equal((await h.manager.execute(request('read', { path: a.file.path, source: 'disk', view: 'one' }))).error.field, 'view');
});

test('drawing list pagination rejects stale snapshots instead of mixing pages', async () => {
  const h = harness(), first = await h.manager.execute(request('list', { limit: 1 }));
  const revision = first.data.revision; assert.equal(first.data.nextOffset, 1);
  const second = await h.manager.execute(request('list', { offset: 1, limit: 1, revision })); assert.equal(second.ok, true);
  h.files.push({ path: 'c.excalidraw.md' });
  assert.equal((await h.manager.execute(request('list', { offset: 1, revision }))).error.code, 'STALE_REVISION');
  assert.equal((await h.manager.execute(request('list', { offset: 0.5 }))).error.code, 'INVALID_INPUT');
});

test('write receipts require IDs, replay identical requests and reject changed effective content', async () => {
  const { manager } = harness(); assert.equal((await manager.execute(request('create'))).error.field, 'requestId');
  const original = request('create', { requestId: 'test-1', path: 'new.excalidraw.md', elements: [] });
  const receipt = await manager.execute(original); assert.deepEqual(await manager.execute(original), receipt);
  assert.equal((await manager.execute({ ...original, path: 'other.excalidraw.md' })).error.field, 'requestId');
  assert.deepEqual(await manager.execute(request('result', { requestId: 'test-1' })), receipt);
  assert.equal((await manager.execute(request('result', { requestId: 'unknown' }))).error.code, 'OUTCOME_UNKNOWN');
});

test('unload rejects new requests and invalidates old session receipts', async () => {
  const { manager } = harness(); let active = 0;
  const release = manager.registerOperationCleanup(() => active++); release();
  manager.registerOperationCleanup(() => active++); manager.destroy();
  assert.equal(active, 1);
  assert.equal((await manager.execute(request('status'))).error.code, 'NOT_READY');
});

test('skeleton validation refuses persisted internals, dangling bindings and malformed frames before conversion', () => {
  const { elements: { validateBatch } } = harness();
  const box = { id: 'box', type: 'rectangle', x: 0, y: 0, width: 100, height: 80, opacity: 0 };
  assert.equal(validateBatch([box])[0].x, 0);
  for (const batch of [[{ ...box, version: 7 }], [box, box], [{ ...box, opacity: 101 }],
    [{ type: 'arrow', start: { id: 'absent' } }], [{ type: 'frame', children: ['absent'] }],
    [{ type: 'text', text: 'ok', fontSize: 0 }], [{ type: 'line', points: [[0, NaN], [20, 20]] }]]) assert.throws(() => validateBatch(batch));
  assert.equal(validateBatch([box, { type: 'arrow', start: { id: 'box' } }, { type: 'frame', children: ['box'] }]).length, 3);
});

test('operation validation and export allocation limits reject unsupported requests', () => {
  const { apply: { validateOperations }, exporting: { exportBounds } } = harness();
  for (const operations of [[], [{ op: 'replaceScene' }], [{ op: 'update', id: 'a', set: { version: 3 } }],
    [{ op: 'delete', ids: ['a'], children: 'surprise' }], [{ op: 'image', asset: '../image.png' }], [{ op: 'latex', text: 'x', scaleX: 0 }]]) assert.throws(() => validateOperations(operations));
  assert.equal(validateOperations([{ op: 'update', id: 'a', set: { x: 0, opacity: 0, text: '' } }]).length, 1);
  for (const dimensions of [[0, 100, 1], [10000, 10000, 1], [100, Infinity, 1], [17000, 1, 1]]) assert.throws(() => exportBounds(...dimensions));
  assert.doesNotThrow(() => exportBounds(1000, 1000, 4));
});

/** Load a production method intact; only its app boundary dependencies are supplied. */
function productionMethod(path, className, name, dependencies = {}) {
  const source = createSourceFile(path, readFileSync(path, 'utf8'), ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => node.kind === SyntaxKind.ClassDeclaration && node.name.text === className);
  const method = declaration.members.find(node => node.name?.getText(source) === name);
  assert.ok(method, `${className}.${name}`);
  const compiled = transpileModule(`export class Loaded { ${method.getText(source)} }`, { compilerOptions: { module: ModuleKind.CommonJS, target: 9 } }).outputText;
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies));
  return exports.Loaded.prototype[name];
}

test('delayed text preparation leaves concurrent metadata and the scene intact when publication is rejected', async () => {
  let resume;
  const waiting = new Promise(resolve => { resume = resolve; });
  const original = { id: 'label123', type: 'text', text: 'before', rawText: 'before' };
  const model = { textElements: new Map([['label123', { raw: 'before' }]]), parse: async () => { await waiting; return { parsed: 'prepared', link: null }; } };
  model.addTextElement = productionMethod('src/shared/ExcalidrawData.ts', 'ExcalidrawData', 'addTextElement');
  const view = { excalidrawData: model, textMode: 'raw', excalidrawAPI: { getSceneElements: () => [original] }, updateScene: () => assert.fail('stale edit published') };
  const addElements = productionMethod('src/view/ExcalidrawView.ts', 'ExcalidrawView', 'addElements', {
    CaptureUpdateAction: { IMMEDIATELY: 'capture' }, TextMode: { parsed: 'parsed' }, arrayToMap: values => new Map(values.map(value => [value.id, value])),
  });
  const pending = addElements.call(view, { newElements: [{ ...original, text: 'prepared', rawText: 'prepared' }], validateBeforePublish: () => { throw Error('STALE_REVISION'); } });
  model.textElements.set('label123', { raw: 'human edit' });
  resume(); await assert.rejects(pending, /STALE_REVISION/);
  assert.equal(model.textElements.get('label123').raw, 'human edit');
  assert.equal(original.text, 'before');
});

test('existing unguarded text callers retain completion-time metadata ownership', async () => {
  let resume;
  const waiting = new Promise(resolve => { resume = resolve; });
  const original = new Map(), replacement = new Map();
  const model = { textElements: original, parse: async () => { await waiting; return { parsed: 'display', link: null }; } };
  const addText = productionMethod('src/shared/ExcalidrawData.ts', 'ExcalidrawData', 'addTextElement');
  const pending = addText.call(model, 'text1234', 'source', 'source');
  model.textElements = replacement; resume(); await pending;
  assert.equal(original.size, 0); assert.equal(replacement.get('text1234').raw, 'source');
});

test('trusted script receipt identity includes source content and never interpolates args', async () => {
  const h = harness(); const file = { path: 'Scripts/test.md', extension: 'md', content: 'return utils.input;', stat: { size: 18 } }; h.files.push(file);
  h.plugin.settings = {}; let executions = 0;
  h.plugin.ea = { getAPI: () => ({ destroy() {} }) };
  h.plugin.scriptEngine = { executeScriptFileForCLI: async (f, view, ea, input, lib, source, check) => { check(); executions++; assert.equal(source, file.content); return input; } };
  const input = request('script', { requestId: 'script-1', script: file.path, trusted: true, args: { text: '${notExecuted}' } });
  const first = await h.manager.execute(input); assert.equal(first.ok, true); assert.deepEqual(first.data, input.args); assert.equal(first.persistence, 'unknown');
  assert.deepEqual(await h.manager.execute(input), first); assert.equal(executions, 1);
  file.content = 'return 2;'; assert.equal((await h.manager.execute(input)).error.field, 'requestId'); assert.equal(executions, 1);
  assert.equal((await h.manager.execute({ ...input, requestId: 'script-2', trusted: false })).error.code, 'TRUST_REQUIRED');
});

test('save outcome reports only an acknowledged captured revision through the existing queue policy', async () => {
  const save = productionMethod('src/view/managers/ViewSaveCoordinator.ts', 'ViewSaveCoordinator', 'saveWithOutcome', { DIRECT_SAVE_SIDE_EFFECT_POLICY: { triggerAutoexport: true } });
  for (const status of ['persisted', 'window-migration-persisted', 'failed', 'skipped', 'unchanged', 'persistence-handed-off', 'window-migration-handed-off']) {
    const coordinator = { currentRevision: 4, enqueueSave: async request => {
      assert.equal(request.bypassSameFileEditGuard, false); assert.equal(request.forcePersistence, true);
      return { status, preparedSave: { capturedRevision: 4 } };
    } };
    const result = await save.call(coordinator);
    assert.equal(result.requestedRevision, 4);
    assert.equal(result.acknowledgedRevision, ['persisted', 'window-migration-persisted'].includes(status) ? 4 : null);
  }
});

test('CLI scripts clean up their owned EA on success/failure while manual scripts retain their lifetime', async () => {
  let destroyed = 0;
  const ea = { destroy: () => destroyed++ }, engine = { eaInstances: [], viewAutostartEAs: new Set(),
    getCompiledScript: async () => async (ea, utils) => ({ input: utils.input, executionSource: utils.executionSource }) };
  engine.executeExecutable = productionMethod('src/shared/Scripts.ts', 'ScriptEngine', 'executeExecutable', { getEA: () => ea });
  const cli = productionMethod('src/shared/Scripts.ts', 'ScriptEngine', 'executeScriptFileForCLI');
  const result = await cli.call(engine, { basename: 'test' }, undefined, ea, { x: 0 }, {}, 'source', () => {});
  assert.deepEqual(result, { input: { x: 0 }, executionSource: 'cli' }); assert.equal(destroyed, 1);
  engine.getCompiledScript = async () => async (ea, utils) => { await utils.inputPrompt('fail'); };
  await assert.rejects(cli.call(engine, { basename: 'test' }, undefined, ea, null, {}, 'source', () => {}), /INTERACTION_REQUIRED/);
  assert.equal(destroyed, 2);
  await engine.executeExecutable(undefined, async () => 'manual', 'test', {}, 'manual');
  assert.equal(destroyed, 2); assert.equal(engine.eaInstances.length, 1);
});

test('CLI compilation checks exact source even when file stat matches a cached manual script', async () => {
  const getCompiled = productionMethod('src/shared/Scripts.ts', 'ScriptEngine', 'getCompiledScript');
  const file = { path: 'Script.md', stat: { mtime: 1, size: 10 }, content: 'old source' };
  const engine = { compiledScripts: new Map(), app: { vault: { read: async () => file.content } }, compileScript: source => async () => source };
  assert.equal(await (await getCompiled.call(engine, file))(), 'old source');
  file.content = 'new source'; assert.equal(await (await getCompiled.call(engine, file, 'new source'))(), 'new source');
  await assert.rejects(getCompiled.call(engine, file, 'different'), /source changed/);
});
