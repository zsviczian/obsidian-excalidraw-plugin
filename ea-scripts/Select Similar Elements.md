/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-select-similar-elements.png)

This script enables the selection of elements based on matching properties. Select the attributes (such as stroke color, fill style, font family, etc) that should match for selection. It's perfect for large scenes where manual selection of elements would be cumbersome. You can either run the script to select matching elements across the entire scene, or define a specific group of elements to apply the selection criteria to. 

```js */

let config = window.ExcalidrawSelectConfig;
config = Boolean(config) && (Date.now() - config.timestamp < 60000) ? config : null;

let elements = ea.getViewSelectedElements();
if(!config && (elements.length !==1)) {
  new Notice("Select a single element");
  return;
} else {
  if(elements.length === 0) {
    elements = ea.getViewElements();
  }
}

const {angle, backgroundColor, fillStyle, fontFamily, fontSize, height, width, opacity, roughness, roundness, strokeColor, strokeStyle, strokeWidth, type, startArrowhead, endArrowhead, fileId} = ea.getViewSelectedElement();

const fragWithHTML = (html) => createFragment((frag) => (frag.createDiv().innerHTML = html));
  
//--------------------------
// RUN
//--------------------------
const run = () => {
  selectedElements = elements.filter(el=>
    ((typeof config.angle === "undefined") || (el.angle === config.angle)) &&
    ((typeof config.backgroundColor === "undefined") || (el.backgroundColor === config.backgroundColor)) &&
    ((typeof config.fillStyle === "undefined") || (el.fillStyle === config.fillStyle)) &&
    ((typeof config.fontFamily === "undefined") || (el.fontFamily === config.fontFamily)) &&
    ((typeof config.fontSize === "undefined") || (el.fontSize === config.fontSize)) &&
	((typeof config.height === "undefined") || Math.abs(el.height - config.height) < 0.01) &&
	((typeof config.width === "undefined") || Math.abs(el.width - config.width) < 0.01) &&
    ((typeof config.opacity === "undefined") || (el.opacity === config.opacity)) &&
    ((typeof config.roughness === "undefined") || (el.roughness === config.roughness)) &&
    ((typeof config.roundness === "undefined") || (el.roundness === config.roundness)) &&
    ((typeof config.strokeColor === "undefined") || (el.strokeColor === config.strokeColor)) &&
    ((typeof config.strokeStyle === "undefined") || (el.strokeStyle === config.strokeStyle)) &&
    ((typeof config.strokeWidth === "undefined") || (el.strokeWidth === config.strokeWidth)) &&
    ((typeof config.type === "undefined") || (el.type === config.type)) &&
    ((typeof config.startArrowhead === "undefined") || (el.startArrowhead === config.startArrowhead)) &&
    ((typeof config.endArrowhead === "undefined") || (el.endArrowhead === config.endArrowhead)) &&
    ((typeof config.fileId === "undefined") || (el.fileId === config.fileId))
  )
  ea.selectElementsInView(selectedElements);
  delete window.ExcalidrawSelectConfig;
}

//--------------------------
// Modal
//--------------------------
const showInstructions = () => {
  const instructionsModal = new ea.obsidian.Modal(app);
  instructionsModal.onOpen = () => {
    instructionsModal.contentEl.createEl("h2", {text: "Instructions"});
	instructionsModal.contentEl.createEl("p", {text: "Step 1: Choose the attributes that you want the selected elements to match."});
	instructionsModal.contentEl.createEl("p", {text: "Step 2: Select an action:"});
	instructionsModal.contentEl.createEl("ul", {}, el => {
	  el.createEl("li", {text: "Click 'RUN' to find matching elements throughout the entire scene."});
	  el.createEl("li", {text: "Click 'SELECT' to 1) first choose a specific group of elements in the scene, then 2) run the 'Select Similar Elements' once more within 1 minute to apply the filter criteria only to that group of elements."});
	});
	instructionsModal.contentEl.createEl("p", {text: "Note: If you choose 'SELECT', make sure to click the 'Select Similar Elements' script again within 1 minute to apply your selection criteria to the group of elements you chose."});
  };
  instructionsModal.open();
};

const selectAttributesToCopy = () => {
  const configModal = new ea.obsidian.Modal(app);
  configModal.onOpen = () => {
    config = {};
	configModal.contentEl.createEl("h1", {text: "Select Similar Elements"});
    new ea.obsidian.Setting(configModal.contentEl)
      .setDesc("Choose the attributes you want the selected elements to match, then select an action.")
      .addButton(button => button
        .setButtonText("Instructions")
        .onClick(showInstructions)
      );

    
    // Add Toggles for the rest of the attributes
	let attributes = [
	  {name: "Element type", key: "type"},
	  {name: "Stroke color", key: "strokeColor"},
	  {name: "Background color", key: "backgroundColor"},
	  {name: "Opacity", key: "opacity"},
	  {name: "Fill style", key: "fillStyle"},
	  {name: "Stroke style", key: "strokeStyle"},
	  {name: "Stroke width", key: "strokeWidth"},
	  {name: "Roughness", key: "roughness"},
	  {name: "Roundness", key: "roundness"},           
	  {name: "Font family", key: "fontFamily"},
	  {name: "Font size", key: "fontSize"},
	  {name: "Start arrowhead", key: "startArrowhead"},
	  {name: "End arrowhead", key: "endArrowhead"},
	  {name: "Height", key: "height"},
	  {name: "Width", key: "width"},
	  {name: "ImageID", key: "fileId"},
	];
  
	attributes.forEach(attr => {
	  const attrValue = elements[0][attr.key];
	  if(attrValue || (attr.key === "startArrowhead" && elements[0].type === "arrow") || (attr.key === "endArrowhead" && elements[0].type === "arrow")) {
	    let description = '';
	
	    switch(attr.key) {
	      case 'backgroundColor':
	      case 'strokeColor':
	        description = `<div style='background-color:${attrValue};'>${attrValue}</div>`;
	        break;
	      case 'roundness':
	        description = attrValue === null ? 'Sharp' : 'Round';
	        break;
	      case 'roughness':
	        description = attrValue === 0 ? 'Architect' : attrValue === 1 ? 'Artist' : 'Cartoonist';
	        break;
	      case 'strokeWidth':
	        description = attrValue <= 0.5 ? 'Extra thin' : 
	                      attrValue <= 1 ? 'Thin' :
	                      attrValue <= 2 ? 'Bold' :
	                      'Extra bold';
	        break;
	      case 'opacity':
	        description = `${attrValue}%`;
	        break;
	      case 'width':
	      case 'height':
	        description = `${attrValue.toFixed(2)}`;
			break;
	      case 'startArrowhead':
	      case 'endArrowhead':
	        description = attrValue === null ? 'None' : `${attrValue.charAt(0).toUpperCase() + attrValue.slice(1)}`;
	        break;
	      case 'fontFamily':
	        description = attrValue === 1 ? 'Hand-drawn' :
	                      attrValue === 2 ? 'Normal' :
	                      attrValue === 3 ? 'Code' :
	                      'Custom 4th font';
	        break;
	      case 'fontSize':
	        description = `${attrValue}`;
	        break;
	      default:
	        console.log(attr.key);
	        console.log(attrValue);
	        description = `${attrValue.charAt(0).toUpperCase() + attrValue.slice(1)}`;
	        break;
	    }
	
	    new ea.obsidian.Setting(configModal.contentEl)
	      .setName(`${attr.name}`)
	      .setDesc(fragWithHTML(`${description}`))
	      .addToggle(toggle => toggle
	        .setValue(false)
	        .onChange(value => {
	          if(value) {
	            config[attr.key] = attrValue;
	          } else {
	            delete config[attr.key];
	          }
	        })
	      )
	  }
	});


	//Add Toggle for the rest of the attributes. Organize attributes into a logical sequence or groups by adding
	//configModal.contentEl.createEl("h") or similar to the code

    new ea.obsidian.Setting(configModal.contentEl)
      .addButton(button => button
        .setButtonText("SELECT")
        .onClick(()=>{
	      config.timestamp = Date.now();
	      window.ExcalidrawSelectConfig = config;
	      configModal.close();
        })
      ) 
	  .addButton(button => button
		.setButtonText("RUN")
		.setCta(true)
        .onClick(()=>{
          elements = ea.getViewElements();
          run();
          configModal.close();
        })
      )
	}

  
	configModal.onClose = () => {
      setTimeout(()=>delete configModal);
	}
	
	configModal.open();
}


if(config) {
  run();
} else {
  selectAttributesToCopy();
}