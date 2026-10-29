import assert from "node:assert/strict";
import test from "node:test";
import {
  resizeNotification,
  splitWindowErrors,
  classifyCLIErrorText,
  settleBrowserDiagnostics,
} from "./browserDiagnostics.mjs";

test("only the exact browser notification without an Error object is diagnostic", () => {
  const allowed = {
    message: resizeNotification,
    hasError: false,
    isTrusted: true,
    at: 1,
  };
  const others = [
    { message: resizeNotification, hasError: true },
    { message: resizeNotification, hasError: false, stack: "Error stack" },
    { message: "prefix " + resizeNotification, hasError: false },
    { message: "unrelated", hasError: false },
    { message: resizeNotification },
    { message: resizeNotification, hasError: false, isTrusted: false },
  ];
  assert.deepEqual(splitWindowErrors([allowed, ...others]), {
    diagnostics: [allowed],
    unexpected: others,
  });
});
test("CLI classification retains raw lines and rejects exceptions, suffixes and unknown formats", () => {
  const raw =
    "13:00:00 " +
    resizeNotification +
    "\n\n13:00:01 TypeError: broken\n13:00:02 " +
    resizeNotification +
    " extra\nError: " +
    resizeNotification;
  const result = classifyCLIErrorText(raw);
  assert.equal(result.raw, raw);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.unexpected.length, 3);
});
test("a stable quiet window settles without altering browser events or geometry", async () => {
  const win = {
    closed: false,
    document: { querySelectorAll: () => [] },
    setTimeout,
  };
  const result = await settleBrowserDiagnostics(win, [], "control", {
    quietMs: 1,
    timeoutMs: 500,
  });
  assert.equal(result.status, "passed");
  assert.ok(result.samples.length >= 2);
});
test("persistent notification storms fail the bounded idle check", async () => {
  const events = [],
    win = {
      closed: false,
      document: { querySelectorAll: () => [] },
      setTimeout: (callback) =>
        setTimeout(() => {
          events.push({ message: resizeNotification });
          callback();
        }, 5),
    };
  const result = await settleBrowserDiagnostics(win, events, "storm", {
    quietMs: 30,
    timeoutMs: 60,
  });
  assert.equal(result.status, "failed");
  assert.ok(events.length > 1);
});
test("unstable geometry fails even without any notification", async () => {
  let width = 0;
  const el = {
    isConnected: true,
    className: "workspace-leaf",
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: ++width, height: 100 }),
  };
  const win = {
    closed: false,
    document: { querySelectorAll: () => [el] },
    setTimeout: (callback) => setTimeout(callback, 5),
  };
  assert.equal(
    (
      await settleBrowserDiagnostics(win, [], "broken-layout", {
        quietMs: 30,
        timeoutMs: 60,
      })
    ).status,
    "failed",
  );
});
