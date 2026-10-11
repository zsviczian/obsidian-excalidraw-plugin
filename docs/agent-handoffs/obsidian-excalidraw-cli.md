# Obsidian Excalidraw CLI — research and implementation handoff

Prepared by **Zsolt's Codex Agent** on **2026-10-11**.

**Status:** Implemented and validated locally; the maintainer authorized committing, pushing, and merging on 2026-10-11. The original research and proposed contract remain below as the decision record. Actual behavior and validation are recorded in the implementation sections and [CLI reference](../CLI.md).

### Implementation baseline — 2026-10-11

The local implementation investigation continued on this PR branch at
`44dac3237cdfb9e542a51cc2e83f3f24ec908e4f`, using Node `v22.22.2` and the
installed `@zsviczian/excalidraw` `0.18.140`. The initial production build
passed with the existing 32 circular-dependency warnings. `node --check
dist/main.js` passed, and all 11 offline native-runner tests passed.
The baseline `npm run code` reports 120 existing errors; no source code
was changed during this baseline investigation.

The resulting `dist/main.js` is **4,995,829 bytes**, leaving **247,051 bytes**
under the maintainer's intended **5 MiB (5,242,880-byte)** budget. Its SHA-256 is
`44d6f37e518c4d2db2de3409a42b1cc1cd538ad336de48ad3cdb25c65263f529`.
The initial investigation mistakenly interpreted the "5 MB" limit as decimal
5,000,000 bytes and reported a budget conflict. The maintainer corrected that
interpretation; implementation continues against the 5 MiB budget without a
packaging optimization. Final bundle measurements must use the explicit byte
threshold to avoid repeating this unit error.

Native transport probes used the existing, running `excalidraw-test` vault
on macOS, Obsidian **1.14.4 (installer 1.14.0)**, launched through
`scripts/testing/host/processTools.mjs` with explicit `vault=excalidraw-test`
and captured subprocess stdout. Temporary native handlers on the already
installed plugin returned valid JSON for a synchronous return, a resolved
promise, a 30 ms timer, a Vault read, and a real library PNG render
(1,133-byte in-memory blob). All five returned `ok: true`; each process
exited zero. The probe removed its own handler registrations and cleanup
callbacks afterward. It did not deploy the newly built baseline or write
an exported image to the vault. The installed runtime's skeleton converter
was present and used in the PNG probe.

These results support ordinary awaited CLI replies on this macOS/Codex
subprocess combination. They do not establish Windows, Linux, another agent
host, mobile startup, production command registration/unload, or the full
authoring workflow. No receipt-mode transport workaround is currently
justified. The exact canonical CLI declarations were also read from the
official `obsidianmd/obsidian-api` `obsidian.d.ts`: the registration method
and `CliData`, `CliFlag`, `CliFlags`, and `CliHandler` are tagged `1.12.2`.
The maintainer requires both `requireApiVersion("1.12.2")` and method-presence
validation before registration, with local structural types and no change
to the Obsidian `1.8.7` dependency or minimum app version.

### Implementation and validation — 2026-10-11

The local implementation now covers all thirteen actions and the native root,
with the same versioned dispatcher exposed as `ea.executeCLI`. Native
registration is desktop-only and checks both API 1.12.2 and method presence.
Canonical CLI types are local; Obsidian 1.8.7, manifests, lockfile, component,
and Extras dependencies are unchanged. Session IDs use the existing mobile-safe
`nanoid` helper, avoiding a new `crypto.randomUUID` startup requirement.

| Checkpoint | Implemented behavior | Recorded evidence |
| --- | --- | --- |
| 0 | Awaited native transport and baseline | Five captured native probes; 4,995,829-byte baseline |
| 1 | Descriptors, JSON dispatcher, discovery/schema/API/list/read/open, EA facade | 5,019,055-byte build; native help/status/schema/read registration |
| 2 | Converter validation, local/label IDs, strict EA creation, templates | 5,028,949-byte build; labels/arrows/frames, root path and collision round-trip |
| 3 | Guarded request-local text metadata, finite edits, save acknowledgments | Native stale/busy, delayed text, failed-save recovery, relationship edits, replay and saved read-back |
| 4 | Vault images, optional MathJax preflight, live/disk SVG/PNG and area bounds | Native image metadata round-trip; source-tagged exports; PNG visual inspection; 200×80 crop with zero padding |
| 5 | Trusted existing scripts, JSON/library utilities, exact source cache check, one-shot cleanup | Native context, replay/source conflict, prompt refusal; production-method tests preserve manual lifetime |
| 6 | Offline skill, localized help/copy command, README/reference, declarations, release notes, repeatable runner | Production and library build; 19 focused tests and 11 runner tests; full native scenario passed |

Final production `dist/main.js`: **5,053,346 bytes**,
**57,517 bytes** over baseline, leaving
**189,534 bytes** under **5,242,880 bytes**.
SHA-256: `7705eeba5d23a0bf54c2e3ea874d7d0ae0b270186ed4b2e326e6e45f3cfd7a9b`.
Builds have no TypeScript diagnostics. Existing circular-dependency warnings
remain. `npm run code` still reports exactly the baseline **120 errors, zero
warnings**; the new CLI modules, types, dialog, and save-outcome seam lint cleanly.
`npm run lib` regenerated the ignored public declaration graph, including
`executeCLI`, its request/result DTOs, and the strict creation parameters.
No generated build artifacts were hand-edited or added as source changes.

The complete registered-command scenario passed on **macOS / Codex subprocess
execution / Obsidian 1.14.4 (installer 1.14.0)** with the installed published
component **0.18.140**:

`npm run verify:obsidian:plugin -- --native-cli`

Final report:
`/var/folders/b1/2dys0jfs7bq73whkl2qnyyym0000gn/T/excalidraw-obsidian-jQHWu0/report.json`.
The report pins built/installed artifact hashes and confirms owned fixture
cleanup. The fixture exercises native file input, discovery, templates, invalid
construction/collision refusal, stable text IDs, fresh revisions, duplicate
receipts, competing writes, delayed text preparation, save failure, finite
relationships/frame guards, core rendering, vault images, scripts, and reopening.
Separate live/light and disk/dark exports were also checked; a PNG was visually
inspected to confirm labels, connector and frame placement. The localized help
dialog and its copy button mounted successfully. All seven manual checkpoint
fixtures were removed after their inspections; repeatable scenarios clean their
own temporary files and hooks.

A combined `--text-undo --native-cli` attempt timed out in the existing
text-undo eval probe before reaching CLI scenarios; its cleanup passed. Report:
`/var/folders/b1/2dys0jfs7bq73whkl2qnyyym0000gn/T/excalidraw-obsidian-8npk9o/report.json`.
An independent Kplex runner was active at the time; that observation does not
establish the timeout's cause. The declared 0.18.140 component also lacks the
separate unchanged-text history fix, as already documented in the runtime guide.
The focused CLI scenario runs independently and passed. Driver subprocesses now
use SIGKILL at timeout, so an ignored SIGTERM cannot leave the runner waiting.

Decisions/limits: schema uses `action` to avoid the native transport's
`command` name; JSON schemas describe request structure while runtime geometry,
relationship, and lifecycle guards remain authoritative. Lib help is an explicit
supported subset of the installed runtime. Save handoffs/unchanged attempts are
conservatively unacknowledged. Scripts report unknown mutation/persistence and
cannot promise rollback or timeout cancellation. A legacy destination is rejected
when a template's linked assets would lose their Obsidian metadata. No agent
configuration is installed automatically, and no new outbound service is used.

Remaining risk-based maintainer checks (separate environments):

1. Apply text/image edits in an inactive popout, then migrate/unload during
   preparation; check stale/busy refusal, undo/redo, and absence of duplicate saves.
2. Load on real Obsidian 1.8.7 and a physical mobile device; native registration
   should be absent and ordinary editing/help should work. Older API, missing
   method, and mobile registration guards are covered by automated tests.
3. Run the full flow from a second terminal-capable agent host and Windows/Linux
   launcher. Claudian/Agent Client/Copilot, physical devices, and those platforms
   have not been tested here; conditional compatibility is not runtime evidence.

### Maintainer-requested visual authoring test — 2026-10-11

Recreated the supplied check-in/Q&A reference in `excalidraw-test` entirely
through native CLI commands: Obsidian `create` staged the trusted EA script,
Excalidraw `script` constructed the drawing, `read` verified disk persistence,
`open` opened it, finite `apply` refined capsule geometry with a fresh revision
and returned `persistence=saved`, and `export` rendered the PNG for inspection.
No eval transport, direct drawing-file writes, or raster imports were used.

The saved `CLI recreation - Check-in and QA.excalidraw.md` contains **73 editable
elements**: 9 rectangles, 28 lines, 21 text elements, and 15 ellipses, with zero
image assets. Its **1692×961** PNG was visually checked after refinement. Both
outputs remain in the test vault at the maintainer's request; the three temporary
script/request notes were moved to trash through the native CLI.

Two native Obsidian `create` transport details were handled in the test client:
escaped newlines in source strings expand during note creation, and an input
request using a `.json` path is created as a Markdown note. Reading back the
actual generated path/content resolved both; neither failure mutated the drawing.

The maintainer approved merging after this test. Cross-platform and physical
device coverage remains limited to the evidence listed above.

### Verification after integrating current master — 2026-10-11

Merged `origin/master@07dec121` into the implementation branch at `769d58ea`,
preserving the newly added embed, grouped-link, and LaTeX runner options alongside
`--native-cli`. Resolved additive conflicts in the runtime guide and runner only.
The release notes also document the new EA signatures.

Production/library builds and `node --check dist/main.js` passed. All **50 tests**
across CLI, runner, process launchers, and Markdown embeds passed. Targeted CLI,
type, dialog, and save-coordinator ESLint passed. The updated production bundle is
**5,057,617 bytes**, leaving **185,263 bytes** under the **5,242,880-byte** budget;
SHA-256 `18a27d7455cf57f83840c5053ea28ff7a88bc6b7661516ec0141482f322b95c1`.

The full smoke runner verified matching installed hashes, plugin load, and the
main-window drawing, then timed out in the feature phase. Fixture cleanup passed;
report: `/var/folders/b1/2dys0jfs7bq73whkl2qnyyym0000gn/T/excalidraw-obsidian-3FaWmy/report.json`.
The exact timed-out command was not captured. Native readiness returned healthy
and the app error buffer was empty afterward.

Reran the complete `runNativeCLIScenario` on uniquely owned fixtures against that
same installed artifact, with command-level timeout tracing. All assertions
passed, including save/reopen, live/disk exports, script context, guarded edits,
failed-save recovery, and owned fixture cleanup. Evidence:
`/private/tmp/excalidraw-cli-premerge-result.json` and
`/private/tmp/excalidraw-cli-premerge-trace.json`. This focused rerun does not
relabel the full runner's timeout as a pass.

**Implementation workspace:** `2026-10-11-obsidian-excalidraw-cli`, initially branched from plugin `master@bf541ca5d460f5773a5547ba4511eba3ff0f2e5b`. Continue on this branch and its draft PR. Recheck its head, current instructions, and related changes before coding. The maintainer requested the detailed plan in this file: retain it through implementation, update decisions and validation here, and do not treat it as the usual disposable one-paragraph planning stub.

## 1. Recommended design

Implement a **native Obsidian CLI extension in the plugin**, backed by a small transport-neutral dispatcher. Use ExcalidrawAutomate for Obsidian-aware operations and the already-exported `ExcalidrawLib.convertToExcalidrawElements` for convenient batch construction. Reuse the current view, file, asset, export, and save paths rather than building another drawing engine.

The intended agent loop is:

`discover → inspect schema → read drawing → apply a bounded edit → verify persistence → render → inspect image`

| Decision | Recommendation |
| --- | --- |
| Transport | Public `Plugin.registerCliHandler`, not an `eval`-only protocol or a new executable. |
| Implementation scope | Plugin only. No new fork or Extras API is indicated by the source. Verify against the installed fork package, not just its remote `master`. |
| Normal authoring | JSON requests with readable skeletons, explicit targets, and a small set of semantic operations. |
| Full advanced access | A documented, explicitly trusted, one-shot EA script command plus progressive EA/Lib API help. Do not generate a command for every method. |
| Discovery | Native help/autocomplete, runtime schemas/examples, a short portable Agent Skill, and a human Command Palette entry pointing to CLI help. |
| Existing drawings | Mutate a specifically resolved live view through existing plugin logic. Require an explicit open operation when a drawing is not open. Do not add a second closed-file persistence engine. |
| Output | JSON results by default; save SVG/PNG to an explicit vault path and return a small artifact descriptor. |
| Non-goals | No Excalidraw+ account integration, HTTP server, MCP server, provider SDK, browser download, global agent-config editing, or generic workflow/job framework. |

A broad API does not mean every operation can run unattended: modals, long-lived sidepanels, optional Extras features, and trusted code have different requirements. Expose those requirements instead of hiding them behind a misleading universal command.

## 2. Research findings and evidence

### 2.1 The announced Excalidraw CLI is a reference, not a dependency

The supplied [announcement URL][announcement] could not be read reliably. I located and inspected the official `excalidraw/cli` repository and the Excalidraw+ roadmap instead. This analysis does not infer the tweet's exact wording or announcement date.

At inspected revision `55fe7f494837078781a062c4d3faf29c159ebec5`, the official CLI combines local rendering with Excalidraw+ workspace/scene/collection operations. Local rendering does not require an account. Its command registration, content validation, and browser-side rendering code are useful references. [E1], [E2], [E3], [E4]

Reuse the **design patterns**: machine-readable output, command-specific help, file-based JSON input, validation before writes, bounded output, and explicit partial-failure reporting. Do not copy its cloud authentication model, server content-reconciliation assumptions, Commander/Zod dependency stack, or separate browser-rendering process into the plugin. Obsidian already hosts the rendering runtime and owns vault persistence.

### 2.2 Obsidian has a public custom CLI API

The current official `obsidian.d.ts`, inspected at `9abd9605ce081383674aae1ed111c456edde0688`, declares the following public API, tagged `@since 1.12.2`: [O1]

```ts
registerCliHandler(
  command: string,
  description: string,
  flags: CliFlags | null,
  handler: CliHandler,
): void;

interface CliData { [key: string]: string | 'true'; }
interface CliFlag {
  value?: string;
  description: string;
  required?: boolean;
}
type CliFlags = Record<string, CliFlag>;
type CliHandler = (params: CliData) => string | Promise<string>;
```

Command IDs are global, and duplicate registration throws. Use the existing plugin ID as the namespace. Native flag descriptions feed help/autocomplete. Do not confuse these handlers with Command Palette commands exposed by `obsidian commands` and `obsidian command id=...`.

The documented desktop CLI requires the running app, CLI enablement/registration, and a suitable installer. Use an explicit `vault=<name-or-id>` **before the command** in agent instructions. Paths are vault-relative; native parameters use `key=value` and boolean switches are bare flags. This is not Obsidian Headless. [O2]

The plugin currently compiles against Obsidian types `1.8.7`. Keep its existing minimum app compatibility. Add only the canonical missing CLI declarations using the repository's established typing approach, and feature-detect the registration method at runtime. Do not assume a declaration proves runtime support or raise the minimum app version solely for this optional feature. [P1], [P2]

### 2.3 Async CLI delivery is a real test gate

An April–May 2026 firsthand report describes Obsidian 1.12.7 plugin handlers losing stdout after real asynchronous work, especially through pipes/agent tools; a second reporter reproduced it without Codex. That is historical evidence, not proof that current Obsidian still has the bug. [O3]

**First implementation task:** register a small test handler and check synchronous return, a resolved promise, a short timer, vault I/O, and a real PNG export through native CLI stdout. Test a terminal and an actual agent subprocess, including redirected/piped output. Record app, installer, platform, launcher, and harness versions.

Prefer the ordinary `Promise<string>` return contract. Do not introduce a mandatory background-job system based on an old report. If supported environments reproduce lost async output, add only an explicit asynchronous receipt mode and a synchronous `:result` lookup using the same bounded session receipt map described below. Do not block Obsidian's event loop waiting for work, scrape developer-console output, or claim an empty stdout/zero exit code means success.

### 2.4 Agent integrations: use their existing execution paths

| Integration inspected | Relevant behavior | Design implication |
| --- | --- | --- |
| **Claudian** | Its README describes local coding-agent execution and vault tools. Its Claude command catalog relies on native SDK discovery of commands/skills rather than independently interpreting every skill directory. | A native CLI plus a standard skill fits its existing terminal/skill model. Do not depend on Claudian-private APIs. [A1], [A2] |
| **Agent Client** | ACP clients expose terminal requests; sessions can use a directory other than the vault, and the README documents native agent skills and permissions. | Always name the vault. Terminal access depends on the selected agent's capabilities and approval, not merely on ACP being present. [A3], [A4] |
| **Copilot for Obsidian** | Current source includes an Obsidian CLI skill for coding-agent backends and platform-specific CLI executable discovery. | Reuse the host's CLI execution and skill support; do not characterize every Copilot mode as shell-capable or add a custom provider bridge. [A5], [A6] |
| **MCP-only or API-only chat clients** | A chat interface does not inherently provide a local terminal. | Expose the same JSON dispatcher in-process for integrations. An external MCP adapter can forward it later; no built-in MCP server is needed for V1. |

Agent Skills provides the portable `SKILL.md` convention and progressive disclosure. Skill availability still depends on the harness's discovery rules and permissions. Do not promise universal automatic discovery or treat a skill's `allowed-tools` metadata as a security boundary. [A7]

### 2.5 Existing plugin and fork primitives

Source baselines inspected:

| Repository | Revision | Role |
| --- | --- | --- |
| `zsviczian/obsidian-excalidraw-plugin` | `bf541ca5d460f5773a5547ba4511eba3ff0f2e5b` | Accepted plugin baseline for this plan. |
| `zsviczian/excalidraw` | `6ec95a327b77df2696e170cb0c9d8a84ac115121` | Inspection of exported functions and skeleton conversion. |
| `zsviczian/obsidian-excalidraw-extras` | `18ed02765078ac8e9f78df7449ccb907cb000460` | Optional feature boundary, previously inspected 0.1.1 source. |
| `excalidraw/cli` | `55fe7f494837078781a062c4d3faf29c159ebec5` | Official CLI reference implementation. |

The plugin declares `@zsviczian/excalidraw` **0.18.140**. Its installed artifact must be checked independently of the fork's current source. The CLI should not require an unpublished API or automatically bump the fork package. [P1]

| Source | Verified behavior / implication |
| --- | --- |
| `src/core/index.ts`, EA `getAPI(view)` | Existing factory creates a separate EA. Allocate one per operation; never use the mutable global EA workbench for concurrent requests. [P3], [P4] |
| EA `elementsDict`, `imagesDict`, `clear`, `setView` | EA stages edits. `clear()` clears the workbench, not the drawing. Automatic `setView()` can select active/last/first; CLI targeting must not use that fallback. [P4] |
| EA `help`, `SuggesterInfo.ts` | Help uses existing signature/description metadata but prints to the console. A CLI help handler must return metadata, not return `ea.help()` or scrape its logs. [P4], [P5] |
| EA `addElementsToView`, view `addElements` | Existing route handles text parsing, image/equation metadata, runtime file publication, container/arrow refresh, and saving. Reuse it, with narrow guards/receipts where required. [P4], [P6] |
| `ViewSaveCoordinator` | Internal save outcomes exist, but public save helpers often return `void`; a resolved call is not a durable-save receipt. [P7] |
| EA `create`, `FileManager.createDrawing` | Existing serialization handles plugin Markdown, but defaults include global format/folder settings and collision suffixing. An exact-path CLI needs a small explicit per-call option, not temporary global setting changes. [P4], [P8] |
| EA `getSceneFromFile` | Returns elements/appState, not a complete asset/Markdown metadata round-trip. Do not use it to overwrite a drawing. [P4] |
| EA `createViewSVG/PNG`, `createSVG/PNG` | Existing live-view and file/template export routes exist. `elementsOverride` is a complete candidate list, not a patch. [P4] |
| `Scripts.ts` | Script execution already returns a value and supports fresh EAs, but existing scripts intentionally retain lifetime for hooks/sidepanels. Add CLI-only one-shot cleanup rather than changing all scripts. [P9] |
| Fork `index.tsx`, plugin constants/types | `convertToExcalidrawElements`, restoration, geometry, mutation helpers, and exports are already exposed. No new fork export is required. [F1], [P10], [P11] |

## 3. Command surface and discovery contract

Use `obsidian-excalidraw-plugin` as the native root command and `obsidian-excalidraw-plugin:<action>` for actions. Keep the long but collision-safe native name in examples; no shell alias or separate npm installation is required.

All action handlers call the same dispatcher. A proposed public EA method, **`ea.executeCLI(request)`**, should delegate to that dispatcher and return the same JSON-compatible result. It must not reuse the caller's staged elements or automatically target the caller's current view. This is the documented in-process route for other plugins; native CLI remains the primary agent route.

| Action | Purpose and principal inputs |
| --- | --- |
| root / `help` | Short overview, action names, next command to run, and examples. |
| `status` | CLI API version, plugin/runtime readiness, installed dependency capabilities, current vault identity, optional-feature availability. No keys or complete settings dump. |
| `schema` | `command=<action>`; return that command's JSON input/output schema, defaults, side effects, and runnable example. |
| `api` | `surface=ea\|lib`, `query=<text>` or `name=<method>`; bounded method search, signatures, descriptions, relevant examples. Discovery only, not reflective invocation. |
| `list` | Drawing paths with bounded pagination; optional `folder`. Use the plugin's drawing classification rather than extension-only guesses. |
| `read` | Exact `path`, optional `view`, `source=auto\|live\|disk`, `detail=summary\|elements`, selection/ID filters, pagination. Return source/revision/dirty state. |
| `open` | Resolve or explicitly open a drawing as Excalidraw and return a ready view identity. This command can change the workspace; no hidden opens in `read`. |
| `create` | Exact new `path`, optional explicit template, and JSON construction request. Fail on an existing target by default. |
| `apply` | One bounded edit request against an explicit live target and expected revision. Stage edits, publish through the plugin, and report persistence. |
| `export` | SVG/PNG to an explicit vault-relative `out`; source/selection/area, theme, padding, and bounded scale options. Return artifact metadata. |
| `script` | Explicit existing script path, target when needed, JSON arguments, and a `trusted` acknowledgment. One-shot execution for advanced EA/Lib use. |
| `skill` | Return the portable CLI skill; `format=markdown` is useful for saving or attaching it. Default JSON can contain the Markdown string. |
| `result` | Retrieve a recent operation receipt by caller-supplied request ID. Session-only; not a persistent job service. |

The root index, schema, and API help should be short and useful without a loaded drawing. An unavailable optional operation must be reported as unavailable with a reason, not silently omitted from documentation or registered as a no-op.

### Discovery layers

1. Register native descriptions and `CliFlags` so `obsidian help` and `obsidian help obsidian-excalidraw-plugin:apply` explain the actual command.
2. Return a small machine-readable index from the root command. Include `apiVersion`, capability flags, input style, and next-step examples.
3. Return detailed schemas only when requested. Derive help, examples, validation, and skill action names from one small command descriptor registry. Do not bundle a general JSON-schema engine solely to validate this finite command set.
4. Reuse EA's existing documentation metadata and generated Lib references for progressive API help. Do not invent signatures from runtime function arity or expose private plugin methods/settings through reflection.
5. Add a Command Palette entry such as **Excalidraw: Show CLI and agent instructions**, with a copy action for the skill. This also helps agents that first discover the plugin through `commands filter=obsidian-excalidraw-plugin`.
6. Add a short README entry and a CLI reference document linked from the existing EA skill. The installed plugin is normally three artifacts; repository documentation is not automatically present in every user's vault. The runtime `skill`/`help` route must work without fetching GitHub.

Keep the portable skill small: when to use the CLI, explicit vault/target rules, the read/apply/export loop, structured errors, and links to deeper runtime help. Exporting/installing a skill is a user action. Never overwrite vault `AGENTS.md`, `CLAUDE.md`, `.claude`/`.agents` directories, provider configuration, or Claudian's per-device skill links automatically.

## 4. Requests, results, and examples

### 4.1 Input and target rules

Small operations can use native flags. For construction and edits, prefer **`input=<vault-relative UTF-8 JSON file>`**. This avoids fragile shell escaping and oversized Windows IPC arguments. A small `json=<payload>` alternative may be supported; require exactly one of them. Do not interpret JSON strings as code.

JSON payloads use `apiVersion: 1`. The native action supplies `command`; the in-process method includes it explicitly. If a target is supplied both in flags and the file, require the values to agree rather than silently override one. Paths are exact vault-relative paths, including the extension. A missing path is an error, not permission to edit the active drawing.

For existing drawings, `apply` requires a fresh `expectedRevision` from a live `read`. `view` is required when more than one eligible view shows the same file. A stale or unavailable target returns a useful error and the candidates; do not pick the first or most recently active leaf.

`source=auto` uses an unambiguous live view when present, otherwise disk; multiple live candidates require a view choice. `source=live` fails when no ready view exists. `source=disk` does not open or save the drawing. Selection filters require a live source. Use one snapshot for each read response, with a default summary and bounded element pages. Omit base64 asset bodies and return a revision/source marker. A changed snapshot invalidates a pagination cursor. An explicit disk read may differ from unsaved live content and must say so.

### 4.2 Result envelope

A proposed completed result shape is:

```json
{
  "apiVersion": 1,
  "requestId": "diagram-pass-01",
  "status": "completed",
  "ok": true,
  "command": "apply",
  "target": {
    "vault": "Design Vault",
    "path": "Drawings/Flow.excalidraw.md",
    "viewId": "opaque-view-id"
  },
  "revision": "opaque-new-revision",
  "persistence": "saved",
  "data": {
    "createdIds": ["a1b2c3d4"],
    "updatedIds": [],
    "deletedIds": [],
    "idMap": {"nodeA": "a1b2c3d4"}
  },
  "warnings": []
}
```

`status` is `completed`, `failed`, or `pending`. A pending response is **not success**: use `ok: null` and direct the caller to `result`. `persistence` is `not-applicable`, `saved`, `unsaved`, or `unknown`; `saved` means the corresponding mutation was acknowledged durable by the existing save path, not merely queued or visible. A `result` lookup may return pending while an ordinary awaited request is still running.

Errors include a stable code, short explanation, relevant field, and recovery action. Initial codes should cover `INVALID_INPUT`, `UNSUPPORTED_COMMAND`, `NOT_READY`, `NOT_FOUND`, `NOT_EXCALIDRAW`, `AMBIGUOUS_TARGET`, `BUSY`, `STALE_REVISION`, `ALREADY_EXISTS`, `DEPENDENCY_UNAVAILABLE`, `INTERACTION_REQUIRED`, `RENDER_FAILED`, `SAVE_FAILED`, and `OUTCOME_UNKNOWN`. Report whether a mutation was not applied, applied, partial, or unknown when failure follows side effects. Do not expose stack traces or private payloads by default.

Return strings from native handlers. Do not use `console.log` as the response channel, patch global logging, or call `process.exit` inside Obsidian. The host owns process exit behavior; agents must parse the result rather than infer success from exit code alone.

### 4.3 End-to-end authoring example

These are proposed commands for the implementation agent to turn into tested examples:

```sh
obsidian vault="Design Vault" help obsidian-excalidraw-plugin:create
obsidian vault="Design Vault" obsidian-excalidraw-plugin:status
obsidian vault="Design Vault" obsidian-excalidraw-plugin:schema command=create
obsidian vault="Design Vault" obsidian-excalidraw-plugin:create input="Agent IO/create-flow.json"
obsidian vault="Design Vault" obsidian-excalidraw-plugin:open path="Drawings/Flow.excalidraw.md"
obsidian vault="Design Vault" obsidian-excalidraw-plugin:read path="Drawings/Flow.excalidraw.md" source=live detail=elements
obsidian vault="Design Vault" obsidian-excalidraw-plugin:export path="Drawings/Flow.excalidraw.md" source=live format=png out="Agent IO/flow-preview.png" requestId=preview-flow-01
```

`Agent IO/create-flow.json`:

```json
{
  "apiVersion": 1,
  "requestId": "create-flow-01",
  "path": "Drawings/Flow.excalidraw.md",
  "operations": [
    {
      "op": "add",
      "elements": [
        {
          "id": "input",
          "type": "rectangle",
          "x": 0,
          "y": 0,
          "width": 180,
          "height": 90,
          "label": {"text": "Input"}
        },
        {
          "id": "output",
          "type": "rectangle",
          "x": 320,
          "y": 0,
          "width": 180,
          "height": 90,
          "label": {"text": "Output"}
        },
        {
          "id": "flow",
          "type": "arrow",
          "x": 180,
          "y": 45,
          "width": 140,
          "height": 0,
          "start": {"id": "input"},
          "end": {"id": "output"}
        }
      ]
    }
  ]
}
```

Here input IDs are **request-local labels**, not instructions to overwrite elements with those IDs. The result maps them to actual IDs. Generated label elements must also be discoverable in the result/read response. An edit request uses the returned actual IDs and live revision:

```json
{
  "apiVersion": 1,
  "requestId": "edit-flow-02",
  "path": "Drawings/Flow.excalidraw.md",
  "view": "view-id-from-open",
  "expectedRevision": "revision-from-live-read",
  "operations": [
    {
      "op": "update",
      "id": "actual-output-container-id",
      "set": {"backgroundColor": "#e7f5ff"}
    }
  ]
}
```

The agent saves that payload to a new input file, calls `:apply`, checks the receipt, exports again, and inspects the rendered image through its host's image tool. Excalidraw should not call an AI provider merely to inspect its own export.

### 4.4 Session receipts, not a job framework

Require a caller-supplied request ID for drawing writes, output-file writes, and trusted scripts. Maintain a small bounded in-memory receipt map, scoped to the plugin session, keyed by ID and a fingerprint of the effective request. Fingerprint parsed input contents, not just an input filename; include the executed script's source identity for scripts. The same ID and same request returns the existing receipt rather than applying again; the same ID with different content is an error. Include a session identifier and document expiration. Do not evict active entries; reject new work when capacity is exhausted.

This permits `:result requestId=...` after lost stdout or a client timeout. It does **not** provide durable exactly-once execution across reloads. After restart/expiration, report unknown outcome and require read-back before a new mutation. Do not silently retry writes. If the async transport issue is reproduced, an explicit `async` flag can return the receipt immediately and let callers poll the same map. In that mode require `requestId` in the native flags before any awaited input-file read; a matching ID inside the file is allowed. No additional queue, database, or HTTP endpoint is necessary.

## 5. Element construction and editing

### 5.1 Use the existing converter for new skeleton batches

The fork's `packages/element/src/transform.ts` does more than fill defaults: it generates measured text, labels, arrow bindings, frame membership, and element ordering. It operates on a temporary scene containing **only the supplied skeletons**. It does not know the current Obsidian scene. [F2]

Implementation sequence:

1. Validate the complete batch before invoking the converter: supported types, finite coordinates/dimensions, unique local IDs, valid references, valid frame children, and bounded size. Preserve intentional zero values rather than applying truthy defaults in the CLI.
2. Allocate collision-free IDs using the plugin's conventions; map local IDs and all intra-batch references before conversion. Pass `regenerateIds: false` after this mapping so the returned ID map remains useful. Account for the plugin's short text IDs and additional IDs generated for bound labels; verify post-save IDs, not just immediate constructor output.
3. Call the **installed** library's converter once for the batch. Verify the resulting IDs, references, and supported types before publication. The converter may log/skip duplicates and may throw on invalid references; it is not a substitute for CLI validation.
4. Put the generated elements into a fresh EA's workbench and use the plugin's insertion or creation path as appropriate. Do not write the returned array directly into a `.excalidraw.md` file or skip text/asset metadata synchronization.

Do not run existing scene elements through the converter just to change their style or text: that risks rebuilding identities and bindings. A new arrow referring to an **existing** scene element cannot rely on the converter's local-ID map. Copy the required live endpoints into EA and use existing `connectObjects`/arrow helpers, then publish the coherent change.

Do not add newly supported fork-only element types to the CLI's advertised schema until the installed package supports them. Basic shapes/text/arrows/frames can establish the first usable slice. Special elements remain accessible through documented EA methods without duplicating every constructor.

### 5.2 Small semantic operation set

`apply` should support these operations through the same staging/publication path:

| Operation | Implementation direction |
| --- | --- |
| `add` | Skeleton batch as above; ordinary shapes, text, arrows, frames, and other installed supported types. |
| `update` | Actual element ID plus validated `set` fields. Copy live elements to EA; preserve IDs/bindings/unknown existing custom data, and maintain version/nonce increments through existing mutation helpers. Route text changes through existing raw/parsed text and measurement behavior. |
| `delete` | Explicit IDs; use deletion/tombstone and binding cleanup behavior, not array omission or attachment deletion. Include bound labels consistently. Require an explicit children option before removing a nonempty frame's contents. |
| `connect` | Existing/request-created endpoint IDs, optional side/arrow styling. Reuse EA's connection helpers; no new routing engine. |
| `group` / `ungroup` | Explicit IDs/group, using existing grouping conventions and preserving unaffected groups. |
| `image` | Explicit vault asset and coordinates, through EA image loading and `imagesDict`. No unsupported bare `fileId` with absent binary/source data. |
| `latex` | Explicit source and coordinates through EA; preflight the existing Extras feature and report unavailable/interaction-required rather than opening consent UI unexpectedly. |

The first release does not need a generic full-scene replacement, arbitrary JSON Pointer patcher, or reflective `ea[method](...args)` command. Use trusted scripts for uncommon operations, advanced layouts, Mermaid, SVG import, Markdown-image workflows, or selection/view automation until their semantics warrant a stable structured command.

An `update` schema must identify fields that cannot be assigned directly: IDs, type changes, version bookkeeping, raw binary data, frame/arrow relationships, and special Markdown-image metadata. Reject unsupported edits with the relevant EA method/help link. Never silently discard unknown requested properties. Do preserve unknown properties already in the drawing.

## 6. Persistence, targeting, and side effects

### 6.1 Explicit live ownership

Resolve the target once to a file, view, and runtime API identity. Check file identity and lifecycle again after awaited work. Return `BUSY` during closing/migration, active same-file Markdown editing, or incompatible synchronization rather than bypassing existing guards. Do not use `getEA().setView()` without an explicit view, `activeWindow`, or a last-active leaf as a hidden fallback.

A specifically requested `open` may reveal a normal main-window tab so the existing React lifecycle actually mounts; a hidden leaf is not guaranteed to initialize. Report the resulting view ID. Existing popout views can be targeted explicitly. Do not migrate the user's leaf or construct a headless React root solely for CLI work. Opening a drawing may run its existing user-configured scripts: document that normal workspace side effect rather than claiming an execution sandbox.

Serialize CLI mutations for the same drawing using a small in-flight guard; return `BUSY` for competing requests rather than creating another persistence queue. Other drawings may proceed independently. This guard does not lock out human editing, so optimistic validation is still needed.

### 6.2 Revisions must cover the data actually being edited

A live read returns an opaque revision tied to the current session, file/view/API generation, and authoritative edit state. Reuse existing save revisions and source identities where they cover the operation. The fork's legacy sum-of-element-versions is not sufficient; even its ordered element hash does not describe Markdown-image source, binary mappings, or all document metadata. [F3], [P7]

Before publication, confirm that the state used to prepare the edit is still current. Include relevant document/asset metadata in the check or refuse an operation while that state is changing. Do not invent a universal merge policy or overwrite newer user edits.

**Important source trap:** view `addElements` performs awaited text work before publication. A check only at CLI entry is insufficient. Add a narrow optional prepublication validation hook or equivalent internal seam, preserving existing callers. Trace where text/asset metadata is changed as well: a guard only immediately before `updateScene` must not leave partially changed metadata from earlier preparation. Prefer request-local preparation and existing lifecycle identities; do not use a full scene rollback that could erase concurrent user work. If a path cannot meet the prepublication contract without broader redesign, keep that path out of structured `apply` and document its trusted-script alternative until resolved. [P6]

### 6.3 Report durable saves, not attempted saves

The current coordinator has useful internal outcomes including `persisted`, `unchanged`, `skipped`, `failed`, and persistence/window handoffs. Public `save()` discards the result, and force-save can return after skipping or catching an error. `addElementsToView()` returning true is therefore not proof that the requested edit reached disk. [P7]

Add the smallest internal outcome-returning method and view facade needed by the CLI while retaining old signatures/behavior for existing callers. Map the result to the CLI's receipt using the acknowledged revision. Do not return the internal prepared-save object or serialized vault content. A handoff is not durable until its existing completion confirms that revision.

Use the existing save coordinator and file persistence rules. Do not add direct `vault.modify` writes to an open drawing. Do not call `clearDirty`, drop failed edits, reset history, or print “saved” because the view currently looks clean. A save failure after scene publication must report `mutation: applied` with unsaved/unknown persistence and preserve the user's recovery options. A late client timeout does not undo the mutation.

Publish a coherent edit with the existing capture/update policy so normal undo remains meaningful. Add focused regression coverage for text/rawText, containers, bindings, and asset publication. Preserve the recently merged undo fix; this CLI task does not authorize reworking it.

### 6.4 Strict creation without another serializer

Reuse EA's Markdown/template construction. However, `create()` currently derives format from global compatibility mode, treats an empty folder as the configured default, and delegates to a creator that silently picks a unique filename. Those are good interactive conveniences but poor implicit CLI behavior. [P4], [P8]

Add a narrow backward-compatible per-call strict creation option, shared with the existing creator: exact vault path (including root), explicit format, fail-on-existing policy, and noninteractive template choice. Existing callers keep their defaults. Let the final Vault create fail on a race instead of choosing an unexpected suffix. Return the actual created path; never delete a concurrently created file as cleanup.

For V1, new CLI drawings default explicitly to modern `.excalidraw.md`; existing legacy drawings retain their format. Reject a contradictory extension/format request. Do not temporarily change plugin settings, invoke a template picker, or duplicate the serializer. Prevalidate construction before creating the file. If later asset/persistence work fails, return the created path and partial outcome instead of hiding an orphan drawing.

Template and back-of-note content must survive. Test the serialization of request-created text/labels and asset records, not just whether a file exists. Do not pretend an elements/appState-only read is a lossless document representation.

## 7. Assets, export, and advanced scripts

### 7.1 Preserve Obsidian asset semantics

Use EA for vault images, PDFs, LaTeX, Markdown images, and linked content rather than manufacturing file IDs. Excalidraw binary files and the plugin's `## Embedded Files`, equation, and Markdown-image metadata are related but not interchangeable. Runtime `updateScene` is not the binary-file loading channel; reuse the existing path that also publishes files. [P4], [P6]

No automatic feature activation. Preflight optional Extras operations through the typed gateway and current user settings. Missing dependencies return an actionable structured result. Core shape/text creation and ordinary SVG/PNG rendering must not require Extras. Read-only inspection should not fetch external assets unnecessarily.

Existing remote assets can make rendering perform network work under normal plugin rules. Declare this possibility in schema/help, preserve consent and network policy, and do not claim the CLI is a sandbox. Do not add a new outbound service, credentials, remote-code loader, or filesystem privilege to make the CLI work.

### 7.2 Visual feedback is part of completion

Use `createViewSVG/PNG` for a selected live scene and the existing file/template exporter for an explicit disk source. Do not auto-save a dirty drawing merely to render it. The result states whether it depicts live or disk content, the revision, effective theme/padding, dimensions, and missing-asset warnings. If a stable requested revision changes while assets are loading, report that conflict rather than claiming the image depicts the earlier revision. [P4]

Await the relevant existing asset/font readiness. Bound the wait and fail clearly when required images cannot be decoded or resolved; do not label a placeholder render as complete. Ordinary read/schema commands must not wait for all image decoding. Prefer a modest preview-size default with explicit bounded scale/dimensions for larger exports.

Write binary PNG with Vault APIs and SVG as UTF-8 to a caller-selected output path. Reject traversal/absolute paths and accidental overwrite of the source drawing or request file. Existing output requires explicit overwrite authorization. Return a small descriptor, not megabytes of base64 in default stdout. Inline image data is unnecessary for V1 because terminal-capable agents can inspect the saved file.

PDF export remains documented as dependency- and interaction-sensitive through existing EA. Do not invent a silent PDF destination contract or another print implementation just for this release.

### 7.3 Full EA/Lib access through one-shot trusted scripts

The advanced command should accept an explicit existing vault script file and JSON arguments. Reuse ScriptEngine's compilation/cache and execution path. Add a CLI-specific execution mode rather than concatenating user arguments into JavaScript. Proposed script context:

```ts
// Existing script body, executed only after explicit trusted acknowledgment.
// utils.input is parsed JSON; ea is a fresh, explicitly targeted EA.
const options = utils.input;
const chosen = ea.getViewSelectedElements();
return { count: chosen.length, requestedLabel: options.label };
```

Provide the already-loaded Excalidraw library through a documented CLI script utility such as `utils.excalidrawLib`, referencing the same runtime as the target view (or the initialized plugin runtime for view-free construction). This is an additional utility reference, not a second import/evaluation or new fork export. The API help must describe its actual installed exports.

Implement a small `executeScriptFileForCLI` facade or equivalent optional execution configuration that supplies `utils.input`, `utils.executionSource = "cli"`, and the library reference; returns the script result; and destroys the CLI-owned EA in `finally`. Existing manual, startup, and sidepanel script lifetime must remain unchanged. The current engine's finally block does not generally destroy EA because persistent hooks and sidepanels depend on it. [P9]

CLI one-shot scripts must not retain hooks, sidepanels, unawaited writes, or timers after completion. Default `utils.inputPrompt`/`suggester` should fail with `INTERACTION_REQUIRED` rather than leave a terminal waiting for a hidden modal. Arbitrary trusted code can still call other APIs directly; this is not a security sandbox or an enforceable side-effect whitelist. A client timeout cannot safely preempt arbitrary synchronous JavaScript or undo its prior side effects.

Keep execution restricted to explicit local source with a `trusted` flag; no remote script URL, implicit script found in a drawing, or code execution through `read`/`schema`. Respect the current script-file format policy. Return JSON-serializable values with size limits; convert an undefined return to a documented null result. Do not serialize live views/DOM/plugin objects. If result serialization fails after edits, report that side effects may already have occurred.

Structured `apply` can promise its bounded validation/publication behavior; arbitrary scripts cannot promise all-or-nothing edits, universal noninteractive behavior, or automatic persistence. Script help must explain explicit `await`/save discipline and the receipt must distinguish script completion from a verified saved drawing. Do not add an implicit “save everything touched” pass.

## 8. Implementation organization and integration points

Start with a few cohesive modules, not a framework:

| Proposed file / existing seam | Responsibility |
| --- | --- |
| `src/core/managers/ExcalidrawCLI.ts` | Plugin-owned registration, dispatcher, lifecycle cleanup, small in-flight/receipt maps. |
| `src/core/cli/cliCommands.ts` | Action descriptors, input normalization/validation, help/schema/examples, finite command handlers. Split by concern only when justified by size. |
| `src/core/cli/cliTarget.ts` | Exact file/view resolution and readiness/revision checks; no alternative view lifecycle. |
| `src/types/excalidrawCliTypes.ts` | Public JSON DTOs/errors; derive element-related types from published fork types instead of copying them. |
| `src/core/main.ts` | Own the manager and register it at a deliberate lifecycle point; minimal composition only. |
| `src/types/types.d.ts` | Canonical compatibility declarations for the optional native CLI API while using older Obsidian types. |
| `src/shared/ExcalidrawAutomate.ts` | Small `executeCLI` delegation and backward-compatible creation options where needed; no CLI parser embedded in EA. |
| `src/shared/Scripts.ts` | CLI-only arguments/library utility/one-shot cleanup and result handling. |
| `ExcalidrawView.ts`, `ViewSaveCoordinator.ts` | Narrow guarded-publication and outcome-returning seams, backed by tests; no new persistence subsystem. |
| `FileManager.ts` | Strict per-call creation behavior shared with current serializers. |
| `SuggesterInfo.ts`, docs generators, CLI docs/skill | Keep public API, generated declarations, discovery, and usage examples aligned. |

Register help/status without eagerly loading optional components. Mutating handlers require initialized plugin/runtime and a valid target. Use `plugin.awaitInit()` only with a bounded readiness policy; never deadlock startup waiting for the component the handler registration itself blocks. On unload, remove handlers through the registration lifecycle, reject/cancel prepublication work, release maps and EA instances, and prevent stale continuations from mutating a replacement plugin/view.

The public EA addition requires its SuggesterInfo documentation and generated/public library declarations to be updated in the same change. Add concise user release notes and maintain localized UI strings in the required languages. CLI command IDs and JSON keys stay stable/nonlocalized; descriptions may use the existing localization system.

### Bundle and startup budget

The plugin is already close to its release size ceiling. PR #2987 reports a 4,995,385-byte production bundle for its validation; this is historical PR evidence, not a fresh measurement of this branch. Measure the actual baseline locally before implementation. [P12]

Do not add Commander, Zod, AJV, Playwright, an MCP server, or an embedded copy of the full EA training corpus to production. Use existing runtime exports, small descriptors/guards, and build-time generation. Return API documentation progressively. Track byte delta after every checkpoint and keep `main.js` under the existing 5 MB policy. If the feature cannot fit, stop and report the measured trade-off; do not silently raise the limit, move it to Extras, or start unrelated size refactors.

## 9. Implementation checkpoints

Each checkpoint should build independently and update this note with actual evidence. The PR remains draft until the complete agreed slice and available validation are done.

### Checkpoint 0 — native transport and baseline

- Read current AGENTS/CONTRIBUTING, record plugin head, installed fork/Extras versions, and bundle bytes.
- Prove native registration/help/unload and async return delivery on the intended desktop installers, including piped agent execution.
- Confirm the installed runtime's converter and export helpers. Verify that no dependency on unpublished fork code has slipped in.
- Choose ordinary awaited output; add the explicit receipt-mode fallback only if a recorded reproduction requires it.

**Exit:** written transport evidence and a runnable small probe, not an assumed `eval` workaround.

### Checkpoint 1 — discovery and read-only operations

- Implement the dispatcher, native descriptors, result envelope, `help/status/schema/api/list/read`.
- Add the proposed EA facade without changing its workbench.
- Test explicit vault/path/view selection, multiple matching views, disk versus live content, pagination, unsupported host API, and plugin reload.

**Exit:** an agent can discover the interface and inspect a drawing without mutating it or loading unnecessary assets.

### Checkpoint 2 — creation and skeleton construction

- Implement validated converter staging and stable returned ID mappings.
- Add strict per-call creation with explicit root path/format/collision behavior through the existing serializer.
- Test labels, arrows, frames, text IDs after save/reopen, templates, collision races, and no partial file on validation failure.

**Exit:** the example flow is a normal editable Obsidian drawing, not just a valid-looking JSON object.

### Checkpoint 3 — guarded edits and persistence receipts

- Implement finite `apply` operations, current-target/revision validation, one in-flight CLI mutation per drawing, and bounded request receipts.
- Add only the necessary prepublication and save-outcome seams.
- Test concurrent human edits, two agent requests, delayed text/asset preparation, save failures, and unload/migration; preserve undo and unrelated metadata.

**Exit:** applied versus saved versus unknown outcomes are truthful, with no silent active-file fallback or second writer.

### Checkpoint 4 — assets and visual feedback

- Add vault image/LaTeX preflight and use the current metadata paths.
- Implement live/disk SVG/PNG export, output path/overwrite checks, asset readiness, and bounded dimensions.
- Test default core functionality without Extras, missing optional features, existing remote assets under current permissions, and dirty-live versus disk previews.

**Exit:** the agent can inspect an exported image of the state it actually edited.

### Checkpoint 5 — advanced script coverage

- Add explicit trusted local script execution with JSON arguments, installed Lib reference, result serialization, and CLI-only cleanup.
- Add tests proving manual/sidepanel script lifetime remains unchanged.
- Document which interactions cannot run unattended and avoid promising script-level transaction isolation.

**Exit:** advanced EA/Lib functionality is reachable without dozens of bespoke commands or new provider integrations.

### Checkpoint 6 — agent discovery and release readiness

- Add the short portable skill, human help/copy entry, README/reference links, generated declarations, and real examples.
- Exercise the workflow through at least two different agent harnesses/Obsidian hosts with terminal access; record tested combinations separately from expected compatibility.
- Run build, relevant tests/lint, library generation, documented runtime lane, and final size/startup checks.
- Replace the PR's plan-only summary with implemented behavior, actual validation, remaining limits, and source/artifact identities. Keep this research/decision record until the maintainer decides its final documentation home.

## 10. Validation matrix and acceptance

### Automated checks

Test parsers/dispatch with plain fixtures and mock only external boundaries where possible. Reuse the repository's test conventions; do not introduce a broad test framework just for the CLI.

- **Protocol:** required/unknown flags; mutually exclusive JSON inputs; invalid JSON/version; `true` string handling; numeric finiteness; bounded request/output sizes; harmful object keys; stable errors; same request ID with same/different effective payload; expired/reloaded receipts.
- **Path safety:** exact root/nested paths, spaces/Unicode, malformed/traversal/absolute paths, source/input/output collisions, output overwrite consent, drawing classification, two files with the same basename.
- **Selection and ownership:** two views of one file, inactive popout, missing view, explicit open readiness, file switch/API replacement across an await, same-file Markdown editing, unload and reload.
- **Authoring:** measured text, raw/parsed links, bound labels, connectors, frame children, ordering, duplicate/dangling skeleton IDs, zero coordinates, existing IDs and version/nonce behavior on updates, deletion/binding cleanup, unrelated custom data preserved.
- **Persistence:** rejected validation causes no published edit; stale preparation does not leave mutated metadata; accepted scene plus failed save remains recoverable; repeated request does not duplicate; later human edits are not acknowledged as saved by an earlier receipt; save/reopen round-trip.
- **Assets/export:** binary/source metadata preserved, missing/decode-failed assets explicit, optional Extras disabled, dirty-live versus disk image, area/selection bounds, effective theme, no base64 in default reads, output file bytes and dimensions.
- **Scripts:** input not interpolated into source; existing engine return/errors propagate; one-shot cleanup on success/failure; persistent manual scripts unchanged; modal helper refusal; nonserializable result after side effects does not claim rollback.
- **Discovery:** descriptor/help/schema/example consistency; API search not reflection execution; skill available offline; no automatic edits to agent configuration.

### Native Obsidian checks

Use the dedicated `excalidraw-test` vault and the existing documented safety/cleanup contract. `npm run test:obsidian:runner` covers the offline host harness; `npm run verify:obsidian:plugin` tests the plugin with its installed component. Add focused native CLI scenarios rather than substituting a blank-drawing smoke for feature coverage. [P13], [P14]

Test macOS and Windows launchers, including `Obsidian.com` on Windows; Linux native execution and a real agent-host invocation need their own evidence. The existing large Windows `eval` temporary-file bridge is test-only and is not a production implementation strategy for these new native commands. Use argument arrays when an agent host exposes process execution, and file input for large payloads. WSL/container/remote agents require access to the actual local Obsidian executable/session; list these as conditional, not universally supported.

Run one complete discovery → create → read → edit → save/reopen → export → image-inspection scenario through Claudian or a direct coding CLI, and a second through Agent Client or Copilot's terminal-capable backend. A single model provider is not a compatibility test of all hosts. Permission-denied and missing-CLI outcomes must be actionable.

Desktop CLI support does not justify breaking mobile plugin startup or increasing `minAppVersion`. Run a mobile/no-CLI loading smoke when feasible. Actual mobile native CLI support is not promised by this design.

### Completion criteria

- Native commands are discoverable and explained without prior knowledge of plugin internals.
- A terminal-capable agent can author and revise a linked diagram without hand-writing Excalidraw bookkeeping or editing compressed Markdown.
- Advanced scripts can use the existing EA and installed library under explicit trust, with accurate limitations.
- No request silently chooses the active drawing, replaces newer user edits, or reports an attempted save as durable.
- Visual exports identify their source/revision and unresolved assets rather than silently claiming complete output.
- The implementation stays in the plugin, uses existing lifecycle/save/asset behavior, and remains within packaging limits.
- The PR records actual test/build/device evidence, unresolved transport/platform limits, and up to three maintainer manual checks. Nothing is merged automatically.

## 11. Questions that require evidence, not speculative architecture

There is no maintainer product decision blocking this plan. Resolve the following in the local environment and record results before broadening scope:

1. Does native async stdout work on the currently supported installers and actual agent transports? If not, use the small explicit receipt mode, not a new server.
2. Which installed fork exports/types exactly match the inspected source? Use only that compatible subset; no CLI-driven fork work is currently needed.
3. Can existing prepublication/save seams provide the required revision and durability evidence without broader refactoring? If not, narrow the structured operation rather than inventing another persistence model.
4. Does the measured production bundle leave sufficient headroom? Report a real budget conflict before changing packaging scope.

## Sources

Repository links below are pinned to inspected revisions where source behavior matters. External documentation and integration READMEs are observations as of 2026-10-11, not compatibility guarantees for future versions.

[announcement]: https://x.com/excalidraw/status/2108249557519970369?s=20
[E1]: https://github.com/excalidraw/cli/blob/55fe7f494837078781a062c4d3faf29c159ebec5/README.md
[E2]: https://github.com/excalidraw/cli/blob/55fe7f494837078781a062c4d3faf29c159ebec5/src/cli.ts
[E3]: https://github.com/excalidraw/cli/blob/55fe7f494837078781a062c4d3faf29c159ebec5/src/scene-content.ts
[E4]: https://github.com/excalidraw/cli/blob/55fe7f494837078781a062c4d3faf29c159ebec5/src/render-page.ts
[O1]: https://github.com/obsidianmd/obsidian-api/blob/9abd9605ce081383674aae1ed111c456edde0688/obsidian.d.ts
[O2]: https://obsidian.md/help/cli
[O3]: https://forum.obsidian.md/t/codex-cannot-get-results-from-delayed-handlers-registerd-with-registerclihandler/113184
[A1]: https://github.com/YishenTu/claudian/blob/main/README.md
[A2]: https://github.com/YishenTu/claudian/blob/1891ce25c2d83ba92334ab1358466ccd2a4fccf3/src/providers/claude/commands/ClaudeCommandCatalog.ts
[A3]: https://github.com/RAIT-09/obsidian-agent-client/blob/3d069c91636588be4e65d955e670403a9ea642d8/README.md
[A4]: https://github.com/RAIT-09/obsidian-agent-client/blob/3d069c91636588be4e65d955e670403a9ea642d8/src/acp/acp-client.ts
[A5]: https://github.com/logancyang/obsidian-copilot/blob/cd873037c357d6a4d60a90ddb9e33705b65f6865/src/builtinSkills/obsidianSkills.ts
[A6]: https://github.com/logancyang/obsidian-copilot/blob/cd873037c357d6a4d60a90ddb9e33705b65f6865/src/agentMode/backends/shared/obsidianCliPath.ts
[A7]: https://agentskills.io/specification
[P1]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/package.json
[P2]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/AGENTS.md
[P3]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/core/index.ts
[P4]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/shared/ExcalidrawAutomate.ts
[P5]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/shared/Dialogs/SuggesterInfo.ts
[P6]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/view/ExcalidrawView.ts
[P7]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/view/managers/ViewSaveCoordinator.ts
[P8]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/core/managers/FileManager.ts
[P9]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/shared/Scripts.ts
[P10]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/constants/constants.ts
[P11]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/src/types/excalidrawLib.d.ts
[P12]: https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2987
[P13]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/docs/OBSIDIAN_RUNTIME_TESTING.md
[P14]: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/bf541ca5d460f5773a5547ba4511eba3ff0f2e5b/scripts/testing/host/processTools.mjs
[F1]: https://github.com/zsviczian/excalidraw/blob/6ec95a327b77df2696e170cb0c9d8a84ac115121/packages/excalidraw/index.tsx
[F2]: https://github.com/zsviczian/excalidraw/blob/6ec95a327b77df2696e170cb0c9d8a84ac115121/packages/element/src/transform.ts
[F3]: https://github.com/zsviczian/excalidraw/blob/6ec95a327b77df2696e170cb0c9d8a84ac115121/packages/element/src/index.ts
