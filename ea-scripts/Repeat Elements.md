/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-repeat-elements.png)

This script will detect the difference between 2 selected elements, including position, size, stroke and background color, and create several elements that repeat these differences based on the number of repetitions entered by the user.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

let repeatNum = parseInt(await utils.inputPrompt("repeat times?","number","5"));
if(!repeatNum) {
    new Notice("Please enter a number.");
    return;
}

const selectedElements = ea.getViewSelectedElements().sort((lha,rha) => 
    lha.x === rha.x? (lha.y === rha.y? 
    (lha.width === rha.width? 
    (lha.height - rha.height) : lha.width - rha.width) 
    : lha.y - rha.y) : lha.x - rha.x);

if(selectedElements.length !== 2) {
    new Notice("Please select 2 elements.");
    return;
}

if(selectedElements[0].type !== selectedElements[1].type) {
    new Notice("The selected elements must be of the same type.");
    return;
}

const xDistance = selectedElements[1].x - selectedElements[0].x;
const yDistance = selectedElements[1].y - selectedElements[0].y;
const widthDistance = selectedElements[1].width - selectedElements[0].width;
const heightDistance = selectedElements[1].height - selectedElements[0].height;

const bgColor1 = colorNameToHex(selectedElements[0].backgroundColor);
const rgbBgColor1 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgColor1);
const bgColor2 = colorNameToHex(selectedElements[1].backgroundColor);
const rgbBgColor2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgColor2);
let bgHDistance = 0;
let bgSDistance = 0;
let bgLDistance = 0;
if(rgbBgColor1 && rgbBgColor2) {
    const bgHsl1 = rgbToHsl([parseInt(rgbBgColor1[1], 16), parseInt(rgbBgColor1[2], 16), parseInt(rgbBgColor1[3], 16)]);
    const bgHsl2 = rgbToHsl([parseInt(rgbBgColor2[1], 16), parseInt(rgbBgColor2[2], 16), parseInt(rgbBgColor2[3], 16)]);
    
    bgHDistance = bgHsl2[0] - bgHsl1[0];
    bgSDistance = bgHsl2[1] - bgHsl1[1];
    bgLDistance = bgHsl2[2] - bgHsl1[2];
}

const strokeColor1 = colorNameToHex(selectedElements[0].strokeColor);
const rgbStrokeColor1 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(strokeColor1);
const strokeColor2 = colorNameToHex(selectedElements[1].strokeColor);
const rgbStrokeColor2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(strokeColor2);
let strokeHDistance = 0;
let strokeSDistance = 0;
let strokeLDistance = 0;
if(rgbStrokeColor1 && rgbStrokeColor2) {
    const strokeHsl1 = rgbToHsl([parseInt(rgbStrokeColor1[1], 16), parseInt(rgbStrokeColor1[2], 16), parseInt(rgbStrokeColor1[3], 16)]);
    const strokeHsl2 = rgbToHsl([parseInt(rgbStrokeColor2[1], 16), parseInt(rgbStrokeColor2[2], 16), parseInt(rgbStrokeColor2[3], 16)]);
    
    strokeHDistance = strokeHsl2[0] - strokeHsl1[0];
    strokeSDistance = strokeHsl2[1] - strokeHsl1[1];
    strokeLDistance = strokeHsl2[2] - strokeHsl1[2];
}

ea.copyViewElementsToEAforEditing(selectedElements);
for(let i=0; i<repeatNum; i++) {
    const newEl = ea.cloneElement(selectedElements[1]);
    ea.elementsDict[newEl.id] = newEl;
    newEl.x += xDistance * (i + 1);
    newEl.y += yDistance * (i + 1);
    const originWidth = newEl.width;
    const originHeight = newEl.height;
    const newWidth = newEl.width + widthDistance * (i + 1);
    const newHeight = newEl.height + heightDistance * (i + 1);
    if(newWidth >= 0 && newHeight >= 0) {
        if(newEl.type === 'arrow' || newEl.type === 'line' || newEl.type === 'freedraw') {
          const minX = Math.min(...newEl.points.map(pt => pt[0]));
          const minY = Math.min(...newEl.points.map(pt => pt[1]));
          for(let j = 0; j < newEl.points.length; j++) {
            if(newEl.points[j][0] > minX) {
              newEl.points[j][0] = newEl.points[j][0] + ((newEl.points[j][0] - minX) / originWidth) * (newWidth - originWidth);
            }
            if(newEl.points[j][1] > minY) {
              newEl.points[j][1] = newEl.points[j][1] + ((newEl.points[j][1] - minY) / originHeight) * (newHeight - originHeight);
            }
          }
        }
        else {
          newEl.width = newWidth;
          newEl.height = newHeight;
        }
    }

    if(rgbBgColor1 && rgbBgColor2) {
        const bgHsl2 = rgbToHsl([parseInt(rgbBgColor2[1], 16), parseInt(rgbBgColor2[2], 16), parseInt(rgbBgColor2[3], 16)]);
        const newBgH = bgHsl2[0] + bgHDistance * (i + 1);
        const newBgS = bgHsl2[1] + bgSDistance * (i + 1);
        const newBgL = bgHsl2[2] + bgLDistance * (i + 1);
        
        if(newBgH >= 0 && newBgH <= 360 && newBgS >= 0 && newBgS <= 100 && newBgL >= 0 && newBgL <= 100) {
            const newBgRgb = hslToRgb([newBgH, newBgS, newBgL]);
            newEl.backgroundColor = "#" + rgbToHexString(newBgRgb);
        }
    }

    if(rgbStrokeColor1 && rgbStrokeColor2) {
        const strokeHsl2 = rgbToHsl([parseInt(rgbStrokeColor2[1], 16), parseInt(rgbStrokeColor2[2], 16), parseInt(rgbStrokeColor2[3], 16)]);
        const newStrokeH = strokeHsl2[0] + strokeHDistance * (i + 1);
        const newStrokeS = strokeHsl2[1] + strokeSDistance * (i + 1);
        const newStrokeL = strokeHsl2[2] + strokeLDistance * (i + 1);
        
        if(newStrokeH >= 0 && newStrokeH <= 360 && newStrokeS >= 0 && newStrokeS <= 100 && newStrokeL >= 0 && newStrokeL <= 100) {
            const newStrokeRgb = hslToRgb([newStrokeH, newStrokeS, newStrokeL]);
            newEl.strokeColor = "#" + rgbToHexString(newStrokeRgb);
        }
    }
}

await ea.addElementsToView(false, true, true);

function rgbToHexString(args) {
  const integer =
    ((Math.round(args[0]) & 0xff) << 16) +
    ((Math.round(args[1]) & 0xff) << 8) +
    (Math.round(args[2]) & 0xff);

  const string = integer.toString(16).toUpperCase();
  return "000000".substring(string.length) + string;
}

function hslToRgb(hsl) {
  const h = hsl[0] / 360;
  const s = hsl[1] / 100;
  const l = hsl[2] / 100;
  let t2;
  let t3;
  let val;

  if (s === 0) {
    val = l * 255;
    return [val, val, val];
  }

  if (l < 0.5) {
    t2 = l * (1 + s);
  } else {
    t2 = l + s - l * s;
  }

  const t1 = 2 * l - t2;

  const rgb = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    t3 = h + (1 / 3) * -(i - 1);
    if (t3 < 0) {
      t3++;
    }

    if (t3 > 1) {
      t3--;
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3;
    } else if (2 * t3 < 1) {
      val = t2;
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    } else {
      val = t1;
    }

    rgb[i] = val * 255;
  }

  return rgb;
}

function rgbToHsl(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const delta = max - min;
  let h;
  let s;

  if (max === min) {
    h = 0;
  } else if (r === max) {
    h = (g - b) / delta;
  } else if (g === max) {
    h = 2 + (b - r) / delta;
  } else if (b === max) {
    h = 4 + (r - g) / delta;
  }

  h = Math.min(h * 60, 360);

  if (h < 0) {
    h += 360;
  }

  const l = (min + max) / 2;

  if (max === min) {
    s = 0;
  } else if (l <= 0.5) {
    s = delta / (max + min);
  } else {
    s = delta / (2 - max - min);
  }

  return [h, s * 100, l * 100];
}

function colorNameToHex(color) {
  const colors = {
    aliceblue: "#f0f8ff",
    antiquewhite: "#faebd7",
    aqua: "#00ffff",
    aquamarine: "#7fffd4",
    azure: "#f0ffff",
    beige: "#f5f5dc",
    bisque: "#ffe4c4",
    black: "#000000",
    blanchedalmond: "#ffebcd",
    blue: "#0000ff",
    blueviolet: "#8a2be2",
    brown: "#a52a2a",
    burlywood: "#deb887",
    cadetblue: "#5f9ea0",
    chartreuse: "#7fff00",
    chocolate: "#d2691e",
    coral: "#ff7f50",
    cornflowerblue: "#6495ed",
    cornsilk: "#fff8dc",
    crimson: "#dc143c",
    cyan: "#00ffff",
    darkblue: "#00008b",
    darkcyan: "#008b8b",
    darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9",
    darkgreen: "#006400",
    darkkhaki: "#bdb76b",
    darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
    darkred: "#8b0000",
    darksalmon: "#e9967a",
    darkseagreen: "#8fbc8f",
    darkslateblue: "#483d8b",
    darkslategray: "#2f4f4f",
    darkturquoise: "#00ced1",
    darkviolet: "#9400d3",
    deeppink: "#ff1493",
    deepskyblue: "#00bfff",
    dimgray: "#696969",
    dodgerblue: "#1e90ff",
    firebrick: "#b22222",
    floralwhite: "#fffaf0",
    forestgreen: "#228b22",
    fuchsia: "#ff00ff",
    gainsboro: "#dcdcdc",
    ghostwhite: "#f8f8ff",
    gold: "#ffd700",
    goldenrod: "#daa520",
    gray: "#808080",
    green: "#008000",
    greenyellow: "#adff2f",
    honeydew: "#f0fff0",
    hotpink: "#ff69b4",
    "indianred ": "#cd5c5c",
    indigo: "#4b0082",
    ivory: "#fffff0",
    khaki: "#f0e68c",
    lavender: "#e6e6fa",
    lavenderblush: "#fff0f5",
    lawngreen: "#7cfc00",
    lemonchiffon: "#fffacd",
    lightblue: "#add8e6",
    lightcoral: "#f08080",
    lightcyan: "#e0ffff",
    lightgoldenrodyellow: "#fafad2",
    lightgrey: "#d3d3d3",
    lightgreen: "#90ee90",
    lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a",
    lightseagreen: "#20b2aa",
    lightskyblue: "#87cefa",
    lightslategray: "#778899",
    lightsteelblue: "#b0c4de",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    limegreen: "#32cd32",
    linen: "#faf0e6",
    magenta: "#ff00ff",
    maroon: "#800000",
    mediumaquamarine: "#66cdaa",
    mediumblue: "#0000cd",
    mediumorchid: "#ba55d3",
    mediumpurple: "#9370d8",
    mediumseagreen: "#3cb371",
    mediumslateblue: "#7b68ee",
    mediumspringgreen: "#00fa9a",
    mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585",
    midnightblue: "#191970",
    mintcream: "#f5fffa",
    mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5",
    navajowhite: "#ffdead",
    navy: "#000080",
    oldlace: "#fdf5e6",
    olive: "#808000",
    olivedrab: "#6b8e23",
    orange: "#ffa500",
    orangered: "#ff4500",
    orchid: "#da70d6",
    palegoldenrod: "#eee8aa",
    palegreen: "#98fb98",
    paleturquoise: "#afeeee",
    palevioletred: "#d87093",
    papayawhip: "#ffefd5",
    peachpuff: "#ffdab9",
    peru: "#cd853f",
    pink: "#ffc0cb",
    plum: "#dda0dd",
    powderblue: "#b0e0e6",
    purple: "#800080",
    rebeccapurple: "#663399",
    red: "#ff0000",
    rosybrown: "#bc8f8f",
    royalblue: "#4169e1",
    saddlebrown: "#8b4513",
    salmon: "#fa8072",
    sandybrown: "#f4a460",
    seagreen: "#2e8b57",
    seashell: "#fff5ee",
    sienna: "#a0522d",
    silver: "#c0c0c0",
    skyblue: "#87ceeb",
    slateblue: "#6a5acd",
    slategray: "#708090",
    snow: "#fffafa",
    springgreen: "#00ff7f",
    steelblue: "#4682b4",
    tan: "#d2b48c",
    teal: "#008080",
    thistle: "#d8bfd8",
    tomato: "#ff6347",
    turquoise: "#40e0d0",
    violet: "#ee82ee",
    wheat: "#f5deb3",
    white: "#ffffff",
    whitesmoke: "#f5f5f5",
    yellow: "#ffff00",
    yellowgreen: "#9acd32",
  };
  if (typeof colors[color.toLowerCase()] != "undefined")
    return colors[color.toLowerCase()];
  return color;
}