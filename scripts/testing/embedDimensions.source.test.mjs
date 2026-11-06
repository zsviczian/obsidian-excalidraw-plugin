import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {sourceHarness} from './sourceHarness.mjs';
const graph=sourceHarness();
const {rewriteEmbedDimensions:edit,getEmbedDimensions,readDrawingEmbedToken,parseEmbedAlias}=await graph.importModule('src/core/editor/embedDimensions.ts');
after(()=>graph.close());

for(const [source,size,expected] of [
  ['![[Map.excalidraw.md#^area=foo,padding=1.5]]',{width:420},'![[Map.excalidraw.md#^area=foo,padding=1.5|420]]'],
  ['![[Map|400]]',{width:400},'![[Map|400]]'],
  ['![[Map| Caption | 300x200 |left]]',{width:450,height:300},'![[Map| Caption | 450x300 |left]]'],
  ['![[Map|Caption|50%x25%|right]]',{width:360,height:180},'![[Map|Caption|360x180|right]]'],
  ['![[Map|x200|center]]',{width:400,height:200},'![[Map|400x200|center]]'],
  ['![[Map|left]]',{width:320},'![[Map|320|left]]'],
  ['![[Map|Caption|left]]',{width:320},'![[Map|Caption|320|left]]'],
  ['![[Map|Caption|unknown|left]]',{width:320},'![[Map|Caption|320|unknown|left]]'],
  ['![[Map|]]',{width:320},'![[Map|320]]'],
  ['![[Map\\|Alias\\|50%x25%\\|left]]',null,'![[Map\\|Alias\\|left]]'],
  ['![[Map\\| x100 \\|center]]',{width:200,height:100},'![[Map\\| 200x100 \\|center]]'],
  ['![[Map|400|left]]',null,'![[Map|left]]'],
  ['![[Map|400]]',null,'![[Map]]'],
  ['![[Map|Alias|left]]',null,'![[Map|Alias|left]]'],
  ['![Caption|200](Drawings/Map.excalidraw.md#^frame=F,padding=5 "Keep title")',{width:300},'![Caption|300](Drawings/Map.excalidraw.md#^frame=F,padding=5 "Keep title")'],
  ['![](<Drawings/Árvíz 测试.excalidraw.md#^clippedframe=My Frame> "Keep (title)")',{width:320},'![320](<Drawings/Árvíz 测试.excalidraw.md#^clippedframe=My Frame> "Keep (title)")'],
  ['![400|left](Map.md#^as-image)',null,'![left](Map.md#^as-image)'],
  ['![Caption|400](Drawings/My%20Map.md "Keep")',null,'![Caption](Drawings/My%20Map.md "Keep")'],
  ['![400](Map.md)',null,'![](Map.md)'],
  ['![](<Drawings/A)B.md#^frame=Frame (> "Title")',{width:120},'![120](<Drawings/A)B.md#^frame=Frame (> "Title")'],
  ['![left](Map.md)',{width:320},'![320|left](Map.md)'],
]) test(`dimension slot: ${source} → ${expected}`,()=>assert.equal(edit(source,size),expected));

test('token parsing stops at its closing boundary and preserves destinations and titles',()=>{
  const first='![Caption\\] kept|200](<Drawings/A (B).md#^group=abcd1234> "Title ) kept")';
  const token=readDrawingEmbedToken(first+' ![[Other]]');
  assert.equal(token.text,first);assert.equal(token.target,'Drawings/A (B).md#^group=abcd1234');
  assert.equal(edit(first+' ![[Other]]',{width:100}),null);
  assert.equal(readDrawingEmbedToken('![[Map]] extra').text,'![[Map]]');
});

test('invalid tokens or non-positive/non-finite dimensions are not written',()=>{
  for(const source of ['text ![[Map]]','![[Map]','![alt](unclosed','ordinary text'])assert.equal(edit(source,{width:100}),null);
  for(const width of [0,-1,Infinity,NaN,1.5,100001])assert.equal(edit('![[Map]]',{width}),null);
  assert.equal(edit('![[Map]]',{width:100,height:0}),null);
});

test('the established alias/style and percentage grammar remains intact',()=>{
  assert.deepEqual(getEmbedDimensions('![[Map|Caption|x40%|left]]'),{width:undefined,height:'40%'});
  assert.deepEqual(parseEmbedAlias('Caption|300x200|left'),{alias:'Caption',width:'300',height:'200',style:'left'});
  assert.deepEqual(parseEmbedAlias('300|right'),{width:'300',style:'right'});
  assert.deepEqual(parseEmbedAlias('Caption|invalid|left'),{alias:'Caption',style:'left'});
  assert.deepEqual(parseEmbedAlias('01|right'),{alias:'01',style:'right'});
});
