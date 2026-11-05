import assert from "node:assert/strict";
import test from "node:test";
import { nativeKeyboardInput } from "./nativeKeyboard.mjs";

test("macOS native editing shortcuts carry browser commands while preserving trusted key parameters", () => {
  for (const [code, modifiers, command] of [["KeyA", 4, "selectAll"], ["KeyZ", 4, "undo"], ["KeyZ", 12, "redo"]]) {
    for (const type of ["keyDown", "rawKeyDown"]) {
      const key = { type, code, key: code.slice(-1).toLowerCase(), modifiers, windowsVirtualKeyCode: code.charCodeAt(3) };
      assert.deepEqual(nativeKeyboardInput(key, "darwin"), { ...key, commands: [command] });
      assert.equal(Object.hasOwn(key, "commands"), false);
    }
  }
});

test("native keyboard transport preserves releases, app shortcuts, other platforms and explicit commands", () => {
  for (const key of [{ type: "keyUp", code: "KeyA", modifiers: 4 }, { type: "keyDown", code: "KeyS", modifiers: 4 },
    { type: "keyDown", code: "KeyA", modifiers: 0 }, { type: "keyDown", code: "KeyA", modifiers: 5 },
    { type: "keyDown", code: "KeyA", modifiers: 4, commands: ["custom"] }]) assert.equal(nativeKeyboardInput(key, "darwin"), key);
  const key = { type: "keyDown", code: "KeyA", modifiers: 2 };
  for (const platform of ["win32", "linux"]) assert.equal(nativeKeyboardInput(key, platform), key);
});
