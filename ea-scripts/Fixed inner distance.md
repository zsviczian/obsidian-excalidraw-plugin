/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-inner-distance.png)

This script arranges selected elements and groups with a fixed inner distance.

Tips: You can use the `Box Selected Elements` and `Dimensions` scripts to create rectangles of the desired size, then use the `Change shape of selected elements` script to convert the rectangles to ellipses, and then use the `Fixed inner distance` script regains a desired inner distance.

Inspiration: #394

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Default distance"]) {
	settings = {
	  "Prompt for distance?": true,
	  "Default distance" : {
		value: 10,
		description: "Fixed horizontal distance between centers"
	  },
	  "Remember last distance?": false
	};
	ea.setScriptSettings(settings);
}

let distanceStr = settings["Default distance"].value.toString();
const rememberLastDistance = settings["Remember last distance?"];

if(settings["Prompt for distance?"]) {
    distanceStr = await utils.inputPrompt("distance?","number",distanceStr);
}

const borders = ["top", "bottom", "left", "right"];
const fromBorder = await utils.suggester(borders, borders, "from border?");

if(!fromBorder) {
  return;
}

const distance = parseInt(distanceStr);
if(isNaN(distance)) {
  return;
}
if(rememberLastDistance) {
	settings["Default distance"].value = distance;
	ea.setScriptSettings(settings);
}
const elements=ea.getViewSelectedElements();
const topGroups = ea.getMaximumGroups(elements)
    .filter(els => !(els.length === 1 && els[0].type ==="arrow")) // ignore individual arrows
    .filter(els => !(els.length === 1 && (els[0].containerId))); // ignore text in stickynote

if(topGroups.length <= 1) {
  new Notice("At least 2 or more elements or groups should be selected.");
  return;
}

if(fromBorder === 'top') {
  const groups = topGroups.sort((lha,rha) => Math.min(...lha.map(t => t.y)) - Math.min(...rha.map(t => t.y)));
  const firstGroupTop = Math.min(...groups[0].map(el => el.y));
  
  for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const curGroup = groups[i];
        const moveDistance = distance * i;
        for(const curEl of curGroup) {
          curEl.y = firstGroupTop + moveDistance;
        }
    }
  }   
}
else if(fromBorder === 'bottom') {
  const groups = topGroups.sort((lha,rha) => Math.min(...lha.map(t => t.y + t.height)) - Math.min(...rha.map(t => t.y + t.height))).reverse();
  const firstGroupBottom = Math.max(...groups[0].map(el => el.y + el.height));
  
  for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const curGroup = groups[i];
        const moveDistance = distance * i;
        for(const curEl of curGroup) {
           curEl.y = firstGroupBottom - moveDistance - curEl.height;
        }
    }
  }   
}
else if(fromBorder === 'left') {
  const groups = topGroups.sort((lha,rha) => Math.min(...lha.map(t => t.x)) - Math.min(...rha.map(t => t.x)));
  const firstGroupLeft = Math.min(...groups[0].map(el => el.x));
  
  for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const curGroup = groups[i];
        const moveDistance = distance * i;
        for(const curEl of curGroup) {
          curEl.x = firstGroupLeft + moveDistance;
        }
    }
  }   
}
else if(fromBorder === 'right') {
  const groups = topGroups.sort((lha,rha) => Math.min(...lha.map(t => t.x + t.width)) - Math.min(...rha.map(t => t.x + t.width))).reverse();
  const firstGroupRight = Math.max(...groups[0].map(el => el.x + el.width));
  
  for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const curGroup = groups[i];
        const moveDistance = distance * i;
        for(const curEl of curGroup) {
           curEl.x = firstGroupRight - moveDistance - curEl.width;
        }
    }
  }   
}

ea.copyViewElementsToEAforEditing(elements);
await ea.addElementsToView(false, false);
