/** One descriptor registry for native flags, schemas and progressive help. */
import type { CLICommand } from "src/types/excalidrawCliTypes";
import type { CliFlags } from "src/types/obsidianCli";

interface CommandDescriptor {
  description: string;
  fields: Record<string, string>;
  writes?: boolean;
  example: Record<string, unknown>;
}
const target = { path: "Exact drawing path including extension", view: "View ID from open/read; required for multiple views" };
const source = { source: "auto (default), live, or disk" };
const page = { offset: "Integer offset, default 0", limit: "Integer page size, default 50; maximum 200", revision: "Required when offset is greater than zero" };
const write = { requestId: "Unique caller ID; same effective request is replayed for 15 minutes in this session" };

export const CLI_COMMANDS: Record<CLICommand, CommandDescriptor> = {
  help: { description: "Discover commands and the authoring workflow", fields: {}, example: {} },
  status: { description: "Inspect readiness and available runtime capabilities", fields: {}, example: {} },
  schema: { description: "Inspect one command's fields and side effects", fields: { action: "Command to describe" }, example: { action: "create" } },
  api: { description: "Search EA documentation or the supported installed Lib reference", fields: { surface: "ea (default) or lib", name: "Exact method name", query: "Case-insensitive search" }, example: { surface: "ea", name: "addText" } },
  list: { description: "List drawing paths without opening them", fields: { folder: "Optional exact folder", ...page }, example: { limit: 50 } },
  read: { description: "Read an explicit live or disk drawing; no base64 asset bodies", fields: { ...target, ...source, ...page, detail: "summary (default) or elements", selectedOnly: "Live selection only", ids: "JSON array of element IDs" }, example: { path: "Drawings/Flow.excalidraw.md", source: "live", detail: "elements" } },
  open: { description: "Explicitly open a ready Excalidraw view; normal drawing scripts can run", fields: { ...target }, example: { path: "Drawings/Flow.excalidraw.md" } },
  create: { description: "Create an exact new path using EA's serializer; never overwrite", fields: { ...write, path: target.path, template: "Optional exact drawing template; no picker", elements: "Validated batch of installed Excalidraw skeletons" }, writes: true, example: { requestId: "flow-1", path: "Drawings/Flow.excalidraw.md", elements: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 200, height: 80, label: { text: "Start" } }] } },
  apply: { description: "Apply one bounded edit to an explicit live revision and report its save outcome", fields: { ...write, ...target, expectedRevision: "Fresh revision from live read", operations: "Array of add, update, delete, connect, group, ungroup, image, or latex operations" }, writes: true, example: { requestId: "flow-2", path: "Drawings/Flow.excalidraw.md", expectedRevision: "from-read", operations: [{ op: "update", id: "actual-id", set: { backgroundColor: "#e7f5ff" } }] } },
  export: { description: "Render SVG/PNG to an explicit vault path; existing remote assets may use normal network permissions", fields: { ...write, ...target, ...source, out: "Exact .svg or .png output path", overwrite: "Explicit permission to replace an existing output", selectedOnly: "Live selection only", theme: "light or dark", padding: "0 to 200, default 10", scale: "PNG scale 0.1 to 4, default 1", area: "JSON object with x,y,width,height" }, writes: true, example: { requestId: "preview-1", path: "Drawings/Flow.excalidraw.md", out: "Drawings/Flow.png" } },
  script: { description: "Run an explicitly trusted local EA script once; arbitrary code is not transactional or sandboxed", fields: { ...write, ...target, script: "Exact existing .md or enabled .js script path", trusted: "Required explicit true", args: "JSON passed as utils.input; never interpolated into code" }, writes: true, example: { requestId: "script-1", script: "Scripts/Inspect.md", trusted: true, args: {} } },
  skill: { description: "Return offline portable agent instructions without installing them", fields: { format: "json (default) or markdown for native stdout" }, example: { format: "markdown" } },
  result: { description: "Look up a session-only operation receipt after a client timeout", fields: { requestId: write.requestId }, example: { requestId: "flow-2" } },
};

/** Native flags describe transport fields as well as command-specific inputs. */
export function commandFlags(command: CLICommand): CliFlags {
  return Object.fromEntries(Object.entries({ ...CLI_COMMANDS[command].fields, input: "Vault-relative UTF-8 JSON request; exclusive with json", json: "Small inline JSON request; exclusive with input" }).map(([key, description]) => [key, {
    description, ...(["trusted", "overwrite", "selectedOnly"].includes(key) ? {} : { value: `<${key}>` }),
  }]));
}

/** Progressive Lib help describes an intentional supported subset, not reflection. */
export const CLI_LIB_HELP = [
  { name: "convertToExcalidrawElements", signature: "convertToExcalidrawElements(skeletons, {regenerateIds})", description: "Construct a batch with labels, bindings and frames. It is not an existing-scene patcher." },
  { name: "getCommonBounds", signature: "getCommonBounds(elements)", description: "Return [minX,minY,maxX,maxY]." },
  { name: "mutateElement", signature: "mutateElement(element, elementsMap, updates)", description: "Maintain element versions/nonces when mutating an EA workbench copy." },
  { name: "exportToSvg", signature: "exportToSvg({elements, appState, files})", description: "Low-level SVG export; prefer the CLI export action for Obsidian assets." },
  { name: "exportToBlob", signature: "exportToBlob({elements, appState, files, mimeType})", description: "Low-level raster export; prefer CLI export for Obsidian assets." },
];

/** Portable instructions available offline; never written to agent configuration automatically. */
export const CLI_SKILL = `---
name: obsidian-excalidraw-cli
description: Create, inspect, edit and render Obsidian Excalidraw drawings through the running app's native CLI.
---

Use a local terminal with Obsidian running and CLI enabled (API 1.12.2+).
Always put vault="<name or ID>" before the command. Native root: obsidian-excalidraw-plugin.
Start with obsidian vault="<vault>" obsidian-excalidraw-plugin:help, then :schema action=create.
All results use apiVersion 1. Check ok, mutation and persistence; process exit zero alone does not prove success.
Put large requests in a visible vault-relative JSON file and pass input="<file>". Inline json is for small requests.
Requests in files include apiVersion:1; the native command supplies command. The in-process ea.executeCLI request also includes command.
Use exact drawing paths including extensions. Never assume an active drawing. :open explicitly creates a tab and can run configured drawing scripts.
Loop: :read source=live detail=elements → :apply with expectedRevision and a unique requestId → check persistence=saved → :export → inspect the image file.
For duplicate views use the view ID from :open or :read. Refresh after STALE_REVISION; retry BUSY only after read-back.
New skeleton IDs are local labels; use returned idMap actual IDs for updates. Updates reject identity, bindings and asset internals.
Every write requires requestId. Repeat the identical effective request to retrieve its receipt; different content with the same ID fails.
:result requestId=<id> recovers a receipt after lost stdout. Receipts expire after 15 minutes/reload; unknown outcome requires read-back before another write.
:api surface=ea name=<method> gives existing EA signatures. :api surface=lib lists the supported installed Lib reference; advanced exports remain available to scripts.
:script requires trusted=true and an explicit existing local script file. utils.input contains args; utils.excalidrawLib is the installed runtime. Await all work; completion does not imply saved drawing.
One-shot EA is cleaned up; utility prompts fail INTERACTION_REQUIRED. Trusted code can still invoke other interactive APIs: this is not a sandbox, timeout cancellation or transaction.
Export names an explicit out=.svg/.png; overwrite=true is required for existing outputs. Live exports never implicitly save. Remote assets follow existing permissions.
Use :schema for exact fields, operation limits, and runnable examples. Do not edit compressed drawing Markdown directly or install another Excalidraw CLI.
`;
