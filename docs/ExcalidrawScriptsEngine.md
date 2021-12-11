# [◀ Excalidraw Automate How To](../readme.md)

Place your ExcalidrawAutomate Scripts into the folder defined in Excalidraw Settings. EA scripts may be markdown files, but must contain valid JavaScript code. You will be able to access your scripts from Excalidraw via the Obsidian Command Palette. This will allow you to assign hotkeys to your favorite scripts just like to any other Obsidian command. The Scripts folder may not be the root folder of your Vault.

An Excalidraw script will automatically receive two objects:
- The `ea` object, already initialized and set to the active view from which it was called.
- The `utils` object, which currently supports a single function: `inputPrompt: (header: string, placeholder?: string, value?: string)`.

## Example Excalidraw Automate script

### Add box around selected elements
This script will add an encapsulating box around the currently selected elements in Excalidraw
```javascript
padding = parseInt (await utils.inputPrompt("padding?"));
elements = ea.getViewSelectedElements();
const box = ea.getBoundingBox(elements);
const rndColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,"0");
ea.style.strokeColor = rndColor;
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

### Connect selected elements with an arrow
```javascript
const elements = ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
const groups = ea.getMaximumGroups(elements);
if(groups.length !== 2) return;
els = [ 
  ea.getLargestElement(groups[0]),
  ea.getLargestElement(groups[1])
];
ea.connectObjects(
  els[0].id,
  null,
  els[1].id,
  null, 
  {numberOfPoints:2}
);
ea.addElementsToView();
```