# Drawing load error diagnostics — implementation handoff

Issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2995

## Accepted scope

Keep the existing malformed-drawing recovery and local-backup behavior. Do not silently repair, change frontmatter, switch views, or rewrite user files.

1. Show the affected drawing's **filename in the warning screen title**, with a reasonable truncation strategy for long names.
2. Add a **More information** button to the warning. Keep the initial warning short; retain its existing recovery actions.
3. Explain in the expanded view that a file marked with the `excalidraw-plugin` frontmatter property can fail to load if the Excalidraw drawing-data section is missing or malformed. A common cause of malformed JSON is a sync conflict or interrupted reconciliation across devices. Explain why the existing local backup may help, without implying sync is always responsible.

## Investigation for implementation agent

- Trace the actual error/recovery modal, file context and parsing paths in `src/view/ExcalidrawView.ts`, `src/shared/ExcalidrawData.ts`, and the dialog components. Verify the filename is available at the UI boundary, including restored popout windows and multiple visible leaves.
- Determine whether the expanded view can **safely diagnose** distinct cases: missing drawing section; present section but invalid JSON; compressed drawing data that cannot be decompressed; or valid data failing later. Report only checks supported by actual parsing code, and avoid claiming to know the cause when ambiguous.
- Explore an optional, explicitly user-initiated **attempt to decompress/recover** malformed compressed data, but **do not implement it as part of this PR without maintainer approval**. Consider whether partial decompression is technically meaningful and whether recovery can work on a copy without overwriting the original. Avoid unsafe promises.
- Reuse existing UI components and localized strings; avoid new dependencies and unrelated refactoring.

## Acceptance criteria

- Warning title identifies the correct file even when multiple drawings load during workspace restore.
- Initial warning remains concise, with a More information control.
- Details accurately describe missing vs malformed drawing content, explain local backup, and distinguish verified diagnostics from possible causes.
- Existing repair/backup paths behave exactly as before; no automatic file changes.
- Test ordinary Markdown with stray Excalidraw frontmatter, malformed JSON, a valid drawing, a sync-like damaged drawing, multiple simultaneous leaves, and restored popout windows.
- Run applicable lint/build and Obsidian runtime checks when available; report unrun checks honestly.

This is a planning-only branch. No runtime implementation has been made.
