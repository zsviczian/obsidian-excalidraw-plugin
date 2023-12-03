/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid-selected-images.png)

This script arranges selected images into compact grid view, removing gaps in-between, resizing when necessary and breaking into multiple rows/columns.

```javascript
*/

try {
  let els = ea.getViewSelectedElements().filter(el => el.type == 'image');

  new Notice(els.length);

  if (els.length == 0) throw new Error('No image elements selected');

  const bounds = ea.getBoundingBox(els);
  const { topX, topY, width, height } = bounds;
  
  els.sort((a, b) => a.x + a.y < b.x + b.y);

  const areaAvailable = width * height;

  let elWidth = els[0].width;
  let elHeight = els[0].height;

  if (elWidth * elHeight > areaAvailable) {
    while (elWidth * elHeight > areaAvailable) {
      elWidth /= 1.1;
      elHeight /= 1.1;
    }  
  } else if (elWidth * elHeight < areaAvailable) {
    while (elWidth * elHeight < areaAvailable) {
      elWidth *= 1.1;
      elHeight *= 1.1;
    }
  }

  const rows = (width - elWidth) / elWidth;
  
  let row = 0, column = 0;
  for (const element of els) {    
    element.x = topX + (elWidth * row);
    element.y = topY + (elHeight * column);
    
    if (element.width > elWidth) {
      while (element.width >= elWidth) {
        element.width /= 1.1;
        element.height /= 1.1;
      }  
    } else if (element.width < elWidth) {
      while (element.width <= elWidth) {
        element.width *= 1.1;
        element.height *= 1.1;  
      }
    }

    row++;
    if (row > rows) {
      row = 0;
      column++;
    }
  }

  ea.addElementsToView(false, true, true);
} catch (err) {
  _ = new Notice(err.toString())
}
