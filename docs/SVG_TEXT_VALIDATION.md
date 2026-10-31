# Editable SVG and Mermaid labels

The supplied mindmap stores its ten labels in XHTML inside SVG
`foreignObject` nodes. Its SVG `text` nodes are empty placeholders except for
the footer. The previous converter deliberately omitted both forms of text.

`ea.importSVG()` now stages SVG `text`/positioned `tspan` content and plain
HTML labels as editable native text, using EA's existing font measurements.
Colors, opacity, basic alignment, ancestor groups and ordinary transforms are
retained. Text uses the same short, block-reference-safe IDs as EA-created text;
this avoids ID replacement during Markdown persistence. The real save/reopen
test caught the original long-ID mismatch before this checkpoint.

This is plain-text extraction from inert XML. Source HTML is never attached to
the document, and scripts, handlers, images and remote resources never execute
or load. Character, line, traversal, element and coordinate limits remain
bounded; a fatal error leaves the workbench unchanged.

Available fonts replace arbitrary source fonts. Rich inline styling, exact
glyph baselines, wrapping, text-on-path, skew/nonuniform scaling and complex
HTML layout can differ and produce a localized text-approximation notice.
Images/effects are still limited by the converter's
[support matrix](../src/shared/svgToExcalidraw/readme.md). Shape bindings and
Mermaid's semantic graph are not reconstructed. Keep the SVG image when exact
appearance matters more than editing.

## Verified checkpoint — 2026-10-31

The final native build uses plugin `0c994859ed8b8aa0c5a80c111815a5b8413ece5b`,
fork `745d62f7071be4da192f595bb75e140a7b741fc0` and Extras
`df1f2b5659259c43780c5ef07cd433fa6c3e14fa`, all clean at build time.
[Sanitized cases, source identities and artifact manifests](testing-evidence/svg-text/results.json)
record the exact build and assertions without publishing the supplied SVG or
its rendered image.

- **69 focused SVG tests** and **518 full fast tests** pass. The fast total
  includes 11 new text tests; the measured whole-module subset passes 85 tests
  and its existing coverage ratchets. CLI wrapper checks separately pass 25.
- **10 focused native cases** pass: two new text workflows plus eight reused
  paint/real-Extras workflows, with expected editable-label assertions added to
  the Mermaid conversions. No full-matrix acceptance credit is inferred.
- The supplied mindmap yields 41 native elements, including all ten labels
  and its footer as 11 editable text elements. A text-only export contains
  5,607 visible glyph pixels. Editing, acknowledged saving, exact IDs/text after
  reopen, popout loading/export, cleanup, settling and baseline restoration pass.
  The source hash is unchanged. Visual inspection confirms the labels render.
- Production/library builds, five packaging checks, inventory and feature
  mappings pass. All 18 touched TypeScript files lint clean. Whole-repository
  lint still reports the same 118 unrelated errors; it is not a passing gate.
- No captured console/JavaScript errors or browser notifications occurred.
  `main.js` is 5,033,282 bytes, leaving 209,598 bytes below the 5 MiB target.
  Its deployed hash matches
  `bf05168f57e66718452b010e770d57722ff11135584de17877dcdf8b90d6f004`.

No version, dependency, fork, Extras or PDF production changes are included.
This build was installed in the prepared test vault; the personal-vault build
is not updated by these checks.

## Repeatable checks

Use Node 22+ from the plugin checkout. Native runs use only
`.test-work/vaults/excalidraw-auto-test/`, following the one-time trust/CLI
prerequisites in [the runtime guide](OBSIDIAN_RUNTIME_TESTING.md). Each sequence
builds and hash-verifies the selected workspace fork/plugin/Extras, installs
them, applies baseline settings, and restores the baseline after cleanup.

```powershell
npm.cmd run test:svg-import
npm.cmd run build
npm.cmd run test:fast
npm.cmd run test:source-coverage
npm.cmd run lib
npm.cmd run test:bundle
npm.cmd run test:inventory
npm.cmd run test:features
npm.cmd run verify:obsidian:plugin -- --svg-paint --svg-text
```

The text probe defaults to a tracked, self-authored fixture embedded in its
source. To test a particular SVG, set `EXCALIDRAW_SVG_TEXT_FIXTURE` to its absolute
path before the last command. The file is read-only and hashed before/after;
generated images and private diagnostics stay in the ignored report directory.

The focused native cases assert real Extras-generated SVG conversions, all
expected editable labels, measured text geometry, visible glyph pixels in a
text-only export, editing, acknowledged save, exact IDs/text after reopen,
popout loading/export, settling and cleanup. Visual inspection is recorded
separately from automated assertions. These checks do not replace the complete
357-case acceptance profile or physical-mobile/macOS/Linux validation.
