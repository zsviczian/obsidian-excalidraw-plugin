export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/P_Q6avJGoWI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update, you’ll see these release notes (you can turn this off in the plugin settings).

I build this plugin in my free time, as a labor of love. Curious about the philosophy behind it? Check out [📕 Sketch Your Mind](https://sketch-your-mind.com). If you find it valuable, say THANK YOU or…

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>
`,
"2.15.1":`
## New
- New option in settings under "Zoom and Pan". Pan with right mouse button (Miro‑style): right‑click and drag to pan the canvas. Press 'm' for the context menu (disabled while editing text). 🙏 [@mfuria](https://github.com/mfuria) for making this happen! [#2450](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2450), [#329](https://github.com/zsviczian/excalidraw/pull/329)
- Insert image in the main toolbar now opens a dropdown menu of options: Insert from system, insert from Vault, insert LaTeX. [#2448](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2448)
`,
"2.15.0":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/DqDnzCOoYMc" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

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
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/29EWeglRm7s" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

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

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/A_udjVjgWN0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

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
"2.13.2":`
## New
- Excalidraw now properly supports drag and drop of obsidian links from Bases.
- ExcalidrawAutomate exposes a new class: \`FloatingModal\`. This is a modified version of the Obsidian.Modal class that allows the modal to be dragged around the screen and that does not dim the background. You can use it to create custom dialogs that behave like Obsidian modals but with more flexibility.
`,
"2.13.1":`
## New
- Support for Obsidian bases as embeddables in Excalidraw.
  - **Note:** The feature is only available to Insiders who have Obsidian 1.9.4 or later installed.
  - If your base includes multiple views you can pin the desired view similar to filtering to a section (click top left # button; \`[[my.base|my view]]\`).

## Fixed
- Cannot type in embedded web forms. In certain cases, typing within these embeds would trigger Excalidraw hotkeys instead of interacting with the embedded content. [#2403](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2403)
`,
"2.13.0":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/QzhyQb4JF3Q" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- **Flexible Auto-Export Location:** Take control of where your auto-exported .png, .svg, and .excalidraw files are saved. Addressing a long-standing request, you can now define custom output paths using the new **Excalidraw Hooks**.
  - Implement the \`onImageExportPathHook\` callback in your ExcalidrawAutomate startup script to control the *destination path*.
    - Get the skeleton script via plugin settings or download it [here](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/master/src/constants/assets/startupScript.md).

- **Control Auto-Export Trigger:** Use the \`onTriggerAutoexportHook\` in your startup script to decide *if* and *how* auto-export runs for a file, based on its properties or frontmatter, *before* the export path is determined.

- **Improved "Open Excalidraw drawing":** The Command Palette command now searches the *entire Vault* for the matching Excalidraw file when used on an embedded .svg or .png, useful when exports are in different folders.

- **Placeholder Files for New Embeds:** When embedding a new drawing as PNG/SVG via the Command Palette, empty placeholder files are now created immediately based on your auto-export setting. This ensures Obsidian correctly updates links if you rename the file soon after creation (when "Keep filenames in sync" is on).

- **Paste Obsidian URLs into Excalidraw:** Pasting an Obsidian URL for an image or file into Excalidraw now inserts the associated image directly into the drawing.

- **\`onImageFilePathHook\` Drag & Drop Support:** The \`onImageFilePathHook\` (for controlling location/filename of *embedded* files) is now triggered when dragging and dropping files into Excalidraw from outside Obsidian, matching the existing behavior for pasting.

## New in ExcalidrawAutomate
\`\`\`ts
splitFolderAndFilename(filepath: string) : {
    folderpath: string;
    filename: string;
    basename: string;
    extension: string;
  }
\`\`\`
`,
"2.12.4":`
## Fixed
- ExaliBrain did not render after the 2.12.3 update. [#2384](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2384)
`,
"2.12.3":`
## Minor fixes
- Includes all recent updates and fixes from excalidraw.com
- Fixed issue with line editor snapping out of edit mode
- Fixed long-standing issue with wireframe to code calling a deprecated OpenAI endpoint
- "Load Excalidraw Properties into Obsidian Suggester" setting now defaults to false for new installations. [#2380](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2380)
- Taskbone OCR result does not get saved to frontmatter in some cases [#1123](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1123)

## New
- If the cropped file or annotated file prefix is set to empty, there will now be no prefix added to the file name. Additionally, now you can also set a suffix to the file name. [#2370](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2370)
`,
"2.12.2": `
## Fixed
- BUG: Excalidraw theme changes to Light from Dark when clicking line element node [#2360](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2360)
`,
"2.12.1": `
## New
- "Text to Path" text input window is now draggable.

## Fixed
- Minor fixes to the Polygon line feature introduced in 2.12.0. [#9580](https://github.com/excalidraw/excalidraw/pull/9580)
- Fix new Improved Unlock UI, where if a lock element was over an unlocked element, the unlocked element was not selectable. [#9582](https://github.com/excalidraw/excalidraw/pull/9582)
- Fixed ghost point issue when moving a shape after dragging a point in the line editor [#9530](https://github.com/excalidraw/excalidraw/pull/9530)

## New in ExcalidrawAutomate
${String.fromCharCode(96,96,96)}js
untils.inputPrompt({
  header: string,
  placeholder?: string,
  value?: string,
  buttons?: { caption: string; tooltip?:string; action: Function }[],
  lines?: number,
  displayEditorButtons?: boolean,
  customComponents?: (container: HTMLElement) => void,
  blockPointerInputOutsideModal?: boolean,
  controlsOnTop?: boolean,
  draggable?: boolean,
});
${String.fromCharCode(96,96,96)}
`,
"2.12.0": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/-fldh3cE2gs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed

- Dynamic styling was not working when frames were present in the scene.
- Minor fix to the screenshot feature. This also resolves the long-standing issue where window control buttons (close, minimize, maximize) appeared in full-screen mode.
- Fixed an issue where ALT/OPT + dragging an embeddable object sometimes failed, resulting in an empty object instead of dragging the element.

## New

- **Line Polygons**: Draw a closed line shape, and it will automatically snap into a polygon. [#9477](https://github.com/excalidraw/excalidraw/pull/9477)
  - Updated the Split Ellipse and Boolean Operations scripts to support this feature.
  - When entering line editor mode (CTRL/CMD + click), the lock point is now marked for easier editing. You can break the polygon using the polygon action in the elements panel.
- **Popout Override**: The "Open the back-of-the-note for the selected image in a popout window" action now overrides the "Focus on Existing Tab" setting and always opens a new popout.
- **Text Arch Enhancements**: The Text Arch script now supports fitting text to a wider range of paths and shapes. Text can also be edited and refitted to different paths.
- **Improved Unlock UI**: Single-clicking a locked element now shows an unlock button. [#9546](https://github.com/excalidraw/excalidraw/pull/9546)
- **Script Update Alerts**: On startup, Excalidraw will notify you if any installed scripts have available updates.
`,
"2.11.1": `
## Fixed:
- The new "Screenshot" option in the Export Image dialog was not working properly. [#2339](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2339)

## New from Excalidraw.com
- Quarter snap points for diamonds [#9387](https://github.com/excalidraw/excalidraw/pull/9387)
- Precise highlights for bindings [#9472](https://github.com/excalidraw/excalidraw/pull/9472)

`,
"2.11.0": `
## New
- New "Screenshot" option in the Export Image dialog. This allows you to take a screenshot of the current view, including embedded web pages, youtube videos, and markdown documents. Screenshot is only possible in PNG.
- Expose parameter in plugin settings to disable AI functionality [#2325](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2325)
- Enable (disable) double-click text editing option in Excalidraw appearance and behavior (based on request on Discord)
- Added two new PDF export sizes: "Match image", "HD Screen".
- Switch between basic shapes. Quickly change the shape of the selected element by pressing TAB [#9270](https://github.com/excalidraw/excalidraw/pull/9270)
- Updated the Scribble Helper Script. Now controls are at the top so your palm does accidently trigger them. I added a new button to insert special characters. Scribble helper now makes use of the new text element wrapping in Excalidraw.

## Fixed in the plugin
- Scaling multiple embeddables at once did not work. [#2276](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2276)
- When creating multiple back-of-the-note the second card is not created correctly if autosave has not yet happened.
- Drawing reloads while editing the back-of-the-note card in certain cases causes editing to be interrupted.
- Moved Excalidraw filetype indicator ✏️ to after filename where other filetype tags are displayed. You can turn the filetype indicator on/off in plugin settings under Miscellaneous.

## Fixed by Excalidraw.com
- Alt-duplicate now preserves the original element. Previously, using Alt to duplicate would swap the original with the new element, leading to unexpected behavior and several downstream issues. [#9403](https://github.com/excalidraw/excalidraw/pull/9403)
- When dragging the arrow endpoint, update the binding only on the dragged side [#9367](https://github.com/excalidraw/excalidraw/pull/9367)
- Laser pointer trail disappearing on pointerup [#9413](https://github.com/excalidraw/excalidraw/pull/9413) [#9427](https://github.com/excalidraw/excalidraw/pull/9427)
`,
"2.10.1": `

## Fixed by Excalidraw.com
- Eraser performance improvement regression. Erasing locked elements. [#9400](https://github.com/excalidraw/excalidraw/pull/9400)

## New
- Grid Customization Options in plugin settings (appearance and behavior/grid): You can now selectively show or hide vertical and horizontal grid lines independently. This allows you to create alternative grid styles, such as horizontal-only lined grids instead of the traditional checkered pattern.

## Fixed in ExcalidrawAutomate
- ${String.fromCharCode(96)}ea.createSVG${String.fromCharCode(96)} throws error [#2321](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2321)

---

## ❤️ Enjoying the plugin?

Support my work by checking out my new book, now available for pre-order:  
[Sketch Your Mind: Nurture a Playful and Creative Brain](https://sketch-your-mind.com) is about visual Personal Knowledge Management. It explores the thinking behind Excalidraw and how it helps you structure and evolve ideas visually. It’s the book I wish I had when I began my own PKM journey.

<div class="ex-coffee-div"><a href="https://sketch-your-mind.com"><img src="https://raw.githubusercontent.com/zsviczian/sketch-your-mind/refs/heads/main/images/cover-mini.jpg" border="0" alt="Pre-order Sketch Your Mind"  height="100%"></a></div>
`,
"2.10.0": `
## New from Excalidraw.com
- Lasso select [#9169](https://github.com/excalidraw/excalidraw/pull/9169)
- Add container to multiple text elements [#9348](https://github.com/excalidraw/excalidraw/pull/9348)

## Fixed from Excalidraw.com
- Rounded diamond edge elbow arrow U route [#9349](https://github.com/excalidraw/excalidraw/pull/9349)
- Improved eraser performance [#9352](https://github.com/excalidraw/excalidraw/pull/9352)
- Keep arrow label horizontal [#9364](https://github.com/excalidraw/excalidraw/pull/9364)

## Fixed in ExcalidrawAutomate
- ${String.fromCharCode(96)}ea.addText${String.fromCharCode(96)} did not honor the width parameter.
`,
"2.9.2":`
- More minor fix. Toolbars are not responsive when dynamic styling is turned off. [#2287](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2287)
`,
"2.9.1":`
- Minor emergency fix. Reverting: [#9203](https://github.com/excalidraw/excalidraw/pull/9203)
`,
"2.9.0":`
## New
- QoL improvement: The context menu requires a longer press and hold for it to be displayed on mobile devices. When you want to precision adjust an element it happens that you linger on the point for just a little longer and the context menu appears unwantedly.
- Elbow arrow improvements [#9236](https://github.com/excalidraw/excalidraw/pull/9236), [#8593](https://github.com/excalidraw/excalidraw/pull/8593), [#9197](https://github.com/excalidraw/excalidraw/pull/9197), [#9191](https://github.com/excalidraw/excalidraw/pull/9191), [#9236](https://github.com/excalidraw/excalidraw/pull/9236)

## Fixed Obsidian 1.8.9 regressions
- Custom references (like #^group) broken in Live Preview in Obsidian 1.8.9 due to translation update [#2279](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2279)
- Excalidraw tabs only show on a second click on Obsidian Mobile

## Refactoring
- The Excalidraw component moved to React 19. Obsidian for now remains on React 18. This refactoring ensures that Excalidraw continues to work in Obsidian and Obsidian will receive future Excalidraw updates. [#9182](https://github.com/excalidraw/excalidraw/pull/9182)
`,
"2.8.3":`
## Fixed
- Chinese translation not available since 2.8.0. [#2247](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2247)
- Since the most recent Samsung Android update, adding images from the gallery returns an Unsupported Image Type error. [#2245](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2245)
- Duplicating/removing frame while children selected [#9079](https://github.com/excalidraw/excalidraw/pull/9079)
`,
"2.8.2":`
## New
- Moved "Create new drawing" option up in the context menu [#2243](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2243)

## Fixed
- In rare cases drawing content gets overwritten with another drawing [#2152](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2152)
- "Wrap selection in frame" sets dark mode to light mode [#2240](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2240)
- Multiple bug fixes from Excalidraw.com
  - Elbow arrows within boxes [#9077](https://github.com/excalidraw/excalidraw/issues/9077)
  - Elbow arrow orthogonality [#9073](https://github.com/excalidraw/excalidraw/pull/9073)
  - Improve library sidebar performance [#9060](https://github.com/excalidraw/excalidraw/pull/9060)
  - Opacity slider now displays numerical value [#9009](https://github.com/excalidraw/excalidraw/pull/9009)
  - Resize a frame and its children together when box selecting the frame and its children together [#9031](https://github.com/excalidraw/excalidraw/pull/9031)
  - Excalidraw screen flickering in dark mode [#9057](https://github.com/excalidraw/excalidraw/pull/9057)
`,
"2.8.1":`
## Fixed
- Unable to open Excalidraw files after the 2.8.0 update. [#2235](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2235)
`,
"2.8.0":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/tWi5xTUTz7E" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- Updated "Export Image" dialog
  - 🚀 PDF Export option including tiling of images over multiple pages.  Only available on desktop :(
  - SVG to clipboard
  - More granular setting for padding and scale
  - Slideshow script can now print slides to PDF (update script from script store)
- Set local graph to show the links in the embeddable when it is activated/deactivated [#2200](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2200)

## Fixed
- Fixed several LaTeX issues. 🙏 @Sintuz [#1631](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1631), [#2195](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2195), [#1842](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1842)
- Fixed support for *.jfif and *.avif images [#2212](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2212)
- PDF++ selection is not correctly showing after embedded into a drawing (for some specific files) [#2213](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2213)
- iOS 18 can't upload image and library [#2182](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2182)
- Image block references are broken in hover previews [#2218](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2218)
  - ⚠️ Note there is a known issue in Obsidian 1.8.2 ⚠️ affecting preview windows in Excalidraw. I received confirmation that this will be fixed in 1.8.3. For now, if hover previews are important to you, you can downgrade to Obsidian 1.8.1 [#2228](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2225) 
- Mobile elements panel and context menu are not scrollable  [#2216](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2216)
- "Local Font" menu disappears when opening a drawing in an Obsidian popout-window [#2205](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2205)

## Updates from Excalidraw.com
- Pressing delete on a frame will only delete the children [#9011](https://github.com/excalidraw/excalidraw/pull/9011)
- New crowfoot arrowheads and a new arrowhead picker [#8942](https://github.com/excalidraw/excalidraw/pull/8942)
- Fixed some of the arrow binding issues [#9010](https://github.com/excalidraw/excalidraw/pull/9010), [#2209](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2209)
- New context menu action: "Wrap selection in frame" [#9005](https://github.com/excalidraw/excalidraw/pull/9005)
- Elbow arrow segment fixing and positioning [#8952](https://github.com/excalidraw/excalidraw/pull/8952)
- When drag creating a new frame, do not add a partial group to it. When wrapping a selected partial group in a frame however, do add it to the wrapping frame. But such that it should be separated from the previous containing group. [#9014](https://github.com/excalidraw/excalidraw/pull/9014)

## New in ExcalidrawAutomate
- New hook: ${String.fromCharCode(96)}onImageFileNameHook${String.fromCharCode(96)}. When set, this callback is triggered when a image is being saved in Excalidraw.
- PDF export functions, paving the way for slideshow to export slides to PDF
${String.fromCharCode(96,96,96)}ts
/**
 * Returns the dimensions of a standard page size in pixels.
*/
function getPagePDFDimensions(
  pageSize: PageSize,
  orientation: PageOrientation
): PageDimensions;

/**
 * Creates a PDF from the provided SVG elements with specified scaling and page properties.
*/
function createPDF(props: {
  SVG: SVGSVGElement[];
  scale?: PDFExportScale;
  pageProps?: PDFPageProperties;
  filename: string;
}): Promise<void>;

/**
 * Creates an SVG representation of the current view.
*/
function createViewSVG(props : {
  withBackground?: boolean;
  theme?: "light" | "dark";
  frameRendering?: FrameRenderingOptions;
  padding?: number;
  selectedOnly?: boolean;
  skipInliningFonts?: boolean;
  embedScene?: boolean;
}): Promise<SVGSVGElement>;

/**
 * If set, this callback is triggered when a image is being saved in Excalidraw.
 * You can use this callback to customize the naming and path of pasted images to avoid
 * default names like "Pasted image 123147170.png" being saved in the attachments folder,
 * and instead use more meaningful names based on the Excalidraw file or other criteria,
 * plus save the image in a different folder.
 * 
 * If the function returns null or undefined, the normal Excalidraw operation will continue
 * with the excalidraw generated name and default path.
 * If a filepath is returned, that will be used. Include the full Vault filepath and filename
 * with the file extension.
 * The currentImageName is the name of the image generated by excalidraw or provided during paste.
 */
function onImageFilePathHook: (data: {
  currentImageName: string;
  drawingFilePath: string;
}) => string = null;  
${String.fromCharCode(96,96,96)}
`,
};
