# SVG to native Excalidraw

Original vendored source: [excalidraw/svg-to-excalidraw](https://github.com/excalidraw/svg-to-excalidraw),
[original checkpoint](https://github.com/excalidraw/svg-to-excalidraw/commit/6f6e4b7269c4194b56cf7517a8357ba73be12a3a).
The source remains embedded in the plugin for packaging and maintenance. The
fidelity upgrade in #3018 replaces the old traversal/paint/geometry handling;
it does not introduce another renderer, an image fallback, or a new scene format.

## API and publication

`ea.importSVG(svgString): boolean` is synchronous and appends fresh native
elements to the EA workbench. It does not clear unrelated workbench elements,
insert into a view, save, or fetch resources. Callers retain control of grouping
and `addElementsToView()`.

Fatal conversion failure returns `false` and leaves the workbench unchanged.
Successful conversion may return `true` with a localized notice describing
approximations or omitted unsupported features. Empty/transparent SVGs are valid;
they are not made opaque to manufacture a visible result. The built-in dialog
checks success and nonempty output before grouping/inserting, checks editor/file
identity after the file read, and always destroys its temporary EA instance.

Existing converted drawings are ordinary native elements. They are not
regenerated or migrated when opened. SVG-as-image insertion/embedding is separate
and unchanged. Lucide icons are a test family; this module supplies no icon
picker, icon catalog API, new CLI operation, or insertion preset.

## Representation and support matrix

| Feature | Handling |
| --- | --- |
| Paint order and grouping | Rendering-tree order is retained. Fill precedes stroke unless `paint-order` specifies otherwise. All ancestor groups and local decomposition groups receive fresh identities; local reuse does not mutate shared definitions. |
| Presentation styling | Root/group/element inheritance, presentation attributes, simple local CSS rules, inline precedence, `currentColor`, `none`, colors with alpha, independent fill/stroke alpha, zero and fractional opacity. The initial color is black, independent of Obsidian's theme. |
| Rectangles, circles, ellipses | Native primitives where their geometry is faithful, including rotated/reflected rectangles and affine ellipses. Skewed/rounded rectangles use sampled native contours. |
| Paths, lines, polylines, polygons | Open/closed subpaths remain distinct. An implicitly closed fill does not close its open stroke. Absolute/relative commands, cubic/quadratic curves, smooth commands and arcs are normalized. Degenerate arcs follow the SVG line/no-op rules. |
| Compound fills | `nonzero` and `evenodd`, nested/disjoint contours, overlaps, and self-intersections use filled-face boundaries. Dense simple/nested outlines use a sweep and containment path rather than all-pairs winding work. |
| Transparent holes | Hole contours are connected by doubled zero-width bridges in a native filled polygon, as supported by the component. No white or background-colored patches are used. Original strokes are emitted separately, without internal seam strokes. |
| Curves | Adaptive subdivision in transformed scene coordinates, maximum deviation 0.1 scene units (tighter for small curves, minimum tolerance 0.000001). Endpoints and explicit closure are retained. There is no every-Nth-point deletion or element per sampled segment. |
| Coordinates | SVG affine composition, centered rotation, reflection, skew, nonzero viewBox origins, alignment and `preserveAspectRatio`, root/nested viewports, absolute units and percentages. When intrinsic dimensions are absent, viewBox dimensions are used, otherwise a 300×150 standalone basis. |
| Local references | `<defs>` and `<use>` including referenced groups/SVG/symbol viewports, instance dimensions and inherited styling. Repeated instances have fresh identities. Missing, cyclic and external references fail conversion. |
| Group/object compositing | **Approximation with a notice.** Native groups do not isolate paint into an offscreen compositing layer. Child opacity multiplication cannot reproduce overlapping group opacity; separately emitted fill/stroke or subpath strokes can also differ under object opacity. These are not counted as exact fidelity passes. |
| Stroke semantics | Native round caps/joins and preset dashed styles. Other cap/join/dash patterns and nonuniform stroke scaling are approximations with a notice. `non-scaling-stroke` retains its constant width; zero-length round-cap strokes become editable dots. |
| Local CSS limits | Simple tag/class/ID compounds and descendant selectors, with lexicographic ID/class/type specificity and source order for ties. Repeated selectors cannot carry into a higher specificity component. SVG-local custom properties and nested `var()` fallbacks retain inheritance, case-sensitive names and local overrides. Cyclic/missing values use call-site fallback or inherited/initial presentation. Advanced selectors, at-rules, `!important` and geometric CSS properties are diagnosed. No host theme or external variable environment is consulted. No external stylesheet is loaded. |
| Clipping, gradients, patterns, filters, blending, markers | Unsupported effects/paint are diagnosed and omitted. Viewport clipping is not destructively applied to native geometry; nested/slice viewports and painted bounds outside the outer viewport produce a notice. |
| Text and plain HTML labels | SVG `text`/positioned `tspan` content and plain Mermaid `foreignObject` labels become editable native text, retaining ancestor groups, colors, alpha, basic anchors and transforms. EA supplies real font metrics. Available font substitutions, rich inline styling, exact glyph baselines, wrapping, skew/nonuniform scaling and complex HTML layout are approximations with a notice. No source HTML is mounted or executed. |
| Embedded images and active content | Images and unsupported foreign HTML content are omitted with a notice. Scripts, handlers and remote resources never execute or load. |

The result remains editable: fill/background colors recolor fill pieces, and
stroke colors recolor original outline pieces. Roughness, grouping, ungrouping,
duplication, ordinary transforms, native Undo/Redo, clipboard, and exports operate
on standard elements. Adding a new visible stroke to a holed fill polygon can
expose its bridge edges; use its separate outline pieces for stroke editing.

Opacity notices also cover `<use>` instances, including nested references, when
their own opacity affects multiple emitted pieces. This diagnoses the existing
per-piece approximation; it does not introduce isolated group compositing.

## Input and resource limits

Unsupported solid color syntax is approximated using the SVG's own `color`
(the source of `currentColor`), or black when that is also unsupported. A
localized paint notice accompanies successful publication; it no longer aborts
the complete SVG. Explicit `none`, transparency and independent alpha remain
intact. Paint-server URLs are never fetched: an explicit solid/`none` fallback
is used, otherwise that paint stays transparent. Gradients and patterns are
still not native fills. This follows the fallback syntax in
[SVG 2 paint](https://www.w3.org/TR/SVG2/painting.html#SpecifyingPaint), while
the unknown-color substitution is an intentional import approximation.

An SVG generated for an image-only Mermaid diagram can use this same route,
including its supported SVG text and plain HTML labels. It does not recover a
semantic diagram or automatic label/connector bindings. Images, rich HTML and
unsupported effects retain the limitations above. Preserve the original image
when exact rendering matters.

SVG is parsed as inert XML and is never attached as active source markup. Scripts,
event handlers, external use targets and CSS URLs are never executed/resolved.
Document types/entities are rejected. Unsupported material content is diagnosed;
malformed, unsafe or excessive input fails atomically.

Current deterministic limits include 2,000,000 input characters, 20,000 input tag
tokens and a 20,000 traversal/emission budget, depth 128, 100,000 sampled/generated
points, 100,000 intersection splits, 20,000 normalized path segments, 1,000 CSS
rules and 8,000,000 counted conversion operations. Coordinates are bounded before
and after transformation. Point budgets include intermediate geometry; there is
no promise that every SVG below one individual limit is supported. These are
work/memory bounds, not a wall-clock latency guarantee on every device.

Visible text adds a 100,000-character budget and at most 1,000 lines per native
text element. Excessive text fails atomically. Direct internal parser users can
provide a synchronous `measureText` adapter; without it, approximate font-unit
measurements are diagnosed. `ea.importSVG()` always supplies real host metrics.
Image conversion may supply an initial affine matrix and transformed bounds
viewport internally. These change placement without wrapping or editing the
source tree, so supported root/ancestor CSS selectors retain their meaning.

Custom properties are limited to 1,024 names per element, reference/fallback
depth 32 and 8,192 characters per expanded value. Inherited-map work counts
toward the existing stylesheet budget; excessive input fails before scene
publication. The supplied Mermaid mindmap regression retains four branch
colors, translucent fills, the light root and editable labels.

## Validation

Run `npm run test:svg-import` for the real converter and importer boundary tests.
The focused `npm run verify:obsidian:plugin -- --svg-paint` path verifies paint
fallback pixels, save/reopen and real Extras Mermaid SVG geometry; see
[paint validation](../../../docs/SVG_PAINT_VALIDATION.md).
Add `--svg-text` for measured editable labels, text-only export pixels,
editing, save/reopen and popout loading; see
[text validation](../../../docs/SVG_TEXT_VALIDATION.md).
With the configured test vault, run:

```sh
npm run verify:obsidian:plugin -- --svg-import
```

The native probe reads the original `TestAssets/*.svg` without modifying them,
hashes them before/after, and uses actual installed Obsidian `getIconIds()` and
`getIcon()` outputs through a temporary, owned test module removed afterward.
No icon package/catalog is added to the product.

The runner rebuilds the pinned old converter from Git commit
`5e4c83f6370f93d3f794ef7afb9545a6b6208c11` into its report directory. Both old and
current conversions go through the same EA workbench staging for comparisons.
Browser source rendering is an independent appearance oracle. Reports distinguish
source/baseline/current differences, intentional corrections, approximations and
unsupported content. Original third-party samples and generated comparisons stay
in the local report directory; only self-authored fixtures are committed.

See [validation evidence](../../../docs/SVG_IMPORT_VALIDATION.md) and the
[native runtime guide](../../../docs/OBSIDIAN_RUNTIME_TESTING.md). Windows/Linux,
physical mobile touch and physical transform gestures require separate
coverage. A strict runner error gate still reports the previously observed,
unattributed ResizeObserver notifications around popout teardown; passing SVG
feature assertions do not establish that notification's cause or harmlessness.
