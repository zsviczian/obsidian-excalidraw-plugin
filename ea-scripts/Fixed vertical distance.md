/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-vertical-distance.png)

The script arranges the selected elements vertically with a fixed spacing.

When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.

```javascript
*/
const spacing = parseInt (await utils.inputPrompt("spacing?","number","8"));
if(isNaN(spacing)) {
  return;
}
const elements=ea.getViewSelectedElements()
    .filter(els => !(els.length === 1 && els[0].type ==="arrow")); // ignore individual arrows
const topGroups = ea.getMaximumGroups(elements);
const groups = topGroups.sort((lha,rha) => lha[0].y - rha[0].y);

for(var i=0; i<groups.length; i++) {
    if(i > 0) {
        const preGroup = groups[i-1];
        const curGroup = groups[i];

        const preBottom = Math.max(...preGroup.map(el => el.y + el.height));
        const curTop = Math.min(...curGroup.map(el => el.y));
        const distance = curTop -  preBottom - spacing;

        for(const curEl of curGroup) {
            curEl.y = curEl.y - distance;
        }
    }
}
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false, false);
