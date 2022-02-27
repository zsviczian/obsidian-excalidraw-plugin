import {
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_URL_PREFIX,
} from "src/Constants";

// 简体中文
export default {
  // main.ts
  INSTALL_SCRIPT: "安装此脚本",
  UPDATE_SCRIPT: "发现可用更新 - 点击安装",
  CHECKING_SCRIPT: "检查更新 - 点击重新安装",
  UNABLETOCHECK_SCRIPT: "检查更新失败 - 点击重新安装",
  UPTODATE_SCRIPT: "已安装最新脚本 - 点击重新安装",
  OPEN_AS_EXCALIDRAW: "打开为 Excalidraw 绘图",
  TOGGLE_MODE: "在 Excalidraw 和 Markdown 模式之间切换",
  CONVERT_NOTE_TO_EXCALIDRAW: "转换空白笔记为 Excalidraw 绘图",
  CONVERT_EXCALIDRAW: "转换 *.excalidraw 为 *.md 文件",
  CREATE_NEW: "新建 Excalidraw 绘图",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw 格式 => *.excalidraw.md 格式",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw 格式 => *.md (兼容 Logseq) 格式",
  DOWNLOAD_LIBRARY: "导出 stencil 库为 *.excalidrawlib 文件",
  OPEN_EXISTING_NEW_PANE: "在新面板中打开已有的绘图",
  OPEN_EXISTING_ACTIVE_PANE: "在当前面板中打开已有的绘图",
  TRANSCLUDE: "嵌入绘图到该文档",
  TRANSCLUDE_MOST_RECENT: "嵌入最近编辑的绘图到该文档",
  NEW_IN_NEW_PANE: "在新面板中新建绘图",
  NEW_IN_ACTIVE_PANE: "在当前面板中新建绘图",
  NEW_IN_NEW_PANE_EMBED: "在新面板中新建绘图，并嵌入到当前文档",
  NEW_IN_ACTIVE_PANE_EMBED: "在当前面板中新建绘图，并嵌入到当前文档",
  EXPORT_SVG: "导出 SVG 文件到当前目录",
  EXPORT_PNG: "导出 PNG 文件到当前目录",
  TOGGLE_LOCK: "切换文本元素的原文/预览模式",
  DELETE_FILE: "从 Obsidian 库文件夹中删除所选图像或 Markdown 文件",
  INSERT_LINK: "插入链接到该绘图",
  INSERT_IMAGE: "插入库文件夹里的图像到该绘图",
  INSERT_MD: "将库文件夹里的 Markdown 文件以图像形式嵌入到该绘图",
  INSERT_LATEX: "插入 LaTeX 公式到该绘图",
  ENTER_LATEX:
    "输入 LaTeX 表达式（示例： \\binom{n}{k} = \\frac{n!}{k!(n-k)!} ）",

  //ExcalidrawView.ts
  INSTALL_SCRIPT_BUTTON: "安装或更新 Excalidraw 自动化脚本",
  OPEN_AS_MD: "打开为 Markdown 文件",
  SAVE_AS_PNG: "导出 PNG 到当前目录（按住 CTRL/CMD 指定导出位置）",
  SAVE_AS_SVG: "导出 SVG 到当前目录（按住 CTRL/CMD 指定导出位置）",
  OPEN_LINK:
    "将所选文本作为链接打开 \n（按住 SHIFT 并点击此命令可在新面板打开）",
  EXPORT_EXCALIDRAW: "导出为 .Excalidraw 文件",
  LINK_BUTTON_CLICK_NO_TEXT:
    "请选择一个含有内部链接或外部链接的图形或文本元素。\n" +
    "按住 SHIFT 并点击此按钮可在新面板中打开链接。\n" +
    "也可以在画布中按住 CTRL/CMD 并点击图形或文本元素！",
  TEXT_ELEMENT_EMPTY:
    "未选中图形或文本元素，或者元素不包含有效的链接（[[链接|缩写]] 或 [缩写](链接)）",
  FILENAME_INVALID_CHARS: '文件名不能含有以下符号： * " \\  < > : | ?',
  FILE_DOES_NOT_EXIST:
    "文件不存在。按住 ALT（或 ALT + SHIFT）并点击链接来创建新文件。",
  FORCE_SAVE: "强制保存并更新相邻面板。\n（注意：自动保存功能始终是开启的）",
  RAW: "含链接的文本元素正以原文模式显示。\n点击切换到预览模式",
  PARSED: "含链接的文本元素正以预览模式显示。\n点击切换到原文模式",
  NOFILE: "Excalidraw（没有文件）",
  COMPATIBILITY_MODE:
    "*.excalidraw 文件以兼容模式打开。转换为新格式以获得完整的插件功能。",
  CONVERT_FILE: "转换为新格式",

  //settings.ts
  FOLDER_NAME: "Excalidraw 文件夹",
  FOLDER_DESC: "新绘图的默认位置。如果此处为空，将在库的根目录中创建绘图。",
  TEMPLATE_NAME: "Excalidraw 模板文件",
  TEMPLATE_DESC:
    "Excalidraw 模板文件的完整路径。" +
    "示例：如果您的模板在默认的 Excalidraw 文件夹中且文件名是" +
    "Template.md，则此项应设为 Excalidraw/Template.md。" +
    "如果您在兼容模式下使用 Excalidraw，那么您的模板也必须是旧格式的 excalidraw 文件，" +
    "例如 Excalidraw/Template.excalidraw。",
  SCRIPT_FOLDER_NAME: "Excalidraw 自动化脚本的文件夹",
  SCRIPT_FOLDER_DESC:
    "此文件夹用于存放 Excalidraw 自动化脚本。" +
    "您可以在 Obsidian 命令面板中执行这些脚本。" +
    "您可以为喜欢的脚本分配快捷键，就像为其他 Obsidian 命令分配快捷键一样。" +
    "该项不能设为库的根目录。",
  AUTOSAVE_NAME: "自动保存",
  AUTOSAVE_DESC:
    "每 30 秒自动保存编辑中的绘图。这个功能主要是为了防止在手机端（安卓）上的“滑动切换应用”操作可能" +
    "导致的数据丢失，因为我无法在手机应用被终止时及时保存绘图。桌面端用户一般不需要开启此功能，因为" +
    "在桌面端，只要关闭 Excalidraw 或 Obsidian，或者移动焦点到其他面板，就会自动触发一次保存，开启" +
    "此功能反而可能会干扰绘图流程。",
  FILENAME_HEAD: "文件名",
  FILENAME_DESC:
    "<p>自动生成的文件名由前缀和日期两部分组成。" +
    "例如 'Drawing 2021-05-24 12.58.07'。</p>" +
    "<p>可参考<a href='https://momentjs.com/docs/#/displaying/format/'>" +
    "日期和时间格式说明</a>来进行修改。</p>",
  FILENAME_SAMPLE: "当前文件名的格式为：<b>",
  FILENAME_PREFIX_NAME: "文件名前缀",
  FILENAME_PREFIX_DESC: "文件名的第一部分",
  FILENAME_DATE_NAME: "文件名日期",
  FILENAME_DATE_DESC: "文件名的第二部分",
  /*SVG_IN_MD_NAME: "SVG Snapshot to markdown file",
  SVG_IN_MD_DESC: "If the switch is 'on' Excalidraw will include an SVG snapshot in the markdown file. "+
                  "When SVG snapshots are saved to the Excalidraw.md file, drawings that include large png, jpg, gif images may take extreme long time to open in markdown view. " +
                  "On the other hand, SVG snapshots provide some level of platform independence and longevity to your drawings. Even if Excalidraw will no longer exist, the snapshot " +
                  "can be opened with an app that reads SVGs. In addition hover previews will be less resource intensive if SVG snapshots are enabled.",*/
  DISPLAY_HEAD: "显示",
  MATCH_THEME_NAME: "使新建的绘图匹配 Obsidian 主题",
  MATCH_THEME_DESC:
    "如果 Obsidian 使用黑暗主题，新建的绘图文件也将使用黑暗主题。" +
    "但如果设置了模板，新建的绘图文件将跟随模板主题。此功能不会作用于已有的绘图。",
  MATCH_THEME_ALWAYS_NAME: "使已有的绘图匹配 Obsidian 主题",
  MATCH_THEME_ALWAYS_DESC:
    "如果 Obsidian 使用黑暗主题，则绘图文件也将以黑暗主题打开；反之亦然。",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw 主题跟随 Obsidian 主题变化",
  MATCH_THEME_TRIGGER_DESC:
    "开启此项，则更改 Obsidian 的黑暗/明亮主题时，当前打开的 Excalidraw 面板的主题会随之改变。",
  DEFAULT_OPEN_MODE_NAME: "Excalidraw 的默认运行模式",
  DEFAULT_OPEN_MODE_DESC:
    "设置 Excalidraw 的运行模式：普通模式，真模式，或者阅读模式。你也可以为某个文件单独设置此项，" +
    "方法是在其 Frontmatter 中添加名为 excalidraw-default-mode 的键，其值为：normal, zen 或者 view。",
  ZOOM_TO_FIT_NAME: "自动缩放以适应视图调整",
  ZOOM_TO_FIT_DESC: "调整面板大小时，自适应地缩放画布",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "自动缩放的最大级别",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "自动缩放画布时，允许放大的最高级别。该项不能低于 0.5（50%），不能超过 10（1000%）。",
  LINKS_HEAD: "链接 & 嵌入到绘图中的文档",
  LINKS_DESC:
    "按住 CTRL/CMD 并点击包含 [[链接]] 的文本元素来打开链接。" +
    "如果所选文本元素包含多个 [[链接]] ，只会打开第一个链接。" +
    "如果所选文本元素包含 URL 链接 (如 https:// or http://)，" +
    "插件会在浏览器中打开超链接。" +
    "链接的源文件被重命名时，绘图中相应的 [[链接]] 也会同步更新。" +
    "若你不愿绘图中的链接文本因此而变化，可用 [[链接|别名]] 来替代。",
  ADJACENT_PANE_NAME: "在相邻面板中打开",
  ADJACENT_PANE_DESC:
    "按住 CTRL/CMD + SHIFT 并点击链接时，插件默认会在新面板中打开该链接。" +
    "若开启此项，Excalidraw 会先尝试寻找已有的相邻面板（按照右侧、左侧、上方、下方的顺序），" +
    "并在其中打开链接。如果找不到，" +
    "再在新面板中打开链接。",
  LINK_BRACKETS_NAME: "在链接两侧显示 [[中括号]]",
  LINK_BRACKETS_DESC: `${
    "预览模式下，渲染文本元素时，在链接两侧显示中括号。" +
    "您可以在绘图文件的 Frontmatter 中加入 '"
  }${FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS}: true/false' 来为其单独设置此项。`,
  LINK_PREFIX_NAME: "链接前缀",
  LINK_PREFIX_DESC: `${
    "预览模式下，如果文本元素包含链接，则添加这些字符作为前缀。" +
    "您可以在绘图文件的 Frontmatter 中加入 '"
  }${FRONTMATTER_KEY_CUSTOM_PREFIX}: "📍 "' 来为其单独设置此项。`,
  URL_PREFIX_NAME: "URL 前缀",
  URL_PREFIX_DESC: `${
    "预览模式下，如果文本元素包含 URL 链接，则为其添加这些字符作为前缀。" +
    "您可以在绘图文件的 Frontmatter 中加入 '"
  }${FRONTMATTER_KEY_CUSTOM_URL_PREFIX}: "🌐 "' 来为其单独设置此项。`,
  LINK_CTRL_CLICK_NAME:
    "按住 CTRL/CMD 并点击含有 [[链接]] 或 [ ](链接) 的文本来打开链接",
  LINK_CTRL_CLICK_DESC:
    "如果此功能影响到您使用某些原版 Excalidraw 功能，可将其关闭。" +
    "关闭后，您只能通过绘图面板标题栏中的链接按钮来打开链接。",
  TRANSCLUSION_WRAP_NAME: "嵌入到绘图中的文档的折行方式",
  TRANSCLUSION_WRAP_DESC:
    "中的 number 表示嵌入的文本溢出时，在第几个字符处进行折行。" +
    "此开关控制具体的折行方式。若开启，则严格在 number 处折行，禁止溢出；" +
    "若关闭，则允许在 number 位置后最近的空格处折行。",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "嵌入到绘图中的文档的最大显示字符数",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "以 ![[Markdown文档]] 的形式将文档嵌入到绘图中时，" +
    "该文档在绘图中可显示的最大字符数量。",
  GET_URL_TITLE_NAME: "使用 iframly 获取页面标题",
  GET_URL_TITLE_DESC:
    "拖放链接到 Excalidraw 时，使用 http://iframely.server.crestify.com/iframely?url= 来获取页面的标题",
  MD_HEAD: "以图像形式嵌入到绘图中的 Markdown 文档",
  MD_HEAD_DESC:
    "你可以将 Markdown 文档以图像的形式嵌入到绘图中，" +
    "方法是按住 CTRL/CMD 并从文件管理器中把文档拖入绘图，或者使用命令面板。",
  MD_TRANSCLUDE_WIDTH_NAME: "以图像形式嵌入到绘图中的 Markdown 文档的默认宽度",
  MD_TRANSCLUDE_WIDTH_DESC:
    "以图像形式嵌入到绘图中的 Markdown 文档的宽度。该选项会影响到折行，以及生成的图像元素的宽度。" +
    "您可以将绘图打开为 Markdown 文件，用 [[文档名#标题|宽度x最大高度]] 的形式，" +
    "来单独为该嵌入的文档设定此项。",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "以图像形式嵌入到绘图中的 Markdown 文档的默认最大高度",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "以图像形式嵌入到绘图中的 Markdown 文档产生的图像高度取决于文档内容的多少，但最大不会超过该值。" +
    "您可以将绘图打开为 Markdown 文件，用 [[文档名#^块引ID|宽度x最大高度]] 的形式，来单独为该嵌入的文档设定此项。",
  MD_DEFAULT_FONT_NAME: "以图像形式嵌入到绘图中的 Markdown 文档的默认字体",
  MD_DEFAULT_FONT_DESC:
    "可以设为 Virgil，Casadia 或其他 .ttf/.woff/.woff2 字体文件（如 MyFont.woff2）。" +
    '您可以在该 Markdown 文档的 Frontmatter 中添加形如 "excalidraw-font: 字体或文件名" 的键值对，来为其单独设定此项。',
  MD_DEFAULT_COLOR_NAME: "以图像形式嵌入到绘图中的 Markdown 文档的默认文本颜色",
  MD_DEFAULT_COLOR_DESC:
    "设为 css 颜色名，如 steelblue（参考 https://www.w3schools.com/colors/colors_names.asp），或者有效的 16 进制颜色值，例如 #e67700。</p>" +
    '您可以在该 Markdown 文档的 Frontmatter 中添加形如 "excalidraw-font-color: 颜色名或颜色值" 的键值对，来为其单独设定此项。',
  MD_CSS_NAME: "CSS 文件",
  MD_CSS_DESC:
    "以图像形式嵌入 Markdown 文档到绘图中时所使用的 CSS 文件名。需包含扩展名，例如 md-embed.css。" +
    "也可以使用 Markdown 文件（如 md-embed-css.md），但其内容应符合 CSS 语法。" +
    "如果您要查询 CSS 所作用的 HTML 节点，请在 Obsidian 开发者控制台（CTRL+SHIFT+i）中键入命令：" +
    '"ExcalidrawAutomate.mostRecentMarkdownSVG" —— 这将显示 Excalidraw 最近生成的 SVG。' +
    "此外，在 CSS 中不能任意地设置字体，您一般只能使用系统默认的标准字体（详见 README），" +
    "但可以通过前面的设置来额外添加一个自定义字体。" +
    '您可以在该 Markdown 文档的 Frontmatter 中添加形如 "excalidraw-css: 库中的CSS文件或CSS片段" 的键值对，来为其单独设定此项。',
  EMBED_HEAD: "嵌入到文档中的绘图 & 导出",
  EMBED_PREVIEW_SVG_NAME: "预览图采用 SVG 格式",
  EMBED_PREVIEW_SVG_DESC:
    "默认情况下 Obsidian 的 Markdown 阅读视图会将嵌入到文档中的绘图显示为 SVG 格式的预览图。关闭此项，则显示为 PNG 格式。",
  PREVIEW_MATCH_OBSIDIAN_NAME: "预览图匹配 Obsidian 主题",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "开启此项，则当 Obsidian 处于黑暗模式时，嵌入到文档中的绘图的预览图也会以黑暗模式渲染；" +
    "当 Obsidian 处于明亮模式时，嵌入到文档中的绘图的预览图也会以明亮模式渲染。您可能还需要关闭“导出的图像包含背景”开关，来获得与 Obsidian 更加协调的观感。",
  EMBED_WIDTH_NAME: "预览图的默认宽度",
  EMBED_WIDTH_DESC:
    "嵌入到文档中的绘图的预览图的默认宽度。此项仅作用于嵌入到文档中的 excalidraw 绘图，不影响嵌入到文档中的其他图像。" +
    "您可以用 ![[drawing.excalidraw|100]] 或 [[drawing.excalidraw|100x100]]" +
    "的形式来为某幅绘图的单独设定预览图宽度。",
  EMBED_TYPE_NAME: "绘图嵌入到文档时的类型",
  EMBED_TYPE_DESC:
    "通过命令面板嵌入绘图时，要嵌入原始的绘图文件，还是嵌入 PNG 或 SVG 副本。" +
    "你需要开启下方的“自动导出 PNG/SVG”等开关，才能在该下拉框中选择 PNG 或 SVG 副本。" +
    "如果绘图文件缺少对应的 PNG 或 SVG 副本，命令面板将会插入一条损坏的链接，这时你需要打开原始绘图并手动导出副本 —— " +
    "该选项不会自动生成 PNG/SVG 副本，只会引用已经存在的 PNG/SVG 副本。",
  EXPORT_PNG_SCALE_NAME: "PNG 导出图像比例",
  EXPORT_PNG_SCALE_DESC: "导出的 PNG 图像的大小比例",
  EXPORT_BACKGROUND_NAME: "导出的图像包含背景",
  EXPORT_BACKGROUND_DESC: "如果关闭，将导出透明背景的图像。",
  EXPORT_THEME_NAME: "导出的图像包含主题",
  EXPORT_THEME_DESC:
    "导出与绘图的黑暗/明亮主题匹配的图像。" +
    "如果关闭，在黑暗主题下导出的图像将和明亮主题一样。",
  EXPORT_HEAD: "导出设置",
  EXPORT_SYNC_NAME: "保持 .SVG 和 .PNG 文件名与绘图文件同步",
  EXPORT_SYNC_DESC:
    "打开后，当绘图文件被重命名时，插件将同步更新同文件夹下的同名 .SVG 和 .PNG 文件。" +
    "当绘图文件被删除时，插件将自动删除同文件夹下的同名 .SVG 和 .PNG 文件。",
  EXPORT_SVG_NAME: "自动导出 SVG",
  EXPORT_SVG_DESC:
    "自动导出和绘图文件同名的 SVG 文件。" +
    "插件会将 SVG 文件保存到绘图文件所在的文件夹中。" +
    "在文档中嵌入这个 SVG 文件，相比直接嵌入绘图文件，具有更强的跨平台能力。" +
    "此开关开启时，每次您编辑 excalidraw 绘图，相应的 SVG 文件都会同步更新。",
  EXPORT_PNG_NAME: "自动导出 PNG",
  EXPORT_PNG_DESC: "类似于自动导出 SVG，但导出格式为 *.PNG",
  COMPATIBILITY_HEAD: "兼容特性",
  EXPORT_EXCALIDRAW_NAME: "自动导出 Excalidraw 文件",
  EXPORT_EXCALIDRAW_DESC: "类似于自动导出 SVG，但导出格式为 *.Excalidraw",
  SYNC_EXCALIDRAW_NAME: "同步同一绘图的两种格式",
  SYNC_EXCALIDRAW_DESC:
    "如果 *.excalidraw 格式文件的修改日期比 *.md 格式文件更新，" +
    "则根据 .excalidraw 文件来更新 .md 文件中的绘图",
  COMPATIBILITY_MODE_NAME: "以旧格式创建新绘图",
  COMPATIBILITY_MODE_DESC:
    "开启此功能后，您通过功能区按钮、命令面板、" +
    "文件浏览器等创建的绘图都将是旧的 *.excalidraw 格式。此外，" +
    "当您打开旧格式绘图文件时将不再收到提醒消息。",
  EXPERIMENTAL_HEAD: "实验性功能",
  EXPERIMENTAL_DESC:
    "这些设置不会立即生效，需要刷新文件资源管理器或者重新启动 Obsidian 才会生效。",
  FILETYPE_NAME: "在文件浏览器中为 Excalidraw 绘图文件添加类型标识符（如 ✏️）",
  FILETYPE_DESC: "可通过下一项设置来自定义类型标识符。",
  FILETAG_NAME: "设置 Excalidraw 绘图文件的类型标识符",
  FILETAG_DESC: "要显示为类型标识符的 emoji 或文本。",
  INSERT_EMOJI: "插入 emoji",
  LIVEPREVIEW_NAME: "在实时预览编辑模式中，嵌入到文档中的绘图以图像的方式渲染",
  LIVEPREVIEW_DESC:
    "开启此项，则可在实时预览编辑模式中，用形如 ![[绘图|宽度|样式]] 的方式来嵌入绘图。" +
    "该选项不会在已打开的文档中立刻生效 —— " +
    "你需要重新打开此文档来使其生效。",
  ENABLE_FOURTH_FONT_NAME: "为文本元素启用本地字体",
  ENABLE_FOURTH_FONT_DESC:
    "开启此项后，文本元素的属性面板里会多出一个本地字体按钮。" +
    "使用了本地字体的绘图文件，将会失去一部分跨平台能力 —— " +
    "若将绘图文件移动到其他库中打开，显示效果可能会截然不同；" +
    "若在 excalidraw.com 或者其他版本的 Excalidraw 中打开，使用本地字体的文本会变回系统默认字体。",
  FOURTH_FONT_NAME: "本地字体文件",
  FOURTH_FONT_DESC:
    "选择库文件夹中的一个 .ttf, .woff 或 .woff2 字体文件作为本地字体文件。" +
    "若未选择文件，则使用默认的 Virgil 字体。",

  //openDrawings.ts
  SELECT_FILE: "选择一个文件后按回车。",
  NO_MATCH: "无法匹配到你所查询的文件。",
  SELECT_FILE_TO_LINK: "选择要插入链接的文件。",
  SELECT_DRAWING: "选择想要插入的绘图",
  TYPE_FILENAME: "键入要选择的绘图名称。",
  SELECT_FILE_OR_TYPE_NEW: "选择已有绘图，或者新绘图的类型，然后按回车。",
  SELECT_TO_EMBED: "选择要插入到当前文档中的绘图。",
  SELECT_MD: "选择想要插入的 Markdown 文档",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW 警告\n停止加载嵌入的图像，因为此文件中存在死循环：\n",
};
