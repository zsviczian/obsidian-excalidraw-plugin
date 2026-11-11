# Temporary handoff: issue #3042 — semantic frame anchors

**Plan-only placeholder. Not a feature implementation.**

- Issue and agreed specification: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3042
- Baseline: `master@83c35ffffea56db7c833c8fe5b3831968083c5a1`
- Working branch: `2026-11-11-issue-3042-frame-anchors-thumbnails`
- Owning repository: `zsviczian/obsidian-excalidraw-plugin` **only**. Do not change the Excalidraw fork, Extras, or K-Plex.
- Implement both regular frames and marker frames; null/blank frame names are not anchors.
- Follow current persisted frontmatter placement/order rules. The YAML thumbnail is a frame **name**; no customData.
- Rename preference: always update, ask each time, or ignore; leverage existing scene-change detection.
- Markdown embeds: implicit thumbnail, explicit empty `#^frame=` for whole scene, frame dropdown with `scan-box` only when frames exist; padding slider for area/frame/clippedframe.
- Navigate to frame with fuzzy modal using existing `setEphemeralState` / `zoomToElementId` behavior.
- Keep current full-scene autoexports; no generated thumbnail artifacts or Bases-specific UI.
- Read the associated **draft PR description** for the detailed plan and tests.

**Implementation agent: remove this temporary file before the PR is marked ready for review.**
