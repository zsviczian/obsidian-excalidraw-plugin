If you are enjoying the Excalidraw plugin then please support my work and enthusiasm by buying me a coffee on [https://ko-fi/zsolt](https://ko-fi.com/zsolt).

[<img src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" class="coffee">](https://ko-fi.com/zsolt) 

---

Jump ahead to the [[#List of available scripts]]

# Intorducing Excalidraw Automate Script Engine
<iframe width="560" height="315" src="https://www.youtube.com/embed/hePJcObHIso" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Script Engine scripts are installed in the `Downloaded` subfolder of the `Excalidraw Automate script folder` specified in plugin settings.

In the `Command Palette` installed scripts are prefixed with `Downloaded/`, thus you can always know if you are executing a local script of your own, or one that you have downloaded from GitHub.

## Attention developers and hobby hackers
<img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/hobby-programmer.svg' align='left' style='background-color:whitesmoke; width:80px; margin-right:15px; margin-bottom:10px;'/>
If you want to modify scripts, I recommend moving them to the `Excalidraw Automate script folder` or a different subfolder under the script folder. Scripts in the `Downloaded` folder will be overwritten when you click the `Update this script` button. Note also, that at this time, I do not check if the script file has been updated on GitHub, thus the `Update this script` button is always visible once you have installed a script, not only when an update is availble (hope to build this feature in the future).

I would love to include your contribution in the script library. If you have a script of your own that you would like to share with the community, please open a [PR](https://github.com/zsviczian/obsidian-excalidraw-plugin/pulls) on GitHub. Be sure to include the following in your pull request
- The [script file](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/ea-scripts) with a self explanetory name. The name of the file will be the name of the script in the Command Palette.
- An [image](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/images) explaining the scripts purpose. Remember a picture speaks thousand words!
- An update to this file [ea-scripts/index.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/index.md)

---

# List of available scripts
- [[#Box Selected Elements]]
- [[#Bullet Point]]
- [[#Connect elements]]
- [[#Convert text to link with folder and alias]]
- [[#Create new markdown file and embed into active drawing]]
- [[#Darken background color]]
- [[#Dimensions]]
- [[#Elbow connectors]]
- [[#Expand rectangles horizontally keep text centered]]
- [[#Expand rectangles horizontally]]
- [[#Expand rectangles vertically keep text centered]]
- [[#Expand rectangles vertically]]
- [[#Fixed spacing]]
- [[#Fixed vertical distance]]
- [[#Font Family]]
- [[#Grid]]
- [[#Lighten background color]]
- [[#Modify background color opacity]]
- [[#Modify stroke width of selected elements]]
- [[#OCR - Optical Character Recognition]]
- [[#Reverse arrows]]
- [[#Set Link Alias]]
- [[#Split text by lines]]
- [[#Text Align]]
- [[#Transfer TextElements to Excalidraw markdown metadata]]
- [[#Zoom to Fit Selected Elements]]


## Box Selected Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Box%20Selected%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Box%20Selected%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will add an encapsulating box around the currently selected elements in Excalidraw.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-box-elements.jpg'></td></tr></table>

## Bullet Point
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Bullet%20Point.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Bullet%20Point.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will add a small circle to the top left of each text element in the selection and add the text and the "bullet point" into a group.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-bullet-point.jpg'></td></tr></table>

## Connect elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Connect%20elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Connect%20elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will connect two objects with an arrow. If either of the objects are a set of grouped elements (e.g. a text element grouped with an encapsulating rectangle), the script will identify these groups, and connect the arrow to the largest object in the group (assuming you want to connect the arrow to the box around the text element).<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-connect-elements.jpg'></td></tr></table>

## Convert text to link with folder and alias
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Convert%20text%20to%20link%20with%20folder%20and%20alias.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Convert%20text%20to%20link%20with%20folder%20and%20alias.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Converts text elements to links pointing to a file in a selected folder and with the alias set as the original text. The script will prompt the user to select an existing folder from the vault.<br><code>original text</code> - <code>[[selected folder/original text|original text]]</code></td></tr></table>

## Create new markdown file and embed into active drawing
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Create%20new%20markdown%20file%20and%20embed%20into%20active%20drawing.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Create%20new%20markdown%20file%20and%20embed%20into%20active%20drawing.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script will prompt you for a filename, then create a new markdown document with the file name provided, open the new markdown document in an adjacent pane, and embed the markdown document into the active Excalidraw drawing.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-create-and-embed-new-markdown-file.jpg'></td></tr></table>

## Darken background color
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Darken%20background%20color.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Darken%20background%20color.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script darkens the background color of the selected element by 2% at a time. You can use this script several times until you are satisfied. It is recommended to set a shortcut key for this script so that you can quickly try to DARKEN and LIGHTEN the color effect. In contrast to the `Modify background color opacity` script, the advantage is that the background color of the element is not affected by the canvas color, and the color value does not appear in a strange rgba() form.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/darken-lighten-background-color.png'></td></tr></table>

## Dimensions
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Dimensions.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Dimensions.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Currently there is no way to specify the exact location and size of objects in Excalidraw. You can bridge this gap with the following simple script.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dimensions.jpg'></td></tr></table>

## Elbow connectors
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Elbow%20connectors.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Elbow%20connectors.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script converts the selected connectors to elbows.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/elbow-connectors.png'></td></tr></table>

## Expand rectangles horizontally keep text centered
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Expand%20rectangles%20horizontally%20keep%20text%20centered.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Expand%20rectangles%20horizontally%20keep%20text%20centered.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script expands the width of the selected rectangles until they are all the same width and keep the text centered.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif'></td></tr></table>

## Expand rectangles horizontally
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Expand%20rectangles%20horizontally.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Expand%20rectangles%20horizontally.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script expands the width of the selected rectangles until they are all the same width.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif'></td></tr></table>

## Expand rectangles vertically keep text centered
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Expand%20rectangles%20vertically%20keep%20text%20centered.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Expand%20rectangles%20vertically%20keep%20text%20centered.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script expands the height of the selected rectangles until they are all the same height and keep the text centered.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif'></td></tr></table>

## Expand rectangles vertically
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Expand%20rectangles%20vertically.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Expand%20rectangles%20vertically.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script expands the height of the selected rectangles until they are all the same height.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif'></td></tr></table>

## Fixed spacing
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20spacing.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20spacing.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script arranges the selected elements horizontally with a fixed spacing. When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fix-space-demo.png'></td></tr></table>

## Fixed vertical distance
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20vertical%20distance.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20vertical%20distance.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script arranges the selected elements vertically with a fixed spacing. When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-vertical-distance.png'></td></tr></table>

## Font Family
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Font%20Family.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Font%20Family.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Sets font family of the text block (Virgil, Helvetica, Cascadia). Useful if you want to set a keyboard shortcut for selecting font family.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-font-family.jpg'></td></tr></table>

## Grid
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Grid.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Grid.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The default grid size in Excalidraw is 20. Currently there is no way to change the grid size via the user interface. This script offers a way to bridge this gap.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid.jpg'></td></tr></table>

## Lighten background color
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Lighten%20background%20color.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Lighten%20background%20color.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script lightens the background color of the selected element by 2% at a time. You can use this script several times until you are satisfied. It is recommended to set a shortcut key for this script so that you can quickly try to DARKEN and LIGHTEN the color effect.In contrast to the `Modify background color opacity` script, the advantage is that the background color of the element is not affected by the canvas color, and the color value does not appear in a strange rgba() form.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/darken-lighten-background-color.png'></td></tr></table>

## Modify background color opacity
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Modify%20background%20color%20opacity.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Modify%20background%20color%20opacity.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script changes the opacity of the background color of the selected boxes. The default background color in Excalidraw is so dark that the text is hard to read. You can lighten the color a bit by setting transparency. And you can tweak the transparency over and over again until you're happy with it. Although excalidraw has the opacity option in its native property Settings, it also changes the transparency of the border. Use this script to change only the opacity of the background color without affecting the border.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-modify-background-color-opacity.png'></td></tr></table>

## Modify stroke width of selected elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Modify%20stroke%20width%20of%20selected%20elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Modify%20stroke%20width%20of%20selected%20elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will set the stroke width of selected elements. This is helpful, for example, when you scale freedraw sketches and want to reduce or increase their line width.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-stroke-width.jpg'></td></tr></table>

## OCR - Optical Character Recognition
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/OCR%20-%20Optical%20Character%20Recognition.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/OCR%20-%20Optical%20Character%20Recognition.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script will  1) send the selected image file to [taskbone.com](https://taskbone.com) to exctract the text from the image, and 2) will add the text to your drawing as a text element.<br><mark>⚠ Note that you will need to manually paste your token into the script after the first run! ⚠</mark><br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-ocr.jpg'><br><iframe width="560" height="315" src="https://www.youtube.com/embed/W2NMzR8s4eE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></td></tr></table>

## Reverse arrows
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Reverse%20arrows.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Reverse%20arrows.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Reverse the direction of **arrows** within the scope of selected elements.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-reverse-arrow.jpg'></td></tr></table>

## Set Link Alias
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Link%20Alias.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Link%20Alias.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Iterates all of the links in the selected TextElements and prompts the user to set or modify the alias for each link found.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-set-link-alias.jpg'></td></tr></table>

## Split text by lines
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Split%20text%20by%20lines.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Split%20text%20by%20lines.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Split lines of text into separate text elements for easier reorganization<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-split-lines.jpg'></td></tr></table>

## Text Align
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Text%20Align.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Text%20Align.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Sets text alignment of text block (cetner, right, left). Useful if you want to set a keyboard shortcut for selecting text alignment.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-align.jpg'></td></tr></table>

## Transfer TextElements to Excalidraw markdown metadata
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Transfer%20TextElements%20to%20Excalidraw%20markdown%20metadata.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Transfer%20TextElements%20to%20Excalidraw%20markdown%20metadata.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script will delete the selected text elements from the canvas and will copy the text from these text elements into the Excalidraw markdown file as metadata. This means, that the text will no longer be visible in the drawing, however you will be able to search for the text in Obsidian and find the drawing containing this image.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-metadata.jpg'></td></tr></table>

## Zoom to Fit Selected Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Zoom%20to%20Fit%20Selected%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Zoom%20to%20Fit%20Selected%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Similar to Excalidraw standard SHIFT+2 feature: Zoom to fit selected elements, but with the ability to zoom to 1000%. Inspiration: [#272](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/272)</td></tr></table>
