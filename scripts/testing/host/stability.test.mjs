import assert from 'node:assert/strict';
import test from 'node:test';
import {stabilityFixture} from './stability.mjs';
test('large-scene stress stays bounded and deterministic with preserved prose and custom data',()=>{
  const value=stabilityFixture();assert.equal(value,stabilityFixture());
  const scene=JSON.parse(value.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(scene.elements.length,1000);assert.ok(value.includes('User Markdown retained.'));
  assert.ok(Math.max(...scene.elements.map(e=>e.x+e.width))<5000);
  assert.ok(Math.max(...scene.elements.map(e=>e.y+e.height))<2100);
  assert.equal(scene.elements[999].customData.retainedUnknown.value,999);
  assert.throws(()=>stabilityFixture(10000),/Bounded/);
});
