import {
  DEVICE,
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_URL_PREFIX,
} from "src/constants";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/ModifierkeyHelper";

// 简体中文
export default {
  // main.ts
  INSTALL_SCRIPT: "安装此脚本",
  UPDATE_SCRIPT: "有可用更新 - 点击安装",
  CHECKING_SCRIPT:
    "检查更新中 - 点击重新安装",
  UNABLETOCHECK_SCRIPT:
    "检查更新失败 - 点击重新安装",
  UPTODATE_SCRIPT:
    "脚本已是最新 - 点击重新安装",
  OPEN_AS_EXCALIDRAW: "打开为 Excalidraw 绘图",
  TOGGLE_MODE: "在 Excalidraw 和 Markdown 模式之间切换",
  CONVERT_NOTE_TO_EXCALIDRAW: "转换：空白 Markdown 文档 => Excalidraw 绘图文件",
  CONVERT_EXCALIDRAW: "转换： *.excalidraw => *.md",
  CREATE_NEW: "新建绘图文件",
  CONVERT_FILE_KEEP_EXT: "转换：*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "转换：*.excalidraw => *.md (兼容 Logseq)",
  DOWNLOAD_LIBRARY: "导出 stencil 库为 *.excalidrawlib 文件",
  OPEN_EXISTING_NEW_PANE: "打开已有的绘图 - 于新面板",
  OPEN_EXISTING_ACTIVE_PANE:
    "打开已有的绘图 - 于当前面板",
  TRANSCLUDE: "嵌入绘图（形如 ![[drawing]]）到当前 Markdown 文档中",
  TRANSCLUDE_MOST_RECENT: "嵌入最近编辑过的绘图（形如 ![[drawing]]）到当前 Markdown 文档中",
  TOGGLE_LEFTHANDED_MODE: "切换为左手模式",
  NEW_IN_NEW_PANE: "新建绘图 - 于新面板",
  NEW_IN_NEW_TAB: "新建绘图 - 于新页签",
  NEW_IN_ACTIVE_PANE: "新建绘图 - 于当前面板",
  NEW_IN_POPOUT_WINDOW: "新建绘图 - 于新窗口",
  NEW_IN_NEW_PANE_EMBED:
    "新建绘图 - 于新面板 - 并将其嵌入（形如 ![[drawing]]）到当前 Markdown 文档中",
  NEW_IN_NEW_TAB_EMBED:
    "新建绘图 - 于新页签 - 并将其嵌入（形如 ![[drawing]]）到当前 Markdown 文档中",
  NEW_IN_ACTIVE_PANE_EMBED:
    "新建绘图 - 于当前面板 - 并将其嵌入（形如 ![[drawing]]）到当前 Markdown 文档中",
  NEW_IN_POPOUT_WINDOW_EMBED: "新建绘图 - 于新窗口 - 并将其嵌入（形如 ![[drawing]]）到当前 Markdown 文档中",
  TOGGLE_LOCK: "文本元素：原文模式（RAW）⟺ 预览模式（PREVIEW）",
  DELETE_FILE: "从库中删除所选图像或 MD-Embed 的源文件",
  INSERT_LINK_TO_ELEMENT:
    `复制所选元素为内部链接（形如 [[file#^id]] ）。\n按住 ${labelCTRL()} 可复制元素所在分组为内部链接（形如 [[file#^group=id]] ）。\n按住 ${labelSHIFT()} 可复制所选元素所在区域为内部链接（形如 [[file#^area=id]] ）。\n按住 ${labelALT()} 可观看视频演示。`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "复制所选元素所在分组为内部链接（形如 [[file#^group=id]] ）",
  INSERT_LINK_TO_ELEMENT_AREA:
    "复制所选元素所在区域为内部链接（形如 [[file#^area=id]] ）",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "复制所选框架为内部链接（形如 [[file#^frame=id]] ）",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "复制所选元素为内部链接（形如 [[file#^id]] ）",
  INSERT_LINK_TO_ELEMENT_ERROR: "未选择画布里的单个元素",
  INSERT_LINK_TO_ELEMENT_READY: "链接已生成并复制到剪贴板",
  INSERT_LINK: "插入任意文件（以内部链接形式嵌入，形如 [[drawing]] ）到当前绘图中",
  INSERT_IMAGE: "插入图像或 Excalidraw 绘图（以图像形式嵌入）到当前绘图中",
  IMPORT_SVG: "从 SVG 文件导入图形元素到当前绘图中（暂不支持文本元素）",
  INSERT_MD: "插入 Markdown 文档（以图像形式嵌入）到当前绘图中",
  INSERT_PDF: "插入 PDF 文档（以图像形式嵌入）到当前绘图中",
  UNIVERSAL_ADD_FILE: "插入任意文件（以 Embeddable 形式嵌入）到当前绘图中",
  INSERT_LATEX:
    `插入 LaTeX 公式到当前绘图。按住 ${labelALT()} 可观看视频演示。`,
  ENTER_LATEX: "输入 LaTeX 表达式",
  READ_RELEASE_NOTES: "阅读本插件的更新说明",
  RUN_OCR: "OCR：识别涂鸦和图片里的文本并复制到剪贴板",
  TRAY_MODE: "绘图工具属性页：面板模式 ⟺ 托盘模式",
  SEARCH: "搜索文本",
  RESET_IMG_TO_100: "重设图像元素的尺寸为 100%",
  TEMPORARY_DISABLE_AUTOSAVE: "临时禁用自动保存功能，直到本次 Obsidian 退出（小白慎用！）",
  TEMPORARY_ENABLE_AUTOSAVE: "启用自动保存功能",

  //ExcalidrawView.ts
  INSTALL_SCRIPT_BUTTON: "安装或更新 Excalidraw 脚本",
  OPEN_AS_MD: "打开为 Markdown 文档",
  EXPORT_IMAGE: `导出为图像`,
  OPEN_LINK: "打开所选元素里的链接 \n（按住 SHIFT 在新面板打开）",
  EXPORT_EXCALIDRAW: "导出为 .excalidraw 文件（旧版绘图文件格式）",
  LINK_BUTTON_CLICK_NO_TEXT:
    "请选择一个含有链接的图形或文本元素。",
  FILENAME_INVALID_CHARS:
    '文件名不能含有以下符号： * " \\  < > : | ? #',
  FORCE_SAVE:
    "保存（同时更新嵌入了该绘图的 Markdown 文档）",
  RAW: "文本元素正以原文（RAW）模式显示链接。\n点击切换到预览（PREVIEW）模式",
  PARSED:
    "文本元素正以预览（PREVIEW）模式显示链接。\n点击切换到原文（RAW）模式",
  NOFILE: "Excalidraw（没有文件）",
  COMPATIBILITY_MODE:
    "*.excalidraw 是兼容旧版的绘图文件格式。需要转换为新格式才能解锁本插件的全部功能。",
  CONVERT_FILE: "转换为新格式",
  BACKUP_AVAILABLE: "加载绘图文件时出错，可能是由于 Obsidian 在上次保存时意外退出了（手机上更容易发生这种意外）。<br><br><b>好消息：</b>这台设备上存在备份。您是否想要恢复本设备上的备份？<br><br>（我建议您先尝试在最近使用过的其他设备上打开该绘图，以检查是否有更新的备份。）",
  BACKUP_RESTORED: "已恢复备份",
  CACHE_NOT_READY: "抱歉，加载绘图文件时出错。<br><br><mark>现在有耐心，将来更省心。</mark><br><br>该插件有备份机制，但您似乎刚刚打开 Obsidian，需要等待一分钟或更长的时间来读取缓存。缓存读取完毕时，您将会在右上角收到提示。<br><br>请点击 OK 并耐心等待缓存，或者选择点击取消后手动修复你的文件。<br>",
  OBSIDIAN_TOOLS_PANEL: "Obsidian 工具面板",
  ERROR_SAVING_IMAGE: "获取图像时发生未知错误",
  WARNING_PASTING_ELEMENT_AS_TEXT: "你不能将 Excalidraw 元素粘贴为文本元素！",
  USE_INSERT_FILE_MODAL: "使用“插入任意文件（以 iFrame 形式嵌入）”功能来嵌入 Markdown 文档",

  //settings.ts
  RELEASE_NOTES_NAME: "显示更新说明",
  RELEASE_NOTES_DESC:
    "<b>开启：</b>每次更新本插件后，显示最新发行版本的说明。<br>" +
    "<b>关闭：</b>您仍可以在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a> 上阅读更新说明。",
  NEWVERSION_NOTIFICATION_NAME: "通知插件更新",
  NEWVERSION_NOTIFICATION_DESC:
      "<b>开启：</b>当本插件存在可用更新时，显示通知。<br>" +
      "<b>关闭：</b>您需要手动检查本插件的更新（设置 - 第三方插件 - 检查更新）。",
  
  FOLDER_NAME: "Excalidraw 文件夹",
  FOLDER_DESC:
    "新绘图的默认存储路径。若为空，将在库的根目录中创建新绘图。",
  FOLDER_EMBED_NAME:
    "将 Excalidraw 文件夹用于“新建绘图”系列命令",
  FOLDER_EMBED_DESC:
    "在命令面板中执行“新建绘图”系列命令时，" +
    "新建的绘图文件的存储路径。<br>" +
    "<b>开启：</b>使用 Excalidraw 文件夹。 <br><b>关闭：</b>使用 Obsidian 设置的新附件默认位置。",
  TEMPLATE_NAME: "Excalidraw 模板文件",
  TEMPLATE_DESC:
    "Excalidraw 模板文件的完整路径。<br>" +
    "如果您的模板在默认的 Excalidraw 文件夹中且文件名是 " +
    "Template.md，则此项应设为 Excalidraw/Template.md（也可省略 .md 扩展名，即 Excalidraw/Template）。<br>" +
    "如果您在兼容模式下使用 Excalidraw，那么您的模板文件也必须是旧的 *.excalidraw 格式，" +
    "例如 Excalidraw/Template.excalidraw。",
  SCRIPT_FOLDER_NAME: "Excalidraw 自动化脚本的文件夹（大小写敏感！）",
  SCRIPT_FOLDER_DESC:
    "此文件夹用于存放 Excalidraw 自动化脚本。" +
    "您可以在 Obsidian 命令面板中执行这些脚本，" +
    "还可以为喜欢的脚本分配快捷键，就像为其他 Obsidian 命令分配快捷键一样。<br>" +
    "该项不能设为库的根目录。",
  SAVING_HEAD: "保存",
  COMPRESS_NAME: "压缩 Excalidraw JSON",
  COMPRESS_DESC:
    "Excalidraw 绘图文件默认将元素记录为 JSON 格式。开启此项，可将元素的 JSON 数据以 BASE64 编码" +
    "（使用 <a href='https://pieroxy.net/blog/pages/lz-string/index.html'>LZ-String</a> 算法）。" +
    "这样做的好处是：一方面可以避免原来的明文 JSON 数据干扰 Obsidian 的文本搜索结果，" +
    "另一方面减小了绘图文件的体积。<br>" +
    "当您通过功能区按钮或命令将绘图切换成 Markdown 模式时，" +
    "数据将被解码回 JSON 格式以便阅读和编辑；" +
    "而当您切换回 Excalidraw 模式时，数据就会被再次编码。<br>" +
    "开启此项后，对于之前已存在但未压缩的绘图文件，" +
    "需要重新打开并保存才能生效。",
  AUTOSAVE_INTERVAL_DESKTOP_NAME: "桌面端自动保存时间间隔",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "每隔多长时间自动保存一次（如果绘图文件没有发生改变，将不会保存）。" +
    "当 Obsidian 应用内的焦点离开活动文档（如关闭工作空间、点击菜单栏、切换到其他页签或面板等）的时候，也会触发自动保存。" +
    "直接退出 Obsidian 应用（不管是终结进程还是点关闭按钮）不会触发自动保存。",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "移动端自动保存时间间隔",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "建议在移动端设置更短的时间间隔。" +
    "当 Obsidian 应用内的焦点离开活动文档（如关闭工作空间、点击菜单栏、切换到其他页签或面板等）的时候，也会触发自动保存。" +
    "直接退出 Obsidian 应用（在应用切换器中划掉）不会触发自动保存。此外，当您切换到其他应用时，有时候" +
    "系统会自动清理 Obsidian 后台以释放资源。这种情况下，自动保存会失效。",
FILENAME_HEAD: "文件名",
  FILENAME_DESC:
    "<p>点击阅读" +
    "<a href='https://momentjs.com/docs/#/displaying/format/'>日期和时间格式参考</a>。</p>",
  FILENAME_SAMPLE: "“新建绘图”系列命令创建的文件名形如：",
  FILENAME_EMBED_SAMPLE: "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名形如：",
  FILENAME_PREFIX_NAME: "“新建绘图”系列命令创建的文件名前缀",
  FILENAME_PREFIX_DESC: "执行“新建绘图”系列命令时，创建的绘图文件名的第一部分",
  FILENAME_PREFIX_EMBED_NAME:
    "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名前缀",
  FILENAME_PREFIX_EMBED_DESC:
    "执行“新建绘图并嵌入到当前 Markdown 文档中”系列命令时，" +
    "创建的绘图文件名是否以当前文档名作为前缀？<br>" +
    "<b>开启：</b>是<br><b>关闭：</b>否",
  FILENAME_POSTFIX_NAME:
    "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名的中间部分",
  FILENAME_POSTFIX_DESC:
    "介于文件名前缀和日期时间之间的文本。仅对“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的绘图生效。",
  FILENAME_DATE_NAME: "文件名里的日期时间",
  FILENAME_DATE_DESC:
    "文件名的最后一部分。允许留空。",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: "文件扩展名（.excalidraw.md 或 .md）",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "该选项在兼容模式（即非 Excalidraw 专用 Markdown 文件）下不会生效。<br>" +
    "<b>开启：</b>使用 .excalidraw.md 作为扩展名。<br><b>关闭：</b>使用 .md 作为扩展名。",
  DISPLAY_HEAD: "显示",
  DYNAMICSTYLE_NAME: "动态样式",
  DYNAMICSTYLE_DESC:
    "根据画布颜色调节 Excalidraw 界面颜色",
  LEFTHANDED_MODE_NAME: "左手模式",
  LEFTHANDED_MODE_DESC:
    "目前只在托盘模式下生效。若开启此项，则托盘（绘图工具属性页）将位于右侧。" +
    "<br><b>开启：</b>左手模式。<br><b>关闭：</b>右手模式。",
  IFRAME_MATCH_THEME_NAME: "使 MD-Embed 匹配 Excalidraw 主题",
  IFRAME_MATCH_THEME_DESC:
    "<b>开启：</b>当你的 Obsidian 和 Excalidraw 一个使用黑暗主题、一个使用明亮主题时，" +
    "开启此项，MD-Embed 将会匹配 Excalidraw 主题。<br>" +
    "<b>关闭：</b>如果你想要 MD-Embed 匹配 Obsidian 主题，请关闭此项。",    
  MATCH_THEME_NAME: "使新建的绘图匹配 Obsidian 主题",
  MATCH_THEME_DESC:
    "如果 Obsidian 使用黑暗主题，新建的绘图文件也将使用黑暗主题。<br>" +
    "但是若设置了模板，新建的绘图文件将跟随模板主题；另外，此功能不会作用于已有的绘图。" +
    "<br><b>开启：</b>跟随 Obsidian 主题风格。<br><b>关闭：</b>跟随模板主题风格。",
  MATCH_THEME_ALWAYS_NAME: "使已有的绘图匹配 Obsidian 主题",
  MATCH_THEME_ALWAYS_DESC:
    "如果 Obsidian 使用黑暗主题，则绘图文件也将以黑暗主题打开；反之亦然。" +
    "<br><b>开启：</b>匹配 Obsidian 主题风格。<br><b>关闭：</b>采用上次保存时的主题风格。",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw 主题跟随 Obsidian 主题变化",
  MATCH_THEME_TRIGGER_DESC:
    "开启此项，则切换 Obsidian 的黑暗/明亮主题时，已打开的 Excalidraw 面板的主题会随之改变。" +
    "<br><b>开启：</b>跟随主题变化。<br><b>关闭：</b>不跟随主题变化。",
  DEFAULT_OPEN_MODE_NAME: "Excalidraw 的默认运行模式",
  DEFAULT_OPEN_MODE_DESC:
    "设置 Excalidraw 的运行模式：普通模式（Normal）/禅模式（Zen）/阅读模式（View）。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>excalidraw-default-mode: normal/zen/view</code> 的键值对。",
  DEFAULT_PEN_MODE_NAME: "触控笔模式（Pen mode）",
  DEFAULT_PEN_MODE_DESC:
    "打开绘图时，是否自动开启触控笔模式？",

  DEFAULT_PINCHZOOM_NAME: "允许在触控笔模式下进行双指缩放",
  DEFAULT_PINCHZOOM_DESC:
    "在触控笔模式下使用自由画笔工具时，双指缩放可能造成干扰。<br>" +
    "<b>开启: </b>允许在触控笔模式下进行双指缩放<br><b>关闭： </b>禁止在触控笔模式下进行双指缩放",

  DEFAULT_WHEELZOOM_NAME: "鼠标滚轮缩放页面",
  DEFAULT_WHEELZOOM_DESC:
    `<b>开启：</b>鼠标滚轮为缩放页面，${labelCTRL()}+鼠标滚轮为滚动页面</br><b>关闭：</b>鼠标滚轮为滚动页面，${labelCTRL()}+鼠标滚轮为缩放页面`,
    
  ZOOM_TO_FIT_NAME: "调节面板尺寸后自动缩放页面",
  ZOOM_TO_FIT_DESC: "调节面板尺寸后，自适应地缩放页面" +
    "<br><b>开启：</b>自动缩放。<br><b>关闭：</b>禁用自动缩放。",
  ZOOM_TO_FIT_ONOPEN_NAME: "打开绘图时自动缩放页面",
  ZOOM_TO_FIT_ONOPEN_DESC: "打开绘图文件时，自适应地缩放页面" +
      "<br><b>开启：</b>自动缩放。<br><b>关闭：</b>禁用自动缩放。",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "自动缩放的最高级别",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "自动缩放画布时，允许放大的最高级别。该值不能低于 0.5（50%）且不能超过 10（1000%）。",
  LINKS_HEAD: "链接（Links） & 以内部链接形式嵌入到绘图中的 Markdown 文档（Transclusion）",
  LINKS_DESC:
    `按住 ${labelCTRL()} 并点击包含 <code>[[链接]]</code> 的文本元素可以打开其中的链接。` +
    "如果所选文本元素包含多个 <code>[[有效的内部链接]]</code> ，只会打开第一个链接；" +
    "如果所选文本元素包含有效的 URL 链接 (如 <code>https://</code> 或 <code>http://</code>)，" +
    "插件会在浏览器中打开链接。<br>" +
    "链接的源文件被重命名时，绘图中相应的 <code>[[内部链接]]</code> 也会同步更新。" +
    "若您不愿绘图中的链接外观因此而变化，可使用 <code>[[内部链接|别名]]</code>。",
  ADJACENT_PANE_NAME: "在相邻面板中打开",
  ADJACENT_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 并点击绘图里的内部链接时，插件默认会在新面板中打开该链接。<br>` +
    "若开启此项，Excalidraw 会先尝试寻找已有的相邻面板（按照右侧、左侧、上方、下方的顺序），" +
    "并在其中打开该链接。如果找不到，" +
    "再在新面板中打开。",
  MAINWORKSPACE_PANE_NAME: "在主工作区中打开",
  MAINWORKSPACE_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 并点击绘图里的内部链接时，插件默认会在当前窗口的新面板中打开该链接。<br>` +
    "若开启此项，Excalidraw 会在主工作区的面板中打开该链接。",  
  LINK_BRACKETS_NAME: "在链接的两侧显示 <code>[[中括号]]</code>",
  LINK_BRACKETS_DESC: `${
    "文本元素处于预览（PREVIEW）模式时，在内部链接的两侧显示中括号。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>"
  }${FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS}: true/false</code> 的键值对。`,
  LINK_PREFIX_NAME: "内部链接的前缀",
  LINK_PREFIX_DESC: `${
    "文本元素处于预览（PREVIEW）模式时，如果其中包含链接，则添加此前缀。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>"
  }${FRONTMATTER_KEY_CUSTOM_PREFIX}: "📍 "</code> 的键值对。`,
  URL_PREFIX_NAME: "外部链接的前缀",
  URL_PREFIX_DESC: `${
    "文本元素处于预览（PREVIEW）模式时，如果其中包含外部链接，则添加此前缀。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>"
  }${FRONTMATTER_KEY_CUSTOM_URL_PREFIX}: "🌐 "</code> 的键值对。`,
  PARSE_TODO_NAME: "待办任务（Todo）",
  PARSE_TODO_DESC: "将文本元素中的 <code>- [ ]</code> 和 <code>- [x]</code> 前缀显示为方框。",
  TODO_NAME: "未完成项目",
  TODO_DESC: "未完成的待办项目的符号",
  DONE_NAME: "已完成项目",
  DONE_DESC: "已完成的待办项目的符号",
  HOVERPREVIEW_NAME: "鼠标悬停预览内部链接",
  HOVERPREVIEW_DESC:
    `<b>开启：</b>在 Excalidraw <u>阅读模式（View）</u>下，鼠标悬停在 <code>[[内部链接]]</code> 上即可预览；` +
    "而在<u>普通模式（Normal）</u>下, 鼠标悬停在内部链接右上角的蓝色标识上即可预览。<br> " +
    `<b>关闭：</b>鼠标悬停在 <code>[[内部链接]]</code> 上，并且按住 ${labelCTRL()} 才能预览。`,
  LINKOPACITY_NAME: "链接标识的透明度",
  LINKOPACITY_DESC:
    "含有链接的元素，其右上角的链接标识的透明度。介于 0（全透明）到 1（不透明）之间。",
  LINK_CTRL_CLICK_NAME:
    `按住 ${labelCTRL()} 并点击含有 [[链接]] 或 [别名](链接) 的文本来打开链接`,
  LINK_CTRL_CLICK_DESC:
    "如果此功能影响到您使用某些原版 Excalidraw 功能，可将其关闭。" +
    "关闭后，您只能通过绘图面板标题栏中的链接按钮来打开链接。",
  TRANSCLUSION_WRAP_NAME: "Transclusion 的折行方式",
  TRANSCLUSION_WRAP_DESC:
    "中的 number 表示嵌入的文本溢出时，在第几个字符处进行折行。<br>" +
    "此开关控制具体的折行方式。若开启，则严格在 number 处折行，禁止溢出；" +
    "若关闭，则允许在 number 位置后最近的空格处折行。",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "Transclusion 的默认折行位置",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "除了通过 <code>![[doc#^block]]{number}</code> 中的 number 来控制折行位置，您也可以在此设置 number 的默认值。<br>" +
    "一般设为 0 即可，表示不设置固定的默认值，这样当您需要嵌入文档到便签中时，" +
    "Excalidraw 能更好地帮您自动处理。",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "Transclusion 的最大显示字符数",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "以 <code>![[内部链接]]</code> 或 <code>![](内部链接)</code> 的形式将文档以文本形式嵌入到绘图中时，" +
    "该文档在绘图中可显示的最大字符数量。",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "隐藏 Transclusion 行首的引用符号",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "不显示 Transclusion 中每一行行首的 > 符号，以提高纯文本 Transclusion 的可读性。<br>" +
    "<b>开启：</b>隐藏 > 符号<br><b>关闭：</b>不隐藏 > 符号（注意，由于 Obsidian API 的原因，首行行首的 > 符号不会被隐藏）",
  GET_URL_TITLE_NAME: "使用 iframly 获取页面标题",
  GET_URL_TITLE_DESC:
    "拖放链接到 Excalidraw 时，使用 <code>http://iframely.server.crestify.com/iframely?url=</code> 来获取页面的标题。",
  MD_HEAD: "以图像形式嵌入到绘图中的 Markdown 文档（MD-Embed）",
  MD_HEAD_DESC:
    "除了 Transclusion，您还可以将 Markdown 文档以图像形式嵌入到绘图中。" +
    `方法是按住 ${labelCTRL()} 并从文件管理器中把文档拖入绘图，或者执行“以图像形式嵌入”系列命令。`,

  MD_TRANSCLUDE_WIDTH_NAME: "MD-Embed 的默认宽度",
  MD_TRANSCLUDE_WIDTH_DESC:
    "MD-Embed 的宽度。该选项会影响到折行，以及图像元素的宽度。<br>" +
    "您可为绘图中的某个 MD-Embed 单独设置此项，方法是将绘图切换至 Markdown 模式，" +
    "并修改相应的 <code>[[Embed文件名#标题|宽度x最大高度]]</code>。",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "MD-Embed 的默认最大高度",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "MD-Embed 的高度取决于 Markdown 文档内容的多少，但最大不会超过该值。<br>" +
    "您可为绘图中的某个 MD-Embed 单独设置此项，方法是将绘图切换至 Markdown 模式，并修改相应的 <code>[[Embed文件名#^块引ID|宽度x最大高度]]</code>。",
  MD_DEFAULT_FONT_NAME:
    "MD-Embed 的默认字体",
  MD_DEFAULT_FONT_DESC:
    "可以设为 <code>Virgil</code>，<code>Casadia</code> 或其他有效的 .ttf/.woff/.woff2 字体文件（如 <code>我的字体.woff2</code>）。<br>" +
    "您可为某个 MD-Embed 单独设置此项，方法是在其源文件的 frontmatter 中添加形如 <code>excalidraw-font: 字体名或文件名</code> 的键值对。",
  MD_DEFAULT_COLOR_NAME:
    "MD-Embed 的默认文本颜色",
  MD_DEFAULT_COLOR_DESC:
    "可以填写 HTML 颜色名，如 steelblue（参考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 进制颜色值，例如 #e67700，或者任何其他有效的 CSS 颜色。<br>" +
    "您可为某个 MD-Embed 单独设置此项，方法是在其源文件的 frontmatter 中添加形如 <code>excalidraw-font-color: steelblue</code> 的键值对。",
  MD_DEFAULT_BORDER_COLOR_NAME:
    "MD-Embed 的默认边框颜色",
  MD_DEFAULT_BORDER_COLOR_DESC:
    "可以填写 HTML 颜色名，如 steelblue（参考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 进制颜色值，例如 #e67700，或者任何其他有效的 CSS 颜色。<br>" +
    "您可为某个 MD-Embed 单独设置此项，方法是在其源文件的 frontmatter 中添加形如 <code>excalidraw-border-color: gray</code> 的键值对。<br>" +
    "如果您不想要边框，请留空。",
  MD_CSS_NAME: "MD-Embed 的默认 CSS 样式表",
  MD_CSS_DESC:
    "MD-Embed 图像所采用的 CSS 样式表文件名。需包含扩展名，例如 md-embed.css。" +
    "允许使用 Markdown 文件（如 md-embed-css.md），但其内容应符合 CSS 语法。<br>" +
    "如果您要查询 CSS 所作用的 HTML 节点，请在 Obsidian 开发者控制台（CTRL+SHIFT+i）中键入命令：" +
    "<code>ExcalidrawAutomate.mostRecentMarkdownSVG</code> —— 这将显示 Excalidraw 最近生成的 SVG。<br>" +
    "此外，在 CSS 中不能任意地设置字体，您一般只能使用系统默认的标准字体（详见 README），" +
    "但可以通过上面的设置来额外添加一个自定义字体。<br>" +
    "您可为某个 MD-Embed 单独设置此项，方法是在其源文件的 frontmatter 中添加形如 <code>excalidraw-css: 库中的CSS文件或CSS片段</code> 的键值对。",
  EMBED_HEAD: "嵌入到 Markdown 文档中的绘图 & 导出",
  EMBED_CACHING: "启用预览图",
  EMBED_SIZING: "预览图的尺寸",
  EMBED_THEME_BACKGROUND: "预览图的主题和背景色",
  EMBED_IMAGE_CACHE_NAME: "为嵌入到 Markdown 文档中的绘图创建预览图",
  EMBED_IMAGE_CACHE_DESC: "为嵌入到文档中的绘图创建预览图。可提高下次嵌入的速度。" +
    "但如果绘图中又嵌入了子绘图，当子绘图改变时，您需要打开子绘图并手动保存，才能够更新父绘图的预览图。",
  EMBED_IMAGE_CACHE_CLEAR: "清除预览图",
  BACKUP_CACHE_CLEAR: "清除备份",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "该操作将删除所有绘图文件的备份。备份是绘图文件损坏时的一种补救手段。每次您打开 Obsidian 时，本插件会自动清理无用的备份。您确定要删除所有备份吗？",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "将之前已导出的图像作为预览图",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "该选项与“自动导出 SVG/PNG 副本”选项配合使用。如果嵌入到 Markdown 文档中的绘图文件存在同名的 SVG/PNG 副本，则将其作为预览图，而不再重新生成。<br>" +
    "该选项能够提高 Markdown 文档的打开速度，尤其是当嵌入到 Markdown 文档中的绘图文件中含有大量图像或 MD-Embed 时。" +
    "但是，该选项也可能导致预览图无法立即响应你对绘图文件或者 Obsidian 主题风格的修改。<br>" +
    "该选项仅作用于嵌入到 Markdown 文档中的绘图。" +
    "该选项无法提升绘图文件的打开速度。详见<a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.23' target='_blank'>此说明</a>。",
  /*EMBED_PREVIEW_SVG_NAME: "生成 SVG 格式的预览图",
  EMBED_PREVIEW_SVG_DESC:
    "<b>开启：</b>为嵌入到 Markdown 文档中的绘图生成 <a href='https://en.wikipedia.org/wiki/Scalable_Vector_Graphics' target='_blank'>SVG</a> 格式的预览图。<br>" +
    "<b>关闭：</b>为嵌入到 Markdown 文档中的绘图生成 <a href='' target='_blank'>PNG</a> 格式的预览图。注意：PNG 格式预览图不支持某些 <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>绘图元素的块引用特性</a>。",*/
  EMBED_PREVIEW_IMAGETYPE_NAME: "预览图的格式",
  EMBED_PREVIEW_IMAGETYPE_DESC:
    "<b>原始 SVG：</b>高品质、可交互。<br>" +
    "<b>SVG：</b>高品质、不可交互。<br>" +
    "<b>PNG：</b>高性能、<a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>不可交互</a>。", 
  PREVIEW_MATCH_OBSIDIAN_NAME: "预览图匹配 Obsidian 主题",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "开启此项，则当 Obsidian 处于黑暗模式时，嵌入到 Markdown 文档中的绘图的预览图也会以黑暗模式渲染；当 Obsidian 处于明亮模式时，预览图也会以明亮模式渲染。<br>" +
    "您可能还需要关闭“导出的图像包含背景”开关，来获得与 Obsidian 更加协调的观感。",
  EMBED_WIDTH_NAME: "预览图的默认宽度",
  EMBED_WIDTH_DESC:
    "嵌入到 Markdown 文档中的绘图的预览图的默认宽度。该选项也适用于鼠标悬停时浮现的预览图。<br>" +
    "您可为某个要嵌入到 Markdown 文档中的绘图文件单独设置此项，" +
    "方法是修改相应的内部链接格式为形如 <code>![[drawing.excalidraw|100]]</code> 或 <code>[[drawing.excalidraw|100x100]]</code>。",
  EMBED_TYPE_NAME: "“嵌入绘图到当前 Markdown 文档中”系列命令的源文件类型",
  EMBED_TYPE_DESC:
    "在命令面板中执行“嵌入绘图到当前 Markdown 文档中”系列命令时，要嵌入绘图文件本身，还是嵌入其 PNG 或 SVG 副本。<br>" +
    "如果您想选择 PNG 或 SVG 副本，需要先开启下方的“自动导出 PNG 副本”或“自动导出 SVG 副本”。<br>" +
    "如果您选择了 PNG 或 SVG 副本，当副本不存在时，该命令将会插入一条损坏的链接，您需要打开绘图文件并手动导出副本才能修复 —— " +
    "也就是说，该选项不会自动帮您生成 PNG/SVG 副本，而只会引用已有的 PNG/SVG 副本。",
  EMBED_WIKILINK_NAME: "“嵌入绘图到当前 Markdown 文档中”系列命令产生的内部链接类型",
  EMBED_WIKILINK_DESC:
    "<b>开启：</b>将产生 <code>![[Wiki 链接]]</code>。<b>关闭：</b>将产生 <code>![](Markdown 链接)</code>。",
  EXPORT_PNG_SCALE_NAME: "导出的 PNG 图像的比例",
  EXPORT_PNG_SCALE_DESC: "导出的 PNG 图像的大小比例",
  EXPORT_BACKGROUND_NAME: "导出的图像包含背景",
  EXPORT_BACKGROUND_DESC:
    "如果关闭，将导出透明背景的图像。",
  EXPORT_PADDING_NAME: "导出的图像的空白边距",
  EXPORT_PADDING_DESC:
    "导出的 SVG/PNG 图像四周的空白边距（单位：像素）。<br>" +
    "增加该值，可以避免在导出图像时，靠近图像边缘的图形被裁掉。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>excalidraw-export-padding: 5<code> 的键值对。",
  EXPORT_THEME_NAME: "导出的图像匹配主题",
  EXPORT_THEME_DESC:
    "导出与绘图的黑暗/明亮主题匹配的图像。" +
    "如果关闭，在黑暗主题下导出的图像将和明亮主题一样。",
  EXPORT_HEAD: "导出设置",
  EXPORT_SYNC_NAME:
    "保持 SVG/PNG 文件名与绘图文件同步",
  EXPORT_SYNC_DESC:
    "打开后，当绘图文件被重命名时，插件将同步更新同文件夹下的同名 .SVG 和 .PNG 文件。" +
    "当绘图文件被删除时，插件将自动删除同文件夹下的同名 .SVG 和 .PNG 文件。",
  EXPORT_SVG_NAME: "自动导出 SVG 副本",
  EXPORT_SVG_DESC:
    "自动导出和绘图文件同名的 SVG 副本。" +
    "插件会将副本保存到绘图文件所在的文件夹中。" +
    "在文档中嵌入这个 SVG 文件，相比直接嵌入绘图文件，具有更强的跨平台能力。<br>" +
    "此开关开启时，每次您编辑 Excalidraw 绘图，其 SVG 文件副本都会同步更新。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>excalidraw-autoexport: none/both/svg/png</code>" +
    "的键值对",
  EXPORT_PNG_NAME: "自动导出 PNG 副本",
  EXPORT_PNG_DESC: "和“自动导出 SVG 副本”类似，但是导出格式为 *.PNG。",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "同时导出黑暗和明亮主题风格的图像",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC:  "若开启，Excalidraw 将导出两个文件：filename.dark.png（或 filename.dark.svg）和 filename.light.png（或 filename.light.svg）。<br>"+
    "该选项可作用于“自动导出 SVG 副本”、“自动导出 PNG 副本”，以及其他的手动的导出命令。",
  COMPATIBILITY_HEAD: "兼容性设置",
  EXPORT_EXCALIDRAW_NAME: "自动导出 Excalidraw 旧格式副本",
  EXPORT_EXCALIDRAW_DESC: "和“自动导出 SVG 副本”类似，但是导出格式为 *.excalidraw。",
  SYNC_EXCALIDRAW_NAME:
    "新旧格式绘图文件的内容保持同步",
  SYNC_EXCALIDRAW_DESC:
    "如果旧格式（*.excalidraw）绘图文件的修改日期比新格式（*.md）更新，" +
    "则根据旧格式文件的内容来更新新格式文件。",
  COMPATIBILITY_MODE_NAME: "以旧格式创建新绘图",
  COMPATIBILITY_MODE_DESC:
    "开启此功能后，您通过功能区按钮、命令面板、" +
    "文件浏览器等创建的绘图都将是旧格式（*.excalidraw）。" +
    "此外，您打开旧格式绘图文件时将不再收到警告消息。",
  MATHJAX_NAME: "MathJax (LaTeX) 的 javascript 库服务器",
  MATHJAX_DESC: "如果您在绘图中使用 LaTeX，插件需要从服务器获取并加载一个 javascript 库。" + 
    "如果您的网络无法访问某些库服务器，可以尝试通过此选项更换库服务器。"+
    "更改此选项后，您可能需要重启 Obsidian 来使其生效。",
  LATEX_DEFAULT_NAME: "插入 LaTeX 时的默认表达式",
  LATEX_DEFAULT_DESC: "允许留空。允许使用类似 <code>\\color{white}</code> 的格式化表达式。",
  NONSTANDARD_HEAD: "非 Excalidraw.com 官方支持的特性",
  NONSTANDARD_DESC: "这些特性不受 Excalidraw.com 官方支持。当导出绘图到 Excalidraw.com 时，这些特性将会发生变化。",
  CUSTOM_PEN_NAME: "自定义画笔的数量",
  CUSTOM_PEN_DESC: "在画布上的 Obsidian 菜单旁边切换自定义画笔。长按画笔按钮可以修改其样式。",
  EXPERIMENTAL_HEAD: "实验性功能",
  EXPERIMENTAL_DESC:
    "以下部分设置不会立即生效，需要刷新文件资源管理器或者重启 Obsidian 才会生效。",
  FIELD_SUGGESTER_NAME: "开启字段建议",
  FIELD_SUGGESTER_DESC:
    "开启后，当您在编辑器中输入 <code>excalidraw-</code> 或者 <code>ea.</code> 时，会弹出一个带有函数说明的自动补全提示菜单。<br>" +
    "该功能借鉴了 Breadcrumbs 和 Templater 插件。",
  FILETYPE_NAME: "在文件浏览器中为 excalidraw.md 文件添加类型标识符（如 ✏️）",
  FILETYPE_DESC:
    "可通过下一项设置来自定义类型标识符。",
  FILETAG_NAME: "excalidraw.md 文件的类型标识符",
  FILETAG_DESC: "要显示为类型标识符的 emoji 或文本。",
  INSERT_EMOJI: "插入 emoji",
  LIVEPREVIEW_NAME: "嵌入绘图到文档时，模拟嵌入图像的语法",
  LIVEPREVIEW_DESC:
    "开启此项，则可在 Obsidian 实时预览模式的编辑视图下，用形如 <code>![[绘图|宽度|样式]]</code> 的语法来嵌入绘图。<br>" +
    "该选项不会在已打开的文档中立刻生效 —— " +
    "你需要重新打开此文档来使其生效。",
  ENABLE_FOURTH_FONT_NAME: "为文本元素启用本地字体",
  ENABLE_FOURTH_FONT_DESC:
    "开启此项后，文本元素的属性面板里会多出一个本地字体按钮。<br>" +
    "使用了本地字体的绘图文件，将会失去一部分跨平台能力 —— " +
    "若将绘图文件移动到其他库中打开，显示效果可能会截然不同；" +
    "若在 excalidraw.com 或者其他版本的 Excalidraw 中打开，使用本地字体的文本会变回系统默认字体。",
  FOURTH_FONT_NAME: "本地字体文件",
  FOURTH_FONT_DESC:
    "选择库文件夹中的一个 .ttf, .woff 或 .woff2 字体文件作为本地字体文件。" +
    "若未选择文件，则使用默认的 Virgil 字体。",
  SCRIPT_SETTINGS_HEAD: "已安装脚本的设置",
  TASKBONE_HEAD: "Taskbone OCR（光学符号识别）",
  TASKBONE_DESC: "这是一个将 OCR 融入 Excalidraw 的实验性功能。请注意，Taskbone 是一项独立的外部服务，而不是由 Excalidraw 或 Obsidian-excalidraw-plugin 项目提供的。" +
    "OCR 能够对画布上用自由画笔工具写下的涂鸦或者嵌入的图像进行文本识别，并将识别出来的文本写入绘图文件的 frontmatter，同时复制到剪贴板。" +
    "之所以要写入 frontmatter 是为了便于您在 Obsidian 中能够搜索到这些文本。" +
    "注意，识别的过程不是在本地进行的，而是通过在线 API，图像会被上传到 taskbone 的服务器（仅用于识别目的）。如果您介意，请不要使用这个功能。",
  TASKBONE_ENABLE_NAME: "启用 Taskbone",
  TASKBONE_ENABLE_DESC: "启用这个功能意味着你同意 Taskbone <a href='https://www.taskbone.com/legal/terms/' target='_blank'>条款及细则</a> 以及 " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>隐私政策</a>.",
  TASKBONE_APIKEY_NAME: "Taskbone API Key",
  TASKBONE_APIKEY_DESC: "Taskbone 的免费 API key 提供了一定数量的每月识别次数。如果您非常频繁地使用此功能，或者想要支持 " + 
    "Taskbone 的开发者（您懂的，没有人能用爱发电，Taskbone 开发者也需要投入资金来维持这项 OCR 服务）您可以" +
    "到 <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a> 购买一个商用 API key。购买后请将它填写到旁边这个文本框里，替换掉原本自动生成的免费 API key。",

  //openDrawings.ts
  SELECT_FILE: "选择一个文件后按回车。",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `选择一个文件后按回车，或者 ${labelSHIFT()}+${labelMETA()}+ENTER 以 100% 尺寸插入。`,
  NO_MATCH: "查询不到匹配的文件。",
  SELECT_FILE_TO_LINK: "选择要插入（以内部链接形式嵌入）到当前绘图中的文件。",
  SELECT_DRAWING: "选择要插入（以图像形式嵌入）到当前绘图中的图像或绘图文件。",
  TYPE_FILENAME: "键入要选择的绘图名称。",
  SELECT_FILE_OR_TYPE_NEW:
    "选择已有绘图，或者键入新绘图文件的名称，然后按回车。",
  SELECT_TO_EMBED: "选择要插入（嵌入）到当前 Markdown 文档中的绘图。",
  SELECT_MD: "选择要插入（以图像形式嵌入）到当前绘图中的 Markdown 文档。",
  SELECT_PDF: "选择要插入（以图像形式嵌入）到当前绘图中的 PDF 文档。",
  PDF_PAGES_HEADER: "页码范围",
  PDF_PAGES_DESC: "示例：1, 3-5, 7, 9-11",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW 警告\n停止加载嵌入的图像，因为此文件中存在死循环：\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "脚本运行错误。请在开发者控制台中查看错误信息。",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "Excalidraw 文件已损坏。尝试从备份文件中加载。",

  //ObsidianMenu.tsx
  GOTO_FULLSCREEN: "进入全屏模式",
  EXIT_FULLSCREEN: "退出全屏模式",
  TOGGLE_FULLSCREEN: "切换全屏模式",
  TOGGLE_DISABLEBINDING: "开启或关闭绑定",
  TOGGLE_FRAME_RENDERING: "开启或关闭框架渲染",
  TOGGLE_FRAME_CLIPPING: "开启或关闭框架裁剪",
  OPEN_LINK_CLICK: "打开所选的图形或文本元素里的链接",
  OPEN_LINK_PROPS: "编辑所选 MD-Embed 的内部链接，或者打开所选的图形或文本元素里的链接",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "缩放至标题",
  NARROW_TO_BLOCK: "缩放至块",
  SHOW_ENTIRE_FILE: "显示全部",
  ZOOM_TO_FIT: "缩放至合适大小",
  RELOAD: "重载",
  OPEN_IN_BROWSER: "在浏览器中打开",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "文件不存在。要创建吗？",
  PROMPT_ERROR_NO_FILENAME: "错误：文件名不能为空",
  PROMPT_ERROR_DRAWING_CLOSED: "未知错误。绘图文件可能已关闭或丢失",
  PROMPT_TITLE_NEW_FILE: "新建文件",
  PROMPT_TITLE_CONFIRMATION: "确认",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "创建 Excalidraw 绘图",
  PROMPT_BUTTON_CREATE_MARKDOWN: "创建 Markdown 文档",
  PROMPT_BUTTON_NEVERMIND: "算了",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "取消",
  PROMPT_BUTTON_INSERT_LINE: "插入一行",
  PROMPT_BUTTON_INSERT_SPACE: "插入空格",
  PROMPT_BUTTON_INSERT_LINK: "插入内部链接",
  PROMPT_BUTTON_UPPERCASE: "大写",
  
};
