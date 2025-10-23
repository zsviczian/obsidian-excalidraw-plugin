/*
Palm Guard: A mobile-friendly drawing mode for Excalidraw that prevents accidental palm touches by hiding UI controls and entering fullscreen mode. Perfect for drawing with a stylus on tablets.

Features:
- Enters fullscreen to maximize drawing space (configurable in plugin script settings)
- Hides all UI controls to prevent accidental taps
- Provides a minimal floating toolbar with toggle visibility button
- Enables a completely distraction-free canvas even on desktop devices by hiding the main toolbar and all chrome while keeping a tiny movable toggle control (addresses immersive canvas / beyond Zen Mode request)
- Draggable toolbar can be positioned anywhere on screen
- Exit Palm Guard mode with a single tap
- Press the hotkey you configured for this script in Obsidian's Hotkey settings (e.g., ALT+X) to toggle UI visibility; if no hotkey is set, use the on-screen toggle button.

![Palm Guard Script](https://youtu.be/A_udjVjgWN0)

```js
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.14.2")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

async function run() {
  if(window.excalidrawPalmGuard) {
    window.excalidrawPalmGuard()
    return;
  }
  const excalidrawAPI = ea.getExcalidrawAPI()
  const modal = new ea.FloatingModal(ea.plugin.app);
  const FULLSCREEN = "Goto fullscreen?";
  let settings = ea.getScriptSettings() || {};
  if(!settings[FULLSCREEN]) {
    settings[FULLSCREEN] = { value: true };
    await ea.setScriptSettings(settings);
  }
  
  //added only to clean up settings if someone installed the initial version of the script
  const HOTKEY_MODIFIERS = "PalmGuard Toggle UI Hotkey Modifiers";
  const HOTKEY_KEY = "PalmGuard Toggle UI Hotkey Key";
  if(settings[HOTKEY_MODIFIERS] || settings[HOTKEY_KEY]) {
    delete settings[HOTKEY_MODIFIERS];
    delete settings[HOTKEY_KEY];
    await ea.setScriptSettings(settings);
  }

  const enableFullscreen = settings[FULLSCREEN].value;

  // Initialize state
  let uiHidden = true;
  let unsuscribeOnChange = () => {}
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
      if (sidebarToggle) sidebarToggle.style.display = display;
      if (plugins) plugins.style.display = display;
      if (toolbarActive) toolbar.style.display = hidden ? "none" : "block";
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
    paddingTop: "4px",
    paddingRight: "8px",
    paddingLeft: "8px"
  });
  
  modal.headerEl.style.display = "none";
  // Configure modal
  modal.titleEl.setText(""); // No title for minimal UI
  
  // Create modal content
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
      cls: "palm-guard-btn clickable-icon cpg-button-toggled-off",
      attr: { 
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    toggleButton.innerHTML = ea.obsidian.getIcon("eye-off").outerHTML;
    // Keyboard hotkey listener (only acts if hotkey configured)
    window.excalidrawPalmGuard = () => toggleButton.click();
    toggleButton.addEventListener("click", () => {
      uiHidden = !uiHidden;
      toggleUIVisibility(uiHidden);
      
      // Toggle icon
      currentIcon = uiHidden ? "eye-off" : "eye" ;
      if (toggleButton.classList.contains('cpg-button-toggled-on')) {
        toggleButton.classList.remove('cpg-button-toggled-on');
        toggleButton.classList.add('cpg-button-toggled-off');
        
      } else {
        toggleButton.classList.remove('cpg-button-toggled-off');
        toggleButton.classList.add('cpg-button-toggled-on');
      }

      toggleButton.innerHTML = ea.obsidian.getIcon(currentIcon).outerHTML;
    });

    // ===================== CUSTOM BUTTONS =====================

      // Function to toggle between cpg-button-toggled-on and cpg-button-toggled-off
    const toggleButtonVisibleStateClass = (customToolsToggle, selectedTool) => {

      const toolButton = customToolsToggle[selectedTool];
      if (toolButton.classList.contains('cpg-button-toggled-off')) {
        toolButton.classList.remove('cpg-button-toggled-off');
        toolButton.classList.add('cpg-button-toggled-on');
        
        Object.values(customToolsToggle).forEach(nonSelectedTool => {
          if (nonSelectedTool != toolButton) {
            nonSelectedTool.classList.remove('cpg-button-toggled-on');
            nonSelectedTool.classList.add('cpg-button-toggled-off');
          }
        })
      }
    }

    const getActiveTool = (excalidrawAPI) => {
      const state = excalidrawAPI.getAppState();
      return state?.activeTool?.type;
    }

    const setActiveTool = (excalidrawAPI, selectedTool) => {
      const toolType = { type: selectedTool };
      excalidrawAPI.setActiveTool(toolType);
      toggleButtonVisibleStateClass(customToolsToggle, selectedTool);
    }

    let currentTool = undefined;
    // Select Tool Button
    const selectToolButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon cpg-button-toggled-off",
      attr: { 
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    selectToolButton.innerHTML = ea.obsidian.getIcon("mouse-pointer").outerHTML;
    selectToolButton.addEventListener("click", () => {
      currentTool = 'selection';
      setActiveTool(excalidrawAPI, currentTool);
    });

    // Pencil Tool Button
    const pencilToolButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon cpg-button-toggled-off",
      attr: { 
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    
    pencilToolButton.innerHTML = ea.obsidian.getIcon("pencil").outerHTML;
    pencilToolButton.addEventListener("click", () => {
      currentTool = 'freedraw';
      setActiveTool(excalidrawAPI, currentTool);
    });

    // eraser Tool Button
    const eraserToolButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon cpg-button-toggled-off",
      attr: {
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    
    eraserToolButton.innerHTML = ea.obsidian.getIcon("eraser").outerHTML;
    eraserToolButton.addEventListener("click", () => {
      currentTool = 'eraser';
      setActiveTool(excalidrawAPI, currentTool);
    });

    // Hand Tool Button
    const handToolButton = buttonContainer.createEl("button", {
      cls: "palm-guard-btn clickable-icon cpg-button-toggled-off",
      attr: {
        style: "background-color: var(--interactive-accent); color: var(--text-on-accent);" 
      }
    });
    
    handToolButton.innerHTML = ea.obsidian.getIcon("hand").outerHTML;
    handToolButton.addEventListener("click", () => {
      currentTool = 'hand';
      setActiveTool(excalidrawAPI, currentTool);
    });

    const customToolsToggle = {
      selection: selectToolButton,
      lasso: selectToolButton,
      hand: handToolButton,
      freedraw: pencilToolButton,
      eraser: eraserToolButton,
    }

    let selectedToolOnRun = getActiveTool(excalidrawAPI);
    if (customToolsToggle[selectedToolOnRun] != null) {
      currentTool = selectedToolOnRun
      toggleButtonVisibleStateClass(customToolsToggle, selectedToolOnRun)
    }

    unsuscribeOnChange = excalidrawAPI.onChange((e, as, f) => {
      if (as?.activeTool?.type != null
          && customToolsToggle[as?.activeTool?.type] != null) {
          toggleButtonVisibleStateClass(customToolsToggle, as?.activeTool?.type);
      }
    })

    // ===================== CUSTOM BUTTONS =====================
    
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

        .cpg-button-toggled-on {
          opacity: 0.8;
        }

        .cpg-button-toggled-off {
          opacity: 0.4;
        }
      `
    });
  });
  
  const autocloseTimer = setInterval(()=>{
    if(!ea.targetView) modal.close();
  },1000);

  // Handle modal close (exit Palm Guard mode)
  modal.onClose = () => {
    // Show all UI elements
    toggleUIVisibility(false);
    // https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#onchange
    // unsuscribe excalidraw on change
    unsuscribeOnChange();
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
      // Adjust positioning based on device type
      const isTablet = ea.DEVICE.isTablet || ea.DEVICE.isMobile;
      const leftOffset = 10;
      const topOffset = isTablet ? 10 : 50;
      
      modalEl.style.left = `${rect.left + leftOffset}px`;
      modalEl.style.top = `${rect.top + topOffset}px`;
    }
  }, 100);
}

run();