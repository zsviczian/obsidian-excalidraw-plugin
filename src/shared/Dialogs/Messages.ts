export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/P_Q6avJGoWI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update you'll be prompted with the release notes. You can disable this in plugin settings.

I develop this plugin as a hobby, spending my free time doing this. If you find it valuable, then please say THANK YOU or...

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>
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
"2.7.5":`
## Fixed
- PDF export scenario described in [#2184](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2184)
- Elbow arrows do not work within frames [#2187](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2187)
- Embedding images into Excalidraw with areaRef links did not work as expected due to conflicting SVG viewbox and width and height values
- Can't exit full-screen mode in popout windows using the Command Palette toggle action [#2188](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2188)
- If the image mask extended beyond the image in "Mask and Crop" image mode, the mask got misaligned from the image.
- PDF image embedding fixes that impacted some PDF files (not all):
    - When cropping the PDF page in the scene (by double-clicking the image to crop), the size and position of the PDF cutout drifted.
    - Using PDF++ there was a small offset in the position of the cutout in PDF++ and the image in Excalidraw.
 - Updated a number of scripts including Split Ellipse, Select Similar Elements, and Concatenate Lines

## New in ExcalidrawAutomate
${String.fromCharCode(96,96,96)}
  /**
   * Add, modify, or delete keys in element.customData and preserve existing keys.
   * Creates customData={} if it does not exist.
   * Takes the element id for an element in ea.elementsDict and the newData to add or modify.
   * To delete keys set key value in newData to undefined. So {keyToBeDeleted:undefined} will be deleted.
   * @param id
   * @param newData 
   * @returns undefined if element does not exist in elementsDict, returns the modified element otherwise.
   */
  public addAppendUpdateCustomData(id:string, newData: Partial<Record<string, unknown>>);
${String.fromCharCode(96,96,96)}
`,
"2.7.4":`
## Fixed
- Regression from 2.7.3 where image fileId got overwritten in some cases
- White flash when opening a dark drawing [#2178](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2178)
`,
"2.7.3":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/ISuORbVKyhQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Toggling image size anchoring on and off by modifying the image link did not update the image in the view until the user forced saved it or closed and opened the drawing again. This was a side-effect of the less frequent view save introduced in 2.7.1

## New
- **Shade Master Script**: A new script that allows you to modify the color lightness, hue, saturation, and transparency of selected Excalidraw elements, SVG images, and nested Excalidraw drawings. When a single image is selected, you can map colors individually. The original image remains unchanged, and a mapping table is added under ${String.fromCharCode(96)}## Embedded Files${String.fromCharCode(96)} for SVG and nested drawings. This helps maintain links between drawings while allowing different color themes.
- New Command Palette Command: "Duplicate selected image with a different image ID". Creates a copy of the selected image with a new image ID. This allows you to add multiple color mappings to the same image. In the scene, the image will be treated as if a different image, but loaded from the same file in the Vault.

## QoL Improvements
- New setting under ${String.fromCharCode(96)}Embedding Excalidraw into your notes and Exporting${String.fromCharCode(96)} > ${String.fromCharCode(96)}Image Caching and rendering optimization${String.fromCharCode(96)}. You can now set the number of concurrent workers that render your embedded images. Increasing the number will increase the speed but temporarily reduce the responsiveness of your system in case of large drawings.
- Moved pen-related settings under ${String.fromCharCode(96)}Excalidraw appearance and behavior${String.fromCharCode(96)} to their sub-heading called ${String.fromCharCode(96)}Pen${String.fromCharCode(96)}.
- Minor error fixing and performance optimizations when loading and updating embedded images.
- Color maps in ${String.fromCharCode(96)}## Embedded Files${String.fromCharCode(96)} may now include color keys "stroke" and "fill". If set, these will change the fill and stroke attributes of the SVG root element of the relevant file.

## New in ExcalidrawAutomate
${String.fromCharCode(96,96,96)}ts
// Updates the color map of an SVG image element in the view. If a ColorMap is provided, it will be used directly.
// If an SVGColorInfo is provided, it will be converted to a ColorMap.
// The view will be marked as dirty and the image will be reset using the color map.
updateViewSVGImageColorMap(
  elements: ExcalidrawImageElement | ExcalidrawImageElement[],
  colors: ColorMap | SVGColorInfo | ColorMap[] | SVGColorInfo[]
): Promise<void>;

// Retrieves the color map for an image element.
// The color map contains information about the mapping of colors used in the image.
// If the element already has a color map, it will be returned.
getColorMapForImageElement(el: ExcalidrawElement): ColorMap;

// Retrieves the color map for an SVG image element.
// The color map contains information about the fill and stroke colors used in the SVG.
// If the element already has a color map, it will be merged with the colors extracted from the SVG.
getColorMapForImgElement(el: ExcalidrawElement): Promise<SVGColorInfo>;

// Extracts the fill (background) and stroke colors from an Excalidraw file and returns them as an SVGColorInfo.
getColosFromExcalidrawFile(file:TFile, img: ExcalidrawImageElement): Promise<SVGColorInfo>;

// Extracts the fill and stroke colors from an SVG string and returns them as an SVGColorInfo.
getColorsFromSVGString(svgString: string): SVGColorInfo;

// upgraded the addImage function.
// 1. It now accepts an object as the input parameter, making your scripts more readable
// 2. AddImageOptions now includes colorMap as an optional parameter, this will only have an effect in case of SVGs and nested Excalidraws
// 3. The API function is backwards compatible, but I recommend new implementations to use the object based input
addImage(opts: AddImageOptions}): Promise<string>;

interface AddImageOptions {
  topX: number;
  topY: number;
  imageFile: TFile | string;
  scale?: boolean; 
  anchor?: boolean;
  colorMap?: ColorMap;
}

type SVGColorInfo = Map<string, {
  mappedTo: string;
  fill: boolean;
  stroke: boolean;
}>;

interface ColorMap {
  [color: string]: string;
};
${String.fromCharCode(96,96,96)}
`,
"2.7.2":`
## Fixed
- The plugin did not load on **iOS 16 and older**. [#2170](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2170)
- Added empty line between ${String.fromCharCode(96)}# Excalidraw Data${String.fromCharCode(96)} and ${String.fromCharCode(96)}## Text Elements${String.fromCharCode(96)}. This will now follow **correct markdown linting**. [#2168](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2168)
- Adding an **embeddable** to view did not **honor the element background and element stroke colors**, even if it was configured in plugin settings. [#2172](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2172)
- **Deconstruct selected elements script** did not copy URLs and URIs for images embedded from outside Obsidian. Please update your script from the script library. 
- When **rearranging tabs in Obsidian**, e.g. having two tabs side by side, and moving one of them to another location, if the tab was an Excalidraw tab, it appeared as non-responsive after the move, until the tab was resized.

## Source Code Refactoring
- Updated filenames, file locations, and file name letter-casing across the project
- Extracted onDrop, onDragover, etc. handlers to DropManger in ExcalidrawView
`,
"2.7.1":`
## Fixed
- Deleting excalidraw file from file system while it is open in fullscreen mode in Obsidian causes Obsidian to be stuck in full-screen view [#2161](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2161)
- Chinese fonts are not rendered in LaTeX statements [#2162](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2162)
- Since Electron 32 (newer Obsidian Desktop installers) drag and drop links from Finder or OS File Explorer did not work. [Electron breaking change](https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath). This is now fixed
- Addressed unnecessary image reloads when changing windows in Obsidian
`,
"2.7.0":`
## Fixed
- Various Markdown embeddable "fuzziness":  
    - Fixed issues with appearance settings and edit mode toggling when single-click editing is enabled.  
    - Ensured embeddable file editing no longer gets interrupted unexpectedly.  
- **Hover Preview**: Disabled hover preview for back-of-the-note cards to reduce distractions.
- **Settings Save**: Fixed an issue where plugin settings unnecessarily saved on every startup.

## New Features
- **Image Cropping Snaps to Objects**: When snapping is enabled in the scene, image cropping now aligns to nearby objects.  
- **Session Persistence for Pen Mode**: Excalidraw remembers the last pen mode when switching between drawings within the same session.

## Refactoring
- **Mermaid Diagrams**: Excalidraw now uses its own Mermaid package, breaking future dependencies on Obsidian's Mermaid updates. This ensures stability and includes all fixes and improvements made to Excalidraw Mermaid since February 2024. The plugin file size has increased slightly, but this change significantly improves maintainability while remaining invisible to users.  
- **MathJax Optimization**: MathJax (LaTeX equation SVG image generation) now loads only on demand, with the package compressed to minimize the startup and file size impact caused by the inclusion of Mermaid.  
- **On-Demand Language Loading**: Non-English language files are now compressed and load only when needed, counterbalancing the increase in file size due to Mermaid and improving load speeds.  
- **Codebase Restructuring**: Improved type safety by removing many ${String.fromCharCode(96)}//@ts-ignore${String.fromCharCode(96)} commands and enhancing modularity. Introduced new management classes: **CommandManager**, **EventManager**, **PluginFileManager**, **ObserverManager**, and **PackageManager**. Further restructuring is planned for upcoming releases to improve maintainability and stability.
`,
"2.6.8":`
## New
- **QoL improvements**:
  - Obsidian-link search button in Element Link Editor.
  - Add Any File now searches file aliases as well.
  - Cosmetic changes to file search modals (display path, show file type icon).
  - Text Element cursor-color matches the text color.
- New script in script store: [Image Occlusion](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Image%20Occlusion.md) by [@TrillStones](https://github.com/TrillStones) 🙏

## Fixed
- Excalidraw icon on the **ribbon menu kept reappearing** every time you reopen Obsidian [#2115](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2115)
- In pen mode, when **single-finger panning** is enabled, Excalidraw should still **allow actions with the mouse**.
- When **editing a drawing in split mode** (drawing is on one side, markdown view is on the other), editing the markdown note sometimes causes the drawing to re-zoom and jump away from the selected area.
- Hover-Editor compatibility resolved [2041](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2041)
-  ${String.fromCharCode(96)}ExcalidrawAutomate.create() ${String.fromCharCode(96)} will now correctly include the markdown text in templates above Excalidraw Data and below YAML front matter. This also fixes the same issue with the **Deconstruct Selected Element script**.

`,
};
