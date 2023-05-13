/*
Copies the text from the selected PDF page on the Excalidraw canvas to the clipboard.

<iframe width="560" height="315" src="https://www.youtube.com/embed/Kwt_8WdOUT4" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
Link:: https://youtu.be/Kwt_8WdOUT4


```js*/
const el = ea.getViewSelectedElements().filter(el=>el.type==="image")[0];
if(!el) {
  new Notice("Select a PDF page");
  return;
}
const f = ea.getViewFileForImageElement(el);
if(f.extension.toLowerCase() !== "pdf") {
  new Notice("Select a PDF page");
  return;
}

const pageNum = parseInt(ea.targetView.excalidrawData.getFile(el.fileId).linkParts.ref.replace(/\D/g, ""));
if(isNaN(pageNum)) {
  new Notice("Can't find page number");
  return;
}

const pdfDoc = await window.pdfjsLib.getDocument(app.vault.getResourcePath(f)).promise;
const page = await pdfDoc.getPage(pageNum);
const text = await page.getTextContent();
if(!text) {
	new Notice("Could not get text");
	return;
}
pdfDoc.destroy();
window.navigator.clipboard.writeText(
  text.items.reduce((acc, cur) => acc + cur.str.replace(/\x00/ug, '') + (cur.hasEOL ? "\n" : ""),"")
);
new Notice("Page text is available on the clipboard");