/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-repeat-texts.png)
In the following script, we address the concept of repetition through the lens of numerical progression. As visualized by the image, where multiple circles each labeled with an even task number are being condensed into a linear sequence, our script will similarly iterate through a set of numbers.

Inspired from [Repeat Elements](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Repeat%20Elements.md)


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

const selectedElements = ea.getViewSelectedElements().sort((lha,rha) => lha.x === rha.x ? lha.y - rha.y : lha.x - rha.x);

const selectedBounds = selectedElements.filter(e => e.type !== "text");
const selectedTexts = selectedElements.filter(e => e.type === "text");
const selectedTextsById = selectedTexts.reduce((prev, next) => (prev[next.id] = next, prev), {})


if(selectedTexts.length !== 2 || ![0, 2].includes(selectedBounds.length)) {
    new Notice("Please select only 2 text elements.");
    return;
}

if(selectedBounds.length === 2) {
	if(selectedBounds[0].type !== selectedBounds[1].type) {
	    new Notice("The selected elements must be of the same type.");
		return;
	}
	if (!selectedBounds.every(e => e.boundElements?.length === 1)) {
		new Notice("Only support the bound element with 1 text element.");
		return;
	}
	if (!selectedBounds.every(e => !!selectedTextsById[e.boundElements?.[0]?.id])) {
		new Notice("Bound element must refer to the text element.");
		return;
	}
}

const prevBoundEl = selectedBounds.length ? selectedBounds[0] : selectedTexts[0];
const nextBoundEl = selectedBounds.length ? selectedBounds[1] : selectedTexts[1];
const prevTextEl = prevBoundEl.type === 'text' ? prevBoundEl : selectedTextsById[prevBoundEl.boundElements[0].id]
const nextTextEl = nextBoundEl.type === 'text' ? nextBoundEl : selectedTextsById[nextBoundEl.boundElements[0].id]

const xDistance = nextBoundEl.x - prevBoundEl.x;
const yDistance = nextBoundEl.y - prevBoundEl.y;

const numReg = /\d+/
let textNumDiff
try {
	const num0 = +prevTextEl.text.match(numReg)
	const num1 = +nextTextEl.text.match(numReg)
	textNumDiff = num1 - num0
} catch(e) {
	new Notice("Text must include a number!")
	return;
}

const repeatEl = (newEl, step) => {
    ea.elementsDict[newEl.id] = newEl;
    newEl.x += xDistance * (step + 1);
    newEl.y += yDistance * (step + 1);

	if(newEl.text) {
		const text = newEl.text.replace(numReg, (match) => +match + (step + 1) * textNumDiff)
		newEl.originalText = text
		newEl.rawText = text
		newEl.text = text
	}
}

ea.copyViewElementsToEAforEditing(selectedBounds);
for(let i=0; i<repeatNum; i++) {
	const newTextEl = ea.cloneElement(nextTextEl);
	repeatEl(newTextEl, i)

	if (selectedBounds.length) {
	    const newBoundEl = ea.cloneElement(selectedBounds[1]);
		newBoundEl.boundElements[0].id = newTextEl.id
		newTextEl.containerId = newBoundEl.id
		repeatEl(newBoundEl, i)
	}
}

await ea.addElementsToView(false, false, true);

