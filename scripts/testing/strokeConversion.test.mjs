/** Actual geometry/workbench helpers with the existing version-clone boundary isolated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sourceHarness } from './sourceHarness.mjs';
const require = createRequire(import.meta.url), rough = require('roughjs');
const graph = sourceHarness({
  'roughjs/bin/generator': { RoughGenerator: rough.generator().constructor },
  './excalidrawElementUtils': { cloneElement: e => ({ ...structuredClone(e), version: e.version + 1 }) },
});
const { convertWorkbenchStroke } = await graph.importModule('src/utils/strokeConversion.ts');
const { concatenateWorkbenchLines } = await graph.importModule('src/utils/strokeConcatenation.ts');
const { segmentDistance } = await graph.importModule('src/shared/svgToExcalidraw/pathGeometry.ts');
test.after(() => graph.close());

function line(id, points, extra = {}) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { id, type: 'line', x: 10, y: 20, angle: 0, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    strokeWidth: 2, strokeColor: '#123456', backgroundColor: 'transparent', fillStyle: 'solid', roughness: 0, opacity: 100,
    seed: 1, version: 1, groupIds: ['group'], frameId: 'frame', customData: { preserved: 'yes' }, boundElements: [], polygon: false, roundness: null, ...extra };
}
function workbench(elements) {
  return { elementsDict: Object.fromEntries(elements.map(e => [e.id, e])), getElement(id) { return this.elementsDict[id]; },
    plugin: { getCLIRuntime: () => ({ getCommonBounds: ([e]) => {
      const xs = e.points.map(p => p[0] + e.x), ys = e.points.map(p => p[1] + e.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    } }) } };
}
const world = e => e.points.map(([x, y]) => [x + e.x, y + e.y]);
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance, `${a} != ${b}`);

test('line to free-draw retains world placement, identity and metadata for rotated strokes', () => {
  const source = line('stroke', [[0, 0], [100, 0]], { angle: Math.PI / 2 });
  const ea = workbench([source]);
  const result = convertWorkbenchStroke(ea, 'stroke', 'freedraw');
  const target = ea.getElement('stroke');
  assert.equal(source.type, 'line'); assert.equal(target.type, 'freedraw'); assert.equal(target.angle, 0);
  near(world(target)[0], [60, -30]); near(world(target)[1], [60, 70]);
  assert.equal(target.version, 2); assert.deepEqual(target.groupIds, ['group']); assert.equal(target.frameId, 'frame');
  assert.equal(target.customData.preserved, 'yes'); assert.equal(target.customData.strokeOptions.options.start.cap, true);
  assert.equal(target.pressures.length, target.points.length); assert.equal(target.simulatePressure, false);
  assert.equal('polygon' in target, false); assert.match(result.warnings[0], /excalidraw.com/);
});

test('rounded line conversion samples the actual spline within tolerance instead of retagging control points', () => {
  const source = line('curve', [[0, 0], [50, 100], [100, 0]], { roundness: { type: 2 } });
  const ea = workbench([source]), tolerance = 0.2;
  convertWorkbenchStroke(ea, source.id, 'freedraw', { tolerance });
  const sampled = world(ea.getElement(source.id)); assert.ok(sampled.length > source.points.length);
  const ops = rough.generator().curve(source.points, { roughness: 0, preserveVertices: true, disableMultiStroke: true }).sets[0].ops.slice(0, source.points.length);
  let start;
  for (const op of ops) {
    if (op.op === 'move') start = op.data;
    else {
      const [bx, by, cx, cy, dx, dy] = op.data;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100, u = 1 - t;
        const p = [u ** 3 * start[0] + 3 * u ** 2 * t * bx + 3 * u * t ** 2 * cx + t ** 3 * dx + source.x,
          u ** 3 * start[1] + 3 * u ** 2 * t * by + 3 * u * t ** 2 * cy + t ** 3 * dy + source.y];
        const error = Math.min(...sampled.slice(1).map((b, j) => segmentDistance(p, sampled[j], b)));
        assert.ok(error <= tolerance ** 2 + 1e-8);
      }
      start = [dx, dy];
    }
  }
});

test('free-draw to line simplifies centerlines and explicitly removes custom pen and pressure semantics', () => {
  const ea = workbench([line('stroke', Array.from({ length: 100 }, (_, i) => [i, i % 2 * 0.1]))]);
  convertWorkbenchStroke(ea, 'stroke', 'freedraw');
  const result = convertWorkbenchStroke(ea, 'stroke', 'line', { tolerance: 0.5, strokeWidth: 3 });
  const target = ea.getElement('stroke');
  assert.equal(target.points.length, 2); assert.equal(target.strokeWidth, 3); assert.equal(target.customData.preserved, 'yes');
  assert.equal('strokeOptions' in target.customData, false); assert.equal('pressures' in target, false);
  assert.match(result.warnings[0], /pressure/i);
});

test('custom free-draw tips/pressure configuration is copied without modifying caller settings', () => {
  const ea = workbench([line('a', [[0, 0], [50, 0]]), line('b', [[0, 0], [50, 0]])]);
  convertWorkbenchStroke(ea, 'a', 'freedraw');
  const pen = structuredClone(ea.getElement('a').customData.strokeOptions);
  pen.options.start.cap = false; pen.options.end.taper = 20; pen.options.thinning = 0.6;
  pen.hasOutline = true; pen.outlineWidth = 2;
  const before = structuredClone(pen);
  convertWorkbenchStroke(ea, 'b', 'freedraw', { penOptions: pen });
  assert.deepEqual(pen, before); assert.deepEqual(ea.getElement('b').customData.strokeOptions, pen);
  ea.getElement('b').customData.strokeOptions.options.end.taper = 10;
  assert.equal(pen.options.end.taper, 20);
});

test('conversion preserves closed fills and rejects unsupported relationships or budgets atomically', () => {
  const ea = workbench([line('closed', [[0, 0], [50, 0], [0, 50]], { polygon: true, backgroundColor: '#ff0000' })]);
  convertWorkbenchStroke(ea, 'closed', 'freedraw');
  assert.deepEqual(ea.getElement('closed').points.at(-1), [0, 0]);
  convertWorkbenchStroke(ea, 'closed', 'line'); assert.equal(ea.getElement('closed').polygon, true);
  const ordinary = workbench([line('ordinary', [[0, 0], [50, 0], [0, 50], [0, 0]], { backgroundColor: '#ff0000' })]);
  convertWorkbenchStroke(ordinary, 'ordinary', 'freedraw'); assert.equal(ordinary.getElement('ordinary').backgroundColor, '#ff0000');
  const open = workbench([line('open', [[0, 0], [50, 0]], { type: 'freedraw', backgroundColor: '#ff0000' })]);
  convertWorkbenchStroke(open, 'open', 'line'); assert.equal(open.getElement('open').polygon, false);
  for (const extra of [{ startArrowhead: 'arrow' }, { startBinding: { elementId: 'shape' } }, { endBinding: { elementId: 'shape' } }, { boundElements: [{ id: 'label', type: 'text' }] }]) {
    const e = line('bad', [[0, 0], [20, 30]], extra), target = workbench([e]), before = structuredClone(e);
    assert.throws(() => convertWorkbenchStroke(target, 'bad', 'freedraw')); assert.deepEqual(target.getElement('bad'), before);
  }
  const target = workbench([line('curve', [[0, 0], [50, 100], [100, 0]], { roundness: { type: 2 } })]);
  const before = structuredClone(target.getElement('curve'));
  assert.throws(() => convertWorkbenchStroke(target, 'curve', 'freedraw', { maxPoints: 2 }));
  assert.deepEqual(target.getElement('curve'), before);
});

test('concatenation chooses endpoint order, retains sharp corners and publishes no intermediate changes', () => {
  const a = line('a', [[0, 0], [50, 0]]), b = line('b', [[50, 50], [50, 0]]), c = line('c', [[50, 50], [20, 80]]);
  const ea = workbench([a, b, c]), result = concatenateWorkbenchLines(ea, ['a', 'c', 'b'], { maxGap: 0 });
  assert.equal(result.id, 'a'); assert.deepEqual(result.removedIds, ['c', 'b']);
  assert.equal(ea.getElement('b').isDeleted, true); assert.equal(ea.getElement('c').isDeleted, true);
  assert.equal(a.isDeleted, undefined); assert.equal(b.isDeleted, undefined);
  assert.deepEqual(world(ea.getElement('a')), [[10, 20], [60, 20], [60, 70], [30, 100]]);
});

test('concatenation refuses disconnected, conflicting and closed inputs without deleting any source', () => {
  for (const extra of [{ x: 1000 }, { strokeColor: '#abcdef' }, { polygon: true }, { startBinding: { elementId: 'shape' } }, { endBinding: { elementId: 'shape' } }, { boundElements: [{ id: 'label', type: 'text' }] }]) {
    const ea = workbench([line('a', [[0, 0], [50, 0]]), line('b', [[50, 0], [100, 0]], extra)]), before = structuredClone(ea.elementsDict);
    assert.throws(() => concatenateWorkbenchLines(ea, ['a', 'b'])); assert.deepEqual(ea.elementsDict, before);
  }
});

test('concatenation samples spline sections and normalizes rotation before endpoint matching', () => {
  const rotated = workbench([line('a', [[0, 0], [100, 0]], { angle: Math.PI / 2 }), line('b', [[0, 0], [40, 0]], { x: 60, y: 70 })]);
  concatenateWorkbenchLines(rotated, ['a', 'b'], { maxGap: 0.000001 });
  const points = world(rotated.getElement('a'));
  near(points[0], [60, -30]); near(points[1], [60, 70]); near(points[2], [100, 70]);
  const curved = workbench([line('a', [[0, 0], [50, 100], [100, 0]], { roundness: { type: 2 } }), line('b', [[100, 0], [150, 50]])]);
  const result = concatenateWorkbenchLines(curved, ['a', 'b'], { maxGap: 0 });
  assert.ok(result.pointCount > 4); assert.equal(curved.getElement('a').roundness, null);
  near(world(curved.getElement('a')).at(-1), [160, 70]);
});
