/** Test-only receipts distinguish a completed operation from a lost CLI response without replay. */
import {randomUUID} from 'node:crypto';
import {existsSync,lstatSync,realpathSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {parseCLIJSON} from './inAppTask.mjs';
import {retryReadOnly} from './readOnlyTransport.mjs';
import {nativeReadyCode} from './hostReadiness.mjs';

/** Run once in the selected renderer; retain the outcome before returning it to CLI transport. */
export async function recordCLIResult(key, id, source) {
  const previous=globalThis[key];
  if(previous && (previous.owner!==key || previous.state!=='done')) throw Error('Unsettled or unowned CLI operation receipt');
  const receipt={owner:key,id,state:'pending'};
  globalThis[key]=receipt;
  try {
    const value=await eval(source);
    receipt.kind=typeof value;
    receipt.value=value;
    receipt.state='done';
    return value;
  } catch(error) {
    receipt.error=String(error?.stack||error);
    receipt.state='done';
    throw error;
  }
}

/** Own one bounded last-operation receipt across the serialized native sequence and mode reloads. */
export function createAcknowledgedCLI(run, {token=randomUUID().replaceAll('-',''),
  invoke=(name,args)=>run(name,...args), now=()=>Date.now(), wait,
  timeoutMs=60_000,responseTimeoutMs=1_000,readTimeoutMs=5_000,screenshotRoot}={}) {
  const key='__excalidrawCLIReceipt_'+token, diagnostics=[];
  let serial=0, used=false, disposed=false;
  const pause=new Int32Array(new SharedArrayBuffer(4));
  const waitForPoll=wait??(ms=>Atomics.wait(pause,0,0,ms));
  const read=(name,args,deadline=now()+timeoutMs)=>retryReadOnly(()=>invoke(name,args,Math.max(1,Math.min(readTimeoutMs,deadline-now()))),{operation:name,diagnostics,deadline,now});
  const snapshot=deadline=>parseCLIJSON(read('eval',[`code=JSON.stringify(globalThis[${JSON.stringify(key)}]??null)`],deadline));
  const cli=(name,...args)=>{
    if(disposed)throw Error('CLI receipt transport is disposed');
    const readOnly=['version','help','commands'].includes(name)
      || name==='vault'&&args.every(arg=>arg.startsWith('info='))
      || name==='dev:errors'&&args.length===0
      // Only this exact probe can cross a renderer reload without a receipt.
      || name==='eval'&&args.length===1&&args[0]==='code='+nativeReadyCode
      || /^obsidian-excalidraw-plugin:(help|status|skill|list|schema|api|read|result)$/.test(name);
    if(readOnly)return read(name,args);
    if(name==='dev:errors'&&args.length===1&&args[0]==='clear') {
      try{return invoke(name,args,responseTimeoutMs);}
      catch(error){
        if(!/\bETIMEDOUT\b/.test(error.message))throw error;
        // Do not clear again: a new diagnostic after the first clear must survive.
        if(read(name,[]).trim()!=='No errors captured.')throw error;
        diagnostics.push({operation:name,recovered:'confirmed empty error buffer',error:error.message});
        return '';
      }
    }
    if(name==='dev:screenshot'&&screenshotRoot) {
      const file=resolve(args.find(arg=>arg.startsWith('path='))?.slice(5)||'');
      const root=realpathSync(screenshotRoot),parent=realpathSync(dirname(file));
      if(parent!==root&&!parent.startsWith(root+sep))throw Error('Unowned screenshot destination');
      const existed=existsSync(file);
      if(existed&&!lstatSync(file).isFile())throw Error('Screenshot destination is not a regular file');
      const deadline=now()+timeoutMs;
      try{return invoke(name,args,responseTimeoutMs);}
      catch(error){
        if(!/\bETIMEDOUT\b/.test(error.message)||existed)throw error;
        // A unique fresh artifact is a completion receipt; never capture again.
        while(now()<deadline) {
          if(existsSync(file)&&lstatSync(file).isFile()) {
            const image=parseCLIJSON(read('eval',[`code=JSON.stringify((()=>{const image=require('@electron/remote').nativeImage.createFromPath(${JSON.stringify(file)});return {empty:image.isEmpty(),...image.getSize()}})())`],deadline));
            if(!image.empty&&image.width>0&&image.height>0) {
              diagnostics.push({operation:name,recovered:'decoded fresh screenshot',error:error.message});
              return '';
            }
          }
          waitForPoll(Math.min(50,Math.max(0,deadline-now())));
        }
        error.cleanupFailed=true;throw error;
      }
    }
    if(!['eval','dev:cdp'].includes(name))return run(name,...args);
    let source;
    if(name==='eval') {
      const code=args.find(arg=>arg.startsWith('code='));
      if(!code)return run(name,...args);
      source=code.slice(5);
    } else {
      const method=args.find(arg=>arg.startsWith('method='))?.slice(7);
      if(!method)throw Error('Missing native protocol method');
      const params=JSON.parse(args.find(arg=>arg.startsWith('params='))?.slice(7)||'{}');
      source=`(async()=>{const wc=require('@electron/remote').getCurrentWebContents();if(!wc.debugger.isAttached())throw Error('Native protocol debugger ownership missing');return JSON.stringify(await wc.debugger.sendCommand(${JSON.stringify(method)},${JSON.stringify(params)}))})()`;
    }
    const id=++serial;
    used=true;
    let output;
    const deadline=now()+timeoutMs;
    try {output=invoke('eval',[`code=(${recordCLIResult.toString()})(${JSON.stringify(key)},${id},${JSON.stringify(source)})`],Math.min(responseTimeoutMs,timeoutMs));}
    catch(error) {
      if(!/\bETIMEDOUT\b/.test(error.message))throw error;
      let receipt;
      try {
        for(;;) {
          receipt=snapshot(deadline);
          if(receipt?.owner===key&&receipt.id===id&&receipt.state==='done')break;
          if(receipt&&(receipt.owner!==key||receipt.id>id)||now()>=deadline)throw error;
          waitForPoll(Math.min(50,deadline-now()));
        }
      } catch(recoveryError) {
        recoveryError.cleanupFailed=true;
        recoveryError.observations={...recoveryError.observations,receiptKey:key,receipt,operation:name};
        throw recoveryError;
      }
      diagnostics.push({operation:name,id,recovered:'completed receipt',error:error.message});
      if(receipt.error)throw Error('Native operation failed before its CLI response was lost: '+receipt.error);
      if(!['string','undefined','boolean','number'].includes(receipt.kind))throw Error('Cannot reconstruct a non-primitive CLI result');
      output='=> '+String(receipt.value);
    }
    return name==='dev:cdp'?output.trim().replace(/^=>\s*/,''):output;
  };
  return {cli,diagnostics,key,dispose(){
    if(disposed)return;
    if(used) {
      try {
        parseCLIJSON(invoke('eval',[`code=(()=>{const c=globalThis[${JSON.stringify(key)}];if(c){if(c.owner!==${JSON.stringify(key)}||c.state!=='done')throw Error('Unsettled CLI receipt; preserve native work');delete globalThis[${JSON.stringify(key)}];}return JSON.stringify({disposed:true})})()`],readTimeoutMs));
      } catch(error) {
        if(!/\bETIMEDOUT\b/.test(error.message)||snapshot()!==null){error.cleanupFailed=true;throw error;}
        diagnostics.push({operation:'dispose CLI receipt',recovered:'confirmed absent',error:error.message});
      }
    }
    disposed=true;
  }};
}
