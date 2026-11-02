# Temporary implementation handoff — workflow improvements (#2941, #3000, #3009, #2894)

**Status:** Plan only. No runtime fix or passing test is claimed. **Remove this file before finalizing the PR.**

Base: `zsviczian/obsidian-excalidraw-plugin` `master@5429408ad0e58ac3eb918439f463bde741357143` (2026-11-02).

Owning issues:
- [#2941 — Ctrl+S while editing text](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2941): preserve the maintainer's requirement that Ctrl/Cmd+S always force-saves the current vault drawing. Fix any text-edit route that opens standalone export instead; don't disable save.
- [#3000 — Zen mode exit overlaps zoom](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3000): separate the zoom and exit controls without broad layout changes.
- [#3009 — Markdown image extraction destination](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3009): default to the owning drawing's folder, not attachments, while retaining user folder choice.
- [#2894 — Pasted code block height](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2894): fit newly inserted code cards to content, without changing existing cards or all back-of-note cards.

Implementation ownership:
- This branch is the plugin implementation workspace. Continue on it, not a new competing branch.
- Investigate source and actual failing behavior before changing it. The candidate files identified in the draft PR are starting points, not confirmed causes.
- If fork changes are genuinely required, follow its AGENTS.md, CONTRIBUTING.md and fork-inventory protocol; create a separate companion draft PR on its own branch. Do not publish a package or update consumer dependency without explicit authorization.
- Follow the current [issue-resolution process](../agent-workflows/issue-resolution.md), [tests](../TESTING.md) and [native runtime guide](../OBSIDIAN_RUNTIME_TESTING.md).

Completion conditions:
- Add targeted regressions that fail before each correction, then pass after; execute final portable and native regression gates with identified source/artifact revisions.
- Confirm real persistence after reopen, main/popout behavior and device/layout limits; physical stylus/touch and OS-native drag are not proven by emulation.
- Keep four independently reviewable changes and remove this temporary handoff file.
- Replace the draft PR's plan with an evidence-based outcome summary; leave draft until validation is complete and do not merge.
