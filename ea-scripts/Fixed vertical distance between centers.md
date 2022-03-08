/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-vertical-distance-between-centers.png)

This script arranges the selected elements vertically with a fixed center spacing.

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
		description: "Fixed vertical distance between centers"
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

const groups = topGroups.sort((lha,rha) => lha[0].y - rha[0].y);

for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const preGroup = groups[i-1];
        const curGroup = groups[i];

        const preTop = Math.min(...preGroup.map(el => el.y));
        const preBottom = Math.max(...preGroup.map(el => el.y + el.height));
        const preCenter = preTop + (preBottom - preTop) / 2;
        const curTop = Math.min(...curGroup.map(el => el.y));
        const curBottom = Math.max(...curGroup.map(el => el.y + el.height));
        const curCenter = curTop + (curBottom - curTop) / 2;
        const distanceBetweenCenters = curCenter - preCenter - distance;

        for(const curEl of curGroup) {
            curEl.y = curEl.y - distanceBetweenCenters;
        }
    }
}

ea.copyViewElementsToEAforEditing(elements);
await ea.addElementsToView(false, false);