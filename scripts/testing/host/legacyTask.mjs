/** Retire polling-only native probes through the shared settle-before-cleanup contract. */
import assert from 'node:assert/strict';
import {runInAppTask} from './inAppTask.mjs';
export async function runLegacyTask({cli,control,execute,cleanup=async()=>{},args=[],timeoutMs=120000,cleanupMs=180000}){
  assert.match(control,/^__[a-zA-Z0-9_]+$/,'Legacy controller must be a named owned test global');
  // Both functions are local repository helpers, serialized exactly as existing
  // native probes are. No remote code, production instrumentation or source-coverage credit.
  const adapter=new Function(`return async function(c,control,args){
    if(globalThis[control])throw Error('Existing native controller: '+control);
    const legacy={state:'pending'};globalThis[control]=legacy;
    Object.defineProperty(legacy,'cancelled',{get:()=>c.cancelled});
    Object.defineProperty(c,'phase',{get:()=>control+': '+(legacy.results?.length??0)+' completed cases'});
    c.defer(async()=>{await (${cleanup.toString()})(control);if(legacy.cleanupFailed)throw Error(legacy.cleanupFailed);if(globalThis[control]===legacy)delete globalThis[control];});
    try{c.checkpoint();const result=await (${execute.toString()})(control,...args);return {result,results:legacy.results,reopen:legacy.reopen};}
    catch(error){if(error.cleanupFailed)legacy.cleanupFailed=String(error);throw error;}
  }`)();
  try{return await runInAppTask({cli,execute:adapter,args:[control,args],timeoutMs,cleanupMs,onProgress:phase=>process.stdout.write('[native] '+phase+'\n')});}
  catch(error){error.message+='; legacy controller: '+control;throw error;}
}

/** Await an entire existing host operation before its caller may restore or delete resources. */
export function runHostFunction({cli,execute,args=[],helpers=[],timeoutMs=60000,cleanupMs=120000}){
  const adapter=new Function(`return async function(c,...args){${helpers.map(helper=>helper.toString()).join(';')} c.checkpoint();return await (${execute.toString()})(...args);}`)();
  return runInAppTask({cli,execute:adapter,args,timeoutMs,cleanupMs});
}
