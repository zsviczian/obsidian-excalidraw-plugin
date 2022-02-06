# [◀ Excalidraw Automate How To](./readme.md)

[![Script Engine](https://user-images.githubusercontent.com/14358394/145684531-8d9c2992-59ac-4ebc-804a-4cce1777ded2.jpg)](https://youtu.be/hePJcObHIso)

## Introduction
Place your ExcalidrawAutomate Scripts into the folder defined in Excalidraw Settings. The Scripts folder may not be the root folder of your Vault.

![image](https://user-images.githubusercontent.com/14358394/145673547-b4f57d01-3643-40f9-abfd-14c3bfa5ab93.png)

EA scripts may be markdown files, plain text files, or .js files. The only requirement is that they must contain valid JavaScript code. 

![image](https://user-images.githubusercontent.com/14358394/145673674-bb59f227-8eea-43dc-83b8-4d750e1920a8.png)

You will be able to access your scripts from Excalidraw via the Obsidian Command Palette. 

![image](https://user-images.githubusercontent.com/14358394/145673652-6b1713e2-edc8-4bc8-8246-3f8df8a4b273.png)

This will allow you to assign hotkeys to your favorite scripts just like to any other Obsidian command. 

![image](https://user-images.githubusercontent.com/14358394/145673633-83b6c969-cead-429b-9721-fd047f980279.png)

## Script development
An Excalidraw script will automatically receive two objects:
- `ea`: The Script Enginge will initialize the `ea` object including setting the active view to the View from which the script was called.
- `utils`: I have borrowed functions exposed on utils from [QuickAdd](https://github.com/chhoumann/quickadd/blob/master/docs/QuickAddAPI.md), though currently not all QuickAdd utility functions are implemented in Excalidraw. As of now, these are the available functions. See the example below for details.
  - `inputPrompt: (header: string, placeholder?: string, value?: string, buttons?: [{caption:string, action:Function}])`
    - Opens a prompt that asks for an input. Returns a string with the input.
    - You need to await the result of inputPrompt.
    - `buttons.action(input: string) => string`. The button action will receive the current input string. If action returns null, the input will be unchanged. If action returns a string, the inputPrompt will resolve to this value.
```typescript
let fileType = "";
const filename = await utils.inputPrompt (
  "Filename for new document",
  "Placeholder",
  "DefaultFilename.md",
  [
    {
      caption: "Markdown",
      action: ()=>{fileType="md";return;}
		},
    {
      caption: "Excalidraw",
      action: ()=>{fileType="ex";return;}
    }
  ]
);

```
  - `suggester: (displayItems: string[], items: any[], hint?: string, instructions?:Instruction[])`
    - Opens a suggester. Displays the displayItems and returns the corresponding item from items[].
    - You need to await the result of suggester.
    - If the user cancels (ESC), suggester will return `undefined`
    - Hint and instructions are optional.
    ```typescript
      interface Instruction {
        command: string;
        purpose: string;
      }
    ```
  - Scripts may have settings. These settings are stored as part of plugin settings and may be also changed by the user via the Obsidian plugin settings window.
    - You can access settings for the active script using `ea.getScriptSettings()` and store settings values with `ea.setScriptSettings(settings:any)`
    - Rules for displaying script settings in plugin settings are:
      - If the setting is a simple literal (boolean, number, string) these will be displayed as such in settings. The name of the setting will be the key for the value.
    ```javascript
    ea.setScriptSettings({ 
      "value 1": true, 
      "value 2": 1,
      "value 3": "my string"
    })
    ```
    ![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/SimpleSettings.jpg)
      - If the setting is an object and follows the below structure then a description and a valueset may also be added. Values may also be hidden from the user using the `hidden` key.
      ```javascript
      ea.setScriptSettings({
        "value 1": {
          "value": true,
          "description": "This is the description for my boolean value"
        },
        "value 2": {
          "value": 1,
          "description": "This is the description for my numeric value"
        },
        "value 3": {
          "value": "my string",
          "description": "This is the description for my string value",
          "valueset": ["allowed 1","allowed 2","allowed 3"]
        },
        "value 4": {
          "value": "my value",
          "hidden": true
        }        
      });
      ```
      ![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/ComplexSettings.jpg)

---------

## Example Excalidraw Automate Scripts

These scripts are available as downloadable `.md` files on GitHub in [this](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/ea-scripts) folder 📂.

### Add box around selected elements

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-box-elements.jpg)

This script will add an encapsulating box around the currently selected elements in Excalidraw
```javascript
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//check if settings exist. If not, set default values on first run
if(!settings["Default padding"]) {
	settings = {
		"Prompt for padding?": true,
	  "Default padding" : {
			value: 10,
		  description: "Padding between the bounding box of the selected elements, and the box the script creates"
		}
	};
	ea.setScriptSettings(settings);
}

let padding = settings["Default padding"].value;

if(settings["Prompt for padding?"]) {
	padding = parseInt (await utils.inputPrompt("padding?","number",padding.toString()));
}

if(isNaN(padding)) {
  new Notice("The padding value provided is not a number");
  return;
}
elements = ea.getViewSelectedElements();
const box = ea.getBoundingBox(elements);
color = ea
        .getExcalidrawAPI()
        .getAppState()
        .currentItemStrokeColor;
//uncomment for random color:
//color = '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,"0");
ea.style.strokeColor = color;
id = ea.addRect(
	box.topX - padding,
	box.topY - padding,
	box.width + 2*padding,
	box.height + 2*padding
);
ea.copyViewElementsToEAforEditing(elements);
ea.addToGroup([id].concat(elements.map((el)=>el.id)));
ea.addElementsToView(false);
```

----

### Connect selected elements with an arrow

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-connect-elements.jpg)

This script will connect two objects with an arrow. If either of the objects are a set of grouped elements (e.g. a text element grouped with an encapsulating rectangle), the script will identify these groups, and connect the arrow to the largest object in the group (assuming you want to connect the arrow to the box around the text element).
```javascript
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Starting arrowhead"]) {
	settings = {
	  "Starting arrowhead" : {
			value: "none",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Ending arrowhead" : {
			value: "triangle",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Line points" : {
			value: 1,
      description: "Number of line points between start and end"
		}
	};
	ea.setScriptSettings(settings);
}

const arrowStart = settings["Starting arrowhead"].value === "none" ? null : settings["Starting arrowhead"].value;
const arrowEnd = settings["Ending arrowhead"].value === "none" ? null : settings["Ending arrowhead"].value;
const linePoints = Math.floor(settings["Line points"].value);

const elements = ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
groups = ea.getMaximumGroups(elements);

if(groups.length !== 2) {
  //unfortunately getMaxGroups returns duplicated resultset for sticky notes
  //needs additional filtering
  cleanGroups=[];
  idList = [];
  for (group of groups) {
    keep = true;
    for(item of group) if(idList.contains(item.id)) keep = false;
    if(keep) {
      cleanGroups.push(group);
      idList = idList.concat(group.map(el=>el.id))
    }
  }
  if(cleanGroups.length !== 2) return;
  groups = cleanGroups;
}

els = [ 
  ea.getLargestElement(groups[0]),
  ea.getLargestElement(groups[1])
];

ea.style.strokeColor = els[0].strokeColor;
ea.style.strokeWidth = els[0].strokeWidth;
ea.style.strokeStyle = els[0].strokeStyle;
ea.style.strokeSharpness = els[0].strokeSharpness;

ea.connectObjects(
  els[0].id,
  null,
  els[1].id,
  null, 
  {
	endArrowHead: arrowEnd,
	startArrowHead: arrowStart, 
	numberOfPoints: linePoints
  }
);
ea.addElementsToView();
```

----
### Reverse selected arrows

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-reverse-arrow.jpg)

Reverse the direction of **arrows** within the scope of selected elements.

```javascript
elements = ea.getViewSelectedElements().filter((el)=>el.type==="arrow");
if(!elements || elements.length===0) return;
elements.forEach((el)=>{
	const start = el.startArrowhead;
	el.startArrowhead = el.endArrowhead;
	el.endArrowhead = start;
});
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();
```

----

### Set line width of selected elements

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-stroke-width.jpg)

This is helpful, for example, when you scale freedraw sketches and want to reduce or increase their line width.
```javascript
let width = (ea.getViewSelectedElement().strokeWidth??1).toString();
width = await utils.inputPrompt("Width?","number",width);
const elements=ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
ea.getElements().forEach((el)=>el.strokeWidth=width);
ea.addElementsToView();
```

----

### Set grid size

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid.jpg)

The default grid size in Excalidraw is 20. Currently there is no way to change the grid size via the user interface. 
```javascript
const grid = parseInt(await utils.inputPrompt("Grid size?",null,"20"));
const api = ea.getExcalidrawAPI();
let appState = api.getAppState();
appState.gridSize = grid;
api.updateScene({
  appState,
  commitToHistory:false
});
```

----

### Set element dimensions and position

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dimensions.jpg)

Currently there is no way to specify the exact location and size of objects in Excalidraw. You can bridge this gap with the following simple script.
```javascript
const elements = ea.getViewSelectedElements();
if(elements.length === 0) return;
const el = ea.getLargestElement(elements);
const sizeIn = [el.x,el.y,el.width,el.height].join(",");
let res = await utils.inputPrompt("x,y,width,height?",null,sizeIn);
res = res.split(",");
if(res.length !== 4) return;
let size = [];
for (v of res) {
  const i = parseInt(v);
  if(isNaN(i)) return;
  size.push(i);
}
el.x = size[0];
el.y = size[1];
el.width = size[2];
el.height = size[3];
ea.copyViewElementsToEAforEditing([el]);
ea.addElementsToView();
```

----

### Bullet points

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-bullet-point.jpg)

This script will add a small circle to the top left of each text element in the selection and add the text and the "bullet point" into a group.
```javascript
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
ea.copyViewElementsToEAforEditing(elements);
const padding = 10;
elements.forEach((el)=>{
  ea.style.strokeColor = el.strokeColor;
  const size = el.fontSize/2;
  const ellipseId = ea.addEllipse(
    el.x-padding-size,
    el.y+size/2,
    size,
    size
  );
  ea.addToGroup([el.id,ellipseId]);
});
ea.addElementsToView();
```

----

### Split text by lines
**!!!Requires Excalidraw 1.5.1 or higher**

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-split-lines.jpg)

Split lines of text into separate text elements for easier reorganization
```javascript
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
elements.forEach((el)=>{
  ea.style.strokeColor = el.strokeColor;
  ea.style.fontFamily  = el.fontFamily;
  ea.style.fontSize    = el.fontSize;
  const text = el.text.split("\n");
  for(i=0;i<text.length;i++) {
	ea.addText(el.x,el.y+i*el.height/text.length,text[i]);
  }
});
ea.addElementsToView();
ea.deleteViewElements(elements);
```

----

### Set Text Alignment

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-align.jpg)

Sets text alignment of text block (cetner, right, left). Useful if you want to set a keyboard shortcut for selecting text alignment.
```javascript
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
if(elements.length===0) return;
let align = ["left","right","center"];
align = await utils.suggester(align,align);
elements.forEach((el)=>el.textAlign = align);
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();
```

----

### Set Font Family

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-font-family.jpg)

Sets font family of the text block (Virgil, Helvetica, Cascadia). Useful if you want to set a keyboard shortcut for selecting font family.
```javascript
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
if(elements.length===0) return;
let font = ["Virgil","Helvetica","Cascadia"];
font = parseInt(await utils.suggester(font,["1","2","3"]));
if (isNaN(font)) return;
elements.forEach((el)=>el.fontFamily = font);
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();
```
