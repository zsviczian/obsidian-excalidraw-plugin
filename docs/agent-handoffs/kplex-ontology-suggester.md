# K-Plex ontology completion — temporary handoff

**Status:** Plan-only draft PR; no runtime implementation or completed feature tests.

Prepared by Zsolt's Codex Agent on 2026-11-02 at the maintainer's request.

The implementation plan and acceptance criteria belong to the draft PR on
`2026-11-02-kplex-ontology-suggester`. Continue on that branch; remove this
placeholder before finalizing the implementation.

## Starting references

- Plugin baseline: `master@5b926e2957f290a25d963bc08a661356b845f4a2`.
- K-Plex reference: `main@e757239ce41a29934bc8a2b74d598146b2bd7e10`.
- Read `AGENTS.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md`,
  `docs/TESTING.md`, and `docs/OBSIDIAN_RUNTIME_TESTING.md` before implementation.
- Follow `docs/agent-workflows/issue-resolution.md` for plan-only PR handoff.

## Requested outcome

Use K-Plex's live configured ontology and trigger combinations in Excalidraw's
existing inline suggestion inputs, especially the native element-link editor.
With `|` denoting the caret, representative results are:

```text
:::|       -> friend::|
(::p|      -> (parent:: |)
(:::|)     -> (parent:: |)
[:::|]     -> [friend:: |]
```

Use the selected physical field's exact spelling. Preserve surrounding text,
reuse an existing matching closer, and allow subsequent `[[note]]` completion.
K-Plex must remain optional; honor its disabled-suggester setting and custom or
historical triggers without rewriting configuration.

## Important integration constraint

K-Plex's documented entry point is `window.kplexApi.v1`. Its current public API
exposes ontology definitions, but not the native suggester's configured triggers,
enabled flag, or completion matcher. The PR must resolve that supported API gap;
do not read private settings, hijack a registered `EditorSuggest` instance, or
copy the matcher into Excalidraw. A narrow companion K-Plex capability should
reuse its existing matching and ontology-presentation owners. This branch does
not modify K-Plex or establish that such a capability already exists.

Prefer the existing `InlineLinkSuggester` and typed host attachment boundary.
Do not add a second competing popup, a hard dependency, a whole-vault scan, or
an unrelated fork refactor. Validate actual input state, caret, keyboard scope,
scene persistence, lifecycle, popout ownership, and existing link/tag completion.

Historical regression references, not issues fixed by this placeholder:
- [Ontology-wrapped embeds, fixed in 2.23.8](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2782).
- [K-Plex trigger defaults and saved-trigger compatibility](https://github.com/zsviczian/kplex/issues/109).

Run focused executable regressions during implementation and the required
portable/native acceptance profiles before readiness. Stage companion artifacts
only in the repository-owned disposable test vault, record exact revisions and
hashes, and distinguish desktop mobile emulation from physical-device evidence.
Keep the PR draft and unmerged until implementation and validation are complete.
