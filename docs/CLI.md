# Excalidraw CLI

Use a terminal on the computer running Obsidian, with Obsidian's CLI enabled.
Native registration requires Obsidian API **1.12.2 or newer** and the registration
method to be present. Excalidraw still supports Obsidian 1.8.7; older installations
simply omit native handlers. The same JSON dispatcher is available to scripts as
`await ea.executeCLI(request)` on every supported version.

Select **Excalidraw: Show CLI and agent instructions** in the command palette to
copy a short prompt linking to the CLI documentation, then replace the user-instructions
placeholder with your task. The portable [agent skill](AITrainingData/excalidraw-cli/SKILL.md)
can be installed in your agent's normal skill directory manually. Excalidraw
does not install agent configuration or require a particular model provider.

```sh
obsidian vault="My vault" obsidian-excalidraw-plugin:help
obsidian vault="My vault" obsidian-excalidraw-plugin:status
obsidian vault="My vault" obsidian-excalidraw-plugin:schema action=create
obsidian vault="My vault" obsidian-excalidraw-plugin:skill format=markdown
```

Put `vault` before the command. On Windows use Obsidian's console launcher,
`Obsidian.com`, when capturing output. A remote/container/WSL terminal needs
access to the local executable and running app. Agent integrations such as
Claudian, Agent Client, and Copilot need a terminal-capable backend and permission
to invoke that executable. A missing command means you should check the host API,
enabled plugin, CLI setting, launcher, and selected vault before retrying.

All ordinary responses are JSON with `apiVersion: 1`, `session`, `command`,
`status`, `ok`, `mutation`, `persistence`, `warnings`, and optional `data`,
`target`, `revision`, or `error`. `skill format=markdown` returns Markdown on
native stdout. Check `ok` and the persistence receipt: process exit zero alone
does not prove success. Errors include a stable code and recovery instruction.

## Author a drawing

Save this UTF-8 JSON request as a visible vault file, for example `CLI/create.json`:

```json
{
  "apiVersion": 1,
  "command": "create",
  "requestId": "flow-create-1",
  "path": "Drawings/Flow.excalidraw.md",
  "elements": [
    {"id":"start","type":"rectangle","x":0,"y":0,"width":180,"height":80,"label":{"text":"Start"}},
    {"id":"end","type":"rectangle","x":280,"y":0,"width":180,"height":80,"label":{"text":"Finish"}},
    {"id":"connection","type":"arrow","x":180,"y":40,"start":{"id":"start"},"end":{"id":"end"}}
  ]
}
```

```sh
obsidian vault="My vault" obsidian-excalidraw-plugin:create input="CLI/create.json"
obsidian vault="My vault" obsidian-excalidraw-plugin:open path="Drawings/Flow.excalidraw.md"
obsidian vault="My vault" obsidian-excalidraw-plugin:read path="Drawings/Flow.excalidraw.md" source=live detail=elements
```

`create` uses the existing EA serializer, keeps template prose/metadata, and
never overwrites or appends a filename suffix. Paths are exact and include an
extension; root paths remain at the vault root. `.excalidraw.md` creates modern
Markdown; `.excalidraw` explicitly creates legacy JSON. `template` is an exact
existing drawing path, with no template picker. `open` explicitly creates/reveals
a normal tab if needed; configured drawing scripts may run as part of opening.
Use a modern destination for templates with linked asset metadata that legacy
JSON cannot retain; this conversion is rejected rather than dropping the assets.

Skeleton IDs are request-local labels. The response `data.idMap` maps them to
actual IDs; generated labels also appear in `createdIds`. Omitted IDs use `@0`,
`@1`, etc. Prefer explicit local IDs when using several add operations. Every
new element, including bound text, receives an eight-character ID. Supported
types are rectangle, ellipse, diamond, text, arrow, line, frame, and stickynote.
Arrow `start`/`end` bindings and frame `children` reference IDs in their batch.
Frames require children and cannot nest. Use `connect` for existing endpoints.

To edit, copy the current live `data.revision` and actual IDs into a new request:

```json
{
  "apiVersion": 1,
  "command": "apply",
  "requestId": "flow-edit-1",
  "path": "Drawings/Flow.excalidraw.md",
  "expectedRevision": "copy-from-live-read",
  "operations": [
    {"op":"update","id":"actual-shape-id","set":{"backgroundColor":"#e7f5ff"}},
    {"op":"update","id":"actual-bound-text-id","set":{"text":"Ready"}}
  ]
}
```

`apply` stages one coherent edit, checks its file/view/API identity and scene,
document/asset metadata, and settings again before publication, then uses the
existing save queue. A stale preparation publishes nothing. If publication
succeeds but saving fails, the response reports `mutation: applied` and
`persistence: unsaved` or `unknown`; keep the recoverable drawing open and save
or inspect it before continuing. A save receipt acknowledges the accepted edit,
not every later human edit. A handoff is not reported as durable.

| Operation | Fields after `op` |
| --- | --- |
| `add` | `elements`: new skeleton batch |
| `update` | `id`, `set`: finite style/geometry/text fields |
| `delete` | `ids`; nonempty frames require `children: "delete"` or `"detach"` |
| `connect` | `from`, `to`; optional local `id`, `fromSide`, `toSide` (top/bottom/left/right) |
| `group` | `ids`; returns a new group ID |
| `ungroup` | `ids`, `groupId`; preserves other groups |
| `image` | `asset`: exact vault PNG/JPEG/GIF/WebP/SVG; optional `id`, `x`, `y`, `scale` (boolean) |
| `latex` | `text`; optional `id`, `x`, `y`, `scaleX`, `scaleY`; requires compatible enabled Extras MathJax |

`update` accepts x/y/width/height/angle, strokeColor/backgroundColor/fillStyle,
strokeWidth/strokeStyle/roughness/opacity, locked/link, and text/fontSize/fontFamily/
textAlign/verticalAlign. Text fields require a text element; edit the bound label
ID to change its text. Linear resizing and identity, version, binding, frame,
binary, or Markdown-image metadata edits require a trusted script. Unknown
requested fields are rejected; existing custom data is preserved. Delete uses
tombstones and binding cleanup and does not delete attachment files.

## Read, render, and recover

`list` returns exact paths. `read` defaults to a summary without asset bodies;
`detail=elements` returns at most 50 elements per page (maximum 200). Use
`nextOffset` and the same `revision` for later pages. A changed snapshot returns
`STALE_REVISION`. `ids` filters explicit IDs and `selectedOnly` needs a live view.

`source=auto` uses an unambiguous live view, otherwise disk; `source=live` requires
a ready open drawing; `source=disk` reads saved content without opening/saving it.
If several views show the same drawing, specify `view` using its returned ID.
Disk reads/exports reject a view ID. No command silently selects the active drawing.

```sh
obsidian vault="My vault" obsidian-excalidraw-plugin:export path="Drawings/Flow.excalidraw.md" source=live out="Drawings/Flow.png" requestId=preview-1
obsidian vault="My vault" obsidian-excalidraw-plugin:result requestId=flow-edit-1
obsidian vault="My vault" obsidian-excalidraw-plugin:api surface=ea name=addText
obsidian vault="My vault" obsidian-excalidraw-plugin:api surface=lib name=mutateElement
```

Export writes only the explicit `.svg`/`.png` artifact. Existing files require
`overwrite=true`; output cannot replace the request, drawing, or a referenced
asset. Source/revision, theme, byte count, and dimensions are returned. Live export
does not save the drawing. Optional `theme` is light/dark, `padding` is 0–200
(default 10), `scale` is 0.1–4 for PNG (default 1), and `area` is an exact
`{x,y,width,height}` scene rectangle. Inspect the image before another revision.
Missing/undecoded assets fail explicitly. Existing remote assets use normal
plugin permissions and may require network access. Core shape/text and SVG/PNG
rendering work without Extras; optional features are never activated automatically.

Every write requires a unique 1–80 character `requestId` (letters, digits, `_`,
`.`, `-`). Repeating the identical effective request returns its receipt; different
content with the same ID is rejected. Script source is part of that identity.
`result` can recover lost stdout or report `status: pending, ok: null`. Completed
receipts expire after 15 minutes; there are at most 128 in one plugin session.
Reload/expiry/unknown outcomes require read-back before issuing another write.
Competing CLI operations on the same target return `BUSY`; human editing remains
possible, so always refresh after `STALE_REVISION`.

Input is limited to 2 MiB and nesting to 30 levels; output to 512 KiB. Use either
`input=<visible vault JSON file>` or small inline `json`, never both. Supplied
flags must agree with JSON. Construction is limited to 500 skeletons per batch,
100 operations, 5000 scene elements for edits/exports, 16 MiB drawings/assets,
and 16 million raster pixels / 16384 pixels per side / 32 MiB artifacts. The
machine schema describes structure; runtime geometry, relationship, and lifecycle
guards also apply. Hidden, absolute, traversal, and ambiguous paths are rejected.

## Trusted advanced scripts

Choose an explicit existing `.md` script, or an enabled `.js` script, and
acknowledge `trusted=true`. `path` is optional for view-free construction; a
targeted script requires an explicit ready drawing. For example:

```js
const input = utils.input; // JSON arguments, never interpolated into source
const bounds = utils.excalidrawLib.getCommonBounds(ea.getViewElements());
return { label: input.label, bounds, source: utils.executionSource }; // "cli"
```

The existing ScriptEngine compiles/caches the file and runs it with a fresh EA.
`utils.excalidrawLib` is the installed shared runtime; `api surface=lib` documents
an intentional supported subset, while scripts can use other installed exports.
The CLI-owned EA and its registered cleanups/hooks/sidepanel are destroyed on
completion or failure. Manual and persistent sidepanel scripts retain their
existing lifetimes. Utility prompts/suggesters fail with `INTERACTION_REQUIRED`.

Trusted code is not sandboxed or transactional and can call other interactive
APIs. Await all writes/saves and do not retain timers, hooks, or unawaited work.
Script completion reports unknown mutation/persistence; it does not implicitly
save everything touched. Undefined returns become null; non-JSON or oversized
results fail without claiming rollback. A terminal timeout cannot preempt
arbitrary synchronous code or undo side effects. PDF, Mermaid, SVG import, and
advanced Markdown-image workflows remain available through existing EA/Extras
APIs with their normal dependency and interaction requirements.
