# SVG import validation — #3018

## Original macOS checkpoint

Measured on macOS on 2026-10-27, Node 22.22.2, Obsidian CLI/app
1.15.0 (installer 1.14.0), plugin manifest 2.29.0. The old converter is pinned
to `5e4c83f6370f93d3f794ef7afb9545a6b6208c11`. The guarded runner builds that
source into its owned report directory; both versions pass through the same EA
workbench staging before comparison. Browser rendering of the original SVG is
the independent appearance reference. No external asset request is needed.

The component dependency remains 0.18.144. Integration used the previously
authorized, locally copied unpublished fork artifacts; this change introduces
no fork API dependency or fork source modification. Exact artifact SHA-256:

| Component artifact | SHA-256 |
| --- | --- |
| `excalidraw.production.min.js` | `6b9188c0a3ca14dbe5b57f040892f534ec73b89f18503c79bcd303a48ff99248` |
| `excalidraw.production.min.css` | `0337e307594435b5125d216c9570aad9b5d4460908f3f0e716baf1daa87ac002` |
| `excalidraw.development.js` | `517ae39d2ed6758a41658ad40e58e9e843fc7d5c11ec170a342fae2b1d0768fb` |
| `excalidraw.development.css` | `192fb4463825f0b870d9f59862f6ae54056e591226546608958fe9e3c937b883` |

## Corpus and appearance

The local `excalidraw-test/TestAssets` corpus contains five SVGs, not a Git
checkout. Before/after SHA-256 checks confirm the originals are unchanged.
Third-party sample contents and generated previews are not committed.

| Sample | SHA-256 |
| --- | --- |
| `startup.svg` | `08ab5ad1a4ca5b325e1ffae7094abfc9920b7fb30c3e7fcbedb771f617f6dfbe` |
| `project.svg` | `8e4c5cf9c2b902b94072612c686a237e2666a29c441a2997124266dc23443cd0` |
| `rocket.svg` | `fc366fdeec6a151603736fc2c8cf0e2684c4679e219fda0bd8fe406e4bc56b62` |
| `noun_Rocket_8415980.svg` | `c716bf9a1c47e5ec5a2a805953dbb761b1c8a58fd2b2fc2cc2f20df3da7c0057` |
| `Icon - brain - Flaticon.svg` | `438f371bea62da56b374ba263843e698f344e924d48cdc84d081eb9c83029838` |

Actual installed `getIconIds()`/`getIcon()` yielded **1,982** registered SVGs:
**1,935** `lucide-` IDs and **47** other registered IDs/aliases. All now convert
successfully to nonempty native elements. Before changes, five returned empty
output despite reporting success: `lucide-equal`, `lucide-equal-not`,
`lucide-frame`, `lucide-hash`, `lucide-italic`. No fixed catalog count is encoded
in the tests. An owned temporary plugin exposes Obsidian's real exports to the
probe and is unloaded/deleted afterward; no catalog is added to product code.

Nineteen representative cases (seven actual Lucide icons, five supplied files,
seven self-authored fixtures) each compare source/old/new on transparent, white,
dark, green and checker backgrounds: **95 comparisons**. Roughness is zero for
appearance measurement. Numbers below are mean normalized RGBA channel error
on the checker background, lower is better; they are not perceptual scores or
claims of exact raster equality.

| Fixture | Old error | New error | Classification |
| --- | ---: | ---: | --- |
| `startup.svg` | 0.103985 | 0.000355 | Improved |
| `project.svg` | 0.224040 | 0.000380 | Improved |
| `rocket.svg` | 0.166479 | 0.000182 | Improved; real transparent hole |
| `Icon - brain - Flaticon.svg` | 0.178850 | 0.000496 | Improved |
| `noun_Rocket_8415980.svg` | 0.066359 | 0.004445 | Improved geometry; unsupported copyright text omitted with notice |
| Seven selected Lucide icons | 0.041081–0.190394 | 0.000150–0.000946 | Improved; lines, curves, primitive and previously empty cases |
| Known-good translated rectangle | 0 | 0 | Unchanged |
| Known-good mixed primitives | 0.026707 | 0.000338 | Improved; existing triangle defect corrected |
| Transparent compound hole | 0.092525 | 0.000690 | Improved; underlying checker visible |
| Even-odd overlapping contours | 0.054331 | 0 | Improved |
| Inherited lines | 0.034490 | 0.000696 | Improved |
| Independent opacity | 0.163733 | 0 | Improved |
| Overlapping group opacity | 0.115591 | 0.014953 | Explicit native compositing approximation; not a fidelity pass |

The representable cases stay below 0.01 mean error on every tested background.
The copyright-text and group-compositing cases are explicitly excluded from that
acceptance threshold. Source/old/new rocket, transparent-hole and colored-brain
previews were also inspected visually. This finite corpus does not establish
full SVG compatibility; see the [support matrix](../src/shared/svgToExcalidraw/readme.md).

## Geometry and cost

One sequential native run measured the following. API time includes parsing,
conversion and EA staging; export time measures native SVG construction only.
These are single-run observations, not stable benchmarks or actual paint latency.
Serialized bytes count native element JSON, without scene/file wrappers.

| Fixture | Elements old → new | Points old → new | JSON bytes old → new | API ms old → new | SVG export ms old → new |
| --- | ---: | ---: | ---: | ---: | ---: |
| `startup.svg` | 41 → 35 | 1,491 → 1,503 | 80,054 → 77,919 | 61.8 → 34.2 | 48.9 → 33.9 |
| `project.svg` | 32 → 32 | 1,380 → 1,728 | 69,426 → 83,789 | 10.1 → 16.1 | 21.3 → 17.7 |
| `rocket.svg` | 5 → 4 | 108 → 435 | 6,912 → 19,734 | 1.3 → 16.8 | 2.1 → 6.1 |
| `noun_Rocket_8415980.svg` | 11 → 10 | 330 → 559 | 18,809 → 27,751 | 7.1 → 20.0 | 5.5 → 9.7 |
| `Icon - brain - Flaticon.svg` | 66 → 65 | 2,367 → 5,723 | 122,810 → 250,725 | 32.4 → 113.2 | 51.9 → 109.1 |

Fidelity has a real cost for curved files. Correct viewport scaling and adaptive
scene-space accuracy preserve details the old sampling lost. Dense straight
outlines retain their vertices without an element per segment; a sweep and
containment path avoid unnecessary all-pairs face work. Regression tests cover
a 6,000-point simple outline and 4,400-point compound outline in both fill rules.
No indiscriminate point deletion is used to manufacture smaller output.

Representative cold bounds-query time for the colored brain grew from 21.4 to
46.3 ms; 100 subsequent bounds calls were 2.9 ms for each version. For project,
cold bounds were 6.2 → 4.6 ms and 100 warm calls 0.4 → 0.3 ms. For rocket they
were 0.2 → 1.6 ms and 0.2 → below timer resolution. Both versions use the same
staging/version path. These queries do not measure drag responsiveness or paint.
Large repeated complex imports and physical transforms remain review priorities.

## Editor and compatibility checks

`npm run test:svg-import`: **51 passed**, including the actual converter,
independent winding-grid comparisons, malformed/resource limits, style and
coordinate behavior, and extracted real importer/API boundary methods. Minimal
old-converter reproductions failed for opacity, open strokes and white holes
before fixes. The dense-outline regression also failed before its topology
optimization. Inherited image-geometry tests (32), drop tests (147) and runner
tests (11) pass. Production/library builds and four packaging checks pass.
Focused converter/dialog lint is clean; full lint has 119 errors versus 120 at
baseline. `npm run madge` is unavailable because its binary is not installed;
it is not recorded as passing.
The converter reuses the already installed path parser as an explicit runtime
dependency. Offline tests declare patched `@xmldom/xmldom` 0.9.12 directly;
that XML implementation is not included in the plugin runtime.

The native feature scenario passes in both main and popout windows:

- Actual command/dialog and EA insertion, synchronous append, untouched
  unrelated workbench contents, and atomic failure on malformed input.
- Native grouping/ungrouping, scripted color/roughness changes, duplication,
  resizing and rotation; native public history Undo/Redo actions.
- Actual clipboard event to another disposable drawing, SVG/PNG export, save
  and close/reopen with unchanged geometry/styles/groups.
- Ordinary SVG-as-image insertion, plus a plugin disable/enable and reopening
  converted native elements without regeneration.
- Before/after original asset hashes and owned fixture/controller cleanup.

These are scripted native checks, not physical pointer/touch gesture tests.
Windows/Linux, cold application restart, restored popouts, physical mobile and
offline/disconnected-device execution remain separate coverage. Product
conversion itself makes no network requests and uses no desktop-only API.

## Unresolved runtime notification

The full native run's SVG assertions and cleanup pass, but its **strict
JavaScript-error gate fails** on repeated `ResizeObserver loop completed with
undelivered notifications.` events. This notification was observed in earlier
work, including blank-popout teardown. Its responsible observer has not been
identified; it must not be labeled harmless, test-only, or definitively a plugin
bug. The test runner preserves it and does not filter it out. Passing SVG
assertions do not establish the cause or absence of a lifecycle/layout problem.

The browser emits this event when resize observations remain undelivered after
its loop-protection processing, deferring pending observations to another
rendering cycle. See the [Resize Observer processing model](https://www.w3.org/TR/resize-observer/#deliver-resize-loop-error).
Attribution requires tracing the responsible observer/layout writes separately;
there is no related runtime suppression or ResizeObserver change in #3018.

Local evidence: guarded report `excalidraw-obsidian-E2gEVq/report.json` and its
`svg-corpus.json`/PNG companions in the host temporary directory. The report
records exact built/installed hashes: `main.js` SHA-256
`8dbb8b9b29a08a1f241b2a81742510be5d7ea9c7e9a646b5719bd2d65e76682e`,
5,006,500 bytes, 236,380 bytes below the 5 MiB release target. Reports/previews
are local evidence, not files shipped in the plugin.
The finalized corpus-lookup/test-dependency run (`excalidraw-obsidian-icsGTc`)
repeated all feature and cleanup passes with identical installed artifact hashes;
its strict error gate again failed on the same unattributed notification.

## Windows follow-up — 2026-10-27

Rechecked merged PR #3018 at `9e52063296ffcd3b38d6a2bd5b23546d7e6268f7`
with the local follow-up changes: CSS specificity now compares ID/class/type
counts lexicographically, and translucent `<use>` instances diagnose the existing
compositing approximation when expansion emits multiple pieces. Direct/nested
reuse, opaque/single-piece controls, repeated classes/types, universal selectors
and source-order ties have regression coverage. Both reported reproductions
failed before their respective fixes; all **55** converter/importer tests pass.

`npm run build`, four bundle tests and focused ESLint pass. Full `npm run code`
retains exactly the same **119** baseline errors; Rollup's circular-dependency
warnings are unchanged. No public EA signature, locale key, CSS or fork API changed.

`npm run verify:obsidian:plugin -- --svg-import` passed on Windows, Node 22.22.3,
Obsidian **1.14.5 (installer 1.14.0)**, using only the dedicated `excalidraw-test`
vault. The plugin manifest remains 2.29.0; these changes target the upcoming
2.29.1 release without a version bump. The installed-package lane identified
component **0.18.145** and the following actual bytes. This run did not reinstall
the component or establish published-tarball provenance for locally installed
artifacts; the preceding Mermaid integration used local artifact copying.

| Component artifact | SHA-256 |
| --- | --- |
| `excalidraw.production.min.js` | `dd9fca04252b4f1b74dc8c293fc77d0960af6d0461cb2d4092adbdc62a4ab00a` |
| `excalidraw.production.min.css` | `0337e307594435b5125d216c9570aad9b5d4460908f3f0e716baf1daa87ac002` |
| `excalidraw.development.js` | `392dd6954b105f25675d210d7470e3a83d035299481050489f8da28296ad5ffc` |
| `excalidraw.development.css` | `192fb4463825f0b870d9f59862f6ae54056e591226546608958fe9e3c937b883` |

All **1,992/1,992** registered icons converted to nonempty native output,
including **1,935** Lucide-prefixed IDs. The five supplied SVGs have the same
before/after hashes listed above. Nineteen representative cases across five
backgrounds produced **95** source/baseline/current comparisons; unsupported
copyright text and group compositing retain their documented fidelity exclusions.
The generated source/current checkerboard PNGs for the colored brain and project
rocket were also visually inspected. Catalog conversion is not visual
certification of every icon.

Main-window and fresh-popout command/EA import, append/failure isolation,
grouping, scripted edits/duplicate/resize/rotate, native Undo/Redo, cross-drawing
clipboard, SVG-as-image, SVG/PNG export and save/reopen passed. Plugin reload,
the strict JavaScript-error gate and fixture/controller cleanup also passed.
This clean Windows run does not identify or resolve the historical macOS
ResizeObserver notification.

Local evidence: `excalidraw-obsidian-PlL0Xr/report.json`, `svg-corpus.json` and
PNG companions in the host temporary directory. Built and deployed hashes match:

| Plugin artifact | SHA-256 |
| --- | --- |
| `main.js` | `f1cd74d06fd9a5e977ca2961f0bca6921a1c70d2d95494b305d8ff448d2e97e1` |
| `styles.css` | `cabd7e32c71e41dca2cbaff8bb7f4f06b27417901da143d88608d4c7175a8284` |
| `manifest.json` | `4880b885c50643ef848d31cea829776ca2e96747353aee334d71e875f79d31c0` |

`main.js` is **5,012,500 bytes**, leaving **230,380 bytes** below the 5 MiB target.
The companion CLI skill/reference update stays on `cli-image-efficiency`;
its 25 offline tests and frontmatter/relative-link checks pass. These are not
live acceptance of a trusted SVG script through the companion bundle.

Priority remaining checks: repeat the new specificity/use-opacity examples in
main/restored popouts; assess dense SVG editing on physical mobile; rerun against
published component bytes before release. Cold restart, Linux and physical touch
remain separate environments. Existing representation limits remain unchanged.
