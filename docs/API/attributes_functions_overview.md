# [◀ Excalidraw Automate How To](../readme.md)
## Attributes and functions overivew
Here's the interface implemented by ExcalidrawAutomate:

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