# Automated test coverage: plugin integration owner

Prepared by **Zsolt's Codex Agent**, 2026-10-28, at the maintainer's request.

**Temporary plan-only handoff. No test implementation or production change is included.** The draft PR on this branch owns the detailed design, alternatives, coverage matrix, cross-repository contracts, milestones and acceptance criteria. Read its full description and companion PRs before implementation. Continue on this branch; do not create a replacement PR.

## Baseline and workspace

- Branch: `2026-10-28-automated-test-coverage`, targeting `master`.
- Plugin baseline: `962416bbd379b9c8aabf2a892940ef3abbf11185`.
- Fork baseline: `9ede0da2581387b0bc12ef184a093a9274be9bb7`.
- Extras baseline: `f82fe17c11f76f63163bfb5b2df430cbacd051d6`.
- All three repositories have a companion branch with the same name. Verify current remote heads and instructions when resuming; these baseline SHAs are investigation context, not permission to overwrite newer work.

Read `AGENTS.md`, `CONTRIBUTING.md`, `docs/OBSIDIAN_RUNTIME_TESTING.md` and `docs/agent-workflows/issue-resolution.md` first. Read the fork's inventory/contracts and Extras instructions before cross-package work. Extras had no `CONTRIBUTING.md` at the investigated baseline.

## Ownership and starting checkpoint

This repository owns the portable, tracked test-vault seed, fixture provenance, guarded Obsidian CLI orchestration, mobile-layout emulation, cross-package scenario registry and combined evidence report. Extend `scripts/testing/host/`; do not replace its path, artifact, error and cleanup safeguards. The fork and Extras own their independent tests and immutable artifact manifests.

First inventory every existing test and important feature, run and record the actual baseline, and agree the versioned test-report/artifact contract. The existing desktop `excalidraw-test` corpus was not accessible during design: curate only explicitly selected, redistributable assets locally; never copy its settings, secrets or personal content wholesale. The committed core corpus must work without that desktop path.

Independent tests may run in parallel. Only one coordinator may stage builds, control native Obsidian, change device mode or attach a debugger in a shared application session. A cross-repository host lock is mandatory.

## Completion discipline

Implement the full important-feature matrix, not only a harness and smoke test. Distinguish source tests, real browser tests, real Obsidian tests, desktop mobile emulation and physical-device evidence. Missing capabilities and cleanup errors must never become passes. Do not merge, publish packages, bump versions or absorb unrelated open PRs.

Before final handoff, transfer durable operating instructions into maintained testing documentation, remove this temporary file, update the PR with actual results and remaining limitations, and leave it draft for maintainer review. No build, suite or native runtime test was executed during this design-only preparation.
