# 2.7.4

## Fixed
- Regression from 2.7.3 where image fileId got overwritten in some cases
- White flash when opening a dark drawing [#2178](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2178)

# 2.7.3

[![Thumbnail - 20241226 Shade Master Color Magic (Custom)](https://github.com/user-attachments/assets/c9a1d6a0-f64c-45e7-a5a4-4390b2c84d1e)](https://youtu.be/ISuORbVKyhQ)

## New
- **Shade Master Script**: A new script that allows you to modify the color lightness, hue, saturation, and transparency of selected Excalidraw elements, SVG images, and nested Excalidraw drawings. When a single image is selected, you can map colors individually. The original image remains unchanged, and a mapping table is added under `## Embedded Files` for SVG and nested drawings. This helps maintain links between drawings while allowing different color themes.
- New Command Palette Command: "Duplicate selected image with a different image ID". Creates a copy of the selected image with a new image ID. This allows you to add multiple color mappings to the same image. In the scene, the image will be treated as if a different image, but loaded from the same file in the Vault.

## QoL Improvements
- New setting under `Embedding Excalidraw into your notes and Exporting` > `Image Caching and rendering optimization`. You can now set the number of concurrent workers that render your embedded images. Increasing the number will increase the speed but temporarily reduce the responsiveness of your system in case of large drawings.
- Moved pen-related settings under `Excalidraw appearance and behavior` to their sub-heading called `Pen`.
- Minor error fixing and performance optimizations when loading and updating embedded images.
- Color maps in `## Embedded Files` may now include color keys "stroke" and "fill". If set, these will change the fill and stroke attributes of the SVG root element of the relevant file.

## Fixed
- Toggling image size anchoring on and off by modifying the image link did not update the image in the view until the user forced saved it or closed and opened the drawing again. This was a side-effect of the less frequent view save introduced in 2.7.1

## New in ExcalidrawAutomate
```ts
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
```


# 2.7.2

## Fixed
- The plugin did not load on **iOS 16 and older**. [#2170](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2170)
- Added empty line between `# Excalidraw Data` and `## Text Elements`. This will now follow **correct markdown linting**. [#2168](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2168)
- Adding an **embeddable** to view did not **honor the element background and element stroke colors**, even if it was configured in plugin settings. [#2172](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2172)
- **Deconstruct selected elements script** did not copy URLs and URIs for images embedded from outside Obsidian. Please update your script from the script library. 
- When **rearranging tabs in Obsidian**, e.g. having two tabs side by side, and moving one of them to another location, if the tab was an Excalidraw tab, it appeared as non-responsive after the move, until the tab was resized.

## Source Code Refactoring
- Updated filenames, file locations, and file name letter-casing across the project
- Extracted onDrop, onDragover, etc. handlers to DropManger in ExcalidrawView

# 2.7.0-beta-x

this is a debugging release

```js
function minifyCode(code) {
  const minified = minify(code, {
    compress: {
      arrows: false,
      keep_fargs: true,
      keep_fnames: true,
      keep_infinity: true,
      reduce_vars: false,
      toplevel: false,
      typeofs: false,
      pure_getters: false,
      unsafe: false
    },
    mangle: {
      keep_fnames: true,
      reserved: [
        // Array methods
        'reduce', 'map', 'filter', 'forEach', 'some', 'every',
        'find', 'findIndex', 'includes', 'indexOf', 'slice',
        'splice', 'concat', 'join', 'push', 'pop', 'shift',
        'unshift',
        
        // Core objects
        'Array', 'Object', 'String', 'Number', 'Boolean',
        'Function', 'Promise', 'Symbol', 'Set', 'Map',
        
        // React
        'React', 'ReactDOM'
      ]
    },
    output: {
      comments: false,
      beautify: false,
      webkit: true
    }
  });

  if (minified.error) {
    throw new Error(minified.error);
  }
  return minified.code;
}
```

# 2.7.1

## Fixed
- Deleting excalidraw file from file system while it is open in fullscreen mode in Obsidian causes Obsidian to be stuck in full-screen view [#2161](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2161)
- Chinese fonts are not rendered in LaTeX statements [#2162](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2162)
- Since Electron 32 (newer Obsidian Desktop installers) drag and drop links from Finder or OS File Explorer did not work. [Electron breaking change](https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath). This is now fixed
- Addressed unnecessary image reloads when changing windows in Obsidian

# 2.7.0

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
- **Codebase Restructuring**: Improved type safety by removing many `//@ts-ignore` commands and enhancing modularity. Introduced new management classes: **CommandManager**, **EventManager**, **PluginFileManager**, **ObserverManager**, and **PackageManager**. Further restructuring is planned for upcoming releases to improve maintainability and stability.

# 2.7.0-beta-7

## Fixed
- Excalidraw does not open in Obsidian popout windows
- Implemented shared mermaid instance to avoid each Excalidraw popout window instantiating a new Mermaid (assuming the user uses mermaid in all the windows)

# 2.7.0-beta-6

## QoL
- I compressed non-English language files and load them only on demand.

## Refactoring
- Moved event handlers to EventManager class
- Removed many (not yet all) //@ ts-ignore instructions, thus improving type safety of the code

# 2.7.0-beta-5

No new feature compared to beta-4

## Refactored
- A careful and small first step in restructuring the code. I carved out FileManager.ts, ObserverManager.ts, and PackageManager.ts from main.ts. EventManager.ts, ActionManager.ts, and likely others will follow, followed by ExcalidrawView.ts, etc.

# 2.7.0-beta-4

Fixed LaTeX Race Condition in 2.7.0-beta-3 (causing multiple instances of MathJax to be potentially loaded into memory).

## QoL Fixes
- Embeddable file editing does not get interrupted unexpectedly
- Hover preview does not show for back-of-the-note cards as it is distracting.

## QoL New
- Excalidraw will default to the last pen mode when switching between drawings within the same session. Thus if you used the pen on the previous drawing, pen mode will be active in the next drawing you open.

# 2.7.0-beta-3

## Refactor
- Moved MathJax (LaTeX equation SVG image generation) package to load only on demand; and compressed the mathjax package in the plugin file. This aims to counterbalance the increase in size due to the inclusion of mermaid diagrams package in Excalidraw and the consequent startup performance hit.

## Fixed
- Addressed multiple fuzziness with embeddable appearance settings and edit mode on/off switching when single click editing is enabled in settings.

# 2.7.0-beta-2

## Fixed
- race condition when loading mermaid SVG in a drawing
- Settings save on startup

# 2.7.0-beta-1

## Refactoring
- Obsidian 1.8.x will likely include a new version of Mermaid. Unfortunately that breaks the current Mermaid-to-Excalidraw feature that uses the built in Obsidian Mermaid package to save memory and improve the startup time of the plugin. To ensure longevity of the plugin I stopped using the Obsidian version of Mermaid and use the one that comes with Excalidraw. Side Effect is that Excalidraw main.js has increased to 9.2MB and startup time increases with a few percent. The benefit is all the fixes and improvements to mermaid in Excalidraw since January 2024 that I haven't deployed to Obsidian become available. In short, for the end user this is likely an invisible change, under the hood lots have changed.

# 2.6.8

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
- `ExcalidrawAutomate.create()` will now correctly include the markdown text in templates above Excalidraw Data and below YAML front matter. This also **fixes the same issue with the Deconstruct Selected Element script**.

# 2.6.8-beta-3

## New
- Text Element cursor color matched the text color.
- Diagnostics to analyze startup time. After Obsidian has loaded open Developer Console (CTRL+SHIFT+i / CMD+OPT+i) and type the following `ExcalidrawAutomate.printStartupBreakdown()`
- [Image Occlusion](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Image%20Occlusion.md) script by [@TrillStones](https://github.com/TrillStones) 🙏

## Fixed
- BUG: icon on the ribbon menu keeps reappearing even if you hide it every time you reopen Obsidian [#2115](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2115)
- In pen mode, when single-finger panning is enabled, allow actions with the mouse.
- When editing an Excalidraw file in split mode (drawing on one side, markdown view on the other), editing the markdown sometimes causes the drawing to re-zoom and jump away from the selected area.
- Hover-Editor compatibility
-  `ExcalidrawAutomate.create()` will now correctly include the markdown text in templates above Excalidraw Data and below YAML front matter. This also fixes the same issue with the Deconstruct Selected Element script.

# 2.6.8-beta-2

## New
- Dynamic cursor color based on the text color of the text element [#2123](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2123)

# 2.6.8-beta-1

This version includes the code for the new canvas element linking feature from Excalidraw.com... however, in Obsidian this feature is hidden since it was already solved long ago, and the solution from excalidraw.com would introduce additional UX complexity (and would also not work in Obsidian because of the different architecture in Obsidian compared to the web).  I hope this new feature in the code will have no impact (has not created new bugs) in the Obsidian plugin... This will require careful testing over the next few days to verify).

## New
- Diagnostics to analyze startup time. After Obsidian has loaded open Developer Console (CTRL+SHIFT+i / CMD+OPT+i) and type the following `ExcalidrawAutomate.printStartupBreakdown()`

## Fixed
- BUG: icon on the ribbon menu keeps reappearing even if you hide it every time you reopen Obsidian [#2115](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2115)
- In pen mode, when single-finger panning is enabled, allow actions with the mouse.
- When editing an Excalidraw file in split mode (drawing on one side, markdown view on the other), editing the markdown sometimes causes the drawing to re-zoom and jump away from the selected area.

# 2.6.7

Hoping to finally move on to 2.7.0... but still have one last bug to fix in 2.6.x!

## Fixed
I misread a line in the Excalidraw package code... ended up breaking image loading in 2.6.6. The icon library script didn't work right, and updating nested drawings caused all images in the scene to be dropped from memory. This led to image placeholders in exports and broke copy-paste to Excalidraw.com and between drawings. I am surprised no one reported it! 😳

# 2.6.6

## Fixed
- Images and LaTeX formulas did not update in the scene when the source was changed until the Excalidraw drawing was closed and reopened. [#2105](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2105)

# 2.6.5

## Fixed
- Text sizing issue in the drawing that is first loaded after Obsidian restarts [#2086](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2086)
- Excalidraw didn't load if there was a file in the Excalidraw folder with a name that starts the same way as the Scripts folder name. [#2095](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2095)
- **OVERSIZED EXCALIDRAW TOOLBAR**: Added a new setting under "Excalidraw Appearance and Behavior > Theme and Styling" called "Limit Obsidian Font Size to Editor Text." This setting is off by default. When enabled, it restricts Obsidian’s custom font size adjustments to editor text only, preventing unintended scaling of Excalidraw UI elements and other themes that rely on the default interface font size. Feel free to experiment with this setting to improve Excalidraw UI consistency. However, because this change affects the broader Obsidian UI, it’s recommended to turn it off if any layout issues arise. [#2087](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2087)

# 2.6.5-beta-1

## Fixed
- text sizing issue in the drawing first loaded after Obsidian restart [#2086](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2086)
- Excalidraw fails to load if Excalidraw folder includes a file with a filename starting with the same character sequence as the scripts folder. e.g. Script Folder is `Excalidraw/Scripts` and the `Excalidraw` folder has a file called `Scripts-whatever.md` [#2095](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2095)

# 2.6.4

## Fixed
- Error saving when cropping images embedded from a URL (not from a file in the Vault) [#2096](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2096)

# 2.6.3


[![Thumbnail - 20241103 Excalidraw 2 6 3](https://github.com/user-attachments/assets/90236982-7498-4880-89a7-7b8af181ee03)](https://youtu.be/OfUWAvCgbXk)

## New
- **Cropping PDF Pages**  
  - Improved PDF++ cropping: You can now double-click cropped images in Excalidraw to adjust the crop area, which will also appear as a highlight in PDF++. This feature applies to PDF cut-outs created in version 2.6.3 and beyond.
- **Insert Last Active PDF Page as Image**  
  - New command palette action lets you insert the currently active PDF page into Excalidraw. Ideal for setups with PDF and Excalidraw side-by-side. You can assign a hotkey for quicker access. Cropped areas in Excalidraw will show as highlights in PDF++.

## Fixed
- Fixed **Close Settings** button toggle behavior [#2085](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2085)
- Resolved text wrapping issues causing layout shifts due to trailing whitespaces [#8714](https://github.com/excalidraw/excalidraw/pull/8714)
- **Aspect Ratio and Size Reset** commands now function correctly with cropped images.
- **Cropped Drawings**: Adjustments to cropped Excalidraw drawings are now supported. However, for nested Excalidraw drawings, it's recommended to use area, group, and frame references instead of cropping.

## Refactoring
- Further font loading optimizations on Excalidraw.com; no impact expected in Obsidian [#8693](https://github.com/excalidraw/excalidraw/pull/8693)
- Text wrapping improvements [#8715](https://github.com/excalidraw/excalidraw/pull/8715)
- Plugin initiation and error handling


# 2.6.3-beta-6

Handle the case `plugin.settings.previousRelease === null`

# 2.6.3-beta-5

startup error handling for debug purposes

# 2.6.3-beta-4

On a quest to find out why Excalidraw won't start for [@wernsting](https://discord.com/channels/1026825302900494357/1301305189029908530). Slightly reordered startup sequence.

# 2.6.3-beta-3

## Refactoring
I reworked plugin initiation sequence and cleaned up some of the unfinished work 2.6.0

# 2.6.3-beta-2

## New
- PDF++ cropping support improved. This will not apply to old cut-outs. Now if you select a crop area in PDF++, you can easily adjust in Excalidraw.
- There is a new command palette action to `Insert last active PDF page as image` into the Scene. The way this is intended to work is that you have a PDF document open in one pane and Excalidraw in another, as you scroll the PDF view you can use a hotkey (or the command palette) to insert the relevant active page to Excalidraw. Then you can crop it in Excalidraw. The cropping will show up in PDF++

# 2.6.3-beta-1

## Fixed
- text wrapping fix trailing line whitespaces layout shift [#8714](https://github.com/excalidraw/excalidraw/pull/8714)
- Reset aspect ratio and set to 100% of original size command palette actions will now work correctly with cropped images
- Cropping Excalidraw drawings, then changing the cropped drawing will now work, albeit it is impossible to come up with an intelligent algorithm to maintain the right crop location. For this purpose I recommend the area, group, frame links.

## Refactoring
- Excalidraw.com made further changes to font loading. Hopefully these will have no unexpected impact in Obsidian [#8693](https://github.com/excalidraw/excalidraw/pull/8693) 
- Text wrapping [#8715](https://github.com/excalidraw/excalidraw/pull/8715)

# 2.6.2

## Fixed
- Image scaling issue with SVGs that miss the width and height property. [#8729](https://github.com/excalidraw/excalidraw/issues/8729)

# 2.6.1

## New
- Pen-mode single-finger panning enabled also for the "Selection" tool.
- You can disable pen-mode single-finger panning in Plugin Settings under Excalidraw Appearance and Behavior [#2080](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2080)

## Fixed
- Text tool did not work in pen-mode using finger [#2080](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2080)
- Pasting images to Excalidraw from the web resulted in filenames of "image_1.png", "image_2.png" instead of "Pasted Image <<timestamp>>" [#2081](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2081)


# 2.6.0

## Performance
- Much faster plugin initialization. Down from 1000-3000ms to 100-300ms. According to my testing speed varies on a wide spectrum depending on device, size of Vault and other plugins being loaded. I measured values ranging from 84ms up to 782ms [#2068](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2068) 
- Faster loading of scenes with many embedded illustrations or PDF pages.
- SVG export results in even smaller files by further optimizing which characters are included in the embedded fonts. [#8641](https://github.com/excalidraw/excalidraw/pull/8641)

## New
- Image cropping tool. Double click the image to crop it. [#8613](https://github.com/excalidraw/excalidraw/pull/8613)
- Single finger panning in pen mode.
- Native handwritten CJK Font support [8530](https://github.com/excalidraw/excalidraw/pull/8530) 
  - Created a new **Fonts** section in settings. This includes configuration of the "Local Font" and downloading of the CJK fonts in case you need them offline.
- Option under **Appearance and Behavior / Link Click** to disable double-click link navigation in view mode. [#2075](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2075)
- New RU translation 🙏@tovBender

## Updated
- CN translation 🙏@dmscode

# 2.6.0-beta-2

## New
- Created a new **Fonts** section in settings. Downloading CJK fonts locally takes a few steps, but it works properly even when Obsidian does not have Internet access.
- Added an option under **Appearance and Behavior / Link Click** to disable double-click link navigation in view mode. [#2075](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2075)

# 2.6.0-beta-4

Fixed some loading issues

# 2.6.0-beta-3

I reduced plugin startup time to a range of ~200ms

# 2.6.0-beta-1

Everything in 2.5.3-beta-1,2,3 and 4.

## New
- Batching of adding images when loading a scene. Images are 

## Fixed
- performance issue after the introduction of image cropping is resolved. Cropping is included in the build again
- Excalidraw works again in pop-out windows
- Console log error message about worker thread initiation is resolved

# 2.5.3-beta-5

The new image cropping feature is a major performance hit on scene rendering. 
I'll reintroduce this feature in a few days.
for more see: [#8692](https://github.com/excalidraw/excalidraw/issues/8692)

# 2.5.3-beta-4

## New
- Image Cropping [#8613](https://github.com/excalidraw/excalidraw/pull/8613)
- Significantly improved loading times for scenes with multiple images/PDF embeds/equations, etc.

# 2.5.3-beta-3

This should be the same as 2.5.3-beta-2 with one new feature (see below). However, Excalidraw moved many files around, and renamed files... hopefully, I found all changes and this works as before (or better 😉)

## New
- SVG export strictly only includes glyphs from fonts that are used in the drawing [#8678](https://github.com/excalidraw/excalidraw/issues/8678)


# 2.5.3-beta-2

Everything in 2.5.3-beta-1 +

- Updated CN translation 🙏@dmscode
- New RU translation 🙏@tovBender

## Fonts: 
- Fixed [#8677](https://github.com/excalidraw/excalidraw/issues/8677) Lilita an Nunito fonts did not appear in exports if ExcaliFont was also present in the scene
- Locally hosted font support is not yet working (likely won't by 2.5.3 release... it is beyond my "paygrade", can't seem to find a simple & workable solution).
  - Base Excalidraw fonts are included in the package
  - CJK font is loaded from the web


# 2.5.3-beta-1

## New
### Native handwritten CJK font support! [8530](https://github.com/excalidraw/excalidraw/pull/8530) 🎉  
To improve Excalidraw's startup time [#2068](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2068) and manage the large file size of the CJK font family, I’ve moved Excalidraw fonts out of the plugin's `main.js` file. Starting with version 2.5.3, fonts will be loaded from the internet. Normally, this should not cause any issues, as Obsidian caches these files after the first use.

However, if you prefer to keep Obsidian fully local, or if you have a slow internet connection, you can download the necessary font assets. Simply download the fonts from [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip), unzip them, and save the contents to a folder in your vault.

**Steps:**
  - Download the font assets from [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip).
  - Unzip the contents into a folder within your vault (e.g., `Excalidraw/FontAssets`).
  - Do not set this folder to the Vault root or place other files (such as your local fonts) in this folder.

**Obsidian Sync Users:** If you want to sync these font files across devices, make sure Obsidian Sync is set to synchronize "All other file types".

**Note:** If you find this process cumbersome, I encourage you to submit a feature request with Obsidian.md to support plugin assets within the plugin folder. Currently, only a single plugin file (main.js) is supported. This limitation leads to slower plugin startup times and manual steps like this to manage assets such as fonts or libraries, which are currently all bundled into main.js.


# 2.5.2

## Fixed
- Text became disconnected from sticky notes (rectangle/ellipse/diamond + text) if the sticky note contained a link (e.g., URL or wiki link), and in some cases, triggered a save error warning. [#2054](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2054)
- Long-clicking to open an Excalidraw drawing from a markdown note did not work when the note was in an Obsidian pop-out window.
- Active tool was deactivated after autosave, requiring the user to reselect the tool.

## Minor changes to default settings
- I adjusted some of the default settings. This change only affects new installs of Excalidraw; existing installs and settings remain unchanged:
  - **Reuse Adjacent Pane** is now the default for opening new drawings. Excalidraw will try to open the drawing in the most recently used adjacent pane, if available.
  - **Focus on Existing Tab** is the default for reopening an already open drawing. Excalidraw will switch to the existing tab where the drawing is open, instead of creating a new one.
  - **Autosave Interval** is now set to a default value of 1 minute on Desktop and 30 seconds on mobile platforms.

# 2.5.1

## New
- Excalidraw will now save images using the filename from the file system when adding an image via the image tool (in the top toolbar).
- Increased the maximum image size from a width/height of 1440 to 2880 when adding an image via the image tool in the top toolbar.
- Flip arrowheads: If you have an arrow bound to elements, select only the arrow (not the bound elements) and press SHIFT+H or SHIFT+V to swap the arrowheads. [#8525](https://github.com/excalidraw/excalidraw/pull/8525)

## Fixed
- Zoom
  - "Zoom to Fit" did not work correctly when multiple Obsidian tabs were open, and Excalidraw was in a lower tab. Additionally, there was an offset when the left side panel was open, especially if the panel was relatively large compared to the canvas area. [#2039](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2039)
  - SHIFT+1 and SHIFT+2 will now honor the max zoom setting in Plugin Settings.
- Adding images using the image tool in the toolbar was unreliable. Sometimes it worked, sometimes it didn't, depending on whether the drawing had unsaved changes. Autosave was causing the issue with the image tool. [#1992](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1992)
- Frame related issues
  - Fixed an issue where links to the back of the note were broken if an unnamed frame was present in the scene. [#2027](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2027)
  - Frame transclusion was not working when there was a LaTeX equation anywhere in the scene. [#2028](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2028)
  - Frame settings and rounded image corners were not honored when exporting (and auto-exporting) SVGs. [#2026](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026)
- Resolved issues with the width, height, and style parsing of Excalidraw drawings embedded in Markdown notes. `![[my file|10 - my alias]]` was incorrectly parsed as a width of 10 and a style of "- my alias."
- Links
  - When navigating element links, selecting a #tag from the link-list did not open the Obsidian tag in the search.
  - False-positive tag results in second-order links list.
  - Arrow label links did not work as expected. Since CTRL/CMD+Click is used in Excalidraw to start the line editor, the solution is not straightforward from a UX perspective. [#2023](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2023)
    - You can open arrow links by ctrl+clicking on the label itself. If the arrow or line element contains the link, ctrl+click on the link indicator in the top right.
    - You can also right-click the linear element and select "Open Link" from the context menu.
- Various elbow-arrow fixes and QoL improvements from excalidraw.com [#8324](https://github.com/excalidraw/excalidraw/pull/8324), [#8448](https://github.com/excalidraw/excalidraw/pull/8448), [#8440](https://github.com/excalidraw/excalidraw/pull/8440)


# 2.5.1-beta-2

## Fixed
- Adding images using the image tool in the toolbar was unreliable. Sometimes it worked, sometimes it didn't. (it depended on whether the drawing had changes or not. Autosave was causing the issue with the image tool). [#1992](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1992)
- Fixed issue where links to the back of the note were broken if (an unnamed) frame was in the scene. [#2027](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2027)
- Fixed issue with width, height, style parsing of embedded excalidraw drawings. `![[my file|10 - my alias]]` was incorrectly parsed as a width value of 10 and a style of "- my alias".
- False positive tag results in second order links list
- Selecting tag from list did not open the tag in search 

## New
- Excalidraw will save the image with the filename from the file system when adding the image via the image tool (in the top toolbar).
- Increased maximum image size from a max width/height of 1440 to 2880, when adding an image via the add image tool in the top toolbar.

# 2.5.1-beta-1

## Fixed
- Frame transclusion not working when there is a LaTeX equation anywhere in the scene. [#2028](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2028)
- Frame settings and rounded image corners not honored when exporting (and auto exporting) SVG. [#2026](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026)
- Arrow label links did not work. Because CTRL/CMD+Click is Excalidraw's approach for starting the line editor, the solution is not as simple from a UX perspective [#2023](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2023)
  - You can open arrow links if you ctrl+click on the label itself, or if the arrow or line element has the link, then ctrl click on the link indicator in the top right.
  - You can also open the link by right clicking on the linear element and selecting open link from the context menu.
- Various elbow-arrow fixes and QoL improvements from excalidraw.com [#8324](https://github.com/excalidraw/excalidraw/pull/8324), [#8448](https://github.com/excalidraw/excalidraw/pull/8448), [#8440](https://github.com/excalidraw/excalidraw/pull/8440)

## New
- Flip arrow heads. If you have an arrow that is bound to elements, if you only select the arrow, and not the bound elements and press SHIFT+H or SHIFT+V the arrow heads will be swapped. [#8525](https://github.com/excalidraw/excalidraw/pull/8525)

# 2.5.0

The new [Community Wiki](https://excalidraw-obsidian.online/Hobbies/Excalidraw+Blog/WIKI/Welcome+to+the+WIKI) is waiting for your contribution!

## Fixed
- Regression from 2.4.3: Text flickers when editing text in a container [#2015](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2015).
- Significantly improved the performance of group and frame [image fragments](https://youtu.be/sjZfdqpxqsg) when the source drawing includes many images, but the fragment does not.
- Minor styling tweaks. Note that with Obsidian 1.7.1, the font size and zoom settings in Obsidian > Appearance will affect the size of buttons and menu items in Excalidraw as well.

## New
- New Canvas Search from Excalidraw.com (CTRL/CMD+F). The "old" search is still available in the Obsidian Command Palette _"Search for text in drawing"_. The old search will also search in image-file names and frame titles, but the result set is not as sophisticated as the one built by Excalidraw.com. If you want to use the old search, you can set up a hotkey in Obsidian settings, e.g., CTRL+ALT/CMD+OPT+F. [#8438](https://github.com/excalidraw/excalidraw/pull/8438)
- Grid Color settings under **Excalidraw Appearance and Behavior**. Note that the grid color and opacity also affect the color and transparency of the binding box when using the arrow tool. [#2007](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2007)
- Refactoring the code to be compatible with the upcoming Obsidian 1.7.2.
- `ExcalidrawAutomate.decompressFromBase64()` will now remove line breaks from the input string so you can directly supply the compressed JSON string for decompression by script.

# 2.5.0-rc-1

- Minor styling tweaks.
- `ExcalidrawAutomate.decompressFromBase64()` will now remove line breaks from the input string so you can directly supply the compressed-json string for decompression by script.

# 2.5.0-beta-5

Fixed issue with refactoring to accommodate upcoming Obsidian 1.7.2 changes.


# 2.5.0-beta-4

- Minor style tweaks
- Refactoring to accommodate upcoming Obsidian 1.7.2 changes.
- Fixed math types used from the Excalidraw package that changed recently

# 2.5.0-beta-3

## Fixed
- loading of images flickered (especially if many files were loaded)

## Improved
- Search results focus and navigation + search is now integrated next to the Stencil Library in the side panel.

## New
- Grid color settings under Excalidraw Appearance and Behavior [#2007](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2007)
 
<img width="796" alt="image" src="https://github.com/user-attachments/assets/1f21db61-bd6f-458f-9083-232ed415c73e">



# 2.5.0-beta-2

## Fixed
- Regression from 2.4.3: text flickering when editing text in container [#2015](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2015)

## New
- Implemented simple zoom for new Canvas Search feature [#8486](https://github.com/excalidraw/excalidraw/pull/8486)

# 2.5.0-beta-1

## New
- Canvas Search from excalidraw.com (CTRL/CMD+F). The "old" search is still available on the command palette "Search for text in drawing". The old search will also search in file names and frame titles, but the result set is not as sophisticated as the one built by Excalidraw.com. If you want to use the old search you can set up a hotkey in Obsidian settings, e.g. CTRL+ALT/CMD+OPT + F.
## Fixed
- Significantly improved the performance of image embeds for group and frame references when the source drawing includes many images.

# 2.4.3-rc-2

Check out the [Excalidraw Plugin's Community WIKI](https://excalidraw-obsidian.online/Hobbies/Excalidraw+Blog/WIKI/Welcome+to+the+WIKI) and help with your content contribution.

## Fixed
- In some situations Excalidraw hangs indefinitely when opening a different file in the same tab
- Can't exit arrow tool on phone [#2006](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2006)
- Save is triggered every few seconds, leading to glitches in handwriting [#2004](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2004)
- Canvas shifts when editing text reaches right hand side of the canvas, especially at higher zoom values
- Minor styling tweaks to adapt to Obsidian 1.7.1 new stylesheet, in particular to scale Excalidraw properly in line with Obsidian Appearance Setting Font-Size value.
- Tweaked Compatibilty Setting description to mention Obsidian 1.7.1 Footnotes support

# 2.4.3-rc-1

## Fixed
- In some situations Excalidraw hangs indefinitely when opening a different file in the same tab
- Can't exit arrow tool on phone [#2006[(https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2006)
- Save is triggered every few seconds, leading to glitches in handwriting [#2004](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2004)
- Canvas shifts when editing text reaches right hand side of the canvas, especially at higher zoom values


# 2.4.3

Check out the [Excalidraw Plugin's Community WIKI](https://excalidraw-obsidian.online/Hobbies/Excalidraw+Blog/WIKI/Welcome+to+the+WIKI) and help with your content contribution.

## Fixed
- In some situations Excalidraw hangs indefinitely when opening a different file in the same tab
- Can't exit arrow tool on phone [#2006](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2006)
- Save is triggered every few seconds, leading to glitches in handwriting [#2004](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2004)
- Canvas shifts when editing text reaches right hand side of the canvas, especially at higher zoom values
- Minor styling tweaks to adapt to Obsidian 1.7.1 new stylesheet, in particular to scale Excalidraw properly in line with Obsidian Appearance Setting Font-Size value.
- Tweaked Compatibilty Setting description to mention Obsidian 1.7.1 Footnotes support

# 2.4.2

This release addresses critical issues for all Obsidian Mobile users.

#### I Made Two Mistakes
- **Rushed 2.4.1 fix:** I expedited the 2.4.1 release to resolve a major bug, but in doing so, I didn't conduct my usual level of thorough testing.
- **Premature feature inclusion:** I included a new feature from Excalidraw.com (SVG export to include only used glyphs) in 2.4.1, because I believe it brings significant end user benefits and did not want to wait until October. However, a small part of this feature was designed for server-side execution on Excalidraw.com, not for local use on Obsidian Mobile.

Despite these two emergency bug-fix releases, this doesn't deviate from the [monthly release schedule](https://youtu.be/2poSS-Z91lY). The next feature update is still planned for early October.

## Fixes:
- **Excalidraw rendering issues on Obsidian Mobile:**
  - Nested Excalidraw drawings with text failed to render.
  - Drawings in Markdown view didn't render if they contained text and were set to SVG Image or SVG Native (they worked with PNG).
  - SVG export failed for drawings containing text.
- **LaTeX equation duplication:** After using ALT+Drag to duplicate a LaTeX equation, editing the duplicate modified the original instead. [#1984](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1994)
- **Unreadable Obsidian search results:** When drawings contained numerous Element Links and Embedded Files Links, search results became unreadable. This fix will apply to files saved after installing the update. [#1999](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1999)

# 2.4.2-rc-1

This release addresses critical issues for all Obsidian Mobile users.

#### I Made Two Mistakes
- **Rushed 2.4.1 fix:** I expedited the 2.4.1 release to resolve a major bug, but in doing so, I didn't conduct my usual level of thorough testing.
- **Premature feature inclusion:** I included a new feature from Excalidraw.com (SVG export to include only used glyphs) in 2.4.1, because I believe it brings significant end user benefits and did not want to wait until October. However, a small part of this feature was designed for server-side execution on Excalidraw.com, not for local use on Obsidian Mobile.

Despite these two emergency bug-fix releases, this doesn't deviate from the [monthly release schedule](https://youtu.be/2poSS-Z91lY). The next feature update is still planned for early October.

## Fixes:
- **Excalidraw rendering issues on Obsidian Mobile:**
  - Nested Excalidraw drawings with text failed to render.
  - Drawings in Markdown view didn't render if they contained text and were set to SVG Image or SVG Native (they worked with PNG).
  - SVG export failed for drawings containing text.
- **LaTeX equation duplication:** After using ALT+Drag to duplicate a LaTeX equation, editing the duplicate modified the original instead. [#1984](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1994)
- **Unreadable Obsidian search results:** When drawings contained numerous Element Links and Embedded Files Links, search results became unreadable. This fix will apply to files saved after installing the update. [#1999](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1999)

# 2.4.1

This release includes an important fix that can result in your drawing being overwritten by another drawing. Please update to this version as soon as possible.

## Fixed
- A problem where switching between two Excalidraw documents in the same tab could result in the content from the first document overwriting the second one, particularly when the first document was large. [#1988](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1988)
- Styling issue when Obsidian font size is set to the non-default value.
- Embedding a block reference `![[file#^block]]` where the file is an excalidraw file incorrectly replaced the embedding with the image instead of the block of text.

## New
- Improved SVG export to include only the necessary glyphs for .woff2 fonts, minimizing file sizes. Note that this feature is currently supported only for .woff2 files; other font formats like .ttf and .otf will be fully embedded, leading to larger SVG files. I recommend using .woff2 files whenever possible.

# 2.4.1-rc-1

## Fixed
- A problem where switching between two Excalidraw documents in the same tab could result in the content from the first document overwriting the second one, particularly when the first document was large. [#1988](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1988)
- Styling issue when Obsidian font size is set to the non-default value.
- Embedding a block reference `![[file#^block]]` where the file is an excalidraw file incorrectly replaced the embedding with the image instead of the block of text.

## New
- Improved SVG export to include only the necessary glyphs for .woff2 fonts, minimizing file sizes. Note that this feature is currently supported only for .woff2 files; other font formats like .ttf and .otf will be fully embedded, leading to larger SVG files. I recommend using .woff2 files whenever possible.

# 2.4.0

See the notes for the beta release for a detailed list of changes in 2.4.0

[![Thumbnail - 20240827 Excalidraw 2 4 0 (Custom)](https://github.com/user-attachments/assets/e56f1119-9d76-4627-b3d3-0a4943401a5d)](https://youtu.be/LtuAaqY_DNc)

---

## Notice
There is a minor formatting issue when you set non-default font size in `Obsidian > Appearance` settings. I won't publish an update just because of this. If you are impacted, you can add the following CSS snippet under `Obsidian > Appearance > CSS Snippets`. Open the folder, create a file e.g. "`excalidraw-style-tweak.css`" and paste the below code save the file, update the list of snippets in Obsidian and enable this new snippet.

```css
.excalidraw div[data-radix-popper-content-wrapper] > div > div.Island {
 max-width: 13rem !important;
}

.excalidraw .App-menu__left {
  width: 12.5rem !important;
}
```

---

## New
- Flowcharts with CTRL/CMD+Arrow and ALT/OPT+Arrow keys
- Improved PDF Support
  - PDF++ cropped area paste
  - Import PDF into frames
- Element links with metadata
- Obisidan Hotkey overrides
- Support for Zotero style markdown links

## QoL
- Much improved freedraw flow, less autosave glitches
- Link editor CTRL+Meta/(CTRL+CMD) + click or via the command palette "Open the image-link or LaTeX-formula editor.
- Improved search and search results
- Disable double tap ereaser activation in pen mode
- Single click editing of markdown embeddables
- Set grid size and frequency
- Improved paste
- Pan & Zoom while editing Text
- Save active too-state (e.g. tool-lock) with the drawing
- Show/hide "sword" splashscreen in new drawings

## Fixed
- Duplicate line points when Alt+click adding new points in line editor- - Excalidraw Automate measureText, impacting gate placement in ExcaliBrain
- If a group includes a frame, the image reference will include all the elements in the frame, not just the frame
- Excalidraw rendering issues in markdown preview
- Markdown pages embedded in Excalidraw were broken
- Drawing did not save arrow type
- Fixed rendering of newly pasted links

## ExcalidrawAutomate
- new functions
  - tex2dataURL
  - addElementsToFrame
  - resetImageAspectRatio
- Changed
  - getViewSelectedElements(includeFrameChildren: boolean = true);
  - getOriginalImageSize with option to wait for the image to load

# 2.4.0-rc-2

## New
- Hotkey overrides in Plugin settings
- active tool will be saved with the drawing [#1967](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1967)
- new setting: Excalidraw appearance and behavior > Show splash screen in new drawings [1969](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1969)
- Pan and Zoom while editing text

![image](https://github.com/user-attachments/assets/ae937bc9-0964-4c67-87a7-5b353592a1c5)


# 2.4.0-rc-1

## New
- New setting: "Single click to edit embedded markdown". (Plugin Settings > Embed files into Excalidraw > Interactive Markdown Files)

## Fixed
- Links dragged from Zotero to Excalidraw are not recognized correctly [#1963](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1963)
- Embed preview of drawings in markdown notes is broken starting with 2.4.0-beta-7 on Android devices [#1956](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1956)

![image](https://github.com/user-attachments/assets/6c94bee3-f0b4-4883-a0a0-7c9c471a8894)


# 2.4.0-beta-10

## Performance
- Moved the JSON compressor to a separate worker thread, reducing glitches in freedraw performance during autosave.
- Refactored JSON manipulation in the load and save functions, further decreasing freedraw performance glitches when autosave runs.

## Fixes
- Fixed two issues with pasting links and transclusions. These were not rendered correctly until the user pressed CTRL+S, and block references from the back-of-the-excalidraw file (i.e. self-references in the format of `![[#^blockRef]]` triggered a warning message.
- Resolved a bug that caused Excalidraw to erroneously switch to markdown view mode when clicking a link (e.g., in backlinks or search) that should lead to an embedded image in the drawing.

## New
- Pasting multiple lines of text with `CTRL+V` (not `CTRL+Shift+V`) now replaces any image embeds with actual images and shifts the pasted text downward to make room. This enables you to copy an entire markdown document and "convert" it into text elements and images in Excalidraw with a single `CTRL+V` action.
- Added Chinese ReadMe 🙏@dmscode

## Housekeeping
- Refactored rollup.config.js and cleaned up/updated dependencies in package.json


# 2.4.0-beta-9

## Fixed
- The drawing did not save the type of arrow. e.g. if you were using elbow arrows, the next time you opened the drawing you had to select elbow arrows again.

## New
- CTRL+F search in Excalidraw will also search in image file names

## Performance
- Performance improvement for drawing freedraw lines hopefully results in significant improvement for drawings with many elements.

## Refactor
- Excalidraw.com refactored the "Diagram to Code" AI feature. Hopefully, it will still work the same way it did before.

# 2.4.0-beta-8

## Fixed
- When the selection includes an elbow arrow the repositioning of the selected elements using the arrow keys is blocked unless the start and end elements binding to the arrow are also included in the selection [#8387](https://github.com/excalidraw/excalidraw/issues/8387)
- The context menu stopped working after editing properties with stats editor [#8385](https://github.com/excalidraw/excalidraw/issues/8385)
- Markdown pages embedded as an image (i.e. not using the interactive embeddable feature) did not display embedded Excalidraw images in the markdown page and did not display fonts correctly.
- I also fixed the input prompt to edit the markdown-image size. It was very unpredictable until now.
- When Obsidian search matches text from the markdown side of the document Excalidraw will switch to markdown view when navigating to the search result (by clicking on the line in Obsidian search). Until now switching to markdown only worked for sections and block references.

## New
- Editable grid size and grid frequency in Canvas & Shape Properties. ⚠️ Note that until 2.4.0 is released the setGrid script will not be updated - and the current one will not work. However, you can use the new shape properties editor instead.
- BIG QoL: When searching for text in Excalidraw, the search result will be highlighted with bold selection borders.
- CTRL/CMD+F (search) in Excalidraw will also search element links.
- Element links now support `#tags` and `(inline dataview:: [[links]])`. This way you can assign ontology and tags to your drawing without impacting the visual look and feel of the document (as these metadata elements will be hidden from view in the element link). Searching for these in Excalidraw with CTRL/CMD+F or Obsidian's built-in search is also possible.
- Clicking Obsidian search results will highlight elements in the drawing even if multiple elements match the query. This is true for link-, tag-, and text-matches equally.
- CTRL+CMD+Click (Mac default) / CTRL+Meta+Click (Windows default): To edit the image-file link will open an editor window where you can also edit the link for the image or PDF. This way you can replace the image file with another link or add `|100%` to the end of the excalidraw-image to anchor its size or change the `page=` or `rect=` for the embedded PDF page, etc.
- New Command Palette action: `Open the image-link or LaTeX-formula editor`

## New / changed in Excalidraw Automate
- ExcalidrawAutomate `getTemplate` returned an incorrect frontmatter when the template includes `%%` in front of `# Excalidraw Data`, this resulted in an error in the deconstructed file where the first text element got an additional `## Text Elements` heading.
- getOriginalImageSize() has a new optional parameter to wait for the image to load into view
- resetImageAspectRatio() is a new utility function that resets the image to its original aspect ratio.
  - If the image is resized then the function returns true.
  - If the image element is not in EA (only in the view), then if the image is resized, the element is copied to EA for Editing using copyViewElementsToEAforEditing([imgEl]).
  - Note you need to run await ea.addElementsToView(false); to add the modified image to the view.",
```ts
async getOriginalImageSize(imageElement: ExcalidrawImageElement, shouldWaitForImage: boolean=false): Promise<{width: number; height: number}>;

async resetImageAspectRatio(imgEl: ExcalidrawImageElement): Promise<boolean>;
```



# 2.4.0-beta-7

## Fixed
- Markdown / PDF export rendering incorrectly rendered [obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) task-list as an image when it included tasks from an Excalidraw file 

## New
- Updated zh-cn translation 🙏 @dmscode
- Few experimental hyperlinks in Settings to improve navigation

# 2.4.0-beta-6

## New
- Setting under Appearance and Behavior to enable/disable double tap eraser in Pen mode. [#1760](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1760)

<img width="778" alt="image" src="https://github.com/user-attachments/assets/d161ebd3-9f3f-4a1d-b50e-f5824f8406e9">

- Support for [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) page cropping. You can select a rectangular area in PDF++ then paste it to Excalidraw and the cropped area with a link back to the source will appear.

https://github.com/user-attachments/assets/7a686cfa-e18c-47b6-a4ea-558e64ee6a2b


# 2.4.0-beta-5

## Fixed
- `Render Excalidraw file as an image in hover preview...` setting had no effect
- Improved the language of some of the preview-related settings

+ I cleaned up some of the markdownPostProcessor code.
Here are the test cases that should be verified for markdownPostProcessor:

![image](https://github.com/user-attachments/assets/bac84a75-7e09-4d6e-aa1b-5dc9a9f6028e)


# 2.4.0-beta-4

## What to test
- Please test Excalidraw previews, publishing, markdown view, reading view, hover-preview, export to PDF... with all the different settings (e.g.: excalidraw-open-md: true).
- The change impacting `getViewSelectedElmenents` may have a broad range of effects. I know of some positive changes, such as the deconstruct elements script now correctly deconstructs framed elements, but I don't know if I have broken anything. This function is such a fundamental function that it can have effects in many places.

----

## New
- New setting in the PDF import process allows pages to be imported directly into frames instead of rectangles. This enhancement offers several advantages, image references can reference page numbers (e.g. referencing all annotations for page 3 would be `![[drawing#^frame=3]]`), you can crop PDF pages in place by resizing the frame, additionally, it simplifies moving, copying, or deconstructing pages along with their annotations. [#1931](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1931)

## Fixed
- In the case of group references (i.e.: `![[drawing#^group=<groupID>]]`), if the group includes a frame, elements inside the frame will also be included in the group. 
- Frame and ClippedFrame reference will only be offered as options if one and only one frame is selected
- Improved markdown preview rendering speed especially in the case of PDF Exports [#1932](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1932)

## New in ExcalidrawAutomate
- `addElementsToFrame(frameId: string, elementIDs: string[]):void;`;

## Breaking change
- `getViewSelectedElements(includeFrameChildren: boolean = true): ExcalidrawElement[];`: if frames are selected the function will return the frames and all their child elements unless `includeFrameChildren` is set to false. Until now, the function did not return frame children, however, this behavior is inconsistent with the copy/paste experience.

# 2.4.0-beta-3

https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1930
## Fixed
- ExcalidrawAutomate `measureText` returned an incorrect value because `getFontFamily` returned undefined. This resulted in ExcaliBrain gates getting offset incorrectly since 2.2.11

## New in ExcalidrawAutomate
- Exposing `ea.tex2dataURL` based on FR [#1930](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1930)
```ts
async tex2dataURL(
    tex: string,
    scale: number = 4 // Default scale value, adjust as needed
  ): Promise<{
    mimeType: MimeType;
    fileId: FileId;
    dataURL: DataURL;
    created: number;
    size: { height: number; width: number };
  }> 
```

# 2.4.0-beta-2

## Fix
- Disable flowchart keybindings inside inputs [#8353](https://github.com/excalidraw/excalidraw/issues/8353)
- Improve detection of line intersections
- Duplicate line points when ALT+clicking in Line Editor to add line points [#8346](https://github.com/excalidraw/excalidraw/issues/8346)

https://github.com/user-attachments/assets/c4b8db62-ab4c-4b4f-aec0-392d529369e3

## New
- create flowcharts from a generic element using elbow arrows  [#8329](https://github.com/excalidraw/excalidraw/pull/8329)
  - With the addition of elbow arrows, we now support the creation of a flowchart from a selected generic element with **Ctrl/Cmd + arrow key**
  -  Once a flowchart has been created, from any one of the nodes, we can navigate the flowchart using **Alt/Option + arrow key**
  - Additionally, holding Ctrl/Cmd and pressing the arrow key n times will create n nodes in the given direction at once when the starting node has multiple nodes connected to it, holding Alt/Option and pressing the arrow key will cycle between the connected nodes, giving users a chance to navigate to any one node in a flowchart

https://github.com/user-attachments/assets/d9ab2f15-f336-45e3-969d-5dc414a9a91f



# 2.4.0-beta-1

## New 
- create flowcharts from a generic element using elbow arrows  [#8329](https://github.com/excalidraw/excalidraw/pull/8329)
  - With the addition of elbow arrows, we now support the creation of a flowchart from a selected generic element with **Ctrl/Cmd + arrow key**
  -  Once a flowchart has been created, from any one of the nodes, we can navigate the flowchart using **Alt/Option + arrow key**
  - Additionally, holding Ctrl/Cmd and pressing the arrow key n times will create n nodes in the given direction at once when the starting node has multiple nodes connected to it, holding Alt/Option and pressing the arrow key will cycle between the connected nodes, giving users a chance to navigate to any one node in a flowchart

https://github.com/user-attachments/assets/d9ab2f15-f336-45e3-969d-5dc414a9a91f



# 2.3.0

I am moving to a new release approach aiming to publish one update per month to the Obsidian script store. If you want to continue to receive more frequent updates with new features and minor bug fixes, then join the beta testing team. [#1912](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1912)

[![Thumbnail - 20240803 Excalidraw Release Approach (Custom)](https://github.com/user-attachments/assets/ab40648c-f73f-4bda-a416-52839f918f2a)](https://youtu.be/2poSS-Z91lY)

## New
- Elbow connectors:  https://x.com/excalidraw/status/1819084086222393554

## Fixed 
- Convert Markdown to Excalidraw did not work correctly when there was `---` anywhere in the file, but no frontmatter (e.g. a table)
- Fixed Obsidian move tab to new window
- Fixed duplicating bound arrows without its bound elements throwing error [#8315](https://github.com/excalidraw/excalidraw/issues/8315)

# 2.3.0-beta-1

## New
- Elbow connectors:  https://x.com/excalidraw/status/1819084086222393554

# Fixed 
- Convert Markdown to Excalidraw did not work correctly when there was `---` anywhere in the file, but no frontmatter (e.g. a table)
- Fixed Obsidian move tab to new window
- Fixed duplicating bound arrows without its bound elements throwing error [#8315](https://github.com/excalidraw/excalidraw/issues/8315)

# 2.2.13-1

## New
Elbow connectors:  https://x.com/excalidraw/status/1819084086222393554

# Fixed 
- Convert Markdown to Excalidraw did not work correctly when there was `---` anywhere in the file, but no frontmatter (e.g. a table)
- Fixed Obsidian move tab to new window


# 2.2.13

## Fixed
- Could not undo element after pasting [#1906](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1906)
- Links broke after renaming an Excalidraw file using the F2 shortcut [#1907](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1907)
- Unable to open or convert very large `.excalidraw` file, e.g. BoaPs you can download from [here](https://ko-fi.com/zsolt/shop)


# 2.2.12

## Fixed
- Rename moved files to root folder [#1905](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1905)
- Fonts not displaying correctly in cached image previews

# 2.2.11

![badges](https://github.com/user-attachments/assets/7591b523-6bc6-46ff-b552-5c3492139e4c)

## New
- Font picker with additional fonts (not yet fully configurable, but that will come in due time) [#8012](https://github.com/excalidraw/excalidraw/pull/8012)
- Introducing Visual Thinking Badges. The more you use Excalidraw the higher your rank will be. Levels are: Bronze, Silver, Gold and Platinum.

## Fixed
- Embedded PDF was not visible on phones [#1904](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1904)
- F2 does not rename files in Excalidraw View [#1900](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1900)
- Wireframe to Code now honors the GPT model settings in plugin settings. [#1901](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1901)
- Updated ExcaliAI to support gpt-4o for vision. [#1859](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1859) 🙏@Saik0s
- Minor fixes from excalidraw.com [#8287](https://github.com/excalidraw/excalidraw/pull/8287), [#8285](https://github.com/excalidraw/excalidraw/pull/8285)

# 2.2.10-2

FontPicker 2nd beta

# 2.2.10-1

early beta release of the fontpicker in Obsidian

# 2.2.10

[![Thumbnail - 20240721 Image references for embedded images (Custom)](https://github.com/user-attachments/assets/44c020d6-fdaf-4b01-9003-7ff589077827)](https://youtu.be/sjZfdqpxqsg)

## Fixed
- Drastically degraded rendering performance when zoomed in and when arrows with labels are used. [#8267](https://github.com/excalidraw/excalidraw/pull/8267), [#8266](https://github.com/excalidraw/excalidraw/pull/8266), , [#1893](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1893)
- Frame title font in exports. 

## New
- Area, Group, Frame, and Clipped-Frame references to images now also work when pasting images to Excalidraw.
- The new reference type `clippedframe=` works in the same way as `frame=` but will display the elements clipped by the frame. `clippedframe=` will always display the image with zero padding.
- New command palette action: `Frame Settings` gives you fine-grained control over how frames are rendered. Frame settings will also be reflected in image exports. For example, if you hide the frame name or outline, then in exports they will not be visible.

# 2.2.9

## New
- Improved the "Open the back-of-the-note of the selected Excalidraw image" action. It now works with grouped elements and keeps the popout window within the visible screen area when elements are close to the top of the canvas. Note: Due to an Obsidian bug, I do not recommend using this feature with versions 1.6.0 - 1.6.6, if you have Obsidian Sync enabled, because Obsidian may freeze when closing the popout window. It functions properly in Obsidian versions before 1.6.0 and from 1.6.7 onwards. 

## Fixed
- Drag and drop from a local folder (outside Obsidian) resulted in duplicate images.
- Insert Link Action did not work [#1873](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1873)
- Insert Obsidian Command Action did not work
- Element link for text element got deleted when editing the text. [#1878](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1878)
- When back-of-the-drawing Section Headings have spaces in them, clicking the link opens the drawing side not the markdown side. [#1877](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1877)
- obsidian:// links did not work as expected. [#1872](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1872)
- copying and moving a rectangle with text, moves the text unexpectedly. The issue should now be resolved (at least much less likely to occur) [#1867](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1867)

# 2.2.8

While this release may appear modest with no new features, it represents nearly 50 hours of dedicated work. Here's what's been improved:

- **Enhanced Memory Management**: Significant improvements to optimize memory usage.
- Bug Fixes:
  - Support for multi-file drag and drop from the operating system.
  - Correct theming of animated GIFs as Embeddables.
  - Several other minor bug fixes.

Due to extensive refactoring of the codebase, there may be some unexpected issues. Thanks for your understanding and patience.

# 2.2.7-5



# 2.2.7-4

Solved Excalidraw Package memory leak. There is still leak in the Obsidian plugin

# 2.2.7-3

removed the large placeholder object I use to trace memory leakage that I forgot to remove from 2.2.7-2

# 2.2.7-2

Fixed text element responsiveness. 
Removing React and Version Update Timer when plugin unloads.

# 2.2.7-1

There are no new features, only code refactoring focusing on improving memory use. There are many-many changes, thus this requires thorough testing before it goes live to the public.

# 2.2.7

## New
- In Miscellaneous Settings: added **Load Excalidraw Properties into Obsidian Suggester**. This setting toggles the automatic loading of Excalidraw properties at startup. Enabled by default for easy use of front matter properties. Disabling it prevents auto-loading, but you'll need to manually remove unwanted properties using Obsidian properties view. A plugin restart is required after enabling auto-loading.

## Fixed
- Zotero support [1835](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1835)
- Lines binding to elements and selections [#8146](https://github.com/excalidraw/excalidraw/issues/8146), and plugin getting stuck with dragging an element [#8131](https://github.com/excalidraw/excalidraw/issues/8131)

# 2.2.6

## Fixed
- CTRL+F search for text elements in drawing: result is not selected. This is a regression in 2.2.5 [#1822](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1822)

## New
- Zotero compatibility support for back-of-the-side markdown notes. This needs to be enabled in plugin settings under Compatibility [#1820](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1820)

## New from Excalidraw.com
- Stats & Element Properties is now editable, e.g. you can type in the exact position and size of objects.
- Pasting mermaid diagrams from chatGPT will embed a diagram instead of the text

# 2.2.5

## Fixed
- Cursor visibility in dark mode [#1812](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1812)
- SVG to Excalidraw now...
  - converts elements inside the `<switch>` tag, improving compatibility with SVGs from [The Noun Project](https://thenounproject.com/)
  - sets visibility for all elements, preventing invisible converted images.
- Cached images sometimes lost their font face and natural size when nested in an Excalidraw scene. This issue occurred when drawings were embedded in a markdown note (native SVG) and nested in a drawing simultaneously. Depending on the update and render sequence, these drawings sometimes appeared incorrectly in the Excalidraw scene.

# 2.2.4


[![scribble support (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/c4f5c4c7-9b8f-427f-aa6f-8c1b189610af)](https://youtube.com/shorts/zF1p2yfk4f4)


## New from Excalidraw.com
-  You can now set the text width even during creation. Simply drag with the text tool. Note, there's a minimum distance before the text enters the wrapped mode so there aren't false positives. [See example here](https://x.com/excalidraw/status/1795468201335075000)

## New
- Updated zh-cn translation. Thank you @dmscode 
- New context menu and command palette action: "Move back-of-note card to File". This is only active when an eligible embeddable element is selected.

## Fixed
- Setting different autosaveIntervals on Desktop and Mobile will no longer trigger unnecessary commits to settings each time you open Excalidraw on a different device. Thanks @jmhammond for the contribution! [#1805](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1805), [#1652](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1652), [#888](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/888)

## Fixed in ExcalidrawAutomate
- `getCM(color)` was missing from `ea.help()`. It is now added. getCM returns a ColorMaster object. ColorMaster is a powerful library should you want to create scripts to manipulate colors. Check out my [Scripting Colors](https://youtu.be/7gJDwNgQ6NU) video should you want to learn more. [#1806](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1806)

# 2.2.3

## Fixed
-  Undo history was not properly initialized [#1791](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1785)
- Excalidraw did not save edits when switching to markdown view mode with a hotkey or terminating the popout window
- SVG export did not maintain the aspect ratio of manually distorted images [#1780](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1780)

## New
- In pen mode, double tapping the screen will toggle the eraser tool when using freedraw tool, or one of the other tools in locked mode. [#1760](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1760)
- New setting under "Excalidraw appearance and behavior" to disable rendering of Excalidraw drawings in hover previews, in case the file has the `excalidraw-open-md: true` frontmatter property [#1795](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1795)
- Additional foolproofing of `# Excalidraw Data`. The file is now more resilient to automated linting and other changes. There is also a new setting under "Compatibility Features" to add a dummy first text element to `## Text Elements`. You can use this feature if your auto-linter adds empty lines after section headings.
- Pasting markdown code blocks will create a back-of-the-note card with the code block. CTRL+SHIFT+V will paste the text as a normal text element. When copying code from Chat GPT the markdown code fence (triple backtick) is missing. In this case, you may use the new context menu action "Paste code block" to create a back of the note card with the code block.
- Pasting long text will be wrapped in the text element.

## New in ExcalidrawAutomate
- Updated viewUpdateScene: This now implements the [new Excalidraw API](https://github.com/excalidraw/excalidraw/pull/7898)
```ts
  viewUpdateScene (
    scene: {
      elements?: ExcalidrawElement[],
      appState?: AppState,
      files?: BinaryFileData,
      commitToHistory?: boolean,
      storeAction?: "capture" | "none" | "update",
    },
    restore: boolean = false,
  ):void ;
  ```
- Updated addText. The function now supports the new text-wrapping feature
```ts
  addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      autoResize?: boolean; //Default is true. Setting this to false will wrap the text in the text element without the need for the container. If set to false, you must set a width value as well.
      wrapAt?: number; //wrapAt is ignored if autoResize is set to false (and width is provided)
      width?: number;
      height?: number;
      textAlign?: "left" | "center" | "right";
      box?: boolean | "box" | "blob" | "ellipse" | "diamond";
      boxPadding?: number;
      boxStrokeColor?: string;
      textVerticalAlign?: "top" | "middle" | "bottom";
    },
    id?: string,
  ): string
  ```

# 2.2.2

## Fixed
- ExcaliBrain stopped working with 2.2.0

![I apologize](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/3b05aa28-788d-4329-9721-798ad58a6ca2)


# 2.2.1

## Fixed
- Text height becomes unreadable after 2.2.0 update. [#1784](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1784)
- Images are loaded with a rounded border when loading old Excalidraw files
- Embedded Excalidraw images cache gets stuck with old version of the image
- Extremely long loading times with legacy (3+ years old) Excalidraw files

# 2.2.0

[![Thumbnail - 20240518 Excalidraw file structure (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/58e183d1-4ebc-4d6c-ae50-5a40270d24b4)](https://youtu.be/dV0NEOwn5NM)

⚠️⚠️⚠️ BREAKING CHANGE ⚠️⚠️⚠️
Files you save with 2.2.0 are not backward compatible with earlier plugin versions!

## New from excalidraw.com
- Wrapable text elements (without the need for transparent sticky notes!)

## New
- File format. I nested all Excalidraw markup under `# Excalidraw Data`.  Here's the new structure.
```markdown
---
excalidraw-plugin: parsed
other-frontmatter-properties: values
---
back of the note bla bla bla

# Excalidraw Data
## Text Element
## Element Links
## Embedded Files
%%
## Drawing
%%
```
- When opening Excalidraw in Markdown `# Excalidraw Data` will be folded.
- New command palette action: `Open the back-of-the-note of the selected Excalidraw image`. The action is only visible when selecting an embedded Excalidraw drawing in the Scene. On a desktop, the command will open the back of the selected card in a popout window, and on a mobile, in a new tab.

## Fixed
- Drag and drop from Finder/Explorer (OS external). Images will retain their filenames. PDFs will be imported to the Vault. [#1779](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1779)

# 2.1.8.2-beta-1

Files you save with 2.2.0 are not backward compatible with earlier versions of the plugin!

# New
- Merged new wrapable text elements from Excalidraw.com
- File format. I nested all Excalidraw markup under `# Excalidraw Data`.  Here's the new structure.
```markdown
---
excalidraw-plugin: parsed
other-frontmatter-properties: values
---
back of the note bla bla bla

# Excalidraw Data
## Text Element
## Element Links
## Embedded Files
%%
## Drawing
%%
```
- When opening Excalidraw in Markdown `# Excalidraw Data` will be folded.
- New command palette action: `Open the back-of-the-note of the selected Excalidraw image`. The action is only visible when you have an embedded Excalidraw drawing selected in your Excalidraw scene. The command will open the back of the selected card in a popout window on Desktop, and in a new tab on mobile.

# 2.1.8.1-beta-2

Files you save with 2.2.0 are not backward compatible with earlier versions of the plugin!

# New
- File format. I nested all Excalidraw markup under `# Excalidraw Data`.  Here's the new structure.
```markdown
---
excalidraw-plugin: parsed
other-frontmatter-properties: values
---
back of the note bla bla bla

# Excalidraw Data
## Text Element
## Element Links
## Embedded Files
%%
## Drawing
%%
```
- When opening Excalidraw in Markdown `# Excalidraw Data` will be folded.
- New command palette action: `Open the back-of-the-note of the selected Excalidraw image`. The action is only visible when you have an embedded Excalidraw drawing selected in your Excalidraw scene. The command will open the back of the selected card in a popout window on Desktop, and in a new tab on mobile.

# 2.1.8

## Fixed
- Fixing issues that surfaced after Obsidian 1.6.0
  - Support for new hover preview CSS
  - Cursor color for links, text elements, and frame names. Became invisible if Obsidian was in dark mode and Excalidraw in light mode.
  - Rendering Excalidraw drawings in Markdown views, right after Obsidian loaded did not work.
- More graceful fail when malformed SVG is submitted for SVG to Excalidraw conversation. [#1768](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1768)

## New
- New setting under "Save" in plugin settings to NOT decompress JSON when switching to Markdown view mode. For details see description under "Save" settings. The benefit is smaller file size and fewer results in the Obsidian search. If you want to edit the JSON, you can always manually decompress JSON in markdown view mode with the command palette action "Excalidraw: Decompress JSON".

# 2.1.8.1-beta-1

Changed file specification. Now Excalidraw is nested under 

# Excalidraw Data

# Excalidraw Data is automatically folded when the file is opened.

# 2.1.7


[![Thumbnail - 20240501 Excalidraw 2M view showcase (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/da34bb33-7610-45e6-b36f-cb7a02a9141b)](https://youtu.be/P_Q6avJGoWI)

## Updates from Excalidraw.com
- Improved undo management.
- Improved handle to scale images from the side.
- Changed arrow binding behavior.
- Many other minor fixes and improvements.

## New
- Introduced image caching for nested (embedded) Excalidraw drawings on the scene. This enhancement should lead to improved scene loading times, especially when dealing with numerous embedded Excalidraw drawings.
- Added new OCR Command Palette actions. Users can now re-run OCR and run OCR for selected elements.

## Fixed
- Fixed an issue where cropping an embeddable PDF frame in the Excalidraw Scene caused distortion based on the embeddable element's aspect ratio. ([#1756](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1756))
- Removed the listing of `# Embedded files` section when adding a "Back of the note card". ([#1754](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1754))
- Resolved the issue where closing the on-screen keyboard with the keyboard hide button of your phone, instead of tapping somewhere else on the Excalidraw scene, did not resize the scene correctly. ([#1729](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1729))
- Fixed the problem where pasting a text element as text into markdown incorrectly pasted the text to the end of the MD note, with line breaks as rendered on screen in Excalidraw. Also addressed the issue where pasting an image element as an image resulted in it being pasted to the end of the document. ([#1749](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1749))
- Corrected the color inversion of embedded images when changing the theme from light to dark, then back from dark to light, and again from light to dark on the third change.
- Addressed the problem where cropping an image while unlocking and rotating it in the cropper did not reflect the rotation. Note that rotating the image in Cropper required switching to markdown view mode, changing the "locked": true property to false, then switching back to Excalidraw mode. This issue likely impacted only a very few power users. ([#1745](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1745))

## New in ExcalidrawAutomate
```ts
/**
   * Retruns the embedded images in the scene recursively. If excalidrawFile is not provided, 
   * the function will use ea.targetView.file
   * @param excalidrawFile 
   * @returns TFile[] of all nested images and Excalidraw drawings recursively
   */
  public getEmbeddedImagesFiletree(excalidrawFile?: TFile): TFile[];
```


# 2.1.6.1-beta-1



# 2.1.6

## Two minor fixes
- Fixed scaling of LaTeX formulas when the formula is changed [#1724](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1724)
- Resolving an odd issue that has been there since November 2021 (v1.4.9). If the back of the note card only contains a block embed `![[embed]]` this was removed when saving the Excalidraw file.



# 2.1.5

## New
- Save "Snap to objects" with the scene state. If this is the only change you make to the scene, force save it using CTRL+S (note, use CTRL on Mac as well).
- Added "Copy markdown link" to the context menu.

## Fixed
- Paste operation occasionally duplicated text elements. [#1723](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1723)
- Pasting multiple instances of the same image from excalidraw.com or another instance of Obsidian, or pasting an image from anywhere and making copies with ALT/OPT + drag immediately after pasting (before autosave triggered) led to broken images when reopening the drawing.
- CTRL/CMD+Click on a Text Element with an element link did not work (previously, you had to click the top right link indicator). Now, you can click anywhere on the element. [#1725](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1725)
- Hover preview for elements with a link only worked when hovering over the element link. Now, you can hover anywhere. If there are multiple elements with links, the top-level element will take precedence.
- Link navigation within drawing when the "Focus on Existing Tab" feature is enabled under "Links, transclusion and TODOs" in settings works again.
- If a link points to a back-of-the-card section or block the drawing will automatically switch to markdown view mode and navigate to the block or section.
- DynamicSytle, dark mode when canvas background is set to transparent.
- Scale to maintain the aspect ratio of a markdown notes embedded as images.
- You can now borrow interactive markdown embeds to tables, blockquotes, list elements and callouts - not just paragraphs.
- Back of the drawing cards:
    - Leaving the Section Name empty when creating the first back of the card note resulted in an error.
    - If you add the markdown comment (`%%`) directly before `# Text Elements`, a trailing `#` will be added to your document, when adding a back of the card note. This is to hide the markdown comment from the card. The trailing (empty) `#` will not be visible in reading mode, pdf exports, and when publishing with Obsidian Publish. 
Here's a sample markdown structure of your document:

```markdown
---
excalidraw-plugin: parsed
---
# Your back of the card section
bla bla bla

#
%%
# Text Elements
... the rest of the Excalidraw file
```

# 2.1.4

## Fixed
- Fixed the **aspect ratio** of an Excalidraw embedded within another Excalidraw **not updating**. [#1707](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1707)
- Some plugins automatically add document properties to all files in the Vault. Users with this configuration were **unable to run Excalidraw scripts**. Excalidraw now removes document properties from the script before execution.
- The very last markdown edit sometimes **wasn't saved when immediately switching from Markdown to Excalidraw View**. I now force a save before switching views. 
- The setting to disable/enable `CTRL/CMD + CLICK on text with [[links]] or [](links) to open them` works again. [#1704](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1704)
- **Annotation and cropping** of images in Markdown notes now also work **with Markdown links that have encoded characters** e.g.: `![images with](markdown%20links)`.
- Solved compatibility issue of **Taskbone OCR on Android**.

## New
- New settings:
  - Under "Appearance and Behavior": Option to **render Excalidraw file as an image in Markdown reading mode**. This setting is disabled by default. [#1706](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1706), [#1705](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1705)
  - Under "Embedding Excalidraw ... and Exporting"/"Export Settings": Option to **render Excalidraw file as an image when exporting to PDF** in Markdown mode. This option is disabled by default. When enabled, exporting an Excalidraw drawing in markdown view mode to PDF will render the image on the page.
- **Enhanced annotation and cropping** of images in Markdown documents:
  - Newly embedded **links will now follow the style of the original link**. If the original format was a `![markdown](link)`, the annotated file will follow this format. For `[[wiki links]]`, it will follow that style. Additionally, if an alias was specified like `[[link|alias]]`, the annotated or cropped image will retain the alias.
  - Introduced a new setting under "Saving" titled **"Preserve image size when annotating"**. This setting is disabled by default. When enabled, the embed link replacing the annotated image will maintain the size of the original image.
- Option to **automaticaly embed the scene in exported PNG and SVG image files**. Including the scene will allow users to open the picture on Excalidraw.com or in another Obsidian Vault as an editable Excalidraw file.New setting is under the Export category. The new frontmatter tag is: `excalidraw-export-embed-scene: true/false`.

# 2.1.3

Minor change and republishing of 2.1.2

# 2.1.2

## Quality of Life Improvements
- The "Insert Any File" option that disappeared from the Command Palette is now restored. [#1690](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1690)
- Improved two-finger pan speed.
- Fixed text wrapping issue that caused text to jump around when editing text in a sticky note when the Obsidian zoom level was not set to 100%.
- Mask Generation in [ExcaliAI](https://youtu.be/3G8hsV-V-gQ) Edit Image now works properly again. [#1684](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1684)
- Fixed aspect ratio change for .jpg, .png, .bmp, .webp, .SVG (non-Excalidraw) images. Previously, if the image was distorted (i.e. you held SHIFT while resizing it), it would revert to the original aspect ratio upon saving the drawing. Resetting the aspect ratio is the desired behavior for nested Excalidraw drawings since you might have changed the source image and want it to still display with the correct aspect ratio, however for other image files, the behavior is not desired. [#1698](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1698)
- The command palette action "Set selected image element size to 100% of original" now works even on freshly pasted images, not just after saving the drawing. ([#1695](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1698))
- If a text element has an element link (CTRL/CMD+K), but the link was not reflected in the Element Text, then CTRL/CMD+clicking the text element did not navigate to the link, only clicking the link indicator did. Now you can also CTRL/CMD click anywhere on the text element and it will navigate. Note, however, that links in the text element text take precedence over element links.


# 2.1.1

## Fixed
- Printing a markdown page that has an Excalidraw drawing on the back side, resulted in an empty PDF. This is now resolved.

## New
- Reduce the visual clutter by fading out the Excalidraw markup in markdown view mode. This feature needs to be enabled in plugin settings. You'll find the setting under `Miscellaneous features`. Look for `Fade out Excalidraw markup`. Depending on the location of the markdown comment `%%`, if the comment starts before `# Text Elements` then the fading will start from `# Text Elements`, if the comment is before `# Drawing` then the fading will only start with "drawing". If you delete the opening `%%` the markup will be visible. Note, that if you place the comment before `#Text Elements`, you will not be able to reference blocks in the `# Text Elements` section, because Obsidian does not index blocks within comment blocks. Image references are not effective, they will work.

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/bb96cdb4-8c5f-4dc5-ad39-7fccee6d5cac)

![fade out setting](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/e627fdb7-6820-4d7d-97f9-a030016be9aa)


# 2.1.0

Bumping the version to 2.1.0 due to minor file format changes that aren't backward compatible. Essentially, 2.0.26 is already not backward compatible, but I forgot to update the version number.

If you haven't watched the [walkthrough video](https://youtu.be/tHUcD4rWIuY) for 2.0.26, I recommend you do so.

## New
- Settings under `Excalidraw Appearance and Behavior`
  - Configure visibility of the crosshair cursor when using the pen tool. [#1673](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1673)
  - Set the time delay for long press to open drawings from markdown under "Link Click and Modifier Keys".


# 2.0.26


[![Thumbnail - 20240324 PKM workshop debrief with Nicole (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/549d75ec-ca67-43f8-804a-f5d13b3be3d5)](https://youtu.be/tHUcD4rWIuY)


## New
- Minor updates from [Excalidraw.com](https://excalidraw.com). The key change is text measurements that should result in consistent text sizing between desktop and mobile devices.
- Now you can embed the markdown section of an Excalidraw note to your drawing. Simply select `Insert ANY file`, choose the drawing, and select the relevant heading section to embed.
  - This also works with "back-of-the-drawing" markdown sections. Use the context menu `Add back-of-note Card`. The action is also available on the Command Palette and in the Excalidraw-Obsidian Tools Panel.
- Editing an embedded markdown note is now easier. Just press Enter when the element is selected. [#1650](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1650)
- The crosshair cursor is now hidden when the freedraw tool is active and using a pen. [#1659](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1659)
- `Convert markdown note to Excalidraw Drawing` now converts an existing markdown note (not just empty notes) into a drawing. The original markdown note will be on the "back side of the drawing".
- Introducing `Annotate image in Excalidraw`, which works very similarly to `Crop and mask image`. You can replace an image in a markdown note or on the Obsidian Canvas with an Excalidraw drawing containing that image. You will be able to annotate the image in Excalidraw.
- Now you can reference frames in images embedded in markdown and canvas with frame names e.g. `![[drawing#^frame=Frame 01]]`
- Excalidraw file format change:
  - New frontmatter switch `excalidraw-open-md`: If set to true, the file by default will open as a markdown file. You can switch to Excalidraw View Mode via the command palette action or by right-clicking the tab.
  - Easter Egg: If you add a comment in front of `# Text Elements`, then the entire Excalidraw data: markdown and JSON will be commented out, thus invisible when exporting to the web. If you remove the comment from before `# Text Elements`, then only the JSON will be commented out.

Before:
```markdown
[#1657](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1657) 
%%
# Text Elements
...
# Drawing
```

After:
```markdown
# Text Elements
....
%%
# Drawing
```

# 2.0.25

## New - a small change that opens big opportunities
- You can now set a folder as the Excalidraw Template in settings (See under Basic). If a folder is provided, Excalidraw will treat drawings in that folder as templates and will prompt you to select the template to use for new drawings.
- I updated the <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Deconstruct%20selected%20elements%20into%20new%20drawing.md">Deconstruct Selected Elements into new Drawing</a> script to accommodate the new template setting.


# 2.0.24

Quality of Life Fixes!

## Fixed
- Text editing issue on mobile devices with an on-screen keyboard is now fixed 🥳. Previously, Excalidraw's UI fell apart when the keyboard was activated, and often even after you stopped editing, the canvas positioning was off. I hope to have solved the issue (we'll see after your testing and feedback!). This is one of those cases that seems insignificant but took enormous effort. It took me 2.5 full days of net time to figure out the root cause and the solution (this is not an exaggeration).
- Tool buttons did not get selected on the first click.
- Images flicker on Forced Save.
- Hover preview fixes:
  - `area=`, `group=`, `frame=` references now display the part of the image as expected in hover preview (showed an empty preview until now).
  - Block and section references to notes on the "back side of the drawing" now correctly show up in hover preview (showed an empty preview until now).

## New
- Default height setting in Plugin Settings. Thanks @leoccyao! [#1612](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1612)


# 2.0.23

## New
- Additional arrowheads (Circle, Circle Outline, Diamond, Diamond Outline, Triangle Outline) are now available via element properties.
- Setting under "Links and Transclusions" to show/hide second-order links

## Fixed
- some styling issues with dynamic styles (e.g.: text color of context menu)

## New in ExcalidrawAutomate
- Excalidraw Publish Support: New hook to modify the link in the exported SVGs. This is useful when you want to export SVGs to your website. If set, this callback is triggered whenever a drawing is exported to SVG. The string returned by the hook will replace the link in the exported SVG. The hook is only executed if the link is to a file internal to Obsidian. [1605](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1605)
```js
onUpdateElementLinkForExportHook: (data: {
*    originalLink: string,
*    obsidianLink: string,
*    linkedFile: TFile | null,
*    hostFile: TFile,
*  }) => string = null;
```

# 2.0.22

## Fixed
- BUG: Unable to load obsidian excalidraw plugin on ipad 15.x or older [#1525](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1525)
- BUG: ea.help does not display help if only function signature is available [#1601](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1601)

# 2.0.21

## New/changed
**"Focus on Existing Tab"**
- New Setting: Disabled by default.
  - Prevents multiple instances of the same drawing from opening when clicking on links within Excalidraw.
  - Overrides the "Reuse Adjacent Pane" option when the file is already open.
  - Accessible under "Links, Transclusions, and TODOs" in plugin settings.

**Enhanced Context Menu Functions for Text Containers**
- Two new context menu functions added for containers with a text element:
  - Right-click to select the text element only, allowing independent color changes from the container.
  - Remove orphaned element links when the text element has a link but no longer includes a link in the text.

**Improved Laser Pointer Activation**
- Laser pointer activation on double tap in view mode removed due to interference with link navigation and other features.
- When the drawing is in "view" mode, laser pointer activation now available via long-press/right-click context menu.
- Alternatively, activate the laser pointer with "k" if you have a keyboard.

## Fixed
- **Older iOS and Android webview support**: Rebuilt all packages and dependencies with Node 18, hoping to address (sorry I can't reproduce/test these issues myself) compatibility issues with older iPad OS versions, up to 15.7. [#1525](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1525), and Android [1598](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1598)
- **Double-click navigation**: Fixed the issue where double-clicking an embedded image did not navigate to the link in view mode.
- **ExcaliBrain new file creation**: Resolved the issue with new file creation from ExcaliBrain. [#201](https://github.com/zsviczian/excalibrain/issues/201)
- **Canvas immersive style**: Removed Canvas immersive embedding style support from the Excalidraw stylesheet to address performance issues experienced by some users with various Obsidian themes. If you require this feature, you can add a CSS snippet with the provided code.


```css
.canvas-node:not(.is-editing):has(.excalidraw-canvas-immersive) {
  ::-webkit-scrollbar,
  ::-webkit-scrollbar-horizontal {
    display: none;
  }
  background-color: transparent !important;
}

.canvas-node:not(.is-editing) .canvas-node-container:has(.excalidraw-canvas-immersive) {
  border:       unset;
  box-shadow:   unset;
}
```


# 2.0.20

## Fixed in ExcalidrawAutomate
- Regression:  `ea.getMaximumGroups(elements)` stopped working after the 2.0.19 update. [#1576](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1576)

# 2.0.19

[![cropped_Thumbnail - 20240201 PDF Cropping Goodness (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/6053b754-9ee4-488c-a4dc-f12f8e0d0131)](https://youtu.be/4wp6vLiIdGM)


## Fixed
- When updating Excalidraw, some open drawings weren't automatically reopening. I hope I got this fixed (note this change will only have an effect when you receive the update after this).
- In dark mode, the frame header is challenging to see when modified [#1568](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1568).

## New
- Crop PDF pages:
  - Available in Excalidraw, Markdown Notes, and on the Canvas.
  - Crop the active page from the embedded PDF viewer and insert the cropped image into the current view, both in Excalidraw and on Canvas.
- New Command Palette Action: "Insert active PDF page as image." This action is functional in Excalidraw. If an embedded Obsidian-PDF-viewer is present, executing this command will insert the active page as an image into the Excalidraw scene.
- Two new settings introduced:
  - "Basic" section allows setting the folder for crop files.
  - "Saving/filename" section enables setting the prefix for crop files.
- PDF import now defaults to importing all pages.
- Rounded corners now available for images.
- Second-order links now encompass forward links from embedded Excalidraw Files.
- Clicking a cropped file in a markdown note or on Canvas will prompt to open the original file, not just the cropper.



# 2.0.18

## New
[![vintage-mask](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/0dc5af10-d6bf-4bd5-aafa-55c3bb3f611c)](https://youtube.com/shorts/ST6h4uaXmnY)
- [Crop Vintage Mask Script](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Crop%20Vintage%20Mask.md). Install it from the script library. It will add a rounded corner mask to your cropped image.
- New advanced setting under "Non-Excalidraw.com Supported Features" in settings. You can modify the memory limit of image zooming to achieve a sharper zoom-in experience on some devices.
- Laser Pointer will not activate on Double Click in ExcaliBrain

## Fixed
- Cropping rotated images in Excalidraw

## New in ExcalidrawAutomate
- You can now provide a desired element ID to many of the add functions. addLine, addArrow, addRect, etc.
- ea.help now provides help on Script Engine utils functions as well
- ea.isExcalidrawMask(file?:TFile) will return true if the currently open view or the supplied file is an Excalidraw Mask file.

# 2.0.17

## Fixed
- Image cropping now supports dark mode
- Image cropping/carve-out was not working reliably in some cases [#1546](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1546)
- Masking a mirrored image resulted in an off-positioned mask

## New
- Context menu action to convert SVG to Excalidraw strokes
- Updated Chinese translation (Thank you @tswwe)

# 2.0.16

## Fixed
- Image cropping did not work with large files on lower-powered devices [#1538](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1538). 
- Mermaid editor was not working when Excalidraw was open in an Obsidian popout window [#1503](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1503)

# 2.0.15

[![Thumbnail - 20240106 Image Cropping (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/499114c4-5cfd-481b-867f-a409b92a812d)](https://www.youtube.com/embed/uHFd0XoHRxE)

## New
- Crop and Mask Images in Excalidraw, Canvas, and Markdown. (Inspired by @bonecast [#4566](https://github.com/excalidraw/excalidraw/issues/4566))
- Draw metadata around images but hide it on the export.

## Fixed
- Freedraw closed circles (2nd attempt)
- Interactive Markdown embeddable border-color (setting did not have an effect)

# 2.0.14

## New
- Stylus button now activates the eraser function. Note: This feature is supported for styluses that comply with industry-standard button events. Unfortunately, Samsung SPEN and Apple Pencil do not support this functionality.

## Fixed
- Improved handwriting quality. I have resolved the long-standing issue of closing the loop when ends of the line are close, making an "u" into an "o" ([#1529](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1529) and [#6303](https://github.com/excalidraw/excalidraw/issues/6303)).
- Improved Excalidraw's full-screen mode behavior. Access it via the Obsidian Command Palette or the full-screen button on the Obsidian Tools Panel ([#1528](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1528)).
- Fixed color picker overlapping with the Obsidian mobile toolbar on Obsidian-Mobile.
- Corrected display issues with alternative font sizes (Fibonacci and Zoom relative) in the element properties panel when editing a text element (refer to [2.0.11 Release Notes](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.0.11) for details about the font-size Easter Egg).
- Resolved the issue where Excalidraw SVG exports containing LaTeX were not loading correctly into Inkscape ([#1519](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1519)). Thanks to 🙏@HyunggyuJang for the contribution.

# 2.0.13

## Fixed
- Excalidraw crashes if you paste an image and right-click on canvas immediately after pasting.

# 2.0.12

## Fixed
- Stencil library not working [#1516](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1516), [#1517](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1517)
- The new convert image from URL to Local File feature did not work in two situations:
  - When the embedded image is downloaded from a very slow server (e.g. OpenAIs temp image server)
  - On Android
- The postToOpenAI function did not work in all situations on Android.
- ExcaliAI wireframe to code did not display correctly on Android
- Tooltips kept popping up on Android.

## New
- Added "Save image from URL to local file" to the right-click context menu
- Further ExcaliAI improvements including support for image editing with image mask

# 2.0.11

## Fixed
- Resolved an Obsidian performance issue caused by simultaneous installations of Excalidraw and the Minimal theme. Optimized Excalidraw CSS loading into Obsidian since April 2021, resulting in noticeable performance improvements. ([#1456](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1456))
- Removed default support for the [Sliding Panes Plugin](https://github.com/deathau/sliding-panes-obsidian) due to compatibility issues with Obsidian Workspaces. Obsidian's "Stack Tabs" feature now supersedes Sliding Panes. To re-enable sliding panes support, navigate to Compatibility Features in Plugin Settings.
- Sometimes images referenced with URLs did not show in exported scenes and when embedding Excalidraw into a markdown note. I hope all that is now resolved.
- ExcalidrawAutomate scripts sometimes were not able to save their settings.

## New
- Introduced an "Easter Egg" feature in font-size properties:
  - Hold SHIFT while selecting font size to use scaled sizes (S, M, L, XL) based on the current canvas zoom, ensuring consistent sizes within zoom ranges.
  - Hold ALT/OPT while selecting font size to use values based on the golden mean (s:16, m:26, l:42, xl:68). ALT+SHIFT scales font sizes based on canvas zoom.
  - Scaled sizes are sticky; new text elements adjust font sizes relative to the canvas zoom. Deselect SHIFT to disable this feature.
  - For more on the Golden Scale, watch [The Golden Opportunity](https://youtu.be/2SHn_ruax-s).
- Added two new Command Palette Actions:
  - "Decompress current Excalidraw File" in Markdown View mode helps repair corrupted, compressed Excalidraw files manually.
  - "Save image from URL to local file" saves referenced URL images to your Vault, replacing images in the drawing.
- Updated the ExcaliAI script to generate images using ExcaliAI.

## New in ExcalidrawAutomate
- Added additional documentation about functions to ea.suggester.
- Added ea.help(). You can use this function from Developer Console to print help information about functions. Usage: `ea.help(ea.functionName)` or `ea.help('propertyName')` - notice property name is in quotes"




# 2.0.10

One more minor tweak to support an updated ExcaliAI script - now available in the script store.

# 2.0.9

This release is very minor, and I apologize for the frequent updates in a short span. I chose not to delay this fix for 1-2 weeks, waiting for my larger release. The WireframeToAI feature wasn't working in 2.0.8, but now it does.

# 2.0.8

## New
- Mermaid Class Diagrams [#7381](https://github.com/excalidraw/excalidraw/pull/7381)
- New Scripts:
  - Repeat Texts contributed by @soraliu [#1425](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1425)
  - Relative Font Size Cycle [#1474](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1474)
- New setting to configure the URL used to reach the OpenAI API - for setting an OpenAI API compatible local LLM URL.

## Fixed
- web images with jpeg extension were not displayed.  [#1486](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1486)
- MathJax was causing errors on the file in the active editor when starting Obsidian or starting the Excalidraw Plugin. I reworked the MathJax implementation from the ground up. [#1484](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1484), [#1473](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1473)
- Enhanced performance for resizing sticky notes (resize + ALT) on slower devices when centrally adjusting their size.

## New in ExcalidrawAutomate:
- New ArrowHead types. Currently only available programmatically and when converting Mermaid Class Diagrams into Excalidraw Objects:
```ts
  addArrow(
    points: [x: number, y: number][],
    formatting?: {
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      startObjectId?: string;
      endObjectId?: string;
    },
  ): string;
  
  connectObjects(
    objectA: string,
    connectionA: ConnectionPoint | null,
    objectB: string,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      padding?: number;
    },
  ): string;

  connectObjectWithViewSelectedElement(
    objectA: string,
    connectionA: ConnectionPoint | null,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      padding?: number;
    },
  ): boolean;
```

# 2.0.7

[![Thumbnail - 20231203 Excalidraw 2 0 5 (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/087fcd53-236a-4526-8a81-a290f7717f68)](https://youtu.be/kp1K7GRrE6E)

# Fixed
- Android and iOS crash. I can't apologize enough for releasing a version that I did not properly test on Android and iOS 😰. That ought to teach me something about last-minute changes before hitting release.
- Scaled-resizing a sticky note (SHIFT+resize) caused Excalidraw to choke on slower devices
- Improved plugin performance focusing on minimizing Excalidraw's effect on Obsidian overall
- Images embedded with a URL often did not show up in image exports, hopefully, the issue will less frequently occur in the future.
- Local file URL now follows Obsidian standard - making it easier to navigate in Markdown view mode.

# New
- Bonus feature compared to 2.0.5: Second-order links when clicking embedded images. I use images to connect ideas. Clicking on an image and seeing all the connections immediately is very powerful.
- In plugin settings, under "Startup Script", the button now opens the startup script if it already exists.
- Partial support for animated GIFs (will not show up in image exports, but can be added as interactive embeddables)
- Configurable modifier keys for link click action and drag&drop actions
- Improved support for drag & drop from your local drive and embedding of files external to Excalidraw.

# 2.0.6

ROLLBACK TO 2.0.4

# 2.0.4


[![Thumbnail - 20231126 ExcaliAI (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/52f72b44-3df6-47fa-94a8-538e71805fda)](https://youtu.be/A1vrSGBbWgo)

## New
- ExcaliAI
- You can now add `ex-md-font-hand-drawn` or `ex-md-font-hand-drawn` to the `cssclasses:` frontmatter property in embedded markdown nodes and their font face will match the respective Excalidraw fonts.

## Fixed
- Adding a script for the very first time (when the script folder did not yet exist) did not show up in the tools panel. Required an Obsidian restart. 
- Performance improvements

## New and updated In Excalidraw Automate
- functions to make AI integration easier
```typescript
/**
 * Wrapper for createPNG() that returns a base64 encoded string
*/
async createPNGBase64(
    templatePath?: string,
    scale: number = 1,
    exportSettings?: ExportSettings,
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<string>;

  /**
   * Checks if the folder exists, if not, creates it.
   * @param folderpath
   * @returns 
   */
  public async checkAndCreateFolder(folderpath: string): Promise<TFolder>;

  /**
   * Checks if the filepath already exists, if so, returns a new filepath with a number appended to the filename.
   * @param filename 
   * @param folderpath 
   * @returns 
   */
  public getNewUniqueFilepath(filename: string, folderpath: string): string;
  
    /**
   * Grabs the codeblock contents from the supplied markdown string.
   * @param markdown 
   * @param codeblockType 
   * @returns an array of dictionaries with the codeblock contents and type
   */
  public extractCodeBlocks(markdown: string): { contents: string, type: string }[];
  
   /**
   * converts a string to a DataURL
   * @param htmlString 
   * @returns dataURL
   */
  public async convertStringToDataURL (htmlString:string):Promise<string>;
  
  /**
   * Post's an AI request to the OpenAI API and returns the response.
   * @param request 
   * @returns 
   */
  public async postOpenAI (request: AIRequest): Promise<RequestUrlResponse>;
  
    /**
   * copies elements from view to elementsDict for editing
   * @param elements 
   */
  copyViewElementsToEAforEditing(elements: ExcalidrawElement[], copyImages: boolean = false): void;
```

# 2.0.3

## Fixed
- Mermaid to Excalidraw stopped working after installing the Obsidian 1.5.0 insider build. [#1450](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1450)
- Embed color settings were not honored when the embedded markdown was focused on a section or block.
- CTRL+Click on a Mermaid diagram did not open the Mermaid editor.
- Scrollbars were visible when the embeddable was set to transparent (set background color to match element background, and set element background color to "transparent").



# 2.0.2

[![Thumbnail - 20231119 Embeddable Element Properties (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/96bc96a8-a924-440a-9337-597fa38c8d44)](https://youtu.be/502swdqvZ2A)

## Fixed
- Resolved an issue where the Command Palette's "Toggle between Excalidraw and Markdown mode" failed to uncompress the Excalidraw JSON for editing.

## New
- Scaling feature for embedded objects (markdown documents, pdfs, YouTube, etc.): Hold down the SHIFT key while resizing elements to adjust their size.
- Expanded support for Canvas Candy. Regardless of Canvas Candy, you can apply CSS classes to embedded markdown documents for transparency, shape adjustments, text orientation, and more.
- Added new functionalities to the active embeddable top-left menu:
  - Document Properties (cog icon)
    - File renaming
    - Basic styling options for embedded markdown documents
    - Setting YouTube start time
  - Zoom to full screen for PDFs
- Improved immersive embedding of Excalidraw into Obsidian Canvas.
- Introduced new Command Palette Actions:
  - Embeddable Properties
  - Scaling selected embeddable elements to 100% relative to the current canvas zoom.

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/90ff151d-a7ef-454f-9708-d74c4907f147)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/787193ef-6977-4cd8-9f39-c80c2e6f2c08)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/92e4720b-4304-43c4-9529-c23299667853)



# 2.0.1-beta-2

## New
- You can scale embedded objects such as markdown documents, pdfs, YouTube, etc. by holding down the SHIFT key when resizing elements
- (almost) full canvas candy support. But even if you don't have Canvas Candy, you can apply cssclasses to embedded markdown documents to make them transparent, change their shape and text orientation, etc.
- New functions on the active embeddable top left menu
  - Document Properties (cog icon)
    - rename file
    - set some basic styling of embedded markdown documents
    - Set YouTube start time
  - can zoom to PDF
 - Immersive embedding into Canvas
 - New Command Palette Actions:
    - Embeddable Properties
    - Scale selected embeddable elements to 100% relative to the current canvas zoom

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/90ff151d-a7ef-454f-9708-d74c4907f147)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/787193ef-6977-4cd8-9f39-c80c2e6f2c08)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/92e4720b-4304-43c4-9529-c23299667853)



# 2.0.1-beta-1

## New
- You can scale embedded objects such as markdown documents, pdfs, YouTube, etc. by holding down the SHIFT key when resizing elements
- (almost) full canvas candy support. But even if you don't have Canvas Candy, you can apply cssclasses to embedded markdown documents to make them transparent, change their shape and text orientation, etc.
- New functions on the active embeddable top left menu
  - Document Properties (cog icon)
    - rename file
    - set some basic styling of embedded markdown documents
    - Set YouTube start time
  - can zoom to PDF
 - Immersive embedding into Canvas
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/90ff151d-a7ef-454f-9708-d74c4907f147)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/787193ef-6977-4cd8-9f39-c80c2e6f2c08)
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/92e4720b-4304-43c4-9529-c23299667853)



# 2.0.1

## Fixed
- bug with cssclasses in frontmatter
- styling of help screen keyboard shortcuts [#1437](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1437)

# 2.0.0


[![](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/e2634076-8926-4f8d-a36e-7f1f95122691)](https://youtu.be/JC1E-jeiWhI)


## New
- Added support for applying CSS classes in frontmatter. Now, when embedding Excalidraw drawings into Obsidian Canvas, you can use [Canvas Candy](https://tfthacker.com/canvas-candy) classes. For instance, `cssclasses: cc-border-none` removes the canvas node border around the drawing.
- Introduced new context menu actions:
  - Navigate to link or embedded image.
  - Add any file from the vault to the canvas.
  - Convert the selected text element or sticky note to an embedded markdown file.
  - Add a link from the Vault to the selected element.
- Frames are now rendered in exported images.
- SVG Export includes the `.excalidraw-svg` class, enabling post-processing of SVGs using publish.js when using custom domains with Obsidian Publish. Also, added a command palette action `Obsidian Publish: Find SVG and PNG exports that are out of date`.
- Added a new Command palette action to open the corresponding Excalidraw file based on the embedded SVG or PNG file. `Open Excalidraw Drawing` [Issue #1411](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1411)

## Fixed and Improved
- Resolved issue with the Mermaid Timeline graph displaying all black. [Issue #1424](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1424)
- Enabled toggling pen mode off after activation by a pen touch.
- Now you are able to unlock elements on mobile; previously, locked elements couldn't be selected.
- Fixed the disabled `complete line button` for multipoint lines on mobile.
![Mobile Editing Image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/e7051c75-818f-4800-ba16-ac276e229184)


# 1.9.29

 # This release is available via BRAT for testing

## New
- Supports css classes in frontmatter. You can now apply Canvas Candy classes and the Excalidraw drawings you embed into Obsidian Canvas will apply the classes properly. e.g. `cssclasses: cc-border-none` will result in an Excalidraw drawing on canvas without the canvas node border around it.
- New context menu actions to
  - navigate to link (or image in case of embedded image),
  - add any file from the vault to the canvas
  - to convert the selected text element or sticky note to an embedded markdown file, and 
  - to add a link from the Vault to the selected element
- Frames are rendered in exported images.
- SVG Export now includes the `.excalidraw-svg` class. This can be used to post process svgs using publish.js when using custom domains with Obsidian Publish. There is also a new command palette action to check if SVG exports are out of date (i.e. the drawing or some of the embedded elements in the drawing have changed since the SVG was exported).

## Fixed and improved
- Mermaid Timeline graph has all black [#1424](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1424)
- The complete line button for multipoint lines on mobile was disabled making it impossible to finish editing the line
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/e7051c75-818f-4800-ba16-ac276e229184)


# 1.9.28

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





# 1.9.27

## New
- Restructured plugin settings, added additional comments and relevant videos
- Added setting to change PDF to Image resolution/scale. This has an effect when embedding PDF pages to Excalidraw. A lower value will result in less-sharp pages, but better overall performance. Also, larger pages (higher scale value) were not accepted by Excalidraw.com when copying from Obsidian due to the 2MB image file limit.  Find the "PDF to Image" setting under "Embedding Excalidraw into your Notes and Exporting" setting. [#1393](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1393)

## Fixed
- When multiple Excalidraw Scripts were executed parallel a race condition occurred causing scripts to override each other
- I implemented a partial fix to "text detaching from figures when dragging them" [#1400](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1400)
- Regression: extra thin stroke removed with 1.9.26 [#1399](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1399)


# 1.9.26

## Fixes and improvements from Excalidraw.com
- Freedraw shape selection issue, when fill-pattern is not solid [#7193](https://github.com/excalidraw/excalidraw/pull/7193)
- Actions panel UX improvement [#6850](https://github.com/excalidraw/excalidraw/pull/6850)

## Fixed in plugin
- After inserting PDF pages as image the size of inserted images were incorrectly anchored preventing resizing of pages. The fix does not solve the issue with already imported pages, but pages you import in the future will not be anchored. 
- Mobile toolbar flashes up on tab change on desktop
- Toolbar buttons are active on the first click after opening a drawing. This addresses the "hand" issue raised here: [#1344](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1344)

# 1.9.25

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
```typescript
compressToBase64(str:string):string;
decompressFromBase64(str:string):string;
```


# 1.9.24

## Fixed
- Resolved some hidden Image and Backup Cache initialization errors.

## New Features
- Introducing the `[[cmd://cmd-id]]` link type, along with a new Command Palette Action: `Insert Obsidian Command as a link`. With this update, you can now add any command available on the Obsidian Command palette as a link in Excalidraw. When you click the link, the corresponding command will be executed. This feature opens up exciting possibilities for automating your drawings by creating Excalidraw Scripts and attaching them to elements.

- I am thrilled to announce that you can now embed images directly from your local hard drive in Excalidraw. These files won't be moved into Obsidian. Please note, however, that these images won't be synchronized across your other devices. [#1365](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1365)

![](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/images/excalidraw-modifiers.png)

Stay creative and productive with Excalidraw!

# 1.9.23

## Fixed
- Link navigation error in view mode introduced with 1.9.21 [#7120](https://github.com/excalidraw/excalidraw/pull/7120)

# 1.9.21

## Fixed:
- When moving a group of objects on the grid, each object snapped separately resulting in a jumbled-up image [#7082](https://github.com/excalidraw/excalidraw/issues/7082)

## New from Excalidraw.com:
- Laser Pointer. Press "K" to activate the laser pointer, or find it under more tools. In View-Mode double click/tap the canvas to toggle the laser pointer

![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/d3fc079d-9428-4a93-9a9b-1947ce9b6b57)


# 1.9.20

[![Thumbnail - 20230930 1 9 20 (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/620c6169-51a7-4334-9c5c-ec3b2ab66cdf)](https://youtu.be/QB2rKRxxYlg)

## New
- Now you can insert [Mermaid](https://mermaid.live/) diagrams as Excalidraw elements into your drawings (currently only the [Flowchart](https://mermaid.js.org/syntax/flowchart.html) type is supported, [other diagram types](https://mermaid.js.org/intro/#diagram-types) are inserted as Mermaid native images. 
  - ⚠️**This feature requires Obsidian API v1.4.14 (the latest desktop version). On Obsidian mobile API v1.4.14 is only available to Obsidian insiders currently**
  - If you want to contribute to the project please head over to [mermaid-to-excalidraw](https://github.com/excalidraw/mermaid-to-excalidraw) and help create the converters for the other diagram types as well.
- The Fourth Font now also supports the OTF format
- Disable snap-to-grid in grid mode by holding down the CTRL/CMD while drawing or moving an element [#6983](https://github.com/excalidraw/excalidraw/pull/6983)
- I updated the Excalidraw logo in Obsidian. This affects the logo on the tab and the ribbon.

## New from excalidraw.com
- Elements alignment snapping. Hold down the CTRL/CMD button while moving an element to snap it to other objects. [#6256](https://github.com/excalidraw/excalidraw/pull/6256)

## New in the script library
- Shape [Boolean Operations](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Boolean%20Operations.md) script in script library 🙏@GColoy

## Fixed
- Fourth Font displays correctly in SVG embeds mode
- The re-colorMap map (see [1.9.19](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.9.19) for more info) did not work when either of the fill or stroke color properties of the image was missing.
- Excalidraw Pasting with middle mouse button on Linux [#1338](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/1338) 🙏@Aeases 

## Fixed from excalidraw.com
- Excalidraw's native eyedropper fixes [#7019](https://github.com/excalidraw/excalidraw/pull/7019)

## New in Excalidraw Automate
- `getPolyBool()` returns a [PolyBool](https://github.com/velipso/polybooljs) object
- sample mermaid code:
```js
ea = ExcalidrawAutomate();
ea.setView();
await ea.addMermaid(
  `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`
);
ea.addElementsToView();
```

# 1.9.19.2

This version is available via BRAT
------
## New
- [Mermaid](https://mermaid.live/) support, including ExcalidrawAutomate support for Mermaid.
- Fourth Font now also supports fonts in OTF format
- Elements alignment snapping. Hold down control while moving the element to snap to other objects. [#6256](https://github.com/excalidraw/excalidraw/pull/6256)
- Holding down CTRL/CMD while drawing or moving a shape with Grid turned on will disable snap to grid [#6983](https://github.com/excalidraw/excalidraw/pull/6983)
- Shape [Boolean Operations](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Boolean%20Operations.md) script in script library 🙏@GColoy
- Updated ribbon button logo to new Excalidraw logo

## Fixed
- Fourth Font displays correctly in SVGNative mode
- re-colorMap map (see [1.9.19](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.9.19) for more info) did not work when either of the fill or stroke color properties of the image was missing.
- Excalidraw's native eyedropper fixes [#7019](https://github.com/excalidraw/excalidraw/pull/7019)

## New in Excalidraw Automate
- `getPolyBool()` returns a [PolyBool](https://github.com/velipso/polybooljs) object
- sample mermaid code:
```js
ea = ExcalidrawAutomate();
ea.setView();
await ea.addMermaid(
  `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`
);
ea.addElementsToView();
```



# 1.9.19-mermaid

This is a beta release. You may install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat)

# New
- Fourth Font now also supports fonts in OTF format
- Mermaid support, including ExcalidrawAutomate support for mermaid.

sample EA code:
```js
ea = ExcalidrawAutomate();
ea.setView();
await ea.addMermaid(
  `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`
);
ea.addElementsToView();
```

# Fixed
-  re-colorMap map (see [1.9.19](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.9.19) for more info) did not work when either of the fill or stroke color properties of the image was missing.


# 1.9.19

## New
- I added new features to the [Deconstruct Selected Elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Deconstruct%20selected%20elements%20into%20new%20drawing.md) script
- I added a new script: [Text Aura](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Text%20Aura.md)
- I updated the [Set Grid](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Grid.md) script. You can now set the Major/Minor tick frequency. [#1305](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1305)
- The re-colorMap is now case-insensitive. The color map is a hidden feature. In Markdown View mode you can add a JSON map after the embedded SVG or Excalidraw image filename with a mapping of current colors to new colors.
![image](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/1d985a59-a2d2-48a2-9cef-686bfbe9ef02)

## New in ExcalidrawAutomate
- I added the `silent` switch. If this is true, the created file will not be opened.
```typescript
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
    plaintext?: string; //text to insert above the `# Text Elements` section
  }): Promise<string>
```

# 1.9.18

## New
- Excalidraw now syncs with Obsidian's language settings, provided translations are available. [#1297](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1297)

## Fixed
- [#1285](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1285): Solved Obsidian crashes caused by copying images from Excalidraw into markdown notes. Going forward:
  - Copying an image will paste its embed link,
  - Copying a text element will paste the text,
  - For all other elements with links, the link will be pasted.
  - In all other cases nothing will be pasted.
  
- Resolved grid instability ([#1298](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1298)).
- Fixed missing `[[square brackets]]` in PDF section references, making the links functional.
- Corrected the behavior of "Open current link in browser" for embedded YouTube and Vimeo frames. Clicking the globe button will now correctly open the links.


# 1.9.17

## New 
- Significant performance improvements from Excalidraw.com
- When selecting a highlight in the Obsidian PDF editor and selecting "Copy as Quote" in the context menu, then paste this to Excalidraw, the text will arrive as a text element wrapped in a transparent sticky note with the link to the original highlight attached to the sticky note. You can override this behavior by SHIFT+CTRL/CMD pasting

## Fixed
- BUG: Image caching issue. Changes to the drawing do not reflect immediately in the note when re-opening the drawing [#1297](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1279)
- Removed underline from links in NativeSVG embed.

# 1.9.16

I apologize for this extra release. I accidentally built 1.9.15 with an older excalidraw.com package version. Fixes and new features (like the improved grid) are now available again. Otherwise, this is the same as 1.9.15.

# 1.9.15

## New
- There is now a search box in the Excliadraw Script Store. I categorized the scripts and added keywords to help easier navigation.

## Fixed
- The theme of the embedded Markdown document did not always honor plugin settings. With some themes, it worked, with others (including the default Obsidian theme, it didn't). 

# 1.9.14

## Fixed
- **Dynamic Styling**: Excalidraw `Plugin Settings/Display/Dynamic Styling` did not handle theme changes correctly.
- **Section References**: Section Headings that contained a dot (e.g. [#2022](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2022).01.01) (or other special characters) did not work when focusing markdown embeds to a section. [#1262](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1262)
- **PNG Export**: When using images from the web (i.e. based on URL and not a file from your Vault), embedding the Excalidraw file into a markdown document as PNG, or exporting as PNG failed. This is because due to browser cross-origin restrictions, Excalidraw is unable to access the image. In such cases, a placeholder will be included in the export, but the export will not fail, as until now.

# New in ExcalidrawAutomate
- `getActiveEmbeddableViewOrEditor` will return the active editor and file in case of a markdown document or the active leaf.view for other files (e.g. PDF, MP4 player, Kanban, Canvas, etc) of the currently active embedded object. This function can be used by plugins to check if an editor is available and obtain the view or editor to perform their actions. Example: [package.json](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/package.json#L23), [Checking for EA](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/src/excalibrain-main.ts#L114-L127), and [Running the function](https://github.com/zsviczian/excalibrain/blob/2056a021af7c3a53ed08203a77f6eae304ca6e39/src/excalibrain-main.ts#L362-L399)
```typescript
public getActiveEmbeddableViewOrEditor (view?:ExcalidrawView): {view:any}|{file:TFile, editor:Editor}|null;
```

# 1.9.13

[![Thumbnail - 20230805 Excalidraw 1 9 13 (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/4cad7be5-b6a3-4f3c-9b41-4339011dba86)](https://youtu.be/opLd1SqaH_I)

# New
- **Templater support**: You can now execute Templater scripts on an embedded Markdown document when the document is active for editing
- **Interactive image-embeds**: I added a new image embed option "SVG Native". In "SVG Native" mode embedded items such as videos, webpages, and links (including links within the Vault) work.
- **Anchored image resizing**: When you embed an Excalidraw drawing using the Anchor to 100% option, resizing the image will be disabled.

# Fixed
- when opening a new document in the Excalidraw view while a markdown document was open for editing in an embeddable, Excalidraw terminated with errors
 
# New in ExcalidrawAutomate
- added openState to the `openFileInNewOrAdjacentLeaf. For details see: [OpenViewState](https://github.com/obsidianmd/obsidian-api/blob/f86f95386d439c19d9a77831d5cac5748d80e7ec/obsidian.d.ts#L2686-L2695)
```typescript
openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf
```



# 1.9.12

## New
- If you create a Text Element that includes only a transclusion e.g.: `![[My Image.png]]` excalidraw will automatically replace the transclusion with the embedded image. [#1243](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1243)
- New Excalidraw splash screen icon contributed by Felix Häberle. 😍

<img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-sword-mini.png'/>

## Fixed
- Popout windows behaved inconsistently losing focus at the time when a markdown file was embedded. Hopefully, this is now working as intended.
- A number of small fixes that will also improve the ExcaliBrain experience

# 1.9.11

## New
- I added 2 new command palette actions: 1) to toggle frame clipping and 2) to toggle frame rendering.

# Updated
- I released a minor update to the slideshow script. Frame sequence (Frame 1, 2, 3, ...) will now be displayed in proper order. Frames will be hidden during the presentation (this was there before, but there was a change to excalidraw.com that broke this feature of the slideshow script).

# Fixed: 
- Excalidraw Automate error introduced with 1.9.10 - when elements are repositioned to cursor and no ExcalidrawView is active

# 1.9.10

## New
- @mazurov added a new script: [Ellipse Selected Elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Ellipse%20Selected%20Elements.md)

## Fixed
- **Image Saving Error**: Previously, inserting an image from Firebase Storage or other URLs could result in an error that prevented the entire drawing from being saved. I have now improved the error handling and image fetching from the web, ensuring smooth image insertion and saving.  
- **Text Search Bug**: There was an issue where text search failed when frames had default names like "Frame 1," "Frame 2," etc. This has been resolved, and now the text search works correctly in such cases. ([#1239](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1239))   
- **Image Positioning Fix**: An annoying bug caused the image to jump after inserting it using the "Insert Image" command palette action. I've fixed this issue, and now the image behaves as expected when positioning it for the first time.

# 1.9.9

⚠️⚠️ BREAKING CHANGE ⚠️⚠️ 
I migrated the element type "iframe" to "embeddable". This is because iframe support on excalidraw.com will use the "embeddable" type. Migration is necessary for continued compatibility. You need to update Excalidraw to the latest version on all your devices otherwise if you open an already converted file with an older version, the embedded elements will be deleted from your drawing.

## Fixed:
- PNG image caching resulting in broken images after Obsidian restarts
- SVG export now displays embedded iframes with the correct embed link (note this feature only works when you open the SVGs in a browser outside Obsidian).

## Updated / fixed in Excalidraw Automate
- I updated `lib/ExcalidrawAutomate.d.ts` and published a new version of obsidian-excalidraw-plugin type library to npmjs.
- Added new ExcalidrawAutomate functions: ` addEmbeddable()`, `DEVICE`, `newFilePrompt()`, and `getLeaf()`
- `addImage` and `addElementsToView` were extended with 1-1 additional optional parameter. As a result of `shouldRestoreElements` defaulting to false, all elements in the scene will no longer be updated (iframes will not blink) when you add elements via script.
- There is a new event hook: `onPasteHook`. This will be called whenever the user pastes something to the canvas. You can use this callback if you want to do something additional during the onPaste event. In case you want to prevent the Excalidraw default onPaste action you must return false

```typescript
async addImage(
  topX: number,
  topY: number,
  imageFile: TFile | string,
  scale: boolean = true, //default is true which will scale the image to MAX_IMAGE_SIZE, false will insert image at 100% of its size
  anchor: boolean = true, //only has an effect if "scale" is false. If "anchor" is true the image path will include |100%, if false the image will be inserted at 100%, but if resized by the user it won't pop back to 100% the next time Excalidraw is opened.
): Promise<string>;

async addElementsToView(
  repositionToCursor: boolean = false,
  save: boolean = true,
  newElementsOnTop: boolean = false,
  shouldRestoreElements: boolean = false, //restore elements - auto-corrects broken, incomplete or old elements included in the update
): Promise<boolean>;

 onPasteHook: (data: {
  ea: ExcalidrawAutomate;
  payload: ClipboardData;
  event: ClipboardEvent;
  excalidrawFile: TFile; //the file receiving the paste event
  view: ExcalidrawView; //the excalidraw view receiving the paste
  pointerPosition: { x: number; y: number }; //the pointer position on canvas
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

/**
 * Prompts the user with a dialog to select new file action.
 * - create markdown file
 * - create excalidraw file
 * - cancel action
 * The new file will be relative to this.targetView.file.path, unless the parent file is provided.
 * If shouldOpenNewFile is true, the new file will be opened in a workspace leaf.
 * targetPane control which leaf will be used for the new file.
 * Returns the TFile for the new file or null if the user cancels the action.
 * @param newFileNameOrPath
 * @param shouldOpenNewFile
 * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
 * @param parentFile
 * @returns
 */
newFilePrompt(
  newFileNameOrPath: string,
  shouldOpenNewFile: boolean,
  targetPane?: PaneTarget,
  parentFile?: TFile
): Promise<TFile | null>;

/**
 * Generates a new Obsidian Leaf following Excalidraw plugin settings such as open in Main Workspace or not, open in adjacent pane if available, etc.
 * @param origo // the currently active leaf, the origin of the new leaf
 * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
 * @returns
 */
getLeaf(
  origo: WorkspaceLeaf,
  targetPane?: PaneTarget
): WorkspaceLeaf;
```

# 1.9.8

## New Features
- Zoom to heading and block in markdown frames.
- Added an iframe menu that allows users to change heading/block zoom, center the element, and open it in the browser.
- Replaced twitframe with platform.twitter for tweets. The "Read more" and "Reply" buttons now work.

## Bug Fixes
- Fixed an issue where embedded markdown frames disappeared in fullscreen mode. [#1197](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1197)
- Resolved a problem with the "Embed Markdown as Image" feature where changes to embed properties were not always honored. [#1201](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1201)
- When inserting any file from the Vault and embedding a Markdown document as an image, the embed now correctly honors the section heading if specified. [#1200](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1200)
- SVG and PNG autoexport now function properly when closing a popout window. [#1209](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1209)
- Many other minor fixes

# 1.9.7

## Fixed:

- Fixed an issue where using the color picker shortcut would cause the UI to disappear in mobile view mode.
- You can now add YouTube playlists to iframes.
- Fixed a bug where the "Add any file" dropdown suggester opened in the main Obsidian workspace instead of the popout window when Excalidraw was running. ([#1179](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1191))
- Made some improvements to the logic of opening in the adjacent pane, although it is still not perfect.
- Fixed an issue where Obsidian sync would result in the loss of the last approximately 20 seconds of work. Excalidraw's handling of sync is now fixed. ([#1189](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1189))

## New:

- Introducing Image Cache: Excalidraw will now cache rendered images embedded in Markdown documents, which will enhance the markdown rendering experience.
- Backup Cache: Excalidraw now stores a backup on your device when saving, in case the application is terminated during a save operation. If you are using sync, you can find the latest backup on the device you last used to edit your drawing.
- Added `frame=` parameter to image references. ([#1194](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1194)) For more details about this feature, check out this [YouTube video](https://youtu.be/yZQoJg2RCKI).
- When an SVG image from Draw.io is embedded in Excalidraw, clicking the image will open the file in the [Diagram plugin](https://github.com/zapthedingbat/drawio-obsidian) (if available).
- Added the [Create DrawIO file](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Create%20DrawIO%20file.md) Excalidraw Automate Script to the library, which allows you to create a new draw.io drawing and add it to the current Excalidraw canvas.

## New in ExcalidrawAutomate

```typescript
async getAttachmentFilepath(filename: string): Promise<string>
```

This asynchronous function retrieves the filepath to a new file, taking into account the attachments preference settings in Obsidian. It creates the attachment folder if it doesn't already exist. The function returns the complete path to the file. If the provided filename already exists, the function will append '_[number]' before the extension to generate a unique filename.

```typescript
getElementsInFrame(frameElement: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[];
```

This function returns the elements contained within a frame.

[![Thumbnail - 20230702 Draw io support (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/05c2b512-1f6e-46bd-ac17-c9e1e00d9f69)](https://youtu.be/DJcosmN-q2s)



# 1.9.6.1-beta

New:
- Markdown embed image cache. Excalidraw will cache rendered images embedded in Markdown documents. This will speed up the markdown rendering experience.

Fixed:
- color picker shortcut results in the UI disappearing when in mobile view mode
- you can now add youtube playlists

# 1.9.6

## Fixed
- help shortcuts are really hard to see [#1176](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1179)
- link icons not visible on elements after 1.9.5 release (reported on Discord)
- PDFs in iFrames will now respect `[[document.pdf#page=155]]` format
- Keyboard shortcuts were not working properly on external drop. Check [updated keyboard map](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/excalidraw-modifiers.png)

# 1.9.5


[![board screenshot (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/2d4a8166-7c4e-4f39-bc1a-7ec11f91654c)](https://youtu.be/ICpoyMv6KSs)


## New
- IFrame support: insert documents from your Obsidian Vault and insert youtube, Vimeo, and generally any website from the internet
- Frame support: use frames to group items on your board

## New in ExcalidrawAutomate
- selectElementsInView now also accepts a list of element IDs
- new addIFrame function that accepts an Obsidian file or a URL string
```typescript
selectElementsInView(elements: ExcalidrawElement[] | string[]): void;
addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string;
```

# 1.9.4-beta

For those who want to play with the half-baked solution, this release features embedding of youtube, vimeo, twitter, webpages, markdown documents, kanban boards, excalidraw.com boards including collaboration sessions, and more. There are still many rough edges. 

For now, you can add a frame by creating a rectangle, adding a link and clicking the <> button.



# 1.9.3

## New from Excalidraw.com
- Eyedropper tool. The eyedropper is triggered with "i". If you hold down the ALT while clicking the color it will set the stroke color of the selected element, else the background color.
- Flipping multiple elements
- Improved stencil library rendering performance + the stencil library will remember the scroll position from the previous time it was open

# Fixed
- Replaced command palette and tab export SVG/PNG/Excalidraw actions with "export image" which will take the user to the export image dialog.



# 1.9.2

[![Thumbnail - 20230520 Excalidraw 1 9 2 ColorPicker (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/b4356329-78ae-48c2-8fb2-eeedf9418643)](https://youtu.be/diBT5iaoAYo)

## New
- Excalidraw.com Color Picker redesign [#6216](https://github.com/excalidraw/excalidraw/pull/6216)
- Updated palette loader script in the script library
- New ExcalidrawAutomate API to load Elements and AppState from another Excalidraw file.
```typescript
async getSceneFromFile(file: TFile): Promise<{elements: ExcalidrawElement[]; appState: AppState;}>
```

# 1.9.1

## Updates from Excalidraw.com
- "Unlock all elements" - new action available via the context menu [#5894](https://github.com/excalidraw/excalidraw/pull/5894)
- Minor improvements to improve the speed [#6560](https://github.com/excalidraw/excalidraw/pull/6560)
- Retain Seed on Shift Paste [#6509](https://github.com/excalidraw/excalidraw/pull/6509)

## New/Fixed
- Clicking on the link handle (top right corner) will open the link in the same window
- CTRL/CMD click on a link will open the link in a new tab and will focus on the new tab
- Linking to parts of images. In some cases clicking search results, links, or backlinks did not focus on the right element according to the link.  Fixed.

# 1.9.0

[![Thumbnail - 1 9 0 (Custom)](https://github.com/zsviczian/obsidian-excalidraw-plugin/assets/14358394/ae631dfe-33fd-4789-9d53-4d9e74c02d39)](https://youtu.be/nB4cOfn0xAs)

## New
- embed PDF

## New in ExcalidrawAutomate
- onFileCreateHook: if set this hook is called whenever a new drawing is created using Excalidraw command palette menu actions. If the excalidraw file is created using Templater or other means, the trigger will not fire. [#1124](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124)
```typescript
  onFileCreateHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being created
    view: ExcalidrawView;
  }) => Promise<void>;
```

## Fixed
- Embedded images, markdowns, PDFs will load one by one, not in one go after a long wait
- minor styling improvement to dynamic styling

# 1.8.26

## Fixed
- Dynamic styling did not pick up correctly
  - the accent color with the default Obsidian theme
  - the drawing theme color with the out-of-the-box, default new drawing (not using a template)
- The Obsidian tools panel did not pick up user scripts when installing your very first script. A reload of Obsidian was required.

# 1.8.25

[![Thumbnail - Scribble Helper (Custom)](https://user-images.githubusercontent.com/14358394/233802797-000a7034-b660-4e43-bea8-120b68b70bc5.png)](https://youtu.be/BvYkOaly-QM)

## New & improved
- Multi-link support
- Updated [Scribble Helper](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Scribble%20Helper.md) script for better handwritten text support. 
  - Add links to text elements
  - Creating wrapped text in transparent sticky notes
  - Add text to arrows and lines
  - Handwriting support on iOS via Scribble

## Fixed
  - The long-standing issue of jumping text

# 1.8.24

## Updates from Excalidraw.com
- fix: color picker keyboard handling not working
- fix: center align text when bind to the container via context menu
- fix: split "Edit selected shape" shortcut

## New
- Updated the Scribble Helper script with lots of new features. I will release a demo video in the next few days.

## Fixed
- BUG: Area embed link of svg inside excalidraw embed entire svg instead of area [#1098](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1098)

## New in Excalidraw Automate
Lot more configuration options for script utils.inputPrompt
```typescript
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
```

# 1.8.23

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
[![zsviczian_a_magic_paintbrush_changing_the_color_of_an_SVG_icon__4ce72806-3c28-4ab5-b93f-d211a82e2c40 (Custom)](https://user-images.githubusercontent.com/14358394/232213307-37a7fc74-694d-40bf-a395-4456fcd8d923.png)](https://youtu.be/MIZ5hv-pSSs)

# 1.8.22

## Fixed
- Styling of custom pens and script buttons was inverted compared to default Obsidian buttons. Now it looks more consistent.
- Minor tweaks to dynamic styling. [see this video to understand dynamic styling](https://youtu.be/fypDth_-8q0)

## New
- Scripts by @threethan:
  - [Auto Draw for Pen](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Auto%20Draw%20for%20Pen.md): Automatically switches between the select and draw tools, based on whether a pen is being used.
  - [Hardware Eraser Support](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Hardware%20Eraser%20Support.md): Adds support for pen inversion, a.k.a. the hardware eraser on the back of your pen.
- Added separate buttons to support copying link, area or group references to objects on the drawing. [#1063](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1063). See [this video](https://youtu.be/yZQoJg2RCKI) for more details on how this works.
- Hover preview will not trigger for image files (.png, .svg, .jpg, .gif, .webp, .bmp, .ico, .excalidraw)
- Minor updates to the [Slideshow](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Slideshow.md) script. You can download the updated script from the Excalidraw script library.  The slideshow will now correctly run in a popout window. When the drawing is in a popout window, the slideshow will not be full screen, but will only occupy the popout window. If you run the slideshow from the main Obsidian workspace, it will be displayed in full-screen mode.
- Updated the Icon Library script to now include image keywords. I've uploaded the new script here: https://gist.github.com/zsviczian/33ff695d5b990de1ebe8b82e541c26ad If you need further information watch this [video](https://youtu.be/_OEljzZ33H8)

## New in ExcalidrawAutomate
- `addText` `formatting` parameter now accepts `boxStrokeColor` and `textVerticalAlign` values.
```typescript
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
```
- new `onFileOpenHook`. If set, this callback is triggered, when an Excalidraw file is opened. You can use this callback in case you want to do something additional when the file is opened. This will run before the file level script defined in the `excalidraw-onload-script` frontmatter is executed. Excalidraw will await the result of operations here.  Handle with care. If you change data such as the frontmatter of the underlying file, I haven't tested how it will behave.
```typescript
onFileOpenHook: (data: {
  ea: ExcalidrawAutomate;
  excalidrawFile: TFile; //the file being loaded
  view: ExcalidrawView;
}) => Promise<void>;
```

# 1.8.21

## Quality of Life improvements
- Dynamic Styling (see plugin settings / Display). When Dynamic Styling is enabled it fixes Excalidraw issues with the Minimal Theme
- New "Invert Colors" script

[![1-8-21 (Custom)](https://user-images.githubusercontent.com/14358394/227802074-54debc7e-3a82-475e-9c74-ca8ab5427529.png)](https://youtu.be/fypDth_-8q0)

## Note
The few of you, that are using the Dynamic Styling Templater script, please remove it and restart Obsidian.

# 1.8.20

## Fixed
- Excalidraw froze Obsidian in certain rare situations [#1054](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1054)
- File loading error [#1062](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1062)
- Embedded images in markdown documents no longer have the line on the side. Image sizing works better. [#1059](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1059)
- Locked elements will not show a hover preview [#1060](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1060)
- CTRL/CMD + K correctly triggers add link [#1056](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1056)

## New
- Grid color adjusts to the view background color

I'm sorry, but the sticky note editing issue on Android with the on-screen keyboard has still not been resolved. If you also experience this error, please help raise the priority with the core Excalidraw team by commenting on this issue: [#6330](https://github.com/excalidraw/excalidraw/issues/6330)

# 1.8.19

## Fixed: Text wrapping issue in sticky notes. Text wraps differently and words disappear during text editing. (#6318)

There are 3 additional issues with container text editing open. I hope they will be addressed soon. Excalidraw.com recently changed how text size is calculated, and unfortunately, this has a knock-on effect on Obsidian (as this time I was too quick to follow excalidraw.com developments - sorry). The related issues still open are:
- Pinch zooming while editing text in a text container [#6331](https://github.com/excalidraw/excalidraw/issues/6331)
- Container text jumps on edit on Android with on-screen keyboard [#6330](https://github.com/excalidraw/excalidraw/issues/6330)
- Shadow text when editing text containers without a keyboard on iOS [#6329](https://github.com/excalidraw/excalidraw/issues/6329)

# 1.8.18

## Fixed
- Text scaling issue introduced in 1.8.17
- [#1043](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1043):  Error handling when `onCanvasColorChangeHook` is executed. This is used in the [Dynamic Styling Script](https://youtu.be/LtR04fNTKTM). 

# 1.8.17

## New from Excalidraw.com
- Improved text wrapping in the ellipse and diamond shapes [6172](https://github.com/excalidraw/excalidraw/pull/6172)

## New
- Updated slideshow script
[![Thumbnail - Slideshow 2 0 (Custom)](https://user-images.githubusercontent.com/14358394/221422712-0fbeea13-7a90-4a1d-98a6-481cc44fbef5.jpg)](https://youtu.be/mQ2eLk_0TV4)

## Fixed: 
- "Save to..." in the Stencil Library menu now works as expected [#1032](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1032)

# 1.8.16

**!!! Modifier keys have changed, please review the table below !!!**

[![Thumbnail - 1 8 16 (Custom)](https://user-images.githubusercontent.com/14358394/220446582-e894fd27-d77d-44a7-9cfe-f780f13156af.jpg)]([https://youtu.be/9HlipSIzRhc)


## Fixed 

- This version was extensively tested and developed on MacOS to remove usability issues.
- New command palette action to create a new drawing in a new tab
- Modifier keys to open links in the active window, splitting the current view to the right, in a new tab, or in a popout window now behave consistently both in Excalidraw and when clicking a drawing that is embedded in a markdown note.
- Drag & Drop properly works from within Obsidian, from a web browser, and from the OS file explorer

![](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/images/excalidraw-modifiers.png)


# 1.8.15-beta

!!! Modifier keys have changed, please review the table below!

## Fixed 
- This version was extensively tested and developed on MacOS to remove usability issues.
- New command palette action to create a new drawing in a new tab
- Modifier keys to open links in the active window, splitting the current view to the right, in a new tab, or in a popout window now behave consistently both in Excalidraw and when clicking a drawing that is embedded in a markdown note.
- Drag & Drop properly works from within Obsidian, from a web browser, and from the OS file explorer

![](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/images/excalidraw-modifiers.png)


# 1.8.14

## Fixed
- text element link gets deleted when the drawing is reloaded

# 1.8.13

## Fixed
- When changing a text element in markdown mode, the change seem to have showed up when switching back to Excalidraw  mode, but then lost these changes when loading the file the next time.
- Scrolling through a page that has embedded drawings on Obsidian Mobile accidently opens the drawing in Excalidraw when touching the image. Now you need to press and hold to open the image in Excalidraw. [#1003](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1003)
- The scrollbar is no longer visible when presenting using the SlideShow script
- Stroke properties could not be changed when custom pen settings had "Stroke & fill applies to: All shapes". It works now.

## QoL
- Custom pens will remember the stroke changes until you press the pen preset button again.
  - This is a bit hard to explain, let me try... Essentially, when you use a custom pen, it will keep the changes you made to the pen (like changing the stroke width) until you press the pen-prereset button again. So, for example, if you're using a mind mapping custom pen and change its color, and then switch to a different tool like text, when you switch back to the freedraw tool using the Excalidraw tools panel, the pen will still have the same color you set earlier, but if you press the mind mapping pen-preset button, it will default back to your custom pen settings including your preset color.
- Added new buttons to load current stroke color and background color in the pen settings dialog. Also added an edit box so you can configure any valid color string (including with transparency) for pen stroke and background colors. [#991](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/991)

# 1.8.12

[![Thumbnail - 1 8 12 (Custom)](https://user-images.githubusercontent.com/14358394/215325965-3f810e9a-569b-4ac5-a24a-71b4abebffa0.png)](https://youtu.be/OjNhjaH2KjI)

# New
- Hand/Panning Tool, added by the Excalidraw.com team [#6141](https://github.com/excalidraw/excalidraw/pull/6141)
- Configure custom pens, and pin to the sidebar for easy access [#986](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/986)
- Added color picker. This allows you to pick colors not included in the palette, and to pick colors from any object displayed on the screen.
- Option to pin favorite scripts (downloaded and user scripts) to the sidebar
- New Script in Script Library: [Mindmap format](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20format.md) by [pandoralink](https://github.com/zsviczian/obsidian-excalidraw-plugin/commits/master/ea-scripts/Mindmap%20format.md?author=pandoralink) 🙏🎉

# 1.8.11


[![Thumbnail - 1 8 11 (Custom)](https://user-images.githubusercontent.com/14358394/213917800-34591334-ff5d-47aa-a354-4bfd1420e360.png)](https://youtu.be/rBarRfcSxNo)

# New
- Support for referencing images from the internet in Excalidraw drawings, including YouTube thumbnail support. [#913](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/913)
  - Link to images on the internet without creating a copy in the Obsidian Vault by holding down the CTRL button while dropping the link or image.
  - Automatic conversion of image URLs and YouTube links into image elements with original links added as a link on the element when pasting. Note, that if you only want to paste the link, first double-click the canvas to start a new text element, then paste the link.
- Two new options added to plugin settings:
  - Make mouse wheel zoom by default [#474](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/474)
  - Allow pinch zoom in pen mode [#828](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/828)
- Update to the [Set Grid](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Grid.svg) script now saves the grid setting for the current file.

# 1.8.10


[![Thumbnail - 1 8 10 (Custom)](https://user-images.githubusercontent.com/14358394/212551154-5319960b-d7a7-466a-9184-05b755ec1331.png)](https://youtu.be/wTtaXmRJ7wg)

# QoL improvements
- You can structure icons in the Obsidian tools panel by moving scripts to folders
![image](https://user-images.githubusercontent.com/14358394/212389592-306130d0-209a-49df-99bb-c538f2155b23.png)
- I added useful actions to the hamburger menu in both tray-mode and normal-mode. 
![image](https://user-images.githubusercontent.com/14358394/212534508-9107fd19-27ab-4415-8abc-bc97c73afc0b.png)
- I added a new Export Image dialog. You can access the new export screen from the hamburger-menu
![image](https://user-images.githubusercontent.com/14358394/212534654-7a479e23-8d5d-452e-9a18-a9896278aa27.png)
- Links in help now point to Obsidian-Excalidraw relevant content.
- Added a welcome screen
![image](https://user-images.githubusercontent.com/14358394/212534568-3cd1e8a1-5b20-4a30-96e4-40d7dac57e33.png)
- I updated the alternative dark mode / dynamic styling [script](https://gist.github.com/zsviczian/c7223c5b4af30d5c88a0cae05300305c)


# 1.8.9

## Minor QoL improvements
- When you open a second drawing in the same Excalidraw view (i.e. by navigating a link) and make a change to this drawing, and then press UNDO, the entire drawing disappeared. Redo brought the image back, however, this behavior was frustrating. Not anymore...
- On iPad
  - when you open the command palette, autozoom resized the drawing. If the Obsidian command palette or some other modal window is shown Excalidraw will not resize the view.
  - when you add a link to the drawing using the Command Palette, sometimes the link was added in a far corner of the drawing outside the current view area. This should be fixed now.

# Excalidraw Automate
I added the following function to Excalidraw Automate. This allows you to position new items based on the last known pointer position on the canvas.
```typescript
public getViewLastPointerPosition(): {x:number, y:number};
```

# 1.8.8

## New
- Embed scene in exported PNG and SVG images [#860](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/860).  This means that the export will be a normal PNG or SVG image with the added functionality that if someone loads the image into excalidraw.com it will open as a normal excalidraw file.
  - I've added 2 new Command Palette actions (export PNG, export SVG with embedded scene).
  - If you SHIFT click `Save as PNG (or SVG)` in the workspace-tab menu, Excalidraw will embed the scene in the export.
- I updated the [Organic Line](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Organic%20Line.md)  script. It has an improved thick-to-thin look and a new thin-to-thick-to-thin line type.
- The plugin now includes support for [Perfect Freehand](https://perfect-freehand-example.vercel.app/) pen-options. I've also added a new [Alternative Pens](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Alternative%20Pens.md) script.
[![Thumbnail - custom pen (Custom)](https://user-images.githubusercontent.com/14358394/211054371-8872e01a-77d6-4afc-a0c2-86a55410a8d3.png)](https://youtu.be/uZz5MgzWXiM)


# Fixed
- Intelligent image width setting [#955](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/955). Before this change, when the embedded image was small, the image would be extended to meet the image width setting in plugin settings. From now on, if the image is smaller than max-width, it will only extend to max-width. You can still set 100% width using custom CSS. See more on that [here](https://github.com/zsviczian/obsidian-excalidraw-plugin#embedded-images).

# New in ExcalidrawAutomate
- I added the `plaintext` parameter to `ExcalidrawAutomate.create`. Using this, you can add some text below the frontmatter but above the `# Text Elements` section. Use this for example to add metadata to your file. (e.g. I use this in my Daily Quote template to add a Dataview field for the `Author::` and add the quote with a standard block reference, so I can easily reference it in other files. I also add the `#quote` tag to the file using this.)
- The script running in the ScriptEngine now also receives the `TFile` object for the script itself. You can access this object during execution via the `utils.scriptFile` variable. 

# 1.8.7

## New from Excalidraw.com
- Support shrinking text containers to their original height when text is removed [#6025](https://github.com/excalidraw/excalidraw/pull/6025)

https://user-images.githubusercontent.com/14358394/209404092-579d54e9-7003-48ef-8b82-84be08ba6246.mp4

## Fixes
- removed the white background when editing arrow-label [#6033](https://github.com/excalidraw/excalidraw/pull/6033)
- Minor style tweaks
  - for embedding Excalidraw into Obsidian Canvas. e.g. dragging no longer accidentally creates an image copy of the drawing, and
  - style tweaks on the Excalidraw canvas

## New
- If you set a different text color and sticky note stroke color, now if you change the sticky note border color, the text color will not be changed.

# 1.8.6

Same as 1.8.5, but compatibility issues with Obsidian 1.0.0 are resolved. Some of the features in 1.8.6 only work with Obsidian 1.1.6 and above.

# 1.8.5

## New from Excalidraw.com:
- Better default radius for rectangles [#5553](https://github.com/excalidraw/excalidraw/pull/5553)
  - old drawings will look unchanged, this applies only to new rectangles
> [!Note]- ExcalidrawAutomate technical details
> - `strokeSharpness` is now deprecated
> - use roundness instead
>    - `roundness === null` is legacy `strokeSharpness = "sharp"`
>    - `roundness = { type: RoundnessType; value?: number }
>      - type: 1, LEGACY, type:2 PROPORTIONAL_RADIUS, type:3 ADAPTIVE_RADIUS: 3
>      - value:
>        - Radius represented as % of element's largest side (width/height).
>          DEFAULT_PROPORTIONAL_RADIUS = 0.25;
>        - Fixed radius for the ADAPTIVE_RADIUS algorithm. In pixels.
>          DEFAULT_ADAPTIVE_RADIUS = 32;

![image|200](https://user-images.githubusercontent.com/5153846/206264345-59fd7436-e87b-4bc9-ade8-9e6f6a6fd8c1.png)

## New
- Improved embedding into Obsidian Canvas
- Improved embedding into Markdown documents
- Added setting under `Display/Default mode when opening Excalidraw` to always open the drawing in view mode on Mobile, but in normal mode on desktop. [#939](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/939)

## Fixed
- Zoom reset tooltip appears twice [#942](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/942)
- Hid export library from library menu as it does not work due to Obsidian limitations. Use the command palette export library instead.
- Arrow with label did not get exported and embedded correctly [#941](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/941)
![image|200](https://user-images.githubusercontent.com/22638687/207845868-b352ddb1-7994-4f13-a0b2-f2e19bd72935.png)

# 1.8.4

## New from Excalidraw.com
- Labels on Arrows!!! [#5723](https://github.com/excalidraw/excalidraw/pull/5723).
  - To add a label press "Enter" or "Double click" on the arrow
  - Use "Cmd/Ctrl+double click" to enter the line editor

https://user-images.githubusercontent.com/11256141/192515552-6b6ddc06-5de0-4931-abdd-6ac3a804656d.mp4

## New
- Changed behavior: In the Obsidian markdown editor clicking an Excalidraw image will not open the image (to avoid accidentally opening the image on a tablet). To open a drawing for editing in Excalidraw double click or long-tap on it. [#920](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/920)

## Fixed 
- BUG: text stroke color is not honored when the color is not on the palette [#921](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/921)
- BUG: The new [paste behavior](https://github.com/excalidraw/excalidraw/pull/5786) introduced in the previous release did not work as expected in Obsidian. Now it does.

# 1.8.3-beta

## New from Excalidraw.com
- Labels on Arrows!!! [#5723](https://github.com/excalidraw/excalidraw/pull/5723)

## Fixed 
- BUG: text stroke color is not honored when the color is not on the palette [#921](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/921)

# 1.8.2


Introducing the [Excalidraw Slideshow Script](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Slideshow.md) - available in the script store
[![Thumbnail - Excalidraw presentations (Custom)](https://user-images.githubusercontent.com/14358394/205403915-db688250-c450-4259-a27a-d82207c86deb.png)](https://youtu.be/HhRHFhWkmCk)

## Fixed
- Obsidian tools panel gets misplaced after switching Obsidian workspace tabs

## New in ExcalidrawAutomate
- changed `viewToggleFullScreen(forceViewMode: boolean = false): void`: the function will toggle view mode on when going to full screen and view mode off when terminating full screen.
- new functions
```typescript
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
```


# 1.8.1

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

## New in Excalidraw Automate
- Published the obsidian_module on the ExcalidrawAutomate object. `ExcalidrawAutomate.obsidian`. Publishing this object will give script developers increased flexibility and control over script automation.


# 1.8.0

[![Thumbnail - 1 8 0 OCR (Custom)](https://user-images.githubusercontent.com/14358394/202916770-28f2fa64-1ba2-4b40-a7fe-d721b42634f7.png)
](https://youtu.be/7gu4ETx7zro)



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

# 1.7.30

Fix:
- Forcing the embedded image to always scale to 100% (a feature introduced in [1.7.26](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.7.26)) scaled the embedded excalidraw drawings incorrectly on devices with a pixel ratio of 2 or 3 (e.g. iPads). This is now fixed, however, this fix might retrospectively impact drawings that use this feature. Sorry for that.

# 1.7.29

- This is a big update that accommodates the **UI redesign** on Excalidraw.com [#5780](https://github.com/excalidraw/excalidraw/pull/5780). The change on the surface may seem superficial, however, I had to tweak a number of things to make it work in Obsidian. I hope I found everything that broke and fixed it, if not, I'll try to fix it quickly...
- This update also comes with changes under the hood that **fix issues with Excalidraw Automate** - paving the way for further scripts, plus some smaller bug fixes.
- I **reworked text wrapping**. In some cases, text wrapping in SVG exports looked different compared to how the text looked in Excalidraw. This should now be fixed.
- If you are using the **Experimental Dynamic Styling** of the Excalidraw Toolbar, then I recommend updating your styling script following base on [this](https://gist.github.com/zsviczian/c7223c5b4af30d5c88a0cae05300305c)

# 1.7.27

## New
- Import SVG drawing as an Excalidraw object. [#679](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/679)
[![Thumbnail - 1 7 27 SVG import (Custom)](https://user-images.githubusercontent.com/14358394/199207784-8bbe14e0-7d10-47d7-971d-20dce8dbd659.png)](https://youtu.be/vlC1-iBvIfo)

## Fixed
- Large drawings freeze on the iPad when opening the file. I implemented a workaround whereby Excalidraw will avoid zoom-to-fit drawings with over 1000 elements. [#863](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/863)
- Reintroduced copy/paste to the context menu

# 1.7.26

## Fixed
- Transcluded block with a parent bullet does not embed sub-bullet [#853](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/853)
- Transcluded text will now exclude ^block-references at end of lines
- Phantom duplicates of the drawing appear when "zoom to fit" results in a zoom value below 10% and there are many objects on the canvas [#850](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/850)
- CTRL+Wheel will increase/decrease zoom in steps of 5% matching the behavior of the "+" & "-" zoom buttons.
- Latest updates from Excalidarw.com
  - Freedraw flip not scaling correctly [#5752](https://github.com/excalidraw/excalidraw/pull/5752)
  - Multiple elements resizing regressions [#5586](https://github.com/excalidraw/excalidraw/pull/5586)

## New - power user features
- Force the embedded image to always scale to 100%. Note: this is a very niche feature with a very particular behavior that I built primarily for myself (even more so than other features in Excalidraw Obsidian - also built primarily for myself 😉)... This will reset your embedded image to 100% size every time you open the Excalidraw drawing, or in case you have embedded an Excalidraw drawing on your canvas inserted using this function, every time you update the embedded drawing, it will be scaled back to 100% size. This means that even if you resize the image on the drawing, it will reset to 100% the next time you open the file or you modify the original embedded object. This feature is useful when you decompose a drawing into separate Excalidraw files, but when combined onto a single canvas you want the individual pieces to maintain their actual sizes. I use this feature to construct Book-on-a-Page summaries from atomic drawings.
- I added an action to the command palette to temporarily disable/enable Excalidraw autosave. When autosave is disabled, Excalidraw will still save your drawing when changing to another Obsidian window, but it will not save every 10 seconds. On a mobile device (but also on a desktop) this can lead to data loss if you terminate Obsidian abruptly (i.e. swipe the application away, or close Obsidian without first closing the drawing). Use this feature if you find Excalidraw laggy.

# 1.7.25

## Fixed
- Tool buttons did not visually stick the first time you clicked them.
- Tray (in tray mode) was higher when the help button was visible. The tray in tablet mode was too large and the help button was missing.
- ExcalidrawAutomate `getCM(color:TInput): ColorMaster;` function will now properly convert valid [css color names](https://www.w3schools.com/colors/colors_names.asp) to ColorMaster objects.
- The downloaded script icons in the Excalidraw-Obsidian menu were not always correct
- The obsidian mobile navigation bar at the bottom overlapped with Excalidraw

# New
- Created ExcalidrawAutomate hook for styling script when the canvas color changes. See sample [onCanvasColorChangeHook](https://gist.github.com/zsviczian/c7223c5b4af30d5c88a0cae05300305c) implementation following the link.

[![Thumbnail - Excalidraw Dynamic Styling (Custom) (1)](https://user-images.githubusercontent.com/14358394/196050310-ac96f9e9-0aaa-495c-b081-f3fca21a84d7.png)](https://youtu.be/LtR04fNTKTM)


```typescript
  /**
   * If set, this callback is triggered whenever the active canvas color changes
   */
  onCanvasColorChangeHook: (
    ea: ExcalidrawAutomate,
    view: ExcalidrawView, //the Excalidraw view 
    color: string,
  ) => void = null;
```

# 1.7.24

This is the same as 1.7.23.  I missed the main.js from 1.7.23. I created this additional release so you can update in Obsidian and get the latest main.js

# 1.7.23

## New and improved
- **Updated Chinese translation**. Thanks, @tswwe!
- **Improved update for TextElement links**: Until now, when you attached a link to a file to a TextElement using the "Create Link" command, this link did not get updated when the file was renamed or moved. Only links created as markdown links in the TextElement text were updated. Now both approaches work. Keep in mind however, that if you have a link in the TextElemenet text, it will override the link attached to the text element using the create link command. [#566](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/566)
- **Transclusion filters markdown comments**: Text transclusion in a TextElement using the `![[file]]` or `![[file#section]]` format did not filter out markdown comments in the file placed `%% inside a comment block %%`. Now they do.
- **Remove leading '>' from trancluded quotes**: Added a new option in settings under **Links and Transclusion** to remove the leading `> ` characters from quotes you transclude as a text element in your drawing. 
![image](https://user-images.githubusercontent.com/14358394/194755306-6e7bf5f3-4228-44a1-9363-c3241b34865e.png)
- **Added support for `webp`, `bmp`, and `ico` images**. This extends the already supported formats (`jpg`, `gif`, `png`, `svg`).
- **Added command palette action to reset images to original size**. Select a single image or embedded Excalidraw drawing on your canvas and choose `Set selected image element size to 100% of original` from the command palette. This function is especially helpful when you combine atomic drawings on a single canvas, keeping each atomic piece in its original excalidraw file (i.e. the way I create [book on a page summaries](https://www.youtube.com/playlist?list=PL6mqgtMZ4NP1-mbCYc3T7mr-unmsIXpEG))
- The `async getOriginalImageSize(imageElement: ExcalidrawImageElement): Promise<{width: number; height: number}>` function is also avaiable via ExcalidrawAutomate. You may use this function to resize images to custom scales (e.g. 50% size, or to fit a certain bounding rectangle).

# Fixed
- Upgraded perfect freehand package to resolve unwanted dots on end of lines [#5727](https://github.com/excalidraw/excalidraw/pull/5727)
- Pinch zoom in View mode opens images resulting in a very annoying behavior [#837](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/837)
- Embedded files such as transcluded markdown documents and images did not honor the Obsidian "New Link Format" setting (shortest path, relative path, absolute path). [#829](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/829)
- **Fixed error with dataview queries involving Excalidraw files**: In case you created a task on an Excalidraw canvas (`docA.md`) by typing `- [ ] Task [[owner]] #tag`, and then you created a Dataview tasklist in another document (`docB.md`) such that the query criteria matched the task in `docA.md`, then the task from `docA.md` only appeared as an empty line when viewing `docB.md`. If you now embedded `docB.md` into a third markdown document (`docC.md`), then instead of the contents of `docB.md` Obsidian rendered `docA.md`. [#835](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/835)


# 1.7.22

## Fixed
- Text size in sticky notes increased when opening the drawing or when editing a sticky note [#824](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/824)
- ToDo rendering did not work properly when there were parsed links in the text
- Horizontal text alignment in sticky notes did not honor text alignment setting when resizing text. The text was always aligned center even when text alignment was left or right. [#5720](https://github.com/excalidraw/excalidraw/issues/5720)

# 1.7.21

## New from Excalidraw.com
- Image-mirroring in export preview and in exported SVG [#5700](https://github.com/excalidraw/excalidraw/pull/5700), [#811](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/811), [#617](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/617)

# New 
- Ctrl+s will force-save your drawing and update all your transclusions
- Added setting to parse `- [ ] ` and `- [x] ` todo items. Parsing is disabled by default. This feature can be found under "Links and Transclusions" in Plugin Settings. [#819](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/819)
![image](https://user-images.githubusercontent.com/14358394/192145020-94bdd115-d24f-47c7-86fe-1417c53980c4.png)

https://user-images.githubusercontent.com/14358394/192151120-3c61c822-0352-4ba7-9900-b38078fb373c.mp4

- Added new scripts to the script library
  - [Rename Image](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Rename%20Image.md)
  - [Text Arch](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Text%20Arch.md)
 
https://user-images.githubusercontent.com/14358394/192151105-78c0115b-4e30-4296-b647-e3c05851a48f.mp4

# Fixed
- Fixed toast message to display script name on press and hold on mobile and iPad.
- Fixed save error when the embedded image file is not found (i.e. it was moved, renamed, or deleted)


# 1.7.20

## New from Excalidraw.com
- support segment midpoints in line editor [#5641](https://github.com/excalidraw/excalidraw/pull/5641)

# Fixed
- When editing a line or arrow and selecting a tool on the toolbar, the tool jumps back to the selection tool and you need to click again to select the tool [#5703](https://github.com/excalidraw/excalidraw/issues/5703)
- Minor improvement of autosave, hopefully decreasing occasional lagging

# 1.7.19

## QoL improvements
- Reintroduced the help button. I also added the help button to the Tray (in Tray Mode) and moved help to the canvas action panel (in non-TrayMode), because in Obsidian 0.16.0 the status bar hides the help icon.
- Resetting the canvas with the "Reset Canvas" button will now preserve the custom color palette.
- I updated the [Set background color of unlclosed line object](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md) script. The script will now add background color to open freedraw objects as well. You no longer need to convert freedraw objects to lines before setting the background color. Check the Script Engine library to download the update.

# New in Excalidraw Automate
- I added the [ColorMaster](https://github.com/lbragile/ColorMaster#readme) library to ExcalidrawAutomate. You can get a CM object by calling `ExcalidrawAutomate.getCM(<your color comes here>)`. Color master introduces many new ways to manipulate colors from script. I will publish scripts that make use of this new functionality including supporting videos on my YouTube channel in the coming days.

# 1.7.18

## Critical fix
- Duplicating text elements, adding text elements from the library, and pasting excalidraw text elements results in a corrupted file!!

# 1.7.17

## Fixed
- Block transclusions sometimes got lost when switching between RAW mode and PREVIEW mode. [#769](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/769)

## New
- Added feature to disable "new Excalidraw version" notification [#770](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/770)
- Added option to export both light- and dark-themed images at the same time. If this is enabled Excalidraw will create two files "filename.dark.png" and "filename.light.png" (or .svg depending on your other settings). See practical use case here: [Aadam's Notes](https://notes.aadam.dev/SBYNtPHqsTW9Ck1Kuoxsu/)
- Added custom export padding for PNG images. Use the frontmatter key `excalidraw-export-padding` to set the padding at a file level, or set padding for all your files in plugin settings. The new feature replaces the old "SVG Padding" option and applies to both SVG and PNG exports.

## ExcalidrawAutomate
- Added `padding` to the createPNG function call.
```typescript
async createPNG(
  templatePath?: string,
  scale: number = 1,
  exportSettings?: ExportSettings,
  loader?: EmbeddedFilesLoader,
  theme?: string,
  padding?: number,
)
```

# 1.7.16

## fixed
- Excalidraw canvas is empty after saving the drawing and re-opening it at a later time. If you accidentally paste Excalidraw elements from the clipboard as the contents of a text element, in certain situations this can corrupt the Excalidraw file and as a result, Excalidraw will load an empty-looking drawing the next time.  Changing to markdown view, these files can be repaired, however, to avoid accidental data loss, I have prevented pasting of excalidraw clipboard contents as text elements. [#768](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/768)

# new
- Add zoom % display in mobile TM mode [737](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/737)

# 1.7.15

## Fixed
- Canvas turns white when adding point for curved line [#760](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/760), [#738](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/738), [#5602](https://github.com/excalidraw/excalidraw/issues/5602)

# 1.7.14

[![Video thumbnail small](https://user-images.githubusercontent.com/14358394/185787278-9dff080c-591e-4be2-a35a-9be0be85526f.jpg)](https://youtu.be/yZQoJg2RCKI)

## New
- The `Copy markdown link for selected element to clipboard` action in the Obsidian menu is now more intelligent. If multiple elements are selected it will copy the Element Reference for the largest element. 
- When referencing an element in a link pointing to an Excalidraw file using the elementId or the section header as the block reference e.g. `[[file#^elementID]]`, you can now add the `group=` prefix, e.g. `[[file#^group=elementID]]` and the `area=` prefix, e.g. `[[file#area=Section heading]]`. If the `group=` prefix is found, Excalidraw will select the group of elements in the same group as the element referenced by the elementID or heading section reference. If the `area=` prefix is found, excalidraw will insert a cutout of the image around the referenced element. The `area=` selector is not supported when embedding Excalidraw as PNG into your markdown documents.
- I added "Toggle left-handed mode" to the Command Palette. The action is only visible if tray-mode is enabled. It will move the tray from left to right and back. [749](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/749)
-  
## Fix
- Zooming with CTRL+Wheel will no longer trigger hover preview.
- When editing text in a text element CTRL+C will not launch the hover preview in case the mouse pointer is over the text element being edited. Hover preview will only show if the element is not in editing mode.
- ExcalidrawAutomate did not reliably save changes. This caused issues for example in the "Add link to an existing file and open" script. [#747](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/747)
- Create a new folder not working when clicking on a link in Erxcalidraw that points to a file that is in a folder that does not yet exist. [741](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/741)
- Downgraded to React 17 due to various stability issues, including [#738](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/738) and [#747](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/747)

# New in Excalidraw Automate
- I added two new Excalidraw Automate functions
```typescript
/**
 * Gets the groupId for the group that contains all the elements, or null if such a group does not exist
 * @param elements 
 * @returns null or the groupId
*/
getCommonGroupForElements(elements: ExcalidrawElement[]): string;

/**
 * Gets all the elements from elements[] that share one or more groupIds with element.
 * @param element 
 * @param elements - typically all the non-deleted elements in the scene 
 * @returns 
*/
getElementsInTheSameGroupWithElement(element: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[];
```

# 1.7.13

## Fix from Excalidraw.com
- Resize multiple elements from center ([#5560](https://github.com/excalidraw/excalidraw/pull/5560))

# Obsidian 0.16.0 compatibility enhancements (accessible to insiders soon)
- `Install or update Excalidraw Scripts` was only available via the page header button. Because the page header is hidden by default, the install script action is now available through the pane menu and through the command palette as well.
- `Open selected text as link` page header button is now also available via the pane menu
- `Open in Adjacent Pane` and `Open in Main Workspace` Excalidraw plugin settings fixed

# 1.7.12

## New from Excalidraw.com:
- Show a mid-point for lines and arrows. By touching the mid-point you can add an additional point to a two-point line. This is especially helpful when working on a tablet with touch input. ([#5534](https://github.com/excalidraw/excalidraw/pull/5534))
- Lock angle when editing a line or an arrow with shift pressed. Pressing shift will restrict the edited point to snap to certain discrete angles. ([#5527](https://github.com/excalidraw/excalidraw/pull/5527))

# Fixed:
- Clicking Obsidian search-results pointing to an element on the canvas stopped working ([#734](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/734))
- Allow resizing and rotation of lines and arrows consisting of 3 or more points by showing the bounding box when selected ([#5554](https://github.com/excalidraw/excalidraw/pull/5554))

# New
- You can now use the following frontmatter key to allow/prevent automatic export of PNG/SVG images at a file level. This frontmatter will override export settings for the given file.  ([#732](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/732)
`excalidraw-autoexport: none|both|svg|png`

# 1.7.11

## Fixed
- Markdown files embed into the Excalidraw canvas crashed when the embedded markdown file included a nested Markdown embed with a block reference (i.e. the markdown document you are dropping into Excalidraw included a quote you referenced from another file using a `[[other-file#^blockref]]` block or section reference. 
- Horizontal flipping of arrows and lines broke in 1.7.10. ([#726](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/726))

# 1.7.10

## New from Excalidraw.com
- Improved handling of arrows and lines. ([#5501](https://github.com/excalidraw/excalidraw/pull/5501))

# Fixed
- When opening a document in view-mode or zen-mode the panel buttons no longer flash up for a moment before switching to the desired mode. ([#479](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/479))
- The "blinding white screen" no longer flashes up while loading the scene if the scene is dark ([#241](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/241))

# Under the hood
- Finalized migration to React 18 (no longer showing an error about React 17 compatibility mode in console log)

# 1.7.9

## New features and fixes from Excalidraw.com:
- The right-click context menu is now scrollable on smaller screens ([#4030](https://github.com/excalidraw/excalidraw/pull/4030), [#5520](https://github.com/excalidraw/excalidraw/pull/5520))
- Holding down the shift key while rotating an object will rotate it at discrete angles. Rotation is continuous without the SHIFT key. ([#5500](https://github.com/excalidraw/excalidraw/pull/5500))
- Improved cursor alignment when resizing an element proportionally (maintain aspect ratio) by holding SHIFT during resizing. ([#5513](https://github.com/excalidraw/excalidraw/pull/5515))
- Improved freedraw performance during editing (now has proper canvas caching), and no more blurry freedraw shapes when exporting on a higher scale. ([#5481](https://github.com/excalidraw/excalidraw/pull/5481))
- Sidebar stencil library now correctly scrolls vertically ([#5459](https://github.com/excalidraw/excalidraw/pull/5459))

# New in Obsidian:
- Fullscreen mode on iPad. When there are multiple work panes open, clicking the fullscreen action in the Excalidraw Obsidian menu will hide the other work panes and make Excalidraw fullscreen.

# Fixes in Obsidian:
- Drag&Drop an image from a web browser into Excalidraw ([#697](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/697))
- On Obsidian Mobile 1.3.0, when the drawing included an embedded image, switching from markdown-view to Excalidraw-view caused the drawing to disappear (it had to be recovered from backup or synchronization history).  ([#715](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/715))
- When working on a mobile device (tablet and phone) and using two work panes (one for drawing and the other for editing a markdown document) if you switched focus from the drawing to the markdown document auto-zoom changed the zoom level of the drawing. ([#723](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723)), ([#705](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/705))
- Actions on the Command Palette to create a new drawing in a new pane or reusing an existing adjacent pane; on the main workspace or in the Hover Editor or Popout window, were not working well. See related settings in plugin settings under "Links and transclusions" ([#718](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/718))
- There was a problem with links with section references when the header contained space characters ([#704](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/704))
- I added additional controls to avoid the fantom warnings about a problem with saving the Excalidraw file. Hopefully, from now on, you'll see this error less frequently ([#701](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/701))

# 1.7.8

⚠⚠⚠ Only install this version if you have Obsidian 0.15.5 or later.⚠⚠⚠

# Optimized for Obsidian 0.15.5
- I reworked how the plugin treats the "More options" menu because the old approach was interfering with Obsidian
- Did thorough testing of handling of work panes on link click. There are two settings (open in the adjacent pane, and open in the main workspace), and three broad scenarios (Excalidraw in a work pane in the main Obsidian window, Excalidraw in a hover editor, and Excalidraw in an Obsidian popout window). All should work correctly now.


# 1.7.7

⚠⚠⚠ Only install this version if you have Obsidian 0.15.4 or later.⚠⚠⚠

# New
- Optimized for Obsidian 0.15.4
- On a desktop, you can now use the META key when clicking on a link and it will open the link in a new popout Window.
- ([#685](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/685)) Markdown embeds will now display correctly in Excalidraw even if they include photos and recursive markdown embeds. Unfortunately due to the limitations of Safari the inversion of colors on iPads in dark mode will not work well.

https://user-images.githubusercontent.com/14358394/177213263-2a7ef1ca-0614-4190-8955-e830ca6b424b.mp4

# Fixed
- ([#683](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/683)) Copy/Paste Markdown embeds to create another instance of the embed, thus you can reference different sections of the document in your drawing (something I broke in 1.7.6)
- ([#684](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/684)) Transclusions incorrectly did not pick up subsections of a section. To understand this change, imagine for example the following document:
```markdown
# A
abc
# B
xyz
## b1
123
## b2
456
# C
```
When you transclude `![[document#B]]` you expect the following result
```
B
xyz

b1
123

b2
456
```
Until this fix you only got
```
B
xyz
```

# 1.7.6

⚠⚠⚠ Only install this version if you have Obsidian 0.15.3 or later.⚠⚠⚠

This release is the same as 1.7.5 except for two minor fixes
- a fix for ExcaliBrain, becuase 1.7.5 broke ExcaliBrain.
- I left out the release note from 1.7.5.

# New
- Deployed sidebar for libraries panel from excalidraw.com ([#5274](https://github.com/excalidraw/excalidraw/pull/5274)). You can dock the library to the right side depending on the screen real estate available (i.e. does not work on mobiles).

# Fixed
- When copying 2 identical images from one drawing to another, the second image got corrupted in the process ([#672]https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/672)).
- When making a copy of an equation in a drawing and then without first closing/opening the file, immediately copying the new equation to another drawing, the equation did not get displayed until the file was closed and reopened.
- Copying a markdown embed from one drawing to another, in the destination the markdown embed appeared without the section/block reference and without the width & height (i.e. these settings had to be done again)
- Improved the parsing of section references in embeds. When you had `&` in the section name in a markdown file, when embedding that markdown document into Excalidraw, the section reference did not work as expected ([#681 ](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/681)).
- Improved the logic for autosave to better detect changes to the document, and to reduce too frequent export of `.png` and/or `.svg` files, when auto export is enabled in plugin settings.


# 1.7.5

⚠⚠⚠ Only install this version if you have Obsidian 0.15.3 or later.⚠⚠⚠

# New
- Deployed sidebar for libraries panel from excalidraw.com ([#5274](https://github.com/excalidraw/excalidraw/pull/5274)). You can dock the library to the right side depending on the screen real estate available (i.e. does not work on mobiles).

# Fixed
- When copying 2 identical images from one drawing to another, the second image got corrupted in the process ([#672]https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/672)).
- When making a copy of an equation in a drawing and then without first closing/opening the file, immediately copying the new equation to another drawing, the equation did not get displayed until the file was closed and reopened.
- Copying a markdown embed from one drawing to another, in the destination the markdown embed appeared without the section/block reference and without the width & height (i.e. these settings had to be done again)
- Improved the parsing of section references in embeds. When you had `&` in the section name in a markdown file, when embedding that markdown document into Excalidraw, the section reference did not work as expected ([#681 ](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/681)).
- Improved the logic for autosave to better detect changes to the document, and to reduce too frequent export of `.png` and/or `.svg` files, when auto export is enabled in plugin settings.


# 1.7.4

⚠⚠⚠ Only install this version if you have Obsidian 0.15.3 or later.⚠⚠⚠


- Obsidian 0.15.3 support dragging and dropping work panes between Obsidian windows.

https://user-images.githubusercontent.com/14358394/176932818-5ff6ad55-daac-4c1d-8681-5bb2616ded65.mp4

- Addressed Obsidian changes affecting the more-options menu.
- Addressed incompatibility with Obsidian Mobile 1.2.2.

# 1.7.3

## Requires Obsidian 0.15.3

Support for dragging and dropping work panes between Obsidian windows.

# 1.7.2

Due to some of the changes to the code, I highly recommend restarting Obsidian after installing this update to Excalidraw.

# Fixed
- Stability improvements
- Opening links in new panes and creating new drawings from the file explorer works properly again

# New feature
- Two new command palette actions:
  - Create a new drawing - IN A POPOUT WINDOW
  - Create a new drawing - IN A POPOUT WINDOW - and embed into active document
![image](https://user-images.githubusercontent.com/14358394/175137800-88789f5d-f8e8-4371-a356-84f443aa6a50.png)
- Added setting to prefer opening the link in the popout window or in the main workspace.
![image](https://user-images.githubusercontent.com/14358394/175076326-1c8eee53-e512-4025-aedb-07881a732c69.png)

# 1.7.1

Support for Obsidian 0.15.0 popout windows. While there are no new features (apart from the popout window support) under the hood there were some major changes required to make this happen.

![image](https://user-images.githubusercontent.com/14358394/174451726-90ed8c82-77ff-4015-b8e9-7220bd2e6041.png)


# 1.7.0

This is the first test version of Excalidraw Obsidian supporting Obsidian 0.15.0 popout windows. The current technical solution is not really sustainable, it's more of a working concept. I don't expect any real big issues with this version - on the contrary, this works much better with Obsidian 0.15.0 popout windows, but some of the features aren't working as expected in the Obsidian popouts yet. Also as a consequence of Obsidian 0.15.0 compatibility, multiple hover previews are no longer supported.

# 1.6.34

Obsidian is implementing some exciting, but significant changes to how windows are managed. I need to make some heavy/invasive changes to Excalidraw to adapt. The next version of the Excalidraw Plugin will require Obsidian 0.15.1 or newer. If you are not signed up for Obsidian Insider Builds, you will need to wait a few weeks until the new Obsidian version will be made public.

# Fix
- Error saving when the attachments folder exists but with a different letter case (i.e. Attachments instead of attachments) [658](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/658). I added more error tolerance. As a general rule, however, I recommend treating file paths as case-sensitive as some platforms like iOS or LINUX have case-sensitive filenames, and synchronizing your Vault to these platforms will cause you headaches in the future.
- Text detached from the container if you immediately clicked the text-align buttons while editing the text in the container for the very first time. [#657](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/657).
- Can't add text to the second container if the first container has text and the second container is centered around the first one. [#5300](https://github.com/excalidraw/excalidraw/issues/5300)


# 1.6.33

## Fixed
- Under some special circumstances an Excalidraw drawing embedded into another Excalidraw drawing did not update when you modified the embedded drawing until you closed Excalidraw completely and reopened it. [#637](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/637)

# New
- ExcalidrawAutomate addLabelToLine adds a text label to a line or arrow. Currently only works with a simple straight 2-point (start & end) lines.
```typescript
addLabelToLine(lineId: string, label: string): string
```
- ExcalidrawAutomate ConnectObjects now returns the id of the arrow that was created.


# 1.6.32

## Fixed
- Filenames of embedded images and markdown documents did not get updated if the drawing was open in a work-pane while you changed the filename of the embedded file (image or markdown document) [632](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/632).
- When you created a new text element and immediately dragged it, sometimes autosave interrupted the drag action and Excalidraw dropped the element you were dragging [630](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/630)
- In some edge cases when you had the drawing open on your desktop and you also opened the same image on your tablet, Sync seemed to work in the background but the changes did not appear on the desktop until you closed and opened the drawing again. [629](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/629)
- LaTeX support: Excalidraw must download a javascript library from one of the hosting sites for MathJax tex2svg. It seems that some people do not have access to the URL recommended in the first place by [MathJax](https://docs.mathjax.org/en/latest/web/start.html). If LaTeX formulas do not render correctly in Excalidraw, try changing the source server under Compatibility Settings in Excalidraw Plugin Settings. [628](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/628)



# 1.6.31

Minor update:

## Fixes
- Color picker hotkeys were not working. They are working again [627](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/627)
- MathJax was throwing an error when you opened a drawing with LaTeX formulas. I updated MathJax (LaTeX) to the newest  (3.2.1) release.

# 1.6.30

## Fixed
- The load library button stopped working [#625](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/625).
- On iPad (probably other Obsidian mobile platforms as well) after opening the command palette the positioning of the pointer was off. From now on, the pointer is now automatically re-calibrated every 5 seconds.
- I improved collaboration sync. If the open file has not been saved for the last 5 minutes (i.e. you are not working on it actively), and a remote newer version is received via sync, then the remote file will simply overwrite the local file (i.e. the behavior of Excalidraw Obsidian prior to implementing Share Vault Synchronization support in 1.6.29). This solution helps distinguish between active collaboration when parties participating are actively editing, but also caters to the scenario when you open a drawing on one device (e.g. your home desktop) and once you are finished editing you do not close the drawing, but simply put your PC to sleep... Later you edit the same drawing on your tablet. When you turn on your desktop the next time, the changes you made on your tablet are synchronized. The changes from your tablet should be honored, there is no value in running the file comparison between the local version and the received one... this reduces the probability of running into sync conflicts.


# 1.6.29

## New
- I implemented sync support inspired by the new [Obsidian Multiplayer Sync](https://youtu.be/ZyCPhbd51eo) feature (available in insider build v0.14.10). 
  - To manage expectations, this is not real-time collaboration like on Excalidraw.com. Synchronization is delayed by the frequency of the autosave timer (every 10 secs) and the speed of Obsidian sync. Also if a file has conflicting versions, Obsidian sync may delay the delivery of the changed file.
  - Even if you are not using multiplayer Obsidian Vaults, you may benefit from the improved synchronization, for example when using the freedraw tool on your tablet or phone, and in parallel editing the same drawing (e.g. typing text) on your desktop. I frequently do this in a mind-mapping scenario.
  - If the same Excalidraw sketch is open on multiple devices then Excalidraw will try to merge changes into the open drawing, thus parallel modifications on different devices are possible. If the same element is edited by multiple parties at the same time, then the foreign (received) version will be honored and the local changes lost. 

## Fixed:
- Default embed width setting stopped working. [#622](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/622)
- The link tooltip gets stuck on screen after Excalidraw closes [#621](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/621)
- Layout error when using the Workspaces core plugin. [#28](https://github.com/zsviczian/excalibrain/issues/28)


# 1.6.28

## New
- When dropping a link from a DataView query into Excalidraw the link will honor your "New link format" preferences in Obsidian. It will add the "shortest path when possible", if that is your setting. If the link includes a block or section reference, then the link will automatically include an alias, such that only the filename is displayed (shortest path possible allowing) [#610](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/610)
- If Excalidraw is in a Hover Editor and you open a link in another pane by CTRL+SHIFT+Click then the new page will open in the main workspace, and not in a split pane in the hover editor.

## Fixed
- New text elements get de-selected after auto-save [#609](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609)
- Update opacity of bound text when the opacity of the container is updated [#5142](https://github.com/excalidraw/excalidraw/pull/5142)
- ExcalidrawAutomate: openFileInNewOrAdjacentLeaf() function. This also caused an error when clicking a link in Excalidraw in a hover window, when there were no leaves in the main workspace view.

# 1.6.27

## New Features
- New front matter tag: `excalidraw-onload-script`. The value of this field will be executed as javascript code using the Script Engine environment. Use this to initiate custom actions or logic when loading your drawing.
- New ExcalidrawAutomate function: 
```typescript
isExcalidrawView(view: any): boolean;
deregisterThisAsViewEA():boolean;
onViewUnloadHook: (view: ExcalidrawView) => void;
```
- Added `view: ExcalidrawView, ea: ExcalidrawAutomate` to hooks.
```typescript
  onViewModeChangeHook(isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate): void;
  onLinkHoverHook(
    element: NonDeletedExcalidrawElement,
    linkText: string,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ):boolean;
  onLinkClickHook(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ): boolean;
```
- Added padding as optional parameter to ExcalidrawAutomte.createSVG
```typescript
  async createSVG(
    templatePath?: string,
    embedFont: boolean = false,
    exportSettings?: ExportSettings, 
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<SVGSVGElement>
```


# 1.6.26

## Fixed
- Dragging multiple files onto the canvas will now correctly [#589](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/589)
  - add multiple links
  - or if you hold the CTRL/(SHIFT on Mac) while dropping the files, then adding multiple images
- Dropped images and links were not selectable with the selection tool until the file was saved. This is now fixed.
- Display the linked block/section on link-hover instead of the full page. [#597](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/597)
- Hover preview without CTRL/CMD works again. Requires configuration in plugin settings. [#595](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/595)
- If you embed the same markdown document into a drawing multiple times, you can now display different sections of the document in each embedded object. [#601](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/601).
- If you make a copy of an equation and edit this copy, the original equation will remain unchanged [#593](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/593)

## New Features
- When you drag files from Dataview-results onto the canvas the obsidian:// urls will be converted into wiki links.[#599](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/599)
- I added one more frontmatter key: `excalidraw-linkbutton-opacity:` This sets the opacity of the blue link-button in the top right corner of the element, overriding the respective setting in plugin settings. Valid values are numbers between 0 and 1, where 0 means the button is fully transparent.

### Excalidraw Automate and Plugin integration
- I added `app.plugins.plugins["obsidian-excalidraw-plugin"].getAPI()`. The function will generate a new instance of the ExcalidrawAutomate API interface. This provides an alternative to using `window.ExcalidrawAutomate` with the added benefit that you do not need to `reset()` the object each time you use it since this will be a dedicated instance created each time `getAPI()` is called. For general scripting purposes `window.ExcalidrawAutomate` is still the ideal solution, however, if you are building a plugin or more complex script against ExcalidrawAutomate, then this solution will have benefits.
- published npm package for Excliadraw so that plugins can be developed against the Excalidraw-Automate API
- New event hooks:
```typescript
  /**
   * Register instance of EA to use for hooks with TargetView
   * By default ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
   * Using this event you can set a different instance of Excalidraw Automate for hooks
   */
  registerThisAsViewEA: () => void;

  /**
   * If set, this callback is triggered, when the user changes the view mode.
   * You can use this callback in case you want to do something additional when the user switches to view mode and back.
   */
  onViewModeChangeHook: (isViewModeEnabled:boolean) => void = null;

   /**
   * If set, this callback is triggered, when the user hovers a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
   */
  onLinkHoverHook: (
    element: NonDeletedExcalidrawElement,
    linkText: string,
  ) => boolean = null;

   /**
   * If set, this callback is triggered, when the user click a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
   */
  onLinkClickHook:(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent
  ) => boolean = null;

  /**
   * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
   * You can use this callback in case you want to do something additional when the onDrop event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
   */
  onDropHook: (data: {
    ea: ExcalidrawAutomate;
    event: React.DragEvent<HTMLDivElement>;
    draggable: any; //Obsidian draggable object
    type: "file" | "text" | "unknown";
    payload: {
      files: TFile[]; //TFile[] array of dropped files
      text: string; //string
    };
    excalidrawFile: TFile; //the file receiving the drop event
    view: ExcalidrawView; //the excalidraw view receiving the drop
    pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
  }) => boolean = null;
```

# 1.6.25

## Fixed
- pinch-zoom in view mode ([#5001](https://github.com/excalidraw/excalidraw/pull/5001))
- add image button on iPad was not working ([#5038](https://github.com/excalidraw/excalidraw/pull/5038) & [#584](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/584))

## New Feature
- If Excalidraw is open in a [hover-editor](https://github.com/nothingislost/obsidian-hover-editor) window when opening a link in a new pane by CTRL+SHIFT clicking on the link, Excalidraw will open the link in the main workspace and not by splitting the view inside the hover-editor. 
- Excalidraw ScriptEngine settings
  - Script Engine settings now render HTML descriptions
  - If `height` property of a text setting is set, the setting text input will be rendered as a textArea with the specified height.



# 1.6.24

## Fixed
- Shift+Click on an element link (i.e. a link attached to a rectangle, ellipse, etc) did not open the link in a new leaf (as it does when clicking a text element link).
- Clicking a link in a new leaf will make the leaf active and focused after the click. No further click is necessary to start editing the opened document.
- Using [hover-editor](https://github.com/nothingislost/obsidian-hover-editor), if you opened an Excalidraw drawing and dragged the editor to another location, the pointer in Excalidraw got misaligned with the actual mouse / pen location. Similarly, when rearranging workspace panes by dragging, Excalidraw lost pointer calibration.

## New Features
### From Excalidraw.com
- Element locking

### Plugin
- Any element that has a link, ctrl/cmd+clicking anywhere on the object will trigger the link action. You no longer have to go to the link icon. ([#541](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/541#issuecomment-1075578365))


# 1.6.23

## Fixes:
- I have received some user feedback about cases where the text separated from the sticky note. This version comes with a cleanup script that will try to automatically resolve these issues.
- Autosave did not notice changes in a very obscure case, when you opened a drawing, resized an element, and without deselecting the element you immediately closed the drawing. ([565](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/565)
- CTRL+Enter to create a task did not work in hover-editor when opened from Excalidraw. Now it does! Thanks @pjeby! ([567](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/567))

## New Features
- If you have the [Obsidian-Latex](https://github.com/xldenis/obsidian-latex) plugin installed Excalidraw will also process the `preambles.sty` file. ([563](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/563))
- Added new setting `Embed & Export/If found, use the already exported image for preview`.  This setting works in conjunction with the `Auto-export SVG/PNG` settings. If an exported image that matches the file name of the drawing is available, use that image instead of generating a preview image on the fly. This will result in faster previews especially when you have many embedded objects in the drawing, however, it may happen that your latest changes are not displayed and that the image will not automatically match your Obsidian theme in case you have changed the Obsidian theme since the export was created. This setting only applies to embedding images into markdown documents. For a number of reasons, the same approach cannot be used to expedite the loading of drawings with many embedded objects.

https://user-images.githubusercontent.com/14358394/161437490-1296a243-10a8-4419-a8d3-4c529102bf13.mp4

Note, the video demonstrates the slow loading, the long wait is deliberate at the beginning of the video.


# 1.6.22

## Fixed:
- "Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed into active document" did not work as intended when an Excalidraw pane was already open. (#559)
- [Obsidian-hover-editor](https://github.com/nothingislost/obsidian-hover-editor) related improvements (#555):
  - hovering triggered many hover preview windows in quick succession, and in some cases raised dozens of errors in the Developer Console
  - hover-editors were not visible in Excalidraw fullscreen mode

## Minor new features:
- Activating the eraser with key "e" will toggle the active tool and back. So for example if you are drawing a freedraw shape, you can press "e" to delete a few strokes, then press "e" again to continue drawing. On desktop PCs many styluses allow you to configure the pen button to trigger keypress "e". 
- New setting to enable penMode by default.
- I increased the file size limit for images you paste into Excalidraw from 2MB to 20MB. You should however avoid very large images as they will impact the overall performance of the canvas. (#557)

# 1.6.21

 # Fixed
- Links in drawings (e.g. text elements, embedded images, etc) were not updating consistently when the source file was moved or renamed in your Vault. In some cases, this has led to broken links.
- I implemented further improvements to the saving of your drawings. To remove an element of complexity and potential error, as part of this change, I have hidden the autosave settings. From now, autosave is always enabled. Excalidraw will attempt to save at every 10s, or if you are actively engaged in drawing a shape at that very moment (e.g. you are busy with a freedraw line), then autosave will save the drawing at the earliest next opportunity. Though this should never happen, if for some reason the save button gets stuck on "red" you should press it to trigger a forced-save.
- If you have two sections in your drawing `# Section abc` and `# Section abc def`, then referencing `[[#Section abc]]` in a link will also highlight `# Section abc def`. These section references now work as expected.

# 1.6.20

[![thumbnail](https://user-images.githubusercontent.com/14358394/159369910-6371f08d-b5fa-454d-9c6c-948f7e7a7d26.jpg)](https://youtu.be/U2LkBRBk4LY)

# Fixed
- ExcalidrawAutomate.create() threw an error. [#539](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/539)

# New Features
- Bind/unbind text to/from container [4935](https://github.com/excalidraw/excalidraw/pull/4935)
- Image export settings in the frontmatter [519](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/519).  If these keys are present they will override the default excalidraw embed and export settings.
  - `excalidraw-export-transparent: true`
    - true == Transparent / false == with background. 
  - `excalidraw-export-dark`
    - true == Dark mode / false == light mode.
  - `excalidraw-export-svgpadding`
    - This only affects export to SVG. Specify the export padding for the image
  - `excalidraw-export-pngscale`˙
    - This only affects export to PNG. Specify the export scale for the image. The typical range is between 0.5 and 5, but you can experiment with other values as well.

# 1.6.19

Fixes:
- Left-handed mode did not work on iOS
- Minor improvements to the Eraser


# 1.6.18

[![Thumbnail](https://user-images.githubusercontent.com/14358394/158008902-12c6a851-237e-4edd-a631-d48e81c904b2.jpg)](https://youtu.be/4N6efq1DtH0)

![1.6.18](https://user-images.githubusercontent.com/14358394/157973800-75150698-e1ed-44ac-8036-17bfc0ca9594.png)

# Fixes
- You were not able to modify the text properties of a text element while editing the text in tray mode. [496](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/496)
- iframely friendly page titles from web links did not work reliably. I reworked the logic, should work better now.
- Improved resilience of loading from a damaged Excalidraw.md file.

# New Features
## From Excalidraw.com
- Added Eraser [4887](https://github.com/excalidraw/excalidraw/pull/4887)

## Plugin
- New setting for default transcluded-text line-wrap length. This is the default value for "wrapAt" in `![[file#^block]]{wrapAt}`. Wrapping text using this feature will insert linebreaks in the transcluded text. An alternative approach is to transclude text inside sticky notes, in which case Excalidraw will automatically take care of text wrapping depending on the sticky note's width. [228](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/228)
- New command palette action to toggle Excalidraw fullscreen mode. This allows you to set a hotkey for fullscreen mode.
- I added basic support for left-handed users. You can enable left-handed mode in plugin settings under the "Display" section. Currently, only affects the position of the elements tray in tray-mode. [510](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/510)
- Added more flexibility for defining the filename for drawings. ⚠Due to the change, current settings may behave slightly differently compared to before.⚠[470](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/470)


# 1.6.17


[![thumbnail](https://user-images.githubusercontent.com/14358394/156930779-772ba4a5-04d5-4583-b752-3c5e1f6f0f21.jpg)](https://youtu.be/Etskjw7a5zo)

![1 6 17](https://user-images.githubusercontent.com/14358394/156931241-0d9f7b9b-ef8f-4dbc-9089-fef8f9d3d981.png)

# Fixed
- Freedraw shape's background color was missing in the SVG export. [#443](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/443)
- In rare cases, when you only changed the background color of the drawing or edited the dimensions of an embedded markdown document, or changed an existing LaTeX formula, and then moved to another document in the vault, these changes did not get saved. [#503](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/503)
- I resolved an Excalidraw Automate glitch with word wrapping in containers. EA generated containers with fixed line breaks. The same error also affected the conversion of drawings from the "legacy" Excalidraw.com file format.
- When you allow/disable autosave in settings, this change will immediately take effect for all open Excalidraw workspace leaves. Until now autosave was activated only after you closed and reopened the Excalidraw view. [#502](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/502)
- When you create a text element containing a `[[markdown link]]` in raw mode, the new link was parsed nonetheless, and sometimes the link disappeared, leaving only the parsed text without the actual link. Creating links in raw-mode now works correctly.

# New Features
- The most recent 5 custom colors from the canvas are now added as color options to the element stroke and element background palette. [#4843](https://github.com/excalidraw/excalidraw/pull/4843)
- Vertical text alignment for text in sticky notes  [#4852](https://github.com/excalidraw/excalidraw/pull/4852)
- Markdown embeds into Excalidraw now receive default styling, including that of tables, blockquotes, and code blocks. I also added a new setting and corresponding frontmatter-key to set the border-color for the embedded markdown document. You can override plugin settings at the document level by adding `excalidraw-border-color: steelblue` to the markdown document you want to embed into your drawing. Valid values are css-color-name|#HEXcolor|any-other-html-standard-format.
- In Obsidian search, when the text you were searching for is found in an Excalidraw document, clicking the link in search-results will open the drawing with the matching text element selected and zoomed.
- Excalidraw now supports linking to text elements on the canvas and linking to non-text objects. 
1) You can reference text headings just the same as markdown headings in a document
i.e. you have a text element that includes a valid markdown heading:
```markdown
# My Heading
details...
```
or 
```markdown
text element text
# my reference
```
You can reference these like this respectively: `[[#My Heading|display alias]]` and `[[#my reference|alias]]`

![image](https://user-images.githubusercontent.com/14358394/156890231-5a23bcb3-40a4-4ad7-b366-74c328620159.png)

2) You can also reference element ids similar to block references
- Links take this form `[[#^elementID|alias]]`
- Linking is supported by a new action on the Obsidian Tools Panel
![image](https://user-images.githubusercontent.com/14358394/156894011-6442c3d6-aaff-43a8-bd77-513e450484ba.png)


# 1.6.16

![Excalidraw 1 6 16 Release Notes](https://user-images.githubusercontent.com/14358394/155894422-cffcf247-9601-43ec-8a8d-53b61ad6ef4c.png)

## Fixed
- CMD+Drag from the Obsidian File Manager does not work on Mac. You can now use SHIFT+Drag to embed an image or markdown document into a scene. ([#468](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468))
- Excalidraw Compressed JSON is now cut to smaller chunks (64 characters per paragraph, instead of the earlier 1024 characters). This should address search performance issues. ([#484](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/484))

## New Features
- I added the Obsidian Tools Panel
  - Click the Obsidian button to access the panel.
  - The tools panel contains key plugin commands and user / downloaded Excalidraw scripts.
  - Drag the panel with the handle at the top. A single click on the top to collapse the panel.
  - On Mobile press and hold the drag handle before dragging, to avoid activating the Obsidian slide-in menus.
  - On Mobile long touch individual buttons on the panel to access tooltips.
  - Reinstall Excalidraw scripts to get the icons.
- If you hold down SHIFT while resizing a sticky note, the text size will scale instead of text wrapping. ([Excalidraw tweet](https://twitter.com/aakansha1216/status/1496116528890417155?s=20&t=taXjA6I9Nd0T-C0wYBsG5g))
- SVG export now includes links ([#4791](https://github.com/excalidraw/excalidraw/pull/4791))
- Added fullscreen mode for Obsidian Mobile
- Release notes
  - disable popup in settings
  - access release notes via the command palette, or the button on the tools panel

[![Thumbnail](https://user-images.githubusercontent.com/14358394/155894458-aa901561-1686-4255-86da-5e37f14a1690.jpg)](https://youtu.be/gMIKXyhS-dM)



# 1.6.15

## Fixed
- TFile.unsafeCacheData no longer available since Obsidian v0.13.25 [#464](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/464) - fix was not working correctly. Hopefully now it does.

# 1.6.14

## Fixed
- New drawing to match Obsidian theme option does not work [#463](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/463)
- File remains open after delete [#465](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/465)
- TFile.unsafeCacheData no longer available since Obsidian v0.13.25 [#464](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/464)
- Switching from raw mode to parsed mode does not work [#462](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/462)
- Don't autozoom on the on modify trigger [#461](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/461)
- Fixed Command Palette: "Transclude (embed) the most recently edited drawing" & embedding a PNG or SVG instead of the Excalidraw itself.

# New Feature
- Search for text elements in the scene. The script will select matching text elements and will zoom the scene to these elements. Use "quotation marks" to search for an exact match. Search is case insensitive and also ignores linebreaks.

https://user-images.githubusercontent.com/14358394/154866590-f2e49d64-aa2c-4a01-8673-19a3f23f5839.mp4

- Updated the [Change shape of selected elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Change%20shape%20of%20selected%20elements.md) script to convert lines and arrows as well. If the selection includes both "line" type elements and "box" type elements, then the user will be prompted first to convert boxed elements to rectangle, diamond, or ellipse, and then to convert line type elements to line or arrow.
- [#457](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/457) New option in Excalidraw settings to embed link to Excalidraw SVG or PNG as markdown link or Wiki link.
![image](https://user-images.githubusercontent.com/14358394/154864917-4fa13ff1-de45-4405-b9d4-e3c14ac5fbe1.png)



# 1.6.13

[![Thumbnail](https://user-images.githubusercontent.com/14358394/154821232-a404b6cf-72fb-4ce4-9d53-619132dce491.jpg)](https://youtu.be/xHPGWR3m0c8)

# Fixed
- Improved styling of the color palette, especially when the color palette is extra large.
You can find the color palette used in the example [here](https://github.com/zsviczian/obsidian-excalidraw-plugin/discussions/458)

https://user-images.githubusercontent.com/14358394/154809130-b72929b0-1a2b-4d64-b3df-967044fee681.mp4

- legacy Excalidraw file support
- Debugged save, now you can reliably work Excalidraw on a desktop and a tablet side by side. Just make sure you wait for autosave before starting to edit on the other device (or press force save).
- The Force Save button will turn red if there are unsaved changes.

# New Feature:
- new Excalidraw Automate functions (thanks to @1-2-3)
```typescript
  hexStringToRgb(color: string):number[];
  rgbToHexString(color: number[]):string;
  hslToRgb(color: number[]):number[];
  rgbToHsl(color:number[]):number[];  
  colorNameToHex(color:string):string;
```

- New option in settings: `compressed-json` file format for Excalidraw files. This will reduce the chances of Excalidraw JSON content cluttering your results in Obsidian Search. The feature is disabled by default.
  - Before
  ![image](https://user-images.githubusercontent.com/14358394/154798436-cf3f1591-7b92-4eb1-a5a1-abb2b0016376.png)
  ![image](https://user-images.githubusercontent.com/14358394/154798495-dcff6f51-a949-46c9-bea1-c57d4d009855.png)
  -  After
  ![image](https://user-images.githubusercontent.com/14358394/154798448-b2d1c971-8e8d-4296-9530-3929eda9b13b.png)
  ![image](https://user-images.githubusercontent.com/14358394/154798484-e4965d68-ddac-41ba-a47d-acee6ce7ab51.png)
![image](https://user-images.githubusercontent.com/14358394/154797587-e7e3a4d3-c739-4f3a-9aa9-5b6e95df108c.png)




# 1.6.12

## Improvements
- Improved saving:
  - Added 15-second autosave option.
  - Excalidraw will not save the file if there aren't any changes
  - on Obsidian quit save trigger was removed, because it is executed by Obsidian on a best effort basis, and may not complete, leaving crippled files.
  - Save icon turns red if edits are found. Autosave clears the red.
  - Removed the saving of .bak files

- The custom color palette now supports any number of colors
- The mobile toolbar now includes the save link button
![image](https://user-images.githubusercontent.com/14358394/154771690-1e7769bf-900e-40e1-acd8-d7663f7aec85.png)
- ExcalidrawAutomate fullscreen mode function no correctly switches to fullscreen, including command palette working in fullscreen mode
- Insert image and drag & drop image now add the image to the top, not the bottom
- MeasureText gracefully handles if fontSize or fontFamily is null
- The custom color palette now supports any number of colors
![image](https://user-images.githubusercontent.com/14358394/154772372-f47b87cd-9290-4a21-8734-a385fbfbe4b1.png)


# 1.6.11

## Fixed
- ea.addElementsToView broke with 1.6.8 [#438](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/438)

# 1.6.10

## Fixed
- Pasting images from clipboard with special characters in name fails silently [#422](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422)
- link icon not displayed for new link when excalidraw-link-brackets: true [#434](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/434)
- multiple instances of save result in race condition when terminating an Excalidraw leaf caused file conflict with the backup file
- Next attempt at solving: Unable to create target link from link text [#431](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/431)
- Excalidraw link tooltip text remained visible after navigating to the linked page

# 1.6.9

## Fixes:
- Unable to create target link from link text [#431](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/431)
- New drawing to match Obsidian theme did not work when creating a new drawing from template.
- Hover preview of Excalidraw documents not working [#416](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/416)
- Getting a lot of sync errors (Obsidian sync) for the drawing.excalidarw.md.bak file [#432](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/432)
- Lost focus when using a Wacom pen on Desktop [#426](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/426)
- Excalidraw will remember tray-mode for next drawings.



# 1.6.8

## Fixed
- undo now works correctly for elements modified with Excalidraw Script

# New features
[![Thumbnail](https://user-images.githubusercontent.com/14358394/153676009-6f86b2d7-c248-49a2-b802-be21c6999e4f.jpg)](https://youtu.be/2v9TZmQNO8c)

- New "Property-Panel Tray-Mode". You can toggle this mode from the command palette.
![image](https://user-images.githubusercontent.com/14358394/153668260-5a2a8985-8ba7-4a69-8166-abd4749da249.png)


## Custom color palette
![image](https://user-images.githubusercontent.com/14358394/153668524-1bb2fb71-f935-485c-8eb5-3df092c32104.png)

- You can specify the color palette to use for your drawings in the appState of your Excalidraw drawing template.
- You can omit `colorPalette` from appState if you don't want to change the color palette.
- The color palette must include 15 colors exactly for each of the 3 palettes.
- You do not need to provide all three palettes, only the ones you wish to modify.  E.g. if you would like to change some of the stroke colors, then you do not need to specify the `elementBackground` and `canvasBackground` values, only the `elementStroke`
- You can use this site to define colors for your palette: https://coolors.co/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226
- Colors may be any valid HTML color, including [color names](https://www.w3schools.com/colors/colors_names.asp).
- This is the [color palette](https://yeun.github.io/open-color/) used by Excalidraw (canvas: shade 0, element background: shade 6, stroke color: shade 9).
- Here's a [very large color palette example](https://github.com/zsviczian/obsidian-excalidraw-plugin/discussions/458)

Example: This is the default Excalidraw color palette. 
```json
"appState": {
  "theme": "light",
  "viewBackgroundColor": "white",
  "currentItemStrokeColor": "#5c940d",
  "currentItemBackgroundColor": "#fd7e14",
  "currentItemFillStyle": "solid",
  "currentItemStrokeWidth": 0.5,
  "currentItemStrokeStyle": "solid",
  "currentItemRoughness": 1,
  "currentItemOpacity": 100,
  "currentItemFontFamily": 2,
  "currentItemFontSize": 16,
  "currentItemTextAlign": "left",
  "currentItemStrokeSharpness": "sharp",
  "currentItemStartArrowhead": null,
  "currentItemEndArrowhead": "arrow",
  "currentItemLinearStrokeSharpness": "round",
  "gridSize": null,
  "colorPalette": {
    "elementStroke": [
      "#000000",
      "#343a40",
      "#495057",
      "#c92a2a",
      "#a61e4d",
      "#862e9c",
      "#5f3dc4",
      "#364fc7",
      "#1864ab",
      "#0b7285",
      "#087f5b",
      "#2b8a3e",
      "#5c940d",
      "#e67700",
      "#d9480f"
    ],
    "elementBackground": [
      "transparent",
      "#ced4da",
      "#868e96",
      "#fa5252",
      "#e64980",
      "#be4bdb",
      "#7950f2",
      "#4c6ef5",
      "#228be6",
      "#15aabf",
      "#12b886",
      "#40c057",
      "#82c91e",
      "#fab005",
      "#fd7e14"
    ],
    "canvasBackground": [
      "#ffffff",
      "#f8f9fa",
      "#f1f3f5",
      "#fff5f5",
      "#fff0f6",
      "#f8f0fc",
      "#f3f0ff",
      "#edf2ff",
      "#e7f5ff",
      "#e3fafc",
      "#e6fcf5",
      "#ebfbee",
      "#f4fce3",
      "#fff9db",
      "#fff4e6"
    ]
  }
}
```

# 1.6.7

Fixing [#420](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/420)

# 1.6.6

## New features:
- I added two features to resolve [#418](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/418) 
  - Below 100% zoom level, link icon size is adaptive. As the image size decreases, so will link icons. Above 100% the link Icon size is fixed.
  - I added a setting where you can change the opacity of the link icon
![image](https://user-images.githubusercontent.com/14358394/153295236-3e316029-50bf-4688-a540-7eb2534b5295.png)
- I added a button to finalize editing of a multi-point line element (notice the "check-mark" button appear in the bottom left as I start drawing the line). You can initiate a multi-point line with two fingers on a touchscreen and continue adding points until you finalize the line by pressing the "check-mark".

https://user-images.githubusercontent.com/14358394/153220106-fce2f65d-c8e3-4576-af5a-20b9038ac5b6.MOV

- Freedraw background fill [#4610](https://github.com/excalidraw/excalidraw/pull/4610)

https://user-images.githubusercontent.com/22396000/149664807-d2b3bc72-2853-4a4e-b3a2-46628c2dcd80.mp4


# 1.6.5

Same as 1.6.4... only the right package this time :)

# 1.6.4

## Minor fix:
- Fixed navigating to links on tablets. In view mode, the whole element acts as a link except for on phones.

# 1.6.3

## New Feature
- Added setting to disable autosave, or to set autosave to a less frequent schedule. This is based on some discussion on issue [#401](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/401)
- Allow any precision when zooming ([4730](https://github.com/excalidraw/excalidraw/pull/4730))
- Updated scripts: [Add Link to Existing File and Open](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Link%20to%20Existing%20File%20and%20Open.md) and [Add Link to New Page and Open](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Link%20to%20New%20Page%20and%20Open.md). The scripts will now group the link with the object. Also, the link circle object is now only 5% opaque.

# Fixed
- Links are clickable on mobile ([4704](https://github.com/excalidraw/excalidraw/issues/4704))
- Context menu is displayed correctly on Android ([4739](https://github.com/excalidraw/excalidraw/issues/4739))
- Excalidraw bak file caused an error when there was a conflict between versions on two devices
- Link click did not navigate to block when clicking a link with block reference
- 

# 1.6.2

used the wrong version of the Excalidraw package in 1.6.1 by mistake. This is now corrected.

# 1.6.1

Here's a demo of the new handwriting / linking features: https://youtu.be/_GfWailVKpc

# Fixes:
- Number of small QoL improvements to improve the pen experience 
  - iOS scribble now works with Excalidraw: [4705](https://github.com/excalidraw/excalidraw/pull/4705)
  - Slow freedraw lines now will have less jitter [4726](https://github.com/excalidraw/excalidraw/pull/4726)
  - Disabled three-finger pinch-zoom in pen mode as this was causing "jump" in some cases [4725](https://github.com/excalidraw/excalidraw/pull/4725)
  - Freedraw generates much fewer points, resulting in smoother, faster pen strokes [4727](https://github.com/excalidraw/excalidraw/pull/4727)

# New features:
- Option to enable hover preview in Excalidraw without needing to press CTRL/CMD
![image](https://user-images.githubusercontent.com/14358394/152696924-a0b6a9ba-0a2a-4780-ac25-ac392d93fc2a.png)

- ExcalidrawAutomate Script Engine `utils.inputPrompt` can now display multiple buttons (options)
```typescript
inputPrompt: (header: string, placeholder?: string, value?: string, buttons?: [{caption:string, action:Function}])
```
example:
```typescript
let fileType = "";
const filename = await utils.inputPrompt (
  "Filename for new document",
  "Placeholder",
  "DefaultFilename.md",
  [
    {
      caption: "Markdown",
      action: ()=>{fileType="md";return;}
		},
    {
      caption: "Excalidraw",
      action: ()=>{fileType="ex";return;}
    }
  ]
);
```

# 1.6.0

#New Feature
- Excalidraw-Native Hyperlink Support

[![Thumbnail](https://user-images.githubusercontent.com/14358394/152585752-7eb0371f-0bab-40f6-a194-3b48e5811735.jpg)](https://youtu.be/2Y8OhkGiTHg)


# 1.5.30

fixed [#409](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/409) Autoembed SVG missing .excalidraw from filename

# 1.5.29

New feature:
- #405: create The command palette action: create new drawing and embed to the current active file will now create a link following your Obsidian settings.
- #273: SVG export padding

Fixed: 
- deleting Excalidraw file from the view menu did not close the file

# 1.5.28

## Fix
- Image click incorrectly prompted for creating a new file
- Fix markdown drag and drop embed

# 1.5.27

## New Feature: 
- Added prompt to create a new file when clicking a link that points to a file that does not exist. This replaces the CTRL+ALT click. The prompt offers an option to create an Excalidraw file or a Markdown file.
![image](https://user-images.githubusercontent.com/14358394/152054517-f8c1fa96-6a9f-4f67-be84-d33615f091e9.png)
- Unbind text [#4686](https://github.com/excalidraw/excalidraw/pull/4686)

# Fix
- fix: typing _+ in wysiwyg not working [#4680](https://github.com/excalidraw/excalidraw/issues/4680)
- fix: keyboard-zooming in wysiwyg should zoom canvas [#4676](https://github.com/excalidraw/excalidraw/pull/4676)

# 1.5.26

## New Features:
- Published 5 new ExcalidrawAPI functions:
```typescript
  selectElements: (elements: readonly ExcalidrawElement[]) => void;
  sendBackward: (elements: readonly ExcalidrawElement[]) => void;
  bringForward: (elements: readonly ExcalidrawElement[]) => void;
  sendToBack: (elements: readonly ExcalidrawElement[]) => void;
  bringToFront: (elements: readonly ExcalidrawElement[]) => void;
```
you can access these via `ea.getExcalidrawAPI().`
- Added ExcalidrawAutomate function for moving elements in the zIndex in the view. To see an example of how the function is used, take a look at [Set background color of unclosed line object by adding a shadow clone](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md)
```typescript
moveViewElementToZIndex(elementId:number, newZIndex:number): void;
```
- I updated/improved two scripts:
  - [Set background color of unclosed line object by adding a shadow clone](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md)
  - [Convert freedraw to line](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Convert%20freedraw%20to%20line.md)

See the scripts in action:
[![thumbnail](https://user-images.githubusercontent.com/14358394/151705333-54e9ffd2-0bd7-4d02-b99e-0bd4e4708d4d.jpg)](https://youtu.be/qbPIAZguJeo)



# 1.5.25

Prevent pinch-zoom when pen lock is on and freedraw tool is selected.

# 1.5.24

## New Feature
- Disable pinch zoom when freedraw tool is active
- Added 3 new scripts: 
  - [Convert freedraw to line](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Convert%20freedraw%20to%20line.md)
  - [Select Elements of Type](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Select%20Elements%20of%Type.md)
  - [Set background color of unclosed line object by adding a shadow clone](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md)
 - New ExcalidrawAutomate functions:
```typescript
  selectElementsInView(elements: ExcalidrawElement[]): void; //sets selection in view
  generateElementId(): string; //returns an 8 character long random id
  cloneElement(element: ExcalidrawElement): ExcalidrawElement; //Returns a clone of the element with a new id
```

# 1.5.23

## New Features
## Pencil & Pen QoL improvements:
- Palm rejection: Introducing the pencil lock to prevent touch to interfere with your drawing with your Apple Pencil, or other stylus or pen. Click the freedraw tool and the lock will appear.
![image](https://user-images.githubusercontent.com/14358394/151600654-3efa28d8-0d20-431d-95ee-9e5547894e3e.png)
- Added a fourth, "extra thin", stroke width to the palette to help draw thinner lines with freedraw.
![image](https://user-images.githubusercontent.com/14358394/151600287-c60767b6-63c7-4e00-966a-33564b24345d.png)

## Others
- [#396](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/396) Excalidraw file backup. A backup is created when saving your drawing. If the main drawing file is corrupted due to the unexpected shutdown of Obsidian, Excalidraw will first attempt to restore the drawing from the backup.
- [#395](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/395) Field Suggestor borrowed from Breadcrumbs and Templater plugins. The Field Suggestor will show an autocomplete menu with all available Excalidraw field options when you type `excalidraw-` or `ea.`. Tooltips offer helpful background information for ExcalidrawAutomate functions. You can turn this feature off under Experimental Settings. 
![image](https://user-images.githubusercontent.com/14358394/151226864-af2a711c-9add-4526-ac97-ab239b21d8dc.png)


# 1.5.22

## New Features:
- Error message in case of script execution error
- [#392](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/392) Hide settings for deleted scripts

# Fixed
- [#388](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/388) `ExcalidrawAutomate.addArrow` now correctly handles startArrowHead and endArrowHead == null
- [#387](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/387) Rendering error in Obsidian document when excalidraw's alias contains spaces
- [#357](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/357) Transclusion has issues with code blocks
- Transclusions did not resolve immediately in Sticky Notes
- When zoomToFit on resize is enabled in settings, then in some cases excalidraw zooms to fit after text editing on iPad due to the on screen keyboard disappearing.


# 1.5.21

## New Features
- Since 1.5.15 ScriptEngine Scripts may have settings. These settings are stored as part of plugin settings. From now, these settings may be edited by the user via the Obsidian plugin settings window. 
  - See an example use of the feature [here](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/ExcalidrawScriptsEngine.md#add-box-around-selected-elements)
  - You can access settings for the active script using `ea.getScriptSettings()`, and store settings with `ea.setScriptSettings(settings:any)`
  - Rules for displaying script settings in plugin settings:
    - If the setting is a simple literal (boolean, number, string) these will be displayed as such in settings. The name of the setting will be the key for the value. 
    ```javascript
    ea.setScriptSettings({ 
      "value 1": true, 
      "value 2": 1,
      "value 3": "my string"
    })
    ```
    ![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/SimpleSettings.jpg)
    - If the setting is an object and follows the below structure then a description and a valueset may also be added for displaying plugin settings. Values may also be hidden using the `hidden` key.
    ```javascript
    ea.setScriptSettings({
       "value 1": {
        "value": true,
        "description": "This is the description for my boolean value"
      },
      "value 2": {
        "value": 1,
        "description": "This is the description for my numeric value"
      },
      "value 3": {
        "value": "my string",
        "description": "This is the description for my string value",
        "valueset": ["allowed 1","allowed 2","allowed 3"]
      },
      "value 4": {
        "value": "my value",
        "hidden": true
      }        
    });
    ```
    ![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/ComplexSettings.jpg)
- ScriptEngine suggester now includes optional hint and instructions
  `suggester: (displayItems: string[], items: any[], hint?: string, instructions?:Instruction[])`
  - Opens a suggester. Displays the displayItems and returns the corresponding item from items[].
  - You need to await the result of suggester.
  - If the user cancels (ESC), suggester will return `undefined`
  - Hint and instructions are optional.
  ```typescript
  interface Instruction {
    command: string;
    purpose: string;
  }
  ```


# 1.5.20

## Fixed
- [#376](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/376) : text alignment of stick notes in markdown embeds got lost. Not any more
- I changed the ScriptEngine suggester limit to 20. This will improve speed in the case of large datasets.
- Jumping text ([#4630](https://github.com/excalidraw/excalidraw/pull/4630))
- The popover context menu displays partially offscreen ([#4631](https://github.com/excalidraw/excalidraw/pull/4631))

# New 
- Updated Chinese translation (PR [#379](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/379), thank you @tswwe)
- [#350](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/350) Filename settings for embed drawings. Added new setting, toggle button: Name of the new inserted drawing starts with the name of the note.
![image](https://user-images.githubusercontent.com/14358394/150630777-b9a6cca8-84c9-407d-8e0b-07b232e89d85.png)
- [#373](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/373) New setting to specify if embedded drawing should be created in the Excalidraw folder or the attachments folder specified in Obsidian settings
![image](https://user-images.githubusercontent.com/14358394/150632874-a39526db-6782-4048-b289-a11d494c82f7.png)

- New ExcalidrawAutomate functions
```typescript
//Open a file in a new workspace leaf or reuse an existing adjacent leaf depending on Excalidraw Plugin Settings
openFileInNewOrAdjacentLeaf (file:TFile):WorkspaceLeaf;

//measure text size based on current style settings
measureText(text:string):{ width: number, height: number };

//returns true if plugin version is >= than required
verifyMinimumPluginVersion(requiredVersion: string):boolean; 
```



# 1.5.19

Fix: 
- Initial loading and switching of fonts resulted in text being resized and moved. Fixed.

# 1.5.18

Fix:
- Fourth Font did not appear correctly in SVG export, hover preview and `![[image embed.excalidraw]]`

# 1.5.17

## Fixed:
- [#365](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/365), [#351](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/351) Live Preview embeds did not work when the file path included a space character
- [#366](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/366) Hover preview of links work again in Excalidraw View Mode
- Excalidraw plugin alert when a new version is available now works

# New feature
- [#14](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/14), [#341](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/341), [#359](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/359)  Added an option for a fourth font to use with Text Elements. A big THANK YOU to @tswwe for contributing to the work via the for-obsidian Excalidraw package pull request [#55](https://github.com/zsviczian/excalidraw/pull/55))
[![fourtfont](https://user-images.githubusercontent.com/14358394/149659524-2a4e0a24-40c9-4e66-a6b1-c92f3b88ecd5.jpg)](https://youtu.be/eKFmrSQhFA4)


# 1.5.16

## Fixed
- Issues with saving settings
- Script Engine did not handle folder name errors well, causing it to crash and not restart. I added more thorough error-checking logic to the script engine
- [#4533](https://github.com/excalidraw/excalidraw/pull/4533) prefer spreadsheet data over the image

# New Feature
- #347: I added a parameter to ea.addElementsToView to specify whether new elements created with EA should be added at the back or the front of already existing elements in the View. Default is to add elements to the back.
```typescript
    async addElementsToView(
      repositionToCursor: boolean = false,
      save: boolean = true,
      newElementsOnTop: boolean = false
    ): Promise<boolean>
```

# 1.5.15

## New Feature
- [#344](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/344) Experimental immersive image embedding in Live Preview editing mode. Enabled by default. If it is causing errors, please let me know via issues. You can turn the feature off in settings (at the very bottom of the Excalidraw settings)
- Implemented automated notification when a new version of Excalidraw is available.
- Added ability to save settings to scripts. There is one new property and 2 new functions on ExcalidrawAutomate:
```typescript
  activeScript: string;
  getScriptSettings(): {};
  async setScriptSettings(settings:any):Promise<void>;
```
Excalidraw script engine will automatically set activeScript to the value representing the currently executing script. Settings are saved into excalidraw-obsidian data.json together with other Excalidraw plugin settings.


# 1.5.14

## Fixed
- Script Engine only looked at the basename of script-file when creating the command palette ID, as a result, if the same filename was present in multiple folders, only one of them (unpredictable which one) showed in the command palette.
- Deployed Excalidraw core product: fix: Reduce padding to 5px for bounded text [#4530](https://github.com/excalidraw/excalidraw/pull/4530)

# New Feature
- Implemented checking for available updates on GitHub for installed scripts

# 1.5.13

## New Feature

[![plugin store](https://user-images.githubusercontent.com/14358394/147889174-6c306d0d-2d29-46cc-a53f-3f0013cf14de.jpg)](https://youtu.be/lzYdOQ6z8F0)



# 1.5.12

Minor fixes:
- In certain cases when an image was permanently deleted from Obsidian and from Excalidraw automate, Excalidraw would not recognize the change until Obsidian was restarted.
- Container bound text elements (sticky notes), the TextElement will inherit the group bindings of the parent container.

# 1.5.11

Fix for [#327](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/327) 

# 1.5.10

Fixed:
- Excalidraw preview in live edit mode of a markdown document displayed transcluded files within the Excalidraw drawing as separate files. i.e. the image and then below the image the transcluded files. When the transcluded file did not exist, the markdown postprocessor threw an error. I added lots of additional comments to the markdownPostProcessor script and refactored/simplified the code slightly.
- Markdown embeds did not show when the embedded file is empty. Now Excalidraw will display a holding message until the document has content.


# 1.5.9

- Improved savePNG, saveSVG when embedded into markdown document.
- feat: Support updating text properties by clicking on container ([#4499](https://github.com/excalidraw/excalidraw/pull/4499))

# 1.5.8

- minor fix to ExcalidarwAutomate addText to handle non-container bound text wrapping correctly.

# 1.5.7

Fixed
- Command Palette and Excalidraw Script Engine dialogs will show correctly when Excalidraw is in full-screen mode
- ExcalidrawAutomate now includes containerBound text element in getViewSelectedElements() when container is selected
- ExcalidrawAutomate: markdown links do not get lost when drawing is in parsed mode, and elements are edited using copyViewElementsToEAforEditing() and then added back into the canvas.

New feature:
- #321: Aliases are added to the suggestion list when inserting wikilink using the command palette

# 1.5.6

New feature:
- #317: Added command palette action to delete image element and file (deletes images and markdown embeds. `Delete selected Image or Markdown file from Vault`
- Added `getViewFileForImageElement` to ExcalidrawAutomate

Fixed: 
- [#318](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/318) 
- [#282](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/282)

# 1.5.5

Fixed:
- [#312](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/312) special characters in section headers when used as block references. When these ( `.,$!?;[]^#*<>&@|\":`) special characters are used in section headers 
- `strokeStyle` setting now works in Excalidraw Automate
- Fixed link click for container bound text elements

# 1.5.4

New Feature:
- Sticky Notes. Wrap text to rectangles, diamonds, ellipses, and images.
[![sticky notes thumbnail](https://user-images.githubusercontent.com/14358394/147283367-e5689385-ea51-4983-81a3-04d810d39f62.jpg)](https://youtu.be/NOuddK6xrr8)

Fixed:
- [#304](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/304) Obsidian native on-drop is no longer broken when Excalidraw is installed
- Many minor fixes 

# 1.5.3

New Feature:
- Added multi-selection support to when editing line/arrow points (press enter/double-click on the line to edit). See this tweet for details: https://twitter.com/dluzar/status/1470389942262054920?s=20

# 1.5.2

Fixed:
- #299: Focus no longer lost when finishing TextElement editing
- CTRL+Enter now correctly submits TextElement


# 1.5.1

## Fixed
- removed targetView.save() from deleteViewElements() as that was causing issues when executing the script

# New Feature:
- Added suggester to Script Engine utils.
  - `suggester: (displayItems: string[], actualItems: string[])`
    - Opens a suggester. Displays the displayItems, but you map these the other values with actual Items. Returns the selected value.
    - You need to await the result of suggester.


# 1.5.0

## New Features
The key new feature is the ExcalidrawAutomate Script Engine. Click to watch the intro video:
[![Script Engine](https://user-images.githubusercontent.com/14358394/145684531-8d9c2992-59ac-4ebc-804a-4cce1777ded2.jpg)](https://youtu.be/hePJcObHIso)
Read more [here](https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html)

# Fixes
- Improvements to transclusions
- LaTeX copy/paste [#297](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/297) 
- Many minor fixes and code cleanup
 

# 1.4.19

New Features:
* updated Excalidraw package to include rounded diamond [#4369](https://github.com/excalidraw/excalidraw/pull/4369)
* Added new function to ExcalidrawAutomate
```typescript
getBoundingBox(elements:ExcalidrawElement[]): {topX:number,topY:number,width:number,height:number};
```


# 1.4.18

Fixed:
- [#292](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/292) 
- Error handling when the embedded image file is no longer available (link is broken). Excalidraw was not able to load the drawing. 

New feature:
- Excalidraw Automate if the existing element is manipulated using Excalidraw Automate and added back to the scene,  `addElementsToView` will handle this intelligently (i.e. update the existing element instead of adding a duplicate with the same id). Eg.: add a rectangle around the selected image. This script can be executed e.g. from QuickAdd.
```javascript
ea = ExcalidrawAutomate;
ea.reset();
ea.setView("active");
img = ea.getViewSelectedElement();
id = ea.addRect(img.x,img.y,img.width,img.height);
ea.elementsDict[img.id]=img;
ea.addToGroup([id,img.id]);
ea.addElementsToView(false);
```


# 1.4.17

## New Feature:
- You can now bind arrows to image elements

https://user-images.githubusercontent.com/14358394/144313632-d9279b1b-e7e5-4503-98ea-cbf4f1ec1742.mp4


# 1.4.16

## Fixed
- broken LaTeX [#287](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/287) 

# New feature
- [#286](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/286) : added footer div. Recommended styling:
```css
.excalidraw-md-host {
 padding: 0px 15px;
}

.excalidraw-md-footer {
  height: 5 px;
  display: block;
}

foreignObject {
 background-color: whitesmoke;
}

svg {
  border: 2px solid;
  transform: scale(0.985);
  color: skyblue;
}
```
![image](https://user-images.githubusercontent.com/14358394/144110220-e3dbd9f5-10e1-4726-af06-e0d1ed9c25cb.png)


# 1.4.15

## Fixes
- Stencil library no longer crashes obsidian mobile
- [#286](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/286) : settings font color works as expected
- [#284](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/284) : fixed broken Ozan's image embed support
- Fixed issue with Experimental file type display crashing Obsidian mobile in certain situations.

# New in ExcalidrawAutomate
- Added support functions:
```typescript
  getEmbeddedFilesLoader(isDark?:boolean):EmbeddedFilesLoader;
  getExportSettings(withBackground:boolean,withTheme:boolean):ExportSettings;
```

# 1.4.14

## New Feature:
- Improved styling of Markdown Embeds
[![markdownAdvanced](https://user-images.githubusercontent.com/14358394/143783717-fd55a5f3-8197-4f1d-a34e-95590a224b67.jpg)](https://youtu.be/K6qZkTz8GHs)

# Fixed:
- Theme sync with Excalidraw had a minor glitch, it detected theme change when dragging from the file explorer. It is now fixed.
 

# 1.4.13

## New Feature
- Added Markdown embed support using images. See video for details:  https://youtu.be/tsecSfnTMow
- Added caching for images that need to be inverted when changing between light and dark mode


# 1.4.12

Minor fix:
- Export Lib with Command Palette
- Preview without the theme

# 1.4.11

1.4.11 comes with a number of QoL improvements!

# Fixed
- #230: embedded images no longer show inverted colors. The solution was tested and works on Windows and on Android. Sadly it does not resolve inversion in dark mode on iOS. I haven't tested it on Mac. Seems that the root cause is the lack of context filtering support on Safari (see [#4301](https://github.com/excalidraw/excalidraw/issues/4301) for further details)

# New features
- This version includes the recently released new Excalidraw library component. Now you can publish to the Excalidraw public stencil library directly from Obsidian. See for more details: https://twitter.com/aakansha1216/status/1461045987678453760?s=20

## New in settings
![image](https://user-images.githubusercontent.com/14358394/142769465-6e2543cf-615d-47e7-baf0-88f8d05a8c91.png)
- #122: Setting to enable Excalidraw to follow Obsidian's theme. When the theme changes, open Excalidraw views will automatically update to light or dark mode.
- [#262](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/262), [#43](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/43), #198: You can now select a default mode for opening drawings (e.g. to open in view mode or zen mode by default).  The feature also includes a new front-matter key with the following recognized values:
```
excalidraw-default-mode: normal
excalidraw-default-mode: view
excalidraw-default-mode: zen
```

![image](https://user-images.githubusercontent.com/14358394/142766595-d3763e58-5776-4e41-976d-9cec1a50bdb3.png)
- [#251](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/251), [#122](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/122) : Excalidraw preview to match Obsidian Theme. If enabled, when Obsidian is in dark mode, Excalidraw images will render in dark mode. When Obsidian is in light mode, Excalidraw will render in light mode as well. You may try switching 'Export image with background' off for a more Obsidian-integrated look and feel.


# 1.4.10

## Fixed
- [#252](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/252) 
- Fixed highlights not showing in preview

# 1.4.9

Excalidraw will run a housekeeping process to patch drawings to support WYSIWYG transclusion 7 minutes after installing the update. 7 minutes is allowed for sync to complete before running the patch.

# New Features
- A bridging solution to support Obsidian 0.13.2 WYSIWYG until markdownPostProcessor is implemented natively. This only works for Excalidraw.md files. Sadly I can't offer a solution for legacy .excalidraw files.

# Improved Features
- Handling of recursively embedded images work, also catching infinite loops
- Reintroduced the option to choose between SVG or PNG for preview
- Removed SVG snapshot. This will generate much smaller files

# 1.4.8-beta-2

You need to turn on autoexport to SVG or PNG for image previews to work in Obsidian 0.13.2... even then only files that you have touched after this modification will show a preview in edit mode.

In this version, I completely reworked how images are loaded when you recursively embed drawing into drawing into drawing. Files no longer include the SVGSnapshot. It was causing more problems than benefits.

I'll be releasing this version after a couple of days of daily use / testing.

If you use dark mode, I recommend these settings:
![image](https://user-images.githubusercontent.com/14358394/141700718-5ceaf816-e5ee-46d9-a2d0-e4a7f618bd15.png)
![image](https://user-images.githubusercontent.com/14358394/141700696-1aeb7f90-a9db-40c7-bb4f-a55f63cb546a.png)
![image](https://user-images.githubusercontent.com/14358394/141700711-b349f2d4-5f18-4999-99fb-e0e0098e3ac0.png)


# 1.4.8-beta

This is an early beta experiment to see how I could display Excalidraw images in the new 0.13.0 WYSIWYG editor. The solution is incomplete. While I don't think this will do any damage to existing drawings, I advise some caution. Best to install this version of excalidraw in a test vault for now.

Note: if you are referencing text elements in other documents using the block references in the .md file, those block references will not work with this update. I am working on a solution.

![image](https://user-images.githubusercontent.com/14358394/141197594-60e527a8-0de9-4bb5-b562-b425fe56c03d.png)
![image](https://user-images.githubusercontent.com/14358394/141197957-a301b375-893a-4d8d-81f2-0ece7da0ed49.png)



# 1.4.7

## Fixed
- Improved logic for embedding an Excalidraw drawing into another Excalidraw drawing. Partly solving [#230](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/230) 

# 1.4.6

I messed up the 1.4.5 release. This is a re-release.
MathJax performance improvement. Now using native tex2svg. I kept image2html as a fallback solution.

# 1.4.5

MathJax performance improvement. Now using native tex2svg. I kept image2html as a fallback solution.

# 1.4.4

## New Feature
- I added a very rudimentary solution to support copy/paste of images and equations between drawings. Normally images and equations are stored as images, and when you paste them to another drawing, a new copy of the image would be created. Even worst, the pasted version of the equation will no longer link to a formula but will become a pasted PNG image file. The solution I implemented now, keeps track of all the images and equations that were open in Excalidraw during your current Obsidian session. When you paste an image or equation, the plugin will check for the fileId within your current session, and if a match is found, it will paste the formula or the image location, instead of the bitmap. I could at a later time index the whole vault for formulas and embedded images, but that feels very resource-intensive. I believe the current solution will be fit for purpose, discounting some edge cases of copying between vaults. Note that even though Excalidraw.com does not support LaTeX, if you copy/paste an equation from Obsidian to Excalidraw.com and then copy/paste it back to Obsidian (while within the same Obsidian session), the equation will convert back from a bitmap into an equation.

# 1.4.3

v1.4.3 requires Obsdiain v0.12.16 because of MathJax support.

# New Feature
- [#214](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/214) LaTex Support. See [intro video on YouTube](https://youtu.be/r08wk-58DPk)
- Added a hint around canvas panning when a selection tool is active, but nothing is selected ([#4159](https://github.com/excalidraw/excalidraw/pull/4159)).

# Fixed
- [#223](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/223) Nested drawing gets squashed on refresh.
- [#211](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/211) Image link in Excalidraw not updating when changing the name of the image
- [#224](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/224) Include Excalidraw drawings in insert image command palette action

![LaTex Demo](https://user-images.githubusercontent.com/14358394/139676900-e3782073-9264-4730-a049-2bbc0dab8ee3.png)



# 1.4.2

## New Features:
- Using iframely to resolve url titles when a URL is dropped onto a drawing. You can turn this feature off in settings.
- Includes the new arrow type from Excalidraw.com
- New command palette option to add an image from the vault

# Fix
- Markdown view performance was dreadful in case a large image was added to the drawing (and there were only very few elements in the drawing). This was because the svg snapshot includes a blob copy of the image, and markdown view struggled with lines of 1-2MB in size. I now cut the blob with \n after 4kb. For portability, the \n characters need to be removed before reusing the SVG.

# 1.4.1

Fixed [Jumping Text](https://github.com/excalidraw/excalidraw/issues/4098)

# 1.4.0

## New features
- Image Elements
- Added setting to set the maximum zoom level
- Added setting to apply Obsidian theme (dark/light) to existing drawings

# Fixed
- CMD + Click to open links and drawings on now works as expected. Previously you had to hold CTRL+CMD+CLICK. This is fixed.

# 1.4.0.prerelease.2

This is a pre-release. While I have made every effort to make this stable, there can be still glitches. Please ensure you have a backup of your files before installing this in your vault. Please use GitHub issues to raise any bugs or questions. Thank you!

You can find a short video introducing the new features [here](https://youtu.be/_c_0zpBJ4Xc).

![Excalidraw image support](https://user-images.githubusercontent.com/14358394/138568300-a6c8b385-99f3-40fa-9e68-5083756aa2bd.png)

# To Install:
- Exit Obsidian. 
- Copy the 3 files `main.js`, `manifest.json`, `styles.css` to the `vault/.obsidian/plugins/obsidian-excalidraw-plugin/` folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

# 1.4.0.prerelease.1

Please use [Excalidraw 1.4.0 prelease 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.4.0.prerelease.2) instead of this release.

-----

This is a pre-release. While I have made every effort to make this stable, there can be still glitches. Please ensure you have a backup of your files before installing this in your vault. Please use GitHub issues to raise any bugs or questions. Thank you!

You can find a short video introducing the new features [here](https://youtu.be/_c_0zpBJ4Xc).

![Excalidraw image support](https://user-images.githubusercontent.com/14358394/138568300-a6c8b385-99f3-40fa-9e68-5083756aa2bd.png)

# To Install:
- Exit Obsidian. 
- Copy the 3 files `main.js`, `manifest.json`, `styles.css` to the `vault/.obsidian/plugins/obsidian-excalidraw-plugin/` folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)



# 1.3.20

## Fixed:
- Performance of the Markdown view when working with large drawings was significantly improved. The plugin now exports formatted Excalidraw JSON which works better with  CodeMirror in Obsidian, but due to the change, the files opened with the new version of the plugin won't open with an older version of the plugin anymore.

# 1.3.19

## Fix:
- [#188](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/188) ALT+CTRL click on a link to create document was broken. 
- Since open in adjacent pane feature (1.3.17), Shift+CTRL click threw an error if there was only a single pane open in the workspace.

# New features:
- Excalidraw component includes the latest fixes including [fix: freehand points](https://github.com/excalidraw/excalidraw/pull/4031) which should further improve the iPad freehand experience.
- [#187](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187) Links may include a linebreak to fit smaller spaces, they will still work
- [#182](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182) Excalidraw is more forgiving about the formatting of the `# Drawing` section
- [#189](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/189) added setting to adjust default theme of drawing (dark/light) with Obsidian theme. Only works in case there is no template set. Also, an existing drawing will be opened in the theme it was saved.
![image](https://user-images.githubusercontent.com/14358394/137008830-705c5050-0a89-4aa6-91b5-a0c3f9ee0104.png)


# 1.3.18

Updated Excalidraw component to the latest version. This includes a few minor enhancements.

# Fixed:
- in special situations link hover caused an error. Not any more.
- Link hover on drawings did not work correctly with rotated text elements. This is not corrected. Also if multiple text elements are available at the location of the pointer, Excalidraw will now select one that has a link.

# 1.3.17

## New Features: 
- [#156](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/156) Implemented Open in Adjacent pane
Activate in settings
![image](https://user-images.githubusercontent.com/14358394/135911634-ff98207f-839c-4b94-af19-b5eaab60298f.png)
- [#172](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/172) Now adding a new line after ``` and before %%

# Fixed
- [#166](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/166) Corrected typo in migration prompt CSS style
- [#142](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/142) Fixed processing of `# Text Elements` in markdown. In case for some reason Excalidraw block references got inserted before the `# Text Elements` section, the processing of the markdown led to unexpected app behavior.


# 1.3.17-beta-2

INSTALL THIS WITH CAUTION. THE FILE FORMAT WILL CHANGE. I SUGGEST YOU DO NOT USE IT IN YOUR MAIN VAULT.

This is a demo release. While I have played with this version for a good half-day, and haven't noticed any significant issues, please keep in mind, that I have built this demo version of Excalidraw-Obsidian using the unfinished/development version of the Excalidraw Image Element source code (https://github.com/excalidraw/excalidraw/pull/4011). Please make sure you back up your vault before installing this. However unlikely, it may also happen, that the file format of the final version changes, in which case you may lose some (or all) of your drawings edited with this version of Excalidraw.

## YouTube demo:
[![image element](https://user-images.githubusercontent.com/14358394/135725161-a80c145e-ee31-4806-8357-3f23929103ca.jpg)](https://youtu.be/LFxQwGcnlYQ)

## To Install:
- Exit Obsidian. 
- Copy the 3 files `main.js`, `manifest.json`, `styles.css` to the `vault/.obsidian/plugins/obsidian-excalidraw-plugin/` folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)


# 1.3.17-beta-1

Please use [Image Element Preview 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/ImageElement-preview-2).

INSTALL THIS WITH CAUTION. THE FILE FORMAT WILL CHANGE. I SUGGEST YOU DO NOT USE IT IN YOUR MAIN VAULT.

This is a demo release. While I have played with this version for a good half-day, and haven't noticed any significant issues, please keep in mind, that I have built this demo version of Excalidraw-Obsidian using the unfinished/development version of the Excalidraw Image Element source code (https://github.com/excalidraw/excalidraw/pull/4011). Please make sure you back up your vault before installing this. However unlikely, it may also happen, that the file format of the final version changes, in which case you may lose some (or all) of your drawings edited with this version of Excalidraw.

## YouTube demo:
[![image element](https://user-images.githubusercontent.com/14358394/135725161-a80c145e-ee31-4806-8357-3f23929103ca.jpg)](https://youtu.be/LFxQwGcnlYQ)

## To Install:
- Exit Obsidian. 
- Copy the 3 files `main.js`, `manifest.json`, `styles.css` to the `vault/.obsidian/plugins/obsidian-excalidraw-plugin/` folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)


# 1.3.16

## Fixed
- [#155](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/155) conversion of files imported from Excalidraw.com was broken.

# New Features
- first implementation of [#157](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/157) (use setting to define the maximum number of characters to transclude from the document)
- Implemented option to zoom to fit drawing to window size when Obsidian window or Excalidraw view pane is resized (#159)
- Implemented MVP version of onDropHook [#152](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/152) See [documentation](https://zsviczian.github.io/obsidian-excalidraw-plugin/API/utility.html#ondrophook) for more details.

# 1.3.15

## Fixed 
- Text element link copy now works with legacy files as well. No longer a need for the workaround described in 1.3.14. 
- Resolved issue with loading legacy .excalidraw files

# 1.3.14

## New Feature
- Now you can copy a text element that has a link, and it will retain the link. This resolves issue [#114](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/114). Note that this feature only works with text created in 1.3.14. As a workaround for old drawings, simply double-click to edit "old" text before copying. New drawings will simply have this feature. I hope this "hassle" of double-clicking will fade over time, as more of your drawings are created/edited the newer version. 

[demo video](https://user-images.githubusercontent.com/14358394/135168130-a999d79a-637d-4cd3-8419-7c4a9e6d6b02.mp4)


# Workaround for issue [#150](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/150)
- There is an issue with the placing of text elements when editing in a high zoom in ratio. For now, I maximize the auto-zoom to 200%

# 1.3.13

## New Excalidraw Automate Functions
## getViewElements()
```typescript
getViewElements():ExcalidrawElement[] 
```

Returns all the elements from the view.

## deleteViewElements()
```typescript
deleteViewElements(elToDelete: ExcalidrawElement[]):boolean 
```

Deletes those elements from the view that match the elements provided as the input parameter.

Example to delete the selected elements from the view:
```typescript
ea = ExcalidrawAutomate;
ea.setView("active");
el = ea.getViewSelectedElements();
ea.deleteViewElements();
```

# 1.3.12

## Fixed:
- This update will patch existing Excalidraw files in your vault to correct formatting issues. The script will run in the background a few minutes after you've started obsidian. It will amend the malformed (yet working) Excalidraw .md files. Amongst others, this will improve the performance of hover previews of Excalidraw files.
- There were cases when settings did not save your changes consistently. Should be fixed.
- There was a race condition auto-generating SVG and PNG files. This led to files sometimes not being updated. 
- If the very first text element added to a drawing was a link, Excalidraw did not processes it well. 
- #111: Excalidraw now correctly treats Windows (CRLF), Linux (LF), and Mac (CR) line endings
- New drawings had comments (`%%`) misplaced, impacting tasks and links in text elements. Fixed.
- In some cases, the drawing stayed open in the view after deletion.
- open-drawing, insert-drawing, and insert-link dialogs were slow on large vaults. Speed is now improved. Tooltip was added each time the dialog was opened, leading to a long trail of tooltips after many uses.
- When opening a corrupted excalidraw file, the plugin will display an error message and open the file in markdown view. In the past, the file was sometimes overwritten with the previous active drawing.

# New feature:
- [#149](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/149) You can specify in settings if you want to embed PNG, SVG or Excalidraw files into documents.
![image](https://user-images.githubusercontent.com/14358394/134781370-3edcfc6b-11ab-4746-83b0-255cca7863c6.png)


# 1.3.11

## Fixes
- [#147](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/147) 
- [#148](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/148) 
- Export to SVG failed in rare cases. Changed conversion from outerHTML to XMLSerializer 

# 1.3.10

I deployed the improved Excalidraw freehand draw to Obsidian. This update improves palm rejection, provides better ink flow and pressure sensitivity. It ups the freehand drawing experience if you are using an Apple pencil or SPen, or some other stylus.

https://twitter.com/excalidraw/status/1439263621981384706?s=20

# 1.3.9

## Fixed
- minor bug-fix: when you CTRL+clicked a tag in the drawing, it threw an error if the drawing was not full screen. 

# New Feature 
- ExcalidrawAutomate create function
  - now returns the filepath of the created file
  - properly processes the frontmatter of the template file (fixed)
  - you can now specify frontmatter to be used as a parameter
```typescript
    create (
      params?: {
        filename?: string, 
        foldername?:string, 
        templatePath?:string, 
        onNewPane?: boolean,
        frontmatterKeys?:{
          "excalidraw-plugin"?: "raw"|"parsed",
          "excalidraw-link-prefix"?: string,
          "excalidraw-link-brackets"?: boolean,
          "excalidraw-url-prefix"?: string
        }
      }
    ):Promise<string>;
```


# 1.3.8

## New Features
- Navigating to block references (e.g. `![[document#^ref]]`) from the drawing will open the document at the position of the block reference.
- Extended ExcalidrawAutomate:
  - Improved calculation of line and arrow bounds.
  - New function: `addBlob(topX:number, topY:number, width:number, height:number):string;` will draw a blob which you can later alter by modifying the points of the blob
  - Extended function: with `wrapAt`, and different `box` type. If box is added, text will be centered in the box, also the text will be the top layer, thus if you add background color to the box, it will be behind the text.
  - Removed `verticalAlign` as it had no effect
```typescript
addText (
  topX:number, 
  topY:number, 
  text:string, 
  formatting?: {
    wrapAt?:number,
    width?:number, 
    height?:number,
    textAlign?: string, 
    box?: boolean|"box"|"blob"|"ellipse"|"diamond",
    boxPadding?: number
  },
  id?:string
):string;
```

# 1.3.7

## Fixed
- better support images in the kanban plugin [details are here](https://github.com/zsviczian/obsidian-excalidraw-plugin/discussions/141)
- drag&drop files in Obsidian was broken

# 1.3.6

## New Features

- Now supports drag & drop of plain text, including support for [Obsidian Drag & Drops Plugin](https://github.com/GitMurf/obsidian-drag-and-drop-blocks)

# Fixed

- Text sizing of dropped elements fixed.
- Text wrapping no longer leaves a trailing newline character


# 1.3.5

## New features:
- added a check at plugin startup to validate Electron version. Excalidraw will display a message if Electron version is "8." as I had multiple cases when users complained that Excalidraw does not work for them, and it turned out they were using an old version of Electron (Obsidian installer).
- Added forceViewMode option to ExcalidrawAutomate.viewToggleFullScreen()

# 1.3.4

## New Feature
Added a new function to ExcalidrawAutomate: `ExcalidrawAutomate.viewToggleFullScreen()` will change target view between normal and fullscreen mode. Only supports Obsidian desktop. The function will do nothing on mobile.
```javascript
ea = ExcalidrawAutomate;
ea.setView("first");
ea.viewToggleFullScreen();
```


# 1.3.3

## New Feature
- force wrapping of transcluded text for CJK as requested [#136](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/136) . See settings `Lins & transclusion/Overflow wrap behavior of transcluded text`
- new API function: `ExcalidrawAutomate.getViewSelectedElements():ExcalidrawElement[]`

![image](https://user-images.githubusercontent.com/14358394/132140020-2329fae7-61d6-4855-ba51-c0fac4107a9d.png)


# 1.3.2

## Fixed
- ExcalidrawAutomate.create() was broken. Now it works again.

# 1.3.1

## New Features 
[Demo video](https://user-images.githubusercontent.com/14358394/132108632-c2ad7501-326a-42b1-bb8e-0b8f73f36235.mp4)
- Drag&Drop support to create links from files in the file manager
- Improved zoomToFit, will fit fullscreen, (almost) regardless of image size
 
# Fix
- The full package is in one file. No chunks get loaded from the web.



# 1.3.0

## New Features
I have extended ExcalidrawAutomate with functions that allow a script to directly add elements to an active Excalidraw View. This paves the way to feature-rich Excalidraw macros, such as adding activities to a flowchart.

[Click here to view animation](https://user-images.githubusercontent.com/14358394/131967188-2a488e38-f742-49d9-ae98-33238a8d4712.mp4)

These are the new functions:
```typescript
getElements():ExcalidrawElement[];
getElement(id:string):ExcalidrawElement;
//View Manipulation
targetView: ExcalidrawView;
setView(view:ExcalidrawView|"first"|"active"):ExcalidrawView;
getExcalidrawAPI():any;
getViewSelectedElement():ExcalidrawElement;
connectObjectWithViewSelectedElement(
  objectA:string,
  connectionA: ConnectionPoint, 
  connectionB: ConnectionPoint, 
  formatting?: { 
    numberOfPoints?: number,
    startArrowHead?:string,
    endArrowHead?:string, 
    padding?: number
}):boolean;
addElementsToView(repositionToCursor:boolean, save:boolean):Promise<boolean>;
```

You can find further details about the API functions here: https://zsviczian.github.io/obsidian-excalidraw-plugin/#api-documentation


# 1.2.24

## Fixed
- [#133](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/133) gridSize is not picked up from Template
- also added ExcalidrawAutomate.canvas.gridSize parameter to the automation interface.
- Template now does not need to include the .md file extension

# 1.2.23

## Fixed
- Error when leaving fullscreen, if two Excalidraw drawings were open side by side
- Error when text element is not yet present in the underlying markdown document and a link-hover event is triggered
- Name of the command palette action to switch between RAW and PREVIEW mode, changed from LOCK/UNLOCK to RAW/PREVIEW.

# New
- Published `wrapText(text:string, lineLen:number):string` via ExcalidrawAutomate.

# 1.2.22

## Fixed:
- Transclusion of blocks did not work as expected when the block was a bullet point.

# Improved:
- When hovering a block reference, the block text will appear in the hover preview, not the entire document

# 1.2.21

## Fixed
- Blockquote transclusion

![image](https://user-images.githubusercontent.com/14358394/131221940-0cf6486b-2a47-4549-8feb-8b9209e7b394.png)


# 1.2.20

## New Feature
- Implemented basic word wrapping for embedded text. This partially resolves: [#118](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/118) 
  Include max line length after transclusion in curly brackets: `![[File#^blockref]]{40}`
  This example will wrap text to achieve max 40 characters per line.

# 1.2.19

## New Feature
- improved block embedding. Now supports 
  - multiline blocks 
  ```markdown
  line 1
  line 2
  line 3 
  ^blockref
  ```
- and heading references e.g. `![[file#section]]`

# 1.2.18

## Fixed:
- Exit full-screen mode not working on the second screen (screen without taskbar - windows 10).

# 1.2.17

## Fix:
- [#130](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/130) Markdown loses focus in side by side mode

# Changed feature:
- [#121](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/121) and [#129](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/129) 
Command Palette `Create a new drawing - IN A NEW PANE - and embed into active document` and `Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed into active document` will use the Vault's `Default location for new attachments` setting + the filename of the active file + "_" + Excalidraw's filename date setting for the filename of the new drawing.
- Excalidraw will now process `![[drawing.md|100%|css-class]]` correctly. The width of the drawing in the resulting HTML will correctly show 100%. This feature is useful when including Excalidraw images into presentations with the Slides core plugin.

# 1.2.16

## Fixes
- On rare occasions, when [closing Obsidian](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/caee4f7500ba375e181e67f97e0682369a5e770a/src/main.ts#L896) with an Excalidraw file open, syncing the drawing with the underlying markdown before saving was in a race condition that resulted in an invalid JSON. I moved [this code](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/6d285466773e40e6dafd98f5e5715b39c0aab209/src/ExcalidrawView.ts#L167) into an [await block](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/caee4f7500ba375e181e67f97e0682369a5e770a/src/ExcalidrawView.ts#L159)
- Changed fullscreen mode, to be even more fullscreen
- Hover preview did not show in fullscreen mode, I added an [ugly workaround](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/caee4f7500ba375e181e67f97e0682369a5e770a/src/ExcalidrawView.ts#L765), for now, to reattach the popover to the contentEl, because in fullscreen mode only the contentEl is visible, other DIVs are hidden.
- Changed how image updates happen after settings changes. Moved reloadRequests and embedUpdates to settings.hide().

# New feature
- Added setting to have a different prefix for URL links.
- Added a new frontmatter switch for document-specific URL prefix. 
```
---

excalidraw-plugin: parsed/raw
excalidraw-link-prefix: "📍"
excalidraw-url-prefix: "🌐"
excalidraw-link-brackets: false/true

---
```

# 1.2.15

## New Feature
- Implemented link hover preview inside Excalidraw: [#127](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/127)
![image](https://user-images.githubusercontent.com/14358394/130334656-312dc178-4bd3-4fb3-8441-e2cebca5a10e.png)


# 1.2.14

## New feature
Added feature to select if SVG or PNG images are rendered in Markdown Preview. PNG images will be scaled depending on the embed size, to avoid image quality issues with PNG. The new feature is linked to [Excalidraw issue #3910](https://github.com/excalidraw/excalidraw/issues/3910).

# Fixes
In the case of complex drawings, the hover preview was displayed extremely slowly. On less powerful PCs Obsidian appeared to freeze for minutes. The root cause of the issue was found to be the markdown preview of extremely large code blocks (of over several hundreds of KBs). The drawing section of Excalidraw markdown files is now placed within markdown comments `%%` blocking preview from picking up these code blocks. The fix does not include automatic patching of all existing drawings. Drawings will get migrated to the new commented format as they are opened and edited. Migrated drawings will display quickly in hover preview.

# 1.2.13

## New Feature
- Support link navigation in Exclidraw View Mode
- Preserve Zen Mode / View Mode when loading a new drawing into the view

# Update
- Chinese translation

# Fixes
- Fixed "exit zen mode" button style on the iPad

# 1.2.12

Excalidraw Chinese (zh-cn) translation.  Thank you @Quorafind
![image](https://user-images.githubusercontent.com/14358394/128065501-ac8b0255-3fc1-4bbe-b194-7ee963d01952.png)


# 1.2.11

## New feature
- Insert link now produces a link in preview mode or raw mode as appropriate based on TextMode of the drawing.


# 1.2.10

## New Features
- using latest Excalidraw build, now includes mobile UNDO/REDO buttons
- [#100](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/100) Implemented WYSIWYG for text elements. 
  - Drawings no longer need to be changed from locked to unlocked mode. When an element is edited the underlying Markdown is displayed for editing.
  - Changed LOCK/UNLOCK to RAW/PREVIEW mode. In raw mode, markdown is displayed always.
- [#107](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/107) Added PNG export scale setting. The setting applies to auto-export as well as to embeds and on-demand exports.
- [#95](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/95) Added support for `#tags`. Clicking a TAG will open up the search.
- [#109](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/109) Added button to toggle Excalidraw full-screen mode

# Fixes
- Auto export was not working. Fixed.
- When the same drawing was open on two devices, with Obsidian Sync active, if the drawing was edited on device 1, device 2 triggered an autosave sometimes overwriting the changes on the first device. Fixed.
- [#101](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/101) pointer precision degraded over time. Fixed by deploying the latest Excalidraw build.
- [#97](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/97) workaround implemented for exporting stencil library and drawings in Excalidraw format on mobile. Don't have a solution for ChromeOS yet.

# 1.2.9

Corrected bug with saving Excalidraw settings

# 1.2.8

## Fixes:
- If sync merges two versions of a file such that the files are concatenated Excalidraw won't choke on it
- Added additional controls to ensure autosave does not accidentally save 

# 1.2.7

## Minor improvements
- Added the following text right below the frontmatter to the default drawing template 
  ==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==
- Tweaked autosave

# 1.2.6

## Fixed
- Zoom to fit when opening a new drawing
- Autosave now works without glitching - I've taken the setting to disable autosave out.
- solved #90: delete did not close the open excalidraw view

# 1.2.5

Keep in sync features improved for migration and for legacy file support

# 1.2.4

## FIX:
- Slightly improved lock/unlock on mobiles. Still an issue with Android though. 

# NEW Feature:
- Improved synchronization of stencil library if you are using Obsidian Sync.
- Added Command Palette Action to Export Stencil Library

# 1.2.3

Solves an issue with undo. Switching drawings it was possible to overwrite the next drawing with the content of the previous drawing using CTRL+Z. The operation could not be undone. 


# 1.2.2

Updated Excalidraw component to v0.9
Improved Text Lock/Unlock 
Fixed remaining issue putting JSON into codeblocks
Fixed an SVG display issue... though the root cause is yet unclear (apart from the fact that Excalidraw 0.9 brought with it a breaking change impacting SVG export).

# 1.2.1

Moved Drawing JSON into codeblock to avoid it showing up in search results.
Corrected hover image observer which transcluded image into postprocessor process by accident.

# 1.2.0

This is a major update. See updated readme and release notes for 1.2.0 alpha, beta, and release candidate releases for details.

[Complete Excalidraw 1.2.0 Walkthrough](https://www.youtube.com/watch?v=sY4FoflGaiM&list=PL6mqgtMZ4NP2jb4K3q2xqlaZowKntGu7k)

# 1.2.0-rc-1

- Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-1) for detailed release notes and instructions before installing this version.
- Then read [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2) release notes.
- You don't need to read release notes for 1.2.0 Alpha 3.
- Then read [Excalidraw 1.2.0 Alpha 4](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-4) release notes

Then install this.

# New features and fixes
- Experimental feature (see settings to enable) to display custom tag for Excalidraw files.
- More reliable hover preview for files
- Compatibility with legacy excalidraw files now includes an option to create legacy files when creating new files, and hover preview for legacy files.

# 1.2.0-beta-2

This is not the most recent version: Install [Excalidraw 1.2.0 Release Candidate 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-rc-1)

- Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-1) for detailed release notes and instructions before installing this version.
- Then read [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2) release notes.
- You don't need to read release notes for 1.2.0 Alpha 3.
- Then read [Excalidraw 1.2.0 Alpha 4](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-4) release notes

# New features and fixes
- fixed font face, not all characters displayed correctly, now they do
- I implemented compatibility mode. *.excalidraw files continue to work with the plugin, albeit with more limited functionality.

# 1.2.0-beta-1

This is not the most recent version: Install [Excalidraw 1.2.0 Release Candidate 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-rc-1)

- Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-1) for detailed release notes and instructions before installing this version.
- Then read [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2) release notes.
- You don't need to read release notes for 1.2.0 Alpha 3.
- Then read [Excalidraw 1.2.0 Alpha 4](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-4) release notes

# New features and fixes:
- fixed embedded image markdown preview rendering when the image appears in a bullet point
- Further Logseq coop compatibility: Added file explorer command to individually convert *.excalidraw files to *.md files and retain the original file.
- fixed file explorer conversion command showing up for all files, not just .excalidraw files.

# 1.2.0-alpha-4

This is not the most recent version: Install [Excalidraw 1.2.0 Release Candidate 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-rc-1)

Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-1) for detailed release notes and instructions before installing this version.
Then read [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2) release notes.
You don't need to read release notes for 1.2.0 Alpha 3.

# New features and fixes
- Conversion window at first 3 startups after upgrade
- Added file explorer right-click menu item to convert files manually
- Added compatibility features to settings
  - Auto-export to *.excalidraw file every time you save the drawing
  - updated the Obsidian .md Excalidraw file if the modified date of the *.excalidraw file is more recent than the .md files
- Fixed synchronization between Markdown and Excalidraw when the same drawing was open in parallel panes and the user modified text elements in markdown.


# 1.2.0-alpha-3

This is not the most recent version: Install [Excalidraw 1.2.0 Release Candidate 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-rc-1)

Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-1) for detailed release notes and instructions before installing this version.

Then read [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2) release notes.

----
This version includes many minor fixes that make the plugin work smoother. The version does not include further new features.

# 1.2.0-alpha-2

Please read [Excalidraw 1.2.0 Alpha 1](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases) for detailed release notes and instructions before installing this version.

I've released a newer version since. Please read the below notes, then move on to [Excalidraw 1.2.0 Alpha 4](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-4).

# bug fixes and new features
- delete .png and .svg when "keep in sync" is on, now works
- `*.excalidraw` export now generates a correct file, which will load on [excalidraw.com](https://excalidraw.com)
- added to optional frontmatter switches to customize link prefix and brackets per drawing
  - `excalidraw-link-prefix: "👉 "`
  - `excalidraw-link-brackets: true/false`
- changed default filename to `*.excalidraw.md` while excalidraw will work with any `*.md` files that has the `excalidraw-plugin` frontmatter key, keeping the file naming convention will ensure Ozan's Image in Editor continues to work.
- I refactored how event handlers are registered, de-registered (It turns out it was working correctly until now)
- I cleaned up the language file. Please contact me if you'd volunteer to translate the plugin to a language.
- I fixed templates in ExcalidrawAutomate
- ... and some other minor improvements


# 1.2.0-alpha-1

I have released [Excalidraw 1.2.0 Alpha 2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.2.0-alpha-2). Please review the release notes here, before downloading Alpha 2 following the link.

This release includes major changes and will require running the "Migrate to version 1.2" command palette script to migrate your existing drawings.

⚠⚠⚠ This is an alpha release. I did my best to test it and to make it stable, but... please make a backup of your data before installing this. In "theory" downgrade to 1.1.x is possible, but I haven't written a script for that! ⚠⚠⚠

__Excalidraw 1.2 integrates Excalidraw fully into Obsidian.__ The plugin no longer uses `*.excalidraw` files, instead, drawings are stored in `*.md` files, just like any other Obsidian document. 

# New and changed features
- I changed the file format from `*.excalidraw` to `*.md`
  - I removed Excalidraw Sync - no longer needed
  - Drawings now have full version history with Obsidian Sync
  - Because drawings are now markdown files, you can create as many templates as you want
- You'll find commands to switch between Markdown and Excalidraw view in the Options menu.
- Text Elements from the drawing are synchronized with block references into the underlying markdown document. This opens up LOTS OF NEW OPPORTUNITIES.
  - Links in Excalidraw now support Aliases i.e `[[link|Alias]]`
  - Links in drawings will show up in backlinks of documents
  - Transclusions are supported i.e. `![[myfile#^blockref]]` will convert in the drawing into the transcluded text
  - Using the block reference you can also reference & transclude text that appears on drawings, in other documents
  - You can add tags to drawings
  - You can add metadata to the YAML front matter of drawings
  - Anything you add between the frontmatter and the `# Text Elements` heading will be ignored by Excalidraw, i.e. you can add whatever you like here, it will be preserved as part of the document.
  - Excalidraw documents now show in graph view.
- To support transclusion and aliases, the canvas now has a Text Element lock. This lock changes the text from preview to edit. Use CTRL+SHIFT+E to quickly switch between text element preview and edit mode.
- I moved SVG and PNG export to the options menu. CTRL+menu will trigger the export of the file outside Obsidian.
- I added an options-menu command to export to `*.excalidraw` format for portability.
- Added [language support](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/src/lang/locale). Contact me if you'd like to translate.

[![Obsidian-Excalidraw 1.2.0 update - Major IMPROVEMENTS](https://user-images.githubusercontent.com/14358394/124356817-7b3f3d80-dc18-11eb-932d-363bb373c5ab.jpg)](https://youtu.be/UxJLLYtgDKE)

# To Install:
- Exit Obsidian. 
- Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

# Please support my work
If you are enjoying Excalidraw then please support my work and enthusiasm by buying me a coffee on [https://ko-fi/zsolt](https://ko-fi.com/zsolt).

Please also help spread the word by sharing about the Obsidian Excalidraw Plugin on Twitter, Reddit, or any other social media platform you regularly use. 

You can find me on Twitter [@zsviczian](https://twitter.com/zsviczian), and on my blog [zsolt.blog](https://zsolt.blog).

[<img style="float:left" src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" width="200">](https://ko-fi.com/zsolt)


# 1.1.10

## New features:
- I resolved issue [#78](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/78). When you CTRL-Click a grouped collection of objects Excalidraw will open the page based on the embedded text.
- I added a setting to disable the CTRL-click functionality should it interfere with default Excalidraw behavior for you. In my experience double-clicking achieves the same outcome as a CTRL-click on an element in a grouped collection of objects, but if you use the CTRL-click feature to select an element of a group frequently, and find the "CTRL-click to open a link" feature annoying, you can now disable it.

# 1.1.9

## Improvements
- I modified the behavior of Excalidraw text element links.
  - CTRL/META + CLICK a text element to open it as a link.
  - CTRL/META + ALT + CLICK to create the file (if it does not yet exist) and open it
  - CTRL/META + SHIFT + CLICK to open the file in a new pane
  - CTRL/META + ALT + SHIFT + CLICK to create the file (if it does not yet exist) and open it in a new pane
- I added a setting to limit link functionality to `[[valid Obsidian links]]` only. By default, the full text of a text element is treated as a link unless it contains a `[[valid internal link]]`, in which case only the `[[internal link]]` is used. The new setting may be beneficial if you want to avoid unexpected updates to text in your drawings. This may happen if a text element in a drawing accidentally matches a file in your vault, and you happen to rename or move that file. By limiting the link behavior to `[[valid internal links]]` only, these accidental matches can be avoided. This is not frequent but happened to me recently.
- LaTeX symbol support. I resolved issue [#75](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/75) by adding a new command palette option ("Insert LaTeX-symbol") to insert an expression containing a LaTeX symbol or a simple formula. Some symbols may not display properly using the "Hand-drawn" font. If that is the case try using the "Normal" or "Code" fonts.

# 1.1.8

- Improvements to links
  - #72: You can now use square brackets to denote links. i.e. the text element `Which are my [[favorite books]]?` will be a link to `favorite books.md`.
  - Square brackets can still be omitted if the entire text element is an internal link. i.e. the following two text elements `Check out the [[requirements specification]]!!` and `requirements specification` will both represent a link to `requirements specification.md`.
  - When files are moved/renamed in your vault, text elements that are recognized links will also get updated in your drawings.
  - I added a new command palette option to insert an internal link to a file in your vault into the active drawing. While a drawing is open press ctrl/cmd+p and select `Excalidraw: Insert link to file`.
- #70: I Added CTRL/CMD + hover quick preview for Excalidraw files. Resolves

[![Obsidian-Excalidraw 1.1.8 - Links enhanced](https://user-images.githubusercontent.com/14358394/120925953-31c40700-c6db-11eb-904d-65300e91815e.jpg)](https://youtu.be/qT_NQAojkzg)


# 1.1.7

Fixed:
- Links starting with a number and continued with space did not work: i.e. `![[123 abc.excalidraw]]`. Now they do

New feature:
- Links: need to shift + click to create file that does not exist.

# 1.1.6

New feature:
[![Obsidian-Excalidraw 1.1.6 - Links](https://user-images.githubusercontent.com/14358394/119559279-bdb46580-bda2-11eb-88cb-7614dc452034.jpg)](https://youtu.be/FDsMH-aLw_I)

Fixed:
- [#63](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/63) 


# 1.1.5

- The template will now restore style properties. This means you can set up defaults in your template for stroke color, stroke width, opacity, font family, font size, fill style, stroke style, etc. This also applies to ExcalidrawAutomate.
- Added settings to customize the autogenerated filename (issue #58)
- Minor fixes for occasional console.log errors

# 1.1.4

Improved event handling for preview updates and sync updates.  Preview will also update when editing on another device and using Obsidian Sync + Excalidraw Sync enabled.

The drawing only opens if you click on the image instead of clicking anywhere in the row.

# 1.1.3

Fixes font issue with the preview of Excalidraw image in embedded mode.
Adds two new command palette commands:
- Create a new drawing - IN A NEW PANE - and embed it in the current document
- Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed it in the current document

# 1.1.2

Fixed [#59](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/59)

# 1.1.1

Now supports `![alttext|300|right](drawing.excalidraw)` format as well.

# 1.1.0

## Major update
## Replaces codeblock embedding with native `![[filename.excalidraw]]` embedding.

## Solves:
[#42](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/42) [#19](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/19)

# 1.0.12

Rebuild with Excalidraw 0.8.0-bec34f2. Solves issue [#56](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/56) 
- freehand drawing added

# 1.0.11

Improved loading performance on large vaults. Issue [#55](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/55) 

# 1.0.10

[![Obsidian-Excalidraw 1.0.10 update](https://user-images.githubusercontent.com/14358394/117579017-60a58800-b0f1-11eb-8553-7820964662aa.jpg)](https://youtu.be/W7pWXGIe4rQ)

# New Features
- Temporary workaround to enable Obsidian Sync for Excalidraw files. This enables almost real-time two-way sync between your devices. You can draw on your iPad with your pencil, on your Android with your stylus, and the image will be available in Obsidian as well and vice versa. 
- I added an autosave feature. Your active drawing gets saved every 30 seconds if you've made changes to it. Drawings otherwise get saved when the window loses focus, or when you close the drawing, etc. Autosave limits the risk of accidental data loss on mobiles when you "swipe out" Obsidian to close it.

# 1.0.10-test

## 1.0.10 Update
[![Obsidian-Excalidraw 1.0.10 update](https://user-images.githubusercontent.com/14358394/117579017-60a58800-b0f1-11eb-8553-7820964662aa.jpg)](https://youtu.be/W7pWXGIe4rQ)

## New Features
- Temporary workaround to enable Obsidian Sync for Excalidraw files. This enables almost real-time two-way sync between your devices. You can draw on your iPad with your pencil, on your Android with your stylus, and the image will be available in Obsidian as well and vice versa. 
- I added an autosave feature. Your active drawing gets saved every 30 seconds if you've made changes to it. Drawings otherwise get saved when the window loses focus, or when you close the drawing, etc. Autosave limits the risk of accidental data loss on mobiles when you "swipe out" Obsidian to close it.

## To Install:
- Exit Obsidian. 
- Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

# 1.0.9

See release notes for [1.0.8](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.0.8).

Contains minor fixes to the Templater automation for handling canvas.theme settings and theme and viewBackgroundColor from template files.

# 1.0.8

## 1.0.8 Update
[![Obsidian-Excalidraw 1.0.8 update](https://user-images.githubusercontent.com/14358394/117492534-029e6680-af72-11eb-90a3-086e67e70c1c.jpg)](https://youtu.be/AtEhmHJjnxM)

## Obsidian mobile v.0.0.18
- This is not part of the update, but fantastic news: Starting from the Obsidian mobile version v.0.0.18, Excalidraw works well on your Mobile.

## QoL improvements
- Adds context menu to File Explorer to create new drawings
- Adds a new command to the palette: “Transclude (embed) the most recently edited Excalidraw drawing”
- Automatically update file-links in transclusions when you rename or move your drawing
- Saves drawing and updates all active pre-views when drawing loses focus
- File is closed and removed when you select “Delete file” from more options
- Saves drawing when exiting Obsidian
- Fixes pen positioning bug with sliding panes after panes scroll

## ExcalidrawAutomte full Templater support
You now have ultimate flexibility over your Excalidraw templates using Templater. 
- Detailed documentation available [here](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/AutomateHowTo.md)
- I created few examples from the simple to the more complex
	- Simple use-case: Creating a drawing using a custom template and following a file and folder naming convention of your choice.
	- Complex use-case: Create a mindmap from a tabulated outline.

## Next update will concentrate on some minor known issues with Mobile
- Positioning of the pen gets misaligned with your stylus/finger after you open the command palette
- saving when you terminate the mobile app by closing the Obsidian task

# 1.0.8-test3

## Issues resolved
[#37](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/37), [#38](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/38), [#40](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/40), [#41](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/41), [#44](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/44), [#45](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/45), [#46](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/46)

## New features
- Adds [ExcalidrawAutomate](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/AutomateHowTo.md) a library of functions to generate Excalidraw drawings with Templater. Follow this [link](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/AutomateHowTo.md) for detailed documentation and examples.
- Adds context menu to file explorer to create a drawing in any folder.
- Adds feature to automatically update links in excalidraw transclusions when the name of the drawing changes.

## To Install:
- Exit Obsidian. 
- Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder. 
- Restart Obsidian.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

# 1.0.8-test2

Adds [ExcalidrawAutomate](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/AutomateHowTo.md) a library of functions to generate Excalidraw drawings with Templater.

Fixes issue [#37](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/37).
Adds context menu to file explorer to create a drawing in any folder.

# 1.0.8-test

Adds [ExcalidrawAutomate](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/AutomateHowTo.md) a library of functions to generate Excalidraw drawings with Templater.

Fixes issue [#37](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/37).
Adds context menu to file explorer to create a drawing in any folder.


# 1.0.7

Added a small tweak to styles. 
Now you can control if the text wraps around the object or not.
Use `|left` to align the image left without text wrapping and `|left-wrap` to wrap text.

CSS used:
```
svg.excalidraw-svg-right-wrap {
  float: right;
  margin: 0px 0px 20px 20px;
}

svg.excalidraw-svg-left-wrap {
  float: left;
  margin: 0px 35px 20px 0px;
}

div.excalidraw-svg-right {
  text-align: right;
}

div.excalidraw-svg-left {
  text-align: left;
}
```

# 1.0.6

Fixes:
[#31](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/31) [#25](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/25) [#24](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/24) [#23](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/23) [#22](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/22) [#20](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/20)

[![](https://user-images.githubusercontent.com/14358394/116312909-58725200-a7ad-11eb-89b9-c67cb48ffebb.jpg)](https://youtu.be/ipZPbcP2B0M)

## Export to SVG and PNG
- Using the filename and location of the active drawing
### Image Settings
- Export with background
- Export with theme

### Triggering export
#### Once-off
- Buttons to export active drawing
- Command palette action to export active drawing
#### Automated
- Auto export SVG
- Auto export PNG
- Keep filenames in Sync

## Open drawings on a new page or on the current page
### Command Palette
- Create a drawing on a new page by splitting the currently active pane
- Open a drawing on a new page by splitting the currently active pane
### Ribbon Button
- Click to open in an active pane
- CTRL+Click to open on a new page

## SVG styling when embedding using a code block
- new formatting option for the code block embed
- Valid values: left, right, center... but really anything after the last |.
- corresponding CSS
```
.excalidraw-svg-left {
 float: left;
}

.excalidraw-svg-right {
 float: right;
}

.excalidraw-svg-center {
}

.excalidraw-svg {
}
```
# How to install 
Install from Obsidian Community Plugins or ...
Copy the following 3 files into your `vault/.obsidian/plugins/obsidian-excalidraw-plugin` folder
- main.js
- manifest.json
- style.css

# 1.0.6-test

Fixes:
[#31](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/31) [#25](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/25) [#24](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/24) [#23](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/23) [#22](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/22) [#20](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/20)

[![](https://user-images.githubusercontent.com/14358394/116312909-58725200-a7ad-11eb-89b9-c67cb48ffebb.jpg)](https://youtu.be/TKgveGuA8Eo)

# Excalidraw 1.0.6 update
## Export to SVG and PNG
### New settings
- Export with background
- Export with theme
- Auto export SVG
- Auto export PNG
- Keep filenames in Sync
### Command palette action to export active drawing
- Using the filename and location of the active drawing
- Image types supported
	- PNG
	- SVG
## New command palette actions
- Create a new drawing in a new pane by splitting the currently active pane
- Open drawing in a new pane by splitting the currently active pane
### New setting
- Configure the ribbon button to 
	- open in a new pane by splitting the current pane
	- open in the currently active pane

## SVG styling when embedding using code block
### new options
[[drawing.excalidraw|500|left]]

[[drawing.excalidraw|500x300|right]]

[[drawing.excalidraw|center]]
### corresponding CSS
```
.excalidraw-svg-left {
 float: left;
}

.excalidraw-svg-right {
 float: right;
}

.excalidraw-svg-center {
}

.excalidraw-svg {
}
```
## Stencil library bug resolved
# How to install the test release
Copy the following 3 files into your `vault/.obsidian/plugins/obsidian-excalidraw-plugin` folder
- main.js
- manifest.json
- style.css

# 1.0.5



# 1.0.5-test2

## Warning
This is a pre-release using the latest unreleased Excalidraw 0.7.0 package. Based on my testing experience, this is stable, but not production-ready until Excalidraw 0.7.0 is officially released. 

## Fixes
### Excalidraw 0.7.0 fixes
These issues in Excalidraw affected the usability of Excalidraw in Obsidian, namely:
- The keyboard event propagation issue that impacted other workspace leaves in Obsidian. See bugs [#11](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/11) and [#12](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/12).
- Solves the ctrl+x on workspace leaf title issue
- The issue with placing library items outside view. 
- The issue with placing charts generated from pasted data

### App logic fixes
- The positioning of the drawing is also fixed. Drawings should now always appear centered within the workspace canvas when opening.
- When closing a drawing, not switching to another document in the file view did not save the drawing. This is now fixed.
- Drawings are always initialized with the theme they were saved.
- Moved stencil library files to data.json in hopes that Obsidian sync will cover these in the future. (sorry, this may again impact the stencil library for those that used the previous test version)
- main.js filesize drastically reduced (especially compared to the first test version... from 12MB down to 560kb)

## Breaking change
Excalidraw 0.7.0 also introduces a breaking change in how client-side stencil libraries are handled. As a consequence items in your stencil library (But not the drawings saved in your vault!) will be lost. You will need to add library items again.
![image](https://user-images.githubusercontent.com/14358394/115918236-96067080-a477-11eb-8daa-836a68719f81.png)

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)


# 1.0.5-test

## Warning
This is a pre-release using the latest unreleased Excalidraw 0.7.0 package. Based on my testing experience, this is stable, but not production-ready until Excalidraw 0.7.0 is officially released. 

## Fixes
Excalidraw 0.7.0 fixes two bugs that affected the usability of Excalidraw in Obsidian, namely:
- The keyboard event propagation issue that impacted other workspace leaves in Obsidian. See bugs [#11](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/11) and [#12](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/12).
- The issue with placing library items outside view. 

The positioning of the drawing is also fixed. Drawings should now always appear centered within the workspace canvas when opening.

## Breaking change
Excalidraw 0.7.0 also introduces a breaking change in how client-side stencil libraries are handled. As a consequence items in your stencil library (But not the drawings saved in your vault!) will be lost. You will need to add library items again.
![image](https://user-images.githubusercontent.com/14358394/115918236-96067080-a477-11eb-8daa-836a68719f81.png)

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)


# 1.0.4-test

## Warning
This is a test version using the unreleased Excalidraw 0.7.0 package. This version breaks the library due to a breaking change between Excalidra 0.6.0 and 0.7.0. Your library items within Excalidraw will potentially be permanently lost!!! Your Obsidian vault will not be impacted. 
fixes [#12](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/12) and [#11](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/11)

## Fixes
Fixes the keyboard even propagation impacting other workspace leaves in Obsidian.

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

# 0.0.4

## Release notes
### New features
- resize embedded image using the [[image.excalidraw|100]] or [[image.excalidraw|100x100]] format. Resolves issue [#4](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/4)

### Fixes
- dark mode [#7](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/7) 
- application icon [#6](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/6) 
- application description [#5](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/5) 

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)

### Install to iPad
Use "Filebrowser" app which can show hidden folders. Create a folder in .obsidian and copy in the 3 files from this repository. And it works, Though there is a reported issue to resolve which will be solved with the next Obsidian release.


# 0.0.3

## Release notes
Supports transclusion.
Use command palette: Excalidraw: insert link to .excalidraw file into markdown document 
Check [project page](https://github.com/zsviczian/obsidian-excalidraw-plugin) for full list of features and demo video

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115394105-b8339080-a1e2-11eb-8395-ef42777e031e.png)


# 0.0.2

Release notes:
Key change: now integrated into Obsidian file Explorer.
Transclusion is next!
It works but I haven't yet gotten around to solving transclusion into .md files.


To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.
![image](https://user-images.githubusercontent.com/14358394/115279271-ca5ff100-a146-11eb-8ca6-cb4aae296dd9.png)


# 0.0.1

## Release notes:
It works but I haven't yet gotten around to solving transclusion into .md files.

## To Install:
Copy the 3 files main.js, manifest.json, styles.css to the vault/.obsidian/plugins/obsidian-excalidraw-plugin/ folder.

# 1.0.2

Addressed feedback:
https://github.com/obsidianmd/obsidian-releases/pull/258

# 1.0.1

Addressed feedback on code.
https://github.com/obsidianmd/obsidian-releases/pull/258

# 1.0.0

This is the initial release of the Obsidian-Excalidraw Plugin.

