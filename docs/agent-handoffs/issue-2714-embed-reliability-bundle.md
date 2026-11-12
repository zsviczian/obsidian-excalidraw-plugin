# TEMPORARY — six-issue insertion, embed, export, and Save As handoff

**Status: plan-only draft PR. No runtime implementation has been made on this branch.**

This file exists solely to give GitHub a branch diff so the local agent can take over the draft PR. **Delete this file before final review**; the PR description is the implementation plan and must be updated with actual code changes and test evidence.

Tracked issues (do not auto-close until individually verified):
- [#2257 — Invalid / template-like metadata aliases must not crash file insertion](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2257)
- [#2303 — Markdown headings containing links fail as embeddables](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2303)
- [#2570 — Escaping special characters in exported SVG hyperlink attributes](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2570)
- [#2389 — NBSP text can break drawing embeds](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2389)
- [#2858 — Code-block-produced drawing embeds (optional, strictly time capped)](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2858)
- [#2714 — Ctrl+Shift+S / Save As unexpectedly changes drawing theme](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2714)

Baseline: `master@87f0f929fb07775d4d8731d1f92a84f876dd377f`.
Owner: **this plugin repository only**. Do not alter the Excalidraw fork, Extras, scripts, or other repositories in this implementation.

Follow [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [CODING_STANDARDS.md](../../CODING_STANDARDS.md) and [issue resolution workflow](../agent-workflows/issue-resolution.md).

Before editing source, confirm which of the six reports still fails on current master; check related recent work. Produce a failing regression for each confirmed defect. Preserve all existing SVG link removal and link-rewriting/export hooks; test broad heading/alias/anchor combinations before altering heading resolution. For #2714, honor the maintainer's most recent direction to block the unintended `Ctrl+Shift+S` shortcut in the focused Excalidraw view rather than changing the drawing theme logic without proof. For #2858, **maximum 90 minutes total**, abort when the compatibility fix is nontrivial, risky or requires another plugin's internals; do not sacrifice the other fixes.

Finish by deleting this file, documenting exact reproduced vs. unreproduced outcomes, test commands/results, and remaining risks in the PR. Keep the PR draft until reviewer-ready. No merge without maintainer approval.
