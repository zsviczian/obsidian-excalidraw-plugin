import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { obsidianCliExecutable, packageManagerInvocation, spawnNativeSync } from "./processTools.mjs";

test("CLI discovery supports both desktop platforms, overrides and PATH fallback", () => {
  const env = { LOCALAPPDATA: "/local", PROGRAMFILES: "/program files" };
  const console = join(env.PROGRAMFILES, "Obsidian/Obsidian.com");
  assert.equal(obsidianCliExecutable(env, "win32", path => path === console), console);
  const mac = "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli";
  assert.equal(obsidianCliExecutable({}, "darwin", path => path === mac), mac);
  assert.equal(obsidianCliExecutable({ EXCALIDRAW_OBSIDIAN_CLI: "/custom cli" }, "win32", () => false), "/custom cli");
  assert.equal(obsidianCliExecutable({}, "darwin", () => false), "obsidian");
});

test("long and multiline Windows evals preserve literal code and remove their temporary scripts", () => {
  for (const code of ['JSON.stringify("quotes: \\" and paths: C:\\\\test")\n', `JSON.stringify(${JSON.stringify("x".repeat(50_000))})`]) {
    const args = ["vault=excalidraw-test", "eval", `code=${code}`];
    const options = { timeout: 1234, encoding: "utf8" };
    const result = { status: 0, stdout: "receipt" };
    let script;
    assert.equal(spawnNativeSync("Obsidian.com", args, options, { platform: "win32", spawn: (file, forwarded, received) => {
      assert.equal(file, "Obsidian.com");
      assert.equal(received, options);
      assert.deepEqual(forwarded.slice(0, 2), args.slice(0, 2));
      assert.ok(forwarded[2].length < 1000);
      assert.doesNotMatch(forwarded[2], /[\r\n]/);
      const output = runInNewContext(forwarded[2].slice(5), { require: () => ({ readFileSync: (path, encoding) => {
        script = path;
        assert.equal(encoding, "utf8");
        assert.equal(readFileSync(path, encoding), code);
        return code;
      } }) });
      assert.equal(output, runInNewContext(code));
      return result;
    } }), result);
    assert.equal(existsSync(dirname(script)), false);
    assert.equal(args[2], `code=${code}`);
  }
});

test("temporary eval scripts are removed if native spawning throws", () => {
  let directory;
  assert.throws(() => spawnNativeSync("Obsidian.com", ["vault=excalidraw-test", "eval", "code=1\n+1"], {}, {
    platform: "win32", spawn: (_file, args) => {
      runInNewContext(args[2].slice(5), { require: () => ({ readFileSync: path => { directory = dirname(path); return "1+1"; } }) });
      throw new Error("launcher failure");
    },
  }), /launcher failure/);
  assert.equal(existsSync(directory), false);
});

test("short Windows calls and all macOS calls keep their native arguments", () => {
  for (const [platform, code] of [["win32", "1+1"], ["darwin", "1\n+1"]]) {
    const args = ["vault=excalidraw-test", "eval", `code=${code}`];
    spawnNativeSync("obsidian", args, {}, { platform, spawn: (_file, received) => assert.equal(received, args) });
  }
});

test("package managers launch JavaScript entries through the current Node without .cmd shims", () => {
  const node = "/node install/node";
  for (const [manager, entry] of [["npm", "npm/bin/npm-cli.js"], ["yarn", "yarn/bin/yarn.js"]]) {
    const script = join(dirname(node), "node_modules", entry);
    const invocation = packageManagerInvocation(manager, ["run", "build"], {
      env: {}, node, platform: "win32", exists: path => path === script,
    });
    assert.deepEqual(invocation, { file: node, args: [script, "run", "build"] });
  }
  assert.deepEqual(packageManagerInvocation("yarn", ["build:obsidian"], {
    env: {}, node, platform: "darwin", exists: () => false,
  }), { file: "yarn", args: ["build:obsidian"] });
  assert.throws(() => packageManagerInvocation("yarn", [], { env: {}, node, platform: "win32", exists: () => false }), /EXCALIDRAW_YARN_CLI/);
});
