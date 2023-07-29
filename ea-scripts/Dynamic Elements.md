/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dynamic-elements.png)

This script is used with the Excalidraw plugin for Obsidian. It reads and executes code written in your Excalidraw drawing.
Labels starting with '#' define macros (functions) and labels starting with '=' call these functions and other JavaScript code.
The code in the labels is evaluated and the results are displayed on your drawing.

```javascript
*/

// Check if the minimum required version of the plugin is installed.
if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("Please update your Excalidraw plugin to a newer version to use this script.");
  return;
}

// Retrieve all the elements in the Excalidraw drawing.
const allElements = ea.getViewElements();

// Filter out the arrow elements, as they define or call functions.
const arrowElements = ea.getMaximumGroups(ea.getViewSelectedElements())
  .reduce((acc, group) => [...acc, ...group.filter(el => el.type === 'arrow')], []);

// Separate the arrows into those that define macros and those that call functions.
const macrosArrows = arrowElements.filter(arrow => {
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
  return labelElement.text.startsWith('#');
});

let evalArrows = arrowElements.filter(arrow => {
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
  return labelElement.text.startsWith('=');
});

// Iterate over the arrows that define macros to define the macros.
for (const arrow of macrosArrows) {
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
  const macrosTextElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);

  // Extract the macro name and definition.
  const macrosName = labelElement.text.substr(1).replace(/s/, '');
  const macrosDefinition = macrosTextElement.text;

  // Define the macro by executing the definition.
  const codeToEvaluate = `window.${macrosName} = ${macrosDefinition}`;
  let outputMessage = 'Macro definition failed';

  try {
    eval(codeToEvaluate);
    outputMessage = `Macro successfully defined at ${new Date()}`;
  } catch (err) {
    outputMessage = `Macro definition failed with error: ${err}`;
  }

  // Update the output element with the result of the macro definition.
  const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
  ea.copyViewElementsToEAforEditing([endBindingElement]);
  const outputElement = ea.getElement(endBindingElement.id);
  outputElement.rawText = outputMessage;
  ea.addElementsToView();
}

// Create a mapping for the dependency levels.
const dependencyLevels = {};

for (const arrow of evalArrows) {
  //const startBindingElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
  const functionName = labelElement.text.substring(1);
  let currentArrow = arrow;
  let level = 0;

  while (true) {
    const parentArrow = arrowElements.find(a => a.endBinding && a.endBinding.elementId === currentArrow.startBinding.elementId);

    if (!parentArrow) {
      break;
    }

    level += 1;
    currentArrow = parentArrow;
  }

  dependencyLevels[functionName] = level;
}

// Sort the eval arrows based on their dependencies.
evalArrows.sort((a, b) => {
  const startBindingElementA = allElements.find(el => el.id === (a.boundElements[0] || {}).id);
  const startBindingElementB = allElements.find(el => el.id === (b.boundElements[0] || {}).id);

  // Check if the function exists.
  const functionNameA = startBindingElementA.text.substring(1);
  const functionNameB = startBindingElementB.text.substring(1);

  // Use the dependency levels from the mapping.
  const dependencyLevelA = dependencyLevels[functionNameA] || 0;
  const dependencyLevelB = dependencyLevels[functionNameB] || 0;

  return dependencyLevelA - dependencyLevelB;
});

async function getImageData(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}

// Iterate over the arrows that call functions to execute the functions.
for (const arrow of evalArrows) {
  const startBindingElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);
  const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);

  // Check if the function exists.
  const functionName = labelElement.text.substring(1);
  const functionExists = eval(`typeof window.${functionName} == "function"`);

  if (functionExists) {
    // If the function exists, extract the arguments for the function.
    let functionArguments = [];

    const getElementContent = (element) => {
      if (element.type == 'text') {
        return element.text;
      } else if (element.type == 'image') {
        return element.fileId;
      } else if (element.type == 'iframe') {
        return element.link;
      }
    }
    
    if (startBindingElement.type == 'rectangle') {
      // take each element content in the rectangle group
      const groupId = startBindingElement.groupIds[0];
      const contentsInGroup = allElements.filter(el.groupIds.contains(groupId)).map(getElementContent).filter(it => !!it);
      functionArguments = contentsInGroup.map(el => el.text);
    } else {
      functionArguments.push(getElementContent());
    }

    // Execute the function and update the output element with the result.
    const functionArgumentsString = functionArguments.map(arg => `"${arg}"`).join(',');
    const codeToEvaluate = `new Promise(async (resolve, reject) => {
      try {
        const result = window.${functionName}(${functionArgumentsString});
        resolve(result);  
      } catch (err) {
        console.error("Error in executing the function", err);
      }
    });`;

    eval(codeToEvaluate).then(async output => {
      ea.copyViewElementsToEAforEditing([endBindingElement]);
      const outputElement = ea.getElement(endBindingElement.id);
      if (outputElement.type == 'image') {
        const imageURL = `${output}`;
        const dataURL = await getImageData(imageURL)

        const file = (new TextEncoder()).encode(dataURL)
        const hashBuffer = await window.crypto.subtle.digest("SHA-1", file);
        const fileId =
          Array.from(new Uint8Array(hashBuffer))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");

        ea.getExcalidrawAPI().addFiles([{
          id: fileId,
          dataURL: dataURL,
          created: Number(new Date()),
          mimeType:
            "image/jpeg"
        }])

        outputElement.fileId = fileId;

        ea.addElementsToView();
      } else if (outputElement.type == 'text') {
        outputElement.text = output;
        outputElement.rawText = output;
        ea.addElementsToView();
      } else if (outputElement.type == 'iframe') {
        const newElements = ea.getViewElements().map(it => {
          if (it.id == endBindingElement.id) {
            it.link = output;
          }
          return it;
        })
        ea.getExcalidrawAPI().updateScene({
          elements: newElements,
        })
      }
    });
  }
}

ea.addElementsToView();
