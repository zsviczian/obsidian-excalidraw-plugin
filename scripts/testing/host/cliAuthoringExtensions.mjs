/** Real native packets, filled contours, drawing embeds and public EA stroke workflows. */
import assert from 'node:assert/strict';
import { createNativeCLIActions } from './nativeCLITransport.mjs';
import { runInAppTask } from './inAppTask.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function runCLIAuthoringExtensions({ cli, drawingPath, reportDir }) {
  const prefix = drawingPath.replace(/\.excalidraw\.md$/, '') + '_authoring';
  assert.ok(prefix.split('/').at(-1).startsWith('__excalidraw_cli_smoke_'));
  const files = { host: prefix + '.excalidraw.md', request: prefix + '_request.json', source: prefix + '_source.excalidraw.md', note: prefix + '_plain.md', filled: prefix + '_filled.png', open: prefix + '_open.png', embed: prefix + '_embed.png', overview: prefix + '_overview.png', svg: prefix + '.svg' };
  const { action, recoveries } = createNativeCLIActions(cli);
  const ok = r => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };
  const id = suffix => prefix.slice(-30) + '-' + suffix;
  const evaluate = code => JSON.parse(cli('eval', 'code=' + code).trim().replace(/^=>\s*/, ''));
  const read = () => ok(action('read', { path: files.host, source: 'live', detail: 'elements' })).data;
  let strokeResults;
  try {
    ok(action('create', { requestId: id('source'), path: files.source, elements: [{ type: 'rectangle', x: 0, y: 0, width: 200, height: 90, backgroundColor: '#1971c2', fillStyle: 'solid', label: { text: 'Embedded mind map' } }] }));
    const points = Array.from({ length: 250 }, (_, i) => [80 * (Math.cos(i / 249 * Math.PI * 2) - 1), 60 * Math.sin(i / 249 * Math.PI * 2)]);
    points[249] = [...points[0]];
    const hostRequest = { apiVersion: 1, requestId: id('host'), path: files.host, elements: [
      { id: 'contour', type: 'line', x: 240, y: 100, width: 160, height: 120, polygon: true, points, roughness: 0, strokeColor: '#ff0000', backgroundColor: '#ff0000', fillStyle: 'solid' },
      { id: 'target', type: 'rectangle', x: 400, y: 0, width: 180, height: 80, label: { text: 'Selected target' } },
      { id: 'unrelated', type: 'ellipse', x: 400, y: 200, width: 80, height: 80 },
      { id: 'frame', type: 'frame', children: ['target'], name: 'Packet frame' },
    ] };
    evaluate(`(async()=>{await app.vault.create(${JSON.stringify(files.request)},${JSON.stringify(JSON.stringify(hostRequest))});return JSON.stringify({written:true})})()`);
    const created = ok(action('create', hostRequest, files.request));
    const opened = ok(action('open', { path: files.host })).data;
    const targetId = created.data.idMap.target, polygonId = created.data.idMap.contour;
    evaluate(`(()=>{const v=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.id===${JSON.stringify(opened.viewId)}).view;v.updateScene({appState:{selectedElementIds:{[${JSON.stringify(targetId)}]:true}},captureUpdate:'NEVER'});return JSON.stringify({selected:true})})()`);
    const packet = ok(action('selection', { path: files.host, view: opened.viewId })).data;
    assert.equal(packet.elements.length, 2); assert.equal(packet.elements.find(e => e.id === targetId).frameId, created.data.idMap.frame);
    const labelId = packet.elements.find(e => e.id === targetId).labelId;
    assert.ok(labelId && packet.elements.some(e => e.id === labelId && e.containerId === targetId));
    const copied = await runInAppTask({ cli, execute: copyAndClearSelection, args: [files.host, [targetId], false], timeoutMs: 30000 });
    assert.deepEqual(copied.packet, packet);
    const selectedRead = ok(action('read', { path: packet.path, view: packet.view, source: 'live', detail: 'elements', revision: packet.revision, ids: packet.elements.map(e => e.id) })).data;
    assert.equal(selectedRead.total, 2);
    const unrelatedBefore = read().elements.find(e => e.id === created.data.idMap.unrelated);
    ok(action('apply', { requestId: id('targeted'), path: files.host, view: packet.view, expectedRevision: selectedRead.revision, operations: [{ op: 'update', id: labelId, set: { text: 'Packet label edited' } }] }));
    // Existing EA publication bumps version metadata on staged copies; all unrelated content must remain identical.
    const content = ({ version, versionNonce, updated, ...element }) => element;
    assert.deepEqual(content(read().elements.find(e => e.id === created.data.idMap.unrelated)), content(unrelatedBefore));
    assert.equal(action('apply', { requestId: id('stale-packet'), path: files.host, expectedRevision: packet.revision, operations: [{ op: 'update', id: targetId, set: { opacity: 20 } }] }).error.code, 'STALE_REVISION');
    if (process.env.EXCALIDRAW_CLI_POPOUT === '1') {
      const popout = await runInAppTask({ cli, execute: copyAndClearSelection, args: [files.host, [targetId], true], timeoutMs: 45000 });
      assert.notEqual(popout.packet.view, packet.view); assert.equal(popout.packet.path, files.host);
      assert.deepEqual(popout.packet.elements.map(e => e.id), packet.elements.map(e => e.id));
    }
    ok(action('apply', { requestId: id('embed'), path: files.host, expectedRevision: read().revision, operations: [{ op: 'image', id: 'embed', asset: files.source, x: 20, y: 300, scale: false, anchor: true }] }));
    const embedded = evaluate(`(async()=>{const v=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.id===${JSON.stringify(opened.viewId)}).view;const image=v.getViewElements().find(e=>e.type==='image'),ef=v.excalidrawData.getFile(image.fileId);await app.vault.create(${JSON.stringify(files.note)},'An ordinary note');return JSON.stringify({source:ef.file.path,text:await app.vault.read(v.file)})})()`);
    assert.equal(embedded.source, files.source); assert.ok(embedded.text.includes('|100%'));
    const image = read().elements.find(e => e.type === 'image');
    ok(action('export', { requestId: id('embed-png'), path: files.host, source: 'live', out: files.embed, theme: 'light', area: { x: image.x, y: image.y, width: image.width, height: image.height }, padding: 0 }));
    const embedPixels = await runInAppTask({ cli, execute: redPixels, args: [files.embed], timeoutMs: 30000 });
    assert.ok(embedPixels.blue > embedPixels.total * 0.3, JSON.stringify(embedPixels));
    for (const asset of [files.note, files.host]) assert.equal(action('apply', { requestId: id(asset === files.note ? 'plain-note' : 'self'), path: files.host, expectedRevision: read().revision, operations: [{ op: 'image', asset }] }).error.code, 'INVALID_INPUT');
    const area = { x: 150, y: 90, width: 20, height: 20 };
    ok(action('export', { requestId: id('filled'), path: files.host, source: 'live', out: files.filled, theme: 'light', area, padding: 0 }));
    const filled = await runInAppTask({ cli, execute: redPixels, args: [files.filled], timeoutMs: 30000 });
    assert.ok(filled.red > filled.total * 0.8, JSON.stringify(filled));
    assert.equal(read().elements.find(e => e.id === polygonId).polygon, true);
    ok(action('apply', { requestId: id('open-line'), path: files.host, expectedRevision: read().revision, operations: [{ op: 'update', id: polygonId, set: { polygon: false, backgroundColor: 'transparent' } }] }));
    assert.equal(read().elements.find(e => e.id === polygonId).polygon, false);
    ok(action('export', { requestId: id('open-png'), path: files.host, source: 'live', out: files.open, theme: 'light', area, padding: 0 }));
    const unfilled = await runInAppTask({ cli, execute: redPixels, args: [files.open], timeoutMs: 30000 });
    assert.equal(unfilled.red, 0);
    strokeResults = await runInAppTask({ cli, execute: exerciseStrokeAuthoring, args: [files.host], timeoutMs: 90000 });
    ok(action('export', { requestId: id('host-svg'), path: files.host, source: 'disk', out: files.svg }));
    ok(action('export', { requestId: id('host-png'), path: files.host, source: 'disk', out: files.overview, theme: 'light' }));
    const exported = evaluate(`(async()=>{const s=await app.vault.read(app.vault.getFileByPath(${JSON.stringify(files.svg)}));return JSON.stringify({hasImage:s.includes('<image'),hasSourceLabel:s.includes('Embedded mind map')})})()`);
    assert.equal(exported.hasImage, true);
    evaluate(`(async()=>{for(const l of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===${JSON.stringify(files.host)})){await l.setViewState({type:'empty',state:{}});l.detach()}return JSON.stringify({closed:true})})()`);
    ok(action('open', { path: files.host }));
    const reopened = read().elements;
    assert.equal(reopened.find(e => e.id === labelId).rawText, 'Packet label edited');
    assert.equal(reopened.find(e => e.id === labelId).text.replace(/\s+/g, ' '), 'Packet label edited');
    assert.equal(reopened.find(e => e.id === strokeResults.convertedId).type, 'line');
    assert.equal(reopened.some(e => e.id === strokeResults.removedId), false);
    assert.ok(reopened.some(e => e.type === 'image'));
    return { status: 'passed', assertions: ['250-point polygon fill and false update verified by decoded pixels', 'live packet and actual copy command retain bound labels after deselection', ...(process.env.EXCALIDRAW_CLI_POPOUT === '1' ? ['actual selection-copy command in a separate popout owner document'] : []), 'targeted label edit preserves unrelated content and refuses a stale packet', 'linked drawing embed/100% anchor and host SVG/PNG/save/reopen', 'ordinary Markdown and self-embed refusal', ...strokeResults.assertions], transportRecoveries: recoveries };
  } finally {
    try {
      // Preserve available render evidence on failures too, before deleting owned fixtures.
      if (reportDir) {
        const target = join(reportDir, 'authoring-extensions'); mkdirSync(target, { recursive: true });
        for (const [key, path] of Object.entries(files).filter(([key]) => ['filled', 'open', 'embed', 'overview', 'svg'].includes(key))) {
          const data = evaluate(`(async()=>{const f=app.vault.getFileByPath(${JSON.stringify(path)});if(!f)return JSON.stringify(null);const b=new Uint8Array(await app.vault.readBinary(f));let s='';for(const n of b)s+=String.fromCharCode(n);return JSON.stringify({base64:btoa(s)})})()`);
          if (data) writeFileSync(join(target, key + (key === 'svg' ? '.svg' : '.png')), Buffer.from(data.base64, 'base64'));
        }
      }
    } finally {
    evaluate(`(async()=>{for(const path of ${JSON.stringify(Object.values(files))}){if(!path.startsWith(${JSON.stringify(prefix)}))throw Error('Unsafe cleanup');for(const l of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===path)){await l.setViewState({type:'empty',state:{}});l.detach()}const f=app.vault.getFileByPath(path);if(f)await app.vault.delete(f)}return JSON.stringify({clean:true})})()`);
    }
  }
}

async function copyAndClearSelection(c, path, ids, popout) {
  let view = app.workspace.getLeavesOfType('excalidraw').find(l => l.view.file?.path === path)?.view;
  if (!view) throw Error('Owned view missing');
  if (popout) {
    const originalView = view, leaf = app.workspace.openPopoutLeaf();
    c.defer(async () => { await leaf.setViewState({ type: 'empty', state: {} }); leaf.detach(); app.workspace.setActiveLeaf(originalView.leaf, { focus: false }); });
    await leaf.setViewState({ type: 'excalidraw', state: { file: path }, active: true });
    await c.waitFor(() => leaf.view?.isLoaded && leaf.view?.excalidrawAPI, 'popout editor');
    view = leaf.view;
    if (view.containerEl.ownerDocument === originalView.containerEl.ownerDocument) throw Error('Expected a separate owner document');
  }
  view.updateScene({ appState: { selectedElementIds: Object.fromEntries(ids.map(id => [id, true])) }, captureUpdate: 'NEVER' });
  const clipboard = view.containerEl.ownerDocument.defaultView.navigator.clipboard;
  const original = Object.getOwnPropertyDescriptor(clipboard, 'writeText'); let packet;
  Object.defineProperty(clipboard, 'writeText', { configurable: true, value: async value => { packet = JSON.parse(value); } });
  try {
    app.workspace.setActiveLeaf(view.leaf, { focus: true });
    app.commands.executeCommandById('obsidian-excalidraw-plugin:copy-selection-for-agent');
    await c.waitFor(() => packet, 'clipboard packet');
    view.updateScene({ appState: { selectedElementIds: {} }, captureUpdate: 'NEVER' });
    return { packet };
  } finally { if (original) Object.defineProperty(clipboard, 'writeText', original); else delete clipboard.writeText; }
}

async function redPixels(c, path) {
  const file = app.vault.getFileByPath(path), blob = new Blob([await app.vault.readBinary(file)]);
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    image.src = url; await image.decode();
    const canvas = createFragment().createEl('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data; let red = 0, blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 180 && data[i + 1] < 80 && data[i + 2] < 80 && data[i + 3] > 200) red++;
      if (data[i] < 80 && data[i + 1] < 180 && data[i + 2] > 150 && data[i + 3] > 200) blue++;
    }
    const center = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
    return { red, blue, total: data.length / 4, center: [...data.slice(center, center + 4)] };
  } finally { URL.revokeObjectURL(url); }
}

async function exerciseStrokeAuthoring(c, path) {
  const p = app.plugins.plugins['obsidian-excalidraw-plugin'], view = app.workspace.getLeavesOfType('excalidraw').find(l => l.view.file?.path === path)?.view;
  const ea = p.ea.getAPI(view), check = (value, message) => { if (!value) throw Error(message); };
  c.defer(() => ea.destroy());
  ea.style.roughness = 0; ea.style.strokeWidth = 2;
  const curve = ea.addLine([[650, 300], [700, 400], [750, 300]]);
  ea.getElement(curve).roundness = { type: 2 }; ea.getElement(curve).angle = Math.PI / 6;
  ea.getElement(curve).customData = { ownedStroke: 'preserved' };
  await ea.addElementsToView(false, false);
  let original = view.getViewElements().find(e => e.id === curve), before = p.getCLIRuntime().getCommonBounds([original]);
  ea.clear(); ea.copyViewElementsToEAforEditing([original]);
  const result = ea.convertLineToFreedraw(curve, { tolerance: 0.2 });
  check(result.pointCount > original.points.length && result.warnings.some(w => w.includes('excalidraw.com')), 'Curve sampling or compatibility warning missing');
  check(view.getViewElements().find(e => e.id === curve).type === 'line', 'Conversion changed live scene before publication');
  await ea.addElementsToView(false, false);
  const converted = view.getViewElements().find(e => e.id === curve), after = p.getCLIRuntime().getCommonBounds([converted]);
  check(converted.type === 'freedraw' && converted.customData.ownedStroke === 'preserved', 'Free-draw conversion/metadata missing');
  check(before.every((n, i) => Math.abs(n - after[i]) < 3), 'Rotated spline moved during conversion');
  ea.clear(); ea.copyViewElementsToEAforEditing([converted]);
  const back = ea.convertFreedrawToLine(curve, { tolerance: 0.2, strokeWidth: 2 });
  check(back.warnings.length > 0, 'Pressure loss warning missing');
  await ea.addElementsToView(false, false);
  ea.clear();
  const first = ea.addLine([[650, 500], [700, 500]]), second = ea.addLine([[700, 550], [700, 500]]);
  await ea.addElementsToView(false, false);
  const lines = view.getViewElements().filter(e => [first, second].includes(e.id));
  ea.clear(); ea.copyViewElementsToEAforEditing(lines);
  ea.concatenateLines([first, second], { maxGap: 0 });
  check(view.getViewElements().some(e => e.id === second), 'Concatenation deleted live source before publication');
  await ea.addElementsToView(false, false); await view.save(false);
  check(!view.getViewElements().some(e => e.id === second), 'Concatenation did not remove second source');
  return { convertedId: curve, removedId: second, assertions: ['actual rotated spline bounds retained through line/free-draw conversion', 'conversion/concatenation remain isolated until explicit EA publication', 'custom metadata and surviving IDs retained', 'sharp/reversed endpoint concatenation and saved tombstones'] };
}
