/*
Adds a rounded mask to the image by adding a full cover black mask and a rounded rectangle white mask. The script is also useful for adding just a black mask. In this case, run the script, then delete the white mask and add your custom white mask.
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-crop-vintage.jpg)
```js*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.18")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

if(!ea.isExcalidrawMaskFile()) {
  new Notice("This script only works with Mask Files");
  return;
}

const frames = ea.getViewElements().filter(el=>el.type==="frame")
if(frames.length !== 1) {
  new Notice("Multiple frames found");
  return;
}
const frame = frames[0];
const frameId = frame.id;
ea.style.fillStyle = "solid";
ea.style.roughness = 0;
ea.style.strokeColor = "transparent";
ea.style.strokeWidth = 0.1;
ea.style.opacity = 50;

let blackEl = ea.getViewElements().find(el=>el.id === "allblack");
let whiteEl = ea.getViewElements().find(el=>el.id === "whiteovr");

if(blackEl && whiteEl) {
  ea.copyViewElementsToEAforEditing([blackEl, whiteEl]);
} else
if (blackEl && !whiteEl) {
  ea.copyViewElementsToEAforEditing([blackEl]);
  ea.style.backgroundColor = "white";
  ea.addRect(frame.x,frame.y,frame.width,frame.height, "whiteovr");
} else
if (!blackEl && whiteEl) {
  ea.style.backgroundColor = "black";
  ea.addRect(frame.x-10,frame.y-10,frame.width+20,frame.height+20, "allblack");
  ea.copyViewElementsToEAforEditing([whiteEl]);
} else {
  ea.style.backgroundColor = "black";
  ea.addRect(frame.x-10,frame.y-10,frame.width+20,frame.height+20, "allblack");
  ea.style.backgroundColor = "white";
  ea.addRect(frame.x,frame.y,frame.width,frame.height, "whiteovr");
}
blackEl = ea.getElement("allblack");
whiteEl = ea.getElement("whiteovr");
blackEl.frameId = frameId;
whiteEl.frameId = frameId;

let curve = await utils.inputPrompt(
  "Set roundess",
  "Positive whole number",
  `${whiteEl.roundness?.value ?? "500"}`
);

if(!curve) return;
curve = parseInt(curve);
if(isNaN(curve) || curve < 0) {
  new Notice ("Roudness is not a valid positive whole number");
  return;
}
whiteEl.roundness = {type: 3, value: curve};
ea.addElementsToView(false, true, true);