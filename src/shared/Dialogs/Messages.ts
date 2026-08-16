import {
  getYouTubeThumbnailUrl,
  getYouTubeUrl,
  URLs,
} from "src/constants/safeUrls";

const getYouTubeDiv = (videoId: string) => `
<div class="excalidraw-videoWrapper">
<a href="${getYouTubeUrl(videoId)}" target="_blank"><img src="${getYouTubeThumbnailUrl(videoId)}" style="width:100%;"></a>
</div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update, you'll see these release notes (you can turn this off in the plugin settings).

I build this plugin as a labor of love. Curious about the philosophy behind it? Check out [📕 Sketch Your Mind](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_SYM}). Want to master Excalidraw? Join [Excalidraw Mastery](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EM}). If you find it valuable, say "Thank you", and

<div class="ex-coffee-div"><a href="${URLs.KO_FI_COM_ZSOLT}"><img src="${URLs.CDN_KO_FI_COM_CDN_KOFI3_PNG}" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>
`,
  "2.27.0": `
## Maintenance
- Refactoring the plugin. Removed unused functions, improved code structure and readability. Removed the obsolete Draw.io/Diagram plugin integration (since the other plugin no longer works and is not maintained) and retired the Create DrawIO file script from the script library.
- Migrated the embedded Excalidraw runtime from the retired UMD build path to a dedicated ESM-source-based Obsidian package while preserving offline operation, popout windows, and runtime Mermaid loading through Excalidraw Extras. The Assistant UI font is now bundled instead of fetched from the internet, and the plugin-private React runtime is generated from the official npm package entrypoints instead of legacy UMD files.
- Updated the plugin-private React and ReactDOM runtime to React 19.

## Fixed
- The Excalidraw color palette now uses its natural height when space is available instead of being unnecessarily limited to a short, vertically scrolling panel. Its native color control also remains aligned with the hex input.
- The text-to-diagram chat history menu is visible again, allowing saved chats to be restored and deleted.
- Stencil library is persisted with tab-indented JSON to support Git diffs. [#2883](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2883)
- Custom color-picker top picks (pinned by dragging a color onto the strip) are now saved with the drawing instead of being forgotten on reload.
- Changing the canvas background color from the color-picker popover no longer leaves the popover's own theming out of sync until it's closed and reopened.

## New from Excalidraw.com
- Improved bucket tool and eyedropper support [#11849](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11849)
- Respect box selection mode ('contain' vs 'overlap') in lasso selection [#11862](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11862)
- Color-picker top picks can now be customized by dragging a color from the palette onto the strip; right-click the strip to reset [#11872](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11872)

## New in Excalidraw Automate
- Scripts can now register custom buttons in the selected-element context menu (the small toolbar shown above a selected element):
\`\`\`ts
registerElementActionProvider(getActions: (element: ExcalidrawElement) => readonly {id: string, title: string, icon: string, action: () => void}[]): (() => void) | null;
\`\`\`
- Scripts can now ask to be automatically re-run every time a new Excalidraw view is opened, with a user-confirmed Allow/Deny/Ask-me-later prompt; a fresh Allow also attaches the script to every other currently-open view immediately. Manage which scripts are allowed to autostart from the "Autostart scripts" command or the Compatibility settings section:
\`\`\`ts
registerAutostart(): Promise<"allow" | "deny" | "pending">;
\`\`\`
`,
  "2.26.4": `
## Fixed
- Markdown-image edits could be lost in some usage scenarios, 2.26.3 did not provide a broad enough fix. [#2865](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2865)

`,
  "2.26.3": `
## Fixed
- Editing one Markdown image and immediately selecting another to edit could silently drop the first image's contents, both from memory and from the note on disk. Reported on the [Sketch Your Mind community](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM}/t/excalidraw-2-26-0/7791/2). 🙏
- Deleting the last local Markdown image via the Excalidraw properties panel's delete button no longer skips the prompt to keep or delete its Markdown content. Deletion detection now covers every trigger (keyboard, Cut, context menu, panel button, or scripts) uniformly.

## New from Excalidraw.com
- New tool: Bucket fill. See more tools menu, or press B to toggle the bucket fill tool. [#11799](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11799)
`,
  "2.26.2": `
${getYouTubeDiv("p9MBFxUoOXQ")}

## New
- Stencil libraries can now be stored as vault files instead of \`data.json\`, improving plugin settings stability. Existing users are offered a safe, merge-first migration. To sync libraries, enable **Sync all other types** in Obsidian Sync. To view library files, enable **Show all file types** in Obsidian settings.
- Added editable Markdown images.
  - Store content locally (back-of-the-card) or link to a Markdown note, heading, or block.
  - Edit content and appearance from the Excalidraw side panel.
  - Supports canvas layering and image export.
  - Dragging a Markdown note as an image lets you choose a heading (when available) and insert it as either an editable Markdown image or embeddable.
  - Local Markdown image copies share the same source. Use **Duplicate selected image** to create an independent image and Markdown body. You can also convert between images and embeddables from the selected element's menu.
- Image-reference embeds now support an optional \`padding=N\` parameter, e.g.:  \`![[drawing#^area=xyz,padding=10]]\` [#2850](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2850) 🙏[@Evgene-Kopylov](${URLs.GITHUB_COM}/Evgene-Kopylov)
- Added the Voronoi diagram script. 🙏[@FreeCutter](${URLs.GITHUB_COM}/FreeCutter) [#2845](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2845)
- Dragging a single external GIF with the **Import external file** action now lets you import it as either an image or an embeddable. [#2848](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2848)
- Folder and file path settings now provide vault suggestions, warn about missing paths, and can create missing folders after confirmation.
- \`area=\` embed previews in reading mode now show a zoom icon on hover. Clicking it opens an interactive slider to adjust the padding value visually, updating the markdown link in real time. Drag the knob or use the mouse wheel (0/10, then step 50 up to 2000).

## New and fixed from Excalidraw.com
- New: Flowchart (CTRL/CMD+Arrow) now intelligently routes new shapes to avoid overlapping child nodes. [#11532](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11532)
- New: Draw To Shape automatically converts freehand drawings into perfect shapes. [#9313](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/9313)
- Fixed: Dragged arrow endpoints now respect grid and angle locks. [#10972](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/10972)
- New: Double-click an arrow to toggle its arrowhead. [#11615](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11615)

## Fixed
- Custom freedraw pens now remain selected after temporarily switching to the eraser or another tool, and are restored when returning to freedraw. [#2859](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2859)
- Added configurable bottom padding for Markdown images to prevent clipped final lines or borders.
- Markdown image font selectors now preview each font and refresh the vault font list whenever opened.
- Empty Markdown image font colors now normalize to black when the editor opens or the color field loses focus. CSS controls can also copy the generated SVG for inspection.
- Dragging an external video or other non-image file with the **Import external file** action now offers the same use, overwrite, or import options as images when a matching vault file already exists. [#2851](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2851) 🙏[@WolfExplode](${URLs.GITHUB_COM}/WolfExplode)

## Excalidraw Automate Breaking Change
- The Excalidraw API has replaced \`api.scrollToContent(target?, opts?)\` with \`api.setViewport(opts | null)\`. Update the MindMap Builder and Comic Strip Director scripts, along with any custom scripts using the old API. See the Excalidraw [Change Log](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_CHANGELOG}#viewport-control--scrollzoom-locking) for details.
`,
  "2.25.3": `
  Minor maintenance release with two important fixes.

  ## Fixed
  - Fixed custom pens with shared Perfect Freehand settings both appearing selected in the toolbar at the same time. [#2828](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2828)
  - Plugin does not start. Changing dynamic styling setting to off, and to on again solves the issue. Added further safety checks to avoid plugin crash. [#2819](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2819)

  ## New in ExcalidrawAutomate
  - Added \`ea.getCM6()\` to expose CodeMirror 6 classes/functions (EditorView, EditorState, etc.) to the ScriptEngine environment.
  - Added \`ea.getMathEditorExtensions()\` to expose Excalidraw's pre-configured LaTeX editor extensions, natively supporting obsidian-latex-suite integration in custom sidepanel scripts.
`,
  "2.25.2": `
One more small maintenance release with a few important fixes.

I'm now shifting my focus to the [SYM Community](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM}), where I'll be experimenting with some exciting new Visual PKM ideas. I'll also be taking a few weeks to recharge, so I don't expect another Excalidraw update until August.

I hope these fixes make for a stable release. Have a great summer, and see you in the community!

## Fixed
- Fixed YouTube embeddables not rendering on Android devices.
- Fixed custom pen settings not being saved correctly. Added **Save** and **Cancel** buttons to the Pen Settings page.
- Fixed an error generating image IDs on mobile devices when uploading or pasting images into a scene.
`,
  "2.25.1": `
This is a very minor update to fix a small regression in 2.25.0
  
## Fixed
- Excalidraw Automate Color Picker component used in Shade Master broke in 2.25.0. It is now restored.

  ## New
- Separate setting to enable extra bottom padding for tablet controls. This is useful for tablets with a system navigation bar that overlaps the Excalidraw footer controls. [#2833](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2833)
- Added \`onSceneChangeHook\` to Excalidraw Startup Script template. 
`,
  "2.25.0": `
${getYouTubeDiv("aqt5NJE2sJ8")}

## New from Excalidraw.com
- Significantly improved ink flow for freedraw pen. You can now toggle between pressure sensitive and constant mode for the default excalidraw.com freedraw pen. [#11507](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11507), [#11551](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11551)

## New in the Plugin
- Added the ability to show or hide document properties for embedded full Markdown files. This feature was requested by @Rolf during a Sketch Your Mind community monthly call discussion. [Join the community!](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM}/welcome)
- Comic book Callout Editor script available in the Script Library
- Added new ExtraBold line width option, and XS font option

## Fixed
- BUG: Double Click to edit from Obsidian in Live preview doesn't work anymore [#2813](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2813)
- Edge cases leading to memory leak and CPU overload when closing a markdown preview while embedded Excalidraw drawings are loading, or closing an ExcalidrawView, while nested images are still loading.
- Markdown-embed-as-image snapshot drops MathJax/LaTeX output [#2818](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2818), [#2282](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2282) 🙏[@Jmarcos13](${URLs.GITHUB_COM}/Jmarcos13) via [#2822](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2822)
- Fixed the "Customize the Embedded File Link" action. If you change the dimensions of the markdown image or the pdf page reference number, the image immediately updates in the scene. You can also use this feature to swap out images e.g. a png icon to an SVG icon. Default shortcut is CTRL+WIN+Click or CMD+Control+Click on the image element.
- LaTeX and Mermaid did not work on iOS. Released updated Excalidraw Extras and bumped the minimum required version to 0.0.15. [#2825](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2825)
- Malformed "Source" URL in ExcalidrawLib and Excalidraw Data json. [#2826]${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2826)

## New in ExcalidrawAutomate
- Added \`onSceneChangeHook\` to allow scripts and sidepanel tabs to react to scene changes. The hook supports filtering by \`appStateKeys\` and checking for tab visibility to optimize performance.

\`\`\`ts
  /**
   * If set, this callback is triggered when the scene changes in the target view.
   * You can use this to react to appState or element changes.
   * Any script can sign up for updates via this hook.
   * Because this hook fires extremely frequently (on every mouse move during drawing),
   * you MUST specify which appState keys you are interested in OR set trackElements to true.
   * If trackElements is falsy and appStateKeys is empty or undefined, the callback will NOT be triggered to prevent performance issues.
   * For sidepanel tabs, there is an additional filter feature: if triggerWhenInvisible is false,
   * the callback will only trigger when the sidepanel is visible and the tab is active.
   */
  onSceneChangeHook: {
    appStateKeys?: (keyof AppState)[];
    trackElements?: boolean;
    triggerWhenInvisible?: boolean;
    callback: (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      view: ExcalidrawView,
      ea: ExcalidrawAutomate,
    ) => void;
  } | null = null;
\`\`\`
`,
  "2.24.2": `
  ## Fixed
  - High impact regression in 2.24.0: Translations were not loading correctly. 🙏[@Lumintian](${URLs.GITHUB_COM}/Lumintian) [#2809](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2809)

  ## New
  - Added lock reading mode to markdown embeddables. If reading mode is locked, clicking the embeddable will not switch to the editor. This is useful for interacting with todo lists, links, and other interactive elements in the embeddables. Based on feedback from the Sketch Your Mind Community. 🙏[@robb3r](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM}/u/robb3r)
`,
  "2.24.1": `
To keep Excalidraw lightweight, improve startup performance, reduce plugin size, and address Obsidian's high-risk code scanner findings, several advanced features have been moved to the new **Excalidraw Extras** companion plugin in 2.24.0.

The first time you use one of these features, Excalidraw will automatically prompt you to install Excalidraw Extras:

- LaTeX formulas (MathJax)
- Mermaid diagrams
- PDF printing
- Direct file system access (files outside your vault)

This change reduces Excalidraw's size to under 5 MB, allowing even Obsidian Sync Basic users to sync the plugin across all devices while keeping the core plugin lighter.

---

This (2.24.1) is an emergency follow-up release.

I had to remove a very helpful convenience feature from Excalidraw Extras management: automatic plugin enable/disable.

The feature was removed because of an unexpected Obsidian code scanner review that VERY negatively impacted Excalidraw's scanner score. The same code passed validation without any issues before the release, then failed when released, with no clear warning or guidance. I cannot continue shipping user-friendly automation when the validation target keeps changing.

I support security and quality checks. However, the current scanner process is difficult to work with due to inconsistent results, limited transparency, and the lack of a clear review or appeal process.

If Excalidraw matters to you, please consider contacting Obsidian and advocating for a more transparent, developer-friendly process:

* Stable and consistent scanner results before release
* Clear, actionable error reporting
* A real and timely review and appeal path for questionable findings
* Support for safe plugin workflows, such as companion-plugin management and asset deployment

## Changed

* Removed automatic enable/disable of Excalidraw Extras from the onboarding flow.
* Excalidraw Extras must now be enabled manually in Community Plugins after installation.

`,
  "2.24.0": `
To keep Excalidraw lightweight, improve startup performance, reduce plugin size, and address Obsidian's high-risk code scanner findings, several advanced features have been moved to the new **Excalidraw Extras** companion plugin.

The first time you use one of these features, Excalidraw will automatically prompt you to install Excalidraw Extras:

- LaTeX formulas (MathJax)
- Mermaid diagrams
- PDF printing
- Direct file system access (files outside your vault)

This change reduces Excalidraw's size to under 5 MB, allowing even Obsidian Sync Basic users to sync the plugin across all devices while keeping the core plugin lighter.

## Fixed
- Keep runtime custom pen settings per custom pen index instead of sharing one active pen object. Switching between custom pens restores each pen's last adjusted stroke width, colors, fill style, and roughness. 🙏[@arias007](${URLs.GITHUB_COM}/arias007) [#2801](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/2801)
- Insert ANY file: Typing “p” in the search field opens the PDF selection [#2791](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2791)
- Blurry arrows in PNG export when arrows have a text label [#2793](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2793), [#11492](${URLs.GITHUB_COM_EXCALIDRAW_EXCALIDRAW_PULL}/11492)
  `,
  "2.23.12": `
  ## Fixed
  - Code scanner error
`,
  "2.23.11": `
  ## Fixed
  - Print to PDF sometimes displayed a scrollbar on prinouts on MacOS.
  - Scenes that contain \`![[text#^block]] transclusions\` did not render in markdown nor in image previews.
  - Addressed further Obsidian code scanner findings
`,
  "2.23.10": `
## Fixed
- 2.23.9 regression: Toolbar sizing issue in desktop and compact UI modes [#2789](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2789)
`,
  "2.23.9": `
## New
- Excalidraw now updates nested image embeds in the scene triggered by Obsidian window/tab changes even if those changes affect deep nested images (i.e. excalidraw images nested inside the nested drawings)
- Added the Color Scheme Manager script. 🙏[@iwanhoogendoorn](${URLs.GITHUB_COM}/iwanhoogendoorn)
  - Iwan will demonstrate the script and host a Q&A session for [Sketch Your Mind Community Members](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_SYM}) on Friday, 12 June.

## Fixed
- Clicking Excalidraw links now correctly jumps to the targeted element, group, or frame when the destination is another Excalidraw drawing, including links chosen through the multi-link picker and links triggered from nested embeds.
- In some cases the image cache did not update when nested drawings were modified
- Horizontal and Vertical arrow lines are not always displayed correctly when exporting to SVG or embedding SVG to a markdown note [#1454](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/1454)
- Updated vulnerable package dependency lodash-es and nanoid based on Obsidian code scanner findings.
`,
  "2.23.8": `
${getYouTubeDiv("y3sDfH30ApU")}

## New
- Embeddable links now support adding ontology to links, e.g. \`(ontology:: [[file#section]])\` and \`(ontology:: [Video Title](link-to-youtube-video))\`. This allows you to add custom metadata to links that will be picked up as dataview tags and rendered with tools such as ExcaliBrain.

## Fixed
- Regression from security fixes: embed markdown as image failed in some cases
- Plugin settings now includes all available fonts when setting the default font when embedding markdown as image.

## New in ExcalidrawAutomate
- \`ea.zoomToElements()\` now accepts an optional margin parameter to control the amount of whitespace around the zoomed elements. The default margin is 0.05 (5% of the view size), but you can adjust it as needed for your specific use case.
- \`ea.cloneElements()\` function to clone elements with new IDs and updated relationships, useful for duplicating or moving elements without affecting the originals.

\`\`\`ts
/**
   * Zooms the target view to fit the specified elements.
   * @param {boolean} selectElements - Whether to select the elements after zooming.
   * @param {ExcalidrawElement[]} elements - Array of elements to zoom to.
   * @param {number} [margin=0.05] - The margin around the elements when zooming.
   */
  viewZoomToElements(selectElements: boolean, elements: ExcalidrawElement[], margin: number = 0.05): void;

/**
   * Clones an array of Excalidraw elements or a clipboard string.
   * Ensures that relationships (containers, bound elements, groups, bindings) 
   * are correctly remapped to the newly generated IDs.
   * 
   * @param {ExcalidrawElement[] | string} elementsOrClipboard - The elements array or Excalidraw clipboard string.
   * @returns {ExcalidrawElement[]} An array of cloned elements with new IDs and updated relationships.
   */
  cloneElements(elementsOrClipboard: ExcalidrawElement[] | string): ExcalidrawElement[];
\`\`\`

## Fixed in ExcalidrawAutomate
- \`ea.addImage()\` now supports adding the markdown section of an Excalidraw file as an image.
`,
  "2.23.7": `
## Fixed
- Some Excalidraw Script Icons are loaded with extra bold line weight.
- BUG: Color remapping UI for Shade Master script does not appear to work when editing the colors of a nested Excalidraw drawing. [#2779](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2779)
  `,
  "2.23.6": `
I apologize in advance — there will likely be a few more micro-releases over the coming weeks.

I'm addressing the Obsidian code scanner findings gradually, and every code change carries some risk. I am making changes in small increments to minimize potential issues.

If you notice anything broken or behaving unexpectedly, please let me know. I'll do my best to investigate and fix it quickly.

## Fixed
- Links in language files 
`,
  "2.23.5": `
${getYouTubeDiv("otIHXat8Roo")}

## New
- Added **session-scoped AI usage metering** with per-model token/image tracking, a new **"Session token usage"** settings button with Markdown export, and an **"AI Usage: input/output"** button in ExcaliAI next to Run for quick access to the same breakdown.
- Added an explicit opt-in for executing <code>cmd://</code> links from drawings. Command links are now blocked by default, with a security warning prompt on first use and a dedicated setting under Excalidraw Automate.
- Replaced the dropped-link title resolver from Iframely with an HTTPS oEmbed endpoint.
- Hardened **data URL embeddables**: HTML loaded through <code>data:text/html</code> now renders in a sandboxed iframe with a defensive CSP to keep interactive content contained inside the embeddable.
- New option in settings to disable placeholder image.

## Fixed
- Fixed Taskbone OCR, which broke in 2.23.0.
- Fixed inline link suggester in MindMap Builder failing when filenames included the "." (dot) character. [#2772](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2772)

## New in ExcalidrawAutomate
- Added \`getPathForImageFileId(fileId: FileId): string | null\` — returns the vault path for an image element identified by its Excalidraw fileId. Note: Excalidraw does not maintain a persistent index of fileIds to paths; the path is only available for images that have appeared in an open drawing during the current Obsidian session.
- Gemini image models now expose **provider-correct size presets** in AI settings and ExcaliAI, with Google image requests automatically translating presets into Gemini aspect ratio and image size parameters.
- Added three new ExcalidrawAutomate methods for **AI token usage**.

\`\`\`ts
/**
 * Returns accumulated AI token usage for the current Obsidian session.
 * Usage is keyed by model identifier. Data is not persisted and resets on restart.
 */
public getAIUsage(): AIUsageData;

/**
 * Opens a modal showing per-model AI token usage for the current session.
 * Includes a "Copy as Markdown" button.
 */
public showAIUsageModal(): void;

/**
 * Returns a compact label string: "AI Usage: 355k/23k" (input/output tokens).
 * Appends image generation count when present, e.g. "+ 3 imgs".
 */
public formatAIUsageLabel(): string;

/**
 * Returns the vault path for an image file identified by its Excalidraw fileId.
 * Only available for images seen in an open drawing during the current session.
 * @param {FileId} fileId - The Excalidraw fileId of the image.
 * @returns {string | null} The vault path, or null if not cached in this session.
 */
getPathForImageFileId(fileId: FileId): string | null;
\`\`\`
  `,
  "2.23.3": `
I apologize in advance — there will likely be a few more micro-releases over the coming weeks.

I'm addressing the Obsidian scanner findings gradually, and every code change carries some risk. The safest approach I know is to ship small, incremental updates focused on specific fixes rather than large sweeping changes.

If you notice anything broken or behaving unexpectedly, please let me know. I'll do my best to investigate and fix it quickly.

## Fixed
- Excalidraw Script Library icons were not downloading correctly. [#2768](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES}/2768)
  `,
  "2.23.2": `
  ## Fixed
  - Further code scanner and transparency improvements, including a new \`ExcalidrawAutomate.printURLsInCodebase()\` function to list all URLs used in the codebase. All URL calls require explicit user action, either through enabled settings or clearly indicated links. Run the function in the Obsidian Developer Console (\`CTRL+SHIFT+I\` / \`CMD+OPT+I\`).
  `,
  "2.23.0": `
${getYouTubeDiv("EiT56z3KPjI")}

## New
- Added a new setting under *Excalidraw Automate* to opt-in to \`excalidraw-onload-scripts\`.
- Added image cache for nested images, including nested Excalidraw drawings and PDF page renders.
  - When a scene is opened again on the same device, cached images are shown immediately while validation of nested changes continues in the background. This should **noticeably improve loading times** for scenes you access regularly.
  - A new setting under plugin settings in **Image caching and rendering optimization** lets you control cache retention in days, so you can balance disk usage against how long these cached images are kept available.
  - The cache is local to each device. It is **not synced** through Obsidian Sync or your vault, so each device builds and maintains its own cache independently.
- Placeholder image for empty drawings.
- AI support is now **provider-aware across the plugin**. You can choose between OpenAI, Anthropic/Claude, Google/Gemini, xAI/Grok, or an OpenAI-compatible/local endpoint.
  - AI settings now use shared provider profiles plus text/multimodal model lists, image model lists, default model selection, token budgets, and an optional verbose developer-console logging toggle for troubleshooting.
  - The shared AI configuration is now used by ExcalidrawAutomate, Mermaid chat, diagram-to-code, ExcaliAI, and related AI features.
  - Older OpenAI-specific AI settings are migrated automatically into the new shared AI settings on first run.
  - New and updated ExcaliAI script.
- API key obfuscation for plugin settings. This helps prevent your API keys from leaking via Excalidraw plugin settings in case you open your vault to LLMs.

## Fixed
- **Findings listed on [Obsidian Community Plugin Info](${URLs.COMMUNITY_OBSIDIAN_MD_PLUGINS_OBSIDIAN_EXCALIDRAW_PLUGIN})**
- Error when saving pasted images from Excalidraw.com.
- Fixed Mermaid chat / text-to-diagram and diagram-to-code to use the shared AI layer and honor the configured provider, model, API key, and endpoint settings.
- Fixed the ExcaliAI script to work with the new shared AI settings, including provider-aware text and image model selection, prompt transforms vs. mask edits, and OpenAI image responses that return \`b64_json\` instead of a hosted URL.

## New in ExcalidrawAutomate
- Added new provider-aware AI helper functions for scripts while retaining backward compatibility for existing \`postOpenAI()\` integrations.
  - Added \`getAISettings()\` to inspect the shared AI settings from scripts.
  - Added \`analyzeAIImage()\`, \`generateAIImage()\`, \`transformAIImage()\`, and \`maskEditAIImage()\` for shared text/image workflows.
  - Added \`createAIChatSession()\` to preserve chat history between calls without manually maintaining the \`messages\` array.
- Added \`extractCodeBlocks()\` to simplify parsing model responses that return fenced code blocks.
- Updated \`addImage()\` to accept \`data:image/...\` data URLs directly, in addition to files, hyperlinks, vault paths, and PDF++ references.

\`\`\`ts
/**
 * Posts an AI request to the currently configured provider and returns the response.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<RequestUrlResponse>} Promise resolving to the provider-normalized API response.
 */
public async postAI(request: AIRequest): Promise<RequestUrlResponse>;

/**
 * Backwards-compatible alias for \`postAI()\`.
 * Existing scripts can keep calling \`postOpenAI()\` while using the shared provider, model, API key, and endpoint settings.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<RequestUrlResponse>} Promise resolving to the provider-normalized API response.
 */
public async postOpenAI(request: AIRequest): Promise<RequestUrlResponse>;

/**
 * Returns the shared AI settings exposed to scripts.
 * @returns {ExcalidrawAISettings | null} Shared AI settings or null if AI is unavailable.
 */
public getAISettings(): ExcalidrawAISettings | null;

/**
 * Sends an image-aware text request using the shared multimodal routing.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<GenerateAITextResult>} Promise resolving to normalized text output.
 */
public async analyzeAIImage(request: AIRequest): Promise<GenerateAITextResult>;

/**
 * Generates a new image using the configured image model.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<GenerateAIImageResult>} Promise resolving to normalized image output.
 */
public async generateAIImage(request: AIRequest): Promise<GenerateAIImageResult>;

/**
 * Applies a prompt-based transform to an input image.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<GenerateAIImageResult>} Promise resolving to normalized image output.
 */
public async transformAIImage(request: AIRequest): Promise<GenerateAIImageResult>;

/**
 * Applies a mask-based edit to an input image.
 * @param {AIRequest} request - The AI request configuration.
 * @returns {Promise<GenerateAIImageResult>} Promise resolving to normalized image output.
 */
public async maskEditAIImage(request: AIRequest): Promise<GenerateAIImageResult>;

/**
 * Creates a lightweight chat session helper that preserves prior conversation turns between calls.
 * @param {Omit<AIRequest, "messages">} initialRequest - Default request fields applied to every send.
 * @returns {AIChatSession} Chat session helper with \`getMessages()\`, \`reset()\`, and \`send()\`.
 */
public createAIChatSession(initialRequest?: Omit<AIRequest, "messages">): AIChatSession;

/**
 * Extracts code blocks from markdown text.
 * @param {string} markdown - The markdown string to parse.
 * @returns {Array<{ data: string, type: string }>} Array of objects containing code block contents and types.
 */
public extractCodeBlocks(markdown: string): { data: string, type: string }[];

/**
 * Adds an image element to the ExcalidrawAutomate instance.
 * @param {number | AddImageOptions} topXOrOpts - The x-coordinate of the top-left corner or an options object.
 * @param {number} topY - The y-coordinate of the top-left corner.
 * @param {TFile | string} imageFile - The image file, hyperlink, vault path, PDF++ reference, or data URL.
 * @param {boolean} [scale=true] - Whether to scale the image to MAX_IMAGE_SIZE.
 * @param {boolean} [anchor=true] - Whether to anchor the image at 100% size.
 * @returns {Promise<string>} Promise resolving to the ID of the added image element.
 */
async addImage(
  topXOrOpts: number | AddImageOptions,
  topY: number,
  imageFile: TFile | string,
  scale: boolean = true,
  anchor: boolean = true,
): Promise<string>;
\`\`\`
`,
};
