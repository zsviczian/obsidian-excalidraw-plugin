# CLI image-preview validation (#3004)

Generated in the dedicated `excalidraw-test` vault on macOS with Obsidian 1.14.4
(installer 1.14.0), using the declared Excalidraw 0.18.143 package. These are
synthetic, non-private fixtures produced by the native CLI regression on
2026-10-15. The runner retains the full matrix beside its `report.json`.

Compare [original](light-original.png), [mixed](light-mixed.png), and
[thumbnails](live-thumbnails.png): the same source appears uncropped, cropped,
mirrored, rotated with reduced opacity, and clipped inside a frame. The original
also includes a small SVG icon and transparent raster regions. Thumbnail crops
and frame clipping retain their placement. Placeholder labels intentionally rotate
and mirror with the image. The [dark placeholders](dark-placeholder.png) exercise
Unicode and XML punctuation; [placeholder SVG](light-placeholder.svg) contains no
original image payloads. Preview generation preserved source text, elements, and
dirty state in the regression.

The native feature assertions passed, including actual same-size/same-mtime disk
attachment replacement rejection. Its overall clean-error gate failed because
Obsidian reported repeated `ResizeObserver loop completed with undelivered
notifications` during teardown. A separate blank-popout control reproduced that
warning without preview operations. It is not suppressed. Popout inventory/export
also completed in a separate run, with the same teardown warning.

The optional native stress used 387 file records with 811,609,434 aggregate payload
characters, above V8's 536,870,888 single-string limit. Stable reads, last-byte
invalidation, stale apply refusal, and placeholder export passed. Shared immutable
backing strings make this an allocation-path regression, not a real 570 MB drawing
or peak-memory benchmark. That drawing was unavailable. Windows and physical mobile
were not tested.
