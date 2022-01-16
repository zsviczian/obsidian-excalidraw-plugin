/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif)

This script expands the height of the selected rectangles until they are all the same height and keep the text centered.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

const elements = ea.getViewSelectedElements();
const topGroups = ea.getMaximumGroups(elements);

const groupHeights = topGroups
  .map((g) => {
    if(g.length === 1 && (g[0].type === 'arrow' || g[0].type === 'line')) {
      // ignore individual lines
      return { minTop: 0, maxBottom: 0 };
    }
    return g.reduce(
      (pre, cur, i) => {
        if (i === 0) {
          return {
            minTop: cur.y,
            maxBottom: cur.y + cur.height,
            index: i,
          };
        } else {
          return {
            minTop: cur.y < pre.minTop ? cur.y : pre.minTop,
            maxBottom:
              cur.y + cur.height > pre.maxBottom
                ? cur.y + cur.height
                : pre.maxBottom,
            index: i,
          };
        }
      },
      { minTop: 0, maxBottom: 0 }
    );
  })
  .map((r) => {
    r.height = r.maxBottom - r.minTop;
    return r;
  });

const maxGroupHeight = Math.max(...groupHeights.map((g) => g.height));

for (var i = 0; i < topGroups.length; i++) {
  const rects = topGroups[i]
    .filter((el) => el.type === "rectangle")
    .sort((lha, rha) => lha.y - rha.y);
  const texts = topGroups[i]
    .filter((el) => el.type === "text")
    .sort((lha, rha) => lha.y - rha.y);
  const groupWith = groupHeights[i].height;
  if (groupWith < maxGroupHeight) {
    const distance = maxGroupHeight - groupWith;
    const perRectDistance = distance / rects.length;
    for (var j = 0; j < rects.length; j++) {
      const rect = rects[j];
      const rectLeft = rect.x;
      const rectTop = rect.y;
      const rectRight = rect.x + rect.width;
      const rectBottom = rect.y + rect.height;

      rect.y = rect.y + perRectDistance * j - perRectDistance / 2;
      rect.height += perRectDistance;

      const textsWithRect = texts.filter(text => text.x >= rectLeft && text.x <= rectRight
        && text.y >= rectTop && text.y <= rectBottom);
      for(const text of textsWithRect) {
        text.y = text.y + perRectDistance * j;
      }
    }
  }
}

ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false, false);
