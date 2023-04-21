/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-scribble-helper.jpg)

iOS scribble helper for better handwriting experience with text elements. If no elements are selected then the script creates a text element at the pointer position and you can use the edit box to modify the text with scribble. If a text element is selected then the script opens the input prompt where you can modify this text with scribble.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.24")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

//const helpLINK = "https://youtu.be/MIZ5hv-pSSs";
const DBLCLICKTIMEOUT = 300;
const maxWidth = 600;
const padding = 6;
const api = ea.getExcalidrawAPI();
const win = ea.targetView.ownerWindow;
if(!win.ExcalidrawScribbleHelper) win.ExcalidrawScribbleHelper = {};
if(typeof win.ExcalidrawScribbleHelper.penOnly === "undefined") {
  win.ExcalidrawScribbleHelper.penOnly = false;
}
let windowOpen = false; //to prevent the modal window to open again while writing with scribble
let prevZoomValue = api.getAppState().zoom.value; //used to avoid trigger on pinch zoom

// -------------
// Load settings
// -------------
const settings = ea.getScriptSettings();
//set default values on first-ever run of the script
if(typeof win.ExcalidrawScribbleHelper.action === "undefined") {
  if(!settings["Default action"]) {
	settings = {
	  "Default action" : {
	    value: "Text",
	    valueset: ["Text","Sticky","Wrap"],
	    description: "What type of element should CTRL/CMD+ENTER create. TEXT: A regular text element. " +
	      "STICKY: A sticky note with border color and background color " +
	      "(using the current setting of the canvas). STICKY: A sticky note with transparent " +
	      "border and background color."
	  },
	};
	await ea.setScriptSettings(settings);
  }
  win.ExcalidrawScribbleHelper.action = settings["Default action"].value;
}

//---------------------------------------
// Color Palette for stroke color setting
//---------------------------------------
// https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.8
const defaultStrokeColors = [
    "#000000", "#343a40", "#495057", "#c92a2a", "#a61e4d",
    "#862e9c", "#5f3dc4", "#364fc7", "#1864ab", "#0b7285",
    "#087f5b", "#2b8a3e", "#5c940d", "#e67700", "#d9480f"
  ];

const loadColorPalette = () => {
  const st = api.getAppState();
  const strokeColors = new Set();
  let strokeColorPalette = st.colorPalette?.elementStroke ?? defaultStrokeColors;
  if(Object.entries(strokeColorPalette).length === 0) {
    strokeColorPalette = defaultStrokeColors;
  }

  ea.getViewElements().forEach(el => {
    if(el.strokeColor.toLowerCase()==="transparent") return;
    strokeColors.add(el.strokeColor);
  });

  strokeColorPalette.forEach(color => {
    strokeColors.add(color)
  });

  strokeColors.add(st.currentItemStrokeColor ?? ea.style.strokeColor);
  return strokeColors;
}

//----------------------------------------------------------
// Define variables to cache element location on first click
//----------------------------------------------------------
// if a single element is selected when the action is started, update that existing text
let containerElements = ea.getViewSelectedElements()
  .filter(el=>["arrow","rectangle","ellipse","line","diamond"].contains(el.type));
let selectedTextElements = ea.getViewSelectedElements().filter(el=>el.type==="text");

let textLocationCache = {};
//Address text jumping on mobile when keyboard is popping up
//This should really be solved in the core product, but that is not yet happening
const cacheTextElCoords = () => {
  if(selectedTextElements.length === 1) {
    textLocationCache.x = selectedTextElements[0].x;
    textLocationCache.y = selectedTextElements[0].y;
    return;
  }
  delete textLocationCache.x;
  delete textLocationCache.y;
}
const isLocationCacheValid = () => !(typeof textLocationCache.x === "undefined");
cacheTextElCoords();

//-------------------------------------------
// Functions to add and remove event listners
//-------------------------------------------
const addEventHandler = (handler) => {
  if(win.ExcalidrawScribbleHelper.eventHandler) {
    win.removeEventListner("pointerdown", handler);
  }
  win.addEventListener("pointerdown",handler);
  win.ExcalidrawScribbleHelper.eventHandler = handler;
  win.ExcalidrawScribbleHelper.window = win;
}

const removeEventHandler = (handler) => {
  win.removeEventListener("pointerdown",handler);
  delete win.ExcalidrawScribbleHelper.eventHandler;
  delete win.ExcalidrawScribbleHelper.window;
}

//Stop the script if scribble helper is clicked and no eligable element is selected
let silent = false;
if (win.ExcalidrawScribbleHelper?.eventHandler) {
  removeEventHandler(win.ExcalidrawScribbleHelper.eventHandler);
  delete win.ExcalidrawScribbleHelper.eventHandler;
  delete win.ExcalidrawScribbleHelper.window;
  if(!(containerElements.length === 1 || selectedTextElements.length === 1)) {
    new Notice ("Scribble Helper was stopped");
    return;
  }
  silent = true;
}

// ----------------------
// Custom dialog controls
// ----------------------
if (typeof win.ExcalidrawScribbleHelper.penOnly === "undefined") {
  win.ExcalidrawScribbleHelper.penOnly = undefined;
}
if (typeof win.ExcalidrawScribbleHelper.penDetected === "undefined") {
  win.ExcalidrawScribbleHelper.penDetected = false;
}
let timer = Date.now();
let eventHandler = () => {};

const customControls =  (container) => {
  //const helpDIV = container.createDiv();
  //helpDIV.innerHTML = `<a href="${helpLINK}" target="_blank">Click here for help</a>`;
  const viewBackground = api.getAppState().viewBackgroundColor;
  const el1 = new ea.obsidian.Setting(container)
    .setName(`Text color`)
    .addDropdown(dropdown => {
      Array.from(loadColorPalette()).forEach(color => {
        const options = dropdown.addOption(color, color).selectEl.options;
        options[options.length-1].setAttribute("style",`color: ${color
          }; background: ${viewBackground};`);
      });
      dropdown
        .setValue(ea.style.strokeColor)
        .onChange(value => {
          ea.style.strokeColor = value;
          el1.nameEl.style.color = value;
        })
    })
  el1.nameEl.style.color = ea.style.strokeColor;
  el1.nameEl.style.background = viewBackground;
  el1.nameEl.style.fontWeight = "bold";
								 
  const el2 = new ea.obsidian.Setting(container)
    .setName(`Trigger editor by pen double tap only`)
    .addToggle((toggle) => toggle
      .setValue(win.ExcalidrawScribbleHelper.penOnly)
      .onChange(value => {
        win.ExcalidrawScribbleHelper.penOnly = value;
      })
    )
  el2.settingEl.style.border = "none";
  el2.settingEl.style.display = win.ExcalidrawScribbleHelper.penDetected ? "" : "none";
}

// -------------------------------
// Click / dbl click event handler
// -------------------------------
eventHandler = async (evt) => {
  if(windowOpen) return;
  if(ea.targetView !== app.workspace.activeLeaf.view) removeEventHandler(eventHandler);
  if(evt && (evt.ctrlKey || evt.altKey || evt.metaKey || evt.shiftKey)) return;
  const st = api.getAppState();
  win.ExcalidrawScribbleHelper.penDetected = st.penDetected;

  if(st.editingElement) return; //don't trigger text editor when editing a line or arrow
  
  if(typeof win.ExcalidrawScribbleHelper.penOnly === "undefined") {
    win.ExcalidrawScribbleHelper.penOnly = false;
  }
  
  if (evt && win.ExcalidrawScribbleHelper.penOnly &&
    win.ExcalidrawScribbleHelper.penDetected && evt.pointerType !== "pen") return;
  const now = Date.now();
  
  //the <50 condition is to avoid false double click when pinch zooming
  if((now-timer > DBLCLICKTIMEOUT) || (now-timer < 50)) {
    prevZoomValue = st.zoom.value;
    timer = now;
    containerElements = ea.getViewSelectedElements()
      .filter(el=>["arrow","rectangle","ellipse","line","diamond"].contains(el.type));
    selectedTextElements = ea.getViewSelectedElements().filter(el=>el.type==="text");
	  return;
  }
  //further safeguard against triggering when pinch zooming
  if(st.zoom.value !== prevZoomValue) return;
  
  //sleeping to allow keyboard to pop up on mobile devices
  await sleep(200);
  ea.clear();

  //if a single element with text is selected, edit the text
  //(this can be an arrow, a sticky note, or just a text element)
  if(selectedTextElements.length === 1) {
    editExistingTextElement(selectedTextElements);
    return;
  }
  
  let containerID;
  let container;
  //if no text elements are selected (i.e. not multiple text  elements selected),
  //check if there is a single eligeable container selected
  if(selectedTextElements.length === 0) {
    if(containerElements.length === 1) {
      ea.copyViewElementsToEAforEditing(containerElements);
      containerID = containerElements[0].id
      container = ea.getElement(containerID);
    }
  }
  
  const {x,y} = ea.targetView.currentPosition;

  if(ea.targetView !== app.workspace.activeLeaf.view) return;
  const actionButtons = [
    {
      caption: `A`,
      tooltip: "Add as Text Element",
      action: () => {
        win.ExcalidrawScribbleHelper.action="Text";
        if(settings["Default action"].value!=="Text") {
          settings["Default action"].value = "Text";
          ea.setScriptSettings(settings);
        };
        return;
      }
    },
    {
      caption: "📝",
      tooltip: "Add as Sticky Note (rectangle with border color and background color)",
      action: () => {
        win.ExcalidrawScribbleHelper.action="Sticky";
        if(settings["Default action"].value!=="Sticky") {
          settings["Default action"].value = "Sticky";
          ea.setScriptSettings(settings);
        };
        return;
      }
    },
    {
      caption: "☱",
      tooltip: "Add as Wrapped Text (rectangle with transparent border and background)",
      action: () => {
        win.ExcalidrawScribbleHelper.action="Wrap";
        if(settings["Default action"].value!=="Wrap") {
          settings["Default action"].value = "Wrap";
          ea.setScriptSettings(settings);
        };
        return;
      }
    }
  ];
  if(win.ExcalidrawScribbleHelper.action !== "Text") actionButtons.push(actionButtons.shift());
  if(win.ExcalidrawScribbleHelper.action === "Wrap") actionButtons.push(actionButtons.shift());

  ea.style.strokeColor = st.currentItemStrokeColor ?? ea.style.strokeColor;
  ea.style.backgroundColor = st.currentItemBackgroundColor ?? ea.style.backgroundColor;
  ea.style.fillStyle = st.currentItemFillStyle ?? ea.style.fillStyle;
  ea.style.fontFamily = st.currentItemFontFamily ?? ea.style.fontFamily;
  ea.style.fontSize = st.currentItemFontSize ?? ea.style.fontSize;
  ea.style.textAlign = (container && ["arrow","line"].contains(container.type))
    ? "center"
    : st.currentItemTextAlign ?? ea.style.textAlign;
  ea.style.verticalAlign = (container && ["arrow","line"].contains(container.type))
    ? "middle"
    : ea.style.verticalAlign;

  windowOpen = true;
  const text = await utils.inputPrompt (
    "Edit text", "", "", containerID?undefined:actionButtons, 5, true, customControls
  );
  windowOpen = false;

  if(!text || text.trim() === "") return;

  const textId = ea.addText(x,y, text);
  if (!container && (win.ExcalidrawScribbleHelper.action === "Text")) {
    ea.addElementsToView(false, false, true);
    addEventHandler(eventHandler);
    return;
  }
  const textEl = ea.getElement(textId);

  if(!container && (win.ExcalidrawScribbleHelper.action === "Wrap")) {
    ea.style.backgroundColor = "transparent";
    ea.style.strokeColor = "transparent";
  }

  const boxes = [];
  if(container) {
    boxes.push(containerID);
    const linearElement = ["arrow","line"].contains(container.type);
    const l = linearElement ? container.points.length-1 : 0;
    const dx = linearElement && (container.points[l][0] < 0) ? -1 : 1;
    const dy = linearElement && (container.points[l][1] < 0) ? -1 : 1;
    cx = container.x + dx*container.width/2;
    cy = container.y + dy*container.height/2;
    textEl.x = cx - textEl.width/2;
    textEl.y = cy - textEl.height/2;
  }

  if(!container) {
    const width = textEl.width+2*padding;
    const widthOK = width<=maxWidth;
    containerID = ea.addRect(
      textEl.x-padding,
      textEl.y-padding,
      widthOK ? width : maxWidth,
      textEl.height + 2 * padding
    );
    container = ea.getElement(containerID);
  } 
  boxes.push(containerID);
  container.boundElements=[{type:"text",id: textId}];
  textEl.containerId = containerID;

  await ea.addElementsToView(false,false,true);
  const containers = ea.getViewElements().filter(el=>boxes.includes(el.id));
  if(["rectangle","diamond","ellipse"].includes(container.type)) api.updateContainerSize(containers);
  ea.selectElementsInView(containers);
};

// ---------------------
// Edit Existing Element
// ---------------------
const editExistingTextElement = async (elements) => {
  windowOpen = true;
  ea.copyViewElementsToEAforEditing(elements);
  const el = ea.getElements()[0];
  //this is a hack to address jumping text
  if(isLocationCacheValid()) {
    el.x = textLocationCache.x;
    el.y = textLocationCache.y;
  }
  ea.style.strokeColor = el.strokeColor;
  const text = await utils.inputPrompt(
    "Edit text","",elements[0].rawText,undefined,5,true,customControls
  ); 
  windowOpen = false;
  if(!text) return;
  
  el.strokeColor = ea.style.strokeColor;
  el.originalText = text;
  el.text = text;
  el.rawText = text;
  ea.refreshTextElementSize(el.id);
  await ea.addElementsToView(false,false);
  if(el.containerId) {
    const containers = ea.getViewElements().filter(e=>e.id === el.containerId);
    api.updateContainerSize(containers);
    ea.selectElementsInView(containers);
  }
}

//--------------
// Start actions
//--------------
if(!win.ExcalidrawScribbleHelper?.eventHandler) {
  if(!silent) new Notice(
    "Double click the screen to create a new text element, " +
    "or double click an element to add or edit text\nClick the script again or move to " +
    "another Obsidian-tab to stop the script"
  );
  addEventHandler(eventHandler);
}

if(containerElements.length === 1 || selectedTextElements.length === 1) {
  timer = timer - 100;
  eventHandler();
}