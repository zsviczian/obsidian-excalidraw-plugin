# Visual Resources

Open **Visual Resources** from the Excalidraw command palette or use the shapes button beside **Insert Any File**. The filter menu includes vault icons, Lucide icons, images, drawings, stencils, and Thinking Frameworks. **Other visuals** is off by default. It includes unmatched drawings and images based on all configured discovery rules, with excluded folders respected.

## Find and use resources

| What you want to do | Where to start | What the interface makes clear |
| --- | --- | --- |
| Find a vault icon by its group | Enable **Vault icons** in the filter menu, then choose a group. | Fine filters appear under their owning type. **Select all** and **Select none** affect resource types and preserve group choices. |
| Use a named frame | Enable **Drawings**, search for a frame name, then use **Browse named frames** on the drawing card. | Frame groups control which names appear in search and in the lower selector. The drawing card still inserts the whole drawing. |
| Insert an SVG into a drawing | Choose **Insert linked SVG** or **Insert as editable strokes**. | Stroke insertion asks whether to record a source link. Pick a document property or use `excalidraw-svg-sources`. With K-Plex enabled, choose a relationship direction and one of its configured fields. **SVG stroke options** lets you set defaults while browsing. |
| Add a visual to a note or Canvas | Open **Visual Resources** from an editable Markdown note or Canvas, then select an image, drawing, or frame. | The panel names the destination. Markdown adds an embed at the cursor. Canvas adds a file node and retains the frame reference. Lucide icons become linked SVG attachments in these editors. |
| Organize several results at once | Choose **Select multiple resources**, check items, then choose **Actions for selected resources**. | The count confirms which mode you are in. Favorites and creating a playlist are available from the first selection. Existing playlists and eligible stencil moves appear as applicable. |
| Switch collections or adjust the gallery | Open **Collections** using the library icon. The selection and layout controls sit beside it. | Collections contains **Favorites**, playlists, and manually added vault files. Settings and moving the panel sit at the end of the toolbar. |

Drag the divider to resize the gallery and frame selector, or focus it and use the Up and Down arrow keys. On desktop, double-click a vault resource to open its source, or drag it to an Excalidraw drawing to insert it at the drop position.

Large or linked drawings and their frames use existing thumbnails when a suitably sized preview is available. A placeholder keeps the resource browsable on a cache miss. Small, self-contained drawings can generate a temporary thumbnail. Browsing adds no drawing thumbnails to the persistent cache.

The two journeys that still benefit from visible context are frame browsing and inserting into another editor. A frame is part of its parent drawing, so the frame list stays below that drawing’s search results. The destination label matters when switching between Markdown and Canvas because the same click creates different types of links. The library icon represents the collection menu as a whole. A bookmark would suggest Favorites only, and a list icon is already used for the layout control.

For new blank drawings, choose a framework, continue with a blank drawing, or defer the prompt for seven days. The **Create drawing with a Thinking Framework** command reopens the picker at any time. The first download is explicit, and the plugin's version-update preference also controls catalog checks.

## Vault data

Favorites, manual selections and playlist memberships live in `resource-collections.json` in the Excalidraw folder. Local edits replay against the latest vault contents. Obsidian Sync or another sync provider still determines how simultaneous offline edits to that file are reconciled. Confirmed deletions leave unresolved registry entries, while currently unavailable resources are omitted from the gallery until they resolve.

To rename a stencil, click its name and press Enter to save or Escape to cancel. You can also choose **Rename** from its action menu. The name is saved in the stencil’s owning library. The renamed stencil stays in place, even if its new name no longer matches the current search. Changing the search, filters, or collection applies the current name and sort order.

Stencil moves preserve the original item ID and check the destination before removing the source copy. If the second write fails, both copies may remain. Empty stencil libraries stay available until explicitly deleted.
