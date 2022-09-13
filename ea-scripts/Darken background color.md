/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/darken-lighten-background-color.png)

This script darkens the background color of the selected element by 2% at a time. 

You can use this script several times until you are satisfied. It is recommended to set a shortcut key for this script so that you can quickly try to DARKEN and LIGHTEN the color effect.

In contrast to the `Modify background color opacity` script, the advantage is that the background color of the element is not affected by the canvas color, and the color value does not appear in a strange rgba() form.

The color conversion method was copied from [color-convert](https://github.com/Qix-/color-convert).

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.7.19")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Step size"]) {
  settings = {
    "Step size" : {
      value: 2,
      description: "Step size in percentage for making the color darker"
    }
  };
  ea.setScriptSettings(settings);
}

const step = settings["Step size"].value;

const elements = ea
  .getViewSelectedElements()
  .filter((el) =>
    ["rectangle", "ellipse", "diamond", "image", "line", "freedraw"].includes(el.type)
  );
ea.copyViewElementsToEAforEditing(elements);
for (const el of ea.getElements()) {
  const color = ea.colorNameToHex(el.backgroundColor);
  const cm = ea.getCM(color);
  if (cm) {
	  const darker = cm.darkerBy(step);
	  if(Math.floor(darker.lightness)>0) el.backgroundColor = darker.stringHSL();
  }
}
await ea.addElementsToView(false, false);
