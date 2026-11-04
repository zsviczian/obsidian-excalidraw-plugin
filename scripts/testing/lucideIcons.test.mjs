/** Real SVG converter with a small installed-registry fixture; no live Obsidian. */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import chroma from 'chroma-js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { loadConverter } from './svgConverterHarness.mjs';

const registry = new Map([
  ['lucide-line', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12H22"/></svg>'],
  ['lucide-arrow-up', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5V19"/></svg>'],
  ['lucide-dot', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h0"/></svg>'],
  ['lucide-wide', '<svg viewBox="10 20 48 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22Q34 42 56 22"/></svg>'],
  ['lucide-empty', '<svg viewBox="0 0 24 24"/>'],
  ['lucide-clipped', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M29 10L34 16"/></svg>'],
  ['lucide-partial', '<svg viewBox="0 0 24 24"><rect width="4" height="4"/><text>omitted</text></svg>'],
  ['custom', '<svg viewBox="0 0 24 24"/>'],
]);
function iconNode(source) {
  const node = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  node.cloneNode = () => iconNode(source);
  node.querySelectorAll = () => Array.from(node.getElementsByTagName('*')).filter(n => n.hasAttribute('stroke-width'));
  Object.defineProperty(node, 'outerHTML', { get: () => new XMLSerializer().serializeToString(node) });
  return node;
}
let id=0;
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/lucideIcons.ts', import.meta.url),'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText, { module,exports:module.exports,require(name) {
  if(name==='obsidian') return { getIconIds:()=>[...registry.keys()], getIcon:id=>registry.has(id)?iconNode(registry.get(id)):null };
  if(name==='chroma-js') return chroma;
  if(name.includes('constants')) return { nanoid:()=>`outer-${++id}` };
  if(name.includes('parser')) return {svgToExcalidraw:loadConverter()};
  throw Error(name);
}});
const {getLucideIcons,prepareLucideIcon}=module.exports;

test('catalog is installed Lucide-only, canonical and filtered case-insensitively',()=>{
  assert.ok(getLucideIcons().every(e=>e.icon.startsWith('lucide-')));
  assert.equal(getLucideIcons('WIDE')[0].name,'wide');
  assert.equal(getLucideIcons('ARROW UP')[0].icon,'lucide-arrow-up');
  assert.equal(getLucideIcons('missing').length,0);
});
test('presets scale nominal geometry and strokes once, independent of canvas zoom',()=>{
  for(const size of [48,96,192]) {
    const {elements,result}=prepareLucideIcon({icon:'line',size,x:100,y:200,strokeColor:'red',roughness:2,opacity:40});
    assert.equal(result.icon,'lucide-line');
    assert.equal(result.viewport.width,size);
    assert.equal(elements[0].x,100+size/12);
    assert.equal(elements[0].y,200+size/2);
    assert.equal(elements[0].width,size*20/24);
    assert.equal(elements[0].strokeWidth,size/12);
    assert.equal(elements[0].backgroundColor,'transparent');
    assert.equal(elements[0].strokeColor,'#ff0000');
    assert.equal(elements[0].roughness,2);
    assert.equal(elements[0].opacity,40);
    assert.equal(elements[0].version,1);
    assert.ok(elements.every(e=>e.groupIds.at(-1)===result.groupId));
  }
});
test('explicit stroke width also controls round-cap dot geometry',()=>{
  for(const size of [48,192]) {
    const {elements}=prepareLucideIcon({icon:'dot',size,strokeWidth:3,strokeColor:'blue'});
    assert.equal(elements[0].type,'ellipse');
    assert.equal(elements[0].width,3);
    assert.equal(elements[0].backgroundColor,'#0000ff');
    assert.equal(elements[0].strokeColor,'transparent');
  }
});
test('aspect, viewBox origin and curve sampling retain intended final scale',()=>{
  const small=prepareLucideIcon({icon:'wide',size:48});
  const large=prepareLucideIcon({icon:'wide',size:192});
  assert.equal(large.result.viewport.height,96);
  assert.equal(large.elements[0].x,8);
  assert.ok(large.elements[0].points.length>small.elements[0].points.length);
});
test('repeat calls retain independent identities and do not mutate registry SVGs',()=>{
  const first=prepareLucideIcon({icon:'line'}), second=prepareLucideIcon({icon:'lucide-line'});
  assert.notEqual(first.result.groupId,second.result.groupId);
  assert.notEqual(first.elements[0].id,second.elements[0].id);
  assert.equal(first.elements[0].strokeWidth,8);
  assert.equal(second.elements[0].strokeWidth,8);
});
test('unknown/custom/unsafe names, invalid values and partial/empty conversions fail',()=>{
  for(const options of [{icon:'unknown'},{icon:'custom'},{icon:'https://example.test/icon.svg'},
    {icon:'empty'},{icon:'partial'},{icon:'clipped'},{icon:'line',size:0},{icon:'line',x:NaN},
    {icon:'line',strokeWidth:0},{icon:'line',opacity:101},{icon:'line',roughness:-1},
    {icon:'line',strokeColor:'var(--color)'}]) assert.throws(()=>prepareLucideIcon(options));
});

const tree=ts.createSourceFile('ea.ts',readFileSync(new URL('../../src/shared/ExcalidrawAutomate.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
let method;
function find(node){if(ts.isMethodDeclaration(node)&&node.name.getText(tree)==='addLucideIcon')method=node.getText(tree);ts.forEachChild(node,find);}
find(tree);
const exports={};
vm.runInNewContext(ts.transpileModule(`export class EA {${method}}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,prepareLucideIcon});
test('EA API is synchronous, view-free and preserves unrelated workbench/style/assets on failure',()=>{
  const ea=new exports.EA();
  ea.style={strokeColor:'green',roughness:0,opacity:25};
  ea.elementsDict={sentinel:{id:'sentinel'}};ea.imagesDict={retained:{}};
  ea.copyViewElementsToEAforEditing=elements=>elements.forEach(e=>ea.elementsDict[e.id]=e);
  const style=JSON.stringify(ea.style),images=JSON.stringify(ea.imagesDict);
  const result=ea.addLucideIcon({icon:'line'});
  assert.equal(typeof result.groupId,'string');
  assert.equal(ea.elementsDict[result.elementIds[0]].strokeColor,'#008000');
  assert.equal(ea.elementsDict[result.elementIds[0]].opacity,25);
  const before=JSON.stringify(ea.elementsDict);
  assert.throws(()=>ea.addLucideIcon({icon:'partial'}));
  assert.equal(JSON.stringify(ea.elementsDict),before);
  assert.equal(JSON.stringify(ea.style),style);
  assert.equal(JSON.stringify(ea.imagesDict),images);
});
