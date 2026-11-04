# Mermaid 3.1 integration: fork PR #478

The fork keeps Mermaid external; Extras bundles converter 3.1.0 and every lazy
Pele diagram module into one offline runtime. The unreleased Extras service
contract remains 3.0.0 as directed. No plugin production code, PDF printing,
package/API version or plugin dependency declaration changes.

Fork checkpoint: `d22f8ec1758a79fea6e106c9d1a80bf589d34f27`.
Extras checkpoint: `df1f2b5659259c43780c5ef07cd433fa6c3e14fa`.
Both portable and manual-native CI pin those exact sources.

**701 portable cases pass**, including seven new real-scene flowchart cases
and 13 new Extras production-browser cases. The existing native gateway now
converts twelve diagram kinds offline, asserting normalized geometry, editable
labels/image representation, image decoding and error recovery. It executes in
both focused Extras testing and the full native profile.

The additional real-Extras diagnostic passes **43 assertions across 13 kinds**,
including swimlane, EA insertion, selected-source main/popout previews, PNG
export and byte-preserving save/reopen. No notifications or unexpected errors;
cleanup/restoration pass. Its artifact matches the combined portable/full-native
candidate: main.js 5,031,203 bytes, SHA-256
`8854030e4242ab2f91488fde3eb058db6056f9f853f046ca48acb46dc54cafb8`.

Full native acceptance remains **349/357 passed, eight settling failures**.
All 258 behavioral obligations and 40 device profiles pass. The sustained exact
ResizeObserver notification loop starts during `native:lifecycle-new-popout-survivor`,
before Mermaid loads. A fresh renderer running rebuilt pre-merge fork/Extras
reproduces the same ordered-prefix failure. This establishes that the observed
failure predates #478, without assigning its cause. It is not suppressed or
reclassified as a passing full run; production observers, deadlines, exclusions
and negative controls are unchanged. Cleanup and baseline restoration pass.

From this checkout, with the documented one-time test-vault trust/CLI setup:

```powershell
npm.cmd run test:regression:portable
npm.cmd run test:native
npm.cmd run verify:obsidian -- --extras-services --diagnostics
```

Every native entry builds/deploys/hash-verifies the current selected workspace
revisions in `.test-work/vaults/excalidraw-auto-test/`, enables/configures both
plugins and restores baseline state. Never substitute a personal vault.

[Public review, repeatable additional dialog probe and limitations](https://github.com/zsviczian/excalidraw/blob/d22f8ec1758a79fea6e106c9d1a80bf589d34f27/dev-docs/Obsidian/pr-478-merge-review.md)
and [sanitized case results, artifact hashes and baseline comparison](https://github.com/zsviczian/excalidraw/blob/d22f8ec1758a79fea6e106c9d1a80bf589d34f27/dev-docs/Obsidian/pr-478-results.json)
retain the failed native gate separately from passing feature checks. The old
`review3022ProductionDiff.mjs` is scoped to #3022's approved patch, rather than
an allowlist for subsequent upstream feature merges.

Manual follow-up: complex saved Mermaid syntax/configuration and labels,
especially source editing/export in popouts and physical Android/iOS touch.
Native macOS/Linux, isolated cold application startup and physical devices
remain separate environments.
