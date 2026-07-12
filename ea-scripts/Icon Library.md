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
                { name: "Icon", pattern: "^icon - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" },
                { name: "Stickfigure", pattern: "^stickfigure - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" },
                { name: "Logo", pattern: "^logo - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" }
            ],
            excludeFolders: "",
            defaultIconWidth: CONSTANTS.DEFAULT_ICON_WIDTH,
            thumbSize: CONSTANTS.DEFAULT_THUMB_SIZE,
            lightBgColor: "#FFFFFF60",
            darkBgColor: "#FFFFFF60"
        };
        ea.setScriptSettings(currentSettings);
    }
    
    // Patch existing configurations missing new properties
    if (currentSettings.lightBgColor === undefined) currentSettings.lightBgColor = "#FFFFFF80";
    if (currentSettings.darkBgColor === undefined) currentSettings.darkBgColor = "#FFFFFF80";
    if (currentSettings.defaultIconWidth === undefined) currentSettings.defaultIconWidth = CONSTANTS.DEFAULT_ICON_WIDTH;
    if (currentSettings.thumbSize === undefined) currentSettings.thumbSize = CONSTANTS.DEFAULT_THUMB_SIZE;

    currentSettings.filters = currentSettings.filters.map(f => ({
        name: f.name || "Unnamed",
        pattern: f.pattern || "",
        folderPattern: f.folderPattern || "",
        extensions: f.extensions || "",
        maxKb: f.maxKb || ""
    }));

    // Initialize active filters state if missing (defaults to all filters enabled)
    if (currentSettings.activeFilterNames === undefined) {
        currentSettings.activeFilterNames = currentSettings.filters.map(f => f.name);
    }
    
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
 * Scans the vault for files matching the active regex filters.
 * Applies the 4-condition AND logic (Folder, Keyword, Extension, Size) per filter.
 * @param {Object} currentSettings - The current script settings.
 * @param {Array<string>} overrideActiveFilters - Optional override for active filter testing.
 * @returns {Array<{file: TFile, keyword: string, filterName: string}>} Sorted array of matched files.
 */
function getLibraryItems(currentSettings, overrideActiveFilters = null) {
    const excludeFolders = (currentSettings.excludeFolders || "")
        .split(/[\n,]/)
        .map(f => f.trim())
        .filter(f => f);

    const files = app.vault.getFiles().filter(f => {
        if (excludeFolders.some(ex => f.path.startsWith(ex))) return false;
        // Optimization: File extension validation is now handled per-filter, so we pass all non-excluded files.
        return true;
    });

    const items = [];
    const activeFilterNames = overrideActiveFilters || currentSettings.activeFilterNames || [];
    const activeFilters = currentSettings.filters
        .filter(f => activeFilterNames.includes(f.name))
        .map(f => {
            try { 
                return { 
                    name: f.name, 
                    regex: new RegExp(f.pattern, "i"),
                    folderRegex: f.folderPattern ? new RegExp(f.folderPattern, "i") : null,
                    folderString: f.folderPattern || "",
                    extensions: f.extensions ? f.extensions.split(",").map(e => e.trim().toLowerCase().replace(/^\./, '')) : [],
                    maxSize: parseFloat(f.maxSize) || null
                }; 
                // Migrate to new schema dynamically:
                return {
                    name: f.name,
                    regex: new RegExp(f.pattern, "i"),
                    folderRegex: f.folderPattern ? new RegExp(f.folderPattern, "i") : null,
                    extensions: f.extensions ? f.extensions.split(",").map(e => e.trim().toLowerCase().replace(/^\./, '')) : [],
                    maxSize: parseFloat(f.maxKb) || null
                };
            }
            catch (e) { return null; }
        })
        .filter(f => f);

    for (const file of files) {
        let matched = false;
        let keyword = file.basename;
        let filterName = "";

        for (const filter of activeFilters) {
            // 1. Check Extension
            if (filter.extensions.length > 0) {
                if (!filter.extensions.includes(file.extension.toLowerCase())) continue;
            } else {
                // Default fallback if no extensions specified: images and Excalidraw files
                const isImage = CONSTANTS.IMAGE_EXTS.includes(file.extension.toLowerCase());
                const isExcal = ea.isExcalidrawFile(file);
                if (!isImage && !isExcal) continue;
            }

            // 2. Check Folder Path
            if (filter.folderRegex) {
                if (!filter.folderRegex.test(file.parent.path)) continue;
            }

            // 3. Check File Size (maxKb)
            if (filter.maxSize !== null) {
                const sizeKb = file.stat.size / 1024;
                if (sizeKb > filter.maxSize) continue;
            }

            // 4. Check Keyword pattern
            const match = filter.regex.exec(file.basename);
            if (match) {
                matched = true;
                filterName = filter.name;
                // If a capture group exists, use it as the keyword
                keyword = match[1] ? match[1].trim() : file.basename;
                break; // OR logic achieved: stop processing filters if one matches
            }
        }

        if (matched) {
            items.push({ file, keyword, filterName });
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
        
        const id = await ea.addImage(center.x, center.y, file, true); // Insert at 100% scale first
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
        .${CONSTANTS.CSS_PREFIX}header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 15px; }
        
        .${CONSTANTS.CSS_PREFIX}search-wrapper { 
            display: flex; 
            align-items: center; 
            position: relative; 
            flex-grow: 1;
            min-width: 150px;
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
            width: 100%;
        }

        .${CONSTANTS.CSS_PREFIX}buttons-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto; 
        }

        .${CONSTANTS.CSS_PREFIX}scale-btn { 
            cursor: pointer; 
            padding: 4px 8px; 
            display: flex; 
            align-items: center; 
            color: var(--text-muted); 
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
            padding: 15px 0; 
            border-radius: 6px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        
        /* Wrapper to hold the rotated slider without breaking layout */
        .${CONSTANTS.CSS_PREFIX}slider-wrapper {
            position: relative;
            width: 30px;
            height: 120px;
            margin: 0 auto;
        }
        
        /* Rotate standard horizontal slider to bypass webkit vertical limitations.
           Obsidian's native theme colors will now perfectly apply to this element. */
        .${CONSTANTS.CSS_PREFIX}slider {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-90deg);
            width: 120px !important; 
            margin: 0;
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
 * Displays an informational modal with instructions on how to use the Icon Library.
 * @param {App} app - The Obsidian App instance.
 */
function showInfoModal(app) {
    const modal = new ea.obsidian.Modal(app);
    modal.titleEl.setText("Icon Library Info");
    const content = modal.contentEl;
    
    content.createEl("style", {
        text: `
        .icon-lib-info-list { margin-top: 0; padding-left: 20px; }
        .icon-lib-info-list li { margin-bottom: 12px; line-height: 1.4; }
        `
    });
    
    content.createEl("p", { text: "Welcome to the Icon Library! Here is a brief explanation of its use:" });
    const ul = content.createEl("ul", { cls: "icon-lib-info-list" });
    
    ul.createEl("li").innerHTML = `<b>Naming convention:</b> The pre-configured icon naming convention (recommended, but can be modified in settings) is "<code>type - comma, separated, keywords - source</code>", e.g. "icon - book, read, study - flaticon".`;
    ul.createEl("li").innerHTML = `<b>Usage:</b> Type in your search, press <code>Tab</code>, use arrow keys to select, press <code>Enter</code> to insert into the scene, press <code>ESC</code> to close the sidepanel.`;
    ul.createEl("li").innerHTML = `<b>Hotkey:</b> Setup an Obsidian Hotkey for the script so it opens quickly when needed.`;
    ul.createEl("li").innerHTML = `<b>Mouse:</b> If using a mouse, simply click on an icon to insert it into the scene.`;
    ul.createEl("li").innerHTML = `<b>MindMap Builder:</b> If you have MindMap Builder installed and running, and a mindmap node is currently selected, the icon will be added to the mindmap directly as a leaf.`;
    ul.createEl("li").innerHTML = `<b>Size:</b> Default insert size is 180x180 (for square icons). To learn more why, join the <a href="https://community.sketch-your-mind.com/vtw">Visual Thinking Workshop</a>, or join <a href="https://community.sketch-your-mind.com/em">Excalidraw Mastery</a>.`;
    ul.createEl("li").innerHTML = `<b>Philosophy:</b> To understand the underlying philosophy of the plugin and the scripts, read my book: <a href="https://community.sketch-your-mind.com/sym">Sketch Your Mind</a>.`;
    ul.createEl("li").innerHTML = `<b>What else?</b> Have fun building beautiful visual structures!`;
    
    const btnContainer = content.createDiv({ attr: { style: "display: flex; justify-content: flex-end; margin-top: 20px;" }});
    const closeBtn = btnContainer.createEl("button", { text: "Close", cls: "mod-cta" });
    closeBtn.onclick = () => modal.close();
    
    modal.open();
}

/**
 * Builds the header section containing the search bar, funnel filters, scale popover, and settings buttons.
 * @param {HTMLElement} contentEl - The parent container.
 * @param {Object} state - The global script state.
 * @returns {Object} References to the search input, size slider, buttons, and the document click handler.
 */
function buildHeaderUI(contentEl, state) {
    const headerRow = contentEl.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}header` });
    
    // 1. Search Wrapper (Now only contains the input field)
    const searchWrapper = headerRow.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}search-wrapper` });
    const searchInput = searchWrapper.createEl("input", { 
        type: "text", 
        cls: `${CONSTANTS.CSS_PREFIX}search`, 
        placeholder: STRINGS.SEARCH_PLACEHOLDER 
    });

    const buttonsWrapper = headerRow.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}buttons-wrapper` });

    // 2. Funnel Button & Popover (Separated into its own relative container)
    const funnelContainer = buttonsWrapper.createDiv({ attr: { style: "position: relative;" } });
    
    const funnelBtn = funnelContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}settings-btn` });
    funnelBtn.setAttribute("aria-label", "Filter by Category");
    funnelBtn.setAttribute("title", "Filter by Category");
    
    const funnelPopover = funnelContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}slider-popover` });
    funnelPopover.style.padding = "10px";
    funnelPopover.style.minWidth = "150px";
    funnelPopover.style.right = "0"; // Align to the right edge of its button
    funnelPopover.style.width = "max-content";
    funnelPopover.style.display = "none"; // Explicit initialization fixes the 1st-click bug

    const updateFunnelIcon = () => {
        const allEnabled = state.settings.filters.every(f => state.settings.activeFilterNames.includes(f.name));
        funnelBtn.innerHTML = ea.obsidian.getIcon(allEnabled ? "funnel" : "funnel-x")?.outerHTML || "Y";
        if (!allEnabled) {
            funnelBtn.style.color = "var(--interactive-accent)";
        } else {
            funnelBtn.style.color = "";
        }
    };

    const renderFunnelPopover = () => {
        funnelPopover.empty();
        funnelPopover.createEl("h4", { text: "Filters", attr: { style: "margin-top: 0; margin-bottom: 10px;" } });
        state.settings.filters.forEach(f => {
            const row = funnelPopover.createDiv({ attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 5px;" } });
            const cb = row.createEl("input", { type: "checkbox" });
            cb.checked = state.settings.activeFilterNames.includes(f.name);
            row.createEl("label", { text: f.name });
            
            cb.addEventListener("change", (e) => {
                if (e.target.checked) {
                    if (!state.settings.activeFilterNames.includes(f.name)) {
                        state.settings.activeFilterNames.push(f.name);
                    }
                } else {
                    state.settings.activeFilterNames = state.settings.activeFilterNames.filter(n => n !== f.name);
                }
                ea.setScriptSettings(state.settings);
                updateFunnelIcon();
                // Triggering a fake input event natively triggers debouncedSearch and re-renders the grid
                searchInput.dispatchEvent(new Event("input"));
            });
        });
    };

    funnelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renderFunnelPopover();
        funnelPopover.style.display = funnelPopover.style.display === "none" ? "block" : "none";
        sliderPopover.style.display = "none";
    });
    
    updateFunnelIcon();
    
    // 3. Scale Button & Popover (Separated into its own relative container)
    const scaleContainer = buttonsWrapper.createDiv({ attr: { style: "position: relative;" } });
    
    const scaleBtn = scaleContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}settings-btn` });
    scaleBtn.innerHTML = ea.obsidian.getIcon(CONSTANTS.ICON_SCALE)?.outerHTML 
                      || ea.obsidian.getIcon(CONSTANTS.ICON_EXPAND_FALLBACK)?.outerHTML || "↕";
    scaleBtn.setAttribute("aria-label", "Adjust Thumbnail Size");
    scaleBtn.setAttribute("title", "Adjust Thumbnail Size");
    
    const sliderPopover = scaleContainer.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}slider-popover` });
    sliderPopover.style.display = "none"; // Explicit initialization fixes the 1st-click bug
    sliderPopover.style.right = "0"; // Align to the right edge of its button
    
    // Use the wrapper to absolutely position the rotated horizontal slider
    const sliderWrapper = sliderPopover.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}slider-wrapper` });
    const sizeSlider = sliderWrapper.createEl("input", { 
        type: "range", 
        cls: `${CONSTANTS.CSS_PREFIX}slider`,
        attr: { 
            min: "50", 
            max: "250", 
            value: state.settings.thumbSize
        } 
    });

    scaleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sliderPopover.style.display = sliderPopover.style.display === "none" ? "block" : "none";
        funnelPopover.style.display = "none";
    });

    // 4. Info Button
    const infoBtn = buttonsWrapper.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}settings-btn` });
    infoBtn.innerHTML = ea.obsidian.getIcon("info")?.outerHTML || "i";
    infoBtn.setAttribute("aria-label", "Instructions & Info");
    infoBtn.setAttribute("title", "Instructions & Info");
    infoBtn.addEventListener("click", () => showInfoModal(app));

    // 5. Settings Button
    const settingsBtn = buttonsWrapper.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}settings-btn` });
    settingsBtn.innerHTML = ea.obsidian.getIcon(CONSTANTS.ICON_SETTINGS)?.outerHTML || "⚙";
    settingsBtn.setAttribute("aria-label", "Settings");
    settingsBtn.setAttribute("title", "Settings");

    // Close popovers if clicking outside
    const outsideClickHandler = (e) => {
        if (!scaleBtn.contains(e.target) && !sliderPopover.contains(e.target)) {
            sliderPopover.style.display = "none";
        }
        if (!funnelBtn.contains(e.target) && !funnelPopover.contains(e.target)) {
            funnelPopover.style.display = "none";
        }
    };

    return { searchInput, sizeSlider, infoBtn, settingsBtn, outsideClickHandler, updateFunnelIcon };
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
    // Intercept Tab / Shift+Tab to jump back to search input
    if (e.key === "Tab") {
        e.preventDefault();
        const searchInput = grid.parentElement.querySelector(`.${CONSTANTS.CSS_PREFIX}search`);
        if (searchInput) searchInput.focus();
        return;
    }

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

    const loadMoreBtn = grid.querySelector('.load-more-btn-wrapper button');

    if (target >= 0 && target < cards.length) {
        e.preventDefault();
        cards[target].focus();
    } else if (target >= cards.length && loadMoreBtn) {
        // If moving down or right past the last loaded card, pass focus to the Load More button
        e.preventDefault();
        loadMoreBtn.focus();
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
 * Uses batch loading to improve performance with large libraries.
 * Filters items actively based on toggled funnel categories.
 * @param {HTMLElement} gridContainer - The grid DOM element.
 * @param {IntersectionObserver} observer - The observer for lazy loading.
 * @param {Array<{file: TFile, keyword: string, filterName: string}>} items - The library items.
 * @param {string} searchTerm - The current search filter.
 * @param {Object} currentSettings - The active settings.
 * @param {number} [offset=0] - The starting index for the current batch.
 * @param {boolean} [focusOnLoad=false] - Whether to automatically focus the first newly loaded item.
 */
function renderGrid(gridContainer, observer, items, searchTerm, currentSettings, offset = 0, focusOnLoad = false) {
    if (offset === 0) {
        gridContainer.empty();
    } else {
        // Remove existing Load More button before appending new cards
        const existingBtn = gridContainer.querySelector('.load-more-btn-wrapper');
        if (existingBtn) existingBtn.remove();
    }

    const term = searchTerm.toLowerCase();
    const activeFilterNames = currentSettings.activeFilterNames || [];
    
    // Apply search filter AND toggle filters concurrently
    const filtered = items.filter(item => 
        item.keyword.toLowerCase().includes(term) && 
        activeFilterNames.includes(item.filterName)
    );
    
    // Batch size limits DOM nodes created in a single render cycle
    const BATCH_SIZE = 100;
    const batch = filtered.slice(offset, offset + BATCH_SIZE);

    for (const item of batch) {
        createThumbnailCard(item, gridContainer, observer, currentSettings);
    }

    // Automatically focus the first newly rendered card if requested (e.g. after pressing Enter on the Load More button)
    if (focusOnLoad) {
        setTimeout(() => {
            const allCards = gridContainer.querySelectorAll(`.${CONSTANTS.CSS_PREFIX}card`);
            if (allCards[offset]) {
                allCards[offset].focus();
            }
        }, 50);
    }

    // If there are more items to show, append a "Load More" button
    if (offset + BATCH_SIZE < filtered.length) {
        const btnWrapper = gridContainer.createDiv({ 
            cls: "load-more-btn-wrapper", 
            attr: { style: "grid-column: 1 / -1; display: flex; justify-content: center; padding: 20px 0;" }
        });
        
        const btn = btnWrapper.createEl("button", { text: "Load More", cls: "mod-cta" });
        
        const loadMoreAction = () => {
            renderGrid(gridContainer, observer, items, searchTerm, currentSettings, offset + BATCH_SIZE, true);
        };

        btn.addEventListener("click", loadMoreAction);
        
        // Listen to keydown on the Load More button to allow upward traversal back into the cards grid
        btn.addEventListener("keydown", (e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                const allCards = gridContainer.querySelectorAll(`.${CONSTANTS.CSS_PREFIX}card`);
                if (allCards.length > 0) {
                    allCards[allCards.length - 1].focus();
                }
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                loadMoreAction();
            }
        });
    }
}

// ==============================================================================
// 5. Settings Modal
// ==============================================================================

/**
 * Custom suggester to handle large vaults efficiently.
 * Inherits from Obsidian's native FuzzySuggestModal and limits the rendered items.
 */
class SampleFileSuggester extends ea.obsidian.FuzzySuggestModal {
  constructor(app, files, onSelect) {
    super(app);
    this.files = files;
    this.onSelect = onSelect;
    this.limit = 20; // Drastically improves performance by restricting DOM nodes
    this.setPlaceholder("Select sample file to test filters");
  }
    
  getItems() {
    return this.files;
  }

  getItemText(file) {
    // Display the full path so users can differentiate identically named files
    return file.path;
  }

  onChooseItem(file, evt) {
    this.onSelect(file);
  }
}

/**
 * Modal class handling the configuration of custom palettes, UI sizing, 
 * filter rules, and layout testing.
 */
class IconSettingsModal extends ea.obsidian.Modal {
  constructor(app, currentSettings, onSave) {
    super(app);
    this.localSettings = JSON.parse(JSON.stringify(currentSettings));
    this.onSave = onSave;
    this.cleanups = [];
    
    // State for Filter Pagination & Editing
    this.currentFilterIndex = 0;
    this.workingFilter = null;
    
    // State for Sample File Tester
    this.testFile = null;

    this.LLM_PROMPT = `You are an intelligent agent helping the user configure a 4-component filter for an Obsidian.md icon library. The library can filter images and excalidraw.md image files.
The filtering system has 4 criteria (AND relationship within a single filter block):
1. Folder Path (Regular Expression) - if empty, accepts all folders.
2. Filename Keyword Grabber (Regular Expression) - must contain a capture group (.*) to extract the display name of the icon.
3. Extensions (comma separated, ${CONSTANTS.IMAGE_EXTS.join(", ")}, md) - if empty, defaults to all image formats and Excalidraw files.
4. Max Size in KB (number) - if empty, no limit.

Multiple filter blocks have an OR relationship with each other.

Your task:
1. Ask the user questions to understand what icons or files they want to include in their library.
2. Request sample file paths and names.
3. Act as an intelligent agent. Once you understand their needs, return the exact values they should fill into the 4 fields for one or more filter blocks.
4. Ensure the Keyword Grabber regex is valid JavaScript regex and correctly extracts the core icon name using a capture group.`;
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
    
    // Header Row with LLM Agent Prompt Button
    const headerRow = contentEl.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;" } });
    headerRow.createEl("h2", { text: STRINGS.SETTINGS_TITLE, attr: { style: "margin: 0;" } });
    
    const llmBtn = headerRow.createEl("button", { text: "Copy LLM Prompt" });
    llmBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(this.LLM_PROMPT);
        new Notice("LLM agent prompt copied to clipboard! Paste it to ChatGPT/Claude.");
    });

    contentEl.createEl("p", { 
        text: "Use the 'Copy LLM Prompt' button to copy instructions for an AI agent to help you design complex filter rules based on your vault structure.", 
        cls: "setting-item-description",
        attr: { style: "margin-bottom: 20px;" }
    });

    const filterContainer = contentEl.createDiv();
    this.renderFilters(filterContainer);

    const testerContainer = contentEl.createDiv();
    this.renderFilterTester(testerContainer);

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

    // Note: The global Save button has been removed. Changes auto-save on close.
  }

  renderFilters(container) {
    const scrollPos = this.contentEl.scrollTop;
    const doc = container.ownerDocument;
    if (doc.activeElement && container.contains(doc.activeElement)) {
        doc.activeElement.blur();
    }
    container.empty();
    
    // Ensure index is within bounds
    if (this.localSettings.filters.length === 0) {
        this.localSettings.filters.push({ name: "Default Filter", pattern: "^icon - (.*)", folderPattern: "", extensions: "", maxKb: "" });
    }
    this.currentFilterIndex = Math.max(0, Math.min(this.currentFilterIndex, this.localSettings.filters.length - 1));
    
    // Initialize or re-clone the working filter
    if (!this.workingFilter) {
        this.workingFilter = JSON.parse(JSON.stringify(this.localSettings.filters[this.currentFilterIndex]));
    }
    
    const headerRow = container.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;" }});
    headerRow.createEl("h4", { text: STRINGS.FILTERS_TITLE, attr: { style: "margin: 0;" } });
    
    const resetBtn = headerRow.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Restore default regular expressions", title: "Restore default regular expressions" } });
    resetBtn.innerHTML = ea.obsidian.getIcon("rotate-ccw")?.outerHTML || "Reset";
    resetBtn.addEventListener("click", () => {
        if (window.confirm("Are you sure you want to reset all filter definitions to the script defaults?")) {
            this.localSettings.filters = [
                { name: "Icon", pattern: "^icon - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" },
                { name: "Stickfigure", pattern: "^stickfigure - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" },
                { name: "Logo", pattern: "^logo - (.*?)(?: - [^-]+)?$", folderPattern: "", extensions: "", maxKb: "" }
            ];
            
            // Reset active filters to include the default ones
            this.localSettings.activeFilterNames = this.localSettings.filters.map(f => f.name);
            
            this.currentFilterIndex = 0;
            this.workingFilter = null;
            this.onSave(this.localSettings);
            this.renderFilters(container);
            if (this.testFile) this.renderSampleFileResult(this.resultContainer);
        }
    });

    container.createEl("p", { text: STRINGS.FILTERS_DESC, cls: "setting-item-description", attr: { style: "margin-bottom: 10px;" } });

    // Pagination Header (1/3, Next, Prev)
    const paginationRow = container.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: var(--background-secondary); padding: 5px 10px; border-radius: 6px; border: 1px solid var(--background-modifier-border);" }});
    
    const prevBtn = paginationRow.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Previous filter" }});
    prevBtn.innerHTML = ea.obsidian.getIcon("arrow-left").outerHTML;
    prevBtn.disabled = this.currentFilterIndex === 0;
    
    paginationRow.createSpan({ text: `Filter ${this.currentFilterIndex + 1} / ${this.localSettings.filters.length}`, attr: { style: "font-weight: bold;" }});
    
    const nextBtn = paginationRow.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Next filter" }});
    nextBtn.innerHTML = ea.obsidian.getIcon("arrow-right").outerHTML;
    nextBtn.disabled = this.currentFilterIndex === this.localSettings.filters.length - 1;

    // Filter Card UI
    const card = container.createDiv({ attr: { style: "border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; background: var(--background-primary);" } });
    const cardHeader = card.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;" } });
    
    const nameInput = cardHeader.createEl("input", { type: "text", value: this.workingFilter.name, placeholder: "Filter Name", attr: { style: "font-weight: bold; width: 220px;" } });
    
    const actionsDiv = cardHeader.createDiv({ attr: { style: "display: flex; gap: 8px;" }});
    const saveFilterBtn = actionsDiv.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Save filter changes" }});
    saveFilterBtn.innerHTML = ea.obsidian.getIcon("save").outerHTML;
    
    const delBtn = actionsDiv.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Delete filter" } });
    delBtn.innerHTML = ea.obsidian.getIcon("trash").outerHTML;

    // Helper to detect unsaved changes
    const checkDirty = () => {
        const savedStr = JSON.stringify(this.localSettings.filters[this.currentFilterIndex]);
        const workStr = JSON.stringify(this.workingFilter);
        const isDirty = savedStr !== workStr;
        if (isDirty) {
            saveFilterBtn.classList.add("mod-warning");
        } else {
            saveFilterBtn.classList.remove("mod-warning");
        }
        return isDirty;
    };

    // Navigation and Action logic
    const navigate = (delta) => {
        if (checkDirty() && !window.confirm("You have unsaved changes. Discard?")) return;
        this.currentFilterIndex += delta;
        this.workingFilter = null;
        this.renderFilters(container);
    };

    prevBtn.addEventListener("click", () => navigate(-1));
    nextBtn.addEventListener("click", () => navigate(1));

    saveFilterBtn.addEventListener("click", () => {
        const oldName = this.localSettings.filters[this.currentFilterIndex].name;
        const newName = this.workingFilter.name;
        
        this.localSettings.filters[this.currentFilterIndex] = JSON.parse(JSON.stringify(this.workingFilter));
        
        // Update name in active filters if it changed
        if (oldName !== newName && this.localSettings.activeFilterNames) {
            const activeIndex = this.localSettings.activeFilterNames.indexOf(oldName);
            if (activeIndex > -1) {
                this.localSettings.activeFilterNames[activeIndex] = newName;
            }
        }
        
        this.onSave(this.localSettings);
        checkDirty();
        new Notice(`Filter '${this.workingFilter.name}' saved.`);
        if (this.testFile) this.renderSampleFileResult(this.resultContainer);
    });

    delBtn.addEventListener("click", () => {
        if (window.confirm("Are you sure you want to delete this filter?")) {
            const filterName = this.localSettings.filters[this.currentFilterIndex].name;
            this.localSettings.filters.splice(this.currentFilterIndex, 1);
            
            // Remove from active filters
            if (this.localSettings.activeFilterNames) {
                this.localSettings.activeFilterNames = this.localSettings.activeFilterNames.filter(n => n !== filterName);
            }
            
            if (this.localSettings.filters.length === 0) {
                // Ensure at least one filter remains
                const defaultName = "Default Filter";
                this.localSettings.filters.push({ name: defaultName, pattern: "^icon - (.*)", folderPattern: "", extensions: "", maxKb: "" });
                
                if (!this.localSettings.activeFilterNames) {
                    this.localSettings.activeFilterNames = [];
                }
                if (!this.localSettings.activeFilterNames.includes(defaultName)) {
                    this.localSettings.activeFilterNames.push(defaultName);
                }
            }
            this.currentFilterIndex = Math.max(0, this.currentFilterIndex - 1);
            this.workingFilter = null;
            this.onSave(this.localSettings);
            this.renderFilters(container);
            if (this.testFile) this.renderSampleFileResult(this.resultContainer);
        }
    });

    const grid = card.createDiv({ attr: { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 12px;" } });
    
    // 1. Folder Path
    const folderWrapper = grid.createDiv({ attr: { style: "display: flex; flex-direction: column;" }});
    folderWrapper.createEl("label", { text: "Folder Path (Regex)", attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;" } });
    const folderInput = folderWrapper.createEl("input", { type: "text", value: this.workingFilter.folderPattern, placeholder: "Leave empty for all folders" });

    // 2. Keyword Grabber
    const kwWrapper = grid.createDiv({ attr: { style: "display: flex; flex-direction: column;" }});
    kwWrapper.createEl("label", { text: "Keyword Grabber (Regex)", attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;" } });
    const patternInput = kwWrapper.createEl("input", { type: "text", value: this.workingFilter.pattern, placeholder: "^icon - (.*)" });

    // 3. Extensions
    const extWrapper = grid.createDiv({ attr: { style: "display: flex; flex-direction: column;" }});
    extWrapper.createEl("label", { text: "Extensions (comma separated)", attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;" } });
    const extInput = extWrapper.createEl("input", { type: "text", value: this.workingFilter.extensions, placeholder: `${CONSTANTS.IMAGE_EXTS.join(", ")}, md` });

    // 4. Max Size
    const sizeWrapper = grid.createDiv({ attr: { style: "display: flex; flex-direction: column;" }});
    sizeWrapper.createEl("label", { text: "Max Size (KB)", attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;" } });
    const sizeInput = sizeWrapper.createEl("input", { type: "number", value: this.workingFilter.maxKb, placeholder: "No limit" });

    // Bind event listeners to update workingFilter and check dirty state
    const bindInput = (el, key) => {
        el.addEventListener("input", (e) => {
            this.workingFilter[key] = e.target.value;
            checkDirty();
        });
    };
    bindInput(nameInput, "name");
    bindInput(folderInput, "folderPattern");
    bindInput(patternInput, "pattern");
    bindInput(extInput, "extensions");
    bindInput(sizeInput, "maxKb");

    // Add New Filter Button
    const addBtn = container.createEl("button", { text: "Add Filter", attr: { style: "margin-top: 15px;" } });
    addBtn.addEventListener("click", () => {
        if (checkDirty() && !window.confirm("You have unsaved changes. Discard and create new?")) return;
        
        const newName = "New Filter " + (this.localSettings.filters.length + 1);
        this.localSettings.filters.push({ name: newName, pattern: "^new - (.*)", folderPattern: "", extensions: "", maxKb: "" });
        
        // Add the new filter to active filters by default
        if (this.localSettings.activeFilterNames && !this.localSettings.activeFilterNames.includes(newName)) {
            this.localSettings.activeFilterNames.push(newName);
        }
        
        this.currentFilterIndex = this.localSettings.filters.length - 1;
        this.workingFilter = null;
        this.onSave(this.localSettings);
        this.renderFilters(container);
    });

    // Initial dirty check
    checkDirty();

    setTimeout(() => {
        this.contentEl.scrollTop = scrollPos;
    }, 10);
  }

  renderFilterTester(contentEl) {
    const self = this; // Store a stable reference to the modal instance

    const details = contentEl.createEl("details", { attr: { style: "margin-top: 20px; margin-bottom: 20px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 6px;" } });
    const summary = details.createEl("summary", { attr: { style: "font-weight: bold; cursor: pointer; outline: none; display: flex; justify-content: space-between; align-items: center;" } });
    
    summary.createSpan({ text: "Test filters" });
    
    const testContainer = details.createDiv({ attr: { style: "margin-top: 15px; position: relative;" } });
    const matchBtn = testContainer.createEl("button", { text: "Select a sample file from the vault", cls: "mod-cta" });
    self.resultContainer = testContainer.createDiv({ attr: { style: "margin-top: 15px;" } });

    matchBtn.addEventListener("click", () => {
        const files = app.vault.getFiles();
        
        // Launch the optimized native fuzzy suggester
        const suggester = new SampleFileSuggester(app, files, (selectedFile) => {
            if (selectedFile) {
                self.testFile = selectedFile;
                self.renderSampleFileResult(self.resultContainer);
            }
        });
        
        suggester.open();
    });
  }

  renderSampleFileResult(container) {
    const self = this; // Store a stable reference to the modal instance
    container.empty();
    if (!self.testFile) return;

    // File Metadata Card
    const metaCard = container.createDiv({ attr: { style: "padding: 10px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; margin-bottom: 15px;" }});
    metaCard.createDiv().innerHTML = `<b>File:</b> ${self.testFile.name}`;
    metaCard.createDiv().innerHTML = `<b>Path:</b> <span style="word-break: break-all; color: var(--text-muted); font-size: 0.9em;">${self.testFile.path}</span>`;
    metaCard.createDiv().innerHTML = `<b>Size:</b> ${(self.testFile.stat.size / 1024).toFixed(1)} KB &nbsp;&nbsp;|&nbsp;&nbsp; <b>Ext:</b> ${self.testFile.extension}`;

    // Result Table
    const table = container.createEl("table", { attr: { style: "width: 100%; border-collapse: collapse; font-size: 0.9em;" }});
    
    const trHead = table.createEl("tr", { attr: { style: "border-bottom: 1px solid var(--background-modifier-border); text-align: left;" }});
    ["Filter Name", "Folder", "Ext", "Size", "Keyword", "Included"].forEach(th => trHead.createEl("th", { text: th, attr: { style: "padding: 6px;" }}));

    let anyPassed = false;

    self.localSettings.filters.forEach(f => {
        // Evaluate Folder
        let folderPass = true;
        if (f.folderPattern) {
            try { 
                folderPass = new RegExp(f.folderPattern, "i").test(self.testFile.parent.path); 
            } catch (e) { 
                folderPass = false; 
            }
        }
        
        // Evaluate Extension
        let extPass = true;
        let extensions = f.extensions ? f.extensions.split(",").map(e => e.trim().toLowerCase().replace(/^\./, '')) : [];
        if (extensions.length > 0) {
            extPass = extensions.includes(self.testFile.extension.toLowerCase());
        } else {
            const isImage = CONSTANTS.IMAGE_EXTS.includes(self.testFile.extension.toLowerCase());
            const isExcal = ea.isExcalidrawFile(self.testFile);
            extPass = isImage || isExcal;
        }
        
        // Evaluate Size
        let sizePass = true;
        const maxKb = parseFloat(f.maxKb);
        if (!isNaN(maxKb)) {
            const sizeKb = self.testFile.stat.size / 1024;
            sizePass = sizeKb <= maxKb;
        }
        
        // Evaluate Keyword
        let kwPass = false;
        let kwResult = "❌";
        if (f.pattern) {
            try {
                const regex = new RegExp(f.pattern, "i");
                const match = regex.exec(self.testFile.basename);
                if (match) {
                    kwPass = true;
                    kwResult = match[1] ? match[1].trim() : self.testFile.basename;
                }
            } catch (e) {}
        }

        const finalPass = folderPass && extPass && sizePass && kwPass;
        if (finalPass) anyPassed = true;

        const tr = table.createEl("tr", { attr: { style: "border-bottom: 1px solid var(--background-modifier-border-alt);" }});
        tr.createEl("td", { text: f.name, attr: { style: "padding: 6px; font-weight: bold;" }});
        tr.createEl("td", { text: folderPass ? "✅" : "❌", attr: { style: "padding: 6px; text-align: center;" }});
        tr.createEl("td", { text: extPass ? "✅" : "❌", attr: { style: "padding: 6px; text-align: center;" }});
        tr.createEl("td", { text: sizePass ? "✅" : "❌", attr: { style: "padding: 6px; text-align: center;" }});
        tr.createEl("td", { text: kwResult, attr: { style: "padding: 6px; color: " + (kwPass ? "var(--text-accent)" : "") }});
        tr.createEl("td", { text: finalPass ? "✅" : "❌", attr: { style: "padding: 6px; text-align: center;" }});
    });

    container.createDiv({ 
        text: anyPassed ? "Result: File will be included in the library." : "Result: File will NOT be included.",
        attr: { style: `margin-top: 15px; font-weight: bold; color: ${anyPassed ? "var(--text-success)" : "var(--text-error)"};` }
    });
  }

  onClose() {
    this.cleanups.forEach(fn => fn());
    
    // Auto-save global settings on close. 
    // Filter definitions are explicitly saved via their individual 'Save' button, 
    // but the rest of the layout configurations are committed here.
    setTimeout(async () => {
        await this.onSave(this.localSettings);
        if (ea.sidepanelTab && ea.sidepanelTab.isVisible()) {
            ea.sidepanelTab.onOpen();
        }
    }, 10);
  }
}

// ==============================================================================
// 6. Main Execution & Render Queue
// ==============================================================================

const renderQueue = [];
let isRendering = false;

/**
 * Processes the thumbnail rendering queue sequentially to prevent device lock-up.
 */
async function processRenderQueue() {
    if (isRendering) return;
    isRendering = true;
    while (renderQueue.length > 0) {
        const { file, container, card } = renderQueue.shift();
        
        // Skip rendering if the card has been detached from the DOM (e.g. search changed)
        if (!card.isConnected) continue;
        
        await renderThumbnail(file, container);
    }
    isRendering = false;
}

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

    // Build UI and extract references
    const headerUI = buildHeaderUI(tab.contentEl, state);
    const searchInput = headerUI.searchInput;
    const sizeSlider = headerUI.sizeSlider;
    const outsideClickHandler = headerUI.outsideClickHandler;
    const updateFunnelIcon = headerUI.updateFunnelIcon; // Added

    // --- Dynamic Event Listener Management ---
    let isListenersAttached = false;
    let attachedDocument = null; // Track document to safely detach if windows migrate

    const escapeKeyHandler = (e) => {
        if (e.key === "Escape") {
            // Ensure the event actually originated from within our tab
            if (!tab.containerEl.contains(e.target)) return;

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
    };

    const attachListeners = () => {
        if (isListenersAttached) return;
        
        // Use bubble phase (false) instead of capture (true) to play nice with Obsidian
        tab.containerEl.addEventListener("keydown", escapeKeyHandler, false);
        
        attachedDocument = tab.contentEl.ownerDocument;
        if (attachedDocument) {
            attachedDocument.addEventListener("click", outsideClickHandler);
        }
        isListenersAttached = true;
    };

    const detachListeners = () => {
        if (!isListenersAttached) return;
        
        tab.containerEl.removeEventListener("keydown", escapeKeyHandler, false);
        
        if (attachedDocument) {
            attachedDocument.removeEventListener("click", outsideClickHandler);
            attachedDocument = null;
        }
        isListenersAttached = false;
    };

    // Track focus leaving the sidepanel to eagerly detach listeners
    tab.containerEl.addEventListener("focusout", (e) => {
        // e.relatedTarget is the element receiving focus. 
        // If it's outside our container (or null, meaning Obsidian canvas/window took focus), detach!
        if (!e.relatedTarget || !tab.containerEl.contains(e.relatedTarget)) {
            detachListeners();
        }
    });

    // Track focus entering the sidepanel to safely re-attach listeners
    tab.containerEl.addEventListener("focusin", (e) => {
        attachListeners();
    });

    // Grid Setup
    const gridContainer = tab.contentEl.createDiv({ cls: `${CONSTANTS.CSS_PREFIX}grid` });
    gridContainer.style.setProperty("--thumb-size", `${state.settings.thumbSize}px`);

    // --- Handle Tab from Search Input to Grid ---
    searchInput.addEventListener("keydown", (e) => {
        // Only override standard Tab (allow Shift+Tab to natively escape out of search bar backwards)
        if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            // Focus the first available card in the result set
            const firstCard = gridContainer.querySelector(`.${CONSTANTS.CSS_PREFIX}card`);
            if (firstCard) {
                firstCard.focus();
            }
        }
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const imgContainer = entry.target.querySelector(`.${CONSTANTS.CSS_PREFIX}img-container`);
                
                // Prevent duplicate queueing if elements flicker rapidly
                if (!imgContainer.dataset.queued) {
                    imgContainer.dataset.queued = "true";
                    observer.unobserve(entry.target);
                    
                    const file = app.vault.getAbstractFileByPath(entry.target.dataset.path);
                    if (file) {
                        // Queue the item to be rendered
                        renderQueue.push({ file, container: imgContainer, card: entry.target });
                        processRenderQueue();
                    }
                }
            }
        });
    }, { root: gridContainer, rootMargin: CONSTANTS.OBSERVER_MARGIN });

    const debouncedSearch = debounce((term) => {
        renderGrid(gridContainer, observer, state.libraryItems, term, state.settings);
    }, CONSTANTS.DEBOUNCE_DELAY);

    searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value));

    // Debounce the disk save to prevent lag
    const debouncedSaveSize = debounce((size) => {
        state.settings.thumbSize = parseInt(size);
        ea.setScriptSettings(state.settings);
    }, 500);

    sizeSlider.addEventListener("input", (e) => {
        const size = e.target.value;
        gridContainer.style.setProperty("--thumb-size", `${size}px`);
        debouncedSaveSize(size);
    });

    headerUI.settingsBtn.addEventListener("click", () => {
        const modal = new IconSettingsModal(app, state.settings, async (newSettings) => {
            state.settings = newSettings;
            await ea.setScriptSettings(state.settings);
            state.libraryItems = getLibraryItems(state.settings);
            renderGrid(gridContainer, observer, state.libraryItems, searchInput.value, state.settings);
            
            // Re-evaluate funnel icon based on new active filters
            if (updateFunnelIcon) updateFunnelIcon();
        });
        modal.open();
    });

    // Lifecycle Hooks
    tab.onFocus = (view) => {
        if (view && view !== ea.targetView) {
            ea.setView(view);
        }
        // Ensure listeners are bound if the user forces focus via a Command/Hotkey
        attachListeners();
    };

    tab.onOpen = () => {
        state.libraryItems = getLibraryItems(state.settings);
        renderGrid(gridContainer, observer, state.libraryItems, searchInput.value, state.settings);
        setTimeout(() => {
            searchInput.focus();
            attachListeners(); // Ensure bound immediately on open
        }, 100);
    };

    tab.onClose = () => {
        // Robust cleanup on close
        detachListeners();
    };

    tab.open();
}

main();