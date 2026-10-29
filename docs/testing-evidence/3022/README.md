# Testing checkpoint: acceptance remains incomplete

Latest acceptance attempt: plugin `9c08d814`, fork `053a3b9`, Extras `1cdcb7c`.
Fresh portable validation passes 654 cases and source/package gates. Exclusive
unchanged text/pointer reruns pass. The subsequent full run passes all 258
behavioral cases and all 40 device/layout cases, but stability cycle 3 times out;
cycles 4/5 and the passing JavaScript-error gate are missing. Eight illegal-access
exceptions and one host onDelete exception remain failures. Cleanup/restoration
and both actual negative controls pass. **Zero of two complete repeats pass.**

[Sanitized failed acceptance, complete available cases and artifact manifests](acceptance-failed-9c08d814.json)
retains the evidence. The test-only file-delete/detach cleanup race has a
deterministic regression and correction; the initial load timeout and illegal
access still require focused diagnosis. No production fix, exclusion expansion,
or blind full-run retry is applied. A new clean checkpoint is required for both
full repeats after test-tooling corrections. Historical checkpoints follow.

Latest tested product: plugin `38bf80fbf42fe75784e31d9763fab35a3196b35c`,
fork `053a3b9f9e77917c457fce8ca9453d38b92a303b`, Extras
`1cdcb7c425a9b80afdc7b39c88861143b4b85e58`.

[Focus-correction summary and complete artifact hashes](focus-correction-summary.json)
records the approved `focus: false` change, four passing actual-method regressions
and the successful isolated phone embedding/device profile. Actual mobile mode,
390 x 844 geometry, rendered/exported pixels, save/reopen and restoration pass;
no window errors are recorded. Existing `patchMobileView` calls are unchanged.
The installed plugin main is 5,030,423 bytes, SHA-256
`cdc284000720118563ddfddcd482b8b9ade49be354619584e06fc3e4cf1cd6df`.

Fresh portable validation passes **654 canonical cases (56 new / 598 reused)**:
476 plugin fast, 127 fork source, 18 fork browser, 29 Extras source and four Extras
browser cases. Source-coverage and packed-consumer gates pass separately.
[Hosted Plugin tests](https://github.com/zsviczian/obsidian-excalidraw-plugin/actions/runs/40914623771)
and [CodeQL](https://github.com/zsviczian/obsidian-excalidraw-plugin/actions/runs/40914623903)
pass at this source checkpoint. The exact production audit passes the PDF rollback,
approved plain-PDF/font/internal-preview-focus corrections and release notes.

**Zero of the two required complete native repeats have passed.** A full attempt
was interrupted for the maintainer's foreground PC use after all 172 desktop
behavior cases passed. Its keyboard/pointer failures remain recorded and require
an unchanged rerun with exclusive access; focus interference is plausible, not
proven. The task settled and the test vault's device/layout/settings baseline was
restored with both plugins ready and no tasks, print roots or popouts. Native
input is paused until the maintainer frees the machine. No partial run is counted.
See [F17 and the interruption findings](../../TESTING_FINDINGS_3022.md#f17---mobile-embedding-exception-approved-focus-correction).

The earlier independent-core product checkpoint was plugin `3fc7cc9caf89bb4ca8361c004109ac59528fce1e`,
fork `053a3b9f9e77917c457fce8ca9453d38b92a303b`, Extras
`1cdcb7c425a9b80afdc7b39c88861143b4b85e58`.

- [Sanitized native summary and case results](checkpoint-native-summary.json): all
  **59 required independent core cases**, **15 popout drop variants** included,
  plus one focused nested-pane interaction case pass. These 60 cases comprise
  **16 new and 44 reused identities**. Both native negative controls pass.
- [Three-repository artifact/source manifests](checkpoint-artifact-manifests.json):
  exact revisions, clean source identities, build commands, toolchains, bytes and
  hashes. The native coordinator built, installed and hash-verified these builds
  in `.test-work/vaults/excalidraw-auto-test/`.
- Fresh local portable verification passes **650 canonical cases**: **52 new,
  598 reused**. Source/package gates pass separately. An earlier matching-product
  [hosted portable run and downloadable reports](https://github.com/zsviczian/obsidian-excalidraw-plugin/actions/runs/40887221793)
  also pass. Historical timeout/lock test identities were removed/replaced as
  required by the PDF rollback; they are listed in the summary.
- The core run records **zero notifications and unexpected exceptions**, passed
  cleanup and restored baseline. The native exception and deliberately broken
  geometry controls prove that unrelated failures still fail.
- A real plugin-to-Extras PDF export passes: one 288 x 216 pt page, preserved
  text, 3330 red pixels, 10,616 bytes. Its decoded page was visually inspected.
  PDF SHA-256: `536b8e864e3c4e1c41e52faa9c0eb25fdf18cac5633bf6c45803db287c0888b8`.

That older core checkpoint predates the approved internal-node focus correction;
its phone/tablet error was subsequently reproduced and resolved in the focused
evidence above. It remains historical evidence, not a complete native repeat.

These are checkpoint summaries, not a replacement for the full 357-case profile
or its two matching-build repeats. The final evidence exporter refuses incomplete
acceptance. Native CLI-bearing cases in the full plan are six: four desktop
behavioral editing cases, native CLI authoring, and Lucide catalogue/authoring.
Two phone/tablet protocol workflows use public `EA.executeCLI` separately.

Use the [repeatable setup and execution commands](../../OBSIDIAN_RUNTIME_TESTING.md).
The seed has 22 tracked content/configuration files, including a declared workspace
layout. Plugin executables, raw reports and generated PDF/PNG files remain ignored.
Public summaries contain sanitized paths and synthetic fixtures only.

Physical mobile, native touch/WebView/stylus behavior, actual OS drag transports,
other native desktop operating systems and isolated whole-application cold start
remain separate environments; desktop emulation does not establish those claims.
