/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dynamic-elements.png)

The script allows to create dynamic elements on the canvas by connecting them with macros functions defined on the same canvas.

```javascript
*/

async function runDynamicElementsScript() {
  const allElements = ea.getViewElements();
  const pluginVersionSupported = await ensurePluginVersion("1.5.21");
  if (!pluginVersionSupported) return;

  const arrowElements = extractArrowElements(allElements);
  const { macrosArrows, evalArrows } = separateArrows(arrowElements, allElements);
  defineMacros(macrosArrows, allElements);
  const dependencyLevels = calculateDependencyLevels(evalArrows, arrowElements, allElements);
  evalArrows.sort((a, b) => compareDependencies(a, b, dependencyLevels));

  for (const arrow of evalArrows) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    const functionName = labelElement.text.substring(1);
    const functionExists = typeof window[functionName] === "function";
    if (functionExists) {
      const startBindingElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);
      const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
      const functionArguments = extractArguments(startBindingElement);
      await evaluateAndAssignResults(functionName, functionArguments, endBindingElement);
    }
  }
}

async function ensurePluginVersion(requiredVersion) {
  if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion(requiredVersion)) {
    new Notice("Please update your Excalidraw plugin to a newer version to use this script.");
    return false;
  }
  return true;
}

function extractArrowElements(allElements) {
  return ea.getMaximumGroups(ea.getViewSelectedElements())
    .flatMap(group => group.filter(el => el.type === 'arrow'));
}

function separateArrows(arrowElements, allElements) {
  const macrosArrows = [];
  const evalArrows = [];
  for (const arrow of arrowElements) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    if (!labelElement) continue;

    const labelText = labelElement.text;
    if (labelText.startsWith('#')) {
      macrosArrows.push(arrow);
    } else if (labelText.startsWith('=')) {
      evalArrows.push(arrow);
    }
  }
  return { macrosArrows, evalArrows };
}

function defineMacros(macrosArrows, allElements) {
  for (const arrow of macrosArrows) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    const macrosName = labelElement.text.substr(1).replace(/s/, '');
    const macrosTextElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);
    const macrosDefinition = macrosTextElement.text;
    const codeToEvaluate = `window.${macrosName} = ${macrosDefinition}`;
    let outputMessage = '';
    try {
      eval(codeToEvaluate);
      outputMessage = `defined at ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      outputMessage = `failed with error: ${err}`;
    }
    const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
    updateOutputMessage(endBindingElement, outputMessage);
  }
}

function calculateDependencyLevels(evalArrows, arrowElements, allElements) {
  const dependencyLevels = {};
  for (const arrow of evalArrows) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    const functionName = labelElement.text.substring(1);
    let currentArrow = arrow;
    let level = 0;
    while (true) {
      const parentArrow = arrowElements.find(a => a.endBinding && a.endBinding.elementId === currentArrow.startBinding.elementId);
      if (!parentArrow) break;
      level += 1;
      currentArrow = parentArrow;
    }
    dependencyLevels[functionName] = level;
  }
  return dependencyLevels;
}

function compareDependencies(a, b, dependencyLevels) {
  const functionNameA = getFunctionNameFromArrow(a);
  const functionNameB = getFunctionNameFromArrow(b);
  const dependencyLevelA = dependencyLevels[functionNameA] || 0;
  const dependencyLevelB = dependencyLevels[functionNameB] || 0;
  return dependencyLevelA - dependencyLevelB;
}

function getFunctionNameFromArrow(arrow) {
  const labelElement = ea.getViewElements().find(el => el.id === (arrow.boundElements[0] || {}).id);
  return labelElement ? labelElement.text.substring(1) : '';
}

async function updateOutputMessage(outputElement, message) {
  ea.copyViewElementsToEAforEditing([outputElement]);

  const el = ea.getElement(outputElement.id);

  if (el.type === 'image') {
    const imageURL = message;
    const dataURL = await getImageData(imageURL);
    const fileId = await createFileFromDataURL(dataURL);
    el.fileId = fileId;
  } else if (el.type === 'text') {
    el.text = message.toString();
    el.rawText = message.toString();
  } else if (el.type === 'iframe') {
    el.link = message.toString();
  }

  ea.addElementsToView();
}

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

async function createFileFromDataURL(dataURL) {
  const file = (new TextEncoder()).encode(dataURL);
  const hashBuffer = await window.crypto.subtle.digest("SHA-1", file);
  const fileId = Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  await ea.getExcalidrawAPI().addFiles([{
    id: fileId,
    dataURL: dataURL,
    created: Number(new Date()),
    mimeType:
      "image/jpeg"
  }]);
  return fileId;
}

function extractArguments(startBindingElement) {
  const getElementContent = (element) => {
    if (element.type == 'text') {
      return element.text;
    } else if (element.type == 'image') {
      return element.url;
    } else if (element.type == 'iframe') {
      return element.link;
    }
  };

  if (startBindingElement.type == 'rectangle') {
    const groupElements = ea.getViewElements().filter(el => startBindingElement.groupIds.includes(el.groupIds[0]) && el.type !== 'arrow');
    return groupElements.map(getElementContent);
  } else {
    return [getElementContent(startBindingElement)];
  }
}

async function evaluateAndAssignResults(functionName, functionArguments, endBindingElement) {
  const functionArgumentsString = functionArguments.map(arg => `"${arg}"`).join(',');
  const codeToEvaluate = `new Promise(async (resolve, reject) => {
      try {
        const result = window.${functionName}(${functionArgumentsString});
        resolve(result);  
      } catch (err) {
        console.error("Error in executing the function", err);
      }
    });`;
  const functionResult = await eval(codeToEvaluate);
  await updateOutputMessage(endBindingElement, functionResult);
}

runDynamicElementsScript();
