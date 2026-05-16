export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update, you'll see these release notes (you can turn this off in the plugin settings).

I build this plugin as a labor of love. Curious about the philosophy behind it? Check out [📕 Sketch Your Mind](https://sketch-your-mind.com). Want to master Excalidraw? Join [Excalidraw Mastery](https://community.sketch-your-mind.com/em). If you find it valuable, say THANK YOU or…

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>
`,
  "2.23.0": `
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=EiT56z3KPjI" target="_blank"><img src ="https://i.ytimg.com/vi/EiT56z3KPjI/maxresdefault.jpg" style="width:100%;"></a>
</div>

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
- **Findings listed on [Obsidian Community Plugin Info](https://community.obsidian.md/plugins/obsidian-excalidraw-plugin)**
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
  "2.22.3": `

Feeling overwhelmed by Excalidraw's endless features?

It's not just a drawing tool. Inside Obsidian, it becomes a thinking tool.  
To unlock linking, embedding, and referencing, you need a mindset shift.

**Join Excalidraw Mastery** to make that shift.  
Courses, live Q&As, and deep dives to help you move into true 4D Visual PKM.  👉 https://community.sketch-your-mind.com/em

<div style="text-align:center;margin-top:10px;">
<a href="https://community.sketch-your-mind.com/em" target="_blank"><img src="https://sketch-your-mind.com/images/logo-EM.png" style="width:50%"></a>
</div>

Excalidraw Mastery is part of the **Sketch Your Mind Community**—a space for visual thinkers.  
Share your work. Ask questions. Learn from others.  👉 https://community.sketch-your-mind.com

Curious about the philosophy behind it?

<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=TnwRlaIdhSU" target="_blank"><img src ="https://sketch-your-mind.com/images/Thumbnail-podcast.jpg" style="width:100%;"></a>
</div>

`,
  "2.22.1": `
## New
- Added a command palette action to switch all currently open Excalidraw drawings to view mode.
  - While this temporary mode is enabled, any Excalidraw drawing opened afterward will also open in view mode.
  - This is useful when presenting multiple drawings and you want to avoid accidentally moving elements, and when you don't want the tools to be in the way.
- Added an optional phone-only layout setting to push Excalidraw's footer controls above the system navigation bar on some Android devices [#2688](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2688), [#2652](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2652), [#798](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/798)
  - Look for ""Extra bottom padding for phone controls" in the plugin settings.

## Fixed
- invisible cursor color in color picker, mermaid chat, in text elements in dark mode [#2739](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2739)
- image sizing issue when embedding image type "SVG Image" to markdown
- copying a nested image fragment in Excalidraw and pasting to markdown lost the image block reference
- modifier keys conflicted with Excalidraw alt-select (lasso) behavior
`,
  "2.22.0": `
## Fixed
- Fixed misaligned panel buttons in tray mode [#2718](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2718) 🙏[@heinrich26](https://github.com/heinrich26)
- Improved loading of nested Excalidraw files within a scene, with some additional performance gains.
- Fixed an issue where the caret color did not match the text color [#11018](https://github.com/excalidraw/excalidraw/issues/11018)

## New from Excalidraw.com
- Added several text editing improvements, including a right-side handle on wrapped text for easier auto-resizing without opening the context menu [#10979](https://github.com/excalidraw/excalidraw/pull/10979)
- Added support for Mermaid state diagrams [#11031](https://github.com/excalidraw/excalidraw/pull/11031)
- There is a new Preferences menu above the Dark/Light mode switch in the main menu [#10760](https://github.com/excalidraw/excalidraw/pull/10760)
- Added a new Preferences option to switch between Wrap and Overlap selection modes. Overlap mode behaves similarly to the lasso selection tool available under More Tools [#11053](https://github.com/excalidraw/excalidraw/pull/11053)

## New
- Added support for embedding the [Sheet Plus](obsidian://show-plugin?id=sheet-plus) plugin as an active embeddable element in Excalidraw. At the moment, changing the canvas theme between dark and light mode does not automatically re-render embedded sheets. To apply the theme change, close and reopen the drawing. This will likely be improved in a future update.
`,
  "2.21.3": `
## Fixed
- Caret color for link editor, text elemnts in dark mode, color picker input element.
- Link click behavior modifier keys setting in plugin settings now enforces CTRL/CMD for link clicks and improves on clarity of setting UI by adding a header row
- Link click conbinations that included ALT/OPT did not work because they trigger lasso selection in Excalidraw. This is now fixed, if you CTRL+ALT click a link it will navigate while retaining the lasso select feature when pressing ALT/OPT.
- Copying an image block embed (e.g. \`![[drawing#^frame=my_frame]]\`) from the excalidraw scene and pasting it to markdown no longer loses the frame reference
- Embed "SVG Image" to markdown should size correctly now when setting a percentage \`![[drawing|50%]]\` where 50% is relative to the width of the markdown note.

`,
  "2.21.2": `
## Fixed
- The new ExcalidrawAutomate function \`parseText()\` broke if the text was a transcluded image or PDF document, causing downstream paste issues in MindMap Builder.
- Custom pen sloppiness not being saved to a template drawing [#2715](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2715) 🙏[@sreedharsreeram](https://github.com/sreedharsreeram)

`,
  "2.21.1": `
## Fixed
- Drawing and editor fails to initialize in a new window [#2713](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2713)
- Duplicate selected image with a different image ID command palette action did not duplicate cropped PDF images.
- Memory leak issue with PDF import as images.

## New
- Put caret at pointer position when clicking on selected text element [#10970](https://github.com/excalidraw/excalidraw/pull/10970)

`,
  "2.21.0": `
## New
- LaTeX editor is now floating [#2684](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2684) 🙏[@TravisLEBLANC1](https://github.com/TravisLEBLANC1), [#2698](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2698) 🙏[@heinrich26](https://github.com/heinrich26)
- Inline link suggester supports new triggers \`![[drawing#^frame=\` and \`![[drawing#^clippedframe=\`, thus it is easy to reference frames like pdf pages, slides or other parts of your scene marked using marker frames.
- Support for mermaid Entity Relationship Diagrams, and new ERD/cardinality arrowheads [#10940](https://github.com/excalidraw/excalidraw/pull/10940)
- New Context Menu options to disable arrow binding and midpoint snapping [#10906](https://github.com/excalidraw/excalidraw/pull/10906)
- Improved UI styling and icons are better aligned with Obsidian [#2703](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2703), [#2687](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2687), [#2697](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2697) 🙏[@heinrich26](https://github.com/heinrich26)

## Fixed
- Sizing of embedded images in Markdown when image type is set to SVG [#2685](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2685)
- Fixed Enter, Up/Down arrows, and TAB keys stopped working in text elements after deleting the \`#\` character [#2704](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2704)

## MindMap Builder
- Fixed navigation (arrow keys) scoping and recognition
- Added new feature to paste images and single Excalidraw elements like container with text, text element, or image element directly as a map leaf (using the MindMap Builder default paste shortcut: ALT/OPT+V)
- Added new action to toggle a markdown link between markdown embeddable and link as text. Default shortcut is ALT/OPT+E.

## New in ExcalidrawAutomate
\`\`\`ts
/**
 * Parses text using the target view's ExcalidrawData parser.
 *
 * This reuses ExcalidrawData parsing logic directly, including transclusion
 * resolution, link bracket rendering, and link/url prefixes based on the
 * target file's frontmatter.
 *
 * @param {string} text - Raw text to parse.
 * @returns {Promise<string | undefined>} Parsed text, or undefined when input/view is unavailable.
 */
public async parseText (text: string): Promise<string | undefined>;
\`\`\`
`,
  "2.20.6": `
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=g-BiyQ7TJTM" target="_blank"><img src ="https://i.ytimg.com/vi/g-BiyQ7TJTM/maxresdefault.jpg" style="width:100%;"></a>
</div>

## New
- Inline suggester now supports searching for tags in addition to files. Trigger with "#".
- In Mindmap Builder
  - Added Up-Facing, Down-Facing, and Up-Down maps
  - Added submaps. You can now promote any node to be a new mindmap root (a sub-map). Sub-maps can have different layout settings such as different growth strategies, different colors, etc.
  - Added experimental MindMap Builder API, accessible via \`window.MindMapBuilderAPI\`. See [MindMap Builder API documentation](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/ea-script-docs/MindMapBuilderAPI.md) for more. Essentially, the API allows mindmaps to be created using the Obsidian CLI.

## New from Excalidraw.com
- Allow clicking on links and embeds with laser tool [#10797](https://github.com/excalidraw/excalidraw/pull/10797)
- Improved paste text to diagram with more options and support for more data [#10824](https://github.com/excalidraw/excalidraw/pull/10824)

try copy/pasting this into Excalidraw:
\`\`\`
skill, junior, medior, senior
business_analysis, 2, 6, 9
business_writing, 3, 7, 9
stakeholder_mgmt, 1, 6, 10
\`\`\`

## New in ExcalidrawAutomate
- Added \`skipScriptRestore(scriptName?: string): boolean\` function to the API. This allows scripts to queue a one-time skip marker so sidepanel persisted restoration will not re-run the script. Intended for startup race conditions where a script is started from the Command Palette/hotkey before the sidepanel has opened. If scriptName is omitted, the function uses ea.activeScript.

## Fixed
- Significant performance improvement of MindMap Builder and all other scripts modifying elements in large scenes containing thousands of elements.
- Multiple arrow related updates and fixes from Excalidraw.com [#10832](https://github.com/excalidraw/excalidraw/pull/10832) [#10831](https://github.com/excalidraw/excalidraw/pull/10831) [#10816](https://github.com/excalidraw/excalidraw/pull/10816)
- Hide MindMap Builder and other floating tools when creating a screenshot
`,
  "2.20.5": `
## Fixed
- Obsidian Mobile: The floating navigation bar got stuck at the bottom after closing Excalidraw or switching to a markdown note. [#2673](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2673)
- "Toggle UI Mode" now includes a preference setting for Obsidian Phone as well. You can now set different default layouts for phone, tablet, and desktop. [#2670](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2670)

## New
- Added "Toggle Full Screen" button to toolbar right next to the "Obsidian menu", and the "Insert Any File" button.
`,
  "2.20.4": `
## Fixed
- Fix NativeSVG embed mode into Markdown documents, ahead of the Obsidian 1.12.1 release. [#2665](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2665)
- Color picker once again supports 8-digit hex codes (Hex color string with an opacity). [#10772](https://github.com/excalidraw/excalidraw/issues/10772)
- Fixed regression that removed LaTeX scaling. [#2668](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2668) 🙏[@TravisLEBLANC1](https://github.com/TravisLEBLANC1)
- Corrected malformed frame embeds when using marker frames.
- Context menu options **“Do not invert image(s) in dark mode”** and **“Invert image(s) in dark mode”** now properly cascade when drawings are nested as images inside other drawings.
- Improved performance of the [MindMap Builder script](https://visual-thinking-workshop.com/mindmap).

## New
- [Deconstruct Selected Elements script](https://youtu.be/HRtaaD34Zzg) now includes a folder selection option, allowing you to choose the destination folder for the generated image.
- Arrow binding midpoints. When the projected point is close to center, snap it to the exact center. This way it's easier to create neat(er) simple arrow connections. [#10611](https://github.com/excalidraw/excalidraw/pull/10611)

`,
  "2.20.3": `
## Fixed
- Hover preview when hovering an element with a link in the scene was unreliable
- If a text element had a link in the text body, in some situations, the link became unresponsive to clicks. [#2660](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2660)

## New
- Added default keymap to latex editor [#2655](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2655) 🙏[superle3](https://github.com/superle3)
`,
  "2.20.2": `
## New from Excalidraw.com
- Arrow focus indicator [#10613](https://github.com/excalidraw/excalidraw/pull/10613)

## Fixed
- Experimental file type display now also works in Obsidian Mobile. (Reported on Discord)
- Text to Mermaid stores chat history locally (i.e. not synchronized between devices).
- Image positioning in crop editor [#2589](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2589), [#10726](https://github.com/excalidraw/excalidraw/pull/10726)

## MindMap Builder
- Implemented better undo support (effective only for the very last MindMap Builder action). Additionally, CMD/CTRL+Z and CTRL+Y, CMD+SHIFT+Z now work when the MindMap input window is focused.
- Fixed: Double character input issue (IME Composition Error) when creating nodes [#2647](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2647)
- Fixed: More robust error handling when the MindMap is corrupted or invalid.
- Updated Excalidraw Writing Machine to support document generation from MindMaps. Writing Machine will honor the branch order. Requires update of the Writing Machine Script.

## New in ExcalidrawAutomate
- \`getBoundTextElement()\` now also accepts an \`ExcalidrawElement[]\` (2-element selection: container + text) in addition to a single element.
- \`addElementsToView()\` extended with \`captureUpdate\` parameter (default: "IMMEDIATELY"). When set to false, the addition of elements will not be recorded in the view's history.

\`\`\`ts
  async addElementsToView(
    repositionToCursor: boolean = false,
    save: boolean = true,
    newElementsOnTop: boolean = false,
    shouldRestoreElements: boolean = false,
    captureUpdate: CaptureUpdateActionType = CaptureUpdateAction.IMMEDIATELY,
  ): Promise<boolean>
\`\`\`
`,
  "2.20.1": `
## Fixed
- Fixed Experimental file type display, available under miscellaneous settings. (Reported on Discord)
- Fixed image inversion in dark mode on iOS devices. [#2636](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2636)
- Fixed UI Mode switching on tablets was unreliable.

## New/Fixed in MindMap Builder
- **Connector Ontology**: Added support for labeling connection lines. A secondary input field (accessible via Shift+Tab) is now available in both docked and floating modes. Labels are preserved during copy/paste operations using inline Dataview syntax (e.g., link ontology:: node content).
- **Connector Styling**: Introduced configuration settings for branch thickness and scaling strategies, allowing a choice between Hierarchical (tapering width by depth) or Uniform connector widths.
- **Smart Resume**: The Focus and Zoom actions now target the most recently active node if no current selection is made. This automatically focuses the input field, allowing you to quickly resume mapping from where you left off.
- **Radial Fill Sweep**: Added a "Fill Sweep Angle" option for Radial layouts. When enabled, nodes are distributed evenly across the full configured arc range, even when there are only a few nodes. (Visible only when Growth Strategy is set to "Radial").
- **Radial Navigation**: Updated Level 1 node navigation in Radial maps to follow visual vertical alignment instead of rotational order. Up/Down keys now consistently move the selection visually up or down on both sides of the circle, matching the behavior of Right-Left layouts.
- **Fixed**:
  - Sidepanel opens on activation of MindMap Builder even in floating mode. Requires update of both Excalidraw and the MindMap Builder script.
  - **Node Reordering**: Overhauled the logic for moving nodes via CMD/CTRL+Arrow to resolve unpredictability; nodes now move consistently to the intended locations.
  - **iOS Navigation**: Resolved an issue where using the Tab key to cycle focus between components in the floating input window did not work reliably on iOS.
  - **Boundary Layering**: Fixed an issue where sub-branch boundaries were placed above text elements when pasting a map; they now correctly render on the layer below the text.
  - **Layout Stability**: Fixed an issue where the viewport would shift unexpectedly when pasting multiple elements onto an existing node in large scenes.

> [!Tip]- Learn MindMap Builder
> Learn it fast with the low-cost [MindMap Builder course](https://visual-thinking-workshop.com/mindmap). Register before **31 Jan** to join a live Q&A:
> - Sat Jan 31 @ 18:00 CET ([local time](https://www.timeanddate.com/worldclock/fixedtime.html?msg=MindMap+Builder+Launch+Party&iso=20260131T17&p1=%3A&ah=1))
> - Sun Feb 1 @ 09:00 CET ([local time](https://www.timeanddate.com/worldclock/fixedtime.html?msg=MindMap+Builder+Launch+Party&iso=20260201T08&p1=%3A&ah=1))

`,
  "2.20.0": `
<div class="excalidraw-videoWrapper">
<a href="https://www.youtube.com/watch?v=5G9QF-u9w0Q" target="_blank"><img src ="https://i.ytimg.com/vi/5G9QF-u9w0Q/maxresdefault.jpg" style="width:100%;"></a>
</div>

> [!Tip]- Learn MindMap Builder
> Learn it fast with the low-cost [MindMap Builder course](https://visual-thinking-workshop.com/mindmap). Register before **31 Jan** to join a live Q&A:
> - Sat Jan 31 @ 18:00 CET ([local time](https://www.timeanddate.com/worldclock/fixedtime.html?msg=MindMap+Builder+Launch+Party&iso=20260131T17&p1=%3A&ah=1))
> - Sun Feb 1 @ 09:00 CET ([local time](https://www.timeanddate.com/worldclock/fixedtime.html?msg=MindMap+Builder+Launch+Party&iso=20260201T08&p1=%3A&ah=1))

## Scripts
- Moved [Shade Master](https://youtu.be/ISuORbVKyhQ) to use the new Excalidraw Sidepanel API (just like MindMap Builder).

## New
- Dark theme from Excalidraw.com [#10578](https://github.com/excalidraw/excalidraw/pull/10578) (including correct emoji rendering in dark mode 😍).
- New image context-menu option (right-click an image) to control whether that image inverts in dark mode
  - Default behavior: SVG-based images (including LaTeX, Mermaid, and nested Excalidraw images) invert in dark mode; bitmap images (PNG/JPG) do not.
- New from Excalidraw.com: chat-style interface for Mermaid TextToDiagrams (requires an OpenAI API key configured in Excalidraw plugin settings). [#10530](https://github.com/excalidraw/excalidraw/pull/10530)
  - Breaking change: the legacy “force SVG” option for Mermaid diagrams is no longer supported. If a diagram can be rendered as Excalidraw, it will be; otherwise, an SVG will be used.
- Moved the Shade Master script to use the new Sidepanel (just like MindMap Builder).

## Fixed
- In full-screen mode on phones, a large area at the top of the screen was left unused. Also fixed an issue where the Obsidian Mobile navigation bar could overlap the Excalidraw toolbar.
- The link indicator in the top-right corner would remain visible even when an element was set to transparent [#2625](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2625)
- Importing PDFs with mixed page sizes could produce distorted pages [#2578](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2578)
- Some PDFs failed to load when importing PDFs as images (notably documents using JPEG2000-compressed images). Also improved handling of certain color profiles and cases where text rendered with missing/incorrect glyphs.
- A long-standing export issue: when exporting in a theme different from the current view (e.g., viewing in dark mode but exporting in light mode), nested Excalidraw images containing bitmap images could export with inverted colors.
`,
};
