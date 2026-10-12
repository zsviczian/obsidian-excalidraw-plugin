/** Shell-free desktop CLI and package-manager launches for local test tooling. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Windows needs the console launcher to capture CLI output. Overrides are executable paths. */
export function obsidianCliExecutable(env = process.env, platform = process.platform, exists = existsSync) {
  if (env.EXCALIDRAW_OBSIDIAN_CLI) return env.EXCALIDRAW_OBSIDIAN_CLI;
  const candidates = platform === "win32"
    ? [env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Obsidian", "Obsidian.com"),
      env.PROGRAMFILES && join(env.PROGRAMFILES, "Obsidian", "Obsidian.com"),
      env["PROGRAMFILES(X86)"] && join(env["PROGRAMFILES(X86)"], "Obsidian", "Obsidian.com")]
    : platform === "darwin" ? ["/Applications/Obsidian.app/Contents/MacOS/obsidian-cli",
      "/Applications/Obsidian.app/Contents/MacOS/Obsidian"] : [];
  return candidates.filter(Boolean).find(exists) ?? "obsidian";
}

/**
 * Preserve argument arrays and process results. Long/multiline Windows evals pass through
 * an owned UTF-8 script: the console transport can otherwise truncate or corrupt its IPC JSON.
 * This local file bridge is test-only and is removed even when the launcher fails.
 */
export function spawnNativeSync(file, args, options, { platform = process.platform, spawn = spawnSync } = {}) {
  const codeIndex = args.findIndex(arg => arg.startsWith("code="));
  const lengthBound = file.length + args.reduce((length, arg) => length + arg.length * 2 + 3, 0);
  const inlineSafe = codeIndex >= 0 && !/[\r\n]/.test(args[codeIndex]) && lengthBound < 8_000;
  if (platform !== "win32" || args[1] !== "eval" || !args[0]?.startsWith("vault=") || codeIndex < 0 || inlineSafe) {
    return spawn(file, args, options);
  }
  const directory = mkdtempSync(join(tmpdir(), "excalidraw-cli-eval-"));
  try {
    const script = join(directory, "probe.js");
    writeFileSync(script, args[codeIndex].slice(5), "utf8");
    const forwarded = [...args];
    forwarded[codeIndex] = `code=eval(require("node:fs").readFileSync(${JSON.stringify(script)},"utf8"))`;
    return spawn(file, forwarded, options);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Run npm/Yarn through this Node binary, avoiding .cmd shims and shell quoting on Windows. */
export function packageManagerInvocation(manager, args, {
  env = process.env, node = process.execPath, platform = process.platform, exists = existsSync,
} = {}) {
  if (!["npm", "yarn"].includes(manager)) throw new Error(`Unsupported package manager: ${manager}`);
  const entry = manager === "npm" ? "npm/bin/npm-cli.js" : "yarn/bin/yarn.js";
  const candidates = [manager === "npm" ? env.npm_execpath : env.EXCALIDRAW_YARN_CLI,
    join(dirname(node), "node_modules", entry),
    join(dirname(node), "../lib/node_modules", entry),
    env.APPDATA && join(env.APPDATA, "npm/node_modules", entry),
    manager === "yarn" && join(dirname(node), "node_modules/corepack/dist/yarn.js")];
  const script = candidates.filter(Boolean).find(exists);
  if (script) return { file: node, args: [script, ...args] };
  if (platform !== "win32" && manager === "yarn") return { file: "yarn", args };
  throw new Error(manager === "npm"
    ? "Cannot locate npm-cli.js; launch this driver with npm run verify:obsidian"
    : "Cannot locate Yarn's JavaScript entry; install Yarn/Corepack or set EXCALIDRAW_YARN_CLI to yarn.js");
}
