import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {runLegacyTask} from './legacyTask.mjs';
function host(){const state={setTimeout,clearTimeout,events:[]};vm.createContext(state);return {state,cli(command,code){assert.equal(command,'eval');return String(vm.runInContext(code.slice(5),state));}};}
test('timed-out legacy work settles before cleanup and controller removal',async()=>{
  const {state,cli}=host();
  await assert.rejects(runLegacyTask({cli,control:'__legacy_owned',timeoutMs:10,cleanupMs:1000,execute:async()=>{events.push('started');await new Promise(resolve=>setTimeout(resolve,150));events.push('finished');},cleanup:async()=>{events.push('cleanup');}}),/deadline/);
  assert.deepEqual(state.events,['started','finished','cleanup']);
  assert.equal(vm.runInContext('Object.keys(globalThis).some(key=>key.startsWith("__"))',state),false);
});
test('failed legacy cleanup retains both controllers for guarded recovery',async()=>{
  const {state,cli}=host();
  await assert.rejects(runLegacyTask({cli,control:'__legacy_failed',execute:async()=>{},cleanup:async()=>{throw Error('owned resource leaked');}}),error=>error.cleanupFailed&&/resource leaked/.test(error.message));
  assert.equal(vm.runInContext('!!globalThis.__legacy_failed',state),true);
  assert.equal(Object.keys(state).filter(key=>key.startsWith('__excalidrawTestTask_')).length,1);
});

test('parent cancellation reaches the legacy loop before owned cleanup',async()=>{
  const {state,cli}=host();
  await assert.rejects(runLegacyTask({cli,control:'__legacy_cancelled',timeoutMs:10,cleanupMs:1000,
    execute:async control=>{while(!globalThis[control].cancelled)await new Promise(resolve=>setTimeout(resolve,5));events.push('observed cancellation');},
    cleanup:async()=>{events.push('cleaned');}}),error=>/deadline/.test(error.message)&&!error.cleanupFailed);
  assert.deepEqual(state.events,['observed cancellation','cleaned']);
  assert.equal(Object.keys(state).some(key=>key.startsWith('__')),false);
});

test('a legacy operation reports its own failed cleanup and retains recovery ownership',async()=>{
  const {state,cli}=host();
  await assert.rejects(runLegacyTask({cli,control:'__legacy_cleanup_in_work',execute:async()=>{const error=Error('owned server/view did not close');error.cleanupFailed=true;throw error;}}),error=>error.cleanupFailed&&/did not close/.test(error.message));
  assert.ok(state.__legacy_cleanup_in_work);
  assert.equal(Object.keys(state).filter(key=>key.startsWith('__excalidrawTestTask_')).length,1);
});
