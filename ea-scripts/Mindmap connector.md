/*

![](https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/images/mindmap%20connector.png)

This script creates mindmap like lines(only right side available). The line will starts according to the creation time of the elements. So you may need to create the header element first.

```javascript
*/
const elements = ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
groups = ea.getMaximumGroups(elements);

els=[];
elsx=[];
elsy=[];
for (i = 0, len =groups.length; i < len; i++) {
  els.push(ea.getLargestElement(groups[i]));
  elsx.push(ea.getLargestElement(groups[i]).x);
  elsy.push(ea.getLargestElement(groups[i]).y);
}

ea.style.strokeColor = els[0].strokeColor;
ea.style.strokeWidth = els[0].strokeWidth;
ea.style.strokeStyle = els[0].strokeStyle;
ea.style.strokeSharpness = els[0].strokeSharpness;
let maxy = Math.max.apply(null, elsy);
let indexmaxy=elsy.indexOf(maxy);
let miny = Math.min.apply(null, elsy);
let indexminy = elsy.indexOf(miny);

let maxx = Math.max.apply(null, elsx);
let indexmaxx = elsx.indexOf(maxx);
let minx = Math.min.apply(null, elsx);
let indexminx = elsx.indexOf(minx);
let s=0;
if (indexminx==0) {
  s=1; 
}
else if (indexminy == 0) {
  s=0;
}

if(s) {
  ea.addLine(
    [[els[0].x + els[0].width * 1.5,
    maxy + els[indexmaxy].height / 2],
    [els[0].x + els[0].width * 1.5,
    miny + els[indexminy].height / 2]]
  );
  for (i = 1, len = groups.length; i < len; i++) {
    ea.addLine(
      [[els[i].x,
      els[i].y + els[i].height/2],
      [els[0].x + els[0].width * 1.5,
      els[i].y + els[i].height/2]]
    );
  }
  ea.addArrow(
    [[els[0].x+els[0].width,
    els[0].y + els[0].height / 2],
    [els[0].x + els[0].width * 1.5,
    els[0].y + els[0].height / 2]],
    {
      startArrowHead: "none",
      endArrowHead: "dot"
    }
  )
}

else {
  ea.addLine(
    [[maxx + els[indexmaxx].width / 2,
    els[0].y + els[0].height * 2],
    [minx + els[indexminx].width / 2,
    els[0].y + els[0].height * 2]]
  );
  for (i = 1, len = groups.length; i < len; i++) {
    ea.addLine(
      [[els[i].x + els[i].width / 2,
      els[i].y],
      [els[i].x + els[i].width / 2,
      els[0].y + els[0].height * 2]]
    );
  }
  ea.addArrow(
    [[els[0].x + els[0].width / 2,
    els[0].y + els[0].height],
    [els[0].x + els[0].width / 2,
    els[0].y + els[0].height * 2]],
    {
      startArrowHead: "none",
      endArrowHead: "dot"
    }
  );
}

await ea.addElementsToView(false,false,true);
