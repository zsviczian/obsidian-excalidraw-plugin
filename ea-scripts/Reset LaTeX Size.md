
/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-reset-latex.jpg)

Reset the sizes of embedded LaTeX equations to the default sizes or a multiple of the default sizes.

```javascript
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.4.0")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let elements = ea.getViewSelectedElements().filter((el)=>["image"].includes(el.type));
if (elements.length === 0) return;

scale = await utils.inputPrompt("Scale?", "Number", "1");
if (!scale) return;
scale = parseFloat(scale);

ea.copyViewElementsToEAforEditing(elements);

for (el of elements) {
  equation = ea.targetView.excalidrawData.getEquation(el.fileId)?.latex;
  if (!equation) return;
  eqData = await ea.tex2dataURL(equation);
  ea.getElement(el.id).width = eqData.size.width * scale;
  ea.getElement(el.id).height = eqData.size.height * scale;
};

ea.addElementsToView(false, false);