/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-convert-freedraw-to-line.jpg)

Convert selected freedraw objects into editable lines. This will allow you to adjust your drawings by dragging line points and will also allow you to select shape fill in case of enclosed lines. You can adjust conversion point density in settings.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Point density"]) {
  settings = {
    "Point density" : {
      value: "7:1",
      valueset: ["1:1","2:1","3:1","4:1","5:1","6:1","7:1","8:1","9:1","10:1","11:1"],
      description: "A freedraw object has many points. Converting freedraw to a line with too many points will result in an impractical object that is hard to edit. This setting sepcifies how many points from freedraw should be averaged to form a point on the line"
    },
  };
  ea.setScriptSettings(settings);
}

const scale = settings["Point density"].value;
const setSize = parseInt(scale.substring(0,scale.indexOf(":")));

const elements = ea.getViewSelectedElements().filter(el=>el.type==="freedraw");
if(elements.length === 0) {
	new Notice("No freedraw object is selected");
}


ea.style.roughness=0;
ea.style.strokeSharpness="round";

elements.forEach((el)=>{
	points = [];
  points.push(el.points[0]);
  for(i=1;i<el.points.length;i+=setSize) {
		point = [0,0];
    count = 0;
    for(p of el.points.slice(i,i+setSize)) {
			point = [ point[0]+p[0] , point[1]+p[1] ];
			count++;
		}
		point = [point[0]/count,point[1]/count];
	  points.push(point);
	}
	const lineId = ea.addLine(points);
  const line = ea.getElement(lineId);
  line.strokeWidth = el.strokeWidth*3;
  line.strokeColor = el.strokeColor;
  line.width = el.width;
  line.height = el.height;
  line.x = el.x;
  line.y = el.y;
});

ea.deleteViewElements(elements);
await ea.addElementsToView(false,false,true);
ea.selectElementsInView(ea.getElements());