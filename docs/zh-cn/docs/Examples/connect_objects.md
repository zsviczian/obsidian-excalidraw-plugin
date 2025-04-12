# [◀ Excalidraw Automate 使用指南](../readme.md)

## 连接对象

这个 [Templater](https://github.com/SilentVoid13/Templater) 模板演示了如何使用 ExcalidrawAutomate 连接两个对象。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

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
