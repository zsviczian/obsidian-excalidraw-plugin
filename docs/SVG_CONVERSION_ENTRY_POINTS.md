# SVG conversion entry points

The image menu offers **Import SVG as Excalidraw**, opening the system file
picker with an SVG filter. The selected file is read directly and converted
to grouped native geometry and editable text in one operation. It does not
first copy an SVG image into the vault or scene. Cancelling leaves the drawing
unchanged. The existing separate vault-import command remains available.

When Mermaid output is an SVG image, **Insert** offers
**Convert to elements**, **Keep SVG image** and **Cancel**. Keeping the image
preserves its Mermaid source; cancellation inserts nothing and retains the
last source in the existing dialog storage. Native Mermaid diagrams and
programmatic `ea.addMermaid()` retain their existing behavior without a prompt.

Right-click an SVG image in the drawing and select **Convert SVG to editable
elements**. Generated Mermaid SVGs use their embedded scene data; no vault SVG
file is required. Conversion replaces only that image, retaining its viewport,
rotation, opacity, outer groups, frame, link and scene layer. One undo restores
the original image, and shared SVG bytes remain available to other images.
Locked images and drawing embeds retain their existing workflows. Reset a
crop first: native geometry cannot retain image clipping.

The converter's [font/layout/effect limitations](../src/shared/svgToExcalidraw/readme.md)
still apply, including approximations for reflected text and nonuniform text
scaling. Source SVGs remain inert and local. Invalid/excessive source, invalid
image geometry, empty conversion and changed editor/file/document identities
cannot publish a partial replacement.
SVG-local CSS custom properties and nested `var()` fallbacks are resolved,
including inheritance, case-sensitive names, local overrides and cycles.
Obsidian's theme is never consulted. The supplied Mermaid mindmap now retains
its four series colors, translucent fills, light root fill and 13 editable
labels. Missing variables without a fallback use inherited/initial presentation
and produce a CSS warning. Advanced selectors, geometric CSS, font shorthands
and complex effects remain limited; this is not a full browser CSS engine.
Variables are bounded to 1,024 names per element, 32 references/fallback levels,
8,192 characters per expanded value and the existing conversion work budget.
Placement uses the converter's initial matrix rather than adding SVG wrappers.
A regression checks that `svg { opacity: .5 }` applies once and that `g rect`
does not start matching a root rectangle; the original wrapper implementation
failed with blue/15% instead of red/30%. Both source and real-pixel native checks
retain this assertion.

## Integration and repeatable validation

The plugin owns conversion, prompts, target guards, scene replacement, saving
and cleanup. The fork changes four production files: the shared image menu,
typed host adapter contract, fork-owned dispatch helper and a fingerprinted
TTD pre-insertion hook. This requires paired host protocol 4; Extras and its
service API are unchanged. Release/package/dependency versions are unchanged.
Local matching artifacts/declarations prove integration only; publish/install
the matching fork package before a durable release handoff.

From the plugin checkout, using Node 22+ and the existing vault trust/CLI
prerequisites in [the runtime guide](OBSIDIAN_RUNTIME_TESTING.md):

```powershell
npm.cmd run test:svg-import
npm.cmd run test:fast
npm.cmd run test:source-coverage
npm.cmd run lib
npm.cmd run test:bundle
npm.cmd run test:inventory
npm.cmd run test:features
npm.cmd run verify:obsidian:plugin -- --svg-paint --svg-text --svg-entry-points
```

The native command automatically builds the selected workspace fork/plugin/Extras,
deploys and hash-checks them, applies the declared configuration and tests only
`.test-work/vaults/excalidraw-auto-test/`. It restores the baseline and leaves
installed builds available. New UI cases use trusted CDP input and the existing
owned main/popout test environment, exception capture and bounded stable-idle
checks. They assert actual scene state, decoded pixels, undo/redo and physical
save/reopen; screenshots and menu registration alone do not count as behavior.

The initial run passed main-window import and all three Mermaid choices, then
stopped on an obsolete `scrollToContent` call in test setup. The test now uses
the supported `zoomToFit`, with every behavioral assertion retained. The next
run passed all ten new cases across main and popout. A later combined run found
a replaced context-menu button retained by the test. The helper now reacquires
that menu target while preserving the visible/uncovered hit test; three
regressions prove detached, covered and missing controls still fail. Failed
evidence remains in ignored reports, including `svg-entry-native-css-final`.

Final combined validation passes **20 native cases**: ten new main/popout UI
cases and ten reused converter cases. Both contexts decode 20,000 red pixels
at the expected 30% opacity in the stylesheet regression. Console, CLI and
window errors and browser notifications are empty; bounded settling, cleanup
and baseline restoration pass. The installed test vault remains usable.

System chooser interception is required after trusted menu clicks, including
`Page.fileChooserOpened` and the SVG filter. Selection supplies an actual file
outside the vault through `DOM.setFileInputFiles`. Cancellation is explicitly
synthetic; physical OS-dialog navigation remains a manual check. Both contexts
decode 18,120 translucent-blue pixels in the supplied mindmap. An independent
Canvas reference accounts for premultiplied-alpha rounding. The first pixel
assertion expected unrounded source RGB; a solid-color control reproduced the
rounding, and the corrected oracle passes. Failed evidence remains under the
ignored `svg-system-colors-native` report.

Portable validation passes **549 tests** (31 new cases across conversion, UI,
picker and input tooling), including the **105-case measured-source subset**
and **96 focused SVG cases**. The fork passes 146 owned tests (seven new),
20 existing built-browser cases, full type checking, both artifact/declaration
builds, a clean packed consumer and the pinned 268-path audit. Build, library,
five bundle checks, inventory and feature mapping also pass. Matching-type lint
introduces no findings; existing view/import-order findings remain documented.
The plugin bundle is 5,042,947 bytes, with 199,933 bytes below the release target.

See [sanitized case results, source identities, hashes and diagnostics](testing-evidence/svg-entry-points/results.json).
The source identities record each repository's base commit and uncommitted
source-diff hash; documentation is finalized after the native run.

The focused checks do not replace the complete 357-case matrix. Physical mobile,
other desktop systems, restored/cold-start popouts and provider-backed AI
generation remain separate validation environments; no external AI request is
needed for these local Mermaid tests.
