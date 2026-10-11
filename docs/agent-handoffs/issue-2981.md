# Temporary implementation handoff: #2981

Prepared by Zsolt's Codex Agent.

- [Issue #2981](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2981)
- [Technical assessment](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2981#issuecomment-6108754662)
- [Related, unmerged geometry fix #2950](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2950)

The implementation plan belongs in this branch's draft PR description. The warning's actual cause remains unconfirmed; no runtime fix is included. Keep the PR in draft until the failure is established. Remove this temporary file when implementation is finalized.

## Local investigation: 2026-10-11

The handoff branch now includes `master@48c353519a88455e3c365d9741be2f5d90098ae8`, including the fixes from #2987, #2989 and #2985. Runtime source matches that master baseline.

Native checks used Windows, Obsidian CLI 1.14.0, plugin manifest 2.28.1, and the dedicated `excalidraw-test` vault with only Excalidraw enabled (no Extras plugin). The installed component declares 0.18.140 but retains the previously copied, unpublished #2976 artifacts; this is an integration environment, not a published-package release smoke.

- A newly inserted local Markdown image: native pointer dragging of the editor's bottom height handle, both unchanged and immediately after typing, produced no serious-warning Notice or Excalidraw errorlog exception.
- A separate native canvas-corner resize changed actual scene dimensions. Editing again immediately before resizing reproduced the display-size reset described in #2947/#2950, but not #2981's warning. Do not duplicate that open geometry PR or call it this warning's confirmed cause.
- Local content rendered through the real editor refresh button and the focus/selection transition. Direct force-save completed successfully.
- An owned external Markdown source: editing, native editor-height drag, rendering and force-save preserved the external text; the drawing became clean without an Excalidraw errorlog exception.
- A newly created popout: keyboard editor-height adjustment, local Markdown rendering and force-save/reopen preserved both the text and the resulting 500 × 125 image dimensions. This proves the tested persistence path, not physical popout pointer input or macOS behavior.

The existing Excalidraw errorlog was observed through a temporary console wrapper, retaining only `where`, `fn`, message and stack. No warning-path exception was recorded. Separate developer-buffer errors appeared in `getWithBackground → getIMG`, reading `exportWithBackground` from null plugin settings; these were not emitted by the observed serious-warning/save paths and are not an established diagnosis for #2981.

Only UUID-owned drawing/source files were used. The main drawing, external source and popout drawing were deleted after closing their leaves; the console wrapper and probe controller were removed and prior focus restored. Prepared user examples were unchanged.

## Evidence still needed

The original report names Obsidian 1.14.4/macOS 27 and omits the plugin version and exception. Obtain a reproducible sequence/drawing or its console error (`where`, `fn`, stack), including whether “bottom line” means the editor separator or canvas image handle. The maintainer has been asked for that evidence. Do not add speculative pointer, save or generation changes, suppress the warning, or publish a release note claiming a fix on the basis of the unrelated geometry reset.
