/*

![](https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/images/mindmap%20connector.png)

![](https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/images/Mindmap%20connector1.png)
This script creates mindmap like lines(only right and down side are available). The line will starts according to the creation time of the elements. So you may need to create the header element first.

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
//line style setting
ea.style.strokeColor = els[0].strokeColor;
ea.style.strokeWidth = els[0].strokeWidth;
ea.style.strokeStyle = els[0].strokeStyle;
ea.style.strokeSharpness = els[0].strokeSharpness;
//all min max x y
let maxy = Math.max.apply(null, elsy);
let indexmaxy=elsy.indexOf(maxy);
let miny = Math.min.apply(null, elsy);
let indexminy = elsy.indexOf(miny);
let maxx = Math.max.apply(null, elsx);
let indexmaxx = elsx.indexOf(maxx);
let minx = Math.min.apply(null, elsx);
let indexminx = elsx.indexOf(minx);
//child max min x y
let gmaxy = Math.max.apply(null, elsy.slice(1));
let gindexmaxy=elsy.indexOf(gmaxy);
let gminy = Math.min.apply(null, elsy.slice(1));
let gindexminy = elsy.indexOf(gminy);
let gmaxx = Math.max.apply(null, elsx.slice(1));
let gindexmaxx = elsx.indexOf(gmaxx);
let gminx = Math.min.apply(null, elsx.slice(1));
let gindexminx = elsx.indexOf(gminx);
let s=0;//Set line direction down as default 
if (indexminx==0 &&  els[0].x + els[0].width<=gminx) {
  s=1; 
}
else if (indexminy == 0) {
  s=0;
}
var length_left;
if(els[0].x + els[0].width * 2<=gminx){length_left=els[0].x + els[0].width * 1.5;}
else {length_left=(els[0].x + els[0].width+gminx)/2;}

var length_down;
if(els[0].y + els[0].height* 2.5<=gminy){length_down=els[0].y + els[0].height * 2;}
else {length_down=(els[0].y + els[0].height+gminy)/2;}
if(s) {
  ea.addLine(
    [[length_left,
    maxy + els[indexmaxy].height / 2],
    [length_left,
    miny + els[indexminy].height / 2]]
  );
  for (i = 1, len = groups.length; i < len; i++) {
    ea.addLine(
      [[els[i].x,
      els[i].y + els[i].height/2],
      [length_left,
      els[i].y + els[i].height/2]]
    );
  }
  ea.addArrow(
    [[els[0].x+els[0].width,
    els[0].y + els[0].height / 2],
    [length_left,
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
    length_down],
    [minx + els[indexminx].width / 2,
    length_down]]
  );
  for (i = 1, len = groups.length; i < len; i++) {
    ea.addLine(
      [[els[i].x + els[i].width / 2,
      els[i].y],
      [els[i].x + els[i].width / 2,
      length_down]]
    );
  }
  ea.addArrow(
    [[els[0].x + els[0].width / 2,
    els[0].y + els[0].height],
    [els[0].x + els[0].width / 2,
    length_down]],
    {
      startArrowHead: "none",
      endArrowHead: "dot"
    }
  );
}

await ea.addElementsToView(false,false,true);
