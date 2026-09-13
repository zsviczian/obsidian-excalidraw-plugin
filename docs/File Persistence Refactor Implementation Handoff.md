# File persistence refactor: implementation handoff

Updated: 2026-09-13. Status: checkpoint 5b is accepted and committed as `31592829`. Checkpoint 6a ordinary dirty-unload handoff is implemented and maintainer-accepted after aggressive multi-view, mixed-mode, popout, desktop/mobile, and Obsidian Sync testing. The broader checkpoint 6 ordering and migration-handoff work remains checkpoint 6b and is not claimed complete by this acceptance.

This is the execution specification for checkpoint 5b and original checkpoints 6–12. Read it with [AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md), the opening review in [File Persistence Lifecycle Design](<Excalidraw Plugin File Persistence Lifecycle Design.md>), and the concluding “Updated File persistance refactor plan 2026-09-12 (Astra)” section of [RefactorPlan.md](../RefactorPlan.md). This document owns detailed tasks and acceptance gates; RefactorPlan owns checkpoint summaries, maintainer acceptance, and commit/action history. Do not maintain another independent task list.

The earlier failed 5b experiment produced dirty/save ping-pong. Restoring 5a and applying only `CaptureUpdateAction.NEVER` resolved that symptom, while later traces separately proved a destructive dirty-receiver route and cross-view notifications dropped by timing-only suppression. Those findings led to the staged 5b.2–5b.5 implementation rather than restoration of the failed combined patch. The prior divergence is now resolved in instrumented maintainer testing; retain its causal history here so later work does not regress to heuristic timer changes or explanations involving retained views from an earlier plugin runtime.

## 1. Execution ledger and rules

The six 5b steps below are numbered consecutively for handoff clarity. In the earlier lifecycle review, minimum snapshot ownership was called “9a before 5b.3”; here it is **5b.3 (original 9a)**, observation is **5b.4**, and enabling matching is **5b.5**. They are the same six tasks, not additional checkpoints.

| ID | Deliverable | State | Evidence / acceptance / commit |
| --- | --- | --- | --- |
| 5b.0 | Preserve experiment; establish committed 5a baseline | Comparison completed | Source stash `2b158abb204fd9b7e76aeea0a80e12476ce9879e`; HEAD `3899d056`; baseline bundle SHA-256 `cd2f5459151c56cb6ec920bb7ff369eec489be76cc87159292bf4e7dd90dc560`; maintainer confirmed 5a works. This is a comparison result, not certification of all stress interleavings |
| 5b.0a | Publish incoming synchronization as non-undoable remote state | Dirty-loop correction confirmed and committed | Only `IMMEDIATELY` → `NEVER` restored. Commit `45144b52`; pre-instrumentation bundle SHA-256 `acfe02c8592ccae73aaea8ffb1ab034b8517358081f1c72360088244ee14adeb`. Remaining alternating-edit divergence is tracked under 5b.1–5b.5; detailed undo/viewport coverage is not newly certified by this report |
| 5b.1 | Trace first missed propagation, with dirty-origin tracing if needed | Evidence complete; diagnostics removed | Trace A: dirty V2 was routed through full reload and its edit was cleared. Trace B: six modify events were cross-suppressed by the receiver's stale post-save Boolean; both views finally reported clean/idle with different scene fingerprints. The broad temporary `EXCALIDRAW_PERSISTENCE_5B` instrumentation was never committed and was removed before the clean 5b.2/5b.3 checkpoints |
| 5b.2 | Reproduce failure; implement demonstrated prerequisites | Complete; committed | Production routing sends stale dirty/busy Markdown receivers through pending incremental synchronization; clean idle stale and raw-file routes are unchanged. Executable checks and maintainer stress/reopen validation pass. Commit `58d8ea84`. Cross-view post-save suppression remains a proved failing requirement carried through 5b.3–5b.5 |
| 5b.3 / 9a | Minimum immutable save ownership | Complete; committed | Save intent now carries producer/target-generation/operation/requested-revision identity. Save-owned scene, nested element data, app-state subset, files, deletions, selected IDs, and source envelope are detached before normalization; `PreparedSave` owns the exact final text and actual captured revision. Only physical successful write outcomes publish a successful prepared identity. Focused checks/builds and maintainer large-scene runtime tests pass. Commit `071e3ef3`; suppression behavior is intentionally unchanged |
| 5b.4 | Observe candidate content classification | Complete; diagnostics removed | Exact-byte classifier covers successful/accepted/pending/failed/handed-off/different/unknown states and newer local revisions. Ordinary own echoes matched successful writes while cross-view notifications consumed by the Boolean contained different content. The traces also proved the distinct **Open in new window** reentrant replacement failure. Temporary observation code is removed from source and the rebuilt bundle |
| 5b.5 | Enable matching at the coalesced read boundary | Complete; committed | Boolean-armed Markdown events now continue through the existing pending latest-state synchronization loop. Its single owned Vault read revalidates runtime/target identity and skips parse/publication only for exact successful-write or accepted-content matches; all other classifications process normally. Raw `.excalidraw` suppression and same-file edit ownership remain unchanged. Explicit `setViewData()` completion ownership fixes the diagnostic-sensitive **Open in new window** lifecycle race. Commit `31592829` |
| 6 | Detached persistence ownership and ordering | 6a accepted; commit pending; 6b remains | Ordinary dirty unload now hands immutable prepared text to a plugin-owned per-path FIFO and reports `persistence-handed-off`. The queue resolves the file at execution, rejects missing/recreated targets, writes no empty payload, and never coalesces independent snapshots. Maintainer stress tests passed with five simultaneous representations across Markdown/Excalidraw, side-by-side, **Move to new window**, and **Open in new window**, plus desktop/mobile concurrent editing. Live-save ordering, multiple-producer conflict handling, BAK, and special migration handoff remain unchanged and unclaimed |
| 7 | BAK after successful detached persistence | Blocked on 6 | Exact successful payload and empty-scene safeguard |
| 8 | Same-file multi-owner edit gate | Planned | Move forward only as an explicitly demonstrated prerequisite |
| 9 | Complete normalized save/export snapshot | Planned | Builds on 9a, without repeating its implementation |
| 10 | Snapshot autoexports, then ordered exports | Planned | Two separate acceptance gates |
| 11 | Async load generation | Planned | Move a narrow portion forward only if evidence requires it |
| 12 | Remaining semaphore/timer cleanup | Last | Each retired state has a verified owner |

For each implementation increment:

1. State the invariant, concrete failing evidence, affected callers, and smallest proposed correction. Do not bundle history, viewport, image loading, and dirty policy into an echo-detection change.
2. Update this ledger and RefactorPlan with what is implemented versus manually accepted. A build is not acceptance. Never mark all of 5b complete because one reproduction improves.
3. Run production build and focused diagnostics before handing off a test build. Keep genuine failures/notices visible; hiding a busy notice or rejecting a modify silently is not a fix.
4. Recommend risk-based tests, wait for required maintainer results, and commit only when requested. Remove temporary diagnostics before a production commit. If a correction fails, record that, preserve its comparison patch, and return to its preceding accepted boundary rather than stacking another guessed predicate.
5. Preserve the TextFileView facade, public scripting APIs, existing serialized data, merge behavior outside the demonstrated defect, early migration unmount, viewport ownership, and dependency-refresh fallback. No new protocol, blanket CRDT, version bump, package upgrade, or manager solely to make a diagram cleaner.

## 2. Checkpoint 5b.0 — recover and validate the baseline

### Exact state at handoff

- Branch observed: `file-persistence-improvements`; HEAD `3899d056`, `fix: deduplicate copied markdown image renders`.
- `af1cbe74`, `fix: retain latest external drawing sync`, is the committed checkpoint 4/5a baseline. `3899d056` adds only the separately accepted image-loader fix. Prefer `3899d056` initially so the image waves do not confound the stress test.
- `a42e9525` is the save/synchronization ownership checkpoint. Do not jump back that far unless the 5a comparison supplies a reason.
- Uncommitted experimental runtime paths at review: `src/core/managers/FileManager.ts`, `src/types/excalidrawViewTypes.ts`, `src/view/ExcalidrawView.ts`, `src/view/components/CustomEmbeddable.tsx`, `src/view/managers/ViewSaveCoordinator.ts`.
- Documentation changes include the maintainer's appended plan and this handoff. They remained outside the source-only stash and are still present in the working tree. No branch switch or destructive rollback was performed.

### Safe preservation procedure

1. Read `git status --short`, `git branch --show-current`, `git log -6 --oneline`, `git diff --stat`, and `git diff --cached --stat`. Inspect all overlapping/new changes. Stop if the five paths above now contain unrelated user work; do not assume this inventory is still exact.
2. Record plugin dependency/lockfile identity, installed `@zsviczian/excalidraw` version and hashes of its four `dist/obsidian` artifacts, Node/npm versions, current production bundle hash, and sibling-repository branch/status if its artifacts were copied locally. `node_modules` is ignored and survives stashing: a Git commit alone does not identify the runtime package. At review the declared Excalidraw dependency was `0.18.135`; verify rather than reinstalling blindly.
3. Preserve the known experiment with a **path-scoped stash**, leaving documentation in the working tree. After confirming the inventory and index, use:

   ```sh
   git stash push -m "checkpoint-5b failed experiment before baseline validation" -- \
     src/core/managers/FileManager.ts \
     src/types/excalidrawViewTypes.ts \
     src/view/ExcalidrawView.ts \
     src/view/components/CustomEmbeddable.tsx \
     src/view/managers/ViewSaveCoordinator.ts
   git rev-parse 'stash@{0}'
   git stash show --stat 'stash@{0}'
   git status --short
   git diff 3899d056 -- src
   ```

   Record the resolved stash object ID in the ledger, not only `stash@{0}` (its index can change). Inspect the saved patch and verify the final source diff is empty. If new experiment files are untracked, preserve them explicitly too; the command above does not include them. Never use `git stash -a`, broad cleaning, or a hard reset. Do not include the roadmap in a blanket stash and then lose the instructions needed to resume.
4. At the reviewed HEAD, stashing those paths restores baseline source without moving the branch. If HEAD has advanced, plan a separate baseline worktree after preserving changes rather than overwriting unrelated commits. The exact `af1cbe74` comparison can also use a separate worktree; do not silently remove the accepted image fix from the development branch.
5. Keep the stash until the replacement 5b is accepted. Consult it as evidence with `git stash show -p <recorded-OID>`. Do not automatically `pop` it after a good baseline test: that would reintroduce all the unvalidated predicates together. Restoring any part later is a separately reviewed action.
6. Keep these documentation edits through the comparison. If the maintainer requests a documentation checkpoint, stage only the explicit documentation paths, not the source experiment. This specification does not itself authorize a commit or deployment.

The procedure above was executed on 2026-09-12 for the documented five source paths. It remains here as the recovery/audit procedure; revalidate the inventory before reusing it.

### 5b.0 execution record

- Branch/HEAD after restoration: `file-persistence-improvements` at `3899d056`. `git diff 3899d056 -- src` was empty.
- Failed experiment: stash object `2b158abb204fd9b7e76aeea0a80e12476ce9879e`, message `checkpoint-5b failed experiment before baseline validation`. It contains exactly the five documented source paths, 144 insertions and 61 deletions. Retain this object through 5b acceptance; do not identify it later only as `stash@{0}`.
- The three planning files were excluded from the stash. Their pre-stash SHA-256 values were `7546b8f...ed0` (`RefactorPlan.md`), `e4dd2686...1eb` (lifecycle design), and `e5a0e919...d99` (this handoff). They subsequently changed only to record this execution; they were not rolled back or stashed.
- Toolchain: Node `v22.22.2`, npm `10.9.7`. Declared and installed `@zsviczian/excalidraw` version: `0.18.135`. Sibling fork was on `master` with no reported working-tree changes.
- Installed fork artifact SHA-256 values: production JS `42e36f9e...e2`; development JS `5df27a6a...f61`; production CSS `e371caed...7db`; development CSS `1151ae7f...947`. Preserve the full command output in the conversation record; abbreviations here are for readability.
- Failed-experiment bundle before restoration: 4,904,430 bytes, SHA-256 `003c1de0...e15`. Rebuilt baseline bundle: 4,903,363 bytes, SHA-256 `cd2f5459...560`.
- `npm run build` passed in 11.1 seconds and reported 33 circular-dependency warnings (three shown plus “and 30 more”). `node --check dist/main.js` passed. Focused ESLint across the five restored paths reported the existing 19 errors: 18 in `ExcalidrawView.ts` and one in `CustomEmbeddable.tsx`; the other three files were clean. `git diff --check` passed.
- No deployment destination or private fixture identity was inferred or recorded. No Obsidian runtime test has been performed against this rebuilt baseline yet.
- The maintainer subsequently confirmed that 5a still works. The receiving view nevertheless became dirty after receiving only view A's synchronized input. This is the accepted baseline observation motivating isolated checkpoint 5b.0a.

### Baseline test record

Build baseline with Node 22+, `npm run build`, and `node --check dist/main.js`. Record actual build warnings, touched-file lint baseline, `dist/main.js` size/hash, and deployment destination. Do not assume the historical 33 Rollup circular warnings or earlier lint counts still apply. Use the established maintainer test-vault deployment workflow and only an authorized destination. Do not edit generated artifacts by hand. Verify the deployed bundle is the one just built, then fully restart Obsidian.

Use disposable fixture copies, preserving the original outside the test mutation path. Record compression/text mode, autosave interval/settings, autoexport options, zoom-to-fit setting, Obsidian/Electron/OS versions, open leaves, and whether both views were fully loaded before interaction. Do not log private fixture contents into the repository.

Test first with a minimal drawing, then the reported approximately 4,400-element drawing with 500+ Markdown images (72 distinct images copied repeatedly). Start every comparison from the same fixture bytes; prior experiments may have altered versions/indices even if the drawing looks unchanged.

| Baseline case | Required observation |
| --- | --- |
| One edit in A; switch once to B; no more input | Same intended content; finite save/sync activity; both eventually clean; no rescue edit/save needed |
| A/B deliberately at different pan/zoom; alternate edits | Elements propagate; receiving camera stays local |
| Both edit before the other write is applied | Distinct non-conflicting edits survive; no perpetual dirty cycle after input stops |
| Repeat incoming unchanged contents / reopen unchanged drawing | No endless normalization saves; reopening preserves content and layers |
| Back-of-note editor held active while other view edits, then released | Pending scene update appears after release; Markdown content survives |
| Receiving view has not saved for more than five minutes | Record whether full reload runs; verify local content and viewport, not merely the incremental path |

Wait for initial asset work and at least multiple configured autosave periods after input stops; record actual timings rather than declaring success after the old two-second suppression window. Compare file contents after close/reopen as well as visible canvases. Run image-loading overlap as a separate case, not an accidental variation between builds.

**Gate:** baseline comparison completed. The maintainer confirmed that 5a still works; preserve that observation without extending it to unreported stress/undo/platform cases. Continue from the isolated capture-mode result below.

### Checkpoint 5b.0a — isolated remote history publication

The baseline publishes the merged incoming scene using `CaptureUpdateAction.IMMEDIATELY`. The maintainer observed that a clean receiver becomes dirty after receiving only that synchronized input. Apply only the previously attempted capture-mode correction: publish with `CaptureUpdateAction.NEVER`, documenting that incoming Vault state is not a local undoable edit and that locally retained merge state is handled by the existing explicit dirty branch above publication.

Do not restore the failed experiment's content hash, expected-write record, viewport app-state injection, dirty-predicate replacement, semaphore removal, or `CustomEmbeddable` edits. This checkpoint does not claim to solve checkpoint 5b's echo-classification problem.

**Gate:** with clean A and B, edit only A and let synchronization settle. B must receive the element change without entering dirty state, adding the incoming operation to its local undo history, saving the same state back, or moving its independent viewport. Then make a local edit in B and verify it becomes dirty, can be undone, persists, and synchronizes to A. Finally repeat several alternating edits on the large fixture and stop input; both views must converge cleanly without a force save. If ping-pong returns, record the first unexpected transition under 5b.1 rather than adding another adjacent fix.

Automated validation: `npm run build` passed in 11.6 seconds with the established 33 circular-dependency warnings; `node --check dist/main.js` and `git diff --check` passed. The bundle is 4,903,357 bytes with the SHA-256 recorded in the ledger. Focused `ExcalidrawView.ts` lint reports its same 18 existing errors, none on the changed publication. The maintainer confirms dirty ping-pong is resolved, but reports sustained alternating-edit divergence. Retain this narrow improvement and proceed to 5b.1 for the remaining failure. The broad convergence portion of the gate remains open for overall 5b acceptance; do not keep adding fixes under baseline checkpoint 5b.0a.

### Assessment after 5b.0a — separate progress from convergence

The remaining issue belongs to checkpoint 5b. It should be investigated now in 5b.1 and reproduced in 5b.2; its eventual correction may depend on 5b.3 snapshot ownership or 5b.4/5b.5 content classification. No later checkpoint is guaranteed to fix it. Original checkpoints 6–12 remain gated on live-view convergence. In particular, the detached-write queue does not fix two active `TextFileView` writers by itself.

Keep `3899d056` plus the isolated `NEVER` change as the current diagnostic starting point. The only source diff at this assessment is that capture mode and its two comment lines. The five-file failed experiment remains stashed. Do not repeat baseline restoration or pop the stash. A controlled comparison without `NEVER` is useful only if a trace implicates history/dirty callbacks; record matching fixtures and edit cadence, and restore the accepted change after comparison. Do not infer causation from the order of user reports.

Current source gives these concrete investigation targets, in this order of boundary observation rather than certainty of cause:

| Boundary / verified behavior | What the trace must establish |
| --- | --- |
| `FileManager.modifyEventHandler()` calls `consumeOwnWriteReloadSuppression()` before setting a pending-sync marker. It checks only the Boolean. | Was the first notification needed by the receiver consumed here? A marker cannot preserve a notification that never reaches it |
| `executeSaveRequest()` arms the Boolean before `super.save()`, then calls `setPreventReload()` after success; that method sets it to true again and schedules cleanup. | If the own-write modify already consumed the first arm before the save promise resolved, did completion re-arm it and consume another view's later write? This is a source-permitted timing sequence, not a reproduced explanation of the current incident |
| Suppression timeout only clears the flag; it does not reread or schedule synchronization. | Did both views settle with no pending work despite a suppressed required notification? Waiting for the timeout cannot itself recover that notification |
| Notification routing can choose full reload, including after five minutes since last save; `reload()` can return early while save/sync or same-file editing is active. | Did a routed event get no incremental marker and no applied reload? Log the branch and early-return reason; a returned `true` is not proof content was installed |
| The save loop yields to the whole sync drain; per-view saves do not coordinate cross-view writes. | Is a missing change queued but waiting, or did another write supersede its disk state before read/merge? Distinguish active operation, whole-loop lifetime, trailing request, and dirty revision |
| Live capture and model normalization share mutable inputs; incoming application can catch errors internally. | Did the change reach prepared bytes and successful publication, and did it survive later callbacks? Parse completion or a resolved application promise alone is not proof of publication |

For the re-arm scenario, the conditional timeline is A arms → A's own event clears → A save resolves and arms again → B writes → A consumes B's event with no pending marker. Trace event/write ordering in Obsidian before selecting any correction. Shortening/removing the timer or deleting the second arm still leaves the origin-blind Boolean; neither is a sufficient general solution without the controlled cases.

`NEVER` may eliminate redundant saves that previously happened to emit another modify and retry a missed synchronization. That is a hypothesis to test, not grounds to restore unnecessary dirty revisions. Also check the opposite failure: if real local work is no longer tracked, the first break occurs before source persistence. The desired contract is explicit eventual propagation after finite edits without depending on an accidental follow-up save.

### First diagnostic run for the remaining divergence

Use the current build's settings and a fresh fixture. For the first attribution run, wait for initial image loading and make distinct changes to separate simple elements (or add distinct simple shapes), recording anonymous element/edit identities. Repeat the user's A/B switching cadence; editing different elements separates propagation failure from same-element conflict policy. Add image-loading overlap and same-element competing edits as subsequent cases.

Capture both views' operations on one sequence timeline. Begin with cheap routing, suppression arm/consume/re-arm/expiry, save completion, pending-marker and ownership events. Trace selected edit identity/version through captured/prepared and read/published states. Use the already-owned save text and sync read for payload observation; do not add an asynchronous Vault read for every modify just for diagnostics. Deep raw/parsed/merged field comparisons are the second tier if the event reaches reconciliation but content changes unexpectedly.

At the first visible divergence, stop editing and collect a read-only snapshot of both scenes' relevant edit identities, disk state, current/saved revisions, active/queued save, pending sync/loop, same-file guard, and suppression state. Record elapsed settling time. Avoid force-save, reload, or close until this evidence is captured because those actions alter the state under investigation. No automatic diagnostic writes or repair loop.

Classify the earliest break:

1. **Source edit absent from prepared/successfully written content:** inspect local dirty tracking, capture revision, normalization and acknowledgement (5b.2/5b.3).
2. **Source write present but receiver event consumed/unrouted:** inspect suppression/routing; reproduce the decision and implement its validated replacement (5b.2 then 5b.4/5b.5 as needed).
3. **Receiver work queued but never acquired/completed:** inspect save/sync/gate waits, exceptions and request fairness (5b.2).
4. **Read/merge/publication omits a required change, or subsequent work overwrites it:** inspect actual write order, merge results, publication and callbacks; use 5b.2 or 5b.3 according to the demonstrated boundary.

These are classifications for selecting the correction, not four changes to implement speculatively. The next implementation deliverable is the trace and its smallest reproducible failing case.

## 3. Source map and verified hazards

Use symbol searches; line numbers in older notes drift. The following describes reviewed source and the failed working patch, not guaranteed post-stash behavior.

| Boundary | Inspect these files/symbols | What must be distinguished |
| --- | --- | --- |
| Notification and leaf-switch entry | `src/core/managers/FileManager.ts: modifyEventHandler`; `EventManager.ts: onModifyHandler`, `onActiveLeafChangeHandler` | Same-path Markdown versus raw `.excalidraw`; initialized view versus `ExcalidrawLoading`; split-switch/full-reload/Markdown-view branches |
| Per-view persistence | `src/view/managers/ViewSaveCoordinator.ts: enqueueSave`, `drainSaveQueue`, `performQueuedSave`, `completeSaveRevision`, `setDirty`, `flush`, `forceSaveWithPolicy` | Active write versus queued save-loop lifetime; queued/requested versus captured revision; dirty visuals versus acknowledged state |
| External synchronization | `src/view/ExcalidrawView.ts: requestExternalSynchronization`, `startExternalSyncLoop`, `drainExternalSynchronization`, `acquireSynchronization`, `yieldToPendingExternalSynchronization`, `applyIncomingSynchronization` | Notification marker versus read in progress; parser model versus live merge; same-file guard; cancellation/finally boundaries |
| All dirty sources | Same view: `onExcalidrawIncrement`, `onChange`, `checkSceneVersion`, explicit `setDirty`; tracked-app-state helpers | Durable store increments, tracked persisted app state, ordered version hash, explicit reconciliation, delayed metadata/image mutations |
| Save representations | Same view: `executeSaveRequest`, `getSceneWithAppState`, `prepareGetViewDataFromSnapshot`, `getViewData`, `loadDrawing`, `setViewData`; `src/shared/ExcalidrawData.ts: loadData`, `syncElements` | Raw Markdown buffer; raw parsed JSON; normalized mutable model; live API; exact text passed to TextFileView |
| Image publication | `src/view/managers/ViewSceneFileManager.ts`; `src/shared/EmbeddedFileLoader.ts`; view `addFiles`/`updateScene`; image scaling helpers | Queued loader versus actual callback/decode completion; render-only work versus persisted geometry/customData |
| Fork store/index behavior | Sibling `packages/element/src/index.ts: hashElementsVersion`; `fractionalIndex.ts: syncInvalidIndices`; installed fork `CaptureUpdateAction`, store callbacks, `updateScene` implementation | Real published artifact behavior; ordered nonce hashing; index mutation; synchronous flush versus delayed callback; history capture semantics |
| Detached persistence | View migration callback and unload branches; `src/core/managers/ViewMigrationPersistenceHandoffManager.ts`, `ViewMigrationHandoffManager.ts`; `src/shared/BackupPersistenceQueue.ts` | Drawing-state transfer versus serialized persistence transfer; accepted handoff versus completed source write |

Verified facts to preserve in future reasoning:

- `loadData()` applies remaining non-text `elementLinkMap` entries by setting the link and incrementing `version` and `versionNonce` unconditionally. An isolated execution of that exact loop with an unchanged link demonstrated the increment; the loop also exists at `3899d056`. This is **not** an end-to-end reproduction of ping-pong. Do not remove version increments globally without checking actual link changes and consumers.
- `hashElementsVersion()` is ordered nonce hashing, not a numerical revision sum or complete content comparison. Reordering can be a genuine layer edit. `ExcalidrawView.updateScene()` normalizes indices after synchronization has computed `previousSceneVersion`; the normalization can mutate versions. Trace the actual installed array and callbacks before changing baseline timing.
- The uncommitted `hasLocalStateToPersist && !isDirty()` guard suppresses revision advancement for an already-dirty view. An already-dirty Boolean does not establish whether a waiting/active request includes a newly reconciled change. Conversely, every repeated reconciliation is not automatically a new document change.
- `setDirty()` advances `currentRevision` and updates a trailing request when `saveLoopPromise` exists. The loop can be alive while `activeSaveRevision` is null and it is awaiting external synchronization. Trace whether the trailing request receives the reconciliation revision. `forceSave` refuses several kinds of busy state; the notice does not prove a physical Vault write is hung.
- `yieldToPendingExternalSynchronization()` awaits the **whole** external drain, not one iteration despite its comment. Further events can extend it. Pending state being bounded does not guarantee finite work or fairness.
- Incoming tombstone IDs filter local elements before the live-element version comparison. Do not claim newer-local-versus-older-deletion behavior is version-aware without a separate correction and test.
- `getSceneWithAppState()` retains API elements and nested objects; a shallow files map still shares values. `syncElements()` assigns the provided scene and mutates it across awaits, including clearing `scene.files` after synchronization. `readonly` does not make this an immutable capture.
- `loadDrawing(false, deletedElements)` may run during save normalization. Camera stripping in the reload branch is not automatically exercised by that call. Adding app state to `updateScene()` can change flush behavior as well as values. The observed camera improvement does not prove which mechanism caused it.
- `await loadSceneFiles()` does not await all image publication/decoding. Some image helpers change geometry/customData without a version bump; do not classify all image differences as disposable cache noise.
- Incremental sync does not explicitly adopt the drain's raw Markdown into `this.data`; serialization uses that buffer's envelope. Verify Obsidian's actual TextFileView callback/buffer contract before claiming a stale buffer, or fixing one by blindly overwriting local Markdown. `setViewData()` has a same-file early return after asynchronous initialization.
- Exact prepared-text equality describes observed bytes, not who emitted a Vault event. View revisions are local counters. Even serialized writes in a single JavaScript realm can race across awaits; a per-view coordinator is not a per-path write coordinator.

## 4. Checkpoint 5b.1 — trace the first erroneous transition

Create a temporary, isolated diagnostic patch with prefix such as `EXCALIDRAW_PERSISTENCE_5B`. Use `log` from `src/utils/debugHelper.ts`, not direct console calls. Emit one copyable string per event, with monotonically assigned anonymous view/operation IDs and sequence numbers. Bound captured observations; do not retain views, scenes, or giant payloads in a global debug buffer. Remove diagnostics and search both `src/` and the rebuilt `dist/main.js` before a production commit.

Trace the missing-propagation boundary first as specified above. The following is the available diagnostic inventory; enable deeper per-element comparisons only when routing/write evidence requires them. Dirty-origin tracing remains necessary for source edits and any recurrence of ping-pong, but an unexpected dirty event is no longer required to begin diagnosis.

- Dirty origin and before/after current/saved/active/requested revision; previous/current ordered scene hash; tracked-app-state category; whether a queued request was created/replaced. Do not merely log the final header-icon color.
- Save trigger (autosave, switch/blur, force, flush, teardown), capture start, preparation completion, actual write invocation/completion/failure/no-op, queue yield/resume, and terminal acknowledgement. A resolved whole-loop promise is not an individual write-completion event.
- Modify notification, classification candidate/result, pending marker transitions, sync acquisition/release, exact target/runtime validity, Vault read start/completion, parse start/completion, publication, and full-reload branch.
- At raw, parsed, merged, published, and serialized boundaries: bounded anonymous element transition samples plus counts of changed IDs, versions/nonces, indices/order, links, text dimensions, deletion state, image geometry/customData, and tracked app-state categories. Capture immutable scalar observations immediately; do not inspect a live object later and call it its earlier state.
- Fingerprint raw/prepared text at selected operation boundaries. Do not hash multi-megabyte scenes on every `onChange` or await extra diagnostic work inside behavior-critical paths. If hashing is deferred, label when input was captured versus when the digest completed. Measure diagnostic overhead and confirm the uninstrumented symptom too.
- Observe TextFileView `getViewData`/`setViewData` and its inherited save contract using the supported runtime/debugger or local typings/source where available; use obsidian-typings as the API reference. Do not introduce an unverified TextFileView override merely to collect a trace.
- Separate delayed loader callbacks, scene publication, and store/onChange notification. A queued loader, synchronous API return, frame callback, and actual paint are different milestones.

Start with a single edit/switch to establish normal routing, then reproduce the reported repeated alternating edits. Identify the first required edit that fails to reach the other view; a quiet but divergent pair is as significant as busy queues. If a new dirty loop occurs, identify its first unwarranted dirty transition and follow the resulting write. If normalization produces a required write, check that its result stabilizes on the next cycle.

**Gate:** attach a concise trace interpretation and unresolved questions to the ledger. If the trace changes timing enough to hide the bug, reduce it and use deterministic barriers in the test harness; do not declare resolution. Do not add a new production manager/guard in this diagnostic checkpoint.

### 5b.1 instrumentation execution record

- Commit `45144b52` is the accepted boundary containing `CaptureUpdateAction.NEVER` and the three persistence planning documents. The failed combined experiment remains preserved as stash object `2b158abb204fd9b7e76aeea0a80e12476ce9879e` and was not reapplied.
- The temporary diagnostic patch remains uncommitted. It adds `src/utils/persistenceTrace.ts` and instruments `PluginFileManager`, `EventManager`, `ViewSaveCoordinator`, and `ExcalidrawView`. It does not add a persistence manager, guard, suppression decision, queue transition, or other intended behavior correction.
- Every diagnostic event goes through `log()` as exactly one fully rendered string beginning `EXCALIDRAW_PERSISTENCE_5B`. It assigns anonymous per-runtime view IDs and a global sequence/elapsed time. It never prints a Vault path, Markdown text, element content, or object payload. Large prepared/read text and ordered scenes are represented by synchronous fingerprints and counts; selected local element changes use hashed IDs and bounded metadata for at most eight elements.
- The trace covers local dirty origins and revision transitions; leaf leave/enter and save request completion; save queue creation, coalescing, dequeue, write, acknowledgement, yield, and release; suppression arm/consume/re-arm/expiry; modify routing; pending-sync marker and loop transitions; read/parse/merge/publication; and reload early-return reasons. A five-second delayed read-only snapshot after leaf activation records both the live scene fingerprint and settled save/sync/pending/suppression state, so a quiet divergent pair is observable without rescue input.
- Node 22.22.2 production build passed in 10.2 seconds with the established 33 circular-dependency warnings. `node --check dist/main.js` and `git diff --check` passed. The instrumented bundle is 4,914,810 bytes with SHA-256 `91993059ab69fff35ebb4313811d4d76089dd7c29539b3860cff9e5af5de1fe7`. Focused lint reports only the same 18 established `ExcalidrawView.ts` findings; the new helper and the other three instrumented files are clean.

Runtime capture procedure:

1. Deploy the instrumented bundle and fully restart Obsidian. Open the disposable large fixture in two adjacent fully loaded Excalidraw views and let initial Markdown-image work settle.
2. Open Developer Tools, filter Console output by `EXCALIDRAW_PERSISTENCE_5B`, and optionally clear the filtered console immediately before editing.
3. Make distinct edits to separate elements while alternating A → B → A → B as in the reported reproduction. Continue only until the first visible missed propagation or divergence.
4. At the first divergence, stop all input. Do not force save, reload, close a leaf, or make a rescue edit. Wait at least five seconds so the delayed settled-state snapshot is emitted.
5. Copy all filtered trace lines as plain text and report which view missed which visible edit. Preserve line order. If the trace volume or overhead prevents reproduction, report that rather than extending the test or treating it as a pass.

### 5b.1 trace interpretation

The two maintainer traces reproduce two independent failure boundaries. These are observed event sequences, not inferred plugin-runtime history or timing guesses.

**Trace A — a dirty receiver is destructively full-reloaded.** V2 records a local durable edit at sequences 53–55 while V1 is preparing its save. V1 writes at sequences 56–58. V2 receives that modify while dirty (`modify-match`, sequence 59), but routes it to `modify-route-full-reload` at sequence 61; `reload-enter` at sequence 62 confirms `full=1` and `preserveViewport=0`. The reload later advances/clears V2's dirty baseline at sequences 81–82 and completes at sequence 83. No incremental synchronization marker, read, merge, or publication occurs for V2. Therefore V2's edit is replaced by the disk snapshot written from V1. The five-minute heuristic is unsafe whenever its target has local unpersisted state; this failure is independent of expected-write matching.

**Trace B — post-save suppression consumes another view's write.** Own writes normally consume the suppression armed immediately before `super.save()`, then successful completion arms the same Boolean again for the cleanup window. The re-armed Boolean has no writer or content identity. The trace records six events where the view consuming suppression is not the view whose `textfile-save-begin` caused the modify: sequences 474, 796, 849, 894, 942, and 1054. The first is already conclusive: V2 re-arms after its own save at sequence 416; V1 writes at sequence 471; V2 consumes that event with `cleanupTimer=1` at sequences 472–474, so it creates no pending synchronization. Its timeout at sequence 495 only observes the Boolean already cleared and cannot recover the event.

The final transition proves this is a dropped notification, not work that merely needs more time. V1 finishes a write and re-arms at sequence 1003. V2 subsequently writes different prepared bytes at sequence 1048. V1 is clean, not saving, and not busy at sequence 1052, but consumes V2's event from the stale cleanup-window Boolean at sequences 1053–1054. After timers settle, V1 and V2 both report `dirty=0`, `saving=0`, `synchronizing=0`, `pending=0`, and `syncLoop=0`, yet their live scene summaries differ at sequences 1069 and 1072 (`4432:3:2080337:47643cfd:3c5b39d6` versus `4432:0:2080312:c16304cc:92a2bd45`). No later queue action exists that can reconcile them. Earlier cross-suppressions in both directions explain why the user-visible missing direction can vary during sustained alternation.

The trace does not show a hung save, an exception, an unreleased synchronization flag, or an unprocessed pending marker. It does show expected parse-time/installation version changes, but those are downstream of successfully routed notifications and are not needed to explain either first break. Preserve those normalization concerns for the deterministic convergence suite; do not mix them into the two demonstrated routing corrections.

## 5. Checkpoint 5b.2 — reproduce and establish convergence

There is no established plugin view/model unit-test suite in `package.json`. Do not invent an `npm test` success claim. Establish a small reproducible harness with a documented command using current tooling; prefer actual functions/classes and injected Vault/scheduler boundaries over a copied imitation of the algorithm. A source-loop micro-test proves only that loop. Test helpers may control promise completion order; avoid timing-dependent real sleeps. Pure helpers can be extracted mechanically only when needed and separately reviewed.

Implement and validate the demonstrated boundaries as separate increments:

1. **Dirty-receiver routing.** Reproduce Trace A with a receiver whose `lastSaveTimestamp` is more than five minutes old and which has a local unsaved edit when another view writes. A same-file Markdown modify must not enter destructive full reload while the receiver is dirty or persistence/synchronization-busy. Route it through the existing pending incremental synchronization path so acquisition, latest-file read, version merge, explicit retained-local dirty state, and viewport preservation remain in force. Keep the clean, inactive stale-view refresh policy unchanged unless its own test proves it unsafe. Verify the local edit and incoming non-conflicting edit both survive, the receiver remains dirty only until the merged state is persisted, and reopen contains both. This correction is eligible for its own checkpoint/test before suppression replacement.
2. **Cross-view suppression reproduction.** Encode the Trace B order explicitly: A completes an own write, its immediate own modify consumes the pre-write arm, completion re-arms the Boolean, then B writes before A's cleanup timeout. Assert that current code suppresses B's event and leaves no pending marker. Retain this failing regression through 5b.3–5b.5. Do not “fix” it by merely shortening the timeout or deleting the completion re-arm: Vault notification timing can differ by platform, and either timing-only change recreates a missed-own-echo or external-write window.

The demonstrated durable replacement is the planned content-aware path: 5b.3 must associate exact prepared bytes and actual successful completion with a save operation; 5b.4 must verify the candidate classification against these interleavings without suppressing; 5b.5 must mark same-file Markdown events as pending work before classification, acquire the existing read boundary, and skip only content already represented by a relevant successful/accepted identity. A different view's differing bytes must remain eligible even during the former cleanup window. Equality may establish redundant content, not writer identity. Keep `CustomEmbeddable`'s non-save calls to `setPreventReload()` explicitly inventoried; removing save-owned Boolean suppression does not authorize deleting same-file editor protection before checkpoint 8 supplies an equivalent owner/grace model.

Define three separate comparisons:

1. **Exact bytes:** what the Vault read or actual save contained. Suitable for redundant-content detection, not merge ownership.
2. **Persisted document meaning:** elements including order/deletions/custom fields, persisted app state, and Markdown envelope under existing format rules. Any excluded field requires a concrete reason; do not erase all indices, nonces, camera values, or image dimensions to make tests pass.
3. **View-local runtime state:** camera, selection, render caches, and editor state where the existing policy treats them as local. Some camera/tool settings are serialized under current settings; local runtime ownership does not authorize removing them from the file format.

Required controlled cases:

| Case | Assertion / decision required |
| --- | --- |
| Parse and serialize unchanged non-text links repeatedly | After any explicitly justified normalization, versions and writes reach a fixed point; real link changes still persist |
| Equal elements with different order/invalid fractional indices | Genuine layer changes survive; normalization converges; dirty baseline corresponds to what was actually installed |
| Raw/parsed text, bound text, equations, copied Markdown images | Normalization does not endlessly toggle fields; durable geometry changes are retained |
| Older incoming N, newer local N+1 | Local result remains eligible for persistence even if the receiver was previously clean or already dirty |
| Incoming-only changes to a clean receiver | Accepting the persisted baseline alone does not create a write-back loop |
| Same element changed in both views; deletion versus edit | Record existing tie/deletion policy; preserve it unless a demonstrated correction is explicitly approved; never claim both conflicting values survive |
| Repeated/duplicate notification and notification during sync finalization | Latest work is not lost at marker clear or promise-finally boundaries; unchanged events do not generate writes |
| Pending save waits for sync; reconciliation changes state | Pending request covers the reconciled revision; acknowledgement cannot strand that change |
| Save fails, parse fails, or view changes while awaiting | Flags/promises release; dirty state and existing valid drawing survive; no false success or stale publication |
| Markdown/back-of-note changes while scene save is preparing | Latest accepted envelope is retained or a conflict is explicitly handled; no silent header/tail overwrite |

Control at least these cross-view interleavings: A writes, B reads A, B merges/saves; A and B both prepare before either completes; B writes between A's notification and A's read; A receives another notification while applying the first; old read/hash completes after navigation/record replacement. Test on-demand leaf-switch saves with autosave, not autosave alone.

If two saves can overwrite an unseen non-conflicting edit before any reader observes it, a latest-read marker alone cannot fix that. Produce the failing timeline and decide whether a narrow plugin-owned per-path reconciliation/write boundary is needed. Such coordination must still use `super.save()` for live writes, must reread/reconcile under the relevant boundary, and must preserve main-realm migration rules. Mere FIFO serialization or choosing the last arrival is not conflict resolution. Treat this as an explicit prerequisite checkpoint, not an incidental new queue inside hash detection.

**Gate:** record the earliest failing case and its responsible boundary. For a queue/merge correction implemented here, record its passing reproduction and callback/history effects. If the failure is specifically the Boolean suppression that 5b.4/5b.5 replace, or snapshot ownership addressed in 5b.3, retain the failing regression case and explicitly carry that acceptance requirement to the named step. Do not require 5b.2 to solve the Boolean with an interim heuristic just to reach the designed replacement, and do not claim overall convergence before it is fixed. Independent defects must not be hidden by the pending replacement. Undo/redo must keep local edits undoable without making remote acceptance a spurious user edit. Re-run both first-edit and sustained large-scene cases after each relevant correction.

### 5b.2a dirty-receiver routing execution record

The first demonstrated correction is implemented as an isolated routing change. `getDrawingModifyRoute()` is a pure production helper used by `PluginFileManager.modifyEventHandler()`. For same-file Markdown, a dirty or persistence-busy receiver now selects `incremental-sync` before the five-minute stale-view decision. That route uses the existing latest pending marker, acquisition, Vault read, merge, non-undoable publication, retained-local dirty marking, and autosave. A clean and idle stale Markdown view still uses the existing full reload; raw `.excalidraw` routing is unchanged.

`node scripts/check-file-modify-routing.mjs` imports the production helper and verifies stale+dirty → incremental, stale+busy → incremental, clean+idle+stale → full reload, the existing Markdown-side/recent-switch protection, and both raw-file routes. It passes. Focused lint for the new helper, `FileManager`, and all temporary diagnostic support files passes. The Node 22.22.2 production build passed in 10.7 seconds with the established 33 circular-dependency warnings; bundle syntax and `git diff --check` pass. The bundle is 4,915,216 bytes, SHA-256 `16534db42f8f0f1b28d69c123166ef02f5a2c6a056e3544c61fbb9bd876a6327`.

Manual gate is deliberately scoped to Trace A because Trace B remains unfixed. Start from a full Obsidian restart with the large drawing's file modification time older than five minutes and neither view carrying a prior suppression timer. Open it in adjacent fully loaded views. Edit A, switch immediately to B, and make a distinct edit while A is still preparing/writing. B's matching modify must log `dirty=1` followed by `modify-route-sync`, never `modify-route-full-reload`; B must retain its own edit while accepting A's non-conflicting edit, preserve its viewport, and persist the merged result. After work settles, verify the persisted/reopened drawing contains both. The still-known stale suppression may prevent A from immediately receiving B's merged write, so that symptom alone does not reject 5b.2a; record it under the already proved 5b.3–5b.5 requirement. Any loss of B's local edit, full reload while B is dirty/busy, or failure of the persisted merged result rejects this increment.

Maintainer validation passes this scoped gate. Across 1,223 trace lines there is no `modify-route-full-reload`; every matching event not consumed by the known Boolean enters `modify-route-sync`, including dirty receivers. The alternating dual-edit scenario remained responsive longer and was reported as definitely better. The two live views eventually diverged on screen, but closing and reopening the view that missed updates loaded those updates from persisted content; the reopened V3 settled with 4,435 live elements. This confirms the former dirty full-reload loss is removed and the accumulated result remains reopenable.

The residual divergence is not new evidence against 5b.2a. The same trace contains seven cross-view suppression events (sequences 563, 684, 731, 850, 903, 1012, and 1123), each caused by a receiver's prior post-save cleanup-window Boolean rather than the current writer. For example, V1 writes at sequence 1117 while clean/idle V2 consumes the event at sequences 1121–1123 with `cleanupTimer=1`, creating no pending synchronization. V2 later shows a different live summary, while reopen obtains the later persisted scene. This precisely matches the accepted 5b.3–5b.5 regression and requires no additional routing change in 5b.2.

## 6. Checkpoint 5b.3 — minimum save ownership (original 9a)

Before implementing, write the capture/acknowledgement contract. Conceptual names below describe roles, not a demand for new managers or final public types:

- **Save intent:** trigger, force/guard/side-effect policy, producer identity, and requested revision. A queued intent can predate capture.
- **SaveSnapshot:** file identity/runtime generation, capture revision, owned scene/app-state/deletion/selection inputs, and the Markdown envelope or its explicitly accepted base identity.
- **PreparedSave:** exact final text, normalized state identity, producer/capture revision, and persistence-relevant eligibility/options. Mutable preparation scratch is not exposed as an immutable result.
- **Write completion:** operation identity, actual successful prepared payload identity, and the revision it is safe to acknowledge. Failure/skipping/handoff are not successful disk writes.

Use existing project/fork types; keep view-scoped types local unless shared. Choose the revision-capture point explicitly: forwarding `requestedRevision` is not enough if capture happens later. Either capture that exact revision when requested, or capture current state later and return its actual captured revision. Do not acknowledge revisions that arrived after capture. Preserve public `save(...)`/force-save delegates and policy merging.

Inventory every mutable input used after an await: elements and nested points/bindings/customData, deleted elements, selected IDs, app-state nested objects, file metadata, Markdown envelope/element maps, and normalization outputs. Copy mutable structures needed by preparation; share immutable strings/bytes only under a documented ownership rule. Do not JSON-clone the entire live API/app state (it contains runtime objects), nor duplicate all image data URLs unnecessarily. Dev tests can freeze owned captures, but must not freeze objects still owned by Excalidraw.

`syncElements()` currently installs and mutates the scene in `this.excalidrawData`. Determine which preparation mutations must later be reflected in the live model. Do not solve immutability by simply detaching everything and dropping normalized metadata, or by publishing an old snapshot over newer local edits. Prove that API mutations during compression cannot change prepared text or exported normalized state.

Capture after any intentionally awaited edit/deletion prompt, with target revalidation. For migration, capture all API-owned values synchronously and unmount before the **first await**, as required today; do not move an ordinary save's waits into that pre-unmount path. Keep teardown and replacement file identity checks distinct from source runtime lifetime.

Audit `getViewData()` and `super.save()` so the text fingerprinted is exactly the text the inherited bridge consumes, including headers/frontmatter/back-of-note and compression. Preserve forced no-op save's explicit reload behavior (`reloadIfWriteDidNotEmitModify`); unchanged text can still require a refresh without a modify event. Verify BAK's existing `lastSavedData` source corresponds to this completed write before building on it.

**Gate:** paused compression plus further edits, nested-object mutation, queued revision advancement, failed write, no-op force save, malformed incoming Markdown, navigation, and migration. Older completion cannot clear a newer revision; normalization cannot overwrite newer live work. Measure peak retained data on the large fixture. No export queue yet.

### 5b.3 implementation record

`ViewSaveCoordinator` now assigns each physical attempt a save intent containing the view producer, save-target generation, operation ID, and requested revision. `ExcalidrawView` samples the actual current revision at scene capture, after the existing deletion-prompt await and target checks. A save-target generation advances when `TextFileView` starts loading a different target; this identity is only for persistence records and deliberately does not claim to be the asynchronous load fence planned in checkpoint 11.

`saveSnapshot.ts` creates save-owned copies of the scene envelope, elements and their nested plain data, the persisted app-state subset, binary-file records, deleted elements, selected IDs, and source Markdown envelope. Runtime render caches (`shape` and `canvas`) are excluded, while immutable data-URL strings are shared. Existing `ExcalidrawData.syncElements()` still owns normalization and its metadata maps; after it settles, `generateMDBase()` synchronously materializes those maps and the normalized scene into strings before asynchronous compression. Therefore the resulting `PreparedSave.text` is the exact immutable text passed through `getViewData()` to `TextFileView.save()`. Completing an older capture acknowledges only its captured revision; edits arriving during normalization/compression remain newer and retain/queue dirty work even if their data was conservatively included in the prepared bytes.

The coordinator retains the latest `PreparedSave` only for a completed live `super.save()` or the awaited main-realm migration write. A requested, skipped, failed, delayed-unload, or migration-handed-off operation is not labeled a successful physical write. The current Boolean is still armed and consumed exactly as before; no modify event is classified or skipped using this record in 5b.3.

Automated validation: `node scripts/check-save-snapshot.mjs` proves nested element/deletion/app-state/file detachment, render-cache exclusion, immutable data-URL sharing, exact prepared text identity, target generation, and captured-versus-requested acknowledgement. Focused lint, unused-symbol checks, production and library builds, bundle syntax, and `git diff --check` pass. The Node 22.22.2 production build retains the established 33 circular-dependency warnings; `ExcalidrawView.ts` retains exactly its established 18 lint errors. With the temporary trace removed, the production bundle is 4,905,956 bytes with SHA-256 `46873e0e72d5264b3aa240be88cb395a37d44b72a1f09fe2fc16e07ea05c9de5`.

The maintainer accepted the focused runtime gate on the 4,400+ element scene: edits made around compression persisted, all tested change types passed, bound linear elements did not change the outcome, and no regression was identified. This gate does not require two-view convergence: the known post-save Boolean may still discard the other view's notification until 5b.5.

## 7. Checkpoint 5b.4 — observe classification without changing suppression

Alongside the now-validated baseline behavior, maintain a temporary candidate record and log what a replacement would do. Do not consume notifications based on the candidate yet. Keep candidate calculations bounded and separate from production scheduling; observation can perturb timing, so compare uninstrumented runs as well.

Candidate identity needs a producer/operation ID, target file/runtime identity, captured revision, exact prepared-text fingerprint, and write state. Producer revision is meaningful only for that producer. A newly started write must not be labeled successful; a record from an older operation must not clear its replacement after a delayed promise settles. Track a successfully accepted document baseline separately where needed. Bound retention; do not store an unbounded hash history.

| Observed state | Required interpretation |
| --- | --- |
| Bytes match this target's known successful prepared write, with no newer local edits | Candidate redundant content; not proof the notification originated here |
| Same bytes, but local edits occurred after capture | Do not clear or acknowledge those newer edits; any skipped merge is only an optimization for already represented disk content |
| Bytes match only a pending/failed/abandoned attempt | Not established successful content; defer/classify after outcome or process normally |
| Bytes match the fully accepted current document baseline | Repeated notification may be redundant without a current expected-write record; define this independently of timeout expiry |
| Different or unknown bytes; read/hash failure | Keep external work eligible; report failure through existing paths; do not consume as an own write |
| Target/runtime/record changed during await | Result cannot classify the replacement target; preserve any newer target work |
| Later writer produced identical bytes | Equality can make content redundant, but cannot establish writer identity |

Test record replacement, successful write notification before/after promise completion, no-op write without notification, duplicate/delayed events, failed write, rename, close, A→B→A navigation, and two writers. Observe force-save and same-file editor callers, including the two suppression calls removed in the failed `CustomEmbeddable.tsx` patch.

**Gate:** every skip decision is justified by known accepted/successful content and cannot lose newer local state. Record disagreements with actual outcomes before changing behavior. Timeout is cleanup, never evidence of origin.

### 5b.4 implementation record

The observation patch is intentionally uncommitted. The bounded classifier compares exact retained strings, while console output uses only length/FNV fingerprints. It distinguishes successful writes, accepted input, still-pending attempts, failed attempts, unconfirmed handoffs, differing known content, and missing/stale target identity. A matching successful write or accepted baseline also reports whether a newer local revision exists; observation never clears that revision.

Existing incremental synchronization classifies the Vault text it already read. To inspect events that the legacy Boolean currently drops, a view temporary per-view marker coalesces only those Markdown events into one latest-state shadow read after local save/sync/edit ownership settles. That read neither parses nor publishes data and never marks dirty or schedules persistence. It captures and revalidates the save-target generation before and after awaits. Initial successfully loaded text and successfully applied synchronization text establish the observation-only accepted baseline. Prepared write attempts are recorded before persistence and transition only when the matching producer/target/operation completes; an older completion cannot replace a newer candidate.

All diagnostics use `log()` and emit one complete string prefixed `EXCALIDRAW_PERSISTENCE_5B4`; they contain anonymous view IDs, revisions/states, and bounded fingerprints, never paths, note contents, image data, or expandable objects. `node scripts/check-save-content-classification.mjs` covers successful content with/without newer local work, accepted content, pending/failed/handed-off attempts, different content, target-generation invalidation, and operation replacement. Focused lint, unused-symbol lint, the production build, bundle syntax, and `git diff --check` pass. The instrumented bundle is 4,912,850 bytes with SHA-256 `62d4a318aec18fc275c6c5fd624d0d53f65309c1a0347b803a9c721c3e0bc731`; the build retains 33 established circular warnings and `ExcalidrawView.ts` retains its established 18 lint errors.

Runtime gate: deploy and restart Obsidian, filter the console by `EXCALIDRAW_PERSISTENCE_5B4`, and run the same alternating two-view large-scene test until the first visible missed propagation. Stop input and wait several seconds before copying all filtered strings. For an ordinary own-write echo, the suppressed shadow read should classify `matches-successful-write`. For the proved cross-view defect, the receiving view's legacy Boolean may still consume the event, but its shadow read must classify `different-from-known-content` (or another explicitly non-skippable state), never a successful/accepted redundant match. Also capture one duplicate notification/settled no-op and one edit made during a save; matching content with `newerLocal=1` must not imply that the newer revision can be cleared. Any mismatch between these candidate results and the known event outcome rejects 5b.4 and must be explained before 5b.5.

### 5b.4 runtime evidence and popout follow-up

The two supplied `EXCALIDRAW_PERSISTENCE_5B4` traces validate the candidate distinction for main-window views 1 and 3. Each view's own notification shadow-read repeatedly classified `matches-successful-write`. Four notifications consumed in the other view's post-save Boolean window classified `different-from-known-content` (trace sequences 93–98, 108–113, 132–135, and 147–150). These are exactly the events that 5b.5 must retain as pending work. Sequence 106 also records `matches-successful-write newerLocal=1`, confirming that byte equality must not acknowledge or clear a later local revision.

The three-view extension reveals a separate pre-classification gap. View 4 records `content-accepted` at sequence 152, proving that its runtime loaded the persisted document, but subsequent saves from views 1 and 3 produce no view-4 suppression, route, sync-read, or accepted-content event. That absence does **not** yet prove why the view was skipped: the original 5b.4 logging begins only after `getExcalidrawViews(app, true)` and target checks. Keep production routing unchanged and temporarily record every Excalidraw leaf visible through both `getLeavesOfType()` and `iterateAllLeaves()`, plus `_loaded`, API readiness, closing/migration state, file match, and the selected route. The next reproduction must establish whether the popout is absent from type enumeration, rejected by the initialized-only filter, rejected by lifecycle/file targeting, or routed to ignore. Correct only the demonstrated boundary, then rerun this main/popout case before enabling or accepting 5b.5.

The follow-up trace resolves that routing question. In this session the affected popout is anonymous view 3. Across all 17 observed modifications it is returned by type enumeration, `_loaded=1`, API-ready, and matched to the modified file, but `closingOrMigrating=1`; `PluginFileManager` therefore takes its intentional lifecycle early return. This is not an initialized-view or file-target failure. View 3 also prepares and completes three later writes through `window-migration-persisted` (sequences 66–77, 146–157, and 257–268), proving `windowMigrating` itself remains active while the user continues editing. Do not merely bypass `isClosingOrMigrating()` in `FileManager`: that would let a source-runtime guard fail open.

The phase traces establish two different Obsidian operations. **Move to popout** completes `closeLeafView()` with `sourceStillLeaf=0`, then creates a distinct replacement (`sameAsSource=0`) that becomes API-ready and receives later updates. **Open in popout** invokes the callback while the newly created leaf's own view-state transition is still active: `closeLeafView()` resolves in the same millisecond with `sourceStillLeaf=1`, and replacement setup resolves with `sameAsSource=1`. That source object then becomes API-ready while retaining `windowMigrating`, so it is visible and writable but excluded from incoming synchronization. The correction preserves synchronous capture and pre-await unmount, completes any required save flush, then yields one main task on the destination window before calling `closeLeafView()`. This lets the outer state transition finish before the nested source replacement. The phase trace must now show `sourceStillLeaf=0` and `sameAsSource=0` for both opening modes; if either remains `1`, do not clear the migration flag or bypass the guard.

The reported 4,400-element lock/select latency reproduces on Excalidraw.com. Treat it as an upstream Excalidraw performance investigation unless a separate profile demonstrates additional plugin synchronization overhead; it is not evidence against the current persistence classification. The phase-observation build passes the focused classifier/snapshot/routing scripts, unused-symbol lint, focused lint, production build, bundle syntax, and `git diff --check`. `ExcalidrawView.ts` retains exactly its 18 established lint errors, the build retains the 33 established circular warnings, and the bundle is 4,914,732 bytes with SHA-256 `3c7607fbf2648cf162a4ad32e21f403f7427d068edad324524b3027e8f6f690e`.

## 8. Checkpoint 5b.5 — enable coalesced content matching

Keep the modify callback lightweight: initialized-target validation, existing routing, and marking latest-state work. For the incremental Markdown path, the view's pending-sync operation should own the fresh read and candidate comparison after acquiring the appropriate save/sync/lifecycle boundary. Reuse that read for parsing; do not create a separate per-event read/hash task ahead of it. Preserve raw `.excalidraw`, full-reload, explicit refresh, and same-file branches; either route them through a validated equivalent classification boundary or explicitly retain their safe behavior during staged rollout.

Logical operation (adapt existing code rather than introducing another loop):

1. Mark a current file as needing inspection; notifications while busy retain this demand.
2. Acquire the operation boundary without waiting on a whole save loop that is itself waiting for this sync. Revalidate the exact runtime/file after meaningful awaits; same path alone is insufficient for navigation away and back.
3. Claim the current pending marker before the read, preserving any later notification as trailing demand. Read current Vault text once, compare against valid success/acceptance identity, and parse only if reconciliation is needed.
4. On redundant content, do not alter newer local dirty revisions or manufacture a new save. On changed content, parse/reconcile through the tested pipeline and advance the accepted baseline only after successful application. If an editor acquires the file meanwhile, retain pending demand and wait for release.
5. Release ownership in `finally`; inspect any trailing demand, including one arriving between the last loop check and promise cleanup. Use existing bounded state if sufficient; add a notification epoch only if a proved gap requires it. Parse failure must retain valid live state without starting an endless retry loop on the same malformed bytes.
6. Save genuinely unpersisted reconciled state through the existing coordinator. Prove fairness between finite pending sync and trailing saves; no early return may strand a dirty revision behind a stale request.

Hashing must be browser/mobile-safe. Exact bytes are the write identity; if a fingerprint is used, document collision assumptions and failure behavior. Do not confuse the Excalidraw scene hash with a full-text fingerprint. Revalidate record/runtime after asynchronous digest completion. Timeouts only release abandoned records; expired records must not cause an otherwise unchanged document to start a save cycle.

Before removing `preventReload` storage/accessors, search **all** callers and classify their purpose: ordinary save echo, explicit force/reload request, same-file editor grace, migration, and teardown. Keep the successful 5a rule (no arming before serialization) until its replacement is accepted. Do not carry forward the failed patch's history mode, camera arguments, or dirty predicate simply because they are adjacent in the diff; each needs its own evidence and gate. If the same-file ownership gate is a prerequisite, execute checkpoint 8 explicitly before retiring those calls.

### 5b.5 implementation record

The staged implementation leaves the legacy Boolean storage and all existing callers in place, but it no longer allows that Boolean to discard a Markdown drawing notification. `PluginFileManager` consumes the one-shot flag for compatibility, then continues through the established route. Raw `.excalidraw` notifications still retain their former early return. Same-file embeddable callers still own `embeddableIsEditingSelf`; their Markdown notification becomes pending and waits at `acquireSynchronization()` until ownership releases.

The pending synchronization loop remains the only active read boundary. After acquiring save/sync/edit ownership, it claims the current marker, reads the latest Vault text once, and revalidates both file/runtime identity and target generation. Exact bytes classified as `matches-successful-write` or `matches-accepted-content` do not parse, publish, clear dirty state, or schedule a save. This remains true when a newer local revision exists: the disk content is redundant, while the later local revision remains dirty. Pending, failed, handed-off, different, or unknown identity follows the existing parse/reconciliation/accepted-baseline path. The temporary separate shadow-read loop was removed, so enabling the decision adds no diagnostic Vault read.

Executable checks cover Markdown deferral versus raw suppression and redundant/non-redundant classification, including successful bytes with newer local work. Classifier, snapshot, and route scripts; focused lint; unused-symbol lint; production build; bundle syntax; and `git diff --check` pass. `ExcalidrawView.ts` retains its exact 18-error baseline and the build retains 33 established circular warnings. The accepted instrumented bundle, including the **Open in popout** correction, was 4,913,456 bytes with SHA-256 `b5d3e75b650bfa20c54126710cb15bad3f01ecc730bdeca780cf39761980ecc0`.

The maintainer then accepted the instrumented runtime gate. Sustained work on the approximately 4,400-element drawing did not break save or synchronization. Additional passing cases covered an active back-of-note editor while switching tabs, adjacent Markdown and Excalidraw representations of the same note, dirty migration to a popout without a prior save, and switching an unsaved drawing to Markdown mode by hotkey. **Open in popout** now creates an updating replacement rather than leaving the visible source permanently migrating; **Move to popout** remains healthy. All changes were preserved.

Temporary fingerprints, anonymous-view enumeration, migration-phase logging, and classification-decision logging were then removed. A repository and rebuilt-bundle search finds no `EXCALIDRAW_PERSISTENCE_5B4`, `persistenceClassificationTrace`, or `persistenceClassificationFingerprint`. The first clean production bundle was 4,909,082 bytes with SHA-256 `a1b49ad6b31e527c291ecc0dfdcf585d20cb272da010f1068aa0859f8faa86a9`; it retained the 33 established Rollup circular warnings. The three executable checks, focused lint, unused-symbol lint, bundle syntax, and `git diff --check` passed; `ExcalidrawView.ts` retained exactly its established 18 lint errors.

That first clean build failed the **Open in new window** runtime case while **Move to new window** continued to work, so it is rejected as a checkpoint candidate. The accepted instrumented trace records `content-accepted` for the source view during the supposed timer boundary, before `closeLeafView()` succeeds. Removing fingerprint/logging work allowed the zero-delay destination timer to run before that asynchronous `setViewData()` continuation completed. The corrected invariant is therefore not “one timer has elapsed”; it is “the exact active view-data load has settled, followed by one destination task.” `setViewData()` now owns a bounded completion record, settles it on successful, early-return, and rejected layout-ready continuations, and migration captures the active promise before synchronous unmount. This is completion observation only: it does not invalidate loads, alter file identity, or claim the broader generation work of checkpoint 11.

The revised clean production bundle is 4,909,585 bytes with SHA-256 `15733871836c02a3dfcd84a3e9c817028ca34d153366b352c40c2c467f7a3982`. It contains no temporary trace prefix. The three executable persistence checks, unused-symbol lint, production build, bundle syntax, and `git diff --check` pass; `ExcalidrawView.ts` retains exactly its established 18 lint errors and Rollup retains 33 established circular warnings.

**Final 5b gate:** accepted. The maintainer confirmed the revised clean **Open in new window** path works correctly. The broader instrumented convergence and lifecycle cases listed above also passed, and **Move to new window** remained healthy throughout the clean-build regression comparison. One physical-mobile save/synchronization smoke test remains recommended before release, but checkpoint 6 may begin after the clean 5b commit.

## 9. Original checkpoint 6 — plugin-owned detached persistence

Start with ordinary dirty unload as its own change; migrate the special window-handoff path only after ordinary handoff is proven. Reuse the scheduling/cleanup lessons of `BackupPersistenceQueue`, not its entire policy: that queue currently drops pending work on `destroy()` and uses latest arrival, neither of which automatically provides source-document durability.

Define a data-only immutable request with operation/producer identity, file targeting information, captured revision, exact text, reason, and captured backup eligibility. Never retain view/Window/DOM/React/API/package lease references or callbacks closing over them. The plugin/main realm owns timers and execution and resolves the `TFile` at execution with `getFileByPath()`.

Required decisions before implementation:

- How the request relates to the last accepted source state and to newer live writes. View-local revisions cannot establish a global newest payload. If a successful-write sequence is introduced, define it at the actual ordered write boundary; assigning arrival tickets does not make two stale snapshots causally comparable.
- One active plus one newest trailing payload is safe only when the trailing candidate demonstrably supersedes the previous candidate. For independent producers, reuse any validated per-path reconciliation boundary from 5b.2 or explicitly resolve the conflict. Do not silently discard independent edits to preserve a queue-size target; if no safe bounded policy has been specified, stop and request the design decision.
- Separate `accepted/handed-off`, `persisted`, `superseded`, and `failed`. Replace `view-unload-scheduled` honestly. Decide how the coordinator/migration state represents pending responsibility without claiming Vault completion. Do not mark a handed-off revision as persisted merely to clear the old view's icon.
- Rename/delete/recreate-same-path behavior: resolve at execution but do not write stale text into a different file merely because the path exists again. Define cancellation/retargeting using the repository's lifecycle, not an invented permanent TFile ID.
- Shutdown/failure: define a bounded retained failure/reporting policy and flush opportunity; plugin unload/application exit may not await promises. An in-memory queue survives a view, not process failure. Do not add a hidden retry loop, recreate deleted files, or claim crash durability.

Keep live writes on `super.save()`. Preserve synchronous capture and source unmount before asynchronous migration work; popout-to-main final writing remains replacement/main-realm owned. Keep `ViewMigrationHandoffManager` drawing state separate. Deleting `ViewMigrationPersistenceHandoffManager` is the final proven consolidation, not the first edit.

**Tests:** dirty ordinary close; closing two views with distinct edits; old unload payload versus newer live save; immediate reopen; rename/delete/recreate; injected failure; source popout destroyed; dirty migration both directions; last popout close; plugin shutdown. Confirm no duplicate writes and no source runtime retained. Main-window ordering tests first, then native Electron teardown on available desktop systems and one mobile unload/navigation run.

### Checkpoint 6a implementation record — ordinary dirty unload only

The first increment replaces the view-owned 200 ms fire-and-forget callback only for ordinary `viewunload`. `executeSaveRequest()` hands the exact `PreparedSave` text and its producer, target-generation, operation, requested/captured revision, file path, captured file creation time, non-empty-scene eligibility, and `view-unload` reason to `ViewPersistenceQueue`. The save result is now honestly named `persistence-handed-off`; it transfers responsibility without publishing a successful-write identity. Normal live `super.save()`, both window-migration branches, drawing-state handoff, and migration persistence handoff are unchanged.

`ViewPersistenceQueue` is plugin-owned and contains only immutable request data plus a captured Vault capability. It resolves the current `TFile` immediately before execution and refuses a missing path, an empty payload, or a same-path file whose creation time differs. Requests execute FIFO per path and are never coalesced because independent view revisions do not establish supersession. Failures are contained so later requests still run, and they produce the existing long-lived serious-error notice plus structured error logging without file contents. The queue has no timer or listener and intentionally has no destructive unload cleanup: plugin unload begins asynchronous view conversions before their handoffs arrive, while completed path chains release themselves.

This increment does **not** solve or claim ordering between a detached request and a concurrent live `super.save()`, nor safe consolidation of two independently dirty closing views. Those remain checkpoint 6b design requirements. It also carries `hasNonDeletedElements` forward but does not write a BAK; that remains checkpoint 7. Do not collapse `ViewMigrationPersistenceHandoffManager` yet.

`node scripts/check-view-persistence-queue.mjs` verifies FIFO execution without coalescing, a blocked first write with a trailing request, missing and recreated targets, empty-payload rejection, injected write failure, later progress after failure, and flush settlement. Focused queue/main/coordinator lint, unused-symbol lint, the prior classifier/snapshot/routing checks, production build, bundle syntax, and `git diff --check` pass. Rollup retains 33 established circular warnings. The bundle is 4,911,256 bytes with SHA-256 `59b4e3a2c8184a3f77d7eb97d4d857c5b17a5e857c18e4bff7fd40132380c496`.

**6a runtime gate:** in the main window, edit a drawing and immediately close its tab without manually saving; reopen it only after a short settle and verify the edit is present. Repeat by switching an unsaved Excalidraw view to Markdown mode, and by disabling/reloading the plugin with an unsaved edit, then fully restart Obsidian and verify persisted contents. Repeat the immediate-close case once with the large compressed drawing to exercise serialization followed by retired-view writing. There must be no unhandled rejection or serious-error notice. A BAK update is not expected yet. Do not use two independently dirty closing views as an acceptance claim for 6a; record that separately for the 6b ordering design.

**6a runtime acceptance — 2026-09-13:** the maintainer accepted this increment after aggressive testing with five simultaneous representations of one drawing: one Markdown view, four Excalidraw views, adjacent views, a tab moved to a popout, and an independently opened popout. Persistence and synchronization remained stable and receiving viewports did not jump. A second test combined one mobile and two desktop views with parallel Markdown-embeddable editing. Obsidian Sync temporarily delivered malformed drawing JSON, which the existing Notice surfaced; after Sync settled, an explicit save persisted the latest valid scene and the file remained intact. A third mixed mobile/desktop/Markdown-view test remained stable under Sync latency. These results validate 6a's ordinary handoff in realistic lifecycle stress, but they do not prove the still-unimplemented 6b ordering between concurrent live and detached writers or migration-handoff consolidation.

## 10. Original checkpoint 7 — detached BAK after successful source write

Schedule BAK only from confirmed Vault completion using that operation's exact text and captured non-empty-scene eligibility. Do not inspect a retired view or a later live scene to decide whether the old write is safe to back up. Preserve the existing safeguard; its current element-count semantics must not silently change with tombstone representation.

Coalesced/superseded attempts that never write produce no BAK. Failed source writes produce no BAK. Integrate scheduling with existing main-window `ImageCache`/`BackupPersistenceQueue` storage rather than creating a second database or per-popout store. Order backups consistently with successful source writes, including live and detached completions. An older delayed callback must not replace a newer successful backup. Define source-write failure and backup-write failure as different results; a backup failure does not undo a source write.

**Tests:** exact payload identity, source failure preserving prior BAK, backup failure, empty scene, trailing supersession, slow older versus newer write, source close immediately after handoff, purge/clear with queued work. Verify durable backups are never treated as disposable preview cache. Keep recovery reporting plugin-owned and privacy-preserving.

## 11. Original checkpoint 8 — same-file edit ownership gate

Read the complete entry/flush/release paths in `CustomEmbeddable.tsx`, `MarkdownImageEditor.ts`, and the view's self-edit guard methods. Identify whether ownership is view-local, per file, or shared between paths before selecting storage scope; changing scope to plugin-global is a behavior change, not an accessor rename.

Specify idempotent `acquire(ownerId)`, `release(ownerId, graceMs)`, `hasActiveOwners`, `isInGracePeriod`, `isBlocked`. Different simultaneous editors need distinct IDs; repeated acquire from one owner must not leak a counter. Final-owner release starts the relevant grace period; reacquire cancels/replaces only the appropriate release state. Old timers must not unblock a new owner or a different file. Distinguish editor flush completion from its UI closing.

Resume pending latest-state synchronization after release/grace without another modify event. Preserve raw Markdown and explicit bypass/force-save semantics. Replace clear/re-arm workarounds only after their original ordering is reproduced by the new gate. Ensure editor teardown releases ownership even on failed saves, without claiming the failed content persisted.

**Tests:** two overlapping owners, switching image editors while the old one flushes, Canvas self-embed plus image editor, reactivation during grace, final Markdown modify during grace, external drawing change held pending, navigation/close/migration, and touch edit/exit on a physical mobile device. Add no new debounce duration without measured need.

## 12. Original checkpoint 9 — finish the normalized snapshot contract

Extend accepted 9a/5b.3 rather than recapturing the live API after persistence. `PreparedSave` should retain the normalized scene and settings/input identity needed by secondary outputs, as well as exact source text. Normalization may clear runtime file payloads; preserve or resolve the corresponding export assets without reading a later live view's scene.

Specify ownership of embedded-file metadata, Markdown/equation references, deletions, selection, app-state export options, and file path. Reference-based external assets may themselves change while exporting: document whether fidelity means source-scene revision or also frozen dependency contents. Do not promise historical external-asset bytes unless captured; avoid embedding all large image payloads by default. Persisted unknown/custom fields must survive.

**Tests:** full-scene versus selected export, parsed/raw text, equations, Markdown images, PDF crops, app-state-only edits, deleted elements, normalization during concurrent editing, migration, and peak retained memory while one operation plus a trailing operation exists. Releasing a view must not leak a snapshot through callbacks.

## 13. Original checkpoint 10 — autoexport fidelity, then ordering

**10a:** Make automatic `saveSVG`, `savePNG`, and raw `.excalidraw` output consume the successful `PreparedSave`, including normalized scene/options/path. Inspect `ViewExportManager`'s downstream `loadFilesForExport` and option getters: passing only a scene argument is insufficient if they still consult a later live model. Preserve manual exports' live-scene behavior and existing autoexport trigger policy, including blur and forced-save distinctions. Never export a failed/merely handed-off source request as a successful source revision.

**10b:** Add one active export and one newest eligible trailing export per source/format/theme, ordered by the validated source-persistence identity. Per-view revision maximum is invalid. Check resolved output-path collisions across formats/themes/renames too. Serialize or reject obsolete completion before the final output write so a slow old render cannot overwrite a newer export. A queued old autoexport must not write to a renamed/recreated target without an explicit path policy.

Do not make source persistence wait for slow image rendering/export completion. Detached autoside-effect behavior must be specified separately; never retain a retired view merely to finish an export. Raw `.excalidraw` autoexport can participate in existing modify/compatibility routing; test that it does not create another feedback loop.

**Tests:** N saving while N+1 is edited, slow N rendering versus N+1, two source views, light/dark outputs, source failure, export failure with newer trailing success, rename, close, manual export during queued autoexport, and matching exported elements to the saved source scene rather than the latest API scene.

## 14. Original checkpoint 11 — asynchronous load generation

Add a monotonically increasing view/runtime load generation. Each `setViewData()` entry captures generation and exact target identity before asynchronous initialization. Invalidate on replacement load, clear, close, and migration. Check after meaningful awaits and before mutations of model, raw text, API, React tree, file state, and dirty baselines. File-path equality alone fails A→B→A navigation. Disposal must invalidate work even if the field still points to the same path.

Keep `textFileViewLoadedFile` and its explanatory comment: it suppresses duplicate same-file TextFileView delivery, not obsolete async continuations. Coordinate with the loader's existing API/path checks rather than replacing them with one broad Boolean. Stale tasks may finish private computation and clean up their own resources, but must not clear flags/baselines belonging to the current generation. Do not serialize all loads behind a dying runtime.

If generation checks were required earlier by 5b, document exactly what is already covered and finish only the remaining boundaries here. Check main/popout replacement identity without violating early unmount.

**Tests:** slow A then fast B; A→B→A; repeated same-file `setViewData`; close during fonts/initialization/compression; migration during load; delayed asset callback from retired API; parse failure followed by valid load; physical-mobile rapid navigation. No stale task may dirty or clear the replacement drawing.

## 15. Original checkpoint 12 — remaining flags and timers

Inventory every remaining semaphore/timer by owner, acquisition, release, cancellation, callback target, and durability requirement. Use a table in the completion review. Retire one cohesive group per checkpoint; do not rename the entire object while behavior is changing.

- Save ownership belongs to its accepted coordinator; synchronization to its accepted acquisition/drain; content identities to the tested classifier; same-file editor ownership to its gate.
- Keep lifecycle state (closing/migrating/popout teardown), initial-load/autozoom state, and interaction throttles distinct. A single generic `isBusy` is a caller convenience, not an adequate owner model.
- Durability timers belong to the plugin/main realm; scene-file timers to `ViewSceneFileManager`; interaction timers may be view-owned. Never transfer IndexedDB/local-storage ownership to a popout.
- Clear timers/listeners idempotently, protect callback generation, and verify there is no wait cycle between save, sync, gate release, and unload. Use existing Obsidian registration helpers where appropriate.
- Path-scoping residual global embed invalidation and Canvas capability hardening remain lower-priority separate changes. Do not reopen the accepted image-render deduplication fix without new evidence.

**Tests:** main-window close/navigation, restored/new popout, dirty migration, last-popout destruction, mobile navigation, repeated enable/disable, no late callback after release, and the full first-edit/two-view convergence gate once cleanup finishes.

## 16. Required handoff record after each step

Update the ledger with: source commit or uncommitted scope; fixture/settings and installed artifact identity; exact automated commands/results; manual cases passed/failed/not run; new invariant and evidence; remaining uncertainties; next permitted action. Record rollback/stash identity if used. Keep private reproduction material outside committed docs unless the maintainer explicitly provides a public fixture.

No further production behavior change without either a deterministic failing case or a causal runtime trace. No proceeding to detached persistence while checkpoint 5 still requires another edit or forced save to settle. This is a sequence of independently reviewable experiments with acceptance gates, not authorization to implement all remaining checkpoints unattended.
