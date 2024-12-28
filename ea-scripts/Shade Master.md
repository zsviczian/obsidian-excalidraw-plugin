/*
This is an experimental script. If you find bugs, please consider debugging yourself then submitting a PR on github with the fix, instead of raising an issue. Thank you!

This script modifies the color lightness/hue/saturation/transparency of selected Excalidraw elements and  SVG and nested Excalidraw drawings. Select eligible elements in the scene, then run the script.

- The color of Excalidraw elements (lines, ellipses, rectangles, etc.) will be changed by the script.
- The color of SVG elements and nested Excalidraw drawings will only be mapped. When mapping colors, the original image remains unchanged, only a mapping table is created and the image is recolored during rendering of your Excalidraw screen. In case you want to make manual changes you can also edit the mapping in Markdown View Mode under `## Embedded Files`

If you select only a single SVG or nested Excalidraw element, then the script offers an additional feature. You can map colors one by one in the image. 
```js*/

const HELP_TEXT = `
<ul>
<li dir="auto">Select SVG images, nested Excalidraw drawings and/or regular Excalidraw elements</li>
<li dir="auto">For a single selected image, you can map colors individually in the color mapping section</li>
<li dir="auto">For Excalidraw elements: stroke and background colors are modified permanently</li>
<li dir="auto">For SVG/nested drawings: original files stay unchanged, color mapping is stored under <code>## Embedded Files</code></li>
<li dir="auto">Using color maps helps maintain links between drawings while allowing different color themes</li>
<li dir="auto">Sliders work on relative scale - the amount of change is applied to current values</li>
<li dir="auto">Unlike Excalidraw's opacity setting which affects the whole element:
<ul>
<li dir="auto">Shade Master can set different opacity for stroke vs background</li>
<li dir="auto">Note: SVG/nested drawing colors are mapped at color name level, thus "black" is different from "#000000"</li>
<li dir="auto">Additionally if the same color is used as fill and stroke the color can only be mapped once</li>
</ul>
</li>
<li dir="auto">This is an experimental script - contributions welcome on GitHub via PRs</li>
</ul>
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/ISuORbVKyhQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`;

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.7.2")) {
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
  if(el.type !== "image") return false;
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
const currentColors = new Map();
const colorInputs = new Map();
const sliderResetters = [];
let terminate = false;
const FORMAT = "Color Format";
const STROKE = "Modify Stroke Color";
const BACKGROUND = "Modify Background Color"
const ACTIONS = ["Hue", "Lightness", "Saturation", "Transparency"];
const precision = [1,2,2,3];
const minLigtness = 1/Math.pow(10,precision[2]);
const maxLightness = 100 - minLigtness;
const minSaturation = 1/Math.pow(10,precision[2]);

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
    
    originalColors.set(el.id, {type: "svg",colors: svgColors});
  }
  copyOriginalsToCurrent();
}

function copyOriginalsToCurrent() {
  for (const [key, value] of originalColors.entries()) {
    if(value.type === "regular") {
      currentColors.set(key, {...value});
    } else {
      const newColorMap = new Map();
      for (const [color, info] of value.colors.entries()) {
        newColorMap.set(color, {...info});
      }
      currentColors.set(key, {type: "svg", colors: newColorMap});
    }
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
    const current = currentColors.get(el.id);
    if (original && original.type === "svg") {
      
      for (const color of original.colors.keys()) {
        current.colors.get(color).mappedTo = color;
      }
    }
  } else {
    for (const el of svgImageElements) {
      const original = originalColors.get(el.id);
      const current = currentColors.get(el.id);
      if (original && original.type === "svg") {
        for (const color of original.colors.keys()) {
          current.colors.get(color).mappedTo = color;
        }
      }
    }
  }
  run("clear");
}

// Set colors
async function setColors(colors) {
  debounceColorPicker = true;
  const regularElements = getRegularElements();
  
  if (regularElements.length > 0) {
    ea.copyViewElementsToEAforEditing(regularElements);
    for (const el of ea.getElements()) {
      const original = colors.get(el.id);
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
    const original = colors.get(el.id);
    if (original && original.type === "svg") {
      const newColorMap = {};
      
      for (const [color, info] of original.colors.entries()) {
        newColorMap[color] = info.mappedTo;
        // Update UI components
        const inputs = colorInputs.get(color);
        if (inputs) {
          if(info.mappedTo === "fill") {
            info.mappedTo = "black";
            //"fill" is a special value in case the SVG has no fill color defined (i.e black)
            inputs.textInput.setValue("black");
            inputs.colorPicker.setValue("#000000");
          } else {
            const cm = ea.getCM(info.mappedTo);
            inputs.textInput.setValue(info.mappedTo);
            inputs.colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
          }
        }
      }
      updatedImageElementColorMaps.set(el, newColorMap);
    }
  } else {
    for (const el of svgImageElements) {
      const original = colors.get(el.id);
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
  if (modified.lightness === 0) modified = modified.lightnessTo(minLigtness);
  if (modified.lightness === 100) modified = modified.lightnessTo(maxLightness);
  if (modified.saturation === 0) modified = modified.saturationTo(minSaturation);

  switch(action) {
    case "Lightness":
      // handles edge cases where lightness is 0 or 100 would convert saturation and hue to 0
      let lightness = cm.lightness;
      const shouldRoundLight = (lightness === minLigtness || lightness === maxLightness);
      if (shouldRoundLight) lightness = Math.round(lightness);
      lightness += isDecrease ? -step : step;
      if (lightness <= 0) lightness = minLigtness;
      if (lightness >= 100) lightness = maxLightness;
      modified = modified.lightnessTo(lightness);
      break;
    case "Hue":
      modified = isDecrease ? modified.hueBy(-step) : modified.hueBy(step);
      break;
    case "Transparency":
      modified = isDecrease ? modified.alphaBy(-step) : modified.alphaBy(step);
      break;
    default:
      let saturation = cm.saturation;
      const shouldRoundSat = saturation === minSaturation;
      if (shouldRoundSat) saturation = Math.round(saturation);
      saturation += isDecrease ? -step : step;
      if (saturation <= 0) saturation = minSaturation;
      modified = modified.saturationTo(saturation);
  }

  const hasAlpha = modified.alpha < 1;
  const opts = { alpha: hasAlpha, precision };
  
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
          run(action, isDecrease, step);
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
    const { contentEl, modalEl } = modal;
    const { width, height } = ea.getExcalidrawAPI().getAppState();
    modal.bgOpacity = 0;
    contentEl.createEl('h2', { text: 'Shade Master' });
    
    const helpDiv = contentEl.createEl("details", {
      attr: { style: "margin-bottom: 1em;background: var(--background-secondary); padding: 1em; border-radius: 4px;" }});
    helpDiv.createEl("summary", { text: "Help & Usage Guide", attr: { style: "cursor: pointer; color: var(--text-accent);" } });
    const helpDetailsDiv = helpDiv.createEl("div", {
      attr: { style: "margin-top: 0em; " }
    });
    helpDetailsDiv.innerHTML = HELP_TEXT;

    const component = new ea.obsidian.Setting(contentEl)
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
          run();
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

    // lightness and saturation are on a scale of 0%-100%
    // Hue is in degrees, 360 for the full circle
    // transparency is on a range between 0 and 1 (equivalent to 0%-100%)
    // The range for lightness, saturation and transparency are double since
    // the input could be at either end of the scale
    // The range for Hue is 360 since regarless of the position on the circle moving
    // the slider to the two extremes will travel the entire circle
    // To modify blacks and whites, lightness first needs to be changed to value between 1% and 99%
    sliderResetters.push(slider(contentEl, "Hue", 0, 360, 1, false));
    sliderResetters.push(slider(contentEl, "Saturation", 0, 200, 1, false));
    sliderResetters.push(slider(contentEl, "Lightness", 0, 200, 1, false));
    sliderResetters.push(slider(contentEl, "Transparency", 0, 2, 0.05, true));

    // Add color pickers if a single SVG image is selected
    if (svgImageElements.length === 1) {
      const svgElement = svgImageElements[0];
      //note that the objects in currentColors might get replaced when
      //colors are reset, thus in the onChange functions I will always
      //read currentColorInfo from currentColors based on svgElement.id
      const initialColorInfo = currentColors.get(svgElement.id).colors;
      const colorSection = contentEl.createDiv();
      colorSection.createEl('h3', { text: 'SVG Colors' });
      
      for (const [color, info] of initialColorInfo.entries()) {
        const row = new ea.obsidian.Setting(colorSection)
          .setName(color === "fill" ? "SVG default" : color)
          .setDesc(`${info.fill ? "Fill" : ""}${info.fill && info.stroke ? " & " : ""}${info.stroke ? "Stroke" : ""}`);
        row.descEl.style.width = "100px";
        row.nameEl.style.width = "100px";

        // Create color preview div
        const previewDiv = row.controlEl.createDiv();
        previewDiv.style.width = "50px";
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
            .setButtonText(">>")
            .setClass("reset-color-button")
            .onClick(async () => {
              const original = originalColors.get(svgElement.id);
              const current = currentColors.get(svgElement.id);
              if (original?.type === "svg") {
                const originalInfo = original.colors.get(color);
                const currentInfo = current.colors.get(color);
                if (originalInfo) {
                  currentInfo.mappedTo = color;
                  run("reset single color");
                }
              }
            }))
          resetButton.settingEl.style.padding = "0";
          resetButton.settingEl.style.border = "0";

        // Add text input for color value
        const textInput = new ea.obsidian.TextComponent(row.controlEl)
          .setValue(info.mappedTo)
          .setPlaceholder("Color value");
        textInput.inputEl.style.width = "100%";
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
                    ? cm.stringRGB({alpha , precision }).toLowerCase()
                    : format === "HEX" 
                      ? cm.stringHEX({alpha}).toLowerCase()
                      : cm.stringHSL({alpha, precision }).toLowerCase();

                  textInput.setValue(newColor);
                  const currentInfo = currentColors.get(svgElement.id).colors;
                  currentInfo.get(color).mappedTo = newColor;
                  run("Update SVG color");
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

        colorPicker.colorPickerEl.style.maxWidth = "2.5rem";
  
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
              const currentInfo = currentColors.get(svgElement.id).colors.get(color);
              // Preserve alpha from original color
              const originalAlpha = ea.getCM(currentInfo.mappedTo).alpha;
              const cm = ea.getCM(value);
              cm.alphaTo(originalAlpha);
              const alpha = originalAlpha < 1 ? true : false;
              const format = settings[FORMAT].value;
              const newColor = format === "RGB" 
                ? cm.stringRGB({alpha, precision }).toLowerCase()
                : format === "HEX" 
                  ? cm.stringHEX({alpha}).toLowerCase()
                  : cm.stringHSL({alpha, precision }).toLowerCase();
              
              // Update text input
              textInput.setValue(newColor);
              
              // Update SVG
              currentInfo.mappedTo = newColor;
              run("Update SVG color");
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
          for (const resetter of sliderResetters) {
            resetter();
          }
          copyOriginalsToCurrent();
          setColors(originalColors);
        }))
      .addButton(button => button
        .setButtonText("Close")
        .setCta(true)
        .onClick(() => modal.close()));

    makeModalDraggable(modalEl);
    
    const maxHeight = Math.round(height * 0.6);
    const maxWidth = Math.round(width * 0.9);
    modalEl.style.maxHeight = `${maxHeight}px`;
    modalEl.style.maxWidth = `${maxWidth}px`;
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

function executeChange(isDecrease, step, action) {
  const modifyStroke = settings[STROKE].value;
  const modifyBackground = settings[BACKGROUND].value;
  const regularElements = getRegularElements();

  // Process regular elements
  if (regularElements.length > 0) {
    for (const el of regularElements) {
      const currentColor = currentColors.get(el.id);

      if (modifyStroke && currentColor.strokeColor) {
        currentColor.strokeColor = modifyColor(el.strokeColor, isDecrease, step, action);
      }
      
      if (modifyBackground && currentColor.backgroundColor) {
        currentColor.backgroundColor = modifyColor(el.backgroundColor, isDecrease, step, action);
      }
    }
  }
  
  // Process SVG image elements
  if (svgImageElements.length === 1) { // Only update UI for single SVG
    const el = svgImageElements[0];
    colorInfo = currentColors.get(el.id).colors;

    // Process each color in the SVG
    for (const [color, info] of colorInfo.entries()) {
      let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
      
      if (shouldModify) {
        const modifiedColor = modifyColor(info.mappedTo, isDecrease, step, action);
        colorInfo.get(color).mappedTo = modifiedColor;
        // Update UI components if they exist
        const inputs = colorInputs.get(color);
        if (inputs) {
          const cm = ea.getCM(modifiedColor);
          inputs.textInput.setValue(modifiedColor);
          inputs.colorPicker.setValue(cm.stringHEX({alpha: false}).toLowerCase());
        }
      }
    }
  } else {
    if (svgImageElements.length > 0) {
      for (const el of svgImageElements) {
        const colorInfo = currentColors.get(el.id).colors;
    
        // Process each color in the SVG
        for (const [color, info] of colorInfo.entries()) {
          let shouldModify = (modifyBackground && info.fill) || (modifyStroke && info.stroke);
          
          if (shouldModify) {
            const modifiedColor = modifyColor(info.mappedTo, isDecrease, step, action);
            colorInfo.get(color).mappedTo = modifiedColor;
          }
        }
      }
    }
  }
}

let isRunning = false;
let queue = false;
function processQueue() {
  if (!terminate && !isRunning && queue) {
    queue = false;
    isRunning = true;
    setColors(currentColors).then(() => {
      isRunning = false;
      if (queue) processQueue();
    });
  }
}

function run(action="Hue", isDecrease=true, step=0) {
  // passing invalid action (such as "clear") will bypass rewriting of colors using CM
  // this is useful when resetting colors to original values
  if(ACTIONS.includes(action)) { 
    executeChange(isDecrease, step, action);
  }
  queue = true;
  if (!isRunning) processQueue();
}

await storeOriginalColors();
showModal();
processQueue();