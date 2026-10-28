/** Use local declarations only for a byte-matched, unpublished runtime handoff. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const obsidianArtifacts = [
  "excalidraw.production.min.js",
  "excalidraw.development.js",
  "excalidraw.production.min.css",
  "excalidraw.development.css",
];
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export function localExcalidrawTypePaths(
  pluginRoot,
  forkRoot = resolve(pluginRoot, "../excalidraw"),
) {
  const pkg = resolve(forkRoot, "packages/excalidraw");
  const types = resolve(pkg, "types");
  const installed = resolve(
    pluginRoot,
    "node_modules/@zsviczian/excalidraw/dist/obsidian",
  );
  if (!existsSync(resolve(types, "excalidraw/obsidianExcalidrawHost.d.ts")))
    return undefined;
  // An unrelated sibling checkout must never silently replace installed types.
  if (
    !obsidianArtifacts.every((name) => {
      const local = resolve(pkg, "dist/obsidian", name),
        target = resolve(installed, name);
      return (
        existsSync(local) && existsSync(target) && hash(local) === hash(target)
      );
    })
  )
    return undefined;
  const paths = {
    react: [resolve(pluginRoot, "node_modules/@types/react/index.d.ts")],
    "react/*": [resolve(pluginRoot, "node_modules/@types/react/*")],
    "react-dom": [
      resolve(pluginRoot, "node_modules/@types/react-dom/index.d.ts"),
    ],
    "react-dom/*": [resolve(pluginRoot, "node_modules/@types/react-dom/*")],
    "@zsviczian/excalidraw": [resolve(types, "excalidraw/index.d.ts")],
    "@zsviczian/excalidraw/*": [resolve(pkg, "*")],
    "@excalidraw/excalidraw/*": [resolve(types, "excalidraw/*")],
    "@excalidraw/excalidraw/element/*": [resolve(types, "element/src/*")],
    "@excalidraw/mermaid-to-excalidraw": [
      resolve(
        forkRoot,
        "node_modules/@excalidraw/mermaid-to-excalidraw/dist/index.d.ts",
      ),
    ],
    "@excalidraw/mermaid-to-excalidraw/*": [
      resolve(forkRoot, "node_modules/@excalidraw/mermaid-to-excalidraw/*"),
    ],
  };
  for (const name of ["common", "element", "math", "utils"]) {
    paths[`@excalidraw/${name}`] = [resolve(types, `${name}/src/index.d.ts`)];
    paths[`@excalidraw/${name}/*`] = [resolve(types, `${name}/src/*`)];
  }
  return paths;
}
