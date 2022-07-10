# [◀ Excalidraw Automate How To](../readme.md)
## Applying an Excalidraw Template to a New Drawing
This example is similar to the one in the introduction, only rotated 90°, and using a template, plus specifying a filename and folder to save the drawing, and opening the new drawing in a new pane.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.style.angle = Math.PI/2; 
  ea.style.strokeWidth = 3.5;
  ea.addRect(-150,-50,450,300);
  ea.addText(-100,70,"Left to right");
  ea.addArrow([[-100,100],[100,100]]);

  ea.style.strokeColor = "red";
  await ea.addText(100,-30,"top to bottom",{width:200,textAlign:"center"});
  ea.addArrow([[200,0],[200,200]]);
  await ea.create({
    filename    :"My Drawing",
    foldername  :"myfolder/fordemo/",
    templatePath:"Excalidraw/Template2.excalidraw",
    onNewPane   :true});
%>
```