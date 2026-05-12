/*

<a href="https://www.youtube.com/watch?v=A1vrSGBbWgo" target="_blank"><img src ="https://i.ytimg.com/vi/A1vrSGBbWgo/maxresdefault.jpg" style="width:560px;"></a>


![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-draw-a-ui.jpg)
```js*/
let dirty=false;

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.23.0")) {
  new Notice("This script requires Excalidraw 2.23.0 or later. Please update the plugin.");
  return;
}

const outputTypes = {
  "html": {
    instruction: "Turn this into a single html file using tailwind. Return a single message containing only the html file in a codeblock.",
    blocktype: "html"
  },
  "mindmap": {
    instruction: "Return only the mind map as plain text. Use one # heading for the central node, then nested - bullets for branches. Do not use bold, italics, code fences, tables, or explanatory text.",
    blocktype: "mindmap"
  },
  "mermaid": {
    instruction: "Return a single message containing only the mermaid diagram in a codeblock.",
    blocktype: "mermaid"
  },
  "svg": {
    instruction: "Return a single message containing only the SVG code in an html codeblock.",
    blocktype: "svg"
  },
  "image-gen": {
    instruction: "Return a single message with the generated image prompt in a codeblock",
    blocktype: "image"
  },
    "image-gen-silent": {
    instruction: "Return a single message with the generated image prompt in a codeblock",
    blocktype: "image-silent"
  },
  "image-edit": {
    instruction: "",
    blocktype: "image"
  }
}

const systemPrompts = {
  "Challenge my thinking": {
    prompt: `Your task is to interpret a screenshot of a whiteboard, translating its ideas into a Mermaid graph. The whiteboard will encompass thoughts on a subject. Within the mind map, distinguish ideas that challenge, dispute, or contradict the whiteboard content. Additionally, include concepts that expand, complement, or advance the user's thinking. Utilize the Mermaid graph diagram type and present the resulting Mermaid diagram within a code block. Ensure the Mermaid script excludes the use of parentheses ().`,
    type: "mermaid",
    help: "Turn the selected image and optional prompt into a Mermaid mind map. If conversion fails, open More Tools > Mermaid to Excalidraw and edit the generated script."
  },
  "Convert sketch to shapes": {
    prompt: `Given an image featuring various geometric shapes drawn by the user, your objective is to analyze the input and generate SVG code that accurately represents these shapes. Your output will be the SVG code enclosed in an HTML code block.`,
    type: "svg",
    help: "Convert selected sketches into SVG shapes. Works best with a small number of simple shapes. Experimental."
  },
  "Create a simple Excalidraw icon": {
    prompt: `Given a description of an SVG image from the user, your objective is to generate the corresponding SVG code. Avoid incorporating textual elements within the generated SVG. Your output should be the resulting SVG code enclosed in an HTML code block.`,
    type: "svg",
    help: "Turn a text prompt into a simple SVG icon and insert it into Excalidraw. Text prompt only. Experimental."
  },
  
  "Create a stick figure": {
    prompt: "You will receive a prompt from the user. Your task involves drawing a simple stick figure or a scene involving a few stick figures based on the user's prompt. Create the stick figure based on the following style description. DO NOT add any detail, just use it AS-IS: Create a simple stick figure character with a large round head and a face in the style of sketchy caricatures. The stick figure should have a rudimentary body composed of straight lines representing the arms and legs. Hands and toes should be represented with round shapes, do not add details such as fingers or toes. Use fine lines, smooth curves, rounded shapes. The stick figure should retain a playful and childlike simplicity, reminiscent of a doodle someone might draw on the corner of a notebook page. Create a black and white drawing, a hand-drawn figure on white background.",
    type: "image-gen",
    help: "Send only the text prompt to the configured image model. Be specific. To keep the prompt unchanged, start with: 'DO NOT add any detail, just use it AS-IS:'"
  },
  "Edit an image": {
    prompt: null,
    type: "image-edit",
    help: "Image elements are used as the source image. In mask mode, shapes on top become the mask. Turn mask edit off to flatten non-image elements into the source image and apply a prompt-based transform."
  },
  "Generate an image from image and prompt": {
    prompt: "Your task involves receiving an image and a textual prompt from the user. Your goal is to craft a detailed, accurate, and descriptive narrative of the image, tailored for effective image generation. Utilize the user-provided text prompt to inform and guide your depiction of the image. Ensure the resulting image remains text-free.",
    type: "image-gen",
    help: "Generate an image from the selected image and your prompt. Add context in the prompt to guide how the image should be interpreted."
  },
  "Generate an image from prompt": {
    prompt: null,
    type: "image-gen",
    help: "Send only the text prompt to the configured image model. Be specific. To keep the prompt unchanged, start with: 'DO NOT add any detail, just use it AS-IS:'"
  },
  "Generate an image to illustrate a quote": {
    prompt: "Your task involves transforming a user-provided quote into a detailed and imaginative illustration. Craft a visual representation that captures the essence of the quote and resonates well with a broad audience. If the Author's name is provided, aim to establish a connection between the illustration and the Author. This can be achieved by referencing a well-known story from the Author, situating the image in the Author's era or setting, or employing other creative methods of association. Additionally, provide preferences for styling, such as the chosen medium and artistic direction, to guide the image creation process. Ensure the resulting image remains text-free. Your task output should comprise a descriptive and detailed narrative aimed at facilitating the creation of a captivating illustration from the quote.",
    type: "image-gen",
    help: "Turn a quote into an illustrated scene. Include the author's name if you want the result to reference them."
  },
   "Generate 4 icon-variants based on input image": {
    prompt: "Given a simple sketch and an optional text prompt from the user, your task is to generate a descriptive narrative tailored for effective image generation, capturing the style of the sketch. Utilize the text prompt to guide the description. Your objective is to instruct DALL-E to create a collage of four minimalist black and white hand-drawn pencil sketches in a 2x2 matrix format. Each sketch should convert the user's sketch into simple artistic SVG icons with transparent backgrounds. Ensure the resulting images remain text-free, maintaining a minimalist, easy-to-understand style, and omit framing borders. Only include a pencil in the drawing if it is explicitly mentioned in the user prompt or included in the sketch.",
    type: "image-gen-silent",
    help: "Generate a 2x2 sheet of four icon variations from the selected sketch. Add a prompt if you want to steer the result."
  }, 
  "Visual brainstorm": {
    prompt: "Your objective is to interpret a screenshot of a whiteboard, creating an image aimed at sparking further thoughts on the subject. The whiteboard will present diverse ideas about a specific topic. Your generated image should achieve one of two purposes: highlighting concepts that challenge, dispute, or contradict the whiteboard content, or introducing ideas that expand, complement, or enrich the user's thinking. You have the option to include multiple tiles in the resulting image, resembling a sequence akin to a comic strip. Ensure that the image remains devoid of text.",
    type: "image-gen",
    help: "Generate an image from the selected image and prompt to spark new ideas."
  },
  "Wireframe to code": {
    prompt: `You are an expert tailwind developer. A user will provide you with a low-fidelity wireframe of an application and you will return a single html file that uses tailwind to create the website. Use creative license to make the application more fleshed out. Write the necessary javascript code. If you need to insert an image, use placehold.co to create a placeholder image.`,
    type: "html",
    help: "Interpret the selected wireframe and generate a web app as a single HTML file. You can copy the result from the embeddable menu."
  },
}

if(window?.MindMapBuilderAPI) {
  systemPrompts["Create Mindmap"] = {
    prompt: "You will receive a text prompt and may also receive an image. Create a mind map as a hierarchical plain-text outline based on the image content, if provided, and the text prompt. Return only the mind map. Use exactly one markdown H1 heading for the central node, then - bullets for branches and indented - bullets for sub-branches. Do not use bold, italics, code fences, numbering, commentary, or any markdown formatting other than the heading and bullet list.",
    type: "mindmap",
    help: "Create a hierarchical mind map from the selected image, if any, and your prompt, then import it into Mind Map Builder. Requires the Mind Map Builder API to be available."
  };
}

// --------------------------------------
// Initialize values and settings
// --------------------------------------
let settings = ea.getScriptSettings();

if(!settings["Agent's Task"]) {
  settings = {
    "Agent's Task": "Wireframe to code",
    "User Prompt": "",
    "Mask Edit": true,
  };
  await ea.setScriptSettings(settings);
}

let userPrompt = settings["User Prompt"] ?? "";
let agentTask = settings["Agent's Task"];
let imageSize = settings["Image Size"]??"1024x1024";
let selectedTextModel = settings["Text Model"] ?? "";
let selectedImageModel = settings["Image Model"] ?? "";
let selectedMaxTokens = String(settings["Max Tokens"] ?? "").trim();
let prefersMaskEdit = settings["Mask Edit"] !== false;

const aiSettings = ea.getAISettings();
if(!aiSettings?.enabled) {
  new Notice("Excalidraw AI is disabled or unavailable. Enable it in plugin settings.");
  return;
}

if(!systemPrompts.hasOwnProperty(agentTask)) {
  agentTask = Object.keys(systemPrompts)[0];
}
let textModel, imageModel, validSizes;
let imageDataURL = null;
let maskDataURL = null;

const parsePositiveInteger = (value) => {
  const normalizedValue = String(value ?? "").trim();
  if(!normalizedValue) {
    return null;
  }

  const parsedValue = parseInt(normalizedValue, 10);
  if(Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const isImageEditTask = (task = agentTask) => (
  systemPrompts[task].type === "image-edit"
);

const doesTaskUseTextModel = (task = agentTask) => {
  const promptConfig = systemPrompts[task];
  const taskOutputType = outputTypes[promptConfig.type];
  const taskIsImageGenRequest = taskOutputType.blocktype === "image" || taskOutputType.blocktype === "image-silent";
  const taskIsImageEditRequest = isImageEditTask(task);
  return !taskIsImageEditRequest && !(taskIsImageGenRequest && !promptConfig.prompt);
};

const getConfiguredTextMaxTokens = () => {
  const scriptOverride = parsePositiveInteger(selectedMaxTokens);
  if(scriptOverride) {
    return scriptOverride;
  }

  const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
  return pluginDefault;
};

const getProviderProfiles = () => (
  aiSettings.providerProfiles ?? {}
);

const getTextModelConfigs = () => (
  aiSettings.textModels ?? {}
);

const getImageModelConfigs = () => (
  aiSettings.imageModels ?? {}
);

const hasConfiguredProviderApiKey = (providerId) => (
  Boolean(getProviderProfiles()[providerId]?.hasApiKey)
);

const getConfiguredModelIdsForKind = (kind) => {
  const configs = kind === "text"
    ? getTextModelConfigs()
    : getImageModelConfigs();

  return Object.keys(configs)
    .filter(modelId => hasConfiguredProviderApiKey(configs[modelId]?.providerId))
    .sort((left, right) => left.localeCompare(right));
};

const getMissingModelConfigurationMessage = (kind) => {
  if(kind === "text") {
    return "No text or multimodal models are ready to use. Add an API key to a provider profile and assign at least one text model in Excalidraw AI settings.";
  }

  return "No image models are ready to use. Add an API key to a provider profile and assign at least one image model in Excalidraw AI settings.";
};

const getConfiguredTextModel = () => (
  (imageDataURL ? aiSettings.defaultMultimodalTextModel : aiSettings.defaultTextModel)
  || aiSettings.defaultTextModel
  || aiSettings.defaultMultimodalTextModel
  || getConfiguredModelIdsForKind("text")[0]
  || ""
);

const getConfiguredImageModel = () => (
  aiSettings.defaultImageModel
  || getConfiguredModelIdsForKind("image")[0]
  || ""
);

const getModelConfigId = (configs, modelId) => {
  if(configs[modelId]) {
    return modelId;
  }
  return Object.keys(configs).find(configId => configs[configId]?.model === modelId) ?? "";
};

const getTextModelConfigId = (modelId) => getModelConfigId(getTextModelConfigs(), modelId);

const getImageModelConfigId = (modelId) => {
  return getModelConfigId(getImageModelConfigs(), modelId);
};

const getTextModelConfig = (modelId) => {
  const configId = getTextModelConfigId(modelId);
  return configId ? getTextModelConfigs()[configId] ?? null : null;
};

const getImageModelConfig = (modelId) => {
  const configId = getImageModelConfigId(modelId);
  return configId ? getImageModelConfigs()[configId] ?? null : null;
};

const getAvailableTextModels = () => {
  const configuredModels = getConfiguredModelIdsForKind("text");
  if(configuredModels.length > 0) {
    return configuredModels;
  }
  return [];
};

const getAvailableImageModels = () => {
  const configuredModels = getConfiguredModelIdsForKind("image");
  if(configuredModels.length > 0) {
    return configuredModels;
  }
  return [];
};

const getValidSizesForModel = (model) => {
  if(!model) {
    return [];
  }
  const configuredSizes = getImageModelConfig(model)?.supportedSizes
    ?.map(size => size?.trim())
    .filter(Boolean);
  if(configuredSizes?.length) {
    return configuredSizes;
  }
  return ["1024x1024"];
};

const getResolvedTextModelSelection = (requestedModelId = selectedTextModel) => {
  const availableModels = getAvailableTextModels();
  const requestedConfigId = getTextModelConfigId(requestedModelId);
  const configuredDefaultId = getTextModelConfigId(getConfiguredTextModel());
  const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId]
    .find(modelId => modelId && availableModels.includes(modelId))
    || "";
  const modelConfig = getTextModelConfig(resolvedModelId);
  const providerProfiles = getProviderProfiles();
  const providerId = modelConfig?.providerId ?? Object.keys(providerProfiles)[0] ?? "";
  const providerProfile = providerProfiles[providerId] ?? null;

  return {
    modelId: resolvedModelId,
    modelConfig,
    providerId,
    providerProfile,
    requestConfig: {
      textModelId: resolvedModelId,
    },
  };
};

const getResolvedImageModelSelection = (requestedModelId = selectedImageModel) => {
  const availableModels = getAvailableImageModels();
  const requestedConfigId = getImageModelConfigId(requestedModelId);
  const configuredDefaultId = getImageModelConfigId(getConfiguredImageModel());
  const resolvedModelId = [requestedConfigId, configuredDefaultId, availableModels[0], requestedModelId]
    .find(modelId => modelId && availableModels.includes(modelId))
    || "";
  const modelConfig = getImageModelConfig(resolvedModelId);
  const providerProfiles = getProviderProfiles();
  const providerId = modelConfig?.providerId ?? Object.keys(providerProfiles)[0] ?? "";
  const providerProfile = providerProfiles[providerId] ?? null;

  return {
    modelId: resolvedModelId,
    modelConfig,
    providerId,
    providerProfile,
    requestConfig: {
      imageModelId: resolvedModelId,
    },
  };
};

const getTextModelValidationMessage = (modelId, {requireMultimodal = false} = {}) => {
  if(getAvailableTextModels().length === 0) {
    return getMissingModelConfigurationMessage("text");
  }
  const textSelection = getResolvedTextModelSelection(modelId);
  if(!textSelection.modelConfig) {
    return `The selected text model (${modelId || "unknown"}) isn't configured in Excalidraw AI settings.`;
  }
  if(!textSelection.providerProfile) {
    return `The provider profile (${textSelection.providerId || "unknown"}) for text model ${textSelection.modelId} is missing from Excalidraw AI settings.`;
  }
  if(!textSelection.providerProfile.hasApiKey) {
    return `The selected provider profile (${textSelection.providerId}) doesn't have an API key configured.`;
  }
  if(requireMultimodal && textSelection.modelConfig.multimodalSupport === false) {
    return `The selected text model (${textSelection.modelId}) is set to text-only. Choose a multimodal model for image analysis tasks.`;
  }
  return "";
};

const getImageModelValidationMessage = (modelId, {requirePromptTransformSupport = false, requireMaskEditSupport = false} = {}) => {
  if(getAvailableImageModels().length === 0) {
    return getMissingModelConfigurationMessage("image");
  }
  const imageSelection = getResolvedImageModelSelection(modelId);
  if(!imageSelection.modelConfig) {
    return getMissingModelConfigurationMessage("image");
  }
  if(!imageSelection.providerProfile) {
    return `The provider profile (${imageSelection.providerId || "unknown"}) for image model ${imageSelection.modelId} is missing from Excalidraw AI settings.`;
  }
  if(!imageSelection.providerProfile.hasApiKey) {
    return `The selected provider profile (${imageSelection.providerId}) doesn't have an API key configured.`;
  }
  if(requirePromptTransformSupport && imageSelection.modelConfig.supportsPromptImageTransforms === false) {
    return `The selected image model (${imageSelection.modelId}) doesn't support prompt-based transforms in Excalidraw AI settings.`;
  }
  if(requireMaskEditSupport && imageSelection.modelConfig.supportsMaskImageEdits === false) {
    return `The selected image model (${imageSelection.modelId}) doesn't support mask-based edits in Excalidraw AI settings.`;
  }
  return "";
};

const getImageRequestErrorMessage = (result, modelId) => {
  const baseMessage = result?.json?.error?.message ?? "The image request failed.";
  const errorContext = result?.json?.error;
  const imageSelection = getResolvedImageModelSelection(modelId);
  const contextParts = [];
  if(errorContext?.provider) {
    contextParts.push(`provider=${errorContext.provider}`);
  }
  if(errorContext?.status) {
    contextParts.push(`status=${errorContext.status}`);
  }
  if(errorContext?.endpoint) {
    contextParts.push(`endpoint=${errorContext.endpoint}`);
  }
  if(errorContext?.imageRequest?.model) {
    contextParts.push(`model=${errorContext.imageRequest.model}`);
  }
  if(errorContext?.imageRequest?.size) {
    contextParts.push(`size=${errorContext.imageRequest.size}`);
  }
  if(errorContext?.imageRequest?.mode) {
    contextParts.push(`mode=${errorContext.imageRequest.mode}`);
  }
  const contextText = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
  return `${baseMessage}${contextText}`;
};

const getTaskValidationMessage = ({
  usesTextModel,
  requiresMultimodalText,
  isImageGenRequest,
  isImageEditRequest,
  requiresPromptTransformSupport,
  requiresMaskEditSupport,
  activeTextSelection,
  activeImageSelection,
}) => {
  if(usesTextModel) {
    const textValidationMessage = getTextModelValidationMessage(activeTextSelection.modelId, {
      requireMultimodal: requiresMultimodalText,
    });
    if(textValidationMessage) {
      return textValidationMessage;
    }
  }

  if(isImageGenRequest || isImageEditRequest) {
    return getImageModelValidationMessage(activeImageSelection.modelId, {
      requirePromptTransformSupport: requiresPromptTransformSupport,
      requireMaskEditSupport: requiresMaskEditSupport,
    });
  }
  return "";
};

const getActiveTextModel = () => {
  return getResolvedTextModelSelection(selectedTextModel).modelId;
};

const getActiveImageModel = () => {
  return getResolvedImageModelSelection(selectedImageModel).modelId;
};

const activeImageModelSupportsMaskEdits = () => {
  const modelConfig = getResolvedImageModelSelection(selectedImageModel).modelConfig;
  return Boolean(modelConfig) && modelConfig.supportsMaskImageEdits !== false;
};

const canUseMaskEdit = () => (
  isImageEditTask() && activeImageModelSupportsMaskEdits()
);

const shouldUseMaskEdit = () => (
  canUseMaskEdit() && prefersMaskEdit
);

const shouldGenerateMaskPreview = () => (
  shouldUseMaskEdit()
);

const hasAvailableTextModels = () => getAvailableTextModels().length > 0;

const hasAvailableImageModels = () => getAvailableImageModels().length > 0;

const parseImageSize = (size) => {
  const [width, height] = (size ?? "1024x1024").split("x").map(value => parseInt(value, 10));
  if(Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
    return {width: 1024, height: 1024};
  }
  return {width, height};
};

const getEditTargetBoundingBox = (bb, size) => {
  const {width: targetWidth, height: targetHeight} = parseImageSize(size);
  const targetRatio = targetWidth/targetHeight;
  const sourceRatio = bb.width/bb.height;

  let width = bb.width;
  let height = bb.height;
  let topX = bb.topX;
  let topY = bb.topY;

  if(sourceRatio > targetRatio) {
    height = width/targetRatio;
    topY = bb.topY - (height - bb.height)/2;
  } else if(sourceRatio < targetRatio) {
    width = height*targetRatio;
    topX = bb.topX - (width - bb.width)/2;
  }

  return {topX, topY, width, height, targetWidth, targetHeight};
};

const setTextAndImageModels = () => {
  const nextTextModel = getActiveTextModel();
  if(selectedTextModel !== nextTextModel) {
    dirty = true;
  }
  textModel = nextTextModel;
  selectedTextModel = textModel;

  const nextImageModel = getActiveImageModel();
  if(selectedImageModel !== nextImageModel) {
    dirty = true;
  }
  imageModel = nextImageModel;
  selectedImageModel = imageModel;
  validSizes = imageModel ? getValidSizesForModel(imageModel) : [];
  if(imageModel && !validSizes.includes(imageSize)) {
    imageSize = validSizes[0] ?? "1024x1024";
    dirty = true;
  }
}
setTextAndImageModels();

// --------------------------------------
// Generate Image Blob From Selected Excalidraw Elements
// --------------------------------------
const calculateImageScale = (elements) => {
  const bb = ea.getBoundingBox(elements);
  const size = (bb.width*bb.height);
  const minRatio = Math.sqrt(360000/size);
  const maxRatio = Math.sqrt(size/16000000);
  return minRatio > 1 
    ? minRatio
    : (
        maxRatio > 1 
        ? 1/maxRatio
        : 1
      );
}

const createMask = async (dataURL) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // If opaque (alpha > 0), make it transparent
        if (data[i + 3] > 0) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        } else if (data[i + 3] === 0) {
          // If fully transparent, make it red
          data[i] = 255; // Red
          data[i + 1] = 0; // Green
          data[i + 2] = 0; // Blue
          data[i + 3] = 255; // make it opaque
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const maskDataURL = canvas.toDataURL();

      resolve(maskDataURL);
    };

    img.onerror = error => {
      reject(error);
    };

    img.src = dataURL;
  });
}

// For image edits, the selected content is padded to the requested output aspect ratio
// so the exported image and mask match the requested model size.
const generateCanvasDataURL = async (view, targetImageEdit=false) => {
  let PADDING = 5;
  await view.forceSave(true); //to ensure recently embedded PNG and other images are saved to file
  const viewElements = ea.getViewSelectedElements();
  if(viewElements.length === 0) {
    return {imageDataURL: null, maskDataURL: null} ;
  }
  ea.copyViewElementsToEAforEditing(viewElements, true); //copying the images objects over to EA for PNG generation
  
  let maskDataURL;
  const loader = ea.getEmbeddedFilesLoader(false);
  let scale = calculateImageScale(ea.getElements());
  const bb = ea.getBoundingBox(viewElements);
  if(ea.getElements()
    .filter(el=>el.type==="image")
    .some(el=>Math.round(el.width) === Math.round(bb.width) && Math.round(el.height) === Math.round(bb.height))
  ) { PADDING = 0; }
  
  let exportSettings = {withBackground: true, withTheme: true};
  
  if(targetImageEdit) {
    PADDING = 0;  
    const strokeColor = ea.style.strokeColor;
    const backgroundColor = ea.style.backgroundColor;
    ea.style.backgroundColor = "transparent";
    ea.style.strokeColor = "transparent";
    const targetBounds = getEditTargetBoundingBox(bb, imageSize);
    const rectID = ea.addRect(targetBounds.topX, targetBounds.topY, targetBounds.width, targetBounds.height);
    const rect = ea.getElement(rectID);
    ea.style.strokeColor = strokeColor;
    ea.style.backgroundColor = backgroundColor;
    ea.getElements().filter(el=>el.type === "image").forEach(el=>{el.isDeleted = true});

    scale = targetBounds.targetWidth/rect.width;
    exportSettings = {withBackground: false, withTheme: true};
    maskDataURL= await ea.createPNGBase64(
      null, scale, exportSettings, loader, "light", PADDING
    );
    maskDataURL = await createMask(maskDataURL)
    ea.getElements().filter(el=>el.type === "image").forEach(el=>{el.isDeleted = false});
    ea.getElements().filter(el=>el.type !== "image" && el.id !== rectID).forEach(el=>{el.isDeleted = true});
  }

  const imageDataURL = await ea.createPNGBase64(
    null, scale, exportSettings, loader, "light", PADDING
  );
  ea.clear();
  return {imageDataURL, maskDataURL};
}

({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));

// --------------------------------------
// Support functions - embeddable spinner and error
// --------------------------------------
const spinner = await ea.convertStringToDataURL(`
  <html><head><style>
    html, body {width: 100%; height: 100%; color: ${ea.getExcalidrawAPI().getAppState().theme === "dark" ? "white" : "black"};}
    body {display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 1rem; overflow: hidden;}
    .Spinner {display: flex; align-items: center; justify-content: center; margin-left: auto; margin-right: auto;}
    .Spinner svg {animation: rotate 1.6s linear infinite; transform-origin: center center; width: 40px; height: 40px;}
    .Spinner circle {stroke: currentColor; animation: dash 1.6s linear 0s infinite; stroke-linecap: round;}
    @keyframes rotate {100% {transform: rotate(360deg);}}
    @keyframes dash {
      0% {stroke-dasharray: 1, 300; stroke-dashoffset: 0;}
      50% {stroke-dasharray: 150, 300; stroke-dashoffset: -200;}
      100% {stroke-dasharray: 1, 300; stroke-dashoffset: -280;}
    }
  </style></head><body>
    <div class="Spinner">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" stroke-width="8" fill="none" stroke-miter-limit="10"/>
      </svg>
    </div>
    <div>Generating...</div>
  </body></html>`);

  const errorMessage = async (spinnerID, message) => {
    const error = "Something went wrong! Check developer console for more.";
    const details = message ? `<p>${message}</p>` : "";
    const errorDataURL = await ea.convertStringToDataURL(`
      <html><head><style>
        html, body {height: 100%;}
        body {display: flex; flex-direction: column; align-items: center; justify-content: center; color: red;}
        h1, h3 {margin-top: 0;margin-bottom: 0.5rem;}
      </style></head><body>
        <h1>Error!</h1>
        <h3>${error}</h3>${details}
      </body></html>`);
    new Notice (error);
    ea.getElement(spinnerID).link = errorDataURL;
    ea.addElementsToView(false,true);
  }

// --------------------------------------
// Utility to write Mermaid to dialog
// --------------------------------------
const EDITOR_LS_KEYS = {
  OAI_API_KEY: "excalidraw-oai-api-key",
  MERMAID_TO_EXCALIDRAW: "mermaid-to-excalidraw",
  PUBLISH_LIBRARY: "publish-library-data",
};

const setMermaidDataToStorage = (mermaidDefinition) => {
  try {
    window.localStorage.setItem(
      EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW,
      JSON.stringify(mermaidDefinition)
    );
    return true;
  } catch (error) {
    console.warn(`localStorage.setItem error: ${error.message}`);
    return false;
  }
};

const getGeneratedImageSource = (result) => {
  return result?.firstImage?.dataURL
    || result?.firstImage?.url
    || result?.images?.[0]?.dataURL
    || result?.images?.[0]?.url
    || null;
};

const getResultFinishReason = (result) => {
  const finishReason = result?.json?.choices?.[0]?.finish_reason;
  return typeof finishReason === "string" ? finishReason : "";
};

const isMaxTokenFinishReason = (finishReason) => {
  const normalized = (finishReason ?? "").trim().toLowerCase();
  return normalized === "max_tokens" || normalized === "max_tokens_exceeded" || normalized === "length";
};

const extractStructuredContent = (rawContent, blocktype) => {
  const contentText = (rawContent ?? "").trim();
  if(!contentText) {
    return "";
  }

  const codeBlocks = ea.extractCodeBlocks(contentText);
  const matchingBlock = codeBlocks.find(block => (block.type ?? "").toLowerCase() === blocktype)
    || (blocktype === "svg" ? codeBlocks.find(block => (block.type ?? "").toLowerCase() === "html") : null)
    || codeBlocks[0];

  if(matchingBlock?.data) {
    return matchingBlock.data;
  }

  if(blocktype === "html") {
    const doctypeIndex = contentText.indexOf("<!DOCTYPE html>");
    const htmlOpenIndex = contentText.indexOf("<html");
    const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlOpenIndex;
    const endIndex = contentText.lastIndexOf("</html>");
    if(startIndex >= 0 && endIndex >= 0) {
      return contentText.slice(startIndex, endIndex + "</html>".length);
    }
  }

  if(blocktype === "mermaid" && contentText.startsWith("mermaid")) {
    return contentText.replace(/^mermaid/, "").trim();
  }

  if(blocktype === "mindmap") {
    return contentText;
  }

  return "";
};

// --------------------------------------
// Submit Prompt
// --------------------------------------
const generateImage = async(text, spinnerID, bb, silent=false) => {
  const validationMessage = getImageModelValidationMessage(selectedImageModel);
  if(validationMessage) {
    new Notice(validationMessage, 8000);
    await errorMessage(spinnerID, validationMessage);
    return;
  }

  const imageSelection = getResolvedImageModelSelection(selectedImageModel);
  const result = await ea.generateAIImage({
    ...imageSelection.requestConfig,
    text,
    imageGenerationProperties: {
      size: imageSize, 
      //quality: "standard", //not supported by dall-e-2
      n:1,
    },
  });
  console.log({result, json:result?.json});

  const imageSource = getGeneratedImageSource(result);
  
  if(!imageSource) {
    await errorMessage(spinnerID, getImageRequestErrorMessage(result, imageSelection.modelId));
    return;
  }
  
  const spinner = ea.getElement(spinnerID)
  spinner.isDeleted = true;
  const imageID = await ea.addImage(spinner.x, spinner.y, imageSource);
  const imageEl = ea.getElement(imageID);
  const revisedPrompt = result.revisedPrompt;
  if(revisedPrompt && !silent) {
    ea.style.fontSize = 16;
    const rectID = ea.addText(imageEl.x+15, imageEl.y + imageEl.height + 50, revisedPrompt, {
      width: imageEl.width-30,
      textAlign: "center",
      textVerticalAlign: "top",
      box: true,
    })
    ea.getElement(rectID).strokeColor = "transparent";
    ea.getElement(rectID).backgroundColor = "transparent";
    ea.addToGroup(ea.getElements().filter(el=>el.id !== spinnerID).map(el=>el.id));
  }
  
  await ea.addElementsToView(false, true, true);
  if(silent) return;

}

const run = async (text) => {
  if(!text && !imageDataURL) {
    new Notice("Enter a prompt or select content before running ExcaliAI.");
    return;
  }

  const systemPrompt = systemPrompts[agentTask];
  const outputType = outputTypes[systemPrompt.type];
  const isImageGenRequest = outputType.blocktype === "image" || outputType.blocktype === "image-silent";
  const isImageEditRequest = isImageEditTask();
  const isMaskEditRequest = isImageEditRequest && shouldUseMaskEdit();
  const usesTextModel = !isImageEditRequest && !(isImageGenRequest && !systemPrompt.prompt);
  const requiresMultimodalText = usesTextModel && Boolean(imageDataURL);
  const activeTextSelection = getResolvedTextModelSelection(selectedTextModel);
  const activeImageSelection = getResolvedImageModelSelection(selectedImageModel);
  const validationMessage = getTaskValidationMessage({
    usesTextModel,
    requiresMultimodalText,
    isImageGenRequest,
    isImageEditRequest,
    requiresPromptTransformSupport: isImageEditRequest && !isMaskEditRequest,
    requiresMaskEditSupport: isMaskEditRequest,
    activeTextSelection,
    activeImageSelection,
  });

  if(validationMessage) {
    new Notice(validationMessage, 8000);
    return;
  }

  if(isImageEditRequest) {
    if(!text) {
      new Notice("Enter instructions for how the image should be changed.");
      return;
    }
    if(!imageDataURL) {
      new Notice("Select an image.");
      return;
    }
    if(isMaskEditRequest && !maskDataURL) {
      new Notice("Select or create a mask.");
      return;
    }
  }
  
  //place spinner next to selected elements
  const bb = ea.getBoundingBox(ea.getViewSelectedElements()); 
  const spinnerID = ea.addEmbeddable(bb.topX+bb.width+100,bb.topY-(720-bb.height)/2,550,720,spinner);
  
  //this block is in an async call using the isEACompleted flag because otherwise during debug Obsidian
  //goes black (not freezes, but does not get a new frame for some reason)
  //palcing this in an async call solves this issue
  //If you know why this is happening and can offer a better solution, please reach out to @zsviczian
  let isEACompleted = false;
  setTimeout(async()=>{
    await ea.addElementsToView(false,true);
    ea.clear();
    const embeddable = ea.getViewElements().filter(el=>el.id===spinnerID);
    ea.copyViewElementsToEAforEditing(embeddable);
    const els = ea.getViewSelectedElements();
    ea.viewZoomToElements(false, els.concat(embeddable));
    isEACompleted = true;
  });

  if(isImageGenRequest && !systemPrompt.prompt && !isImageEditRequest) {
    await generateImage(text,spinnerID,bb);
    return;
  }

  let result;
  let requestTextResult = null;
  if(isImageEditRequest) {
    result = isMaskEditRequest
      ? await ea.maskEditAIImage({
          ...activeImageSelection.requestConfig,
          image: {url: imageDataURL},
          ...(text && text.trim() !== "") ? {text} : {},
          imageGenerationProperties: {
            size: imageSize,
            n: 1,
            mask: maskDataURL,
          },
        })
      : await ea.transformAIImage({
          ...activeImageSelection.requestConfig,
          image: {url: imageDataURL},
          ...(text && text.trim() !== "") ? {text} : {},
          imageGenerationProperties: {
            size: imageSize,
            n: 1,
          },
        });
  } else {
    requestTextResult = async () => {
      const maxTokens = getConfiguredTextMaxTokens();
      const textRequestObject = {
        ...activeTextSelection.requestConfig,
        ...imageDataURL ? {image: {url: imageDataURL}} : {},
        ...(text && text.trim() !== "") ? {text} : {},
        systemPrompt: systemPrompt.prompt,
        instruction: outputType.instruction,
        ...(maxTokens ? {maxTokens} : {}),
      };

      return imageDataURL
        ? await ea.analyzeAIImage(textRequestObject)
        : await ea.generateAIText(textRequestObject);
    };

    result = await requestTextResult();
  }

  //checking that EA has completed. Because the postOpenAI call is an async await
  //I don't expect EA not to be completed by now. However the devil never sleeps.
  //This (the insomnia of the Devil) is why I have a watchdog here as well
  let counter = 0
  while(!isEACompleted && counter++<10) sleep(50);
  if(!isEACompleted) {
    await errorMessage(spinnerID, "Unexpected ExcalidrawAutomate error.");
    return;
  }

  if(isImageEditRequest) {   
    const imageSource = getGeneratedImageSource(result);
    if(!imageSource) {
      await errorMessage(spinnerID, getImageRequestErrorMessage(result, activeImageSelection.modelId));
      return;
    }
    
    const spinner = ea.getElement(spinnerID)
    spinner.isDeleted = true;
    const imageID = await ea.addImage(spinner.x, spinner.y, imageSource);    
    await ea.addElementsToView(false, true, true);
    return;
  }

  if(result?.json?.error) {
    await errorMessage(spinnerID, result?.json?.error?.message);
    return;
  }

  //exctract codeblock and display result
  let content = extractStructuredContent(result.content, outputType.blocktype);

  if(!content) {
    const errorDetails = outputType.blocktype === "html" && isMaxTokenFinishReason(getResultFinishReason(result))
      ? "The model hit the token limit before it finished the HTML output. Increase 'Text max token override' in ExcaliAI or raise the default AI response token limit in plugin settings."
      : undefined;
    await errorMessage(spinnerID, errorDetails);
    return;
  }

  if(isImageGenRequest) {
    await generateImage(content,spinnerID,bb,outputType.blocktype === "image-silent");
    return;
  }
  
  switch(outputType.blocktype) {
    case "html":
      ea.getElement(spinnerID).link = await ea.convertStringToDataURL(content);
      ea.addElementsToView(false,true);
      break;
    case "mindmap": {
      const mmb = window?.MindMapBuilderAPI;
      if(!mmb?.setView || !mmb?.importMarkdown) {
        await errorMessage(spinnerID, "Mind Map Builder API is not available.");
        return;
      }

      const setViewResult = mmb.setView(ea.targetView);
      if(!setViewResult?.ok) {
        await errorMessage(spinnerID, setViewResult?.error?.message || "Could not connect to Mind Map Builder.");
        return;
      }

      const importResult = await mmb.importMarkdown({markdown: content});
      if(!importResult?.ok) {
        await errorMessage(spinnerID, importResult?.error?.message || "Could not create the mind map.");
        return;
      }

      ea.getElement(spinnerID).isDeleted = true;
      await ea.addElementsToView(false, true, true);
      new Notice("Mind map created in Mind Map Builder.", 8000);
      break;
    }
    case "svg":
      ea.getElement(spinnerID).isDeleted = true;
      ea.importSVG(content);
      ea.addToGroup(ea.getElements().map(el=>el.id));
      if(ea.getViewSelectedElements().length>0) {
        ea.targetView.currentPosition = {x: bb.topX+bb.width+100, y: bb.topY};
      }
      ea.addElementsToView(true, false);
      break;
    case "mermaid":
      if(content.startsWith("mermaid")) {
        content = content.replace(/^mermaid/,"").trim();
      }

      try {
        result = await ea.addMermaid(content);
        if(typeof result === "string") {
          await errorMessage(spinnerID, "Open [More Tools > Mermaid to Excalidraw] to review and fix the generated Mermaid script.<br><br>" + result);
          return;
        }
      } catch (e) {
        ea.addText(0,0,content);
      }
      ea.getElement(spinnerID).isDeleted = true;
      ea.targetView.currentPosition = {x: bb.topX+bb.width+100, y: bb.topY-bb.height};
      await ea.addElementsToView(true, false);
      setMermaidDataToStorage(content);
      new Notice("Open More Tools > Mermaid to Excalidraw to review or edit the generated diagram.",8000);
      break;
  }
}

// --------------------------------------
// User Interface
// --------------------------------------
let previewDiv;
const fragWithHTML = (html) => createFragment((frag) => (frag.createDiv().innerHTML = html));
const isImageGenerationTask = () => systemPrompts[agentTask].type === "image-gen" || systemPrompts[agentTask].type === "image-gen-silent" || systemPrompts[agentTask].type === "image-edit";
const addPreviewImage = () => {
  if(!previewDiv) return;
  previewDiv.empty();
  previewDiv.createEl("img",{
    attr: {
      style: `max-width: 100%;max-height: 30vh;`,
      src: imageDataURL,
    }
  });

  if(isImageEditTask() && !shouldUseMaskEdit()) {
    previewDiv.createEl("p", {
      text: activeImageModelSupportsMaskEdits()
        ? "Mask edit is off. Non-image elements are flattened into the preview image and sent as a prompt-based transform."
        : "This model doesn't support mask edits. Non-image elements are flattened into the preview image and sent as a prompt-based transform.",
    });
    return;
  }

  if(maskDataURL) {
    previewDiv.createEl("img",{
      attr: {
        style: `max-width: 100%;max-height: 30vh;`,
        src: maskDataURL,
      }
    });
  }
}

const configModal = new ea.obsidian.Modal(app);
configModal.modalEl.style.width="100%";
configModal.modalEl.style.maxWidth="1000px";

configModal.onOpen = async () => {
  const contentEl = configModal.contentEl;
  contentEl.createEl("h1", {text: "ExcaliAI"});

  let systemPromptTextArea, systemPromptDiv, textModelSetting, textModelSettingDropdown, imageModelSetting, imageModelSettingDropdown, imageSizeSetting, imageSizeSettingDropdown, maskEditSetting, maskEditToggleComponent, maxTokensSetting, helpEl, textModelHelpEl, imageModelHelpEl, maxTokensHelpEl;

  const updateTextModelHelp = () => {
    if(!textModelHelpEl) return;
    if(!hasAvailableTextModels()) {
      textModelHelpEl.innerHTML = `<b>Text model:</b> ${getMissingModelConfigurationMessage("text")}`;
      return;
    }
    const textSelection = getResolvedTextModelSelection(textModel);
    const multimodalText = textSelection.modelConfig?.multimodalSupport === false
      ? "text-only"
      : "multimodal";
    const usageText = isImageGenerationTask() && !systemPrompts[agentTask].prompt && systemPrompts[agentTask].type !== "image-edit"
      ? "This task uses the image model directly."
      : imageDataURL
        ? "The selected canvas image will also be sent to this model."
        : "Only the text prompt will be sent to this model.";
    textModelHelpEl.innerHTML = `<b>Text model:</b> ${textModel}. <b>Provider:</b> ${textSelection.providerId || "unknown"}. This model is ${multimodalText}. ${usageText}`;
  };

  const updateImageModelHelp = () => {
    if(!imageModelHelpEl) return;
    if(!hasAvailableImageModels()) {
      imageModelHelpEl.innerHTML = `<b>Image model:</b> ${getMissingModelConfigurationMessage("image")}`;
      return;
    }
    const configuredSizes = validSizes.length > 0 ? validSizes.join(", ") : "1024x1024";
    const modelConfig = getImageModelConfig(imageModel);
    const transformSupportText = modelConfig?.supportsPromptImageTransforms === false
      ? "doesn't support prompt transforms"
      : "supports prompt transforms";
    const maskSupportText = modelConfig?.supportsMaskImageEdits === false
      ? "doesn't support mask edits"
      : "supports mask edits";
    const editModeText = isImageEditTask()
      ? shouldUseMaskEdit()
        ? "Mask edit is on, so non-image elements are sent as the mask."
        : activeImageModelSupportsMaskEdits()
          ? "Mask edit is off, so non-image elements are flattened into the source image."
          : "This model doesn't support mask edits, so non-image elements are flattened into the source image."
      : "";
    imageModelHelpEl.innerHTML = `<b>Image model:</b> ${imageModel}. <b>Sizes:</b> ${configuredSizes}. This model ${transformSupportText} and ${maskSupportText}. If the selected image or mask does not match the chosen aspect ratio, ExcaliAI expands the export frame to fit the target ratio instead of cropping the content. ${editModeText}`;
  };

  const updateMaskEditSetting = () => {
    if(!maskEditSetting || !maskEditToggleComponent) return;
    const maskEditAvailable = activeImageModelSupportsMaskEdits();
    maskEditSetting.settingEl.style.display = isImageEditTask() ? "" : "none";
    maskEditSetting.descEl.setText(maskEditAvailable
      ? "On: non-image elements become the mask. Off: non-image elements are flattened into the source image for a prompt-based transform."
      : "This model doesn't support mask edits. ExcaliAI will flatten non-image elements into the source image and use a prompt-based transform.");
    maskEditToggleComponent.setDisabled(!maskEditAvailable);
    maskEditToggleComponent.setValue(shouldUseMaskEdit());
  };

  const updateMaxTokensHelp = () => {
    if(!maxTokensHelpEl) return;
    const scriptOverride = parsePositiveInteger(selectedMaxTokens);
    const pluginDefault = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
    const effectiveMaxTokens = getConfiguredTextMaxTokens();
    const sourceText = scriptOverride
      ? "Using the ExcaliAI override."
      : pluginDefault
        ? "Using the plugin default response token limit."
        : "Using the shared AI runtime default behavior.";
    maxTokensHelpEl.innerHTML = `<b>Text max tokens:</b> ${effectiveMaxTokens ?? "runtime default"}. ${sourceText}`;
  };

  const refreshTextModelDropdown = () => {
    if(!textModelSettingDropdown) return;
    while (textModelSettingDropdown.selectEl.options.length > 0) {
      textModelSettingDropdown.selectEl.remove(0);
    }
    getAvailableTextModels().forEach(model=>textModelSettingDropdown.addOption(model,model));
    textModelSettingDropdown.setDisabled(!hasAvailableTextModels());
    if(hasAvailableTextModels()) {
      textModelSettingDropdown.setValue(textModel);
    }
  };

  const refreshImageSizeDropdown = () => {
    if(!imageSizeSettingDropdown) return;
    while (imageSizeSettingDropdown.selectEl.options.length > 0) {
      imageSizeSettingDropdown.selectEl.remove(0);
    }
    validSizes.forEach(size=>imageSizeSettingDropdown.addOption(size,size));
    imageSizeSettingDropdown.setDisabled(!hasAvailableImageModels());
    if(hasAvailableImageModels() && validSizes.length > 0) {
      imageSizeSettingDropdown.setValue(imageSize);
    }
  };

  const refreshImageModelDropdown = () => {
    if(!imageModelSettingDropdown) return;
    while (imageModelSettingDropdown.selectEl.options.length > 0) {
      imageModelSettingDropdown.selectEl.remove(0);
    }
    getAvailableImageModels().forEach(model=>imageModelSettingDropdown.addOption(model,model));
    imageModelSettingDropdown.setDisabled(!hasAvailableImageModels());
    if(hasAvailableImageModels()) {
      imageModelSettingDropdown.setValue(imageModel);
    }
  };

  const updateHelpText = () => {
    helpEl.innerHTML = `<b>How it works:</b> ` + systemPrompts[agentTask].help;
    updateTextModelHelp();
    updateImageModelHelp();
    updateMaxTokensHelp();
  };
  
  new ea.obsidian.Setting(contentEl)
    .setName("Task")
    .addDropdown(dropdown=>{
      Object.keys(systemPrompts).forEach(key=>dropdown.addOption(key,key));
      dropdown
      .setValue(agentTask)
      .onChange(async (value) => {
        dirty = true;
        const prevTask = agentTask;
        agentTask = value;
        if(
          (systemPrompts[prevTask].type === "image-edit" && systemPrompts[value].type !== "image-edit") || 
          (systemPrompts[prevTask].type !== "image-edit" && systemPrompts[value].type === "image-edit")
        ) {
          ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
          addPreviewImage();
        }
        setTextAndImageModels();
        refreshTextModelDropdown();
        refreshImageModelDropdown();
        refreshImageSizeDropdown();
        updateMaskEditSetting();
        textModelSetting.settingEl.style.display = "";
        maxTokensSetting.settingEl.style.display = doesTaskUseTextModel() ? "" : "none";
        imageModelSetting.settingEl.style.display = isImageGenerationTask() ? "" : "none";
        imageSizeSetting.settingEl.style.display = isImageGenerationTask() ? "" : "none";
        const prompt = systemPrompts[value].prompt;
        updateHelpText();
        if(prompt) {
          systemPromptDiv.style.display = "";
          systemPromptTextArea.setValue(systemPrompts[value].prompt);
        } else {
          systemPromptDiv.style.display = "none";
        }
      });
   })

  helpEl = contentEl.createEl("p");
  textModelHelpEl = contentEl.createEl("p");
  imageModelHelpEl = contentEl.createEl("p");
  maxTokensHelpEl = contentEl.createEl("p");
  updateHelpText();

  systemPromptDiv = contentEl.createDiv();
  systemPromptDiv.createEl("h4", {text: "System prompt"});
  systemPromptDiv.createEl("span", {text: "Advanced: change this only if you know why."})
  const systemPromptSetting = new ea.obsidian.Setting(systemPromptDiv)
    .addTextArea(text => {
       systemPromptTextArea = text;
       const prompt = systemPrompts[agentTask].prompt;
       text.inputEl.style.minHeight = "10em";
       text.inputEl.style.width = "100%";
       text.setValue(prompt);
       text.onChange(value => {
         systemPrompts[agentTask].prompt = value;
       });
       if(!prompt) systemPromptDiv.style.display = "none";
    })
  systemPromptSetting.nameEl.style.display = "none";
  systemPromptSetting.descEl.style.display = "none";
  systemPromptSetting.infoEl.style.display = "none";

  contentEl.createEl("h4", {text: "Prompt"});
  const userPromptSetting = new ea.obsidian.Setting(contentEl)
    .addTextArea(text => {
       text.inputEl.style.minHeight = "10em";
       text.inputEl.style.width = "100%";
       text.setValue(userPrompt);
       text.onChange(value => {
         userPrompt = value;
         dirty = true;
       })
    })
  userPromptSetting.nameEl.style.display = "none";
  userPromptSetting.descEl.style.display = "none";
  userPromptSetting.infoEl.style.display = "none";

  textModelSetting = new ea.obsidian.Setting(contentEl)
    .setName("Text model")
    .setDesc("Shows only text or multimodal models whose provider has an API key. A multimodal model is required when the selected canvas image is sent with the prompt.")
    .addDropdown(dropdown=>{
      getAvailableTextModels().forEach(model=>dropdown.addOption(model,model));
      textModelSettingDropdown = dropdown;
      dropdown.setDisabled(!hasAvailableTextModels());
      dropdown
        .setValue(textModel || getAvailableTextModels()[0] || "")
        .onChange((value) => {
          dirty = true;
          selectedTextModel = value;
          setTextAndImageModels();
          refreshTextModelDropdown();
          updateTextModelHelp();
        });
   });

  maxTokensSetting = new ea.obsidian.Setting(contentEl)
    .setName("Text max token override")
    .setDesc("Optional script-level override for text and multimodal requests. Leave blank to use the Excalidraw AI default response token limit.")
    .addText(text => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      const placeholderValue = parsePositiveInteger(aiSettings.defaultMaxResponseTokens);
      if(placeholderValue) {
        text.setPlaceholder(String(placeholderValue));
      }
      text.setValue(selectedMaxTokens);
      text.onChange(value => {
        selectedMaxTokens = String(value ?? "").trim();
        dirty = true;
        updateMaxTokensHelp();
      });
    });
  maxTokensSetting.settingEl.style.display = doesTaskUseTextModel() ? "" : "none";
  maxTokensSetting.settingEl.toggleClass("is-disabled", !hasAvailableTextModels());

  imageModelSetting = new ea.obsidian.Setting(contentEl)
    .setName("Image model")
    .setDesc("Shows only image models whose provider has an API key.")
    .addDropdown(dropdown=>{
      getAvailableImageModels().forEach(model=>dropdown.addOption(model,model));
      imageModelSettingDropdown = dropdown;
      dropdown.setDisabled(!hasAvailableImageModels());
      dropdown
        .setValue(imageModel || getAvailableImageModels()[0] || "")
        .onChange(async (value) => {
          dirty = true;
          selectedImageModel = value;
          setTextAndImageModels();
          refreshTextModelDropdown();
          refreshImageModelDropdown();
          refreshImageSizeDropdown();
          updateMaskEditSetting();
          updateImageModelHelp();
          if(isImageEditTask()) {
            ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
            addPreviewImage();
          }
        });
   })
  imageModelSetting.settingEl.style.display = isImageGenerationTask() ? "" : "none";

  maskEditSetting = new ea.obsidian.Setting(contentEl)
    .setName("Use mask edit")
    .setDesc("On: non-image elements become the mask. Off: non-image elements are flattened into the source image for a prompt-based transform.")
    .addToggle(toggle => {
      maskEditToggleComponent = toggle;
      toggle
        .setValue(shouldUseMaskEdit())
        .setDisabled(!activeImageModelSupportsMaskEdits())
        .onChange(async (value) => {
          dirty = true;
          prefersMaskEdit = value;
          updateMaskEditSetting();
          updateImageModelHelp();
          ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
          addPreviewImage();
        });
    });
  maskEditSetting.settingEl.style.display = isImageEditTask() ? "" : "none";

  imageSizeSetting = new ea.obsidian.Setting(contentEl)
    .setName("Image size")
    .setDesc("Uses the sizes configured for the selected image model in Excalidraw AI settings.")
    .addDropdown(dropdown=>{
      validSizes.forEach(size=>dropdown.addOption(size,size));
      imageSizeSettingDropdown = dropdown;
      dropdown.setDisabled(!hasAvailableImageModels());
      dropdown
        .setValue(imageSize)
        .onChange(async (value) => {
          dirty = true;
          imageSize = value;
          updateImageModelHelp();
          if(isImageEditTask()) {
            ({imageDataURL, maskDataURL} = await generateCanvasDataURL(ea.targetView, shouldGenerateMaskPreview()));
            addPreviewImage();
          }
        });
   })
   imageSizeSetting.settingEl.style.display = isImageGenerationTask() ? "" : "none";

  setTextAndImageModels();
  refreshTextModelDropdown();
  refreshImageModelDropdown();
  refreshImageSizeDropdown();
  updateMaskEditSetting();
  updateHelpText();
  
  if(imageDataURL) {
    previewDiv = contentEl.createDiv({
      attr: {
        style: "text-align: center;",
      }
    });
    addPreviewImage();
  } else {
    contentEl.createEl("h4", {text: "No canvas selection"});
    contentEl.createEl("span", {text: "Nothing is selected, so only the text prompt will be sent to the configured text model."});
  }
  
  new ea.obsidian.Setting(contentEl)
    .addButton(button => 
      button
      .setButtonText("Run")
      .onClick((event)=>{
        if(doesTaskUseTextModel() && !hasAvailableTextModels()) {
          new Notice(getMissingModelConfigurationMessage("text"), 8000);
          return;
        }
        if(isImageGenerationTask() && !hasAvailableImageModels()) {
          new Notice(getMissingModelConfigurationMessage("image"), 8000);
          return;
        }
        run(userPrompt); //Obsidian crashes otherwise, likely has to do with requesting an new frame for react
        configModal.close();
      })
    );
}

configModal.onClose = () => {
  if(dirty) {
    settings["User Prompt"] = userPrompt;
    settings["Agent's Task"] = agentTask;
    settings["Mask Edit"] = prefersMaskEdit;
    settings["Text Model"] = selectedTextModel;
    settings["Max Tokens"] = selectedMaxTokens;
    settings["Image Model"] = selectedImageModel;
    settings["Image Size"] = imageSize;
    ea.setScriptSettings(settings);
  }
}
  
configModal.open();
