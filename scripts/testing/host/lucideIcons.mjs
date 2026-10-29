import { runLegacyTask } from './legacyTask.mjs';
/** #3019 live checks, restricted to fixtures owned by the guarded parent runner. */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { copyFileSync } from 'node:fs';
import {runLucideInteractionControl} from './lucideInteractionControl.mjs';

export async function runLucideScenario({cli,drawingPath,reportDir}) {
  const prefix=drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/,'')+'_lucide';
  assert.ok(prefix.startsWith('__excalidraw_cli_smoke_'));
  const paths={drawing:prefix+'.excalidraw.md',invalid:prefix+'_invalid.excalidraw.md',popout:prefix+'_popout.excalidraw.md',svg:prefix+'.svg',png:prefix+'.png'};
  const key='__lucide3019';
  const evaluate=code=>JSON.parse(cli('eval','code='+code).trim().replace(/^=>\s*/,''));
  const originalLayout=evaluate('JSON.stringify(app.workspace.getLayout())');
  const ordinaryInteraction=await runLucideInteractionControl({cli,drawingPath});
  const action=(command,values={})=>JSON.parse(cli('obsidian-excalidraw-plugin:'+command,'json='+JSON.stringify({apiVersion:1,...values})));
  const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
  let unsettled=false;
  let n=0;
  const id=()=>prefix.slice(-40)+'-'+(++n);
  const read=source=>ok(action('read',{path:paths.drawing,source,detail:'elements',limit:200})).data;
  try {
    const catalog=[];
    let page=ok(action('icons',{limit:200})).data;
    for(;;){catalog.push(...page.icons);if(page.nextOffset===null)break;page=ok(action('icons',{limit:200,offset:page.nextOffset,revision:page.revision})).data;}
    assert.ok(catalog.length>0);assert.ok(catalog.every(entry=>entry.icon.startsWith('lucide-')));
    const icons=[48,96,192].map((size,i)=>({id:'db'+i,icon:'database',x:i*240,y:0,size,roughness:0,strokeColor:'#0066ff'}));
    for(const [row,icon] of ['brain','ellipsis'].entries())for(const [i,size] of [48,96,192].entries())
      icons.push({id:icon+i,icon,x:i*240,y:400+row*240,size,roughness:0,strokeColor:'#0066ff'});
    const request={requestId:id(),path:paths.drawing,elements:[{id:'box',type:'rectangle',x:0,y:250,width:80,height:50}],icons};
    const created=ok(action('create',request));
    assert.equal(created.persistence,'saved');assert.equal(Object.keys(created.data.groupMap).length,icons.length);
    assert.equal(created.data.idMap.db0,undefined);
    assert.deepEqual(action('create',request),created);
    assert.equal(action('create',{...request,requestId:id()}).error.code,'ALREADY_EXISTS');
    for(const invalidIcons of [[{id:'good',icon:'database'},{id:'bad',icon:'not-installed-3019'}],[{id:'box',icon:'database'}],[{id:'repeat',icon:'dot'},{id:'repeat',icon:'dot'}]]) {
      const refused=action('create',{...request,path:paths.invalid,requestId:id(),icons:invalidIcons});
      assert.equal(refused.ok,false);assert.equal(refused.mutation,'not-applied');
      assert.equal(action('read',{path:paths.invalid,source:'disk'}).error.code,'NOT_FOUND');
    }
    const disk=read('disk');assert.equal(disk.assetIds.length,0);assert.ok(disk.elements.every(e=>e.type!=='image'));
    for(const [i,size] of [48,96,192].entries()) {
      const handle=created.data.groupMap['db'+i],members=disk.elements.filter(e=>handle.elementIds.includes(e.id));
      assert.ok(members.length>0);assert.ok(members.every(e=>e.groupIds.at(-1)===handle.groupId));
      assert.ok(members.every(e=>Math.abs(e.strokeWidth-size/12)<1e-6));
    }
    ok(action('open',{path:paths.drawing}));
    const live=read('live');
    const failed=action('apply',{requestId:id(),path:paths.drawing,expectedRevision:live.revision,operations:[{op:'lucide',id:'valid',icon:'database'},{op:'lucide',id:'bad',icon:'not-installed-3019'}]});
    assert.equal(failed.ok,false);assert.equal(failed.mutation,'not-applied');assert.equal(read('live').revision,live.revision);
    assert.equal(action('apply',{requestId:id(),path:paths.drawing,expectedRevision:'stale',operations:[{op:'lucide',id:'db',icon:'database'}]}).error.code,'STALE_REVISION');
    const applied=ok(action('apply',{requestId:id(),path:paths.drawing,view:live.viewId,expectedRevision:live.revision,operations:[{op:'lucide',id:'dot',icon:'dot',x:700,y:0,size:48,strokeWidth:3,opacity:60}]}));
    assert.equal(applied.persistence,'saved');assert.ok(applied.data.groupMap.dot);assert.equal(applied.data.idMap.dot,undefined);
    const dot=read('disk').elements.filter(e=>applied.data.groupMap.dot.elementIds.includes(e.id));
    assert.ok(dot.every(e=>e.groupIds.at(-1)===applied.data.groupMap.dot.groupId));
    const artifacts=[];
    for(const format of ['svg','png'])artifacts.push(ok(action('export',{requestId:id(),path:paths.drawing,source:'disk',out:paths[format]})).data);
    const vault=evaluate('JSON.stringify(app.vault.adapter.basePath)');
    copyFileSync(join(vault,paths.png),join(reportDir,'lucide-presets.png'));
    ok(action('create',{requestId:id(),path:paths.popout,elements:[]}));
    const probe=await runLegacyTask({cli,control:key,execute:probeLucide,args:[paths.drawing,drawingPath,catalog.map(e=>e.icon),paths.popout],timeoutMs:120000,cleanupMs:120000});
    const saved=read('disk');assert.equal(saved.assetIds.length,0);
    assert.ok(saved.elements.every(e=>e.type!=='image'));
    evaluate(`(async()=>{const p=app.plugins.plugins['obsidian-excalidraw-plugin'];const view=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===${JSON.stringify(paths.drawing)}).view;await p.lucidePicker.open(view);return JSON.stringify({open:true})})()`);
    cli('dev:screenshot','path='+join(reportDir,'lucide-picker.png'));
    return {id:'lucide-3019',status:'passed',evidenceKind:'native-cli-commands',transport:'native plugin CLI and trusted palette/UI',commands:['icons','create','read','open','apply','export'],ordinaryInteraction,catalog:catalog.length,artifacts,...probe.result};
  } catch(error) {unsettled=error.cleanupFailed===true;throw error;} finally {
    if(!unsettled)evaluate(`(async()=>{const p=app.plugins.plugins['obsidian-excalidraw-plugin'];p?.lucidePicker?.tab?.close();delete globalThis.${key};for(const path of ${JSON.stringify(Object.values(paths))}){if(!path.startsWith('__excalidraw_cli_smoke_'))throw Error('Not an owned fixture');for(const leaf of app.workspace.getLeavesOfType('excalidraw').filter(l=>l.view.file?.path===path)){await leaf.setViewState({type:'empty',state:{}});leaf.detach()}const file=app.vault.getFileByPath(path);if(file)await app.vault.delete(file)}await app.workspace.changeLayout(${JSON.stringify(originalLayout)});return JSON.stringify({clean:true,layoutRestored:true})})()`);
  }
}

async function probeLucide(key,path,otherPath,catalog,popoutPath) {
  const p=app.plugins.plugins['obsidian-excalidraw-plugin'];
  const check=(value,message)=>{if(!value)throw Error(message);};
  const wait=async(predicate,message)=>{const until=Date.now()+20000;while(!predicate()){if(Date.now()>until)throw Error('Lucide timeout: '+message);await new Promise(resolve=>setTimeout(resolve,30));}};
  const leaf=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===path),view=leaf.view,api=view.excalidrawAPI;
  const other=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===otherPath).view;
  const style={strokeColor:'#0066ff',roughness:2,opacity:70};
  const ea=p.ea.getAPI();let total=0,points=0,maxMs=0,conversions=0;const rejected=[];
  try {
    ea.setView(null);ea.style.strokeColor=style.strokeColor;ea.style.roughness=style.roughness;ea.style.opacity=style.opacity;
    const sentinel=ea.addRect(0,0,20,20),before=JSON.stringify(ea.getElement(sentinel)),styleBefore=JSON.stringify(ea.style);
    for(const size of [48,96,192])for(const icon of catalog) {
      const start=performance.now();let handle;
      try {handle=ea.addLucideIcon({icon,size});}
      catch(error){rejected.push({icon,size,error:String(error)});check(ea.getElements().length===1,'rejected icon changed workbench');continue;}
      maxMs=Math.max(maxMs,performance.now()-start);
      conversions++;
      check(handle.elementIds.length>0,'empty catalog construction '+icon);
      const elements=handle.elementIds.map(id=>ea.getElement(id));
      check(elements.every(e=>e.type!=='image'&&e.groupIds.at(-1)===handle.groupId),'non-native/missing group '+icon);
      total+=elements.length;points+=elements.reduce((sum,e)=>sum+(e.points?.length??0),0);
      for(const id of handle.elementIds)delete ea.elementsDict[id];
    }
    check(JSON.stringify(ea.getElement(sentinel))===before&&JSON.stringify(ea.style)===styleBefore,'EA construction mutated unrelated state');
    check(Object.keys(ea.imagesDict).length===0,'EA created image assets');
  } finally {ea.destroy();}
  const picker=p.lucidePicker;
  const originalStyle=api.getAppState();
  api.updateScene({appState:{viewModeEnabled:false,currentItemStrokeColor:style.strokeColor,currentItemRoughness:style.roughness,currentItemOpacity:style.opacity},captureUpdate:'NEVER',forceFlushSync:true});
  let popout;
  try {
    app.workspace.setActiveLeaf(leaf,{focus:true});
    const initial=api.getSceneElements().length;
    await picker.open(view);check(api.getSceneElements().length===initial,'opening inserted');
    const tab=picker.tab;check(tab,'picker missing');
    await picker.open(view);check(picker.tab===tab,'duplicate picker tab');
    app.workspace.setActiveLeaf(leaf,{focus:true});
    const trigger=Array.from(view.containerEl.querySelectorAll('button')).find(button=>button.getAttribute('title')===p.getLabel('COMP_IMG'));
    check(trigger,'image menu trigger missing');trigger.click();
    await wait(()=>view.ownerDocument.querySelector('[data-testid="toolbar-lucide"]'),'Lucide menu item');
    view.ownerDocument.querySelector('[data-testid="toolbar-lucide"]').click();
    await wait(()=>picker.revealing===0&&picker.target===view,'image menu picker action');
    check(picker.tab===tab,'image menu duplicated picker');
    const search=tab.contentEl.querySelector('input[type=search]'),select=tab.contentEl.querySelector('select');
    const event=type=>new tab.contentEl.ownerDocument.defaultView.Event(type,{bubbles:true});
    const filter=name=>{search.value=name;search.dispatchEvent(event('input'));};
    check(tab.contentEl.querySelectorAll('[data-icon]').length<=60,'unbounded DOM');
    const firstIcon=tab.contentEl.querySelector('[data-icon]').dataset.icon;
    const pageButtons=tab.contentEl.querySelectorAll('.excalidraw-lucide-pages button');
    pageButtons[1].click();
    check(tab.contentEl.querySelector('[data-icon]').dataset.icon!==firstIcon,'next icon page');
    check(tab.contentEl.querySelectorAll('[data-icon]').length<=60,'unbounded second page');
    pageButtons[0].click();
    check(tab.contentEl.querySelector('[data-icon]').dataset.icon===firstIcon,'previous icon page');
    filter('no-such-icon-3019');check(tab.contentEl.querySelectorAll('[data-icon]').length===0,'empty search');
    let lastIds=[];
    for(const size of [48,96,192]) {
      filter('database');select.value=String(size);select.dispatchEvent(event('change'));
      const button=tab.contentEl.querySelector('[data-icon="lucide-database"]');check(button&&!button.disabled,'picker insertion disabled');
      const before=new Set(api.getSceneElements().map(e=>e.id));
      if(size===48)button.click();
      else {
        const child=button.querySelector(size===96?'svg path, svg':'span');
        check(child,'thumbnail/label click target');
        child.dispatchEvent(new tab.contentEl.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
      }
      await wait(()=>!picker.busy,'UI insert/save');
      const members=api.getSceneElements().filter(e=>!before.has(e.id));
      lastIds=members.map(e=>e.id);
      check(members.length>0&&members.every(e=>Math.abs(e.strokeWidth-size/12)<1e-6&&e.roughness===2&&e.opacity===70),'UI preset/style');
      check(new Set(members.map(e=>e.groupIds.at(-1))).size===1,'UI outer group');
      check(members.every(e=>api.getAppState().selectedElementIds[e.id]),'UI selection');
    }
    api.updateScene({captureUpdate:'IMMEDIATELY',forceFlushSync:true});api.history.undo();
    await wait(()=>!api.getSceneElements().some(e=>lastIds.includes(e.id)),'icon undo');
    api.updateScene({captureUpdate:'IMMEDIATELY',forceFlushSync:true});api.history.redo();
    await wait(()=>lastIds.every(id=>api.getSceneElements().some(e=>e.id===id)),'icon redo');
    filter('database');search.focus();search.dispatchEvent(new tab.contentEl.ownerDocument.defaultView.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
    check(tab.contentEl.ownerDocument.activeElement?.hasAttribute('data-icon'),'keyboard navigation');
    const beforeOther=other.getViewElements().length;
    const otherIds=new Set(other.getViewElements().map(e=>e.id)),otherStyle=other.excalidrawAPI.getAppState();
    await picker.open(other);picker.tab.contentEl.querySelector('[data-icon="lucide-database"]').click();
    await wait(()=>!picker.busy,'other drawing insert');check(other.getViewElements().length>beforeOther,'picker redirected insertion');
    check(other.getViewElements().filter(e=>!otherIds.has(e.id)).every(e=>e.roughness===otherStyle.currentItemRoughness&&e.strokeColor===otherStyle.currentItemStrokeColor&&e.opacity===otherStyle.currentItemOpacity),'other drawing style');
    // A separate saved drawing in another document resolves through its actual editor ID.
    popout=app.workspace.openPopoutLeaf();
    // openPopoutLeaf returns before Obsidian moves the initially empty leaf.
    // Start the drawing load in its destination document, not the retiring main realm.
    await wait(()=>popout.view.containerEl.ownerDocument!==view.ownerDocument,'empty popout migration');
    await popout.setViewState({type:'excalidraw',state:{file:popoutPath}});
    try {await wait(()=>popout.view.excalidrawAPI&&!popout.view.excalidrawAPI.isDestroyed&&popout.view.isLoaded&&!popout.view.isClosingOrMigrating()&&popout.view.ownerDocument!==view.ownerDocument,'popout');}
    catch(error){throw Error(error.message+' '+JSON.stringify({type:popout.view.getViewType(),loaded:popout.view.isLoaded,closing:popout.view.isClosingOrMigrating?.(),file:popout.view.file?.path,differentDocument:popout.view.ownerDocument!==view.ownerDocument,api:!!popout.view.excalidrawAPI,leaves:app.workspace.getLeavesOfType('excalidraw').map(l=>({id:l.id,path:l.view.file?.path,closing:l.view.isClosingOrMigrating(),loaded:l.view.isLoaded}))}));}
    popout.view.excalidrawAPI.updateScene({appState:{viewModeEnabled:false},captureUpdate:'NEVER',forceFlushSync:true});
    p.runAction('lucide',popout.view.excalidrawAPI.id);
    await wait(()=>picker.target===popout.view,'scoped image action');
    try {await wait(()=>!picker.tab.contentEl.querySelector('[data-icon="lucide-database"]').disabled,'writable popout');}
    catch(error){throw Error(error.message+' '+JSON.stringify({target:picker.target?.id,expected:popout.view.id,writable:picker.writable(),busy:picker.busy,revealing:picker.revealing,loaded:popout.view.isLoaded,closing:popout.view.isClosingOrMigrating(),saving:popout.view.isPersistenceBusy(),viewMode:popout.view.excalidrawAPI.getAppState().viewModeEnabled,tabActive:picker.tab.isActiveTab(),status:picker.tab.contentEl.querySelector('.excalidraw-lucide-status').textContent}));}
    const beforePopout=popout.view.getViewElements().length;
    picker.tab.contentEl.querySelector('[data-icon="lucide-database"]').click();
    await wait(()=>!picker.busy&&popout.view.getViewElements().length>beforePopout,'popout insert');
    await picker.open(view);
    const count=api.getSceneElements().length,originalAdd=view.addElements;
    let release;
    try {
      view.addElements=async options=>{await new Promise(resolve=>{release=resolve;});return originalAdd.call(view,options);};
      picker.tab.contentEl.querySelector('[data-icon="lucide-database"]').click();
      await wait(()=>release,'deferred insertion');await picker.open(other);release();
      await wait(()=>!picker.busy,'stale insertion');check(api.getSceneElements().length===count,'stale target published');
    } finally {view.addElements=originalAdd;release?.();}
    picker.tab.close();await picker.open(view);check(picker.tab.contentEl.querySelector('select').value==='192','session size lost');
    check(picker.tab.contentEl.querySelector('input').value==='database','session search lost');
    await view.saveWithOutcome();
    return {catalogPresetConversions:conversions,rejectedCatalogInputs:rejected,totalElements:total,totalPoints:points,maxConversionMs:maxMs,imageMenu:true,uiPresets:true,gridPagination:true,nestedThumbnailClicks:true,undoRedo:true,keyboardNavigation:true,singleton:true,twoDrawings:true,popout:true,staleTarget:true,sessionReuse:true};
  } finally {
    picker.tab?.close();
    if(popout){const win=popout.view.containerEl.ownerDocument.defaultView;if(win===app.workspace.containerEl.ownerDocument.defaultView)throw Error('Lucide popout migrated unexpectedly');if(popout.view.isDirty?.())await popout.view.saveWithOutcome();win.close();const end=Date.now()+10000;while(!win.closed){if(Date.now()>end)throw Error('Lucide popout did not close');await new Promise(resolve=>setTimeout(resolve,25));}}
    if(view.excalidrawAPI===api)api.updateScene({appState:{currentItemStrokeColor:originalStyle.currentItemStrokeColor,currentItemRoughness:originalStyle.currentItemRoughness,currentItemOpacity:originalStyle.currentItemOpacity},captureUpdate:'NEVER'});
  }
}
