# [◀ Excalidraw 自动化指南](../readme.md)

## 画布样式设置
设置画布的属性。

### theme, setTheme()
字符串。有效值为 "light"（明亮）和 "dark"（黑暗）。

`setTheme()` 接受一个数字参数：
- 0："light"（明亮）
- 其他任何数字："dark"（黑暗）

### viewBackgroundColor
字符串。这是对象的填充颜色。[CSS 合法颜色值](https://www.w3schools.com/cssref/css_colors_legal.asp)

允许的值包括 [HTML 颜色名称](https://www.w3schools.com/colors/colors_names.asp)、十六进制 RGB 字符串（例如红色使用 `#FF0000`）或 `transparent`（透明）。

### gridSize
数字。网格的大小。如果设置为零，则不显示网格。
