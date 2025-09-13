import {
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS,
} from "src/constants/constants";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";

declare const PLUGIN_VERSION:string;

// English
export default {
  // Sugester
  SELECT_FILE_TO_INSERT: "Select a file to insert",
  // main.ts
  CONVERT_URL_TO_FILE: "Save image from URL to local file",
  UNZIP_CURRENT_FILE: "Decompress current Excalidraw file",
  ZIP_CURRENT_FILE: "Compress current Excalidraw file",
  PUBLISH_SVG_CHECK: "Obsidian Publish: Find SVG and PNG exports that are out of date",
  EMBEDDABLE_PROPERTIES: "Embeddable Properties",
  EMBEDDABLE_RELATIVE_ZOOM: "Scale selected embeddable elements to 100% relative to the current canvas zoom",
  OPEN_IMAGE_SOURCE: "Open Excalidraw drawing",
  INSTALL_SCRIPT: "Install the script",
  UPDATE_SCRIPT: "Update available - Click to install",
  CHECKING_SCRIPT:
    "Checking for newer version - Click to reinstall",
  UNABLETOCHECK_SCRIPT:
    "Update check failed - Click to reinstall",
  UPTODATE_SCRIPT:
    "Script is up to date - Click to reinstall",
  OPEN_AS_EXCALIDRAW: "Open as Excalidraw Drawing",
  TOGGLE_MODE: "Toggle between Excalidraw and Markdown mode",
  DUPLICATE_IMAGE: "Duplicate selected image with a different image ID",
  CONVERT_NOTE_TO_EXCALIDRAW: "Convert markdown note to Excalidraw Drawing",
  CONVERT_EXCALIDRAW: "Convert *.excalidraw to *.md files",
  CREATE_NEW: "New drawing",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw => *.md (Logseq compatibility)",
  DOWNLOAD_LIBRARY: "Export stencil library as an *.excalidrawlib file",
  OPEN_EXISTING_NEW_PANE: "Open existing drawing - IN A NEW PANE",
  OPEN_EXISTING_ACTIVE_PANE:
    "Open existing drawing - IN THE CURRENT ACTIVE PANE",
  TRANSCLUDE: "Embed a drawing",
  TRANSCLUDE_MOST_RECENT: "Embed the most recently edited drawing",
  TOGGLE_LEFTHANDED_MODE: "Toggle left-handed mode",
  TOGGLE_SPLASHSCREEN: "Show splash screen in new drawings",
  FLIP_IMAGE: "Open the back-of-the-note for the selected image in a popout window (flip the card)",
  NEW_IN_NEW_PANE: "Create new drawing - IN AN ADJACENT WINDOW",
  NEW_IN_NEW_TAB: "Create new drawing - IN A NEW TAB",
  NEW_IN_ACTIVE_PANE: "Create new drawing - IN THE CURRENT ACTIVE WINDOW",
  NEW_IN_POPOUT_WINDOW: "Create new drawing - IN A POPOUT WINDOW",
  NEW_IN_NEW_PANE_EMBED:
    "Create new drawing - IN AN ADJACENT WINDOW - and embed into active document",
  NEW_IN_NEW_TAB_EMBED:
    "Create new drawing - IN A NEW TAB - and embed into active document",
  NEW_IN_ACTIVE_PANE_EMBED:
    "Create new drawing - IN THE CURRENT ACTIVE WINDOW - and embed into active document",
  NEW_IN_POPOUT_WINDOW_EMBED: "Create new drawing - IN A POPOUT WINDOW - and embed into active document",
  TOGGLE_LOCK: "Toggle Text Element between edit RAW and PREVIEW",
  DELETE_FILE: "Delete selected image or Markdown file from Obsidian Vault",
  MARKER_FRAME_SHOW: "Show Marker Frames",
  MARKER_FRAME_HIDE: "Hide Marker Frames",
  MARKER_FRAME_TITLE_SHOW: "Show Marker Frame Titles",
  MARKER_FRAME_TITLE_HIDE: "Hide Marker Frame Titles",
  COPY_ELEMENT_LINK: "Copy [[link]] for selected element(s)",
  COPY_DRAWING_LINK: "Copy ![[embed link]] for this drawing",
  INSERT_LINK_TO_ELEMENT:
    `Copy [[link]] for selected element to clipboard. ${labelCTRL()}+CLICK to copy 'group=' link. ${labelSHIFT()}+CLICK to copy an 'area=' link.`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "Copy 'group=' ![[link]] for selected element to clipboard.",
  INSERT_LINK_TO_ELEMENT_AREA:
    "Copy 'area=' ![[link]] for selected element to clipboard.",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "Copy 'frame=' ![[link]] for selected element to clipboard.",
  INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "Copy 'clippedframe=' ![[link]] for selected element to clipboard.",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "Copy [[link]] for selected element to clipboard.",
  INSERT_LINK_TO_ELEMENT_ERROR: "Select a single element in the scene",
  INSERT_LINK_TO_ELEMENT_READY: "Link is READY and available on the clipboard",
  INSERT_LINK: "Insert link to file",
  INSERT_COMMAND: "Insert Obsidian Command as a link",
  INSERT_IMAGE: "Insert image or Excalidraw drawing from your vault",
  IMPORT_SVG: "Import an SVG file as Excalidraw strokes (limited SVG support, TEXT currently not supported)",
  IMPORT_SVG_CONTEXTMENU: "Convert SVG to strokes - with limitations",
  INSERT_MD: "Insert markdown file from vault",
  INSERT_PDF: "Insert PDF file from vault",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE: "Insert last active PDF page as image",
  UNIVERSAL_ADD_FILE: "Insert ANY file",
  INSERT_CARD: "Add back-of-note card",
  CONVERT_CARD_TO_FILE: "Move back-of-note card to File",
  ERROR_TRY_AGAIN: "Please try again.",
  PASTE_CODEBLOCK: "Paste code block",
  INSERT_LATEX:
    `Insert LaTeX formula (e.g. \\binom{n}{k} = \\frac{n!}{k!(n-k)!}).`,
  ENTER_LATEX: "Enter a valid LaTeX expression",
  READ_RELEASE_NOTES: "Read latest release notes",
  RUN_OCR: "OCR full drawing: Grab text from freedraw + images to clipboard and doc.props",
  RERUN_OCR: "OCR full drawing re-run: Grab text from freedraw + images to clipboard and doc.props",
  RUN_OCR_ELEMENTS: "OCR selected elements: Grab text from freedraw + images to clipboard",
  TRAY_MODE: "Toggle property-panel tray-mode",
  SEARCH: "Search for text in drawing",
  CROP_PAGE: "Crop and mask selected page",
  CROP_IMAGE: "Crop and mask image",
  ANNOTATE_IMAGE : "Annotate image in Excalidraw",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "Insert active PDF page as image",
  RESET_IMG_TO_100: "Set selected image element size to 100% of original",
  RESET_IMG_ASPECT_RATIO: "Reset selected image element aspect ratio",
  TEMPORARY_DISABLE_AUTOSAVE: "Disable autosave until next time Obsidian starts (only set this if you know what you are doing)",
  TEMPORARY_ENABLE_AUTOSAVE: "Enable autosave",
  FONTS_LOADED: "Excalidraw: CJK Fonts loaded",
  FONTS_LOAD_ERROR: "Excalidraw: Could not find CJK Fonts in the assets folder\n",

  //Prompt.ts
  SELECT_LINK_TO_OPEN: "Select a link to open",

  //ExcalidrawView.ts
  ERROR_CANT_READ_FILEPATH: "Error, can't read file path. Importing file instead",
  NO_SEARCH_RESULT: "Didn't find a matching element in the drawing",
  FORCE_SAVE_ABORTED: "Force Save aborted because saving is in progress",
  LINKLIST_SECOND_ORDER_LINK: "Second Order Link",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE: "Customize the Embedded File link",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT: "Do not add [[square brackets]] around the filename!<br>" +
    "For markdown-page images follow this format when editing your link: <mark>filename#^blockref|WIDTHxMAXHEIGHT</mark><br>" +
    "You can anchor Excalidraw images to 100% of their size by adding <code>|100%</code> to the end of the link.<br>" +
    "You can change the PDF page by changing <code>#page=1</code> to <code>#page=2</code> etc.<br>" +
    "PDF rect crop values are: <code>left, bottom, right, top</code>. Eg.: <code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "Frame Rendering: Enabled",
  FRAME_CLIPPING_DISABLED: "Frame Rendering: Disabled",
  ARROW_BINDING_INVERSE_MODE: "Inverted Mode: Default arrow binding is now disabled. Use CTRL/CMD to temporarily enable binding when needed.",
  ARROW_BINDING_NORMAL_MODE: "Normal Mode: Arrow binding is now enabled. Use CTRL/CMD to temporarily disable binding when needed.",
  EXPORT_FILENAME_PROMPT: "Please provide filename",
  EXPORT_FILENAME_PROMPT_PLACEHOLDER: "filename, leave blank to cancel action",
  WARNING_SERIOUS_ERROR: "WARNING: Excalidraw ran into an unknown problem!\n\n" +
    "There is a risk that your most recent changes cannot be saved.\n\n" +
    "To be on the safe side...\n" +
    "1) Please select your drawing using CTRL/CMD+A and make a copy with CTRL/CMD+C.\n" +
    "2) Then create an empty drawing in a new pane by CTRL/CMD+clicking the Excalidraw ribbon button,\n" +
    "3) and paste your work to the new document with CTRL/CMD+V.",
  ARIA_LABEL_TRAY_MODE: "Tray-mode offers an alternative, more spacious canvas",
  TRAY_TRAY_MODE: "Toggle tray-mode",
  TRAY_SCRIPT_LIBRARY: "Script Library",
  TRAY_SCRIPT_LIBRARY_ARIA: "Explore the Excalidraw Script Library",
  TRAY_EXPORT: "Export Image...",
  TRAY_EXPORT_ARIA: "Export image as PNG, SVG, or Excalidraw file",
  TRAY_SAVE: "Save",
  TRAY_SWITCH_TO_MD: "Open as Markdown",
  TRAY_SWITCH_TO_MD_ARIA: "Switch to markdown view",
  MASK_FILE_NOTICE: "This is a mask file. It is used to crop images and mask out parts of the image. Press and hold notice to open the help video.",
  INSTALL_SCRIPT_BUTTON: "Install or update Excalidraw Scripts",
  OPEN_AS_MD: "Open as Markdown",
  EXPORT_IMAGE: `Export Image`,
  OPEN_LINK: "Open selected text as link\n(SHIFT+CLICK to open in a new pane)",
  EXPORT_EXCALIDRAW: "Export to an .Excalidraw file",
  LINK_BUTTON_CLICK_NO_TEXT:
    "Select an element that contains an internal or external link.\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR:
    "Arrow- and Line-Element links cannot be navigated by " + labelCTRL() + " + CLICKing on the element because that also activates the line editor.\n" +
    "Use the right-click context menu to open the link, or click the link indicator in the top right corner of the element.\n",
  FILENAME_INVALID_CHARS:
    'File name cannot contain any of the following characters: * " \\ < > : | ? #',
  FORCE_SAVE:
    "Save (will also update transclusions)",
  RAW: "Change to PREVIEW mode (only affects text-elements with links or transclusions)",
  PARSED:
    "Change to RAW mode (only affects text-elements with links or transclusions)",
  NOFILE: "Excalidraw (no file)",
  COMPATIBILITY_MODE:
    "*.excalidraw file opened in compatibility mode. Convert to new format for full plugin functionality.",
  CONVERT_FILE: "Convert to new format",
  BACKUP_AVAILABLE: "We encountered an error while loading your drawing. This might have occurred if Obsidian unexpectedly closed during a save operation. For example, if you accidentally closed Obsidian on your mobile device while saving.<br><br><b>GOOD NEWS:</b> Fortunately, a local backup is available. However, please note that if you last modified this drawing on a different device (e.g., tablet) and you are now on your desktop, that other device likely has a more recent backup.<br><br>I recommend trying to open the drawing on your other device first and restore the backup from its local storage.<br><br>Would you like to load the backup?",
  BACKUP_RESTORED: "Backup restored",
  BACKUP_SAVE_AS_FILE: "This drawing is empty. A non-empty backup is available. Would you like to restore it as a new file and open it in a new tab?",
  BACKUP_SAVE: "Restore",
  BACKUP_DELETE: "Delete Backup",
  BACKUP_CANCEL: "Cancel",
  CACHE_NOT_READY: "I apologize for the inconvenience, but an error occurred while loading your file.<br><br><mark>Having a little patience can save you a lot of time...</mark><br><br>The plugin has a backup cache, but it appears that you have just started Obsidian. Initializing the Backup Cache may take some time, usually up to a minute or more depending on your device's performance. You will receive a notification in the top right corner when the cache initialization is complete.<br><br>Please press OK to attempt loading the file again and check if the cache has finished initializing. If you see a completely empty file behind this message, I recommend waiting until the backup cache is ready before proceeding. Alternatively, you can choose Cancel to manually correct your file.<br>",
  OBSIDIAN_TOOLS_PANEL: "Obsidian Tools Panel",
  ERROR_SAVING_IMAGE: "Unknown error occurred while fetching the image. It could be that for some reason the image is not available or rejected the fetch request from Obsidian",
  WARNING_PASTING_ELEMENT_AS_TEXT: "PASTING EXCALIDRAW ELEMENTS AS A TEXT ELEMENT IS NOT ALLOWED",
  USE_INSERT_FILE_MODAL: "Use 'Insert Any File' to embed a markdown note",
  RECURSIVE_INSERT_ERROR: "You may not recursively insert part of an image into the same image as it would create an infinite loop",
  CONVERT_TO_MARKDOWN: "Convert to file...",
  SELECT_TEXTELEMENT_ONLY: "Select text element only (not container)",
  REMOVE_LINK: "Remove text element link",
  LASER_ON: "Enable laser pointer",
  LASER_OFF: "Disable laser pointer",
  WELCOME_RANK_NEXT: "more drawings until the next rank!",
  WELCOME_RANK_LEGENDARY: "You're at the top. Keep on being legendary!",
  WELCOME_COMMAND_PALETTE: 'Type "Excalidraw" in the Command Palette',
  WELCOME_OBSIDIAN_MENU: "Explore the Obsidian Menu in the top right",
  WELCOME_SCRIPT_LIBRARY: "Visit the Script Library",
  WELCOME_HELP_MENU: "Find help in the hamburger-menu",
  WELCOME_YOUTUBE_ARIA: "Visual PKM YouTube Channel",
  WELCOME_YOUTUBE_LINK: "Check out the Visual PKM YouTube channel.",
  WELCOME_DISCORD_ARIA: "Join the Discord Server",
  WELCOME_DISCORD_LINK: "Join the Discord Server",
  WELCOME_TWITTER_ARIA: "Follow me on Twitter",
  WELCOME_TWITTER_LINK: "Follow me on Twitter",
  WELCOME_LEARN_ARIA: "Learn Visual PKM",
  WELCOME_LEARN_LINK: "Sign up for the Visual Thinking Workshop",
  WELCOME_DONATE_ARIA: "Donate to support Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: 'Say "Thank You" & support the plugin.',
  SAVE_IS_TAKING_LONG: "Saving your previous file is taking a long time. Please wait...",
  SAVE_IS_TAKING_VERY_LONG: "For better performance, consider splitting large drawings into several smaller files.",

  //ContentSearcher.ts
  SEARCH_COPIED_TO_CLIPBOARD: "Markdown ready on clipboard",
  SEARCH_COPY_TO_CLIPBOARD_ARIA: "Copy the entire dialog to the clipboard as Markdown. Ideal for use with tools like ChatGPT to search and understand.",
  SEARCH_SHOWHIDE_ARIA: "Show/Hide search bar",
  SEARCH_NEXT: "Next",
  SEARCH_PREVIOUS: "Previous",



  //settings.ts
  NOTEBOOKLM_LINK_ARIA: "Ask NotebookLM for help about the plugin. This model is pre-loaded with all my video transcripts, release notes and other helpful content. Chat with NotebookLM to explore my 250+ videos and the Excalidraw documentation.",
  NOTEBOOKLM_LINK_TEXT: "Learn the Plugin. Access the NotebookLM knowledgebase.",
  LINKS_BUGS_ARIA: "Report bugs and raise feature requsts on the plugin's GitHub page",
  LINKS_BUGS: "Report Bugs",
  LINKS_YT_ARIA: "Check out my YouTube channel to learn about Visual Thinking and Excalidraw",
  LINKS_YT: "Learn on YouTube",
  LINKS_DISCORD_ARIA: "Join the Visual Thinking Workshop Discord Server",
  LINKS_DISCORD: "Join the Community",
  LINKS_TWITTER: "Follow me",
  LINKS_VTW_ARIA: "Learn about Visual PKM, Excalidraw, Obsidian, ExcaliBrain and more",
  LINKS_VTW: "Join a Workshop",
  LINKS_BOOK_ARIA: "Read Sketch Your Mind, my book on Visual Thinking",
  LINKS_BOOK: "Read the Book",
  LINKS_WIKI: "Plugin Wiki",
  LINKS_WIKI_ARIA: "Explore the Excalidraw Plugin Wiki",

  RELEASE_NOTES_NAME: "Display Release Notes after update",
  RELEASE_NOTES_DESC:
    "<b><u>Toggle ON:</u></b> Display release notes each time you update Excalidraw to a newer version.<br>" +
    "<b><u>Toggle OFF:</u></b> Silent mode. You can still read release notes on <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a>.",
  WARN_ON_MANIFEST_MISMATCH_NAME: "Warn about incomplete plugin updates",
  WARN_ON_MANIFEST_MISMATCH_DESC: "Checks that the installed Excalidraw executable matches the version shown in Obsidian's plugin list. If they don't match (often after partial sync), you'll see a warning and can update. Disable to stop checking.",
  NEWVERSION_NOTIFICATION_NAME: "Plugin update notification",
  NEWVERSION_NOTIFICATION_DESC:
      "<b><u>Toggle ON:</u></b> Show a notification when a new version of the plugin is available.<br>" +
      "<b><u>Toggle OFF:</u></b> Silent mode. You need to check for plugin updates in Community Plugins.",
  
  BASIC_HEAD: "Basic",
  BASIC_DESC: `In the "Basic" settings, you can configure options such as displaying release notes after updates, receiving plugin update notifications, setting the default location for new drawings, specifying the Excalidraw folder for embedding drawings into active documents, defining an Excalidraw template file, and designating an Excalidraw Automate script folder for managing automation scripts.`,
  FOLDER_NAME: "Excalidraw folder (CAsE sEnsITive!)",
  FOLDER_DESC:
    "Default location for new drawings. If empty, drawings will be created in the Vault root.",
  CROP_SUFFIX_NAME: "Crop file suffix",
  CROP_SUFFIX_DESC:
    "The last part of the filename for new drawings created when cropping an image. " +
    "Leave empty if you don't need a suffix.",
  CROP_PREFIX_NAME: "Crop file prefix",
  CROP_PREFIX_DESC:
    "The first part of the filename for new drawings created when cropping an image. " +
    "Leave empty if you don't need a prefix.",  
  ANNOTATE_SUFFIX_NAME: "Annotation file suffix",
  ANNOTATE_SUFFIX_DESC:
    "The last part of the filename for new drawings created when annotating an image. " +
    "Leave empty if you don't need a suffix.",
  ANNOTATE_PREFIX_NAME: "Annotation file prefix",
  ANNOTATE_PREFIX_DESC:
    "The first part of the filename for new drawings created when annotating an image. " +
    "Leave empty if you don't need a prefix.",
  ANNOTATE_PRESERVE_SIZE_NAME: "Preserve image size when annotating",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "When annotating an image in markdown the replacement image link will include the width of the original image.",
  CROP_FOLDER_NAME: "Crop file folder (CaSE senSItive!)",
  CROP_FOLDER_DESC:
    "Default location for new drawings created when cropping an image. If empty, drawings will be created following the Vault attachments settings.",
  ANNOTATE_FOLDER_NAME: "Image annotation file folder (CaSe SeNSitIVe!)",
  ANNOTATE_FOLDER_DESC:
    "Default location for new drawings created when annotating an image. If empty, drawings will be created following the Vault attachments settings.",
  FOLDER_EMBED_NAME:
    "Use Excalidraw folder when embedding a drawing into the active document",
  FOLDER_EMBED_DESC:
    "Define which folder to place the newly inserted drawing into " +
    "when using the command palette action: 'Create a new drawing and embed into active document'.<br>" +
    "<b><u>Toggle ON:</u></b> Use Excalidraw folder<br><b><u>Toggle OFF:</u></b> Use the attachments folder defined in Obsidian settings.",
  TEMPLATE_NAME: "Excalidraw template file or folder (caSe SenSiTive!)",
  TEMPLATE_DESC:
    "Full filepath or folderpath to the Excalidraw template.<br>" +
    "<b>Template File:</b>E.g.: If your template is in the default Excalidraw folder and its name is " +
    "Template.md, the setting would be: Excalidraw/Template.md (or just Excalidraw/Template - you may omit the .md file extension). " +
    "If you are using Excalidraw in compatibility mode, then your template must be a legacy Excalidraw file as well " +
    "such as Excalidraw/Template.excalidraw. <br><b>Template Folder:</b> You can also set a folder as your template. " +
    "In this case you will be prompted which template to use when creating a new drawing.<br>" +
    "<b>Pro Tip:</b> If you are using the Obsidian Templater plugin, you can add Templater code to your different Excalidraw " +
    "templates to automate configuration of your drawings.",
  SCRIPT_FOLDER_NAME: "Excalidraw Automate script folder (CASE SeNSitiVE!)",
  SCRIPT_FOLDER_DESC:
    "The files you place in this folder will be treated as Excalidraw Automate scripts. " +
    "You can access your scripts from Excalidraw via the Obsidian Command Palette. Assign " +
    "hotkeys to your favorite scripts just like to any other Obsidian command. " +
    "The folder may not be the root folder of your Vault. ",
  AI_HEAD: "AI Settings - Experimental",
  AI_DESC: `In the "AI" settings, you can configure options for using OpenAI's GPT API. ` +
    `While the OpenAI API is in beta, its use is strictly limited — as such we require you use your own API key. ` +
    `You can create an OpenAI account, add a small credit (5 USD minimum), and generate your own API key. ` +
    `Once API key is set, you can use the AI tools in Excalidraw.`,
  AI_ENABLED_NAME: "Enable AI features",
  AI_ENABLED_DESC: "You need to reopen Excalidraw for the changes to take effect.",
  AI_OPENAI_TOKEN_NAME: "OpenAI API key",
  AI_OPENAI_TOKEN_DESC:
    "You can get your OpenAI API key from your <a href='https://platform.openai.com/api-keys'>OpenAI account</a>.",
  AI_OPENAI_TOKEN_PLACEHOLDER: "Enter your OpenAI API key here",
  AI_OPENAI_DEFAULT_MODEL_NAME: "Default AI model",
  AI_OPENAI_DEFAULT_MODEL_DESC:
    "The default AI model to use when generating text. This is a freetext field, so you can enter any valid OpenAI model name. " +
    "Find out more about the available models on the <a href='https://platform.openai.com/docs/models'>OpenAI website</a>.",
  AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER: "Enter your default AI model here. e.g.: gpt-3.5-turbo-1106",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME: "Default Image Generation AI model",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC:
    "The default AI model to use when generating images. Image editing and variations are only supported by dall-e-2 at this time by OpenAI, " +
    "for this reason dall-e-2 will automatically be used in such cases regardless of this setting.<br>" +
    "This is a freetext field, so you can enter any valid OpenAI model name. " +
    "Find out more about the available models on the <a href='https://platform.openai.com/docs/models'>OpenAI website</a>.",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER: "Enter your default Image Generation AI model here e.g.: dall-e-3",
  AI_OPENAI_DEFAULT_VISION_MODEL_NAME: "Default AI vision model",
  AI_OPENAI_DEFAULT_VISION_MODEL_DESC:
    "The default AI vision model to use when generating text from images. This is a freetext field, so you can enter any valid OpenAI model name. " +
    "Find out more about the available models on the <a href='https://platform.openai.com/docs/models'>OpenAI website</a>.",
  AI_OPENAI_DEFAULT_API_URL_NAME: "OpenAI API URL",
  AI_OPENAI_DEFAULT_API_URL_DESC:
    "The default OpenAI API URL. This is a freetext field, so you can enter any valid OpenAI API compatible URL. " +
    "Excalidraw will use this URL when posting API requests to OpenAI. I am not doing any error handling on this field, so make sure you enter a valid URL and only change this if you know what you are doing. ",
  AI_OPENAI_DEFAULT_IMAGE_API_URL_NAME: "OpenAI Image Generation API URL",
  AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER: "Enter your default AI vision model here. e.g.: gpt-4o",
  SAVING_HEAD: "Saving",
  SAVING_DESC: "In the 'Saving' section of Excalidraw Settings, you can configure how your drawings are saved. This includes options for compressing Excalidraw JSON in Markdown, setting autosave intervals for both desktop and mobile, defining filename formats, and choosing whether to use the .excalidraw.md or .md file extension. ",
  COMPRESS_NAME: "Compress Excalidraw JSON in Markdown",
  COMPRESS_DESC:
    "By enabling this feature Excalidraw will store the drawing JSON in a Base64 compressed " +
    "format using the <a href='https://pieroxy.net/blog/pages/lz-string/index.html'>LZ-String</a> algorithm. " +
    "This will reduce the chance of Excalidraw JSON cluttering your search results in Obsidian. " +
    "As a side effect, this will also reduce the filesize of Excalidraw drawings. " +
    "When you switch an Excalidraw drawing to Markdown view, using the options menu in Excalidraw, the file will " +
    "be saved without compression, so that you can read and edit the JSON string. The drawing will be compressed again " +
    "once you switch back to Excalidraw view. " +
    "The setting only has effect 'point forward', meaning, existing drawings will not be affected by the setting " +
    "until you open them and save them.<br><b><u>Toggle ON:</u></b> Compress drawing JSON<br><b><u>Toggle OFF:</u></b> Leave drawing JSON uncompressed",
  DECOMPRESS_FOR_MD_NAME: "Decompress Excalidraw JSON in Markdown View",
  DECOMPRESS_FOR_MD_DESC:
    "By enabling this feature Excalidraw will automatically decompress the drawing JSON when you switch to Markdown view. " +
    "This will allow you to easily read and edit the JSON string. The drawing will be compressed again " +
    "once you switch back to Excalidraw view and save the drawing (CTRL+S).<br>" +
    "I recommend switching this feature off as it will result in smaller file sizes and avoiding unnecessary results in Obsidian search. " +
    "You can always use the 'Excalidraw: Decompress current Excalidraw file' command from the command palette "+
    "to manually decompress the drawing JSON when you need to read or edit it.",
  AUTOSAVE_INTERVAL_DESKTOP_NAME: "Interval for autosave on Desktop",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "The time interval between saves. Autosave will skip if there are no changes in the drawing. " +
    "Excalidraw will also save the file when closing a workspace tab or navigating within Obsidian, but away from the active Excalidraw tab (i.e. clicking on the Obsidian ribbon or checking backlinks, etc.). " +
    "Excalidraw will not be able to save your work when terminating Obsidian directly either by killing the Obsidian process, or clicking to close Obsidian altogether.",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "Interval for autosave on Mobile",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "I recommend a more frequent interval for Mobiles. " +
    "Excalidraw will also save the file when closing a workspace tab or navigating within Obsidian, but away from the active Excalidraw tab (i.e. tapping on the Obsidian ribbon or checking backlinks, etc.). " +
    "Excalidraw will not be able to save your work when terminating Obsidian directly (i.e. swiping it away). Also note, that when you switch apps on a Mobile device, sometimes Android and iOS closes " +
    "Obsidian in the background to save system resources. In such a case Excalidraw will not be able to save the latest changes.",
  FILENAME_HEAD: "Filename",
  FILENAME_DESC:
    "<p>Click this link for the <a href='https://momentjs.com/docs/#/displaying/format/'>" +
    "date and time format reference</a>.</p>",
  FILENAME_SAMPLE: "Filename for a new drawing is: ",
  FILENAME_EMBED_SAMPLE: "Filename for a new embedded drawing is: ",
  FILENAME_PREFIX_NAME: "Filename prefix",
  FILENAME_PREFIX_DESC: "The first part of the filename",
  FILENAME_PREFIX_EMBED_NAME:
    "Filename prefix when embedding a new drawing into a markdown note",
  FILENAME_PREFIX_EMBED_DESC:
    "Should the filename of the newly inserted drawing start with the name of the active markdown note " +
    "when using the command palette action: <code>Create a new drawing and embed into active document</code>?<br>" +
    "<b><u>Toggle ON:</u></b> Yes, the filename of a new drawing should start with filename of the active document<br><b><u>Toggle OFF:</u></b> No, filename of a new drawing should not include the filename of the active document",
  FILENAME_POSTFIX_NAME:
    "Custom text after markdown Note's name when embedding",
  FILENAME_POSTFIX_DESC:
    "Affects filename only when embedding into a markdown document. This text will be inserted after the note's name, but before the date.",
  FILENAME_DATE_NAME: "Filename Date",
  FILENAME_DATE_DESC:
    "The last part of the filename. Leave empty if you do not want a date.",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: ".excalidraw.md or .md",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "This setting does not apply if you use Excalidraw in compatibility mode, " +
    "i.e. you are not using Excalidraw markdown files.<br><b><u>Toggle ON:</u></b> filename ends with .excalidraw.md<br><b><u>Toggle OFF:</u></b> filename ends with .md",
  DISPLAY_HEAD: "Excalidraw appearance and behavior",
  DISPLAY_DESC: "In the 'appearance and behavior' section of Excalidraw Settings, you can fine-tune how Excalidraw appears and behaves. This includes options for dynamic styling, left-handed mode, matching Excalidraw and Obsidian themes, default modes, and more.",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME: "Limit Obsidian Font Size to Editor Text",
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC:
    "Obsidian's custom font size setting affects the entire interface, including Excalidraw and themes that depend on the default font size. " +
    "Enabling this option restricts font size changes to editor text, which will improve the look of Excalidraw. " +
    "If parts of the UI look incorrect after enabling, try turning this setting off.",  
  DYNAMICSTYLE_NAME: "Dynamic styling",
  DYNAMICSTYLE_DESC:
    "Change Excalidraw UI colors to match the canvas color",
  LEFTHANDED_MODE_NAME: "Left-handed mode",
  LEFTHANDED_MODE_DESC:
    "Currently only has effect in tray-mode. If turned on, the tray will be on the right side." +
    "<br><b><u>Toggle ON:</u></b> Left-handed mode.<br><b><u>Toggle OFF:</u></b> Right-handed mode.",
  IFRAME_MATCH_THEME_NAME: "Markdown embeds to match Excalidraw theme",
  IFRAME_MATCH_THEME_DESC:
    "<b><u>Toggle ON:</u></b> Set this to true if for example you are using Obsidian in dark-mode but use excalidraw with a light background. " +
    "With this setting the embedded Obsidian markdown document will match the Excalidraw theme (i.e. light colors if Excalidraw is in light mode).<br>" +
    "<b><u>Toggle OFF:</u></b> Set this to false if you want the embedded Obsidian markdown document to match the Obsidian theme (i.e. dark colors if Obsidian is in dark mode).",    
  MATCH_THEME_NAME: "New drawing to match Obsidian theme",
  MATCH_THEME_DESC:
    "If theme is dark, new drawing will be created in dark mode. This does not apply when you use a template for new drawings. " +
    "Also this will not affect when you open an existing drawing. Those will follow the theme of the template/drawing respectively." +
    "<br><b><u>Toggle ON:</u></b> Follow Obsidian Theme<br><b><u>Toggle OFF:</u></b> Follow theme defined in your template",
  MATCH_THEME_ALWAYS_NAME: "Existing drawings to match Obsidian theme",
  MATCH_THEME_ALWAYS_DESC:
    "If theme is dark, drawings will be opened in dark mode. If your theme is light, they will be opened in light mode. " +
    "<br><b><u>Toggle ON:</u></b> Match Obsidian theme<br><b><u>Toggle OFF:</u></b> Open with the same theme as last saved",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw to follow when Obsidian Theme changes",
  MATCH_THEME_TRIGGER_DESC:
    "If this option is enabled open Excalidraw pane will switch to light/dark mode when Obsidian theme changes. " +
    "<br><b><u>Toggle ON:</u></b> Follow theme changes<br><b><u>Toggle OFF:</u></b> Drawings are not affected by Obsidian theme changes",
  DEFAULT_OPEN_MODE_NAME: "Default mode when opening Excalidraw",
  DEFAULT_OPEN_MODE_DESC:
    "Specifies the mode how Excalidraw opens: Normal, Zen, or View mode. You may also set this behavior on a file level by " +
    "adding the excalidraw-default-mode frontmatter key with a value of: normal, view, or zen to your document.",
  DEFAULT_PEN_MODE_NAME: "Pen mode",
  DEFAULT_PEN_MODE_DESC:
    "Should pen mode be automatically enabled when opening Excalidraw?",
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME: "Enable double-click text create",
  DISABLE_DOUBLE_TAP_ERASER_NAME: "Enable double-tap eraser in pen mode",
  DISABLE_SINGLE_FINGER_PANNING_NAME: "Enable single-finger panning in pen mode",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "Show (+) crosshair in pen mode",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "Show crosshair in pen mode when using the freedraw tool. <b><u>Toggle ON:</u></b> SHOW <b><u>Toggle OFF:</u></b> HIDE<br>"+
    "The effect depends on the device. Crosshair is typically visible on drawing tablets, MS Surface, but not on iOS.",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME: "Render Excalidraw file as an image in hover preview...",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "...even if the file has the <b>excalidraw-open-md: true</b> frontmatter key.<br>" +
    "When this setting is off and the file is set to open in md by default, the hover preview will show the " +
    "markdown side of the document.<br>" +
    "Note: <b>excalidraw-open-md</b> is different from <b>excalidraw-embed-md</b>. If <b>excalidraw-embed-md</b> is set to true, the hover preview will always show the markdown side, regardless of this setting. To force image rendering when embedding, use <code>![[drawing#^as-image]]</code> in your markdown file.",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME: "Render as image when in markdown reading mode of an Excalidraw file",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC:
    "When you are in markdown reading mode (aka. reading the back side of the drawing) should the Excalidraw drawing be rendered as an image? " +
    "This setting will not affect the display of the drawing when you are in Excalidraw mode or when you embed the drawing into a markdown document or when rendering hover preview.<br><ul>" +
    "<li>See other related setting for <a href='#"+TAG_PDFEXPORT+"'>PDF Export</a> under 'Embedding and Exporting' further below.</li></ul><br>" +
    "You must close the active excalidraw/markdown file and reopen it for this change to take effect.",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME: "Render Excalidraw as Image in Obsidian PDF Export",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC:
    "This setting controls how Excalidraw files are exported to PDF using Obsidian's built-in <b>Export to PDF</b> feature.<br>" +
    "<ul><li><b>Enabled:</b> The PDF will include the Excalidraw drawing as an image.</li>" +
    "<li><b>Disabled:</b> The PDF will include the markdown content as text.</li></ul>" +
    "Note: This setting does not affect the PDF export feature within Excalidraw itself.<br>" +
    "See the other related setting for <a href='#"+TAG_MDREADINGMODE+"'>Markdown Reading Mode</a> under 'Appearance and Behavior' further above.<br>" +
    "⚠️ You must close and reopen the Excalidraw/markdown file for changes to take effect. ⚠️",
  HOTKEY_OVERRIDE_HEAD: "Hotkey overrides",
  HOTKEY_OVERRIDE_DESC: `Some of the Excalidraw hotkeys such as <code>${labelCTRL()}+Enter</code> to edit text or <code>${labelCTRL()}+K</code> to create an element link ` +
    "conflict with Obsidian hotkey settings. The hotkey combinations you add below will override Obsidian's hotkey settings while using Excalidraw, thus " +
    `you can add <code>${labelCTRL()}+G</code> if you want to default to Group Object in Excalidraw instead of opening Graph View.`,
  THEME_HEAD: "Theme and styling",
  ZOOM_AND_PAN_HEAD: "Zoom and Pan",
  PAN_WITH_RIGHT_MOUSE_BUTTON_NAME: "Right-click drag to pan",
  PAN_WITH_RIGHT_MOUSE_BUTTON_DESC: "Right-click and drag to pan the canvas (Miro-style). Press 'm' to open the context menu.",
  DEFAULT_PINCHZOOM_NAME: "Allow pinch zoom in pen mode",
  DEFAULT_PINCHZOOM_DESC:
    "Pinch zoom in pen mode when using the freedraw tool is disabled by default to prevent unwanted accidental zooming with your palm.<br>" +
    "<b><u>Toggle ON:</u></b> Enable pinch zoom in pen mode<br><b><u>Toggle OFF:</u></b>Disable pinch zoom in pen mode",

  DEFAULT_WHEELZOOM_NAME: "Mouse wheel to zoom by default",
  DEFAULT_WHEELZOOM_DESC:
    `<b><u>Toggle ON:</u></b> Mouse wheel to zoom; ${labelCTRL()} + mouse wheel to scroll</br><b><u>Toggle OFF:</u></b>${labelCTRL()} + mouse wheel to zoom; Mouse wheel to scroll`,
    
  ZOOM_TO_FIT_NAME: "Zoom to fit on view resize",
  ZOOM_TO_FIT_DESC: "Zoom to fit drawing when the pane is resized" +
    "<br><b><u>Toggle ON:</u></b> Zoom to fit<br><b><u>Toggle OFF:</u></b> Auto zoom disabled",
  ZOOM_TO_FIT_ONOPEN_NAME: "Zoom to fit on file open",
  ZOOM_TO_FIT_ONOPEN_DESC: "Zoom to fit drawing when the drawing is first opened" +
      "<br><b><u>Toggle ON:</u></b> Zoom to fit<br><b><u>Toggle OFF:</u></b> Auto zoom disabled",  
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "Zoom to fit max ZOOM level",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "Set the maximum level to which zoom to fit will enlarge the drawing. Minimum is 0.5 (50%) and maximum is 10 (1000%).",
  ZOOM_STEP_NAME: "Zoom increment",
  ZOOM_STEP_DESC: "Zoom increment (in percentage points) for actions like mouse wheel zoom. Smaller values give finer control but may require excessive scrolling. Default: 5%.",
  ZOOM_MIN_NAME: "Minimum zoom",
  ZOOM_MIN_DESC: "How far you can zoom out (fit more of the drawing on screen). Default: 10%. Values below 10% were historically unstable—lower with caution and reset to 10% if issues occur.",
  ZOOM_MAX_NAME: "Maximum zoom",
  ZOOM_MAX_DESC: "Upper zoom limit. Default: 3000%. Usually no need to change; included for completeness.",
  PEN_HEAD: "Pen",
  GRID_HEAD: "Grid",
  GRID_DYNAMIC_COLOR_NAME: "Dynamic grid color",
  GRID_DYNAMIC_COLOR_DESC:
    "<b><u>Toggle ON:</u></b>Change grid color to match the canvas color<br><b><u>Toggle OFF:</u></b>Use the color below as the grid color",
  GRID_COLOR_NAME: "Grid color",
  GRID_OPACITY_NAME: "Grid opacity",
  GRID_OPACITY_DESC: "Grid opacity will also control the opacity of the binding box when binding an arrow to an element.<br>" +
    "Set the opacity of the grid. 0 is transparent, 100 is opaque.",
  GRID_DIRECTION_NAME: "Grid direction",
  GRID_DIRECTION_DESC: "The first toggle shows/hides the horizontal grid, the second toggle shows/hides the vertical grid.",
  GRID_HORIZONTAL: "Render horizontal grid",
  GRID_VERTICAL: "Render vertical grid",
  LASER_HEAD: "Laser pointer",
  LASER_COLOR: "Laser pointer color",
  LASER_DECAY_TIME_NAME: "Laser pointer decay time",
  LASER_DECAY_TIME_DESC: "Laser pointer decay time in milliseconds. Default is 1000 (i.e. 1 second).",
  LASER_DECAY_LENGTH_NAME: "Laser pointer decay length.",
  LASER_DECAY_LENGTH_DESC: "Laser pointer decay length in line points. Default is 50.",
  LINKS_HEAD: "Links, transclusion and TODOs",
  LINKS_HEAD_DESC: "In the 'Links, transclusion and TODOs' section of Excalidraw Settings, you can configure how Excalidraw handles links, transclusions, and TODO items. This includes options for opening links, managing panes, displaying links with brackets, customizing link prefixes, handling TODO items, and more. ",
  LINKS_DESC:
    `${labelCTRL()}+CLICK on <code>[[Text Elements]]</code> to open them as links. ` +
    "If the selected text has more than one <code>[[valid Obsidian links]]</code>, only the first will be opened. " +
    "If the text starts as a valid web link (i.e. <code>https://</code> or <code>http://</code>), then " +
    "the plugin will open it in a browser. " +
    "When Obsidian files change, the matching <code>[[link]]</code> in your drawings will also change. " +
    "If you don't want text accidentally changing in your drawings use <code>[[links|with aliases]]</code>.",
  DRAG_MODIFIER_NAME: "Link Click and Drag&Drop Modifier Keys",
  DRAG_MODIFIER_DESC: "Modifier key behavior when clicking links and dragging and dropping elements. " +
    "Excalidraw will not validate your configuration... pay attention to avoid conflicting settings. " +
    "These settings are different for Apple and non-Apple. If you use Obsidian on multiple platforms, you'll need to make the settings separately. "+
    "The toggles follow the order of " +
    (DEVICE.isIOS || DEVICE.isMacOS ? "SHIFT, CMD, OPT, CONTROL." : "SHIFT, CTRL, ALT, META (Windows key)."),
  LONG_PRESS_DESKTOP_NAME: "Long press to open desktop",
  LONG_PRESS_DESKTOP_DESC: "Long press delay in milliseconds to open an Excalidraw Drawing embedded in a Markdown file. ",
  LONG_PRESS_MOBILE_NAME: "Long press to open mobile",
  LONG_PRESS_MOBILE_DESC: "Long press delay in milliseconds to open an Excalidraw Drawing embedded in a Markdown file. ",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE: "Allow double-click to open links in view mode",

  FOCUS_ON_EXISTING_TAB_NAME: "Focus on Existing Tab",
  FOCUS_ON_EXISTING_TAB_DESC: "When opening a link, Excalidraw will focus on the existing tab if the file is already open. " +
    "Enabling this setting overrides 'Reuse Adjacent Pane' when the file is already open except for the 'Open the back-of-the-note of the selected excalidraw image' command palette action.",
  SECOND_ORDER_LINKS_NAME: "Show second-order links",
  SECOND_ORDER_LINKS_DESC: "Show links when clicking on a link in Excalidraw. Second-order link are backlinks pointing to the link being clicked. " +
    "When using image icons to connect similar notes, second order links allow you to get to related notes in one click instead of two. " +
    "See <a href='https://youtube.com/shorts/O_1ls9c6wBY?feature=share'>YT Short</a> to understand.",
  ADJACENT_PANE_NAME: "Reuse adjacent pane",
  ADJACENT_PANE_DESC:
    `When ${labelCTRL()}+${labelALT()} clicking a link in Excalidraw, by default the plugin will open the link in a new pane. ` +
    "Turning this setting on, Excalidraw will first look for an existing pane, and try to open the link there. " +
    "Excalidraw will look for the other workspace pane based on your focus/navigation history, i.e. the workpane that was active before you " +
    "activated Excalidraw.",
  MAINWORKSPACE_PANE_NAME: "Open in main workspace",
  MAINWORKSPACE_PANE_DESC:
    `When ${labelCTRL()}+${labelALT()} clicking a link in Excalidraw, by default the plugin will open the link in a new pane in the current active window. ` +
    "Turning this setting on, Excalidraw will open the link in an existing or new pane in the main workspace. ",  
  LINK_BRACKETS_NAME: "Show <code>[[brackets]]</code> around links",
  LINK_BRACKETS_DESC: `${
    "In PREVIEW mode, when parsing Text Elements, place brackets around links. " +
    "You can override this setting for a specific drawing by adding <code>"
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> to the file's frontmatter.`,
  LINK_PREFIX_NAME: "Link prefix",
  LINK_PREFIX_DESC: `${
    "In PREVIEW mode, if the Text Element contains a link, precede the text with these characters. " +
    "You can override this setting for a specific drawing by adding <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> to the file's frontmatter.`,
  URL_PREFIX_NAME: "URL prefix",
  URL_PREFIX_DESC: `${
    "In PREVIEW mode, if the Text Element contains a URL link, precede the text with these characters. " +
    "You can override this setting for a specific drawing by adding <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> to the file's frontmatter.`,
  PARSE_TODO_NAME: "Parse todo",
  PARSE_TODO_DESC: "Convert '- [ ] ' and '- [x] ' to checkbox and tick in the box.",
  TODO_NAME: "Open TODO icon",
  TODO_DESC: "Icon to use for open TODO items",
  DONE_NAME: "Completed TODO icon",
  DONE_DESC: "Icon to use for completed TODO items",
  HOVERPREVIEW_NAME: `Hover preview without pressing the ${labelCTRL()} key`,
  HOVERPREVIEW_DESC:
    `<b><u>Toggle ON:</u></b> In Exalidraw <u>view mode</u> the hover preview for [[wiki links]] will be shown immediately, without the need to hold the ${labelCTRL()} key. ` +
    "In Excalidraw <u>normal mode</u>, the preview will be shown immediately only when hovering the blue link icon in the top right of the element.<br> " +
    `<b><u>Toggle OFF:</u></b> Hover preview is shown only when you hold the ${labelCTRL()} key while hovering the link.`,
  LINKOPACITY_NAME: "Opacity of link icon",
  LINKOPACITY_DESC:
    "Opacity of the link indicator icon in the top right corner of an element. 1 is opaque, 0 is transparent.",
  LINK_CTRL_CLICK_NAME:
    `${labelCTRL()}+CLICK on text with [[links]] or [](links) to open them`,
  LINK_CTRL_CLICK_DESC:
    "You can turn this feature off if it interferes with default Excalidraw features you want to use. If " +
    `this is turned off, you can either use ${labelCTRL()} + ${labelMETA()} or the link indicator in the top right of the element to open links.`,
  TRANSCLUSION_WRAP_NAME: "Overflow wrap behavior of transcluded text",
  TRANSCLUSION_WRAP_DESC:
    "Number specifies the character count where the text should be wrapped. " +
    "Set the text wrapping behavior of transcluded text. Turn this ON to force-wrap " +
    "text (i.e. no overflow), or OFF to soft-wrap text (at the nearest whitespace).",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "Transclusion word wrap default",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "You can manually set/override word wrapping length using the `![[page#^block]]{NUMBER}` format. " +
    "Normally you will not want to set a default, because if you transclude text inside a sticky note, then Excalidraw will automatically take care of word wrapping. " +
    "Set this value to `0` if you do not want to set a default. ",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "Page transclusion max char count",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "The maximum number of characters to display from the page when transcluding an entire page with the " +
    "![[markdown page]] format.",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "Quote translusion: remove leading '> ' from each line",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "Remove the leading '> ' from each line of the transclusion. This will improve readability of quotes in text only transclusions<br>" +
    "<b><u>Toggle ON:</u></b> Remove leading '> '<br><b><u>Toggle OFF:</u></b> Do not remove leading '> ' (note it will still be removed from the first row due to Obsidian API functionality)",
  GET_URL_TITLE_NAME: "Use iframely to resolve page title",
  GET_URL_TITLE_DESC:
    "Use the <code>http://iframely.server.crestify.com/iframely?url=</code> to get title of page when dropping a link into Excalidraw",
  PDF_TO_IMAGE: "PDF to Image",
  PDF_TO_IMAGE_SCALE_NAME: "PDF to Image conversion scale",
  PDF_TO_IMAGE_SCALE_DESC: "Sets the resolution of the image that is generated from the PDF page. Higher resolution will result in bigger images in memory and consequently a higher load on your system (slower performance), but sharper image. " +
    "Additionally, if you want to copy PDF pages (as images) to Excalidraw.com, the bigger image size may result in exceeding the 2MB limit on Excalidraw.com.",
  EMBED_TOEXCALIDRAW_HEAD: "Embed files into Excalidraw",
  EMBED_TOEXCALIDRAW_DESC: "In the Embed Files section of Excalidraw Settings, you can configure how various files are embedded into Excalidraw. This includes options for embedding interactive markdown files, PDFs, and markdown files as images.",
  MD_HEAD: "Embed markdown into Excalidraw as image",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "Interactive Markdown Files",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `The below settings will only effect future embeds. Current embeds remain unchanged. The theme setting of embedded frames is under the "Excalidraw appearance and behavior" section.`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "Single click to edit embedded markdown",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "Single click on an embedded markdown file to edit it. " +
    "When turned off, the markdown file will first open in preview mode, then switch to edit mode when you click on it again.",
  MD_TRANSCLUDE_WIDTH_NAME: "Default width of a transcluded markdown document",
  MD_TRANSCLUDE_WIDTH_DESC:
    "The width of the markdown page. This affects the word wrapping when transcluding longer paragraphs, and the width of " +
    "the image element. You can override the default width of " +
    "an embedded file using the <code>[[filename#heading|WIDTHxMAXHEIGHT]]</code> syntax in markdown view mode under embedded files.",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "Default maximum height of a transcluded markdown document",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "The embedded image will be as high as the markdown text requires, but not higher than this value. " +
    "You can override this value by editing the embedded image link in markdown view mode with the following syntax <code>[[filename#^blockref|WIDTHxMAXHEIGHT]]</code>.",
  MD_DEFAULT_FONT_NAME:
    "The default font typeface to use for embedded markdown files.",
  MD_DEFAULT_FONT_DESC:
    'Set this value to "Virgil" or "Cascadia" or the filename of a valid <code>.ttf</code>, <code>.woff</code>, or <code>.woff2</code> font e.g. <code>MyFont.woff2</code> ' +
    "You can override this setting by adding the following frontmatter-key to the embedded markdown file: <code>excalidraw-font: font_or_filename</code>",
  MD_DEFAULT_COLOR_NAME:
    "The default font color to use for embedded markdown files.",
  MD_DEFAULT_COLOR_DESC:
    'Set this to any valid css color name e.g. "steelblue" (<a href="https://www.w3schools.com/colors/colors_names.asp">color names</a>), or a valid hexadecimal color e.g. "#e67700", ' +
    "or any other valid css color string. You can override this setting by adding the following frontmatter-key to the embedded markdown file: <code>excalidraw-font-color: steelblue</code>",
  MD_DEFAULT_BORDER_COLOR_NAME:
    "The default border color to use for embedded markdown files.",
  MD_DEFAULT_BORDER_COLOR_DESC:
    'Set this to any valid css color name e.g. "steelblue" (<a href="https://www.w3schools.com/colors/colors_names.asp">color names</a>), or a valid hexadecimal color e.g. "#e67700", ' +
    "or any other valid css color string. You can override this setting by adding the following frontmatter-key to the embedded markdown file: <code>excalidraw-border-color: gray</code>. " +
    "Leave empty if you don't want a border. ",
  MD_CSS_NAME: "CSS file",
  MD_CSS_DESC:
    "The filename of the CSS to apply to markdown embeds. Provide the filename with extension (e.g. 'md-embed.css'). The css file may also be a plain " +
    "markdown file (e.g. 'md-embed-css.md'), just make sure the content is written using valid css syntax. " +
    `If you need to look at the HTML code you are applying the CSS to, then open Obsidian Developer Console (${DEVICE.isIOS || DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"}) and type in the following command: ` +
    '"ExcalidrawAutomate.mostRecentMarkdownSVG". This will display the most recent SVG generated by Excalidraw. ' +
    "Setting the font-family in the css is has limitations. By default only your operating system's standard fonts are available (see README for details). " +
    "You can add one custom font beyond that using the setting above. " +
    'You can override this css setting by adding the following frontmatter-key to the embedded markdown file: "excalidraw-css: css_file_in_vault|css-snippet".',
  EMBED_HEAD: "Embedding Excalidraw into your Notes and Exporting",
  EMBED_DESC: `In the "Embed & Export" settings, you can configure how images and Excalidraw drawings are embedded and exported within your documents. Key settings include choosing the image type for markdown preview (such as Native SVG or PNG), specifying the type of file to insert into the document (original Excalidraw, PNG, or SVG), and managing image caching for embedding in markdown. You can also control image sizing, whether to embed drawings using wiki links or markdown links, and adjust settings related to image themes, background colors, and Obsidian integration. 
    Additionally, there are settings for auto-export, which automatically generates SVG and/or PNG files to match the title of your Excalidraw drawings, keeping them in sync with file renames and deletions.`,
  EMBED_CANVAS: "Obsidian Canvas support",
  EMBED_CANVAS_NAME: "Immersive embedding",
  EMBED_CANVAS_DESC: 
    "Hide canvas node border and background when embedding an Excalidraw drawing to Canvas. " +
    "Note that for a full transparent background for your image, you will still need to configure Excalidraw to export images with transparent background.",
  EMBED_CACHING: "Image caching and rendering optimization",
  RENDERING_CONCURRENCY_NAME: "Image rendering concurrency",
  RENDERING_CONCURRENCY_DESC:
    "Number of parallel workers to use for image rendering. Increasing this number will speed up the rendering process, but may slow down the rest of the system. " +
    "The default value is 3. You can increase this number if you have a powerful system.",
  EXPORT_SUBHEAD: "Export Settings",
  EMBED_SIZING: "Image sizing",
  EMBED_THEME_BACKGROUND: "Image theme and background color",
  EMBED_IMAGE_CACHE_NAME: "Cache images for embedding in markdown",
  EMBED_IMAGE_CACHE_DESC: "Cache images for embedding in markdown. This will speed up the embedding process, but in case you compose images of several sub-component drawings, " +
    "the embedded image in Markdown won't update until you open the drawing and save it to trigger an update of the cache.",
  SCENE_IMAGE_CACHE_NAME: "Cache nested Excalidraws in Scene",
  SCENE_IMAGE_CACHE_DESC: "Cache nested Excalidraws in the Scene for faster scene rendering. This will speed up the rendering process, especially if you have deeply nested Excalidraws in your scene. " + 
    "Excalidraw will try to intelligently identify if any children of a nested Excalidraw have changed and will update the cache accordingly. " +
    "You may want to turn this off, in case you are suspecting that the cache is not updating properly.",
  EMBED_IMAGE_CACHE_CLEAR: "Purge Cache",
  BACKUP_CACHE_CLEAR: "Purge Backups",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "This action will delete all Excalidraw drawing backups. Backups are used as a safety measure in case your drawing file gets damaged. Each time you open Obsidian the plugin automatically deletes backups for files that no longer exist in your Vault. Are you sure you want to clear all backups?",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "If found, use the already exported image for preview",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "This setting works in conjunction with the <a href='#"+TAG_AUTOEXPORT+"'>Auto-export SVG/PNG</a> setting. If an exported image that matches the file name of the drawing " +
    "is available, use that image instead of generating a preview image on the fly. This will result in faster previews especially when you have many embedded objects in the drawing, however, " +
    "it may happen that your latest changes are not displayed and that the image will not automatically match your Obsidian theme in case you have changed the " +
    "Obsidian theme since the export was created. This setting only applies to embedding images into markdown documents. " +
    "For a number of reasons, the same approach cannot be used to expedite the loading of drawings with many embedded objects. See demonstration <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.23' target='_blank'>here</a>.",
  /*EMBED_PREVIEW_SVG_NAME: "Display SVG in markdown preview",
  EMBED_PREVIEW_SVG_DESC:
    "<b><u>Toggle ON:</u></b> Embed drawing as an <a href='https://en.wikipedia.org/wiki/Scalable_Vector_Graphics' target='_blank'>SVG</a> image into the markdown preview.<br>" +
    "<b><u>Toggle OFF:</u></b> Embed drawing as a <a href='' target='_blank'>PNG</a> image. Note, that some of the <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>image block referencing features</a> do not work with PNG embeds.",*/
  EMBED_PREVIEW_IMAGETYPE_NAME: "Image type in markdown preview",
  EMBED_PREVIEW_IMAGETYPE_DESC:
    "<b><u>Native SVG</u></b>: High Image Quality. Embedded Websites, YouTube videos, Obsidian Links, and external images embedded via a URL will all work. Embedded Obsidian pages will not<br>" +
    "<b><u>SVG Image</u></b>: High Image Quality. Embedded elements and images embedded via URL only have placeholders, links don't work<br>" +
    "<b><u>PNG Image</u></b>: Lower Image Quality, but in some cases better performance with large drawings. Embedded elements and images embedded via URL only have placeholders, links don't work. Also some of the <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>image block referencing features</a> do not work with PNG embeds.", 
  PREVIEW_MATCH_OBSIDIAN_NAME: "Excalidraw preview to match Obsidian theme",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "Image preview in documents should match the Obsidian theme. If enabled, when Obsidian is in dark mode, Excalidraw images will render in dark mode. " +
    "When Obsidian is in light mode, Excalidraw will render light mode as well. You may want to switch 'Export image with background' off for a more Obsidian-integrated look and feel.",
  EMBED_WIDTH_NAME: "Default width of embedded (transcluded) image",
  EMBED_WIDTH_DESC:
    "The default width of an embedded drawing. This applies to live preview edit and reading mode, as well as to hover previews. You can specify a custom " +
    "width when embedding an image using the <code>![[drawing.excalidraw|100]]</code> or " +
    "<code>[[drawing.excalidraw|100x100]]</code> format.",
  EMBED_HEIGHT_NAME: "Default height of embedded (transcluded) image",
  EMBED_HEIGHT_DESC:
    "The default height of an embedded drawing. This applies to live preview edit and reading mode, as well as to hover previews. You can specify a custom " +
    "height when embedding an image using the <code>![[drawing.excalidraw|100]]</code> or " +
    "<code>[[drawing.excalidraw|100x100]]</code> format.",
  EMBED_TYPE_NAME: "Type of file to insert into the document",
  EMBED_TYPE_DESC:
    "When you embed an image into a document using the command palette this setting will specify if Excalidraw should embed the original Excalidraw file " +
    "or a PNG or an SVG copy. You need to enable <a href='#"+TAG_AUTOEXPORT+"'>auto-export PNG / SVG</a> (see below under Export Settings) for those image types to be available in the dropdown. For drawings that do not have a " +
    "a corresponding PNG or SVG readily available the command palette action will insert a broken link. You need to open the original drawing and initiate export manually. " +
    "This option will not autogenerate PNG/SVG files, but will simply reference the already existing files.",
  EMBED_MARKDOWN_COMMENT_NAME: "Embed link to drawing as comment",
  EMBED_MARKDOWN_COMMENT_DESC: 
    "Embed the link to the original Excalidraw file as a markdown link under the image, e.g.:<code>%%[[drawing.excalidraw]]%%</code>.<br>" +
    "Instead of adding a markdown comment you may also select the embedded SVG or PNG line and use the command palette action: " +
    "'<code>Excalidraw: Open Excalidraw drawing</code>' to open the drawing.",
  EMBED_WIKILINK_NAME: "Embed Drawing using Wiki link",
  EMBED_WIKILINK_DESC:
    "<b><u>Toggle ON:</u></b> Excalidraw will embed a [[wiki link]].<br><b><u>Toggle OFF:</u></b> Excalidraw will embed a [markdown](link).",
  EXPORT_PNG_SCALE_NAME: "PNG export image scale",
  EXPORT_PNG_SCALE_DESC: "The size-scale of the exported PNG image",
  EXPORT_BACKGROUND_NAME: "Export image with background",
  EXPORT_BACKGROUND_DESC:
    "If turned off, the exported image will be transparent.",
  EXPORT_PADDING_NAME: "Image Padding",
  EXPORT_PADDING_DESC:
    "The padding (in pixels) around the exported SVG or PNG image. Padding is set to 0 for clippedFrame references." +
    "If you have curved lines close to the edge of the image they might get cropped during image export. You can increase this value to avoid cropping. " +
    "You can also override this setting at a file level by adding the <code>excalidraw-export-padding: 5<code> frontmatter key.",
  EXPORT_THEME_NAME: "Export image with theme",
  EXPORT_THEME_DESC:
    "Export the image matching the dark/light theme of your drawing. If turned off, " +
    "drawings created in dark mode will appear as they would in light mode.",
  EXPORT_EMBED_SCENE_NAME: "Embed scene in exported image",
  EXPORT_EMBED_SCENE_DESC:
    "Embed Excalidraw scene in exported image. Can be overridden at a file level by adding the <code>excalidraw-export-embed-scene: true/false<code> frontmatter key. " +
    "The setting only takes effect the next time you (re)open drawings.",
  PDF_EXPORT_SETTINGS: "PDF Export Settings",
  EXPORT_HEAD: "Auto-export Settings",
  EXPORT_SYNC_NAME:
    "Keep the .SVG and/or .PNG filenames in sync with the drawing file",
  EXPORT_SYNC_DESC:
    "When turned on, the plugin will automatically update the filename of the .SVG and/or .PNG files when the drawing in the same folder (and same name) is renamed. " +
    "The plugin will also automatically delete the .SVG and/or .PNG files when the drawing in the same folder (and same name) is deleted. ",
  EXPORT_SVG_NAME: "Auto-export SVG",
  EXPORT_SVG_DESC:
    "Automatically create an SVG export of your drawing matching the title of your file. " +
    "The plugin will save the *.SVG file in the same folder as the drawing. " +
    "Embed the .svg file into your documents instead of Excalidraw making you embeds platform independent. " +
    "While the auto-export switch is on, this file will get updated every time you edit the Excalidraw drawing with the matching name. " + 
    "You can override this setting on a file level by adding the <code>excalidraw-autoexport</code> frontmatter key. Valid values for this key are " +
    "<code>none</code>,<code>both</code>,<code>svg</code>, and <code>png</code>.",
  EXPORT_PNG_NAME: "Auto-export PNG",
  EXPORT_PNG_DESC: "Same as the auto-export SVG, but for *.PNG",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "Export both dark- and light-themed image",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC:  "When enabled, Excalidraw will export two files instead of one: filename.dark.png, filename.light.png and/or filename.dark.svg and filename.light.svg<br>"+
    "Double files will be exported both if auto-export SVG or PNG (or both) are enabled, as well as when clicking export on a single image.",
  COMPATIBILITY_HEAD: "Compatibility features",
  COMPATIBILITY_DESC: "You should only enable these features if you have a strong reason for wanting to work with excalidraw.com files instead of markdown files. Many of the plugin features are not supported on legacy files. Typical usecase would be if you use set your vault up on top of a Visual Studio Code project folder and you have .excalidraw drawings you want to access from Visual Studio Code as well. Another usecase might be using Excalidraw in Logseq and Obsidian in parallel.",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "Linter compatibility",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC: "Excalidraw is sensitive to the file structure below <code># Excalidraw Data</code>. Automatic linting of documents can create errors in Excalidraw Data. " +
    "While I've made some effort to make the data loading resilient to " +
    "lint changes, this solution is not foolproof.<br><mark>The best is to avoid linting or otherwise automatically changing Excalidraw documents using different plugins.</mark><br>" +
    "Use this setting if for good reasons you have decided to ignore my recommendation and configured linting of Excalidraw files.<br> " +
    "The <code>## Text Elements</code> section is sensitive to empty lines. A common linting approach is to add an empty line after section headings. In case of Excalidraw this will break/change the first text element in your drawing. " +
    "To overcome this, you can enable this setting. When enabled, Excalidraw will add a dummy element to the beginning of <code>## Text Elements</code> that the linter can safely modify." ,
  PRESERVE_TEXT_AFTER_DRAWING_NAME: "Zotero and Footnotes compatibility",
  PRESERVE_TEXT_AFTER_DRAWING_DESC: "Preserve text after the ## Drawing section of the markdown file. This may have a very slight performance impact when saving very large drawings.",
  DEBUGMODE_NAME: "Enable debug messages",
  DEBUGMODE_DESC: "I recommend restarting Obsidian after enabling/disabling this setting. This enable debug messages in the console. This is useful for troubleshooting issues. " +
    "If you are experiencing problems with the plugin, please enable this setting, reproduce the issue, and include the console log in the issue you raise on <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/issues'>GitHub</a>",
  SLIDING_PANES_NAME: "Sliding panes plugin support",
  SLIDING_PANES_DESC:
    "Need to restart Obsidian for this change to take effect.<br>" +
    "If you use the <a href='https://github.com/deathau/sliding-panes-obsidian' target='_blank'>Sliding Panes plugin</a> " +
    "you can enable this setting to make Excalidraw drawings work with the Sliding Panes plugin.<br>" +
    "Note, that Excalidraw Sliding Panes support causes compatibility issues with Obsidian Workspaces.<br>" +
    "Note also, that the 'Stack Tabs' feature is now available in Obsidian, providing native support for most of the Sliding Panes functionality.",
  EXPORT_EXCALIDRAW_NAME: "Auto-export Excalidraw",
  EXPORT_EXCALIDRAW_DESC: "Same as the auto-export SVG, but for *.Excalidraw",
  SYNC_EXCALIDRAW_NAME:
    "Sync *.excalidraw with *.md version of the same drawing",
  SYNC_EXCALIDRAW_DESC:
    "If the modified date of the *.excalidraw file is more recent than the modified date of the *.md file " +
    "then update the drawing in the .md file based on the .excalidraw file",
  COMPATIBILITY_MODE_NAME: "New drawings as legacy files",
  COMPATIBILITY_MODE_DESC:
    "⚠️ Enable this only if you know what you are doing. In 99.9% of the cases you DO NOT want this on. " +
    "By enabling this feature drawings you create with the ribbon icon, the command palette actions, " +
    "and the file explorer are going to be all legacy *.excalidraw files. This setting will also turn off the reminder message " +
    "when you open a legacy file for editing.",
  MATHJAX_NAME: "MathJax (LaTeX) javascript library host",
  MATHJAX_DESC: "If you are using LaTeX equations in Excalidraw, then the plugin needs to load a javascript library for that. " + 
    "Some users are unable to access certain host servers. If you are experiencing issues, try changing the host here. You may need to "+
    "restart Obsidian after closing settings, for this change to take effect.",
  LATEX_DEFAULT_NAME: "Default LaTeX formula for new equations",
  LATEX_DEFAULT_DESC: "Leave empty if you don't want a default formula. You can add default formatting here such as <code>\\color{white}</code>.",
  LATEX_PREAMBLE_NAME: "LaTeX preamble file (CasE SEnSiTivE!)",
  LATEX_PREAMBLE_DESC: "Full filepath to the preamble file, leave empty for default. If the file doesn't exist this option will be ignored.<br><strong>Important:</strong> Requires obsidian reload after change to take effect!",
  NONSTANDARD_HEAD: "Non-Excalidraw.com supported features",
  NONSTANDARD_DESC: `These settings in the "Non-Excalidraw.com Supported Features" section provide customization options beyond the default Excalidraw.com features. These features are not available on excalidraw.com. When exporting the drawing to Excalidraw.com these features will appear different.
    You can configure the number of custom pens displayed next to the Obsidian Menu on the canvas, allowing you to choose from a range of options. Additionally, you can enable a local font option, which adds a local font to the list of fonts on the element properties panel for text elements. `,
  RENDER_TWEAK_HEAD: "Rendering tweaks",
  MAX_IMAGE_ZOOM_IN_NAME: "Maximum image zoom in resolution",
  MAX_IMAGE_ZOOM_IN_DESC: "To save on memory and because Apple Safari (Obsidian on iOS) has some hard-coded limitations, Excalidraw.com limits the max resolution of images and large objects when zooming in. You can override this limitation using a multiplicator. " +
    "This means you are multiplying the limit set by default in Excalidraw, the larger the multiplier the better the image zoom in resolution will be, and the more memory it will consume. " +
    "I recommend playing with multiple values for this setting. You know you've hit the wall, when zooming in to a larger PNG image suddenly the image disappears from view. The default value is 1. The setting has no effect on iOS.",
  CUSTOM_PEN_HEAD: "Custom pens",
  CUSTOM_PEN_NAME: "Number of custom pens",
  CUSTOM_PEN_DESC: "You will see these pens next to the Obsidian Menu on the canvas. You can customize the pens on the canvas by long-pressing the pen button.",
  EXPERIMENTAL_HEAD: "Miscellaneous features",
  EXPERIMENTAL_DESC: `These miscellaneous features in Excalidraw include options for setting default LaTeX formulas for new equations, enabling a Field Suggester for autocompletion, displaying type indicators for Excalidraw files, enabling immersive image embedding in live preview editing mode, and experimenting with Taskbone Optical Character Recognition for text extraction from images and drawings. Users can also enter a Taskbone API key for extended usage of the OCR service.`,
  EA_HEAD: "Excalidraw Automate",
  EA_DESC: 
    "ExcalidrawAutomate is a scripting and automation API for Excalidraw. Unfortunately, the documentation of the API is sparse. " +
    "I recommend reading the <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts'>ExcalidrawAutomate.d.ts</a> file, " +
    "visiting the <a href='https://zsviczian.github.io/obsidian-excalidraw-plugin/'>ExcalidrawAutomate How-to</a> page - though the information " +
          "here has not been updated for a long while -, and finally to enable the field suggester below. The field suggester will show you the available " +
    "functions, their parameters and short description as you type. The field suggester is the most up-to-date documentation of the API.",
  FIELD_SUGGESTER_NAME: "Enable Field Suggester",
  FIELD_SUGGESTER_DESC:
    "Field Suggester borrowed from Breadcrumbs and Templater plugins. The Field Suggester will show an autocomplete menu " +
    "when you type <code>excalidraw-</code> or <code>ea.</code> with function description as hints on the individual items in the list.",
  STARTUP_SCRIPT_NAME: "Startup script",
  STARTUP_SCRIPT_DESC:
    "If set, excalidraw will execute the script at plugin startup. This is useful if you want to set any of the Excalidraw Automate hooks. The startup script is a markdown file " +
    "that should contain the javascript code you want to execute when Excalidraw starts.",
  STARTUP_SCRIPT_BUTTON_CREATE: "Create startup script",
  STARTUP_SCRIPT_BUTTON_OPEN: "Open startup script",
  STARTUP_SCRIPT_EXISTS: "Startup script file already exists",
  FILETYPE_NAME: "Display type (✏️) for excalidraw.md files in File Explorer",
  FILETYPE_DESC:
    "Excalidraw files will receive an indicator using the emoji or text defined in the next setting.",
  FILETAG_NAME: "Set the type indicator for excalidraw.md files",
  FILETAG_DESC: "The text or emoji to display as type indicator.",
  INSERT_EMOJI: "Insert an emoji",
  LIVEPREVIEW_NAME: "Immersive image embedding in live preview editing mode",
  LIVEPREVIEW_DESC:
    "Turn this on to support image embedding styles such as ![[drawing|width|style]] in live preview editing mode. " +
    "The setting will not affect the currently open documents. You need close the open documents and re-open them for the change " +
    "to take effect.",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "Fade out Excalidraw markup",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC: "In Markdown view mode, the section after the markdown comment %% " +
    "fades out. The text is still there, but the visual clutter is reduced. Note, you can place the %% in the line right above # Text Elements, " +
    "in this case the entire drawing markdown will fade out including # Text Elements. The side effect is you won't be able to block reference text in other markdown notes, that is after the %% comment section. This is seldom an issue. " +
    "Should you want to edit the Excalidraw markdown script, simply switch to markdown view mode and temporarily remove the %% comment.",
  EXCALIDRAW_PROPERTIES_NAME: "Load Excalidraw Properties into Obsidian Suggester",
  EXCALIDRAW_PROPERTIES_DESC: "Toggle this setting to load Excalidraw document properties into Obsidian's property suggester at plugin startup. "+
   "Enabling this feature simplifies the use of Excalidraw front matter properties, allowing you to leverage many powerful settings. If you prefer not to load these properties automatically, " +
   "you can disable this feature, but you will need to manually remove any unwanted properties from the suggester. " +
   "Note that turning on this setting requires restarting the plugin as properties are loaded at startup.",  
  FONTS_HEAD: "Fonts",
  FONTS_DESC: "Configure local fontfaces and downloaded CJK fonts for Excalidraw.",
  CUSTOM_FONT_HEAD: "Local font",
  ENABLE_FOURTH_FONT_NAME: "Enable local font option",
  ENABLE_FOURTH_FONT_DESC:
    "Enabling this option will add a local font to the font list in the properties panel for text elements. " +
    "Be aware that using this local font may compromise platform independence. " +
    "Files using the custom font might render differently when opened in a different vault or at a later time, depending on the font settings. " +
    "Additionally, the 4th font will default to the system font on excalidraw.com or other Excalidraw versions.",
  FOURTH_FONT_NAME: "Local font file",
  FOURTH_FONT_DESC:
    "Select a .otf, .ttf, .woff, or .woff2 font file from your vault to use as the local font. " +
    "If no file is selected, Excalidraw will default to the Virgil font. " +
    "For optimal performance, it is recommended to use a .woff2 file, as Excalidraw will encode only the necessary glyphs when exporting images to SVG. " +
    "Other font formats will embed the entire font in the exported file, potentially resulting in significantly larger file sizes.",
  OFFLINE_CJK_NAME: "Offline CJK font support",
  OFFLINE_CJK_DESC: 
    `<strong>Changes you make here will only take effect after restarting Obsidian.</strong><br>
     Excalidraw.com offers handwritten CJK fonts. By default these fonts are not included in the plugin locally, but are served from the Internet. 
     If you prefer to keep Excalidraw fully local, allowing it to work without Internet access you can download the necessary <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip" target="_blank">font files from GitHub</a>.
     After downloading, unzip the contents into a folder within your Vault.<br>
     Pre-loading fonts will impact startup performance. For this reason you can select which fonts to load.`,
  CJK_ASSETS_FOLDER_NAME: "CJK Font Folder (cAsE sENsiTIvE!)",
  CJK_ASSETS_FOLDER_DESC: `You can set the location of the CJK fonts folder here. For example, you may choose to place it under <code>Excalidraw/CJK Fonts</code>.<br><br>
    <strong>Important:</strong> Do not set this folder to the Vault root! Do not put other fonts in this folder.<br><br>
    <strong>Note:</strong> If you're using Obsidian Sync and want to synchronize these font files across your devices, ensure that Obsidian Sync is set to synchronize "All other file types".`, 
  LOAD_CHINESE_FONTS_NAME: "Load Chinese fonts from file at startup",
  LOAD_JAPANESE_FONTS_NAME: "Load Japanese fonts from file at startup",
  LOAD_KOREAN_FONTS_NAME: "Load Korean fonts from file at startup",
  SCRIPT_SETTINGS_HEAD: "Settings for installed Scripts",
  SCRIPT_SETTINGS_DESC: "Some of the Excalidraw Automate Scripts include settings. Settings are organized by script. Settings will only become visible in this list after you have executed the newly downloaded script once.",
  TASKBONE_HEAD: "Taskbone Optical Character Recognition",
  TASKBONE_DESC: "This is an experimental integration of optical character recognition into Excalidraw. Please note, that taskbone is an independent external service not provided by Excalidraw, nor the Excalidraw-Obsidian plugin project. " +
    "The OCR service will grab legible text from freedraw lines and embedded pictures on your canvas and place the recognized text in the frontmatter of your drawing as well as onto clipboard. " +
    "Having the text in the frontmatter will enable you to search in Obsidian for the text contents of these. " +
    "Note, that the process of extracting the text from the image is not done locally, but via an online API. The taskbone service stores the image on its servers only as long as necessary for the text extraction. However, if this is a dealbreaker, then please don't use this feature.",
  TASKBONE_ENABLE_NAME: "Enable Taskbone",
  TASKBONE_ENABLE_DESC: "By enabling this service your agree to the Taskbone <a href='https://www.taskbone.com/legal/terms/' target='_blank'>Terms and Conditions</a> and the " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>Privacy Policy</a>.",
  TASKBONE_APIKEY_NAME: "Taskbone API Key",
  TASKBONE_APIKEY_DESC: "Taskbone offers a free service with a reasonable number of scans per month. If you want to use this feature more frequently, or you want to support " + 
    "the developer of Taskbone (as you can imagine, there is no such thing as 'free', providing this awesome OCR service costs some money to the developer of Taskbone), you can " +
    "purchase a paid API key from <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a>. In case you have purchased a key, simply overwrite this auto generated free-tier API-key with your paid key.",

  //HotkeyEditor
  HOTKEY_PRESS_COMBO_NANE: "Press your hotkey combination",
  HOTKEY_PRESS_COMBO_DESC: "Please press the desired key combination",
  HOTKEY_BUTTON_ADD_OVERRIDE: "Add New Override",
  HOTKEY_BUTTON_REMOVE: "Remove",

  //openDrawings.ts
  SELECT_FILE: "Select a file then press enter.",
  SELECT_COMMAND: "Select a command then press enter.",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `Select a file then press ENTER, or ${labelSHIFT()}+${labelMETA()}+ENTER to insert at 100% scale.`,
  NO_MATCH: "No file matches your query.",
  NO_MATCHING_COMMAND: "No command matches your query.",
  SELECT_FILE_TO_LINK: "Select the file you want to insert the link for.",
  SELECT_COMMAND_PLACEHOLDER: "Select the command you want to insert the link for.",
  SELECT_DRAWING: "Select the image or drawing you want to insert",
  TYPE_FILENAME: "Type name of drawing to select.",
  SELECT_FILE_OR_TYPE_NEW:
    "Select existing drawing or type name of a new drawing then press Enter.",
  SELECT_TO_EMBED: "Select the drawing to insert into active document.",
  SELECT_MD: "Select the markdown document you want to insert",
  SELECT_PDF: "Select the PDF document you want to insert",
  PDF_PAGES_HEADER: "Pages to load?",
  PDF_PAGES_DESC: "Format: 1, 3-5, 7, 9-11",

  //SelectCard.ts
  TYPE_SECTION: "Type section name to select.",
  SELECT_SECTION_OR_TYPE_NEW:
    "Select existing section or type name of a new section then press Enter.",
  INVALID_SECTION_NAME: "Invalid section name.",
  EMPTY_SECTION_MESSAGE: "Type the Section Name and hit enter to create a new Section",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW WARNING\nAborted loading embedded images due to infinite loop in file:\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "Script execution error. Please find error message on the developer console.",

  //ExcalidrawViewUtils.ts
  MARKER_FRAME_RENDERING_DISABLED_NOTICE: "There are hidden marker-frames in the scene.",
  //DRAWING_HAS_BACK_OF_THE_CARD: "There are notes on the back of this drawing.",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "Excalidraw file was corrupted. Loading from backup file.",
  FONT_LOAD_SLOW: "Loading Fonts...\n\n This is taking longer than expected. If this delay occurs regularly then you may download the fonts locally to your Vault. \n\n" +
    "(click=dismiss, right-click=Info)",
  FONT_INFO_TITLE: "Starting v2.5.3 fonts load from the Internet",
  FONT_INFO_DETAILED: `
      <p>
        To improve Obsidian's startup time and manage the large <strong>CJK font family</strong>, 
        I've moved the CJK fonts out of the plugin's <code>main.js</code>. CJK fonts will be loaded from the internet by default.
        This typically shouldn't cause issues as Obsidian caches these files after first use.
      </p>
      <p>
        If you prefer to keep Obsidian 100% local or experience performance issues, you can download the font assets.
      </p>
      <h3>Instructions:</h3>
      <ol>
        <li>Download the fonts from <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip">GitHub</a>.</li>
        <li>Unzip and copy files into a Vault folder (default: <code>Excalidraw/${CJK_FONTS}</code>; folder names are cAse-senSITive).</li>
        <li><mark>DO NOT</mark> set this folder to the Vault root or mix with other local fonts.</li>
      </ol>
      <h3>For Obsidian Sync Users:</h3>
      <p>
        Ensure Obsidian Sync is set to synchronize "All other file types" or download and unzip the file on all devices.
      </p>
      <h3>Note:</h3>
      <p>
        If you find this process cumbersome, please submit a feature request to Obsidian.md for supporting assets in the plugin folder. 
        Currently, only a single <code>main.js</code> is supported, which leads to large files and slow startup times for complex plugins like Excalidraw. 
        I apologize for the inconvenience.
      </p>
    `,

  //ObsidianMenu.tsx
  GOTO_FULLSCREEN: "Goto fullscreen mode",
  EXIT_FULLSCREEN: "Exit fullscreen mode",
  TOGGLE_FULLSCREEN: "Toggle fullscreen mode",
  TOGGLE_DISABLEBINDING: "Toggle to invert default binding behavior",
  TOGGLE_FRAME_RENDERING: "Toggle frame rendering",
  TOGGLE_FRAME_CLIPPING: "Toggle frame clipping",
  OPEN_LINK_CLICK: "Open Link",
  OPEN_LINK_PROPS: "Open the image-link or LaTeX-formula editor",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "Narrow to heading...",
  PIN_VIEW: "Pin view",
  DO_NOT_PIN_VIEW: "Do not pin view",
  NARROW_TO_BLOCK: "Narrow to block...",
  SHOW_ENTIRE_FILE: "Show entire file",
  SELECT_SECTION: "Select section from document",
  SELECT_VIEW: "Select view from base",
  ZOOM_TO_FIT: "Zoom to fit",
  RELOAD: "Reload original link",
  OPEN_IN_BROWSER: "Open current link in browser",
  PROPERTIES: "Properties",
  COPYCODE: "Copy source to clipboard",

  //EmbeddableSettings.tsx
  ES_TITLE: "Embeddable Element Settings",
  ES_RENAME: "Rename File",
  ES_ZOOM: "Embedded Content Scaling",
  ES_YOUTUBE_START: "YouTube Start Time",
  ES_YOUTUBE_START_DESC: "ss, mm:ss, hh:mm:ss",
  ES_YOUTUBE_START_INVALID: "The YouTube Start Time is invalid. Please check the format and try again",
  ES_FILENAME_VISIBLE: "Filename Visible",
  ES_BACKGROUND_HEAD: "Embedded note background color",
  ES_BACKGROUND_DESC_INFO: "Click here for more info on colors",
  ES_BACKGROUND_DESC_DETAIL: "Background color affects only the preview mode of the markdown embeddable. When editing, it follows the Obsidian light/dark theme as set for the scene (via document property) or in plugin settings. The background color has two layers: the element background color (lower layer) and a color on top (upper layer). Selecting 'Match Element Background' means both layers follow the element color. Selecting 'Match Canvas' or a specific background color keeps the element background layer. Setting opacity (e.g., 50%) mixes the canvas or selected color with the element background color. To remove the element background layer, set the element color to transparent in Excalidraw's element properties editor. This makes only the upper layer effective.",
  ES_BACKGROUND_MATCH_ELEMENT: "Match Element Background Color",
  ES_BACKGROUND_MATCH_CANVAS: "Match Canvas Background Color",
  ES_BACKGROUND_COLOR: "Background Color",
  ES_BORDER_HEAD: "Embedded note border color",
  ES_BORDER_COLOR: "Border Color",
  ES_BORDER_MATCH_ELEMENT: "Match Element Border Color",
  ES_BACKGROUND_OPACITY: "Background Opacity",
  ES_BORDER_OPACITY: "Border Opacity",
  ES_EMBEDDABLE_SETTINGS: "Embeddable Markdown Settings",
  ES_USE_OBSIDIAN_DEFAULTS: "Use Obsidian Defaults",
  ES_ZOOM_100_RELATIVE_DESC: "The button will adjust the element scale so it will show the content at 100% relative to the current zoom level of your canvas",
  ES_ZOOM_100: "Relative 100%",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "File does not exist. Do you want to create it?",
  PROMPT_ERROR_NO_FILENAME: "Error: Filename for new file may not be empty",
  PROMPT_ERROR_DRAWING_CLOSED: "Unknown error. It seems as if your drawing was closed or the drawing file is missing",
  PROMPT_TITLE_NEW_FILE: "New File",
  PROMPT_TITLE_CONFIRMATION: "Confirmation",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "Create EX",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA: "Create Excalidraw drawing and open in new tab",
  PROMPT_BUTTON_CREATE_MARKDOWN: "Create MD",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA: "Create markdown document and open in new tab",
  PROMPT_BUTTON_EMBED_MARKDOWN: "Embed MD",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA: "Replace selected element with embedded markdown document",
  PROMPT_BUTTON_NEVERMIND: "Nevermind",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "Cancel",
  PROMPT_BUTTON_INSERT_LINE: "Insert new line",
  PROMPT_BUTTON_INSERT_SPACE: "Insert space",
  PROMPT_BUTTON_INSERT_LINK: "Insert markdown link to file",
  PROMPT_BUTTON_UPPERCASE: "Uppercase",
  PROMPT_BUTTON_SPECIAL_CHARS: "Special Characters",
  PROMPT_SELECT_TEMPLATE: "Select a template",

  //ModifierKeySettings
  WEB_BROWSER_DRAG_ACTION: "Web Browser Drag Action",
  LOCAL_FILE_DRAG_ACTION: "OS Local File Drag Action",
  INTERNAL_DRAG_ACTION: "Obsidian Internal Drag Action",
  PANE_TARGET: "Link click behavior",
  DEFAULT_ACTION_DESC: "In case none of the combinations apply the default action for this group is: ",

  //FrameSettings.ts
  FRAME_SETTINGS_TITLE: "Frame Settings",
  FRAME_SETTINGS_ENABLE: "Enable Frames",
  FRAME_SETTIGNS_NAME: "Display Frame Name",
  FRAME_SETTINGS_OUTLINE: "Display Frame Outline",
  FRAME_SETTINGS_CLIP: "Enable Frame Clipping",

  //InsertPDFModal.ts
  IPM_PAGES_TO_IMPORT_NAME: "Pages to import",
  IPM_SELECT_PAGES_TO_IMPORT: "Please select pages to import",
  IPM_ADD_BORDER_BOX_NAME: "Add border box",
  IPM_ADD_FRAME_NAME: "Add page to frame",
  IPM_ADD_FRAME_DESC: "For easier handling I recommend to lock the page inside the frame. " +
    "If, however, you do lock the page inside the frame then the only way to unlock it is to right-click the frame, select remove elements from frame, then unlock the page.",
  IPM_GROUP_PAGES_NAME: "Group pages",
  IPM_GROUP_PAGES_DESC: "This will group all pages into a single group. This is recommended if you are locking the pages after import, because the group will be easier to unlock later rather than unlocking one by one.",
  IPM_SELECT_PDF: "Please select a PDF file",

  //Utils.ts
  UPDATE_AVAILABLE: `A newer version of Excalidraw is available in Community Plugins.\n\nYou are using ${PLUGIN_VERSION}.\nThe latest is`,
  SCRIPT_UPDATES_AVAILABLE: `Script updates available - check the script store.\n\n${DEVICE.isDesktop ? `This message is available in console.log (${DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"})\n\n` : ""}If you have organized scripts into subfolders under the script store folder and have multiple copies of the same script, you may need to clean up unused versions to clear this alert. For private copies of scripts that should not be updated, store them outside the script store folder.`,
  ERROR_PNG_TOO_LARGE: "Error exporting PNG - PNG too large, try a smaller resolution",

  //modifierkeyHelper.ts
  // WebBrowserDragAction
  WEB_DRAG_IMPORT_IMAGE: "Import Image to Vault",
  WEB_DRAG_IMAGE_URL: "Insert Image or YouTube Thumbnail with URL",
  WEB_DRAG_LINK: "Insert Link", 
  WEB_DRAG_EMBEDDABLE: "Insert Interactive-Frame",

  // LocalFileDragAction
  LOCAL_DRAG_IMPORT: "Import external file or reuse existing file if path is from the Vault",
  LOCAL_DRAG_IMAGE: "Insert Image: with local URI or internal-link if from Vault",
  LOCAL_DRAG_LINK: "Insert Link: local URI or internal-link if from Vault",
  LOCAL_DRAG_EMBEDDABLE: "Insert Interactive-Frame: local URI or internal-link if from Vault",

  // InternalDragAction  
  INTERNAL_DRAG_IMAGE: "Insert Image",
  INTERNAL_DRAG_IMAGE_FULL: "Insert Image @100%",
  INTERNAL_DRAG_LINK: "Insert Link",
  INTERNAL_DRAG_EMBEDDABLE: "Insert Interactive-Frame",

  // LinkClickAction
  LINK_CLICK_ACTIVE: "Open in current active window",
  LINK_CLICK_NEW_PANE: "Open in a new adjacent window",
  LINK_CLICK_POPOUT: "Open in a popout window",
  LINK_CLICK_NEW_TAB: "Open in a new tab",
  LINK_CLICK_MD_PROPS: "Show the Markdown image-properties dialog (only relevant if you have embedded a markdown document as an image)",

  //ExportDialog
  // Dialog and tabs
  EXPORTDIALOG_TITLE: "Export Drawing",
  EXPORTDIALOG_TAB_IMAGE: "Image",
  EXPORTDIALOG_TAB_PDF: "PDF",
  // Settings persistence
  EXPORTDIALOG_SAVE_SETTINGS: "Save image settings to file doc.properties?",
  EXPORTDIALOG_SAVE_SETTINGS_SAVE: "Save as preset",
  EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "One-time use",
  // Image settings
  EXPORTDIALOG_IMAGE_SETTINGS: "Image",
  EXPORTDIALOG_IMAGE_DESC: "PNG supports transparency. External files can include Excalidraw scene data.",
  EXPORTDIALOG_PADDING: "Padding",
  EXPORTDIALOG_SCALE: "Scale",
  EXPORTDIALOG_CURRENT_PADDING: "Current padding:",
  EXPORTDIALOG_SIZE_DESC: "Scale affects output size",
  EXPORTDIALOG_SCALE_VALUE: "Scale:",
  EXPORTDIALOG_IMAGE_SIZE: "Size:",
  // Theme and background
  EXPORTDIALOG_EXPORT_THEME: "Theme",
  EXPORTDIALOG_THEME_LIGHT: "Light",
  EXPORTDIALOG_THEME_DARK: "Dark",
  EXPORTDIALOG_BACKGROUND: "Background",
  EXPORTDIALOG_BACKGROUND_TRANSPARENT: "Transparent",
  EXPORTDIALOG_BACKGROUND_USE_COLOR: "Use scene color",
  // Selection
  EXPORTDIALOG_SELECTED_ELEMENTS: "Export",
  EXPORTDIALOG_SELECTED_ALL: "Entire scene",
  EXPORTDIALOG_SELECTED_SELECTED: "Selection only",
  // Export options
  EXPORTDIALOG_EMBED_SCENE: "Include scene data?",
  EXPORTDIALOG_EMBED_YES: "Yes",
  EXPORTDIALOG_EMBED_NO: "No",
  // PDF settings
  EXPORTDIALOG_PDF_SETTINGS: "PDF",
  EXPORTDIALOG_PAGE_SIZE: "Size",
  EXPORTDIALOG_PAGE_ORIENTATION: "Orientation",
  EXPORTDIALOG_ORIENTATION_PORTRAIT: "Portrait",
  EXPORTDIALOG_ORIENTATION_LANDSCAPE: "Landscape",
  EXPORTDIALOG_PDF_FIT_TO_PAGE: "Page Fitting",
  EXPORTDIALOG_PDF_FIT_OPTION: "Fit to page",
  EXPORTDIALOG_PDF_FIT_2_OPTION: "Fit to max 2-pages",
  EXPORTDIALOG_PDF_FIT_4_OPTION: "Fit to max 4-pages",
  EXPORTDIALOG_PDF_FIT_6_OPTION: "Fit to max 6-pages",
  EXPORTDIALOG_PDF_FIT_8_OPTION: "Fit to max 8-pages",
  EXPORTDIALOG_PDF_FIT_12_OPTION: "Fit to max 12-pages",
  EXPORTDIALOG_PDF_FIT_16_OPTION: "Fit to max 16-pages",
  EXPORTDIALOG_PDF_SCALE_OPTION: "Use image scale (may span multiple pages)",
  EXPORTDIALOG_PDF_PAPER_COLOR: "Paper Color",
  EXPORTDIALOG_PDF_PAPER_WHITE: "White",
  EXPORTDIALOG_PDF_PAPER_SCENE: "Use scene color",
  EXPORTDIALOG_PDF_PAPER_CUSTOM: "Custom color",
  EXPORTDIALOG_PDF_ALIGNMENT: "Position on Page",
  EXPORTDIALOG_PDF_ALIGN_CENTER: "Center",
  EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "Center Left",
  EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "Center Right",
  EXPORTDIALOG_PDF_ALIGN_TOP_LEFT: "Top Left",
  EXPORTDIALOG_PDF_ALIGN_TOP_CENTER: "Top Center", 
  EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT: "Top Right",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT: "Bottom Left",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER: "Bottom Center",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT: "Bottom Right",
  EXPORTDIALOG_PDF_MARGIN: "Margin",
  EXPORTDIALOG_PDF_MARGIN_NONE: "None",
  EXPORTDIALOG_PDF_MARGIN_TINY: "Small",
  EXPORTDIALOG_PDF_MARGIN_NORMAL: "Normal",
  EXPORTDIALOG_SAVE_PDF_SETTINGS: "Save PDF settings",
  EXPORTDIALOG_SAVE_CONFIRMATION: "PDF config saved to plugin settings as default",
  // Buttons
  EXPORTDIALOG_PNGTOFILE : "Export PNG",
  EXPORTDIALOG_SVGTOFILE : "Export SVG",
  EXPORTDIALOG_PNGTOVAULT : "PNG to Vault",
  EXPORTDIALOG_SVGTOVAULT : "SVG to Vault",
  EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
  EXPORTDIALOG_PNGTOCLIPBOARD : "PNG to Clipboard",
  EXPORTDIALOG_SVGTOCLIPBOARD : "SVG to Clipboard",
  EXPORTDIALOG_PDF: "Export PDF",

  EXPORTDIALOG_PDF_PROGRESS_NOTICE: "Exporting PDF. If this image is large, it may take a while.",
  EXPORTDIALOG_PDF_PROGRESS_DONE: "Export complete",
  EXPORTDIALOG_PDF_PROGRESS_ERROR: "Error exporting PDF, check developer console for details",

  // Screenshot tab
  EXPORTDIALOG_NOT_AVAILALBE: "Sorry, this feature is only available when the drawing is open in the main Obsidian workspace.",
  EXPORTDIALOG_TAB_SCREENSHOT: "Screenshot",
  EXPORTDIALOG_SCREENSHOT_DESC: "Screenshots will include embeddables such as markdown pages, YouTube, websites, etc. They are only available on desktop, cannot be automatically exported, and only support PNG format.",
  SCREENSHOT_DESKTOP_ONLY: "Screenshot feature is only available on desktop",
  SCREENSHOT_FILE_SUCCESS: "Screenshot saved to vault",
  SCREENSHOT_CLIPBOARD_SUCCESS: "Screenshot copied to clipboard",
  SCREENSHOT_CLIPBOARD_ERROR: "Failed to copy screenshot to clipboard: ",
  SCREENSHOT_ERROR: "Error capturing screenshot - see console log",

  //exportUtils.ts
  PDF_EXPORT_DESKTOP_ONLY: "PDF export is only available on desktop",

  //UniversalInsertFileModal.ts
  UIFM_TITLE: "Insert File From Vault",
  UIFM_SECTION_HEAD: "Select section heading",
  UIFM_ANCHOR: "Anchor to 100% of original size",
  UIFM_ANCHOR_DESC: "This is a pro feature, use it only if you understand how it works. If enabled even if you change the size of the imported image in Excalidraw, the next time you open the drawing this image will pop back to 100% size. This is useful when embedding an atomic Excalidraw idea into another note and preserving relative sizing of text and icons.",
  UIFM_BTN_EMBEDDABLE: "as Embeddable",
  UIFM_BTN_PDF: "as Pdf",
  UIFM_BTN_IMAGE: "as Image",

  //ReleaseNotes.ts
  RN_WELCOME: "Welcome to Excalidraw",

  //Excalidraw component
  COMP_IMG: "Image & Files",
  COMP_IMG_FROM_SYSTEM: "Import from system",
  COMP_IMG_ANY_FILE: "ANY file from Vault",
  COMP_IMG_LaTeX: "LaTeX formula",
  COMP_FRAME: "Frame Actions",
  COMP_FRAME_HINT: "Toggle Marker Frame. Guide-only frames to define slides/print areas/image references. " +
      "Hidden in image exports; doesn't contain elements. Hide/show frames via canvas context menu.",

  //CustomEmbeddable.tsx
  NOTICE_PDF_THEME: "PDF theme overridden.\n" +
    "Control via this file's 'excalidraw-embeddable-theme' document property (overrides plugin).\n\n" +
    "Values: dark, light, auto=Excalidraw, default=Obsidian.",

  //EmbeddableActionsMenu.tsx
  BOOKMARK_PAGE: "Save current position in document",
  CAPTURE_PAGE: "Capture current page as image",

  //VersionMismatch.ts
  //WARNING: Do not change the {VAL_RECORDED} and {VAL_ACTUAL} strings, they are replaced by the actual version values at runtime!
  VERSION_MISMATCH_NOTICE: `The version recorded by Obsidian is <b>{VAL_RECORDED}</b>, but the installed Excalidraw code is <b>{VAL_ACTUAL}</b>.`,
  
  VERSION_MISMATCH_HEADING: "Excalidraw version mismatch",
  VERSION_MISMATCH_CAUSE: "This usually happens after a partial sync (e.g. Obsidian Sync Standard) where large files (main.js > 5MB) did not sync, so only <code>manifest.json</code> updated.",
  VERSION_MISMATCH_OPTIONS: "Options:<br><b>1.</b> Re-download the plugin (recommended).<br><b>2.</b> Ignore for now.",
  VERSION_MISMATCH_NOTE: "Note: Updating version info manually may affect tools that read manifest.json directly (e.g. Plugin Update Tracker, BRAT) until a full reinstall.",
  VERSION_MISMATCH_DISABLE_NAME: "Disable future mismatch warnings",
  VERSION_MISMATCH_DISABLE_DESC: "You can re-enable this under: Settings → Excalidraw → Basic → Warn about incomplete plugin updates.",
  VERSION_MISMATCH_REDOWNLOAD: "Re-download plugin",
  VERSION_MISMATCH_IGNORE: "Ignore",
};
