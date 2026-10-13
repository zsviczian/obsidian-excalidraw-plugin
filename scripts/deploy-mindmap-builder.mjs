/** Build Mindmap Builder in its authoring workspace and copy the published artifacts. */
import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { packageManagerInvocation } from "./testing/host/processTools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(process.argv[2] ?? path.join(root, "..", "ea-scripts"));
const slug = "mindmap-builder";

async function deploy() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) throw new Error("Mindmap Builder requires Node.js 22 or newer.");
  await fs.access(path.join(workspace, "src", "scripts", slug, "main.ts"));

  const invocation = packageManagerInvocation("npm", ["run", "build"]);
  const result = spawnSync(invocation.file, invocation.args, {
    cwd: workspace,
    stdio: "inherit",
    // Both repositories' scripts must use the same supported Node installation.
    env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`EA Scripts build failed (exit ${result.status}).`);

  const outputDir = path.join(workspace, "build", slug);
  // Read both before replacing either published artifact. Copy the template wrapper intact.
  const markdown = await fs.readFile(path.join(outputDir, `${slug}.md`));
  const preview = await fs.readFile(path.join(outputDir, `${slug}.svg`));
  await fs.writeFile(path.join(root, "ea-scripts", "Mindmap Builder.md"), markdown);
  await fs.writeFile(path.join(root, "ea-scripts", "Mindmap Builder.svg"), preview);
  console.log(`Mindmap Builder published artifacts copied from ${workspace}`);
}

deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
