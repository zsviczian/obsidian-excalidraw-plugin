import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readNativeState,installStateEvidence} from './nativeStateEvidence.mjs';

test('passive native state reads preserve settings, layout, focus and scheduling without exposing values',()=>{
  const forbidden=()=>{throw Error('Diagnostic attempted a state/layout write');};
  const doc={hasFocus:()=>true,visibilityState:'visible',querySelectorAll:()=>[],activeElement:null,defaultView:{innerWidth:1024,innerHeight:800,focus:forbidden,ResizeObserver:forbidden}};
  const settings={falseValue:false,zeroValue:0,secret:'fixture-secret'};
  const view={getViewType:()=> 'excalidraw',containerEl:{ownerDocument:doc,isConnected:true},isPersistenceBusy:()=>false,_events:[forbidden]};
  const leaf={id:'leaf',parent:{id:'tabs'},view};
  const layout={main:{id:'split'},left:{collapsed:true},right:{collapsed:true}};
  const workspace={containerEl:{ownerDocument:doc},activeLeaf:leaf,activeEditor:view,getLayout:()=>layout,iterateAllLeaves:fn=>fn(leaf),floatingSplit:{children:[]},_:{'layout-change':[{},{}]},setActiveLeaf:forbidden};
  const wc={getBackgroundThrottling:()=>false,setBackgroundThrottling:forbidden,debugger:{isAttached:()=>true,listenerCount:()=>1}};
  const context={app:{workspace,plugins:{plugins:{'obsidian-excalidraw-plugin':{settings}}}},require:name=>name==='crypto'?{createHash}:{getCurrentWebContents:()=>wc}};
  const result=vm.runInNewContext('('+readNativeState.toString()+')('+'"boundary"'+')',context);
  assert.equal(result.settings.falseValue,createHash('sha256').update('false').digest('hex'));
  assert.equal(result.settings.zeroValue,createHash('sha256').update('0').digest('hex'));
  assert.equal(result.settings.missing,undefined);
  assert.ok(!JSON.stringify(result).includes('fixture-secret'));
  assert.equal(result.layout,layout);assert.equal(workspace.activeLeaf,leaf);assert.equal(settings.secret,'fixture-secret');
  assert.equal(result.workspaceListeners.kind,'Events');assert.equal(result.workspaceListeners.counts['layout-change'],2);
  assert.equal(result.leaves[0].listeners.kind,'Component');assert.equal(result.leaves[0].listeners.cleanupCallbacks,1);
  assert.equal(result.pluginListeners.kind,'unavailable');assert.equal(result.mainWindow.debuggerMessageListeners,1);
});

test('passive case evidence preserves original failure and captures cleanup without restoring state',async()=>{
  const failure=Error('original behavior failure'),calls=[],disposers=[];let value='initial';
  const c={defer:fn=>disposers.push(fn),case:async(id,features,run)=>{calls.push({id,features});return run();}};
  const states=installStateEvidence(c,label=>({label,value}));
  await assert.rejects(c.case('case',['P03'],async()=>{value='changed';throw failure;}),error=>error===failure);
  assert.deepEqual(calls,[{id:'case',features:['P03']}]);assert.equal(value,'changed');
  value='cleaned';for(const dispose of disposers.reverse())await dispose();
  assert.deepEqual(states,[{label:'before:lifecycle',value:'initial'},{label:'before:case',value:'initial'},{label:'after:case',value:'changed'},{label:'after:lifecycle-cleanup',value:'cleaned'}]);
});
