/*
This is an experimental script. If you find bugs, please consider debugging yourself then submitting a PR on github with the fix, instead of raising an issue. Thank you!

This script modifies the color lightness/hue/saturation/transparency of selected Excalidraw elements and  SVG and nested Excalidraw drawings. Select eligible elements in the scene, then run the script.

- The color of Excalidraw elements (lines, ellipses, rectangles, etc.) will be changed by the script.
- The color of SVG elements and nested Excalidraw drawings will only be mapped. When mapping colors, the original image remains unchanged, only a mapping table is created and the image is recolored during rendering of your Excalidraw screen. In case you want to make manual changes you can also edit the mapping in Markdown View Mode under `## Embedded Files`

If you select only a single SVG or nested Excalidraw element, then the script offers an additional feature. You can map colors one by one in the image. 
```js*/

const HELP_TEXT = `
- Select SVG images, nested Excalidraw drawings and/or regular Excalidraw elements
- For a single selected image, you can map colors individually in the color mapping section
- For Excalidraw elements: stroke and background colors are modified permanently
- For SVG/nested drawings: original files stay unchanged, color mapping is stored under \`## Embedded Files\`
- Using color maps helps maintain links between drawings while allowing different color themes
- Sliders work on relative scale - the amount of change is applied to current values
- Unlike Excalidraw's opacity setting which affects the whole element:
  - Shade Master can set different opacity for stroke vs background
  - Note: SVG/nested drawing colors are mapped at color name level, thus "black" is different from "#000000"
  - Additionally if the same color is used as fill and stroke the color can only be changed once
- This is an experimental script - contributions welcome on GitHub via PRs
`;

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.7.3")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

/*
SVGColorInfo is returned by ea.getSVGColorInfoForImgElement. Color info will all the color strings in the SVG file plus "fill" which represents the default fill color for SVG icons set at the SVG root element level. Fill if not set defaults to black:

type SVGColorInfo = Map<string, {
  mappedTo: string;
  fill: boolean;
  stroke: boolean;
}>;

In the Excalidraw file under `## Embedded Files` the color map is included after the file. That color map implements ColorMap. ea.updateViewSVGImageColorMap takes a ColorMap as input.
interface ColorMap {
  [color: string]: string;
};
*/

// Main script execution
const allElements = ea.getViewSelectedElements();
const svgImageElements = allElements.filter(el => {
  const file = ea.getViewFileForImageElement(el);
  if(!file) return false;
  return el.type === "image" && (
    file.extension === "svg" ||
    ea.isExcalidrawFile(file)
  );
});

if(allElements.length === 0) {
  new Notice("Select at least one rectangle, ellipse, diamond, line, arrow, freedraw, text or SVG image elment");
  return;
}

const originalColors = new Map();
const colorInputs = new Map();
const sliderResetters = [];
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

function getRegularElements() {
  ea.clear();
  //loading view elements again as element objects change when colors are updated
  const allElements = ea.getViewSelectedElements();
  return allElements.filter(el => 
    ["rectangle", "ellipse", "diamond", "line", "arrow", "freedraw", "text"].includes(el.type)
  );
}

const updatedImageElementColorMaps = new Map();
let isWaitingForSVGUpdate = false;
function updateViewImageColors() {
  if(terminate || isWaitingForSVGUpdate || updatedImageElementColorMaps.size === 0) {
    return;
  }
  isWaitingForSVGUpdate = true;
  elementArray = Array.from(updatedImageElementColorMaps.keys());
  colorMapArray = Array.from(updatedImageElementColorMaps.values());
  updatedImageElementColorMaps.clear();
  ea.updateViewSVGImageColorMap(elementArray, colorMapArray).then(()=>{
    isWaitingForSVGUpdate = false;
    updateViewImageColors();
  });
}

async function storeOriginalColors() {
  // Store colors for regular elements  
  for (const el of getRegularElements()) {
    const key = el.id;
    const colorData = {
      type: "regular",
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor
    };
    originalColors.set(key, colorData);
  }

  // Store colors for SVG elements
  for (const el of svgImageElements) {
    const colorInfo = await ea.getSVGColorInfoForImgElement(el);
    const svgColors = new Map();
    for (const [color, info] of colorInfo.entries()) {
      svgColors.set(color, {...info});
    }
    const svgColorData = {
      type: "svg",
      colors: svgColors
    };
    originalColors.set(el.id, svgColorData);
  }
}

function clearSVGMapping() {
  for (const resetter of sliderResetters) {
    resetter();
  }
  // Reset SVG elements
  if (svgImageElements.length === 1) {
    const el = svgImageElements[0];
    const original = originalColors.get(el.id);
    if (original && original.type === "svg") {
      
      for (const color of original.colors.keys()) {
        // Update UI components
        const inputs = colorInputs.get(color);
        if (inputs) {
          if(color === "fill") {
            //stroke is a special value in case the SVG has no fill color defined (i.e black)
            inputs.textInput.setValue("black");
            inputs.colorPicker.setValue("#000000");
          } else {
            const cm = ea.getCM(color);
            inputs.textInput.setValue(color);
            inputs.colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
          }
        }
      }
      updatedImageElementColorMaps.set(el, {});
    }
  } else {
    for (const el of svgImageElements) {
      updatedImageElementColorMaps.set(el, {});
    }
  }
  updateViewImageColors();
}

// Function to reset colors
async function resetColors() {
  for (const resetter of sliderResetters) {
    resetter();
  }

  const regularElements = getRegularElements();
  
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
  if (svgImageElements.length === 1) {
    const el = svgImageElements[0];
    const original = originalColors.get(el.id);
    if (original && original.type === "svg") {
      const newColorMap = {};
      
      for (const [color, info] of original.colors.entries()) {
        newColorMap[color] = info.mappedTo;
        // Update UI components
        const inputs = colorInputs.get(color);
        if (inputs) {
          const cm = ea.getCM(info.mappedTo);
          inputs.textInput.setValue(info.mappedTo);
          inputs.colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
        }
      }
      updatedImageElementColorMaps.set(el, newColorMap);
    }
  } else {
    for (const el of svgImageElements) {
      const original = originalColors.get(el.id);
      if (original && original.type === "svg") {
        const newColorMap = {};
        
        for (const [color, info] of original.colors.entries()) {
          newColorMap[color] = info.mappedTo;
        }  
        updatedImageElementColorMaps.set(el, newColorMap);
      }
    }
  }
  updateViewImageColors();
}

function modifyColor(color, isDecrease, step, action) {
  if (!color) return null;
  
  const cm = ea.getCM(color);
  if (!cm) return color;

  let modified = cm;

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
  const opts = { alpha: hasAlpha, precision: [1,2,2,3] };
  
  const format = settings[FORMAT].value;
  switch(format) {
    case "RGB": return modified.stringRGB(opts).toLowerCase();
    case "HEX": return modified.stringHEX(opts).toLowerCase();
    default: return modified.stringHSL(opts).toLowerCase();
  }
}

function slider(contentEl, action, min, max, step, invert) {
  let prevValue = (max-min)/2;
  let debounce = false;
  let sliderControl;
  new ea.obsidian.Setting(contentEl)
  .setName(action)
  .addSlider(slider => {
    sliderControl = slider;
    slider
      .setLimits(min, max, step)
      .setValue(prevValue)
      .onChange(async (value) => {
        if (debounce) return;
        const isDecrease = invert ? value > prevValue : value < prevValue;
        const step = Math.abs(value-prevValue);
        prevValue = value;
        if(step>0) {
          run(isDecrease, step, action);
        }
      });
    }
  );
  return () => {
    debounce = true;
    prevValue = (max-min)/2;
    sliderControl.setValue(prevValue);
    debounce = false;
  }
}

function showModal() {
  let debounceColorPicker = true;
  const modal = new ea.obsidian.Modal(app);
  let dirty = false;

  modal.onOpen = async () => {
    const { contentEl } = modal;
    modal.bgOpacity = 0;
    contentEl.createEl('h2', { text: 'Shade Master' });
    
    const helpDiv = contentEl.createEl("details", {
      attr: { style: "margin-bottom: 1em;background: var(--background-secondary); padding: 1em; border-radius: 4px;" }});
    helpDiv.createEl("summary", { text: "Help & Usage Guide", attr: { style: "cursor: pointer; color: var(--text-accent);" } });
    helpDiv.createEl("div", { 
      text: HELP_TEXT,
      attr: { style: "margin-top: 0.5em; white-space: pre-wrap;" }
    });

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

    sliderResetters.push(slider(contentEl, "Hue", 0, 400, 1, false));
    sliderResetters.push(slider(contentEl, "Saturation", 0, 200, 1, false));
    sliderResetters.push(slider(contentEl, "Lightness", 0, 100, 1, false));
    sliderResetters.push(slider(contentEl, "Transparency", 0, 2, 0.05, true));

    // Add color pickers if a single SVG image is selected
    if (svgImageElements.length === 1) {
      const svgElement = svgImageElements[0];
      const colorInfo = await ea.getSVGColorInfoForImgElement(svgElement);
      
      const colorSection = contentEl.createDiv();
      colorSection.createEl('h3', { text: 'SVG Colors' });
      
      for (const [color, info] of colorInfo.entries()) {
        const row = new ea.obsidian.Setting(colorSection)
          .setName(color === "fill" ? "SVG default" : color)
          .setDesc(`${info.fill ? "Fill" : ""}${info.fill && info.stroke ? " & " : ""}${info.stroke ? "Stroke" : ""}`);
        
        // Create color preview div
        const previewDiv = row.controlEl.createDiv();
        previewDiv.style.width = "30px";
        previewDiv.style.height = "20px";
        previewDiv.style.border = "1px solid var(--background-modifier-border)";
        if (color === "transparent") {
          previewDiv.style.backgroundImage = "linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)";
          previewDiv.style.backgroundSize = "10px 10px";
          previewDiv.style.backgroundPosition = "0 0, 0 5px, 5px -5px, -5px 0px";
        } else {
          previewDiv.style.backgroundColor = ea.getCM(color).stringHEX({alpha: false}).toLowerCase();
        }
        
        const resetButton = new ea.obsidian.Setting(row.controlEl)
          .addButton(button => button
            .setButtonText(">>>")
            .setClass("reset-color-button")
            .onClick(async () => {
              const original = originalColors.get(svgElement.id);
              if (original?.type === "svg") {
                const originalInfo = original.colors.get(color);
                if (originalInfo) {
                  const newColorMap = await ea.getColorMapForImageElement(svgElement);
                  delete newColorMap[color];
                  updatedImageElementColorMaps.set(svgElement, newColorMap);
                  updateViewImageColors();
                  
                  // Update UI components
                  debounceColorPicker = true;
                  textInput.setValue(color === "fill" ? "black" : color);
                  colorPicker.setValue(color === "fill"
                    ? "#000000"
                    : ea.getCM(color).stringHEX({alpha: false}).toLowerCase()
                  );
                  updateViewImageColors();
                }
              }
            }))
          resetButton.settingEl.style.padding = "0";
          resetButton.settingEl.style.border = "0";

        // Add text input for color value
        const textInput = new ea.obsidian.TextComponent(row.controlEl)
          .setValue(info.mappedTo)
          .setPlaceholder("Color value");
        textInput.inputEl.style.width = "120px";
        textInput.onChange(value => {
          const lower = value.toLowerCase();
          if (lower === color) return;
          textInput.setValue(lower);
        })

        const applyButtonComponent = new ea.obsidian.Setting(row.controlEl)
          .addButton(button => button
            .setIcon("check")
            .setTooltip("Apply")
            .onClick(async () => {
              const value = textInput.getValue();
              try {
                if(!CSS.supports("color",value)) {
                  new Notice (`${value} is not a valid color string`);
                  return;
                }
                const cm = ea.getCM(value);
                if (cm) {
                  const format = settings[FORMAT].value;
                  const alpha = cm.alpha < 1 ? true : false;
                  const newColor = format === "RGB" 
                    ? cm.stringRGB({alpha , precision: [1,2,2,3]}).toLowerCase()
                    : format === "HEX" 
                      ? cm.stringHEX({alpha}).toLowerCase()
                      : cm.stringHSL({alpha, precision: [1,2,2,3]}).toLowerCase();
      
                  const newColorMap = await ea.getColorMapForImageElement(svgElement);
                  if(color === newColor) {
                    delete newColorMap[color];
                  } else {
                    newColorMap[color] = newColor;
                  }
                  updatedImageElementColorMaps.set(svgElement, newColorMap);
                  updateViewImageColors();
                  debounceColorPicker = true;
                  colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
                }
              } catch (e) {
                console.error("Invalid color value:", e);
              }
            }));
          applyButtonComponent.settingEl.style.padding = "0";
          applyButtonComponent.settingEl.style.border = "0";
        
        // Add color picker
        const colorPicker = new ea.obsidian.ColorComponent(row.controlEl)
          .setValue(ea.getCM(info.mappedTo).stringHEX({alpha: false}).toLowerCase());
  
        // Store references to the components
        colorInputs.set(color, {
          textInput,
          colorPicker,
          previewDiv,
          resetButton
        });

        colorPicker.colorPickerEl.addEventListener('click', () => {
          debounceColorPicker = false;
        });

        colorPicker.onChange(async (value) => {
          try {
            if(!debounceColorPicker) {
            // Preserve alpha from original color
              const originalAlpha = ea.getCM(info.mappedTo).alpha;
              const cm = ea.getCM(value);
              cm.alphaTo(originalAlpha);
              const alpha = originalAlpha < 1 ? true : false;
              const format = settings[FORMAT].value;
              const newColor = format === "RGB" 
                ? cm.stringRGB({alpha, precision: [1,2,2,3]}).toLowerCase()
                : format === "HEX" 
                  ? cm.stringHEX({alpha}).toLowerCase()
                  : cm.stringHSL({alpha, precision: [1,2,2,3]}).toLowerCase();
              
              // Update text input
              textInput.setValue(newColor);
              
              // Update SVG
              const newColorMap = await ea.getColorMapForImageElement(svgElement);
              if(color === newColor) {
                delete newColorMap[color];
              } else {
                newColorMap[color] = newColor;
              }
              updatedImageElementColorMaps.set(svgElement, newColorMap);
              updateViewImageColors();
            }
          } catch (e) {
            console.error("Invalid color value:", e);
          } finally {
            debounceColorPicker = true;
          }
        });
      }
    }

    const buttons = new ea.obsidian.Setting(contentEl);
    if(svgImageElements.length > 0) {
      buttons.addButton(button => button
        .setButtonText("Initialize SVG Colors")
        .onClick(() => {
          debounceColorPicker = true;
          clearSVGMapping();
        })
      );
    }

    buttons
      .addButton(button => button
        .setButtonText("Reset")
        .onClick(() => {
          debounceColorPicker = true;
          resetColors();
        }))
      .addButton(button => button
        .setButtonText("Close")
        .setCta(true)
        .onClick(() => modal.close()));

    makeModalDraggable(modal.modalEl);
  };

  modal.onClose = () => {
    terminate = true;
    if (dirty) {
      ea.setScriptSettings(settings);
    }
    if(ea.targetView.isDirty()) {
      ea.targetView.save(false);
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

  const onPointerDown = (e) => {
    // Ensure the event target isn't an interactive element like slider, button, or input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = modalEl.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    modalEl.style.position = 'absolute';
    modalEl.style.margin = '0';
    modalEl.style.left = `${initialX}px`;
    modalEl.style.top = `${initialY}px`;
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    modalEl.style.left = `${initialX + dx}px`;
    modalEl.style.top = `${initialY + dy}px`;
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  header.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  // Clean up event listeners on modal close
  modalEl.addEventListener('remove', () => {
    header.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  });
}

async function executeChange(isDecrease, step, action) {
  try {
    isRunning = true;
    const modifyStroke = settings[STROKE].value;
    const modifyBackground = settings[BACKGROUND].value;
    const regularElements = getRegularElements();

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
    if (svgImageElements.length === 1) { // Only update UI for single SVG
      const el = svgImageElements[0];
      const colorInfo = await ea.getSVGColorInfoForImgElement(el);
      const newColorMap = {};
  
      // Process each color in the SVG
      for (const [color, info] of colorInfo.entries()) {
        let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
        
        if (shouldModify) {
          const modifiedColor = modifyColor(info.mappedTo, isDecrease, step, action);
          if (modifiedColor !== color) {
            newColorMap[color] = modifiedColor;
          }
          // Update UI components if they exist
          const inputs = colorInputs.get(color);
          if (inputs) {
            const cm = ea.getCM(modifiedColor);
            inputs.textInput.setValue(modifiedColor);
            inputs.colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
          }
        }
      }
      updatedImageElementColorMaps.set(el, newColorMap);
    } else {
      if (svgImageElements.length > 0) {
        for (const el of svgImageElements) {
          const colorInfo = await ea.getSVGColorInfoForImgElement(el);
          const newColorMap = {};
      
          // Process each color in the SVG
          for (const [color, info] of colorInfo.entries()) {
            let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
            
            if (shouldModify) {
              const modifiedColor = modifyColor(info.mappedTo, isDecrease, step, action);
              if (modifiedColor !== color) {
                newColorMap[color] = modifiedColor;
              }
            }
          }
          updatedImageElementColorMaps.set(el, newColorMap);
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

isRunning = false;
const queue = [];
function processQueue() {
  if (!terminate && !isRunning && queue.length > 0) {
    const [isDecrease, step, action] = queue.shift();
    executeChange(isDecrease, step, action).then(() => {
      updateViewImageColors()
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

await storeOriginalColors();
showModal();
processQueue();