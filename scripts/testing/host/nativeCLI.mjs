/** Native authoring round-trip on fixtures owned by the guarded parent runner. */
import assert from 'node:assert/strict';

export async function runNativeCLIScenario({ cli, drawingPath }) {
  const prefix = drawingPath.replace(/\.(?:excalidraw\.md|excalidraw|md)$/, '') + '_native_cli';
  assert.ok(prefix.split('/').at(-1).startsWith('__excalidraw_cli_smoke_'));
  const idPrefix = prefix.split('/').at(-1).slice(-40);
  const paths = { drawing: `${prefix}.excalidraw.md`, request: `${prefix}.json`, png: `${prefix}.png`, svg: `${prefix}.svg`, disk: `${prefix}_disk.png`,
    script: `${prefix}_script.md`, template: `${prefix}_template.excalidraw.md`, invalid: `${prefix}_invalid.excalidraw.md` };
  const evaluate = code => JSON.parse(cli('eval', `code=${code}`).trim().replace(/^=>\s*/, ''));
  const action = (command, request = {}) => JSON.parse(cli(`obsidian-excalidraw-plugin:${command}`, `json=${JSON.stringify({ apiVersion: 1, ...request })}`));
  const ok = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result; };
  const write = (path, text) => evaluate(`(async()=>{const path=${JSON.stringify(path)},file=app.vault.getFileByPath(path);if(file)await app.vault.modify(file,${JSON.stringify(text)});else await app.vault.create(path,${JSON.stringify(text)});return JSON.stringify({written:true})})()`);
  const viewCode = `app.workspace.getLeavesOfType('excalidraw').find(leaf=>leaf.view.file?.path===${JSON.stringify(paths.drawing)})?.view`;
  const control = '__excalidrawNativeCLIRegression';
  let cleanup = false;
  const artifacts = [];
  try {
    for (const command of ['help', 'status', 'skill', 'list']) ok(action(command));
    assert.equal(ok(action('schema', { action: 'apply' })).data.command, 'apply');
    assert.equal(ok(action('api', { name: 'executeCLI' })).data.entries[0].name, 'executeCLI');
    const create = { apiVersion: 1, requestId: `${idPrefix}-create`, path: paths.drawing, elements: [
      { id: 'a', type: 'rectangle', x: 0, y: 0, width: 180, height: 80, label: { text: 'Start' } },
      { id: 'b', type: 'rectangle', x: 280, y: 0, width: 180, height: 80, label: { text: '[[Link]]' } },
      { id: 'arrow', type: 'arrow', x: 180, y: 40, start: { id: 'a' }, end: { id: 'b' } },
      { id: 'frame', type: 'frame', children: ['a', 'b', 'arrow'], name: 'Native CLI' },
    ] };
    write(paths.request, JSON.stringify(create));
    const created = ok(JSON.parse(cli('obsidian-excalidraw-plugin:create', `input=${paths.request}`)));
    assert.equal(created.persistence, 'saved'); assert.equal(created.data.createdIds.length, 6);
    assert.ok(created.data.createdIds.every(id => id.length === 8));
    assert.deepEqual(action('create', create), created);
    assert.equal(action('create', { ...create, requestId: `${idPrefix}-collision` }).error.code, 'ALREADY_EXISTS');
    const invalid = action('create', { requestId: `${idPrefix}-invalid`, path: paths.invalid, elements: [{ type: 'arrow', start: { id: 'missing' } }] });
    assert.equal(invalid.mutation, 'not-applied');
    assert.equal(evaluate(`JSON.stringify({exists:!!app.vault.getFileByPath(${JSON.stringify(paths.invalid)})})`).exists, false);
    const templateSource = evaluate(`(async()=>{const file=app.vault.getFileByPath(${JSON.stringify(paths.drawing)});const text=await app.vault.read(file);await app.vault.modify(file,text.replace('# Excalidraw Data',${JSON.stringify('## Hybrid note\n\nTemplate prose survives.\n\n# Excalidraw Data')}));return JSON.stringify({ready:true})})()`); assert.equal(templateSource.ready, true);
    ok(action('create', { requestId: `${idPrefix}-template`, path: paths.template, template: paths.drawing, elements: [{ id: 'new', type: 'text', text: 'Template addition', x: 0, y: 150 }] }));
    assert.equal(evaluate(`(async()=>{const text=await app.vault.read(app.vault.getFileByPath(${JSON.stringify(paths.template)}));return JSON.stringify({preserved:text.includes('Template prose survives.')&&text.includes('Template addition')})})()`).preserved, true);
    ok(action('open', { path: paths.drawing }));
    const read = () => ok(action('read', { path: paths.drawing, source: 'live', detail: 'elements' })).data;
    let live = read(); const label = live.elements.find(element => element.type === 'text' && element.text === 'Start');
    const update = { requestId: `${idPrefix}-update`, path: paths.drawing, expectedRevision: live.revision, operations: [{ op: 'update', id: label.id, set: { text: 'Edited via native CLI', strokeColor: '#1971c2' } }] };
    const applied = ok(action('apply', update)); assert.equal(applied.persistence, 'saved');
    assert.deepEqual(action('apply', update), applied);
    assert.equal(action('apply', { ...update, requestId: `${idPrefix}-stale` }).error.code, 'STALE_REVISION');
    assert.equal(ok(action('read', { path: paths.drawing, source: 'disk', detail: 'elements' })).data.elements.find(element => element.id === label.id).rawText, 'Edited via native CLI');
    // Actual delayed text path, competing CLI write, and a newer human scene.
    live = read();
    evaluate(`(()=>{const v=${viewCode},p=app.plugins.plugins['obsidian-excalidraw-plugin'];if(globalThis.${control})throw Error('test controller exists');const c={view:v,model:v.excalidrawData,original:v.excalidrawData.addTextElement,state:'waiting'};globalThis.${control}=c;c.gate=new Promise(resolve=>c.release=resolve);c.model.addTextElement=async function(...args){await c.gate;return c.original.apply(this,args)};p.executeCLI(${JSON.stringify({ apiVersion: 1, command: 'apply', requestId: `${idPrefix}-delayed`, path: paths.drawing, expectedRevision: live.revision, operations: [{ op: 'update', id: label.id, set: { text: 'Must not publish' } }] })}).then(result=>{c.result=result;c.state='finished'});return JSON.stringify({started:true})})()`);
    assert.equal(action('apply', { ...update, requestId: `${idPrefix}-competing`, expectedRevision: live.revision }).error.code, 'BUSY');
    evaluate(`(()=>{const c=globalThis.${control},v=c.view,a=v.excalidrawAPI;const elements=structuredClone(a.getSceneElements());elements.find(e=>e.type==='rectangle').x+=1;v.updateScene({elements,captureUpdate:'IMMEDIATELY'});c.model.addTextElement=c.original;c.release();return JSON.stringify({released:true})})()`);
    let delayed;
    for (let i = 0; i < 100; i++) {
      delayed = action('result', { requestId: `${idPrefix}-delayed` }); if (delayed.status !== 'pending') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(delayed.error.code, 'STALE_REVISION'); assert.equal(delayed.mutation, 'not-applied');
    assert.equal(read().elements.find(element => element.id === label.id).rawText, 'Edited via native CLI');
    evaluate(`(()=>{delete globalThis.${control};return JSON.stringify({clean:true})})()`);
    // Published edits survive a failed save receipt; no false durability claim.
    evaluate(`(()=>{const v=${viewCode};globalThis.${control}={view:v,originalSave:v.saveWithOutcome};v.saveWithOutcome=async()=>({status:'failed',requestedRevision:1,acknowledgedRevision:null,currentRevision:1});return JSON.stringify({ready:true})})()`);
    const failed = action('apply', { ...update, requestId: `${idPrefix}-failed-save`, expectedRevision: read().revision, operations: [{ op: 'update', id: label.id, set: { text: 'Recoverable edit' } }] });
    assert.equal(failed.mutation, 'applied'); assert.equal(failed.persistence, 'unsaved');
    assert.equal(read().elements.find(element => element.id === label.id).rawText, 'Recoverable edit');
    evaluate(`(async()=>{const c=globalThis.${control};c.view.saveWithOutcome=c.originalSave;delete globalThis.${control};const saved=await c.view.saveWithOutcome();return JSON.stringify({status:saved.status})})()`);
    const relationships = ok(action('apply', { requestId: `${idPrefix}-relations`, path: paths.drawing, expectedRevision: read().revision, operations: [
      { op: 'add', elements: [{ id: 'new-node', type: 'rectangle', x: 540, y: 0, width: 180, height: 80, label: { text: 'Temporary' } }] },
      { op: 'connect', id: 'new-arrow', from: created.data.idMap.b, to: 'new-node', fromSide: 'right', toSide: 'left' },
      { op: 'group', ids: [created.data.idMap.b, 'new-node'] },
    ] }));
    assert.ok(relationships.data.idMap['new-node'] && relationships.data.idMap['new-arrow']);
    const cleanupRelations = ok(action('apply', { requestId: `${idPrefix}-ungroup`, path: paths.drawing, expectedRevision: read().revision, operations: [
      { op: 'ungroup', ids: [created.data.idMap.b, relationships.data.idMap['new-node']], groupId: relationships.data.groupIds[0] },
      { op: 'delete', ids: [relationships.data.idMap['new-node'], relationships.data.idMap['new-arrow']] },
    ] })); assert.equal(cleanupRelations.persistence, 'saved');
    const refusedFrame = action('apply', { requestId: `${idPrefix}-frame-guard`, path: paths.drawing, expectedRevision: read().revision, operations: [{ op: 'delete', ids: [created.data.idMap.frame] }] });
    assert.equal(refusedFrame.error.field, 'children'); assert.equal(refusedFrame.mutation, 'not-applied');
    for (const [format, source, out] of [['svg', 'live', paths.svg], ['png', 'live', paths.png], ['png', 'disk', paths.disk]]) {
      const result = ok(action('export', { requestId: `${idPrefix}-${source}-${format}`, path: paths.drawing, source, out, theme: 'light' }));
      assert.equal(result.persistence, 'saved'); assert.ok(result.data.width > 0 && result.data.height > 0 && result.data.bytes > 100);
      artifacts.push(result.data);
    }
    assert.equal(action('export', { requestId: `${idPrefix}-no-overwrite`, path: paths.drawing, out: paths.png }).error.code, 'ALREADY_EXISTS');
    live = read();
    const image = ok(action('apply', { requestId: `${idPrefix}-image`, path: paths.drawing, expectedRevision: live.revision, operations: [{ op: 'image', id: 'preview', asset: paths.png, x: 0, y: 200 }] })); assert.ok(image.data.idMap.preview);
    assert.equal(ok(action('read', { path: paths.drawing, source: 'disk' })).data.types.image, 1);
    write(paths.script, 'return {input:utils.input,source:utils.executionSource,converter:typeof utils.excalidrawLib.convertToExcalidrawElements};');
    const scriptRequest = { requestId: `${idPrefix}-script`, script: paths.script, trusted: true, args: { x: 0, text: '${literal}' } };
    const script = ok(action('script', scriptRequest)); assert.equal(script.persistence, 'unknown'); assert.deepEqual(script.data.input, scriptRequest.args); assert.equal(script.data.source, 'cli');
    assert.deepEqual(action('script', scriptRequest), script);
    write(paths.script, 'await utils.inputPrompt("must fail");');
    assert.equal(action('script', scriptRequest).error.field, 'requestId');
    assert.equal(action('script', { ...scriptRequest, requestId: `${idPrefix}-prompt` }).error.code, 'INTERACTION_REQUIRED');
    const close = evaluate(`(async()=>{for(const leaf of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===${JSON.stringify(paths.drawing)})){await leaf.setViewState({type:'empty',state:{}});leaf.detach()}return JSON.stringify({closed:true})})()`); assert.equal(close.closed, true);
    ok(action('open', { path: paths.drawing }));
    assert.equal(read().elements.find(element => element.id === label.id).rawText, 'Recoverable edit');
  } finally {
    const result = evaluate(`(async()=>{const c=globalThis.${control};if(c){if(c.original)c.model.addTextElement=c.original;if(c.originalSave)c.view.saveWithOutcome=c.originalSave;c.release?.();delete globalThis.${control}}const paths=${JSON.stringify(Object.values(paths))};for(const path of paths){if(!path.startsWith(${JSON.stringify(prefix)}))throw Error('unsafe fixture cleanup');for(const leaf of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===path)){await leaf.setViewState({type:'empty',state:{}});leaf.detach()}const file=app.vault.getFileByPath(path);if(file)await app.vault.delete(file)}return JSON.stringify({clean:true})})()`);
    cleanup = result.clean;
  }
  assert.equal(cleanup, true);
  return { id: 'native-cli-authoring', status: 'passed', assertions: ['native discovery/file input', 'stable labels, bindings and frames', 'template prose', 'collision and invalid-batch refusal', 'guarded text save/read-back', 'idempotent receipts', 'competing write BUSY', 'stale async text leaves metadata intact', 'failed save preserves recoverable edit', 'add/connect/group/ungroup/delete and frame child guard', 'live/disk SVG/PNG', 'vault image metadata round-trip', 'trusted script context/source identity/prompt refusal', 'save/reopen', 'owned fixture cleanup'], artifacts };
}
