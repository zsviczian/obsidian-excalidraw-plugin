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
    'src/shared/lucideIcons': { getLucideIcons: query => ['lucide-database', 'lucide-dot', 'lucide-zap'].filter(icon => icon.includes(query.toLowerCase())).map(icon => ({ icon, name: icon.slice(7) })) },
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
  return { manager: new ExcalidrawCLI(plugin), protocol, icons: load('src/core/cli/cliIcons'), elements: load('src/core/cli/cliElements'), apply: load('src/core/cli/cliApply'), exporting: load('src/core/cli/cliExport'), images: load('src/core/cli/cliImages'), dimensions: load('src/core/cli/cliImageDimensions'), dependencies: load('src/core/cli/cliDependencies'), customData: load('src/utils/elementCustomDataUtils'), plugin, registrations, versionChecks, files, View, mocks };
}
const request = (command, values = {}) => ({ apiVersion: 1, command, ...values });

test('registration validates minimum API, optional method and desktop without bumping the baseline', () => {
  for (const options of [{ supported: false }, { native: false }, { desktop: false }]) {
    const h = harness(options); h.manager.initialize(); assert.equal(h.registrations.size, 0);
  }
  const h = harness(); h.manager.initialize(); assert.equal(h.registrations.size, 15);
  assert.deepEqual(h.versionChecks, ['1.12.2']);
});

test('icon discovery is read-only, bounded and snapshot-paginated', async () => {
  const h=harness();
  const first=await h.manager.execute(request('icons',{limit:1}));
  assert.equal(first.ok,true); assert.equal(first.mutation,'not-applied');
  assert.equal(first.data.total,3); assert.equal(first.data.nextOffset,1);
  const second=await h.manager.execute(request('icons',{limit:1,offset:1,revision:first.data.revision}));
  assert.equal(second.data.icons[0].icon,'lucide-dot');
  assert.equal((await h.manager.execute(request('icons',{limit:201}))).error.code,'INVALID_INPUT');
  assert.equal((await h.manager.execute(request('icons',{query:'database',offset:1,revision:first.data.revision}))).error.code,'STALE_REVISION');
  assert.equal((await h.manager.execute(request('schema',{action:'create'}))).data.jsonSchema.properties.icons.maxItems,100);
});

test('icon staging retains single-element aliases and validates aggregate expanded geometry',()=>{
  const h=harness(), {stageCLIIcon,checkIconBudget}=h.icons;
  const elements=[]; let sequence=0;
  const ea={ getElements:()=>elements,addLucideIcon: options=>{
    assert.equal(options.roughness,1); assert.equal(options.strokeColor,'#1e1e1e');
    const id=`member-${++sequence}`;elements.push({id,type:'line',points:[[0,0],[2,2]]});
    return {icon:'lucide-database',groupId:`group-${sequence}`,elementIds:[id],warnings:[],viewport:{x:0,y:0,width:96,height:96}};
  }};
  const idMap={shape:'actual-shape'},groupMap={};
  const result=stageCLIIcon(ea,{id:'db',icon:'database'},idMap,groupMap);
  assert.equal(groupMap.db,result); assert.deepEqual(idMap,{shape:'actual-shape'});
  for(const id of ['db','shape','__proto__','constructor','prototype'])assert.throws(()=>stageCLIIcon(ea,{id,icon:'database'},idMap,groupMap));
  assert.throws(()=>stageCLIIcon(ea,{id:'actual-shape',icon:'database'},idMap,groupMap,['actual-shape']));
  assert.equal(sequence,1);
  assert.throws(()=>checkIconBudget(Array.from({length:5001},()=>({type:'rectangle'}))));
  assert.throws(()=>checkIconBudget([{type:'line',points:Array(100001).fill([0,0])}]));
  assert.throws(()=>h.apply.validateOperations([{op:'lucide',icon:'database'}]));
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
  assert.deepEqual(schema.$defs.operation.oneOf.map(option => option.properties.op.const), ['lucide', 'add', 'update', 'delete', 'connect', 'group', 'ungroup', 'image', 'imageMetadata', 'latex']);
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

test('segmented live revisions retain immutable payloads and catch last-byte or descriptor changes', () => {
  const h = harness();
  const dataURL = 'data:image/png;base64,' + 'a'.repeat(2 * 1024 * 1024);
  const file = { id: 'asset', mimeType: 'image/png', dataURL, created: 1 };
  const element = { id: 'img', type: 'image', fileId: 'asset', version: 1, isDeleted: false };
  const embedded = { img: dataURL, imgInverted: dataURL, mtime: 2 };
  const model = { textElements: new Map(), markdownImages: new Map(), equations: new Map(), mermaids: new Map(),
    exportPreparedSaveData: () => ({ files: new Map([['asset', embedded]]) }) };
  const files = { asset: file };
  const view = new h.View();
  Object.assign(view, { id: 'view-1', file: h.files[0], excalidrawData: model,
    excalidrawAPI: { getSceneElementsIncludingDeleted: () => [element], getFiles: () => files },
    getScene: () => ({ appState: { theme: 'light' } }), data: 'markdown', textMode: 'raw', plugin: { settings: { use: true } },
    isLoaded: true, isClosingOrMigrating: () => false });
  const targets = h.manager.targets;
  const original = targets.revision(view);
  assert.equal(targets.revision(view), original);
  file.dataURL = dataURL.slice(0, -1) + 'b';
  const replaced = targets.revision(view);
  assert.notEqual(replaced, original);
  assert.equal(targets.revision(view), replaced);
  embedded.imgInverted = dataURL.slice(0, -1) + 'c';
  assert.notEqual(targets.revision(view), replaced);
  const beforeSettings = targets.revision(view);
  view.plugin.settings.use = false;
  assert.notEqual(targets.revision(view), beforeSettings);
  const beforeApi = targets.revision(view);
  view.excalidrawAPI = { ...view.excalidrawAPI };
  assert.notEqual(targets.revision(view), beforeApi);
  h.manager.destroy();
});

test('CLI image inventory and policy avoid data URLs, separate shared-symbol representations and reject malformed rules', async () => {
  const h = harness();
  const { parseImagePolicy, decideImage, imageInventory, prepareImagePreview } = h.images;
  const file = { id: 'shared', dataURL: 'data:image/png;base64,QUJDRA==', mimeType: 'image/png', created: 0 };
  const original = { id: 'original', type: 'image', fileId: 'shared', status: 'saved', x: 10, y: 12, width: 200, height: 100, angle: 0.5, opacity: 80, scale: [-1, 1], crop: null, customData: { excalidrawCLI: { version: 1, tags: ['context'] } } };
  const copy = { ...original, id: 'placeholder', customData: { excalidrawCLI: { version: 1, label: '<& 安全>' } } };
  const policy = parseImagePolicy({ default: 'placeholder', rules: [{ ids: ['original'], mode: 'original' }], thumbnailMaxDimension: 512 });
  const a = decideImage(original, file, policy), b = decideImage(copy, file, policy);
  assert.equal(a.mode, 'original'); assert.equal(b.mode, 'placeholder');
  assert.equal(imageInventory(original, file).loadedRenditionBytes, 4);
  assert.equal(imageInventory(original, file).tags[0], 'context');
  assert.equal(imageInventory({ ...original, status: undefined }, file).status, null);
  const preview = await prepareImagePreview([original, copy], { shared: file }, policy, new Map([[a.elementId, a], [b.elementId, b]]));
  assert.equal(preview.elements[0].fileId, 'shared');
  assert.notEqual(preview.elements[1].fileId, 'shared');
  assert.equal(preview.elements[1].crop, null);
  assert.equal(preview.elements[1].x, copy.x); assert.equal(preview.elements[1].angle, copy.angle);
  assert.deepEqual(preview.elements[1].scale, copy.scale);
  const previewPayload = preview.files[preview.elements[1].fileId].dataURL;
  const xml = atob(previewPayload.split(',')[1]);
  assert.match(xml, /&#60;&#38;/); assert.doesNotMatch(xml, /<script/);
  assert.equal(file.dataURL, 'data:image/png;base64,QUJDRA==');
  assert.throws(() => parseImagePolicy({ default: 'auto' }));
  assert.throws(() => parseImagePolicy({ rules: [{ mode: 'original' }] }));
  assert.throws(() => parseImagePolicy({ rules: Array(33).fill({ ids: ['x'], mode: 'original' }) }));
});

test('schema distinguishes insertion boolean scale from export number scale and validates metadata fields', async () => {
  const h = harness();
  const result = await h.manager.execute(request('schema', { action: 'apply' }));
  const operations = result.data.jsonSchema.$defs.operation.oneOf;
  assert.equal(operations.find(op => op.properties.op.const === 'image').properties.scale.type, 'boolean');
  assert.equal(operations.find(op => op.properties.op.const === 'imageMetadata').properties.tags.anyOf[1].maxItems, 12);
  assert.deepEqual(operations.find(op => op.properties.op.const === 'imageMetadata').anyOf, [{ required: ['label'] }, { required: ['tags'] }]);
  assert.equal((await h.manager.execute(request('schema', { action: 'create' }))).data.jsonSchema.$defs.skeleton.properties.label.type, 'object');
  assert.equal((await h.manager.execute(request('schema', { action: 'export' }))).data.jsonSchema.properties.scale.type, 'number');
  assert.doesNotThrow(() => h.apply.validateOperations([{ op: 'image', asset: 'images/a.png', scale: true }]));
  assert.throws(() => h.apply.validateOperations([{ op: 'image', asset: 'images/a.png', scale: 1 }]));
  assert.throws(() => h.apply.validateOperations([{ op: 'imageMetadata', id: 'img', tags: ['x', 'x'] }]));
});

test('BUSY before lock retries the same canonical ID while pending/failed and mismatched writes never repeat', async () => {
  const h = harness(); let calls = 0;
  h.manager.writes.execute = async () => {
    calls++;
    if (calls === 1) throw new h.protocol.CLIError('BUSY', 'pre-execution refusal', 'path', 'Retry identical request.', {}, true);
    return { mutation: 'applied', persistence: 'saved', data: { calls } };
  };
  const input = request('create', { requestId: 'busy1', path: 'new.excalidraw.md', elements: [] });
  const first = await h.manager.execute(input); assert.equal(first.error.code, 'BUSY');
  assert.equal((await h.manager.execute({ ...input, path: 'different.excalidraw.md' })).error.field, 'requestId');
  const second = await h.manager.execute(input); assert.equal(second.ok, true);
  assert.equal(second.data.calls, 2);
  assert.deepEqual(await h.manager.execute(input), second); assert.equal(calls, 2);
  h.manager.writes.execute = async () => { throw Error('private: image data; TOKEN-123'); };
  const err = await h.manager.execute(request('create', { requestId: 'boom1', path: 'new.excalidraw.md', elements: [] }));
  assert.equal(err.error.code, 'INTERNAL_ERROR'); assert.equal(err.mutation, 'unknown');
  assert.equal(err.persistence, 'unknown'); assert.doesNotMatch(JSON.stringify(err), /TOKEN-123/);
});

test('summary, image inventory and paged elements avoid cloning original file payloads', async () => {
  const h = harness(); const bigURL = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
  const element = { id: 'img12345', fileId: 'large', type: 'image', status: 'saved', isDeleted: false,
    x: 0, y: 0, width: 100, height: 80, angle: 0, opacity: 100, scale: [1, 1], crop: null, customData: {} };
  const files = { large: { id: 'large', dataURL: bigURL, mimeType: 'image/png', created: 0 } };
  const view = Object.assign(new h.View(), { id: 'view-1', file: h.files[0], isLoaded: true, isClosingOrMigrating: () => false,
    isDirty: () => false, textMode: 'raw', data: '', plugin: { settings: {} },
    excalidrawAPI: { getSceneElementsIncludingDeleted: () => [element], getFiles: () => files, getAppState: () => ({ selectedElementIds: {} }) },
    excalidrawData: { textElements: new Map(), markdownImages: new Map(), equations: new Map(), mermaids: new Map(), getFileEntries: () => [],
      exportPreparedSaveData: () => ({ files: new Map([['large', { img: bigURL, imgInverted: bigURL }]]) }) },
    getScene: () => ({ elements: [element], files, appState: {} }) });
  h.plugin.app.workspace.getLeavesOfType = () => [{ view }];
  const originalClone = globalThis.structuredClone;
  globalThis.structuredClone = input => {
    if (input && (input.files || input.elements)) assert.fail('Unexpected full-scene clone');
    return originalClone(input);
  };
  try {
    const summary = await h.manager.execute(request('read', { path: view.file.path, source: 'live' }));
    assert.equal(summary.ok, true); assert.equal(summary.data.total, 1);
    const images = await h.manager.execute(request('read', { path: view.file.path, source: 'live', detail: 'images' }));
    assert.equal(images.ok, true); assert.equal(images.data.images[0].loadedRenditionBytes, 6 * 1024 * 1024);
    assert.equal(JSON.stringify(images).includes(bigURL), false);
    const page = await h.manager.execute(request('read', { path: view.file.path, source: 'live', detail: 'elements' }));
    assert.equal(page.ok, true); assert.equal(page.data.elements[0].id, element.id);
    assert.equal(page.data.revision, summary.data.revision);
  } finally { globalThis.structuredClone = originalClone; }
});

test('derived PNG dimensions honor requested caps and existing hard limits', () => {
  const { exporting: { previewScale, exportBounds } } = harness();
  assert.equal(previewScale(4000, 2000, 1, 1000, 1000, 2000000), 0.25);
  assert.ok(previewScale(20000, 20000, 1, 100, 100, 10000) < 0.1);
  assert.throws(() => previewScale(500, 500, 1, undefined, undefined, 0));
  assert.throws(() => exportBounds(100000, 100000, 1));
});

test('disk dependencies detect same-stat replacements, restoration, deletion and unload, and release listeners', async () => {
  const { dependencies: { CLIDiskDependencies } } = harness();
  const file = { path: 'image.png', stat: { size: 4, mtime: 1 } };
  let bytes = Uint8Array.of(1, 2, 3, 4), current = true;
  const listeners = new Map();
  const vault = { getFileByPath: () => file, readBinary: async () => bytes.slice().buffer,
    on: (event, fn) => { listeners.set(event, fn); return event; }, offref: event => listeners.delete(event) };
  const guard = new CLIDiskDependencies(vault, () => current);
  await guard.observe(file); await guard.validate();
  bytes[3] = 5;
  await assert.rejects(guard.validate(), error => error.code === 'STALE_REVISION');
  bytes[3] = 4;
  await guard.validate();
  listeners.get('modify')(file);
  await assert.rejects(guard.validate(), error => error.code === 'STALE_REVISION');
  guard.destroy(); guard.destroy(); assert.equal(listeners.size, 0);
  const second = new CLIDiskDependencies(vault, () => current);
  current = false;
  await assert.rejects(second.observe(file), error => error.code === 'NOT_READY');
  second.destroy(); assert.equal(listeners.size, 0);
});

test('thumbnail preflight rejects huge and unknown raster dimensions before creating or decoding an image', async () => {
  const { dimensions: { thumbnailDimensions }, images } = harness();
  const png = (width, height) => {
    const bytes = Buffer.alloc(24);
    Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(bytes);
    bytes.write('IHDR', 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
    return 'data:image/png;base64,' + bytes.toString('base64');
  };
  assert.deepEqual(thumbnailDimensions(png(400, 200)), { width: 400, height: 200 });
  for (const url of [png(100000, 100000), png(0, 1), 'data:image/svg+xml;base64,' + btoa('<svg/>')]) {
    assert.throws(() => thumbnailDimensions(url), error => error.code === 'ASSETS_UNAVAILABLE');
  }
  const element = { type: 'image', id: 'large', fileId: 'file', width: 100, height: 100 };
  const file = { id: 'file', dataURL: png(100000, 100000), mimeType: 'image/png' };
  const policy = images.parseImagePolicy({ default: 'thumbnail' });
  await assert.rejects(images.prepareImagePreview([element], { file }, policy, new Map()), error => error.code === 'ASSETS_UNAVAILABLE');
});

test('real export preparation omits replaced payloads and refuses concurrent live edits and omitted attachment collisions', async () => {
  const h = harness(); let rendered, writes = 0, changeDuringRender = false;
  const element = { type: 'image', id: 'image001', fileId: 'file001', x: 0, y: 0, width: 80, height: 40, angle: 0, isDeleted: false };
  const files = { file001: { id: 'file001', mimeType: 'image/png', dataURL: 'data:image/png;base64,QUJDRA==', created: 1 } };
  const model = { textElements: new Map(), markdownImages: new Map(), equations: new Map(), mermaids: new Map(), exportPreparedSaveData: () => ({ files: [] }), getFileEntries: () => [['file001', { file: { path: 'attachment.svg' } }]] };
  const view = Object.assign(new h.View(), { id: 'view001', file: h.files[0], isLoaded: true, isClosingOrMigrating: () => false,
    textMode: 'raw', data: '', plugin: { settings: {} }, excalidrawData: model,
    excalidrawAPI: { getSceneElementsIncludingDeleted: () => [element], getFiles: () => files },
    getScene: () => ({ elements: [element], files, appState: {} }), getViewExportTheme: () => 'light' });
  h.plugin.app.workspace.getLeavesOfType = () => [{ view }];
  h.plugin.getCLIRuntime = () => ({ getCommonBounds: () => [0, 0, 80, 40] });
  h.plugin.app.vault.getAbstractFileByPath = () => null;
  h.plugin.app.vault.createBinary = async () => { writes++; };
  h.mocks['src/utils/fileUtils'].checkAndCreateFolder = async () => {};
  h.mocks['src/utils/utils'].getSVG = async scene => {
    rendered = scene;
    if (changeDuringRender) element.x++;
    return { getAttribute: key => key === 'width' ? '100' : '60', setAttribute() {}, outerHTML: '<svg width="100" height="60"/>' };
  };
  const request = { path: view.file.path, source: 'live', out: 'preview.svg', imagePolicy: { default: 'placeholder' } };
  const result = await h.exporting.exportDrawing(h.manager, request, request.out);
  assert.equal(writes, 1); assert.equal(result.data.imageSummary.placeholder, 1);
  assert.equal(Object.values(rendered.files).some(file => file.dataURL === files.file001.dataURL), false);
  assert.notEqual(rendered.elements[0].fileId, element.fileId);
  assert.equal(element.fileId, 'file001');
  changeDuringRender = true;
  await assert.rejects(h.exporting.exportDrawing(h.manager, request, request.out), error => error.code === 'STALE_REVISION');
  assert.equal(writes, 1);
  await assert.rejects(h.exporting.exportDrawing(h.manager, { ...request, out: 'attachment.svg' }, 'attachment.svg'), error => error.code === 'INVALID_INPUT');
  assert.equal(writes, 1);
});


test('image metadata edits preserve namespace extensions and refuse forward versions', () => {
  const { customData: { cliImageMetadataPatch } } = harness();
  const element = { type: 'image', customData: { other: { preserved: true }, excalidrawCLI: { version: 1, label: 'Before', tags: ['detail'], future: { preserved: true } } } };
  const patched = cliImageMetadataPatch(element, null, undefined);
  assert.equal(patched.excalidrawCLI.label, undefined);
  assert.deepEqual(patched.excalidrawCLI.tags, ['detail']);
  assert.deepEqual(patched.excalidrawCLI.future, { preserved: true });
  assert.deepEqual(patched.other, element.customData.other);
  assert.equal(element.customData.excalidrawCLI.label, 'Before');
  assert.throws(() => cliImageMetadataPatch({ ...element, customData: { excalidrawCLI: { version: 2 } } }, 'New', undefined), /Unsupported/);
});
