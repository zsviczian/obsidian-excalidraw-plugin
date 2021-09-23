The Obsidian-Excalidraw plugin integrates [Excalidraw](https://excalidraw.com/), a feature rich sketching tool, into Obsidian. You can store and edit Excalidraw files in your vault, you can embed drawings into your documents, and you can link to documents and other drawings to/and from Excalidraw. For a showcase of Excalidraw features, please read my blog post [here](https://www.zsolt.blog/2021/03/showcasing-excalidraw.html) and/or watch the videos below.

![image](https://user-images.githubusercontent.com/14358394/125159831-336d6880-e17a-11eb-8a3d-ceabc2555a08.png)

# Important notice to the 1.2.0 update

This version comes with tons of new features and possibilities. 

Drawings you've created with version 1.1.x need to be converted to take advantage of the new features. If you want, you can also continue to use your exisiting drawings in compatibility mode (e.g. if you use Logseq and Obsidian in parallel). During conversion your existing `*.excalidraw` files will be replaced with new `*.excalidraw.md` files.

## Conversion and compatibility
To convert files you have the following options:
- Click `CONVERT FILES` in the migration dialog when installing 1.2.0
- In the Command Palette select `Excalidraw: Convert *.excalidraw files to *.excalidraw.md files` to convert all `*.excalidraw` files to `*.excalidraw.md` files. 
- To convert files individually: 
  - Right click an `*.excalidraw` file in File Explorer and select one of the following options:
    - `*.excalidraw => *.excalidraw.md`
    - `*.excalidraw => *.md (Logseq compatibility)`: This option will retain the original *.excalidraw file next to the new Obsidian format. Make sure you also enable additional `Compatibility features` in `Settings` for a full solution.
  - Open a legacy `*.excalidraw` file and select `Convert to new format` from the `Options Menu` in the Excalidraw view.

# Video walkthrough
| | | |
|----|----|----|
|[![Obsidian-Excalidraw 1.2.0 update - Major IMPROVEMENTS](https://user-images.githubusercontent.com/14358394/124356817-7b3f3d80-dc18-11eb-932d-363bb373c5ab.jpg)](https://youtu.be/UxJLLYtgDKE)|[![1  Getting Started](https://user-images.githubusercontent.com/14358394/125160304-7f211180-e17c-11eb-8363-c52723de1ffd.jpg)](https://youtu.be/sY4FoflGaiM)|[![2  Basic shapes and features](https://user-images.githubusercontent.com/14358394/125160312-8a743d00-e17c-11eb-9fa2-490ef4cbd59e.jpg)](https://youtu.be/Iy_oVTq12Gw)|
|[![3  Groups](https://user-images.githubusercontent.com/14358394/125160323-96f89580-e17c-11eb-9bce-8eb1067a51bb.jpg)](https://youtu.be/QOL1KF7-kdc)|[![4  Stencil](https://user-images.githubusercontent.com/14358394/125160332-9f50d080-e17c-11eb-98e9-fec60fe147d9.jpg)](https://youtu.be/aSgcbfspvfo)|[![5  embedding](https://user-images.githubusercontent.com/14358394/125160341-a546b180-e17c-11eb-9de8-d87fdc844c9c.jpg)](https://youtu.be/MaJ5jJwBRWs)|
|[![6  Links](https://user-images.githubusercontent.com/14358394/125160346-aa0b6580-e17c-11eb-930b-4024807040d1.jpg)](https://youtu.be/MXzeCOEExNo)|[![7  Markdown](https://user-images.githubusercontent.com/14358394/125160354-b2fc3700-e17c-11eb-81af-9e71e461f6dd.jpg)](https://youtu.be/R0IAg0s-wQE)|[![8  Templates](https://user-images.githubusercontent.com/14358394/125160360-b8f21800-e17c-11eb-8bd8-79d4e3f6e92d.jpg)](https://youtu.be/ibdS7ykwpW4)|
|[![9  Excalidraw Automate](https://user-images.githubusercontent.com/14358394/125160367-bdb6cc00-e17c-11eb-92f1-6f59faea85fd.jpg)](https://youtu.be/VRZVujfVab0)|[![10  Miscellaneous](https://user-images.githubusercontent.com/14358394/125160374-c3141680-e17c-11eb-8cc2-dfaffd903d15.jpg)](https://youtu.be/D1iBYo1_jjc)||

# Key features
- The plugin aims to integrate Excalidraw seemlessly into Obsidian including Command Palette actions, File Explorer features, Option Menu commands, and the Ribbon Button.
- CTRL+Click on the ribbon button, or in the file explorer to create / open drawings in a new pane.
- Settings will allow you to customzie Excalidraw to your needs:
  - Default folder for new drawings and define custom filename pattern for new drawings.
  - Template for new drawings. The template will restore stroke properties. This means you can set up defaults in your template for stroke color, stroke width, opacity, font family, font size, fill style, stroke style, etc. This also applies to ExcalidrawAutomate.
  - If portability is important to you: Auto-export SVG and/or PNG files including keep-in-sync feature so you can embed svg/png into your documents instead of embedding excalidraw files.
  - Specify the default width of embedded drawings.
  - Compatibility features to auto-export and keep in sync markdown excalidraw files and legacy .excalidraw files.
  - Experimental feature to add custom TAG to file expolorer to mark drawing files.
  - Enable / disable autosave.
- You can customize the size and position of the embedded images using the `[[image.excalidraw|100]]`, `[[image.excalidraw|100x100]]`, `[[image.excalidraw|100|left]]`, `[[image.excalidraw|right-wrap]]`, formatting options. `[[<filename.excalidraw>|<width>x<height>|<alignment>]]`. You can add your custom alignment via css. Any text that appears in `<alignment>` will be added to the rendered SVG element style and to the wrapper DIV element. Check below and styles.css for more insight.
- Supports hyperlinks e.g. `https://zsolt.blog`, `[Obsidian](https://obsidian.md)`, and internal links e.g. `[[My file in vault|Alias]]` in drawing text. 
  - Links will update when files are moved or renamed, if you have the Obsidian setting Files & Links/Automatically Update Internal Links enalbled.
  - Links in drawings will show up in backlinks of documents
  - Transclusions are supported 
    - `![[myfile#^blockref]]` will convert in the drawing into the transcluded text of the block
    - `![[myfile#section]]` also works, this will transclude the section
    - you can also specify word wrapping for transcluded text by adding the max character count in curly brackets right after the transclusion e.g. `![[myfile#^blockref]]{40}` will wrap text at 40 characters.
  - For convenience you can also use the command palette to insert links into drawings
  - CTRL/META + hover to bring up the Obsidian quick preview for the link. (On Mac it is CTRL+CMD+hover).
  - CTRL/META + CLICK a text element to open it as a link.
  - CTRL/META + ALT + CLICK to create the file (if it does not yet exist) and open it
  - CTRL/META + SHIFT + CLICK to open the file in a new pane
  - CTRL/META + ALT + SHIFT + CLICK to create the file (if it does not yet exist) and open it in a new pane
- Using the block reference you can also reference & transclude text that appears on drawings, in other documents
- Insert LaTex symbols and simple formulas using the Command Palette action "Insert LaTeX-symbol". Some symbols may not display properly using the "Hand-drawn" font. If that is the case try using the "Normal" or "Code" fonts.
- Since 1.2.0 Drawing files are stored in Markdown files
  - You can add tags to drawings
  - You can add metadata to the YAML front matter of drawings
  - Anything you add between the frontmatter and the `# Text Elements` heading will be ignored by Excalidraw, i.e. you can add whatever you like here, it will be preserved as part of the document.
  - Excalidraw documents now show in graph view.
  - The following front matter keys will customize how the drawing is displayed - overriding general settings:
    - `excalidraw-link-prefix: "📍"` preview prefix for internal links
    - `excalidraw-url-prefix: "🌐"` preview prefix for external links
    - `excalidraw-link-brackets: true|false` whether or not to display brackets around links in preview
- Includes full [Templater](https://silentvoid13.github.io/Templater/) and [Dataview](https://blacksmithgu.github.io/obsidian-dataview/docs/api/intro/) support through ExcalidrawAutomate. Check out the [detailed help + examples](https://zsviczian.github.io/obsidian-excalidraw-plugin/)
- REQUIRES AN OBSIDIAN SYNC SUBSCRIPTION: Full drawing file history and synchronization between devices
- Multilanguage support: if you'd like to help out by translating the plugin, please get in contact with me.

# Known issues
- Mobile support
  - Positioning of the pen gets misaligned after you open the command palette.
  - Partially mitigated in 1.0.10 by the introduction of autosave: Your drawing will not be saved when you terminate the mobile app by closing the Obsidian task. 

# Tips and tricks
- If you want to sketch in fullscreen, I recommend installing the [Fullscreen Focus Mode](https://github.com/razumihin/obsidian-fullscreen-plugin) plugin.
- [Ozan's Image in Editor Plugin](https://github.com/ozntel/oz-image-in-editor-obsidian). In a nice collaboration with Ozan, his Image-in-Editor plugin now supports Excalidraw. I recommend installing his plugin to display drawings also in Edit mode. Note that Ozan's plugin will only display Excalidraw drawings if the link ends with `.md` or `.excalidraw`. i.e. the following drawing will show in Edit Mode `![[My Drawing.md]]`, but wiki links such as `[[My Drawing]]` will not.

# Feedback, questions, ideas, problems
Join the conversation about the Excalidraw plugin on [forum.obsidian.md](https://forum.obsidian.md/t/excalidraw-full-featured-sketching-plugin-in-obsidian)

Please head over to [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues) to report a bug or request an enhancement.

# Say Thank You
If you are enjoying Excalidraw then please support my work and enthusiasm by buying me a coffee on [https://ko-fi/zsolt](https://ko-fi.com/zsolt).

Please also help spread the word by sharing about the Obsidian Excalidraw Plugin on Twitter, Reddit, or any other social media platform you regularly use. 

You can find me on Twitter [@zsviczian](https://twitter.com/zsviczian), and on my blog [zsolt.blog](https://zsolt.blog).

[<img style="float:left" src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" width="200">](https://ko-fi.com/zsolt)
