/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-repeat-elements.png)

This script will detect the difference between 2 selected elements, including position, size, angle, stroke and background color, and create several elements that repeat these differences based on the number of repetitions entered by the user.

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
const angleDistance = selectedElements[1].angle - selectedElements[0].angle;

const bgColor1 = ea.colorNameToHex(selectedElements[0].backgroundColor);
const rgbBgColor1 = parseColorString(bgColor1); 
const bgColor2 = ea.colorNameToHex(selectedElements[1].backgroundColor);
const rgbBgColor2 = parseColorString(bgColor2);
let bgHDistance = 0;
let bgSDistance = 0;
let bgLDistance = 0;

if(rgbBgColor1 && rgbBgColor2) {
    const bgHsl1 = ea.rgbToHsl([rgbBgColor1.value[0], rgbBgColor1.value[1], rgbBgColor1.value[2]]);
    const bgHsl2 = ea.rgbToHsl([rgbBgColor2.value[0], rgbBgColor2.value[1], rgbBgColor2.value[2]]);

    bgHDistance = bgHsl2[0] - bgHsl1[0];
    bgSDistance = bgHsl2[1] - bgHsl1[1];
    bgLDistance = bgHsl2[2] - bgHsl1[2];
}

const strokeColor1 = ea.colorNameToHex(selectedElements[0].strokeColor);
const rgbStrokeColor1 = parseColorString(strokeColor1);
const strokeColor2 = ea.colorNameToHex(selectedElements[1].strokeColor);
const rgbStrokeColor2 = parseColorString(strokeColor2);
let strokeHDistance = 0;
let strokeSDistance = 0;
let strokeLDistance = 0;

if(rgbStrokeColor1 && rgbStrokeColor2) {
    const strokeHsl1 = ea.rgbToHsl([rgbStrokeColor1.value[0], rgbStrokeColor1.value[1], rgbStrokeColor1.value[2]]); 
    const strokeHsl2 = ea.rgbToHsl([rgbStrokeColor2.value[0], rgbStrokeColor2.value[1], rgbStrokeColor2.value[2]]);

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
    newEl.angle += angleDistance * (i + 1);
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
        const bgHsl2 = ea.rgbToHsl([rgbBgColor2.value[0], rgbBgColor2.value[1], rgbBgColor2.value[2]]);
        const newBgH = bgHsl2[0] + bgHDistance * (i + 1);
        const newBgS = bgHsl2[1] + bgSDistance * (i + 1);
        const newBgL = bgHsl2[2] + bgLDistance * (i + 1);
        
        if(newBgH >= 0 && newBgH <= 360 && newBgS >= 0 && newBgS <= 100 && newBgL >= 0 && newBgL <= 100) {
            const newBgRgb = ea.hslToRgb([newBgH, newBgS, newBgL]);
            newEl.backgroundColor = rgbColorToString(newBgRgb, rgbBgColor1.model);
        }
    }

    if(rgbStrokeColor1 && rgbStrokeColor2) {
        const strokeHsl2 = ea.rgbToHsl([rgbStrokeColor2.value[0], rgbStrokeColor2.value[1], rgbStrokeColor2.value[2]]);
        const newStrokeH = strokeHsl2[0] + strokeHDistance * (i + 1);
        const newStrokeS = strokeHsl2[1] + strokeSDistance * (i + 1);
        const newStrokeL = strokeHsl2[2] + strokeLDistance * (i + 1);
        
        if(newStrokeH >= 0 && newStrokeH <= 360 && newStrokeS >= 0 && newStrokeS <= 100 && newStrokeL >= 0 && newStrokeL <= 100) {
            const newStrokeRgb = ea.hslToRgb([newStrokeH, newStrokeS, newStrokeL]);
            newEl.strokeColor = rgbColorToString(newStrokeRgb, rgbStrokeColor1.model);
        }
    }
}

await ea.addElementsToView(false, false, true);

function parseColorString(string) {
	var prefix = string.substring(0, 3).toLowerCase();
	var val;
	var model;
	switch (prefix) {
		case 'hsl':
			val = ea.hslToRgb(parseHslColorString(string));
			model = 'hsl';
			break;
		case 'hwb':
			val = hwbToRgb(parseHwbColorString(string));
			model = 'hwb';
			break;
		default:
			val = parseRgbColorString(string);
			model = 'rgb';
			break;
	}

	if (!val) {
		return null;
	}

	return {model: model, value: val};
};

function parseRgbColorString(string) {
	if (!string) {
		return null;
	}
  var colorNames={};

	var abbr = /^#([a-f0-9]{3,4})$/i;
	var hex = /^#([a-f0-9]{6})([a-f0-9]{2})?$/i;
	var rgba = /^rgba?\(\s*([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
	var per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
	var keyword = /^(\w+)$/;

	var rgb = [0, 0, 0, 1];
	var match;
	var i;
	var hexAlpha;

	if (match = string.match(hex)) {
		hexAlpha = match[2];
		match = match[1];

		for (i = 0; i < 3; i++) {
			var i2 = i * 2;
			rgb[i] = parseInt(match.slice(i2, i2 + 2), 16);
		}

		if (hexAlpha) {
			rgb[3] = parseInt(hexAlpha, 16) / 255;
		}
	} else if (match = string.match(abbr)) {
		match = match[1];
		hexAlpha = match[3];

		for (i = 0; i < 3; i++) {
			rgb[i] = parseInt(match[i] + match[i], 16);
		}

		if (hexAlpha) {
			rgb[3] = parseInt(hexAlpha + hexAlpha, 16) / 255;
		}
	} else if (match = string.match(rgba)) {
		for (i = 0; i < 3; i++) {
			rgb[i] = parseInt(match[i + 1], 0);
		}

		if (match[4]) {
			if (match[5]) {
				rgb[3] = parseFloat(match[4]) * 0.01;
			} else {
				rgb[3] = parseFloat(match[4]);
			}
		}
	} else if (match = string.match(per)) {
		for (i = 0; i < 3; i++) {
			rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
		}

		if (match[4]) {
			if (match[5]) {
				rgb[3] = parseFloat(match[4]) * 0.01;
			} else {
				rgb[3] = parseFloat(match[4]);
			}
		}
	} else if (match = string.match(keyword)) {
		if (match[1] === 'transparent') {
			return [0, 0, 0, 0];
		}

		if (!hasOwnProperty.call(colorNames, match[1])) {
			return null;
		}

		rgb = colorNames[match[1]];
		rgb[3] = 1;

		return rgb;
	} else {
		return null;
	}

	for (i = 0; i < 3; i++) {
		rgb[i] = clamp(rgb[i], 0, 255);
	}
	rgb[3] = clamp(rgb[3], 0, 1);

	return rgb;
}

function parseHslColorString(string) {
	if (!string) {
		return null;
	}

	var hsl = /^hsla?\(\s*([+-]?(?:\d{0,3}\.)?\d+)(?:deg)?\s*,?\s*([+-]?[\d\.]+)%\s*,?\s*([+-]?[\d\.]+)%\s*(?:[,|\/]\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
	var match = string.match(hsl);

	if (match) {
		var alpha = parseFloat(match[4]);
		var h = ((parseFloat(match[1]) % 360) + 360) % 360;
		var s = clamp(parseFloat(match[2]), 0, 100);
		var l = clamp(parseFloat(match[3]), 0, 100);
		var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);

		return [h, s, l, a];
	}

	return null;
}

function parseHwbColorString(string) {
	if (!string) {
		return null;
	}

	var hwb = /^hwb\(\s*([+-]?\d{0,3}(?:\.\d+)?)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
	var match = string.match(hwb);

	if (match) {
		var alpha = parseFloat(match[4]);
		var h = ((parseFloat(match[1]) % 360) + 360) % 360;
		var w = clamp(parseFloat(match[2]), 0, 100);
		var b = clamp(parseFloat(match[3]), 0, 100);
		var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
		return [h, w, b, a];
	}

	return null;
}

function rgbColorToString(color, model) {
  switch (model) {
		case 'hsl':
			return rgbColorToHslString(color);
		case 'hwb':
			return rgbColorToHwbString(color);
		default:
			return ea.rgbToHexString(color);
	}
}

function rgbColorToHslString(rgb) {
  var hsl = ea.rgbToHsl(rgb);
  return 'hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)'
};

function rgbColorToHwbString(rgb) {
	var hwb = rgbToHwb(rgb);

	return 'hwb(' + hwb[0] + ', ' + hwb[1] + '%, ' + hwb[2] + '%)';
};

function rgbToHwb(rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

function hwbToRgb(hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); 
	let r;
	let g;
	let b;
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}

	return [r * 255, g * 255, b * 255];
}

function clamp(num, min, max) {
	return Math.min(Math.max(min, num), max);
}