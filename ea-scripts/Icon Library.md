/*
 * ==============================================================================
 * Icon Library Sidepanel
 * ==============================================================================
 * Purpose:
 * Provides a responsive, lazily loaded icon library implemented natively as an
 * Excalidraw Automate Sidepanel. It allows users to search, keyboard-navigate,
 * and seamlessly insert items (SVG exports of Excalidraw files or raster images)
 * into Excalidraw or MindMap Builder.
 *
 * Key Features:
 * - Configurable regex-based file filtering and keyword extraction.
 * - Auto-generation of SVG thumbnails for Excalidraw files.
 * - Lazy-loaded grid with responsive thumbnail sizing via a vertical slider popover.
 * - Theme-aware thumbnail backgrounds (configurable for Light and Dark modes).
 * - Keyboard accessibility for navigation and insertion.
 * - MindMap Builder integration.
 *
 * High-Level Logic / Architecture:
 * - Global Constants & Strings: Centralized at the top for easy localization and tuning.
 * - Main entry point (`main()`) handles singleton tab creation and state management.
 * - Strictly modular UI rendering functions separate layout assembly from business logic.
 * - Lazy loading is managed via an IntersectionObserver to conserve memory.
 * - A custom settings modal handles configuration and includes a live regex tester.
 * ==============================================================================
 ```js*/

// ==============================================================================
// 1. Constants & Strings
// ==============================================================================

const STRINGS = {
    TAB_TITLE: "Icon Library",
    SEARCH_PLACEHOLDER: "Search icons...",
    LOADING: "Loading...",
    ERROR: "Error",
    SETTINGS_TITLE: "Icon Library Settings",
    SETTINGS_SAVE: "Save Settings",
    TEST_REGEX_TITLE: "Test Regex & Find Matches",
    TEST_REGEX_PLACEHOLDER: "Enter a filename to test regex...",
    TEST_BTN_FIND: "Find All Matching Files in Vault",
    EXCLUDE_NAME: "Exclude Folders",
    EXCLUDE_DESC: "Comma or newline separated folder paths to ignore.",
    WIDTH_NAME: "Default Icon Width",
    WIDTH_DESC: "Width when inserting the icon into the scene.",
    LIGHT_BG_NAME: "Light Mode Thumbnail Background",
    LIGHT_BG_DESC: "Background color applied behind thumbnails in Light mode (e.g. #ffffff or rgba(0,0,0,0.1)). Leave empty for transparent.",
    DARK_BG_NAME: "Dark Mode Thumbnail Background",
    DARK_BG_DESC: "Background color applied behind thumbnails in Dark mode. Leave empty for transparent.",
    FILTERS_TITLE: "Filters (Regular Expressions)",
    FILTERS_DESC: "Create regular expressions to match filenames and extract keywords using capture groups (.*). Note: All expressions are evaluated case-insensitively."
};

const CONSTANTS = {
    IMAGE_EXTS: ["png", "jpg", "jpeg", "gif", "svg", "webp"],
    DEFAULT_THUMB_SIZE: 100,
    DEFAULT_ICON_WIDTH: 180,
    DEBOUNCE_DELAY: 200,
    OBSERVER_MARGIN: "50px",
    ICON_SCALE: "scaling",
    ICON_EXPAND_FALLBACK: "expand",
    ICON_SETTINGS: "settings",
    CSS_PREFIX: "excalidraw-icon-library-"
};

// ==============================================================================
// 2. Data & Utility Functions
// ==============================================================================

/**
 * Initializes and returns the script settings, ensuring all default values are present.
 * @returns {Object} The current settings object.
 */
function initializeSettings() {
    let currentSettings = ea.getScriptSettings();

    if (!currentSettings.filters) {
        currentSettings = {
            filters: [
                { name: "Icon", pattern: "^icon - (.*?)(?: - [^-]+)?$" },
                { name: "Stickfigure", pattern: "^stickfigure - (.*?)(?: - [^-]+)?$" },
                { name: "Logo", pattern: "^logo - (.*?)(?: - [^-]+)?$" }
            ],
            excludeFolders: "Assets/nosync",
            defaultIconWidth: CONSTANTS.DEFAULT_ICON_WIDTH,
            thumbSize: CONSTANTS.DEFAULT_THUMB_SIZE,
            lightBgColor: "#FFFFFF60",
            darkBgColor: "#FFFFFF60"
        };
        ea.setScriptSettings(currentSettings);
    }
    
    // Patch existing configurations missing new properties
    if (currentSettings.lightBgColor === undefined) currentSettings.lightBgColor = "#FFFFFF60";
    if (currentSettings.darkBgColor === undefined) currentSettings.darkBgColor = "#FFFFFF60";
    if (currentSettings.defaultIconWidth === undefined) currentSettings.defaultIconWidth = CONSTANTS.DEFAULT_ICON_WIDTH;
    if (currentSettings.thumbSize === undefined) currentSettings.thumbSize = CONSTANTS.DEFAULT_THUMB_SIZE;
    
    return currentSettings;
}

/**
 * Creates a debounced version of the provided function.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Scans the vault for image and Excalidraw files matching the active regex filters.
 * @param {Object} currentSettings - The current script settings.
 * @returns {Array<{file: TFile, keyword: string}>} Sorted array of matched files.
 */
function getLibraryItems(currentSettings) {
    const excludeFolders = (currentSettings.excludeFolders || "")
        .split(/[\n,]/)
        .map(f => f.trim())
        .filter(f => f);

    const files = app.vault.getFiles().filter(f => {
        if (excludeFolders.some(ex => f.path.startsWith(ex))) return false;
        const isImage = CONSTANTS.IMAGE_EXTS.includes(f.extension.toLowerCase());
        const isExcal = ea.isExcalidrawFile(f);
        return isImage || isExcal;
    });

    const items = [];
    const activeFilters = currentSettings.filters
        .map(f => {
            try { return new RegExp(f.pattern, "i"); }
            catch (e) { return null; }
        })
        .filter(f => f);

    for (const file of files) {
        let matched = false;
        let keyword = file.basename;

        for (const regex of activeFilters) {
            const match = file.basename.match(regex);
            if (match) {
                matched = true;
                if (match[1]) keyword = match[1];
                break;
            }
        }

        if (matched) {
            items.push({ file, keyword: keyword.trim() });
        }
    }

    return items.sort((a, b) => a.keyword.localeCompare(b.keyword));
}

// ==============================================================================
// 3. Rendering & Insertion Logic
// ==============================================================================

/**
 * Generates an SVG representation of an Excalidraw file for thumbnail display.
 * Simplifies loading by passing the file path directly as the templatePath to ea.createSVG().
 * Caches generated SVGs based on file modification time (mtime) for high performance.
 * @param {TFile} file - The Excalidraw file.
 * @returns {Promise<HTMLElement|SVGSVGElement>} The generated SVG element or an error div.
 */
async function getSvgThumbnail(file) {
    // Initialize the cache Map directly on the function object to avoid loose global variables
    if (!getSvgThumbnail.cache) {
        getSvgThumbnail.cache = new Map();
    }

    const cacheKey = file.path;
    const currentMtime = file.stat.mtime;
    const cachedItem = getSvgThumbnail.cache.get(cacheKey);

    // Return a clone of the cached SVG if the file hasn't been modified
    if (cachedItem && cachedItem.mtime === currentMtime) {
        // Deep clone the DOM node so it can be safely injected into multiple containers over time
        return cachedItem.svg.cloneNode(true);
    }

    try {
        // Ensure the workbench is empty so only the template content is rendered
        ea.clear(); 
        
        // Configure export settings (withBackground = false, withTheme = false)
        const exportSettings = ea.getExportSettings(false, false);
        
        // Generate the SVG by passing the file path as the template. 
        // ExcalidrawAutomate handles loading the scene and any embedded images natively.
        // We pass 'undefined' for the loader so EA creates its own.
        const svg = await ea.createSVG(file.path, false, exportSettings, undefined, "light", 0);
        
        // Store the mtime and a clone of the generated SVG in the cache
        getSvgThumbnail.cache.set(cacheKey, {
            mtime: currentMtime,
            svg: svg.cloneNode(true)
        });
        
        return svg;
    } catch (e) {
        console.error("Failed to generate SVG for", file.path, e);
        const div = document.createElement("div");
        div.innerText = STRINGS.ERROR;
        div.style.color = "var(--text-error)";
        return div;
    }
}

/**
 * Renders the thumbnail inside the provided container, generating SVG or loading an image.
 * @param {TFile} file - The file to render.
 * @param {HTMLElement} container - The DOM container to render into.
 * @returns {Promise<void>}
 */
async function renderThumbnail(file, container) {
    container.empty();
    if (ea.isExcalidrawFile(file)) {
        const svg = await getSvgThumbnail(file);
        svg.style.width = "100%";
        svg.style.height = "100%";
        container.appendChild(svg);
    } else {
        const img = container.createEl("img");
        img.src = app.vault.getResourcePath(file);
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
    }
}

/**
 * Inserts the selected file into the Excalidraw scene or MindMap Builder.
 * Modified to insert precisely at the visible center of the scene and auto-select.
 * @param {TFile} file - The file to insert.
 * @param {Object} currentSettings - The active settings containing dimensions.
 * @returns {Promise<void>}
 */
async function insertItem(file, currentSettings) {
    const mmb = window.MindMapBuilderAPI;
    let insertedToMmb = false;
    const targetWidth = currentSettings.defaultIconWidth;

    // MindMap Builder integration
    if (mmb && typeof mmb.ready === "function" && mmb.ready()) {
        const selRes = mmb.getSelection();
        if (selRes.ok && selRes.data.nodeId) {
            const link = `![[${file.path}|${targetWidth}]]`;
            const addRes = await mmb.addNode({
                text: link,
                parentId: selRes.data.nodeId
            });
            if (addRes.ok) insertedToMmb = true;
        }
    }

    // Standard Excalidraw insertion
    if (!insertedToMmb) {
        if (!ea.targetView) return;

        ea.clear();
        const center = ea.getViewCenterPosition();
        
        const id = await ea.addImage(center.x, center.y, file, false); // Insert at 100% scale first
        const el = ea.getElement(id);

        if (el) {
            if (el.width && el.height) {
                const ratio = el.height / el.width;
                el.width = targetWidth;
                el.height = targetWidth * ratio;
            } else {
                el.width = targetWidth;
                el.height = targetWidth;
            }
            
            // Adjust X and Y so the element is perfectly centered on the screen
            el.x = center.x - el.width / 2;
            el.y = center.y - el.height / 2;
        }

        // Add to view without repositioning to cursor
        await ea.addElementsToView(false, false, true);
        
        // Select the newly inserted element
        const newEl = ea.getViewElements().find(e => e.id === id);
        if (newEl) {
            ea.selectElementsInView([newEl]);
        }
    }
}

// ==============================================================================
// 4. UI Components & Layout
// ==============================================================================

/**
 * Injects required CSS styles into the sidepanel content element.
 * @param {HTMLElement} contentEl - The tab's content element.
 */
function injectCSS(contentEl) {
    contentEl.createEl("style", {
        text: `
        .${CONSTANTS.CSS_PREFIX}header { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; }
        
        .${CONSTANTS.CSS_PREFIX}search-wrapper { 
            display: flex; 
            align-items: center; 
            position: relative; 
            flex-grow: 1; 
            border: 1px solid var(--background-modifier-border); 
            border-radius: 4px; 
            background: var(--background-modifier-form-field); 
        }
        .${CONSTANTS.CSS_PREFIX}search { 
            flex-grow: 1; 
            padding: 5px 8px; 
            border: none !important; 
            box-shadow: none !important; 
            background: transparent !important; 
        }
        
        .${CONSTANTS.CSS_PREFIX}scale-btn { 
            cursor: pointer; 
            padding: 4px 8px; 
            display: flex; 
            align-items: center; 
            color: var(--text-muted); 
        }
        .${CONSTANTS.CSS_PREFIX}scale-btn:hover { color: var(--text-normal); }
        
        .${CONSTANTS.CSS_PREFIX}slider-popover { 
            display: none; 
            position: absolute; 
            right: 0; 
            top: calc(100% + 5px); 
            z-index: 10; 
            background: var(--background-secondary); 
            border: 1px solid var(--background-modifier-border); 
            padding: 10px 0; 
            border-radius: 6px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        
        /* Apply Obsidian accent color directly to the range slider and force vertical layout safely */
        .${CONSTANTS.CSS_PREFIX}slider {
            -webkit-appearance: slider-vertical;
            appearance: slider-vertical;
            accent-color: var(--interactive-accent) !important;
        }

        .${CONSTANTS.CSS_PREFIX}settings-btn { 
            cursor: pointer; 
            padding: 4px; 
            border-radius: 4px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        .${CONSTANTS.CSS_PREFIX}settings-btn:hover { background-color: var(--background-modifier-hover); }
        
        .${CONSTANTS.CSS_PREFIX}grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 100px), 1fr));
            gap: 10px;
            overflow-y: auto;
            padding-bottom: 20px;
        }
        
        .${CONSTANTS.CSS_PREFIX}card {
            display: flex;
            flex-direction: column;
            align-items: center;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            padding: 8px;
            cursor: pointer;
            outline: none;
            transition: border-color 0.2s, background-color 0.2s;
            background: var(--background-secondary);
        }
        .${CONSTANTS.CSS_PREFIX}card:hover, .${CONSTANTS.CSS_PREFIX}card:focus {
            border-color: var(--interactive-accent);
            background: var(--background-primary);
        }
        
        .${CONSTANTS.CSS_PREFIX}img-container {
            width: 100%;
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border-radius: 4px;
        }
        
        .${CONSTANTS.CSS_PREFIX}label {
            margin-top: 8px;
            font-size: 0.8em;
            text-align: center;
            word-break: break-word;
            color: var(--text-normal);
            max-height: 2.4em;
            overflow: hidden;
            user-select: none;
        }
        
        .${CONSTANTS.CSS_PREFIX}loading {
            color: var(--text-muted);
            font-size: 0.8em;
        }
        `
    });
}

/**
 * Builds the header section containing the search bar, scale popover, and settings button.
 * @param {HTMLElement} contentEl - The parent container.
 * @param {Object} state - The global script state.
 * @returns {Object} References to the search input, size slider, and settings button.
 */
function buildHeaderUI(contentEl, state) {
    const headerRow = contentEl.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}header` });
    
    // Search & Sizer wrapper
    const searchWrapper = headerRow.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}search-wrapper` });
    const searchInput = searchWrapper.createEl("input", { 
        type: "text", 
        cls: `${CONSTANTS.CSS_PREFIX}search`, 
        placeholder: STRINGS.SEARCH_PLACEHOLDER 
    });
    
    const scaleBtn = searchWrapper.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}scale-btn` });
    scaleBtn.innerHTML = ea.obsidian.getIcon(CONSTANTS.ICON_SCALE)?.outerHTML 
                      || ea.obsidian.getIcon(CONSTANTS.ICON_EXPAND_FALLBACK)?.outerHTML || "↕";
    
    // Vertical Sizer Popover
    const sliderPopover = searchWrapper.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}slider-popover` });
    const sizeSlider = sliderPopover.createEl("input", { 
        type: "range", 
        cls: `${CONSTANTS.CSS_PREFIX}slider`,
        attr: { 
            min: "50", 
            max: "250", 
            value: state.settings.thumbSize,
            orient: "vertical", 
            // Removed invalid writing-mode, rely on CSS appearance defined in injectCSS()
            style: "width: 24px; height: 100px; display: block; margin: 0 auto;" 
        } 
    });

    // Settings Button
    const settingsBtn = headerRow.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}settings-btn` });
    settingsBtn.innerHTML = ea.obsidian.getIcon(CONSTANTS.ICON_SETTINGS)?.outerHTML;

    // Popover toggle logic
    scaleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sliderPopover.style.display = sliderPopover.style.display === "none" ? "block" : "none";
    });

    contentEl.ownerDocument.addEventListener("click", (e) => {
        if (!scaleBtn.contains(e.target) && !sliderPopover.contains(e.target)) {
            sliderPopover.style.display = "none";
        }
    });

    return { searchInput, sizeSlider, settingsBtn };
}

/**
 * Handles keyboard navigation within the thumbnail grid.
 * @param {KeyboardEvent} e - The keyboard event.
 * @param {HTMLElement} card - The card element currently focused.
 * @param {HTMLElement} grid - The parent grid container.
 * @param {TFile} file - The file associated with the card.
 * @param {Object} currentSettings - The active settings.
 */
function handleGridKeydown(e, card, grid, file, currentSettings) {
    const cards = Array.from(grid.querySelectorAll(`.${CONSTANTS.CSS_PREFIX}card`));
    const idx = cards.indexOf(card);
    if (idx === -1) return;

    let cols = 1;
    if (cards.length > 1) {
        const top0 = cards[0].offsetTop;
        for (let i = 1; i < cards.length; i++) {
            if (cards[i].offsetTop > top0) {
                cols = i;
                break;
            }
        }
        if (cols === 1 && cards[cards.length - 1].offsetTop === top0) {
            cols = cards.length;
        }
    }

    let target = -1;
    if (e.key === "ArrowRight") target = idx + 1;
    else if (e.key === "ArrowLeft") target = idx - 1;
    else if (e.key === "ArrowDown") target = idx + cols;
    else if (e.key === "ArrowUp") target = idx - cols;

    if (target >= 0 && target < cards.length) {
        e.preventDefault();
        cards[target].focus();
    } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        insertItem(file, currentSettings);
    }
}

/**
 * Creates a single thumbnail card and attaches listeners.
 * @param {Object} item - The library item {file, keyword}.
 * @param {HTMLElement} gridContainer - The grid DOM element.
 * @param {IntersectionObserver} observer - The lazy loading observer.
 * @param {Object} currentSettings - The active settings.
 */
function createThumbnailCard(item, gridContainer, observer, currentSettings) {
    const card = gridContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}card`, attr: { tabindex: "0" } });
    card.dataset.path = item.file.path;
    card.setAttribute("aria-label", item.keyword);

    const imgContainer = card.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}img-container` });
    
    // Theme-aware background application
    const isDarkTheme = document.body.hasClass("theme-dark");
    const thumbBgColor = isDarkTheme ? currentSettings.darkBgColor : currentSettings.lightBgColor;
    if (thumbBgColor && thumbBgColor.trim() !== "") {
        imgContainer.style.backgroundColor = thumbBgColor;
    }
    
    imgContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}loading`, text: STRINGS.LOADING });
    card.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}label`, text: item.keyword });

    observer.observe(card);

    card.addEventListener("click", () => insertItem(item.file, currentSettings));
    card.addEventListener("keydown", (e) => handleGridKeydown(e, card, gridContainer, item.file, currentSettings));
}

/**
 * Renders the grid of thumbnails based on the provided items and search term.
 * @param {HTMLElement} gridContainer - The grid DOM element.
 * @param {IntersectionObserver} observer - The observer for lazy loading.
 * @param {Array<{file: TFile, keyword: string}>} items - The library items.
 * @param {string} searchTerm - The current search filter.
 * @param {Object} currentSettings - The active settings.
 */
function renderGrid(gridContainer, observer, items, searchTerm, currentSettings) {
    gridContainer.empty();
    const term = searchTerm.toLowerCase();
    const filtered = items.filter(item => item.keyword.toLowerCase().includes(term));

    for (const item of filtered) {
        createThumbnailCard(item, gridContainer, observer, currentSettings);
    }
}

// ==============================================================================
// 5. Settings Modal
// ==============================================================================

/**
 * Modal class for managing Icon Library settings.
 */
class IconSettingsModal extends ea.obsidian.Modal {
    constructor(app, currentSettings, onSave) {
        super(app);
        this.localSettings = JSON.parse(JSON.stringify(currentSettings));
        this.onSave = onSave;
        
        // Store references to the regex tester elements for live updates
        this.testInput = null;
        this.testResult = null;
    }

    /**
     * Evaluates the current regex tester input against the live filter settings
     * and updates the result text immediately.
     */
    evaluateRegexTest() {
        if (!this.testInput || !this.testResult) return;
        
        const val = this.testInput.value;
        if (!val) { 
            this.testResult.innerText = ""; 
            return; 
        }
        
        let matched = false;
        for (const f of this.localSettings.filters) {
            try {
                const regex = new RegExp(f.pattern, "i");
                const match = val.match(regex);
                if (match) {
                    matched = true;
                    this.testResult.innerText = `Matched filter '${f.name}'! Extracted Keyword: ${match[1] || match[0]}`;
                    break;
                }
            } catch (e) { /* Ignore bad regex during typing */ }
        }
        
        if (!matched) {
            this.testResult.innerText = "No match.";
        }
    }

    /**
     * Renders a synchronized color picker and text input row that retains alpha transparency.
     * @param {HTMLElement} container - The DOM container to append to.
     * @param {string} name - Setting name.
     * @param {string} desc - Setting description.
     * @param {string} settingKey - The key in localSettings to bind to.
     */
    renderThemeColorSetting(container, name, desc, settingKey) {
        const row = new ea.obsidian.Setting(container)
            .setName(name)
            .setDesc(desc);
            
        row.controlEl.style.display = "flex";
        row.controlEl.style.gap = "8px";
        row.controlEl.style.alignItems = "center";
        
        const colorInput = row.controlEl.createEl("input", { type: "color" });
        const textInput = row.controlEl.createEl("input", { type: "text" });
        textInput.style.width = "100px";
        
        const currentColor = this.localSettings[settingKey] || "";
        textInput.value = currentColor;
        colorInput.value = currentColor.length >= 7 ? currentColor.substring(0, 7) : "#ffffff";
        
        // Update text input when color picker is used, preserving previous alpha
        colorInput.addEventListener("input", (e) => {
            const newBase = e.target.value; 
            const currentText = textInput.value;
            let alpha = "";
            if (currentText.length === 9) {
                alpha = currentText.substring(7, 9);
            }
            const newValue = newBase + alpha;
            textInput.value = newValue;
            this.localSettings[settingKey] = newValue;
        });
        
        // Update color picker visually when text input is modified
        textInput.addEventListener("input", (e) => {
            const val = e.target.value;
            this.localSettings[settingKey] = val;
            if (val.length >= 7) {
                colorInput.value = val.substring(0, 7);
            }
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: STRINGS.SETTINGS_TITLE });

        const filterContainer = contentEl.createDiv();
        this.renderFilters(filterContainer);

        // Regex Tester is a foldable section immediately below the filters
        this.renderRegexTester(contentEl);

        new ea.obsidian.Setting(contentEl)
            .setName(STRINGS.EXCLUDE_NAME)
            .setDesc(STRINGS.EXCLUDE_DESC)
            .addTextArea(text => {
                text.setValue(this.localSettings.excludeFolders);
                text.onChange(v => { this.localSettings.excludeFolders = v; });
            });

        new ea.obsidian.Setting(contentEl)
            .setName(STRINGS.WIDTH_NAME)
            .setDesc(STRINGS.WIDTH_DESC)
            .addText(text => {
                text.setValue(String(this.localSettings.defaultIconWidth));
                text.onChange(v => { this.localSettings.defaultIconWidth = parseInt(v) || CONSTANTS.DEFAULT_ICON_WIDTH; });
            });

        this.renderThemeColorSetting(contentEl, STRINGS.LIGHT_BG_NAME, STRINGS.LIGHT_BG_DESC, "lightBgColor");
        this.renderThemeColorSetting(contentEl, STRINGS.DARK_BG_NAME, STRINGS.DARK_BG_DESC, "darkBgColor");

        const saveBtnContainer = contentEl.createDiv({ attr: { style: "display: flex; justify-content: flex-end; margin-top: 20px;" } });
        const saveBtn = saveBtnContainer.createEl("button", { text: STRINGS.SETTINGS_SAVE, cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            // Close the modal immediately to prevent the UI from feeling frozen
            this.close();
            // Defer the heavy save and grid re-render logic to the next event loop tick
            setTimeout(async () => {
                await this.onSave(this.localSettings);
            }, 10);
        });
    }

    renderFilters(container) {
        container.empty();
        container.createEl("h4", { text: STRINGS.FILTERS_TITLE, attr: { style: "margin-top: 0; margin-bottom: 5px;" } });
        container.createEl("p", { text: STRINGS.FILTERS_DESC, cls: "setting-item-description", attr: { style: "margin-bottom: 10px;" } });

        this.localSettings.filters.forEach((f, idx) => {
            const row = container.createDiv({ attr: { style: "display: flex; gap: 8px; margin-bottom: 8px; align-items: center;" } });
            const nameInput = row.createEl("input", { type: "text", value: f.name, placeholder: "Filter Name", attr: { style: "width: 120px;" } });
            const patternInput = row.createEl("input", { type: "text", value: f.pattern, placeholder: "Regex pattern", attr: { style: "flex-grow: 1;" } });

            nameInput.addEventListener("change", (e) => { f.name = e.target.value; });
            
            // Listen to input events to dynamically update the regex tester
            patternInput.addEventListener("input", (e) => { 
                f.pattern = e.target.value; 
                this.evaluateRegexTest();
            });

            // Replace "Del" text with the trash icon
            const delBtn = row.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Delete filter" } });
            delBtn.innerHTML = ea.obsidian.getIcon("trash")?.outerHTML || "X";
            delBtn.addEventListener("click", () => {
                this.localSettings.filters.splice(idx, 1);
                this.renderFilters(container);
                this.evaluateRegexTest(); // Re-evaluate in case the deleted filter was the match
            });
        });

        const addBtn = container.createEl("button", { text: "Add Filter", attr: { style: "margin-top: 5px;" } });
        addBtn.addEventListener("click", () => {
            this.localSettings.filters.push({ name: "New Filter", pattern: "^new - (.*)" });
            this.renderFilters(container);
        });
    }

    renderRegexTester(contentEl) {
        // Transform into a foldable <details> element
        const details = contentEl.createEl("details", { attr: { style: "margin-bottom: 20px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 6px;" } });
        const summary = details.createEl("summary", { text: STRINGS.TEST_REGEX_TITLE, attr: { style: "font-weight: bold; cursor: pointer; outline: none;" } });
        
        const testContainer = details.createDiv({ attr: { style: "margin-top: 10px;" } });

        this.testInput = testContainer.createEl("input", { type: "text", placeholder: STRINGS.TEST_REGEX_PLACEHOLDER, attr: { style: "width: 100%; margin-bottom: 10px;" } });
        this.testResult = testContainer.createDiv({ attr: { style: "color: var(--text-accent); margin-bottom: 10px;" } });

        // Evaluate automatically on keystroke
        this.testInput.addEventListener("input", () => {
            this.evaluateRegexTest();
        });

        const matchBtn = testContainer.createEl("button", { text: STRINGS.TEST_BTN_FIND });
        const matchResult = testContainer.createDiv({ attr: { style: "max-height: 150px; overflow-y: auto; margin-top: 10px; font-size: 0.9em; color: var(--text-muted);" } });

        matchBtn.addEventListener("click", () => {
            const tempItems = getLibraryItems(this.localSettings);
            matchResult.innerHTML = `<strong>Found ${tempItems.length} items.</strong><br>` +
                tempItems.slice(0, 20).map(i => `<code>${i.file.name}</code> &rarr; <b>${i.keyword}</b>`).join("<br>") +
                (tempItems.length > 20 ? "<br>..." : "");
        });
    }
}

// ==============================================================================
// 6. Main Execution
// ==============================================================================

/**
 * Main entry point for the Icon Library Sidepanel script.
 * Manages singleton instancing, state management, and sidepanel layout orchestration.
 * @returns {Promise<void>}
 */
async function main() {
    const existingTab = ea.checkForActiveSidepanelTabForScript();
    if (existingTab) {
        if (existingTab.getHostEA() === ea) {
            existingTab.open();
        } else {
            existingTab.open();
            return;
        }
        setTimeout(() => {
            const searchInput = existingTab.contentEl.querySelector(`.${CONSTANTS.CSS_PREFIX}search`);
            if (searchInput) searchInput.focus();
        }, 100);
        return;
    }

    const state = {
        settings: initializeSettings(),
        libraryItems: []
    };

    const tab = await ea.createSidepanelTab(STRINGS.TAB_TITLE, false, true);
    if (!tab) return;

    tab.contentEl.empty();
    injectCSS(tab.contentEl);

    // --- Escape Key Handling ---
    // Capture phase event listener on the root container to ensure it intercepts Escape
    // before Obsidian or other UI elements process it.
    tab.containerEl.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            
            // Hide the sidepanel tab natively
            const sidepanelLeaf = ea.getSidepanelLeaf();
            if (sidepanelLeaf && sidepanelLeaf.view.containerEl.offsetParent !== null) {
                ea.toggleSidepanelView();
            }
            
            // Restore active focus to the Excalidraw view
            if (ea.targetView && ea.targetView.leaf) {
                app.workspace.setActiveLeaf(ea.targetView.leaf, { focus: true });
            }
        }
    }, true);

    const { searchInput, sizeSlider, settingsBtn } = buildHeaderUI(tab.contentEl, state);

    const gridContainer = tab.contentEl.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}grid` });
    gridContainer.style.setProperty("--thumb-size", `${state.settings.thumbSize}px`);

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                observer.unobserve(entry.target);
                const file = app.vault.getAbstractFileByPath(entry.target.dataset.path);
                const imgContainer = entry.target.querySelector(`.${CONSTANTS.CSS_PREFIX}img-container`);
                if (file && imgContainer) {
                    renderThumbnail(file, imgContainer);
                }
            }
        });
    }, { root: gridContainer, rootMargin: CONSTANTS.OBSERVER_MARGIN });

    const debouncedSearch = debounce((term) => {
        renderGrid(gridContainer, observer, state.libraryItems, term, state.settings);
    }, CONSTANTS.DEBOUNCE_DELAY);

    searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value));

    // Debounce the disk save to prevent lag, but update the CSS variable instantly
    const debouncedSaveSize = debounce((size) => {
        state.settings.thumbSize = parseInt(size);
        ea.setScriptSettings(state.settings);
    }, 500);

    sizeSlider.addEventListener("input", (e) => {
        const size = e.target.value;
        gridContainer.style.setProperty("--thumb-size", `${size}px`);
        debouncedSaveSize(size);
    });

    settingsBtn.addEventListener("click", () => {
        const modal = new IconSettingsModal(app, state.settings, async (newSettings) => {
            state.settings = newSettings;
            await ea.setScriptSettings(state.settings);
            state.libraryItems = getLibraryItems(state.settings);
            renderGrid(gridContainer, observer, state.libraryItems, searchInput.value, state.settings);
        });
        modal.open();
    });

    tab.onFocus = (view) => {
        if (view && view !== ea.targetView) {
            ea.setView(view);
        }
    };

    tab.onOpen = () => {
        state.libraryItems = getLibraryItems(state.settings);
        renderGrid(gridContainer, observer, state.libraryItems, searchInput.value, state.settings);
        setTimeout(() => searchInput.focus(), 100);
    };

    tab.open();
}

main();