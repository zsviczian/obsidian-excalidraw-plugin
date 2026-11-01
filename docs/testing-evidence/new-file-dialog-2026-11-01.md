# New File dialog: focused follow-up

Folder and file-name controls reuse the full-row file-selector layout. The label takes its
natural width; the input fills the remaining space. Existing mobile selector rules avoid a
fixed control height. The shell remains Obsidian's standard Modal on desktop and mobile.

The New File folder suggester opts out of focus opening. The first input event enables native
completion; blur resets that gate, so returning to the field does not reopen suggestions until
typing. Closing the modal closes suggestions and removes the optional input/blur gates. Other
VaultPathSuggest consumers retain their existing open-on-focus default.

The maintainer explicitly requested no full regression. Focused evidence only:

- `node --test scripts/testing/drawingCreationIntegration.test.mjs`: 8/8 pass.
- ESLint for Prompt.ts and VaultPathSuggest.ts passes; production build passes.
- One native dialog inspection in the repository-owned excalidraw-auto-test vault passes:
  both fields fill the remaining row (472/526 and 452/526 pixels); initial focus and refocus
  leave suggestions closed; typing opens real folder suggestions; cancellation settles
  without creating a file. Owned UI, workspace and temporary throttling are restored.
- [Native receipt](new-file-dialog-2026-11-01.native.json) records the inspected artifact hashes.
  The final build also incorporates the maintainer's subsequent manifest-only 2.29.1 updates;
  the dialog inspection used the preceding manifest version with these same UI changes.

Native-harness setup initially selected a Markdown view for a drawing; explicitly requesting
an Excalidraw view resolved that prerequisite. The installed Obsidian uses modal-header-button,
so this probe cancels through the actual Nevermind button rather than guessing a legacy close
selector. Cleanup is independent of assertions. The focused checks passed after correcting
those test-only assumptions; no full portable/native/device profile was run.

Physical phone/tablet keyboard clearance was not exercised. Standard Obsidian modal ownership
is preserved, without a floating or draggable replacement. Hosted CodeScanner is unavailable
locally; touched TypeScript lint and the build passed.
