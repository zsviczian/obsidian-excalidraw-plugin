/*
This script modifies colors of selected Excalidraw elements based on modifier keys:

Color Selection:
- No modifier: Both stroke and background colors
- Shift: Only stroke color
- Cmd/Ctrl(⌘/^): Only background color

Modification Type:
- No Alt/Opt (⌥): Increase value (lightness/hue/saturation/transparency depending on settings)
- Alt/Opt (⌥): Decrease value

Action Toggle:
Holding down both SHIFT and CTRL/CMD when clicking the script button will toggle the action.

```js*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.7.19")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const STEP = "Step size";
const FORMAT = "Color format";
const ACTION = "Action"
const ACTIONS = ["Hue", "Lightness", "Saturation", "Transparency"];

const settings = ea.getScriptSettings();
//set default values on first run
if(!settings[STEP]) {
  settings[STEP] = {
    value: 2,
    description: "Increment/decrement step size"
  };
  settings[FORMAT] = {
    value: "HSL",
    valueset: ["HSL", "RGB", "HEX"],
    description: "Output color format"
  };
  settings[ACTION] = {
    value: "Lightness",
    valueset: ACTIONS,
    description: "Sets which aspect of the color should be modified"
  };
  ea.setScriptSettings(settings);
}

const isMac = ea.DEVICE.isMacOS;
const modKeys = {
  alt: isMac ? "⌥" : "ALT",
  shift: isMac ? "⇧" : "SHIFT",
  ctrl: isMac ? "⌘" : "CTRL"
};

function modifyColor(color, modifiers) {
  if (!color) return null;
  
  const cm = ea.getCM(color);
  if (!cm) return color;
  
  const step = settings[STEP].value;
  const isDecrease = modifiers.altKey;
  const action = settings[ACTION].value;

  let modified = cm;

  switch(action) {
    case "Lightness":
      modified = isDecrease ? modified.darkerBy(step) : modified.lighterBy(step);
      break;
    case "Hue":
      modified = isDecrease ? modified.hueBy(-step) : modified.hueBy(step);
      break;
    case "Transparency":
      modified = isDecrease ? modified.alphaBy(-step/100) : modified.alphaBy(step/100);
    default:
      modified = isDecrease ? modified.desaturateBy(step) : modified.saturateBy(step);
  }

  const hasAlpha = modified.alpha !== 1;
  const opts = { alpha: hasAlpha };
  
  const format = settings[FORMAT].value;
  switch(format) {
    case "RGB": return modified.stringRGB(opts);
    case "HEX": return modified.stringHEX(opts);
    default: return modified.stringHSL(opts);
  }
}

function showSettingsModal() {
  const modal = new ea.obsidian.Modal(app);
  let dirty = false;

  modal.onOpen = () => {
    const { contentEl } = modal;
    modal.bgOpacity = 0;
    contentEl.createEl('h2', { text: 'Shade Master' });

    const instructions = contentEl.createDiv();
    instructions.innerHTML = `
      <h3>Instructions</h3>
      <p>The script button will perform a range of actions depending on how you click and which modifier buttons you press when clicking.</p>
      <ul>
        <li>If neither of <kbd>${modKeys.shift}</kbd> and <kbd>${modKeys.ctrl}</kbd> are down the script will modify both stroke and background colors</li>
        <li><kbd>${modKeys.shift}</kbd>: Modify only the stroke color</li>
        <li><kbd>${modKeys.ctrl}</kbd>: Modify only the background color</li>
        <li><kbd>${modKeys.alt}</kbd>: Increase/Decrease hue/ligthness/saturation/transparency (based on setting)</li>
        <li><kbd>${modKeys.shift}</kbd> and <kbd>${modKeys.ctrl}</kbd>: Click to toggle script action between hue/lightness/saturation/transparency.</li>
        <li><kbd>${modKeys.shift}</kbd> and <kbd>${modKeys.ctrl}</kbd>: Double-click to display current action</li>
      </ul>
      <h3>Settings</h3>
    `;

    new ea.obsidian.Setting(contentEl)
      .setName(STEP)
      .setDesc("Increment/decrement step size")
      .addText(text => text
        .setValue(settings["Step size"].value.toString())
        .onChange(value => {
          const val = parseFloat(value);
          if (isNaN(val)) {
            new Notice("Enter a valid number");
            return;
          }
          settings["Step size"].value = val;
          dirty = true;
        }));

    new ea.obsidian.Setting(contentEl)
      .setName(FORMAT)
      .setDesc("Output color format")
      .addDropdown(dropdown => dropdown
        .addOptions({
          "HSL": "HSL",
          "RGB": "RGB",
          "HEX": "HEX"
        })
        .setValue(settings["Color format"].value)
        .onChange(value => {
          settings["Color format"].value = value;
          dirty = true;
        }));

    new ea.obsidian.Setting(contentEl)
      .setName(ACTION)
      .setDesc("Sets which aspect of the color should be modified")
      .addDropdown(dropdown => dropdown
        .addOptions(ACTIONS.reduce((acc, key) => { acc[key] = key; return acc; }, {}))
        .setValue(settings[ACTION].value)
        .onChange(value => {
          settings[ACTION].value = value;
          dirty = true;
        }));

    new ea.obsidian.Setting(contentEl)
      .addButton(button => button
        .setButtonText("Close")
        .setCta(true)
        .onClick(() => modal.close()));

    makeModalDraggable(modal.modalEl); // Add draggable functionality
  };

  modal.onClose = () => {
    if (dirty) {
      ea.setScriptSettings(settings);
    }
  };

  modal.open();
}

/**
 * Add draggable functionality to the modal element.
 * @param {HTMLElement} modalEl - The modal element to make draggable.
 */
function makeModalDraggable(modalEl) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  const header = modalEl.querySelector('.modal-titlebar') || modalEl; // Default to modalEl if no titlebar
  header.style.cursor = 'move';

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = modalEl.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    modalEl.style.position = 'absolute';
    modalEl.style.margin = '0'; // Reset margin to avoid issues
    modalEl.style.left = `${initialX}px`;
    modalEl.style.top = `${initialY}px`;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    modalEl.style.left = `${initialX + dx}px`;
    modalEl.style.top = `${initialY + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}


// Main script execution
const allElements = ea.getViewSelectedElements();
const regularElements = allElements.filter(el => 
  ["rectangle", "ellipse", "diamond", "line", "freedraw", "text"].includes(el.type)
);
const svgImageElements = allElements.filter(el => 
  el.type === "image" && ea.getViewFileForImageElement(el)?.extension === "svg"
);

const modifiers = ea.targetView.modifierKeyDown;

if((modifiers.ctrlKey || modifiers.metaKey) && modifiers.shiftKey) {
  const timestamp = Date.now();
  if(window.ExcalidrawShadeMaster && (timestamp - window.ExcalidrawShadeMaster.timestamp < 350) ) {
    window.clearTimeout(window.ExcalidrawShadeMaster.timerID);
    delete window.ExcalidrawShadeMaster;
    new Notice(`Current action: ${settings[ACTION].value}`);
  } else {
    if(window.ExcalidrawShadeMaster) {
      window.clearTimeout(window.ExcalidrawShadeMaster.timerID);
      delete window.ExcalidrawShadeMaster;
    }
    const timerID = window.setTimeout(()=>{
      delete window.ExcalidrawShadeMaster;
      settings[ACTION].value = ACTIONS[(ACTIONS.indexOf(settings[ACTION].value)+1) % ACTIONS.length];
      new Notice (`Action modified to: ${settings[ACTION].value}`);
      ea.setScriptSettings(settings);
    } ,400);
    window.ExcalidrawShadeMaster = { timestamp, timerID };
  }
  return;
}

// Show settings modal if no elements selected (unchanged)
if (allElements.length === 0) {
  showSettingsModal();
  return;
}

// Process regular elements
if (regularElements.length > 0) {
  ea.copyViewElementsToEAforEditing(regularElements);

  const modifyStroke = !modifiers.ctrlKey && !modifiers.metaKey;
  const modifyBackground = !modifiers.shiftKey && (!modifiers.ctrlKey || !modifiers.metaKey);

  for (const el of ea.getElements()) {  
    if (modifyStroke && el.strokeColor) {
      el.strokeColor = modifyColor(el.strokeColor, modifiers);
    }
    
    if (modifyBackground && el.backgroundColor) {
      el.backgroundColor = modifyColor(el.backgroundColor, modifiers);
    }
  }

  await ea.addElementsToView(false, false);
}

// Process SVG image elements
if (svgImageElements.length > 0) {
  const modifyStroke = !modifiers.ctrlKey && !modifiers.metaKey;
  const modifyBackground = !modifiers.shiftKey && (!modifiers.ctrlKey || !modifiers.metaKey);

  for (const el of svgImageElements) {
    // Get current color mapping
    const colorInfo = await ea.getColorMapForImgElement(el);
    const newColorMap = {};
    let hasChanges = false;

    // Process each color in the SVG
    for (const [color, info] of colorInfo.entries()) {
      let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
      
      if (shouldModify) {
        const modifiedColor = modifyColor(info.mappedTo, modifiers);
        if (modifiedColor !== color) {
          newColorMap[color] = modifiedColor;
          hasChanges = true;
        }
      }
    }

    // Update the SVG if any colors were modified
    if (hasChanges) {
      ea.updateViewSVGImageColorMap(el, newColorMap);
    }
  }
}