import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {validateFeatures} from './features.mjs';
const registry=()=>JSON.parse(readFileSync(new URL('../../tests/features.json',import.meta.url)));
test('feature map retains the full denominator and public surfaces without inferred execution',()=>{
  const result=validateFeatures(registry());assert.equal(result.features,12);assert.equal(result.publicSurface.publicEA.discovered,161);
  assert.ok(result.remaining.length>0);assert.equal(result.publicSurface.settings.entries[0].behavioralCoverage,'not inferred from inventory');
});
test('feature drift, missing test files, stale anchors and unowned fixture references fail closed',()=>{
  let r=registry();r.features.pop();assert.throws(()=>validateFeatures(r),/denominator/);
  r=registry();r.features[0].anchors[0].symbol='missing-owned-source-anchor';assert.throws(()=>validateFeatures(r),/Stale/);
  r=registry();r.features[0].tests[0].path='../private.test.mjs';assert.throws(()=>validateFeatures(r),/traversal/);
  r=registry();r.features[0].fixtures=['not-a-fixture'];assert.throws(()=>validateFeatures(r),/Unknown fixture/);
});
