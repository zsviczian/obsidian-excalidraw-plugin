# Issue #3004 — CLI image safety and efficient previews

Status: planning-only handoff; no runtime fix is included.

- Issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3004
- Branch: `2026-10-14-issue-3004-cli-image-efficiency`
- Starting baseline: `master@b022db60b690e648e04b62774f745ae6a6e47cdb`.
- Read the draft PR for this branch for the source-based assessment, proposed request contract, implementation order, and acceptance tests. It is the implementation handoff, not a claim of completed work.

Keep full-fidelity revision checks independent from opt-in preview reduction. Address both `getFiles()` payloads and cached image strings in prepared-file metadata. Add bounded-resolution and selective labelled-placeholder previews without editing source drawings or weakening stale-image checks. Prefer plugin-side export preparation using the existing component APIs.

Implement on this same branch after rereading `AGENTS.md`, `CONTRIBUTING.md`, the issue, and PR discussion. Preserve the original-image export default, request receipts, source/output ownership, and existing public APIs. No fork/package/version changes are approved by this planning checkpoint.

Remove this temporary file once the implementation and repeatable tests replace it. Update the PR with actual validation and remaining risks; do not merge automatically.
