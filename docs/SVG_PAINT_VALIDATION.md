# SVG paint fallback — 2026-10-31

This records the original paint-only checkpoint. The subsequent
[editable-text follow-up](SVG_TEXT_VALIDATION.md) adds SVG and plain Mermaid
HTML labels in the same PR; its current results supersede the text-omission
limitation below. The original artifact hashes remain historical evidence.

An unsupported solid color, including `color(display-p3 ...)`, previously made
`ea.importSVG()` return `false` and discard the whole conversion. Paint now
uses the SVG's own current color, or black when that is unsupported, and emits
the localized `paint` approximation notice. Supported colors, independent
alpha, explicit `none` and zero opacity retain their behavior. Paint-server
URLs use an explicit solid/`none` fallback without resolving/fetching the URL;
without one, that paint remains omitted. This is not gradient rendering or a
nearest-color conversion. Malformed/unsafe/excessive geometry still fails
atomically without publishing partial elements.

Four regressions failed before the fix and pass afterward. The focused
converter/importer suite passes **59 cases**, including alpha/holes, inherited
styles, grouping, transforms, resource guards, atomic failure and cleanup.
The full plugin fast lane passes **507 tests**; the separately measured
whole-module source-coverage lane passes **84 tests** and its ratchets. Feature
and public/test inventories pass. Production and public-library builds pass.
All nine touched TypeScript files lint with zero warnings. Whole-repository
`npm run code` still reports 118 type-safety/project-service errors; this
change does not fix that unrelated gate.

The focused native sequence builds the matching workspace plugin, fork and
Extras; installs and hash-verifies them in
`.test-work/vaults/excalidraw-auto-test/`; and restores the defined baseline.
All **eight focused cases** pass, with no captured console/JavaScript errors or
browser notifications, and with passing settling, cleanup and restoration:

| Workflow | Evidence |
| --- | --- |
| Unsupported paint through EA | Both native rectangles remain; PNG decoding finds 400 opaque fallback-color pixels and 400 red pixels. Visual inspection confirms both rectangles. IDs/colors survive acknowledged save and reopen. |
| Real Extras pie → SVG → EA | 6 native geometry elements |
| Real Extras mindmap → SVG → EA | 2 native geometry elements |
| Real Extras Gantt → SVG → EA | 10 native geometry elements |
| Real Extras journey → SVG → EA | 14 native geometry elements |
| Real Extras timeline → SVG → EA | 6 native geometry elements |
| Real Extras Git graph → SVG → EA | 4 native geometry elements |
| Real Extras quadrant → SVG → EA | 5 native geometry elements |

These seven small Mermaid fixtures establish a geometry-conversion route,
not faithful conversion of arbitrary diagrams. SVG text/images and unsupported
effects are omitted; labels, bound arrows and semantic graph relationships
are not reconstructed. Keep the SVG image when fidelity matters more than
editing paths. Native element resizing also differs from SVG-image resizing:
ordinary geometry resizing does not proportionally change stored stroke width.

[Sanitized results and artifact manifests](testing-evidence/svg-paint/results.json)
retain exact tested source identities, runtime hashes, assertions and diagnostic
lists. Native validation used Windows Obsidian and the shared application-session
lock. The final production rebuild matches the native-tested `main.js` hash:
`f73848b0216b2971c88b746e55e6e724ed0823f9249ce979d0e93fb9b4a8e18d`
(5,031,850 bytes; 211,030 bytes below the 5 MiB target). No generated binaries,
personal-vault data, version or dependency changes are committed.

Repeat from the plugin checkout (Node 22+, native vault trust/registration
prerequisites from [the runtime guide](OBSIDIAN_RUNTIME_TESTING.md)):

```powershell
npm.cmd run test:svg-import
npm.cmd run build
npm.cmd run test:fast
npm.cmd run test:source-coverage
npm.cmd run lib
npm.cmd run verify:obsidian:plugin -- --svg-paint
npm.cmd run test:inventory
npm.cmd run test:features
```

The CLI skill bundle's existing `cli-image-efficiency` branch now documents
the native Mermaid families, SVG-image fallback, `ea.importSVG()`, Lucide
`create.icons`/`apply` and `ea.addLucideIcon()`, including stroke scaling and
fidelity limits. Its 25 offline checks pass; those are separate from the live
EA/Extras evidence above.

This focused run does not replace the full 357-case acceptance profile. It does
not establish physical-mobile, macOS/Linux or popout coverage for this patch.
Priority manual checks are a previously failing SVG with unsupported paint,
transparent/holed artwork over a colored background, and main/popout import.
