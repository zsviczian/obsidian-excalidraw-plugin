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
"2.19.2":`
## Fixed
- Minor fixes to the link autocomplete functionality:
  - Link suggester "eats up text" [#2603](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2603)
  - "!" triggers the link suggester prematurely
  - "\[\[" will now be auto-completed to "\[\[]]". Note, this is not available in MindMap Builder currently.

## New
- When a persistent Excalidraw script is updated via the script store, it will now automatically reload so the new script takes effect immediately.

`,
"2.19.1":`
## Fixed
- Excalidraw pointer offset issue on Obsidian Mobile 1.11.4 [#2607](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2607)

## New
- Inline autocomplete link suggester now supports Heading sections and block references.
- Escaped "\\\\["  will now be rendered as "[" in text elements.
- Scaling the LaTeX element when the formula is updated. [#2604](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2604) 🙏[@TravisLEBLANC1](https://github.com/TravisLEBLANC1)

## New in ExcalidrawAutomate
- Added PDF++ image link support to the \`addImage()\` function.

`,
"2.19.0":`
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=qY66yoobaX4" target="_blank"><img src ="https://i.ytimg.com/vi/qY66yoobaX4/maxresdefault.jpg" style="width:100%;"></a>
</div>

## New
- 🚀🎉🍾 Added **inline link autocomplete** to text element editing and element link editing. Simply start typing "[[" as you would in a normal markdown document.
  - ‼️ removed add link button element-link editor on desktop
  - ‼️ removed add link from context menu on desktop
  - ‼️ added new setting under "Links, transclusion and TODOs" **Sync text-element link with text**
    - The default behavior is OFF, because it feels more natural to manage the element link separately.
    - When enabled (ON), Excalidraw matches pre-2.19.0 behavior: the first link in the text body is always copied to the element link field. SVG/PNG exports only keep links when the element link field holds a single link (not links inside the text body). Turn this ON if you rely on text-body links and want the element link to always mirror the first one. Turn it OFF if you manage the element link separately: for metadata like tags, inline link ontologies, or multiple links, e.g., dataview-style notes like '(reminds me of:: [[link]]) #noteToSelf'.
- LaTeX formula is saved to \`element.customData.latex\`. This can be helpful for various automation use cases.
- Implemented Color Picker in Custom Pen Settings to pick from the current view's color palette.
- Updated the **Scribble Helper** script with the new Color Picker to select the text color.
- Updated the **Shade Maser** script with the new Color Picker to select the shading color.
- **Mindmap Builder**
  - Uses new sidepanel, persistent across different drawings and autostarts with Obsidian.
  - You can now configure hotkeys
  - Allows editing node text in place
  - You can define your own color palette for branches
  - Improved auto-layout algorithm to work better with larger subtrees
  - Includes inline link suggester
  - Image and Embeddable nodes

## Fixed
- Floating modal used by Excalidraw scripts did not work correctly in Obisidian popout windows.
- In onPaste if \`imageElement.customData.latex\` is present, it will treat the pasted images as a LaTeX formula, even if copied from Excalidraw.com or another Obsidian Vault.

## New & fixed in ExcalidrawAutomate
- \`ea.toClipboard()\` will now include the DataURL for included images from \`ea.imagesDict\`
- Implemented Excalidraw Sidepanel API for ExcalidrawAutomate. Scripts can now create custom Obsidian sidepanel tabs in the Excalidraw Sidepanel.
  - New Command Palette action: "Open Excalidraw Sidepanel" will toggle the sidepanel visibility.
  - The demo script making full use of the new sidepanel API is [Mindmap Builder](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20Builder.md).
  - [ExcalidrawAutomate full library for LLM training.md](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/master/docs/AITrainingData/ExcalidrawAutomate%20full%20library%20for%20LLM%20training.md) includes all necessary training information to use sidepanels.
- Added palette popover helper \`showColorPicker()\` (also used in Pen Settings and Mindmap Builder) to pick from the current view's canvas/element palettes.
- Added inline link suggester helper \`attachInlineLinkSuggester()\` returning a KeyBlocker interface so host scripts can suppress their own keydown handlers while the suggester is active.

New functions in ExcalidrawAutomate. See also [SidepanelTab](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/types/sidepanelTabTypes.ts) type definition.

\`\`\`ts
sidepanelTab: ExcalidrawSidepanelTab | null;
checkForActiveSidepanelTabForScript(scriptName?: string): ExcalidrawSidepanelTab | null;
createSidepanelTab(title: string, persist?: boolean, reveal?: boolean): Promise<ExcalidrawSidepanelTab | null>;
getSidepanelLeaf(): WorkspaceLeaf | null;
toggleSidepanelView(): void;
persistSidepanelTab(): ExcalidrawSidepanelTab | null;
attachInlineLinkSuggester(inputEl: HTMLInputElement, widthWrapper?: HTMLElement): KeyBlocker;
getViewColorPalette(palette: "canvasBackground"|"elementBackground"|"elementStroke"): (string[] | string)[];
showColorPicker(anchorElement: HTMLElement, palette: "canvasBackground"|"elementBackground"|"elementStroke", includeSceneColors: boolean = true): Promise<string | null>;
\`\`\`

- **setView() improvements**
  - Calling \`setView()\` now picks a sensible target automatically:
    - It prefers the **currently active Excalidraw view**.
    - If no active Excalidraw view is found (e.g., the user is focused on a different tab like the File Explorer/sidebar), it will fall back to the **last active Excalidraw view (as long as it is still available)** — typically the drawing the user came from.
  - **New selector**: \`"auto"\` (equivalent to calling \`setView()\`).
    - Useful when you also want to reveal/focus the view: \`setView("auto", true)\`.
  - **Deprecated selectors**: \`"active"\` and \`"first"\` are deprecated and kept only for backward compatibility.
    - Recommended usage is either \`setView()\`, \`setView("auto")\`, or \`setView(excalidrawView)\` (explicitly target a specific view).

\`\`\`ts
setView(view?: ExcalidrawView | "auto" | "first" | "active" | null, show: boolean = false)
\`\`\`
`,
"2.18.3":`
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=dZguonMP2KU" target="_blank"><img src ="https://i.ytimg.com/vi/dZguonMP2KU/maxresdefault.jpg" style="width:100%;"></a>
</div>

## New
- Added Mindmap Builder script to the store.
- LaTeX Suit Integration by [@TravisLEBLANC1](https://github.com/TravisLEBLANC1)
- Added Linear Calendar Generator script to the store. 🙏 [@iwanhoogendoorn](https://github.com/iwanhoogendoorn)

## Fixed
- YouTube video embeds working on iOS  [#2569](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2569)
- Stroke color setting for Embeddedables (markdown notes, websites) is missing after 2.17.0 update [#2580](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2580)
- Context menu paste pastes in image twice [#10542](https://github.com/excalidraw/excalidraw/issues/10542)

## New in ExcalidrawAutomate
- Added 3 new helper functions for working with Script Engine settings (safe during initialization when \`scriptEngineSettings[activeScript]\` is \`undefined\` / \`null\`):
  - \`setScriptSettingValue(key: string, value: ScriptSettingValue): void\`
  - \`getScriptSettingValue(key: string, defaultValue: ScriptSettingValue): ScriptSettingValue\`
  - \`saveScriptSettings(): Promise<void>\`

- Updated \`addArrow()\` to support the new Excalidraw binding options:
  - \`startBindMode?: "inside" | "orbit"\`
  - \`endBindMode?: "inside" | "orbit"\`
  - \`startFixedPoint?: [number, number]\`
  - \`endFixedPoint?: [number, number]\`
  - \`elbowed?: boolean\`

\`\`\`ts
  /**
   * Returns an object describing the bound text element.
   * If a text element is provided:
   *  - returns { eaElement } if the element is in ea.elementsDict
   *  - else (if searchInView is true) returns { sceneElement } if found in the targetView scene
   * If a container element is provided, searches for the bound text element:
   *  - returns { eaElement } if found in ea.elementsDict
   *  - else (if searchInView is true) returns { sceneElement } if found in the targetView scene
   * If not found, returns {}.
   * Does not add the text element to elementsDict.
   * @param element 
   * @param searchInView - If true, searches in the targetView elements if not found in elementsDict.
   * @returns Object containing either eaElement or sceneElement or empty if not found.
   */
  getBoundTextElement(element: ExcalidrawElement, searchInView: boolean = false): {
    eaElement?: Mutable<ExcalidrawTextElement>,
    sceneElement?: ExcalidrawTextElement
    };
\`\`\`
`,
"2.18.2":`
## Fixed
- Stroke palette menu for embedded notes is gone after 2.17 update [#2580](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2580)
- Cannot link to group [#2579](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2579)

`,
"2.18.1":`
## New
- Improved the **Copy [[link]] for selected elements** context-menu action:
  - Added an optional checkbox to append the \`|100%\` anchor to the copied link.
  - Added an option to copy by **frame name** (instead of frame ID) when the frame is named.

## Fixed
- Prevented unnecessary \`data.json\` saves each time a drawing is opened. [#2562](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2562)
- Fixed angle snapping when a line passes over an object.
- Fixed hover preview when referencing a frame by name in an image reference.
- Fixed “Back of note” card insertion breaking LaTeX equations in existing cards. [#2296](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2296) 🙏[@TravisLEBLANC1](https://github.com/TravisLEBLANC1)
- Adjusted hover-preview sizing to more closely match embeds. [#2525](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2575) 🙏[parkero](https://github.com/parkero)
`,
"2.18.0":`
## New from Excalidraw.com
- 🔥🔥🔥 New arrow behavior allows binding arrows to the inside of shapes and image! 🙏[mtolmacs](https://github.com/mtolmacs), [dwelle](https://github.com/dwelle) [#9670](https://github.com/excalidraw/excalidraw/pull/9670)

## New
- New option in the Export Dialog to **include/exclude internal links** when exporting to SVG or PDF.
  - Useful when sharing an SVG or PDF with others.
  - Internal links are links that point to files in your Obsidian vault.
  - By default, internal links are included in exports.
  - Use the new document property: \`export-internal-links: false\` to disable exporting internal links on a per-drawing basis.

## Fixed
- Memory leak issues
- Potential fix to Backspace and CTRL+V stopping working in text elements after extended use of Excalidraw.
- Improved detection of on-screen keyboard on mobile devices. (issue reported on [Discord](https://discord.com/channels/1026825302900494357/1444652800360316959))
- Insert any file, insert LaTeX and some other dialogs got hidden behind the on-screen keyboard on mobile devices. Dialogs appear at the top of the screen now on mobile devices.

## New in ExcalidrawAutomate
- **createSVG()** now exposes convertMarkdownLinksToObsidianURLs and includeInternalLinks parameters.
\`\`\`ts
async createSVG(
    templatePath?: string,
    embedFont: boolean = false,
    exportSettings?: ExportSettings, 
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
    convertMarkdownLinksToObsidianURLs: boolean = false,
    includeInternalLinks: boolean = true,
  ): Promise<SVGSVGElement>
\`\`\`
`,
"2.17.2":`
## Fixed
- Lasso selection tool is back in the more tools menu in tray-mode and desktop mode.
- "Toggle enable context menu" command palette action is available on mobile devices.
- FloatingModal window top-right close button did not work on mobile devices.
- Hover preview flashed for larger PDF hover previews, in some cases would not even show.
- Fixed: opanAI API URL in settings will be honored when creating code from diagram [#2540](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2540) 🙏[@threeq](https://github.com/threeq)
- Fixed export to PDF. Rounded images cropped from the left and the top were transformed incorrectly. [#2544](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2544)

## New
- Added configurable max tokens setting for OpenAI API [#2543](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2543) 🙏[@dddrop](https://github.com/dddrop)
`,
"2.17.1":`
## Fixed
- Excalibrain stopped working after the 2.17.0 update. Fixed. [#2532](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2532)
- Pinned scripts are not hidden in view mode when in phone UI mode.
`,
"2.17.0":`
## New
- Phone UI from Excalidraw.com [#9996](https://github.com/excalidraw/excalidraw/pull/9996)
- Custom pen settings now allow pen width to be set at 0.1 increments from 0.1 to 8.0
- Updated the "Palm Guard" script to support the change UI configurations.
- Restructured UI-Mode settings in plugin settings. You can now set the preference for UI mode for desktop and tablets.
  The old "prefer tray-mode" toggle has been removed. "Toggle Tray-Mode" changes to "Toggle UI-Mode".
- New command palette action: "Toggle enable context menu". This setting is helpful on Mobile devices, where the context menu may interfere with touch interactions. The setting is saved with the drawing, thus you can add it to your templates (then press CTRL+S to force save) if you want the context menu to be disabled by default.

## Fixed
- side panel does not attach correctly when library is pinned [#2510](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2510)
- Fixed print area when using marker frames and printing Slideshow to PDF
- The "Invert Colors" script and ExcalidrawAutomate bugs that resulted in broken colors and Excalidraw crashes in some cases after color inversion.
- Fixed duplicated PDF elements after copy-pasting from scene to scene.
- Resolved the large gap at the top on iOS devices. As it turns out, Apple adds additional padding automatically to avoid collision with the notch.
- Fixed the positioning of the "Canvas and Shape Properties" window.
- Attempt to fix the mobile keyboard pop-up, distorting the view.
- Added finalize multipoint-line button to compact layout
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
};
