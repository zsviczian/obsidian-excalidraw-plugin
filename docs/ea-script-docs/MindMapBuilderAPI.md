# MindMap Builder API

This page documents how **Mind Map Builder** works internally and how to automate it through `window.MindMapBuilderAPI`.

## Why this API exists

Mind Map Builder is optimized for interactive keyboard-first use in Excalidraw. The public API adds a stable automation layer so scripts and AI agents can:

- discover available methods and actions,
- validate arguments before execution,
- execute high-level operations without re-implementing layout logic,
- retrieve map structure and role-based element groups.

## Runtime model (how Mind Map Builder works)

At runtime, Mind Map Builder treats a map as a graph composed of:

- **Node elements**: text-containing Excalidraw elements representing ideas.
- **Branch arrows**: arrows with `customData.isBranch === true`, defining parent/child relationships.
- **Map roots**: top-level nodes without incoming branch arrows.
- **Additional roots (submaps)**: nodes flagged as `customData.isAdditionalRoot === true`.
- **Map config root**: settings are resolved from the node returned by internal root/settings-root logic.
- **Project elements**: branch content plus related decorations, boundaries, and crosslinks.

Most operations run through existing Mind Map Builder internals (action dispatcher + layout engine), and the API wraps those internals with structured success/error return objects.

## API entry point

```js
const mmb = window.MindMapBuilderAPI;
```

The API is available while Mind Map Builder is active.

## Result envelope

All public methods (except `ready()` and `getCapabilities()`) return:

```ts
type MMResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: any } };
```

## Discoverability and minification-safe introspection

Because Mind Map Builder is minified in distribution, rely on runtime introspection (not source signatures):

- `spec()` for machine-readable contract,
- `help()` for human-readable docs,
- `listMethods()` for method discovery,
- `validate()` for argument validation,
- `getErrorCodes()` for stable error semantics.

## Quick start

```js
const mmb = window.MindMapBuilderAPI;
if (!mmb?.ready()) throw new Error("MindMapBuilderAPI not ready");

const methods = mmb.listMethods();
console.log(methods);

const view = mmb.getView();
console.log(view);
```

---

## Public API reference

### Metadata and introspection

#### `ready(): boolean`
Returns whether the API runtime is initialized.

#### `getCapabilities(): { actions: string[]; methods: string[] }`
Returns action constants and currently enumerable API method names.

#### `listMethods(): MMResult<{ methods: string[] }>`
Returns all documented public method names.

#### `getErrorCodes(): MMResult<{ errors: Record<string,string> }>`
Returns error code → explanation map.

#### `spec(): MMResult<{ version; actions; errors; methods }>`
Returns the full machine-readable API contract, including method parameter metadata.

#### `help(method?: string, format?: "object" | "text"): MMResult<object | string>`
Returns docs for one method or the full API.

#### `validate(method: string, args?: any): MMResult<{ valid: boolean; errors: string[]; normalizedArgs: object }>`
Validates arguments against documented method contract before execution.

### View and selection

#### `setView(view: ExcalidrawView): MMResult<{ view; filePath }>`
Sets the active Excalidraw view context used by Mind Map Builder.

#### `getView(): MMResult<{ view; filePath }>`
Returns the current Excalidraw view and backing file path.

#### `getSelection(): MMResult<{ nodeId: string | null; elementIds: string[] }>`
Returns current selected mindmap node (if resolvable) and selected element IDs.

#### `selectNode(nodeId?: string): MMResult<{ nodeId: string }>`
Selects node by ID. If omitted, resolves from current selection context.

#### `setInputFieldDockStatus({ isDocked }): Promise<MMResult<{ isDocked: boolean; isUndocked: boolean; sidepanelVisible: boolean }>>`
Forces input UI mode to docked/undocked. When docking, it docks if needed and reveals sidepanel if hidden. When undocking, it undocks if needed and hides sidepanel if currently visible.

### Map structure and node content

#### `getMindMapRoots(): MMResult<{ rootIds: string[] }>`
Returns top-level master root IDs.

#### `getMapInfo(nodeId?: string): MMResult<{ nodeId; rootId; settingsRootId; depth }>`
Returns hierarchy info for a node.

#### `getNodeText(nodeId?: string): MMResult<{ nodeId; text; ontology }>`
Returns node text and ontology (derived from incoming branch metadata text).

### Actions and layout

#### `performAction(action: string, event?: object): Promise<MMResult<void>>`
Executes one built-in action from `MindMapBuilderAPI.Actions`.

#### `refreshMapLayout(nodeId?: string): Promise<MMResult<{ rootId: string }>>`
Re-runs map layout for a selected or provided node.

### Create / import / export

#### `addNode({ text, parentId?, ontology?, follow?, position? }): Promise<MMResult<{ nodeId; arrowId; rootId }>>`
Adds a node using existing mindmap insertion logic.

#### `importMarkdown({ markdown, parentId? }): Promise<MMResult<{ addedNodeIds: string[]; rootId: string | null }>>`
Imports markdown bullet hierarchy into the map.

#### `exportMarkdown({ nodeId?, cut? }): Promise<MMResult<{ markdown: string }>>`
Copies selected branch as markdown to clipboard and returns the markdown text.

### Submaps and config

#### `toggleSubmapRoot({ nodeId?, enabled? }): Promise<MMResult<{ nodeId; enabled }>>`
Toggles additional-root status (or forces it when `enabled` is provided).

#### `getMapConfig(nodeId?): MMResult<{ rootId; settingsRootId; config }>`
Returns effective map configuration.

#### `setMapConfig({ patch, nodeId?, relayout? }): Promise<MMResult<{ rootId; settingsRootId }>>`
Patches map config and optionally relayouts.

### Element extraction for automation

#### `getBranchElementIds({ nodeId, includeDecorations?, includeCrosslinks? }): MMResult<{ ids: string[] }>`
Returns branch element IDs for targeted operations.

#### `getProjectElementIds(rootId: string): MMResult<{ ids: string[] }>`
Returns all project element IDs under a root.

#### `getElementIdsByRole(rootId: string): MMResult<{ nodes; branchArrows; crossLinks; boundaries; decorations; boundTexts }>`
Returns categorized element IDs for selective styling or export workflows.

---

## Actions enum

Use `MindMapBuilderAPI.Actions` constants with `performAction()`.

Key values include:

- `ADD`, `ADD_SIBLING_AFTER`, `ADD_SIBLING_BEFORE`,
- `ADD_FOLLOW`, `ADD_FOLLOW_FOCUS`, `ADD_FOLLOW_ZOOM`,
- `EDIT`, `PIN`, `BOX`, `TOGGLE_EMBED`, `TOGGLE_BOUNDARY`, `TOGGLE_SUBMAP_ROOT`, `TOGGLE_GROUP`,
- `FOLD`, `FOLD_L1`, `FOLD_ALL`,
- `COPY`, `CUT`, `PASTE`,
- `ZOOM`, `FOCUS`,
- `NAVIGATE`, `NAVIGATE_ZOOM`, `NAVIGATE_FOCUS`,
- `SORT_ORDER`, `REARRANGE`,
- `DOCK_UNDOCK`, `HIDE`,
- `UNDO`, `REDO_Z`, `REDO_Y`.

## Error codes

Retrieve full list dynamically via:

```js
window.MindMapBuilderAPI.getErrorCodes();
```

Common codes:

- `NO_VIEW`, `INVALID_VIEW`
- `INVALID_NODE`, `NO_SELECTION`, `NO_ROOT`
- `INVALID_ACTION`, `INVALID_ARGUMENT`
- `OPERATION_FAILED`

---

## Examples

### 1) Agent-safe execution flow

```js
const ea = window.ExcalidrawAutomate;
if (!ea) {
  console.log("Excalidraw not running");
  return;
}

ea.setView();
if (!ea.targetView) {
  console.log("No Excaliidraw document open");
  return;
}

let mmb = window.MindMapBuilderAPI;

if (!mmb) {
  const cmd = Object.keys(app.commands.commands).find(k=>k.match(/.*Mindmap Builder$/));
  if(!cmd) {
    console.log("MindMap Builder not installed");
    return;
  }
  const leaf = ea.targetView.leaf;
  app.workspace.setActiveLeaf(leaf);
  if (app.commands.commands[cmd].checkCallback(false)) {
    console.log("Failed to initialize MindMap Builder");
    return;
  }
  await sleep(100);
  mmb = window.MindMapBuilderAPI;
  if (!mmb) {
    console.log("MindMap Builder API not available");
    return;
  }
}

const check = mmb.validate("addNode", { text: "New idea" });
if (!check.ok || !check.data.valid) {
  console.log(check);
  return;
}

const res = await mmb.addNode(check.data.normalizedArgs);
console.log(res);
```

### 2) Discover API at runtime

```js
const spec = window.MindMapBuilderAPI.spec();
if (spec.ok) {
  console.log(spec.data.version);
  console.log(Object.keys(spec.data.methods));
}
```

### 3) Add nodes then relayout

```js
await window.MindMapBuilderAPI.addNode({ text: "Topic A" });
await window.MindMapBuilderAPI.addNode({ text: "Topic B", follow: true });
await window.MindMapBuilderAPI.refreshMapLayout();
```

### 4) Execute built-in action

```js
const { Actions } = window.MindMapBuilderAPI;
await window.MindMapBuilderAPI.performAction(Actions.FOLD_ALL);
```

### 5) Read node text + ontology

```js
const res = window.MindMapBuilderAPI.getNodeText();
if (res.ok) {
  console.log(res.data.text, res.data.ontology);
}
```

### 6) Force input dock/undock state

```js
await window.MindMapBuilderAPI.setInputFieldDockStatus({ isDocked: true });  // force docked input
await window.MindMapBuilderAPI.setInputFieldDockStatus({ isDocked: false }); // force floating input
```

### 7) Import markdown under selected node

```js
const md = `
# Product Strategy
- Vision
  - Problem
  - Outcome
- Execution
  - Milestones
`;

await window.MindMapBuilderAPI.importMarkdown({ markdown: md });
```

### 8) Export a branch to markdown

```js
const out = await window.MindMapBuilderAPI.exportMarkdown({ cut: false });
if (out.ok) console.log(out.data.markdown);
```

### 9) Get role-based IDs and style with ExcalidrawAutomate

```js
const roots = window.MindMapBuilderAPI.getMindMapRoots();
if (!roots.ok || roots.data.rootIds.length === 0) return;

const roles = window.MindMapBuilderAPI.getElementIdsByRole(roots.data.rootIds[0]);
if (!roles.ok) return;

// Example: pass roles.data.nodes into your EA styling pipeline
```

### 10) Build a feature showcase mindmap (Right-Left + boundaries)

```js
(async () => {
  const ensureMindMapBuilder = async () => {
    const ea = window.ExcalidrawAutomate;
    if (!ea) throw new Error("ExcalidrawAutomate is not available");

    ea.setView();
    if (!ea.targetView) {
      //if no excalidraw document is avaialble create one and open it
      await ea.create({onNewPane: true,silent: false});
      await sleep(100);
      ea.setView();
      if(!ea.targetView) {
        throw new Error("No Excalidraw view is open");
      }
    }

    let mmb = window.MindMapBuilderAPI;
    if (!mmb) {
      const cmd = Object.keys(app.commands.commands).find((k) => /.*Mindmap Builder$/.test(k));
      if (!cmd) throw new Error("MindMap Builder command not found");

      app.workspace.setActiveLeaf(ea.targetView.leaf);

      // checkCallback(false) returns false when the command can run.
      if (app.commands.commands[cmd].checkCallback(false)) {
        throw new Error("MindMap Builder could not be initialized");
      }

      await sleep(120);
      mmb = window.MindMapBuilderAPI;
      if (!mmb) throw new Error("MindMap Builder API not available after command execution");
    }

    const setView = mmb.setView(ea.targetView);
    if (!setView.ok) throw new Error(`setView failed: ${setView.error.message}`);

    return { ea, mmb };
  }

  const assertOk = (result, label) => {
    if (!result?.ok) {
      const message = result?.error?.message || "Unknown error";
      const code = result?.error?.code || "UNKNOWN";
      throw new Error(`${label} failed (${code}): ${message}`);
    }
    return result.data;
  }

  const { mmb } = await ensureMindMapBuilder();

  // 1) Create / select root
  const rootData = assertOk(await mmb.addNode({ text: "MindMapBuilder API", ontology: "Root" }), "add root");
  assertOk(mmb.selectNode(rootData.nodeId), "select root");

  // 2) Explicitly set growth strategy to Right-Left
  assertOk(
    await mmb.setMapConfig({
      nodeId: rootData.nodeId,
      patch: {
        growthMode: "Right-Left",
        multicolor: true,
        boxChildren: false,
      },
      relayout: true,
    }),
    "setMapConfig",
  );

  // 3) Build feature branches
  const features = [
    {
      title: "Discoverability",
      ontology: "spec/help/listMethods/getErrorCodes",
      items: ["spec()", "help('addNode')", "listMethods()", "getErrorCodes()"],
    },
    {
      title: "Validation",
      ontology: "validate-first automation",
      items: ["validate(method,args)", "normalizedArgs", "contract checks"],
    },
    {
      title: "Core Ops",
      ontology: "create+layout",
      items: ["addNode()", "refreshMapLayout()", "performAction()"],
    },
    {
      title: "Map Data",
      ontology: "query graph",
      items: ["getMapInfo()", "getNodeText()", "getMindMapRoots()"],
    },
    {
      title: "Import/Export",
      ontology: "markdown bridge",
      items: ["importMarkdown()", "exportMarkdown()"],
    },
    {
      title: "Extraction",
      ontology: "element grouping",
      items: ["getBranchElementIds()", "getProjectElementIds()", "getElementIdsByRole()"],
    },
  ];

  const branchNodeIds = [];
  for (const group of features) {
    assertOk(mmb.selectNode(rootData.nodeId), `select root for ${group.title}`);
    const branch = assertOk(
      await mmb.addNode({ text: group.title, ontology: group.ontology, parentId: rootData.nodeId }),
      `add branch ${group.title}`,
    );
    branchNodeIds.push(branch.nodeId);

    for (const item of group.items) {
      assertOk(
        await mmb.addNode({ text: item, parentId: branch.nodeId }),
        `add item ${group.title} -> ${item}`,
      );
    }
  }

  // 4) Add boundaries around selected branch groups
  const withBoundaries = ["Discoverability", "Core Ops", "Extraction"];
  for (let i = 0; i < features.length; i++) {
    const group = features[i];
    if (!withBoundaries.includes(group.title)) continue;
    assertOk(mmb.selectNode(branchNodeIds[i]), `select for boundary ${group.title}`);
    assertOk(await mmb.performAction(mmb.Actions.TOGGLE_BOUNDARY), `toggle boundary ${group.title}`);
  }

  // 5) Final layout + quick verification calls
  assertOk(mmb.selectNode(rootData.nodeId), "reselect root");
  assertOk(await mmb.refreshMapLayout(rootData.nodeId), "final relayout");

  const rootInfo = assertOk(mmb.getMapInfo(rootData.nodeId), "getMapInfo root");
  const rootText = assertOk(mmb.getNodeText(rootData.nodeId), "getNodeText root");
  mmb.performAction(mmb.Actions.ZOOM);

  console.log("Map created", { rootInfo, rootText, branchNodeIds });
})();
```

---

## ExcalidrawAutomate integration note

MindMapBuilder API focuses on mindmap-specific orchestration. For advanced canvas operations (fine-grained styling, geometry transforms, scene-level utilities, file operations), use **ExcalidrawAutomate** together with this API.

Reference:

- [ExcalidrawAutomate full library for LLM training.md](../AITrainingData/ExcalidrawAutomate%20full%20library%20for%20LLM%20training.md)

You can use MindMapBuilderAPI to identify target nodes/branches, then use ExcalidrawAutomate to apply detailed transformations.

## Compatibility

- Designed for the current MindMapBuilder public API exposed at runtime.
- Prefer `spec()` and `validate()` in automation code to remain robust against future changes.
