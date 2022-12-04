/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-ocr.jpg)

THIS SCRIPT REQUIRES EXCALIDRAW 1.5.15

The script will 
  1) send the selected image file to [taskbone.com](https://taskbone.com) to exctract the text from the image, and
  2) will add the text to your drawing as a text element

I recommend also installing the [Transfer TextElements to Excalidraw markdown metadata](Transfer%20TextElements%20to%20Excalidraw%20markdown%20metadata.md) script as well.

The script is based on [@schlundd](https://github.com/schlundd)'s [Obsidian-OCR-Plugin](https://github.com/schlundd/obsidian-ocr-plugin)

See ScriptEngine documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.24")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let token = ea.getScriptSettings().token?.value??ea.getScriptSettings().token; 
const BASE_URL = "https://ocr.taskbone.com";

//convert setting to 1.5.21 format
if(token && !ea.getScriptSettings().token.value) {
  ea.setScriptSettings({token: {value: token, hidden: true}});
}

//get new token if token was not provided
if (!token) {
  const tokenResponse = await fetch(
	BASE_URL + "/get-new-token", {
	  method: 'post'
  });
  if (tokenResponse.status === 200) {
    jsonResponse = await tokenResponse.json();
	token = jsonResponse.token;
	ea.setScriptSettings({token: {value: token, hidden: true}});
  } else {
	notice(`Taskbone OCR Error: ${tokenResponse.status}\nPlease try again later.`);
	return;
  }
}

//get image element
//if multiple image elements were selected prompt user to choose
const imageElements = ea.getViewSelectedElements().filter((el)=>el.type==="image");

//need to save the view to ensure recently pasted images are saved as files
await ea.targetView.save(); 

let selectedImageElement = null;
switch (imageElements.length) {
  case 0: 
    return;
  case 1: 
    selectedImageElement = imageElements[0];
    break;
  default:
	const files = imageElements.map((el)=>ea.getViewFileForImageElement(el));
	selectedImageElement = await utils.suggester(files.map((f)=>f.name),imageElements);
    break;
}

if(!selectedImageElement) {
  notice("No image element was selected");
  return;
}
const imageFile = ea.getViewFileForImageElement(selectedImageElement);
if(!imageFile) {
  notice("Can read image file");
  return;
}

//Execute the OCR
let text = null;
const fileBuffer = await app.vault.readBinary(imageFile);
const formData = new FormData();
formData.append("image", new Blob([fileBuffer]))
try {
  const response = await fetch(
	BASE_URL + "/get-text", { 
	  headers: {
		Authorization: "Bearer " + token
	  },
	  method: "post",
	  body: formData
	});
  if (response.status == 200) {
	jsonResponse = await response.json();
	text = jsonResponse?.text;
	} else {
	  notice(`Could not read Text from ${file.path}:\n Error: ${response.status}`);
	  return;
	}
} catch (error) {
  notice(`The OCR service seems unavailable right now. Please try again later.`);
  return;
}

if(!text) {
  notice("No text found");
  return;
}
console.log({text});

//add text element to drawing
const id = ea.addText(selectedImageElement.x,selectedImageElement.y+selectedImageElement.height,text);
await ea.addElementsToView();
ea.selectElementsInView([ea.getElement(id)]);
ea.getExcalidrawAPI().zoomToFit(ea.getViewSelectedElements(),1);

//utility function
function notice(message) {
  new Notice(message,10000);
  console.log(message);
}
