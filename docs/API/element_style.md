# [◀ Excalidraw Automate How To](../readme.md)
## Element style settings
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