# Issue implementation handoff and resolution

Use this workflow after the maintainer selects an issue from the [assessment shortlist](issue-assessment.md). The assessment remains in the GitHub issue; a draft PR is the implementation queue and its branch is the implementation workspace. Follow `AGENTS.md` and `CONTRIBUTING.md`.

## Prepare a draft PR — chat agent

1. Recheck the issue, comments, existing PRs, and current `master`; do not duplicate ongoing or merged work.
2. Create a dedicated `YYYY-MM-DD-issue-N-short-topic` branch from the appropriate repository's `master`. Keep plugin, fork, and Extras changes in their owning repositories; link companion PRs when coordination is required.
3. GitHub requires a commit difference before opening a PR. For a **plan-only** branch, commit a small `docs/agent-handoffs/issue-N.md` file linking the issue and stating that the file is temporary. Do not modify runtime code. The implementing agent must remove this file before the PR is finalized.
4. Open a **draft** PR targeting `master`, with a title such as `Plan: Fix #N — short description`, using the template below. Confirm the draft PR and branch are readable; return the link. Do not mark the issue fixed.

### Draft PR description template

**Status:** Implementation handoff only; not yet a fix.

**Issue and assessment:** #N, link to the detailed technical assessment comment.

**Baseline and dependencies:** Source commit(s), owning repository, related branches/PRs, required fork/Extras package coordination.

**Implementation plan**
- Likely root cause and evidence (brief; do not duplicate the assessment):
- Recommended code changes and key paths:
- Constraints, alternatives, and risks:

**Acceptance and tests**
- Expected behavior:
- Automated regression tests:
- Manual checks (main window / popout / reload / mobile / offline as relevant):

**For the implementing agent:** Re-read the current issue, PR, source, and repo instructions; verify assumptions, implement on this branch, remove the plan-only handoff file, update the PR description with actual results, and leave the PR as draft until ready for maintainer review.

## Complete the implementation — local agent

Use the same branch and draft PR. Before coding, confirm the branch head and whether the issue or dependencies have changed. Do not start a new competing PR. Commit the code and tests, remove the temporary handoff file, and replace the plan-only PR description with a concise outcome summary:

### Completed PR / handoff template

**Problem and root cause**
- What failed, under which conditions:
- Confirmed cause and key source references:

**Change**
- What changed and why this is the smallest safe fix:
- Affected files and repositories; dependency or package-release coordination:

**Validation**
- Automated tests, builds, and lint actually run, with results:
- Manual Obsidian checks completed (platform, main window, popout, reload, mobile, etc.):

**Remaining risk**
- Known limitations or untested cases:
- Up to three priority manual checks for the reviewer:

Link the original issue, assessment, and companion PRs. Never describe planned tests as completed. Mark ready for review only when implementation and available validation are complete; do not merge without maintainer authorization.
