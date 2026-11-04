import assert from "node:assert/strict";
import test from "node:test";
import { waitForNativeReady } from "./hostReadiness.mjs";
test("reload polls the temporarily unavailable CLI registry, then verifies the actual runtime", async () => {
  let calls = 0, time = 0; const diagnostics = [];
  const result = await waitForNativeReady(() => { if (++calls < 3) throw Error('Command "eval" not found'); return '{"ready":true,"runtime":true,"mobile":true}'; }, { now: () => time, wait: async () => { time += 100; }, diagnostics });
  assert.equal(calls, 3); assert.equal(result.mobile, true); assert.equal(diagnostics.length, 1);
});
test("a package failure is not retried as host startup, and missing readiness has a deadline", async () => {
  await assert.rejects(waitForNativeReady(() => { throw Error("host protocol mismatch"); }), /protocol mismatch/);
  let time = 0;
  await assert.rejects(waitForNativeReady(() => '{"ready":false}', { timeoutMs: 200, now: () => time, wait: async () => { time += 100; } }), /readiness/);
});
