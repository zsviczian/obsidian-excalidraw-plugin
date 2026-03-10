# [◀ Excalidraw 自动化使用指南](../readme.md)

## 在当前编辑的文档中插入新绘图

这个 [Templater](https://github.com/SilentVoid13/Templater) 模板会提示你输入绘图的标题。它将使用提供的标题创建一个新的绘图，并将其保存在你正在编辑的文档所在的文件夹中。然后，它会在光标位置嵌入新绘图，并通过拆分当前页面的方式在新的工作区中打开这个绘图。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

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