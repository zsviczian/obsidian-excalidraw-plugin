/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fix-space-demo.png)

The script arranges the selected elements horizontally with a fixed spacing.

When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.

```javascript
*/
const spacing = parseInt (await utils.inputPrompt("spacing?","number","8"));
if(isNaN(spacing)) {
  return;
}
const elements=ea.getViewSelectedElements();
const topGroups = ea.getMaximumGroups(elements);
const groups = topGroups.sort((lha,rha) => lha[0].x - rha[0].x);

for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const preGroup = groups[i-1];
        const curGroup = groups[i];

        const preRight = Math.max(...preGroup.map(el => el.x + el.width));
        const curLeft = Math.min(...curGroup.map(el => el.x));
        const distance = curLeft -  preRight - spacing;

        for(const curEl of curGroup) {
            curEl.x = curEl.x - distance;
        }
    }
}
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false, false);
