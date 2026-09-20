import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { SameFileEditGate } = await jiti.import(
  "../src/view/managers/SameFileEditGate.ts",
);

const log = (message) => process.stdout.write(`${message}\n`);
const createFakeWindow = () => {
  const timers = new Map();
  const cleared = [];
  let nextTimer = 1;
  return {
    timers,
    cleared,
    setTimeout(callback) {
      const timer = nextTimer++;
      timers.set(timer, callback);
      return timer;
    },
    clearTimeout(timer) {
      cleared.push(timer);
      timers.delete(timer);
    },
  };
};
const runOnlyTimer = (ownerWindow) => {
  assert.equal(ownerWindow.timers.size, 1);
  const [timer, callback] = ownerWindow.timers.entries().next().value;
  ownerWindow.timers.delete(timer);
  callback();
};

const firstWindow = createFakeWindow();
const secondWindow = createFakeWindow();
let currentWindow = firstWindow;
const gate = new SameFileEditGate(() => currentWindow);

gate.acquire("canvas:a");
gate.acquire("canvas:a");
gate.acquire("markdown:b");
assert.equal(gate.hasActiveOwners, true);
assert.equal(gate.isInGracePeriod, false);
assert.equal(gate.isBlocked, true);

gate.release("canvas:a", 2000);
assert.equal(gate.hasActiveOwners, true, "the second owner remains active");
assert.equal(gate.isInGracePeriod, true);
runOnlyTimer(firstWindow);
assert.equal(gate.isBlocked, true, "one owner's grace cannot unblock another");

gate.release("markdown:b", 2000);
const staleRelease = firstWindow.timers.values().next().value;
currentWindow = secondWindow;
gate.acquire("markdown:b");
assert.equal(firstWindow.timers.size, 0, "reacquire cancels in the timer's realm");
staleRelease();
assert.equal(gate.isBlocked, true, "a stale callback cannot unblock reacquired ownership");

gate.release("markdown:b", 2000);
assert.equal(secondWindow.timers.size, 1);
gate.release("markdown:b", 2000);
assert.equal(
  secondWindow.timers.size,
  1,
  "repeated release refreshes only the same owner's grace",
);
runOnlyTimer(secondWindow);
assert.equal(gate.hasActiveOwners, false);
assert.equal(gate.isInGracePeriod, false);
assert.equal(gate.isBlocked, false);

gate.acquire("canvas:legacy");
gate.release("canvas:legacy", 2000);
gate.cancelRelease("canvas:legacy");
assert.equal(
  gate.hasActiveOwners,
  true,
  "canceling a legacy release restores active ownership",
);
assert.equal(secondWindow.timers.size, 0);
gate.release("canvas:legacy", 0);

gate.release("unknown", 2000);
assert.equal(gate.isBlocked, false, "unknown release is an idempotent no-op");
gate.acquire("canvas:c");
gate.release("canvas:c", 2000);
gate.destroy();
assert.equal(secondWindow.timers.size, 0);
assert.equal(gate.isBlocked, false);

log("same-file edit gate checks passed");
