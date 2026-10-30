# Lucide icon insertion (#3019)

Checkpoint: 2026-10-27; validation review and simplification: 2026-10-28.
The maintainer authorized committing, pushing and merging the paired source on
2026-10-28, with package publication and the dependency update deferred until
other changes accumulate. This is an intermediate source checkpoint. No package,
release version, dependency or lockfile is changed by this handoff.

## Source and release boundary

| Repository | Branch | HEAD before implementation |
| --- | --- | --- |
| Plugin | `2026-10-27-lucide-icon-picker` | `19e9a116fcfff75c3429840b42cfbca787590feb` |
| Component | `2026-10-27-lucide-icon-picker` | `02d5b607525da43eadaad72954d4fc644f3c157a` |
| CLI skill | existing `cli-image-efficiency` | `c1ccb89c294ba1048f4859a083eccf85859d2bd7` |

The component's Excalidraw host protocol is now **3**. Its only feature changes
are the shared image-menu entry and forwarding the initiating editor ID through
the typed host adapter. The plugin resolves that ID without storing a current
view in the shared runtime. Common-host protocol 1 is unchanged.

The four locally built component artifacts were copied into the plugin's ignored
installed package for integration testing. Package metadata still says
`@zsviczian/excalidraw` 0.18.145; these are **unpublished protocol-3 bytes**.
The runner's `installed-package` label describes its build input directory,
not published-tarball provenance. This pair is not a durable release handoff.
Publish the next component version, update the plugin's exact dependency and
lockfile, install it, then repeat production/contract/native verification.

The earlier #3018 CSS-specificity and translucent-use warning fixes remain in
this worktree. Their independent evidence is in
[SVG import validation](SVG_IMPORT_VALIDATION.md). They are not new Lucide APIs.

## Implemented behavior

- The command palette and shared image menu reveal one reusable sidepanel.
  Search uses the installed `getIconIds()` Lucide entries and `getIcon()`
  thumbnails, with at most 60 icon buttons mounted. Search and size are
  session-local; native buttons, arrow navigation and accessible labels share
  component-owned event cleanup. Controls disable for unavailable targets.
- UI insertion centers the nominal viewport in the intended drawing and uses
  its current stroke color, roughness and opacity. Presets 48/96/192 scale a
  standard two-unit source stroke to 4/8/16 scene units. Preparation sets the
  actual SVG viewport before curve sampling and preserves padding/aspect ratio.
- Every icon is editable native geometry with a fresh outer group, including
  single-element icons. Standard selection, history, persistence and export
  apply. No icon image, attachment or registry dependency is saved.
- Synchronous `ea.addLucideIcon(options)` appends only after full preparation
  and returns canonical `icon`, `groupId`, `elementIds`, warnings and nominal
  viewport. It needs no view and preserves unrelated workbench elements,
  images and EA style. Optional stroke width is in final scene units.
- Native `icons` discovery is read-only, bounded and revision-paginated.
  `create.icons` and `apply`'s `lucide` operation stage through the same EA
  constructor with deterministic defaults. `groupMap` has one-to-many handles;
  `idMap` retains single-element aliases. Alias conflicts, unsupported or
  incomplete conversions, and aggregate element/point limits fail before
  publication. Existing revision, identity, save and receipt semantics remain.
- EA declarations, API suggester, release notes, five maintained locales,
  embedded CLI guidance and the companion CLI skill/example are updated.
  The skill checks installed capability rather than inferring availability
  from this branch. General SVG import remains a separate workflow.

## Automated checks

| Check | Result |
| --- | --- |
| Node | 22.22.3 |
| Production plugin and public library builds | Pass |
| Canonical generated local-fork host declarations | Pass using `EXCALIDRAW_FORK_ROOT` |
| `npm run test:lucide` | 38 tests pass (31 CLI, seven constructor/EA) |
| `npm run test:svg-import` | 55 tests pass |
| `npm run test:bundle` | Four tests pass |
| `npm run test:obsidian:runner` | 11 tests pass |
| Focused new plugin module lint | Clean |
| Full `npm run code` | Retains 119 baseline errors; not a clean repository lint claim |
| Component artifact/declaration build | Pass |
| Component host tests | Seven current tests pass; filter also ran seven preserved baseline tests |
| Component full typecheck | Same four baseline test diagnostics: matcher, missing rawText, App fixture, tool query |
| Component focused lint | Zero errors, one inherited ImageMenu import-order warning |
| Component inventory | 15 checker tests pass; 237 reviewed paths and complete fingerprints match upstream `14bb42edee3d6fee6be264e3ee78670b3b9cee79` |
| CLI `npm run check` | 25 offline tests pass |
| CLI bundle from another working directory | Frontmatter, 31 relative links and Lucide JSON example pass |

The local-fork environment variable selects the generated declarations for the
prebuild contract test. Rollup itself still reads installed 0.18.145 declarations
and reports the expected old action-union mismatch after deriving the plugin
signature from the canonical contract. Both builds emit successfully; rebuilding
after that type-only change preserves the exact native-tested main.js hash.
A normal build without the local-fork override fails the intentional protocol-3
prebuild check until the matching published package is installed.

The Python skill validator could not import PyYAML; frontmatter was checked
with the plugin's existing Node `js-yaml` instead. `npm run madge` could not run
because the executable is absent. Hosted Obsidian CodeScanner was not available;
its review remains pending after the picker CSS additions.

## Native Windows acceptance

Final combined run: `%TEMP%/excalidraw-obsidian-uvQpEQ/report.json`, **passed**,
including the JavaScript-error gate and owned-fixture cleanup. Vault:
`C:/Obsidian/excalidraw-test`; Obsidian 1.14.5 (installer 1.14.0), console launcher
`C:/Program Files/Obsidian/Obsidian.com`. Test assets were supplied by the
maintainer under `TestAssets` and retained unchanged.

```powershell
$env:EXCALIDRAW_TEST_VAULT_NAME='excalidraw-test'
$env:EXCALIDRAW_TEST_VAULT_PATH='C:/Obsidian/excalidraw-test'
$env:EXCALIDRAW_TEST_CONFIG_DIR='C:/Obsidian/excalidraw-test/.obsidian'
$env:EXCALIDRAW_FORK_ROOT='C:/Users/viczi/GitHub/excalidraw'
npm run verify:obsidian:plugin -- --lucide --svg-import --native-cli
```

Lucide checks cover discovery pages, exact create/collision refusal, idempotent
replay, atomic invalid batches, alias conflicts, native grouping/no assets,
explicit stroke width, stale apply refusal, saved apply/read-back and SVG/PNG
export. All 1,935 installed names were attempted at three presets: **5,802
successful constructions**, 23,226 native members and 387,415 sampled points
across separate workbench calls. One installed SVG, `lucide-save-off`, extends
outside its viewBox and is deliberately refused at all three sizes with a
viewport error. A registered name does not promise lossless conversion.

UI checks pass for actual image-menu dispatch, singleton reuse, bounded/empty
search, keyboard navigation, three presets/current styles, selected grouping,
single Undo/Redo, two drawings, scoped fresh-popout insertion, deferred stale
target refusal and close/reopen session state. The stale-target test deliberately
produces the localized refusal notice visible in `lucide-picker.png`.
`lucide-presets.png` was visually inspected: database/brain/ellipsis at all three
sizes retain curves, round dots, color and expected initial stroke widths.

An early probe loaded the drawing immediately after `openPopoutLeaf()`, before
Obsidian moved the initially empty leaf. It timed out with a retiring view marked
closing/migrating, which the picker correctly disabled. The final probe waits
for the empty leaf's destination document before starting the drawing load.
No general migration fix or duplicate-view migration acceptance is claimed.

The same run also passes the SVG corpus (1,992 registered icons, five unchanged
supplied files, 19 cases on five backgrounds), main/popout editing/history,
copy/export/save/reopen and plugin reload. Existing native CLI authoring,
bindings/frames, template prose, receipt and failed-save recovery checks pass.
Those regression checks do not establish physical touch behavior.

## Tested artifact identity (2026-10-27)

Production `main.js`: **5,028,698 bytes**, leaving 214,182 bytes below 5 MiB.
Installed test-vault files match built files exactly.

| Artifact | SHA-256 |
| --- | --- |
| Plugin main.js | `34a0b15cd98d4c7875ca24bf0215934ac4691ad77b51a1defd2833e292d459c5` |
| Plugin styles.css | `0510f43d1ba875a1a68aa91424d21c00298aa09e4003702dbb8b0702403b28f2` |
| Plugin manifest.json | `4880b885c50643ef848d31cea829776ca2e96747353aee334d71e875f79d31c0` |
| Component production JS | `a63ddd897a1c461042e0fb52c689b216aa166aa8e3dab6717ba02ef2e1c533f0` |
| Component development JS | `35b2ad0a4b4a3c21a4a7ab746570b4f9fa31a3eecadfedc372fc5f2ffe24a24c` |
| Component production CSS | `0337e307594435b5125d216c9570aad9b5d4460908f3f0e716baf1daa87ac002` |
| Component development CSS | `192fb4463825f0b870d9f59862f6ae54056e591226546608958fe9e3c937b883` |

## Validation review (2026-10-28)

Reviewed constructor atomicity, scaling/style semantics, EA workbench ownership,
CLI aliases/budgets/receipts, host lifetime/protocol, sidepanel focus/migration,
listener cleanup, and the accompanying API/skill references. No further feature
correctness defects were found. The existing target, publication and persistence
guards remain necessary; the prior native popout evidence does not justify
removing them.

Simplified the grid to one component-owned delegated click listener. Search and
paging now replace only DOM/buttons; they no longer create a page Component and
60 individual listeners. Removed the unused component field and repeated
writability evaluation. CLI alias checking now uses the supplied array directly
instead of allocating a Set for each icon. The documentation generator's optional
template sync now has one shared conditional after the full-mode output branch.
No fork source or companion skill behavior changed during this review.

Revalidation passes: 38 CLI/EA tests, 55 SVG tests, four bundle tests, 25 CLI-bundle
tests, focused plugin lint, production/library output and local generated-fork
host contracts. Generator/host-probe syntax checks pass. Native Windows report
`%TEMP%/excalidraw-obsidian-enKChi/report.json` passes Lucide plus existing native
CLI authoring, the JavaScript-error gate and fixture cleanup. It additionally
checks next/previous pages and clicks on nested SVG paths and text labels after
search/page replacement. History, main/fresh-popout insertion and stale-target
refusal still pass. Catalog results remain 5,802 successes and the three expected
save-off viewport refusals. The SVG native corpus was not rerun in this review;
its earlier combined acceptance above remains the recorded evidence.

Current production main.js is **5,028,518 bytes** (180 fewer than the prior
checkpoint, 214,362 bytes below 5 MiB), SHA-256
`b9a471eeea1f0f81d158fa0cc68032447cbe73b6a6f1a0fef131dbc026db9cb0`.
The native-installed files match the built artifacts. CSS, manifest and the four
component artifacts retain the hashes above.

**Published-package release dependency:** running the host contract against the declared
installed 0.18.145 declarations still fails: protocol 3 is not assignable to
protocol 2, and its action union lacks Lucide. The same contract passes with the
generated paired-fork declarations. A fresh installation of the declared package
therefore cannot build/run this plugin change as shipped. The maintainer has
explicitly approved merging this intermediate source state and will publish the
fork and advance the dependency later. Publish the fork's protocol-3 package,
install it as the plugin's exact dependency/lockfile and repeat the normal
build/native gate before releasing the plugin. No
fallback or type suppression was added to conceal this mismatch. Existing full
lint/typecheck and platform/CodeScanner limitations above remain unchanged.

## Authorized intermediate merge (2026-10-28)

The maintainer explicitly approved committing, pushing and merging the paired
fork/plugin source while retaining the current versions and dependency. The
fork publication and plugin dependency/lockfile update will be handled later
after other changes accumulate. This approval supersedes the earlier review's
merge restriction; it does not make the currently published package compatible.
Companion source: [Excalidraw fork PR #476](https://github.com/zsviczian/excalidraw/pull/476),
commit `f54ec6061739009267bce4f4f5320ab167843932`.

The fork's required precommit snapshot-update run completed: 81 suites pass and
81 fail; 1,242 tests pass, 1,477 fail, 47 are skipped and one is todo, with three
unhandled errors. The changed host suite passes all seven tests. The broad run
includes the previously recorded harness/host failures and a five-second public
root import timeout; no clean broad-suite result is claimed. All 16 generated
snapshot/inline-test file changes were restored to their exact pre-run bytes.
Full typecheck retains the same four baseline diagnostics. The generated
paired-fork plugin host contract still passes. Test-only generated changes and
runtime build artifacts are excluded from the source commits.
The export file passes all ten tests with a 30-second test timeout; its public
root import takes 5.64 seconds, exceeding the unchanged five-second default.

## Remaining manual and release gates

Highest-probability risk: focus/target ownership during drawing switches and
window migration. Repeat command/menu insertion, tab switching, saving, closing
and reopening in main and restored popouts after cold application restart.
Check dense icons and resize/recolor/rotate on physical mobile, including native
touch and scrolling. Repeat on macOS/Linux; the clean Windows error gate does
not resolve the historical macOS ResizeObserver notification. Complete hosted
CodeScanner review and repeat verification against the published paired package
before release. Group resizing intentionally retains normal Excalidraw stroke
behavior; this feature does not introduce proportional stroke resizing.
