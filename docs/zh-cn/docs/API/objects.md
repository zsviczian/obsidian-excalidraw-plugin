# [◀ Excalidraw 自动化使用指南](../readme.md)

## 添加对象

这些函数将向你的绘图中添加对象。画布是无限的，可以接受负数和正数的 X 和 Y 值。X 值从左到右递增，Y 值从上到下递增。

![坐标系](https://user-images.githubusercontent.com/14358394/116825632-6569b980-ab90-11eb-827b-ada598e91e46.png)

### addRect(), addDiamond(), addEllipse()

```typescript
addRect(topX:number, topY:number, width:number, height:number):string
addDiamond(topX:number, topY:number, width:number, height:number):string
addEllipse(topX:number, topY:number, width:number, height:number):string
```

返回对象的 `id`。当使用线条连接对象时需要用到这个 `id`，详见后文。

### addText()

```typescript
addText( 
  topX:number, 
  topY:number, 
  text:string, 
  formatting?:{
    wrapAt?:number, 
    width?:number, 
    height?:number,
    textAlign?:string, 
    box?: "box"|"blob"|"ellipse"|"diamond", 
    boxPadding?:number
  },
  id?:string
):string
```

向绘图中添加文本。

格式化参数是可选的：
- 如果未指定 `width` 和 `height`，函数将根据字体系列（fontFamily）、字体大小（fontSize）和提供的文本来计算宽度和高度。
- 如果你想要将文本相对于绘图中的其他元素居中对齐，你可以提供固定的高度和宽度，并且可以像上面描述的那样指定 `textAlign` 和 `verticalAlign`。例如：`{width:500, textAlign:"center"}`
- 如果你想在文本周围添加一个框，设置 `{box:"box"|"blob"|"ellipse"|"diamond"}`（分别对应矩形框、气泡框、椭圆框、菱形框）

返回对象的 `id`。当使用线条连接对象时需要用到这个 `id`，详见后文。如果设置了 `{box:}`，则返回包围框对象的 id。

### addLine()

```typescript
addLine(points: [[x:number,y:number]]):string
```

根据提供的点添加一条线。必须包含至少两个点 `points.length >= 2`。如果提供了超过 2 个点，中间点将被添加为断点。当 `strokeSharpness` 设置为 "sharp" 时，线条会以角度方式折断；设置为 "round" 时，线条会呈现曲线。

返回对象的 `id`。

### addArrow()

```typescript
addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead?:string,endArrowHead?:string,startObjectId?:string,endObjectId?:string}):string ;
```

根据提供的点添加一个箭头。必须包含至少两个点 `points.length >= 2`。如果提供了超过 2 个点，中间点将被添加为断点。当元素的 `style.strokeSharpness` 设置为 "sharp" 时，线条会以角度方式折断；设置为 "round" 时，线条会呈现曲线。

`startArrowHead` 和 `endArrowHead` 指定要使用的箭头类型，如上所述。有效值包括 "none"（无）、"arrow"（箭头）、"dot"（圆点）和 "bar"（线条）。例如：`{startArrowHead: "dot", endArrowHead: "arrow"}`

`startObjectId` 和 `endObjectId` 是连接对象的 ID。如果是为了连接对象，建议使用 `connectObjects` 而不是调用 addArrow()。

返回对象的 `id`。

### connectObjects()

```typescript
declare type ConnectionPoint = "top"|"bottom"|"left"|"right";
connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void
```

使用箭头连接两个对象。如果两个元素中的任何一个是 `line`（线条）、`arrow`（箭头）或 `freedraw`（自由绘制）类型，则不会执行任何操作。

`objectA` 和 `objectB` 是字符串类型，表示要连接的对象的 ID。这些 ID 是在创建对象时由 addRect()、addDiamond()、addEllipse() 和 addText() 函数返回的。

`connectionA` 和 `connectionB` 指定在对象上的连接位置。有效值包括："top"（顶部）、"bottom"（底部）、"left"（左侧）和 "right"（右侧）。

`numberOfPoints` 设置线条的中间断点数量。默认值为零，表示箭头的起点和终点之间没有断点。当在绘图上移动对象时，这些断点会影响 Excalidraw 重新路由线条的方式。

`startArrowHead` 和 `endArrowHead` 的工作方式如上文 `addArrow()` 中所述。

### addToGroup()

```typescript
addToGroup(objectIds:[]):string
```

将 `objectIds` 中列出的对象组合成一个组。返回该组的 `id`。