/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-repeat-elements.png)

This script will detect the difference between 2 selected elements, including position, size, angle, stroke and background color, and create several elements that repeat these differences based on the number of repetitions entered by the user.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.7.19")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let repeatNum = parseInt(await utils.inputPrompt("repeat times?","number","5"));
if(!repeatNum) {
    new Notice("Please enter a number.");
    return;
}

const selectedElements = ea.getViewSelectedElements().sort((lha,rha) => 
    lha.x === rha.x? (lha.y === rha.y? 
    (lha.width === rha.width? 
    (lha.height - rha.height) : lha.width - rha.width) 
    : lha.y - rha.y) : lha.x - rha.x);

if(selectedElements.length !== 2) {
    new Notice("Please select 2 elements.");
    return;
}

if(selectedElements[0].type !== selectedElements[1].type) {
    new Notice("The selected elements must be of the same type.");
    return;
}

const xDistance = selectedElements[1].x - selectedElements[0].x;
const yDistance = selectedElements[1].y - selectedElements[0].y;
const widthDistance = selectedElements[1].width - selectedElements[0].width;
const heightDistance = selectedElements[1].height - selectedElements[0].height;
const angleDistance = selectedElements[1].angle - selectedElements[0].angle;

const bgColor1 = ea.colorNameToHex(selectedElements[0].backgroundColor);
const cmBgColor1 = ea.getCM(bgColor1);
const bgColor2 = ea.colorNameToHex(selectedElements[1].backgroundColor);
let   cmBgColor2 = ea.getCM(bgColor2);
const isBgTransparent = cmBgColor1.alpha === 0  || cmBgColor2.alpha === 0;
const bgHDistance = cmBgColor2.hue - cmBgColor1.hue;
const bgSDistance = cmBgColor2.saturation - cmBgColor1.saturation;
const bgLDistance = cmBgColor2.lightness - cmBgColor1.lightness;
const bgADistance = cmBgColor2.alpha - cmBgColor1.alpha;

const strokeColor1 = ea.colorNameToHex(selectedElements[0].strokeColor);
const cmStrokeColor1 = ea.getCM(strokeColor1);
const strokeColor2 = ea.colorNameToHex(selectedElements[1].strokeColor);
let   cmStrokeColor2 = ea.getCM(strokeColor2);
const isStrokeTransparent = cmStrokeColor1.alpha === 0 || cmStrokeColor2.alpha ===0;
const strokeHDistance = cmStrokeColor2.hue - cmStrokeColor1.hue;
const strokeSDistance = cmStrokeColor2.saturation - cmStrokeColor1.saturation;
const strokeLDistance = cmStrokeColor2.lightness - cmStrokeColor1.lightness;
const strokeADistance = cmStrokeColor2.alpha - cmStrokeColor1.alpha;


ea.copyViewElementsToEAforEditing(selectedElements);
for(let i=0; i<repeatNum; i++) {
    const newEl = ea.cloneElement(selectedElements[1]);
    ea.elementsDict[newEl.id] = newEl;
    newEl.x += xDistance * (i + 1);
    newEl.y += yDistance * (i + 1);
    newEl.angle += angleDistance * (i + 1);
    const originWidth = newEl.width;
    const originHeight = newEl.height;
    const newWidth = newEl.width + widthDistance * (i + 1);
    const newHeight = newEl.height + heightDistance * (i + 1);
    if(newWidth >= 0 && newHeight >= 0) {
        if(newEl.type === 'arrow' || newEl.type === 'line' || newEl.type === 'freedraw') {
          const minX = Math.min(...newEl.points.map(pt => pt[0]));
          const minY = Math.min(...newEl.points.map(pt => pt[1]));
          for(let j = 0; j < newEl.points.length; j++) {
            if(newEl.points[j][0] > minX) {
              newEl.points[j][0] = newEl.points[j][0] + ((newEl.points[j][0] - minX) / originWidth) * (newWidth - originWidth);
            }
            if(newEl.points[j][1] > minY) {
              newEl.points[j][1] = newEl.points[j][1] + ((newEl.points[j][1] - minY) / originHeight) * (newHeight - originHeight);
            }
          }
        }
        else {
          newEl.width = newWidth;
          newEl.height = newHeight;
        }
    }

    if(!isBgTransparent) {
		cmBgColor2 = cmBgColor2.hueBy(bgHDistance).saturateBy(bgSDistance).lighterBy(bgLDistance).alphaBy(bgADistance);
		newEl.backgroundColor = cmBgColor2.stringHEX();
    } else {
      newEl.backgroundColor = "transparent";
    }

    if(!isStrokeTransparent) {
		cmStrokeColor2 = cmStrokeColor2.hueBy(strokeHDistance).saturateBy(strokeSDistance).lighterBy(strokeLDistance).alphaBy(strokeADistance);
		newEl.strokeColor = cmStrokeColor2.stringHEX();
    } else {
      newEl.strokeColor = "transparent";
    }
}

await ea.addElementsToView(false, false, true);
