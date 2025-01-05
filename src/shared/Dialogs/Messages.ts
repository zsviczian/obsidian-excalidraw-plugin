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
"2.6.7":`
Hoping to finally move on to 2.7.0... but still have one last bug to fix in 2.6.x!

## Fixed
I misread a line in the Excalidraw package code... ended up breaking image loading in 2.6.6. The icon library script didn't work right, and updating nested drawings caused all images in the scene to be dropped from memory. This led to image-placeholders in exports and broke copy-paste to Excalidraw.com and between drawings. I am surprised no one reported it! 😳
`,
"2.6.6":`
## Fixed
- Images and LaTeX formulas did not update in the scene when the source was changed until the Excalidraw drawing was closed and reopened. [#2105](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2105)
`,
"2.6.5":`
## Fixed
- Text sizing issue in the drawing that is first loaded after Obsidian restarts [#2086](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2086)
- Excalidraw didn't load if there was a file in the Excalidraw folder with a name that starts the same way as the Scripts folder name. [#2095](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2095)
- **OVERSIZED EXCALIDRAW TOOLBAR**: Added a new setting under "Excalidraw Appearance and Behavior > Theme and Styling" called "Limit Obsidian Font Size to Editor Text." This setting is off by default. When enabled, it restricts Obsidian's custom font size adjustments to editor text only, preventing unintended scaling of Excalidraw UI elements and other themes that rely on the default interface font size. Feel free to experiment with this setting to improve Excalidraw UI consistency. However, because this change affects the broader Obsidian UI, it's recommended to turn it off if any layout issues arise. [#2087](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2087)`,
"2.6.4":`
## Fixed
- Error saving when cropping images embedded from a URL (not from a file in the Vault) [#2096](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2096)
`,
};
