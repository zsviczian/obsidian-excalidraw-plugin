# Excalidraw Automate How To

Excalidraw Automate allows you to create Excalidraw drawings using the [Templater](https://github.com/SilentVoid13/Templater) plugin.

With a little work, using Excalidraw Automate you can generate simple mindmaps, fill out SVG forms, create customized charts, etc. based on documents in your vault.

You can access Excalidraw Automate via the ExcalidrawAutomate object. I recommend starting your Automate scripts with the following code.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
const ea = ExcalidrawAutomate;
ea.reset();
```

The first line creates a practical constant so you can avoid writing ExcalidrawAutomate 100x times.

The second line resets ExcalidrawAutomate to defaults. This is important as you will not know which template you executed before, thus you won't know what state you left Excalidraw in.

## Basic logic of using Excalidraw Automate
1. Set the styling of the elements you want to draw
2. Add elements. As you add elements, each new element is added one layer above the previous, thus in case of overlapping objects the later one will be on the top of the prior one.
3. Call `await ea.create();` to instantiate the drawing

You can change styling between adding different elements. My logic for separating element styling and creation is based on the assumption that you will probably set a stroke color, stroke style, stroke roughness, etc. and draw most of your elements using this. There would be no point in setting all these parameters each time you add an element.

### Before we dive deeper, here are two a simple example scripts
#### Create a new drawing with custom name, in a custom folder, using a template
This simple script gives you significant additional flexibility over Excalidraw Plugin settings to name your drawings, place them into folders, and to apply templates.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  await ea.create({
    filename    : tp.date.now("HH.mm"), 
    foldername  : tp.date.now("YYYY-MM-DD"),
    templatePath: "Excalidraw/Template1.excalidraw",
    onNewPane   : false
  });
%>
```

#### Create a simple drawing
*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.addRect(-150,-50,450,300);
  ea.addText(-100,70,"Left to right");
  ea.addArrow([[-100,100],[100,100]]);

  ea.style.strokeColor = "red";
  ea.addText(100,-30,"top to bottom",{width:200,textAligh:"center"});
  ea.addArrow([[200,0],[200,200]]);
  await ea.create();
%>
```
The script will generate the following drawing:

![FristDemo](https://user-images.githubusercontent.com/14358394/116825643-6e5a8b00-ab90-11eb-9e3a-37c524620d0d.png)

## Attributes and functions at a glance
Here's the interface implemented by ExcalidrawAutomate:
*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
ExcalidrawAutomate: {
  style: {
    strokeColor: string;
    backgroundColor: string;
    angle: number;
    fillStyle: FillStyle;
    strokeWidth: number;
    storkeStyle: StrokeStyle;
    roughness: number;
    opacity: number;
    strokeSharpness: StrokeSharpness;
    fontFamily: FontFamily;
    fontSize: number;
    textAlign: string;
    verticalAlign: string;
    startArrowHead: string;
    endArrowHead: string;
  }
  canvas: {theme: string, viewBackgroundColor: string};
  setFillStyle: Function;
  setStrokeStyle: Function;
  setStrokeSharpness: Function;
  setFontFamily: Function;
  setTheme: Function;
  addRect: Function;
  addDiamond: Function;
  addEllipse: Function;
  addText: Function;
  addLine: Function;
  addArrow: Function;
  connectObjects: Function;
  addToGroup: Function;
  toClipboard: Function;
  create: Function;
  createPNG: Function;
  createSVG: Function;
  clear: Function;
  reset: Function;
};
```

## Element Style
As you will notice, some styles have setter functions. This is to help you navigate the allowed values for the property. You do not need to use the setter function however, you can use set the value directly as well.

### strokeColor
String. The color of the line. [CSS Legal Color Values](https://www.w3schools.com/cssref/css_colors_legal.asp)

Allowed values are [HTML color names](https://www.w3schools.com/colors/colors_names.asp), hexadecimal RGB strings, or  e.g. `#FF0000` for red.

### backgroundColor
String. This is the fill color of an object. [CSS Legal Color Values](https://www.w3schools.com/cssref/css_colors_legal.asp)

Allowed values are [HTML color names](https://www.w3schools.com/colors/colors_names.asp), hexadecimal RGB strings e.g. `#FF0000` for red, or `transparent`.

### angle
Number. Rotation in radian. 90° == `Math.PI/2`.

### fillStyle, setFillStyle()
```typescript
type FillStyle = "hachure" | "cross-hatch" | "solid";
setFillStyle (val:number);
```
fillStyle is a string.

`setFillStyle()` accepts a number:
- 0: "hachure"
- 1: "cross-hatch"
- any other number: "solid"

### strokeWidth
Number, sets the width of the stroke.

### strokeStyle, setStrokeStyle()
```typescript
type StrokeStyle = "solid" | "dashed" | "dotted";
setStrokeStyle (val:number);
```
strokeStyle is a string. 

`setStrokeStyle()` accepts a number:
- 0: "solid"
- 1: "dashed"
- any other number: "dotted"

### roughness
Number. Called sloppiness in Excalidraw. Three values are accepted:
- 0: Architect
- 1: Artist
- 2: Cartoonist

### opacity
Number between 0 and 100. The opacity of an object, both stroke and fill.

### strokeSharpness, setStrokeSharpness()
```typescript
type StrokeSharpness = "round" | "sharp";
setStrokeSharpness(val:nmuber);
```
strokeSharpness is a string.

"round" lines are curvey, "sharp" lines break at the turning point.

`setStrokeSharpness()` accepts a number:
- 0: "round"
- any other number: "sharp"

### fontFamily, setFontFamily()
Number. Valid values are 1,2 and 3.

`setFontFamily()` will also accept a number and return the name of the font.
- 1: "Virgil, Segoe UI Emoji"
- 2: "Helvetica, Segoe UI Emoji"
- 3: "Cascadia, Segoe UI Emoji"

### fontSize
Number. Default value is 20 px

### textAlign
String. Alignment of the text horizontally. Valid values are "left", "center", "right".

This is relevant when setting a fix width using the `addText()` function.

### verticalAlign
String. Alignment of the text vertically. Valid values are "top" and "middle".

This is relevant when setting a fix height using the `addText()` function.

### startArrowHead, endArrowHead
String. Valid values are "arrow", "bar", "dot", and "none". Specifies the beginning and ending of an arrow.

This is relavant when using the `addArrow()` and the `connectObjects()` functions.

## canvas
Sets the properties of the canvas. 

### theme, setTheme()
String. Valid values are "light" and "dark".

`setTheme()` accepts a number:
- 0: "light"
- any other number: "dark"

### viewBackgroundColor
String. This is the fill color of an object. [CSS Legal Color Values](https://www.w3schools.com/cssref/css_colors_legal.asp)

Allowed values are [HTML color names](https://www.w3schools.com/colors/colors_names.asp), hexadecimal RGB strings e.g. `#FF0000` for red, or `transparent`.

## Adding objects
These functions will add objects to your drawing. The canvas is infinite, and it accepts negative and positive X and Y values. X values increase left to right, Y values increase top to bottom.

![coordinates](https://user-images.githubusercontent.com/14358394/116825632-6569b980-ab90-11eb-827b-ada598e91e46.png)

### addRect(), addDiamond(), addEllipse()
```typescript
addRect(topX:number, topY:number, width:number, height:number):string
addDiamond(topX:number, topY:number, width:number, height:number):string
addEllipse(topX:number, topY:number, width:number, height:number):string
```
Returns the `id` of the object. The `id` is required when connecting objects with lines. See later.

### addText
```typescript
addText(topX:number, topY:number, text:string, formatting?:{width:number, height:number,textAlign: string, verticalAlign:string, box: boolean, boxPadding: number}):string
```

Adds text to the drawing. 

Formatting parameters are optional:
- If `width` and `height` are not specified, the function will calculate the width and height based on the fontFamily, the fontSize and the text provided.
- In case you want to position a text in the center compared to other elements on the drawing, you can provide a fixed height and width, and you can also specify `textAlign` and `verticalAlign` as described above. e.g.: `{width:500, textAlign:"center"}`
- If you want to add a box around the text, set `{box:true}`

Returns the `id` of the object. The `id` is required when connecting objects with lines. See later. If `{box:true}` then returns the id of the enclosing box.

### addLine()
```typescript
addLine(points: [[x:number,y:number]]):void
```
Adds a line following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if `strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

### addArrow()
```typescript
addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead:string,endArrowHead:string,startObjectId:string,endObjectId:string}):void
```

Adds an arrow following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if element `style.strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

`startArrowHead` and `endArrowHead` specify the type of arrow head to use, as described above. Valid values are "none", "arrow", "dot", and "bar". e.g. `{startArrowHead: "dot", endArrowHead: "arrow"}`

`startObjectId` and `endObjectId` are the object id's of connected objects. I recommend using `connectObjects` instead calling addArrow() for the purpose of connecting objects.

### connectObjects()
```typescript
declare type ConnectionPoint = "top"|"bottom"|"left"|"right";
connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void
```
Connects two objects with an arrow.

`objectA` and `objectB` are strings. These are the ids of the objects to connect. These IDs are returned by addRect(), addDiamond(), addEllipse() and addText() when creating those objects.

`connectionA` and `connectionB` specify where to connect on the object. Valid values are: "top", "bottom", "left", and "right".

`numberOfPoints` set the number of interim break points for the line. Default value is zero, meaning there will be no breakpoint in between the start and the end points of the arrow. When moving objects on the drawing, these breakpoints will influence how the line is rerouted by Excalidraw.

`startArrowHead` and `endArrowHead` work as described for `addArrow()` above.

### addToGroup()
```typescript
addToGroup(objectIds:[]):void
```
Groups objects listed in `objectIds`.

## Utility functions
### clear()
`clear()` will clear objects from cache, but will retain element style settings.

### reset()
`reset()` will first call `clear()` and then reset element style to defaults.

### toClipboard()
```typescript
async toClipboard(templatePath?:string)
```
Places the generated drawing to the clipboard. Useful when you don't want to create a new drawing, but want to paste additional items onto an existing drawing.

### create()
```typescript
async create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean})
```
Creates the drawing and opens it.

`filename` is the filename without extension of the drawing to be created. If `null`, then Excalidraw will generate a filename.

`foldername` is the folder where the file should be created. If `null` then the default folder for new drawings will be used according to Excalidraw settings.

`templatePath` the filename including full path and extension for a template file to use. This template file will be added as the base layer, all additional objects added via ExcalidrawAutomate will appear on top of elements in the template. If `null` then no template will be used, i.e. an empty white drawing will be the base for adding objects.

`onNewPane` defines where the new drawing should be created. `false` will open the drawing on the current active leaf. `true` will open the drawing by vertically splitting the current leaf.

Example:
```javascript
create({filename:"my drawing", foldername:"myfolder/subfolder/", templatePath: "Excalidraw/template.excalidraw", onNewPane: true});
```
### createSVG()
```typescript
async createSVG(templatePath?:string)
```
Returns an HTML SVGSVGElement containing the generated drawing.

### createPNG()
```typescript
async createPNG(templatePath?:string)
```
Returns a blob containing a PNG image of the generated drawing.

## Examples
### Insert new drawing into currently edited document
This template will prompt you for the title of the drawing. It will create a new drawing with the provided title, and in the folder of the document you were editing. It will then transclude the new drawing at the cursor location and open the new drawing in a new workspace leaf by splitting the current leaf.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const defaultTitle = tp.date.now("HHmm")+' '+tp.file.title;
  const title = await tp.system.prompt("Title of the drawing?", defaultTitle);
  const folder = tp.file.folder(true);
  const transcludePath = (folder== '/' ? '' : folder + '/') + title + '.excalidraw';
  tR = String.fromCharCode(96,96,96)+'excalidraw\n[['+transcludePath+']]\n'+String.fromCharCode(96,96,96);
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.setTheme(1); //set Theme to dark
  await ea.create({
    filename : title,
    foldername : folder,
    //templatePath: 'Excalidraw/Template.excalidraw', //uncomment if you want to use a template
    onNewPane : true
  });
%>
```

### Connect objects
*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.addText(-130,-100,"Connecting two objects");
  const a = ea.addRect(-100,-100,100,100);
  const b = ea.addEllipse(200,200,100,100);
  ea.connectObjects(a,"bottom",b,"left",{numberOfPoints: 2}); //see how the line breaks differently when moving objects around
  ea.style.strokeColor = "red";
  ea.connectObjects(a,"right",b,"top",1);
  await ea.create();
%>
```
### Using a template
This example is similar to the first one, but rotated 90°, and using a template, plus specifying a filename and folder to save the drawing, and opening the new drawing in a new pane.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.style.angle = Math.PI/2; 
  ea.style.strokeWidth = 3.5;
  ea.addRect(-150,-50,450,300);
  ea.addText(-100,70,"Left to right");
  ea.addArrow([[-100,100],[100,100]]);

  ea.style.strokeColor = "red";
  await ea.addText(100,-30,"top to bottom",{width:200,textAlign:"center"});
  ea.addArrow([[200,0],[200,200]]);
  await ea.create({filename:"My Drawing",foldername:"myfolder/fordemo/",templatePath:"Excalidraw/Template2.excalidraw",onNewPane:true});
%>
```

### Generating a simple mindmap from a text outline
This is a slightly more elaborate example. This will generate an a mindmap from a tabulated outline.

![Drawing 2021-05-05 20 52 34](https://user-images.githubusercontent.com/14358394/117194124-00a69d00-ade4-11eb-8b75-5e18a9cbc3cd.png)

Example input:
```
- Test 1
	- Test 1.1
- Test 2
	- Test 2.1
	- Test 2.2 
		- Test 2.2.1
		- Test 2.2.2
		- Test 2.2.3
			- Test 2.2.3.1
- Test 3
	- Test 3.1
```

The script:

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
const IDX = Object.freeze({"depth":0, "text":1, "parent":2, "size":3, "children": 4, "objectId":5});

//check if an editor is the active view
const editor = this.app.workspace.activeLeaf?.view?.editor;
if(!editor) return;

//initialize the tree with the title of the document as the first element
let tree = [[0,this.app.workspace.activeLeaf?.view?.getDisplayText(),-1,0,[],0]];
const linecount = editor.lineCount();

//helper function, use regex to calculate indentation depth, and to get line text
function getLineProps (i) {
  props = editor.getLine(i).match(/^(\t*)-\s+(.*)/);
  return [props[1].length+1, props[2]];
}

//a vector that will hold last valid parent for each depth
let parents = [0];

//load outline into tree
for(i=0;i<linecount;i++) {
  [depth,text] = getLineProps(i);
  if(depth>parents.length) parents.push(i+1);
  else parents[depth] = i+1;
  tree.push([depth,text,parents[depth-1],1,[]]);
  tree[parents[depth-1]][IDX.children].push(i+1);
}

//recursive function to crawl the tree and identify height aka. size of each node
function crawlTree(i) {
  if(i>linecount) return 0;
  size = 0;
  if((i+1<=linecount && tree[i+1][IDX.depth] <= tree[i][IDX.depth])|| i == linecount) { //I am a leaf
    tree[i][IDX.size] = 1; 
    return 1; 
  }
  tree[i][IDX.children].forEach((node)=>{ 
    size += crawlTree(node);
  });
  tree[i][IDX.size] = size; 
  return size;   
}

crawlTree(0);

//Build the mindmap in Excalidraw
const width = 300;
const height = 100;
const ea = ExcalidrawAutomate;
ea.reset();

//stores position offset of branch/leaf in height units
offsets = [0];

for(i=0;i<=linecount;i++) {
  depth = tree[i][IDX.depth];
  if (depth == 1) ea.style.strokeColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16);
  tree[i][IDX.objectId] = ea.addText(depth*width,((tree[i][IDX.size]/2)+offsets[depth])*height,tree[i][IDX.text],{box:true});  
  //set child offset equal to parent offset
  if((depth+1)>offsets.length) offsets.push(offsets[depth]);
  else offsets[depth+1] = offsets[depth];
  offsets[depth] += tree[i][IDX.size];
  if(tree[i][IDX.parent]!=-1) {
    ea.connectObjects(tree[tree[i][IDX.parent]][IDX.objectId],"right",tree[i][IDX.objectId],"left",{startArrowHead: 'dot'});
  }
}

await ea.create({onNewPane: true});
%>
```
