/*
# Deconstruct Selected Elements Into New Drawing

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-deconstruct.jpg)

Select elements in the current Excalidraw scene. The script moves the selected elements into a new Excalidraw file, replaces the original selection with an embedded reference to that new drawing, and optionally opens the new file.

The modal lets you choose the destination folder, filename, template, whether to open the new drawing, whether to reuse an adjacent tab, and whether the inserted embed should be anchored at 100% size.

Destination names are validated before creation. Filenames reject path separators and characters that are invalid or unsafe across common vault platforms (`\\ / : * ? " < > |` and control characters). Folder paths use `/` only as the path separator and validate each folder name independently.

## Usage

1. Select one or more elements in an Excalidraw drawing.
2. Run **Deconstruct Selected Elements Into New Drawing**.
3. Choose the destination folder, file name, and optional template.
4. Choose **Insert** or **Insert @100%**.

The default filename and additional template paths can be configured through the script settings.

## Original demonstrations

![](https://www.youtube.com/watch?v=HRtaaD34Zzg)
![](https://www.youtube.com/watch?v=mvMQcz401yo)

Build version: 2026-09-04T17:17:37.900Z

```javascript
*/

// Script bundle
/* EA Script — deconstruct-selected-elements-into-new-drawing | ea-scripts v1.0.0 */
(() => {
  // src/sharedUtils/i18n.ts
  function interpolateTranslation(template, params = {}) {
    return Object.entries(params).reduce(
      (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
      template
    );
  }
  function createTranslator(requestedLocale, catalogs, fallbackLocale = "en") {
    const locale = requestedLocale.toLowerCase().replaceAll("_", "-");
    const baseLocale = locale.split("-")[0] ?? locale;
    return (key, params = {}) => {
      const template = catalogs[locale]?.[key] ?? catalogs[baseLocale]?.[key] ?? catalogs[fallbackLocale]?.[key] ?? key;
      return interpolateTranslation(template, params);
    };
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/de.ts
  var de = {};

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/en.ts
  var en = {
    requiresNewerVersion: "This script requires Excalidraw 2.27.0 or newer. Please install the latest version.",
    selectElements: "You must select elements first.",
    templatesSettingDesc: "Comma-separated list of template filepaths",
    defaultFilenameSettingDesc: "The default filename to use when deconstructing elements.",
    modalTitle: "Deconstruct Elements",
    folderPath: "Folder path",
    fileName: "File name",
    selectTemplate: "Select template",
    noTemplate: "none",
    openDeconstructedImage: "Open deconstructed image",
    reuseExistingTab: "Reuse existing tab",
    reuseExistingTabDesc: "If available, open in an adjacent tab. Otherwise open in a new tab.",
    insert: "Insert",
    insertTooltip: "Insert without anchoring",
    insertAt100: "Insert @100%",
    insertAt100Tooltip: "Anchor to 100% size",
    filenameRequired: "Filename is required.",
    invalidFilenameCharacter: 'File name contains an invalid character: "{character}".',
    invalidFolderCharacter: 'Folder path contains an invalid character: "{character}".',
    invalidFilename: 'Invalid file name: "{name}".',
    invalidFolderPath: 'Invalid folder path near: "{name}".',
    somethingWentWrong: "Something went wrong while creating the deconstructed drawing.",
    deconstructionReady: "Deconstruction ready."
  };

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/es.ts
  var es = {};

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/fr.ts
  var fr = {};

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/ru.ts
  var ru = {};

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/zh-cn.ts
  var zhCn = {};

  // src/scripts/deconstruct-selected-elements-into-new-drawing/lang/index.ts
  var CATALOGS = { en, de, es, fr, ru, "zh-cn": zhCn };
  function createDeconstructTranslator(locale) {
    return createTranslator(locale, CATALOGS);
  }

  // src/sharedUtils/eaEmbeddedFiles.ts
  function copyImageFile(ea2, element, fileId) {
    const view = ea2.targetView;
    if (!view) return false;
    const image = view.excalidrawData.getFile(fileId);
    const filePath = image?.linkParts?.original ?? image?.file?.path;
    const hyperlink = image?.hyperlink;
    if (!image || !filePath && !hyperlink) return false;
    ea2.imagesDict[fileId] = {
      mimeType: image.mimeType,
      id: fileId,
      dataURL: image.img,
      created: image.mtime,
      file: filePath,
      hyperlink,
      hasSVGwithBitmap: image.isSVGwithBitmap,
      latex: null,
      colorMap: ea2.getColorMapForImageElement(element)
    };
    return true;
  }
  function copyEquationFile(ea2, element, fileId) {
    const view = ea2.targetView;
    if (!view) return;
    const equation = view.excalidrawData.getEquation(fileId);
    const sceneFile = view.getScene()?.files[fileId];
    if (!equation || !sceneFile) return;
    ea2.imagesDict[fileId] = {
      mimeType: sceneFile.mimeType,
      id: fileId,
      dataURL: sceneFile.dataURL,
      created: sceneFile.created,
      file: null,
      hasSVGwithBitmap: null,
      latex: equation.latex
    };
  }
  function copyEmbeddedFilesToEa(ea2, elements) {
    for (const element of elements) {
      if (element.type !== "image" || !element.fileId) continue;
      if (!copyImageFile(ea2, element, element.fileId)) {
        copyEquationFile(ea2, element, element.fileId);
      }
    }
  }

  // src/sharedUtils/vaultPaths.ts
  var INVALID_FILE_NAME_CHARACTER = /[\\/:*?"<>|\u0000-\u001F]/u;
  var INVALID_FOLDER_SEGMENT_CHARACTER = /[\\:*?"<>|\u0000-\u001F]/u;
  var WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
  function isVaultRootFolderPath(folderPath) {
    return folderPath === "" || folderPath === "/";
  }
  function firstInvalidCharacter(value, pattern) {
    return value.match(pattern)?.[0] ?? null;
  }
  function validateSegment(segment, invalidCharacterPattern, allowEmpty) {
    if (!segment) {
      return allowEmpty ? { valid: true } : { valid: false, reason: "empty", segment };
    }
    if (segment === "." || segment === "..") {
      return { valid: false, reason: "dot-segment", segment };
    }
    const invalidCharacter = firstInvalidCharacter(segment, invalidCharacterPattern);
    if (invalidCharacter !== null) {
      return {
        valid: false,
        reason: "invalid-character",
        segment,
        character: invalidCharacter
      };
    }
    if (WINDOWS_RESERVED_NAME.test(segment)) {
      return { valid: false, reason: "reserved-name", segment };
    }
    if (/[. ]$/u.test(segment)) {
      return { valid: false, reason: "trailing-dot-or-space", segment };
    }
    return { valid: true };
  }
  function validateVaultFileName(fileName) {
    return validateSegment(fileName, INVALID_FILE_NAME_CHARACTER, false);
  }
  function validateVaultFolderPath(folderPath) {
    if (isVaultRootFolderPath(folderPath)) return { valid: true };
    if (folderPath.startsWith("/") || folderPath.endsWith("/") || folderPath.includes("//")) {
      return { valid: false, reason: "invalid-path-shape", segment: folderPath };
    }
    for (const segment of folderPath.split("/")) {
      const result = validateSegment(segment, INVALID_FOLDER_SEGMENT_CHARACTER, false);
      if (!result.valid) return result;
    }
    return { valid: true };
  }
  function getUniqueVaultFilePath(folderPath, fileName, pathExists) {
    const resolvedFolderPath = isVaultRootFolderPath(folderPath) ? "" : folderPath;
    const lastDot = fileName.lastIndexOf(".");
    const hasExtension = lastDot > 0;
    const stem = hasExtension ? fileName.slice(0, lastDot) : fileName;
    const extension = hasExtension ? fileName.slice(lastDot) : "";
    const joinPath = (name) => resolvedFolderPath ? `${resolvedFolderPath}/${name}` : name;
    let candidate = joinPath(fileName);
    let suffix = 1;
    while (pathExists(candidate)) {
      candidate = joinPath(`${stem} ${suffix}${extension}`);
      suffix += 1;
    }
    return candidate;
  }
  function formatVaultInvalidCharacter(character) {
    const codePoint = character.codePointAt(0);
    if (codePoint === void 0 || codePoint >= 32) return character;
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  function rankVaultFolderSuggestions(folderPaths, query) {
    const lowerQuery = query.toLowerCase();
    return [...new Set(folderPaths)].filter((path) => path.toLowerCase().includes(lowerQuery)).sort((left, right) => {
      const leftStarts = left.toLowerCase().startsWith(lowerQuery);
      const rightStarts = right.toLowerCase().startsWith(lowerQuery);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.localeCompare(right);
    });
  }

  // src/sharedUtils/windowTiming.ts
  function sleepInWindow(ownerWindow, milliseconds) {
    return new Promise((resolve) => ownerWindow.setTimeout(resolve, milliseconds));
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/deconstruction.ts
  async function waitForVaultFile(ea2, app2, path, ownerWindow) {
    for (let attempt = 0; attempt <= 100; attempt += 1) {
      const file = app2.vault.getAbstractFileByPath(path);
      if (file instanceof ea2.obsidian.TFile) {
        return file;
      }
      if (attempt < 100) await sleepInWindow(ownerWindow, 50);
    }
    return null;
  }
  async function waitForDrawingFile(ea2, app2, path, ownerWindow) {
    for (let attempt = 0; attempt <= 100; attempt += 1) {
      const file = app2.vault.getAbstractFileByPath(path);
      if (file instanceof ea2.obsidian.TFile && ea2.isExcalidrawFile(file)) {
        return file;
      }
      if (attempt < 100) await sleepInWindow(ownerWindow, 50);
    }
    return null;
  }
  function getExportPadding(ea2, app2, file) {
    const rawPadding = app2.metadataCache.getCache(file.path)?.frontmatter?.["excalidraw-export-padding"];
    const parsedPadding = Number.parseFloat(String(rawPadding));
    return Number.isNaN(parsedPadding) ? ea2.plugin.settings.exportPaddingSVG : parsedPadding;
  }
  async function replaceSelectionWithEmbed(context, file, padding, shouldAnchor) {
    const { ea: ea2, bounds } = context;
    for (const element of ea2.getElements()) {
      element.isDeleted = true;
    }
    await ea2.addImage(bounds.topX - padding, bounds.topY - padding, file, false, shouldAnchor);
    await ea2.addElementsToView(false, true, true);
    ea2.getExcalidrawAPI()?.history.clear();
  }
  async function openCreatedDrawing(context, file) {
    const { ea: ea2, app: app2, uiState } = context;
    if (!uiState.openDeconstructedImage) return;
    if (uiState.reuseTab) {
      ea2.openFileInNewOrAdjacentLeaf(file);
      return;
    }
    await app2.workspace.getLeaf("tab").openFile(file);
  }
  function isVaultRootFilePath(path) {
    return path.length > 0 && !path.includes("/");
  }
  async function createDrawingAtDestination(context, destination) {
    const { ea: ea2, app: app2, uiState, ownerWindow } = context;
    const requestedVaultRoot = isVaultRootFolderPath(destination.folderPath);
    const intendedRootPath = requestedVaultRoot ? getUniqueVaultFilePath(
      "/",
      destination.fileName,
      (path) => Boolean(app2.vault.getAbstractFileByPath(path))
    ) : null;
    const createOptions = {
      filename: destination.fileName,
      foldername: destination.folderPath,
      templatePath: uiState.templatePath,
      onNewPane: true,
      silent: true
    };
    const newPath = await ea2.create(createOptions);
    const normalizedNewPath = ea2.obsidian.normalizePath(newPath);
    if (!requestedVaultRoot || isVaultRootFilePath(normalizedNewPath)) {
      return normalizedNewPath;
    }
    const createdFile = await waitForVaultFile(ea2, app2, normalizedNewPath, ownerWindow);
    if (!createdFile) {
      return normalizedNewPath;
    }
    if (!intendedRootPath) return normalizedNewPath;
    const rootTarget = app2.vault.getAbstractFileByPath(intendedRootPath) ? getUniqueVaultFilePath(
      "/",
      destination.fileName,
      (path) => Boolean(app2.vault.getAbstractFileByPath(path))
    ) : intendedRootPath;
    await app2.fileManager.renameFile(createdFile, rootTarget);
    return rootTarget;
  }
  async function executeDeconstruction(context, destination, shouldAnchor) {
    const { ea: ea2, app: app2, t: t2, uiState, ownerWindow } = context;
    const newPath = await createDrawingAtDestination(context, destination);
    const file = await waitForDrawingFile(ea2, app2, newPath, ownerWindow);
    if (!file) {
      new Notice(t2("somethingWentWrong"));
      return;
    }
    const padding = getExportPadding(ea2, app2, file);
    await replaceSelectionWithEmbed(context, file, padding, shouldAnchor);
    await openCreatedDrawing(context, file);
    if (!uiState.openDeconstructedImage) new Notice(t2("deconstructionReady"));
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/destination.ts
  function validateDeconstructionDestination(folderPath, fileName) {
    const fileValidation = validateVaultFileName(fileName);
    if (!fileValidation.valid) {
      return { valid: false, field: "file", validation: fileValidation };
    }
    const folderValidation = validateVaultFolderPath(folderPath);
    if (!folderValidation.valid) {
      return { valid: false, field: "folder", validation: folderValidation };
    }
    return {
      valid: true,
      folderPath: folderPath === "/" ? "" : folderPath,
      fileName: fileName.toLowerCase().endsWith(".md") ? fileName : `${fileName}.md`
    };
  }
  function formatDestinationValidationError(t2, result) {
    const { validation } = result;
    if (result.field === "file" && validation.reason === "empty") {
      return t2("filenameRequired");
    }
    if (validation.reason === "invalid-character" && validation.character !== void 0) {
      const character = formatVaultInvalidCharacter(validation.character);
      return t2(result.field === "file" ? "invalidFilenameCharacter" : "invalidFolderCharacter", {
        character
      });
    }
    return t2(result.field === "file" ? "invalidFilename" : "invalidFolderPath", {
      name: validation.segment
    });
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/folderSuggest.ts
  function attachFolderSuggest(ea2, app2, inputEl) {
    const BaseSuggest = ea2.obsidian.AbstractInputSuggest;
    class FolderSuggest extends BaseSuggest {
      targetInput;
      constructor() {
        super(app2, inputEl);
        this.targetInput = inputEl;
      }
      getSuggestions(query) {
        const folderPaths = app2.vault.getAllLoadedFiles().filter((file) => file instanceof ea2.obsidian.TFolder).map((folder) => folder.path);
        return rankVaultFolderSuggestions(folderPaths, query);
      }
      renderSuggestion(value, el) {
        el.setText(value);
      }
      selectSuggestion(value, _event) {
        this.targetInput.value = value;
        const ownerWindow = this.targetInput.ownerDocument.defaultView;
        if (ownerWindow) {
          this.targetInput.dispatchEvent(new ownerWindow.Event("input", { bubbles: true }));
        }
        this.close();
      }
    }
    return new FolderSuggest();
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/modal.ts
  function createTextInput(context, content, label, value) {
    const row = content.createDiv({ cls: "setting-item" });
    row.createDiv({ cls: "setting-item-info" }).createEl("label", { text: label });
    const control = row.createDiv({ cls: "setting-item-control" });
    const input = new context.ea.obsidian.TextComponent(control);
    input.setValue(value);
    input.inputEl.style.width = "100%";
    return input;
  }
  function addBehaviorSettings(context, content) {
    const { ea: ea2, t: t2, config, uiState } = context;
    new ea2.obsidian.Setting(content).setName(t2("selectTemplate")).addDropdown((dropdown) => {
      if (config.templates.length === 0) dropdown.addOption("", t2("noTemplate"));
      for (const file of config.templates) dropdown.addOption(file.path, file.basename);
      dropdown.setValue(uiState.templatePath).onChange((value) => {
        uiState.templatePath = value;
      });
    });
    let reuseSetting = null;
    new ea2.obsidian.Setting(content).setName(t2("openDeconstructedImage")).addToggle(
      (toggle) => toggle.setValue(uiState.openDeconstructedImage).onChange((value) => {
        uiState.openDeconstructedImage = value;
        if (reuseSetting) reuseSetting.settingEl.style.display = value ? "" : "none";
      })
    );
    reuseSetting = new ea2.obsidian.Setting(content).setName(t2("reuseExistingTab")).setDesc(t2("reuseExistingTabDesc")).setClass("reuse-tab-setting").addToggle(
      (toggle) => toggle.setValue(uiState.reuseTab).onChange((value) => {
        uiState.reuseTab = value;
      })
    );
    reuseSetting.settingEl.style.display = uiState.openDeconstructedImage ? "" : "none";
    reuseSetting.settingEl.style.borderTop = "none";
  }
  async function submitDeconstruction(context, modal, inputs, shouldAnchor) {
    const destination = validateDeconstructionDestination(
      inputs.folder.getValue(),
      inputs.file.getValue()
    );
    if (!destination.valid) {
      new Notice(formatDestinationValidationError(context.t, destination));
      return;
    }
    modal.close();
    await executeDeconstruction(context, destination, shouldAnchor);
  }
  function addButtons(context, modal, content, inputs) {
    const buttons = content.createDiv({ cls: "excalidraw-dialog-buttons" });
    buttons.style.marginTop = "20px";
    buttons.style.display = "flex";
    buttons.style.gap = "12px";
    buttons.style.justifyContent = "flex-end";
    new context.ea.obsidian.ButtonComponent(buttons).setButtonText(context.t("insert")).setTooltip(context.t("insertTooltip")).onClick(async () => submitDeconstruction(context, modal, inputs, false));
    new context.ea.obsidian.ButtonComponent(buttons).setButtonText(context.t("insertAt100")).setTooltip(context.t("insertAt100Tooltip")).setCta().onClick(async () => submitDeconstruction(context, modal, inputs, true));
  }
  function openDeconstructModal(context) {
    const { ea: ea2, app: app2, t: t2, config } = context;
    const modal = new ea2.FloatingModal(app2);
    modal.setTitle(t2("modalTitle"));
    let folderSuggest = null;
    modal.onOpen = () => {
      const content = modal.contentEl;
      content.empty();
      const currentFolder = ea2.targetView?.file.parent?.path ?? "";
      const folderInput = createTextInput(context, content, t2("folderPath"), currentFolder);
      folderSuggest = attachFolderSuggest(ea2, app2, folderInput.inputEl);
      const fileInput = createTextInput(context, content, t2("fileName"), config.defaultFileName);
      ea2.targetView?.ownerWindow.setTimeout(() => fileInput.inputEl.focus(), 50);
      addBehaviorSettings(context, content);
      addButtons(context, modal, content, { folder: folderInput, file: fileInput });
    };
    modal.onClose = () => {
      folderSuggest?.close();
      modal.contentEl.empty();
    };
    modal.open();
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/settings.ts
  var TEMPLATES_SETTING = "Templates";
  var DEFAULT_FILE_NAME_SETTING = "Default file name";
  var DEFAULT_FILE_NAME = "deconstructed";
  function asTextScriptSetting(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value;
    if (typeof record.value !== "string") return null;
    return {
      value: record.value,
      description: typeof record.description === "string" ? record.description : ""
    };
  }
  async function ensureSettings(ea2, t2) {
    const current = ea2.getScriptSettings() ?? {};
    const templates = asTextScriptSetting(current[TEMPLATES_SETTING]);
    const defaultFileName = asTextScriptSetting(current[DEFAULT_FILE_NAME_SETTING]);
    if (templates && defaultFileName) return current;
    const next = { ...current };
    if (!templates) {
      next[TEMPLATES_SETTING] = {
        value: "",
        description: t2("templatesSettingDesc")
      };
    }
    if (!defaultFileName) {
      next[DEFAULT_FILE_NAME_SETTING] = {
        value: DEFAULT_FILE_NAME,
        description: t2("defaultFilenameSettingDesc")
      };
    }
    await ea2.setScriptSettings(next);
    return next;
  }
  function resolveTemplates(ea2, app2, configuredPaths) {
    const customTemplates = configuredPaths.split(",").map((path) => path.trim()).filter(Boolean).map((path) => app2.metadataCache.getFirstLinkpathDest(path, "")).filter((file) => file !== null);
    const byPath = /* @__PURE__ */ new Map();
    for (const file of [...customTemplates, ...ea2.getListOfTemplateFiles() ?? []]) {
      byPath.set(file.path, file);
    }
    return [...byPath.values()].sort((left, right) => left.basename.localeCompare(right.basename));
  }
  async function loadDeconstructConfig(ea2, app2, t2) {
    const settings = await ensureSettings(ea2, t2);
    const templatesSetting = asTextScriptSetting(settings[TEMPLATES_SETTING]);
    const defaultFileNameSetting = asTextScriptSetting(settings[DEFAULT_FILE_NAME_SETTING]);
    const configuredTemplatePaths = templatesSetting?.value ?? "";
    return {
      defaultFileName: defaultFileNameSetting?.value || DEFAULT_FILE_NAME,
      templates: resolveTemplates(ea2, app2, configuredTemplatePaths)
    };
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/uiState.ts
  function getDeconstructUiState(ownerWindow, defaultTemplatePath) {
    const deconstructWindow = ownerWindow;
    const existing = deconstructWindow.ExcalidrawDeconstructElements;
    if (!existing) {
      const state = {
        openDeconstructedImage: true,
        reuseTab: true,
        templatePath: defaultTemplatePath
      };
      deconstructWindow.ExcalidrawDeconstructElements = state;
      return state;
    }
    if (typeof existing.reuseTab !== "boolean") existing.reuseTab = true;
    if (typeof existing.openDeconstructedImage !== "boolean") {
      existing.openDeconstructedImage = true;
    }
    if (typeof existing.templatePath !== "string") existing.templatePath = defaultTemplatePath;
    return existing;
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/run.ts
  async function runDeconstructSelectedElements(scriptEa, app2, t2) {
    if (!scriptEa.verifyMinimumPluginVersion("2.27.0")) {
      new Notice(t2("requiresNewerVersion"));
      return;
    }
    const targetView = scriptEa.targetView;
    if (!targetView) return;
    const selectedElements = scriptEa.getViewSelectedElements();
    if (selectedElements.length === 0) {
      new Notice(t2("selectElements"));
      return;
    }
    const ea2 = scriptEa;
    const bounds = ea2.getBoundingBox(selectedElements);
    ea2.clear();
    ea2.copyViewElementsToEAforEditing(selectedElements);
    copyEmbeddedFilesToEa(ea2, ea2.getElements());
    const config = await loadDeconstructConfig(ea2, app2, t2);
    const defaultTemplatePath = config.templates[0]?.path ?? "";
    const uiState = getDeconstructUiState(targetView.ownerWindow, defaultTemplatePath);
    if (uiState.templatePath && !config.templates.some((file) => file.path === uiState.templatePath)) {
      uiState.templatePath = defaultTemplatePath;
    }
    openDeconstructModal({
      ea: ea2,
      app: app2,
      t: t2,
      config,
      uiState,
      bounds,
      ownerWindow: targetView.ownerWindow
    });
  }

  // src/scripts/deconstruct-selected-elements-into-new-drawing/main.ts
  var t = createDeconstructTranslator(ea.obsidian.moment.locale());
  void runDeconstructSelectedElements(ea, app, t);
})();

/* end of bundle */
