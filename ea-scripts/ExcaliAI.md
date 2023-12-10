/*
<iframe width="560" height="315" src="https://www.youtube.com/embed/A1vrSGBbWgo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-draw-a-ui.jpg)
```js*/
let previewImg, previewDiv;

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.10")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const outputTypes = {
  "html": {
    instruction: "Turn this into a single html file using tailwind. Return a single message containing only the html file in a codeblock.",
    blocktype: "html"
  },
  "mermaid": {
    instruction: "Return a single message containing only the mermaid diagram in a codeblock.",
    blocktype: "mermaid"
  },
  "svg": {
    instruction: "Return a single message containing only the SVG code in an html codeblock.",
    blocktype: "svg"
  },
  "image": {
    instruction: "Return a single message containing the image.",
    blocktype: "dataURL"
  }
}

const systemPrompts = {
  "Wireframe to code": {
    prompt: `You are an expert tailwind developer. A user will provide you with a low-fidelity wireframe of an application and you will return a single html file that uses tailwind to create the website. Use creative license to make the application more fleshed out. Write the necessary javascript code. If you need to insert an image, use placehold.co to create a placeholder image.`,
    type: "html"
  },
  "Challenge my thinking": {
    prompt: `The user will provide you with a screenshot of a whiteboard. Your task is to generate a mermaid graph based on the whiteboard and return the resulting mermaid code in a codeblock. The whiteboard will cover ideas about a subject. On the mindmap identify ideas that challenge, dispute, and contradict what is on the whiteboard, as well as also include ideas that extend, add-to, build-on, and takes the thinking of the user further. Use the graph diagram type. Return a single message containing only the mermaid diagram in a codeblock. Avoid the use of () parenthesis in the mermaid script.`,
    type: "mermaid"
  },
  "Excalidraw sketch": {
    prompt: `The user will provide you with the description of an SVG image. Your task is to generate the SVG code based on the user input and return the resulting SVG code in an HTML codeblock`,
    type: "svg"
  }
}

// --------------------------------------
// Initialize values and settings
// --------------------------------------
let settings = ea.getScriptSettings();

if(!settings["Agent's Task"]) {
  settings = {
    "Agent's Task": "Wireframe to code",
    "User Prompt": "",
  };
  await ea.setScriptSettings(settings);
}

const OPENAI_API_KEY = ea.plugin.settings.openAIAPIToken;
if(!OPENAI_API_KEY || OPENAI_API_KEY === "") {
  new Notice("You must first configure your API key in Excalidraw Plugin Settings");
  return;
}

let userPrompt = settings["User Prompt"] ?? "";
let agentTask = settings["Agent's Task"];

if(!systemPrompts.hasOwnProperty(agentTask)) {
  agentTask = Object.keys(systemPrompts)[0];
}

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

const generateCanvasDataURL = async (view) => {
  await view.forceSave(true); //to ensure recently embedded PNG and other images are saved to file
  const viewElements = ea.getViewSelectedElements();
  if(viewElements.length === 0) {
    return;
  }
  ea.copyViewElementsToEAforEditing(viewElements, true); //copying the images objects over to EA for PNG generation
  const scale = calculateImageScale(viewElements);

  const loader = ea.getEmbeddedFilesLoader(false);
  const exportSettings = {
    withBackground: true,
    withTheme: true,
  };

  const dataURL =
    await ea.createPNGBase64(
      null,
      scale,
      exportSettings,
      loader,
      "light",
    );
  ea.clear();
  return dataURL;
}

const imageDataURL = await generateCanvasDataURL(ea.targetView);
  
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

  const errorMessage = async (spinnerID) => {
    const error = "Something went wrong! Check developer console for more.";
    const errorDataURL = await ea.convertStringToDataURL(`
      <html><head><style>
        html, body {height: 100%;}
        body {display: flex; flex-direction: column; align-items: center; justify-content: center; color: red;}
        h1, h3 {margin-top: 0;margin-bottom: 0.5rem;}
      </style></head><body>
        <h1>Error!</h1>
        <h3>${error}</h3>
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
  
// --------------------------------------
// Submit Prompt
// --------------------------------------
const run = async (text) => {
  if(!text && !imageDataURL) {
    new Notice("No prompt, aborting");
    return;
  }

  const systemPrompt = systemPrompts[agentTask];
  const outputType = outputTypes[systemPrompt.type];
  debugger;
  requestObject = {
    ...imageDataURL ? {image: imageDataURL} : {},
    ...(text && text.trim() !== "") ? {text} : {},
    systemPrompt: systemPrompt.prompt,
    instruction: outputType.instruction,
  }

  //place spinner next to selected elements
  const bb = ea.getBoundingBox(ea.getViewSelectedElements());
  
  const spinnerID = ea.addEmbeddable(bb.topX+bb.width+100,bb.topY-(720-bb.height)/2,550,720,spinner);
  await ea.addElementsToView(false,true);
  ea.clear();
  const embeddable = ea.getViewElements().filter(el=>el.id===spinnerID);
  ea.copyViewElementsToEAforEditing(embeddable);
  const els = ea.getViewSelectedElements();
  ea.viewZoomToElements(false, els.concat(embeddable));

  //Get result from GPT
  const result = await ea.postOpenAI(requestObject);

  if(!result?.json?.hasOwnProperty("choices")) {
    await errorMessage(spinnerID);
    return;
  }
  
  console.log({result, json:result?.json});

  //exctract codeblock and display result
  let content = ea.extractCodeBlocks(result.json.choices[0]?.message?.content)[0]?.data;

  if(!content) {
    await errorMessage(spinnerID);
    return;
  }

  switch(outputType.blocktype) {
    case "html":
      ea.getElement(spinnerID).link = await ea.convertStringToDataURL(content);
      ea.addElementsToView(false,true);
      break;
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
      ea.getElement(spinnerID).isDeleted = true;
      try {
        await ea.addMermaid(content);
      } catch (e) {
        ea.addText(0,0,content);
      }
      ea.targetView.currentPosition = {x: bb.topX+bb.width+100, y: bb.topY-bb.height};
      await ea.addElementsToView(true, false);
      setMermaidDataToStorage(content);
      new Notice("Open More Tools/Mermaid to Excalidraw in the top tools menu to edit the generated diagram",8000);
      break;
  }
}

// --------------------------------------
// User Interface
// --------------------------------------
const fragWithHTML = (html) => createFragment((frag) => (frag.createDiv().innerHTML = html));

const configModal = new ea.obsidian.Modal(app);
configModal.modalEl.style.width="100%";
configModal.modalEl.style.maxWidth="1000px";


let dirty=false;
configModal.onOpen = async () => {
  const contentEl = configModal.contentEl;
  contentEl.createEl("h1", {text: "ExcaliAI"});

  let systemPromptTextArea;

  new ea.obsidian.Setting(contentEl)
    .setName("Select Prompt")
    .addDropdown(dropdown=>{
      Object.keys(systemPrompts).forEach(key=>dropdown.addOption(key,key));
      dropdown
      .setValue(agentTask)
      .onChange(value => {
        dirty = true;
        agentTask = value;
        systemPromptTextArea.setValue(systemPrompts[value].prompt);
      });
   })

  contentEl.createEl("h4", {text: "Customize System Prompt"});
  contentEl.createEl("span", {text: "Unless you know what you are doing I do not recommend changing the system prompt"})
  const systemPromptSetting = new ea.obsidian.Setting(contentEl)
    .addTextArea(text => {
       systemPromptTextArea = text;
       text.inputEl.style.minHeight = "10em";
       //text.inputEl.style.minWidth = "400px";
       text.inputEl.style.width = "100%";
       text.setValue(systemPrompts[agentTask].prompt);
       text.onChange(value => {
         systemPrompts[value].prompt = value;
       })
    })
  systemPromptSetting.nameEl.style.display = "none";
  systemPromptSetting.descEl.style.display = "none";
  systemPromptSetting.infoEl.style.display = "none";

  contentEl.createEl("h4", {text: "User Prompt"});
  const userPromptSetting = new ea.obsidian.Setting(contentEl)
    .addTextArea(text => {
       text.inputEl.style.minHeight = "10em";
       //text.inputEl.style.minWidth = "400px";
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

  if(imageDataURL) {
    previewDiv = contentEl.createDiv({
      attr: {
        style: "text-align: center;",
      }
    });
    previewImg = previewDiv.createEl("img",{
      attr: {
        style: `max-width: 100%;max-height: 30vh;`,
        src: imageDataURL,
      }
    });
  } else {
    contentEl.createEl("h4", {text: "No elements are selected"});
    contentEl.createEl("span", {text: "Because there are no Excalidraw elements selected on the canvas, only the text prompt will be sent to OpenAI."});
  }
  
  new ea.obsidian.Setting(contentEl)
    .addButton(button => 
      button
      .setButtonText("Run")
      .onClick((event)=>{
        setTimeout(()=>{run(userPrompt)},500); //Obsidian crashes otherwise, likely has to do with requesting an new frame for react
        configModal.close();
      })
    );
}
  
configModal.onClose = () => {
  if(dirty) {
    settings["User Prompt"] = userPrompt;
    settings["Agent's Task"] = agentTask;
    ea.setScriptSettings(settings);
  }
}
  
configModal.open();
