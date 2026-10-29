# Testing checkpoint: acceptance remains incomplete

Tested product checkpoint: plugin `3fc7cc9caf89bb4ca8361c004109ac59528fce1e`,
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

**Zero of the two required complete native repeats have passed.** Phone and
tablet functional assertions execute, but their strict error gate reproduces an
isolated mobile embedding exception. The proposed internal-node `focus: false`
fix awaits explicit maintainer approval. Production remains unchanged for that
finding. See [F17 and its minimal command](../../TESTING_FINDINGS_3022.md#f17---mobile-embedding-exception-production-approval-pending).

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
