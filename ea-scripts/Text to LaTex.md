
/*

Replaces LaTeX formulas between $ .. $ in a text by actual LaTeX formulas and reversely 

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-latex.png)

if only texts are selected, the text is transformed into text + LaTeX:
- the LaTeX parts must not contain line break
- LaTeX formulas are centered relative to their line
- style and size of the text elements are preserved
- text and LaTeX are combined in a group at the end

if text and LaTeX are selected, all texts and LaTeX are combined into one text, with LaTeX formulas between $ .. $
- style and size of the first text is used for the whole string


PS: there is a bit of "figuring out" where to place elements on the LaTeX to text part, 
but usually we should use it on an output produced by this script itself 
i.e aligned elements, so it should be fine.

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
	return result
}



function getHeightMax(idTable){
	function sanitycheck(id){
		if (ea.getElement(id)){
			return ea.getElement(id).height;
		} else {
			new Notice ("Text to LaTex: something went wrong");
			return 0;
		}
	}
	return Math.max(ea.style.fontSize,...idTable.map(sanitycheck));
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

// return true if we should add a '\n' between el1 and el2
function isLineBreak(el1, el2){
	let middle1 = el1.y + el1.height/2;
	let middle2 = el2.y + el2.height/2;
	return (middle1 > el2.y + el2.height ) || (middle2 > el1.y + el1.height);
}

// sort the elements el1 and el2 with a 
// somewhat intuitive sorting
function sortelems(el1, el2){
	let middle1 = el1.y + el1.height/2;
	let middle2 = el2.y + el2.height/2;

	if (middle1 > el2.y + el2.height || 
		(el2.y <= middle1 && middle1 <= el2.y + el2.height && el1.x >= el2.x)) {
		return 1; // el1 >= el2
	}
	return -1; // el1 < el2
}



if (ea.getViewSelectedElements().length == 0){
	new Notice("Text to Latex: please select text or LaTex first");
	return;
}


if (ea.getViewSelectedElements().find((el) => el.type === "image") === undefined){ 

////// text to latex part

let txt_elements = ea.getViewSelectedElements().filter((el)=> el.type === "text");
for (const el of txt_elements) {
	const text = el.text;
	const lines = text.split('\n');
	let y = el.y;
	let idTable = []; // table of elements to group
	copyStyleGlobal(el); // copy the style el for the next elements
	for (const line of lines){
		const lineIdTable = [];
		for (const part of splitLatex(line)) {
			if (part.length == 0) continue;
			let id = await addTextOrLatex(part,0,0);
			lineIdTable.push(id);
		}
		y = updatePosition(lineIdTable, el.x, y);
		idTable = idTable.concat(lineIdTable);
	}

	ea.addToGroup(idTable); // create a group with all text and latex elements
};
ea.deleteViewElements(txt_elements);
ea.addElementsToView();

///// end text to latex part

}else{

///// latex to text part

let elToDelete = [];
let resultString = "";
let sortedEls = ea.getViewSelectedElements().sort(sortelems);
for (let i = 0; i < sortedEls.length; i++){
	const el = sortedEls[i];
	if (el.type === "text") {
		resultString += el.text;
		elToDelete.push(el);
		if (i+1 < sortedEls.length && isLineBreak(el,sortedEls[i+1])){
			resultString += "\n";
		}
	}else if (el.type === "image"){
		const equation = ea.targetView.excalidrawData.getEquation(el.fileId);
		if (equation){
			resultString += "$" + equation.latex + "$";
			elToDelete.push(el);
			if (i+1 < sortedEls.length && isLineBreak(el,sortedEls[i+1])){
				resultString += "\n";
			}
		}
	}
}

// choosing which style to apply
let aRandomText = sortedEls.find((el) => el.type === "text");
if (aRandomText != undefined){
	copyStyleGlobal(aRandomText);
}

if (resultString.length > 0) {
	ea.addText(sortedEls[0].x, sortedEls[0].y, resultString);
}


ea.deleteViewElements(elToDelete);
ea.addElementsToView();

///// end latex to text part

}
