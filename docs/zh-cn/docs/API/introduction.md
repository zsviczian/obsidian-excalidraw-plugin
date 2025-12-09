# [◀ Excalidraw Automate 使用指南](../readme.md)

## API 介绍

你可以通过 ExcalidrawAutomate 对象来访问 Excalidraw Automate。我建议在 Templater、DataView 和 QuickAdd 脚本中使用以下代码开始：

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

```javascript
const ea = ExcalidrawAutomate;
ea.reset();
```

第一行创建了一个常量，这样你就可以避免重复写 ExcalidrawAutomate 上百次。

第二行将 ExcalidrawAutomate 重置为默认值。这一步很重要，因为你不会知道之前执行了哪个模板，因此也不知道 Excalidraw 处于什么状态。

**⚠ 注意：** 如果你正在使用 Excalidraw 插件内置的[脚本引擎](../ExcalidrawScriptsEngine.md)，引擎会自动处理 `ea` 对象的初始化。

### Excalidraw Automate 的基本使用逻辑

1. 设置要绘制元素的样式
2. 添加元素。当你添加元素时，每个新元素都会被添加到前一个元素的上层，因此在元素重叠的情况下，后添加的元素会显示在先添加元素的上方。
3. 调用 `await ea.create();` 来实例化绘图，或使用 `ea.setView();` 后跟 `ea.addElementsToView();` 将元素添加到现有视图中，或使用 `await ea.createSVG();` 或 `await ea.createPNG();` 从你的元素创建 PNG 或 SVG 图像。

你可以在添加不同元素之间改变样式。我将元素样式和创建分开的逻辑基于这样一个假设：你可能会设置一个描边颜色、描边样式、描边粗糙度等，并使用这些设置来绘制大多数元素。每次添加元素时都重新设置所有这些参数是没有意义的。

### 在深入了解之前，这里有三个简单的 [Templater](https://github.com/SilentVoid13/Templater) 脚本示例

#### 使用模板在自定义文件夹中创建具有自定义名称的新绘图

这个简单的脚本相比 Excalidraw 插件设置提供了更大的灵活性，让你可以为绘图命名、将其放入文件夹中并应用模板。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  await ea.create({
    filename    : tp.date.now("HH.mm"), 
    foldername  : tp.date.now("YYYY-MM-DD"),
    templatePath: "Excalidraw/Template1.excalidraw",
    onNewPane   : false
  });
%>
```

#### 创建一个简单的绘图

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.addRect(-150,-50,450,300);
  ea.addText(-100,70,"Left to right");
  ea.addArrow([[-100,100],[100,100]]);

  ea.style.strokeColor = "red";
  ea.addText(100,-30,"top to bottom",{width:200,textAligh:"center"});
  ea.addArrow([[200,0],[200,200]]);
  await ea.create();
%>
```

该脚本将生成以下绘图：

![FristDemo](https://user-images.githubusercontent.com/14358394/116825643-6e5a8b00-ab90-11eb-9e3a-37c524620d0d.png)

#### 在打开的 Excalidraw 视图中添加一个带框的文本元素

将新元素放置在当前选中元素的下方，并用箭头从选中的元素指向新添加的文本。

*使用 <kbd>CTRL+Shift+V</kbd> 将代码粘贴到 Obsidian 中！*

```javascript
<%*
  const ea = ExcalidrawAutomate;
  ea.reset();
  ea.setView("first"); 
  selectedElement = ea.getViewSelectedElement();
  ea.setStrokeSharpness(0);
  const boxPadding = 5;
  id = ea.addText(
    selectedElement.x + boxPadding,
    selectedElement.y+selectedElement.height+100,
    "[[Next process step]]",
    {
      textAlign:"center",
      box:true,
      boxPadding:boxPadding,
      width:selectedElement.width-boxPadding*2,
    }
  );
  ea.setStrokeSharpness(1);
  ea.style.roughness= 0;
  ea.connectObjectWithViewSelectedElement(
    id,
    "top",
    "bottom",
    {
      numberOfPoints:2,
      startArrowHead:"arrow",
      endArrowHead:"dot", 
      padding:5
  });
  ea.addElementsToView();
%>
```

[点击此处查看动画演示](https://user-images.githubusercontent.com/14358394/131967188-2a488e38-f742-49d9-ae98-33238a8d4712.mp4)
