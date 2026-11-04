import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  resizeNotification,
  splitWindowErrors,
  classifyCLIErrorText,
  settleBrowserDiagnostics,
  acquireBrowserDiagnostics,
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

test("large raw notification evidence is retrieved in bounded pages without chasing new events", () => {
  let removed = 0, pageCount = 0;
  const context = vm.createContext({ window: {
    addEventListener() {}, removeEventListener() { removed++; },
  } });
  const cli = (command, argument) => {
    assert.equal(command, "eval");
    const code = argument.slice(5);
    const result = vm.runInContext(code, context);
    assert.ok(Buffer.byteLength(result) < 256 * 1024, "simulated bounded CLI buffer");
    if (code.includes(".events.slice(") && ++pageCount === 1)
      context[key].events.push({ at: 999999, message: "arrived after the snapshot" });
    return result;
  };
  const observer = acquireBrowserDiagnostics(cli, "large-evidence");
  const key = Object.keys(context).find(key => key.startsWith("__excalidrawBrowserDiagnostics_"));
  const events = Array.from({ length: 10000 }, (_, at) => ({
    at, message: resizeNotification, isTrusted: true, hasError: false,
    source: "app://obsidian.md/index.html", context: "x".repeat(768),
  }));
  context[key].events.push(...events);
  assert.ok(Buffer.byteLength(JSON.stringify(events)) > 4 * 1024 * 1024);
  assert.deepEqual(observer.read(), events);
  assert.equal(context[key].events.length, events.length + 1);
  assert.equal(pageCount, Math.ceil(events.length / 128));
  observer.dispose(); observer.dispose();
  assert.equal(removed, 1);
  assert.equal(context[key], undefined);
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
  // A late event-loop callback cannot turn an exceeded deadline into a pass.
  const stalled = {
    ...win,
    setTimeout: (callback) => setTimeout(callback, 30),
  };
  assert.equal(
    (
      await settleBrowserDiagnostics(stalled, [], "late-callback", {
        quietMs: 10,
        timeoutMs: 20,
      })
    ).status,
    "failed",
  );
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
