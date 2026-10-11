# #2970 — LaTeX editor input in popout windows

Prepared by **Zsolt's Codex Agent** on **2026-10-11**.

**Status:** Temporary implementation handoff; no runtime fix is included. The maintainer selected this P1 issue for implementation. Continue on `2026-10-11-issue-2970-latex-popout-input` and its draft PR. Remove this planning file before the completed fix is ready for review.

**Baseline:** plugin `master@48c353519a88455e3c365d9741be2f5d90098ae8`.

**Issue and detailed assessment:** [#2970](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2970), [technical assessment](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2970#issuecomment-6108909739). Read the current discussion, `AGENTS.md`, and `CONTRIBUTING.md` before coding.

## Scope and evidence

The reporter can edit a formula in a main-window tab, but arrows, click placement, and Backspace behave incorrectly when the drawing is opened in a new window. Reported environment: Ubuntu/Snap, Obsidian 1.13.7, plugin 2.28.1, Extras 0.1.1, with no Latex Suite dependency in the reproduction.

The relevant source was rechecked on the baseline above:

- [`LaTexPrompt` in `Prompt.ts`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/48c353519a88455e3c365d9741be2f5d90098ae8/src/shared/Dialogs/Prompt.ts#L110-L290) still constructs its CodeMirror `EditorView` before `this.open()`. It supplies `parent`, but no explicit root. `onOpen()` only focuses the editor.
- [`FloatingModal.open()`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/48c353519a88455e3c365d9741be2f5d90098ae8/src/shared/Dialogs/FloatingModal.ts#L252-L397) derives the final document/window after `super.open()`. LaTexPrompt already enables key capture and excludes `.cm-editor` from dragging; the optional capture-phase keydown stopper is not active on this path.

**Leading hypothesis, not a confirmed diagnosis:** CodeMirror retains the construction-time root when Obsidian mounts/adopts the modal into another document. The construction order is verified; the root mismatch and its effect on input need runtime confirmation.

## Smallest implementation plan

1. Reproduce the main-tab versus direct-popout sequence in the dedicated test vault. Immediately after modal mounting, compare the editor's root, its DOM's `getRootNode()`/`ownerDocument`, and the modal's owner document. Check selection/focus and whether arrow/click events reach CodeMirror. Do not log formula contents. Compare a current installer as a control; do not substitute an upgrade suggestion for tracing the defect.
2. If the root mismatch is confirmed, correct it **inside LaTexPrompt**, after mounting and before focus, using the installed CodeMirror root-rebinding API suggested in the assessment (`setRoot`; verify the installed signature). Creating the editor only after mounting is the alternative if required. Use the actual mounted Document/ShadowRoot, not the globally active window. A construction-time explicit root can still be wrong if the node subsequently moves.
3. If roots already match, follow the first demonstrated focus/selection failure instead. Do not apply the root patch without evidence, remove modal event guards speculatively, or expand into React/runtime refactoring. Preserve submit/cancel, Mod-Enter, optional Latex Suite extensions, and editor destruction. Add a concise upcoming release note in `src/shared/Dialogs/Messages.ts`.

## Dependencies and boundaries

Start with `Prompt.ts`; inspect `FloatingModal.ts` as context and change it only if evidence requires it. Extras supplies MathJax, not this CodeMirror input. No fork change, Extras release, package/version bump, new setting, or new dependency is planned. Check installed CodeMirror compatibility before implementation. Do not add focus polling, arbitrary delays, repeated editor recreation, or a new document manager. Keep the diff and bundle impact small.

## Acceptance and validation

Add a focused regression in the existing test approach, ideally using a real secondary document/window. Assert root/selection ownership and actual input behavior; a mock that merely observes a `setRoot` call is insufficient. Run `npm run build`, relevant focused tests, and lint on touched code; report unrelated baseline failures separately. Follow [Obsidian runtime testing](../OBSIDIAN_RUNTIME_TESTING.md), using only the dedicated `excalidraw-test` vault. No new testing framework is needed.

Priority manual checks:

1. Main-window and directly opened popout: click placement, arrows, Backspace, selection replacement, undo, and Mod-Enter; save/reopen the edited formula.
2. Move a drawing tab to a popout, then open the formula editor; submit, cancel, close/reopen, and reload the plugin without stale editor/listener behavior.
3. With and without Latex Suite: editing remains usable, canvas hotkeys do not fire while typing, and dragging outside the editor still works.

**Completion:** Use this same branch and PR; replace the PR's plan-only description with confirmed cause, actual changes/tests, and remaining limitations. Remove this temporary file. Do not mark the issue resolved based only on a build or merge without maintainer authorization.

**Validation performed for this handoff:** Current issue/comments and the relevant source were read. No build, device test, or Obsidian runtime reproduction was run.
