import {
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_URL_PREFIX,
} from "src/constants";

// English
export default {
  // main.ts
  INSTALL_SCRIPT: "Install this script",
  UPDATE_SCRIPT: "An update is available - Click to install",
  CHECKING_SCRIPT: "Checking if a newer version is available - Click to reinstall now",
  UNABLETOCHECK_SCRIPT: "Update check was unsuccessful - Click to reinstall now",
  UPTODATE_SCRIPT: "Script is installed and up to date - Click to reinstall now",
  OPEN_AS_EXCALIDRAW: "Open as Excalidraw Drawing",
  TOGGLE_MODE: "Toggle between Excalidraw and Markdown mode",
  CONVERT_NOTE_TO_EXCALIDRAW: "Convert empty note to Excalidraw Drawing",
  CONVERT_EXCALIDRAW: "Convert *.excalidraw to *.md files",
  CREATE_NEW: "New Excalidraw drawing",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw => *.md (Logseq compatibility)",
  DOWNLOAD_LIBRARY: "Export stencil library as an *.excalidrawlib file",
  OPEN_EXISTING_NEW_PANE: "Open an existing drawing - IN A NEW PANE",
  OPEN_EXISTING_ACTIVE_PANE:
    "Open an existing drawing - IN THE CURRENT ACTIVE PANE",
  TRANSCLUDE: "Transclude (embed) a drawing",
  TRANSCLUDE_MOST_RECENT: "Transclude (embed) the most recently edited drawing",
  NEW_IN_NEW_PANE: "Create a new drawing - IN A NEW PANE",
  NEW_IN_ACTIVE_PANE: "Create a new drawing - IN THE CURRENT ACTIVE PANE",
  NEW_IN_NEW_PANE_EMBED:
    "Create a new drawing - IN A NEW PANE - and embed into active document",
  NEW_IN_ACTIVE_PANE_EMBED:
    "Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed into active document",
  EXPORT_SVG: "Save as SVG next to the current file",
  EXPORT_PNG: "Save as PNG next to the current file",
  TOGGLE_LOCK: "Toggle Text Element edit RAW/PREVIEW",
  DELETE_FILE: "Delete selected Image or Markdown file from Obsidian Vault",
  INSERT_LINK: "Insert link to file",
  INSERT_IMAGE: "Insert image from vault",
  INSERT_MD: "Insert markdown file from vault",
  INSERT_LATEX:
    "Insert LaTeX formula (e.g. \\binom{n}{k} = \\frac{n!}{k!(n-k)!})",
  ENTER_LATEX: "Enter a valid LaTeX expression",

  //ExcalidrawView.ts
  INSTALL_SCRIPT_BUTTON: "Install or update Excalidraw Scripts",
  OPEN_AS_MD: "Open as Markdown",
  SAVE_AS_PNG: "Save as PNG into Vault (CTRL/CMD+CLICK to export)",
  SAVE_AS_SVG: "Save as SVG into Vault (CTRL/CMD+CLICK to export)",
  OPEN_LINK: "Open selected text as link\n(SHIFT+CLICK to open in a new pane)",
  EXPORT_EXCALIDRAW: "Export to an .Excalidraw file",
  LINK_BUTTON_CLICK_NO_TEXT:
    "Select a an ImageElement, or select a TextElement that contains an internal or external link.\n" +
    "SHIFT CLICK this button to open the link in a new pane.\n" +
    "CTRL/CMD CLICK the Image or TextElement on the canvas has the same effect!",
  TEXT_ELEMENT_EMPTY:
    "No ImageElement is selected or TextElement is empty, or [[valid-link|alias]] or [alias](valid-link) is not found",
  FILENAME_INVALID_CHARS:
    'File name cannot contain any of the following characters: * " \\ < > : | ?',
  FILE_DOES_NOT_EXIST:
    "File does not exist. Hold down ALT (or ALT+SHIFT) and CLICK link button to create a new file.",
  FORCE_SAVE:
    "Force-save to update transclusions in adjacent panes.\n(Please note, that autosave is always on)",
  RAW: "Change to PREVIEW mode (only effects text-elements with links or transclusions)",
  PARSED:
    "Change to RAW mode (only effects text-elements with links or transclusions)",
  NOFILE: "Excalidraw (no file)",
  COMPATIBILITY_MODE:
    "*.excalidraw file opened in compatibility mode. Convert to new format for full plugin functionality.",
  CONVERT_FILE: "Convert to new format",

  //settings.ts
  FOLDER_NAME: "Excalidraw folder",
  FOLDER_DESC:
    "Default location for new drawings. If empty, drawings will be created in the Vault root.",
  TEMPLATE_NAME: "Excalidraw template file",
  TEMPLATE_DESC:
    "Full filepath to the Excalidraw template. " +
    "E.g.: If your template is in the default Excalidraw folder and it's name is " +
    "Template.md, the setting would be: Excalidraw/Template.md (or just Excalidraw/Template - you may ommit the .md file extension" +
    "If you are using Excalidraw in compatibility mode, then your template must be a legacy excalidraw file as well " +
    "such as Excalidraw/Template.excalidraw.",
  SCRIPT_FOLDER_NAME: "Excalidraw Automate script folder",
  SCRIPT_FOLDER_DESC:
    "The files you place in this folder will be treated as Excalidraw Automate scripts. " +
    "You can access your scripts from Excalidraw via the Obsidian Command Palette. Assign " +
    "hotkeys to your favorite scripts just like to any other Obsidian command. " +
    "The folder may not be the root folder of your Vault. ",
  AUTOSAVE_NAME: "Autosave",
  AUTOSAVE_DESC:
    "Automatically save the active drawing every 30 seconds. Save normally happens when you close Excalidraw or Obsidian, or move " +
    "focus to another pane. In rare cases autosave may slightly disrupt your drawing flow. I created this feature with mobile " +
    "phones in mind (I only have experience with Android), where 'swiping out Obsidian to close it' led to some data loss, and because " +
    "I wasn't able to force save on application termination on mobiles. If you use Excalidraw on a desktop this is likely not needed.",
  FILENAME_HEAD: "Filename",
  FILENAME_DESC:
    "<p>The auto-generated filename consists of a prefix and a date. " +
    "e.g.'Drawing 2021-05-24 12.58.07'.</p>" +
    "<p>Click this link for the <a href='https://momentjs.com/docs/#/displaying/format/'>" +
    "date and time format reference</a>.</p>",
  FILENAME_SAMPLE: "The current file format is: <b>",
  FILENAME_PREFIX_NAME: "Filename prefix",
  FILENAME_PREFIX_DESC: "The first part of the filename",
  FILENAME_DATE_NAME: "Filename date",
  FILENAME_DATE_DESC: "The second part of the filename",
  /*SVG_IN_MD_NAME: "SVG Snapshot to markdown file",
  SVG_IN_MD_DESC: "If the switch is 'on' Excalidraw will include an SVG snapshot in the markdown file. "+
                  "When SVG snapshots are saved to the Excalidraw.md file, drawings that include large png, jpg, gif images may take extreme long time to open in markdown view. " +
                  "On the other hand, SVG snapshots provide some level of platform independence and longevity to your drawings. Even if Excalidraw will no longer exist, the snapshot " +
                  "can be opened with an app that reads SVGs. In addition hover previews will be less resource intensive if SVG snapshots are enabled.",*/
  DISPLAY_HEAD: "Display",
  MATCH_THEME_NAME: "New drawing to match Obsidian theme",
  MATCH_THEME_DESC:
    "If theme is dark, new drawing will be created in dark mode. This does not apply when you use a template for new drawings. " +
    "Also this will not effect when you open an existing drawing. Those will follow the theme of the template/drawing respectively.",
  MATCH_THEME_ALWAYS_NAME: "Existing drawings to match Obsidian theme",
  MATCH_THEME_ALWAYS_DESC:
    "If theme is dark, drawings will be opened in dark mode. If your theme is light, they will be opened in light mode. ",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw to follow when Obsidian Theme changes",
  MATCH_THEME_TRIGGER_DESC:
    "If this option is enabled open Excalidraw pane will switch to light/dark mode when Obsidian theme changes. ",
  DEFAULT_OPEN_MODE_NAME: "Default mode when opening Excalidraw",
  DEFAULT_OPEN_MODE_DESC:
    "Specifies the mode how Excalidraw opens: Normal, Zen, or View mode. You may also set this behaviour on a file level by " +
    "adding the excalidraw-default-mode frontmatter key with a value of: normal,view, or zen to your document.",
  ZOOM_TO_FIT_NAME: "Zoom to fit on view resize",
  ZOOM_TO_FIT_DESC: "Zoom to fit drawing when the pane is resized",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "Zoom to fit max ZOOM level",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "Set the maximum level to which zoom to fit will enlarge the drawing. Minimum is 0.5 (50%) and maximum is 10 (1000%).",
  LINKS_HEAD: "Links and transclusion",
  LINKS_DESC:
    "CTRL/CMD + CLICK on [[Text Elements]] to open them as links. " +
    "If the selected text has more than one [[valid Obsidian links]], only the first will be opened. " +
    "If the text starts as a valid web link (i.e. https:// or http://), then " +
    "the plugin will open it in a browser. " +
    "When Obsidian files change, the matching [[link]] in your drawings will also change. " +
    "If you don't want text accidentally changing in your drawings use [[links|with aliases]].",
  ADJACENT_PANE_NAME: "Open in adjacent pane",
  ADJACENT_PANE_DESC:
    "When CTRL/CMD+SHIFT clicking a link in Excalidraw by default the plugin will open the link in a new pane. " +
    "Turning this setting on, Excalidraw will first look for an existing adjacent pane, and try to open the link there. " +
    "Excalidraw will first look too the right, then to the left, then down, then up. If no pane is found, Excalidraw will open " +
    "a new pane.",
  LINK_BRACKETS_NAME: "Show [[brackets]] around links",
  LINK_BRACKETS_DESC: `${
    "In PREVIEW mode, when parsing Text Elements, place brackets around links. " +
    "You can override this setting for a specific drawing by adding '"
  }${FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS}: true/false' to the file's frontmatter.`,
  LINK_PREFIX_NAME: "Link prefix",
  LINK_PREFIX_DESC: `${
    "In PREVIEW mode, if the Text Element contains a link, precede the text with these characters. " +
    "You can override this setting for a specific drawing by adding '"
  }${FRONTMATTER_KEY_CUSTOM_PREFIX}: "📍 "' to the file's frontmatter.`,
  URL_PREFIX_NAME: "URL prefix",
  URL_PREFIX_DESC: `${
    "In PREVIEW mode, if the Text Element contains a URL link, precede the text with these characters. " +
    "You can override this setting for a specific drawing by adding '"
  }${FRONTMATTER_KEY_CUSTOM_URL_PREFIX}: "🌐 "' to the file's frontmatter.`,
  LINK_CTRL_CLICK_NAME:
    "CTRL/CMD + CLICK on text with [[links]] or [](links) to open them",
  LINK_CTRL_CLICK_DESC:
    "You can turn this feature off if it interferes with default Excalidraw features you want to use. If " +
    "this is turned off, only the link button in the title bar of the drawing pane will open links.",
  TRANSCLUSION_WRAP_NAME: "Overflow wrap behavior of transcluded text",
  TRANSCLUSION_WRAP_DESC:
    "Number specifies the character count where the text should be wrapped. " +
    "Set the text wrapping behavior of transcluded text. Turn this ON to force-wrap " +
    "text (i.e. no overflow), or OFF to soft-wrap text (at the nearest whitespace).",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "Page transclusion max char count",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "The maximum number of characters to display from the page when transcluding an entire page with the " +
    "![[markdown page]] format.",
  GET_URL_TITLE_NAME: "Use iframely to resolve page title",
  GET_URL_TITLE_DESC:
    "Use the http://iframely.server.crestify.com/iframely?url= to get title of page when dropping a link into Excalidraw",
  MD_HEAD: "Markdown-embed settings",
  MD_HEAD_DESC:
    "You can transclude formatted markdown documents into drawings as images CTRL/CMD drop from the file explorer or using " +
    "the command palette action.",
  MD_TRANSCLUDE_WIDTH_NAME: "Default width of a transcluded markdown document",
  MD_TRANSCLUDE_WIDTH_DESC:
    "The width of the markdown page. This effects the word wrapping when transcluding longer paragraphs, and the width of " +
    "the image element. You can override the default width of " +
    "an embedded file using the [[filename#heading|WIDTHxMAXHEIGHT]] syntax in markdown view mode under embedded files.",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "Default maximum height of a transcluded markdown document",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "The embedded image will be as high as the markdown text requries, but not higher than this value. " +
    "You can override this value by editing the embedded image link in markdown view mode with the following syntax [[filename#^blockref|WIDTHxMAXHEIGHT]].",
  MD_DEFAULT_FONT_NAME:
    "The default font typeface to use for embedded markdown files.",
  MD_DEFAULT_FONT_DESC:
    'Set this value to "Virgil" or "Cascadia" or the filename of a valid .ttf, .woff, or .woff2 font e.g. "MyFont.woff2" ' +
    'You can override this setting by adding the following frontmatter-key to the embedded markdown file: "excalidraw-font: font_or_filename"',
  MD_DEFAULT_COLOR_NAME:
    "The default font color to use for embedded markdown files.",
  MD_DEFAULT_COLOR_DESC:
    'Set this to allowed css color names e.g. "steelblue" (https://www.w3schools.com/colors/colors_names.asp), or a valid hexadecimal color e.g. "#e67700". ' +
    'You can override this setting by adding the following frontmatter-key to the embedded markdown file: "excalidraw-font-color: color_name_or_rgbhex"',
  MD_CSS_NAME: "CSS file",
  MD_CSS_DESC:
    "The filename of the CSS to apply to markdown embeds. Provide the filename with extension (e.g. 'md-embed.css'). The css file may also be a plain " +
    "markdown file (e.g. 'md-embed-css.md'), just make sure the content is written using valid css syntax. " +
    "If you need to look at the HTML code you are applying the CSS to, then open Obsidian Developer Console (CTRL+SHIFT+i) and type in the follwoing command: " +
    '"ExcalidrawAutomate.mostRecentMarkdownSVG". This will display the most recent SVG generated by Excalidraw. ' +
    "Setting the font-family in the css is has limitations. By default only your operating system's standard fonts are available (see README for details). " +
    "You can add one custom font beyond that using the setting above. " +
    'You can override this css setting by adding the following frontmatter-key to the embedded markdown file: "excalidraw-css: css_file_in_valut|css-snippet".',
  EMBED_HEAD: "Embed & Export",
  EMBED_PREVIEW_SVG_NAME: "Display SVG in markdown preview",
  EMBED_PREVIEW_SVG_DESC:
    "The default is to display drawings as SVG images in the markdown preview. Turning this feature off, the markdown preview will display the drawing as an embedded PNG image.",
  PREVIEW_MATCH_OBSIDIAN_NAME: "Excalidraw preview to match Obsidian theme",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "Image preview in documents should match the Obsidian theme. If enabled, when Obsidian is in dark mode, Excalidraw images will render in dark mode. " +
    "When Obsidian is in light mode, Excalidraw will render light mode as well. You may want to switch 'Export image with background' off for a more Obsidian-integrated look and feel.",
  EMBED_WIDTH_NAME: "Default width of embedded (transcluded) image",
  EMBED_WIDTH_DESC:
    "Only relevant if embed type is excalidraw. Has no effect on PNG and SVG embeds. The default width of an embedded drawing. You can specify a custom " +
    "width when embedding an image using the ![[drawing.excalidraw|100]] or " +
    "[[drawing.excalidraw|100x100]] format.",
  EMBED_TYPE_NAME: "Type of file to insert into the document",
  EMBED_TYPE_DESC:
    "When you embed an image into a document using the command palette this setting will specify if Excalidraw should embed the original excalidraw file " +
    "or a PNG or an SVG copy. You need to enable auto-export PNG / SVG (see below under Export Settings) for those image types to be available in the dropdown. For drawings that do not have a " +
    "a corresponding PNG or SVG readily available the command palette action will insert a broken link. You need to open the original drawing and initiate export manually. " +
    "This option will not autogenerate PNG/SVG files, but will simply reference the already existing files.",
  EXPORT_PNG_SCALE_NAME: "PNG export image scale",
  EXPORT_PNG_SCALE_DESC: "The size-scale of the exported PNG image",
  EXPORT_BACKGROUND_NAME: "Export image with background",
  EXPORT_BACKGROUND_DESC:
    "If turned off, the exported image will be transparent.",
  EXPORT_THEME_NAME: "Export image with theme",
  EXPORT_THEME_DESC:
    "Export the image matching the dark/light theme of your drawing. If turned off, " +
    "drawings created in dark mode will appear as they would in light mode.",
  EXPORT_HEAD: "Export Settings",
  EXPORT_SYNC_NAME:
    "Keep the .SVG and/or .PNG filenames in sync with the drawing file",
  EXPORT_SYNC_DESC:
    "When turned on, the plugin will automatically update the filename of the .SVG and/or .PNG files when the drawing in the same folder (and same name) is renamed. " +
    "The plugin will also automatically delete the .SVG and/or .PNG files when the drawing in the same folder (and same name) is deleted. ",
  EXPORT_SVG_NAME: "Auto-export SVG",
  EXPORT_SVG_DESC:
    "Automatically create an SVG export of your drawing matching the title of your file. " +
    "The plugin will save the *.SVG file in the same folder as the drawing. " +
    "Embed the .svg file into your documents instead of excalidraw making you embeds platform independent. " +
    "While the auto-export switch is on, this file will get updated every time you edit the excalidraw drawing with the matching name.",
  EXPORT_PNG_NAME: "Auto-export PNG",
  EXPORT_PNG_DESC: "Same as the auto-export SVG, but for *.PNG",
  COMPATIBILITY_HEAD: "Compatibility features",
  EXPORT_EXCALIDRAW_NAME: "Auto-export Excalidraw",
  EXPORT_EXCALIDRAW_DESC: "Same as the auto-export SVG, but for *.Excalidraw",
  SYNC_EXCALIDRAW_NAME:
    "Sync *.excalidraw with *.md version of the same drawing",
  SYNC_EXCALIDRAW_DESC:
    "If the modified date of the *.excalidraw file is more recent than the modified date of the *.md file " +
    "then update the drawing in the .md file based on the .excalidraw file",
  COMPATIBILITY_MODE_NAME: "New drawings as legacy files",
  COMPATIBILITY_MODE_DESC:
    "By enabling this feature drawings you create with the ribbon icon, the command palette actions, " +
    "and the file explorer are going to be all legacy *.excalidraw files. This setting will also turn off the reminder message " +
    "when you open a legacy file for editing.",
  EXPERIMENTAL_HEAD: "Experimental features",
  EXPERIMENTAL_DESC:
    "These setting will not take effect immediately, only when the File Explorer is refreshed, or Obsidian restarted.",
  FILETYPE_NAME: "Display type (✏️) for excalidraw.md files in File Explorer",
  FILETYPE_DESC:
    "Excalidraw files will receive an indicator using the emojii or text defined in the next setting.",
  FILETAG_NAME: "Set the type indicator for excalidraw.md files",
  FILETAG_DESC: "The text or emojii to display as type indicator.",
  INSERT_EMOJI: "Insert an emoji",
  LIVEPREVIEW_NAME: "Immersive image embedding in live preview editing mode",
  LIVEPREVIEW_DESC: "Turn this on to support image embedding styles such as ![[drawing|width|style]] in live preview editing mode. " +
                    "The setting will not effect the currently open documents. You need close the open documents and re-open them for the change " +
                    "to take effect.",
  ENABLE_FOURTH_FONT_NAME: "Enable fourth font option",
  ENABLE_FOURTH_FONT_DESC: "By turning this on, you will see a fourth font button on the properties panel for text elements. " +
                          "Files that use this fourth font will (partly) lose their paltform independence. " +
                          "Depending on the cutom font set in settings, they will look differently when loaded in another vault, or at a later time. " +
                          "Also the 4th font will display as system default font on excalidraw.com, or other Excalidraw versions.",
  FOURTH_FONT_NAME: "Forth font file",
  FOURTH_FONT_DESC: "Select a .ttf, .woff or .woff2 font file from your vault to use as the fourth font. " +
                    "If no file is selected excalidraw will use the Virgil font by default.",
              

  //openDrawings.ts
  SELECT_FILE: "Select a file then press enter.",
  NO_MATCH: "No file matches your query.",
  SELECT_FILE_TO_LINK: "Select the file you want to insert the link for.",
  SELECT_DRAWING: "Select the drawing you want to insert",
  TYPE_FILENAME: "Type name of drawing to select.",
  SELECT_FILE_OR_TYPE_NEW:
    "Select existing drawing or type name of a new drawing then press Enter.",
  SELECT_TO_EMBED: "Select the drawing to insert into active document.",
  SELECT_MD: "Select the markdown document you want to insert",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW WARNING\nAborted loading embedded images due to infinite loop in file:\n",
};
