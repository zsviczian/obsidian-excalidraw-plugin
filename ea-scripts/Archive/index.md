If you are enjoying the Excalidraw plugin then please support my work and enthusiasm by buying me a coffee on [https://ko-fi/zsolt](https://ko-fi.com/zsolt).

[<img src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" class="coffee">](https://ko-fi.com/zsolt) 

---

Jump ahead to the [[#List of available scripts]]

# Introducing Excalidraw Automate Script Engine
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
- [[#Add Connector Point]]
- [[#Add Link to Existing File and Open]]
- [[#Add Link to New Page and Open]]
- [[#Add Next Step in Process]]
- [[#Box Each Selected Groups]]
- [[#Box Selected Elements]]
- [[#Change shape of selected elements]]
- [[#Connect elements]]
- [[#Convert freedraw to line]]
- [[#Convert selected text elements to sticky notes]]
- [[#Convert text to link with folder and alias]]
- [[#Copy Selected Element Styles to Global]]
- [[#Create new markdown file and embed into active drawing]]
- [[#Darken background color]]
- [[#Elbow connectors]]
- [[#Expand rectangles horizontally keep text centered]]
- [[#Expand rectangles horizontally]]
- [[#Expand rectangles vertically keep text centered]]
- [[#Expand rectangles vertically]]
- [[#Fixed horizontal distance between centers]]
- [[#Fixed inner distance]]
- [[#Fixed spacing]]
- [[#Fixed vertical distance between centers]]
- [[#Fixed vertical distance]]
- [[#Lighten background color]]
- [[Mindmap connector]]
- [[#Modify background color opacity]]
- [[#Normalize Selected Arrows]]
- [[#OCR - Optical Character Recognition]]
- [[#Organic Line]]
- [[#Repeat Elements]]
- [[#Reverse arrows]]
- [[#Scribble Helper]]
- [[#Select Elements of Type]]
- [[#Set background color of unclosed line object by adding a shadow clone]]
- [[#Set Dimensions]]
- [[#Set Font Family]]
- [[#Set Grid]]
- [[#Set Link Alias]]
- [[#Set Stroke Width of Selected Elements]]
- [[#Set Text Alignment]]
- [[#Split text by lines]]
- [[#Toggle Fullscreen on Mobile]]
- [[#Transfer TextElements to Excalidraw markdown metadata]]
- [[#Zoom to Fit Selected Elements]]

## Add Connector Point
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Add%20Connector%20Point.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Connector%20Point.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will add a small circle to the top left of each text element in the selection and add the text and the "connector point" to a group. You can use the connector points to link text elements with an arrow (in for example a Wardley Map).<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-bullet-point.jpg'></td></tr></table>

## Add Link to Existing File and Open
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Add%20Link%20to%20Existing%20File%20and%20Open.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Link%20to%20Existing%20File%20and%20Open.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Prompts for a file from the vault. Adds a link to the selected element pointing to the selected file. You can control in settings to open the file in the current active pane or an adjacent pane.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-link-and-open.jpg'></td></tr></table>

## Add Link to New Page and Open
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Add%20Link%20to%20New%20Page%20and%20Open.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Link%20to%20New%20Page%20and%20Open.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Prompts for filename. Offers option to create and open a new Markdown or Excalidraw document. Adds link pointing to the new file, to the selected objects in the drawing. You can control in settings to open the file in the current active pane or an adjacent pane.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-link-to-new-page-and-pen.jpg'></td></tr></table>

## Add Next Step in Process
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Add%20Next%20Step%20in%20Process.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Add%20Next%20Step%20in%20Process.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will prompt you for the title of the process step, then will create a stick note with the text. If an element is selected then the script will connect this new step with an arrow to the previous step (the selected element). If no element is selected, then the script assumes this is the first step in the process and will only output the sticky note with the text that was entered.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-process-step.jpg'></td></tr></table>

## Box Each Selected Groups
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Box%20Each%20Selected%20Groups.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Box%20Each%20Selected%20Groups.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will add encapsulating boxes around each of the currently selected groups in Excalidraw.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-box-each-selected-groups.png'></td></tr></table>

## Box Selected Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Box%20Selected%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Box%20Selected%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will add an encapsulating box around the currently selected elements in Excalidraw.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-box-elements.jpg'></td></tr></table>

## Change shape of selected elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Change%20shape%20of%20selected%20elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Change%20shape%20of%20selected%20elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script allows you to change the shape of selected Rectangles, Diamonds and Ellipses.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-change-shape.jpg'></td></tr></table>

## Connect elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Connect%20elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Connect%20elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will connect two objects with an arrow. If either of the objects are a set of grouped elements (e.g. a text element grouped with an encapsulating rectangle), the script will identify these groups, and connect the arrow to the largest object in the group (assuming you want to connect the arrow to the box around the text element).<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-connect-elements.jpg'></td></tr></table>

## Convert freedraw to line
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Convert%20freedraw%20to%20line.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Convert%20freedraw%20to%20line.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Convert selected freedraw objects into editable lines. This will allow you to adjust your drawings by dragging line points and will also allow you to select shape fill in case of enclosed lines. You can adjust conversion point density in settings.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-convert-freedraw-to-line.jpg'></td></tr></table>

## Convert selected text elements to sticky notes
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Convert%20selected%20text%20elements%20to%20sticky%20notes.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Convert%20selected%20text%20elements%20to%20sticky%20notes.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Converts selected plain text elements to sticky notes with transparent background and transparent stroke color (default setting, can be changed in plugin settings). Essentially converts text element into a wrappable format.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-textelement-to-transparent-stickynote.png'></td></tr></table>

## Convert text to link with folder and alias
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Convert%20text%20to%20link%20with%20folder%20and%20alias.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Convert%20text%20to%20link%20with%20folder%20and%20alias.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Converts text elements to links pointing to a file in a selected folder and with the alias set as the original text. The script will prompt the user to select an existing folder from the vault.<br><code>original text</code> - <code>[[selected folder/original text|original text]]</code></td></tr></table>

## Copy Selected Element Styles to Global
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Copy%20Selected%20Element%20Styles%20to%20Global.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Copy%20Selected%20Element%20Styles%20to%20Global.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will copy styles of any selected element into Excalidraw's global styles.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-copy-selected-element-styles-to-global.png'></td></tr></table>

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

## Fixed horizontal distance between centers
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20horizontal%20distance%20between%20centers.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20horizontal%20distance%20between%20centers.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script arranges the selected elements horizontally with a fixed center spacing.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-horizontal-distance-between-centers.png'></td></tr></table>

## Fixed inner distance
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20inner%20distance.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20inner%20distance.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script arranges selected elements and groups with a fixed inner distance.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-inner-distance.png'></td></tr></table>

## Fixed spacing
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20spacing.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20spacing.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script arranges the selected elements horizontally with a fixed spacing. When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fix-space-demo.png'></td></tr></table>

## Fixed vertical distance between centers
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20vertical%20distance%20between%20centers.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20vertical%20distance%20between%20centers.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script arranges the selected elements vertically with a fixed center spacing.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-vertical-distance-between-centers.png'></td></tr></table>

## Fixed vertical distance
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Fixed%20vertical%20distance.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Fixed%20vertical%20distance.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script arranges the selected elements vertically with a fixed spacing. When we create an architecture diagram or mind map, we often need to arrange a large number of elements in a fixed spacing. `Fixed spacing` and `Fixed vertical Distance` scripts can save us a lot of time.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-fixed-vertical-distance.png'></td></tr></table>

## Lighten background color
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Lighten%20background%20color.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Lighten%20background%20color.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script lightens the background color of the selected element by 2% at a time. You can use this script several times until you are satisfied. It is recommended to set a shortcut key for this script so that you can quickly try to DARKEN and LIGHTEN the color effect.In contrast to the `Modify background color opacity` script, the advantage is that the background color of the element is not affected by the canvas color, and the color value does not appear in a strange rgba() form.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/darken-lighten-background-color.png'></td></tr></table>

## Mindmap connector
```excalidraw-script-install
https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20connector.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/xllowl'>@xllowl</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20connector.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script creates mindmap like lines(only right side available). The line will starts according to the creation time of the elements. So you may need to create the header element first.<br><img src='https://github.com/xllowl/obsidian-excalidraw-plugin/blob/master/images/mindmap%20connector.png'></td></tr></table>

## Modify background color opacity
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Modify%20background%20color%20opacity.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Modify%20background%20color%20opacity.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script changes the opacity of the background color of the selected boxes. The default background color in Excalidraw is so dark that the text is hard to read. You can lighten the color a bit by setting transparency. And you can tweak the transparency over and over again until you're happy with it. Although excalidraw has the opacity option in its native property Settings, it also changes the transparency of the border. Use this script to change only the opacity of the background color without affecting the border.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-modify-background-color-opacity.png'></td></tr></table>

## Normalize Selected Arrows
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Normalize%20Selected%20Arrows.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Normalize%20Selected%20Arrows.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will reset the start and end positions of the selected arrows. The arrow will point to the center of the connected box and will have a gap of 8px from the box.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-normalize-selected-arrows.png'></td></tr></table>

## OCR - Optical Character Recognition
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/OCR%20-%20Optical%20Character%20Recognition.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/OCR%20-%20Optical%20Character%20Recognition.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">REQUIRES EXCALIDRAW 1.5.15<br>The script will  1) send the selected image file to [taskbone.com](https://taskbone.com) to exctract the text from the image, and 2) will add the text to your drawing as a text element.<br><mark>⚠ Note that you will need to manually paste your token into the script after the first run! ⚠</mark><br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-ocr.jpg'><br><iframe width="560" height="315" src="https://www.youtube.com/embed/W2NMzR8s4eE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></td></tr></table>

## Organic Line
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Organic%20Line.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Organic%20Line.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Converts selected freedraw lines such that pencil pressure will decrease from maximum to minimum from the beginning of the line to its end. The resulting line is placed at the back of the layers, under all other items. Helpful when drawing organic mindmaps.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-organic-line.jpg'></td></tr></table>

## Repeat Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Repeat%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/1-2-3'>@1-2-3</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Repeat%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will detect the difference between 2 selected elements, including position, size, angle, stroke and background color, and create several elements that repeat these differences based on the number of repetitions entered by the user.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-repeat-elements.png'></td></tr></table>

## Reverse arrows
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Reverse%20arrows.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Reverse%20arrows.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Reverse the direction of **arrows** within the scope of selected elements.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-reverse-arrow.jpg'></td></tr></table>

## Scribble Helper
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Scribble%20Helper.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Scribble%20Helper.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">iOS scribble helper for better handwriting experience with text elements. If no elements are selected then the creates a text element at pointer position and you can use the edit box to modify the text with scribble. If a text element is selected then opens the input prompt where you can modify this text with scribble.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-scribble-helper.jpg'></td></tr></table>

## Select Elements of Type
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Select%20Elements%20of%20Type.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Select%20Elements%20of%20Type.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Prompts you with a list of the different element types in the active image. Only elements of the selected type will be selected on the canvas. If nothing is selected when running the script, then the script will process all the elements on the canvas. If some elements are selected when the script is executed, then the script will only process the selected elements.<br>The script is useful when, for example, you want to bring to front all the arrows, or want to change the color of all the text elements, etc.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-select-element-of-type.jpg'></td></tr></table>

## Set background color of unclosed line object by adding a shadow clone
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20background%20color%20of%20unclosed%20line%20object%20by%20adding%20a%20shadow%20clone.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Use this script to set the background color of unclosed (i.e. open) line objects by creating a clone of the object. The script will set the stroke color of the clone to transparent and will add a straight line to close the object. Use settings to define the default background color, the fill style, and the strokeWidth of the clone. By default the clone will be grouped with the original object, you can disable this also in settings.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-set-background-color-of-unclosed-line.jpg'></td></tr></table>

## Set Dimensions
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Dimensions.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Dimensions.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Currently there is no way to specify the exact location and size of objects in Excalidraw. You can bridge this gap with the following simple script.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-dimensions.jpg'></td></tr></table>

## Set Font Family
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Font%20Family.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Font%20Family.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Sets font family of the text block (Virgil, Helvetica, Cascadia). Useful if you want to set a keyboard shortcut for selecting font family.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-font-family.jpg'></td></tr></table>

## Set Grid
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Grid.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Grid.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The default grid size in Excalidraw is 20. Currently there is no way to change the grid size via the user interface. This script offers a way to bridge this gap.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid.jpg'></td></tr></table>

## Set Link Alias
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Link%20Alias.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Link%20Alias.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Iterates all of the links in the selected TextElements and prompts the user to set or modify the alias for each link found.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-set-link-alias.jpg'></td></tr></table>

## Set Stroke Width of Selected Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Stroke%20Width%20of%20Selected%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Stroke%20Width%20of%20Selected%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">This script will set the stroke width of selected elements. This is helpful, for example, when you scale freedraw sketches and want to reduce or increase their line width.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-stroke-width.jpg'></td></tr></table>

## Set Text Alignment
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Set%20Text%20Alignment.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Set%20Text%20Alignment.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Sets text alignment of text block (cetner, right, left). Useful if you want to set a keyboard shortcut for selecting text alignment.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-align.jpg'></td></tr></table>

## Split text by lines
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Split%20text%20by%20lines.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Split%20text%20by%20lines.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Split lines of text into separate text elements for easier reorganization<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-split-lines.jpg'></td></tr></table>

## TheBrain-navigation
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/TheBrain-navigation.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/TheBrain-navigation.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">An Excalidraw based graph user interface for your Vault. Requires the <a href='https://github.com/SkepticMystic/breadcrumbs'>Breadcrumbs plugin</a> to be installed and configured as well. Generates a user interface similar to that of <a href='https://TheBrain.com'>TheBrain</a>. Watch this introduction to this script on <a href='https://youtu.be/J4T5KHERH_o'>YouTube</a>.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/TheBrain.jpg'></td></tr></table>

## Toggle Fullscreen on Mobile
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Toggle%20Fullscreen%20on%20Mobile.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Toggle%20Fullscreen%20on%20Mobile.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Hides Obsidian workspace leaf padding and header (based on option in settings, default is "hide header" = false) which will take Excalidraw to full screen. ⚠ Note that if the header is not visible, it will be very difficult to invoke the command palette to end full screen. Only hide the header if you have a keyboard or you've practiced opening command palette!<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/ea-toggle-fullscreen.jpg'></td></tr></table>

## Transfer TextElements to Excalidraw markdown metadata
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Transfer%20TextElements%20to%20Excalidraw%20markdown%20metadata.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Transfer%20TextElements%20to%20Excalidraw%20markdown%20metadata.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">The script will delete the selected text elements from the canvas and will copy the text from these text elements into the Excalidraw markdown file as metadata. This means, that the text will no longer be visible in the drawing, however you will be able to search for the text in Obsidian and find the drawing containing this image.<br><img src='https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-metadata.jpg'></td></tr></table>

## Zoom to Fit Selected Elements
```excalidraw-script-install
https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/Zoom%20to%20Fit%20Selected%20Elements.md
```
<table><tr  valign='top'><td class="label">Author</td><td class="data"><a href='https://github.com/zsviczian'>@zsviczian</a></td></tr><tr valign='top'><td class="label">Source</td><td class="data"><a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Zoom%20to%20Fit%20Selected%20Elements.md'>File on GitHub</a></td></tr><tr valign='top'><td class="label">Description</td><td class="data">Similar to Excalidraw standard <kbd>SHIFT+2</kbd> feature: Zoom to fit selected elements, but with the ability to zoom to 1000%. Inspiration: [#272](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/272)</td></tr></table>
