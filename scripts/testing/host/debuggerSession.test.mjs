import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import { acquireDebuggerSession, unexpectedConsoleErrors } from "./debuggerSession.mjs";
function host(attached = false) {
  const debuggerInstance = new EventEmitter(); debuggerInstance.isAttached = () => attached;
  const commands = [], context = vm.createContext({ require: () => ({ getCurrentWebContents: () => ({ debugger: debuggerInstance }) }) });
  const cli = (command, ...args) => {
    commands.push([command, ...args]);
    if (command === "eval") return String(vm.runInContext(args[0].slice(5), context));
    if (command === "dev:debug") attached = args[0] === "on";
    return "";
  };
  return { cli, commands, debuggerInstance, context };
}
test("an existing debugger is never stolen or detached", () => {
  const { cli, commands } = host(true);
  assert.throws(() => acquireDebuggerSession(cli), /already attached/);
  assert.equal(commands.some(command => command[0] === "dev:debug"), false);
});
test("owned console and exception capture is removed with its exact attachment", () => {
  const { cli, commands, debuggerInstance, context } = host();
  const session = acquireDebuggerSession(cli);
  debuggerInstance.emit("message", null, "Runtime.consoleAPICalled", { type: "error", args: [{ description: "actual failure" }] });
  debuggerInstance.emit("message", null, "Runtime.exceptionThrown", { exceptionDetails: { text: "exception" } });
  assert.equal(session.read().length, 2);
  session.dispose(); session.dispose();
  assert.equal(debuggerInstance.listenerCount("message"), 0);
  assert.equal(Object.keys(context).some(key => key.startsWith("__excalidrawTestConsole_")), false);
  assert.equal(commands.filter(command => command[0] === "dev:debug" && command[1] === "off").length, 1);
});
test("expected fault injection cannot hide another error or an incorrect count", () => {
  const expected = [{ contains: "OWNED_WRITE_FAILURE", min: 1, max: 1 }], error = { kind: "console", messages: ["OWNED_WRITE_FAILURE"] };
  assert.deepEqual(unexpectedConsoleErrors([error], expected), []);
  assert.equal(unexpectedConsoleErrors([error, error], expected).length, 1);
  assert.equal(unexpectedConsoleErrors([error, { messages: ["unrelated failure"] }], expected).length, 1);
  assert.equal(unexpectedConsoleErrors([], expected).length, 1);
  assert.equal(unexpectedConsoleErrors([error, { ...error, kind: "exception" }], expected).length, 1);
});
