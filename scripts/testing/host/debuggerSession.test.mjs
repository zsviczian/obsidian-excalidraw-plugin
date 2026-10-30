import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import {
  acquireDebuggerSession,
  unexpectedConsoleErrors,
  completeConsoleErrors,
} from "./debuggerSession.mjs";
function host(attached = false, initialBackground = true) {
  let background = initialBackground;
  const debuggerInstance = new EventEmitter();
  debuggerInstance.isAttached = () => attached;
  const contents = {
    debugger: debuggerInstance,
    getBackgroundThrottling: () => background,
    setBackgroundThrottling: (value) => {
      background = value;
    },
  };
  const commands = [],
    context = vm.createContext({
      require: () => ({ getCurrentWebContents: () => contents }),
    });
  const cli = (command, ...args) => {
    commands.push([command, ...args]);
    if (command === "eval")
      return String(vm.runInContext(args[0].slice(5), context));
    if (command === "dev:debug") attached = args[0] === "on";
    return "";
  };
  return {
    cli,
    commands,
    debuggerInstance,
    context,
    background: () => background,
  };
}
test("an existing debugger is never stolen or detached", () => {
  const { cli, commands } = host(true);
  assert.throws(() => acquireDebuggerSession(cli), /already attached/);
  assert.equal(
    commands.some((command) => command[0] === "dev:debug"),
    false,
  );
});
test("owned console and exception capture is removed with its exact attachment", () => {
  const { cli, commands, debuggerInstance, context } = host();
  const session = acquireDebuggerSession(cli);
  debuggerInstance.emit("message", null, "Runtime.consoleAPICalled", {
    type: "error",
    args: [{ description: "actual failure" }],
  });
  debuggerInstance.emit("message", null, "Runtime.executionContextCreated", {
    context: { id: 4, name: "owned test context" },
  });
  debuggerInstance.emit("message", null, "Runtime.exceptionThrown", {
    exceptionDetails: {
      executionContextId: 4,
      text: "Uncaught",
      exception: { type: "string", value: "actual primitive exception" },
    },
  });
  assert.equal(session.read().length, 2);
  assert.equal(session.read()[1].messages[0], "actual primitive exception");
  assert.equal(session.read()[1].context.name, "owned test context");
  assert.ok(
    commands.findIndex((command) =>
      command.includes("method=Runtime.disable"),
    ) <
      commands.findIndex((command) =>
        command.includes("method=Runtime.enable"),
      ),
  );
  session.dispose();
  session.dispose();
  assert.equal(debuggerInstance.listenerCount("message"), 0);
  assert.equal(
    Object.keys(context).some((key) =>
      key.startsWith("__excalidrawTestConsole_"),
    ),
    false,
  );
  assert.equal(
    commands.filter(
      (command) => command[0] === "dev:debug" && command[1] === "off",
    ).length,
    1,
  );
});
test("expected fault injection cannot hide another error or an incorrect count", () => {
  const expected = [{ contains: "OWNED_WRITE_FAILURE", min: 1, max: 1 }],
    error = { kind: "console", messages: ["OWNED_WRITE_FAILURE"] };
  assert.deepEqual(unexpectedConsoleErrors([error], expected), []);
  assert.equal(unexpectedConsoleErrors([error, error], expected).length, 1);
  assert.equal(
    unexpectedConsoleErrors(
      [error, { messages: ["unrelated failure"] }],
      expected,
    ).length,
    1,
  );
  assert.equal(unexpectedConsoleErrors([], expected).length, 1);
  assert.equal(
    unexpectedConsoleErrors([error, { ...error, kind: "exception" }], expected)
      .length,
    1,
  );
});

test("lost console controller fails cleanup but still releases our debugger attachment", () => {
  const { cli, commands, context } = host();
  const session = acquireDebuggerSession(cli);
  const key = Object.keys(context).find((key) =>
    key.startsWith("__excalidrawTestConsole_"),
  );
  assert.ok(key);
  vm.runInContext("delete globalThis[" + JSON.stringify(key) + "]", context);
  assert.throws(() => session.dispose(), /controller disappeared/);
  assert.equal(
    commands.filter(
      (command) => command[0] === "dev:debug" && command[1] === "off",
    ).length,
    1,
  );
});

test("renderer scheduling is scoped and restores both original background-throttling values", () => {
  for (const original of [true, false]) {
    const h = host(false, original),
      session = acquireDebuggerSession(h.cli);
    assert.equal(h.background(), false);
    assert.equal(session.scheduling.originalBackgroundThrottling, original);
    session.dispose();
    session.dispose();
    assert.equal(h.background(), original);
  }
});

test("expected missing-asset diagnostics cannot hide exceptions, extra fields, another source or repeated errors", () => {
  const rule = {
    containsAll: [
      "EmbeddedFileLoader._getObsidianImage",
      "owned-source.svg",
      "depth=0",
    ],
    excludes: ["name=error", "[preview truncated]"],
    min: 1,
    max: 1,
  };
  const good = {
    kind: "console",
    messages: ["EmbeddedFileLoader._getObsidianImage owned-source.svg depth=0"],
  };
  assert.deepEqual(unexpectedConsoleErrors([good], [rule]), []);
  for (const other of [
    { ...good, kind: "exception" },
    {
      kind: "console",
      messages: [
        "EmbeddedFileLoader._getObsidianImage other-source.svg depth=0",
      ],
    },
    { kind: "console", messages: [good.messages[0] + " name=error"] },
    { kind: "console", messages: [good.messages[0] + " [preview truncated]"] },
  ])
    assert.ok(unexpectedConsoleErrors([other], [rule]).length);
  assert.ok(unexpectedConsoleErrors([good, good], [rule]).length);
});

test("truncated console objects expose the actual native error and complete own properties", async () => {
  const error = {
    kind: "console",
    overflowArgs: [
      { objectId: "outer", description: "Object", preview: { overflow: true } },
    ],
    messages: [],
  };
  const objects = {
    outer: [
      { name: "file", value: { type: "string", value: "owned-source.svg" } },
      {
        name: "error",
        value: {
          type: "object",
          subtype: "error",
          objectId: "native-error",
          description: "Error: ENOENT",
        },
      },
    ],
    "native-error": [
      { name: "code", value: { type: "string", value: "ENOENT" } },
      { name: "path", value: { type: "string", value: "owned-source.svg" } },
    ],
  };
  const c = {
    errors: [error],
    debugger: {
      sendCommand: async (method, params) => {
        assert.equal(method, "Runtime.getProperties");
        assert.equal(params.ownProperties, true);
        return { result: objects[params.objectId] };
      },
    },
  };
  assert.equal((await completeConsoleErrors(c))[0], error);
  assert.match(
    error.messages[0],
    /"name":"code","type":"string","value":"ENOENT"/,
  );
  assert.equal(error.messages[0].includes("[preview truncated]"), false);
  assert.equal(error.overflowArgs, undefined);
  objects["native-error"].push({
    name: "cause",
    value: { type: "object", objectId: "uninspected" },
  });
  error.overflowArgs = [{ objectId: "outer", preview: { overflow: true } }];
  await completeConsoleErrors(c);
  assert.match(error.messages[0], /\[preview truncated\]/);
});
