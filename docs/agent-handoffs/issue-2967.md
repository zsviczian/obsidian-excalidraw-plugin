# #2967 — Consistent web drag-and-drop actions

Prepared by **Zsolt's Codex Agent** on **2026-10-11**.

**Status:** Temporary implementation handoff; no runtime fix is included. The maintainer selected this P2 issue for implementation. Continue on `2026-10-11-issue-2967-web-drop-actions` and its draft PR. Remove this planning file before the completed fix is ready for review.

**Baseline:** plugin `master@48c353519a88455e3c365d9741be2f5d90098ae8`.

**Issue and detailed assessment:** [#2967](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2967), [technical assessment](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2967#issuecomment-6108851963). Read the current discussion, `AGENTS.md`, and `CONTRIBUTING.md` before coding.

## Scope and evidence

The reporter says web image insertion/import does not match the modifier tooltip, whereas link and interactive-frame insertion work. Reported environment: Windows 11, Obsidian 1.13.7, plugin 2.28.1. The exact browser and transfer payload are not supplied. The report's description of cache versus vault storage is not itself proof of which handler ran or which file was written.

Current source was rechecked:

- [`DropManager.onDrop`, Files branch](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/48c353519a88455e3c365d9741be2f5d90098ae8/src/view/managers/DropManager.ts#L356-L460) has early web URL/link/embeddable cases but no corresponding web image-import handling or URI-list fallback there. Unhandled mixed browser/file payloads continue into the separate local-file action path.
- [`Text/URI/HTML dispatch and dragover`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/48c353519a88455e3c365d9741be2f5d90098ae8/src/view/managers/DropManager.ts#L630-L864) route URL-only image import to `addImageSaveToVault`, URL-backed images to `addImageWithURL`, and YouTube thumbnails separately. Dragover presents local-file instructions only for a sole `Files` type; mixed payloads receive web instructions. Also check `dropAction`: a URI-list-only payload is not currently included in its accepted types.
- [`modifierkeyHelper.ts`](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/48c353519a88455e3c365d9741be2f5d90098ae8/src/utils/modifierkeyHelper.ts#L80-L145) intentionally has separate configurable web and local action maps. The same key combination can have different meanings in those maps.

**Confidence:** High that classification/dispatch can disagree; medium that this explains the reporter's exact symptoms until reproduced. Do not treat the AI-generated explanation in the issue as evidence.

## Smallest implementation plan

1. Reproduce with a controlled web image, recording only transfer type names and resolved action names, not private URLs/payloads. Use deliberately different web/local modifier mappings to expose accidental fallthrough. Test plain URLs, HTML images, URI-list, and mixed `Files` plus text/HTML/URI payloads. Confirm the invoked operation and actual saved drawing/attachment state.
2. In `DropManager.ts`, handle a usable browser source according to the selected **web** action before genuine local-file fallback. Reuse `addImageWithURL`, `addImageSaveToVault`, and existing thumbnail/link/embeddable handlers. Prefer a narrow correction; introduce one small extraction/classification helper only if it removes duplicated decisions. Do not require dragover to read payload contents that are unavailable until drop. Check URI-list-only drag acceptance as well as its final dispatch before claiming support.
3. Preserve existing source precedence and navigation links, or document a specific correction with a failing test. A YouTube watch URL is not image bytes: distinguish it from the thumbnail URL. Do not force all web images into the vault, flip global modifier defaults, or silently run a local action for an unsupported web combination. If correct dispatch still produces wrong storage, trace the called insertion/import method before changing storage; do not rewrite the cache or loader speculatively.

## Dependencies and boundaries

Start in `DropManager.ts`, with the existing modifier helpers and ExcalidrawView insertion delegates as dependencies. Preserve `onDropHook` consumption without duplicate invocation, the handled/delegate return contract, internal vault drags, OS-file drags, duplicate-file prompts, `.excalidraw` delegation, attachment placement, and EA cleanup. No fork/Extras change, new dependency, new settings, generic drag framework, filesystem privilege expansion, or package/version bump is planned.

The LaTeX popout handoff is independent; these two fixes need no sequencing dependency. Do not include unrelated image reports, OCR, or localization work in this PR.

## Acceptance and validation

Add table-driven dispatch tests using existing repository conventions. For each supported payload, assert the selected operation and hook/return behavior, not just matching tooltip text. Cover normal and deliberately different web/local mappings; URL-backed image versus import; links/embeddables; YouTube link/thumbnail; absent or unsupported source; URI-list-only acceptance; genuine OS/internal drags. Use stubs for network/file effects in unit tests and await asynchronous completion before asserting.

Priority manual checks:

1. Windows browser image drag under URL and import actions: inspect the drawing's stored reference and the actual vault attachment, then save/reopen. Record browser/app/installer versions and restart Obsidian after disabling unrelated plugins.
2. YouTube thumbnail/link plus ordinary link and interactive-frame controls: navigation remains intact and no duplicate insertion occurs.
3. OS-file and internal-vault drags, including a duplicate filename, then a popout browser drop: modifier semantics, tooltip ownership, and cleanup stay correct.

Run `npm run build`, relevant focused tests, and lint on touched code. Follow [Obsidian runtime testing](../OBSIDIAN_RUNTIME_TESTING.md) in the dedicated `excalidraw-test` vault; a blank-drawing smoke is not drag-and-drop validation. Add a concise upcoming release note in `src/shared/Dialogs/Messages.ts`; update maintained locales only if user-visible strings change. Keep bundle growth small and report unavailable browser/platform checks honestly.

**Completion:** Implement on this same branch/PR, remove this temporary file, and replace the plan-only description with confirmed cause, actual tests/results, and remaining limitations. Do not close #2967 based on this draft or merge without maintainer authorization.

**Validation performed for this handoff:** Current issue/comments and relevant source were read. No build, browser drop reproduction, or Obsidian runtime tests were run.
