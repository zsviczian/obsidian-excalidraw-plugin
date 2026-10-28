/** Test-only async tasks: cancel, await owned cleanup, then permit fixture deletion. */
import { randomUUID } from "node:crypto";

export function parseCLIJSON(output) {
  const value = output.trim().replace(/^=>\s*/, "");
  if (/^Error:/m.test(value)) throw Error(`Obsidian CLI: ${value.slice(0, 1000)}`);
  try { return JSON.parse(value); } catch { throw Error(`Expected JSON from Obsidian CLI: ${value.slice(0, 500)}`); }
}

export async function runInAppTask({ cli, execute, args = [], timeoutMs = 60_000, cleanupMs = 30_000,
  onRequest, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now(), token = randomUUID().replaceAll("-", "") }) {
  const key = `__excalidrawTestTask_${token}`;
  const evaluate = code => parseCLIJSON(cli("eval", "code=" + code));
  evaluate(`(${installTask.toString()})(${JSON.stringify(key)},${execute.toString()},${JSON.stringify(args)})`);
  const read = () => evaluate(`JSON.stringify((()=>{const c=globalThis[${JSON.stringify(key)}];return c?{state:c.state,result:c.result,error:c.error,tests:c.tests,cleanup:c.cleanup,cleanupErrors:c.cleanupErrors,cleanupPending:c.cleanupPending,phase:c.phase,request:c.request}:{state:'missing'}})())`);
  let state, originalError;
  try {
    const end = now() + timeoutMs;
    for (;;) {
      state = read();
      if (state.state === "done") {
        if (state.error) { const error = Error(state.error); error.evidence = state.tests; throw error; }
        if (state.cleanup !== "passed") throw Error("Native task cleanup failed: " + state.cleanupErrors.join("; "));
        return state.result;
      }
      if (state.state === "cleaning" && state.error) { const error = Error(state.error); error.evidence = state.tests; throw error; }
      if (state.state === "missing") throw Error("Native task controller disappeared");
      if (now() >= end) throw Error("Native task deadline exceeded");
      if (state.request) {
        if (!onRequest) throw Error("No trusted-input/screenshot driver available");
        const response = await onRequest(state.request);
        evaluate(`(()=>{const c=globalThis[${JSON.stringify(key)}];if(c?.request?.id!==${JSON.stringify(state.request.id)})throw Error('Task request ownership changed');c.response=${JSON.stringify(response ?? null)};delete c.request;return JSON.stringify({acknowledged:true})})()`);
      }
      await wait(50);
    }
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    const end = now() + cleanupMs;
    try {
      evaluate(`(()=>{const c=globalThis[${JSON.stringify(key)}];if(c)c.cancelled=true;return JSON.stringify({cancelled:!!c})})()`);
      for (;;) {
        state = read();
        if (state.state === "done") break;
        if (state.state === "missing" || now() >= end) throw Error("Native task did not settle; preserve owned fixtures for recovery");
        await wait(50);
      }
      if (state.cleanup !== "passed") throw Error("Native task cleanup failed: " + state.cleanupErrors.join("; "));
      evaluate(`(()=>{delete globalThis[${JSON.stringify(key)}];return JSON.stringify({removed:true})})()`);
    } catch (cleanupError) {
      const error = new Error(`${originalError?.message || "Native task"}; ${cleanupError.message}`, { cause: originalError || cleanupError });
      error.evidence = state?.tests || originalError?.evidence;
      error.cleanupFailed = true; throw error;
    }
  }
}

/** Entire implementation is serialized into the real host, never shipped in main.js. */
function installTask(key, execute, args) {
  if (globalThis[key]) throw Error("Native task ownership collision");
  const c = { state: "running", cancelled: false, cleanup: "not-started", cleanupErrors: [], disposers: [], requestId: 0, tests: [] };
  globalThis[key] = c;
  c.checkpoint = () => { if (c.cancelled) throw Error("Native task cancelled"); };
  c.waitFor = async (predicate, label, timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    for (;;) { c.checkpoint(); const ready = await predicate(); c.checkpoint(); if (ready) return; if (Date.now() >= end) throw Error(`Timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 25)); }
  };
  c.waitForCleanup = async (predicate, label, timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    while (!(await predicate())) { if (Date.now() >= end) throw Error(`Cleanup timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 25)); }
  };
  c.requestHost = async (method, params) => {
    c.checkpoint(); if (c.request) throw Error("Concurrent host requests are not supported");
    c.request = { id: ++c.requestId, method, params };
    await c.waitFor(() => !c.request, `host ${method}`);
    return c.response;
  };
  c.defer = callback => c.disposers.push(callback);
  c.case = async (testId, featureIds, executeCase) => {
    c.checkpoint();
    c.activeCase=testId;
    try {
      const evidence = await executeCase();
      if (!evidence?.assertions?.length) throw Error('Native case has no assertion evidence');
      c.tests.push({ testId, featureIds, status: 'passed', ...evidence });
    } catch (error) {
      c.tests.push({ testId, featureIds, status: 'failed', reason: String(error.stack || error) });
      throw error;
    } finally { delete c.activeCase; }
  };
  c.task = (async () => {
    try { c.result = await execute(c, ...args); } catch (error) { c.error = String(error.stack || error); }
    finally {
      c.state = "cleaning";
      for (const [index, dispose] of c.disposers.reverse().entries()) {
        c.cleanupPending = index;
        try { await dispose(); } catch (error) { c.cleanupErrors.push(String(error)); }
      }
      delete c.cleanupPending;
      c.cleanup = c.cleanupErrors.length ? "failed" : "passed";
      c.state = "done";
    }
  })();
  return JSON.stringify({ started: true });
}
