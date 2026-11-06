import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {EditorState,Transaction} from '@codemirror/state';
import {history,undo,redo} from '@codemirror/commands';
import {sourceHarness} from './sourceHarness.mjs';
const graph=sourceHarness();
const {DrawingEmbedSource}=await graph.importModule('src/core/editor/embedSource.ts');
after(()=>graph.close());

test('a physical-cell range validator blocks stale resize and source selection without history entries',()=>{
  let state=EditorState.create({doc:'![[Map|100]]',extensions:[history()]}),allowed=false,validations=0,focused=false;
  const view={get state(){return state;},dispatch(spec){state=state.update(spec).state;},focus(){focused=true;}};
  const binding=new DrawingEmbedSource(view,0,state.doc.length,state.doc.toString(),()=>true,(from,to)=>{validations++;assert.equal(state.sliceDoc(from,to),'![[Map|100]]');return allowed;});
  assert.equal(binding.replace('![[Map|108]]'),false);assert.equal(binding.select(),false);assert.equal(focused,false);assert.equal(undo(view),false);
  const transaction=state.update({changes:{from:0,insert:'prefix '}});state=transaction.state;binding.map(transaction.changes);
  assert.equal(validations,2,'range validation must not read pre-update DOM while mapping');
  allowed=true;assert.equal(binding.replace('![[Map|108]]'),true);assert.equal(state.doc.toString(),'prefix ![[Map|108]]');
});
function fixture(doc='before ![[Map|200]] after ![[Map|200]]',occurrence=1){
  let state=EditorState.create({doc,extensions:[history()]});let owner=true,focused=false,writes=0;
  const text='![[Map|200]]',from=doc.indexOf(text,occurrence===0?0:doc.indexOf(text)+1);
  const view={get state(){return state;},dispatch(spec){const transaction=spec instanceof Transaction?spec:state.update(spec);state=transaction.state;if(transaction.docChanged)writes++;},focus(){focused=true;}};
  const binding=new DrawingEmbedSource(view,from,from+text.length,text,()=>owner);
  return{view,binding,owner:value=>owner=value,focused:()=>focused,writes:()=>writes};
}
test('only the bound repeated occurrence changes, with one undo and redo step',()=>{
  const f=fixture();assert.equal(f.binding.replace('![[Map|320]]'),true);
  assert.equal(f.view.state.doc.toString(),'before ![[Map|200]] after ![[Map|320]]');assert.equal(f.writes(),1);
  assert.equal(undo(f.view),true);assert.equal(f.view.state.doc.toString(),'before ![[Map|200]] after ![[Map|200]]');
  assert.equal(redo(f.view),true);assert.equal(f.view.state.doc.toString(),'before ![[Map|200]] after ![[Map|320]]');
});
test('prefix transactions map the source range without selecting another identical token',()=>{
  const f=fixture(),transaction=f.view.state.update({changes:{from:0,insert:'prefix '}});f.view.dispatch(transaction);f.binding.map(transaction.changes);
  assert.equal(f.binding.replace('![[Map|260]]'),true);assert.equal(f.view.state.doc.toString(),'prefix before ![[Map|200]] after ![[Map|260]]');
});
test('source editing selects the exact containing-note token without changing source',()=>{
  const f=fixture();assert.equal(f.binding.select(),true);assert.equal(f.view.state.selection.main.from,26);assert.equal(f.view.state.selection.main.to,38);assert.equal(f.focused(),true);assert.equal(f.writes(),0);
});
test('stale, changed-owner, changed-destination and retired bindings never write',()=>{
  for(const kind of ['owner','token','retired','target']){const f=fixture();
    if(kind==='owner')f.owner(false);
    if(kind==='token'){const change=f.view.state.update({changes:{from:30,to:31,insert:'X'}});f.view.dispatch(change);f.binding.map(change.changes);}
    if(kind==='retired')f.binding.invalidate();
    const before=f.view.state.doc.toString(),writes=f.writes();
    assert.equal(f.binding.replace(kind==='target'?'![[Other|300]]':'![[Map|300]]'),false,kind);
    assert.equal(f.view.state.doc.toString(),before);assert.equal(f.writes(),writes);
  }
});
test('a no-op creates no history event and completed bindings cannot replay',()=>{
  const f=fixture();assert.equal(f.binding.replace(f.binding.text),true);assert.equal(f.writes(),0);assert.equal(undo(f.view),false);
  assert.equal(f.binding.replace('![[Map|300]]'),true);assert.equal(f.binding.replace('![[Map|350]]'),false);assert.equal(f.writes(),1);
});
