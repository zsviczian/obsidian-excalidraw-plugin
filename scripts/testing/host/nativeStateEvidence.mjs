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
  const slots=target=>Object.fromEntries(Object.entries(target?._events||{}).map(([key,value])=>[key,Array.isArray(value)?value.length:null]));
  const active=workspace.activeLeaf,editor=workspace.activeEditor;
  const element=e=>e?{tag:e.tagName,classes:typeof e.className==='string'?e.className:undefined,role:e.getAttribute?.('role'),label:e.getAttribute?.('aria-label')}:null;
  const leaves=[];
  workspace.iterateAllLeaves(leaf=>{const view=leaf.view,owner=view?.containerEl?.ownerDocument;leaves.push({id:leaf.id,parent:leaf.parent?.id,type:view?.getViewType?.(),file:view?.file?.path,connected:view?.containerEl?.isConnected,main:owner===doc,ownerClosed:owner?.defaultView?.closed,loaded:view?.isLoaded,api:!!view?.excalidrawAPI,busy:view?.isPersistenceBusy?.(),listeners:slots(view)});});
  const wc=require('@electron/remote').getCurrentWebContents();
  return {label,at:Date.now(),settings,layout:workspace.getLayout(),activeLeaf:active?.id,activeEditor:{type:editor?.getViewType?.(),file:editor?.file?.path,hasEditor:!!editor?.editor,main:editor?.containerEl?.ownerDocument===doc},mainWindow:{focused:doc.hasFocus(),visibility:doc.visibilityState,width:doc.defaultView.innerWidth,height:doc.defaultView.innerHeight,activeElement:element(doc.activeElement),backgroundThrottling:wc.getBackgroundThrottling(),debuggerAttached:wc.debugger.isAttached(),debuggerMessageListeners:wc.debugger.listenerCount('message')},popouts:workspace.floatingSplit.children.map(window=>({id:window.id,closed:window.doc?.defaultView?.closed,focused:window.doc?.hasFocus(),activeElement:element(window.doc?.activeElement)})),leaves,workspaceListeners:slots(workspace),pluginListeners:slots(plugin),roots:doc.querySelectorAll('.excalidraw-wrapper').length,printRoots:doc.querySelectorAll('body > .print').length,controllers:Object.keys(globalThis).filter(key=>key.startsWith('__excalidrawTestTask_')||key.startsWith('__excalidrawBrowserDiagnostics_')||key.startsWith('__excalidrawTestConsole_'))};
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
