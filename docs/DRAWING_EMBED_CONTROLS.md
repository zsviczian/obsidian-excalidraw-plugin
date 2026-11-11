# Drawing embed controls

In Live Preview, hover a drawing embed to show its toolbar. Small embeds place
the toolbar below the image; touch layouts keep the controls visible. Drag the
bottom-right corner to resize, or focus it and use the arrow keys. A completed
resize changes only that occurrence in the containing note, with one undo step.

For an `area=`, `frame=` or `clippedframe=` reference such as
`![[Drawing#^frame=abcdefgh|300]]`, the toolbar also offers **Adjust padding**,
using the square-dot icon. A compact
horizontal Obsidian slider appears directly below the toolbar and previews
padding from 0 to 2000: 0, 10, then increments of 50. You can drag, click the track, use the
arrow keys, or scroll over the slider. Closing the popup or pressing Enter saves
one source change; Escape cancels. **Use default padding** removes the explicit
`,padding=N` parameter and uses the drawing's export padding preference.

The padding preview holds the embed's displayed dimensions steady while its
content changes. It does not change the drawing file. A stale source, closed
note, replaced widget, or plugin unload cancels the gesture and its pending
preview. Paths, aliases, Markdown titles, dimensions, and table escapes are
preserved. Identical embeds remain independent.

Padding controls require an editable Live Preview source binding and a nonempty
area or frame reference. They are absent for whole drawings, text/group references,
Reading view, read-only editors, nested Markdown transclusions, and Canvas.
Reading view retains preview and open-drawing actions.

## Frames and drawing thumbnails

Select a named frame or marker frame and use **Set as drawing thumbnail** in its
context menu. The document property `excalidraw-thumbnail` stores its exact name
and can also be edited manually. Names must be unique. Implicit previews in
notes, hover previews and other drawings crop to the frame rectangle, without
its outline or title. A missing, invalid or ambiguous name falls back to the
whole scene. PNG/SVG autoexports continue to export the full scene.

On save, `excalidraw-anchors` lists unique named frames and marker frames in
scene order. Unnamed frames are omitted; a frame deliberately named `Frame`
is included. New properties appear at the top of frontmatter and existing
properties retain their positions. Unrelated properties are preserved.

The first rename of a thumbnail frame asks whether to always update its document
property, ask on each rename or leave it unchanged. Change this preference later
in the saving settings. Deleting the frame leaves a stale name and the preview
falls back to the whole scene.

For editable Live Preview embeds whose drawing has frames, the **scan-eye**
button opens a frame picker. **Default thumbnail** removes the explicit override;
**Whole scene** writes `#^frame=` and ignores the thumbnail property. Other items
choose a frame by ID, including unnamed frames and names ending in `,padding=N`.
Existing explicit `frame=` and `clippedframe=` rendering remains unchanged.

Use **Excalidraw: Navigate to frame** to fuzzy-search regular and marker frames
in the current drawing. It uses the existing viewport navigation and selection
behavior, preserving editing mode and Search text.

## Focused validation

Source checks cover detached Reading sections, relative paths, source ownership,
history, padding previews, cancellation, and cleanup. Run the affected
`scripts/testing/*embed*.test.mjs` files with Node's test runner, plus
`scripts/testing/markdownEmbeds.test.mjs`, then build and run CSS policy lint.

`node scripts/testing/host/verify.mjs --embed-regressions` builds and deploys the
current workspace artifacts into the marker-owned test vault. It checks six
cases in the main window and a popout: relative and vault-path links in Live
Preview; detached long-note Reading rendering in all three image formats;
and padding preview, exact-occurrence editing, undo, cancellation, and unchanged
drawing bytes. These cases also belong to complete native profiles.

The prepared test vault must be open, trusted, and CLI-enabled. See
[native testing](OBSIDIAN_RUNTIME_TESTING.md). A prepared build with an unmet
host prerequisite is not a native test pass. Physical touch devices and other
desktop operating systems remain separate manual environments.

For frame metadata, thumbnails, navigation and source controls, run
`node scripts/testing/host/verify.mjs --frame-semantics`. Add
`--devices --device-profiles=phone-portrait-light,tablet-portrait-full-light`
for focused phone/tablet emulation. Complete profiles include these cases too.

The 2026-11-11 Windows checks on Obsidian 1.14.5 passed nine desktop frame cases
(main window, popout and actual plugin reload), eight frame cases in phone/tablet
emulation, and the six existing embed regressions. The final desktop run uses
`scan-eye`; mobile emulation preceded this icon-only substitution. Reports under
`.test-work/reports/frame-semantics-2026-11-11-07/` retain the mobile and prior
regression results; `frame-semantics-2026-11-11-08/` records the successful desktop
rerun. Earlier failed receipts remain intact. All cleanup gates passed.

Focused source checks passed 101/101; bundle/runner checks passed 18/18.
Targeted lint added no findings (24 existing findings remain in adjacent legacy
code). The production bundle is 5,114,584 bytes, leaving 128,296 bytes under 5 MiB.
Physical touch devices, other operating systems and the minimum supported host
version remain manual checks. Complete regression profiles were not run.

## Investigation checkpoint: 2026-11-10

Baseline: plugin `master@2ef81a5d`; implementation branch
`2026-11-10-embed-rendering-padding`. No component or Extras source changes.

- **#3039:** synchronous `is-loaded` claiming prevents native fallback, while
  connection checks can abandon an off-document section before queueing or
  during export. Claiming was added in `f31dff9e`; the detachment checks are
  older. Neither originated in #3037. Reading embeds now use the existing
  Markdown render-context owner, including generation checks and disposal.
- **#3040:** `src` belongs to the containing note, but Live Preview runs the
  drawing's postprocessor with the drawing's own `sourcePath`. Re-resolving a
  relative link from that folder can fail or choose the wrong target. The
  re-resolution came from `5e2bb771` (#2979). For a matching relative drawing
  link, rendering now retains Obsidian's already-resolved drawing identity.
  Unrelated native images and text transclusions keep their original routing.

Both new regression cases failed before the changes and passed afterward.
The final focused run passed **94/94** cases: 89 source checks and five built
bundle checks. Targeted ESLint, CSS policy lint, inventory, feature mappings,
and `git diff --check` passed. The production build adds no TypeScript
diagnostics; its existing 18 circular-dependency warnings remain. `main.js`
is 5,101,162 bytes, leaving 141,718 bytes below the 5 MiB target.

The first native preparation stopped because the test vault was not open. After
the maintainer opened it, a fresh Windows run on Obsidian **1.14.5** passed all
**six targeted cases**, with zero unexpected console/window errors and matching
built, installed and reported artifact hashes. This establishes focused Windows
evidence; the reports' Obsidian 1.15 environment remains a separate check.

The original native report retains its failed cleanup status: baseline restoration
found an inactive synthetic drawing from **2026-11-07**, unrelated to the current
run. It had no open view, controller or print task. Recovery backed up that exact
file, verified its unchanged bytes and timestamp, deleted it through the Vault
API, and reran the baseline-restoration gate successfully. Immutable fixtures
needed no repairs; plugin and Extras settings were verified on disk and in memory.
The failed report and separate successful `cleanup-recovery.json` receipt remain
under `.test-work/reports/embed-regressions-2026-11-10-verified/`. Full regression
profiles were not run.

The subsequent UI refinement replaces the padding trigger with `square-dot` and
the vertical popup with an Obsidian `SliderComponent` in one compact horizontal
row beneath the toolbar. It retains the value readout and an icon-only default
reset. Placement flips above the toolbar when needed to stay in the viewport.
All 15 focused padding/controller checks, the production build, targeted ESLint,
CSS policy lint and registry checks passed. This visual refinement was not rerun
in the native lane; the six native results above apply to the preceding UI.
The rebuilt `main.js` is 5,101,447 bytes, below the 5 MiB target.
