import assert from "node:assert/strict";
import test from "node:test";
import { closeMarkdownImageTab } from "./markdownImageClose.mjs";

test("Markdown-image fixture retirement waits for asynchronous owner release and persistence", async () => {
  let clock = 0, closes = 0, released = false, saved = false;
  const view = { sameFileEditGate: { get hasActiveOwners() { return !released; } },
    isSaveInProgress: () => !saved };
  const c = { tab: { close() { closes++; } } };
  await closeMarkdownImageTab(c, view, { now: () => clock, wait: async ms => {
    assert.equal(c.closingView, view, "pending close retains recovery ownership");
    clock += ms;
    if (clock >= 25) released = true;
    if (clock >= 50) saved = true;
  } });
  assert.equal(closes, 1);
  assert.equal(clock, 50);
  assert.equal(c.closingView, null);
  assert.equal(c.tab, null);
});

test("a close deadline fails and retains the live owner without cancelling native work", async () => {
  let clock = 0;
  const view = { sameFileEditGate: { hasActiveOwners: true }, isSaveInProgress: () => false };
  const c = { tab: { close() {} } };
  await assert.rejects(closeMarkdownImageTab(c, view, {
    timeoutMs: 50, now: () => clock, wait: async ms => { clock += ms; },
  }), error => error.cleanupFailed === true && /preserve/.test(error.message));
  assert.equal(c.closingView, view);
  assert.equal(view.sameFileEditGate.hasActiveOwners, true);
});
