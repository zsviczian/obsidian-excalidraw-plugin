/*
Palm Guard: A mobile-friendly drawing mode for Excalidraw that prevents accidental palm touches by hiding UI controls and entering fullscreen mode. Perfect for drawing with a stylus on tablets.

Features:
- Enters fullscreen to maximize drawing space (configurable in plugin script settings)
- Hides all UI controls to prevent accidental taps
- Provides a minimal floating toolbar with toggle visibility button
- Enables a completely distraction-free canvas even on desktop devices by hiding the main toolbar and all chrome while keeping a tiny movable toggle control (addresses immersive canvas / beyond Zen Mode request)
- Draggable toolbar can be positioned anywhere on screen
- Exit Palm Guard mode with a single tap
- Press ALT+X (OPT+X on Mac) to toggle UI visibility without tapping. This hotkey (modifier combination + key) can be customized under Excalidraw Plugin / Script Settings for Palm Guard. Default: Modifiers = "ALT/OPT", Key = "x".

```js
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.14.2")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

async function run() {
  if(window.excalidrawPalmGuard) {
    new Notice("PalmGuard already running");
    return;
  }
  window.excalidrawPalmGuard = true;
  const modal = new ea.FloatingModal(ea.plugin.app);
  // --- Hotkey settings initialization ---
  const HOTKEY_MODIFIERS = "PalmGuard Toggle UI Hotkey Modifiers";
  const HOTKEY_KEY = "PalmGuard Toggle UI Hotkey Key";
  const FULLSCREEN = "Goto fullscreen?";
  const MODIFIER_OPTIONS = [
    "ALT/OPT",
    "CTRL/CMD",
    "WIN/CTRL",
    "ALT/OPT+CTRL/CMD",
    "ALT/OPT+WIN/CTRL",
    "CTRL/CMD+WIN/CTRL",
    "SHIFT+ALT/OPT",
    "SHIFT+CTRL/CMD",
    "SHIFT+WIN/CTRL",
    "SHIFT+ALT/OPT+CTRL/CMD",
    "SHIFT+ALT/OPT+WIN/CTRL",
    "SHIFT+CTRL/CMD+WIN/CTRL",
    "SHIFT+ALT/OPT+CTRL/CMD+WIN/CTRL"
  ];
  let settings = ea.getScriptSettings() || {};
  let initialized = false;
  if(!settings[HOTKEY_MODIFIERS] || !settings[HOTKEY_KEY]) {
    settings[HOTKEY_MODIFIERS] = { value: "ALT/OPT", valueset: MODIFIER_OPTIONS };
    settings[HOTKEY_KEY] = { value: "x" };
    settings[FULLSCREEN] = { value: true };
    await ea.setScriptSettings(settings);
    initialized = true;
  } else {
    // ensure valueset present (in case older run stored only value)
    settings[HOTKEY_MODIFIERS].valueset = MODIFIER_OPTIONS;
  }
  const hotkeyMods = settings[HOTKEY_MODIFIERS].value;
  const hotkeyKey = (settings[HOTKEY_KEY].value || "x").toLowerCase();
  const enableFullscreen = settings[FULLSCREEN].value;
  const isMac = ea.DEVICE.isMacOS;
  const parseMods = (mods) => mods.split("+").map(m=>m.trim());
  const matchHotkey = (e) => {
    if(e.repeat) return false;
    if(e.key.toLowerCase() !== hotkeyKey) return false;
    const required = parseMods(hotkeyMods);
    const reqSet = new Set(required);
    const active = {
      "SHIFT": e.shiftKey,
      "ALT/OPT": e.altKey,
      "CTRL/CMD": isMac ? e.metaKey : e.ctrlKey,
      "WIN/CTRL": isMac ? e.ctrlKey : e.metaKey,
    };
    // all required present
    for(const r of required) if(!active[r]) return false;
    // ensure no extra (only consider our tracked modifiers)
    for(const name in active) {
      if(active[name] && !reqSet.has(name)) return false;
    }
    return true;
  };
  // --- Obsidian hotkey override for script hotkey ---
  const toObsidianModifiers = (modsStr) => {
    const parts = modsStr.split("+").map(p=>p.trim());
    const out = [];
    parts.forEach(p=>{
      if(p==="ALT/OPT") out.push("Alt");
      else if(p==="CTRL/CMD") out.push("Mod");        // Obsidian's platform abstraction
      else if(p==="WIN/CTRL") out.push(isMac ? "Ctrl" : "Meta");
      else if(p==="SHIFT") out.push("Shift");
    });
    return out;
  };
  let unregisterHotkeyOverride;
  try {
    const scope = ea.plugin.app.keymap.getRootScope();
    const modifiersForOverride = toObsidianModifiers(hotkeyMods);
    const handler = scope.register(modifiersForOverride, hotkeyKey, () => true);
    scope.keys.unshift(scope.keys.pop()); // prioritize our handler
    unregisterHotkeyOverride = () => scope.unregister(handler);
  } catch {}
  // Initialize state
  let uiHidden = true;
  let currentIcon = "eye";
  const toolbar = ea.targetView.contentEl.querySelector(".excalidraw > .Island");
  let toolbarActive = toolbar?.style.display === "block";
  let prevHiddenState = false;
  
  // Function to toggle UI visibility
  const toggleUIVisibility = (hidden) => {
    if(hidden === prevHiddenState) return hidden;
    prevHiddenState = hidden;
    try{
      const topBar = ea.targetView.containerEl.querySelector(".App-top-bar");
      const bottomBar = ea.targetView.containerEl.querySelector(".App-bottom-bar");
      const sidebarToggle = ea.targetView.containerEl.querySelector(".sidebar-toggle");
      const plugins = ea.targetView.containerEl.querySelector(".plugins-container");

      if(hidden) {
        if (toolbarActive && (toolbar?.style.display === "none")) {
          toolbarActive = false;
        }
        if (toolbarActive = toolbar?.style.display === "block") {
          toolbarActive = true;
        };
      }
      
      const display = hidden ? "none" : "";
      
      if (topBar) topBar.style.display = display;
      if (bottomBar) bottomBar.style.display = display;
      if (sidebarToggle) sidebarToggle.style.display = display;
      if (plugins) plugins.style.display = display;
      if (toolbarActive) toolbar.style.display = hidden ? "none" : "block";
      modal.modalEl.style.opacity = hidden ? "0.4" : "0.8";
    } catch {};
    return hidden;
  };
  
  // Enter fullscreen view mode
  if(enableFullscreen) ea.targetView.gotoFullscreen();
  setTimeout(()=>toggleUIVisibility(true),100);
  
  // Create floating toolbar modal
  Object.assign(modal.modalEl.style, {
    width: "fit-content",
    minWidth: "fit-content",
    height: "fit-content",
    minHeight: "fit-content",
    paddingBottom: "4px",
    paddingTop: "16px",
    paddingRight: "4px",
    paddingLeft: "4px"
  });
  
  modal.headerEl.style.display = "none";
  // Configure modal
  modal.titleEl.setText(""); // No title for minimal UI
  
  // Create modal content
  let keyHandler;
  modal.contentEl.createDiv({ cls: "palm-guard-toolbar" }, div => {
    const container = div.createDiv({
      attr: {
        style: "display: flex; flex-direction: column; background-color: var(--background-secondary); border-radius: 4px;"
      }
    });
    
    // Button container
    const buttonContainer = container.createDiv({
      attr: {
        style: "display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;"
      }
    });
    
    // Toggle UI visibility button
    const toggleButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon",
      attr: { 
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    toggleButton.innerHTML = ea.obsidian.getIcon("eye").outerHTML;
    // Keyboard hotkey listener (added after button exists)
    keyHandler = (e) => {
      try {
        if(matchHotkey(e)) {
          e.preventDefault();
          toggleButton.click();
        }
      } catch(_) {}
    };
    window.addEventListener("keydown", keyHandler, true); // capture phase to precede other handlers
    toggleButton.addEventListener("click", () => {
      uiHidden = !uiHidden;
      toggleUIVisibility(uiHidden);
      
      // Toggle icon
      currentIcon = uiHidden ? "eye" : "eye-off";
      toggleButton.innerHTML = ea.obsidian.getIcon(currentIcon).outerHTML;
    });
    
    // Exit button
    const exitButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon",
      attr: { 
        style: "background-color: var(--background-secondary-alt); color: var(--text-normal);" 
      }
    });
    exitButton.innerHTML = ea.obsidian.getIcon("cross").outerHTML;
    
    exitButton.addEventListener("click", () => {
      modal.close();
    });
    
    // Add CSS
    div.createEl("style", { 
      text: `
        .palm-guard-btn:hover {
          filter: brightness(1.1);
        }
        .modal-close-button {
          display: none;
        }
        .palm-guard-btn {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 4px;
          border-radius: 10%;
          width: 2em;
          height: 2em;
          cursor: pointer;
        }
      `
    });
  });
  
  const autocloseTimer = setInterval(()=>{
    if(!ea.targetView) modal.close();
  },1000);

  // Handle modal close (exit Palm Guard mode)
  modal.onClose = () => {
    if(keyHandler) {
      window.removeEventListener("keydown", keyHandler);
    }
    if(unregisterHotkeyOverride) unregisterHotkeyOverride();
    // Show all UI elements
    toggleUIVisibility(false);
    
    // Exit fullscreen
    if(ea.targetView && enableFullscreen) ea.targetView.exitFullscreen();
    clearInterval(autocloseTimer);
    delete window.excalidrawPalmGuard;
  };
  
  // Open the modal
  modal.open();
  
  // Position the modal in the top left initially
  setTimeout(() => {
    const modalEl = modal.modalEl;
    const rect = ea.targetView.contentEl.getBoundingClientRect();
    if (modalEl) {
      modalEl.style.left = `${rect.left+10}px`;
      modalEl.style.top = `${rect.top+10}px`;
    }
  }, 100);
}

run();