
/*

Replaces latex formulas between $ .. $ in a text by actual latex formulas

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-latex.png)
- the LaTex parts must not contain line break
- LaTex formulas are centered relative to their line
- style and size of the text elements are preserved

```js
*/

// return a list of record [{islatex:bool, str:string}]
// that is a split of str with the latex part (between '$') separated
// if islatex=true the enclosing '$' characters are removed and str is a latex formula
// if islatex=false str does not contains latex parts
function splitLatex(str) {
	const latex_reg = /(\$(\\\$|[^$])+\$)/g;
	const result = [];
	let lastIndex = 0;
	const matches = str.matchAll(latex_reg);
	for ( tmp of matches) {
		if (lastIndex != tmp.index) {
			// we add the text between the last latex and the new latex
			result.push({islatex:false, str:str.slice(lastIndex, tmp.index)});
		}

		// we add the new latex found (and remove first and last '$')
		result.push({islatex:true, str:tmp[0].slice(1,-1)});
		lastIndex = tmp.index + tmp[0].length;
	}

	if (lastIndex < str.length){
		// add the rest of the string without latex part in it
		result.push({islatex:false, str:str.slice(lastIndex)});
	}
	console.log(result);
	return result
}


function getHeightMax(idTable){
	return Math.max(...idTable.map((id) => ea.getElement(id).height))
}

function copyStyleGlobal(element){
	if(!element) {
		return;
	}

	ea.style.strokeWidth = element.strokeWidth;
	ea.style.strokeStyle = element.strokeStyle;
	ea.style.strokeSharpness = element.strokeSharpness;
	ea.style.roughness = element.roughness;
	ea.style.fillStyle = element.fillStyle;
	ea.style.backgroundColor = element.backgroundColor;
	ea.style.strokeColor = element.strokeColor;

	if(element.type === 'text') {
		ea.style.fontFamily = element.fontFamily;
		ea.style.fontSize = element.fontSize;
		ea.style.textAlign = element.textAlign;
	}
}

// position every element in elTable properly
// (we update position aftewards because we need to do it anyway 
// for the y coordinate since latex can be big and shift the whole line)
// return the next y
function updatePosition(idLineTable, x0, y0){
	let x = x0;

	const hmax = getHeightMax(idLineTable);
	const charSize = ea.style.fontSize;
	for (const id of idLineTable){
        const el = ea.getElement(id);
		if (el.type != "text" && 0 < el.height && el.height < charSize){
            // scale LaTex if smaller than charSize
            // we don't scale if it is bigger since 
            // we usually want to keep sums and matrices bigger than the text
			el.width = el.width*(charSize/el.height);
			el.height = charSize;
		}
		el.y = y0 + hmax/2 - el.height/2;
		el.x = x;
		x += el.width;
	}
	return y0 + hmax;
}

// add part as a latex of as a text depending on part.islatex
// return id
function addTextOrLatex(part,x,y){
	if (part.islatex) {	      
		return ea.addLaTex(x, y, part.str); 
	}else { 
		return ea.addText(x, y, part.str);
	}
}

let elements = ea.getViewSelectedElements().filter((el)=> el.type == "text");

if(!elements) {
	return;
}

for (const el of elements) {
	const text = el.text;
	const lines = text.split('\n');
	let y = el.y;
	let idTable = []; // table of elements to group
	copyStyleGlobal(el); // copy the style el for the next elements
	for (const line of lines){
		const lineIdTable = [];
		for (const part of splitLatex(line)) {
			let id = await addTextOrLatex(part,0,0);
			lineIdTable.push(id);
		}		
		y = updatePosition(lineIdTable, el.x, y);
		idTable = idTable.concat(lineIdTable);
	}

	ea.addToGroup(idTable); // create a group with all text and latex elements
};
ea.deleteViewElements(elements);
ea.addElementsToView();