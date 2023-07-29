/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dynamic-elements.png)

The script allows to create dynamic elements on the canvas by connecting them with macros functions defined on the same canvas.

```javascript
*/

// Ensure minimum required version of the plugin is installed.
if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("Please update your Excalidraw plugin to a newer version to use this script.");
  return;
}

window.ea = ea;

const allElements = ea.getViewElements();

// Filter out the arrow elements, they define or call functions.
const arrowElements = getArrowElements(ea);
const { macrosArrows, evalArrows } = separateArrows(arrowElements, allElements);

// Define macros.
defineMacros(macrosArrows, allElements, ea);

// Calculate dependency levels.
const dependencyLevels = calculateDependencyLevels(evalArrows, arrowElements);

// Sort evalArrows based on their dependencies.
evalArrows.sort((a, b) => compareDependencies(a, b, allElements, dependencyLevels));

// Execute functions.
evalArrows.forEach(arrow => executeFunctions(arrow, allElements, ea));

ea.addElementsToView();

// ---- Helper Functions ----

function getArrowElements(ea) {
  return ea.getMaximumGroups(ea.getViewSelectedElements())
    .reduce((acc, group) => [...acc, ...group.filter(el => el.type === 'arrow')], []);
}

function separateArrows(arrowElements, allElements) {
  let macrosArrows = [], evalArrows = [];

  for (const arrow of arrowElements) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    const startsWithHash = labelElement.text.startsWith('#');
    const startsWithEqual = labelElement.text.startsWith('=');

    if (startsWithHash) macrosArrows.push(arrow);
    if (startsWithEqual) evalArrows.push(arrow);
  }

  return { macrosArrows, evalArrows };
}

function defineMacros(macrosArrows, allElements, ea) {
  for (const arrow of macrosArrows) {
    const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);
    const macrosTextElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);

    const macrosName = labelElement.text.substr(1).replace(/s/, '');
    const macrosDefinition = macrosTextElement.text;

    const codeToEvaluate = `window.${macrosName} = ${macrosDefinition}`;
    let outputMessage = 'Macro definition failed';

    try {
      eval(codeToEvaluate);
      outputMessage = `Macro successfully defined at ${new Date()}`;
    } catch (err) {
      outputMessage = `Macro definition failed with error: ${err}`;
    }

    const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
    ea.copyViewElementsToEAforEditing([endBindingElement]);
    const outputElement = ea.getElement(endBindingElement.id);
    outputElement.rawText = outputMessage;
    ea.addElementsToView();
  }
}

function calculateDependencyLevels(evalArrows, arrowElements) {
  const dependencyLevels = {};

  for (const arrow of evalArrows) {
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

  return dependencyLevels;
}

function compareDependencies(a, b, allElements, dependencyLevels) {
  const startBindingElementA = allElements.find(el => el.id === (a.boundElements[0] || {}).id);
  const startBindingElementB = allElements.find(el => el.id === (b.boundElements[0] || {}).id);

  const functionNameA = startBindingElementA.text.substring(1);
  const functionNameB = startBindingElementB.text.substring(1);

  const dependencyLevelA = dependencyLevels[functionNameA] || 0;
  const dependencyLevelB = dependencyLevels[functionNameB] || 0;

  return dependencyLevelA - dependencyLevelB;
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

function executeFunctions(arrow, allElements, ea) {
  const startBindingElement = allElements.find(el => el.id === (arrow.startBinding || {}).elementId);
  const endBindingElement = allElements.find(el => el.id === (arrow.endBinding || {}).elementId);
  const labelElement = allElements.find(el => el.id === (arrow.boundElements[0] || {}).id);

  const functionName = labelElement.text.substring(1);
  const functionExists = eval(`typeof window.${functionName} == "function"`);

  if (functionExists) {
    let functionArguments = extractArguments(startBindingElement, allElements);
    evaluateAndAssignResults(functionName, functionArguments, endBindingElement, ea);
  }
}

function extractArguments(startBindingElement, allElements) {
  let functionArguments = [];

  const getElementContent = (element) => {
    if (element.type == 'text') {
      return element.text;
    } else if (element.type == 'image') {
      return element.url;
    }
  };

  if (startBindingElement.type == 'rectangle') {
    const groupElements = allElements.filter(el => startBindingElement.groupIds.includes(el.groupIds[0]) && el.type !== 'arrow');
    functionArguments = groupElements.map(getElementContent);
  } else {
    functionArguments.push(getElementContent(startBindingElement));
  }

  return functionArguments;
}

async function evaluateAndAssignResults(functionName, functionArguments, endBindingElement, ea) {
  const codeToEvaluate = `window.${functionName}(...functionArguments)`;

  try {
    let outputMessage = eval(codeToEvaluate);

    if (functionName == 'fetchImage') {
      outputMessage = await outputMessage;
      ea.copyViewElementsToEAforEditing([endBindingElement]);
      const outputElement = ea.getElement(endBindingElement.id);
      outputElement.image = { url: outputMessage };
      ea.addElementsToView();
    } else {
      ea.copyViewElementsToEAforEditing([endBindingElement]);
      const outputElement = ea.getElement(endBindingElement.id);
      outputElement.text = outputMessage.toString();
      ea.addElementsToView();
    }
  } catch (err) {
    console.error(`Function execution failed with error: ${err}`);
  }
}
