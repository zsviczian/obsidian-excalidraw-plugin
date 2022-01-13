/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif)

This script expands the width of the selected rectangles until they are all the same width and keep the text centered.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

const elements = ea.getViewSelectedElements();
const topGroups = ea.getMaximumGroups(elements);

const groupWidths = topGroups
  .map((g) =>
    g.reduce(
      (pre, cur, i) => {
        if (i === 0) {
          return {
            minLeft: cur.x,
            maxRight: cur.x + cur.width,
            index: i,
          };
        } else {
          return {
            minLeft: cur.x < pre.minLeft ? cur.x : pre.minLeft,
            maxRight:
              cur.x + cur.width > pre.maxRight
                ? cur.x + cur.width
                : pre.maxRight,
            index: i,
          };
        }
      },
      { minLeft: 0, maxRight: 0 }
    )
  )
  .map((r) => {
    r.width = r.maxRight - r.minLeft;
    return r;
  });

const maxGroupWidth = Math.max(...groupWidths.map((g) => g.width));

for (var i = 0; i < topGroups.length; i++) {
  const rects = topGroups[i]
    .filter((el) => el.type === "rectangle")
    .sort((lha, rha) => lha.x - rha.x);
  const texts = topGroups[i]
    .filter((el) => el.type === "text")
    .sort((lha, rha) => lha.x - rha.x);
  const groupWith = groupWidths[i].width;
  if (groupWith < maxGroupWidth) {
    const distance = maxGroupWidth - groupWith;
    const perRectDistance = distance / rects.length;
    for (var j = 0; j < rects.length; j++) {
      const rect = rects[j];
      const rectLeft = rect.x;
      const rectTop = rect.y;
      const rectRight = rect.x + rect.width;
      const rectBottom = rect.y + rect.height;
      
      rect.x = rect.x + perRectDistance * j - perRectDistance / 2;
      rect.width += perRectDistance;
      
      const textsWithRect = texts.filter(text => text.x >= rectLeft && text.x <= rectRight
        && text.y >= rectTop && text.y <= rectBottom);
      for(const text of textsWithRect) {
        text.x = text.x + perRectDistance * j;
      }
    }
  }
}

ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false, false);
