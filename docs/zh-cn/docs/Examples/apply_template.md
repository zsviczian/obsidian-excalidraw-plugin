# [◀ Excalidraw 自动化使用指南](../readme.md)

## 将 Excalidraw 模板应用到新绘图

这个示例与介绍中的类似，只是将图形旋转了90度，并且使用了模板，同时指定了保存绘图的文件名和文件夹，还会在新窗格中打开这个新绘图。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

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