/** Bounded large-scene round trips in the real host; timings are diagnostics. */
import assert from 'node:assert/strict';
import {scene,drawingMarkdown} from '../fixtures.mjs';
import {sha256} from '../contracts.mjs';
import {runInAppTask} from './inAppTask.mjs';

export function stabilityFixture(count=1000){
  assert.ok(Number.isInteger(count)&&count>=2&&count<=2000,'Bounded stability fixture');
  const value=scene(count);
  value.elements.forEach((element,index)=>{element.x=(index%40)*120;element.y=Math.floor(index/40)*80;});
  return drawingMarkdown(value);
}
export async function runStabilityScenario({cli,drawingPath,cycles=6}){
  assert.ok(drawingPath.startsWith('__excalidraw_cli_smoke_'));
  assert.ok(Number.isInteger(cycles)&&cycles>=2&&cycles<=25,'Bounded stability cycles');
  const fixture=stabilityFixture(),path=drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/,'')+'_stability.excalidraw.md';
  const result=await runInAppTask({cli,execute:exerciseStability,args:[path,fixture,cycles],timeoutMs:cycles*30000+90000,cleanupMs:60000,onProgress:(phase)=>console.log('[native] '+(phase||'stability starting'))});
  return {id:'stability',status:'passed',fixtureHash:sha256(fixture),...result};
}
async function exerciseStability(c,path,fixture,cycles){
  const p=app.plugins.plugins['obsidian-excalidraw-plugin'],doc=app.workspace.containerEl.ownerDocument;
  const check=(value,label)=>{if(!value)throw Error(label);};
  const beforeRoots=doc.querySelectorAll('.excalidraw-wrapper').length,previous=app.workspace.activeLeaf;
  let leaf;
  c.defer(async()=>{
    const file=app.vault.getFileByPath(path);
    if(leaf?.view?.excalidrawAPI&&leaf.view.isDirty())check((await leaf.view.saveWithOutcome()).status==='persisted','Stability cleanup save failed');
    // Close the view first: file deletion invokes Obsidian's async onDelete,
    // which still uses the leaf parent after its own awaited open(null).
    if(leaf){const view=leaf.view;await leaf.setViewState({type:'empty',state:{}});leaf.detach();leaf=null;await c.waitForCleanup(()=>!view.excalidrawAPI&&!view.containerEl.querySelector('.excalidraw-wrapper'),'stability view retirement');}
    if(file){check(path.startsWith('__excalidraw_cli_smoke_')&&file.path===path,'Unowned stability cleanup');await app.vault.delete(file);}
    if(previous?.view.containerEl.isConnected)app.workspace.setActiveLeaf(previous,{focus:true});
    check(doc.querySelectorAll('.excalidraw-wrapper').length===beforeRoots,'Stability left an editor root');
  });
  const file=await app.vault.create(path,fixture);
  await c.waitFor(()=>p.isExcalidrawFile(file),'large fixture metadata');
  const timings=[],retired=[];
  c.observations=[];
  const loadState=()=>{const view=leaf?.view;return{at:Date.now(),leafId:leaf?.id,connected:view?.containerEl.isConnected,mainWindow:view?.containerEl.ownerDocument===doc,type:view?.getViewType?.(),file:view?.file?.path,isLoaded:view?.isLoaded,api:!!view?.excalidrawAPI,elements:view?.excalidrawAPI?.getSceneElements?.()?.length,justLoaded:view?.semaphores?.justLoaded,closing:view?.isClosingOrMigrating?.(),activeLeaf:app.workspace.activeLeaf?.id};};
  for(let cycle=0;cycle<cycles;cycle++){
    await c.case(`native:stability-roundtrip:${cycle}`,['P02','P07','P12'],async()=>{
      const start=performance.now();
      c.phase='stability cycle '+cycle+' opening';
      const observation={cycle};c.observations.push(observation);
      let anchor;app.workspace.iterateAllLeaves(l=>{if(!anchor&&l.getRoot()===app.workspace.rootSplit)anchor=l;});
      check(anchor,'No main-window anchor');app.workspace.setActiveLeaf(anchor,{focus:true});
      leaf=app.workspace.getLeaf('tab');await leaf.openFile(file);
      observation.opened=loadState();
      try{await c.waitFor(()=>leaf.view.excalidrawAPI&&leaf.view.isLoaded&&!leaf.view.semaphores.justLoaded&&!leaf.view.isClosingOrMigrating(),'large scene first commit',60000);}catch(error){observation.failed=loadState();throw error;}
      observation.ready=loadState();c.phase='stability cycle '+cycle+' save and reopen';
      const view=leaf.view,api=view.excalidrawAPI,elements=api.getSceneElements();
      check(elements.length===1000,'Large scene lost elements');
      check(elements.every((element,i)=>element.customData?.retainedUnknown?.value===i),'Large scene lost custom data');
      check(!retired.includes(api),'Reopen reused a retired API');
      api.updateScene({elements:elements.map((element,i)=>i?element:{...element,x:cycle+1,version:element.version+1,versionNonce:element.versionNonce+1}),captureUpdate:'IMMEDIATELY',forceFlushSync:true});
      await c.waitFor(()=>view.isDirty(),'large scene dirty revision');
      check((await view.saveWithOutcome()).status==='persisted','Large scene save not acknowledged');
      const disk=await app.vault.read(file),saved=await p.ea.getSceneFromFile(file);
      check(disk.includes('User Markdown retained.')&&saved.elements.length===1000&&saved.elements[0].x===cycle+1,'Large scene disk round trip differs');
      if(cycle===0){
        const runtime=p.getCLIRuntime(),exportStart=performance.now();
        const blob=await runtime.exportToBlob({elements:api.getSceneElements(),appState:{...api.getAppState(),exportBackground:true,exportScale:1},files:api.getFiles(),getDimensions:(width,height)=>({width:Math.ceil(width/4),height:Math.ceil(height/4),scale:0.25})});
        check(blob?.type==='image/png'&&blob.size>100,'Large scene PNG missing');
        const url=URL.createObjectURL(blob),image=new Image();
        try{image.src=url;await image.decode();check(image.naturalWidth>200&&image.naturalHeight>100,'Large scene PNG geometry missing');
          const canvas=createFragment().createEl('canvas');canvas.width=128;canvas.height=64;const context=canvas.getContext('2d');context.drawImage(image,0,0,128,64);
          const pixels=context.getImageData(0,0,128,64).data;let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]<200&&pixels[i+2]<200&&pixels[i+3]>0)red++;
          check(red>100,'Large scene PNG is blank');check(performance.now()-exportStart<60000,'Large scene export exceeded generous budget');
        }finally{URL.revokeObjectURL(url);}
      }
      retired.push(api);await leaf.setViewState({type:'empty',state:{}});leaf.detach();leaf=null;
      await c.waitFor(()=>!view.excalidrawAPI&&!view.containerEl.querySelector('.excalidraw-wrapper'),'old editor unmount');
      check(doc.querySelectorAll('.excalidraw-wrapper').length===beforeRoots,'Editor roots accumulate across reopen');
      const elapsed=performance.now()-start;check(elapsed<60000,'Large scene cycle exceeded generous budget');timings.push(elapsed);
      return {assertions:['1000 elements and unknown custom data retained','physical save and Markdown preserved','fresh API and retired root','bounded scene/export duration'],durationMs:elapsed};
    });
  }
  return {tests:c.tests,cycles,elements:1000,timingsMs:timings,observations:c.observations,limitations:'No forced-GC heap or physical-device performance claim; popout stress has its separate lifecycle lane.'};
}
