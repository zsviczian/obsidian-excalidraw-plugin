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