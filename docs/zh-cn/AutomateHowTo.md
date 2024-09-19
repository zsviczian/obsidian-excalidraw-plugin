# Excalidraw 自动化使用指南

> 此说明当前更新至 `5569cff`。

[English](../../AutomateHowTo.md)

Excalidraw 自动化允许您使用 [Templater](https://github.com/SilentVoid13/Templater) 插件创建 Excalidraw 绘图。

通过一些工作，使用 Excalidraw 自动化，您可以根据保管库中的文档生成简单的思维导图、填写 SVG 表单、创建自定义图表等。

您可以通过 ExcalidrawAutomate 对象访问 Excalidraw 自动化。我建议您以以下代码开始您的自动化脚本。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

```javascript
const ea = ExcalidrawAutomate;
ea.reset();
```

第一行创建了一个实用的常量，这样您就可以避免写 100 次 `ExcalidrawAutomate`。

第二行将 `ExcalidrawAutomate` 重置为默认值。这一点很重要，因为您将不知道之前执行了哪个模板，因此您也不知道 `Excalidraw` 的状态。

## 使用 Excalidraw 自动化的基本逻辑

1. 设置您想要绘制的元素的样式
2. 添加元素。每添加一个新元素，它都会在上一个元素的上方添加一层，因此在重叠对象的情况下，后添加的元素会在前一个元素之上。
3. 调用 `await ea.create();` 来实例化绘图

您可以在添加不同元素之间更改样式。我将元素样式与创建分开是基于这样的假设：您可能会设置描边颜色、描边样式、描边粗糙度等，并使用这些设置绘制大多数元素。每次添加元素时设置所有这些参数是没有意义的。

### 在深入探讨之前，这里有两个简单的示例脚本
#### 使用模板在自定义文件夹中创建具有自定义名称的新绘图
这个简单的脚本为您提供了比 Excalidraw 插件设置更大的灵活性，可以为您的绘图命名、将其放入文件夹中，并应用模板。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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

#### 创建一个简单的绘图
*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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
该脚本将生成以下绘图：

![FristDemo](https://user-images.githubusercontent.com/14358394/116825643-6e5a8b00-ab90-11eb-9e3a-37c524620d0d.png)

## 属性和功能一览
这是 ExcalidrawAutomate 实现的接口：
*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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

## 元素样式
正如您所注意到的，某些样式具有设置函数。这是为了帮助您浏览属性的可用值。不过，您并不需要使用设置函数，您也可以直接设置值。

### strokeColor
字符串。线条的颜色。[CSS 合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括 [HTML 颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制 RGB 字符串，例如 `#FF0000` 表示红色。

### backgroundColor
字符串。对象的填充颜色。[CSS 合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括 [HTML 颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制 RGB 字符串，例如 `#FF0000` 表示红色，或 `transparent`（透明）。

### angle
数字。以弧度表示的旋转。90° == `Math.PI/2`。

### fillStyle, setFillStyle()
```typescript
type FillStyle = "hachure" | "cross-hatch" | "solid";
setFillStyle (val:number);
```
fillStyle 是一个字符串.

`setFillStyle()` 接受一个数字：
- 0: "hachure"（斜线填充）
- 1: "cross-hatch"（交叉斜线填充）
- 其他任何数字: "solid"（实心填充）

### strokeWidth
数字，设置描边的宽度。

### strokeStyle, setStrokeStyle()
```typescript
type StrokeStyle = "solid" | "dashed" | "dotted";
setStrokeStyle (val:number);
```
strokeStyle 是一个字符串。

`setStrokeStyle()` 接受一个数字：
- 0: "solid"（实线）
- 1: "dashed"（虚线）
- 其他任何数字: "dotted"（点线）

### roughness
数字。在 Excalidraw 中称为“粗糙度”。接受三个值：
- 0: 建筑师
- 1: 艺术家
- 2: 卡通画家

### opacity
介于 0 和 100 之间的数字。对象的透明度，包括描边和填充。

### strokeSharpness, setStrokeSharpness()
```typescript
type StrokeSharpness = "round" | "sharp";
setStrokeSharpness(val:nmuber);
```
strokeSharpness 是一个字符串。

“round” 线条是曲线，“sharp” 线条在转折点处断开（硬弯折）。

`setStrokeSharpness()` 接受一个数字：
- 0: "round"（圆滑）
- 其他任何数字: "sharp"（尖锐）

### fontFamily, setFontFamily()
数字。有效值为 1、2 和 3。

`setFontFamily()` 也会接受一个数字并返回字体名称。
- 1: "Virgil, Segoe UI Emoji"
- 2: "Helvetica, Segoe UI Emoji"
- 3: "Cascadia, Segoe UI Emoji"

### fontSize
数字。默认值为 20 像素。

### textAlign
字符串。文本的水平对齐方式。有效值为 "left"（左对齐）、"center"（居中对齐）、"right"（右对齐）。

在使用 `addText()` 函数设置固定宽度时，这一点很重要。

### verticalAlign
字符串。文本的垂直对齐方式。有效值为 "top"（顶部）和 "middle"（中间）。

在使用 `addText()` 函数设置固定高度时，这一点很重要。

### startArrowHead, endArrowHead
字符串。有效值为 "arrow"（箭头）、"bar"（线条）、"dot"（点）和 "none"（无）。指定箭头的起始和结束。

在使用 `addArrow()` 和 `connectObjects()` 函数时，这一点很重要。

## canvas
设置画布的属性。

### theme, setTheme()
字符串。有效值为 "light"（明亮）和 "dark"（黑暗）。

`setTheme()` 接受一个数字：
- 0: "light"（明亮）
- 其他任何数字: "dark"（黑暗）

### viewBackgroundColor
字符串。对象的填充颜色。[CSS 合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括 [HTML 颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制 RGB 字符串，例如 `#FF0000` 表示红色，或 `transparent`（透明）。

## 添加对象
这些函数将向您的绘图中添加对象。画布是无限的，接受负值和正值的 X 和 Y 坐标。X 值从左到右增加，Y 值从上到下增加。

![坐标](https://user-images.githubusercontent.com/14358394/116825632-6569b980-ab90-11eb-827b-ada598e91e46.png)

### addRect(), addDiamond(), addEllipse()
```typescript
addRect(topX:number, topY:number, width:number, height:number):string
addDiamond(topX:number, topY:number, width:number, height:number):string
addEllipse(topX:number, topY:number, width:number, height:number):string
```
返回对象的 `id`。在用线连接对象时，需要使用 `id`。请参见后文。
### addText
```typescript
addText(topX:number, topY:number, text:string, formatting?:{width:number, height:number,textAlign: string, verticalAlign:string, box: boolean, boxPadding: number}):string
```

向绘图中添加文本。

格式参数是可选的：
- 如果未指定 `width`（宽度）和 `height`（高度），函数将根据 `fontFamily`、`fontSize` 和提供的文本计算宽度和高度。
- 如果您希望文本相对于绘图中的其他元素居中，可以提供固定的高度和宽度，同时可以指定 `textAlign` 和 `verticalAlign`，如上所述。例如：`{width:500, textAlign:"center"}`。
- 如果您想在文本周围添加一个框，请设置 `{box:true}`。

返回对象的 `id`。在用线连接对象时，需要使用 `id`。请参见后文。如果 `{box:true}`，则返回包围框的 `id`。

### addLine()
```typescript
addLine(points: [[x:number,y:number]]):void
```
添加一条连接提供的点的线。必须至少包含两个点 `points.length >= 2`。如果提供的点超过两个，间隔点将作为断点添加。如果 `strokeSharpness` 设置为 "sharp"，线条将在转折处断开；如果设置为 "round"，线条将是曲线。

### addArrow()
```typescript
addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead:string,endArrowHead:string,startObjectId:string,endObjectId:string}):void
```

添加一条连接提供的点的箭头。必须至少包含两个点 `points.length >= 2`。如果提供的点超过两个，间隔点将作为断点添加。如果元素 `style.strokeSharpness` 设置为 "sharp"，线条将在转折处断开；如果设置为 "round"，线条将是曲线。

`startArrowHead` 和 `endArrowHead` 指定要使用的箭头类型，如上所述。有效值为 "none"（无）、"arrow"（箭头）、"dot"（点）和 "bar"（线条）。例如：`{startArrowHead: "dot", endArrowHead: "arrow"}`。

`startObjectId` 和 `endObjectId` 是连接对象的对象 ID。我建议使用 `connectObjects` 而不是调用 `addArrow()` 来连接对象。

### connectObjects()
```typescript
declare type ConnectionPoint = "top"|"bottom"|"left"|"right";
connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void
```
连接两个对象的箭头。

`objectA` 和 `objectB` 是字符串。这些是要连接的对象的 ID。这些 ID 是通过 `addRect()`、`addDiamond()`、`addEllipse()` 和 `addText()` 创建这些对象时返回的。

`connectionA` 和 `connectionB` 指定在对象上的连接位置。有效值为："top"（上）、"bottom"（下）、"left"（左）和 "right"（右）。

`numberOfPoints` 设置线条的间隔断点数量。默认值为零，意味着箭头的起点和终点之间不会有断点。当在绘图中移动对象时，这些断点将影响 Excalidraw 如何重新调整线条。

`startArrowHead` 和 `endArrowHead` 的功能与 `addArrow()` 中描述的一致。

### addToGroup()
```typescript
addToGroup(objectIds:[]):void
```
将 `objectIds` 中列出的对象进行分组。

## Utility functions
### clear()
`clear()` 将从缓存中清除对象，但会保留元素样式设置。

### reset()
`reset()` 将首先调用 `clear()`，然后将元素样式重置为默认值。

### toClipboard()
```typescript
async toClipboard(templatePath?:string)
```
将生成的图形放入剪贴板。当您不想创建新图形，而是想将其他项目粘贴到现有图形上时，这非常有用。

### create()
```typescript
async create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean})
```
创建图形并打开它。

`filename` 是要创建的图形的文件名（不带扩展名）。如果为 `null`，则 Excalidraw 会生成一个文件名。

`foldername` 是文件应创建的文件夹。如果为 `null`，则将根据 Excalidraw 设置使用新图形的默认文件夹。

`templatePath` 是包含完整路径和扩展名的模板文件名。该模板文件将作为基础层添加，所有通过 ExcalidrawAutomate 添加的额外对象将出现在模板元素之上。如果为 `null`，则不使用模板，即空白图形将作为添加对象的基础。

`onNewPane` 定义新图形应创建的位置。`false` 将在当前活动的标签页中打开图形；`true` 将通过垂直分割当前标签页来打开图形。

示例：

```javascript
create({filename:"my drawing", foldername:"myfolder/subfolder/", templatePath: "Excalidraw/template.excalidraw", onNewPane: true});
```
### createSVG()
```typescript
async createSVG(templatePath?:string)
```
返回一个包含生成图形的 HTML `SVGSVGElement`。

### createPNG()
```typescript
async createPNG(templatePath?:string)
```
返回一个包含生成图形的 PNG 图像的 blob。

## 示例
### 将新图形插入到当前编辑的文档中
此模板将提示您输入图形的标题。它将在您提供的标题下创建一个新图形，并在您正在编辑的文档的文件夹中。然后，它将在光标位置插入新图形，并通过分割当前标签页在新的工作区标签页中打开新图形。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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

### 连接对象
*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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
### 使用模板
这个示例与第一个类似，但旋转了 90°，并使用了模板，同时指定了文件名和保存图形的文件夹，并在新的标签页中打开新图形。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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

### 从文本大纲生成简单思维导图
这是一个稍微复杂一些的示例。这个示例将从一个表格化的大纲生成思维导图。

![Drawing 2021-05-05 20 52 34](https://user-images.githubusercontent.com/14358394/117194124-00a69d00-ade4-11eb-8b75-5e18a9cbc3cd.png)

输入示例:

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

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*
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
