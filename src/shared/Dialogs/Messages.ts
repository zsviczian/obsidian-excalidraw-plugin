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
"2.6.3":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/OfUWAvCgbXk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

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
`,
"2.6.2":`
## Fixed
- Image scaling issue with SVGs that miss the width and height property. [#8729](https://github.com/excalidraw/excalidraw/issues/8729)
`,
"2.6.1":`
## New
- Pen-mode single-finger panning enabled also for the "Selection" tool.
- You can disable pen-mode single-finger panning in Plugin Settings under Excalidraw Appearance and Behavior [#2080](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2080)

## Fixed
- Text tool did not work in pen-mode using finger [#2080](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2080)
- Pasting images to Excalidraw from the web resulted in filenames of "image_1.png", "image_2.png" instead of "Pasted Image TIMESTAMP" [#2081](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2081)
`,
"2.6.0":`
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
- New RU translation 🙏[@tovBender](https://github.com/tovBender)

## Updated
- CN translation 🙏[@dmscode](https://github.com/dmscode)
`,
};
