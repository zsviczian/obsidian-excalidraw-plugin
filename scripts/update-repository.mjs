import { cpSync, existsSync, lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

const sourceRoot = resolve(
  process.env.REPO_UPDATE_DIR || join(homedir(), "Downloads", "update"),
);
const destinationRoot = process.cwd();

if (!existsSync(sourceRoot) || !lstatSync(sourceRoot).isDirectory()) {
  console.error(`Update folder not found: ${sourceRoot}`);
  process.exit(1);
}

let copiedFiles = 0;

function countFiles(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || stat.isFile()) return 1;
  if (!stat.isDirectory()) return 0;

  let count = 0;
  for (const entry of readdirSync(path)) {
    count += countFiles(join(path, entry));
  }
  return count;
}

console.log(`Updating repository from: ${sourceRoot}`);

for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
  const source = join(sourceRoot, entry.name);
  const destination = join(destinationRoot, entry.name);
  const entryFileCount = countFiles(source);

  cpSync(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
    dereference: false,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });

  copiedFiles += entryFileCount;
  console.log(`Copied ${relative(sourceRoot, source)}`);
}

console.log(`Repository update complete. Copied ${copiedFiles} file${copiedFiles === 1 ? "" : "s"}.`);
