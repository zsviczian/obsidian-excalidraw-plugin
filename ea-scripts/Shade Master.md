/*
This script modifies the color lightness/hue/saturation/transparency of selected Excalidraw elements.
Select elements in the scene, then run the script.

```js*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.7.3")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

// Main script execution
const allElements = ea.getViewSelectedElements();
const svgImageElements = allElements.filter(el => 
  el.type === "image" && ea.getViewFileForImageElement(el)?.extension === "svg"
);

if(allElements.length === 0) {
  new Notice("Select at least one rectangle, ellipse, diamond, line, arrow, freedraw, text or SVG image elment");
  return;
}

const originalColors = new Map();

let terminate = false;
const FORMAT = "Color Format";
const STROKE = "Modify Stroke Color";
const BACKGROUND = "Modify Background Color"
const ACTIONS = ["Hue", "Lightness", "Saturation", "Transparency"];

let settings = ea.getScriptSettings();
//set default values on first run
if(!settings[STROKE]) {
  settings = {};
  settings[FORMAT] = {
    value: "HEX",
    valueset: ["HSL", "RGB", "HEX"],
    description: "Output color format."
  };
  settings[STROKE] = { value: true }
  settings[BACKGROUND] = {value: true }
  ea.setScriptSettings(settings);
}

async function storeOriginalColors() {
  // Store colors for regular elements
  const regularElements = allElements.filter(el => 
    ["rectangle", "ellipse", "diamond", "line", "arrow", "freedraw", "text"].includes(el.type)
  );
  
  for (const el of regularElements) {
    const key = el.id;
    originalColors.set(key, {
      type: "regular",
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor
    });
  }

  // Store colors for SVG elements
  for (const el of svgImageElements) {
    const colorInfo = await ea.getColorMapForImgElement(el);
    const svgColors = new Map();
    for (const [color, info] of colorInfo.entries()) {
      svgColors.set(color, {...info});
    }
    originalColors.set(el.id, {
      type: "svg",
      colors: svgColors
    });
  }
}

// Function to reset colors
async function resetColors() {
  ea.clear();
  const allElements = ea.getViewSelectedElements();
  
  // Reset regular elements
  const regularElements = allElements.filter(el => 
    ["rectangle", "ellipse", "diamond", "line", "arrow", "freedraw", "text"].includes(el.type)
  );
  
  if (regularElements.length > 0) {
    ea.copyViewElementsToEAforEditing(regularElements);
    for (const el of ea.getElements()) {
      const original = originalColors.get(el.id);
      if (original && original.type === "regular") {
        if (original.strokeColor) el.strokeColor = original.strokeColor;
        if (original.backgroundColor) el.backgroundColor = original.backgroundColor;
      }
    }
    await ea.addElementsToView(false, false);
  }

  // Reset SVG elements
  for (const el of allElements.filter(el => 
    el.type === "image" && ea.getViewFileForImageElement(el)?.extension === "svg"
  )) {
    const original = originalColors.get(el.id);
    if (original && original.type === "svg") {
      const newColorMap = {};
      let hasChanges = false;
      
      const currentColors = await ea.getColorMapForImgElement(el);
      for (const [color, info] of currentColors.entries()) {
        const originalInfo = original.colors.get(color);
        if (originalInfo && originalInfo.mappedTo !== info.mappedTo) {
          newColorMap[color] = originalInfo.mappedTo;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        ea.updateViewSVGImageColorMap(el, newColorMap);
      }
    }
  }
}

function modifyColor(color, isDecrease, step, action) {
  if (!color) return null;
  
  const cm = ea.getCM(color);
  if (!cm) return color;

  let modified = cm;
  console.log(cm.alpha);
  switch(action) {
    case "Lightness":
      modified = isDecrease ? modified.darkerBy(step) : modified.lighterBy(step);
      break;
    case "Hue":
      modified = isDecrease ? modified.hueBy(-step) : modified.hueBy(step);
      break;
    case "Transparency":
      modified = isDecrease ? modified.alphaBy(-step) : modified.alphaBy(step);
      break;
    default:
      modified = isDecrease ? modified.desaturateBy(step) : modified.saturateBy(step);
  }

  const hasAlpha = modified.alpha < 1;
  console.log(modified.alpha);
  const opts = { alpha: hasAlpha, precision: [1,2,2,3] };
  
  const format = settings[FORMAT].value;
  switch(format) {
    case "RGB": return modified.stringRGB(opts);
    case "HEX": return modified.stringHEX(opts);
    default: return modified.stringHSL(opts);
  }
}

function slider(contentEl, action, min, max, step, invert) {
  let prevValue = (max-min)/2;
  new ea.obsidian.Setting(contentEl)
  .setName(action)
  .addSlider(slider => slider
    .setLimits(min, max, step)
    .setValue(prevValue)
    .onChange(async (value) => {
      const isDecrease = invert ? value > prevValue : value < prevValue;
      const step = Math.abs(value-prevValue);
      prevValue = value;
      if(step>0) {
        await run(isDecrease, step, action);
      }
    }),
  );
}

function showModal() {
  const modal = new ea.obsidian.Modal(app);
  let dirty = false;

  modal.onOpen = () => {
    const { contentEl } = modal;
    modal.bgOpacity = 0;
    contentEl.createEl('h2', { text: 'Shade Master' });
    
    new ea.obsidian.Setting(contentEl)
      .setName(FORMAT)
      .setDesc("Output color format")
      .addDropdown(dropdown => dropdown
        .addOptions({
          "HSL": "HSL",
          "RGB": "RGB",
          "HEX": "HEX"
        })
        .setValue(settings[FORMAT].value)
        .onChange(value => {
          settings[FORMAT].value = value;
          dirty = true;
        })
      );

    new ea.obsidian.Setting(contentEl)
      .setName(STROKE)
      .addToggle(toggle => toggle
        .setValue(settings[STROKE].value)
        .onChange(value => {
          settings[STROKE].value = value;
          dirty = true;
        })
      );

    new ea.obsidian.Setting(contentEl)
      .setName(BACKGROUND)
      .addToggle(toggle => toggle
        .setValue(settings[BACKGROUND].value)
        .onChange(value => {
          settings[BACKGROUND].value = value;
          dirty = true;
        })
      );

    slider(contentEl, "Hue", 0, 400, 1, false);
    slider(contentEl, "Saturation", 0, 200, 1, false);
    slider(contentEl, "Lightness", 0, 50, 1, false);
    slider(contentEl, "Transparency", 0, 1, 0.05, true);
    
    new ea.obsidian.Setting(contentEl)
      .addButton(button => button
        .setButtonText("Reset Colors")
        .onClick(async () => {
          await resetColors();
        }))
      .addButton(button => button
        .setButtonText("Close")
        .setCta(true)
        .onClick(() => modal.close()));

    makeModalDraggable(modal.modalEl); // Add draggable functionality
  };

  modal.onClose = () => {
    terminate = true;
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

  const onMouseDown = (e) => {
    // Ensure the event target isn't an interactive element like slider, button, or input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

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
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    modalEl.style.left = `${initialX + dx}px`;
    modalEl.style.top = `${initialY + dy}px`;
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  header.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Clean up event listeners on modal close
  modalEl.addEventListener('remove', () => {
    header.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });
}

isRunning = false;
const queue = [];
function processQueue() {
  if (!isRunning && queue.length > 0) {
    const [isDecrease, step, action] = queue.shift();
    executeChange(isDecrease, step, action).then(() => {
      if (queue.length > 0) processQueue();
    });
  }
}

const MAX_QUEUE_SIZE = 100;
function run(isDecrease, step, action) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    new Notice ("Queue overflow. Dropping task.");
    return;
  }
  queue.push([isDecrease, step, action]);
  if (!isRunning) processQueue();
}

async function executeChange(isDecrease, step, action) {
  try {
    isRunning = true;
    
    ea.clear();
    const modifyStroke = settings[STROKE].value;
    const modifyBackground = settings[BACKGROUND].value;
    
    //must reselect after each run since elements change in the scene
    const allElements = ea.getViewSelectedElements();
    const regularElements = allElements.filter(el => 
      ["rectangle", "ellipse", "diamond", "line", "arrow", "freedraw", "text"].includes(el.type)
    );

    // Process regular elements
    if (regularElements.length > 0) {
      ea.copyViewElementsToEAforEditing(regularElements);
      for (const el of ea.getElements()) {  
        if (modifyStroke && el.strokeColor) {
          el.strokeColor = modifyColor(el.strokeColor, isDecrease, step, action);
        }
        
        if (modifyBackground && el.backgroundColor) {
          el.backgroundColor = modifyColor(el.backgroundColor, isDecrease, step, action);
        }
      }
      await ea.addElementsToView(false, false);
    }
    
    // Process SVG image elements
    if (svgImageElements.length > 0) {
      for (const el of svgImageElements) {
        // Get current color mapping
        const colorInfo = await ea.getColorMapForImgElement(el);
        const newColorMap = {};
        let hasChanges = false;
    
        // Process each color in the SVG
        for (const [color, info] of colorInfo.entries()) {
          let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
          
          if (shouldModify) {
            const modifiedColor = modifyColor(info.mappedTo, isDecrease, step, action);
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
  } catch (e) {
    new Notice("Error in executeChange. See developer console for details");
    console.error("Error in executeChange:", e);
  } finally {
    isRunning = false;
  }
}

await storeOriginalColors();
showModal();
processQueue();