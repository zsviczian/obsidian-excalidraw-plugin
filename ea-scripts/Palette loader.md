/*


<iframe width="560" height="315" src="https://www.youtube.com/embed/epYNx2FSf2w" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
Link:: https://youtu.be/epYNx2FSf2w

<iframe width="560" height="315" src="https://www.youtube.com/embed/diBT5iaoAYo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
Link:: https://youtu.be/diBT5iaoAYo

Design your palette at http://paletton.com/
Once you are happy with your colors, click Tables/Export in the bottom right of the screen:
![|400](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-sketch-palette-loader-1.jpg)
Then click "Color swatches/as Sketch Palette"

![|400](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-sketch-palette-loader-2.jpg)
Copy the contents of the page to a markdown file in your vault. Place the file in the Excalidraw/Palettes folder (you can change this folder in settings).

![|400](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-sketch-palette-loader-3.jpg)

![|400](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-sketch-palette-loader-4.jpg)

Excalidraw  appState Custom Palette Data Object:
```js
colorPalette: {
  canvasBackground: [string, string, string, string, string][] | string[],
  elementBackground: [string, string, string, string, string][] | string[],
  elementStroke: [string, string, string, string, string][] | string[],
  topPicks: {
    canvasBackground: [string, string, string, string, string],
    elementStroke: [string, string, string, string, string],
    elementBackground: [string, string, string, string, string] 
  },
}

*/
//--------------------------
// Load settings
//--------------------------
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.9.2")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const api = ea.getExcalidrawAPI();
let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Palette folder"]) {
  settings = {
    "Palette folder" : {
      value: "Excalidraw/Palettes",
      description: "The path to the folder where you store the Excalidraw Palettes"
    },
    "Light-gray" : {
      value: "#505050",
      description: "Base light-gray used for mixing with the accent color to generate the palette light-gray"
    },
    "Dark-gray" : {
      value: "#e0e0e0",
      description: "Base dark-gray used for mixing with the accent color to generate the palette dark-gray"
    }
  };
  ea.setScriptSettings(settings);
}

const lightGray = settings["Light-gray"].value;
const darkGray = settings["Dark-gray"].value;

let paletteFolder = settings["Palette folder"].value.toLowerCase();
if(paletteFolder === "" || paletteFolder === "/") {
  new Notice("The palette folder cannot be the root folder of your vault");
  return;
}

if(!paletteFolder.endsWith("/")) paletteFolder += "/";


//-----------------------
// UPDATE CustomPalette
//-----------------------
const updateColorPalette = (paletteFragment) => {
  const st = ea.getExcalidrawAPI().getAppState();
  colorPalette = st.colorPalette ?? {};
  if(paletteFragment?.topPicks) {
    if(!colorPalette.topPicks) {
      colorPalette.topPicks = {
        ...paletteFragment.topPicks
      };
    } else {
      colorPalette.topPicks = {
        ...colorPalette.topPicks,
        ...paletteFragment.topPicks
      }
    }
  } else {
    colorPalette = {
      ...colorPalette,
      ...paletteFragment
    }
  }
  ea.viewUpdateScene({appState: {colorPalette}});
  ea.addElementsToView(true,true); //elements is empty, but this will save the file
}


//----------------
// LOAD PALETTE
//----------------
const loadPalette = async () => {
  //--------------------------
  // Select palette
  //--------------------------
  const palettes = app.vault.getFiles()
    .filter(f=>f.extension === "md" && f.path.toLowerCase() === paletteFolder + f.name.toLowerCase())
    .sort((a,b)=>a.basename.toLowerCase()<b.basename.toLowerCase()?-1:1);
  const file = await utils.suggester(["Excalidraw Default"].concat(palettes.map(f=>f.name)),["Default"].concat(palettes), "Choose a palette, press ESC to abort");
  if(!file) return;

  if(file === "Default") {
    api.updateScene({
      appState: {
        colorPalette: {}
      }
    });
    return;
  }

  //--------------------------
  // Load palette
  //--------------------------
  const sketchPalette = await app.vault.read(file);

  const parseJSON = (data) => {
    try {
      return JSON.parse(data);
    } catch(e) {
	  return;
    }
  }

  const loadPaletteFromPlainText = (data) => {
    const colors = [];
    data.replaceAll("\r","").split("\n").forEach(c=>{
      c = c.trim();
      if(c==="") return;
      if(c.match(/[^hslrga-fA-F\(\d\.\,\%\s)#]/)) return;
      const cm = ea.getCM(c);
      if(cm) colors.push(cm.stringHEX({alpha: false}));
    })
    return colors;
  }

  const paletteJSON = parseJSON(sketchPalette);

  const colors = paletteJSON
    ? paletteJSON.colors.map(c=>ea.getCM({r:c.red*255,g:c.green*255,b:c.blue*255,a:c.alpha}).stringHEX({alpha: false}))
    : loadPaletteFromPlainText(sketchPalette);
  const baseColor = ea.getCM(colors[0]);

  // Add black, white, transparent, gary
  const palette = [[
    "transparent",
    "black",
    baseColor.mix({color: lightGray, ratio:0.95}).stringHEX({alpha: false}),
    baseColor.mix({color: darkGray, ratio:0.95}).stringHEX({alpha: false}),
    "white"
  ]];

  // Create Excalidraw palette
  for(i=0;i<Math.floor(colors.length/5);i++) {
    palette.push([
	  colors[i*5+1],
      colors[i*5+2],
      colors[i*5],
      colors[i*5+3],
      colors[i*5+4]
    ]);
  }

  const getShades = (c,type) => {
    cm = ea.getCM(c);
    const lightness = cm.lightness;
    if(lightness === 0 || lightness === 100) return c;

	switch(type) {
	  case "canvas":
        return [
          c,
          ea.getCM(c).lightnessTo((100-lightness)*0.5+lightness).stringHEX({alpha: false}),
          ea.getCM(c).lightnessTo((100-lightness)*0.25+lightness).stringHEX({alpha: false}),
          ea.getCM(c).lightnessTo(lightness*0.5).stringHEX({alpha: false}),
          ea.getCM(c).lightnessTo(lightness*0.25).stringHEX({alpha: false}),
        ];
      case "stroke":
        return [
          ea.getCM(c).lightnessTo((100-lightness)*0.5+lightness).stringHEX({alpha: false}),
	      ea.getCM(c).lightnessTo((100-lightness)*0.25+lightness).stringHEX({alpha: false}),
	      ea.getCM(c).lightnessTo(lightness*0.5).stringHEX({alpha: false}),
	      ea.getCM(c).lightnessTo(lightness*0.25).stringHEX({alpha: false}),
	      c,
        ];
      case "background":
        return [
          ea.getCM(c).lightnessTo((100-lightness)*0.5+lightness).stringHEX({alpha: false}),
          c,
          ea.getCM(c).lightnessTo((100-lightness)*0.25+lightness).stringHEX({alpha: false}),
          ea.getCM(c).lightnessTo(lightness*0.5).stringHEX({alpha: false}),
          ea.getCM(c).lightnessTo(lightness*0.25).stringHEX({alpha: false}),
        ];
	}
  }

  const paletteSize = palette.flat().length;
  const newPalette = {
    canvasBackground: palette.flat().map(c=>getShades(c,"canvas")),
    elementStroke: palette.flat().map(c=>getShades(c,"stroke")),
    elementBackground: palette.flat().map(c=>getShades(c,"background"))
  };


  //--------------------------
  // Check if palette has the same size as the current. Is re-paint possible?
  //--------------------------
  const oldPalette = api.getAppState().colorPalette;

  //You can only switch and repaint equal size palettes
  let canRepaint = Boolean(oldPalette) && Object.keys(oldPalette).length === 3 &&
    oldPalette.canvasBackground.length  === paletteSize &&
    oldPalette.elementBackground.length === paletteSize &&
    oldPalette.elementStroke.length     === paletteSize;

  //Check that the palette for canvas background, element stroke and element background are the same
  for(i=0;canRepaint && i<paletteSize;i++) {
    if(
      oldPalette.canvasBackground[i] !== oldPalette.elementBackground[i] ||
      oldPalette.canvasBackground[i] !== oldPalette.elementStroke[i]
    ) {
      canRepaint = false;
      break;
    }
  }

  const shouldRepaint = canRepaint && await utils.suggester(["Try repainting the drawing with the new palette","Just load the new palette"], [true, false],"ESC will load the palette without repainting");


  //--------------------------
  // Apply palette
  //--------------------------
  if(shouldRepaint) {
    const map = new Map();
    for(i=0;i<paletteSize;i++) {
      map.set(oldPalette.canvasBackground[i],newPalette.canvasBackground[i])
    }

    ea.copyViewElementsToEAforEditing(ea.getViewElements());
    ea.getElements().forEach(el=>{
      el.strokeColor = map.get(el.strokeColor)??el.strokeColor;
      el.backgroundColor = map.get(el.backgroundColor)??el.backgroundColor;
    })

    const canvasColor = api.getAppState().viewBackgroundColor;

    await api.updateScene({
      appState: {
        viewBackgroundColor: map.get(canvasColor)??canvasColor
      }
    });

    ea.addElementsToView();
  }
  updateColorPalette(newPalette);
}

//-------------
// TOP PICKS
//-------------
const topPicks = async () => {
  const elements = ea.getViewSelectedElements().filter(el=>["rectangle", "diamond", "ellipse", "line"].includes(el.type));
  if(elements.length !== 5) {
    new Notice("Select 5 elements, the script will use the background color of these elements",6000);
    return;
  }

  const colorType = await utils.suggester(["View Background", "Element Background", "Stroke"],["view", "background", "stroke"], "Which top-picks would you like to set?");

  if(!colorType) {
    new Notice("You did not select which color to set");
    return;
  }

  const topPicks = elements.map(el=>el.backgroundColor);
  switch(colorType) {
    case "view": updateColorPalette({topPicks: {canvasBackground: topPicks}}); break;
    case "stroke": updateColorPalette({topPicks: {elementStroke: topPicks}}); break;
    default: updateColorPalette({topPicks: {elementBackground: topPicks}}); break;
  }
}

//-----------------------------------
// Copy palette from another file
//-----------------------------------
const copyPaletteFromFile = async () => {
  const files = app.vault.getFiles().filter(f => ea.isExcalidrawFile(f)).sort((a,b)=>a.name > b.name ? 1 : -1);
  const file = await utils.suggester(files.map(f=>f.path),files,"Select the file to copy from");
  if(!file) {
    return;
  }
  scene = await ea.getSceneFromFile(file);
  if(!scene || !scene.appState) {
	  new Notice("unknown error");
	  return;
  }
  ea.viewUpdateScene({appState: {colorPalette: {...scene.appState.colorPalette}}});
  ea.addElementsToView(true,true);
}

//----------
// START
//----------
const action = await utils.suggester(
  ["Load palette from file", "Set top-picks based on the background color of 5 selected elements", "Copy palette from another Excalidraw File"],
  ["palette","top-picks","copy"]
);
if(!action) return;

switch(action) {
  case "palette": loadPalette(); break;
  case "top-picks": topPicks(); break;
  case "copy": copyPaletteFromFile(); break;
}