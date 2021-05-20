The Obsidian-Excalidraw plugin integrates [Excalidraw](https://excalidraw.com/), a feature rich sketching tool, into Obsidian. You can store and edit Excalidraw files in your vault and you can transclude drawings into your documents. For a showcase of Excalidraw features, please read my blog post [here](https://www.zsolt.blog/2021/03/showcasing-excalidraw.html) and/or watch the videos below.

# Important notice to the 1.1.x update!

Thank you for updating to Excalidraw 1.1.x!

I have improved how drawings are embedded! You no longer need an Excalidraw codeblock. You can now embed drawings just like any other images: `![[my drawing.excalidraw]]` or `![[my drawing.excalidraw|500|left]]` or `![[my drawing.excalidraw|right-wrap]]`, `![alttext|500|right](drawing.excalidraw)`, `![](folder/drawing.excalidraw)` etc. You get the idea.

ALT+Enter and CTRL+ALT+Enter on the filename in edit mode will open up the Excalidraw editor. Click and CTRL+Click on the image in preview mode will also bring up the Excalidraw editor as expected.

## MIGRATION
I have added a Migration command to the Command Palette. When you select this, the program will run a search and replace for all the excalidraw codeblocks in your vault and will convert them to the new format.

### [Ozan's Image in Editor Plugin](https://github.com/ozntel/oz-image-in-editor-obsidian)
In a nice collaboration with Ozan, his Image in Editor plugin now supports Excalidraw. I recommend installing his plugin to display drawings also in Edit mode.

![image](https://user-images.githubusercontent.com/14358394/115983515-d06c2c80-a5a1-11eb-8d12-c7df91d18107.png)

# Key features
- The plugin saves drawings to your vault as a file with the *.excalidraw* file extension.
- The plugin adds the following actions to the **command palette**:
  - Create a new drawing
  - Find and edit existing drawings in your vault, 
  - Transclude (embed) a drawing into a document, and
  - Export a drawing as PNG or SVG.
- You can also use the **file explorer** in your vault to open existing Excalidraw files. 
- Use the **ribbon button** to create a new drawing, CTRL+Click to open on a new page.
- Open settings to set up
  - a **default folder** for new drawings, 
  - a **Template** by first creating a drawing, customizing it the way you like it, and specifying the file as the template in settings,
  - Excalidraw to **automatically export SVG and/or PNG** files for your drawings, and to keep those in sync with your drawing,
  - default width of embedded drawings 
- You can also ustomize the **size and position of the embedded image** using the `[[image.excalidraw|100]]`, `[[image.excalidraw|100x100]]`, `[[image.excalidraw|100|left]]`, `[[image.excalidraw|right-wrap]]`, formatting options. `[[<filename.excalidraw>|<width>x<height>|<alignment>]]`. You can add your custom alignment via css. Any text that appears in `<alignment>` will be added as style to the SVG element and the wrapper DIV element. Check below and styles.css for more insight.
- Includes full [Templater](https://silentvoid13.github.io/Templater/) and [Dataview](https://blacksmithgu.github.io/obsidian-dataview/docs/api/intro/) support through ExcalidrawAutomate. Read detailed help + examples: [here](https://zsviczian.github.io/obsidian-excalidraw-plugin/)
- REQUIRES AN OBSIDIAN SYNC SUBSCRIPTION: Temporary hack/workaround to enable Obsidian Sync for Excalidraw files. This enables almost real-time two-way sync for Excalidraw files between your devices. You can draw on your iPad with your pencil, on your Android with your stylus, and the image will be available in Obsidian on your desktop as well and vice versa. 

## Please find release notes for new releases below the How-to videos. 

# How to?
Part 1: Intro to Obsidian-Excalidraw - Start a new drawing (3:12)

[![Part 1: Intro to Obsidian-Excalidraw - Start a new drawing](https://user-images.githubusercontent.com/14358394/115983840-05797e80-a5a4-11eb-93cd-bae4b1973f72.jpg)](https://youtu.be/i-hIfY-Ecjg)

Part 2: Intro to Obsidian-Excalidraw - Basic features (6:06)

[![Part 2: Intro to Obsidian-Excalidraw - Basic features](https://user-images.githubusercontent.com/14358394/115983902-699c4280-a5a4-11eb-973d-2ba1bd7ac2db.jpg)](https://youtu.be/-dk7pvdl-H0)

Part 3: Intro to Obsidian-Excalidraw - Advanced features (3:26)

[![Part 3: Intro to Obsidian-Excalidraw - Advanced features](https://user-images.githubusercontent.com/14358394/115983916-7de03f80-a5a4-11eb-8f36-4ad516ef9e80.jpg)](https://youtu.be/2cKlEwo8WU0)

Part 4: Intro to Obsidian-Excalidraw - Setting up a template (1:45)

[![Part 4: Intro to Obsidian-Excalidraw - Setting up a template](https://user-images.githubusercontent.com/14358394/115983929-92bcd300-a5a4-11eb-9d4f-03e5cb9e3ebf.jpg)](https://youtu.be/oNPYZEpmuJ8)

Part 5: Intro to Obsidian-Excalidraw - Stencil Library (3:16)

[![Part 5: Intro to Obsidian-Excalidraw - Stencil Library](https://user-images.githubusercontent.com/14358394/115983944-a8ca9380-a5a4-11eb-8a69-e74ae00d95be.jpg)](https://youtu.be/rLx-9FvlzgI)

Part 6: Intro to Obsidian-Excalidraw: Embedding drawings (2:08)

[![Part 6: Intro to Obsidian-Excalidraw: Embedding drawings](https://user-images.githubusercontent.com/14358394/115983954-bbdd6380-a5a4-11eb-9243-f0151451afcd.jpg)](https://youtu.be/JQeJ-Hh-xAI)

# Release Notes

## 1.0.12 Freehand drawing
- now includes the new freehand drawing features from Excalidraw.com
- If you use Obsydian sync with Excalidraw sync, be sure to update all your devices to the new version, as the old excalidraw will simply delete the freehand drawn images and/or simply not show the drawing.

### Temporary workaround - use it only if you are ok with hacky solutions
- I implemented a temporary workaround to enable Obsidian Sync for Excalidraw files. This enables almost real-time two-way sync between your devices. You can draw on your iPad with your pencil, on your Android with your stylus, and the image will be available in Obsidian as well and vice versa. 
- By enabling this feature Excalidraw will sync drawings to a sync folder where drawings are stored in an ".md" file. This will allow Obsidian sync to synchronize Excalidraw drawings as well... Whenever your drawing changes, the corresponding file in the sync folder will also get updated. Similarly, whenever a file is synchronized to the sync folder by Obsidian sync, Excalidraw will sync it with the .excalidraw file in your vault.
- Because this is a temporary workaround until Obsidian sync is ready, I didn't implement extensive application logic to manage sync. Sync might get confused requiring some manual intervention.

### QoL improvement
- I added an autosave feature. Your active drawing gets saved every 30 seconds if you've made changes to it. Drawings otherwise get saved when the window loses focus, or when you close the drawing, etc. Autosave limits the risk of accidental data loss on mobiles when you "swipe out" Obsidian to close it.

## 1.0.11 update
### QoL improvement
- Workspace loading speed much improved on large vaults.
 
## 1.0.10 update
[![Obsidian-Excalidraw 1.0.10 update](https://user-images.githubusercontent.com/14358394/117579017-60a58800-b0f1-11eb-8553-7820964662aa.jpg)](https://youtu.be/W7pWXGIe4rQ)
 
## 1.0.8 and 1.0.9 (minor fixes) update 
[![Obsidian-Excalidraw 1.0.8 update](https://user-images.githubusercontent.com/14358394/117492534-029e6680-af72-11eb-90a3-086e67e70c1c.jpg)](https://youtu.be/AtEhmHJjnxM)

### QoL improvements
- Adds context menu to File Explorer to create new drawings
- Adds a new command to the palette: “Transclude (embed) the most recently edited Excalidraw drawing”
- Automatically update file-links in transclusions when you rename or move your drawing
- Saves drawing and updates all active pre-views when drawing loses focus
- File is closed and removed when you select “Delete file” from more options
- Saves drawing when exiting Obsidian
- Fixes pen positioning bug with sliding panes after panes scroll

### ExcalidrawAutomte full Templater and DataviewJS support
You now have ultimate flexibility over your Excalidraw templates using Templater and Dataview.
- Detailed documentation available [here](https://zsviczian.github.io/obsidian-excalidraw-plugin/)
- I created few examples from the simple to the more complex
	- Simple use-case: Creating a drawing using a custom template and following a file and folder naming convention of your choice.
	- Complex use-case: Create a mindmap from a tabulated outline.
  ![Drawing 2021-05-05 20 52 34](https://user-images.githubusercontent.com/14358394/117194124-00a69d00-ade4-11eb-8b75-5e18a9cbc3cd.png)
 
## 1.0.6 and 1.0.7 update
[![1.0.6 Update](https://user-images.githubusercontent.com/14358394/116312909-58725200-a7ad-11eb-89b9-c67cb48ffebb.jpg)](https://youtu.be/ipZPbcP2B0M)

### SVG styling when embedding
- 1.0.7 adds further flexibility to styling
- new formatting option for the code block embedding
- Valid values: `left`, `right`, `left-wrap`, `right-wrap`... but anything after the last `|` character will be added to the class of the SVG element and the wrapper DIV element.
Here is the corresponding CSS:
```css
img.excalidraw-svg-right-wrap {
  float: right;
  margin: 0px 0px 20px 20px;
}

img.excalidraw-svg-left-wrap {
  float: left;
  margin: 0px 35px 20px 0px;
}

img.excalidraw-svg-right {
  float: right;
}

img.excalidraw-svg-left {
  float: left;
}

div.excalidraw-svg-right,
div.excalidraw-svg-left {
  display: table;
  width: 100%;
}
```

# Known issues
- I have seen two cases when adding a stencil library did not work. In both cases, the end solution was a reinstall of Obsidian. The root cause is not clear, but maybe because of  the incremental updates of Obsidian from an early version.
- Mobile support
  - Positioning of the pen gets misaligned after you open the command palette.
  - Partially mitigated in 1.0.10 by the introduction of autosave: Your drawing will not be saved when you terminate the mobile app by closing the Obsidian task. 
## Resolved known issues:
- Resolved with 1.0.10 Temporary workaround: 
  - Sync does not support .excalidraw files. This issue will be addressed in a later release of Obsidian sync. Until then, you can use my temporary workaround. 
- Resolved with Obsidian mobile 0.18: 
  - On mobile (iOS and Android): As you draw left to right it opens left sidebar. Draw right to left, opens right sidebar. Draw down, opens commands palette. So seems open is emulating the gestures, even when drawing towards the center. 

# Tips and tricks
- If you want to sketch in fullscreen, I recommend installing the [Fullscreen Focus Mode](https://github.com/razumihin/obsidian-fullscreen-plugin) plugin.
- [Ozan's Image in Editor Plugin](https://github.com/ozntel/oz-image-in-editor-obsidian). In a nice collaboration with Ozan, his Image-in-Editor plugin now supports Excalidraw. I recommend installing his plugin to display drawings also in Edit mode.

# Feedback, questions, ideas, problems
Join the conversation about the Excalidraw plugin on [forum.obsidian.md](https://forum.obsidian.md/t/excalidraw-full-featured-sketching-plugin-in-obsidian)

Please head over to [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues) to report a bug or request an enhancement.

# Say Thank You
If you are enjoying Excalidraw then please support my work and enthusiasm by buying me a coffee on [https://ko-fi/zsolt](https://ko-fi.com/zsolt).

Please also help spread the word by sharing about the Obsidian Excalidraw Plugin on Twitter, Reddit, or any other social media platform you regularly use. 

You can find me on Twitter [@zsviczian](https://twitter.com/zsviczian), and on my blog [zsolt.blog](https://zsolt.blog).

[<img style="float:left" src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" width="200">](https://ko-fi.com/zsolt)
