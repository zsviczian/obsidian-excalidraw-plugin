/** Native #3004 image policies, real renderer geometry and request-owned race fixtures. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCLILargeIdentity } from './cliLargeIdentity.mjs';

export async function runCLIImagePreviewScenario({ cli, drawingPath, reportDir }) {
  const prefix = drawingPath.replace(/\.(?:excalidraw\.md|excalidraw|md)$/, '') + '_images';
  assert.ok(prefix.split('/').at(-1).startsWith('__excalidraw_cli_smoke_'));
  const paths = { drawing: `${prefix}.excalidraw.md`, raster: `${prefix}_source.png`, icon: `${prefix}_icon.svg`, request: `${prefix}.json` };
  const outputs = [], artifacts = []; let largeIdentity;
  const control = '__excalidrawImagePreviewRegression';
  const evaluate = code => JSON.parse(cli('eval', `code=${code}`).trim().replace(/^=>\s*/, ''));
  const action = (command, values = {}) => JSON.parse(cli(`obsidian-excalidraw-plugin:${command}`, `json=${JSON.stringify({ apiVersion: 1, ...values })}`));
  const ok = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result; };
  const id = suffix => `${prefix.split('/').at(-1).slice(-38)}-${suffix}`;
  const viewCode = `app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===${JSON.stringify(paths.drawing)})?.view`;
  const read = (detail = 'images') => { const result = action('read', { path: paths.drawing, source: 'live', detail }); if (!result.ok) throw Error(JSON.stringify({detail,result})); return result.data; };
  const artifactDir = reportDir ? join(reportDir, 'image-previews') : null;
  if (artifactDir) mkdirSync(artifactDir, { recursive: true });
  const preserve = (out, name) => {
    const data = evaluate(`(async()=>{const b=new Uint8Array(await app.vault.readBinary(app.vault.getFileByPath(${JSON.stringify(out)})));let s='';for(const v of b)s+=String.fromCharCode(v);return JSON.stringify({base64:btoa(s)})})()`);
    if (artifactDir) writeFileSync(join(artifactDir, name), Buffer.from(data.base64, 'base64'));
  };
  try {
    evaluate(`(async()=>{const c=createFragment().createEl('canvas');c.width=320;c.height=160;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,160,80);x.fillStyle='#00ff00';x.fillRect(160,0,160,80);x.fillStyle='#0000ff';x.fillRect(0,80,160,80);x.fillStyle='#ffff00';x.fillRect(160,80,160,80);x.clearRect(135,55,50,50);const blob=await new Promise(r=>c.toBlob(r));await app.vault.createBinary(${JSON.stringify(paths.raster)},await blob.arrayBuffer());c.width=c.height=0;await app.vault.create(${JSON.stringify(paths.icon)},'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="21" fill="#9c36b5"/></svg>');return JSON.stringify({created:true})})()`);
    ok(action('create', { requestId: id('create'), path: paths.drawing, elements: [] }));
    ok(action('open', { path: paths.drawing }));
    const inserted = ok(action('apply', { requestId: id('insert'), path: paths.drawing, expectedRevision: read().revision, operations: [
      { op: 'image', id: 'raster', asset: paths.raster, x: 20, y: 20, scale: false },
      { op: 'image', id: 'icon', asset: paths.icon, x: 600, y: 240, scale: false },
    ] }));
    const rasterId = inserted.data.idMap.raster;
    evaluate(`(async()=>{const v=${viewCode},a=v.excalidrawAPI,es=structuredClone(a.getSceneElements()),e=es.find(e=>e.id===${JSON.stringify(rasterId)});e.width=200;e.height=100;e.customData={preserved:'yes'};const copies=[{id:'crop0001',x:260,y:20,crop:{x:80,y:40,width:160,height:80,naturalWidth:320,naturalHeight:160}},{id:'flip0001',x:20,y:170,scale:[-1,1]},{id:'turn0001',x:260,y:180,angle:0.5,opacity:65},{id:'frameimg',x:510,y:20,frameId:'frame001',angle:0.2}].map((p,i)=>({...e,...p,version:1,seed:700+i,versionNonce:800+i}));const frame=app.plugins.plugins['obsidian-excalidraw-plugin'].getCLIRuntime().convertToExcalidrawElements([{id:'frame001',type:'frame',x:520,y:10,width:140,height:140,name:'Clipping',children:[]}])[0];for(const copy of copies)if(copy.frameId==='frame001')copy.frameId=frame.id;v.updateScene({elements:[...es,...copies,frame],captureUpdate:'IMMEDIATELY'});await v.saveWithOutcome();return JSON.stringify({ready:true})})()`);
    ok(action('apply', { requestId: id('labels'), path: paths.drawing, expectedRevision: read().revision, operations: [
      { op: 'imageMetadata', id: rasterId, label: 'Red & <green> 安全', tags: ['detail'] },
      { op: 'imageMetadata', id: 'crop0001', label: 'Cropped', tags: ['context'] },
    ] }));
    const annotated = read();
    assert.equal(annotated.images.length, 6);
    assert.ok(annotated.images.find(e => e.elementId === rasterId).loadedRenditionBytes > 0);
    assert.ok(annotated.images.find(e => e.elementId === rasterId).originalBytes > 0);
    assert.equal(JSON.stringify(annotated).includes('data:image'), false);
    const sourceState = () => evaluate(`(async()=>{const v=${viewCode};return JSON.stringify({text:await app.vault.read(v.file),elements:JSON.stringify(v.excalidrawAPI.getSceneElements()),dirty:v.isDirty()})})()`);
    const before = sourceState();
    const mixed = { default: 'placeholder', rules: [{ ids: [rasterId], mode: 'original' }, { tags: ['context'], mode: 'thumbnail' }, { mimeTypes: ['image/svg+xml'], maxBytes: 65536, mode: 'original' }], labels: { flip0001: 'Mirror & <context> 中文' }, thumbnailMaxDimension: 128 };
    for (const theme of ['light', 'dark']) for (const format of ['svg', 'png']) for (const mode of ['original', 'placeholder', 'mixed']) {
      const name = `${theme}-${mode}.${format}`, out = `${prefix}_${name}`; outputs.push(out);
      const imagePolicy = mode === 'original' ? undefined : mode === 'mixed' ? mixed : { default: 'placeholder' };
      const result = ok(action('export', { requestId: id(`${theme}-${format}-${mode}`), path: paths.drawing, source: 'live', out, theme, maxWidth: 900, maxHeight: 700, maxPixels: 500000, maxArtifactBytes: 2000000, ...(imagePolicy ? { imagePolicy } : {}) }));
      assert.ok(result.data.width <= 900 && result.data.height <= 700);
      assert.ok(result.data.width * result.data.height <= 500000);
      assert.ok(Math.abs(result.data.sceneToPreview.sceneBounds.y + 20.5) < 0.00001, 'Frame label must be included in scene-to-preview origin');
      if (format === 'svg') assert.equal(result.data.sceneToPreview.sceneBounds.height * result.data.effectiveScale, result.data.height);
      assert.ok(result.data.representationId.startsWith('preview:'));
      if (mode === 'mixed') assert.deepEqual(result.data.imageSummary, { original: 2, thumbnail: 1, placeholder: 3 });
      if (mode === 'placeholder' && format === 'svg') {
        const check = evaluate(`(async()=>{const v=${viewCode},s=await app.vault.read(app.vault.getFileByPath(${JSON.stringify(out)})),d=new DOMParser().parseFromString(s,'image/svg+xml');return JSON.stringify({valid:!d.querySelector('parsererror'),omitted:Object.values(v.excalidrawAPI.getFiles()).every(f=>!s.includes(f.dataURL)),images:d.querySelectorAll('image').length})})()`);
        assert.equal(check.valid, true); assert.equal(check.omitted, true); assert.ok(check.images > 0);
      }
      artifacts.push({ name, ...result.data }); preserve(out, name);
    }
    assert.deepEqual(sourceState(), before, 'Preview export changed the source or dirty state');
    if (process.env.EXCALIDRAW_CLI_LARGE_IDENTITY === '1') {
      const out = `${prefix}_large.svg`; outputs.push(out);
      largeIdentity = await runCLILargeIdentity({ evaluate, viewCode, path: paths.drawing, out, requestId: id('large') });
      assert.deepEqual(sourceState(), before, 'Large identity probe changed the real source');
    }
    if (process.env.EXCALIDRAW_CLI_POPOUT === '1') {
    evaluate(`(async()=>{const leaf=app.workspace.openPopoutLeaf();await leaf.setViewState({type:'excalidraw',state:{file:${JSON.stringify(paths.drawing)}},active:true});return JSON.stringify({opened:true})})()`);
    let popout;
    for (let i = 0; i < 100; i++) {
      popout = evaluate(`JSON.stringify(app.workspace.getLeavesOfType('excalidraw').map(l=>l.view).filter(v=>v.file?.path===${JSON.stringify(paths.drawing)}&&v.containerEl.ownerDocument!==app.workspace.containerEl.ownerDocument&&v.isLoaded&&v.excalidrawAPI).map(v=>({id:v.id}))[0]||null)`);
      if (popout) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(popout?.id, 'Popout image drawing did not initialize');
    const popRead = ok(action('read', { path: paths.drawing, source: 'live', view: popout.id, detail: 'images' }));
    assert.equal(popRead.data.images.length, 6);
    const popOut = `${prefix}_popout.png`; outputs.push(popOut);
    ok(action('export', { requestId: id('popout'), path: paths.drawing, source: 'live', view: popout.id, out: popOut, imagePolicy: { default: 'placeholder' }, maxWidth: 400, maxHeight: 200, maxPixels: 60000 }));
    preserve(popOut, 'popout-placeholder.png');
    evaluate(`(async()=>{const leaf=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.id===${JSON.stringify(popout.id)});await leaf.setViewState({type:'empty',state:{}});leaf.detach();return JSON.stringify({closed:true})})()`);
    assert.equal(action('read', { path: paths.drawing, source: 'live', view: popout.id }).error.code, 'NOT_FOUND');
    for (let i = 0; i < 100; i++) {
      if (evaluate(`JSON.stringify({ready:!!(${viewCode})?.isLoaded&&!(${viewCode})?.isClosingOrMigrating()})`).ready) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    }
    // Thumbnail and original must map the same cropped/rotated/mirrored pixels.
    for (const source of ['live', 'disk']) {
      const out = `${prefix}_${source}_thumb.png`; outputs.push(out);
      const rendered = ok(action('export', { requestId: id(`${source}-thumb`), path: paths.drawing, source, out, theme: 'light', imagePolicy: { default: 'thumbnail', rules: [{ ids: [inserted.data.idMap.icon], mode: 'placeholder' }], thumbnailMaxDimension: 128 }, maxWidth: 900 }));
      artifacts.push({ name: `${source}-thumbnails.png`, ...rendered.data }); preserve(out, `${source}-thumbnails.png`);
    }
    const cleared = ok(action('apply', { requestId: id('clear'), path: paths.drawing, expectedRevision: read().revision, operations: [{ op: 'imageMetadata', id: rasterId, label: null }] }));
    assert.equal(cleared.persistence, 'saved');
    const metadata = ok(action('read', { path: paths.drawing, detail: 'elements' })).data.elements.find(e => e.id === rasterId).customData;
    assert.equal(metadata.preserved, 'yes'); assert.equal(metadata.excalidrawCLI.label, undefined); assert.deepEqual(metadata.excalidrawCLI.tags, ['detail']);
    // File transport and complete-asset overwrite protection, including omitted originals.
    evaluate(`(async()=>{await app.vault.create(${JSON.stringify(paths.request)},${JSON.stringify(JSON.stringify({ apiVersion: 1, command: 'export', requestId: id('asset-collision'), path: paths.drawing, out: paths.raster, overwrite: true, imagePolicy: { default: 'placeholder' } }))});return JSON.stringify({ready:true})})()`);
    assert.equal(JSON.parse(cli('obsidian-excalidraw-plugin:export', `input=${paths.request}`)).error.code, 'INVALID_INPUT');
    // Pause after disk assets have loaded, then perform a real same-size attachment replacement.
    const raced = `${prefix}_race.svg`; outputs.push(raced);
    evaluate(`(()=>{if(globalThis.${control})throw Error('controller exists');const v=app.vault,c={vault:v,read:v.read,count:0};globalThis.${control}=c;c.gate=new Promise(r=>c.release=r);v.read=async function(f){if(f.path===${JSON.stringify(paths.drawing)}&&++c.count===3){c.waiting=true;await c.gate}return c.read.call(this,f)};app.plugins.plugins['obsidian-excalidraw-plugin'].executeCLI(${JSON.stringify({ apiVersion: 1, command: 'export', requestId: id('race'), path: paths.drawing, source: 'disk', out: raced })}).then(r=>c.result=r);return JSON.stringify({started:true})})()`);
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = evaluate(`JSON.stringify({waiting:!!globalThis.${control}?.waiting,result:globalThis.${control}?.result})`).waiting;
      if (waiting) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(waiting, true, 'Disk export did not reach the post-loader race gate');
    evaluate(`(async()=>{const c=globalThis.${control},v=app.vault,f=v.getFileByPath(${JSON.stringify(paths.raster)}),b=await v.readBinary(f);c.source=f;c.bytes=b.slice(0);c.stat={...f.stat};new Uint8Array(b)[b.byteLength-1]^=1;await v.adapter.writeBinary(f.path,b,{mtime:c.stat.mtime,ctime:c.stat.ctime});Object.assign(f.stat,c.stat);c.release();return JSON.stringify({replaced:true})})()`);
    let race;
    for (let i = 0; i < 100; i++) {
      race = evaluate(`JSON.stringify({result:globalThis.${control}?.result})`).result;
      if (race) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(race?.error?.code, 'STALE_REVISION', JSON.stringify(race));
    assert.equal(evaluate(`JSON.stringify({exists:!!app.vault.getFileByPath(${JSON.stringify(raced)})})`).exists, false);
    evaluate(`(async()=>{const c=globalThis.${control};c.vault.read=c.read;await c.vault.adapter.writeBinary(c.source.path,c.bytes,{mtime:c.stat.mtime,ctime:c.stat.ctime});Object.assign(c.source.stat,c.stat);delete globalThis.${control};return JSON.stringify({restored:true})})()`);
    return { status: 'passed', assertions: ['shared image original/thumbnail/placeholder identities', 'crop, mirroring, rotation, opacity, frame membership and title bounds', 'transparent PNG and SVG icon, light/dark', 'XML/Unicode labels', 'complete SVG omits original payloads', 'source text/elements/dirty unchanged', 'metadata clear preserves tags and customData', 'live/disk thumbnails', 'file transport and omitted-asset overwrite refusal', 'same-size same-mtime disk attachment race refuses publication'], artifacts, popoutCoverage: process.env.EXCALIDRAW_CLI_POPOUT === '1' ? 'passed' : 'not run (set EXCALIDRAW_CLI_POPOUT=1)', ...(largeIdentity ? { largeIdentity } : {}) };
  } finally {
    evaluate(`(async()=>{const c=globalThis.${control};if(c){c.vault.read=c.read;c.release();if(c.bytes)await c.vault.adapter.writeBinary(c.source.path,c.bytes);delete globalThis.${control}}for(const path of ${JSON.stringify([...Object.values(paths), ...outputs])}){if(!path.startsWith(${JSON.stringify(prefix)}))throw Error('unsafe cleanup');for(const l of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===path)){await l.setViewState({type:'empty',state:{}});l.detach()}const f=app.vault.getFileByPath(path);if(f)await app.vault.delete(f)}return JSON.stringify({clean:true})})()`);
  }
}
