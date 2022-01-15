/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-copy-selected-element-styles-to-global.png)

This script will copy styles of any selected element into Excalidraw's global styles.

After copying the styles of element such as box, text, or arrow using this script, You can then use Excalidraw's box, arrow, and other tools to create several elements with the same style. This is sometimes more convenient than `Copy Styles` and `Paste Styles`, especially when used with the script `Box Each Selected Groups`.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

const element = ea.getViewSelectedElement();
const appState = ea.getExcalidrawAPI().getAppState();

if(!element) {
	return;
}

appState.currentItemStrokeWidth = element.strokeWidth;
appState.currentItemStrokeStyle = element.strokeStyle;
appState.currentItemStrokeSharpness = element.strokeSharpness;
appState.currentItemRoughness = element.roughness;
appState.currentItemFillStyle = element.fillStyle;
appState.currentItemBackgroundColor = element.backgroundColor;
appState.currentItemStrokeColor = element.strokeColor;

if(element.type === 'text') {
	appState.currentItemFontFamily = element.fontFamily;
	appState.currentItemFontSize = element.fontSize;
	appState.currentItemTextAlign = element.textAlign;
}

if(element.type === 'arrow') {
	appState.currentItemStartArrowhead = element.startArrowhead;
	appState.currentItemEndArrowhead = element.endArrowhead;
}
