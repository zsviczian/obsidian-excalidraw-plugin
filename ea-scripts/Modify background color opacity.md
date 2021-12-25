/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

This script changes the opacity of the background color of the selected boxes.

The default background color in Excalidraw is so dark that the text is hard to read. You can lighten the color a bit by setting transparency. And you can tweak the transparency over and over again until you're happy with it.

Although excalidraw has the opacity option in its native property Settings, it also changes the transparency of the border. Use this script to change only the opacity of the background color without affecting the border.

```javascript
*/
const alpha = parseFloat(await utils.inputPrompt("Background color opacity?","number","0.6"));
const elements=ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
ea.getElements().forEach((el)=>{
    const rgbColor = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(el.backgroundColor);
    if(rgbColor) {
        const r = parseInt(rgbColor[1], 16);
        const g = parseInt(rgbColor[2], 16);
        const b = parseInt(rgbColor[3], 16);
        el.backgroundColor=`rgba(${r},${g},${b},${alpha})`;
    }
    else {
        const rgbaColor = /^rgba\((\d+,\d+,\d+,)(\d*\.?\d*)\)$/i.exec(el.backgroundColor);
        if(rgbaColor) {
            el.backgroundColor=`rgba(${rgbaColor[1]}${alpha})`;
        }
    }
});
ea.addElementsToView();