/*

![](https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/images/mindmap%20connector.png)

This script creates mindmap like lines(only right side available). The line will starts according to the creation time of the elements. So you may need to create the header element first.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Starting arrowhead"]) {
	settings = {
	  "Starting arrowhead" : {
			value: "none",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Ending arrowhead" : {``
			value: "none",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Line points" : {
			value: 0 ,
      description: "Number of line points between start and end"
		}
	};
	ea.setScriptSettings(settings);
}

const arrowStart = settings["Starting arrowhead"].value === "none" ? null : settings["Starting arrowhead"].value;
const arrowEnd = settings["Ending arrowhead"].value === "none" ? null : settings["Ending arrowhead"].value;
const linePoints = Math.floor(settings["Line points"].value);



const elements = ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
groups = ea.getMaximumGroups(elements);
/*
const num = parseInt(await utils.inputPrompt("num?",null,"2"));

if(groups.length !== num) {
  //unfortunately getMaxGroups returns duplicated resultset for sticky notes
  //needs additional filtering
  cleanGroups=[];
  idList = [];
  for (group of groups) {
    keep = true;
    for(item of group) if(idList.contains(item.id)) keep = false;
    if(keep) {
      cleanGroups.push(group);
      idList = idList.concat(group.map(el=>el.id))
    }
  }
  if(cleanGroups.length !==  num) return;
  groups = cleanGroups;
}*/
els=[];
elsx=[];
elsy=[];
for (i = 0, len =groups.length; i < len; i++)
{
els.push(ea.getLargestElement(groups[i]));

elsy.push(ea.getLargestElement(groups[i]).y)
}
/*
els = [ 
  ea.getLargestElement(groups[0]),
  ea.getLargestElement(groups[1]),
  ea.getLargestElement(groups[2])
];*/
ea.style.strokeColor = els[0].strokeColor;
ea.style.strokeWidth = els[0].strokeWidth;
ea.style.strokeStyle = els[0].strokeStyle;
ea.style.strokeSharpness = els[0].strokeSharpness;
var maxy = Math.max.apply(null, elsy);
var indexmaxy=elsy.indexOf(maxy);
var miny = Math.min.apply(null, elsy);
var indexminy = elsy.indexOf(miny);

/*for(i = 1, len =groups.length; i < len; i++)
{ 
  elsx.push(els[i].x)
} */
ea.addLine([[els[0].x + els[0].width * 1.5, maxy + els[indexmaxy].height / 2], [els[0].x + els[0].width * 1.5, miny + els[indexminy].height / 2]]);
for (i = 1, len = groups.length; i < len; i++)
{
  ea.addLine([[els[i].x, els[i].y + els[i].height/2], [els[0].x + els[0].width * 1.5, els[i].y + els[i].height/2]]);
}
ea.addLine([[els[0].x+els[0].width, els[0].y + els[0].height / 2], [els[0].x + els[0].width * 1.5, els[0].y + els[0].height / 2]])
 //await ea.create();
/*
ea.connectObjects(
  els[0].id,
  null,
  els[2].id,
  null, 
  {
	endArrowHead: arrowEnd,
	startArrowHead: arrowStart, 
	numberOfPoints: 1
  }
);
*/
ea.addElementsToView(false,false,true);
