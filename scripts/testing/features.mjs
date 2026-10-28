/** Source-linked obligations are a denominator, never a substitute for execution. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ownedPath} from './contracts.mjs';
export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function validateFeatures(registry,root=projectRoot){
  assert.equal(registry.schemaVersion,2,'Unsupported feature schema');
  for(const key of ['requiredSuites','requiredGates'])assert.ok(Array.isArray(registry[key])&&registry[key].length&&new Set(registry[key]).size===registry[key].length,'Missing/duplicate required suite list: '+key);
  const fixtures=new Set(JSON.parse(readFileSync(ownedPath(root,'tests/fixtures/manifest.json'))).fixtures.map(f=>f.id));
  assert.deepEqual(registry.features.map(f=>f.id),Array.from({length:12},(_,i)=>'P'+String(i+1).padStart(2,'0')),'P01–P12 denominator changed');
  for(const feature of registry.features){
    assert.ok(['P0','P1'].includes(feature.priority)&&feature.name&&feature.success&&feature.failure&&feature.cleanup,'Feature obligations missing: '+feature.id);
    assert.ok(feature.platforms.length&&feature.anchors.length&&feature.tests.length,'Feature mapping empty: '+feature.id);
    for(const anchor of feature.anchors){const text=readFileSync(ownedPath(root,anchor.path),'utf8');assert.ok(anchor.symbol&&text.includes(anchor.symbol),'Stale feature anchor: '+anchor.path+' '+anchor.symbol);}
    for(const id of feature.fixtures)assert.ok(fixtures.has(id),'Unknown fixture: '+id);
    for(const test of feature.tests){
      assert.ok(['source','native','browser','artifact'].includes(test.layer),'Unknown test layer');
      assert.ok(!test.repository||test.repository==='fork'||test.repository==='extras','Unknown test repository');
      const testRoot=test.repository?resolve(process.env[test.repository==='fork'?'EXCALIDRAW_FORK_ROOT':'EXCALIDRAW_EXTRAS_ROOT']||resolve(root,test.repository==='fork'?'../excalidraw':'../obsidian-excalidraw-extras')):root;
      ownedPath(testRoot,test.path);assert.ok(test.cases?.length,'Missing executable case IDs');
    }
    assert.ok(Array.isArray(feature.remaining)&&feature.remaining.every(value=>typeof value==='string'&&value),'Remaining obligations must be explicit');
  }
  // Public entries stay enumerated individually. Mapping a family does not claim
  // that all 187 settings, 161 EA entries or commands were behaviorally tested.
  const inventory=JSON.parse(readFileSync(ownedPath(root,'tests/inventory.json')));
  return {features:registry.features.length,remaining:registry.features.flatMap(f=>f.remaining.map(reason=>({featureId:f.id,reason}))),
    publicSurface:Object.fromEntries(['commands','publicEA','settings','cliCommands','hooks'].map(key=>[key,{discovered:inventory[key].length,entries:inventory[key].map(entry=>({...entry,behavioralCoverage:'not inferred from inventory'}))}]))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const evidence=validateFeatures(JSON.parse(readFileSync(ownedPath(projectRoot,'tests/features.json'))));
  process.stdout.write(`${evidence.features} feature groups mapped; ${evidence.remaining.length} explicit remaining obligations. Inventory is discovery, not coverage.\n`);
}
