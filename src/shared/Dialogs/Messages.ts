export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!

<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=P_Q6avJGoWI" target="_blank"><img src ="https://i.ytimg.com/vi/P_Q6avJGoWI/maxresdefault.jpg" style="width:100%;"></a>
</div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update, you'll see these release notes (you can turn this off in the plugin settings).

I build this plugin in my free time, as a labor of love. Curious about the philosophy behind it? Check out [📕 Sketch Your Mind](https://sketch-your-mind.com). If you find it valuable, say THANK YOU or…

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>
`,
"2.17.0":`
## New
- Phone UI from Excalidraw.com [#9996](https://github.com/excalidraw/excalidraw/pull/9996)

## Fixed
- side panel does not attach correctly when library is pinned [#2510](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2510)
- Fixed print area when using marker frames and printing Slideshow to PDF
`,
"2.16.1":`
## Fixed
- Based on a request from [Kevin](https://github.com/Kovah) referencing GDPR, I removed YouTube iframes from settings, scripts, etc., and replaced them with thumbnail images + links to YouTube. [#2234](https://github.com/zsviczian/obsidian-excalidraw-plugin/discussions/2234)`,
"2.16.0":`
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=51EgDgtiZgQ" target="_blank"><img src ="https://i.ytimg.com/vi/51EgDgtiZgQ/maxresdefault.jpg" style="width:100%;"></a>
</div>

## New from Excalidraw.com
- New library search feature [#9903](https://github.com/excalidraw/excalidraw/pull/9903)
  - You can rename library items by selecting them, then choosing "Rename or publish" from the ... menu.
- New compact mode for tablets [#9910](https://github.com/excalidraw/excalidraw/pull/9910)
  - New setting in plugin setting \`Compact-mode on Tablets\` to override tray-mode on tablets in favor of the new compact mode.

## New
- Embedding PDF as images, frames are now marker frames instead of regular frames. You can reference pages, including their markup in markdown notes, using this syntax: \`![[drawing#^frame=12]]\` (page 12)
- Pinned scripts toolbar is now on the right side in all modes: tray-, normal-, and compact. The toolbar moves into view when the side panel is opened for the stencil library or for search.
- Better RTL support, pinned scripts are rendered on the left side in RTL mode.

## Fixed
- Critical fix: When clicking to follow a link in a markdown embeddable in preview mode to open an Excalidraw drawing in the same tab, the back of the newly opened drawing was overwritten with the content of the source drawing.
- PDF++ Links from document to Excalidraw select everything in the scene instead of the linked element. [#2503](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2503)

`,
"2.15.3":`
## Fixed
- New back of the note cards are not visible until the drawing is saved. When adding a back-of-the-note card using the context menu, the card got placed at the absolute 0,0 position in the scene instead of the current pointer position. [#9949](https://github.com/excalidraw/excalidraw/issues/9949)
- Drawings created 4 years ago don't open [#2479](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2479)
- On Obsidian Mobile, when an element has multiple links, clicking the link icon, the link selector pops up and immediately closes
- Improved handling of importing external images and drag and drop of images from inside Obsidian. Features like (Convert SVG to Strokes) and (Flip the card) now work immediately, you don't need to force save, or wait for autosave to kick in.

## New
- Added startup check that detects when Obsidian's recorded plugin version differs from the installed Excalidraw code (e.g. after partial sync of large files) and offers to update or ignore, with a setting to disable the check.
- When Excalidraw is open in two or more tabs—either as Markdown or Excalidraw—auto-zoom is disabled. This allows you to work in multiple tabs on the same drawing at once: focusing on different areas of the same drawing, or editing the Markdown and Excalidraw views in parallel.
`,
"2.15.2":`
## Fixed:
- Pressing enter on a text element erroneously activated all markdown embeddables in the scene. [discord](https://discord.com/channels/1026825302900494357/1412683408424833045)
- After updating to PDF++ 0.40.31, touch scrolling of embedded PDF documents stopped working on mobile devices, and the PDF document appeared with the wrong themes in some cases.
- Issue with the Kanban board as an active embeddable on mobile phones is fixed.

## Fixed in ExcalidrawAutomate
- \`getActiveEmbeddableViewOrEditor (view?:ExcalidrawView): {view:any}|{file:TFile, editor:Editor}|{node: ObsidianCanvasNode}|null;\` no returns the node, instead of the empty view from the leaf.
`,
"2.15.1":`
## Fixed
- PDF improvements
  - It was not possible to scroll the embedded PDF. [#9891](https://github.com/excalidraw/excalidraw/pull/9891)
  - Embedded PDF pages were blurred (pixelated).
  - Embedded PDF now accurately follows \`excalidraw-embeddable-theme\` document property.
    - auto: follows Excalidraw theme (regardless of Obsidian theme)
    - default: follows Obsidian theme (regardless of Excalidraw theme)
    - dark: always displays the PDF in dark mode (regardless of Excalidraw and Obsidian themes)
    - light: always displays the PDF in light mode (regardless of Excalidraw and Obsidian themes)
  - New embeddable-menu buttons:
    - Snapshot: inserts an image of the current active page to the scene
    - Bookmark: updates the embed link to the current page
- Pasting an oversized image triggered an error and caused Excalidraw to discard the scene. [#2453](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2453), [#9878](https://github.com/excalidraw/excalidraw/issues/9878)
- Video with local URI will no longer autoplay when the scene loads
- Error creating link to element when element is a sticky note
- Area link embeds hide the content of the objects within the area [#2461](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2461)
- On Obsidian Mobile 1.9.10, embeddables could cause a black/white screen (no active view) until reselecting the Excalidraw page; [#2460](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2460)
- Scrolling of embedded web pages on mobile devices is working again.

## New
- Insert Any File now supports adding Audio files.
- New option in settings under "Zoom and Pan". Pan with right mouse button (Miro-style): right-click and drag to pan the canvas. Press 'm' for the context menu (disabled while editing text). 🙏 [@mfuria](https://github.com/mfuria) for making this happen! [#2450](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2450), [#329](https://github.com/zsviczian/excalidraw/pull/329)
- Insert image in the main toolbar now opens a dropdown menu of options: Insert from system, insert from Vault, insert Card, and insert LaTeX. [#2448](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2448)

## Deprecated
- Removed "Toggle RAW mode" from the Command Palette and the Obsidian Tools menu due to low usage. RAW mode remains available by adding \`excalidraw-plugin: raw\` to the note's YAML frontmatter/document properties.

## New in ExcalidrawAutomate
\`\`\`ts
/**
 * Returns the center position of the current view in Excalidraw coordinates.
 * @returns {{x:number, y:number}} The center position of the view.
 */
public getViewCenterPosition(): {x:number, y:number};
\`\`\`
`,
"2.15.0":`
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=DqDnzCOoYMc" target="_blank"><img src ="https://i.ytimg.com/vi/DqDnzCOoYMc/maxresdefault.jpg" style="width:100%;"></a>
</div>

## New
- Introducing **Marker Frames**. These are special frames that can be used to mark slides, pages areas for PDF printouts, image references, etc.
  To create a marker frame, create a frame and toggle the marker frame in the elements properties panel.
    - Markers are not included in exports such as images or PDFs.
    - Markers do not contain elements
    - Markers can be hidden/shown from the canvas context menu
- Updated the "Printable Layout Wizard" script
  - Now works with marker frames
  - Supports different page sizes and orientations within a single PDF document
  - The printout may include non-marker frames (e.g., PDF image embeds in frames)
- Pro-tip: You can also use marker frames... 
    - with the Slideshow plugin
    - to create image-area references such that the frames do not get rendered in exported images, and you can reference areas by frame name
- Performance improvement of Image-area references

# New in ExcalidrawAutomate
- \`createPDF()\` now supports \`SVG[]\` array of SVGs with different sizes.
- New function:
\`\`\`ts
  /**
   * Gets the elements within a specific area.
   * @param elements - The elements to check.
   * @param param1 - The area to check against.
   * @returns The elements within the area.
   */
  elementsInArea(
    elements: NonDeletedExcalidrawElement[], 
    {x, y, width, height}:{
      x:number; y:number; width:number; height:number;
    }
  ):ExcalidrawElement[] 
\`\`\`
`,
"2.14.3":`
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=29EWeglRm7s" target="_blank"><img src ="https://i.ytimg.com/vi/29EWeglRm7s/maxresdefault.jpg" style="width:100%;"></a>
</div>

Updated the Printable Layout Wizard script with the option to exclude empty pages.

## Fixed
- If a frame is locked, elements created over the frame or dragged over the frame should not be auto-added to the frame. [#9850](https://github.com/excalidraw/excalidraw/issues/9850)

## Fixed in ExcalidrawAutomate
- Not all AppState properties were being correctly copied to the template when creating a new drawing with ea.create() [#2440](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2440)
`,
"2.14.2":`
## Fixed
- Converting Markdown to Excalidraw ("Back of note"/"Convert markdown to ExcaliDrawing") no longer appends T00:00:00.000Z to an existing date frontmatter field and handles merging of lists such as tags intelligently [#2414](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2414)
- Multi‑point line creation on touchscreens (tap–tap–tap) produced a horizontal line after using a pen. Fixed. [#9840](https://github.com/excalidraw/excalidraw/pull/9840#issuecomment-3165319266)

## New
- Zoom settings (Settings → Excalidraw → Appearance and Behavior → Zoom) [#2434](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2434):
  - Zoom increment (default 5%) to fine‑tune mouse wheel / gesture precision.
  - Minimum zoom (default 10%) controls how far you can zoom out (below 10% may be unstable—use with caution).
  - Maximum zoom (default 3000%) defines the upper zoom limit.
- Palm Guard script (in script store): Mobile-friendly drawing mode for stylus users. Enters fullscreen, hides UI, shows a draggable minimal toolbar (toggle + exit) to prevent accidental palm taps; single tap to exit. Inspired by [#2409](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2409)

<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=A_udjVjgWN0" target="_blank"><img src ="https://i.ytimg.com/vi/A_udjVjgWN0/maxresdefault.jpg" style="width:100%;"></a>
</div>

## ExcalidrawAutomate
- Improved \`FloatingModal\` behavior. Floating Modal now does not trap keyboard events, the header element does not block "X" button in the top right corner, all four corners are rounded on Mobile Devices.

`,
"2.14.1":`
## Fixed
- Excalidraw broke Obsidian's UI in Arabic, Persian, and Hebrew due to LTR, RTL conflict. [#2423](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2423) 
- Styling issues impacting native Obsidian search/replace dialogs. [#2420](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2420)
- Now using native Obsidian attachment location function. 🙏 [mnaoumov](https://github.com/mnaoumov) [#2421](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2421), potentially fixes [#179](https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/179) of the Obsidian Custom Attachment Location plugin issue.

## New
- New frontmatter option \`excalidraw-embed-md\`. When set to \`true\`, embedding the drawing into a markdown note will render the "back of the note" (its markdown content) instead of rendering it as an image.
  - If you want to always display the drawing as an image, even when \`excalidraw-embed-md\` is enabled, use the special embed syntax: \`![[drawing#^as-image]]\`. Here, \`as-image\` is a phantom block reference that forces image rendering.
- Added Spanish translation by [@Joakim31](https://github.com/Joakim31) [#2425](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2425)
- Incremental minor updates from the main [Excalidraw project](https://github.com/excalidraw/excalidraw).
`,
"2.14.0":`
## A Big "Small" Update
- Added search to Excalidraw Settings, plus added a link to access the public NotebookLM workbook pre-loaded with everything about the plugin
- New Taiwan-idiomatic Traditional Chinese translation by [@rlan](https://github.com/rlan) [#2413](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2413)
`,
};
