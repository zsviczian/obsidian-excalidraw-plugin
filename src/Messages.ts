
export const FIRST_RUN = `
The Excalidraw Obsidian plugin is much more than "just" a drawing tool. To help you get started here's a showcase of the key Excalidraw plugin features.

If you'd like to learn more, please subscribe to my YouTube channel: [Visual PKM](https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ) where I regularly share videos about Obsidian-Excalidraw and about tools and techniques for Visual Personal Knowledge Management.

Thank you & Enjoy!
`

export const RELEASE_NOTES: { [k: string]: string } = {
Intro: `I want to make it easier for you to keep up with all the updates.
Going forward, after installing each release, you'll be prompted with a message summarizing the key new features and fixes.
You can disable this in plugin-settings. The release change log is also avalable on [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases).

Since March 2021, I've spent most of my free time building this plugin. By now, this means well over 100 workdays worth of my time (assuming 8-hour days).
I am greatful to all of you who have already bought me a coffee. THANK YOU! This means a lot to me!

I still have many-many ideas for making Obsidian Excalidraw better.
I will continue to keep all the features of the plugin free. If, however, you'd like to contribute to the on-going development of the plugin, I am introducing a simple membership scheme, with Insider, Supporter and VIP tiers.
If you find this plugin valuable, please consider clicking the button below.

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" height=45></a></div>
`,
"1.6.16":`
<div class="excalidraw-videoWrapper"><div>
<iframe src="https://www.youtube.com/embed/_c_0zpBJ4Xc?start=20" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>


## Fixed
- CMD+Drag from the Obsidian File Manager does not work on Mac. You can now use SHIFT+Drag to embed an image or markdown document into a scene. ([#468](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468))
- Excalidraw Compressed JSON is now cut to smaller chunks (64 characters per paragraph, instead of the earlier 1024 characters). This should address search performance issues. ([#484](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/484))

## New Features
- I added the Obsidian Tools Panel
  - Click the Obsidian button to access the pannel.
  - The tools panel contains key plugin commands and user / downloaded Obsidian scripts.
  - Drag the pannel with the handle at the top. Single click on the top to collapse the pannel.
  - On Mobile press and hold the drag handle before dragging, to avoid activating the Obsidian slide in menus.
  - On Mobile long touch individual buttons on the panel to access tooltips.
  - Reinstall Excalidraw scripts to get the icons.
- If you hold down SHIFT while resizing a sticky note, the text size will scale instead of text wrapping. ([Excalidraw tweet](https://twitter.com/aakansha1216/status/1496116528890417155?s=20&t=taXjA6I9Nd0T-C0wYBsG5g))
- SVG export now includes links ([#4791](https://github.com/excalidraw/excalidraw/pull/4791))
- Added fullscreen mode for Obsidian Mobile
`};