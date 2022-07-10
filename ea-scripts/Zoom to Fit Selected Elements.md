/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

Similar to Excalidraw standard <kbd>SHIFT+2</kbd> feature: Zoom to fit selected elements, but with the ability to zoom to 1000%. Inspiration: [#272](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/272)

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
elements = ea.getViewSelectedElements();
api = ea.getExcalidrawAPI();
api.zoomToFit(elements,10);
