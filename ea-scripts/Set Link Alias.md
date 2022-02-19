/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-set-link-alias.jpg)

Iterates all of the links in the selected TextElements and prompts the user to set or modify the alias for each link found.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
// `[[markdown links]]`
for(el of elements) { //doing for instead of .forEach due to await inputPrompt
  parts = el.rawText.split(/(\[\[[\w\W]*?]])/);
  newText = "";
  for(t of parts) { //doing for instead of .map due to await inputPrompt
	if(!t.match(/(\[\[[\w\W]*?]])/)) {
	  newText += t;
    } else {
      original = t.split(/\[\[|]]/)[1];
	  cut = original.indexOf("|");
	  alias = cut === -1 ? "" : original.substring(cut+1);
	  link = cut === -1 ? original : original.substring(0,cut);
      alias = await utils.inputPrompt(`Alias for [[${link}]]`,"type alias here",alias);
	  newText += `[[${link}|${alias}]]`;
    }
  }
  el.rawText = newText;
};

// `[wiki](links)`
for(el of elements) { //doing for instead of .forEach due to await inputPrompt
  parts = el.rawText.split(/(\[[\w\W]*?]\([\w\W]*?\))/);
  newText = "";
  for(t of parts) { //doing for instead of .map due to await inputPrompt
	if(!t.match(/(\[[\w\W]*?]\([\w\W]*?\))/)) {
	  newText += t;
    } else {
	  alias = t.match(/\[([\w\W]*?)]/)[1];
	  link = t.match(/\(([\w\W]*?)\)/)[1];
      alias = await utils.inputPrompt(`Alias for [[${link}]]`,"type alias here",alias);
	  newText += `[[${link}|${alias}]]`;
    }
  }
  el.rawText = newText;
};

ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false,false);