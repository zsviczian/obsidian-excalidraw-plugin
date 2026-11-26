# Visual Resources

Open **Visual Resources** from the Excalidraw command palette or use the shapes button beside **Insert Any File**. The filter menu includes vault icons, Lucide icons, images, drawings, stencils, and Thinking Frameworks. **Other visuals** is off by default. It includes unmatched drawings and images based on all configured discovery rules, with excluded folders respected.

Use the folder menu to open favorites or a playlist, or to add a vault file manually. To nest a playlist, select its parent before creating it. Delete its children before deleting the parent. Select multiple items with the selection control to edit their playlist memberships or move selected stencils between libraries.

A named-frame count opens the lower selector while the drawing card remains available for whole-drawing insertion. The resource menu exposes source and insertion actions where supported. For SVGs, choose **Insert linked SVG** to keep the image linked, or **Insert as editable strokes**. The optional **Link to SVG in drawing properties** switch records the source in the Markdown drawing's `excalidraw-svg-sources` property.

For new blank drawings, choose a framework, continue with a blank drawing, or defer the prompt for seven days. The **Create drawing with a Thinking Framework** command reopens the picker at any time. The first download is explicit, and the plugin's version-update preference also controls catalog checks.

## Vault data

Favorites, manual selections and playlist memberships live in `resource-collections.json` in the Excalidraw folder. Local edits replay against the latest vault contents. Obsidian Sync or another sync provider still determines how simultaneous offline edits to that file are reconciled. Confirmed deletions leave unresolved registry entries, while currently unavailable resources are omitted from the gallery until they resolve.

Stencil moves preserve the original item ID and check the destination before removing the source copy. If the second write fails, both copies may remain. Empty stencil libraries stay available until explicitly deleted.
