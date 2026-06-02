/*
This script implements the unified "Capture Note" workflow, allowing users to select or search for note titles, automatically resolve their template and folder rules, and contextually back-embed visual frames or markdown sections.

![Visual Daily Notes + TODOs in Context: Obsidian Excalidraw, Tasks, Templater, Dataview, ExcaliBrain](https://youtu.be/y3sDfH30ApU)

# Technical Specification: Visual-First Contextual Capture System

## 1. Scope & Objective
This specification dictates the operational logic and flow for a "Capture Note" script running within the `ExcalidrawAutomate` plugin for Obsidian. It creates an integrated environment where ideas are linked continuously between "Originating Notes" (Note A) and "Target Topic Notes" (Note B) using structural visual frames and contextual markdown embeds.

## 2. Global State & Settings (`DNP Config`)
Settings are persisted in Excalidraw's global script settings under the explicit script name `DNP Config` and memory-managed under `window.ExcalidrawCaptureNoteScript` to handle temporary search text tracking across modal lifecycles.

### NoteTypeConfig Schema
Users can configure unlimited dynamic Note Types containing:
*   `folder` (Destination vault path)
*   `template` (Associated `.md` Templater template, extensions cleanly resolved)
*   `prefix` (e.g., `IIB - `)
*   `type` (`file` or `folder`-nested)
*   `icon` (Lucide icon identifier)
*   `ontology` (Action verbs like `reading`, `discussing` for ExcaliBrain/Dataview linkages)

## 3. Modal User Interfaces

### Capture Note Modal (Floating Modal)
*   **Search Box:** Intercepts inputs natively. Uses a custom dropdown logic. Up/Down/Enter keys traverse the auto-complete dropdown, blocking upstream events to prevent the modal from erroneously closing or the FloatingModal calss grabbing the inputs.
*   **Property Autofill:** If a file is searched and matches an existing file, the script parses the document for the `Note type` (in YAML frontmatter or Dataview inline fields) and locks the Link Type to match.
*   **Tab Sequencing:** Enforced structurally via `flex-direction: row-reverse`. Upon tabbing past the ontology dropdown, focus sequentially lands on `Capture Note` > `Link Only` > `Link & Create` > `Settings Cog`.

### Configuration Modal
*   **Two-Tier Settings Design:** 
    *   **Primary Menu:** Shows global sizing variables, property injection preferences, and a clean index of Note Types displaying the associated Lucide Icon, Title, and a `Delete` button. A `Save Settings` CTA resides prominently next to the main header, mirroring the bottom footer.
    *   **Secondary Note Edit Menu:** Opened via the `Edit` button on the primary menu list. This manages individual Note Type parameters. Text inputs for Folder and Templates hook into custom Suggest objects extending `AbstractInputSuggest`.

## 4. Execution Pathway (`start()`)

### Target Resolution & Link Generation
1.  On execution, checks for active text element selections containing WikiLinks.
2.  Triggers `openCaptureModal()`.
3.  Once completed, resolves the required folder routes and constructs the unified target filename.
4.  Generates a raw string `[[Target File]]`.

### File Generation & Templater Injection
*   Checks if the target file exists.
*   If missing, utilizes `app.vault.create` passing the base template configuration. 
*   **Templater Trigger Catching:** Pauses 1000ms. Loads the new file temporarily in a background pane. Forces an explicit `app.commands.executeCommandById("templater-obsidian:replace-in-file-templater")` trigger to ensure template variables unfold, then suspends execution for 1000ms for I/O sync.
*   **Property Injection:** Modifies the compiled markdown document, appending the configured `Note type` key inside either YAML frontmatter or as a Dataview double-colon field (`Note type:: #value`).

### Dual-Note Injection Mechanism
The script assembles dynamic "New Section" labels contextualizing the timestamp and originating location. (e.g., `2026-05-27 Wednesday, Initiator Page`).

**For Visual Formats:**
1.  Calculates lowest-bound coordinate limits (`boundingbox + 100px gap`) on the target Note B.
2.  Creates a designated marker Frame at `(X, Y)` named with the raw section title.
3.  Reactivates Note A's canvas pane.
4.  Calculates local coordinates below the selected text source.
5.  Creates an Image fragment pointing to Note B: `![[Note B#^frame=FRAME_ID]]`.
6.  Injects the selected action verb: `element.link = (discussing:: [[Note B#^frame=FRAME_ID]])`.

**For Markdown Formats:**
1.  Modifies Note B's markdown structure. Safely splits the document based on `# Notes` and `# Excalidraw Data`.
2.  If the Excalidraw JSON payload is commented out via `%%\n# Excalidraw Data`, an empty `# \n\n` section is injected immediately above it to prevent the interactive embeddable from rendering the commented blocks visually.
3.  Generates a second-level header `## [[DNP]], [[Initiator]]` placing it cleanly inside `# Notes`.
4.  Creates an Interactive Markdown Embeddable element on Note B mapping to its own header segment.
5.  Reactivates Note A.
6.  Generates the mirrored Embeddable or Static Image referencing the markdown section, embedding the same Ontology Link metadata to tie the task structures together.
7.  Switches focus permanently to Note B and automatically executes `ea.viewZoomToElements()` centering the screen precisely on the newly built container.

```js*/

const FRAME_MARGIN = 10;

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.23.8")) {
  new Notice("This script requires Excalidraw version 2.23.8 or higher. Please update your plugin.");
  return;
}

// Ensure the global config container exists on the window object
if (!window.ExcalidrawCaptureNoteScript) {
  window.ExcalidrawCaptureNoteScript = {};
}

// -------------------------------------------------------------
// 1. Settings & Storage ("DNP Config")
// -------------------------------------------------------------
ea.activeScript = "DNP Config";
let settings = ea.getScriptSettings();

const DEFAULT_SETTINGS = {
  noteTypes: {},
  DNPConfig: {
    dateFormat: app.internalPlugins.plugins['daily-notes']?.instance?.options?.format || 'YYYY-MM-DD',
    weekFormat: "YYYY-[W]ww",
    monthFormat: "YYYY-MM MMMM",
    recordTime: false,
    timeFormat: app.internalPlugins.plugins['templates']?.instance?.options?.timeFormat || 'HH:mm'
  },
  frameWidth: 1920,
  frameHeight: 1080,
  embedWidth: 400,
  embedHeight: 500,
  imageWidth: 400,
  markdownImageWidth: 400,
  markdownImageHeight: 500,
  markdownEmbedType: "embeddable", // "embeddable" | "image"
  openNoteBBehavior: "adjacent pane", // "new tab" | "adjacent pane" | "same tab"
  useMarkerFrames: true,
  lastSelectedNoteType: "",
  lastSelectedFormat: "Visual",
  addNoteTypeProperty: true,
  noteTypeFieldName: "Note type",
  noteTypePropertyLocation: "frontmatter", // "frontmatter" | "dataview"
  visualTemplateJSON: "", // Template elements
  visualTemplateVAlign: "middle", // "top" | "middle" | "bottom"
  visualTemplateHAlign: "center" // "left" | "center" | "right"
};

// Sync settings with default properties
if (!settings || Object.keys(settings).length === 0) {
  settings = DEFAULT_SETTINGS;
  ea.setScriptSettings(settings);
} else {
  let mutated = false;
  for (const key in DEFAULT_SETTINGS) {
    if (!settings.hasOwnProperty(key)) {
      settings[key] = DEFAULT_SETTINGS[key];
      mutated = true;
    }
  }
  if (mutated) ea.setScriptSettings(settings);
}

// Helper sanitization function for Markdown Section links
function sanitizeLinkSection(text) {
  return text.replace(/[#|^|\[|\]|\|]/g, "").trim();
}

// Retrieve Lucide icon names from the global Obsidian API
const getLucideIconIds = () => {
  return ea.obsidian.getIconIds()
    .filter(id => id.startsWith("lucide-"))
    .map(id => id.replace(/^lucide-/, ""))
    .sort();
};

// -------------------------------------------------------------
// 2. Custom Input Suggest Classes (Folder, Template & Icon Paths)
// -------------------------------------------------------------
// Global flag to track when a suggester was just closed via Escape
let suppressEscape = false;

class FolderSuggest extends ea.obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const folders = app.vault.getAllLoadedFiles()
      .filter(f => f instanceof ea.obsidian.TFolder)
      .map(f => f.path);
    return folders.filter(p => p.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(value, el) { el.setText(value); }
  selectSuggestion(value) {
    this.inputEl.value = value;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
  close() {
    suppressEscape = true;
    setTimeout(() => suppressEscape = false, 150);
    super.close();
  }
}

class TemplateSuggest extends ea.obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const files = app.vault.getMarkdownFiles().map(f => f.path);
    // Strip .md extension before matching and returning
    const cleanFiles = files.map(p => p.endsWith(".md") ? p.slice(0, -3) : p);
    return cleanFiles.filter(p => p.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(value, el) { el.setText(value); }
  selectSuggestion(value) {
    this.inputEl.value = value;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
  close() {
    suppressEscape = true;
    setTimeout(() => suppressEscape = false, 150);
    super.close();
  }
}

class IconSuggest extends ea.obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const iconIds = getLucideIconIds();
    return iconIds.filter(id => id.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(value, el) {
    el.empty();
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "8px";
    el.style.padding = "4px 8px";
    const iconEl = el.createSpan();
    iconEl.innerHTML = ea.obsidian.getIcon("lucide-" + value)?.outerHTML || "";
    el.createSpan({ text: value });
  }
  selectSuggestion(value) {
    this.inputEl.value = value;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
  close() {
    suppressEscape = true;
    setTimeout(() => suppressEscape = false, 150);
    super.close();
  }
}

// -------------------------------------------------------------
// 3. Helper Functions for Note Type and Property Injection
// -------------------------------------------------------------
async function detectNoteType(file) {
  if (!file) return null;
  const content = await app.vault.read(file);
  const cache = app.metadataCache.getFileCache(file);
  
  const rawFieldName = settings.noteTypeFieldName || "Note type";
  const sanitizedFieldName = rawFieldName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-]/g, "");
  
  let parsedVal = null;
  
  // Check YAML frontmatter using the sanitized field name or the raw field name as fallback
  if (cache && cache.frontmatter) {
    const key = Object.keys(cache.frontmatter).find(k => k === sanitizedFieldName || k.toLowerCase() === rawFieldName.toLowerCase());
    if (key) {
      parsedVal = String(cache.frontmatter[key]).trim();
    }
  }
  
  // Check Dataview inline field / Markdown field if not found in frontmatter
  if (!parsedVal) {
    const escapedFieldName = rawFieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match `**Note type**: #value` or `Note type:: #value`
    const regex = new RegExp(`(?:^|\\n)(?:\\*\\*)?${escapedFieldName}(?:\\*\\*)?\\s*(?:::|:)\\s*(#?[^\\n]+)`, "i");
    const match = content.match(regex);
    
    if (match) {
      parsedVal = match[1].trim();
    }
  }
  
  if (!parsedVal) return null;
  
  // Strip out '#' prefix and any quotes, then apply strict sanitization for lookup matching
  parsedVal = parsedVal.replace(/^#/, "").replace(/"/g, "");
  const normalizedVal = parsedVal.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-]/g, "");
  
  return Object.keys(settings.noteTypes).find(k => {
    const configKeyNormalized = k.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-]/g, "");
    return configKeyNormalized === normalizedVal;
  }) || null;
}

async function injectNoteTypeProperty(file, noteTypeKey, cleanFilename, opt) {
  if (!settings.addNoteTypeProperty && !(opt && opt.prefix)) return;
  
  // Strict sanitization: Only letters, numbers, underscores, and hyphens. 
  // Replace spaces with dash, convert to lowercase.
  const sanitizedVal = noteTypeKey.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-]/g, "");
  const rawFieldName = settings.noteTypeFieldName || "Note type";
  const sanitizedFieldName = rawFieldName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-]/g, "");
  
  // Use Obsidian's native API to safely manage frontmatter
  await app.fileManager.processFrontMatter(file, (fm) => {
    // Only inject frontmatter properties and tags if the location is set to frontmatter
    if (settings.addNoteTypeProperty && settings.noteTypePropertyLocation === "frontmatter") {
      // Inject the tag (without the # prefix) to the tags array safely
      if (!fm.tags) {
        fm.tags = [sanitizedVal];
      } else if (Array.isArray(fm.tags)) {
        if (!fm.tags.includes(sanitizedVal)) {
          fm.tags.push(sanitizedVal);
        }
      } else if (typeof fm.tags === "string") {
        const tagArray = fm.tags.split(",").map(t => t.trim());
        if (!tagArray.includes(sanitizedVal)) {
          fm.tags = [...tagArray, sanitizedVal];
        }
      }
      
      // Inject the Note Type in frontmatter using the sanitized field name
      // Obsidian's js-yaml engine automatically adds quotes around strings starting with '#'
      fm[sanitizedFieldName] = `#${sanitizedVal}`;
    }

    // Inject alias if the note type has a prefix defined
    if (opt && opt.prefix && cleanFilename) {
      if (!fm.aliases) {
        fm.aliases = [cleanFilename];
      } else if (Array.isArray(fm.aliases)) {
        if (!fm.aliases.includes(cleanFilename)) {
          fm.aliases.push(cleanFilename);
        }
      } else if (typeof fm.aliases === "string") {
        const aliasArray = fm.aliases.split(",").map(a => a.trim());
        if (!aliasArray.includes(cleanFilename)) {
          fm.aliases = [...aliasArray, cleanFilename];
        }
      }
    }
  });

  // Inject Note Type as a Markdown/Dataview property if preferred
  if (settings.addNoteTypeProperty && settings.noteTypePropertyLocation !== "frontmatter") {
    const content = await app.vault.read(file);
    
    // Dataview supports `**Key**: Value` or `Key:: Value`.
    // Use a single colon if the user provided bold markers, otherwise use double colons.
    const separator = rawFieldName.includes("**") ? ":" : "::";
    const dvString = `${rawFieldName}${separator} #${sanitizedVal}\n\n`;
    
    // Check if the property already exists to prevent duplication
    if (!content.includes(`${rawFieldName}${separator} #${sanitizedVal}`)) {
      const yamlRegex = /^---[\s\S]*?---/;
      if (yamlRegex.test(content)) {
        const match = content.match(yamlRegex)[0];
        const modifiedContent = content.replace(yamlRegex, match + "\n" + dvString);
        await app.vault.modify(file, modifiedContent);
      } else {
        await app.vault.modify(file, dvString + content);
      }
    }
  }
}

// -------------------------------------------------------------
// 4. Core Execution Flow (Refactored)
// -------------------------------------------------------------

// Extracts the initial text from either standard elements or mindmap nodes
async function extractInitialTextAndMindmapState(originView, activeElement, textEl) {
  const mmAPI = window.MindMapBuilderAPI;
  let isMindmapNode = false;
  let mindmapNodeText = "";
  let mmNodeId = null;

  if (mmAPI && activeElement) {
    mmAPI.setView(originView);
    const selRes = mmAPI.getSelection();
    if (selRes.ok && selRes.data.nodeId) {
      mmNodeId = selRes.data.nodeId;
      const nodeTextRes = mmAPI.getNodeText(mmNodeId);
      if (nodeTextRes.ok && nodeTextRes.data) {
        isMindmapNode = true;
        mindmapNodeText = nodeTextRes.data.text;
      }
    }
  }

  let initialLinkText = window.ExcalidrawCaptureNoteScript.tempSearchValue || "";
  window.ExcalidrawCaptureNoteScript.tempSearchValue = "";

  // Extract text if a single WikiLink is selected on canvas
  if (!initialLinkText) {
    if (isMindmapNode && mindmapNodeText) {
      const linkMatch = mindmapNodeText.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
      if (linkMatch) initialLinkText = linkMatch[1];
    } else if (textEl && textEl.rawText) {
      const linkMatch = textEl.rawText.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
      if (linkMatch) initialLinkText = linkMatch[1];
    }
  }

  return { isMindmapNode, mindmapNodeText, mmNodeId, initialLinkText, mmAPI };
}

// Ensures the target file exists, applying templates and properties if newly created
async function ensureTargetFileExists(folder, filename, fname, opt, noteType) {
  let file = app.vault.getFileByPath(fname);
  let isNewFile = !file;

  if (isNewFile) {
    let templateContent = "# Notes\n";
    if (opt.template) {
      const templatePath = opt.template.endsWith(".md") ? opt.template : opt.template + ".md";
      const tFile = app.vault.getFileByPath(templatePath);
      if (tFile) {
        templateContent = await app.vault.read(tFile);
      }
    }

    await ea.checkAndCreateFolder(folder);
    if (opt.type === "folder") {
      await ea.checkAndCreateFolder(`${folder}/${filename}`);
    }

    file = await app.vault.create(fname, templateContent);
    new Notice("Created file: " + file.basename, 3000);

    // Wait for Templater plugin auto-trigger 
    let templaterDidTrigger = false;
    await new Promise((resolve) => {
      let resolved = false;

      // Fallback timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          app.vault.off('modify', onModify);
          resolve();
        }
      }, 1000);

      // Immediate trigger on file modification
      const onModify = (modifiedFile) => {
        if (modifiedFile.path === file.path && !resolved) {
          resolved = true;
          templaterDidTrigger = true;
          clearTimeout(timeout);
          app.vault.off('modify', onModify);
          resolve();
        }
      };

      app.vault.on('modify', onModify);
    });

    if (!templaterDidTrigger) {
      const checkFileContent = await app.vault.read(file);
      // Manual fallback for Templater just in case
      if (checkFileContent.includes("<"+"%")) { //split to avoid Templater throwing an error on synchronization
        try {
          const tempCmd = app.commands.commands["templater-obsidian:replace-in-file-templater"];
          if (tempCmd) {
            if (tempCmd.callback) tempCmd.callback();
            else if (tempCmd.checkCallback) tempCmd.checkCallback(false);
            await sleep(1000);
          }
        } catch (e) { }
      }
    }

    // Inject note type metadata and alias strictly after Templater finishes
    await injectNoteTypeProperty(file, noteType, filename, opt);
  }
  return file;
}

// Resolves the Obsidian leaf behavior and explicitly waits for load instantiation
async function openAndResolveTargetLeaf(file, originView, openNoteBBehavior) {
  let noteBWorkspaceLeaf;
  if (openNoteBBehavior === "adjacent pane") {
    noteBWorkspaceLeaf = ea.openFileInNewOrAdjacentLeaf(file);
  } else if (openNoteBBehavior === "new tab") {
    noteBWorkspaceLeaf = app.workspace.getLeaf("tab");
    await noteBWorkspaceLeaf.openFile(file, { active: true });
  } else {
    noteBWorkspaceLeaf = originView.leaf;
    await noteBWorkspaceLeaf.openFile(file, { active: true });
  }

  // Explicitly wait until the target leaf has fully instantiated its File representation 
  let leafWatchdog = 0;
  while (noteBWorkspaceLeaf.view?.file?.path !== file.path && leafWatchdog++ < 40) {
    await sleep(50);
  }
  return noteBWorkspaceLeaf;
}

// Generates the note header titles based on origin file context
function buildCaptureHeaders(originView) {
  const fileTitle = originView.file.basename;
  const dnpConfig = settings.DNPConfig;
  const isCurrentDNP = moment(fileTitle, dnpConfig.dateFormat, true).isValid();
  const todayDNPBasename = isCurrentDNP
    ? fileTitle
    : moment().format(dnpConfig.dateFormat);

  let sectionRawText = "";
  let sectionWithBrackets = "";

  if (isCurrentDNP) {
    sectionRawText = `${fileTitle}`;
    sectionWithBrackets = `[[${fileTitle}]]`;
  } else {
    sectionRawText = `${fileTitle}, ${todayDNPBasename}`;
    sectionWithBrackets = `[[${fileTitle}]], [[${todayDNPBasename}]]`;
  }

  return { sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP };
}

// Forces Excalidraw view mode and returns the target note's API instance
async function prepareTargetExcalidrawView(noteBWorkspaceLeaf) {
  if (noteBWorkspaceLeaf.view.getViewType() !== 'excalidraw') {
    app.workspace.setActiveLeaf(noteBWorkspaceLeaf, { focus: true });
    
    // Give Obsidian's layout engine time to register the leaf as fully active.
    // This prevents the toggle command from silently failing on a cold boot.
    await sleep(200);

    const cmd = app.commands.commands["obsidian-excalidraw-plugin:toggle-excalidraw-view"];
    if (cmd) {
      if (cmd.callback) cmd.callback();
      else if (cmd.checkCallback) cmd.checkCallback(false);
    } else {
      await app.commands.executeCommandById("obsidian-excalidraw-plugin:toggle-excalidraw-view");
    }
    
    // Explicitly wait until the view type registers the change, rather than a fixed sleep
    let toggleWatchdog = 0;
    while (noteBWorkspaceLeaf.view.getViewType() !== 'excalidraw' && toggleWatchdog++ < 40) {
      await sleep(50);
    }
  }

  if (noteBWorkspaceLeaf.view.getViewType() !== 'excalidraw') {
    new Notice("Error: Target note could not be loaded into Excalidraw.");
    return null;
  }

  const target_ea = ea.getAPI(noteBWorkspaceLeaf.view);
  let targetWatchdog = 0;
  while ((!target_ea.targetView || !target_ea.getExcalidrawAPI()) && targetWatchdog++ < 40) {
    await sleep(50);
    target_ea.setView(noteBWorkspaceLeaf.view);
  }
  return target_ea;
}

// Injects the visual frame marker and template onto the target Note B
async function injectVisualFormat(target_ea, targetX, targetY, sectionRawText, todayDNPBasename, isCurrentDNP) {
  const fWidth = parseInt(settings.frameWidth) || 1920;
  const fHeight = parseInt(settings.frameHeight) || 1080;

  target_ea.clear();
  const frameID = target_ea.addFrame(targetX, targetY, fWidth, fHeight, sectionRawText);
  const frameEl = target_ea.getElement(frameID);
  if (settings.useMarkerFrames !== false) {
    frameEl.frameRole = "marker";
  }
  
  // Only add the DNP link to the frame if the origin note isn't already the DNP
  if (!isCurrentDNP) {
    const frameOntology = settings.frameOntology || "note";
    frameEl.link = `(${frameOntology}::[[${todayDNPBasename}]])`;
  }

  let clonedTemplateElementIds = [];
  if (settings.visualTemplateJSON) {
    try {
      const parsed = JSON.parse(settings.visualTemplateJSON);
      if (parsed.elements && parsed.elements.length > 0) {
        const clonedElements = target_ea.cloneElements(parsed.elements);
        const bounds = window.ExcalidrawLib.getCommonBounds(clonedElements);
        const boundsWidth = bounds[2] - bounds[0];
        const boundsHeight = bounds[3] - bounds[1];

        let offsetX = 0;
        let offsetY = 0;

        if (settings.visualTemplateHAlign === "left") {
          offsetX = targetX - bounds[0] + FRAME_MARGIN;
        } else if (settings.visualTemplateHAlign === "right") {
          offsetX = targetX + fWidth - bounds[2] - FRAME_MARGIN;
        } else {
          offsetX = targetX + (fWidth - boundsWidth) / 2 - bounds[0];
        }

        if (settings.visualTemplateVAlign === "top") {
          offsetY = targetY - bounds[1] + FRAME_MARGIN;
        } else if (settings.visualTemplateVAlign === "bottom") {
          offsetY = targetY + fHeight - bounds[3] - FRAME_MARGIN;
        } else {
          offsetY = targetY + (fHeight - boundsHeight) / 2 - bounds[1];
        }

        for (const el of clonedElements) {
          el.x += offsetX;
          el.y += offsetY;
          if (!settings.useMarkerFrames) {
            el.frameId = frameID;
          }
          target_ea.elementsDict[el.id] = el;
          clonedTemplateElementIds.push(el.id);
        }
      }
    } catch (e) {
      console.error("Failed to process visual template", e);
    }
  }

  await target_ea.addElementsToView(false, false, true);
  target_ea.clear();

  // Force Excalidraw to save state to disk before we proceed
  if (target_ea.targetView && typeof target_ea.targetView.forceSave === "function") {
    await target_ea.targetView.forceSave(true);
  }
  await sleep(200);

  return { frameID, clonedTemplateElementIds };
}

// Modifies Note B's markdown structure to embed the target container safely
async function injectMarkdownFormat(file, target_ea, targetX, targetY, sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP) {
  const data = await app.vault.read(file);
  const sanitizedSection = sanitizeLinkSection(sectionRawText);
  const newLineText = `## ${sectionWithBrackets}\n\n`;

  async function splitAndInsertContent(source, splitReg, insertValue, sticherText) {
    const parts = source.split(splitReg);
    if (parts.length >= 2) {
      await app.vault.modify(
        file, parts[0] + insertValue + parts.slice(1).join(sticherText)
      );
      return true;
    }
    return false;
  }

  let modified = false;
  if (data.includes("# Notes")) {
    modified = await splitAndInsertContent(data, /# Notes\s*(?:\n|\r\n|\r)/, "# Notes\n" + newLineText, "# Notes\n");
  } else {
    if (data.match(/%%\n+# Excalidraw Data\n/)) {
      const insertVal = "\n# Notes\n\n" + newLineText + "\n\n# \n\n%%\n# Excalidraw Data\n";
      const parts = data.split(/%%\n+# Excalidraw Data\n/);
      await app.vault.modify(file, parts[0].trimEnd() + "\n" + insertVal + parts.slice(1).join("%%\n# Excalidraw Data"));
      modified = true;
    } else if (data.includes("# Excalidraw Data")) {
      const insertVal = "\n# Notes\n\n" + newLineText + "\n# \n\n# Excalidraw Data\n";
      const parts = data.split("# Excalidraw Data");
      await app.vault.modify(file, parts[0].trimEnd() + "\n" + insertVal + parts.slice(1).join("# Excalidraw Data"));
      modified = true;
    } else {
      await app.vault.modify(file, data + "\n\n# Notes\n" + newLineText + "\n\n");
      modified = true;
    }
  }

  // Increased sleep to 1000ms to allow Excalidraw to fully process the file change event
  await sleep(1000);

  const embedWidth = parseInt(settings.embedWidth) || 400;
  const embedHeight = parseInt(settings.embedHeight) || 500;
  const containerLink = `[[${file.basename}#${sanitizedSection}]]`;

  target_ea.clear();
  const frameID = target_ea.addEmbeddable(targetX, targetY, embedWidth, embedHeight, containerLink);
  
  // Conditionally add the link to the embeddable target as well
  if (!isCurrentDNP) {
    const embedEl = target_ea.getElement(frameID);
    const frameOntology = settings.frameOntology || "note";
    // Prepend the containerLink so Excalidraw still recognizes the target of the embeddable
    embedEl.link = `${containerLink} (${frameOntology}::[[${todayDNPBasename}]])`;
  }

  await target_ea.addElementsToView(false, true, true);
  target_ea.clear();

  // Force Excalidraw to save state to disk before we proceed
  if (target_ea.targetView && typeof target_ea.targetView.forceSave === "function") {
    await target_ea.targetView.forceSave(true);
  }
  await sleep(200);

  return frameID;
}

// Injects the cross-link reference and embed onto the Origin Note A
async function injectIntoOriginView(originView, activeElement, format, actionType, file, frameID, sectionRawText, ontologyAction, isMindmapNode, mindmapNodeText, mmAPI, mmNodeId, linkAlias, initialLinkText) {
  const timeStr = settings.DNPConfig.recordTime ? moment().format(settings.DNPConfig.timeFormat) + " " : "";
  const refPath = format === "Visual" ? `^frame=${frameID}` : sanitizeLinkSection(sectionRawText);
  
  const displayAlias = linkAlias ? linkAlias : file.basename;
  const linkStr = `[[${file.path}#${refPath}|${displayAlias}]]`;
  
  const ontologyStr = `(${ontologyAction}:: ${linkStr})`;
  const nodeTextString = `${timeStr}${ontologyStr}`;

  const imgWidth = parseInt(settings.originImageWidth || settings.imageWidth) || 400;

  const isMarkdownImage = settings.markdownEmbedType === "image";

  let embedText = "";
  if (actionType === "CAPTURE_HERE") {
    embedText = `![[${file.path}#${refPath}]]`;
  } else if (format === "Visual" || isMarkdownImage) {
    // Keep the markdown string for MM Node text, which parses |w properly
    embedText = `![[${file.path}#${refPath}|${imgWidth}]]`;
  } else {
    embedText = `![[${file.path}#${refPath}]]`;
  }

  let embeddedElementId;

  if (isMindmapNode && mmAPI && mmNodeId) {
    mmAPI.setView(originView);
    const nodeLinksToTarget = mindmapNodeText.includes(file.path) || mindmapNodeText.includes(file.basename);

    if (nodeLinksToTarget) {
      // Update existing MindMap node text contextually instead of overwriting it
      const mmNode = originView.getViewElements().find(el => el.id === mmNodeId);
      const boundTextEl = ea.getBoundTextElement(mmNode, true)?.sceneElement;
      if (boundTextEl) {
        ea.copyViewElementsToEAforEditing([boundTextEl]);
        const el = ea.getElement(boundTextEl.id);
        
        let newText = el.rawText;
        let linkReplaced = false;

        // Try replacing the specific link captured by the modal
        if (initialLinkText) {
            const escapedLink = initialLinkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const linkRegex = new RegExp(`\\[\\[${escapedLink}(?:\\|.*?)?\\]\\]`);
            if (linkRegex.test(newText)) {
                newText = newText.replace(linkRegex, ontologyStr);
                linkReplaced = true;
            }
        } 
        
        // Fallback to first link found, or append
        if (!linkReplaced) {
            const firstLinkRegex = /\[\[([^\]]+)\]\]/;
            if (firstLinkRegex.test(newText)) {
                newText = newText.replace(firstLinkRegex, ontologyStr);
            }
        }

        // Insert timestamp if enabled
        if (settings.DNPConfig.recordTime && !newText.startsWith(timeStr)) {
            newText = timeStr + newText;
        }

        el.rawText = newText;
        el.text = newText;
        el.originalText = newText;
        await ea.addElementsToView(false, false, false);
        ea.clear();
      }
      
      const res = await mmAPI.addNode({ text: embedText, parentId: mmNodeId });
      if (res.ok) embeddedElementId = res.data.nodeId;
      if (format !== "Visual" && actionType !== "CAPTURE_HERE") {
        await mmAPI.performAction("Dock & hide");
      }
    } else {
      const linkTextToUse = settings.DNPConfig.recordTime ? nodeTextString : ontologyStr;
      const res = await mmAPI.addNode({ text: linkTextToUse, parentId: mmNodeId });
      if (res.ok) {
        const res2 = await mmAPI.addNode({ text: embedText, parentId: res.data.nodeId });
        if (res2.ok) embeddedElementId = res2.data.nodeId;
      }
      if (format !== "Visual" && actionType !== "CAPTURE_HERE") {
        await mmAPI.performAction("Dock & hide");
      }
    }
  } else {
    const xPos = activeElement ? activeElement.x : 0;
    let yPos = activeElement ? activeElement.y + activeElement.height * 1.3 : 0;

    if (activeElement) {
      // Intelligently replace text/links without deleting the active element or container
      const boundTextResult = ea.getBoundTextElement(activeElement, true);
      let textEl = boundTextResult?.eaElement || boundTextResult?.sceneElement;
      
      if (textEl) {
          let newText = textEl.rawText;
          let linkReplaced = false;

          // Try replacing the specific link captured by the modal
          if (initialLinkText) {
              const escapedLink = initialLinkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const linkRegex = new RegExp(`\\[\\[${escapedLink}(?:\\|.*?)?\\]\\]`);
              if (linkRegex.test(newText)) {
                  newText = newText.replace(linkRegex, ontologyStr);
                  linkReplaced = true;
              }
          } 
          
          // Fallback to first link found, or append
          if (!linkReplaced) {
              const firstLinkRegex = /\[\[([^\]]+)\]\]/;
              if (firstLinkRegex.test(newText)) {
                  newText = newText.replace(firstLinkRegex, ontologyStr);
              } else {
                  newText = newText + " " + ontologyStr;
              }
          }

          // Insert timestamp if enabled
          if (settings.DNPConfig.recordTime) {
              newText = timeStr + newText;
          }

          let elsToCopy = [textEl];
          if (textEl.id !== activeElement.id) {
              elsToCopy.push(activeElement);
          }
          ea.copyViewElementsToEAforEditing(elsToCopy);
          
          const eaTextEl = ea.getElement(textEl.id);
          eaTextEl.rawText = newText;
          eaTextEl.text = newText;
          eaTextEl.originalText = newText;
          ea.refreshTextElementSize(eaTextEl.id);
      }
    } else {
      // If there was no active element to begin with
      if (settings.DNPConfig.recordTime) {
        ea.addText(xPos, yPos, nodeTextString);
        const textMetrics = ea.measureText(nodeTextString);
        yPos += textMetrics.height + 10;
      }
    }

    if (actionType === "CAPTURE_HERE" || (format !== "Visual" && !isMarkdownImage)) {
      const eWidth = parseInt(settings.embedWidth) || 400;
      const eHeight = parseInt(settings.embedHeight) || 500;
      embeddedElementId = ea.addEmbeddable(
        xPos, yPos,
        eWidth, eHeight,
        `[[${file.basename}#${refPath}]]`
      );
    } else {
      // Add the image. Note: `addImage` doesn't natively parse the |400 suffix to resize the element 
      // when `scale` is false in ExcalidrawAutomate. We pass the clean path.
      embeddedElementId = await ea.addImage(
        xPos, yPos,
        `${file.path}#${refPath}` 
      );
      
      // Fix Dimensions: Read natural size and scale proportionally
      const embeddedElement = ea.getElement(embeddedElementId);
      if (embeddedElement) {
        if (embeddedElement.height > 0) {
          const ratio = embeddedElement.width / embeddedElement.height;
          embeddedElement.width = imgWidth;
          embeddedElement.height = imgWidth / ratio;
        } else {
          // Fallback if dimensions aren't immediately resolved
          embeddedElement.width = imgWidth;
        }
      }
    }

    const embeddedElement = ea.getElement(embeddedElementId);
    if(embeddedElement) {
      embeddedElement.link = `(${ontologyAction}:: [[${file.path}#${refPath}]])`;
    }

    await ea.addElementsToView(!activeElement, true);
    
    // Auto-resize the container if the text expanded
    if (activeElement && activeElement.type !== "text") {
       ea.getExcalidrawAPI().updateContainerSize([activeElement]);
    }
    
    ea.clear();
  }

  return embeddedElementId;
}

// Completes final focus and zoom
async function handleFinalActionFocus(actionType, originView, noteBWorkspaceLeaf, embeddedElementId, target_ea, format, frameID, clonedTemplateElementIds, mmAPI) {
  if (actionType === "CAPTURE_HERE") {
    if (noteBWorkspaceLeaf && noteBWorkspaceLeaf !== originView.leaf) {
      // Force Excalidraw to save its state to disk before we close the leaf
      if (target_ea && target_ea.targetView && typeof target_ea.targetView.forceSave === "function") {
        await target_ea.targetView.forceSave(true);
      }
      await sleep(1000); // Give file I/O ample time before destroying the view
      noteBWorkspaceLeaf.detach();
    }

    const targetElements = ea.getViewElements().filter(el => el.id === embeddedElementId);
    if (targetElements.length > 0) {
      await mmAPI?.performAction("Dock & hide");
      await sleep(50);
      ea.viewZoomToElements(true, targetElements, 0.1);
    }
  } else {
    app.workspace.setActiveLeaf(noteBWorkspaceLeaf, { focus: true });

    let targetElements = target_ea.getViewElements().filter(el => el.id === frameID);
    if (format === "Visual" && clonedTemplateElementIds.length > 0) {
      const templateElements = target_ea.getViewElements().filter(el => clonedTemplateElementIds.includes(el.id));
      if (targetElements.length > 0) {
        target_ea.viewZoomToElements(false, targetElements, 0.1);
        await sleep(50);
      }
      if (templateElements.length > 0) {
        target_ea.selectElementsInView(templateElements);
      }
    } else {
      if (targetElements.length > 0) {
        target_ea.viewZoomToElements(format !== "Visual", targetElements, 0.1);
      }
    }
  }
}

// Resizes and repositions a single selected frame to encompass other selected elements
async function handleFrameResizingIfEligible() {
  const activeElements = ea.getViewSelectedElements();
  if (!activeElements || activeElements.length < 2) return false;

  const frames = activeElements.filter(el => el.type === "frame" || el.type === "magicframe");
  const nonFrames = activeElements.filter(el => el.type !== "frame" && el.type !== "magicframe");

  // Only trigger if exactly one frame and at least one other element are selected
  if (frames.length === 1 && nonFrames.length > 0) {
    const frame = frames[0];
    const bbox = ea.getBoundingBox(nonFrames);

    ea.copyViewElementsToEAforEditing([frame]);
    const eaFrame = ea.getElement(frame.id);

    // Apply the new wrapped coordinates
    eaFrame.x = bbox.topX - FRAME_MARGIN;
    eaFrame.y = bbox.topY - FRAME_MARGIN;
    eaFrame.width = bbox.width + (FRAME_MARGIN * 2);
    eaFrame.height = bbox.height + (FRAME_MARGIN * 2);

    // Commit changes and maintain the original selection for a smooth user experience
    await ea.addElementsToView(false, false, false);
    ea.selectElementsInView(activeElements);
    
    return true; // Indicates the resizing was handled
  }

  return false;
}

// The core orchestrator function
async function start() {
  const originView = ea.targetView;
  if (!originView) {
    new Notice("No active Excalidraw view found.");
    return;
  }

  // Feature: Quick Frame Resizing
  // If a single frame and other elements are selected, resize the frame to wrap the elements and exit early.
  if (await handleFrameResizingIfEligible()) {
    return;
  }

  const activeElement = ea.getViewSelectedElement();
  let textEl = ea.getBoundTextElement(activeElement, true)?.sceneElement;

  // 1. Setup Mindmap & Extract Initial Text
  const { isMindmapNode, mindmapNodeText, mmNodeId, initialLinkText, mmAPI } = await extractInitialTextAndMindmapState(originView, activeElement, textEl);

  // 2. Open Modal
  const captureData = await openCaptureModal(initialLinkText);
  if (!captureData) return;

  const { filename, noteType, format, ontologyAction, actionType, openNoteBBehavior } = captureData;
  const opt = settings.noteTypes[noteType];

  if (!opt) {
    new Notice("Error: Note Type configuration is missing. Open Settings to configure Note Types.");
    return;
  }

  const folder = ea.obsidian.normalizePath(opt.folder);

  // 3. Assemble WikiLink and File Path
  // Parse potential manual aliases (e.g. "Full note title|alias")
  let rawFilename = filename;
  let linkAlias = filename;
  if (filename.includes("|")) {
    const parts = filename.split("|");
    rawFilename = parts[0].trim();
    linkAlias = parts.slice(1).join("|").trim();
  }

  // Fix: Prevent duplicating the prefix if the user selected an existing file 
  // or manually typed the prefix, and isolate the clean title for folder creation
  let cleanFilename = rawFilename;
  if (opt.prefix && cleanFilename.startsWith(opt.prefix)) {
    cleanFilename = cleanFilename.substring(opt.prefix.length);
  }
  let targetBasename = `${opt.prefix ?? ""}${cleanFilename}`;

  // Check if the file already exists anywhere in the vault
  let fileTarget = app.metadataCache.getFirstLinkpathDest(targetBasename, "");

  let targetWikiLink;
  let fname;

  if (fileTarget) {
    // Existing file found, use its actual path instead of forcing it into opt.folder
    fname = fileTarget.path;
    targetWikiLink = `[[${fileTarget.path.replace(/\.md$/, "")}|${linkAlias}]]`;
  } else {
    // New file, construct the path using the configured folder and folder-nesting settings
    let folderPath = (opt.type === "folder") ? `${folder}/${cleanFilename}` : folder;
    targetWikiLink = `[[${folderPath}/${targetBasename}|${linkAlias}]]`;
    fname = `${folderPath}/${targetBasename}.md`;
  }

  if (actionType === "ADD_LINK_ONLY") {
    ea.addText(0, 0, targetWikiLink);
    await ea.addElementsToView(true, true, true);
    ea.clear();
    return;
  }

  // 4. Create File if new
  // Pass the cleanFilename so nested folders are created without the prefix (e.g. Title instead of IIB - Title)
  const file = await ensureTargetFileExists(folder, cleanFilename, fname, opt, noteType);

  // 5. Open Target Leaf
  const noteBWorkspaceLeaf = await openAndResolveTargetLeaf(file, originView, openNoteBBehavior);

  if (actionType === "ADD_LINK_CREATE") {
    if (!textEl && !isMindmapNode) {
      ea.clear();
      ea.addText(0, 0, targetWikiLink);
      await ea.addElementsToView(true, true, true);
      ea.clear();
    }
    new Notice(`Created file: ${file.basename}`);
    return;
  }

  // 6. Setup Capture variables (destructure isCurrentDNP flag)
  const { sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP } = buildCaptureHeaders(originView);

  // 7. Ensure Target View is Excalidraw and get API
  const target_ea = await prepareTargetExcalidrawView(noteBWorkspaceLeaf);
  if (!target_ea) return;

  // 8. Calculate insertion bounds on Target Note
  const bElements = target_ea.getViewElements();
  let targetX = 0;
  let targetY = 0;
  if (bElements.length > 0) {
    const bbox = target_ea.getBoundingBox(bElements);
    targetX = bbox.topX;
    targetY = bbox.topY + bbox.height + 100;
  }

  // 9. Inject onto Target Note
  let frameID = null;
  let clonedTemplateElementIds = [];
  if (format === "Visual") {
    // Pass isCurrentDNP downstream
    const visualRes = await injectVisualFormat(target_ea, targetX, targetY, sectionRawText, todayDNPBasename, isCurrentDNP);
    frameID = visualRes.frameID;
    clonedTemplateElementIds = visualRes.clonedTemplateElementIds;
  } else {
    // Pass todayDNPBasename and isCurrentDNP to correctly map properties on the embeddable target
    frameID = await injectMarkdownFormat(file, target_ea, targetX, targetY, sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP);
  }

  // 10. Focus back to Origin Note A
  app.workspace.setActiveLeaf(originView.leaf, { focus: true });
  await sleep(200);

  // 11. Inject Origin Embed/Link (passing the linkAlias AND the initialLinkText)
  const embeddedElementId = await injectIntoOriginView(
    originView, activeElement, format, actionType, file, frameID, sectionRawText,
    ontologyAction, isMindmapNode, mindmapNodeText, mmAPI, mmNodeId, linkAlias, initialLinkText
  );

  // 12. Final Focus / Zoom
  await handleFinalActionFocus(actionType, originView, noteBWorkspaceLeaf, embeddedElementId, target_ea, format, frameID, clonedTemplateElementIds, mmAPI);
}

// -------------------------------------------------------------
// 5. UI: Capture Note Modal (Refactored)
// -------------------------------------------------------------

function setupCaptureModalEscapeHandler(modal) {
  const escapeKey = modal.scope.keys.find(k => k.key === "Escape");
  if (escapeKey) {
    const originalFunc = escapeKey.func;
    escapeKey.func = (e) => {
      // Block modal closure if a child suggester was just closed
      if (suppressEscape) return false;
      
      // Block modal closure if custom dropdown is open
      const customDropdown = modal.modalEl.querySelector(".mindmap-search-results");
      if (customDropdown && customDropdown.style.display === "block") {
        customDropdown.style.display = "none";
        return false;
      }
      
      // Block modal closure if any standard Obsidian suggester is currently open
      const suggests = document.body.querySelectorAll('.suggestion-container');
      for (const s of suggests) {
        if (s.style.display !== "none") {
          return false; 
        }
      }
      return originalFunc(e);
    };
  }
}

function injectCaptureModalStyles(contentEl) {
  contentEl.createEl("style", {
    text: `
      .mindmap-search-container { position: relative; margin-bottom: 12px; }
      .mindmap-search-results {
        position: absolute; width: 100%; max-height: 180px; overflow-y: auto;
        background: var(--background-primary); border: 1px solid var(--background-modifier-border);
        border-radius: 4px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.15); display: none;
      }
      .mindmap-search-item { padding: 6px 12px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border); }
      .mindmap-search-item:hover { background-color: var(--background-modifier-hover); }
      .mindmap-search-item.is-selected { background-color: var(--background-modifier-hover); }
      .link-type-row-control { display: flex; align-items: center; gap: 8px; width: 100%; }
    `
  });
}

function buildCaptureSearchBox(contentEl, state, callbacks) {
  const searchContainer = contentEl.createDiv({ cls: "mindmap-search-container" });
  const searchSetting = new ea.obsidian.Setting(searchContainer)
    .setName("Note Title")
    .setDesc("Select topic or write new name");
  
  let searchInput;
  const resultsDropdown = searchContainer.createDiv({ cls: "mindmap-search-results" });
  state.ui.resultsDropdown = resultsDropdown;

  let activeIndex = -1;
  let matchedItems = [];

  const selectItemAtActiveIndex = () => {
    if (activeIndex >= 0 && activeIndex < matchedItems.length) {
      const selectedItem = matchedItems[activeIndex];
      let inputValue = selectedItem.basename;
      if (selectedItem.type === "alias") {
        inputValue = `${selectedItem.basename}|${selectedItem.alias}`;
      }
      searchInput.setValue(inputValue);
      resultsDropdown.style.display = "none";
      callbacks.onFileSelected(inputValue);
    }
  };

  const renderActiveItem = () => {
    const children = resultsDropdown.children;
    for (let i = 0; i < children.length; i++) {
      if (i === activeIndex) {
        children[i].addClass("is-selected");
        children[i].scrollIntoView({ block: "nearest" });
      } else {
        children[i].removeClass("is-selected");
      }
    }
  };

  const updateSearchDropdown = (query) => {
    resultsDropdown.empty();
    activeIndex = -1;
    if (!query) {
      resultsDropdown.style.display = "none";
      matchedItems = [];
      return;
    }
    const q = query.toLowerCase();
    
    // Deduplicate items based on their structural payload
    const uniqueItems = new Map();
    state.searchItems.forEach(item => {
      const searchableText = item.type === "alias" ? `${item.basename} ${item.alias}` : item.basename;
      if (searchableText.toLowerCase().includes(q)) {
        const key = item.type === "alias" ? `alias:${item.basename}:${item.alias}` : `${item.type}:${item.basename}`;
        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        }
      }
    });
    matchedItems = Array.from(uniqueItems.values()).slice(0, 8);
    
    if (matchedItems.length > 0) {
      resultsDropdown.style.display = "block";
      matchedItems.forEach((item) => {
        let displayText = item.basename;
        if (item.type === "alias") {
          displayText = `${item.alias} (Alias for: ${item.basename})`;
        } else if (item.type === "unresolved") {
          displayText = `${item.basename} (Placeholder)`;
        }
        
        const divItem = resultsDropdown.createDiv({ cls: "mindmap-search-item", text: displayText });
        divItem.addEventListener("click", () => {
          let inputValue = item.basename;
          if (item.type === "alias") {
            inputValue = `${item.basename}|${item.alias}`;
          }
          searchInput.setValue(inputValue);
          resultsDropdown.style.display = "none";
          callbacks.onFileSelected(inputValue);
        });
      });
    } else {
      resultsDropdown.style.display = "none";
    }
  };

  searchSetting.addText(text => {
    searchInput = text;
    state.ui.searchInput = text;
    text.inputEl.style.width = "100%";
    text.setValue(state.initialSearchValue);
    text.inputEl.placeholder = "Search existing file...";
    text.inputEl.addEventListener("input", (e) => {
      updateSearchDropdown(e.target.value);
      callbacks.onFileSelected(e.target.value);
    });
    setTimeout(() => text.inputEl.focus(), 150);
  });

  // Custom Navigation Handler
  searchInput.inputEl.addEventListener("keydown", (e) => {
    if (resultsDropdown.style.display === "block" && matchedItems.length > 0) {
      if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
        e.stopPropagation(); 
        e.preventDefault();
        
        if (e.key === "ArrowDown") {
          activeIndex = (activeIndex + 1) % matchedItems.length;
          renderActiveItem();
        } else if (e.key === "ArrowUp") {
          activeIndex = (activeIndex - 1 + matchedItems.length) % matchedItems.length;
          renderActiveItem();
        } else if (e.key === "Enter" || e.key === "Tab") {
          selectItemAtActiveIndex();
        } else if (e.key === "Escape") {
          resultsDropdown.style.display = "none";
          suppressEscape = true;
          setTimeout(() => suppressEscape = false, 150);
        }
      }
    }
  }, { capture: true });

  if (state.initialSearchValue) {
    callbacks.onFileSelected(state.initialSearchValue);
  }
}

function buildCaptureLinkTypeSelector(contentEl, state, callbacks) {
  const noteTypeKeys = Object.keys(settings.noteTypes).sort();
  let selectedNoteType = state.selectedNoteType;
  if (!selectedNoteType || !noteTypeKeys.includes(selectedNoteType)) {
    selectedNoteType = noteTypeKeys[0] || "";
    state.selectedNoteType = selectedNoteType;
  }

  const linkTypeRow = new ea.obsidian.Setting(contentEl).setName("Link Type");
  linkTypeRow.controlEl.addClass("link-type-row-control");
  const iconPreviewSpan = linkTypeRow.controlEl.createSpan();
  state.ui.iconPreviewSpan = iconPreviewSpan;

  linkTypeRow.addDropdown(dropdown => {
    state.ui.dropdownComponent = dropdown;
    noteTypeKeys.forEach(k => dropdown.addOption(k, k));
    dropdown.setValue(selectedNoteType);
    dropdown.onChange(val => {
      state.selectedNoteType = val;
      settings.lastSelectedNoteType = val;
      ea.setScriptSettings(settings);
      callbacks.updateIconPreview();
      callbacks.updateOntologyDropdown();
    });
  });

  callbacks.updateIconPreview();
}

function buildCaptureFormatSelector(contentEl, state) {
  new ea.obsidian.Setting(contentEl)
    .setName("Note Format")
    .addDropdown(dropdown => {
      dropdown.addOption("Visual", "Visual (Excalidraw)")
              .addOption("Markdown", "Text (Markdown)")
              .setValue(state.selectedFormat)
              .onChange(val => { 
                state.selectedFormat = val; 
                settings.lastSelectedFormat = val;
                ea.setScriptSettings(settings);
                if (state.ui.captureHereBtnReference) {
                  state.ui.captureHereBtnReference.style.display = val === "Markdown" ? "" : "none";
                }
              });
    });
}

function buildCaptureOpenBehaviorSelector(contentEl, state) {
  new ea.obsidian.Setting(contentEl)
    .setName("Open Note Location")
    .addDropdown(dropdown => dropdown
      .addOption("new tab", "New Tab")
      .addOption("adjacent pane", "Adjacent Split Window")
      .addOption("same tab", "Same Active Tab")
      .setValue(state.openNoteBBehavior)
      .onChange(val => {
        state.openNoteBBehavior = val;
        settings.openNoteBBehavior = val;
        ea.setScriptSettings(settings);
      })
    );
}

function buildCaptureOntologySelector(contentEl, state, callbacks) {
  new ea.obsidian.Setting(contentEl)
    .setName("Ontology Relation")
    .addDropdown(dropdown => {
      state.ui.ontologyDropdownComponent = dropdown;

      dropdown.onChange(val => {
        state.selectedOntology = val;
      });
      
      callbacks.updateOntologyDropdown();
    });
}

function buildCaptureFooter(contentEl, state, modal) {
  // Enforced structurally via flex-direction: row-reverse for tab indexing
  const footer = contentEl.createDiv({
    attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-direction: row-reverse;" }
  });

  const buttonGroup = footer.createDiv({ attr: { style: "display: flex; gap: 8px; flex-direction: row-reverse;" } });

  const handleAction = (actionType) => {
    const val = state.ui.searchInput.getValue().trim();
    if (!val) { new Notice("Please write a valid note title"); return; }
    state.finalData = {
      filename: val,
      noteType: state.selectedNoteType,
      format: state.selectedFormat,
      ontologyAction: state.selectedOntology,
      actionType,
      openNoteBBehavior: state.openNoteBBehavior
    };
    modal.close();
  };

  const captureBtn = buttonGroup.createEl("button", { text: "Capture Note", cls: "mod-cta" });
  captureBtn.addEventListener("click", () => handleAction("CAPTURE"));

  const linkOnlyBtn = buttonGroup.createEl("button", { text: "Link Only" });
  linkOnlyBtn.addEventListener("click", () => handleAction("ADD_LINK_ONLY"));

  const linkCreateBtn = buttonGroup.createEl("button", { text: "Link & Create" });
  linkCreateBtn.addEventListener("click", () => handleAction("ADD_LINK_CREATE"));

  const captureHereBtn = buttonGroup.createEl("button", { text: "Capture Here" });
  captureHereBtn.style.display = state.selectedFormat === "Markdown" ? "" : "none";
  captureHereBtn.addEventListener("click", () => handleAction("CAPTURE_HERE"));
  state.ui.captureHereBtnReference = captureHereBtn;

  const cogBtn = footer.createEl("button", { cls: "clickable-icon" });
  cogBtn.innerHTML = ea.obsidian.getIcon("settings").outerHTML;
  cogBtn.addEventListener("click", () => {
    window.ExcalidrawCaptureNoteScript.tempSearchValue = state.ui.searchInput.getValue().trim();
    modal.close();
    openSettingsModal();
  });
}

async function openCaptureModal(initialSearchValue) {
  return new Promise(resolve => {
    const modal = new ea.FloatingModal(app);
    modal.enableKeyCapture();
    
    setupCaptureModalEscapeHandler(modal);

    modal.modalEl.style.width = "480px";
    modal.modalEl.style.maxWidth = "100%";
    modal.titleEl.setText("Capture Contextual Note");

    // Gather regular files
    let allFiles = app.vault.getMarkdownFiles().concat(app.vault.getFiles().filter(f => ea.isExcalidrawFile(f)));
    
    // Determine template paths to exclude
    const templaterFolder = app.plugins.plugins["templater-obsidian"]?.settings?.templates_folder;
    const excalidrawTemplatePath = ea.plugin.settings.templateFilePath;

    // Filter out template files to keep them out of the search
    allFiles = allFiles.filter(f => {
      // Ensure the path string is valid and not just an empty root folder rule
      if (templaterFolder && templaterFolder.trim() !== "" && f.path.startsWith(templaterFolder)) return false;
      if (excalidrawTemplatePath && excalidrawTemplatePath.trim() !== "" && f.path.startsWith(excalidrawTemplatePath)) return false;
      return true;
    });

    // Construct expanded search items array
    const searchItems = [];
    const fileBasenames = new Set();
    
    // 1. Add real files and their aliases
    allFiles.forEach(f => {
      searchItems.push({ type: "file", basename: f.basename, file: f });
      fileBasenames.add(f.basename);
      
      const cache = app.metadataCache.getFileCache(f);
      if (cache && cache.frontmatter && cache.frontmatter.aliases) {
        const aliases = Array.isArray(cache.frontmatter.aliases) 
          ? cache.frontmatter.aliases 
          : String(cache.frontmatter.aliases).split(",").map(a => a.trim());
        aliases.forEach(a => {
          // Filter out aliases that contain templater code
          if (a && typeof a === "string" && !a.includes("<"+"%")) { //split to avoid Templater throwing an error on synchronization
            searchItems.push({ type: "alias", basename: f.basename, alias: a, file: f });
          }
        });
      }
    });

    // 2. Add unresolved links (placeholders)
    const unresolvedLinks = Object.values(app.metadataCache.unresolvedLinks).flatMap(links => Object.keys(links));
    const uniqueUnresolved = [...new Set(unresolvedLinks)].map(link => {
      const parts = link.split("/");
      return parts[parts.length - 1].replace(/\.md$/i, "");
    });
    
    uniqueUnresolved.forEach(u => {
      // Filter out unresolved links that are just unrendered templater variables
      if (!u.includes("<"+"%") && !fileBasenames.has(u)) { //split to avoid Templater throwing an error on synchronization
        searchItems.push({ type: "unresolved", basename: u });
        fileBasenames.add(u);
      }
    });

    // Unified UI state across the components
    const state = {
      finalData: null,
      initialSearchValue,
      selectedNoteType: settings.lastSelectedNoteType || "",
      selectedFormat: settings.lastSelectedFormat || "Visual",
      openNoteBBehavior: settings.openNoteBBehavior || "adjacent pane",
      selectedOntology: "",
      allFiles: allFiles,
      searchItems: searchItems,
      ui: {} // Stores DOM references dynamically added by builders
    };

    // Shared reactiveness logic
    const callbacks = {
      updateIconPreview: () => {
        const opt = settings.noteTypes[state.selectedNoteType];
        if (opt && opt.icon) {
          state.ui.iconPreviewSpan.innerHTML = ea.obsidian.getIcon("lucide-" + opt.icon)?.outerHTML || "";
        } else {
          state.ui.iconPreviewSpan.innerHTML = "";
        }
      },
      updateOntologyDropdown: () => {
        if (!state.ui.ontologyDropdownComponent || !state.selectedNoteType) return;
        const opt = settings.noteTypes[state.selectedNoteType];
        if (!opt) return;
        const selectEl = state.ui.ontologyDropdownComponent.selectEl;
        while (selectEl.options.length > 0) {
          selectEl.remove(0);
        }
        opt.ontology.actions.forEach(act => {
          state.ui.ontologyDropdownComponent.addOption(act, act);
        });
        state.selectedOntology = opt.ontology.default || opt.ontology.actions[0];
        state.ui.ontologyDropdownComponent.setValue(state.selectedOntology);
      },
      onFileSelected: async (val) => {
        // Strip alias if present to resolve the physical file target
        const actualVal = val.split("|")[0].trim();
        const fileTarget = state.allFiles.find(f => f.basename.toLowerCase() === actualVal.toLowerCase());
        if (fileTarget) {
          const detectedType = await detectNoteType(fileTarget);
          if (detectedType) {
            state.selectedNoteType = detectedType;
            state.ui.dropdownComponent.setValue(detectedType);
            state.ui.dropdownComponent.setDisabled(true);
            callbacks.updateIconPreview();
            callbacks.updateOntologyDropdown();
            return;
          }
        }
        if (state.ui.dropdownComponent) state.ui.dropdownComponent.setDisabled(false);
      }
    };

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.empty();

      injectCaptureModalStyles(contentEl);
      buildCaptureSearchBox(contentEl, state, callbacks);
      buildCaptureLinkTypeSelector(contentEl, state, callbacks);
      buildCaptureFormatSelector(contentEl, state);
      buildCaptureOpenBehaviorSelector(contentEl, state);
      buildCaptureOntologySelector(contentEl, state, callbacks);
      buildCaptureFooter(contentEl, state, modal);
    };

    modal.onClose = () => resolve(state.finalData);
    modal.open();
  });
}

// -------------------------------------------------------------
// 6. UI: Settings & Multi-tier Configuration Modal (Refactored)
// -------------------------------------------------------------

function buildSettingsHeader(contentEl, modal) {
  const headerContainer = contentEl.createDiv({ cls: "settings-header-container" });
  headerContainer.createEl("h2", { text: "DNP Workflows Configuration Panel", attr: { style: "margin:0;" } });
  
  const topSaveBtn = headerContainer.createEl("button", { text: "Save Settings", cls: "mod-cta" });
  topSaveBtn.addEventListener("click", () => {
    ea.setScriptSettings(settings);
    modal.close();
    start();
  });
}

function buildVisualSizingSection(contentEl) {
  const genSection = contentEl.createEl("details", { cls: "setting-sub-section" });
  genSection.createEl("summary", { text: "Visual Sizing & Embed Options" });

  new ea.obsidian.Setting(genSection)
    .setName("Marker Frame Dimensions (Width / Height)")
    .addText(text => text.setValue(String(settings.frameWidth)).onChange(val => { settings.frameWidth = parseInt(val) || 1920; }))
    .addText(text => text.setValue(String(settings.frameHeight)).onChange(val => { settings.frameHeight = parseInt(val) || 1080; }));

  new ea.obsidian.Setting(genSection)
    .setName("Embeddable Element Dimensions (Width / Height)")
    .addText(text => text.setValue(String(settings.embedWidth)).onChange(val => { settings.embedWidth = parseInt(val) || 400; }))
    .addText(text => text.setValue(String(settings.embedHeight)).onChange(val => { settings.embedHeight = parseInt(val) || 500; }));

  // Consolidated image width setting
  new ea.obsidian.Setting(genSection)
    .setName("Originator Note Image Width")
    .setDesc("The default width of the image inserted into note A (height is proportional). Applies to frame and markdown image embeds.")
    .addText(text => text.setValue(String(settings.originImageWidth || settings.imageWidth || 400)).onChange(val => { settings.originImageWidth = parseInt(val) || 400; }));

  new ea.obsidian.Setting(genSection)
    .setName("Markdown Embed Display Format")
    .setDesc("The display format applied to references inside the originating note")
    .addDropdown(dropdown => dropdown
      .addOption("embeddable", "Interactive Embeddable")
      .addOption("image", "Static Markdown Image")
      .setValue(settings.markdownEmbedType)
      .onChange(val => { settings.markdownEmbedType = val; }));

  new ea.obsidian.Setting(genSection)
    .setName("Frame type to use on target note")
    .addDropdown(dropdown => dropdown
      .addOption("Marker Frame", "Marker Frame")
      .addOption("Normal Frame", "Normal Frame")
      .setValue(settings.useMarkerFrames ? "Marker Frame" : "Normal Frame")
      .onChange(val => { settings.useMarkerFrames = (val === "Marker Frame"); }));

  new ea.obsidian.Setting(genSection)
    .setName("Frame Ontology")
    .setDesc("The ontology relation used when linking the frame to the daily note.")
    .addText(text => text.setValue(settings.frameOntology || "note").onChange(val => { settings.frameOntology = val || "note"; }));

  new ea.obsidian.Setting(genSection)
    .setName("Target Note (Note B) Open Location")
    .addDropdown(dropdown => dropdown
      .addOption("new tab", "New Tab")
      .addOption("adjacent pane", "Adjacent Split Window")
      .addOption("same tab", "Same Active Tab")
      .setValue(settings.openNoteBBehavior)
      .onChange(val => { settings.openNoteBBehavior = val; }));
}

async function refreshTemplatePreview(previewDiv, alignSettingsDiv, refreshCallback) {
  previewDiv.empty();
  alignSettingsDiv.empty();
  
  if (!settings.visualTemplateJSON) {
    const pasteBtn = previewDiv.createEl("button", { text: "Paste Excalidraw Elements from Clipboard" });
    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (parsed.type === "excalidraw/clipboard" && parsed.elements) {
          if (parsed.elements.some(e => e.type === "image")) {
            new Notice("Image elements are not supported in visual templates.");
            return;
          }
          settings.visualTemplateJSON = text;
          ea.setScriptSettings(settings);
          refreshCallback();
        } else {
          new Notice("Clipboard does not contain valid Excalidraw elements.");
        }
      } catch (e) {
        new Notice("Failed to read Excalidraw clipboard JSON.");
      }
    });
  } else {
    try {
      const parsed = JSON.parse(settings.visualTemplateJSON);
      const svg = await ea.createViewSVG({
        elementsOverride: parsed.elements,
        withBackground: false,
        padding: 10
      });
      svg.style.maxWidth = "100%";
      svg.style.maxHeight = "200px";
      svg.style.border = "1px dashed var(--background-modifier-border)";
      svg.style.background = "var(--background-secondary)";
      
      const headerRow = previewDiv.createDiv({ cls: "flex-row-spaced", attr: { style: "margin-bottom: 10px;" }});
      headerRow.appendChild(svg);
      
      const delBtn = headerRow.createEl("button", { cls: "clickable-icon" });
      delBtn.innerHTML = ea.obsidian.getIcon("trash-2").outerHTML;
      delBtn.addEventListener("click", () => {
        settings.visualTemplateJSON = "";
        ea.setScriptSettings(settings);
        refreshCallback();
      });
      
      new ea.obsidian.Setting(alignSettingsDiv)
        .setName("Vertical Alignment")
        .addDropdown(d => d
          .addOption("top", "Top")
          .addOption("middle", "Middle")
          .addOption("bottom", "Bottom")
          .setValue(settings.visualTemplateVAlign || "middle")
          .onChange(v => { settings.visualTemplateVAlign = v; ea.setScriptSettings(settings); })
        );
        
      new ea.obsidian.Setting(alignSettingsDiv)
        .setName("Horizontal Alignment")
        .addDropdown(d => d
          .addOption("left", "Left")
          .addOption("center", "Center")
          .addOption("right", "Right")
          .setValue(settings.visualTemplateHAlign || "center")
          .onChange(v => { settings.visualTemplateHAlign = v; ea.setScriptSettings(settings); })
        );
    } catch (e) {
      settings.visualTemplateJSON = "";
      ea.setScriptSettings(settings);
      refreshCallback();
      new Notice("Failed to load visual template preview.");
    }
  }
}

function buildVisualTemplateSection(contentEl) {
  const templateSection = contentEl.createEl("details", { cls: "setting-sub-section" });
  templateSection.createEl("summary", { text: "Visual Template Elements" });
  
  const previewDiv = templateSection.createDiv();
  const alignSettingsDiv = templateSection.createDiv();

  const refreshCallback = () => refreshTemplatePreview(previewDiv, alignSettingsDiv, refreshCallback);
  refreshCallback();
}

function buildPropertyInjectionSection(contentEl) {
  const propSection = contentEl.createEl("details", { cls: "setting-sub-section" });
  propSection.createEl("summary", { text: "Automatic Note Type Property" });
  
  propSection.createEl("p", {
    text: "Note Type can be used in ExcaliBrain to add custom styling to these nodes. Note Type is also helpful in automatically filtering available ontology options on the capture note dialog.",
    attr: { style: "margin-bottom: 15px; color: var(--text-muted); font-size: 0.9em;" }
  });

  new ea.obsidian.Setting(propSection)
    .setName("Add Note Type Property")
    .addToggle(toggle => toggle.setValue(settings.addNoteTypeProperty).onChange(val => { settings.addNoteTypeProperty = val; }));

  new ea.obsidian.Setting(propSection)
    .setName("Note Type Field Name")
    .addText(text => text.setValue(settings.noteTypeFieldName || "Note type").onChange(val => { settings.noteTypeFieldName = val || "Note type"; }));

  new ea.obsidian.Setting(propSection)
    .setName("Property Format / Location")
    .addDropdown(dropdown => dropdown
      .addOption("frontmatter", "YAML Frontmatter")
      .addOption("dataview", "Dataview Inline Field")
      .setValue(settings.noteTypePropertyLocation)
      .onChange(val => { settings.noteTypePropertyLocation = val; }));
}

function buildDateSettingsSection(contentEl) {
  const dateSection = contentEl.createEl("details", { cls: "setting-sub-section" });
  dateSection.createEl("summary", { text: "Date Settings (DNPConfig)" });
  
  dateSection.createEl("p", { 
    attr: { style: "margin-bottom: 15px; color: var(--text-muted); font-size: 0.9em;" } 
  }, el => {
    el.appendText("Configure the moment.js date formats used for Daily, Weekly, and Monthly notes. For syntax help, see ");
    el.createEl("a", { href: "https://momentjs.com/docs/#/displaying/format", text: "Moment.js Documentation" });
    el.appendText(".");
  });

  const createDateSetting = (name, desc, key) => {
    let previewEl;
    new ea.obsidian.Setting(dateSection)
      .setName(name)
      .setDesc(createFragment(frag => {
        frag.appendText(desc);
        frag.createEl("br");
        frag.createEl("br");
        frag.appendText("Preview: ");
        previewEl = frag.createEl("b", { text: moment().format(settings.DNPConfig[key]) });
      }))
      .addText(text => {
        text.setValue(settings.DNPConfig[key]).onChange(val => {
          settings.DNPConfig[key] = val;
          previewEl.setText(moment().format(val));
        });
      });
  };

  createDateSetting("Daily Note Format", "Format template for standard daily notes.", "dateFormat");
  createDateSetting("Weekly Note Format", "Format template for weekly notes.", "weekFormat");
  createDateSetting("Monthly Note Format", "Format template for monthly notes.", "monthFormat");

  new ea.obsidian.Setting(dateSection)
    .setName("Record Link Time")
    .setDesc("If enabled, an interstitial journaling time string will be prepended to the captured link.")
    .addToggle(toggle => toggle.setValue(settings.DNPConfig.recordTime).onChange(val => { settings.DNPConfig.recordTime = val; }));

  let timePreviewEl;
  new ea.obsidian.Setting(dateSection)
    .setName("Time Format String")
    .setDesc(createFragment(frag => {
        frag.appendText("Format template for the interstitial time. ");
        frag.createEl("br");
        frag.appendText("Preview: ");
        timePreviewEl = frag.createEl("b", { text: moment().format(settings.DNPConfig.timeFormat) });
    }))
    .addText(text => {
        text.setValue(settings.DNPConfig.timeFormat).onChange(val => {
            settings.DNPConfig.timeFormat = val;
            timePreviewEl.setText(moment().format(val));
        });
    });
}

function refreshNoteTypesList(listContainer, refreshCallback) {
  listContainer.empty();
  const keys = Object.keys(settings.noteTypes).sort();
  if (keys.length === 0) {
    listContainer.createEl("p", { text: "No custom note types configured yet.", attr: { style: "text-align:center;color:var(--text-muted);padding:10px 0;" } });
    return;
  }

  keys.forEach(key => {
    const item = settings.noteTypes[key];
    const row = listContainer.createDiv({ cls: "note-type-list-item" });
    
    const metaWrapper = row.createDiv({ cls: "note-type-meta-wrapper" });
    const iconSpan = metaWrapper.createSpan();
    iconSpan.innerHTML = ea.obsidian.getIcon("lucide-" + (item.icon || "file"))?.outerHTML || "";
    metaWrapper.createSpan({ text: key, attr: { style: "font-weight:bold;" } });

    let templateDisplay = "";
    if (item.template) {
      const pathParts = item.template.split("/");
      let fileName = pathParts[pathParts.length - 1];
      if (fileName.toLowerCase().endsWith(".md")) {
        fileName = fileName.substring(0, fileName.length - 3);
      }
      templateDisplay = ` | ${fileName}`;
    }

    metaWrapper.createSpan({ text: `(${item.type})${templateDisplay}`, attr: { style: "font-size:0.85em;color:var(--text-muted);" } });

    const btnWrapper = row.createDiv({ cls: "note-type-btn-wrapper" });
    
    const editBtn = btnWrapper.createEl("button", { cls: "clickable-icon" });
    editBtn.innerHTML = ea.obsidian.getIcon("pencil").outerHTML;
    editBtn.addEventListener("click", () => {
      openEditNoteTypeModal(key, () => {
        ea.setScriptSettings(settings);
        refreshCallback();
      });
    });

    const deleteBtn = btnWrapper.createEl("button", { cls: "clickable-icon" });
    deleteBtn.innerHTML = ea.obsidian.getIcon("trash").outerHTML;
    let confirmDelete = false;
    let deleteTimeout;
    deleteBtn.addEventListener("click", () => {
      if (!confirmDelete) {
        confirmDelete = true;
        deleteBtn.style.color = "var(--text-error)";
        deleteBtn.innerHTML = ea.obsidian.getIcon("alert-triangle").outerHTML;
        deleteTimeout = setTimeout(() => {
          confirmDelete = false;
          deleteBtn.style.color = "";
          deleteBtn.innerHTML = ea.obsidian.getIcon("trash").outerHTML;
        }, 3000);
      } else {
        clearTimeout(deleteTimeout);
        delete settings.noteTypes[key];
        ea.setScriptSettings(settings);
        refreshCallback();
      }
    });
  });
}

function buildNoteTypesSection(contentEl) {
  const noteTypesSection = contentEl.createEl("details", { cls: "setting-sub-section" });
  noteTypesSection.createEl("summary", { text: "Note Types & Custom Ontologies" });
  
  const addBtnContainer = noteTypesSection.createDiv({ cls: "flex-row-spaced", attr: { style: "margin-bottom:15px;" } });
  addBtnContainer.createEl("span", { text: "Manage your note types:" });
  const addBtn = addBtnContainer.createEl("button", { text: "Add", cls: "mod-cta" });
  
  const listContainer = noteTypesSection.createDiv();
  const refreshCallback = () => refreshNoteTypesList(listContainer, refreshCallback);

  addBtn.addEventListener("click", () => {
    const tempId = "New Type " + (Object.keys(settings.noteTypes).length + 1);
    settings.noteTypes[tempId] = {
      folder: "",
      type: "file",
      template: "",
      prefix: "",
      icon: "file",
      ontology: { default: "referencing", actions: ["referencing"] }
    };
    openEditNoteTypeModal(tempId, () => {
      ea.setScriptSettings(settings);
      refreshCallback();
    });
  });

  refreshCallback();
}

// -------------------------------------------------------------
// Settings Orchestrator
// -------------------------------------------------------------
function openSettingsModal() {
  const modal = new ea.obsidian.Modal(app);
  modal.titleEl.setText("");

  modal.onOpen = () => {
    const { contentEl } = modal;
    contentEl.empty();

    contentEl.createEl("style", {
      text: `
        .setting-sub-section { border: 1px solid var(--background-modifier-border); padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .setting-sub-section > summary { font-size: 1.17em; font-weight: 600; cursor: pointer; outline: none; margin-bottom: 10px; }
        .setting-sub-section > summary::marker { color: var(--text-muted); }
        .flex-row-spaced { display: flex; justify-content: space-between; align-items: center; }
        .note-type-list-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--background-modifier-border); }
        .note-type-list-item:last-child { border-bottom: none; }
        .note-type-meta-wrapper { display: flex; align-items: center; gap: 12px; }
        .note-type-btn-wrapper { display: flex; gap: 6px; }
        .settings-header-container { border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 12px; margin-bottom: 15px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
      `
    });

    buildSettingsHeader(contentEl, modal);
    buildVisualSizingSection(contentEl);
    buildVisualTemplateSection(contentEl);
    buildPropertyInjectionSection(contentEl);
    buildDateSettingsSection(contentEl);
    buildNoteTypesSection(contentEl);
  };

  modal.onClose = () => {
    setTimeout(() => { delete modal; });
  };
  
  modal.open();
}

// -------------------------------------------------------------
// 7. UI: Detailed Single Note Type Editor Modal (Secondary Modal)
// -------------------------------------------------------------
function openEditNoteTypeModal(noteTypeKey, saveCallback) {
  const modal = new ea.obsidian.Modal(app);
  modal.titleEl.setText(`Configure Note Type`);

  const typeConfig = settings.noteTypes[noteTypeKey];
  let originalKeyName = noteTypeKey;

  // Fetch ExcaliBrain ontology actions
  let brainOntologies = [];
  const excalibrain = app.plugins.plugins["excalibrain"];
  if (excalibrain) {
    const x = [];
    const excalibrainHierarchy = app.plugins.plugins["excalibrain"].settings.hierarchy;
    Object.keys(excalibrainHierarchy)
      .forEach(k => {
        if (k === "exclusions") return;
        x.push(excalibrainHierarchy[k]);
      });
    brainOntologies = Array.from(new Set(x.flat()));
  }

  modal.onOpen = () => {
    const { contentEl } = modal;
    contentEl.empty();

    contentEl.createEl("style", {
      text: `
        .ontology-chip-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .ontology-chip {
          background-color: var(--background-modifier-hover); padding: 4px 8px;
          border-radius: 12px; font-size: 0.85em; display: flex; align-items: center; gap: 6px;
        }
        .ontology-chip-delete { cursor: pointer; font-weight: bold; color: var(--text-muted); }
        .ontology-chip-delete:hover { color: var(--text-error); }
        .suggest-list {
          border: 1px solid var(--background-modifier-border); background: var(--background-primary);
          max-height: 120px; overflow-y: auto; border-radius: 4px; display: none; margin-top: 4px;
        }
        .suggest-item { padding: 4px 8px; cursor: pointer; }
        .suggest-item:hover { background-color: var(--background-modifier-hover); }
        .edit-type-header-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 12px; margin-bottom: 15px; }
        .icon-preview-pane { display: inline-flex; align-items: center; gap: 8px; }
      `
    });

    const headerRow = contentEl.createDiv({ cls: "edit-type-header-row" });
    const nameInput = headerRow.createEl("input", { type: "text", value: originalKeyName });
    nameInput.style.fontWeight = "bold";
    nameInput.style.fontSize = "1.25em";
    nameInput.style.width = "60%";

    const saveBtn = headerRow.createEl("button", { text: "Save", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      const finalName = nameInput.value.trim();
      if (!finalName) {
        new Notice("Please enter a valid note type name.");
        return;
      }
      if (finalName !== originalKeyName) {
        settings.noteTypes[finalName] = typeConfig;
        delete settings.noteTypes[originalKeyName];
      }
      saveCallback();
      modal.close();
    });

    new ea.obsidian.Setting(contentEl)
      .setName("Target Vault Folder")
      .addText(text => {
        text.setValue(typeConfig.folder).onChange(val => { typeConfig.folder = val; });
        new FolderSuggest(app, text.inputEl);
      });

    new ea.obsidian.Setting(contentEl)
      .setName("Template Path")
      .setDesc("The full path of your Templater note template (.md extension is not required)")
      .addText(text => {
        text.setValue(typeConfig.template).onChange(val => { typeConfig.template = val; });
        new TemplateSuggest(app, text.inputEl);
      });

    new ea.obsidian.Setting(contentEl)
      .setName("File Prefix")
      .addText(text => text.setValue(typeConfig.prefix).onChange(val => { typeConfig.prefix = val; }));

    const iconSetting = new ea.obsidian.Setting(contentEl)
      .setName("Lucide Icon");
    
    iconSetting.controlEl.addClass("icon-preview-pane");
    const iconPreviewSpan = iconSetting.controlEl.createSpan();
    
    iconSetting.addText(text => {
      text.setValue(typeConfig.icon || "file").onChange(val => {
        typeConfig.icon = val;
        iconPreviewSpan.innerHTML = ea.obsidian.getIcon("lucide-" + val)?.outerHTML || "";
      });
      new IconSuggest(app, text.inputEl);
    });
    
    if (typeConfig.icon) {
      iconPreviewSpan.innerHTML = ea.obsidian.getIcon("lucide-" + typeConfig.icon)?.outerHTML || "";
    }

    new ea.obsidian.Setting(contentEl)
      .setName("Note Type Structure")
      .addDropdown(dropdown => dropdown
        .addOption("file", "Single File")
        .addOption("folder", "File inside dedicated Folder")
        .setValue(typeConfig.type)
        .onChange(val => { typeConfig.type = val; }));

    // Ontology Tags Picker
    const ontologyRow = new ea.obsidian.Setting(contentEl)
      .setName("Action Ontologies")
      .setDesc("Actions associated with relationships (Click chip to set Default)");

    const actionWrapper = ontologyRow.controlEl.createDiv();
    const actionInput = actionWrapper.createEl("input", { type: "text", placeholder: "Type action & press Enter..." });
    actionInput.style.width = "100%";

    const chipContainer = actionWrapper.createDiv({ cls: "ontology-chip-container" });
    const suggestList = actionWrapper.createDiv({ cls: "suggest-list" });

    const renderChips = () => {
      chipContainer.empty();
      typeConfig.ontology.actions.forEach(action => {
        const chip = chipContainer.createDiv({ cls: "ontology-chip", text: action });
        if (typeConfig.ontology.default === action) {
          chip.style.border = "1px solid var(--interactive-accent)";
          chip.style.fontWeight = "bold";
        }
        
        chip.addEventListener("click", () => {
          typeConfig.ontology.default = action;
          renderChips();
        });

        const del = chip.createSpan({ cls: "ontology-chip-delete", text: "×" });
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          typeConfig.ontology.actions = typeConfig.ontology.actions.filter(a => a !== action);
          if (typeConfig.ontology.default === action) {
            typeConfig.ontology.default = typeConfig.ontology.actions[0] || "";
          }
          renderChips();
        });
      });
    };

    const updateSuggestions = (query) => {
      suggestList.empty();
      if (!query) { suggestList.style.display = "none"; return; }
      const q = query.toLowerCase();
      const matches = brainOntologies.filter(o => o.toLowerCase().includes(q) && !typeConfig.ontology.actions.includes(o));
      
      if (matches.length > 0) {
        suggestList.style.display = "block";
        matches.forEach(m => {
          const div = suggestList.createDiv({ cls: "suggest-item", text: m });
          div.addEventListener("click", () => {
            typeConfig.ontology.actions.push(m);
            if (!typeConfig.ontology.default) typeConfig.ontology.default = m;
            actionInput.value = "";
            suggestList.style.display = "none";
            renderChips();
          });
        });
      } else {
        suggestList.style.display = "none";
      }
    };

    actionInput.addEventListener("input", (e) => updateSuggestions(e.target.value));
    actionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = actionInput.value.trim();
        if (val && !typeConfig.ontology.actions.includes(val)) {
          typeConfig.ontology.actions.push(val);
          if (!typeConfig.ontology.default) typeConfig.ontology.default = val;
          actionInput.value = "";
          suggestList.style.display = "none";
          renderChips();
        }
      }
    });

    renderChips();
  };

  modal.onClose = () => {
    setTimeout(() => { delete modal; });
  };
  modal.open();
}

// -------------------------------------------------------------
// 8. Run Trigger
// -------------------------------------------------------------
await start();