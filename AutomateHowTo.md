# Excalidraw Automate How To

Excalidraw Automate allows you to create Excalidraw drawings using the [Templater](https://github.com/SilentVoid13/Templater) plugin.

With a little work, using Excalidraw Automate you can generate simple mindmaps, fill out SVG forms, create customized charts, etc. based on documents in your vault.

You can access Excalidraw Automate via the ExcalidrawAutomate object. I recommend staring your Automate scripts with the following code.

```javascript
const ea = ExcalidrawAutomate;
ea.reset();
```

The first line creates a practical constant so you can avoid writing ExcalidrawAutomate 100x times.

The second line resets ExcalidrawAutomate to defaults. This is important as you will not know which template you executed before, thus you won't know what state you left Excalidraw in.

## Basic logic of using Excalidraw Automate
1. Set the styling of the elements you want to draw
2. Add elements. As you add elements, each new element is added one layer above the previous, thus in case of overlapping objects the later one will be on the top of the prior one.
3. Call `await create();` to instantiate the drawing

You can change styling between adding different elements. My logic for separating element styling and creation is based on the assumption that you will probably set a stroke color, stroke style, stroke roughness, etc. and draw most of your elements using this. There would be no point in setting all these parameters each time you add an element.

### Before we dive deeper, here's a simple example script
```javascript
<%*
    const ea = ExcalidrawAutomate;
	ea.reset();
	ea.addRect(-150,-50,450,300);
	await ea.addText(-100,70,"Left to right");
	ea.addArrow([[-100,100],[100,100]]);

    ea.style.strokeColor = "red";
	await ea.addText(100,-30,"top to bottom",200,null,"center");
	ea.addArrow([[200,0],[200,200]]);
	await ea.create();
%>
```
The script will generate the following drawing:

![FristDemo](https://user-images.githubusercontent.com/14358394/116825643-6e5a8b00-ab90-11eb-9e3a-37c524620d0d.png)

## Attributes and functions at a glance
Here's the interface implemented by ExcalidrawAutomate:

```typescript
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
	create: Function;
	addRect: Function;
	addDiamond: Function;
	addEllipse: Function;
	addText: Function;
	addLine: Function;
	addArrow: Function;
	connectObjects: Function;
	clear: Function;
	reset: Function;
};
```

## Element Style
As you will notice, some styles have setter functions. This is to help you navigate the allowed values for the property. You do not need to use the setter function however, you can use set the value directly as well.

### strokeColor
String. The color of the line.

Allowed values are [HTML color names](https://www.w3schools.com/colors/colors_names.asp) or hexadecimal RGB strings e.g. `#FF0000` for red.

### backgroundColor
String. This is the fill color of an object.

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

### startArroHead, endArrowHead
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
String. This is the fill color of an object.

Allowed values are [HTML color names](https://www.w3schools.com/colors/colors_names.asp), hexadecimal RGB strings e.g. `#FF0000` for red, or `transparent`.

## Adding objects
These functions will add objects to your drawing. The canvas is infinite, and it accepts negative and positive X and Y values. The top left corner x values increase left to right, y values increase top to bottom.

![coordinates](https://user-images.githubusercontent.com/14358394/116825632-6569b980-ab90-11eb-827b-ada598e91e46.png)

### addRect(), addDiamond, addEllipse
```typescript
addRect(topX:number, topY:number, width:number, height:number):string
addDiamond(topX:number, topY:number, width:number, height:number):string
addEllipse(topX:number, topY:number, width:number, height:number):string
```
Returns the `id` of the object. The `id` is required when connecting objects with lines. See later.

### addText
```typescript
async addText(topX:number, topY:number, text:string, width?:number, height?:number,textAlign?: string, verticalAlign?:string):Promise<string>
```

Adds text to the drawing. If `width` and `height` are not specified, the function will calculate the width and height based on the fontFamily, the fontSize and the text provided.

In case you want to position a text in the center compared to other elements on the drawing, you can provide a fixed height and width, and you can also specify `textAlign` and `verticalAlign` as described above.

Returns the `id` of the object. The `id` is required when connecting objects with lines. See later.

This is an asynchronous function. It must be called with an `await` from the Templater script, otherwise the text will not appear. See code example above.

### addLine()
```typescript
addLine(points: [[x:number,y:number]]):void
```
Adds a line following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if `strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

### addArrow()
```typescript
addArrow(points: [[x:number,y:number]],startArrowHead?:string,endArrowHead?:string,startBinding?:string,endBinding?:string):void
```

Adds an arrow following the points provided. Must include at least two points `points.length >= 2`. If more than 2 points are provided the interim points will be added as breakpoints. The line will break with angles if `strokeSharpness` is set to "sharp" and will be curvey if it is set to "round".

`startArrowHead` and `endArrowHead` specify the type of arrow head to use, as described above. Valid values are "none", "arrow", "dot", and "bar".

`startBinding` and `endBinding` are the object id's of connected objects. Do not use directly with this function. Use `connectObjects` instead.

### connectObjects()
```typescript
declare type ConnectionPoint = "top"|"bottom"|"left"|"right";

connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, numberOfPoints: number = 1,startArrowHead?:string,endArrowHead?:string):void
```
Connects two objects with an arrow.

`objectA` and `objectB` are strings. These are the ids of the objects to connect. IDs are returned by addRect(), addDiamond(), addEllipse() and addText() when creating these objects.

`connectionA` and `connectionB` specify where to connect on the object. Valid values are: "top", "bottom", "left", and "right".

`numberOfPoints` set the number of interim break points for the line. Default value is one, meaning there will be 1 breakpoint between the start and the end points of the arrow. When moving objects on the drawing, these breakpoints will influence how the line is rerouted by Excalidraw.

`startArrowHead` and `endArrowHead` function as described for `addArrow()` above.

## Utility functions
### clear()
`clear()` will clear objects from cache, but will retain element style settings.

### reset()
`reset()` will first call `clear()` and then reset element style to defaults.

### create()
```typescript
async create(filename?: string, foldername?:string, templatePath?:string, onNewPane: boolean = false)
```
Creates the drawing and opens it.

`filename` is the filename without extension of the drawing to be created. If `null`, then Excalidraw will generate a filename.

`foldername` is the folder where the file should be created. If `null` then the default folder for new drawings will be used according to Excalidraw settings.

`templatePath` the filename including full path and extension for a template file to use. This template file will be added as the base layer, all additional objects added via ExcalidrawAutomate will appear on top of elements in the template. If `null` then no template will be used, i.e. an empty white drawing will be the base for adding objects.

`onNewPane` defines where the new drawing should be created. `false` will open the drawing on the current active leaf. `true` will open the drawing by vertically splitting the current leaf.

## Examples
### Connect objects
```javascript
<%*
    const ea = ExcalidrawAutomate;
	ea.reset();
	await ea.addText(-130,-100,"Connecting two objects");
	const a = ea.addRect(-100,-100,100,100);
	const b = ea.addEllipse(200,200,100,100);
	ea.connectObjects(a,"bottom",b,"left",2); //see how the line breaks differently when moving objects around
	ea.style.strokeColor = "red";
	ea.connectObjects(a,"right",b,"top",1);
	await ea.create();
%>
```
### Using a template
This example is similar to the first one, but rotated 90°, and using a template, plus specifying a filename and folder to save the drawing, and opening the new drawing in a new pane.
```javascript
<%*
    const ea = ExcalidrawAutomate;
	ea.reset();
	ea.style.angle = Math.PI/2;
	ea.style.strokeWidth = 3.5;
	ea.addRect(-150,-50,450,300);
	await ea.addText(-100,70,"Left to right");
	ea.addArrow([[-100,100],[100,100]]);

    ea.style.strokeColor = "red";
	await ea.addText(100,-30,"top to bottom",200,null,"center");
	ea.addArrow([[200,0],[200,200]]);
	await ea.create("My Drawing","myfolder/fordemo/","Excalidraw/Template2.excalidraw",true);
%>
```
