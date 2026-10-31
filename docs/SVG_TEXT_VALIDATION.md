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
