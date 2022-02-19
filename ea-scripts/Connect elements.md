/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-connect-elements.jpg)

This script will connect two objects with an arrow. If either of the objects are a set of grouped elements (e.g. a text element grouped with an encapsulating rectangle), the script will identify these groups, and connect the arrow to the largest object in the group (assuming you want to connect the arrow to the box around the text element).

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

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
		"Ending arrowhead" : {
			value: "triangle",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Line points" : {
			value: 1,
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
if(groups.length !== 2) {
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
  if(cleanGroups.length !== 2) return;
  groups = cleanGroups;
}
els = [ 
  ea.getLargestElement(groups[0]),
  ea.getLargestElement(groups[1])
];

ea.style.strokeColor = els[0].strokeColor;
ea.style.strokeWidth = els[0].strokeWidth;
ea.style.strokeStyle = els[0].strokeStyle;
ea.style.strokeSharpness = els[0].strokeSharpness;
ea.connectObjects(
  els[0].id,
  null,
  els[1].id,
  null, 
  {
	endArrowHead: arrowEnd,
	startArrowHead: arrowStart, 
	numberOfPoints: linePoints
  }
);
ea.addElementsToView(false,false,true);