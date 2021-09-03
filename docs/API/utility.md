# [◀ Excalidraw Automate How To](../readme.md)
## Utility functions
### isExcalidrawFile()
```typescript
isExcalidrawFile(f:TFile): boolean
```
Returns true if the file provided is a valid Excalidraw file (either a legacy `*.excalidraw` file or a markdown file with the excalidraw key in the front-matter).

### clear()
`clear()` will clear objects from cache, but will retain element style settings.

### reset()
`reset()` will first call `clear()` and then reset element style to defaults.

### toClipboard()
```typescript
async toClipboard(templatePath?:string)
```
Places the generated drawing to the clipboard. Useful when you don't want to create a new drawing, but want to paste additional items onto an existing drawing.

### getElements()
```typescript
getElements():ExcalidrawElement[];
```
Returns the elements in ExcalidrawAutomate as an array of ExcalidrawElements. This format is usefull when working with ExcalidrawRef.

### getElement()
```typescript
getElement(id:string):ExcalidrawElement;
```

Returns the element object matching the id. If the element does not exist, returns null.

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
async createPNG(templatePath?:string, scale:number=1)
```
Returns a blob containing a PNG image of the generated drawing.

### wrapText()
```typescript
wrapText(text:string, lineLen:number):string
```
Returns a string wrapped to the provided max lineLen.


### Accessing the open Excalidraw view
You first need to initialize targetView, before using any of the view manipulation functions.

#### targetView
```typescript
targetView: ExcalidrawView
```
The open Excalidraw View configured as the target of the view operations. User `setView` to initialize.

#### setView()
```typescript
setView(view:ExcalidrawView|"first"|"active"):ExcalidrawView
```
Setting the ExcalidrawView that will be the target of the View operations. Valid `view` input values are:
- an object instance of ExcalidrawView
- "first": meaning if there are multiple Excalidraw Views open, pick the first that is returned by `app.workspace.getLeavesOfType("Excalidraw")`
- "active": meaning the currently active view

#### getExcalidrawAPI()
```typescript
getExcalidrawAPI():any
```
Returns the native Excalidraw API (ref.current) for the active drawing specified in `targetView`.
See Excalidraw documentation here: https://www.npmjs.com/package/@excalidraw/excalidraw#ref

#### getViewSelectedElement()
```typescript
getViewSelectedElement():ExcalidrawElement
```
If an element is selected in the targetView the function returns the selected element. If multiple elements are selected, either by SHIFT+Clicking to select multiple elements, or by selecting a group, the first of the elements will be selected. If you want to specify which element to select from a group, double click the desired element in the group.

This function is helpful if you want to add a new element in relation to an existing element in your drawing.

#### connectObjectWithViewSelectedElement()
```typescript 
connectObjectWithViewSelectedElement(objectA:string,connectionA: ConnectionPoint, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):boolean
```
Same as `connectObjects()`, but ObjectB is the currently selected element in the target ExcalidrawView. The function helps with placing an arrow between a newly created object and the selected element in the target ExcalidrawView.

#### addElementsToView()
```typescript
addElementsToView(repositionToCursor:boolean=false, save:boolean=false):Promise<boolean>
```
Adds elements created with ExcalidrawAutomate to the target ExcalidrawView.
`repositionToCursor` dafault is false
- true: the elements will be moved such that the center point of the elements will be aligned with the current position of the pointer on ExcalidrawView. You can point and place elements to a desired location in your drawing using this switch.
- false: elements will be positioned as defined by the x&y coordinates of each element.

`save` default is false
- true: the drawing will be saved after the elements were added.
- false: the drawing will be saved at the next autosave cycle. Use false when adding multiple elements one after the other. Else, best to use true, to minimize risk of data loss.