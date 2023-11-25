/*
Based on https://github.com/SawyerHood/draw-a-ui

<iframe width="560" height="315" src="https://www.youtube.com/embed/y3kHl_6Ll4w" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-draw-a-ui.jpg)
```js*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.2")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["OPENAI_API_KEY"]) {
  settings = {
    "OPENAI_API_KEY" : {
      value: "",
      description: `Get your api key at <a href="https://platform.openai.com/">https://platform.openai.com/</a><br>⚠️ Note that the gpt-4-vision-preview 
        requires a minimum of $5 credit on your account.`
    },
    "FOLDER" : {
	    value: "GPTPlayground",
	    description: `The folder in your vault where you want to store generated html pages`
    },
    "FILENAME": {
      value: "page",
      description: `The base name of the html file that will be created. Each time you run the script 
        a new file will be created using the following pattern "filename_i" where i is a counter`
    }
  };
  await ea.setScriptSettings(settings);
}

const OPENAI_API_KEY = settings["OPENAI_API_KEY"].value;
const FOLDER = settings["FOLDER"].value;
const FILENAME = settings["FILENAME"].value;

if(OPENAI_API_KEY==="") {
  new Notice("Please set an OpenAI API key in plugin settings");
  return;
}

const systemPrompt = `You are an expert tailwind developer. A user will provide you with a
 low-fidelity wireframe of an application and you will return 
 a single html file that uses tailwind to create the website.
 Use creative license to make the application more fleshed out. Write the necessary javascript code. 
 If you need to insert an image, use placehold.co to create a placeholder image.
 Respond only with the html file.`;

const post = async (request) => {
  const { image } = await request.json();
  const body = {
    model: "gpt-4-vision-preview",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: image,
          },
          "Turn this into a single html file using tailwind.",
        ],
      },
    ],
  };

  let json = null;
  try {
    const resp = await requestUrl ({
      url: "https://api.openai.com/v1/chat/completions",
      method: "post",
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      throw: false
    });
    json = resp.json;
  } catch (e) {
    console.log(e);
  }

  return json;
}

const blobToBase64 = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  var binary = '';
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const getRequestObjFromSelectedElements = async (view) => {
    await view.forceSave(true);
    const viewElements = ea.getViewSelectedElements();
    if(viewElements.length === 0) {
      new Notice ("Aborting because there is nothing selected.",4000);
      return;
    }
    ea.copyViewElementsToEAforEditing(viewElements);
    const bb = ea.getBoundingBox(viewElements);
    const size = (bb.width*bb.height);
    const minRatio = Math.sqrt(360000/size);
    const maxRatio = Math.sqrt(size/16000000);
    const scale = minRatio > 1 
      ? minRatio
      : (
          maxRatio > 1 
          ? 1/maxRatio
          : 1
        );
	
    const loader = ea.getEmbeddedFilesLoader(false);
    const exportSettings = {
      withBackground: true,
      withTheme: true,
    };

    const img =
      await ea.createPNG(
        null,
        scale,
        exportSettings,
        loader,
        "light",
      );
    const dataURL = `data:image/png;base64,${await blobToBase64(img)}`;
    ea.clear();
    return { json: async () => ({ image: dataURL }) }
  }

const extractHTMLFromString = (result) => {
  if(!result) return null;
  const start = result.indexOf('```html\n');
  const end = result.lastIndexOf('```');
  if (start !== -1 && end !== -1) {
    const htmlString = result.substring(start + 8, end);
    return htmlString.trim();
  }
  return null;
}

const checkAndCreateFolder = async (folderpath) => {
  const vault = app.vault;
  folderpath = ea.obsidian.normalizePath(folderpath);
  const folder = vault.getAbstractFileByPathInsensitive(folderpath);
  if (folder) {
    return folder;
  }
  return await vault.createFolder(folderpath);
}

const getNewUniqueFilepath = (filename, folderpath) => {
  let fname = ea.obsidian.normalizePath(`${folderpath}/${filename}.html`);
  let file = app.vault.getAbstractFileByPath(fname);
  let i = 0;
  while (file) {
    fname = ea.obsidian.normalizePath(`${folderpath}/${filename}_${i++}.html`);
    file = app.vault.getAbstractFileByPath(fname);
  }
  return fname;
}

const requestObject = await getRequestObjFromSelectedElements(ea.targetView);
const result = await post(requestObject);

const errorMessage = () => {
  new Notice ("Something went wrong! Check developer console for more.");
  console.log(result);
}

if(!result?.hasOwnProperty("choices")) {
  errorMessage();
  return;
}

const htmlContent = extractHTMLFromString(result.choices[0]?.message?.content);

if(!htmlContent) {
  errorMessage();
  return;
}

const folder = await checkAndCreateFolder(FOLDER);
const filepath = getNewUniqueFilepath(FILENAME,folder.path);
const file = await app.vault.create(filepath,htmlContent);
const url = app.vault.adapter.getFilePath(file.path).toString();
const bb = ea.getBoundingBox(ea.getViewSelectedElements());
ea.addEmbeddable(bb.topX+bb.width+40,bb.topY,600,800,url);
await ea.addElementsToView(false,true);
ea.viewZoomToElements([]);