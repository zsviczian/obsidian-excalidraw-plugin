# [◀ Excalidraw Automate How To](../readme.md)

## 实用工具函数

### isExcalidrawFile()
```typescript
isExcalidrawFile(f:TFile): boolean
```
如果提供的文件是有效的 Excalidraw 文件（可以是传统的 `*.excalidraw` 文件或在 front-matter 中包含 excalidraw 键的 markdown 文件），则返回 true。

### clear()
`clear()` 将清除缓存中的对象，但会保留元素样式设置。

### reset()
`reset()` 会先调用 `clear()`，然后将元素样式重置为默认值。

### toClipboard()
```typescript
async toClipboard(templatePath?:string)
```
将生成的绘图放置到剪贴板中。当你不想创建新的绘图，而是想将额外的元素粘贴到现有绘图上时，这个功能很有用。

### getElements()
```typescript
getElements():ExcalidrawElement[];
```
以数组形式返回 ExcalidrawAutomate 中的 ExcalidrawElement 元素。这种格式在使用 ExcalidrawRef 时特别有用。

### getElement()
```typescript
getElement(id:string):ExcalidrawElement;
```
返回与指定 id 匹配的元素对象。如果元素不存在，则返回 null。

### create()
```typescript
async create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean})
```
创建并打开绘图。返回创建文件的完整路径。

`filename` 是要创建的绘图文件名（不包含扩展名）。如果为 `null`，Excalidraw 将自动生成文件名。

`foldername` 是文件创建的目标文件夹。如果为 `null`，则会根据 Excalidraw 设置使用默认的新建绘图文件夹。

`templatePath` 是模板文件的完整路径（包含文件名和扩展名）。该模板文件将作为基础图层，所有通过 ExcalidrawAutomate 添加的对象都会显示在模板元素的上层。如果为 `null`，则不使用模板，即使用空白画布作为添加对象的基础。

`onNewPane` 定义新绘图的创建位置。`false` 将在当前活动页签中打开绘图。`true` 将通过垂直分割当前页签来打开绘图。

`frontmatterKeys` 是要应用到文档的 frontmatter 键值集合
  {
    excalidraw-plugin?: "raw"|"parsed",
    excalidraw-link-prefix?: string,
    excalidraw-link-brackets?: boolean,
    excalidraw-url-prefix?: string
  }

示例：
```javascript
create (
  {
    filename:"my drawing", 
    foldername:"myfolder/subfolder/", 
    templatePath: "Excalidraw/template.excalidraw", 
    onNewPane: true, 
    frontmatterKeys: {
      "excalidraw-plugin": "parsed",
      "excalidraw-link-prefix": "",
      "excalidraw-link-brackets": true,
      "excalidraw-url-prefix": "🌐",
    }
  }
);
```

### createSVG()
```typescript
async createSVG(templatePath?:string)
```
返回包含生成绘图的 HTML SVGSVGElement 元素。

### createPNG()
```typescript
async createPNG(templatePath?:string, scale:number=1)
```
返回包含生成绘图的 PNG 图像 blob 对象。

### wrapText()
```typescript
wrapText(text:string, lineLen:number):string
```
返回一个按照指定最大行长度换行的字符串。

### 访问打开的 Excalidraw 视图
在使用任何视图操作函数之前，你需要先初始化 targetView。

#### targetView
```typescript
targetView: ExcalidrawView
```
已打开的 Excalidraw 视图，被配置为视图操作的目标。使用 `setView` 进行初始化。

#### setView()
```typescript
setView(view:ExcalidrawView|"first"|"active"):ExcalidrawView
```
设置将作为视图操作目标的 ExcalidrawView。有效的 `view` 输入值包括：
- ExcalidrawView 的对象实例
- "first"：如果打开了多个 Excalidraw 视图，则选择 `app.workspace.getLeavesOfType("Excalidraw")` 返回的第一个视图
- "active"：表示当前活动的视图

#### getExcalidrawAPI()
```typescript
getExcalidrawAPI():any
```
返回在 `targetView` 中指定的当前活动绘图的原生 Excalidraw API（ref.current）。
查看 Excalidraw 文档请访问：https://www.npmjs.com/package/@excalidraw/excalidraw#ref

#### getViewElements()
```typescript
getViewElements():ExcalidrawElement[] 
```
返回视图中的所有元素。

#### deleteViewElements()
```typescript
deleteViewElements(elToDelete: ExcalidrawElement[]):boolean 
```
从视图中删除与输入参数中提供的元素相匹配的元素。

示例：从视图中删除选中的元素：
```typescript
ea = ExcalidrawAutomate;
ea.setView("active");
el = ea.getViewSelectedElements();
ea.deleteViewElements();
```

#### getViewSelectedElement()
```typescript
getViewSelectedElement():ExcalidrawElement
```
首先需要调用 `setView()` 来设置视图。

如果在目标视图 (targetView) 中选中了一个元素，该函数将返回被选中的元素。如果选中了多个元素（通过 <kbd>SHIFT+点击</kbd> 选择多个元素，或者选择一个组），将返回第一个元素。如果你想从一个组中指定要选择的元素，请双击该组中想要的元素。

当你想要添加一个与绘图中现有元素相关的新元素时，这个函数会很有帮助。

#### getViewSelectedElements()
```typescript
getViewSelectedElements():ExcalidrawElement[]
```
首先需要调用 `setView()` 来设置视图。

获取场景中选中元素的数组。如果没有选中任何元素，则返回 []。

注意：你可以调用 `getExcalidrawAPI().getSceneElements()` 来获取场景中的所有元素。

#### viewToggleFullScreen()
```typescript
viewToggleFullScreen(forceViewMode?:boolean):void;
```
在目标视图 (targetView) 中切换全屏模式和普通模式。通过将 forceViewMode 设置为 `true` 可以将 Excalidraw 切换到查看模式。默认值为 `false`。

此功能在 Obsidian 移动端上不生效。

#### connectObjectWithViewSelectedElement()
```typescript 
connectObjectWithViewSelectedElement(objectA:string,connectionA: ConnectionPoint, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):boolean
```
与 `connectObjects()` 功能相同，但 ObjectB 是目标 ExcalidrawView 中当前选中的元素。该函数有助于在新创建的对象和目标 ExcalidrawView 中选中的元素之间放置一个箭头。

#### addElementsToView()
```typescript
async addElementsToView(repositionToCursor:boolean=false, save:boolean=false):Promise<boolean>
```
将使用 ExcalidrawAutomate 创建的元素添加到目标 ExcalidrawView 中。

`repositionToCursor` 默认值为 false
- true：元素将被移动，使其中心点与 ExcalidrawView 上当前指针的位置对齐。你可以使用此开关将元素指向并放置到绘图中的所需位置。
- false：元素将按照每个元素的 x&y 坐标定义的位置进行放置。

`save` 默认值为 false
- true：元素添加后绘图将被保存。
- false：绘图将在下一个自动保存周期时保存。当连续添加多个元素时使用 false。否则，最好使用 true 以最小化数据丢失的风险。

### onDropHook
```typescript
onDropHook (data: {
  ea: ExcalidrawAutomate, 
  event: React.DragEvent<HTMLDivElement>,
  draggable: any, //Obsidian draggable object
  type: "file"|"text"|"unknown",
  payload: {
    files: TFile[], //TFile[] array of dropped files
    text: string, //string 
  },
  excalidrawFile: TFile, //the file receiving the drop event
  view: ExcalidrawView, //the excalidraw view receiving the drop
  pointerPosition: {x:number, y:number} //the pointer position on canvas at the time of drop
}):boolean;
```
当可拖拽项被拖放到 Excalidraw 上时触发的回调函数。

该函数应返回一个布尔值。如果拖放由钩子函数处理且应停止进一步的原生处理，则返回 true；如果应让 Excalidraw 继续处理拖放操作，则返回 false。

拖放类型可以是以下之一：
- "file"：当从 Obsidian 文件浏览器中拖放文件到 Excalidraw 时。在这种情况下，payload.files 将包含被拖放文件的列表。
- "text"：当拖放链接（如 URL 或 wiki 链接）或其他文本时。在这种情况下，payload.text 将包含接收到的字符串。
- "unknown"：当 Excalidraw 插件无法识别拖放对象的类型时。在这种情况下，你可以使用 React.DragEvent 来分析拖放的对象。

使用 Templater 启动模板或类似方法来设置钩子函数。

```typescript
ea = ExcalidrawAutomate;
ea.onDropHook = (data) => {
  console.log(data); 
  return false;
}
```
