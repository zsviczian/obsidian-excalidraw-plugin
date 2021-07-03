// English

export default {
  // main.ts
  OPEN_AS_EXCALIDRAW: "Open as Excalidraw Drawing",
  TOGGLE_MODE: "Toggle between Excalidraw and markdown mode",
  CONVERT_NOTE_TO_EXCALIDRAW: "Convert empty note to Excalidraw Drawing",
  MIGRATE_TO_2: "MIGRATE to version 2: convert .excalidraw files to .md files",
  CREATE_NEW : "New Excalidraw",
  OPEN_EXISTING_NEW_PANE: "Open an existing drawing - IN A NEW PANE",
  OPEN_EXISTING_ACTIVE_PANE: "Open an existing drawing - IN THE CURRENT ACTIVE PANE",
  TRANSCLUDE: "Transclude (embed) an Excalidraw drawing",
  TRANSCLUDE_MOST_RECENT: "Transclude (embed) the most recently edited Excalidraw drawing",
  NEW_IN_NEW_PANE: "Create a new drawing - IN A NEW PANE",
  NEW_IN_ACTIVE_PANE: "Create a new drawing - IN THE CURRENT ACTIVE PANE",
  NEW_IN_NEW_PANE_EMBED: "Create a new drawing - IN A NEW PANE - and embed in current document",
  NEW_IN_ACTIVE_PANE_EMBED: "Create a new drawing - IN THE CURRENT ACTIVE PANE - and embed in current document",
  EXPORT_SVG: "Export SVG. Save it next to the current file",
  EXPORT_PNG: "Export PNG. Save it next to the current file",
  TOGGLE_LOCK: "Toggle text element edit lock/unlock",
  INSERT_LINK: "Insert link to file",
  INSERT_LATEX: "Insert LaTeX-symbol (e.g. $\\theta$)",
  ENTER_LATEX: "Enter a valid LaTeX expression",

  
  //ExcalidrawView.ts
  OPEN_AS_MD: "Open as markdown",
  SAVE_AS_PNG: "Save as PNG into Vault (CTRL/META+click to export)",
  SAVE_AS_SVG: "Save as SVG into Vault (CTRL/META+click to export)",
  OPEN_LINK: "Open selected text as link\n(SHIFT+click to open in a new pane)",
  EXPORT_EXCALIDRAW: "Export to .Excalidraw file",
  UNLOCK_TO_EDIT: "Unlock text elements to edit",
  LINK_BUTTON_CLICK_NO_TEXT: 'Select a text element containing an internal or external link.\n'+
                                        'SHIFT CLICK this button to open link in a new pane.\n'+
                                        'CTRL/META CLICK on the Text Element on the canvas also works!',
  TEXT_ELEMENT_EMPTY: "Text element is empty, or [[valid-link|alias]] or [alias](valid-link) is not found",
  FILENAME_INVALID_CHARS: 'File name cannot contain any of the following characters: * " \\  < > : | ?',
  FILE_DOES_NOT_EXIST: "File does not exist. Hold down ALT (or ALT+SHIFT) and click link button to create a new file.",
  FORCE_SAVE: "Force-save to update transclusions in adjacent panes\n(Please note, that autosave is always on)",
  LOCK: "Text Elements are unlocked. Click to lock.",
  UNLOCK: "Text Elements are locked. Click to unlock.",
  NOFILE: "Excalidraw (no file)",

  //settings.ts
  FOLDER_NAME: "Excalidraw folder",
  FOLDER_DESC: "Default location for your drawings. If empty, drawings will be created in the Vault root.",
  TEMPLATE_NAME: "Excalidraw template file",
  TEMPLATE_DESC: "Full filepath to the Excalidraw template. " +
                 "E.g.: If your template is in the default Excalidraw folder, the setting would be: Excalidraw/Template",
  FILENAME_HEAD: "New drawing filename",
  FILENAME_DESC: '<p>The auto-generated filename consists of a prefix and a date. ' + 
                 'e.g."Drawing 2021-05-24 12.58.07".</p>'+
                 '<p>Click this link for the <a href="https://momentjs.com/docs/#/displaying/format/">'+
                 'date and time format reference</a>.</p>',
  FILENAME_SAMPLE: "The current file format is: <b>",
  FILENAME_PREFIX_NAME: "Filename prefix",
  FILENAME_PREFIX_DESC: "The first part of the filename",
  FILENAME_DATE_NAME: "Filename date",
  FILENAME_DATE_DESC: "The second part of the filename",
  LINKS_HEAD: "Links in drawings",
  LINKS_DESC: 'CTRL/META + CLICK on Text Elements to open them as links. ' + 
              'If the selected text has more than one [[valid Obsidian links]], only the first will be opened. ' + 
              'If the text starts as a valid web link (i.e. https:// or http://), then ' +
              'the plugin will try to open it in a browser. ' +
              'When Obsidian files change, the matching [[link]] in your drawings will also change. ' +
              'If you don\'t want text accidentally changing in your drawings use [[links|with aliases]].',
  LINK_BRACKETS_NAME: "Show [[bracket]] around links",
  LINK_BRACKETS_DESC: "When parsing text elements, place brackets around links",
  LINK_INDICATOR_NAME:"Link indicator",
  LINK_INDICATOR_DESC:"If text element contains a link, precede the text with these characters in preview.",
  LINK_CTRL_CLICK_NAME: "CTRL + CLICK on text to open them as links",
  LINK_CTRL_CLICK_DESC: 'You can turn this feature off if it interferes with default Excalidraw features you want to use. If ' +
                        'this is turned off, only the link button in the title bar of the drawing pane will open links.',
  EMBED_HEAD: "Embedded image settings",
  EMBED_WIDTH_NAME: "Default width of embedded (transcluded) image",
  EMBED_WIDTH_DESC: "The default width of an embedded drawing. You can specify a custom " +
                    "width when embedding an image using the ![[drawing.excalidraw|100]] or " +
                    "[[drawing.excalidraw|100x100]] format.",
  EXPORT_BACKGROUND_NAME: "Export image with background",
  EXPORT_BACKGROUND_DESC: "If turned off, the exported image will be transparent.",
  EXPORT_THEME_NAME: "Export image with theme",
  EXPORT_THEME_DESC: 'Export the image matching the dark/light theme of your drawing. If turned off, ' +
                     'drawings created in drak mode will appear as they would in light mode.',
  EXPORT_SVG_NAME: "Auto-export SVG",
  EXPORT_SVG_DESC: 'Automatically create an SVG export of your drawing matching the title of your file. ' + 
                   'The plugin will save the .SVG file in the same folder as the drawing. '+
                   'Embed the .svg file into your documents instead of excalidraw to making you embeds platform independent. ' +
                   'While the auto export switch is on, this file will get updated every time you edit the excalidraw drawing with the matching name.',
  EXPORT_PNG_NAME: "Auto-export PNG",
  EXPORT_PNG_DESC: "Same as the auto-export SVG, but for PNG.",
  EXPORT_SYNC_NAME:"Keep the .SVG and/or .PNG filenames in sync with the drawing file",
  EXPORT_SYNC_DESC:'When turned on, the plugin will automaticaly update the filename of the .SVG and/or .PNG files when the drawing in the same folder (and same name) is renamed. ' +
                   'The plugin will also automatically delete the .SVG and/or .PNG files when the drawing in the same folder (and same name) is deleted. ',

  //openDrawings.ts
  SELECT_FILE: "Select a file then hit enter.",   
  NO_MATCH: "No file matches your query.",  
  SELECT_FILE_TO_LINK: "Select file to inster link for.",     
  TYPE_FILENAME: "Type name of drawing to select.",
  SELECT_FILE_OR_TYPE_NEW: "Select existing drawing or type name of a new then hit enter.",
  SELECT_TO_EMBED: "Select drawing to insert into document.",
};
