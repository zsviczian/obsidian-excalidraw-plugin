import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "ea-scripts");
const catalogPath = path.join(scriptsDir, "script-store.json");
const directoryInfoPath = path.join(scriptsDir, "directory-info.json");
const checkOnly = process.argv.includes("--check");
const FEATURED_CATEGORY = "Editors Picks";

const fail = (message) => {
  throw new Error(`[script-store] ${message}`);
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const validateCatalog = () => {
  if (catalog.version !== 1) {
    fail(`Unsupported catalog version: ${catalog.version}`);
  }
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.scripts)) {
    fail("Catalog must contain categories[] and scripts[].");
  }

  const categories = new Set();
  for (const category of catalog.categories) {
    if (!category?.name || categories.has(category.name)) {
      fail(`Invalid or duplicate category: ${category?.name ?? "<missing>"}`);
    }
    categories.add(category.name);
  }

  const names = new Set();
  const files = new Set();
  for (const script of catalog.scripts) {
    if (!script?.name || !script?.file || !script?.installUrl) {
      fail(`Script entry is missing name, file, or installUrl: ${JSON.stringify(script)}`);
    }
    if (names.has(script.name)) {
      fail(`Duplicate script name: ${script.name}`);
    }
    if (files.has(script.file)) {
      fail(`Duplicate script file: ${script.file}`);
    }
    names.add(script.name);
    files.add(script.file);

    if (!fs.existsSync(path.join(scriptsDir, script.file))) {
      fail(`Missing script file: ea-scripts/${script.file}`);
    }
    for (const category of script.categories ?? []) {
      if (!categories.has(category)) {
        fail(`Unknown category "${category}" on ${script.name}`);
      }
    }
    if (
      script.featuredRank !== undefined &&
      !script.categories?.includes(FEATURED_CATEGORY)
    ) {
      fail(`${script.name} has featuredRank but is not in ${FEATURED_CATEGORY}.`);
    }
  }
};

const getGitOutput = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
};

const getHeadDirectoryInfo = () => {
  const source = getGitOutput(["show", "HEAD:ea-scripts/directory-info.json"]);
  if (!source) {
    return null;
  }
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
};

const getChangedManagedFiles = () => {
  const status = getGitOutput([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "ea-scripts",
  ]);
  if (status === null) {
    return null;
  }

  const managed = new Set();
  for (const script of catalog.scripts) {
    managed.add(script.file);
    managed.add(script.file.replace(/\.(?:md|js)$/i, ".svg"));
  }

  const changed = new Set();
  for (const line of status.split(/\r?\n/)) {
    if (line.length < 4) {
      continue;
    }
    let filePath = line.slice(3).trim();
    const renameSeparator = filePath.lastIndexOf(" -> ");
    if (renameSeparator >= 0) {
      filePath = filePath.slice(renameSeparator + 4);
    }
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }
    const prefix = "ea-scripts/";
    if (!filePath.startsWith(prefix)) {
      continue;
    }
    const filename = filePath.slice(prefix.length);
    if (managed.has(filename)) {
      changed.add(filename);
    }
  }
  return changed;
};

const updateDirectoryInfoForChangedScripts = () => {
  const existing = JSON.parse(fs.readFileSync(directoryInfoPath, "utf8"));
  const changed = getChangedManagedFiles();
  const headEntries = getHeadDirectoryInfo();

  // Exported repository ZIPs do not contain .git. In that environment the
  // historical mtimes are intentionally left completely untouched.
  if (changed === null || headEntries === null || changed.size === 0) {
    return null;
  }

  const headByName = new Map(headEntries.map((entry) => [entry.fname, entry.mtime]));
  const currentByName = new Map(existing.map((entry) => [entry.fname, entry]));
  let nextMtime = Date.now();

  for (const filename of changed) {
    const localPath = path.join(scriptsDir, filename);
    if (!fs.existsSync(localPath)) {
      continue;
    }
    const current = currentByName.get(filename);
    const headMtime = headByName.get(filename);

    // If this PR already changed the mtime, keep it. This makes repeated
    // script-store:build runs idempotent and prevents timestamp churn.
    if (current && headMtime !== undefined && current.mtime !== headMtime) {
      continue;
    }

    const mtime = Math.max(nextMtime++, (current?.mtime ?? headMtime ?? 0) + 1);
    if (current) {
      current.mtime = mtime;
    } else {
      const entry = { fname: filename, mtime };
      existing.push(entry);
      currentByName.set(filename, entry);
    }
  }

  return existing;
};

validateCatalog();

if (checkOnly) {
  console.log(
    `[script-store] Catalog OK: ${catalog.scripts.length} scripts in ${catalog.categories.length} categories.`,
  );
  process.exit(0);
}

const directoryInfo = updateDirectoryInfoForChangedScripts();
if (directoryInfo) {
  const directoryInfoSource = `${JSON.stringify(directoryInfo, null, 2)}\n`;
  if (directoryInfoSource !== fs.readFileSync(directoryInfoPath, "utf8")) {
    fs.writeFileSync(directoryInfoPath, directoryInfoSource);
  }
}

console.log(
  `[script-store] Validated ${catalog.scripts.length} scripts and updated directory-info.json for changed script/icon files.`,
);
