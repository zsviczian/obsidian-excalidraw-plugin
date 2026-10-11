# Issue resolution handoff

Use this template after implementing a bug fix, to summarize the change for review or a pull request. Follow `AGENTS.md` and `CONTRIBUTING.md` for branching, validation, and release requirements. Do not publish or merge a PR unless authorized.

## PR / handoff template

### Fix: [brief observable behavior] (#issue)

**Problem and root cause**
- What failed, under which conditions:
- Confirmed cause and key source references:

**Change**
- What changed and why this is the smallest safe fix:
- Affected files and repositories:
- Dependency or package-release coordination, if needed:

**Validation**
- Automated tests added or updated, with actual results:
- Build / lint results actually run:
- Manual Obsidian checks completed (platform, main window, popout, reload, mobile, etc.):

**Remaining risk**
- Known limitations or untested cases:
- Up to three priority manual checks for the reviewer:

Link the issue and any companion PRs. Distinguish completed tests from recommended tests; never claim a build, device check, or release was verified without evidence.
