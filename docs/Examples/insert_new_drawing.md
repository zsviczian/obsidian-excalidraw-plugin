# [◀ Excalidraw Automate How To](../readme.md)
## Insert new drawing into currently edited document
This [Templater](https://github.com/SilentVoid13/Templater) template will prompt you for the title of the drawing. It will create a new drawing with the provided title, and in the folder of the document you were editing. It will then transclude the new drawing at the cursor location and open the new drawing in a new workspace leaf by splitting the current leaf.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const defaultTitle = tp.date.now("HHmm")+' '+tp.file.title;
  const title = await tp.system.prompt("Title of the drawing?", defaultTitle);
  const folder = tp.file.folder(true);
  const transcludePath = (folder== '/' ? '' : folder + '/') + title + '.excalidraw';
  tR = '![['+transcludePath+']]';
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.setTheme(1); //set Theme to dark
  await ea.create({
    filename : title,
    foldername : folder,
    //templatePath: 'Excalidraw/Template.excalidraw', //uncomment if you want to use a template
    onNewPane : true
  });
%>
```