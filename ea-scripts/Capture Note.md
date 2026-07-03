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
const VERSION = "v260629";
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
  constructor(app, inputEl, state = null, originFolderPath = "/") {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.state = state;
    this.originFolderPath = originFolderPath === "/" ? "" : originFolderPath;
  }
  getSuggestions(query) {
    let folders = app.vault.getAllLoadedFiles()
      .filter(f => f instanceof ea.obsidian.TFolder)
      .map(f => f.path);
    
    // Filter and map paths relative to the current origin folder
    if (this.state && this.state.useRelativeFolder) {
      const prefix = this.originFolderPath ? this.originFolderPath + "/" : "";
      folders = folders.filter(p => p.startsWith(prefix) || p === this.originFolderPath);
      folders = folders.map(p => p === this.originFolderPath ? "" : p.substring(prefix.length));
    }
    
    return folders.filter(p => p.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(value, el) { 
    // Display an indicator for the current folder if left empty in relative mode
    const display = value === "" && this.state && this.state.useRelativeFolder ? "./ (Current Folder)" : value;
    el.setText(display || "/"); 
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
// 3b. Async Event & Synchronization Helpers
// -------------------------------------------------------------

/**
 * Waits for a workspace leaf to fully load the specified file object.
 */
const waitForLeafToLoadFile = async (leaf, file, timeout = 10000) => {
  return new Promise((resolve) => {
    if (leaf.view?.file?.path === file.path) return resolve(true);
    let elapsed = 0;
    const interval = 50;
    const check = () => {
      if (leaf.view?.file?.path === file.path) resolve(true);
      else if (elapsed > timeout) resolve(false);
      else { elapsed += interval; setTimeout(check, interval); }
    };
    check();
  });
};

/**
 * Waits for the Excalidraw View to be fully mounted, initialized, and ready.
 * Verifies the API, targetView, and semaphore flags.
 */
const waitForExcalidrawViewReady = async (target_ea, timeout = 10000) => {
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = 50;
    const check = () => {
      if (
        target_ea.targetView &&
        target_ea.getExcalidrawAPI() &&
        target_ea.targetView.semaphores?.viewloaded === true &&
        !target_ea.targetView.semaphores?.viewunload
      ) {
        resolve(true);
      } else if (elapsed > timeout) {
        resolve(false);
      } else {
        elapsed += interval;
        setTimeout(check, interval);
      }
    };
    check();
  });
};

/**
 * Waits for a file to trigger a "modify" event on the vault, indicating 
 * that disk I/O (like forceSave) has completed successfully.
 */
const waitForFileModification = async (file, timeout = 5000) => {
  if (!file) return false;
  return new Promise((resolve) => {
    let timeoutId;
    const handler = (changedFile) => {
      if (changedFile.path === file.path) {
        app.vault.off("modify", handler);
        clearTimeout(timeoutId);
        resolve(true);
      }
    };
    app.vault.on("modify", handler);
    timeoutId = setTimeout(() => {
      app.vault.off("modify", handler);
      resolve(false);
    }, timeout);
  });
};

// -------------------------------------------------------------
// 4. Core Execution Flow (Refactored)
// -------------------------------------------------------------

// Extracts the initial text from either standard elements or mindmap nodes
async function extractInitialTextAndMindmapState(originView, activeElement, textEl) {
  let mmAPI = window.MindMapBuilderAPI;
  
  // Auto-start MindMap Builder if it's not running but a mindmap node is selected
  if (
    !mmAPI && activeElement && (
      activeElement.customData?.hasOwnProperty("mindmapOrder") ||
      activeElement.customData?.hasOwnProperty("growthMode")
  )) {
    const mmbCommandPaletteAction = Object.keys(app.commands.commands).find(k=>k.startsWith("obsidian-excalidraw-plugin") && k.toLowerCase().includes("mindmap builder"));
    if(mmbCommandPaletteAction) {
      const cmd = app.commands.commands[mmbCommandPaletteAction];
      if (cmd) {
        // Check if sidepanel is currently visible before starting MMB
        let sidepanelWasVisible = false;
        const sidepanelLeaf = ea.getSidepanelLeaf();
        if (sidepanelLeaf && sidepanelLeaf.view.containerEl.offsetParent !== null) {
          sidepanelWasVisible = true;
        }

        if(cmd.callback) cmd.callback();
        else if(cmd.checkCallback) cmd.checkCallback(false);
        
        // Wait for the API to become available
        let retries = 0;
        while(!window.MindMapBuilderAPI && retries++ < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        mmAPI = window.MindMapBuilderAPI;

        // If MMB opened the sidepanel but it was previously closed, hide it
        if (!sidepanelWasVisible) {
           const newSidepanelLeaf = ea.getSidepanelLeaf();
           if (newSidepanelLeaf && newSidepanelLeaf.view.containerEl.offsetParent !== null) {
             ea.toggleSidepanelView();
           }
        }
      }
    }
  }

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
            const modifyPromise = waitForFileModification(file, 5000);
            if (tempCmd.callback) tempCmd.callback();
            else if (tempCmd.checkCallback) tempCmd.checkCallback(false);
            await modifyPromise;
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
  let noteBWorkspaceLeaf = null;

  // Check if the file is already open in any existing leaf
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view && leaf.view.file && leaf.view.file.path === file.path) {
      noteBWorkspaceLeaf = leaf;
    }
  });

  if (noteBWorkspaceLeaf) {
    app.workspace.setActiveLeaf(noteBWorkspaceLeaf, { focus: true });
  } else {
    // Standard logic if it is not open yet
    if (openNoteBBehavior === "adjacent pane") {
      noteBWorkspaceLeaf = ea.openFileInNewOrAdjacentLeaf(file);
    } else if (openNoteBBehavior === "new tab") {
      noteBWorkspaceLeaf = app.workspace.getLeaf("tab");
      await noteBWorkspaceLeaf.openFile(file, { active: true });
    } else {
      noteBWorkspaceLeaf = originView.leaf;
      await noteBWorkspaceLeaf.openFile(file, { active: true });
    }
  }

  // Explicitly wait until the target leaf has fully instantiated its File representation 
  await waitForLeafToLoadFile(noteBWorkspaceLeaf, file);
  
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
  const file = noteBWorkspaceLeaf.view?.file;

  if (noteBWorkspaceLeaf.view.getViewType() !== 'excalidraw') {
    app.workspace.setActiveLeaf(noteBWorkspaceLeaf, { focus: true });

    const toggleCmd = async () => {
      const cmd = app.commands.commands["obsidian-excalidraw-plugin:toggle-excalidraw-view"];
      if (cmd) {
        if (cmd.callback) cmd.callback();
        else if (cmd.checkCallback) cmd.checkCallback(false);
      } else {
        await app.commands.executeCommandById("obsidian-excalidraw-plugin:toggle-excalidraw-view");
      }
    };

    // A newly created file is ready to be opened as Excalidraw when the frontmatter for the file 
    // returns a valid value for the excalidraw-plugin yaml key from metadata cache.
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter && cache.frontmatter["excalidraw-plugin"]) {
      await toggleCmd();
    } else {
      await new Promise((resolve) => {
        let timeoutId;
        const handler = (changedFile) => {
          if (changedFile.path === file.path) {
            const currentCache = app.metadataCache.getFileCache(changedFile);
            if (currentCache?.frontmatter && currentCache.frontmatter["excalidraw-plugin"]) {
              app.metadataCache.off("changed", handler);
              clearTimeout(timeoutId);
              toggleCmd().then(resolve);
            }
          }
        };
        app.metadataCache.on("changed", handler);
        timeoutId = setTimeout(() => {
          app.metadataCache.off("changed", handler);
          toggleCmd().then(resolve); // Fallback execution
        }, 5000);
      });
    }
    
    // Explicitly wait until the view type registers the change
    await new Promise((resolve) => {
      let elapsed = 0;
      const interval = 50;
      const check = () => {
        if (noteBWorkspaceLeaf.view.getViewType() === 'excalidraw') resolve();
        else if (elapsed > 5000) resolve(); // timeout fallback
        else { elapsed += interval; setTimeout(check, interval); }
      };
      check();
    });
  }

  if (noteBWorkspaceLeaf.view.getViewType() !== 'excalidraw') {
    new Notice("Error: Target note could not be loaded into Excalidraw.");
    return null;
  }

  const target_ea = ea.getAPI(noteBWorkspaceLeaf.view);
  target_ea.setView(noteBWorkspaceLeaf.view);

  // Wait for Excalidraw view to be fully loaded and semaphores clear
  await waitForExcalidrawViewReady(target_ea);
  
  return target_ea;
}

// Injects the visual frame marker and template onto the target Note B
async function injectVisualFormat(target_ea, targetX, targetY, sectionRawText, todayDNPBasename, isCurrentDNP, preGeneratedFrameID, embeddedElementId, ontologyAction, originFilePath, opt) {
  const fWidth = parseInt(settings.frameWidth) || 1920;
  const fHeight = parseInt(settings.frameHeight) || 1080;

  target_ea.clear();
  
  // Create frame and remap its ID to the pre-generated ID expected by Note A
  const tmpid = target_ea.addFrame(targetX, targetY, fWidth, fHeight, sectionRawText);
  const frameEl = target_ea.getElement(tmpid);
  frameEl.id = preGeneratedFrameID;
  target_ea.elementsDict[preGeneratedFrameID] = frameEl;
  delete target_ea.elementsDict[tmpid];
  
  const frameID = preGeneratedFrameID;

  if (settings.useMarkerFrames !== false) {
    frameEl.frameRole = "marker";
  }
  
  // Conditionally add dynamic links back to the originating element and (if applicable) the DNP
  let linkStr = "";
  if (embeddedElementId && ontologyAction && originFilePath) {
    linkStr += `(${ontologyAction}::[[${originFilePath}#^group=${embeddedElementId}]])`;
  }
  if (!isCurrentDNP) {
    const frameOntology = settings.frameOntology || "note";
    linkStr += (linkStr ? " " : "") + `(${frameOntology}::[[${todayDNPBasename}]])`;
  }
  if (linkStr) {
    frameEl.link = linkStr;
  }

  let clonedTemplateElementIds = [];
  
  // Resolve Visual Template details with fallback to global settings
  const visualTemplateJSON = opt?.visualTemplateJSON || settings.visualTemplateJSON;
  const visualTemplateHAlign = opt?.visualTemplateHAlign || settings.visualTemplateHAlign || "center";
  const visualTemplateVAlign = opt?.visualTemplateVAlign || settings.visualTemplateVAlign || "middle";

  if (visualTemplateJSON) {
    try {
      const parsed = JSON.parse(visualTemplateJSON);
      if (parsed.elements && parsed.elements.length > 0) {
        const clonedElements = ExcalidrawLib.restoreElements(
          target_ea.cloneElements(parsed.elements,
            null,
            {
              refreshDimensions: true,
              repairBindings: true
            }
          )
        );
        const bounds = window.ExcalidrawLib.getCommonBounds(clonedElements);
        const boundsWidth = bounds[2] - bounds[0];
        const boundsHeight = bounds[3] - bounds[1];

        let offsetX = 0;
        let offsetY = 0;

        if (visualTemplateHAlign === "left") {
          offsetX = targetX - bounds[0] + FRAME_MARGIN;
        } else if (visualTemplateHAlign === "right") {
          offsetX = targetX + fWidth - bounds[2] - FRAME_MARGIN;
        } else {
          offsetX = targetX + (fWidth - boundsWidth) / 2 - bounds[0];
        }

        if (visualTemplateVAlign === "top") {
          offsetY = targetY - bounds[1] + FRAME_MARGIN;
        } else if (visualTemplateVAlign === "bottom") {
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
    const modifyPromise = waitForFileModification(target_ea.targetView.file, 2000);
    await target_ea.targetView.forceSave(true);
    await modifyPromise;
  }

  return { frameID, clonedTemplateElementIds };
}

// Modifies Note B's markdown structure to embed the target container safely
async function injectMarkdownFormat(file, target_ea, targetX, targetY, sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP, preGeneratedFrameID, embeddedElementId, ontologyAction, originFilePath) {
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

  // Wait to allow Excalidraw to fully process the file change event
  if (modified) {
    await waitForFileModification(file, 2000);
  }

  const embedWidth = parseInt(settings.embedWidth) || 400;
  const embedHeight = parseInt(settings.embedHeight) || 500;
  
  const selfLinkpath = getObsidianLinkpath(file, file.path);
  const containerLink = `[[${selfLinkpath}#${sanitizedSection}]]`;

  target_ea.clear();
  
  // Create embeddable and remap its ID to the pre-generated ID expected by Note A
  const tmpid = target_ea.addEmbeddable(targetX, targetY, embedWidth, embedHeight, containerLink);
  const embedEl = target_ea.getElement(tmpid);
  embedEl.id = preGeneratedFrameID;
  target_ea.elementsDict[preGeneratedFrameID] = embedEl;
  delete target_ea.elementsDict[tmpid];
  
  const frameID = preGeneratedFrameID;
  
  // Conditionally add dynamic links back to the originating element and (if applicable) the DNP
  let linkStr = containerLink;
  if (embeddedElementId && ontologyAction && originFilePath) {
    const originFile = app.vault.getAbstractFileByPath(originFilePath);
    const originLinkpath = originFile ? getObsidianLinkpath(originFile, file.path) : originFilePath.replace(/\.md$/i, "");
    linkStr += ` (${ontologyAction}::[[${originLinkpath}#^group=${embeddedElementId}]])`;
  }
  if (!isCurrentDNP) {
    const frameOntology = settings.frameOntology || "note";
    const dnpFile = app.metadataCache.getFirstLinkpathDest(todayDNPBasename, file.path);
    const dnpLinkpath = dnpFile ? getObsidianLinkpath(dnpFile, file.path) : todayDNPBasename;
    linkStr += ` (${frameOntology}::[[${dnpLinkpath}]])`;
  }
  embedEl.link = linkStr;

  await target_ea.addElementsToView(false, true, true);
  target_ea.clear();

  // Force Excalidraw to save state to disk before we proceed
  if (target_ea.targetView && typeof target_ea.targetView.forceSave === "function") {
    const modifyPromise = waitForFileModification(target_ea.targetView.file, 2000);
    await target_ea.targetView.forceSave(true);
    await modifyPromise;
  }

  return frameID;
}

// Injects the cross-link reference and embed onto the Origin Note A
async function injectIntoOriginView(originView, activeElement, format, actionType, file, frameID, sectionRawText, ontologyAction, isMindmapNode, mindmapNodeText, mmAPI, mmNodeId, linkAlias, initialLinkText) {
  const timeStr = settings.DNPConfig.recordTime ? moment().format(settings.DNPConfig.timeFormat) + " " : "";
  const refPath = format === "Visual" ? `^frame=${frameID}` : sanitizeLinkSection(sectionRawText);
  
  const displayAlias = linkAlias ? linkAlias : file.basename;
  
  const linkpath = getObsidianLinkpath(file, originView.file.path);
  const linkStr = `[[${linkpath}#${refPath}|${displayAlias}]]`;
  
  const ontologyStr = `(${ontologyAction}:: ${linkStr})`;
  const nodeTextString = `${timeStr}${ontologyStr}`;

  const imgWidth = parseInt(settings.originImageWidth || settings.imageWidth) || 400;

  const isMarkdownImage = settings.markdownEmbedType === "image";

  let embedText = "";
  if (actionType === "CAPTURE_HERE") {
    embedText = `![[${linkpath}#${refPath}]]`;
  } else if (format === "Visual" || isMarkdownImage) {
    // Keep the markdown string for MM Node text, which parses |w properly
    embedText = `![[${linkpath}#${refPath}|${imgWidth}]]`;
  } else {
    embedText = `![[${linkpath}#${refPath}]]`;
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
        `[[${linkpath}#${refPath}]]`
      );
    } else {
      // Add the image. Note: `addImage` doesn't natively parse the |400 suffix to resize the element 
      // when `scale` is false in ExcalidrawAutomate. We pass the clean path.
      embeddedElementId = await ea.addImage(
        xPos, yPos,
        `${file.path}#${refPath}` // ea.addImage uses raw paths reliably 
      );
      
      // Fix Dimensions: Read natural size and scale proportionally
      const embeddedElement = ea.getElement(embeddedElementId);
      if (embeddedElement) {
        if (embeddedElement.height > 0) {
          const ratio = embeddedElement.width / embeddedElement.height;
          embeddedElement.width = imgWidth;
          embeddedElement.height = imgWidth / ratio;
        } else {
          // Fallback if dimensions aren't immediately resolved because target isn't fully drawn yet
          embeddedElement.width = imgWidth;
          embeddedElement.height = imgWidth; // Fallback to square 1:1 format
        }
      }
    }

    // Commit changes so the element exists in the active scene before the unified link update
    await ea.addElementsToView(!activeElement, true);
    
    // Auto-resize the container if the text expanded
    if (activeElement && activeElement.type !== "text") {
       ea.getExcalidrawAPI().updateContainerSize([activeElement]);
    }
    
    ea.clear();
  }

  if (embeddedElementId) {
    const elToUpdate = ea.getViewElements().find(el => el.id === embeddedElementId);
    if (elToUpdate) {
      ea.clear();
      ea.copyViewElementsToEAforEditing([elToUpdate]);
      const eaEl = ea.getElement(embeddedElementId);
      
      if (eaEl) {
        if (format === "Visual") {
          // Visual Format: Frame
          eaEl.link = `(${ontologyAction}:: [[${linkpath}#${refPath}]])`;
        } else {
          const isEmbeddable = actionType === "CAPTURE_HERE" || !isMarkdownImage;
          if (isEmbeddable) {
            // Markdown Format + Embeddable: Multiple links
            eaEl.link = `(${ontologyAction}:: [[${linkpath}#${refPath}]] [[${linkpath}#^group=${frameID}]])`;
          } else {
            // Markdown Format + Static Image: Element ID link only
            eaEl.link = `(${ontologyAction}:: [[${linkpath}#^group=${frameID}]])`;
          }
        }
      }
      
      await ea.addElementsToView(false, true, true);
      ea.clear();
    }
  }

  return embeddedElementId;
}

// Completes final focus and zoom
async function handleFinalActionFocus(actionType, originView, noteBWorkspaceLeaf, embeddedElementId, target_ea, format, frameID, clonedTemplateElementIds, mmAPI) {
  if (actionType === "CAPTURE_HERE") {
    if (noteBWorkspaceLeaf && noteBWorkspaceLeaf !== originView.leaf) {
      // Force Excalidraw to save its state to disk before we close the leaf
      if (target_ea && target_ea.targetView && typeof target_ea.targetView.forceSave === "function") {
        const modifyPromise = waitForFileModification(target_ea.targetView.file, 3000);
        await target_ea.targetView.forceSave(true);
        await modifyPromise;
      }
      noteBWorkspaceLeaf.detach();
    }

    // Reactivate Origin Note (Note A) since we left it briefly to draw into Note B
    app.workspace.setActiveLeaf(originView.leaf, { focus: true });

    // Grab elements using origin_ea
    const origin_ea = ea.getAPI(originView.leaf.view);
    const targetElements = origin_ea.getViewElements().filter(el => el.id === embeddedElementId);
    
    if (targetElements.length > 0) {
      await mmAPI?.performAction("Dock & hide");
      await new Promise(r => setTimeout(r, 50)); 
      origin_ea.viewZoomToElements(true, targetElements, 0.1);
    }
  } else {
    app.workspace.setActiveLeaf(noteBWorkspaceLeaf, { focus: true });

    let targetElements = target_ea.getViewElements().filter(el => el.id === frameID);
    if (format === "Visual" && clonedTemplateElementIds.length > 0) {
      const templateElements = target_ea.getViewElements().filter(el => clonedTemplateElementIds.includes(el.id));
      if (targetElements.length > 0) {
        target_ea.viewZoomToElements(false, targetElements, 0.1);
        await new Promise(r => setTimeout(r, 50)); 
      }
      if (templateElements.length > 0) {
        target_ea.selectElementsInView(templateElements);
      }
    } else {
      if (targetElements.length > 0) {
        target_ea.viewZoomToElements(format !== "Visual", targetElements, 0.1);
      }
    }
    
    // Set MMB view if Visual and mmAPI is available
    if (format === "Visual" && window.MindMapBuilderAPI && target_ea.targetView) {
      window.MindMapBuilderAPI.setView(target_ea.targetView);
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

// Resolves conflicts when an existing file is selected that lacks the note-type or correct prefix
async function resolveExistingFileConflict(file, hasNoteType, hasPrefix, prefix) {
  return new Promise(resolve => {
    const modal = new ea.obsidian.Modal(app);
    modal.titleEl.setText("Existing File Selected");

    let addNoteType = !hasNoteType;
    let renameFile = !hasPrefix;
    let action = "USE_EXISTING"; 
    let isResolved = false;

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.empty();
      
      contentEl.createEl("p", { text: `The file "${file.basename}" already exists but doesn't match the selected Note Type's standard structure.` });

      const optionsDiv = contentEl.createDiv();
      optionsDiv.style.border = "1px solid var(--background-modifier-border)";
      optionsDiv.style.padding = "10px";
      optionsDiv.style.borderRadius = "8px";
      optionsDiv.style.marginBottom = "15px";

      if (!hasNoteType) {
        new ea.obsidian.Setting(optionsDiv)
          .setName("Add Note Type Property")
          .setDesc("Inject the missing note type into the document's properties.")
          .addToggle(toggle => toggle.setValue(addNoteType).onChange(val => addNoteType = val));
      }

      if (!hasPrefix && prefix) {
        new ea.obsidian.Setting(optionsDiv)
          .setName("Modify File Name")
          .setDesc(`Rename file to match pattern: "${prefix}${file.basename}"`)
          .addToggle(toggle => toggle.setValue(renameFile).onChange(val => renameFile = val));
      }

      contentEl.createEl("hr");

      new ea.obsidian.Setting(contentEl)
        .setName("Create New Note Instead")
        .setDesc("Ignore the existing file and create a new one following the standard folder and naming structure.")
        .addToggle(toggle => toggle.setValue(false).onChange(val => {
          if(val) {
            action = "CREATE_NEW";
            optionsDiv.style.opacity = "0.5";
            optionsDiv.style.pointerEvents = "none";
          } else {
            action = "USE_EXISTING";
            optionsDiv.style.opacity = "1";
            optionsDiv.style.pointerEvents = "auto";
          }
        }));

      const btnContainer = contentEl.createDiv({ attr: { style: "display: flex; justify-content: flex-end; margin-top: 20px;" }});
      const btn = btnContainer.createEl("button", { text: "Proceed", cls: "mod-cta" });
      btn.addEventListener("click", () => {
        isResolved = true;
        resolve({ action, addNoteType, renameFile });
        modal.close();
      });
    };
    
    modal.onClose = () => {
        if (!isResolved) resolve(null); // Return null if user cancels (hits escape)
    };

    modal.open();
  });
}

// Safely retrieves the Obsidian linkpath, respecting user settings and stripping .md extensions 
// even during metadata cache misses for newly created files.
function getObsidianLinkpath(file, sourcePath) {
  let linkpath = app.metadataCache.fileToLinktext(file, sourcePath, true);
  
  // Obsidian fallback when cache is missing returns full path WITH .md.
  // Force remove .md
  if (linkpath.toLowerCase().endsWith(".md")) {
    linkpath = linkpath.slice(0, -3);
    
    // Try to respect user's newLinkFormat manually since the cache failed to do so
    const format = app.vault.getConfig("newLinkFormat");
    if (format === "shortest") {
      // Verify if basename is unique in the vault
      const matches = app.vault.getFiles().filter(f => f.basename === file.basename);
      if (matches.length <= 1) { 
        linkpath = file.basename;
      }
    } else if (format === "relative") {
      // Compute relative path manually if Obsidian failed
      const targetDir = file.parent?.path || "";
      const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
      const sourceDir = sourceFile?.parent?.path || "";
      if (targetDir === sourceDir && targetDir !== "/") {
        linkpath = file.basename;
      }
    }
  }
  return linkpath;
}

// The core orchestrator function
async function start() {
  const originView = ea.targetView;
  if (!originView) {
    new Notice("No active Excalidraw view found.");
    return;
  }

  // Feature: Quick Frame Resizing
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

  const { filename, noteType, format, ontologyAction, actionType, openNoteBBehavior, folder: customFolder, sidepanelWasVisible } = captureData;
  
  // Inline cleanup helper attached to visibility flag
  const closeSidepanelIfNeeded = () => {
    if (!sidepanelWasVisible) {
      const sidepanelLeaf = ea.getSidepanelLeaf();
      if (sidepanelLeaf && sidepanelLeaf.view.containerEl.offsetParent !== null) {
        ea.toggleSidepanelView();
      }
    }
  };

  const opt = settings.noteTypes[noteType];

  if (!opt) {
    new Notice("Error: Note Type configuration is missing. Open Settings to configure Note Types.");
    closeSidepanelIfNeeded();
    return;
  }

  // Set the folder from the modal box (and apply relative behaviors)
  let targetFolder = (customFolder !== undefined && customFolder !== "") ? customFolder : opt.folder;
  if (captureData.useRelativeFolder) {
    const baseFolder = originView.file.parent.path;
    if (baseFolder !== "/") {
      targetFolder = targetFolder ? `${baseFolder}/${targetFolder}` : baseFolder;
    }
  }

  const folder = ea.obsidian.normalizePath(targetFolder);

  // 3. Assemble WikiLink and File Path
  let rawFilename = filename;
  let linkAlias = filename;
  if (filename.includes("|")) {
    const parts = filename.split("|");
    rawFilename = parts[0].trim();
    linkAlias = parts.slice(1).join("|").trim();
  }

  let cleanFilename = rawFilename.split("#")[0].trim();
  if (cleanFilename.toLowerCase().endsWith(".md")) {
      cleanFilename = cleanFilename.slice(0, -3);
  }
  
  if (opt.prefix && cleanFilename.startsWith(opt.prefix)) {
    cleanFilename = cleanFilename.substring(opt.prefix.length);
  }
  let targetBasename = `${opt.prefix ?? ""}${cleanFilename}`;

  let expectedPath = (opt.type === "folder") ? `${folder}/${cleanFilename}/${targetBasename}.md` : `${folder}/${targetBasename}.md`;
  let fileTarget = app.vault.getAbstractFileByPath(ea.obsidian.normalizePath(expectedPath));
  
  if (!fileTarget) {
    fileTarget = app.metadataCache.getFirstLinkpathDest(rawFilename, "");
    if (!fileTarget && rawFilename !== targetBasename) {
      fileTarget = app.metadataCache.getFirstLinkpathDest(targetBasename, "");
    }
  }

  // Handle Existing File Conflict Workflow (Bypasses rename warning if type matches)
  if (fileTarget) {
    const existingType = await detectNoteType(fileTarget);
    const hasNoteType = existingType === noteType;
    const hasPrefix = opt.prefix ? fileTarget.basename.startsWith(opt.prefix) : true;

    if (!hasNoteType) {
      const conflictDecision = await resolveExistingFileConflict(fileTarget, hasNoteType, hasPrefix, opt.prefix);
      if (!conflictDecision) {
        closeSidepanelIfNeeded();
        return; 
      }

      if (conflictDecision.action === "CREATE_NEW") {
        fileTarget = null; 
      } else {
        if (conflictDecision.renameFile && !hasPrefix && opt.prefix) {
          const newName = `${opt.prefix}${fileTarget.basename}`;
          const newPath = ea.obsidian.normalizePath(`${fileTarget.parent.path}/${newName}.${fileTarget.extension}`);
          await app.fileManager.renameFile(fileTarget, newPath);
        }
        if (conflictDecision.addNoteType && !hasNoteType) {
          await injectNoteTypeProperty(fileTarget, noteType, cleanFilename, opt);
        }
      }
    }
  }

  let targetWikiLink;
  let fname;

  if (fileTarget) {
    fname = fileTarget.path;
    const linkpath = getObsidianLinkpath(fileTarget, originView.file.path);
    targetWikiLink = `[[${linkpath}|${linkAlias}]]`;
  } else {
    let folderPath = (opt.type === "folder") ? `${folder}/${cleanFilename}` : folder;
    const formattedFolderPath = folderPath ? folderPath.replace(/^\/+/, "") + "/" : "";
    
    const fmt = app.vault.getConfig("newLinkFormat");
    let linkpath = `${formattedFolderPath}${targetBasename}`;
    if (fmt === "shortest") {
      const matches = app.vault.getFiles().filter(f => f.basename === targetBasename);
      if (matches.length === 0) {
        linkpath = targetBasename;
      }
    }
    
    targetWikiLink = `[[${linkpath}|${linkAlias}]]`;
    fname = `${formattedFolderPath}${targetBasename}.md`;
  }

  if (actionType === "ADD_LINK_ONLY") {
    ea.addText(0, 0, targetWikiLink);
    await ea.addElementsToView(true, true, true);
    ea.clear();
    closeSidepanelIfNeeded();
    return;
  }

  // 4. Create File if new
  const file = await ensureTargetFileExists(folder, cleanFilename, fname, opt, noteType);

  if (actionType === "ADD_LINK_CREATE") {
    if (!textEl && !isMindmapNode) {
      ea.clear();
      ea.addText(0, 0, targetWikiLink);
      await ea.addElementsToView(true, true, true);
      ea.clear();
    }
    new Notice(`Created file: ${file.basename}`);
    closeSidepanelIfNeeded();
    return;
  }

  // 5. Setup Capture variables
  const { sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP } = buildCaptureHeaders(originView);

  // 6. Pre-generate ID for the Target Note B element
  const preGeneratedFrameID = ea.generateElementId();

  // 7. Inject Origin Embed/Link FIRST (modifies Note A without leaf switching)
  const embeddedElementId = await injectIntoOriginView(
    originView, activeElement, format, actionType, file, preGeneratedFrameID, sectionRawText,
    ontologyAction, isMindmapNode, mindmapNodeText, mmAPI, mmNodeId, linkAlias, initialLinkText
  );

  // 8. Open Target Leaf (Context shifts to Note B)
  const noteBWorkspaceLeaf = await openAndResolveTargetLeaf(file, originView, openNoteBBehavior);

  // 9. Ensure Target View is Excalidraw and get API
  const target_ea = await prepareTargetExcalidrawView(noteBWorkspaceLeaf);
  if (!target_ea) {
    closeSidepanelIfNeeded();
    return;
  }

  // 10. Calculate insertion bounds on Target Note
  const bElements = target_ea.getViewElements();
  let targetX = 0;
  let targetY = 0;
  if (bElements.length > 0) {
    const bbox = target_ea.getBoundingBox(bElements);
    targetX = bbox.topX;
    targetY = bbox.topY + bbox.height + 100;
  }

  // 11. Inject onto Target Note using preGeneratedFrameID
  let clonedTemplateElementIds = [];
  if (format === "Visual") {
    const visualRes = await injectVisualFormat(target_ea, targetX, targetY, sectionRawText, todayDNPBasename, isCurrentDNP, preGeneratedFrameID, embeddedElementId, ontologyAction, originView.file.path, opt);
    clonedTemplateElementIds = visualRes.clonedTemplateElementIds;
  } else {
    await injectMarkdownFormat(file, target_ea, targetX, targetY, sectionRawText, sectionWithBrackets, todayDNPBasename, isCurrentDNP, preGeneratedFrameID, embeddedElementId, ontologyAction, originView.file.path);
  }

  // 12. Final Focus / Zoom
  await handleFinalActionFocus(actionType, originView, noteBWorkspaceLeaf, embeddedElementId, target_ea, format, preGeneratedFrameID, clonedTemplateElementIds, mmAPI);

  // 13. Sidepanel cleanup
  closeSidepanelIfNeeded();
}

// -------------------------------------------------------------
// 5. UI: Capture Note Modal (Refactored)
// -------------------------------------------------------------

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
      .link-type-row-control { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: flex-end; }
      
      /* Fluid Container-Agnostic Layout (No @media queries needed) */
      .excalidraw-capture-note-modal .setting-item {
        display: flex;
        flex-wrap: wrap;        /* Allows wrapping when sidepanel is thin */
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 0;         /* Shrink vertical padding */
        min-height: auto;       /* Override native Obsidian large min-height on mobile */
        border-top: none;
      }
      .excalidraw-capture-note-modal .setting-item-info {
        flex: 1 1 120px;        /* Base width of 120px, grows if space permits */
        white-space: normal;
        margin-top: 4px;
      }
      .excalidraw-capture-note-modal .setting-item-control {
        flex: 2 1 200px;        /* Base width of 200px. If container < 320px, it wraps to next line */
        justify-content: flex-end;
        width: 100%;            /* Expands to full width when wrapped */
      }
      .excalidraw-capture-note-modal .setting-item-control input[type="text"],
      .excalidraw-capture-note-modal .setting-item-control select {
        width: 100%;
      }
    `
  });
}

function buildCaptureFolderBox(contentEl, state) {
  const folderContainer = contentEl.createDiv({ cls: "mindmap-folder-container" });
  const folderSetting = new ea.obsidian.Setting(folderContainer)
    .setName("Folder")
    .setDesc("Target directory for the note");
  
  let folderInputComp;
  const currentFolderPath = ea.targetView ? ea.targetView.file.parent.path : "/";

  folderSetting.addText(text => {
    state.ui.folderInput = text;
    folderInputComp = text;
    text.inputEl.style.width = "100%";
    
    state.isProgrammaticUpdate = true;
    text.setValue(state.initialFolder);
    state.isProgrammaticUpdate = false;
    
    new FolderSuggest(app, text.inputEl, state, currentFolderPath);

    // Track manual edits by the user (ignoring programmatic setValue)
    text.inputEl.addEventListener("input", () => {
      if (!state.isProgrammaticUpdate) {
        state.folderManuallyEdited = true;
      }
    });
  });

  // Relative vs Absolute folder path toggle
  folderSetting.addExtraButton(btn => {
    state.ui.folderToggleBtn = btn;
    const updateIcon = () => {
      btn.setIcon(state.useRelativeFolder ? "folder-dot" : "folder-lock");
      btn.setTooltip(state.useRelativeFolder ? "In current folder or subfolder" : "Fixed absolute folder path");
    };
    updateIcon();
    
    btn.onClick(() => {
      state.useRelativeFolder = !state.useRelativeFolder;
      settings.useRelativeFolder = state.useRelativeFolder; // Save global preference
      ea.setScriptSettings(settings);
      updateIcon();
      
      // Handle path transformation automatically
      state.isProgrammaticUpdate = true;
      let currentVal = folderInputComp.getValue().trim();
      const prefix = currentFolderPath === "/" ? "" : currentFolderPath;
      
      if (state.useRelativeFolder) {
        // Absolute to Relative
        if (currentVal === prefix) {
          folderInputComp.setValue("");
        } else if (currentVal.startsWith(prefix + "/")) {
          folderInputComp.setValue(currentVal.substring(prefix.length + 1));
        } else {
          folderInputComp.setValue(""); // Does not fall within current path, clear
        }
      } else {
        // Relative to Absolute
        if (currentVal === "") {
          folderInputComp.setValue(prefix);
        } else {
          folderInputComp.setValue(prefix ? `${prefix}/${currentVal}` : currentVal);
        }
      }
      
      state.isProgrammaticUpdate = false;
      state.ui.folderInput.inputEl.dispatchEvent(new Event("input")); // Re-evaluate suggester
    });
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
      callbacks.onFileSelected(inputValue, selectedItem.file);
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
    
    const q = query.toLowerCase().trim();
    // Helper to escape regex special characters
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokens = q.split(/\s+/);
    // Create an ordered regex pattern (e.g. "my.*search.*term")
    const fuzzyRegex = new RegExp(tokens.map(escapeRegex).join('.*'), 'i');
    
    const scoredItems = new Map();

    state.searchItems.forEach(item => {
      // Search against the full file path if available, otherwise fallback to basename
      const searchableText = item.file 
        ? item.file.path + (item.type === "alias" && item.alias ? " " + item.alias : "") 
        : item.basename;
      
      if (fuzzyRegex.test(searchableText)) {
        // Evaluate if it's an exact match on either the basename or alias
        const isExactBasename = item.basename.toLowerCase() === q;
        const isExactAlias = item.type === "alias" && item.alias.toLowerCase() === q;
        const isExact = isExactBasename || isExactAlias;
        
        const mtime = item.file?.stat?.mtime || 0;

        // Include file path to differentiate identical basenames
        const pathSuffix = item.file ? `:${item.file.path}` : "";
        const key = item.type === "alias" ? `alias:${item.basename}:${item.alias}${pathSuffix}` : `${item.type}:${item.basename}${pathSuffix}`;
        
        const current = scoredItems.get(key);
        // Add to map if unique, or if it represents a higher scoring match instance
        if (!current || isExact > current.isExact || (isExact === current.isExact && mtime > current.mtime)) {
          scoredItems.set(key, { item, isExact, mtime });
        }
      }
    });

    // Sort exact matches to the top, then sort by most recently modified
    matchedItems = Array.from(scoredItems.values())
      .sort((a, b) => {
        if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
        return b.mtime - a.mtime;
      })
      .map(s => s.item)
      .slice(0, 8);
    
    if (matchedItems.length > 0) {
      resultsDropdown.style.display = "block";
      matchedItems.forEach((item) => {
        let displayText = item.basename;
        if (item.type === "alias") {
          displayText = `${item.alias} (Alias for: ${item.basename})`;
        } else if (item.type === "unresolved") {
          displayText = `${item.basename} (Placeholder)`;
        }
        
        const divItem = resultsDropdown.createDiv({ cls: "mindmap-search-item" });
        
        // Render duplicate disambiguation if needed
        if (item.isDuplicate && item.file) {
            divItem.createDiv({ text: displayText });
            divItem.createDiv({ text: item.file.parent.path, attr: { style: "font-size: 0.8em; color: var(--text-muted);" } });
        } else {
            divItem.setText(displayText);
        }

        divItem.addEventListener("click", () => {
          let inputValue = item.basename;
          if (item.type === "alias") {
            inputValue = `${item.basename}|${item.alias}`;
          }
          searchInput.setValue(inputValue);
          resultsDropdown.style.display = "none";
          callbacks.onFileSelected(inputValue, item.file);
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
    
    // Focus the file name field on open
    // Using a slightly longer timeout (250ms) to ensure it overrides Obsidian's native 
    // modal auto-focus behavior which naturally targets the first input (Folder box)
    setTimeout(() => {
      text.inputEl.focus();
    }, 250);
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

function buildCaptureLinkTypeSelector(contentEl, state, callbacks, tab) {
  const noteTypeKeys = Object.keys(settings.noteTypes).sort();
  let selectedNoteType = state.selectedNoteType;
  if (!selectedNoteType || !noteTypeKeys.includes(selectedNoteType)) {
    selectedNoteType = noteTypeKeys[0] || "";
    state.selectedNoteType = selectedNoteType;
  }

  const noteTypeRow = new ea.obsidian.Setting(contentEl).setName("Type");
  noteTypeRow.controlEl.addClass("link-type-row-control");
  const iconPreviewSpan = noteTypeRow.controlEl.createSpan();
  state.ui.iconPreviewSpan = iconPreviewSpan;

  noteTypeRow.addDropdown(dropdown => {
    state.ui.dropdownComponent = dropdown;
    noteTypeKeys.forEach(k => dropdown.addOption(k, k));
    dropdown.setValue(selectedNoteType);
    dropdown.onChange(val => {
      state.selectedNoteType = val;
      settings.lastSelectedNoteType = val;
      ea.setScriptSettings(settings);
      callbacks.updateIconPreview();
      callbacks.updateOntologyDropdown();

      // Automatically fill the folder if the Note Type changes (and user hasn't typed a custom folder)
      if (!state.folderManuallyEdited) {
        const actualVal = state.ui.searchInput.getValue().split("|")[0].trim();
        const fileTarget = state.allFiles.find(f => f.basename.toLowerCase() === actualVal.toLowerCase());
        if (!fileTarget) {
            const opt = settings.noteTypes[val];
            if (opt && opt.folder !== undefined && state.ui.folderInput) {
               state.isProgrammaticUpdate = true;
               state.ui.folderInput.setValue(opt.folder);
               state.useRelativeFolder = !!opt.useRelativeFolder;
               if (state.ui.folderToggleBtn) {
                 state.ui.folderToggleBtn.setIcon(state.useRelativeFolder ? "folder-dot" : "folder-lock");
                 state.ui.folderToggleBtn.setTooltip(state.useRelativeFolder ? "In current folder or subfolder" : "Fixed absolute folder path");
               }
               state.isProgrammaticUpdate = false;
            }
        }
      }
    });
  });

  // Add a button to manually pull the target directory from the active Note Type
  noteTypeRow.addExtraButton(btn => {
    state.ui.resetFolderBtn = btn;
    btn.setIcon("folder-sync")
       .setTooltip("Apply folder from selected Note Type")
       .onClick(() => {
         const opt = settings.noteTypes[state.selectedNoteType];
         if (opt && opt.folder !== undefined && state.ui.folderInput) {
           state.isProgrammaticUpdate = true;
           state.ui.folderInput.setValue(opt.folder);
           state.useRelativeFolder = !!opt.useRelativeFolder;
           if (state.ui.folderToggleBtn) {
             state.ui.folderToggleBtn.setIcon(state.useRelativeFolder ? "folder-dot" : "folder-lock");
             state.ui.folderToggleBtn.setTooltip(state.useRelativeFolder ? "In current folder or subfolder" : "Fixed absolute folder path");
           }
           state.isProgrammaticUpdate = false;
           state.folderManuallyEdited = false;
         }
       });
  });

  // 4.1 On-the-spot Note Type creation
  noteTypeRow.addExtraButton(btn => {
    btn.setIcon("plus")
       .setTooltip("Create new Note Type")
       .onClick(() => {
         const tempId = "New Type " + (Object.keys(settings.noteTypes).length + 1);
         settings.noteTypes[tempId] = {
           folder: "",
           useRelativeFolder: state.useRelativeFolder,
           type: "file",
           template: settings.baseTemplateForNewNoteTypes || "",
           prefix: "",
           icon: "file",
           ontology: { default: "referencing", actions: ["referencing"] }
         };
         
         // Passed with isNew = true to gracefully handle escape/cancel deletions
         openEditNoteTypeModal(tempId, (finalName) => {
           ea.setScriptSettings(settings);
           const targetName = finalName || tempId;
           
           state.selectedNoteType = targetName;
           settings.lastSelectedNoteType = targetName;
           
           if(tab && typeof tab.onOpen === "function") {
               tab.onOpen(); // Re-render the capture tab inline
           }
         }, true); 
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

function buildCaptureFooter(contentEl, state, tab) {
  // Footer is a normal non-wrapping flex row. `align-items: flex-end` forces the cog down when the button group expands vertically.
  const footer = contentEl.createDiv({
    attr: { style: "display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; gap: 10px; margin-bottom: 30px;" }
  });

  // buttonGroup gets CSS order 2 so it sits on the right visually
  const buttonGroup = footer.createDiv({ 
    attr: { style: "display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: 1 1 auto; order: 2;" } 
  });

  const handleAction = (actionType) => {
    const val = state.ui.searchInput.getValue().trim();
    const folderVal = state.ui.folderInput ? state.ui.folderInput.getValue().trim() : "";
    
    if (!val) { new Notice("Please write a valid note title"); return; }
    
    state.finalData = {
      filename: val,
      folder: folderVal,
      useRelativeFolder: state.useRelativeFolder, 
      noteType: state.selectedNoteType,
      format: state.selectedFormat,
      ontologyAction: state.selectedOntology,
      actionType,
      openNoteBBehavior: state.openNoteBBehavior,
      sidepanelWasVisible: state.sidepanelWasVisible 
    };
    tab.close();
  };

  // Assign CSS `order` so visual LTR layout matches standard wrap behavior 
  // (Items with higher order appear further right, and will drop to the bottom line first when wrapped)
  const captureBtn = buttonGroup.createEl("button", { 
    text: "Capture", 
    cls: "mod-cta", 
    attr: { 
      style: "order: 4;",
      "aria-label": "Create the note, add backlinks/embeds, and open it for editing."
    } 
  });
  captureBtn.addEventListener("click", () => handleAction("CAPTURE"));

  const linkOnlyBtn = buttonGroup.createEl("button", { 
    text: "Link", 
    attr: { 
      style: "order: 3;",
      "aria-label": "Link to an item without creating the note and without opening it for editing."
    } 
  });
  linkOnlyBtn.addEventListener("click", () => handleAction("ADD_LINK_ONLY"));

  const linkCreateBtn = buttonGroup.createEl("button", { 
    text: "Link + File", 
    attr: { 
      style: "order: 2;",
      "aria-label": "Link to the item and create its note/file in the background (but do not open for note taking)."
    } 
  });
  linkCreateBtn.addEventListener("click", () => handleAction("ADD_LINK_CREATE"));

  const captureHereBtn = buttonGroup.createEl("button", { text: "Capture Here", attr: { style: "order: 1;" } });
  captureHereBtn.style.display = state.selectedFormat === "Markdown" ? "" : "none";
  captureHereBtn.addEventListener("click", () => handleAction("CAPTURE_HERE"));
  state.ui.captureHereBtnReference = captureHereBtn;

  // Cog gets CSS order 1 in the main footer container so it sits on the left visually
  const cogBtn = footer.createEl("button", { cls: "clickable-icon", attr: { style: "order: 1; margin: auto;" } });
  cogBtn.innerHTML = ea.obsidian.getIcon("settings").outerHTML;
  cogBtn.addEventListener("click", () => {
    window.ExcalidrawCaptureNoteScript.tempSearchValue = state.ui.searchInput.getValue().trim();
    // Crucially: Do not call tab.close() here. 
    openSettingsModal(tab);
  });
}

async function openCaptureModal(initialSearchValue) {
  return new Promise(async resolve => {
    
    // Assess visibility state before grabbing the tab
    const sidepanelLeaf = ea.getSidepanelLeaf();
    let sidepanelWasVisible = false;
    if (sidepanelLeaf && sidepanelLeaf.view.containerEl.offsetParent !== null) {
      sidepanelWasVisible = true;
    }

    const tab = await ea.createSidepanelTab("Capture Contextual Note", false, true);
    if (!tab) {
        resolve(null);
        return;
    }
    
    tab.containerEl.classList.add("excalidraw-capture-note-modal");
    
    // Clear default title text and convert to a flex container to align elements
    tab.titleEl.empty();
    tab.titleEl.style.display = "flex";
    tab.titleEl.style.justifyContent = "space-between";
    tab.titleEl.style.alignItems = "center";
    tab.titleEl.style.width = "100%";
    
    // Add Main Title
    tab.titleEl.createSpan({ text: "Capture Contextual Note" });
    
    // Add right-aligned Version string
    tab.titleEl.createSpan({ 
      text: VERSION, 
      attr: { style: "font-size: 0.5em; color: var(--text-muted); font-weight: normal; margin-right: 8px;" } 
    });

    let initialFolder = "";
    let initialFilename = initialSearchValue || "";

    // Parse the path into folder and filename if a full link was passed
    if (initialFilename.includes("/")) {
      const parts = initialFilename.split("/");
      initialFilename = parts.pop();
      initialFolder = parts.join("/");
    }

    let allFiles = app.vault.getMarkdownFiles().concat(app.vault.getFiles().filter(f => ea.isExcalidrawFile(f)));
    
    const templaterFolder = app.plugins.plugins["templater-obsidian"]?.settings?.templates_folder;
    const excalidrawTemplatePath = ea.plugin.settings.templateFilePath;

    allFiles = allFiles.filter(f => {
      if (templaterFolder && templaterFolder.trim() !== "" && f.path.startsWith(templaterFolder)) return false;
      if (excalidrawTemplatePath && excalidrawTemplatePath.trim() !== "" && f.path.startsWith(excalidrawTemplatePath)) return false;
      return true;
    });

    // Detect duplicate basenames for disambiguation in the suggester
    const basenameCounts = new Map();
    allFiles.forEach(f => {
      basenameCounts.set(f.basename, (basenameCounts.get(f.basename) || 0) + 1);
    });

    const searchItems = [];
    const fileBasenames = new Set();
    
    allFiles.forEach(f => {
      const isDuplicate = basenameCounts.get(f.basename) > 1;
      searchItems.push({ type: "file", basename: f.basename, file: f, isDuplicate });
      fileBasenames.add(f.basename);
      
      const cache = app.metadataCache.getFileCache(f);
      if (cache && cache.frontmatter && cache.frontmatter.aliases) {
        const aliases = Array.isArray(cache.frontmatter.aliases) 
          ? cache.frontmatter.aliases 
          : String(cache.frontmatter.aliases).split(",").map(a => a.trim());
        aliases.forEach(a => {
          if (a && typeof a === "string" && !a.includes("<"+"%")) { 
            searchItems.push({ type: "alias", basename: f.basename, alias: a, file: f, isDuplicate });
          }
        });
      }
    });

    const unresolvedLinks = Object.values(app.metadataCache.unresolvedLinks).flatMap(links => Object.keys(links));
    const uniqueUnresolved = [...new Set(unresolvedLinks)].map(link => {
      const parts = link.split("/");
      return parts[parts.length - 1].replace(/\.md$/i, "");
    });
    
    uniqueUnresolved.forEach(u => {
      if (!u.includes("<"+"%") && !fileBasenames.has(u)) { 
        searchItems.push({ type: "unresolved", basename: u });
        fileBasenames.add(u);
      }
    });

    const state = {
      finalData: null,
      initialFolder,
      useRelativeFolder: settings.useRelativeFolder || false,
      initialSearchValue: initialFilename,
      folderManuallyEdited: false, // Start false so we can auto-update if they change to a new file
      isProgrammaticUpdate: false,
      isInitializing: true,
      selectedNoteType: settings.lastSelectedNoteType || "",
      selectedFormat: settings.lastSelectedFormat || "Visual",
      openNoteBBehavior: settings.openNoteBBehavior || "adjacent pane",
      selectedOntology: "",
      allFiles: allFiles,
      searchItems: searchItems,
      sidepanelWasVisible: sidepanelWasVisible, // Include visibility state
      ui: {} 
    };

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
      onFileSelected: async (val, explicitFile = null) => {
        let actualVal = val.split("|")[0].trim();
        actualVal = actualVal.split("#")[0].trim(); // Remove hash anchors and block refs
        if (actualVal.toLowerCase().endsWith(".md")) {
            actualVal = actualVal.slice(0, -3); // Remove .md extension
        }
        
        // Use explicitFile passed down from suggester if available to handle duplicates correctly
        const fileTarget = explicitFile || state.allFiles.find(f => f.basename.toLowerCase() === actualVal.toLowerCase() || f.path.toLowerCase() === actualVal.toLowerCase() + ".md");
        
        if (fileTarget) {
          if (state.ui.folderInput) {
            state.isProgrammaticUpdate = true;
            state.ui.folderInput.setValue(fileTarget.parent.path);
            state.isProgrammaticUpdate = false;
            state.folderManuallyEdited = false; // Sync to existing target file
          }

          const detectedType = await detectNoteType(fileTarget);
          if (detectedType) {
            state.selectedNoteType = detectedType;
            state.ui.dropdownComponent.setValue(detectedType);
            state.ui.dropdownComponent.setDisabled(true);
            callbacks.updateIconPreview();
            callbacks.updateOntologyDropdown();
          }
          if (state.ui.resetFolderBtn) state.ui.resetFolderBtn.setDisabled(true);
        } else {
          // If a new file is being written and folder was not manually edited, inherit the Note Type's folder
          // We block the overwrite during initialization if they provided an initial folder
          if (!state.folderManuallyEdited && state.ui.folderInput && !state.isInitializing) {
            const opt = settings.noteTypes[state.selectedNoteType];
            if (opt && opt.folder !== undefined) {
              state.isProgrammaticUpdate = true;
              state.ui.folderInput.setValue(opt.folder);
              state.useRelativeFolder = !!opt.useRelativeFolder;
              if (state.ui.folderToggleBtn) {
                state.ui.folderToggleBtn.setIcon(state.useRelativeFolder ? "folder-dot" : "folder-lock");
                state.ui.folderToggleBtn.setTooltip(state.useRelativeFolder ? "In current folder or subfolder" : "Fixed absolute folder path");
              }
              state.isProgrammaticUpdate = false;
            }
          }
          if (state.ui.dropdownComponent) state.ui.dropdownComponent.setDisabled(false);
          if (state.ui.resetFolderBtn) state.ui.resetFolderBtn.setDisabled(false);
        }
      }
    };

    tab.onOpen = () => {
      const { contentEl } = tab;
      contentEl.empty();

      injectCaptureModalStyles(contentEl);
      buildCaptureFolderBox(contentEl, state);
      buildCaptureSearchBox(contentEl, state, callbacks);
      buildCaptureLinkTypeSelector(contentEl, state, callbacks, tab);
      buildCaptureFormatSelector(contentEl, state);
      buildCaptureOpenBehaviorSelector(contentEl, state);
      buildCaptureOntologySelector(contentEl, state, callbacks);
      buildCaptureFooter(contentEl, state, tab);
      
      // Allow normal folder resets to happen on subsequent typing
      state.isInitializing = false;
    };

    tab.onClose = () => {
      // Clean up the sidepanel if we revealed it just for this script but it didn't complete
      if (!state.finalData && !state.sidepanelWasVisible) {
        const sidepanelLeaf = ea.getSidepanelLeaf();
        if (sidepanelLeaf && sidepanelLeaf.view.containerEl.offsetParent !== null) {
          ea.toggleSidepanelView();
        }
      }
      resolve(state.finalData);
    };
    tab.open();
  });
}

// -------------------------------------------------------------
// 6. UI: Settings & Multi-tier Configuration Modal (Refactored)
// -------------------------------------------------------------

function buildSettingsHeader(contentEl, modal, captureTab) {
  const headerContainer = contentEl.createDiv({ cls: "settings-header-container" });
  headerContainer.createEl("h2", { text: "DNP Workflows Configuration Panel", attr: { style: "margin:0;" } });
  
  const topSaveBtn = headerContainer.createEl("button", { text: "Save Settings", cls: "mod-cta" });
  topSaveBtn.addEventListener("click", () => {
    ea.setScriptSettings(settings);
    modal.close();
    
    // Instead of calling start() and creating an orphaned secondary sidepanel context, 
    // we instruct the current sidepanel to safely re-paint itself inline.
    if (captureTab && typeof captureTab.onOpen === "function") {
       captureTab.onOpen(); 
    } else {
       start(); 
    }
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

async function refreshTemplatePreview(previewDiv, alignSettingsDiv, configObj, saveCallback, refreshCallback) {
  previewDiv.empty();
  alignSettingsDiv.empty();
  
  if (!configObj.visualTemplateJSON) {
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
          
          // Run pasted elements through restoreElements
          parsed.elements = window.ExcalidrawLib.restoreElements(
            parsed.elements,
            null,
            { refreshDimensions: true, repairBindings: true }
          );
          
          configObj.visualTemplateJSON = JSON.stringify(parsed);
          saveCallback();
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
      const parsed = JSON.parse(configObj.visualTemplateJSON);
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
        configObj.visualTemplateJSON = "";
        saveCallback();
        refreshCallback();
      });
      
      new ea.obsidian.Setting(alignSettingsDiv)
        .setName("Vertical Alignment")
        .addDropdown(d => d
          .addOption("top", "Top")
          .addOption("middle", "Middle")
          .addOption("bottom", "Bottom")
          .setValue(configObj.visualTemplateVAlign || "middle")
          .onChange(v => { configObj.visualTemplateVAlign = v; saveCallback(); })
        );
        
      new ea.obsidian.Setting(alignSettingsDiv)
        .setName("Horizontal Alignment")
        .addDropdown(d => d
          .addOption("left", "Left")
          .addOption("center", "Center")
          .addOption("right", "Right")
          .setValue(configObj.visualTemplateHAlign || "center")
          .onChange(v => { configObj.visualTemplateHAlign = v; saveCallback(); })
        );
    } catch (e) {
      configObj.visualTemplateJSON = "";
      saveCallback();
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

  const refreshCallback = () => refreshTemplatePreview(
    previewDiv, 
    alignSettingsDiv, 
    settings, 
    () => ea.setScriptSettings(settings), 
    refreshCallback
  );
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
  
  const baseTemplateContainer = noteTypesSection.createDiv({ attr: { style: "margin-bottom: 15px;" } });
  new ea.obsidian.Setting(baseTemplateContainer)
    .setName("Base Template for New Ontologies")
    .setDesc("A generic template used automatically when creating new note types on the fly.")
    .addText(text => {
      text.setValue(settings.baseTemplateForNewNoteTypes || "").onChange(val => { 
          settings.baseTemplateForNewNoteTypes = val; 
          ea.setScriptSettings(settings);
      });
      new TemplateSuggest(app, text.inputEl);
    });

  const addBtnContainer = noteTypesSection.createDiv({ cls: "flex-row-spaced", attr: { style: "margin-bottom:15px;" } });
  addBtnContainer.createEl("span", { text: "Manage your note types:" });
  const addBtn = addBtnContainer.createEl("button", { text: "Add", cls: "mod-cta" });
  
  const listContainer = noteTypesSection.createDiv();
  const refreshCallback = () => refreshNoteTypesList(listContainer, refreshCallback);

  addBtn.addEventListener("click", () => {
    const tempId = "New Type " + (Object.keys(settings.noteTypes).length + 1);
    settings.noteTypes[tempId] = {
      folder: "",
      useRelativeFolder: false,
      type: "file",
      template: settings.baseTemplateForNewNoteTypes || "",
      prefix: "",
      icon: "file",
      ontology: { default: "referencing", actions: ["referencing"] }
    };
    
    // Passed with isNew = true to gracefully handle escape/cancel deletions
    openEditNoteTypeModal(tempId, () => {
      ea.setScriptSettings(settings);
      refreshCallback();
    }, true);
  });

  refreshCallback();
}

// -------------------------------------------------------------
// Settings Orchestrator
// -------------------------------------------------------------
function openSettingsModal(captureTab = null) {
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

    buildSettingsHeader(contentEl, modal, captureTab);
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
function openEditNoteTypeModal(noteTypeKey, saveCallback, isNew = false) {
  const modal = new ea.obsidian.Modal(app);
  modal.titleEl.setText(`Configure Note Type`);

  const typeConfig = settings.noteTypes[noteTypeKey];
  let originalKeyName = noteTypeKey;
  let isSaved = false;

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
      isSaved = true;
      saveCallback(finalName);
      modal.close();
    });

    let folderInputComp;
    const currentFolderPath = ea.targetView ? ea.targetView.file.parent.path : "/";

    new ea.obsidian.Setting(contentEl)
      .setName("Target Vault Folder")
      .addText(text => {
        folderInputComp = text;
        text.setValue(typeConfig.folder).onChange(val => { typeConfig.folder = val; });
        // Passing typeConfig directly ensures the Suggester inherits the toggle boolean accurately 
        new FolderSuggest(app, text.inputEl, typeConfig, currentFolderPath);
        typeConfig._tempTextInput = text.inputEl; 
      })
      .addExtraButton(btn => {
        const updateIcon = () => {
          btn.setIcon(typeConfig.useRelativeFolder ? "folder-dot" : "folder-lock");
          btn.setTooltip(typeConfig.useRelativeFolder ? "Relative to current note's folder" : "Absolute folder path");
        };
        updateIcon();
        
        btn.onClick(() => {
          typeConfig.useRelativeFolder = !typeConfig.useRelativeFolder;
          updateIcon();
          
          // Handle path transformation automatically
          let currentVal = folderInputComp.getValue().trim();
          const prefix = currentFolderPath === "/" ? "" : currentFolderPath;
          
          if (typeConfig.useRelativeFolder) {
            // Absolute to Relative
            if (currentVal === prefix) {
              folderInputComp.setValue("");
              typeConfig.folder = "";
            } else if (currentVal.startsWith(prefix + "/")) {
              const newRelative = currentVal.substring(prefix.length + 1);
              folderInputComp.setValue(newRelative);
              typeConfig.folder = newRelative;
            } else {
              folderInputComp.setValue("");
              typeConfig.folder = "";
            }
          } else {
            // Relative to Absolute
            if (currentVal === "") {
              folderInputComp.setValue(prefix);
              typeConfig.folder = prefix;
            } else {
              const newAbsolute = prefix ? `${prefix}/${currentVal}` : currentVal;
              folderInputComp.setValue(newAbsolute);
              typeConfig.folder = newAbsolute;
            }
          }

          if (typeConfig._tempTextInput) {
             typeConfig._tempTextInput.dispatchEvent(new Event("input"));
          }
        });
      });

    new ea.obsidian.Setting(contentEl)
      .setName("Template Path")
      .setDesc("The full path of your Templater note template (.md extension is not required)")
      .addText(text => {
        text.setValue(typeConfig.template).onChange(val => { typeConfig.template = val; });
        new TemplateSuggest(app, text.inputEl);
      });

    // Strip unsafe characters to guarantee OS-level file creation compatibility
    new ea.obsidian.Setting(contentEl)
      .setName("File Prefix")
      .addText(text => text.setValue(typeConfig.prefix).onChange(val => { 
        const cleaned = val.replace(/[\\/:"*?<>|]/g, '');
        if (cleaned !== val) {
          text.setValue(cleaned);
        }
        typeConfig.prefix = cleaned; 
      }));

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

    // Note Type Specific Visual Template Elements
    const templateSection = contentEl.createEl("details", { cls: "setting-sub-section", attr: { style: "margin-top: 15px;" } });
    templateSection.createEl("summary", { text: "Note Type Specific Visual Template Elements" });
    templateSection.createEl("p", {
      text: "If defined, these elements will override the global visual template.",
      attr: { style: "color: var(--text-muted); font-size: 0.9em; margin-bottom: 10px;" }
    });
    
    const previewDiv = templateSection.createDiv();
    const alignSettingsDiv = templateSection.createDiv();

    const refreshVisualTemplateCallback = () => refreshTemplatePreview(
        previewDiv, 
        alignSettingsDiv, 
        typeConfig, 
        () => {}, // Changes will be formally persisted when the modal "Save" button is clicked
        refreshVisualTemplateCallback
    );
    refreshVisualTemplateCallback();
  };

  modal.onClose = () => {
    // If the creation workflow is abandoned before explicitly saving, erase the orphaned entry
    if (isNew && !isSaved) {
      delete settings.noteTypes[originalKeyName];
      ea.setScriptSettings(settings);
    }
    setTimeout(() => { delete modal; });
  };
  modal.open();
}

// -------------------------------------------------------------
// 8. Run Trigger
// -------------------------------------------------------------
await start();