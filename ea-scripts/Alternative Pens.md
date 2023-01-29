/* 
IF YOU ACCIDENTLY MODIFY THIS FILE AND IT STOPS WORKING, SIMPLY DOWNLOAD IT AGAIN FROM THE SCRIPT LIBRARY.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-alternative-pens.jpg)

# How to create a new pen template
It takes a bit of experimentation and skill to create a new pen, so be patient.

1. Create a folder in your Vault for your pen options. The default is `Excalidraw/Pens`.
2. Create a new markdown file in your in the `pen folder` (e.g. `My pen`).
3. Copy the following template to the markdown file.
```json
{
  "highlighter": true,
  "constantPressure": false,
  "hasOutline": true,
  "outlineWidth": 4,
  "options": PASTE_PREFECT_FREEHAND_OPTIONS_HERE 
}
```
4. If you don't want your pen to have an outline around your line, change `hasOutline` to `false`. You can also modify `outlineWidth` if you want a thinner or thicker outline around your line.
5. If you want your pen to be pressure sensitive (when drawing with a mouse the pressure is simulated based on the speed of your hand) leave `constantPressure` as `false`. If you want a constant line width regardless of speed and pen pressure, change it to `true`.
6. `highlighter` true will place the new line behind the existing strokes (i.e. like a highlighter pen). If `highlighter` is missing or it is set to `false` the new line will appear at the top of the existing strokes (the default behavior of Excalidraw pens).
7. Go to https://perfect-freehand-example.vercel.app/ and configure your pen. 
8. Click `Copy Options`.
9. Go back to the pen file you created in step No.2 and replace the placeholder text with the options you just copied from perfect-freehand.
10. Look for `easing` in the file and replace the function e.g. `(t) => t*t,` with the name of the function in brackets (in this example it would be `easeInQuad`). You will find the function name on the perfect-freehand website, only change the first letter to be lower case. 
11. Test your pen in Excalidraw by clicking the `Alternative Pens` script and selecting your new pen.

# Example pens
My pens: https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/ea-scripts/pens

**Fine tipped pen:**
```json
{
  constantPressure: true,
  options: {
    smoothing: 0.4,
    thinning: -0.5,
    streamline: 0.4,
    easing: "linear",
    start: {
      taper: 5,
      cap: false,
    },
    end: {
      taper: 5,
      cap: false,
    },
  }
}
```

**Thick marker:**
```json
{
  constantPressure: true,
  hasOutline: true,
  outlineWidth: 4,
  options: {
    thinning: 1,
    smoothing: 0.5,
    streamline: 0.5,
    easing: "linear",
    start: {
      taper: 0,
      cap: true
    },
    end: {
      taper: 0,
      cap: true
    }
  }
}
```

**Fountain pen:**
```json
{
  options: {
    smoothing: 0.22,
    thinning: 0.8,
    streamline: 0.22,
    easing: "easeInQuad",
    start: {
      taper: true,
      cap: true,
    },
    end: {
      taper: 1,
      cap: true,
    },
  }
}
```
# Notes about the pen options

Note, that custom pens are currently not supported by Excalidraw.com. I've submitted a [PR](https://github.com/excalidraw/excalidraw/pull/6069) but there is no guarantee that it will get pushed to production. Your Excalidraw drawing can still be loaded to Excalidraw, but the special pen effects will not be visible there.

If you set a pen in your Excalidraw template file, that pen will be loaded automatically when you create a file using that template. Similarly, when you save a document, it will save your current pen settings as well. The next time you open the document, you can continue to use the same pen.

Pen options are saved with the stroke. This means, that even if you change the ped definition later on, your existing drawings will not be effected.

`outlineWidth` is relative to `strokeWidth`. i.e. if you make the stroke thinner in Excalidraw, the outline will become proportionally thinner as well. `outlineWidth` is only used if `hasOutline` is set to true.

If you don't want your pen to be pressure/speed sensitive, set `constantPressure` to `true`. Setting `constantPressure` to `true` automatically sets `simulatePressure` to `false`.

If you want your pen to be speed sensitive (i.e. the faster you draw the line the thinner it gets), set `options.simulatePressure` to `true`.  If you omit `simulatePressure` from `options` then excalidraw will detect if you are drawing with a mouse or a pen and use pen pressures if available.

You can read more about configuring perfect freehand here: https://github.com/steveruizok/perfect-freehand#documentation

Excalidraw supports all of the easing functions listed here: https://easings.net/#, plus "linear". You can also find details about these easing functions here:
https://github.com/ai/easings.net/blob/master/src/easings/easingsFunctions.ts

From a performance perspective I recommend linear easing.

# The script

```javascript */

//--------------------------
// Load settings
//--------------------------
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.8")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const api = ea.getExcalidrawAPI();
let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Pen folder"]) {
  settings = {
    "Pen folder" : {
      value: "Excalidraw/Pens",
      description: "The path to the folder where you store the perfect freehand options"
    }
  };
  ea.setScriptSettings(settings);
}

let penFolder = settings["Pen folder"].value.toLowerCase();
if(penFolder === "" || penFolder === "/") {
  new Notice("The pen folder cannot be the root folder of your vault");
  return;
}

if(!penFolder.endsWith("/")) penFolder += "/";


//--------------------------
// Select pen
//--------------------------
const pens = app.vault.getFiles()
  .filter(f=>f.extension === "md" && f.path.toLowerCase() === penFolder + f.name.toLowerCase())
  .sort((a,b)=>a.basename.toLowerCase()<b.basename.toLowerCase()?-1:1);
if(pens.length === 0) {
  const notice = new Notice(`You don't seem to have any pen definition files. Click this message to open the how-to guide.`,4000);
  notice.noticeEl.onclick = async () => app.workspace.openLinkText(utils.scriptFile.path,"","tab");
  return;
}
const file = await utils.suggester(["Excalidraw Default"].concat(pens.map(f=>(f.name.slice(0,f.name.length-3)))),["Default"].concat(pens), "Choose a pen preset, press ESC to abort");
if(!file) return;

if(file === "Default") {
  api.updateScene({
    appState: {
	    currentStrokeOptions: undefined
    }
  });
  return;
}

//--------------------------
// Load pen
//--------------------------
const pen = await app.vault.read(file);

const parseJSON = (data) => {
  try {
    return JSON.parse(data);
  } catch(e) {
	try {
	return JSON.parse(data.replaceAll(/\s(\w*)\:\s/g,' "$1": ').replaceAll(/,([^\w]*?})/gm,"$1"));
	} catch(ee) {
	  const notice = new Notice(`Error loading the pen file. Maybe you accidently copy/pasted the easing function from perfect freehand website? Check the error message in Developer Console.\n(click=dismiss, right-click=Info) `,5000);
	  notice.noticeEl.oncontextmenu = async () => app.workspace.openLinkText(utils.scriptFile.path,"","tab");
	  console.error(ee);
	  console.error(data.replaceAll(/\s(\w*)\:\s/g,' "$1": ').replaceAll(/,([^\w]*?})/gm,"$1"));
	  return;
	}
  }
}

penJSON = parseJSON(pen);


if(!penJSON || typeof penJSON !== 'object') return;

//--------------------------
// Apply pen
//--------------------------
await api.updateScene({
  appState: {
    currentStrokeOptions: penJSON
    }
  });
api.setActiveTool({type:"freedraw"});
