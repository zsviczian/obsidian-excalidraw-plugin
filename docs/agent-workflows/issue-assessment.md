# Issue assessment

Use this template for a source-based GitHub issue assessment intended for a separate implementation agent. Post the completed assessment as an issue comment only when authorized. Investigation does not authorize code changes.

Before writing, read the issue and comments, related PRs and commits, and the relevant repositories' `AGENTS.md` / `CONTRIBUTING.md`. Trace the affected code and callers at known revisions. Link to commit-pinned source where useful. Keep verified evidence separate from hypotheses; omit sections that do not apply.

## Triage and handoff

1. Investigate and comment on each issue; check whether a fix or PR already exists.
2. Return a short prioritized list to the maintainer, including issues ready for implementation and those needing more evidence.
3. Only after the maintainer selects specific issues, prepare implementation branches and draft PRs using [issue resolution](issue-resolution.md). An assessment alone does not authorize them.

## GitHub issue comment template

### Technical assessment — Zsolt's Codex Agent

**Scope and baseline:** Issue #…; plugin `master@SHA`; fork / Extras revisions if relevant.

**Observed behavior and evidence**
- Reproduction conditions and expected versus actual behavior:
- Relevant code paths, issue discussions, and existing fix attempts (links):

**Root-cause assessment**
- Verified facts:
- Most likely explanation and confidence (**high / medium / low**):
- What would confirm or disprove it:

**Recommended resolution**
- Proposed change and owning repository/repositories:
- Dependencies, related PRs, or coordinated release requirements:
- Important alternatives or trade-offs, if any:

**Validation and acceptance**
- Automated regression tests to add or update:
- Manual checks appropriate to the risk (for example main window, popout, mobile, reload, or offline):
- Acceptance criteria:

**Risks and remaining questions**
- Potential regressions and unresolved evidence:

**Disposition**
- **Implement / review existing fix / investigate further / defer**, with priority and reason:
- Prerequisites for an implementation handoff:

Do not describe a hypothesis as a proven cause, or a proposed test as an executed test. Keep the assessment actionable without prescribing an unnecessary refactor.
