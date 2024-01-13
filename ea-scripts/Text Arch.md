/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/text-arch.jpg)

Fit a text to the arch of a circle. The script will prompt you for the radius of the circle and then split your text to individual letters and place each letter to the arch defined by the radius. Setting a lower radius value will increase the arching of the text. Note that the arched-text will no longer be editable as a text element and it will no longer function as a markdown link. Emojis are currently not supported.

```javascript
*/
el = ea.getViewSelectedElement();
if(!el || el.type!=="text") {
	new Notice("Please select a text element");
  return;
}

ea.style.fontSize = el.fontSize;
ea.style.fontFamily = el.fontFamily;
ea.style.strokeColor = el.strokeColor;
ea.style.opacity = el.opacity;

const r = parseInt (await utils.inputPrompt("The radius of the arch you'd like to fit the text to","number","150"));
const archAbove = await utils.suggester(["Arch above","Arch below"],[true,false]);

if(isNaN(r)) {
  new Notice("The radius is not a number");
  return;
}

circlePoint = (angle) => archAbove
  ? [
		r * Math.sin(angle),
		-r * Math.cos(angle)
	]
	: [
		-r * Math.sin(angle),
		r * Math.cos(angle)
	];

let rot = (archAbove ? -0.5 : 0.5) * ea.measureText(el.text).width/r;

let objectIDs = [];
for(i=0;i<el.text.length;i++) {
	const character = el.text.substring(i,i+1);
	const width = ea.measureText(character).width;
  ea.style.angle = rot;
  const [x,y] = circlePoint(rot);
  rot += (archAbove ? 1 : -1) *width / r;
  objectIDs.push(ea.addText(x,y,character));
}
ea.addToGroup(objectIDs);
ea.addElementsToView(true, false, true);