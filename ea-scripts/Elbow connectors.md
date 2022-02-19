/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/elbow-connectors.png)

This script converts the selected connectors to elbows.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
const elements = ea.getViewSelectedElements();

const lines = elements.filter((el)=>el.type==="arrow" || el.type==="line");

for (const line of lines) {
  if (line.points.length >= 3) {
    for (var i = 0; i < line.points.length - 2; i++) {
      var p1;
      var p3;
      if (line.points[i][0] < line.points[i + 2][0]) {
        p1 = line.points[i];
        p3 = line.points[i+2];
      } else {
        p1 = line.points[i + 2];
        p3 = line.points[i];
      }
      const p2 = line.points[i + 1];

      if (p1[0] === p3[0]) {
        continue;
      }

      const k = (p3[1] - p1[1]) / (p3[0] - p1[0]);
      const b = p1[1] - k * p1[0];

      y0 = k * p2[0] + b;
      const up = p2[1] < y0;

      if ((k > 0 && !up) || (k < 0 && up)) {
        p2[0] = p1[0];
        p2[1] = p3[1];
      } else {
        p2[0] = p3[0];
        p2[1] = p1[1];
      }
    }
  }
}

ea.copyViewElementsToEAforEditing(lines);
await ea.addElementsToView(false,false);
