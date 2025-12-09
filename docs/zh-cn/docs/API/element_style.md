# [◀ Excalidraw 自动化指南](../readme.md)

## 元素样式设置

你会注意到，一些样式有setter函数。这是为了帮助你设置属性的允许值。但是你不必使用setter函数，也可以直接设置值。

### strokeColor

字符串类型。线条的颜色。[CSS合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括[HTML颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制RGB字符串，例如红色为`#FF0000`。

### backgroundColor

字符串类型。这是对象的填充颜色。[CSS合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括[HTML颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制RGB字符串，例如红色为`#FF0000`，或者`transparent`（透明）。

### angle

数字类型。以弧度为单位的旋转角度。90度等于`Math.PI/2`。

### fillStyle, setFillStyle()

```typescript
type FillStyle = "hachure" | "cross-hatch" | "solid";
setFillStyle (val:number);
```

fillStyle 是一个字符串。

`setFillStyle()` 接受一个数字参数：
- 0: "hachure"（斜线填充）
- 1: "cross-hatch"（交叉填充）
- 其他任意数字: "solid"（实心填充）

### strokeWidth

数字类型。设置线条的宽度。

### strokeStyle, setStrokeStyle()

```typescript
type StrokeStyle = "solid" | "dashed" | "dotted";
setStrokeStyle (val:number);
```

strokeStyle 是一个字符串。

`setStrokeStyle()` 接受一个数字参数：
- 0: "solid"（实线）
- 1: "dashed"（虚线）
- 其他任意数字: "dotted"（点线）

### roughness

数字类型。在 Excalidraw 中称为随意度。接受三个值：
- 0：建筑师风格
- 1：艺术家风格
- 2：卡通家风格

### opacity

数字类型，取值范围在 0~100 之间。用于设置对象的不透明度，同时影响线条和填充的透明度。

### strokeSharpness, setStrokeSharpness()

```typescript
type StrokeSharpness = "round" | "sharp";
setStrokeSharpness(val:number);
```

strokeSharpness 是一个字符串。

"round"（圆滑）线条是弯曲的，"sharp"（尖锐）线条在转折点处会形成尖角。

`setStrokeSharpness()` 接受一个数字参数：
- 0："round"（圆滑）
- 其他任意数字："sharp"（尖锐）

### fontFamily, setFontFamily()

数字类型。有效值为 1、2 和 3。

`setFontFamily()` 也接受一个数字参数并返回字体名称：
- 1: "Virgil, Segoe UI Emoji"
- 2: "Helvetica, Segoe UI Emoji"
- 3: "Cascadia, Segoe UI Emoji"

### fontSize

数字类型。默认值为 20px。

### textAlign

字符串类型。文本的水平对齐方式。有效值为 "left"（左对齐）、"center"（居中对齐）、"right"（右对齐）。

这在使用 `addText()` 函数设置固定宽度时很有用。

### verticalAlign

字符串类型。文本的垂直对齐方式。有效值为 "top"（顶部对齐）和 "middle"（居中对齐）。

这在使用 `addText()` 函数设置固定高度时很有用。

### startArrowHead, endArrowHead

字符串类型。有效值为 "arrow"（箭头）、"bar"（线段）、"dot"（圆点）和 "none"（无）。用于指定箭头的起始和结束样式。

这在使用 `addArrow()` 和 `connectObjects()` 函数时很有用。
