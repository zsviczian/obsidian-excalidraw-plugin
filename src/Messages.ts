export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!

<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/o0exK-xFP3k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `I want to help you keep up with all the updates. After installing each release, you'll be prompted with a summary of new features and fixes. You can disable these popup messages in plugin settings.

I develop this plugin as a hobby, spending most of my free time doing this. If you'd like to contribute to the on-going work, I have a simple membership scheme with Bronze, Silver and Gold tiers. Many of you have already bought me a coffee. THANK YOU! It really means a lot to me! If you find this plugin valuable, please consider supporting me.

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" height=45></a></div>
`,
"1.6.19": `
This is a minor update fixing left-handed mode on iOS, and deploying improvements to the new Excalidraw Eraser.
`,
"1.6.18": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/4N6efq1DtH0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Modifying properties of a text element in tray mode. [496](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/496)
- Friendly page aliases with iframely should work more reliably now.
- I further improved resilience of loading from a damaged Excalidraw.md file.

## New Features
### From excalidraw.com
- Added Eraser [4887](https://github.com/excalidraw/excalidraw/pull/4887)

### Plugin
- New setting for default transcluded-text line-wrap length. This is the default value for "wrapAt" in ${String.fromCharCode(96)}![[file#^block]]{wrapAt}${String.fromCharCode(96)}. Wrapping text using this feature will insert linebreaks in the transcluded text. An alternative approach is to transclude text inside sticky notes, in which case Excalidraw will automatically take care of text wrapping depending on the sticky note's width. [228](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/228)
- New command palette action to toggle fullscreen mode, so you can assign a hotkey.
- I added basic support for left-handed users. Enable it in plugin settings under the "Display" section. Currently, only affects the position of the tray in tray-mode. [510](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/510)
- More flexible filename settings. ⚠ Due to the change, current settings may behave slightly differently compared to before. ⚠ [470](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/470)
`,
"1.6.17": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/Etskjw7a5zo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>

## Fixed
- Freedraw shape's background color was missing in the SVG export. [#443](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/443)
- In rare cases, when you only changed the background color of the drawing or edited the dimensions of an embedded markdown document, or changed an existing LaTeX formula, and then moved to another document in the vault, these changes did not get saved. [#503](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/503)
- I resolved an Excalidraw Automate glitch with word wrapping in containers. EA generated containers with fixed line breaks. The same error also affected the conversion of drawings from the "legacy" Excalidraw.com file format.
- When you allow/disable autosave in settings, this change will immediately take effect for all open Excalidraw workspace leaves. Until now autosave was activated only after you closed and reopened the Excalidraw view. [#502](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/502)
- When you create a text element containing a ${String.fromCharCode(96,96,96)}[[markdown link]]${String.fromCharCode(96,96,96)} in raw mode, the new link was parsed nonetheless, and sometimes the link disappeared, leaving only the parsed text without the actual link. Creating links in raw-mode now works correctly.

## New Features
- The most recent 5 custom colors from the canvas are now added as color options to the element stroke and element background palette. [#4843](https://github.com/excalidraw/excalidraw/pull/4843)
- Vertical text alignment for text in sticky notes  [#4852](https://github.com/excalidraw/excalidraw/pull/4852)
- Markdown embeds into Excalidraw now receive default styling, including that of tables, blockquotes, and code blocks. I also added a new setting and corresponding frontmatter-key to set the border-color for the embedded markdown document. You can override plugin settings at the document level by adding ${String.fromCharCode(96,96,96)}excalidraw-border-color: steelblue${String.fromCharCode(96,96,96)} to the markdown document you want to embed into your drawing. Valid values are css-color-name|#HEXcolor|any-other-html-standard-format.
- In Obsidian search, when the text you were searching for is found in an Excalidraw document, clicking the link in search-results will open the drawing with the matching text element selected and zoomed.
- Excalidraw now supports linking to text elements on the canvas and linking to non-text objects. 
1) You can reference text headings just the same as markdown headings in a document
i.e. you have a text element that includes a valid markdown heading:
${String.fromCharCode(96,96,96)}markdown
# My Heading
details...
${String.fromCharCode(96,96,96)}
or 
${String.fromCharCode(96,96,96)}markdown
text element text
# my reference
${String.fromCharCode(96,96,96)}
You can reference these like this respectively: ${String.fromCharCode(96,96,96)}[[#My Heading|display alias]]${String.fromCharCode(96,96,96)} and ${String.fromCharCode(96,96,96)}[[#my reference|alias]]${String.fromCharCode(96,96,96)}

![image](https://user-images.githubusercontent.com/14358394/156890231-5a23bcb3-40a4-4ad7-b366-74c328620159.png)

2) You can also reference element ids similar to block references
- Links take this form ${String.fromCharCode(96,96,96)}[[#^elementID|alias]]${String.fromCharCode(96,96,96)}
- Linking is supported by a new action on the Obsidian Tools Panel
![image](https://user-images.githubusercontent.com/14358394/156894011-6442c3d6-aaff-43a8-bd77-513e450484ba.png)

[Release Notes on GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.17)
`,
  "1.6.16": `
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/gMIKXyhS-dM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>


## Fixed
- CMD+Drag from the Obsidian File Manager does not work on Mac. You can now use SHIFT+Drag to embed an image or markdown document into a scene. ([#468](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468))
- Excalidraw Compressed JSON is now cut to smaller chunks (64 characters per paragraph, instead of the earlier 1024 characters). This should address search performance issues. ([#484](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/484))

## New Features
- I added the Obsidian Tools Panel
  - Click the Obsidian button to access the panel.
  - The tools panel contains key plugin commands and user / downloaded Excalidraw scripts.
  - Drag the panel with the handle at the top. Single click on the top to collapse the panel.
  - On Mobile press and hold the drag handle before dragging, to avoid activating the Obsidian slide in menus.
  - On Mobile long touch individual buttons on the panel to access tooltips.
  - Reinstall Excalidraw scripts to get the icons.
- If you hold down SHIFT while resizing a sticky note, the text size will scale instead of text wrapping. ([Excalidraw tweet](https://twitter.com/aakansha1216/status/1496116528890417155?s=20&t=taXjA6I9Nd0T-C0wYBsG5g))
- SVG export now includes links ([#4791](https://github.com/excalidraw/excalidraw/pull/4791))
- Added full screen mode for Obsidian Mobile
- Release notes
  - disable popup in settings
  - access release notes via the command palette, or the button on the tools panel

[Release Notes on GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.16)

[![support-membership](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/support-tiers.jpg)](https://ko-fi.com/zsolt)
`,
};
