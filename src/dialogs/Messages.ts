export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/o0exK-xFP3k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update you'll be prompted with the release notes. You can disable this in plugin settings.

I develop this plugin as a hobby, spending my free time doing this. If you find it valuable, then please say THANK YOU or...

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" height=45></a></div>
`,
"1.9.28":`
## Fixed & Improved
- Fixed an issue where the toolbar lost focus, requiring two clicks. This caused a problem when the hand tool was activated from ExcalidrawAutomate script when opening a drawing, causing buttons to stop working. [#1344](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1344)
- Resolved a caching issue affecting image area-links and group-links, making them work inconsistently. For more details, refer to the discussion on [Discord](https://discord.com/channels/1026825302900494357/1169311900308361318).
- Improved frame colors with Dynamic Coloring.
- Added support for multiline LaTeX formulas. [#1403](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1403)
- Fixed the issue of Chinese characters overlapping in MathJax. [#1406](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1406)

## New
- Added support for Mermaid to Excalidraw **Sequence Diagrams**.
- If an image contains an element link, clicking on the image will now open the link chooser, allowing you to decide whether to open the image or follow the element link.
- When hovering over an image that also has an element link, the hover preview will display the contents of the link.
- You can now choose to **import PDFs** in columns instead of rows. Additionally, you have the option to group all pages after import, which will improve the unlocking experience if you also lock pages on import.
- Introduced configuration options for the **Laser Tool**, including pointer color, decay length, and time. ([#1408](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1408), [#1220](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1220))

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/c0cad40a-1afc-42af-b41b-f912dd8a4e78)
`,
"1.9.27": `
## New
- Restructured plugin settings, added additional comments and relevant videos
- Added setting to change PDF to Image resolution/scale. This has an effect when embedding PDF pages to Excalidraw. A lower value will result in less-sharp pages, but better overall performance. Also, larger pages (higher scale value) were not accepted by Excalidraw.com when copying from Obsidian due to the 2MB image file limit.  Find the "PDF to Image" setting under "Embedding Excalidraw into your Notes and Exporting" setting. [#1393](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1393)

## Fixed
- When multiple Excalidraw Scripts were executed parallel a race condition occurred causing scripts to override each other
- I implemented a partial fix to "text detaching from figures when dragging them" [#1400](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1400)
- Regression: extra thin stroke removed with 1.9.26 [#1399](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1399)`,
"1.9.26":`
## Fixes and improvements from Excalidraw.com
- Freedraw shape selection issue, when fill-pattern is not solid [#7193](https://github.com/excalidraw/excalidraw/pull/7193)
- Actions panel UX improvement [#6850](https://github.com/excalidraw/excalidraw/pull/6850)

## Fixed in plugin
- After inserting PDF pages as image the size of inserted images were incorrectly anchored preventing resizing of pages. The fix does not solve the issue with already imported pages, but pages you import in the future will not be anchored. 
- Mobile toolbar flashes up on tab change on desktop
- Toolbar buttons are active on the first click after opening a drawing. This addresses the "hand" issue raised here: [#1344](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1344)
`,
"1.9.25":`
## Fixed
- Fixed issues with creating Markdown or Excalidraw files for non-existing documents [#1385](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1385)
- Resolved a bug where changing the section/block filter after duplicating a markdown embeddable now works correctly on the first attempt [#1387](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1387)

## New
- Easily create a markdown file and embed it as an embedded frame with a single click when clicking a link pointing to a non-existent file.
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/4b9de54d-2382-4a52-b500-918ba2a60133)
- Offline LaTeX support. The MathJax package is now included in the plugin, eliminating the need for an internet connection. [#1383](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1383), [#936](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/936), [#1289](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1289)

## Minor Updates from excalidraw.com
- Improved the laser pointer in dark mode.
- Removed bound arrows from frames.
- Enhanced fill rendering.
- Maintained the z-order of elements added to frames.

## New in ExcalidrawAutomate
- Introduced two LZString functions in ExcalidrawAutomate:
${String.fromCharCode(96,96,96)}typescript
compressToBase64(str:string):string;
decompressFromBase64(str:string):string;
${String.fromCharCode(96,96,96)}
`,
"1.9.24":`
## Fixed
- Resolved some hidden Image and Backup Cache initialization errors.

## New Features
- Introducing the ${String.fromCharCode(96)}[[cmd://cmd-id]]${String.fromCharCode(96)} link type, along with a new Command Palette Action: ${String.fromCharCode(96)}Insert Obsidian Command as a link${String.fromCharCode(96)}. With this update, you can now add any command available on the Obsidian Command palette as a link in Excalidraw. When you click the link, the corresponding command will be executed. This feature opens up exciting possibilities for automating your drawings by creating Excalidraw Scripts and attaching them to elements.

- I am thrilled to announce that you can now embed images directly from your local hard drive in Excalidraw. These files won't be moved into Obsidian. Please note, however, that these images won't be synchronized across your other devices. [#1365](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1365)

Check out the [updated keyboard map](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png)

<a href="https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png"><img src="https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png" width="100%" alt="Keyboard map"/></a>

Stay creative and productive with Excalidraw!
`,
"1.9.23":`
## Fixed
- Link navigation error in view mode introduced with 1.9.21 [#7120](https://github.com/excalidraw/excalidraw/pull/7120)
`,
"1.9.21":`
## Fixed:
- When moving a group of objects on the grid, each object snapped separately resulting in a jumbled-up image [#7082](https://github.com/excalidraw/excalidraw/issues/7082)

## New from Excalidraw.com:
- 🎉 Laser Pointer. Press "K" to activate the laser pointer, or find it under more tools. In View-Mode double click/tap the canvas to toggle the laser pointer

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/d3fc079d-9428-4a93-9a9b-1947ce9b6b57)
`,
"1.9.20":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/QB2rKRxxYlg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Fourth Font displays correctly in SVG embeds mode
- The re-colorMap map (see [1.9.19](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.9.19) for more info) did not work when either of the fill or stroke color properties of the image was missing.
- Excalidraw Pasting with middle mouse button on Linux [#1338](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1338) 🙏@Aeases 

### Fixed by excalidraw.com
- Excalidraw's native eyedropper fixes [#7019](https://github.com/excalidraw/excalidraw/pull/7019)

## New
- Now you can insert [Mermaid](https://mermaid.live/) diagrams as Excalidraw elements into your drawings (currently only the [Flowchart](https://mermaid.js.org/syntax/flowchart.html) type is supported, [other diagram types](https://mermaid.js.org/intro/#diagram-types) are inserted as Mermaid native images. 
  - ⚠️**This feature requires Obsidian API v1.4.14 (the latest desktop version). On Obsidian mobile API v1.4.14 is only available to Obsidian insiders currently**
  - If you want to contribute to the project please head over to [mermaid-to-excalidraw](https://github.com/excalidraw/mermaid-to-excalidraw) and help create the converters for the other diagram types.
- The Fourth Font now also supports the OTF format
- Disable snap-to-grid in grid mode by holding down the CTRL/CMD while drawing or moving an element [#6983](https://github.com/excalidraw/excalidraw/pull/6983)
- I updated the Excalidraw logo in Obsidian. This affects the logo on the tab and the ribbon.

### New from excalidraw.com
- Elements alignment snapping. Hold down the CTRL/CMD button while moving an element to snap it to other objects. [#6256](https://github.com/excalidraw/excalidraw/pull/6256)

### New in the script library
- The amazing shape [Boolean Operations](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Boolean%20Operations.md) script created by 🙏@GColoy is available in the script library.

### New in Excalidraw Automate
- ${String.fromCharCode(96)}getPolyBool()${String.fromCharCode(96)} returns a [PolyBool](https://github.com/velipso/polybooljs) object
- sample mermaid code:
${String.fromCharCode(96,96,96)}js
ea = ExcalidrawAutomate();
ea.setView();
await ea.addMermaid(
  ${String.fromCharCode(96)}flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]${String.fromCharCode(96)}
);
ea.addElementsToView();
${String.fromCharCode(96,96,96)}`,
"1.9.19":`
## New
- I added new features to the [Deconstruct Selected Elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Deconstruct%20selected%20elements%20into%20new%20drawing.md) script
- I added a new script: [Text Aura](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Text%20Aura.md)
- I updated the [Set Grid](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Grid.md) script. You can now set the Major/Minor tick frequency. [#1305](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1305)
- The re-colorMap is now case-insensitive. The color map is a hidden feature. In Markdown View mode you can add a JSON map after the embedded SVG or Excalidraw image filename with a mapping of current colors to new colors.
<img width="100%" src="https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/1d985a59-a2d2-48a2-9cef-686bfbe9ef02"/>

## New in ExcalidrawAutomate
- I added the ${String.fromCharCode(96)}silent${String.fromCharCode(96)} switch. If this is true, the created file will not be opened.
${String.fromCharCode(96,96,96)}typescript
  async create(params?: {
    filename?: string;
    foldername?: string;
    templatePath?: string;
    onNewPane?: boolean;
    silent?: boolean;
    frontmatterKeys?: {
      "excalidraw-plugin"?: "raw" | "parsed";
      "excalidraw-link-prefix"?: string;
      "excalidraw-link-brackets"?: boolean;
      "excalidraw-url-prefix"?: string;
      "excalidraw-export-transparent"?: boolean;
      "excalidraw-export-dark"?: boolean;
      "excalidraw-export-padding"?: number;
      "excalidraw-export-pngscale"?: number;
      "excalidraw-default-mode"?: "view" | "zen";
      "excalidraw-onload-script"?: string;
      "excalidraw-linkbutton-opacity"?: number;
      "excalidraw-autoexport"?: boolean;
    };
    plaintext?: string; //text to insert above the ${String.fromCharCode(96)}# Text Elements${String.fromCharCode(96)} section
  }): Promise<string>
${String.fromCharCode(96,96,96)}
`,
"1.9.18":`
## New
- Excalidraw now syncs with Obsidian's language settings, provided translations are available. [#1297](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1297)

## Fixed
- [#1285](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1285): Solved Obsidian crashes caused by copying images from Excalidraw into markdown notes. Going forward:
  - Copying an image will paste its embed link,
  - Copying a text element will paste the text,
  - For all other elements with links, the link will be pasted.
  - In all other cases nothing will be pasted.
  
- Resolved grid instability ([#1298](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1298)).
- Fixed missing ${String.fromCharCode(96)}[[square brackets]]${String.fromCharCode(96)} in PDF section references, making the links functional.
- Corrected the behavior of "Open current link in browser" for embedded YouTube and Vimeo frames. Clicking the globe button will now correctly open the links.
`,
"1.9.17":`
## New 
- Significant performance improvements from Excalidraw.com
- When selecting a highlight in the Obsidian PDF editor and selecting "Copy as Quote" in the context menu, then paste this to Excalidraw, the text will arrive as a text element wrapped in a transparent sticky note with the link to the original highlight attached to the sticky note. You can override this behavior by SHIFT+CTRL/CMD pasting

## Fixed
- BUG: Image caching issue. Changes to the drawing do not reflect immediately in the note when re-opening the drawing [#1297](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1279)
- Removed underline from links in NativeSVG embed.
`,
"1.9.16":`
I apologize for this extra release. I accidentally built 1.9.15 with an older excalidraw.com package version. Fixes and new features (like the improved grid) are now available again. Otherwise, this is the same as 1.9.15. Sorry for the inconvenience.
`,
"1.9.15":`
## New
- There is now a search box in the Excliadraw Script Store. I categorized the scripts and added keywords to help easier navigation.

## Fixed
- The theme of the embedded Markdown document did not always honor plugin settings. With some themes, it worked, with others (including the default Obsidian theme, it didn't). 
`,
"1.9.14":`
# Fixed
- **Dynamic Styling**: Excalidraw ${String.fromCharCode(96)}Plugin Settings/Display/Dynamic Styling${String.fromCharCode(96)} did not handle theme changes correctly.
- **Section References**: Section Headings that contained a dot (e.g. #2022.01.01) (or other special characters) did not work when focusing markdown embeds to a section. [#1262](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1262)
- **PNG Export**: When using images from the web (i.e. based on URL and not a file from your Vault), embedding the Excalidraw file into a markdown document as PNG, or exporting as PNG failed. This is because due to browser cross-origin restrictions, Excalidraw is unable to access the image. In such cases, a placeholder will be included in the export, but the export will not fail, as until now.

# New in ExcalidrawAutomate
- ${String.fromCharCode(96)}getActiveEmbeddableViewOrEditor${String.fromCharCode(96)} will return the active editor and file in case of a markdown document or the active leaf.view for other files (e.g. PDF, MP4 player, Kanban, Canvas, etc) of the currently active embedded object. This function can be used by plugins to check if an editor is available and obtain the view or editor to perform their actions. Example: [package.json](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/package.json#L23), [Checking for EA](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/src/excalibrain-main.ts#L114-L127), and [Running the function](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/src/excalibrain-main.ts#L362-L399)

${String.fromCharCode(96,96,96)}typescript
public getActiveEmbeddableViewOrEditor (view?:ExcalidrawView): {view:any}|{file:TFile, editor:Editor}|null;
${String.fromCharCode(96,96,96)}
`,
"1.9.13":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/opLd1SqaH_I" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

# New
- **Templater support**: You can now execute Templater scripts on an embedded Markdown document when the document is active for editing
- **Interactive image-embeds**: I added a new image embed option "SVG Native". In "SVG Native" mode embedded items such as videos, webpages, and links (including links within the Vault) work.
- **Anchored image resizing**: When you embed an Excalidraw drawing using the Anchor to 100% option, resizing the image will be disabled.

# Fixed
- when opening a new document in the Excalidraw view while a markdown document was open for editing in an embeddable, Excalidraw terminated with errors
- shift-click to select multiple elements
- dynamic styling when canvas background with transparent
 
# New in ExcalidrawAutomate
- added openState to the ${String.fromCharCode(96)}openFileInNewOrAdjacentLeaf${String.fromCharCode(96)}. For details see: [OpenViewState](https://github.com/obsidianmd/obsidian-api/blob/f86f95386d439c19d9a77831d5cac5748d80e7ec/obsidian.d.ts#L2686-L2695)
${String.fromCharCode(96,96,96)}typescript
openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf
${String.fromCharCode(96,96,96)}
`,
"1.9.12":`
## New
- If you create a Text Element that includes only a transclusion e.g.: ${String.fromCharCode(96)}![[My Image.png]]${String.fromCharCode(96)} then excalidraw will automatically replace the transclusion with the embedded image.
- New Excalidraw splash screen icon contributed by Felix Häberle. 😍

<div class="excalidraw-image-wrapper">
<img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-sword-mini.png'/>
</div>

## Fixed
- Popout windows behaved inconsistently losing focus at the time when a markdown file was embedded. Hopefully, this is now working as intended.
- A number of small fixes that will also improve the ExcaliBrain experience
`,
"1.9.11":`
# New
- I added 2 new command palette actions: 1) to toggle frame clipping and 2) to toggle frame rendering.

# Updated
- I released a minor update to the slideshow script. Frame sequence (Frame 1, 2, 3, ...) will now be displayed in proper order. Frames will be hidden during the presentation (this was there before, but there was a change to excalidraw.com that broke this feature of the slideshow script).

# Fixed: 
- Excalidraw Automate error introduced with 1.9.10 - when elements are repositioned to cursor and no ExcalidrawView is active
`,
"1.9.10":`
## New
- @mazurov added a new script: [Ellipse Selected Elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Ellipse%20Selected%20Elements.md)

## Fixed
- **Image Saving Error**: Previously, inserting an image from Firebase Storage or other URLs could result in an error that prevented the entire drawing from being saved. I have now improved the error handling and image fetching from the web, ensuring smooth image insertion and saving.  
- **Text Search Bug**: There was an issue where text search failed when frames had default names like "Frame 1," "Frame 2," etc. This has been resolved, and now the text search works correctly in such cases. ([#1239](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1239))   
- **Image Positioning Fix**: An annoying bug caused the image to jump after inserting it using the "Insert Image" command palette action. I've fixed this issue, and now the image behaves as expected when positioning it for the first time.
`,
"1.9.9":`
## ⚠️⚠️ IMPORTANT: PLEASE READ ⚠️⚠️

I updated embedded frames for compatibility with excalidraw.com. To ensure everything works smoothly:

🔄 Update Excalidraw on all your devices.

This will avoid any issues with converted files and let you enjoy the new features seamlessly.

Thank you for your understanding. If you have any questions, feel free to reach out.

---

## Fixed:
- PNG image caching resulting in broken images after Obsidian restarts
- SVG export now displays embedded iframes with the correct embed link (note this feature only works when you open the SVGs in a browser outside Obsidian).

## Updated / fixed in Excalidraw Automate
- I updated ${String.fromCharCode(96)}lib/ExcalidrawAutomate.d.ts${String.fromCharCode(96)} and published a new version of obsidian-excalidraw-plugin type library to npmjs.
- Added new ExcalidrawAutomate functions: ${String.fromCharCode(96)} addEmbeddable()${String.fromCharCode(96)}, ${String.fromCharCode(96)}DEVICE${String.fromCharCode(96)}, ${String.fromCharCode(96)}newFilePrompt()${String.fromCharCode(96)}, and ${String.fromCharCode(96)}getLeaf()${String.fromCharCode(96)}
- ${String.fromCharCode(96)}addImage${String.fromCharCode(96)} and ${String.fromCharCode(96)}addElementsToView${String.fromCharCode(96)} were extended with 1-1 additional optional parameter. As a result of ${String.fromCharCode(96)}shouldRestoreElements${String.fromCharCode(96)} defaulting to false, all elements in the scene will no longer be updated (iframes will not blink) when you add elements via script.
- There is a new event hook: ${String.fromCharCode(96)}onPasteHook${String.fromCharCode(96)}. This will be called whenever the user pastes something to the canvas. You can use this callback if you want to do something additional during the onPaste event. In case you want to prevent the Excalidraw default onPaste action you must return false

${String.fromCharCode(96,96,96)}typescript
async addImage(
  topX: number,
  topY: number,
  imageFile: TFile | string,
  scale: boolean = true,
  anchor: boolean = true,
): Promise<string>;

async addElementsToView(
  repositionToCursor: boolean = false,
  save: boolean = true,
  newElementsOnTop: boolean = false,
  shouldRestoreElements: boolean = false,
): Promise<boolean>;

 onPasteHook: (data: {
  ea: ExcalidrawAutomate;
  payload: ClipboardData;
  event: ClipboardEvent;
  excalidrawFile: TFile;
  view: ExcalidrawView;
  pointerPosition: { x: number; y: number };
 }) => boolean = null;

addEmbeddable(
  topX: number,
  topY: number,
  width: number,
  height: number,
  url?: string,
  file?: TFile
): string;

get DEVICE(): DeviceType;

newFilePrompt(
  newFileNameOrPath: string,
  shouldOpenNewFile: boolean,
  targetPane?: PaneTarget,
  parentFile?: TFile
): Promise<TFile | null>;

getLeaf(
  origo: WorkspaceLeaf,
  targetPane?: PaneTarget
): WorkspaceLeaf;
${String.fromCharCode(96,96,96)}
`,
"1.9.8":`
## New Features
- Zoom to heading and block in markdown frames.
- Added an iframe menu that allows users to change heading/block zoom, center the element, and open it in the browser.
- Replaced twitframe with platform.twitter for tweets. The "Read more" and "Reply" buttons now work. Embedded tweets will honor theme settings.

## Bug Fixes
- Fixed an issue where embedded markdown frames disappeared in fullscreen mode. [#1197](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1197)
- Resolved a problem with the "Embed Markdown as Image" feature where changes to embed properties were not always honored. [#1201](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1201)
- When inserting any file from the Vault and embedding a Markdown document as an image, the embed now correctly honors the section heading if specified. [#1200](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1200)
- SVG and PNG autoexport now function properly when closing a popout window. [#1209](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1209)
- Many other minor fixes
`,
"1.9.7":`
## Fixed:

- Fixed an issue where using the color picker shortcut would cause the UI to disappear in mobile view mode.
- You can now add YouTube playlists to iframes.
- Fixed a bug where the "Add any file" dropdown suggester opened in the main Obsidian workspace instead of the popout window when Excalidraw was running. ([#1179](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1191))
- Made some improvements to the logic of opening in the adjacent pane, although it is still not perfect.
- Fixed an issue where Obsidian sync would result in the loss of the last approximately 20 seconds of work. Excalidraw's handling of sync is now fixed. ([#1189](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1189))

## New:

- Introducing Image Cache: Excalidraw will now cache rendered images embedded in Markdown documents, which will enhance the markdown rendering experience.
- Backup Cache: Excalidraw now stores a backup on your device when saving, in case the application is terminated during a save operation. If you are using sync, you can find the latest backup on the device you last used to edit your drawing.
- Added ${String.fromCharCode(96)}frame=${String.fromCharCode(96)} parameter to image references. ([#1194](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1194)) For more details about this feature, check out this [YouTube video](https://youtu.be/yZQoJg2RCKI).
- When an SVG image from Draw.io is embedded in Excalidraw, clicking the image will open the file in the [Diagram plugin](https://github.com/zapthedingbat/drawio-obsidian) (if available).
- Added the [Create DrawIO file](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Create%20DrawIO%20file.md) Excalidraw Automate Script to the library, which allows you to create a new draw.io drawing and add it to the current Excalidraw canvas.

## New in ExcalidrawAutomate

${String.fromCharCode(96,96,96)}typescript
async getAttachmentFilepath(filename: string): Promise<string>
${String.fromCharCode(96,96,96)}

This asynchronous function retrieves the filepath to a new file, taking into account the attachments preference settings in Obsidian. It creates the attachment folder if it doesn't already exist. The function returns the complete path to the file. If the provided filename already exists, the function will append '_[number]' before the extension to generate a unique filename.

${String.fromCharCode(96,96,96)}typescript
getElementsInFrame(frameElement: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[];
${String.fromCharCode(96,96,96)}

This function returns the elements contained within a frame.
`,
"1.9.6":`
## Fixed
- help shortcuts are really hard to see [#1176](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1179)
- link icons not visible on elements after 1.9.5 release (reported on Discord)
- PDFs in iFrames will now respect the ${String.fromCharCode(96)}[[document.pdf#page=155]]${String.fromCharCode(96)} format
- Keyboard shortcuts were not working properly on external drop. Check [updated keyboard map](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png)

<a href="https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png"><img src="https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png" width="100%" alt="Keyboard map"/></a>
`,
"1.9.5":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/ICpoyMv6KSs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- IFrame support: insert documents from your Obsidian Vault and insert youtube, Vimeo, and generally any website from the internet
- Frame support: use frames to group items on your board

## New in ExcalidrawAutomate
- selectElementsInView now also accepts a list of element IDs
- new addIFrame function that accepts an Obsidian file or a URL string
${String.fromCharCode(96,96,96)}typescript
selectElementsInView(elements: ExcalidrawElement[] | string[]): void;
addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string;
${String.fromCharCode(96,96,96)}
`,

"1.9.3":`
## New from Excalidraw.com
- Eyedropper tool. The eyedropper is triggered with "i". If you hold the ALT key  while clicking the color it will set the stroke color of the selected element, else the background color.
- Flipping multiple elements
- Improved stencil library rendering performance + the stencil library will remember the scroll position from the previous time it was open

## Fixed
- Replaced command palette and tab export SVG/PNG/Excalidraw actions with "export image" which will take the user to the export image dialog.
`,
"1.9.2":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/diBT5iaoAYo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- Excalidraw.com Color Picker redesign [#6216](https://github.com/excalidraw/excalidraw/pull/6216)
- Updated palette loader script in the script library
- New ExcalidrawAutomate API to load Elements and AppState from another Excalidraw file.
${String.fromCharCode(96,96,96)}typescript
async getSceneFromFile(file: TFile): Promise<{elements: ExcalidrawElement[]; appState: AppState;}>
${String.fromCharCode(96,96,96)}
`,
"1.9.1":`
## Updates from Excalidraw.com
- "Unlock all elements" - new action available via the context menu [#5894](https://github.com/excalidraw/excalidraw/pull/5894)
- Minor improvements to improve the speed [#6560](https://github.com/excalidraw/excalidraw/pull/6560)
- Retain Seed on Shift Paste [#6509](https://github.com/excalidraw/excalidraw/pull/6509)

## New/Fixed
- Clicking on the link handle (top right corner) will open the link in the same window
- CTRL/CMD click on a link will open the link in a new tab and will focus on the new tab
- Linking to parts of images. In some cases clicking search results, links, or backlinks did not focus on the right element according to the link.  Fixed.
`,
"1.9.0":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/nB4cOfn0xAs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Embedded images, markdowns, PDFs will load one by one, not in one go after a long wait

## New
- Embed PDF

## New in ExcalidrawAutomate
- onFileCreateHook: if set this hook is called whenever a new drawing is created using Excalidraw command palette menu actions. If the excalidraw file is created using Templater or other means, the trigger will not fire. [#1124](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124)
${String.fromCharCode(96,96,96)}typescript
  onFileCreateHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being created
    view: ExcalidrawView;
  }) => Promise<void>;
  ${String.fromCharCode(96,96,96)}
`,
"1.8.26":`
## Fixed
- Dynamic styling did not pick up correctly
  - the accent color with the default Obsidian theme
  - the drawing theme color with the out of the box, default new drawing (not using a template)
- The Obsidian tools panel did not pick up user scripts when installing your very first script. A reload of Obsidian was required.
`,
"1.8.25": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/BvYkOaly-QM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New & improved
- Multi-link support
- Updated [Scribble Helper](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Scribble%20Helper.md) script for better handwritten text support. 
  - Add links to text elements
  - Creating wrapped text in transparent sticky notes
  - Add text to arrows and lines
  - Handwriting support on iOS via Scribble

## Fixed
  - The long-standing issue of jumping text
  
`,
"1.8.24": `
## Updates from Excalidraw.com
- fix: color picker keyboard handling not working
- fix: center align text when bind to the container via context menu
- fix: split "Edit selected shape" shortcut

## Fixed
- BUG: Area embed link of svg inside excalidraw embed entire svg instead of area [#1098](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1098)

## New
- I updated the [Scribble Helper](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Scribble%20Helper.md) script with tons of new features. I am still beta testing the script. I will release a demo video in the next few days.

## New in Excalidraw Automate
- I added many more configuration options for the scriptEngine utils.inputPrompt function. See [Scribble Helper](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Scribble%20Helper.md) for a demonstration of this new feature.
${String.fromCharCode(96,96,96)}typescript
  public static async inputPrompt(
    view: ExcalidrawView,
    plugin: ExcalidrawPlugin,
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: { caption: string; tooltip?:string; action: Function }[],
    lines?: number,
    displayEditorButtons?: boolean,
    customComponents?: (container: HTMLElement) => void
  )
${String.fromCharCode(96,96,96)}`,
"1.8.23": `
## Fixes
- Fixed palm rejection to prevent unwanted spikes when using the freedraw tool. ([#1065](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1065))
- Fixed issue where images disappeared when zoomed in. ([#6417](https://github.com/excalidraw/excalidraw/pull/6417))
- Autosave will now save the drawing when you change the theme from dark to light or vice versa. ([#1080](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1080))
- Added padding to short LaTeX formulas to prevent cropping. ([#1053](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1053))

## New Features
- Added a new command palette action: Toggle to invert default binding behavior. This new feature allows you to switch between normal and inverted mode. In normal mode, arrows will bind to objects unless you hold the CTRL/CMD key while drawing the arrow or moving objects. In inverted mode, arrows will not bind to objects unless you hold the CTRL/CMD key while drawing the arrow or moving objects.
- You can now set a template LaTeX formula in the plugin settings (under experimental features) to be used when creating a new LaTeX formula. ([#1090](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1090))
- Redesigned the Image Export dialog. I hope dropdowns are now more intuitive than the toggles were.
- Added the ability to export only the selected part of a drawing. See the Export dialog for more information.
- Added a zigzag fill easter egg. See a demo of this feature [here](https://twitter.com/excalidraw/status/1645428942344445952?s=61&t=nivKLx2vgl6hdv2EbW4mZg).
- Added a new expert function: recolor embedded Excalidraw and SVG images (not JPG, PNG, BMP, WEBP, GIF). See a demo of this feature here:

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/MIZ5hv-pSSs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`,
"1.8.22": `
## Fixed
- Styling of custom pen and script buttons in the side panel was inverted.
- Minor tweaks to dynamic styling. [see this video to understand dynamic styling](https://youtu.be/fypDth_-8q0)

## New
- New scripts by @threethan:
  - [Auto Draw for Pen](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Auto%20Draw%20for%20Pen.md): Automatically switches between the select and draw tools, based on whether a pen is being used. Supports most pens including Apple Pencil.
  - [Hardware Eraser Support](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Hardware%20Eraser%20Support.md): Adds support for pen inversion, a.k.a. the hardware eraser on the back of your pen. Supports Windows based styluses. Does not suppoprt Apple Pencil or S-Pen.
- Added separate buttons to support copying link, area or group references to objects on the drawing. [#1063](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1063). See [this video](https://youtu.be/yZQoJg2RCKI) for more details on how this works.
- Hover preview will no longer trigger for image files (.png, .svg, .jpg, .gif, .webp, .bmp, .ico, .excalidraw)
- Minor updates to the [Slideshow](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Slideshow.md) script. You can download the updated script from the Excalidraw script library.  The slideshow will now correctly run also when initiated in a popout window. When the drawing is in a popout window, the slideshow will not be full screen, but will only occupy the popout window. If you run the slideshow from the main Obsidian workspace, it will be displayed in full-screen mode.
- Updated the Icon Library script to now include image keywords under each of the images to allow searching for keywords (CTRL/CMD+F). I've uploaded the new script to [here](https://gist.github.com/zsviczian/33ff695d5b990de1ebe8b82e541c26ad). If you need further information watch this [video](https://youtu.be/_OEljzZ33H8)

## New in ExcalidrawAutomate
- ${String.fromCharCode(96)}addText${String.fromCharCode(96)} ${String.fromCharCode(96)}formatting${String.fromCharCode(96)} parameter now accepts ${String.fromCharCode(96)}boxStrokeColor${String.fromCharCode(96)} and ${String.fromCharCode(96)}textVerticalAlign${String.fromCharCode(96)} values.
${String.fromCharCode(96,96,96)}typescript
addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      wrapAt?: number;
      width?: number;
      height?: number;
      textAlign?: "left" | "center" | "right";
      box?: boolean | "box" | "blob" | "ellipse" | "diamond";
      boxPadding?: number;
      boxStrokeColor?: string;
      textVerticalAlign?: "top" | "middle" | "bottom";
    },
    id?: string,
  ): string;
${String.fromCharCode(96,96,96)}
- new ${String.fromCharCode(96)}onFileOpenHook${String.fromCharCode(96)}. If set, this callback is triggered, when an Excalidraw file is opened. You can use this callback in case you want to do something additional when the file is opened. This will run before the file level script defined in the ${String.fromCharCode(96)}excalidraw-onload-script${String.fromCharCode(96)} frontmatter is executed. Excalidraw will await the result of operations here.  Handle with care. If you change data such as the frontmatter of the underlying file, I haven't tested how it will behave.
${String.fromCharCode(96,96,96)}typescript
onFileOpenHook: (data: {
  ea: ExcalidrawAutomate;
  excalidrawFile: TFile; //the file being loaded
  view: ExcalidrawView;
}) => Promise<void>;
${String.fromCharCode(96,96,96)}`,
"1.8.21": `
## Quality of Life improvements
- Dynamic Styling (see plugin settings / Display). When Dynamic Styling is enabled it fixes Excalidraw issues with the Minimal Theme
- New "Invert Colors" script

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/fypDth_-8q0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

### Note
The few of you, that are using the Dynamic Styling Templater script, please remove it and restart Obsidian.
`,
"1.8.20": `
## Fixed
- Excalidraw froze Obsidian in certain rare situations [#1054](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1054)
- File loading error [#1062](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1062)
- Embedded images in markdown documents no longer have the line on the side. Image sizing works better. [#1059](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1059)
- Locked elements will not show a hover preview [#1060](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1060)
- CTRL/CMD + K correctly triggers add link [#1056](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1056)

## New
- Grid color adjusts to the view background color

I'm sorry, but the sticky note editing issue on Android with the on-screen keyboard has still not been resolved. If you also experience this error, please help raise the priority with the core Excalidraw team by commenting on this issue: [#6330](https://github.com/excalidraw/excalidraw/issues/6330)
`,
"1.8.19": `
## Fixed: Text wrapping issue in sticky notes

I fixed an issue where text would wrap differently and words would disappear during text editing in sticky notes. You can check out the details on [GitHub #6318](https://github.com/excalidraw/excalidraw/issues/6331).

I am aware of three additional issues related to container text editing that are still open. I apologize for any inconvenience caused by the recent change in how text size is calculated on Excalidraw.com, which has had a knock-on effect on Obsidian. I am actively working to address the following issues:

- Pinch zooming while editing text in a text container [GitHub #6331](https://github.com/excalidraw/excalidraw/issues/6331)
- Container text jumps on edit on Android with on-screen keyboard [GitHub #6330](https://github.com/excalidraw/excalidraw/issues/6330)
- Shadow text when editing text containers without a keyboard on iOS [GitHub #6329](https://github.com/excalidraw/excalidraw/issues/6329)

Thank you for your patience while I work on resolving these issues.
`,
"1.8.18": `
## Fixed
- Text scaling issue introduced in 1.8.17
- [#1043](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1043): Error handling when ${String.fromCharCode(96)}onCanvasColorChangeHook${String.fromCharCode(96)} is executed. This is used in the [Dynamic Styling Script](https://youtu.be/LtR04fNTKTM). 
`,
"1.8.17": `
## New from Excalidraw.com
- Improved text wrapping in the ellipse and diamond shapes [6172](https://github.com/excalidraw/excalidraw/pull/6172)

## New
- Updated slideshow script

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/mQ2eLk_0TV4" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed: 
- "Save to..." in the Stencil Library menu now works as expected [#1032](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1032)
`,
"1.8.16": `
**!!! Modifier keys have changed, please review the table below !!!**
[Click this to see the new shortcuts overview image](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png)

## Fixed 
- This version was extensively tested and developed on MacOS to remove usability issues.
- New command palette action to create a new drawing in a new tab
- Modifier keys to open links in the active window, splitting the current view to the right, in a new tab, or in a popout window now behave consistently both in Excalidraw and when clicking a drawing that is embedded in a markdown note.
- Drag & Drop properly works from within Obsidian, from a web browser, and from the OS file explorer

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/9HlipSIzRhc" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`,
"1.8.14":`
## Fixed
- text element link gets deleted when the drawing is reloaded
`,
"1.8.13": `
## Fixed
- When changing a text element in markdown mode, the change seem to have showed up when switching back to Excalidraw  mode, but then lost these changes when loading the file the next time.
- Scrolling through a page that has embedded drawings on Obsidian Mobile accidently opens the drawing in Excalidraw when touching the image. Now you need to press and hold to open the image in Excalidraw. [#1003](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1003)
- The scrollbar is no longer visible when presenting using the SlideShow script
- Stroke properties could not be changed when custom pen settings had "Stroke & fill applies to: All shapes". It works now.

## QoL
- Custom pens will remember the stroke changes until you press the pen preset button again.
  - This is a bit hard to explain, let me try... Essentially, when you use a custom pen, it will keep the changes you made to the pen (like changing the stroke width) until you press the pen-prereset button again. So, for example, if you're using a mind mapping custom pen and change its color, and then switch to a different tool like text, when you switch back to the freedraw tool using the Excalidraw tools panel, the pen will still have the same color you set earlier, but if you press the mind mapping pen-preset button, it will default back to your custom pen settings including your preset color.
- Added new buttons to load current stroke color and background color in the pen settings dialog. Also added an edit box so you can configure any valid color string (including with transparency) for pen stroke and background colors. [#991](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/991)
`,
"1.8.11": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/rBarRfcSxNo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

# New
- Support for referencing images from the internet in Excalidraw drawings, including YouTube thumbnail support. [#913](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/913)
  - Link to images on the internet without creating a copy in your Vault by holding down the CTRL key while dropping the link or image.
  - Automatic conversion of image URLs and YouTube links into image elements with original links added as a link on the element when pasting. Note, that if you only want to paste the plain text link (not the image), first double-click the canvas to start a new text element, then paste the link.
- Two new options added to plugin settings:
  - Make mouse wheel zoom by default [#474](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/474)
  - Allow pinch zoom in pen mode [#828](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/828)
- Update to the [Set Grid](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Grid.svg) script now saves the grid setting for the current file.
`,
"1.8.10": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/wTtaXmRJ7wg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

# QoL improvements
- You can structure icons in the Obsidian tools panel by moving scripts to folders
![image|300](https://user-images.githubusercontent.com/14358394/212389592-306130d0-209a-49df-99bb-c538f2155b23.png)
- I added useful actions to the hamburger menu in both tray-mode and normal-mode. 
![image|150](https://user-images.githubusercontent.com/14358394/212534508-9107fd19-27ab-4415-8abc-bc97c73afc0b.png)
- I added a new Export Image dialog. You can access the new export screen from the hamburger-menu
![image|200](https://user-images.githubusercontent.com/14358394/212534654-7a479e23-8d5d-452e-9a18-a9896278aa27.png)
- Links in help now point to Obsidian-Excalidraw relevant content.
- I added a welcome screen
![image|150](https://user-images.githubusercontent.com/14358394/212534568-3cd1e8a1-5b20-4a30-96e4-40d7dac57e33.png)
- I updated the alternative dark mode / dynamic styling [script](https://gist.github.com/zsviczian/c7223c5b4af30d5c88a0cae05300305c)
`,
"1.8.9":`
# Minor QoL improvements
- When you open a second drawing in the same Excalidraw view (i.e. by navigating a link) and make a change to this drawing, and then press UNDO, the entire drawing disappeared. Redo brought the image back, however, this behavior was frustrating. Not anymore...
- On iPad
  - when you open the command palette, autozoom resized the drawing. If the Obsidian command palette or some other modal window is shown Excalidraw will not resize the view.
  - when you add a link to the drawing using the Command Palette, sometimes the link was added in a far corner of the drawing outside the current view area. This should be fixed now.`,
"1.8.8":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/uZz5MgzWXiM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

# New
- The plugin now includes support for [Perfect Freehand](https://perfect-freehand-example.vercel.app/) pen-options. I've also added a new [Alternative Pens](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Alternative%20Pens.md) script.
- Embed scene in exported PNG and SVG images [#860](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/860).  This means that the export will be a normal PNG or SVG image with the added functionality that if someone loads the image into excalidraw.com it will open as a normal excalidraw file.
  - I've added 2 new Command Palette actions (export PNG, export SVG with embedded scene).
  - If you SHIFT click ${String.fromCharCode(96)} Save as PNG (or SVG)${String.fromCharCode(96)} in the workspace-tab menu, Excalidraw will embed the scene in the export.
- I updated the [Organic Line](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Organic%20Line.md)  script. It has an improved thick-to-thin look and a new thin-to-thick-to-thin line type.

# Fixed
- Intelligent image width setting [#955](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/955). Before this change, when the embedded image was small, the image would be extended to meet the image width setting in plugin settings. From now on, if the image is smaller than max-width, it will only extend to max-width. You can still set 100% width using custom CSS. See more on that [here](https://github.com/zsviczian/obsidian-excalidraw-plugin#embedded-images).

# New in ExcalidrawAutomate
- I added the ${String.fromCharCode(96)} plaintext${String.fromCharCode(96)} parameter to ${String.fromCharCode(96)}ExcalidrawAutomate.create${String.fromCharCode(96)} . Using this, you can add some text below the frontmatter but above the ${String.fromCharCode(96)}# Text Elements${String.fromCharCode(96)} section. Use this for example to add metadata to your file. (e.g. I use this in my Daily Quote template to add a Dataview field for the ${String.fromCharCode(96)}Author::${String.fromCharCode(96)} and add the quote with a standard block reference, so I can easily reference it in other files. I also add the ${String.fromCharCode(96)}#quote${String.fromCharCode(96)} tag to the file using this.)
- The script running in the ScriptEngine now also receives the ${String.fromCharCode(96)}TFile${String.fromCharCode(96)} object for the script itself. You can access this object during execution via the ${String.fromCharCode(96)}utils.scriptFile${String.fromCharCode(96)} variable. 
`,
"1.8.7":`
## New from Excalidraw.com
- Support shrinking text containers to their original height when text is removed [#6025](https://github.com/excalidraw/excalidraw/pull/6025)
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://user-images.githubusercontent.com/14358394/209404092-579d54e9-7003-48ef-8b82-84be08ba6246.mp4" title="Demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- removed the white background when editing arrow-label [#6033](https://github.com/excalidraw/excalidraw/pull/6033)
- Minor style tweaks
  - for embedding Excalidraw into Obsidian Canvas. e.g. dragging no longer accidentally creates an image copy of the drawing, and
  - style tweaks on the Excalidraw canvas

## New
- If you set a different text color and sticky note border color, now if you change the border color, the text color will not be changed.
`,
"1.8.6":`
## New from Excalidraw.com:
- Better default radius for rectangles [#5553](https://github.com/excalidraw/excalidraw/pull/5553). Existing drawings will look unchanged, this applies only to new rectangles.
![image|200](https://user-images.githubusercontent.com/5153846/206264345-59fd7436-e87b-4bc9-ade8-9e6f6a6fd8c1.png)
> [!attention]- ExcalidrawAutomate technical details
> - ${String.fromCharCode(96)}strokeSharpness${String.fromCharCode(96)} is now deprecated
> - use roundness instead
>    - ${String.fromCharCode(96)}roundness === null${String.fromCharCode(96)} is legacy ${String.fromCharCode(96)}strokeSharpness = "sharp"${String.fromCharCode(96)}
>    - ${String.fromCharCode(96)}roundness = { type: RoundnessType; value?: number }${String.fromCharCode(96)}
>      - type: 1, LEGACY, type:2 PROPORTIONAL_RADIUS, type:3 ADAPTIVE_RADIUS: 3
>      - value:
>        - Radius represented as % of element's largest side (width/height).
>          DEFAULT_PROPORTIONAL_RADIUS = 0.25;
>        - Fixed radius for the ADAPTIVE_RADIUS algorithm. In pixels.
>          DEFAULT_ADAPTIVE_RADIUS = 32;

## New
- For Obsidian 1.1.6 and above
  - Improved embedding into Obsidian Canvas
  - Improved embedding into Markdown documents
- Added setting under ${String.fromCharCode(96)}Display/Default mode when opening Excalidraw${String.fromCharCode(96)} to always open the drawing in view mode on Mobile, but in normal mode on desktop. [#939](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/939)

## Fixed
- Zoom reset tooltip appears twice [#942](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/942)
- Hid export library from library menu as it does not work due to Obsidian limitations. Use the command palette export library instead.
- Arrow with label did not get exported and embedded correctly [#941](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/941)
![image|200](https://user-images.githubusercontent.com/22638687/207845868-b352ddb1-7994-4f13-a0b2-f2e19bd72935.png)
`,
"1.8.4":`
## New from Excalidraw.com
- Labels on Arrows!!! [#5723](https://github.com/excalidraw/excalidraw/pull/5723)
  - To add a label press "Enter" or "Double click" on the arrow
  - Use "Cmd/Ctrl+double click" to enter the line editor

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://user-images.githubusercontent.com/11256141/192515552-6b6ddc06-5de0-4931-abdd-6ac3a804656d.mp4" title="Demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- **Changed behavior**: In the Obsidian markdown editor clicking an Excalidraw image will not open the image (to avoid accidentally opening the image on a tablet). To open a drawing for editing in Excalidraw double click or long-tap on it. [#920](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/920)

## Fixed 
- Text stroke color is not honored when pasting a HEX color string to an Excalidraw canvas open in an Obsidian popout window [#921](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/921)
- The new [multi-line >> multi-element paste behavior](https://github.com/excalidraw/excalidraw/pull/5786) introduced in the previous release did not work as expected in Obsidian. Now it does.
`,
"1.8.2":`
Introducing the [Excalidraw Slideshow Script](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Slideshow.md) - available in the script store
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/HhRHFhWkmCk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Obsidian tools panel gets misplaced after switching Obsidian workspace tabs

## New in ExcalidrawAutomate
- changed ${String.fromCharCode(96)}viewToggleFullScreen(forceViewMode: boolean = false): void${String.fromCharCode(96)}: the function will toggle view mode on when going to full screen and view mode off when terminating full screen.
- new functions
${String.fromCharCode(96, 96, 96)}typescript
setViewModeEnabled(enabled: boolean):void;
viewUpdateScene(
    scene: {
      elements?: ExcalidrawElement[];
      appState?: AppState;
      files?: BinaryFileData;
      commitToHistory?: boolean;
    },
    restore: boolean = false,
  ):void;
viewZoomToElements(
    selectElements: boolean,
    elements: ExcalidrawElement[]
  ):void;
${String.fromCharCode(96, 96, 96)}

`,
"1.8.1": `
## New and fixes from Excalidraw.com
- New text paste behavior. Pasting multiline text will generate separate text elements unless you hold down the shift button while pasting [#5786](https://github.com/excalidraw/excalidraw/pull/5786)
- line editor fixes [#5927](https://github.com/excalidraw/excalidraw/pull/5927)

## Fixed
- The Command Palette "Insert link" action now inserts the new link at the top drawing layer, not at the bottom.
- Updated, hopefully, better organized, Plugin Readme.

## New
- Second attempt at moving to React 18. This upgrade is required to maintain alignment with the core Excalidraw product and to continue to benefit from Excalidraw.com enhancements.
- Added options to Plugin Settings
  - to disable autozoom when loading a drawing for the first time [#907](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/907)
  - to modify autosave interval. You can now set an autosave interval for desktop and for mobile [#888](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/888)

## New in ExcalidrawAutomate
- Published the obsidian_module on the ExcalidrawAutomate object. ${String.fromCharCode(96)}ExcalidrawAutomate.obsidian${String.fromCharCode(96)}. Publishing this object will give script developers increased flexibility and control over script automation.
`,
"1.8.0": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/7gu4ETx7zro" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## New
- Optical Character Recognition (OCR). Introducing the MVP (minimum viable product) release of the integration of [Taskbone](https://taskbone.com) OCR into Excalidraw. See the new scan button on the Obsidian tools panel.
- New and improved full-screen mode
  - Activate using the Obsidian tools panel, the Obsidian Command Palette, or the Alt+F11 shortcut
  - The ESC key no longer closes full-screen
  - Full-screen mode works properly on iOS as well
- Improved Icon visibility on the Obsidian tools panel
- Added 3 additional buttons to the tools panel
  - Force save
  - Open link (useful on Mobile devices). In the case of LaTeX equations, the button opens the equation properties.
  - Open the link in a new pane. In the case of embedded markdown documents, the button opens the embed properties.

## Fixed
- The [deconstruct selected elements into a new drawing](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Deconstruct%20selected%20elements%20into%20new%20drawing.md) script now also correctly decomposes transcluded text elements.
`,
"1.7.30":`
Fix:
- Forcing the embedded image to always scale to 100% (a feature introduced in [1.7.26](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.7.26)) scaled the embedded excalidraw drawings incorrectly on devices with a pixel ratio of 2 or 3 (e.g. iPads). This is now fixed, however, this fix might retrospectively impact drawings that use this feature. Sorry for that.
`,
"1.7.29":`
- This is a big update that accommodates the **UI redesign** on Excalidraw.com [#5780](https://github.com/excalidraw/excalidraw/pull/5780). The change on the surface may seem superficial, however, I had to tweak a number of things to make it work in Obsidian. I hope I found everything that broke and fixed it, if not, I'll try to fix it quickly...
- This update also comes with changes under the hood that **fix issues with Excalidraw Automate** - paving the way for further scripts, plus some smaller bug fixes.
- I **reworked text wrapping**. In some cases, text wrapping in SVG exports looked different compared to how the text looked in Excalidraw. This should now be fixed.
- If you are using the **Experimental Dynamic Styling** of the Excalidraw Toolbar, then I recommend updating your styling script following base on [this](https://gist.github.com/zsviczian/c7223c5b4af30d5c88a0cae05300305c)
`,
"1.7.27":`## New
- Import SVG drawing as an Excalidraw object. [#679](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/679)

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/vlC1-iBvIfo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Large drawings freeze on the iPad when opening the file. I implemented a workaround whereby Excalidraw will avoid zoom-to-fit drawings with over 1000 elements. [#863](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/863)
- Reintroduced copy/paste to the context menu
`,
"1.7.26":`## Fixed
- Transcluded block with a parent bullet does not embed sub-bullet [#853](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/853)
- Transcluded text will now exclude ^block-references at end of lines
- Phantom duplicates of the drawing appear when "zoom to fit" results in a zoom value below 10% and there are many objects on the canvas [#850](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/850)
- CTRL+Wheel will increase/decrease zoom in steps of 5% matching the behavior of the "+" & "-" zoom buttons.
- Latest updates from Excalidarw.com
  - Freedraw flip not scaling correctly [#5752](https://github.com/excalidraw/excalidraw/pull/5752)
  - Multiple elements resizing regressions [#5586](https://github.com/excalidraw/excalidraw/pull/5586)

## New - power user features
- Force the embedded image to always scale to 100%. Note: this is a very niche feature with a very particular behavior that I built primarily for myself (even more so than other features in Excalidraw Obsidian - also built primarily for myself 😉)... This will reset your embedded image to 100% size every time you open the Excalidraw drawing, or in case you have embedded an Excalidraw drawing on your canvas inserted using this function, every time you update the embedded drawing, it will be scaled back to 100% size. This means that even if you resize the image on the drawing, it will reset to 100% the next time you open the file or you modify the original embedded object. This feature is useful when you decompose a drawing into separate Excalidraw files, but when combined onto a single canvas you want the individual pieces to maintain their actual sizes. I use this feature to construct Book-on-a-Page summaries from atomic drawings.
- I added an action to the command palette to temporarily disable/enable Excalidraw autosave. When autosave is disabled, Excalidraw will still save your drawing when changing to another Obsidian window, but it will not save every 10 seconds. On a mobile device (but also on a desktop) this can lead to data loss if you terminate Obsidian abruptly (i.e. swipe the application away, or close Obsidian without first closing the drawing). Use this feature if you find Excalidraw laggy.`,
};
