/** Opt-in passive boundary evidence for ordered native reductions; never restores or changes state. */
import {parseCLIJSON} from './inAppTask.mjs';

export const stateEvidenceEnabled=()=>process.env.EXCALIDRAW_TEST_STATE_EVIDENCE==='1';

export function captureNativeState(cli,label){
  return parseCLIJSON(cli('eval','code=JSON.stringify(('+readNativeState.toString()+')('+JSON.stringify(label)+'))'));
}

/** Serialized into the main test-vault realm. No layout measurement, focus, observer or scheduling writes. */
export function readNativeState(label){
  const workspace=app.workspace,doc=workspace.containerEl.ownerDocument;
  const plugin=app.plugins.plugins['obsidian-excalidraw-plugin'];
  const digest=value=>require('crypto').createHash('sha256').update(JSON.stringify(value)??'undefined').digest('hex');
  const settings=Object.fromEntries(Object.keys(plugin?.settings||{}).sort().map(key=>[key,digest(plugin.settings[key])]));
  const slots=target=>{
    // Events owns name -> EventRef[] in `_`; Component owns cleanup callbacks
    // in `_events`. Missing internals are unavailable evidence, never zero.
    if(target?._&&typeof target._==='object'&&!Array.isArray(target._))return {kind:'Events',counts:Object.fromEntries(Object.entries(target._).map(([key,value])=>[key,Array.isArray(value)?value.length:null]))};
    if(Array.isArray(target?._events))return {kind:'Component',cleanupCallbacks:target._events.length};
    return {kind:'unavailable'};
  };
  const active=workspace.activeLeaf,editor=workspace.activeEditor;
  const element=e=>e?{tag:e.tagName,classes:typeof e.className==='string'?e.className:undefined,role:e.getAttribute?.('role'),label:e.getAttribute?.('aria-label')}:null;
  const leaves=[];
  workspace.iterateAllLeaves(leaf=>{const view=leaf.view,owner=view?.containerEl?.ownerDocument;leaves.push({id:leaf.id,parent:leaf.parent?.id,type:view?.getViewType?.(),file:view?.file?.path,connected:view?.containerEl?.isConnected,main:owner===doc,ownerClosed:owner?.defaultView?.closed,loaded:view?.isLoaded,api:!!view?.excalidrawAPI,busy:view?.isPersistenceBusy?.(),listeners:slots(view)});});
  const wc=require('@electron/remote').getCurrentWebContents();
  const popouts=workspace.floatingSplit.children.map(window=>{
    const win=window.doc?.defaultView,contents=win&&!win.closed?win.require('@electron/remote').getCurrentWebContents():null;
    return {id:window.id,closed:win?.closed,focused:window.doc?.hasFocus(),activeElement:element(window.doc?.activeElement),contentsId:contents?.id,backgroundThrottling:contents?.getBackgroundThrottling(),debuggerAttached:contents?.debugger.isAttached(),debuggerMessageListeners:contents?.debugger.listenerCount('message')};
  });
  return {label,at:Date.now(),settings,layout:workspace.getLayout(),activeLeaf:active?.id,activeEditor:{type:editor?.getViewType?.(),file:editor?.file?.path,hasEditor:!!editor?.editor,main:editor?.containerEl?.ownerDocument===doc},mainWindow:{contentsId:wc.id,focused:doc.hasFocus(),visibility:doc.visibilityState,width:doc.defaultView.innerWidth,height:doc.defaultView.innerHeight,activeElement:element(doc.activeElement),backgroundThrottling:wc.getBackgroundThrottling(),debuggerAttached:wc.debugger.isAttached(),debuggerMessageListeners:wc.debugger.listenerCount('message')},popouts,leaves,workspaceListeners:slots(workspace),vaultListeners:slots(app.vault),metadataListeners:slots(app.metadataCache),pluginListeners:slots(plugin),roots:doc.querySelectorAll('.excalidraw-wrapper').length,printRoots:doc.querySelectorAll('body > .print').length,controllers:Object.keys(globalThis).filter(key=>key.startsWith('__excalidrawTestTask_')||key.startsWith('__excalidrawBrowserDiagnostics_')||key.startsWith('__excalidrawTestConsole_'))};
}

/** Adds only passive before/after records; original case identity/assertions and cleanup remain owned by the task. */
export function installStateEvidence(c,read){
  const states=[];
  const record=label=>states.push(read(label));
  const run=c.case.bind(c);
  c.case=async(id,...args)=>{record('before:'+id);try{return await run(id,...args);}finally{record('after:'+id);}};
  c.defer(()=>record('after:lifecycle-cleanup'));
  record('before:lifecycle');
  return states;
}
