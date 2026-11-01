# Native test recovery — 2026-11-01

**Final acceptance: 357 passed, 0 failed, 0 blocked, none missing.** All 40
formerly blocked device profiles pass; native/device cleanup and declared-baseline
restoration pass. Fast checks pass **600/600**. See the
[sanitized final receipt](native-recovery-2026-11-01.native.json). Earlier results
below are retained as the investigation history.

Current work is uncommitted on `codex/kplex-integration-followup`, based on
`ebb7916b` (merged PR #3028). The selected sibling fork is `80df3c48f`; Extras is
`df1f2b5`. Their working trees are unchanged. Node 22.22.2 is used explicitly.

## Corrections

| Original failure | Correction and evidence |
| --- | --- |
| Popout palette and toolbar tests reported concurrent requests | Host acknowledgements now settle explicit promises independently of UI readiness polling. Cancellation settles only the owned request; real dispatch failures and strict assertions remain failures. The delayed-ack regression fails before the fix and passes afterward. Both native interaction cases pass in `native-525f66ee-e983-43b9-8a16-90b5b865e237`. |
| Mermaid gateway loaded old Extras | Refresh locked installs in the current workspace producers, build/freeze/deploy all artifacts, and verify loaded services before UI work. Converter package 3.1.0 and Extras service contract 3.0.0 are deliberately distinct. The production gateway's original exact 3.0.0 requirement is unchanged. Real MathJax and twelve offline Mermaid diagram types pass. |
| File-explorer action not found | The registered label already is **New drawing**. The test now explicitly selects Obsidian's DOM menu renderer and waits for mounting before locating the localized action. Native workflow assertions pass; no product label was changed. |
| Geometry popout cleanup waited on stale `closed: false` | Save owned edits and detach the owned leaf; require API teardown, disconnected DOM and absent workspace registration. Preserve main/shared windows and reject identity changes. The helper is idempotent. Real main/popout geometry, crop and save/reopen cases pass. |

## Additional failures uncovered and repaired

- PDF.js split the printed sentinel into glyph runs. Inserting a space between
  every item created a false text mismatch. Concatenation now preserves the actual
  strings without invented separators. The real PDF, decoded page, text, media
  box, SVG pixels and cleanup pass in `native-259acdb4-762f-4e1f-bc4a-e4004a363c9d`.
  Evidence is retained before assertions, including on failure.
- macOS clamps native windows to this display's 875-pixel work area. For larger
  profiles the runner uses explicit CDP metrics at the unchanged requested CSS
  viewport, records native dimensions/transport and clears the override before
  the teardown idle/error gate. Existing breakpoint and trusted-input assertions
  remain unchanged. The first six desktop profiles passed in
  `native-902507ee-fbf9-4d2f-aada-d04c788ad23b`.
- Read-only CLI responses intermittently timed out while the in-app task continued
  passing later cases. State polls have at most two retries within the existing
  deadline, retaining transport diagnostics. Native input and writes are never
  replayed by that policy. The lost-response regression fails before and passes
  after the fix.
- A debugger-listener install could execute while its response was lost. Cleanup
  now probes its unique ownership token rather than relying on an unacknowledged
  local flag. The regression verifies listener/controller removal, scheduling
  restoration and release of the exact owned debugger.

## Current verification

- Full fast suite: **599 passed**, including the final synchronization-readiness regressions and matching local fork, including viewport, receipt, response-budget and oversized-source regressions. The default installed declarations still expose the previously recorded protocol-2 mismatch, so `EXCALIDRAW_FORK_ROOT` must select the byte-matched current fork for this unpublished integration.
- Offline host harness: **76 passed** (overlaps the fast suite).
- Bundle checks: **5 passed**. Feature mappings and inventory checks pass.
- Production build passes with existing Rollup circular-dependency warnings.
- The original five native failure paths have passed focused reruns. The complete
  Extras scenario, including real PDF output, also passes.
- The maintainer restarted Obsidian with only the named test vault open. The
  subsequent phone trace identified a sliding palette input: the trusted tap
  reached its moving container. Stable-rectangle readiness fixes this; the phone
  palette case passes in `native-cfe9bb07-0d6a-4138-84a9-94f6537eb3b5`.
- The tablet trace requested x=335.21 but delivered x=421.41, exactly reflecting
  the fitted surface scale. The driver now maps CDP input into that surface and
  independently asserts the delivered CSS coordinates. Real mouse/touch device
  edits, the tablet palette case and restoration pass in
  `native-66f99e94-4a3a-4b5a-9cd3-e854aa962b2d`.
- **All 40 device profiles are not yet complete.** The complete matching-build
  native acceptance rerun is next. Partial attempts and functional failures remain
  preserved; focused passes do not replace complete acceptance.

Rerun the complete matrix and matching-build native profile, record exact
artifact hashes, errors and restoration, and update this record.
Desktop mobile emulation remains separate from physical-device touch, other
operating systems and real OS drag/clipboard coverage.

Recovery requirements are captured in `AGENTS.md`, `CODING_STANDARDS.md`,
`CONTRIBUTING.md` and the runtime testing guide. Historical failed reports remain
under `.test-work/reports/` and must not be overwritten.

## Full rerun and acknowledgement recovery

`native-575be6cb-c9a9-4b33-a2ae-efe4a799286c` passed all 172 desktop
behavior cases and the original five failure paths, including real Extras/PDF,
workflow menus and geometry. It then failed on another lost CLI acknowledgement;
the first device profile also lost its viewport-change acknowledgement. Cleanup
and baseline restoration passed. This is a failed complete run, not acceptance.

No blocking dialog or pending task/print remained; ten serialized read probes
returned in 3–89 ms. The coordinator now retains an owned last-operation receipt
before replying to eval/CDP calls. It may adopt only the exact completed result
when transport loses the response. It never replays the mutation; pending,
missing, foreign and failed results remain failures. Receipts are removed at
sequence completion. Seven new regression checks pass. A live fault-injection
probe discarded one completed response, recovered the result, and independently
confirmed exactly one mutation, native protocol access and owned debugger cleanup.
The next complete run will verify this through the full sequence.

## Operation budgets and oversized evals

The receipt-enabled full attempt `native-0fd2838b-e678-442a-8306-182a2e341cdf`
recovered nine completed acknowledgements without replay, but each consumed the
old 60-second launcher deadline. One grouped-link scenario consequently exhausted
its own deadline. A larger wrapped eval then hit macOS `E2BIG`; the first device
profile also lost the separate error-buffer-clear reply. Cleanup and baseline
restoration passed; this attempt remains failed.

The response deadline is now one second, with exact receipt polling bounded by
the unchanged 60-second operation budget. Still-pending/unknown jobs preserve
resources. Known read-only commands have bounded retries. A lost error-clear
reply is accepted only after observing an empty buffer; new errors are never
cleared by a replay. Oversized evals use owned temporary UTF-8 scripts on macOS
and Linux as well as the established Windows path, preserving the entire source.

The live large-eval probe completed in 1,407 ms beyond its one-second response
deadline, using one real script handoff and exactly one mutation. An intentionally
dropped error-clear reply also required exactly one clear. Native protocol access,
debugger cleanup and receipt cleanup passed. The pending/completed/foreign/error,
response-budget, clear-preservation and oversized-source regression tests pass.

The requested Mindmap Builder, Lucide and Pele/kepano release-note changes are now
applied in Messages.ts, with centralized literal link URLs; targeted ESLint passes.
The next complete run builds this final release-note text too.

## Final driver readiness checks

`native-e093d356-a836-4cfd-80ae-afa8317abbde` again passed all 172 desktop
behavior cases and the original five failure paths. A standalone-text variant
clicked before confirming that its trusted text-tool shortcut had committed;
the driver now focuses the editor and waits for actual text-tool state. The
first six device profiles passed, then a phone screenshot lost its reply even
though the PNG existed. Cleanup and baseline restoration passed; this full run
remains failed.

Screenshot recovery now requires a previously absent file under the exact owned
report directory and successful decoding by Electron's native image decoder.
It never repeats a capture or substitutes an image for behavior. A live injected
reply-loss probe confirms exactly one capture and successful decoding. The added
regression also refuses existing or unowned destinations. Product editing,
undo/redo, layout, trusted-input and persistence assertions are unchanged.

The corrected text driver passes focused native report
`native-6918dbf3-ac39-4dfe-9a74-c3aafd283e83`: all eight creation-history
variants (parsed/raw, bound/standalone, keyboard/button) and sixteen editing
variants (plain, wikilink, extra bracket and alias) pass, with cleanup and baseline
restoration passed. The complete rerun now uses this validated driver.

## Complete case execution and synchronization readiness

`native-c2cab9f1-cadf-4a8f-9b1c-c824f43a6de1` executed every required identity:
**355 passed, 2 failed, none missing**. The complete core run, all 172 desktop
behavior cases, tablet workflows and all device profiles executed; the remaining
two failed identities are one phone frontmatter/save workflow and its parent
phone-profile gate. The phone's console/window/CLI error streams were empty;
its parent now reports the failed workflow IDs rather than the misleading
"unexpected errors" description. Cleanup and baseline restoration passed.

The workflow observed new frontmatter in view.data and could request forced
persistence before the view's synchronization busy state cleared. The public
save implementation intentionally skips while synchronization owns the view.
The driver now waits for the exact view/API/file owner to be idle before asking
for its one forced save, still requires status persisted, records the actual
revision receipt on failure, verifies disk scene IDs and reopens the file.
Two new regression checks establish that it waits for synchronization but still
rejects failed receipts or mismatched physical scenes without retrying writes.
The next complete run will establish native acceptance of this readiness change.

## Device blockers resolved; final core fixture readiness

`native-a90f7241-cc16-4867-893c-268b4d7fcc3d` passes the complete device lane:
**126/126**, including all **40** formerly blocked device profiles and their
mobile behavior workflows. Device cleanup and declared-baseline restoration pass.
The requested original five failure paths had already passed focused/repeated
native runs; the original 187 passed / 5 failed / 40 blocked count is historical.

This whole-run aggregate is still **336 passed, 1 failed, 21 missing**. Its single
failure is `feature-scenarios`: `parsed/keyboard/extra-bracket: new text editor`.
The recorded scene is empty, the text editor is absent, and the tool is still
selection. The fixture's imperative `setActiveTool({type: "text"})` schedules a
React update; it had dispatched input without waiting for the state to commit.
`prepareTextUndoFixture` now waits for the exact captured API's active tool to be
text, with a bounded deadline and an API-retirement guard. Its added delayed-
commit regression and affected tests pass **9/9**. This correction retains all
editing, history, disk and reopening assertions; a complete native rerun remains
pending rather than being relabeled as passed.

App-wide native runs were held while the maintainer's production vault was open.
The subsequent K-Plex startup-placeholder investigation used read-only production
inspection and a separately scoped Small-vault test. Only explicitly authorized
K-Plex executable artifacts were deployed to production. The maintainer manually
reloaded K-Plex and confirmed both affected navigation workflows work. No agent-
initiated production reload, cache/settings/note edit or Excalidraw deployment
was used to bypass isolation. K-Plex PR #249 holds that separate acceptance.

## Final complete acceptance

`native-b329000b-8a0d-4b2a-b244-4245ae9c01c8` passes the complete regression
profile: **357 passed, 0 failed, 0 blocked, none missing**. The device lane passes
126/126, including all 40 device profiles. All 16 text-editing/history variants
pass, including the exact extra-bracket case that stopped the preceding run.
The original five failure paths are included and pass. Native/device cleanup and
restoration of the declared plugin, Extras and theme baseline pass.

This run rebuilt the selected current fork, Extras and plugin, froze and verified
their actual artifacts, and ran only after the maintainer closed other vaults.
The native protocol received 72 lost replies through exact completion receipts;
no operation was replayed to turn an unknown outcome into a pass. Original case
identities, strict assertions and time bounds remain unchanged.

Node 22.22.2 fast checks pass 600/600. macOS temporary fixtures use the canonical
`TMPDIR=/private/tmp`; the redirected-path guards remain intact. Plugin main.js
SHA-256 is `5e9d881ee9a04564d855f457bbb2c90439c9c9b0069eefbb0072d2a881edc652`;
producer commits, dirty-source identity, lockfiles and exact artifacts are in the
linked sanitized receipt. Historical reports were preserved.

This establishes macOS desktop and desktop mobile-emulation acceptance. Physical
Android/iOS touch and Windows remain separate. The unpublished fork-artifact
handoff is not a published dependency release. Positive K-Plex template-dropdown
acceptance still requires an actual Excalidraw 2.29.1+ release; local plugin
manifests intentionally remain 2.29.0. No companion changes were committed or
published, and no Excalidraw build was deployed to production.

The actual public library build (`npm run lib`) and both independent packed
consumers (`npm run test:packages`, fork and Extras API) also pass. The first
Extras consumer attempt reused stale `--prefer-offline` registry metadata and
reported converter 3.1.0 as unavailable despite the locked tarball already being
installed. `npm view @excalidraw/mermaid-to-excalidraw@3.1.0 version --prefer-online
--json` confirmed the official published version and refreshed that metadata.
The identical consumer command then passed; no dependency, source or assertion
was changed and no tarball was substituted for the consumer's declared dependency.
