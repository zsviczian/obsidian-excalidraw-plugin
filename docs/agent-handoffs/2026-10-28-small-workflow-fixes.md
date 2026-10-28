# Small workflow reliability package — 2026-10-28

Prepared by **Zsolt's Codex Agent** at the maintainer's request.

**Status: implementation handoff only. No runtime fixes or new regression tests are included in this checkpoint.** Continue on `2026-10-28-small-workflow-fixes` and its draft PR. Starting baseline: [`master` at `9e52063296ffcd3b38d6a2bd5b23546d7e6268f7`](https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7). Remove this temporary handoff before finalizing the implementation; preserve the useful evidence and results in the PR description.

## Objective and selection

Deliver three independent, narrowly scoped plugin improvements that the maintainer can review together at the end. Prioritize user benefit multiplied by confidence and testability, not severity wording or issue age alone.

| Priority | Issue | User outcome | Why this package |
| --- | --- | --- | --- |
| 1 | [#2729: Canvas embed does not scale](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2729) | Excalidraw previews remain useful when an Obsidian Canvas node is resized. | Multiple reports, maintainer acknowledgement, focused plugin rendering/style path. |
| 2 | [#2743: Nested-split fullscreen is blank](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2743) | Fullscreen works from quarter/eighth splits and restores the workspace on exit. | Explicit clean-vault reproduction and a small, identifiable fullscreen manager. |
| 3 | [#2649: Template paths and cancellation](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2649) | Users distinguish same-named templates and can cancel without creating an unwanted drawing. | Clear requested interaction; current source explains the cancellation fall-through. |

These are not claimed to be the three most severe bugs in the tracker. They are the recommended bounded package for unattended implementation. No dedicated matching PR was found in the PR searches during preparation. Recheck before coding because other work can land.

Use separate implementation/test commits for the three issues. Do not make their fixes depend on a shared refactor. Recommended execution order: fullscreen, template workflow, Canvas sizing; the benefit ranking above is independent of implementation order.

## Working agreement for the implementing agent

Read the current `AGENTS.md`, `CONTRIBUTING.md`, issue-assessment/resolution workflows, this PR, all three issues and comments, and `docs/OBSIDIAN_RUNTIME_TESTING.md`. Verify the remote branch head, local worktree and intervening master changes. Preserve concurrent work. The source links below are preparation evidence, not permission to overwrite newer code.

Proceed without routine design questions within the boundaries below. For each issue, first establish a failing current-baseline reproduction or regression, then apply the smallest safe fix. If it is already fixed, identify the fixing change and demonstrate the expected behavior rather than adding speculative code. If it cannot be reproduced, requires an incompatible API change, needs work in the fork/Extras, or depends on unavailable platform evidence, record that item as blocked and continue the other independent items. Do not silently substitute another issue, suppress errors, or claim all three fixed.

Stay in this plugin repository. No dependency/version bumps, new frameworks, scene-format changes, broad save/cache rewrites, label-taxonomy redesign, or changes to the component fork, Extras, CLI bundle or EA script repositories. Do not merge or close issues. Keep the PR draft for maintainer review.

## 1. #2729 — Canvas preview sizing

### Evidence and current source

Read the [full discussion](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2729), especially the [maintainer acknowledgement](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2729#issuecomment-4236297094). Another reporter tested without custom CSS and with only Excalidraw; a commenter reports PNG as a working alternative. The reporter-supplied AI patch was not compiled or verified and is not an accepted implementation.

In [`MarkdownPostProcessor.ts`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/src/core/managers/MarkdownPostProcessor.ts), `setImgStyle` deliberately skips note-style dimensions for `onCanvas`, but `getIMG` still passes `imgAttributes.fwidth` into `_getSVGNative` without that distinction. `_getSVGNative` sets/removes the SVG width and removes height. This is a concrete investigation lead, not a runtime-proven root cause. Inspect the actual node DOM and computed styles, including [`styles.css`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/styles.css).

The SVG cache key does not contain display width. Check whether cached SVG nodes are cloned before display-specific mutation; two embeds of the same drawing must not change each other's size or detach each other's DOM. Do not redesign the cache to solve a CSS-only defect.

Related [#2685](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2685) is a **closed Markdown editing-view width-cap report**, not proof that Canvas is fixed or the same cause. Preserve its corrected note sizing. Open [PR #2868](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2868) concerns `area=` padding controls; do not copy, merge or supersede that feature.

### Bounded behavior

A drawing preview in an Obsidian Canvas file node must respond to the node's available size without the reported small fixed-size result. Preserve aspect ratio, existing immersive/non-immersive behavior and existing interaction/link behavior. Distinguish Canvas-node layout from note embed width semantics. Prefer scoped CSS/display sizing over repeated rerenders or per-node observers unless measurements establish that they are necessary.

Do not globally force every SVG/image to fill every container. Do not change actual drawing element coordinates, exported image dimensions, note width overrides, padding semantics or the saved Canvas node dimensions as a workaround.

### Acceptance and regression matrix

- [ ] Reproduce on the baseline with native SVG previews and a normal drawing in a standalone Obsidian Canvas node; record node/preview bounds before and after resize.
- [ ] Test wide/tall drawings and small/large nodes; resize and zoom Canvas in both directions. No distortion, clipping regression or unexpected scrollbars.
- [ ] Test native SVG, SVG-as-image and PNG settings; retain the working alternatives rather than forcing a mode change.
- [ ] Test two differently sized nodes referencing the same drawing, warm/cold cache and close/reopen. One instance must not affect the other.
- [ ] Retain explicit/default sizing in Markdown Live Preview and Reading view, plus a representative group/frame/area embed. Preserve the closed #2685 behavior.
- [ ] Add a focused source/DOM regression that fails before the fix, and real Obsidian geometry/visual evidence. A mocked DOM alone does not establish CSS layout correctness.

## 2. #2743 — Fullscreen from nested workspace splits

### Evidence and current source

The report supplies a clean-vault Windows reproduction: one note occupies the left half, another the upper right, and a drawing the lower right. Toggle Fullscreen produces a blank view; toggling again exits. Quarter/eighth splits fail while a half split works.

Inspect [`ViewFullscreenManager.ts`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/src/view/managers/ViewFullscreenManager.ts). `gotoFullscreen` walks only as far as the first `.workspace-split`, marks part of the path visible, then hides other unmarked splits across the owning document. An outer split containing the drawing can therefore remain eligible for hiding. This is a source-supported hypothesis to prove with nested fixtures and the native workspace, not a zoom-to-fit diagnosis.

The manager already uses the view's owning document. Preserve that. Trace its callers and cleanup paths, including repeated toggles, view closure and window migration, before changing class ownership.

### Bounded behavior

Keep the drawing and its complete ancestor path visible while hiding the appropriate surrounding workspace. Exiting must restore the previous workspace visibility, dimensions, controls and focus without moving leaves, rebuilding the workspace, reopening the drawing, or changing its contents. Handle absent optional header/control nodes safely.

Scope DOM changes to the intended owner document and elements owned by this fullscreen operation. Avoid clearing unrelated classes/styles or touching a drawing in another window. Repeated entry/exit must be idempotent and cleanup must remain safe if the view is closed.

### Acceptance and regression matrix

- [ ] Add nested DOM fixtures for unsplit, half, quarter and eighth splits, covering both split orientations and different drawing positions. Assert that no target ancestor is hidden.
- [ ] Assert that intended siblings are hidden during fullscreen and restored afterward; existing styles/classes are preserved. Cover missing optional DOM nodes.
- [ ] In real Obsidian, enter/exit from the reported lower-right layout and a deeper layout; the drawing remains editable and workspace geometry is restored.
- [ ] Repeat toggles and test a second drawing plus a popout. No cross-window changes, residual hidden panes, duplicate handlers or drawing edits.
- [ ] Exercise view close/plugin cleanup while fullscreen where the existing lifecycle permits it. Record any untested mobile behavior rather than claiming coverage.

## 3. #2649 — Template chooser paths and real cancellation

### Evidence and current source

The requested UX is explicit: show folder context, offer an explicit blank/default drawing choice, and let Escape cancel instead of creating an empty drawing. The related #1348 request is explicitly outside this issue.

[`templatePromt` in `Prompt.ts`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/src/shared/Dialogs/Prompt.ts) currently auto-selects one file and otherwise builds `[[path|name]]` entries; dismissal resolves to null. [`PluginFileManager.getBlankDrawing`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/src/core/managers/FileManager.ts) then falls through to blank drawing content. `createDrawing` also creates the target folder before awaiting the template content. Cancellation must be resolved before those side effects.

[`getListOfTemplateFiles`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/9e52063296ffcd3b38d6a2bd5b23546d7e6268f7/src/utils/fileUtils.ts) already sorts by full path. Do not treat the issue's older description of discovery ordering as current behavior. The helper is exposed through EA and consumed by other workflows; retain its `TFile[] | null` meaning and do not insert a fake blank file into it. `CommandManager.ts` is another direct `templatePromt` caller and must be audited.

### Bounded behavior and compatibility

When a template chooser is shown, display the filename plus meaningful folder context, preferably relative to the configured template root. Preserve the current path-based ordering of actual files. Add a localized blank/default drawing option at the top and initially select it when the chooser opens with an empty query. Selecting that entry creates a normal blank drawing; Escape or dismissal cancels. Filtering and selection must continue to address the intended real file, including duplicate basenames and nested folders.

Keep no-template and single-configured-file automatic creation behavior unless an explicit chooser was requested. Do not introduce extra prompts into unattended EA/CLI paths. Distinguish template, blank and cancel at the interactive boundary with an explicit internal result rather than overloading null as both blank and cancel.

Audit callers before choosing the implementation shape. Preserve public `getBlankDrawing`, `createDrawing`, EA and exact-path CLI contracts. Explicit `initData`/programmatic creation must remain deterministic. Do not broadly change shared link-prompt cancellation semantics. A cancel must create no drawing, exported placeholder, target directory, Markdown embed text or unnecessary leaf, and must not throw an unhandled rejection.

### Acceptance and regression matrix

- [ ] Two templates with the same basename in different subfolders have distinguishable labels and load the selected contents. Preserve current real-file ordering and filtering.
- [ ] Explicit blank choice creates exactly one normal drawing with existing theme, compatibility and compression behavior.
- [ ] Escape and outside dismissal leave file/folder counts, note text and drawing state unchanged; restore focus without an unwanted new leaf.
- [ ] Cover file-explorer folder context menu, relevant create/new-and-embed commands and direct chooser callers. Test cancellation before creation in a destination that does not yet exist.
- [ ] Zero templates, a single configured template, `.md`/legacy `.excalidraw`, explicit initialization data and representative EA/CLI creation continue to work without newly introduced prompts.
- [ ] Add regressions around selection-result handling and caller side effects; verify the actual chooser and filesystem in Obsidian. Update required locales for new UI text.

## Validation and final deliverable

Use the repository's existing test infrastructure, not a new testing framework. Add the smallest relevant tests that execute production logic, with clear pre-fix failure evidence. Run focused tests for each item, `npm run test:markdown-embeds`, `npm run test:drawing-load-error`, `npm run build`, `npm run lib`, `npm run test:bundle`, and lint for touched files. Run the required full lint gate and distinguish existing baseline errors from introduced failures. Record the exact final `dist/main.js` size and headroom below 5,242,880 bytes.

For native validation, follow `docs/OBSIDIAN_RUNTIME_TESTING.md`, run `npm run test:obsidian:runner` and the guarded `npm run verify:obsidian:plugin` lane using the declared installed component. Add the issue-specific UI/geometry scenarios above; the smoke lane alone does not test these fixes. Use only the already-authorized `excalidraw-test` vault and UUID-owned fixtures. Do not create a substitute vault or touch personal notes. If the prepared environment is absent, record the native-validation blocker rather than weakening guards or pretending source tests suffice.

The ordinary smoke runner expects no template chooser. Restore any temporary template settings before running it, and restore settings/workspace changes from the issue-specific tests in cleanup. Avoid changing shared test examples. Record source revisions, actual deployed artifact hashes, Obsidian/platform versions, cleanup and errors. Mobile/native platforms not exercised must be stated explicitly.

Before final handoff, independently review the combined diff for regressions, add a concise release note in the existing upcoming `Messages.ts` section without bumping versions, remove this temporary file, and update the PR with actual changes and results. Leave it draft. Do not use closing keywords for an unresolved or only partially implemented issue.

The maintainer's end review should need only three demonstrations: (1) resize two Canvas nodes containing the same drawing, (2) toggle fullscreen in a nested split and return, (3) choose between same-named templates, then cancel without a new file. Provide before/after screenshots or short recordings plus the regression-test results. Do not require the maintainer to reconstruct the issue discussions.

## Separate triage record and remaining categorization work

The 2026 `is:issue is:open no:label` search identified #3010, #3009 and #3000. Their bodies/current metadata were read; each had zero comments. Applied and read back: #3010 `bug` + `incomplete`; #3009 `enhancement`; #3000 `bug`. A subsequent identical date-bounded no-label search returned no results. This clears the completely unlabeled queue, **not** every missing dimension on all 2026 issues.

The authenticated connector could read/write issue labels but rejected the repository-wide label-catalog endpoint. The policy in `.github/ISSUE_LABELS.md` explicitly forbids creating labels or treating its proposed names as evidence that they exist. Accordingly, component labels were not guessed or created. The three-axis assessment still needing catalog-backed completion is:

| Issue | Clarity/evidence | Type | Component assessment |
| --- | --- | --- | --- |
| #3010 | Incomplete: no usable debug details, textual reproduction or drawing fixture. | bug, applied | Undetermined; do not infer fork ownership from an image artifact alone. |
| #3009 | Request is understandable; alternatives leave the preferred default undecided. No status label is required just to fill the axis. | enhancement, applied | Plugin Markdown-image extraction dialog. |
| #3000 | Clear reported overlap and steps, but no independent reproduction; two enabled CSS snippets need isolation. | bug, applied | Plugin/fork UI boundary not established; inspect computed styles before assigning. |
| #2729 | Maintainer acknowledged behavior; original report still lacks debug information. `confirmed` and `incomplete` may coexist under policy. | existing bug | Plugin embed rendering/style integration. |
| #2743 | Clean-vault reporter reproduction plus a source-supported mechanism; native reproduction remains required. | existing bug | Plugin fullscreen manager. |
| #2649 | Clear requested behavior and source-confirmed cancellation fall-through. | existing enhancement | Plugin template/creation workflow. |

An agent with live label-catalog access can finish this housekeeping independently of the three code fixes: read actual label names/descriptions, add only supported existing labels, preserve unrelated metadata, and read back each change. For a broader partially categorized backlog pass, remain limited to open issues created in 2026, process newest first, and read each issue's discussion before changing it. Never create/rename/recolor labels, promote severity from a reporter claim, or label an unattempted reproduction as `cannot-reproduce`. Do not mark `needs-info` unless a specific clarification has actually been requested. Identify any agent-authored comments as **Zsolt's Codex Agent**; label-only edits do not need comments.

## Preparation checks versus implementation checks

Completed during preparation: repository instructions/policy review; open-issue and PR searches; selected issue bodies/discussions; relevant current-master source inspection; branch-baseline verification; three label updates with remote read-back.

Not performed during preparation: product-code edits, builds, new tests, native Obsidian reproduction, performance measurements or physical mobile checks. The remaining component categorization is explicitly not reported as complete.
