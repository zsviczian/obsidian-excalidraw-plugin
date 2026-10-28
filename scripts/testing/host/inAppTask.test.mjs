import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { parseCLIJSON, runInAppTask } from "./inAppTask.mjs";
function host() {
  const state = { setTimeout, clearTimeout, events: [] }; vm.createContext(state);
  return { state, cli(command, code) { assert.equal(command, "eval"); return String(vm.runInContext(code.slice(5), state)); } };
}
test("async native work completes cleanup before its controller disappears", async () => {
  const { cli, state } = host();
  const result = await runInAppTask({ cli, execute: async c => { c.defer(async () => { await Promise.resolve(); events.push("cleaned"); }); return { value: 42 }; } });
  assert.deepEqual(result, { value: 42 }); assert.deepEqual(state.events, ["cleaned"]);
  assert.equal(Object.keys(state).some(k => k.startsWith("__excalidrawTestTask_")), false);
});
test("timeout cancels condition waits, awaits cleanup, then propagates failure", async () => {
  const { cli, state } = host();
  await assert.rejects(runInAppTask({ cli, timeoutMs: 20, execute: async c => { c.defer(() => events.push("cancel cleanup")); await c.waitFor(() => false, "never ready"); } }), /deadline/);
  assert.deepEqual(state.events, ["cancel cleanup"]);
  assert.equal(Object.keys(state).some(k => k.startsWith("__excalidrawTestTask_")), false);
});
test("failed cleanup retains the controller and cannot become a pass", async () => {
  const { cli, state } = host();
  await assert.rejects(runInAppTask({ cli, execute: async c => { c.defer(() => { throw Error("owned resource leaked"); }); return true; } }), error => error.cleanupFailed && /leaked/.test(error.message));
  assert.equal(Object.keys(state).filter(k => k.startsWith("__excalidrawTestTask_")).length, 1);
});
test("host requests are acknowledged in order and produce explicit evidence", async () => {
  const { cli } = host(), requests = [];
  const result = await runInAppTask({ cli, execute: async c => ({ response: await c.requestHost("trusted-input", { key: "R" }) }), onRequest: request => { requests.push(request.method); return { dispatched: true }; } });
  assert.deepEqual(requests, ["trusted-input"]); assert.equal(result.response.dispatched, true);
});
test("CLI Error output is failure even with exit zero or preceding output", () => {
  for (const output of ["Error: unavailable", "=> Error: failed", "warning\nError: failed"]) assert.throws(() => parseCLIJSON(output), /CLI/);
});

test("async readiness predicates settle before the next native step", async () => {
  const { cli } = host();
  const result = await runInAppTask({ cli, execute: async c => {
    let checks = 0;
    await c.waitFor(async () => { await Promise.resolve(); return ++checks === 3; }, "async readiness");
    return checks;
  } });
  assert.equal(result, 3);
});

test("work and cleanup failures retain both causes and case evidence", async () => {
  const { cli, state } = host();
  await assert.rejects(runInAppTask({ cli, execute: async c => {
    c.defer(() => { throw Error("cleanup ownership lost"); });
    await c.case("owned:failure", ["P02"], async () => { throw Error("disk write failed"); });
  } }), error => error.cleanupFailed && /disk write failed/.test(error.message)
    && /cleanup ownership lost/.test(error.message) && error.evidence[0].status === "failed");
  assert.equal(Object.keys(state).filter(k => k.startsWith("__excalidrawTestTask_")).length, 1);
});
