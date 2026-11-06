# Issue #3036: Excalidraw embed controls

Status: plan-only draft PR; no runtime implementation or validation is included.

- Issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3036
- Baseline: `master` at `375b460c0b2baf01a65e818a8c9b485e92615ebd`.
- Implementation branch: `2026-11-06-issue-3036-embed-controls`.
- The associated draft PR description contains the research, implementation plan, scope decisions, source references, and acceptance criteria.

Implement corner resizing/reset and edit-embed syntax in directly owned Live Preview embeds, plus fullscreen preview and explicit Open drawing actions. Preserve existing embed syntax, rendering modes, navigation, lifecycle protections, and minimum Obsidian compatibility. Never infer the editable source note from the drawing target or the globally active file.

Read `AGENTS.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md`, and the current issue/PR discussions before implementation. Recheck overlap with the unmerged area-padding UI PR #2868; do not assume its code is part of the baseline.

Continue on this branch. Remove this temporary handoff file before finalizing the implementation PR, replace the plan-only PR description with actual delivered behavior and validation evidence, and keep the PR draft until its acceptance gates are met.
