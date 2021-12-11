# [◀ Excalidraw Automate How To](./readme.md)

## Introduction
Place your ExcalidrawAutomate Scripts into the folder defined in Excalidraw Settings. The Scripts folder may not be the root folder of your Vault.

![image](https://user-images.githubusercontent.com/14358394/145673547-b4f57d01-3643-40f9-abfd-14c3bfa5ab93.png)

EA scripts may be markdown files, plain text files, or .js files. The only requirement is that they must contain valid JavaScript code. 

![image](https://user-images.githubusercontent.com/14358394/145673674-bb59f227-8eea-43dc-83b8-4d750e1920a8.png)

You will be able to access your scripts from Excalidraw via the Obsidian Command Palette. 

![image](https://user-images.githubusercontent.com/14358394/145673652-6b1713e2-edc8-4bc8-8246-3f8df8a4b273.png)

This will allow you to assign hotkeys to your favorite scripts just like to any other Obsidian command. 

![image](https://user-images.githubusercontent.com/14358394/145673633-83b6c969-cead-429b-9721-fd047f980279.png)

## Script development
An Excalidraw script will automatically receive two objects:
- `ea`: The Script Enginge will initialize the `ea` object including setting the active view to the View from which the script was called.
- `utils`: There is currently only a single function published on `utils`
  - `inputPrompt: (header: string, placeholder?: string, value?: string)`. You need to await the result of inputPrompt. See the example below for details.

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
This script will connect two objects with an arrow. If either of the objects are a set of grouped elements (e.g. a text element grouped with an encapsulating rectangle), the script will identify these groups, and connect the arrow to the largest object in the group (assuming you want to connect the arrow to the box around the text element).
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
