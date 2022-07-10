# [◀ Excalidraw Automate How To](../readme.md)
## Connect Objects
This [Templater](https://github.com/SilentVoid13/Templater) template demonstrates how to connect two objects using ExcalidrawAutomate.

*Use <kbd>CTRL+Shift+V</kbd> to paste code into Obsidian!*
```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.addText(-130,-100,"Connecting two objects");
  const a = ea.addRect(-100,-100,100,100);
  const b = ea.addEllipse(200,200,100,100);
  ea.connectObjects(a,"bottom",b,"left",{numberOfPoints: 2}); //see how the line breaks differently when moving objects around
  ea.style.strokeColor = "red";
  ea.connectObjects(a,"right",b,"top",1);
  await ea.create();
%>
```
