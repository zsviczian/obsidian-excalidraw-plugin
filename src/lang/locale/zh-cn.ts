import {
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS,
} from "src/constants/constants";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";

declare const PLUGIN_VERSION:string;

// 简体中文
export default {
  // Sugester
  SELECT_FILE_TO_INSERT: "选择要嵌入到当前绘图中的文件",
  // main.ts
  CONVERT_URL_TO_FILE: "从 URL 下载图片到本地",
  UNZIP_CURRENT_FILE: "解压当前 Excalidraw 文件",
  ZIP_CURRENT_FILE: "压缩当前 Excalidraw 文件",
  PUBLISH_SVG_CHECK: "Obsidian Publish：搜索过期的 SVG 和 PNG 导出文件",
  EMBEDDABLE_PROPERTIES: "Embeddable 元素设置",
  EMBEDDABLE_RELATIVE_ZOOM: "使元素的缩放等级等于当前绘图的缩放等级",
  OPEN_IMAGE_SOURCE: "打开 Excalidraw 绘图",
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
  DUPLICATE_IMAGE: "复制选定的图像，并分配一个不同的图像 ID",
  CONVERT_NOTE_TO_EXCALIDRAW: "转换：空白 Markdown 文档 => Excalidraw 绘图",
  CONVERT_EXCALIDRAW: "转换： *.excalidraw => *.md",
  CREATE_NEW: "新建绘图文件",
  CONVERT_FILE_KEEP_EXT: "转换：*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "转换：*.excalidraw => *.md (兼容 Logseq)",
  DOWNLOAD_LIBRARY: "导出 stencil 库为 *.excalidrawlib 文件",
  OPEN_EXISTING_NEW_PANE: "打开已有的绘图 - 于新面板",
  OPEN_EXISTING_ACTIVE_PANE:
    "打开已有的绘图 - 于当前面板",
  TRANSCLUDE: "嵌入绘图 ![[drawing]] 到当前 Markdown 文档中",
  TRANSCLUDE_MOST_RECENT: "嵌入最近编辑过的绘图 ![[drawing]] 到当前 Markdown 文档中",
  TOGGLE_LEFTHANDED_MODE: "切换为左手模式",
  TOGGLE_SPLASHSCREEN: "在新绘图中显示启动画面",
  FLIP_IMAGE: "在弹出窗口中打开所选绘图的背景笔记",
  NEW_IN_NEW_PANE: "新建绘图 - 于新面板",
  NEW_IN_NEW_TAB: "新建绘图 - 于新标签页",
  NEW_IN_ACTIVE_PANE: "新建绘图 - 于当前面板",
  NEW_IN_POPOUT_WINDOW: "新建绘图 - 于新窗口",
  NEW_IN_NEW_PANE_EMBED:
    "新建绘图 - 于新面板 - 并嵌入到当前 Markdown 文档中",
  NEW_IN_NEW_TAB_EMBED:
    "新建绘图 - 于新标签页 - 并嵌入到当前 Markdown 文档中",
  NEW_IN_ACTIVE_PANE_EMBED:
    "新建绘图 - 于当前面板 - 并嵌入到当前 Markdown 文档中",
  NEW_IN_POPOUT_WINDOW_EMBED: "新建绘图 - 于新窗口 - 并嵌入到当前 Markdown 文档中",
  TOGGLE_LOCK: "文本元素：原文模式（RAW）⟺ 预览模式（PREVIEW）",
  DELETE_FILE: "从仓库中删除所选图片（或以图像形式嵌入的 Markdown）源文件",
  MARKER_FRAME_SHOW: "显示标记画框",
  MARKER_FRAME_HIDE: "隐藏标记画框",
  MARKER_FRAME_TITLE_SHOW: "显示标记画框名称",
  MARKER_FRAME_TITLE_HIDE: "隐藏标记画框名称",
  COPY_ELEMENT_LINK: "复制所选元素的 [[file#^id]] 链接",
  COPY_DRAWING_LINK: "复制绘图的 ![[drawing]] 链接",
  INSERT_LINK_TO_ELEMENT:
    `单击=复制所选元素的 [[file#^id]] 链接\n${labelCTRL()}=复制元素所在分组为 [[file#^group=id]] 链接\n${labelSHIFT()}=复制所选元素所在区域为 [[file#^area=id]] 链接`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "复制所选元素所在分组为 ![[file#^group=id]] 链接",
  INSERT_LINK_TO_ELEMENT_AREA:
    "复制所选元素所在区域为 ![[file#^area=id]] 链接",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "复制所选画框为 ![[file#^frame=id]] 链接",
  INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "复制所选画框（裁切）为 ![[file#^clippedframe=id]] 链接",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "复制所选元素的 [[file#^id]] 链接",
  INSERT_LINK_TO_ELEMENT_ERROR: "选择场景中的单个元素",
  INSERT_LINK_TO_ELEMENT_READY: "链接已生成并复制到剪贴板",
  INSERT_LINK: "以链接形式插入文件",
  INSERT_COMMAND: "插入 Obsidian 命令到当前绘图中",
  INSERT_IMAGE: "以图像形式嵌入图片或 Excalidraw 绘图到当前绘图中",
  IMPORT_SVG: "导入 SVG 文件为线条（暂不支持文本元素）",
  IMPORT_SVG_CONTEXTMENU: "转换 SVG 为线条 - 有限制",
  INSERT_MD: "以图像形式嵌入 Markdown 文档到当前绘图中",
  INSERT_PDF: "以图像形式嵌入 PDF 到当前绘图中",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE: "以图像形式嵌入最后激活的 PDF 页面",
  UNIVERSAL_ADD_FILE: "以交互或图像形式嵌入文件",
  INSERT_CARD: "插入“背景笔记”卡片",
  CONVERT_CARD_TO_FILE: "将“背景笔记”卡片保存到文件",
  ERROR_TRY_AGAIN: "请重试。",
  PASTE_CODEBLOCK: "粘贴代码块",
  INSERT_LATEX:
    `插入 LaTeX 公式到当前绘图中`,
  ENTER_LATEX: "输入 LaTeX 公式",
  READ_RELEASE_NOTES: "阅读本插件的更新说明",
  RUN_OCR: "OCR 整个绘图：识别涂鸦和图片里的文本并复制到剪贴板和笔记属性中",
  RERUN_OCR: "重新 OCR 整个绘图：识别涂鸦和图片里的文本并复制到剪贴板和笔记属性中",
  RUN_OCR_ELEMENTS: "OCR 选中的元素：识别涂鸦和图片里的文本并复制到剪贴板",
  TRAY_MODE: "绘图工具属性页：面板模式 ⟺ 托盘模式",
  SEARCH: "搜索文本",
  CROP_PAGE: "裁剪所选页面并添加蒙版",
  CROP_IMAGE: "裁剪图片并添加蒙版",
  ANNOTATE_IMAGE: "在 Excalidraw 中标注图片",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "以图像形式嵌入当前激活的 PDF 页面",
  RESET_IMG_TO_100: "重置图像尺寸为 100%",
  RESET_IMG_ASPECT_RATIO: "重置所选图像的纵横比",
  TEMPORARY_DISABLE_AUTOSAVE: "临时禁用自动保存功能，直到本次 Obsidian 退出（小白慎用！）",
  TEMPORARY_ENABLE_AUTOSAVE: "启用自动保存功能",
  FONTS_LOADED: "Excalidraw: CJK 字体已加载",
  FONTS_LOAD_ERROR: "Excalidraw: 在资源文件夹下找不到 CJK 字体\n",

  //Prompt.ts
  SELECT_LINK_TO_OPEN: "选择要打开的链接",

  //ExcalidrawView.ts
  ERROR_CANT_READ_FILEPATH: "错误，无法读取文件路径。正在改为导入文件",
  NO_SEARCH_RESULT: "在绘图中未找到匹配的元素",
  FORCE_SAVE_ABORTED: "自动保存被中止，因为文件正在保存中",
  LINKLIST_SECOND_ORDER_LINK: "二级链接",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE: "自定义嵌入文件链接",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT: "请不要在文件名周围添加 [[方括号]]！<br>" +
    "对于 Markdown 图像，在编辑链接时请遵循以下格式：<mark>文件名#^块引用|宽度x最大高度</mark><br>" +
    "您可以通过在链接末尾添加 <code>|100%</code> 来将 Excalidraw 图像锚定为 100% 的大小。<br>" +
    "您可以通过将 <code>#page=1</code> 更改为 <code>#page=2</code> 等来更改 PDF 页码。<br>" +
    "PDF 矩形裁剪值为：<code>左, 下, 右, 上</code>。例如：<code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "画框渲染：已启用",
  FRAME_CLIPPING_DISABLED: "画框渲染：已禁用",
  ARROW_BINDING_INVERSE_MODE: "反转模式：默认方向按键已禁用。需要时请使用 Ctrl/CMD 临时启用。",
  ARROW_BINDING_NORMAL_MODE: "正常模式：方向键已启用。需要时请使用 Ctrl/CMD 临时禁用。",
  EXPORT_FILENAME_PROMPT: "请提供文件名",
  EXPORT_FILENAME_PROMPT_PLACEHOLDER: "请输入文件名，留空以取消操作",
  WARNING_SERIOUS_ERROR: "警告：Excalidraw 遇到了未知的问题!\n\n" +
    "您最近的更改可能无法保存。\n\n" +
    "为了安全起见，请按以下步骤操作：\n" +
    "1) 使用 Ctrl/CMD+A 选择您的绘图，然后使用 Ctrl/CMD+C 进行复制。\n" +
    "2) 然后在新窗格中，通过 Ctrl/CMD 点击 Excalidraw 功能区按钮创建一个空白绘图。\n" +
    "3) 最后，使用 Ctrl/CMD+V 将您的作品粘贴到新文件中。",
  ARIA_LABEL_TRAY_MODE: "托盘模式提供更宽敞的绘图空间",
  TRAY_TRAY_MODE: "切换托盘模式",
  TRAY_SCRIPT_LIBRARY: "脚本库",
  TRAY_SCRIPT_LIBRARY_ARIA: "浏览 Excalidraw 脚本库",
  TRAY_EXPORT: "导出绘图…",
  TRAY_EXPORT_ARIA: "导出绘图为 PNG、SVG、或 Excalidraw",
  TRAY_SAVE: "保存",
  TRAY_SWITCH_TO_MD: "打开为 Markdown",
  TRAY_SWITCH_TO_MD_ARIA: "切换至 Markdown 视图模式",
  MASK_FILE_NOTICE: "这是一个蒙版图像。长按本提示观看帮助视频。",
  INSTALL_SCRIPT_BUTTON: "安装或更新 Excalidraw 脚本",
  OPEN_AS_MD: "打开为 Markdown",
  EXPORT_IMAGE: `导出为图片`,
  OPEN_LINK: "打开所选元素里的链接 \n（按住 Shift 在新面板打开）",
  EXPORT_EXCALIDRAW: "导出为 .excalidraw 文件（旧版绘图文件格式）",
  LINK_BUTTON_CLICK_NO_TEXT:
    "请选择一个包含内部或外部链接的元素。\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR:
    "箭头和线条元素的链接无法通过 " + labelCTRL() + " + 点击元素来跳转，因为这也会激活线条编辑器。\n" +
    "请使用右键上下文菜单打开链接，或点击元素右上角的链接指示器。\n",
  FILENAME_INVALID_CHARS:
    '文件名不能包含以下符号： * " \\ < > : | ? #',
  FORCE_SAVE:
    "保存（同时更新嵌入了该绘图的 Markdown 文档）",
  RAW: "正以 RAW 模式显示链接\n点击切换到 PREVIEW 模式",
  PARSED:
    "正以 PREVIEW 模式显示链接\n点击切换到 RAW 模式",
  NOFILE: "Excalidraw（没有文件）",
  COMPATIBILITY_MODE:
    "*.excalidraw 是兼容旧版的绘图文件格式。需要转换为新格式才能解锁本插件的全部功能。",
  CONVERT_FILE: "转换为新格式",
  BACKUP_AVAILABLE: "加载绘图文件时出错，可能是由于 Obsidian 在上次保存时意外退出了（手机上更容易发生这种意外）。<br><br><b>好消息：</b>这台设备上存在备份。您是否想要恢复本设备上的备份？<br><br>（我建议您先尝试在最近使用过的其他设备上打开该绘图，以检查是否有更新的备份。）",
  BACKUP_RESTORED: "已恢复备份",
  BACKUP_SAVE_AS_FILE: "此绘图为空。但有一个非空的备份可用。您想将其恢复为新文件并在新标签页中打开吗？",
  BACKUP_SAVE: "恢复",
  BACKUP_DELETE: "删除备份",
  BACKUP_CANCEL: "取消",
  CACHE_NOT_READY: "抱歉，加载绘图文件时出错。<br><br><mark>现在有耐心，将来更省心。</mark><br><br>插件有备份机制，但您似乎刚打开 Obsidian，需要等待一分钟或更长的时间来读取缓存。缓存读取完毕时，您会在右上角收到通知。<br><br>请点击 OK 并耐心等待，或者，选择点击取消后手动修复文件。<br>",
  OBSIDIAN_TOOLS_PANEL: "Obsidian 工具面板",
  ERROR_SAVING_IMAGE: "获取图片时发生未知错误。可能是由于某种原因，图片不可用或拒绝了 Obsidian 的获取请求。",
  WARNING_PASTING_ELEMENT_AS_TEXT: "不能将 Excalidraw 元素粘贴为文本元素！",
  USE_INSERT_FILE_MODAL: "使用“嵌入文件”功能来嵌入 Markdown 文档",
  RECURSIVE_INSERT_ERROR: "不能将图像的一部分嵌入到此图像中，因为这可能导致无限循环。",
  CONVERT_TO_MARKDOWN: "转存为 Markdown 文档（并嵌入当前绘图）",
  SELECT_TEXTELEMENT_ONLY: "只选择文本元素（非容器）",
  REMOVE_LINK: "移除文字元素链接",
  LASER_ON: "启用激光笔",
  LASER_OFF: "关闭激光笔",
  WELCOME_RANK_NEXT: "张绘图之后，到达下一等级！",
  WELCOME_RANK_LEGENDARY: "您已是绘图大师，续写传奇吧！",
  WELCOME_COMMAND_PALETTE: '在命令面板中输入 "Excalidraw"',
  WELCOME_OBSIDIAN_MENU: "浏览右上角的 Obsidian 菜单",
  WELCOME_SCRIPT_LIBRARY: "访问脚本库",
  WELCOME_HELP_MENU: "点击汉堡菜单（三横线）获取帮助",
  WELCOME_YOUTUBE_ARIA: "Visual PKM 的 YouTube 频道",
  WELCOME_YOUTUBE_LINK: "查看 Visual PKM 的 YouTube 频道",
  WELCOME_DISCORD_ARIA: "加入 Discord 服务器",
  WELCOME_DISCORD_LINK: "加入 Discord 服务器",
  WELCOME_TWITTER_ARIA: "在 Twitter 上关注我",
  WELCOME_TWITTER_LINK: "在 Twitter 上关注我",
  WELCOME_LEARN_ARIA: "学习 Visual PKM（可视化个人知识管理）",
  WELCOME_LEARN_LINK: "报名加入视觉思维研讨会",
  WELCOME_DONATE_ARIA: "捐赠以支持 Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: '感谢并支持此插件。',
  SAVE_IS_TAKING_LONG: "保存您之前的文件花费的时间较长，请稍候…",
  SAVE_IS_TAKING_VERY_LONG: "为了更好的性能，请考虑将大型绘图拆分成几个较小的文件。",

  //ContentSearcher.ts
  SEARCH_COPIED_TO_CLIPBOARD: "Markdown 内容已复制到剪贴板",
  SEARCH_COPY_TO_CLIPBOARD_ARIA: "将整个设置对话框以 Markdown 格式复制到剪贴板。适合与 ChatGPT 等工具配合使用进行搜索和理解。",
  SEARCH_SHOWHIDE_ARIA: "显示/隐藏搜索栏",
  SEARCH_NEXT: "下一个",
  SEARCH_PREVIOUS: "上一个",



  //settings.ts
  NOTEBOOKLM_LINK_ARIA: "向 NotebookLM 咨询有关插件的帮助。此模型已预加载了我所有的视频转录稿、发布说明和其他帮助内容。与 NotebookLM 聊天，浏览我的 250+ 视频和 Excalidraw 文件。",
  NOTEBOOKLM_LINK_TEXT: "学习插件。访问 NotebookLM 知识库。",
  LINKS_BUGS_ARIA: "在插件的 GitHub 页面报告错误和提交功能请求",
  LINKS_BUGS: "报告错误",
  LINKS_YT_ARIA: "访问我的 YouTube 频道学习视觉思维和 Excalidraw",
  LINKS_YT: "在 YouTube 学习",
  LINKS_DISCORD_ARIA: "加入视觉思维研讨会 Discord 服务器",
  LINKS_DISCORD: "加入社区",
  LINKS_TWITTER: "关注我",
  LINKS_VTW_ARIA: "学习 Visual PKM、Excalidraw、Obsidian、ExcaliBrain 等内容",
  LINKS_VTW: "加入研讨会",
  LINKS_BOOK_ARIA: "阅读我的视觉思维著作《Sketch Your Mind》",
  LINKS_BOOK: "阅读书籍",
  LINKS_WIKI: "插件 Wiki",
  LINKS_WIKI_ARIA: "浏览 Excalidraw 插件 Wiki",

  RELEASE_NOTES_NAME: "显示更新说明",
  RELEASE_NOTES_DESC:
    "<b>开启：</b>每次更新本插件后，显示最新发行版本的说明。<br>" +
    "<b>关闭：</b>您仍可以在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a> 上阅读更新说明。",
  WARN_ON_MANIFEST_MISMATCH_NAME: "警告插件更新不完整",
  WARN_ON_MANIFEST_MISMATCH_DESC: "检查已安装的 Excalidraw 可执行文件是否与 Obsidian 插件列表中显示的版本一致。如果不一致（通常源于同步不完整），你会看到警告并可以选择更新。关闭该项可禁用检查。",
  NEWVERSION_NOTIFICATION_NAME: "插件更新通知",
  NEWVERSION_NOTIFICATION_DESC:
    "<b>开启：</b>当本插件存在可用更新时，显示通知。<br>" +
    "<b>关闭：</b>您需要手动检查插件更新（设置 - 第三方插件 - 检查更新）。",

  BASIC_HEAD: "基本",
  BASIC_DESC: `包括：更新说明，更新通知，新绘图文件、模板文件、脚本文件的存储路径等。`,
  FOLDER_NAME: "Excalidraw 文件夹（區分大小寫！）",
  FOLDER_DESC:
    "新绘图的默认存储路径。若为空，将在仓库根目录中创建新绘图。",
  CROP_SUFFIX_NAME: "裁剪文件的后缀",
  CROP_SUFFIX_DESC:
    "裁剪图像时创建的新绘图文件名的最后部分。" +
    "如果不需要后缀，请留空。",
  CROP_PREFIX_NAME: "裁剪文件的前缀",
  CROP_PREFIX_DESC:
    "裁剪图像时创建的新绘图文件名的第一部分。" +
    "如果不需要前缀，请留空。",
  ANNOTATE_SUFFIX_NAME: "标注文件的后缀",
  ANNOTATE_SUFFIX_DESC:
    "标注图像时创建的新绘图文件名的最后部分。" +
    "如果不需要后缀，请留空。",
  ANNOTATE_PREFIX_NAME: "标注文件的前缀",
  ANNOTATE_PREFIX_DESC:
    "标注图像时创建的新绘图文件名的第一部分。" +
    "如果不需要前缀，请留空。",
  ANNOTATE_PRESERVE_SIZE_NAME: "在标注时保留图像尺寸",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "当在 Markdown 中标注图像时，替换后的图像链接将包含原始图像的宽度。",
  CROP_FOLDER_NAME: "裁剪文件所在文件夹（區分大小寫！）",
  CROP_FOLDER_DESC:
    "裁剪图像时创建的新绘图的默认存储路径。如果留空，将按照仓库附件设置创建。",
  ANNOTATE_FOLDER_NAME: "标注文件所在文件夹（區分大小寫！）",
  ANNOTATE_FOLDER_DESC:
    "标注图像时创建的新绘图的默认存储路径。如果留空，将按照仓库附件设置创建。",
  FOLDER_EMBED_NAME:
    "将 Excalidraw 文件夹用于“新建绘图”系列命令",
  FOLDER_EMBED_DESC:
    "在命令面板中执行“新建绘图”系列命令时，" +
    "新建的绘图文件的存储路径。<br>" +
    "<b>开启：</b>使用上面的 Excalidraw 文件夹。 <br><b>关闭：</b>使用 Obsidian 设置的新附件默认位置。",
  TEMPLATE_NAME: "Excalidraw 模板文件（區分大小寫！）",
  TEMPLATE_DESC:
    "Excalidraw 模板文件（文件夹）的存储路径。<br>" +
    "<b>模板文件：</b>例如：您的模板在默认的 Excalidraw 文件夹中且文件名是 Template.md，" +
    "则该项应设为 Excalidraw/Template.md 或 Excalidraw/Template（省略 .md 扩展名）。<br>" +
    "如果您在兼容模式下使用 Excalidraw，那么您的模板文件也必须是旧的 *.excalidraw 格式，" +
    "如 Excalidraw/Template.excalidraw。<br><b>模板文件夹：</b> 您还可以将文件夹设置为模板。" +
    "这时，创建新绘图时将提示您选择使用哪个模板。<br>" +
    "<b>专业提示：</b> 如果您正在使用 Obsidian Templater 插件，您可以将 Templater 代码添加到不同的" +
    "Excalidraw 模板中，以自动配置您的绘图。",
  SCRIPT_FOLDER_NAME: "Excalidraw 自动化脚本所在文件夹（區分大小寫！）",
  SCRIPT_FOLDER_DESC:
    "此文件夹用于存放 Excalidraw 自动化脚本。" +
    "您可以在 Obsidian 命令面板中执行这些脚本，" +
    "还可以为喜欢的脚本分配快捷键，就像为其他 Obsidian 命令分配快捷键一样。<br>" +
    "该项不能设为仓库根目录。",
  AI_HEAD: "AI（实验性）",
  AI_DESC: `OpenAI GPT API 的设置。` +
    `目前 OpenAI API 还处于测试阶段，您需要使用自己的 API key。` +
    `创建 OpenAI 账户，充值至少 5 美元，生成 API key，` +
    `然后就可以在 Excalidraw 中配置并使用 AI。`,
  AI_ENABLED_NAME: "启用 AI 功能",
  AI_ENABLED_DESC: "您需要重新打开 Excalidraw 才能使更改生效。",
  AI_OPENAI_TOKEN_NAME: "OpenAI API key",
  AI_OPENAI_TOKEN_DESC:
    "您可以访问您的 <a href='https://platform.openai.com/api-keys'>OpenAI 账户</a> 来获取自己的 OpenAI API key。",
  AI_OPENAI_TOKEN_PLACEHOLDER: "OpenAI API key",
  AI_OPENAI_DEFAULT_MODEL_NAME: "默认的文本 AI 模型",
  AI_OPENAI_DEFAULT_MODEL_DESC:
    "使用哪个 AI 模型来生成文本。请填写有效的 OpenAI 模型名称。" +
    "您可访问 <a href='https://platform.openai.com/docs/models'>OpenAI 网站</a> 了解更多模型信息。",
  AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER: "gpt-3.5-turbo-1106",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME: "默认的图片 AI 模型",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC:
    "使用哪个 AI 模型来生成图片。图生图会强制使用 dall-e-2 模型，" +
    "因为目前只有该模型支持 Image editing and variations。" +
    "请填写有效的 OpenAI 模型名称。" +
    "您可访问 <a href='https://platform.openai.com/docs/models'>OpenAI 网站</a> 了解更多模型信息。",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER: "dall-e-3",
  AI_OPENAI_DEFAULT_VISION_MODEL_NAME: "默认的 AI 视觉模型",
  AI_OPENAI_DEFAULT_VISION_MODEL_DESC:
    "根据文本生成图片时，使用哪个 AI 视觉模型。请填写有效的 OpenAI 模型名称。" +
    "您可访问 <a href='https://platform.openai.com/docs/models'>OpenAI 网站</a> 了解更多模型信息。",
  AI_OPENAI_DEFAULT_API_URL_NAME: "OpenAI API URL",
  AI_OPENAI_DEFAULT_API_URL_DESC:
    "默认的 OpenAI API URL。请填写有效的 OpenAI API URL。" +
    "Excalidraw 会通过该 URL 发送 API 请求给 OpenAI。我没有对该项做任何错误处理，请谨慎修改。",
  AI_OPENAI_DEFAULT_IMAGE_API_URL_NAME: "OpenAI 图片生成 API URL",
  AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER: "输入默认 AI 模型名称，如 gpt-4o",
  SAVING_HEAD: "保存",
  SAVING_DESC: "包括：压缩，自动保存的时间间隔，文件的命名格式和扩展名等。",
  COMPRESS_NAME: "压缩 Excalidraw JSON",
  COMPRESS_DESC:
    "Excalidraw 默认将元素记录为 JSON 格式。开启该项，可将元素的 JSON 数据以 Base64 编码" +
    "（使用 <a href='https://pieroxy.net/blog/pages/lz-string/index.html'>LZ-String</a> 算法）。" +
    "这样一方面可以避免原来的明文 JSON 数据干扰 Obsidian 的文本搜索结果，" +
    "另一方面减小了绘图文件的体积。<br>" +
    "当您通过菜单按钮或命令将绘图切换至 Markdown 视图模式时，" +
    "数据将被解码回 JSON 格式以便阅读和编辑；" +
    "而当您切换回 Excalidraw 模式时，数据就会被再次编码。<br>" +
    "开启该项后，对于之前已存在但未压缩的绘图文件，" +
    "需要重新打开并保存才能生效。",
  DECOMPRESS_FOR_MD_NAME: "在 Markdown 视图中解压缩 Excalidraw JSON",
  DECOMPRESS_FOR_MD_DESC:
    "通过启用此功能，Excalidraw 将在切换到 Markdown 视图时自动解压缩绘图 JSON。" +
    "这将使您能够轻松阅读和编辑 JSON 字符串。" +
    "一旦您切换回 Excalidraw 视图并保存绘图（Ctrl+S），绘图将再次被压缩。<br>" +
    "我建议关闭此功能，因为这可以获得更小的文件尺寸，并避免在 Obsidian 搜索中出现不必要的结果。" +
    "您始终可以使用命令面板中的“Excalidraw: 解压缩当前 Excalidraw 文件”命令" +
    "在需要阅读或编辑时手动解压缩绘图 JSON。",
  AUTOSAVE_INTERVAL_DESKTOP_NAME: "桌面端自动保存时间间隔",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "每隔多长时间自动保存一次。如果绘图文件没有发生改变，将不会保存。" +
    "当 Obsidian 应用内的焦点离开活动文件，如关闭某个标签页、点击功能区、切换到其他标签页等时，也会触发自动保存；" +
    "直接退出 Obsidian 应用（不管是终结进程还是点关闭按钮）不会触发自动保存。",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "移动端自动保存时间间隔",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "建议在移动端设置更短的时间间隔。" +
    "当 Obsidian 应用内的焦点离开活动文件时，也会触发自动保存；" +
    "直接退出 Obsidian 应用（在应用切换器中划掉）不会触发自动保存。" +
    "此外，当您切换到其他应用时，有时系统会自动清理 Obsidian 后台以释放资源。这种情况下，自动保存会失效。",
  FILENAME_HEAD: "文件名",
  FILENAME_DESC:
    "<p>点击阅读 " +
    "<a href='https://momentjs.com/docs/#/displaying/format/'>日期和时间格式参考</a>。</p>",
  FILENAME_SAMPLE: "“新建绘图”系列命令创建的文件名如：",
  FILENAME_EMBED_SAMPLE: "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名如：",
  FILENAME_PREFIX_NAME: "“新建绘图”系列命令创建的文件名前缀",
  FILENAME_PREFIX_DESC: "“新建绘图”系列命令创建的文件名的第一部分",
  FILENAME_PREFIX_EMBED_NAME:
    "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名前缀",
  FILENAME_PREFIX_EMBED_DESC:
    "执行“新建绘图并嵌入到当前 Markdown 文档中”系列命令时，" +
    "创建的绘图文件名是否以当前文档名作为前缀？<br>" +
    "<b>开启：</b>是。<b>关闭：</b>否。",
  FILENAME_POSTFIX_NAME:
    "“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的文件名的中间部分",
  FILENAME_POSTFIX_DESC:
    "介于文件名前缀和日期时间之间的文本。仅对“新建绘图并嵌入到当前 Markdown 文档中”系列命令创建的绘图生效。",
  FILENAME_DATE_NAME: "文件名里的日期时间",
  FILENAME_DATE_DESC:
    "文件名的最后一部分。允许留空。",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: "文件扩展名（.excalidraw.md 或 .md）",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "该项在非 Excalidraw Markdown 文档（兼容模式）不会生效。<br>" +
    "<b>开启：</b>使用 .excalidraw.md 作为扩展名。<br><b>关闭：</b>使用 .md 作为扩展名。",
  DISPLAY_HEAD: "界面 & 行为",
  DISPLAY_DESC: "包括：左手模式、动态样式、匹配 Excalidraw 和 Obsidian 主题、默认运行模式等。",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME: "限制 Obsidian 字体大小为编辑器文本",
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC:
    "Obsidian 的自定义字体大小设置会影响整个界面，包括 Excalidraw 和依赖默认字体大小的主题。" +
    "启用该项将限制字体大小更改为编辑器文本，这将改善 Excalidraw 的外观。" +
    "如果启用后发现界面的某些部分看起来不正确，请尝试关闭该项。",
  DYNAMICSTYLE_NAME: "动态样式",
  DYNAMICSTYLE_DESC:
    "根据绘图颜色自动调整 Excalidraw 界面颜色",
  LEFTHANDED_MODE_NAME: "左手模式",
  LEFTHANDED_MODE_DESC:
    "目前只在托盘模式下生效。控制托盘（绘图工具属性页）位置。" +
    "<br><b>开启：</b>左手模式 - 位于右侧。<b>关闭：</b>右手模式 - 位于左侧。",
  IFRAME_MATCH_THEME_NAME: "使 Embeddable 匹配 Excalidraw 主题",
  IFRAME_MATCH_THEME_DESC:
    "<b>开启：</b>当 Obsidian 和 Excalidraw 一个使用深色主题、一个使用浅色主题时，" +
    "开启该项后，以交互形式嵌入到绘图中的元素将会匹配 Excalidraw 主题。<br>" +
    "<b>关闭：</b>如果您想要 Embeddable 匹配 Obsidian 主题，请关闭该项。",
  MATCH_THEME_NAME: "使新建的绘图匹配 Obsidian 主题",
  MATCH_THEME_DESC:
    "如果 Obsidian 使用深色主题，新建的绘图文件也将使用深色主题。<br>" +
    "但是若设置了模板，新建的绘图文件将跟随模板主题；另外，此功能不会作用于已有的绘图。" +
    "<br><b>开启：</b>跟随 Obsidian 主题。<br><b>关闭：</b>跟随模板主题。",
  MATCH_THEME_ALWAYS_NAME: "使已有的绘图匹配 Obsidian 主题",
  MATCH_THEME_ALWAYS_DESC:
    "如果 Obsidian 使用深色主题，则绘图文件也将以深色主题打开；反之亦然。" +
    "<br><b>开启：</b>匹配 Obsidian 主题。<br><b>关闭：</b>采用上次保存时的主题。",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw 主题跟随 Obsidian 主题变化",
  MATCH_THEME_TRIGGER_DESC:
    "开启该项，则切换 Obsidian 的深色/浅色主题时，已打开的 Excalidraw 面板的主题会随之改变。" +
    "<br><b>开启：</b>跟随主题变化。<br><b>关闭：</b>不跟随主题变化。",
  DEFAULT_OPEN_MODE_NAME: "Excalidraw 的默认运行模式",
  DEFAULT_OPEN_MODE_DESC:
    "设置 Excalidraw 的运行模式：普通模式（Normal）/禅模式（Zen）/查看模式（View）。<br>" +
    "可为某个绘图单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-default-mode: normal/zen/view</code> 的键值对。",
  DEFAULT_PEN_MODE_NAME: "触控笔模式（Pen mode）",
  DEFAULT_PEN_MODE_DESC:
    "打开绘图时，是否自动开启触控笔模式？",
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME: "启用双击文本创建",
  DISABLE_DOUBLE_TAP_ERASER_NAME: "启用手写模式下的双击橡皮擦功能",
  DISABLE_SINGLE_FINGER_PANNING_NAME: "启用手写模式下的单指平移功能",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "在触控笔模式下显示十字准星（+）",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "在触控笔模式下使用涂鸦功能会显示十字准星。<b>开启：</b>显示。<b>关闭：</b>隐藏。<br>" +
    "效果取决于设备。十字准星通常在绘图板、MS Surface 上可见，但在 iOS 上不可见。",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME: "鼠标悬停预览时 Excalidraw 将渲染为图像",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "…即使文件具有 <code>excalidraw-open-md: true</code> 笔记属性。<br>" +
    "当该项关闭且设置了默认打开为 Markdown 时，" +
    "悬停预览将显示 Markdown 模式的绘图。<br>" +
    "注意：<b>excalidraw-open-md</b> 不同于 <b>excalidraw-embed-md</b>。如果 <b>excalidraw-embed-md</b> 设置为 true，则悬停预览始终显示 Markdown 模式的绘图，不受该项影响。要强制将嵌入到 Markdown 文档的绘图渲染为图像，请使用 <code>![[drawing#^as-image]]</code>。",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME: "Markdown 模式的 Excalidraw 在阅读模式将渲染为图像",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC:
    "当您在 Markdown Reading 模式（又名“阅读绘图的背景笔记”）时，Excalidraw 绘图是否渲染为图像。<br>" +
    "该项不会影响：Excalidraw 模式的、嵌入到 Markdown 文档的、或悬停预览时的绘图显示。<br>" +
    "请参阅余下部分中与 <a href='#" + TAG_MDREADINGMODE + "'>Markdown Reading 模式</a> 相关的其他设置。<br>" +
    "⚠️ 关闭并重新打开 Excalidraw/Markdown 文件后生效。",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME: "在 Obsidian 中导出为 PDF 时 Excalidraw 将渲染为图片",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC:
    "该项控制在使用 Obsidian 内置的 <b>导出为 PDF</b> 功能，如何将 Excalidraw 文件导出为 PDF。<br>" +
    "<ul><li><b>启用：</b>PDF 将包含 Excalidraw 绘图图片。</li>" +
    "<li><b>禁用：</b>PDF 将包含 Markdown 模式的绘图。</li></ul>" +
    "注意：该项不会影响 Excalidraw 本身的 PDF 导出功能。<br>" +
    "请参阅下方 <a href='#"+TAG_PDFEXPORT+"'>PDF 导出设置</a>。<br>" +
    "⚠️ 关闭并重新打开 Excalidraw/Markdown 文件后生效。",
  HOTKEY_OVERRIDE_HEAD: "热键覆盖",
  HOTKEY_OVERRIDE_DESC: `一些 Excalidraw 的热键，如 ${labelCTRL()}+Enter 用于编辑文本，或 ${labelCTRL()}+K 用于创建元素链接，` +
    "与 Obsidian 的热键设置冲突。您在下面添加的热键组合将在使用 Excalidraw 时覆盖 Obsidian 的热键设置，" +
    `因此如果您希望在 Excalidraw 中默认“编组”，而不是“查看关系图谱”（核心插件 - 关系图谱），您可以添加 ${labelCTRL()}+G。`,
  THEME_HEAD: "主题和样式",
  ZOOM_AND_PAN_HEAD: "缩放和平移",
  PAN_WITH_RIGHT_MOUSE_BUTTON_NAME: "右键拖动平移",
  PAN_WITH_RIGHT_MOUSE_BUTTON_DESC: "右键点击并拖动来平移绘图（和在线白板工具 Miro 类似）。按 'm' 键打开上下文菜单。",
  DEFAULT_PINCHZOOM_NAME: "允许在触控笔模式下进行双指缩放",
  DEFAULT_PINCHZOOM_DESC:
    "在触控笔模式下使用自由画笔工具时，双指缩放可能造成干扰。<br>" +
    "<b>开启：</b>允许双指缩放。<b>关闭： </b>禁止双指缩放。",

  DEFAULT_WHEELZOOM_NAME: "鼠标滚轮缩放",
  DEFAULT_WHEELZOOM_DESC:
    `<b>开启：</b>鼠标滚轮为缩放绘图，${labelCTRL()}+鼠标滚轮为滚动绘图。<br><b>关闭：</b>鼠标滚轮为滚动绘图，${labelCTRL()}+鼠标滚轮为缩放绘图。`,

  ZOOM_TO_FIT_NAME: "调整面板尺寸后自动缩放",
  ZOOM_TO_FIT_DESC: "调整面板尺寸后，自适应地缩放绘图。" +
    "<br><b>开启：</b>自动缩放。<b>关闭：</b>禁用自动缩放。",
  ZOOM_TO_FIT_ONOPEN_NAME: "打开绘图时自动缩放",
  ZOOM_TO_FIT_ONOPEN_DESC: "打开绘图文件时，自适应地缩放绘图。" +
    "<br><b>开启：</b>自动缩放。<b>关闭：</b>禁用自动缩放。",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "自动缩放的最高级别",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "自动缩放绘图时，允许放大的最高级别。该值不能低于 0.5（50%）且不能超过 10（1000%）。",
  ZOOM_STEP_NAME: "缩放增量",
  ZOOM_STEP_DESC: "执行缩放操作时，每次缩放的百分比增量。该值越小，控制精度越高，但完成同样的缩放需要操作更多次。默认：5%。",
  ZOOM_MIN_NAME: "最小缩放",
  ZOOM_MIN_DESC: "绘图缩小（显示更多内容）的极限。默认：10%。低于 10% 可能不稳定——谨慎调低，出现问题请重置为 10%。",
  ZOOM_MAX_NAME: "最大缩放",
  ZOOM_MAX_DESC: "绘图放大的极限。默认：3000%。通常无需修改，考虑完整性而提供。",
  PEN_HEAD: "手写笔",
  GRID_HEAD: "网格",
  GRID_DYNAMIC_COLOR_NAME: "动态网格颜色",
  GRID_DYNAMIC_COLOR_DESC:
    "<b>开启：</b>更改网格颜色以匹配绘图颜色。<br><b>关闭：</b>将以下颜色用作网格颜色。",
  GRID_COLOR_NAME: "网格颜色",
  GRID_OPACITY_NAME: "网格透明度",
  GRID_OPACITY_DESC: "设置网格的透明度。还将控制将箭头绑定到元素时绑定框的透明度。" +
    "0 全透明 ⟺ 100 不透明。",
  GRID_DIRECTION_NAME: "网格方向",
  GRID_DIRECTION_DESC: "第一个开关显示/隐藏水平网格，第二个开关显示/隐藏垂直网格。",
  GRID_HORIZONTAL: "渲染水平网格",
  GRID_VERTICAL: "渲染垂直网格",
  LASER_HEAD: "激光笔工具（更多工具 > 激光笔）",
  LASER_COLOR: "激光笔颜色",
  LASER_DECAY_TIME_NAME: "激光笔消失时间",
  LASER_DECAY_TIME_DESC: "单位是毫秒，默认 1000（即 1 秒）。",
  LASER_DECAY_LENGTH_NAME: "激光笔轨迹长度",
  LASER_DECAY_LENGTH_DESC: "默认 50。",
  LINKS_HEAD: "链接 & 待办任务（Todo）& 嵌入到绘图中的 Markdown 文档（MD-Transclusion）",
  LINKS_HEAD_DESC: "包括：链接的打开和显示，Todo 的显示，MD-Transclusion 的显示等。",
  LINKS_DESC:
    `按住 ${labelCTRL()} 并点击包含 <code>[[链接]]</code> 的文本元素可以打开其中的链接。<br>` +
    "如果所选文本元素包含多个 <code>[[有效的内部链接]]</code> ，只会打开第一个链接；<br>" +
    "如果所选文本元素包含有效的 URL 链接（如 <code>https://</code> 或 <code>http://</code>），" +
    "插件会在浏览器中打开链接。<br>" +
    "链接的源文件被重命名时，绘图中相应的 <code>[[内部链接]]</code> 也会同步更新。" +
    "若您不愿绘图中的链接外观因此而变化，可使用 <code>[[内部链接|别名]]</code>。",
  DRAG_MODIFIER_NAME: "修饰键",
  DRAG_MODIFIER_DESC: "在您按住点击链接或拖动元素时，可以触发某些行为。您可以为这些行为添加修饰键。" +
    "Excalidraw 不会检查您的设置是否合理，因此请谨慎设置，避免冲突。" +
    "以下选项在苹果和非苹果设备上区别很大，如果您在多个硬件平台上使用 Obsidian，需要分别进行设置。" +
    "选项里的 4 个开关依次代表 " +
    (DEVICE.isIOS || DEVICE.isMacOS ? "Shift, CMD, OPT, CONTROL." : "Shift, Ctrl, Alt, Meta (Win 键)。"),
  LONG_PRESS_DESKTOP_NAME: "长按打开（电脑端）",
  LONG_PRESS_DESKTOP_DESC: "长按打开在 Markdown 文档中嵌入的 Excalidraw 绘图。单位：毫秒。",
  LONG_PRESS_MOBILE_NAME: "长按打开（移动端）",
  LONG_PRESS_MOBILE_DESC: "长按打开在 Markdown 文档中嵌入的 Excalidraw 绘图。单位：毫秒。",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE: "在查看模式下允许双击打开链接",

  FOCUS_ON_EXISTING_TAB_NAME: "聚焦于当前标签页",
  FOCUS_ON_EXISTING_TAB_DESC: "当打开一个链接时，如果该文件已经打开，Excalidraw 将会聚焦到现有的标签页上。" +
    "启用该项时，如果文件已打开，将覆盖“在相邻面板中打开”，但“打开所选绘图的背景笔记”命令面板操作除外。",
  SECOND_ORDER_LINKS_NAME: "显示二级链接",
  SECOND_ORDER_LINKS_DESC: "在 Excalidraw 中打开链接时显示链接及二级链接。二级链接是指向被点击链接的反向链接。" +
    "当使用例如图标的嵌入链接时，二级链接可以直达组成它的相关笔记，无需点击两次。" +
    "观看 <a href='https://youtube.com/shorts/O_1ls9c6wBY?feature=share'>这个 YouTube Shorts 视频</a> 以了解更多信息。",
  ADJACENT_PANE_NAME: "在相邻面板中打开",
  ADJACENT_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 并点击绘图里的内部链接时，插件默认会在新面板中打开该链接。<br>` +
    "若开启该项，Excalidraw 会先尝试寻找已有的相邻面板（按照右侧、左侧、上方、下方的顺序），" +
    "并在其中打开该链接。如果找不到，" +
    "再在新面板中打开。",
  MAINWORKSPACE_PANE_NAME: "在主工作区中打开",
  MAINWORKSPACE_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 并点击绘图里的内部链接时，插件默认会在当前窗口的新面板中打开该链接。<br>` +
    "若开启该项，Excalidraw 会在主工作区的面板中打开该链接。",
  LINK_BRACKETS_NAME: "在链接的两侧显示 <code>[[中括号]]</code>",
  LINK_BRACKETS_DESC: `${
    "文本元素处于 PREVIEW 模式时，在内部链接的两侧显示中括号。<br>" +
    "可为某个绘图单独设置该项，方法是在其 frontmatter 中添加如 <code>"
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> 的键值对。`,
  LINK_PREFIX_NAME: "内部链接的前缀",
  LINK_PREFIX_DESC: `${
    "文本元素处于 PREVIEW 模式时，如果其中包含链接，则添加此前缀。<br>" +
    "可为某个绘图单独设置该项，方法是在其 frontmatter 中添加如 <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> 的键值对。`,
  URL_PREFIX_NAME: "外部链接的前缀",
  URL_PREFIX_DESC: `${
    "文本元素处于 PREVIEW 模式时，如果其中包含外部链接，则添加此前缀。<br>" +
    "可为某个绘图单独设置该项，方法是在其 frontmatter 中添加如 <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> 的键值对。`,
  PARSE_TODO_NAME: "待办任务（Todo）",
  PARSE_TODO_DESC: "将文本元素中的 <code>- [ ]</code> 和 <code>- [x]</code> 前缀显示为方框。",
  TODO_NAME: "未完成项目",
  TODO_DESC: "未完成的待办项目的符号",
  DONE_NAME: "已完成项目",
  DONE_DESC: "已完成的待办项目的符号",
  HOVERPREVIEW_NAME: "鼠标悬停预览内部链接",
  HOVERPREVIEW_DESC:
    `<b>开启：</b>在 Excalidraw <u>查看模式（View）</u>下，鼠标悬停在 <code>[[内部链接]]</code> 上即可预览；` +
    "而在<u>普通模式（Normal）</u>下，鼠标悬停在内部链接右上角的蓝色标识上即可预览。<br>" +
    `<b>关闭：</b>鼠标悬停在 <code>[[内部链接]]</code> 上，并且按住 ${labelCTRL()} 才能预览。`,
  LINKOPACITY_NAME: "链接标识的透明度",
  LINKOPACITY_DESC:
    "含有链接的元素，其右上角的链接标识的透明度。0 全透明 ⟺ 100 不透明。",
  LINK_CTRL_CLICK_NAME:
    `按住 ${labelCTRL()} 并点击含有 [[链接]] 或 [别名](链接) 的文本来打开链接`,
  LINK_CTRL_CLICK_DESC:
    "如果此功能影响到您使用某些原版 Excalidraw 功能，可将其关闭。" +
    `关闭后，您可以使用 ${labelCTRL()} + ${labelMETA()} 或者元素右上角的链接指示器来打开链接。`,
  TRANSCLUSION_WRAP_NAME: "MD-Transclusion 的折行方式",
  TRANSCLUSION_WRAP_DESC:
    "中的 number 表示嵌入的文本溢出时，在第几个字符处进行折行。<br>" +
    "此开关控制具体的折行方式。<b>开启：</b>严格在 number 处折行，禁止溢出；" +
    "<b>关闭：</b>允许在 number 位置后最近的空格处折行。",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "MD-Transclusion 的默认折行位置",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "除了通过 <code>![[doc#^block]]{number}</code> 中的 number 来控制折行位置，您也可以在此设置 number 的默认值。<br>" +
    "一般设为 0 即可，表示不设置固定的默认值，这样当您需要嵌入文档到便签中时，" +
    "Excalidraw 能更好地帮您自动处理。",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "MD-Transclusion 的最大显示字符数",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "通过 <code>![[内部链接]]</code> 或 <code>![](内部链接)</code> 格式，将文档以文本形式嵌入到绘图中时，" +
    "该文档在绘图中可显示的最大字符数量。",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "隐藏 MD-Transclusion 行首的引用符号",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "不显示 MD-Transclusion 中每一行行首的 > 符号，以提高纯文本 MD-Transclusion 的可读性。<br>" +
    "<b>开启：</b>隐藏 > 符号。<b>关闭：</b>不隐藏 > 符号。<br>注意，由于 Obsidian API 的原因，首行行首的 > 符号不会被隐藏。",
  GET_URL_TITLE_NAME: "使用 iframly 获取页面标题",
  GET_URL_TITLE_DESC:
    "拖动链接到 Excalidraw 时，使用 <code>http://iframely.server.crestify.com/iframely?url=</code> 来获取页面的标题。",
  PDF_TO_IMAGE: "以图像形式嵌入到绘图中的 PDF",
  PDF_TO_IMAGE_SCALE_NAME: "分辨率",
  PDF_TO_IMAGE_SCALE_DESC: "分辨率越高，图像越清晰，但内存占用也越大。" +
    "此外，如果您想要复制这些图像到 Excalidraw.com，可能会超出其 2MB 大小的限制。",
  EMBED_TOEXCALIDRAW_HEAD: "嵌入到绘图中的文件",
  EMBED_TOEXCALIDRAW_DESC: "包括：以图像形式嵌入到绘图中的 PDF、以交互或图像形式嵌入到绘图中的 Markdown 文档等。",
  MD_HEAD: "以图像形式嵌入到绘图中的 Markdown 文档（MD-Embed）",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "以交互形式嵌入到绘图中的 Markdown 文档（MD-Embeddable）",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `以下设置只会影响以后的嵌入。已存在的嵌入保持不变。嵌入框的主题设置位于“界面 & 行为”部分。`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "单击以编辑嵌入的 Markdown",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "单击嵌入的 Markdown 文档以进行编辑。 " +
    "当此功能关闭时，Markdown 文档将首先以预览模式打开，然后在您再次单击时切换到编辑模式。",
  MD_TRANSCLUDE_WIDTH_NAME: "MD-Embed 的默认宽度",
  MD_TRANSCLUDE_WIDTH_DESC:
    "该项会影响到折行，以及图像的宽度。<br>" +
    "可为绘图中的某个 MD-Embed 单独设置，方法是将绘图切换至 Markdown 视图模式，" +
    "并修改相应的 <code>[[Embed 文件名#标题|宽度x最大高度]]</code>。",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "MD-Embed 的默认最大高度",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "MD-Embed 的高度取决于 Markdown 文档内容的多少，但最大不会超过该值。<br>" +
    "可为绘图中的某个 MD-Embed 单独设置，方法是将绘图切换至 Markdown 视图模式，并修改相应的 <code>[[Embed 文件名#^块引ID|宽度x最大高度]]</code>。",
  MD_DEFAULT_FONT_NAME:
    "MD-Embed 的默认字体",
  MD_DEFAULT_FONT_DESC:
    "可以设为 Virgil、Casadia 或其他有效的 .ttf/.woff/.woff2 字体文件，如 <code>我的字体.woff2</code>。<br>" +
    "可为某个 MD-Embed 单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-font: 字体名或文件名</code> 的键值对。",
  MD_DEFAULT_COLOR_NAME:
    "MD-Embed 的默认文本颜色",
  MD_DEFAULT_COLOR_DESC:
    "可以填写 HTML 颜色名，如 steelblue（参考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 进制颜色值，如 #e67700，或者任何其他有效的 CSS 颜色。<br>" +
    "可为某个 MD-Embed 单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-font-color: steelblue</code> 的键值对。",
  MD_DEFAULT_BORDER_COLOR_NAME:
    "MD-Embed 的默认边框颜色",
  MD_DEFAULT_BORDER_COLOR_DESC:
    "可以填写 HTML 颜色名，如 steelblue（参考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 进制颜色值，如 #e67700，或者任何其他有效的 CSS 颜色。<br>" +
    "可为某个 MD-Embed 单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-border-color: gray</code> 的键值对。<br>" +
    "如果您不想要边框，请留空。",
  MD_CSS_NAME: "MD-Embed 的默认 CSS 样式表",
  MD_CSS_DESC:
    "MD-Embed 图像所采用的 CSS 样式表文件名。需包含扩展名，如 md-embed.css。" +
    "允许使用 Markdown 文档（如 md-embed-css.md），但其内容应符合 CSS 语法。<br>" +
    "如果您要查询 CSS 所作用的 HTML 节点，请在 Obsidian 开发者控制台（Ctrl+Shift+I）中键入命令：" +
    "<code>ExcalidrawAutomate.mostRecentMarkdownSVG</code> —— 这将显示 Excalidraw 最近生成的 SVG。<br>" +
    "此外，在 CSS 中不能任意地设置字体，您一般只能使用系统默认的标准字体（详见 README），" +
    "但可以通过上面的选项来额外添加一个自定义字体。<br>" +
    "可为某个 MD-Embed 单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-css: 仓库中的 CSS 文件或 CSS 片段</code> 的键值对。",
  EMBED_HEAD: "嵌入到 Markdown 文档中的绘图",
  EMBED_DESC: `包括：嵌入到 Markdown 文档中的绘图的预览图类型（SVG、PNG）、源文件类型（Excalidraw、SVG、PNG）、缓存、图像尺寸、图像主题，以及嵌入的语法等。
    此外，还有自动导出 SVG 或 PNG 文件并保持与绘图文件状态同步的设置。`,
  EMBED_CANVAS: "Obsidian 白板支持",
  EMBED_CANVAS_NAME: "沉浸式嵌入",
  EMBED_CANVAS_DESC:
    "当嵌入绘图到 Obsidian 白板中时，隐藏节点的边界和背景。" +
    "注意：如果想要背景完全透明，您依然需要设置导出背景为透明（关闭“导出图片包含背景”）。",
  EMBED_CACHING: "图像缓存和渲染优化",
  RENDERING_CONCURRENCY_NAME: "图像渲染并发性",
  RENDERING_CONCURRENCY_DESC:
    "用于图像渲染的并行工作线程数。增加该值可以加快渲染速度，但可能会减慢系统其他部分的运行速度。" +
    "默认值为 3。如果您的系统性能强大，可以增加该值。",
  EXPORT_SUBHEAD: "导出",
  EMBED_SIZING: "图像尺寸",
  EMBED_THEME_BACKGROUND: "图像的主题和背景色",
  EMBED_IMAGE_CACHE_NAME: "为嵌入到 Markdown 文档中的绘图创建预览图缓存",
  EMBED_IMAGE_CACHE_DESC: "可提高下次嵌入的速度。" +
    "但如果绘图包含子绘图，（当子绘图改变时）您需要打开父绘图并手动保存，才能够更新预览图。",
  SCENE_IMAGE_CACHE_NAME: "缓存场景中嵌套的绘图",
  SCENE_IMAGE_CACHE_DESC: "Excalidraw 将智能地尝试识别嵌套的绘图的子元素是否发生变化，并更新缓存。" +
    "这将加快渲染过程，特别是在您的场景中有深度嵌套的绘图时。<br>" +
    "如果您怀疑缓存未能正确更新，您可能需要关闭此功能。",
  EMBED_IMAGE_CACHE_CLEAR: "清除缓存",
  BACKUP_CACHE_CLEAR: "清除备份",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "该操作将删除所有绘图文件的备份。备份是绘图文件损坏时的一种补救手段。每次您打开 Obsidian 时，本插件会自动清理无用的备份。您确定要现在删除所有备份吗？",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "将之前已导出图片作为预览图",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "该项与下方“导出”部分“导出设置”中的 <a href='#"+TAG_AUTOEXPORT+"'>自动导出 SVG/PNG 副本</a> 选项配合使用。如果嵌入到 Markdown 文档中的绘图文件存在同名的 SVG/PNG 副本，则将其作为预览图，而不再重新生成。<br>" +
    "该项能够提高 Markdown 文档的打开速度，尤其是当嵌入到 Markdown 文档中的绘图文件中含有大量图片或 MD-Embed 时。" +
    "但是，该项也可能导致预览图无法立即响应绘图文件或者 Obsidian 主题的修改。<br>" +
    "该项仅作用于嵌入到 Markdown 文档中的绘图。" +
    "该项无法提升绘图文件的打开速度。详见 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.23' target='_blank'>此说明</a>。",
  /*EMBED_PREVIEW_SVG_NAME: "生成 SVG 格式的预览图",
  EMBED_PREVIEW_SVG_DESC:
    "<b>开启：</b>为嵌入到 Markdown 文档中的绘图生成 <a href='https://en.wikipedia.org/wiki/Scalable_Vector_Graphics' target='_blank'>SVG</a> 格式的预览图。<br>" +
    "<b>关闭：</b>为嵌入到 Markdown 文档中的绘图生成 <a href='' target='_blank'>PNG</a> 格式的预览图。注意：PNG 格式预览图不支持某些 <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>绘图元素的块引用特性</a>。",*/
  EMBED_PREVIEW_IMAGETYPE_NAME: "预览图的格式",
  EMBED_PREVIEW_IMAGETYPE_DESC:
    "<b>Native SVG：</b>高品质、可交互。<br>" +
    "<b>SVG：</b>高品质、不可交互。<br>" +
    "<b>PNG：</b>高性能、<a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>不可交互</a>。",
  PREVIEW_MATCH_OBSIDIAN_NAME: "预览图匹配 Obsidian 主题",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "开启该项，则当 Obsidian 处于深色主题时，嵌入到 Markdown 文档中的绘图的预览图也会以深色主题渲染；当 Obsidian 处于浅色主题时，预览图也会以浅色主题渲染。<br>" +
    "您可能还需要关闭“导出图片包含背景”，来获得与 Obsidian 更加协调的观感。",
  EMBED_WIDTH_NAME: "预览图的默认宽度",
  EMBED_WIDTH_DESC:
    "嵌入到 Markdown 文档中的绘图的预览图的默认宽度。该项也适用于鼠标悬停时浮现的预览图。<br>" +
    "可为某个要嵌入到 Markdown 文档中的绘图文件单独设置，" +
    "方法是修改相应的内部链接格式为如 <code>![[drawing.excalidraw|100]]</code> 或 <code>[[drawing.excalidraw|100x100]]</code>。",
  EMBED_HEIGHT_NAME: "预览图的默认高度",
  EMBED_HEIGHT_DESC:
    "嵌入到 Markdown 文档中的绘图的预览图得默认高度。该项也适用于实时预览编辑和阅读模式，以及悬停预览。" +
    "您可以在使用 <code>![[drawing.excalidraw|100]]</code> 或者 <code>[[drawing.excalidraw|100x100]]</code>" +
    "格式在嵌入图像时指定自定义高度。",
  EMBED_TYPE_NAME: "“嵌入绘图到当前 Markdown 文档中”系列命令的源文件类型",
  EMBED_TYPE_DESC:
    "执行“嵌入绘图到当前 Markdown 文档中”系列命令时，要嵌入绘图文件本身，还是嵌入其 SVG 或 PNG 副本。<br>" +
    "如果您想选择 SVG/PNG 副本，需要先开启下方“导出”部分“导出设置”中的 <a href='#"+TAG_AUTOEXPORT+"'>自动导出 SVG/PNG 副本</a>。<br>" +
    "如果您选择了 SVG/PNG 副本，当副本不存在时，该命令将会插入一条损坏的链接，您需要打开绘图文件并手动导出副本才能修复——" +
    "也就是说，该项不会自动帮您生成 SVG/PNG 副本，而只会引用已有的 SVG/PNG 副本。",
  EMBED_MARKDOWN_COMMENT_NAME: "将链接作为注释插入",
  EMBED_MARKDOWN_COMMENT_DESC:
    "在图像下方以 Markdown 链接形式插入原始 Excalidraw 文件的链接，如 <code>%%[[drawing.excalidraw]]%%</code>。<br>" +
    "除了添加 Markdown 注释之外，您还可以选择嵌入的 SVG 或 PNG，并使用命令面板：" +
    "'<code>Excalidraw: 打开 Excalidraw 绘图</code>'来打开该绘图",
  EMBED_WIKILINK_NAME: "“嵌入绘图到当前 Markdown 文档中”系列命令产生的内部链接类型",
  EMBED_WIKILINK_DESC:
    "<b>开启：</b>将产生 <code>![[Wiki 链接]]</code>。<b>关闭：</b>将产生 <code>![](Markdown 链接)</code>。",
  EXPORT_PNG_SCALE_NAME: "导出 PNG 图片的比例",
  EXPORT_PNG_SCALE_DESC: "导出 PNG 图片的大小比例",
  EXPORT_BACKGROUND_NAME: "导出图片包含背景",
  EXPORT_BACKGROUND_DESC:
    "如果关闭，将导出透明背景的图片。",
  EXPORT_PADDING_NAME: "导出图片的空白边距",
  EXPORT_PADDING_DESC:
    "导出 SVG/PNG 图片四周的空白边距。单位：像素。对于 ![[file#^clippedframe=id]]，边距被设置为 0。<br>" +
    "增加该值，可以避免在导出图片时，图片边缘的部分被裁掉。<br>" +
    "可为某个绘图单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-export-padding: 5</code> 的键值对。",
  EXPORT_THEME_NAME: "导出图片匹配主题",
  EXPORT_THEME_DESC:
    "导出与绘图的深色/浅色主题匹配的图片。" +
    "如果关闭，深色主题下的导出图片将和浅色主题一样。",
  EXPORT_EMBED_SCENE_NAME: "在导出图片中嵌入场景",
  EXPORT_EMBED_SCENE_DESC:
    "在导出图片中嵌入 Excalidraw 场景。可以在其 frontmatter 中添加如 <code>excalidraw-export-embed-scene: true/false</code> 的键值对来覆盖该项。" +
    "该项仅在您下次（重新）打开绘图时生效。",
  PDF_EXPORT_SETTINGS: "PDF 导出设置",
  EXPORT_HEAD: "导出设置",
  EXPORT_SYNC_NAME:
    "保持 SVG/PNG 文件名与绘图文件同步",
  EXPORT_SYNC_DESC:
    "打开后，当绘图文件被重命名时，插件将同步更新同文件夹下的同名 .SVG 和 .PNG 文件。" +
    "当绘图文件被删除时，插件将自动删除同文件夹下的同名 .SVG 和 .PNG 文件。",
  EXPORT_SVG_NAME: "自动导出 SVG 副本",
  EXPORT_SVG_DESC:
    "自动导出和绘图文件同名的 SVG 副本。" +
    "插件会将副本保存到绘图文件所在文件夹中。" +
    "在文档中嵌入 SVG 文件，相比直接嵌入绘图文件，具有更强的跨平台能力。<br>" +
    "此开关开启时，每次您编辑 Excalidraw 绘图，其 SVG 文件副本都会同步更新。<br>" +
    "可为某个绘图单独设置，方法是在其 frontmatter 中添加如 <code>excalidraw-autoexport: none/both/svg/png</code>" +
    "的键值对。",
  EXPORT_PNG_NAME: "自动导出 PNG 副本",
  EXPORT_PNG_DESC: "和“自动导出 SVG 副本”类似，但是导出格式为 *.PNG。",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "同时导出深色和浅色主题的图片",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC: "若开启，Excalidraw 将导出两个文件：filename.dark.png（或 .svg）和 filename.light.png（或 .svg）。<br>" +
    "该项可作用于“自动导出 SVG 副本”、“自动导出 PNG 副本”，以及其他的手动的导出命令。",
  COMPATIBILITY_HEAD: "兼容性设置",
  COMPATIBILITY_DESC: "如果没有特殊原因（例如：您想同时在 VSCode/Logseq 和 Obsidian 中使用 Excalidraw），建议您使用 Markdown 格式的绘图文件，而不是旧的 Excalidraw.com 格式，因为本插件的很多功能在旧格式中无法使用。",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "兼容代码格式化（Linting）",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC: "Excalidraw 对 <code># Excalidraw Data</code> 下的文件结构非常敏感。文档的自动格式化可能会在 Excalidraw 数据中造成错误。" +
    "虽然我已经努力使数据加载对自动格式化变更具有一定的抗性，但这种解决方案并非万无一失。<br>" +
    "<mark>最好的方法是避免使用不同的插件对 Excalidraw 文件进行自动更改。</mark><br>" +
    "如果出于某些合理的原因，您决定忽略我的建议并配置了 Excalidraw 文件的自动格式化，那么可以启用该项。<br>" +
    "<code>## Text Elements</code> 部分对空行很敏感。一种常见的代码格式化是在章节标题后添加一个空行。但对于 Excalidraw 来说，这将破坏/改变您绘图中的第一个文本元素。" +
    "为了解决这个问题，您可以启用该项。启用后 Excalidraw 将在 <code>## Text Elements</code> 的开头添加一个虚拟元素，供自动格式化工具修改。",
  PRESERVE_TEXT_AFTER_DRAWING_NAME: "兼容 Zotero 和脚注（footnotes）",
  PRESERVE_TEXT_AFTER_DRAWING_DESC: "保留 Excalidraw Markdown 中 <code>## Drawing</code> 部分之后的文本内容。保存非常大的绘图时，这可能会造成微小的性能影响。",
  DEBUGMODE_NAME: "开启 debug 信息",
  DEBUGMODE_DESC: "我建议在启用/禁用该项后重新启动 Obsidian。这将在控制台中启用调试消息。这对于排查问题很有帮助。" +
    "如果您在使用插件时遇到问题，请启用该项，重现问题，并在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/issues'>GitHub</a> 上提出的问题中包含控制台日志。",
  SLIDING_PANES_NAME: "支持 Sliding Panes 插件",
  SLIDING_PANES_DESC:
    "该项需要重启 Obsidian 才能生效。<br>" +
    "如果您使用 <a href='https://github.com/deathau/sliding-panes-obsidian' target='_blank'>Sliding Panes 插件</a>，" +
    "您可以开启该项来使 Excalidraw 绘图兼容此插件。<br>" +
    "注意，开启后会产生一些与 Obsidian 工作空间的兼容性问题。<br>" +
    "另外，Obsidian 现在已经原生支持 Stack Tabs（堆叠标签），基本实现了 Sliding Panes 插件的功能。",
  EXPORT_EXCALIDRAW_NAME: "自动导出 Excalidraw 旧格式副本",
  EXPORT_EXCALIDRAW_DESC: "和“自动导出 SVG 副本”类似，但是导出格式为 *.excalidraw。",
  SYNC_EXCALIDRAW_NAME:
    "新旧格式绘图文件的内容保持同步",
  SYNC_EXCALIDRAW_DESC:
    "如果旧格式（*.excalidraw）绘图文件的修改日期比新格式（*.md）更新，" +
    "则根据旧格式文件的内容来更新新格式文件。",
  COMPATIBILITY_MODE_NAME: "以旧格式创建新绘图",
  COMPATIBILITY_MODE_DESC:
    "⚠️ 慎用！99.9% 的情况下您无需开启该项。" +
    "开启此功能后，您通过功能区按钮、命令面板、" +
    "文件浏览器等创建的绘图都将是旧格式（*.excalidraw）。" +
    "此外，您打开旧格式绘图文件时将不再收到警告消息。",
  MATHJAX_NAME: "MathJax (LaTeX) 的 javascript 库服务器",
  MATHJAX_DESC: "如果您在绘图中使用 LaTeX，插件需要从服务器获取并加载一个 javascript 库。" +
    "如果您的网络无法访问某些库服务器，可以尝试通过该项更换库服务器。" +
    "该项可能需要重启 Obsidian 才能生效。",
  LATEX_DEFAULT_NAME: "插入 LaTeX 时的默认公式",
  LATEX_DEFAULT_DESC: "允许留空。允许使用类似 <code>\\color{white}</code> 的格式化表达式。",
  LATEX_PREAMBLE_NAME: "LaTeX 前言文件（區分大小寫！）",
  LATEX_PREAMBLE_DESC: "前言文件的完整路径，留空则使用默认值。如果文件不存在，该项将被忽略。<br><strong>重要：</strong>更改后需要重新加载 Obsidian 才能生效！",
  NONSTANDARD_HEAD: "非 Excalidraw.com 官方支持的特性",
  NONSTANDARD_DESC: `这些特性不受 Excalidraw.com 官方支持。如果在 Excalidraw.com 导入绘图，这些特性将会发生不可预知的变化。
    包括：自定义画笔工具的数量，自定义字体等。`,
  RENDER_TWEAK_HEAD: "渲染优化",
  MAX_IMAGE_ZOOM_IN_NAME: "最大图片放大倍数",
  MAX_IMAGE_ZOOM_IN_DESC: "为节省内存，并且因为 Apple Safari (Obsidian on iOS) 存在硬编码的限制，Excalidraw.com 在放大时会限制图片和大型对象的最大分辨率。您可以设置一个倍数来覆盖这个限制。" +
    "倍数越大，放大后的图片分辨率越高，但内存占用也越大。" +
    "您可以多试几个设置值。当您放大一张较大的 PNG 图片时，如果图片突然从视图中消失，说明已经达到了极限。默认值为 1。该项对 iOS 无效。",
  CUSTOM_PEN_HEAD: "自定义画笔",
  CUSTOM_PEN_NAME: "自定义画笔工具的数量",
  CUSTOM_PEN_DESC: "在绘图上的 Obsidian 菜单按钮旁边切换自定义画笔。长按（双击）画笔按钮可以修改其样式。",
  EXPERIMENTAL_HEAD: "杂项",
  EXPERIMENTAL_DESC: `包括：默认的 LaTeX 公式，字段建议，绘图文件的类型标识符，OCR 等。`,
  EA_HEAD: "Excalidraw 自动化",
  EA_DESC:
    "ExcalidrawAutomate 是用于 Excalidraw 自动化脚本的 API，但是目前说明文档还不够完善，" +
    "建议阅读 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts'>ExcalidrawAutomate.d.ts</a> 文件源码，" +
    "参考 <a href='https://zsviczian.github.io/obsidian-excalidraw-plugin/'>ExcalidrawAutomate How-to</a> 网页（不过该网页" +
    "有一段时间未更新了），并开启下方的字段建议。字段建议功能能够在您键入时提示可用的" +
    "函数及相应的参数，而且附带描述，相当于最新的“文档”。",
  FIELD_SUGGESTER_NAME: "开启字段建议",
  FIELD_SUGGESTER_DESC:
    "开启后，当您在编辑器中输入 <code>excalidraw-</code> 或者 <code>ea.</code> 时，会弹出一个带有函数说明的自动补全提示菜单。<br>" +
    "该功能借鉴了 Breadcrumbs 和 Templater 插件。",
  STARTUP_SCRIPT_NAME: "起动脚本",
  STARTUP_SCRIPT_DESC:
    "插件启动时将自动执行该脚本。可用于为您的 Excalidraw 自动化脚本设置钩子。" +
    "起动脚本请用 javascript 代码编写，并保存为 Markdown 格式。",
  STARTUP_SCRIPT_BUTTON_CREATE: "创建起动脚本",
  STARTUP_SCRIPT_BUTTON_OPEN: "打开起动脚本",
  STARTUP_SCRIPT_EXISTS: "起动脚本已存在",
  FILETYPE_NAME: "在文件浏览器中为 excalidraw.md 文件添加类型标识符（如 ✏️）",
  FILETYPE_DESC:
    "可通过下一选项来自定义类型标识符。",
  FILETAG_NAME: "excalidraw.md 文件的类型标识符",
  FILETAG_DESC: "要显示为类型标识符的 emoji 或文本。",
  INSERT_EMOJI: "插入 emoji",
  LIVEPREVIEW_NAME: "嵌入绘图到文档时，模拟嵌入图片的语法",
  LIVEPREVIEW_DESC:
    "开启该项，则可在 Obsidian 实时预览模式的编辑视图下，用如 <code>![[绘图|宽度|样式]]</code> 的语法来嵌入绘图。<br>" +
    "对于已打开的文档，需要重新打开来使设置生效。" +
    "",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "淡化 Excalidraw 标记",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC: "在 Markdown 视图模式下，在 Markdown 注释 %% " +
    "之后的部分会淡化。文本仍然存在，但视觉杂乱感会减少。请注意，您可以将 %% 放在 # Text Elements 行的上一行，" +
    "这样，整个 Excalidraw Markdown 都会淡化，包括 # Text Elements。 副作用是您将无法在其他 Markdown 笔记中引用文本块，即 %% 注释部分之后的内容。这应该不是大问题。" +
    "如果您想编辑 Excalidraw Markdown 脚本，只需切换至 Markdown 视图模式并暂时删除 %% 注释。",
  EXCALIDRAW_PROPERTIES_NAME: "将 Excalidraw 属性加载到 Obsidian 的自动提示中",
  EXCALIDRAW_PROPERTIES_DESC: "切换该项以在插件启动时将 Excalidraw 笔记属性加载到 Obsidian 的属性自动提示中。" +
   "启用此功能简化了 Excalidraw 前置属性的使用，使您能够利用许多强大的设置。如果您不希望自动加载这些属性，" +
   "您可以禁用此功能，但您将需要手动从自动提示中移除任何不需要的属性。" +
   "请注意，启用该项需要重启插件，因为属性是在启动时加载的。",
  FONTS_HEAD: "字体",
  FONTS_DESC: "配置供 Excalidraw 使用的本地字体。",
  CUSTOM_FONT_HEAD: "本地字体",
  ENABLE_FOURTH_FONT_NAME: "为文本元素启用本地字体",
  ENABLE_FOURTH_FONT_DESC:
    "启用该项将在文本元素的属性面板的字体列表中添加一个本地字体。" +
    "请注意，使用这个本地字体可能会破坏平台的独立性。" +
    "使用自定义字体的文件在不同仓库中打开或在以后打开时，根据字体设置，可能会以不同的方式呈现。" +
    "此外，在 Excalidraw.com 或其他 Excalidraw 版本中，默认的本地字体字体将使用系统字体。",
  FOURTH_FONT_NAME: "本地字体文件",
  FOURTH_FONT_DESC:
    "从仓库中选择一个 .otf/.ttf/.woff/.woff2 字体文件作为本地字体使用。" +
    "Excalidraw 默认使用 Virgil 字体。" +
    "为了获得最佳性能，建议使用 .woff2 文件，因为当导出 SVG 格式的图片时，Excalidraw 只会编码必要的字形。" +
    "其他字体格式将在导出文件中嵌入整个字体，可能会导致文件大小显著增加。<b>译者注：</b>可在 <a href='https://wangchujiang.com/free-font/' target='_blank'>Free Font</a> 获取免费商用中文手写字体。",
  OFFLINE_CJK_NAME: "离线 CJK 字体支持",
  OFFLINE_CJK_DESC:
    `<strong>该项需要重启 Obsidian 才能生效。</strong><br>
    Excalidraw.com 提供手写风格的 CJK 字体。默认情况下，这些字体不会包含在插件本地，而是从互联网获取。
    如果您希望 Excalidraw 完全本地化，以便在没有互联网连接的情况下使用，可以从 <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip" target="_blank">GitHub 下载所需的字体文件</a>。
    下载后，将内容解压到您的仓库中的一个文件夹内。<br>
    预加载字体会影响启动性能。因此，您可以选择加载哪些字体。`,
  CJK_ASSETS_FOLDER_NAME: "CJK 字体文件夹（區分大小寫！）",
  CJK_ASSETS_FOLDER_DESC: `您可以在此设置 CJK 字体文件夹的位置。例如：<code>Excalidraw/CJK Fonts</code>。<br>
    <strong>重要：</strong> 请勿将此文件夹设置为仓库根目录！请勿在此文件夹中放置其他字体。<br>
    <strong>注意：</strong> 如果您使用 Obsidian Sync 并希望在设备之间同步这些字体文件，请确保 Obsidian Sync 设置为同步“所有其他文件类型”。`,
  LOAD_CHINESE_FONTS_NAME: "启动时从文件加载中文字体",
  LOAD_JAPANESE_FONTS_NAME: "启动时从文件加载日文字体",
  LOAD_KOREAN_FONTS_NAME: "启动时从文件加载韩文字体",
  SCRIPT_SETTINGS_HEAD: "已安装脚本的设置",
  SCRIPT_SETTINGS_DESC: "有些 Excalidraw 自动化脚本包含设置项，当执行这些脚本时，它们会在该列表下添加设置项。",
  TASKBONE_HEAD: "Taskbone OCR（光学符号识别）",
  TASKBONE_DESC: "这是一个将 OCR 融入 Excalidraw 的实验性功能。请注意，Taskbone 是一项独立的外部服务，而不是由 Excalidraw 或 obsidian-excalidraw-plugin 项目提供的。" +
    "OCR 能够对绘图上用自由画笔工具写下的涂鸦或者嵌入的图像进行文本识别，并将识别出来的文本写入绘图文件的 frontmatter，同时复制到剪贴板。" +
    "之所以要写入 frontmatter 是为了便于您在 Obsidian 中能够搜索到这些文本。" +
    "注意，识别的过程不是在本地进行的，而是通过在线 API，图像会被上传到 taskbone 的服务器（仅用于识别目的）。如果您介意，请不要使用这个功能。",
  TASKBONE_ENABLE_NAME: "启用 Taskbone",
  TASKBONE_ENABLE_DESC: "启用意味着您同意 Taskbone <a href='https://www.taskbone.com/legal/terms/' target='_blank'>条款及细则</a> 以及 " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>隐私政策</a>。",
  TASKBONE_APIKEY_NAME: "Taskbone API Key",
  TASKBONE_APIKEY_DESC: "Taskbone 的免费 API key 提供了一定数量的每月识别次数。如果您非常频繁地使用此功能，或者想要支持 " +
    "Taskbone 的开发者（您懂的，没有人能用爱发电，Taskbone 开发者也需要投入资金来维持这项 OCR 服务），您可以" +
    "到 <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a> 购买一个商用 API key。购买后请将它填写到旁边这个文本框里，替换掉原本自动生成的免费 API key。",

  //HotkeyEditor
  HOTKEY_PRESS_COMBO_NANE: "按下您的组合键",
  HOTKEY_PRESS_COMBO_DESC: "请按下所需的组合键",
  HOTKEY_BUTTON_ADD_OVERRIDE: "添加新的热键覆盖",
  HOTKEY_BUTTON_REMOVE: "移除",

  //openDrawings.ts
  SELECT_FILE: "选择一个文件后按回车",
  SELECT_COMMAND: "选择一个命令后按回车",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `选择一个文件后按回车，或者 ${labelSHIFT()}+${labelMETA()}+Enter 以 100% 尺寸嵌入。`,
  NO_MATCH: "查询不到匹配的文件",
  NO_MATCHING_COMMAND: "查询不到匹配的命令",
  SELECT_FILE_TO_LINK: "选择要以链接形式插入到当前绘图中的文件",
  SELECT_COMMAND_PLACEHOLDER: "选择要插入到当前绘图中的命令",
  SELECT_DRAWING: "选择要以图像形式嵌入到当前绘图中的图片或绘图文件",
  TYPE_FILENAME: "键入要选择的绘图名称",
  SELECT_FILE_OR_TYPE_NEW:
    "选择已有绘图，或者键入新绘图文件的名称，然后按回车。",
  SELECT_TO_EMBED: "选择要嵌入到当前 Markdown 文档中的绘图",
  SELECT_MD: "选择要以图像形式嵌入到当前绘图中的 Markdown 文档",
  SELECT_PDF: "选择要以图像形式嵌入到当前绘图中的 PDF",
  PDF_PAGES_HEADER: "页码范围",
  PDF_PAGES_DESC: "示例：1, 3-5, 7, 9-11",

  //SelectCard.ts
  TYPE_SECTION: "输入章节标题进行选择",
  SELECT_SECTION_OR_TYPE_NEW:
    "选择现有章节标题或输入新的章节标题，然后按 Enter。",
  INVALID_SECTION_NAME: "无效的章节标题",
  EMPTY_SECTION_MESSAGE: "输入章节标题以创建",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW 警告\n停止加载嵌入的图像，因为此文件中存在死循环：\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "脚本运行错误。请在开发者控制台中查看错误信息。",

  //ExcalidrawViewUtils.ts
  MARKER_FRAME_RENDERING_DISABLED_NOTICE: "场景中有隐藏的标记画框。",
  //DRAWING_HAS_BACK_OF_THE_CARD: "There are notes on the back of this drawing.",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "Excalidraw 文件已损坏。尝试从备份文件中加载。",
  FONT_LOAD_SLOW: "正在加载字体…\n\n这比预期花费的时间更长。如果这种延迟经常发生，您可以将字体下载到您的仓库中。\n\n" +
    "(点击=忽略提示，右键=更多信息)",
  FONT_INFO_TITLE: "从互联网加载 v2.5.3 字体",
  FONT_INFO_DETAILED: `
      <p>
        为了提高 Obsidian 的启动时间并管理大型 <strong>CJK 字体系列</strong>，
        我已将 CJK 字体移出插件的 <code>main.js</code>。默认情况下，CJK 字体将从互联网加载。
        这通常不会造成问题，因为 Obsidian 在首次使用后会缓存这些文件。
      </p>
      <p>
        如果您希望 Obsidian 完全离线或遇到性能问题，可以下载字体资源。
      </p>
      <h3>说明：</h3>
      <ol>
        <li>从 <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip">GitHub</a> 下载字体。</li>
        <li>解压并将文件复制到仓库文件夹中（默认：<code>Excalidraw/${CJK_FONTS}</code>; 文件夹名称區分大小寫！）。</li>
        <li><mark>请勿</mark>将此文件夹设置为仓库根目录或与其他本地字体混合。</li>
      </ol>
      <h3>对于 Obsidian Sync 用户：</h3>
      <p>
        确保 Obsidian Sync 设置为同步“所有其他文件类型”，或者在所有设备上下载并解压文件。
      </p>
      <h3>注意：</h3>
      <p>
        如果您觉得这个过程繁琐，请向 Obsidian.md 提交功能请求，以支持插件文件夹中的资源。
        目前，仅支持（同步）单个 <code>main.js</code>，这导致大型文件和复杂插件（如 Excalidraw）启动时间较慢。
        对此带来的不便，我深表歉意。
      </p>
    `,

  //ObsidianMenu.tsx
  GOTO_FULLSCREEN: "进入全屏模式",
  EXIT_FULLSCREEN: "退出全屏模式",
  TOGGLE_FULLSCREEN: "切换全屏模式",
  TOGGLE_DISABLEBINDING: "开启或关闭绑定",
  TOGGLE_FRAME_RENDERING: "开启或关闭画框渲染",
  TOGGLE_FRAME_CLIPPING: "开启或关闭画框裁切",
  OPEN_LINK_CLICK: "打开所选元素里的链接",
  OPEN_LINK_PROPS: "打开图像链接或 LaTeX 公式编辑器",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "缩放至标题",
  PIN_VIEW: "锁定视图",
  DO_NOT_PIN_VIEW: "解锁视图",
  NARROW_TO_BLOCK: "缩放至块",
  SHOW_ENTIRE_FILE: "显示全部",
  SELECT_SECTION: "从文档选择章节",
  SELECT_VIEW: "从 base 选择视图",
  ZOOM_TO_FIT: "缩放至合适大小",
  RELOAD: "重载链接",
  OPEN_IN_BROWSER: "在浏览器中打开",
  PROPERTIES: "属性",
  COPYCODE: "复制源文件",

  //EmbeddableSettings.tsx
  ES_TITLE: "Embeddable 元素设置",
  ES_RENAME: "重命名",
  ES_ZOOM: "缩放",
  ES_YOUTUBE_START: "YouTube 起始时间",
  ES_YOUTUBE_START_DESC: "ss, mm:ss, hh:mm:ss",
  ES_YOUTUBE_START_INVALID: "YouTube 起始时间无效。请检查格式并重试",
  ES_FILENAME_VISIBLE: "显示页内标题",
  ES_BACKGROUND_HEAD: "背景色",
  ES_BACKGROUND_DESC_INFO: "点击此处查看更多颜色信息",
  ES_BACKGROUND_DESC_DETAIL: "背景色仅影响预览模式的 MD-Embeddable。在编辑模式，它会根据场景（通过笔记属性设置）或插件设置，遵循 Obsidian 的深色/浅色主题。背景色有两层：元素背景色（下层颜色）和上层颜色。选择“匹配元素”表示两层都遵循元素背景色。选择“匹配绘图”或特定背景色不会改变元素背景色。设置透明度（如 50%）会将绘图或选定的颜色与元素背景色混合。要移除元素背景色，可以在 Excalidraw 的元素属性编辑器中将元素背景色设置为透明，这样只有上层颜色生效。",
  ES_BACKGROUND_MATCH_ELEMENT: "匹配元素背景色",
  ES_BACKGROUND_MATCH_CANVAS: "匹配绘图背景色",
  ES_BACKGROUND_COLOR: "背景色",
  ES_BORDER_HEAD: "边框颜色",
  ES_BORDER_COLOR: "边框颜色",
  ES_BORDER_MATCH_ELEMENT: "匹配元素边框颜色",
  ES_BACKGROUND_OPACITY: "背景透明度",
  ES_BORDER_OPACITY: "边框透明度",
  ES_EMBEDDABLE_SETTINGS: "MD-Embeddable 设置",
  ES_USE_OBSIDIAN_DEFAULTS: "使用 Obsidian 默认设置",
  ES_ZOOM_100_RELATIVE_DESC: "使元素的缩放等级等于当前绘图的缩放等级",
  ES_ZOOM_100: "Relative 100%",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "文件不存在。要创建吗？",
  PROMPT_ERROR_NO_FILENAME: "错误：文件名不能为空",
  PROMPT_ERROR_DRAWING_CLOSED: "未知错误。绘图文件可能已关闭或丢失",
  PROMPT_TITLE_NEW_FILE: "新建文件",
  PROMPT_TITLE_CONFIRMATION: "确认",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "创建 Excalidraw 绘图",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA: "创建 Excalidraw 绘图并在新标签页中打开",
  PROMPT_BUTTON_CREATE_MARKDOWN: "创建 Markdown 文档",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA: "创建 Markdown 文档并在新标签页中打开",
  PROMPT_BUTTON_EMBED_MARKDOWN: "嵌入",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA: "将所选元素替换为 MD-Embeddable",
  PROMPT_BUTTON_NEVERMIND: "算了",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "取消",
  PROMPT_BUTTON_INSERT_LINE: "插入一行",
  PROMPT_BUTTON_INSERT_SPACE: "插入空格",
  PROMPT_BUTTON_INSERT_LINK: "插入内部链接",
  PROMPT_BUTTON_UPPERCASE: "大写",
  PROMPT_BUTTON_SPECIAL_CHARS: "特殊字符",
  PROMPT_SELECT_TEMPLATE: "选择一个模板",

  //ModifierKeySettings
  WEB_BROWSER_DRAG_ACTION: "从浏览器拖入时",
  LOCAL_FILE_DRAG_ACTION: "从本地文件系统拖入时",
  INTERNAL_DRAG_ACTION: "在 Obsidian 内部拖动时",
  PANE_TARGET: "点击链接时",
  DEFAULT_ACTION_DESC: "无修饰键时的行为：",

  //FrameSettings.ts
  FRAME_SETTINGS_TITLE: "画框设置",
  FRAME_SETTINGS_ENABLE: "启用画框",
  FRAME_SETTIGNS_NAME: "显示画框名称",
  FRAME_SETTINGS_OUTLINE: "显示画框边框",
  FRAME_SETTINGS_CLIP: "启用画框裁切",

  //InsertPDFModal.ts
  IPM_PAGES_TO_IMPORT_NAME: "要导入的页面",
  IPM_SELECT_PAGES_TO_IMPORT: "请选择页面以进行导入",
  IPM_ADD_BORDER_BOX_NAME: "添加带边框的盒子容器",
  IPM_ADD_FRAME_NAME: "添加页面到画框",
  IPM_ADD_FRAME_DESC: "为了更方便的操作，我建议将页面锁定在画框内。" +
    "但是，如果您确实将页面锁定在画框内，则唯一的解锁方法是右键点击画框，选择“从画框中移除元素”，然后解锁页面。",
  IPM_GROUP_PAGES_NAME: "编组页面",
  IPM_GROUP_PAGES_DESC: "这将把所有页面编为一个组。如果您在导入后锁定页面，建议使用此方法，因为这样可以更方便地解锁整个组，而不是逐个解锁。",
  IPM_SELECT_PDF: "请选择一个 PDF",

  //Utils.ts
  UPDATE_AVAILABLE: `Excalidraw 的新版本已在社区插件中可用。\n\n您正在使用 ${PLUGIN_VERSION}。\n最新版本是`,
  SCRIPT_UPDATES_AVAILABLE: `脚本更新可用 - 请检查脚本存储。\n\n${DEVICE.isDesktop ? `此消息可在控制台日志中查看 (${DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"})\n\n` : ""}如果您已将脚本组织到脚本存储文件夹下的子文件夹中，并且存在同一脚本的多个副本，可能需要清理未使用的版本以消除此警报。对于无需更新的私人脚本副本，请将它们存储在脚本存储文件夹之外。`,
  ERROR_PNG_TOO_LARGE: "导出 PNG 时出错 - PNG 文件过大，请尝试较小的分辨率",

  //modifierkeyHelper.ts
  // WebBrowserDragAction
  WEB_DRAG_IMPORT_IMAGE: "导入图片到仓库",
  WEB_DRAG_IMAGE_URL: "通过 URL 嵌入图片或 YouTube 缩略图",
  WEB_DRAG_LINK: "链接形式插入",
  WEB_DRAG_EMBEDDABLE: "交互形式嵌入",

  // LocalFileDragAction
  LOCAL_DRAG_IMPORT: "导入文件到仓库，或在路径来自仓库时复用现有文件",
  LOCAL_DRAG_IMAGE: "图像形式嵌入：使用本地 URI，或在路径来自仓库时使用内部链接",
  LOCAL_DRAG_LINK: "链接形式插入：使用本地 URI，或在路径来自仓库时使用内部链接",
  LOCAL_DRAG_EMBEDDABLE: "交互形式嵌入：使用本地 URI，或在路径来自仓库时使用内部链接",

  // InternalDragAction
  INTERNAL_DRAG_IMAGE: "图像形式嵌入",
  INTERNAL_DRAG_IMAGE_FULL: "图像形式嵌入（100% 尺寸）",
  INTERNAL_DRAG_LINK: "链接形式插入",
  INTERNAL_DRAG_EMBEDDABLE: "交互形式嵌入",

  // LinkClickAction
  LINK_CLICK_ACTIVE: "在当前活动窗口中打开",
  LINK_CLICK_NEW_PANE: "在相邻的新窗口中打开",
  LINK_CLICK_POPOUT: "在弹出窗口中打开",
  LINK_CLICK_NEW_TAB: "在新标签页中打开",
  LINK_CLICK_MD_PROPS: "显示 Markdown 图片属性对话框（仅在以图像形式嵌入 Markdown 文档时适用）",

  //ExportDialog
  // Dialog and tabs
  EXPORTDIALOG_TITLE: "导出为",
  EXPORTDIALOG_TAB_IMAGE: "图片",
  EXPORTDIALOG_TAB_PDF: "PDF",
  // Settings persistence
  EXPORTDIALOG_SAVE_SETTINGS: "将图片设置保存到文件 doc.properties 吗？",
  EXPORTDIALOG_SAVE_SETTINGS_SAVE: "保存为预设",
  EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "仅本次使用",
  // Image settings
  EXPORTDIALOG_IMAGE_SETTINGS: "图片",
  EXPORTDIALOG_IMAGE_DESC: "PNG 支持透明。外部文件可以包含 Excalidraw 场景数据。",
  EXPORTDIALOG_PADDING: "边距",
  EXPORTDIALOG_SCALE: "缩放",
  EXPORTDIALOG_CURRENT_PADDING: "当前边距：",
  EXPORTDIALOG_SIZE_DESC: "缩放会影响输出大小",
  EXPORTDIALOG_SCALE_VALUE: "缩放：",
  EXPORTDIALOG_IMAGE_SIZE: "大小：",
  // Theme and background
  EXPORTDIALOG_EXPORT_THEME: "主题",
  EXPORTDIALOG_THEME_LIGHT: "浅色",
  EXPORTDIALOG_THEME_DARK: "深色",
  EXPORTDIALOG_BACKGROUND: "背景",
  EXPORTDIALOG_BACKGROUND_TRANSPARENT: "透明",
  EXPORTDIALOG_BACKGROUND_USE_COLOR: "使用场景颜色",
  // Selection
  EXPORTDIALOG_SELECTED_ELEMENTS: "导出",
  EXPORTDIALOG_SELECTED_ALL: "整个场景",
  EXPORTDIALOG_SELECTED_SELECTED: "仅选中部分",
  // Export options
  EXPORTDIALOG_EMBED_SCENE: "包含场景数据吗？",
  EXPORTDIALOG_EMBED_YES: "是",
  EXPORTDIALOG_EMBED_NO: "否",
  // PDF settings
  EXPORTDIALOG_PDF_SETTINGS: "PDF",
  EXPORTDIALOG_PAGE_SIZE: "页面大小",
  EXPORTDIALOG_PAGE_ORIENTATION: "方向",
  EXPORTDIALOG_ORIENTATION_PORTRAIT: "纵向",
  EXPORTDIALOG_ORIENTATION_LANDSCAPE: "横向",
  EXPORTDIALOG_PDF_FIT_TO_PAGE: "页面适配",
  EXPORTDIALOG_PDF_FIT_OPTION: "适配页面",
  EXPORTDIALOG_PDF_FIT_2_OPTION: "适配至最多 2 页",
  EXPORTDIALOG_PDF_FIT_4_OPTION: "适配至最多 4 页",
  EXPORTDIALOG_PDF_FIT_6_OPTION: "适配至最多 6 页",
  EXPORTDIALOG_PDF_FIT_8_OPTION: "适配至最多 8 页",
  EXPORTDIALOG_PDF_FIT_12_OPTION: "适配至最多 12 页",
  EXPORTDIALOG_PDF_FIT_16_OPTION: "适配至最多 16 页",
  EXPORTDIALOG_PDF_SCALE_OPTION: "使用图片缩放（可能跨多页）",
  EXPORTDIALOG_PDF_PAPER_COLOR: "纸张颜色",
  EXPORTDIALOG_PDF_PAPER_WHITE: "白色",
  EXPORTDIALOG_PDF_PAPER_SCENE: "使用场景颜色",
  EXPORTDIALOG_PDF_PAPER_CUSTOM: "自定义颜色",
  EXPORTDIALOG_PDF_ALIGNMENT: "页面位置",
  EXPORTDIALOG_PDF_ALIGN_CENTER: "居中",
  EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "左对齐居中",
  EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "右对齐居中",
  EXPORTDIALOG_PDF_ALIGN_TOP_LEFT: "左上角",
  EXPORTDIALOG_PDF_ALIGN_TOP_CENTER: "顶部居中",
  EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT: "右上角",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT: "左下角",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER: "底部居中",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT: "右下角",
  EXPORTDIALOG_PDF_MARGIN: "边距",
  EXPORTDIALOG_PDF_MARGIN_NONE: "无",
  EXPORTDIALOG_PDF_MARGIN_TINY: "小",
  EXPORTDIALOG_PDF_MARGIN_NORMAL: "正常",
  EXPORTDIALOG_SAVE_PDF_SETTINGS: "保存 PDF 设置",
  EXPORTDIALOG_SAVE_CONFIRMATION: "PDF 配置已保存为插件默认设置",
  // Buttons
  EXPORTDIALOG_PNGTOFILE: "导出 PNG",
  EXPORTDIALOG_SVGTOFILE: "导出 SVG",
  EXPORTDIALOG_PNGTOVAULT: "PNG 保存到仓库",
  EXPORTDIALOG_SVGTOVAULT: "SVG 保存到仓库",
  EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
  EXPORTDIALOG_PNGTOCLIPBOARD: "PNG 复制到剪贴板",
  EXPORTDIALOG_SVGTOCLIPBOARD: "SVG 复制到剪贴板",
  EXPORTDIALOG_PDF: "导出 PDF",

  EXPORTDIALOG_PDF_PROGRESS_NOTICE: "正在导出 PDF。如果图像较大，可能需要一些时间。",
  EXPORTDIALOG_PDF_PROGRESS_DONE: "导出完成",
  EXPORTDIALOG_PDF_PROGRESS_ERROR: "导出 PDF 时出错，请检查开发者控制台以获取详细信息",

  // Screenshot tab
  EXPORTDIALOG_NOT_AVAILALBE: "抱歉，此功能仅在绘图在主 Obsidian 工作区打开时可用。",
  EXPORTDIALOG_TAB_SCREENSHOT: "截图",
  EXPORTDIALOG_SCREENSHOT_DESC: "截图将包含可嵌入的内容，如 Markdown 页面、YouTube、网站等。它们仅在桌面端可用，无法自动导出，并且仅支持 PNG 格式。",
  SCREENSHOT_DESKTOP_ONLY: "截图功能仅在桌面端可用",
  SCREENSHOT_FILE_SUCCESS: "截图已保存到仓库",
  SCREENSHOT_CLIPBOARD_SUCCESS: "截图已复制到剪贴板",
  SCREENSHOT_CLIPBOARD_ERROR: "无法复制截图到剪贴板：",
  SCREENSHOT_ERROR: "截图出错 - 请查看控制台日志",

  //exportUtils.ts
  PDF_EXPORT_DESKTOP_ONLY: "PDF 导出功能仅限桌面端使用",

  //UniversalInsertFileModal.ts
  UIFM_TITLE: "从仓库中嵌入文件",
  UIFM_SECTION_HEAD: "选择章节标题",
  UIFM_ANCHOR: "锚定为原始大小的 100%",
  UIFM_ANCHOR_DESC: "这是一个专业功能，请在了解其作用的情况下再使用。启用后，即使你在 Excalidraw 中调整了导入图像的大小，下次打开绘图时，该图像仍会恢复为原始大小的 100%。这在将一个独立的 Excalidraw 点子嵌入到另一份笔记中，并希望保持文字和图标的相对尺寸时非常有用。",
  UIFM_BTN_EMBEDDABLE: "以交互形式",
  UIFM_BTN_PDF: "PDF 页面",
  UIFM_BTN_IMAGE: "以图像形式",

  //ReleaseNotes.ts
  RN_WELCOME: "欢迎使用 Excalidraw",

  //Excalidraw component
  COMP_IMG: "图片 & 文件",
  COMP_IMG_FROM_SYSTEM: "从系统导入",
  COMP_IMG_ANY_FILE: "仓库中任意文件",
  COMP_IMG_LaTeX: "LaTeX 公式",
  COMP_FRAME: "画框操作",
  COMP_FRAME_HINT: "切换标记画框。标记画框仅用于引导，用于定义幻灯片/打印区域/[[file#^frame=id]]，" +
    "导出时会隐藏；也不会包含元素。通过上下文菜单显示/隐藏标记画框。",

  //CustomEmbeddable.tsx
  NOTICE_PDF_THEME: "已覆盖 PDF 主题。\n" +
    "通过文件的 'excalidraw-embeddable-theme' 笔记属性设置（将覆盖插件设置）。\n\n" +
    "值：dark/light/auto/default，表示深色、浅色、跟随 Excalidraw 或 Obsidian 主题。",

  //EmbeddableActionsMenu.tsx
  BOOKMARK_PAGE: "保存当前进度",
  CAPTURE_PAGE: "以图像形式截取当前页面",

  //VersionMismatch.ts
  //WARNING: Do not change the {VAL_RECORDED} and {VAL_ACTUAL} strings, they are replaced by the actual version values at runtime!
  VERSION_MISMATCH_NOTICE: `Obsidian 显示的版本是 <b>{VAL_RECORDED}</b>，但已安装的 Excalidraw 代码显示的版本是 <b>{VAL_ACTUAL}</b>。`,
  VERSION_MISMATCH_HEADING: "Excalidraw 版本不匹配",
  VERSION_MISMATCH_CAUSE: "通常源于同步不完整，大文件未能同步（如使用 Obsidian Sync Standard，main.js > 5MB），只更新了 <code>manifest.json</code>。",
  VERSION_MISMATCH_OPTIONS: "选项：<br><b>1.</b> 重新下载插件（推荐）。<br><b>2.</b> 暂时忽略。",
  VERSION_MISMATCH_NOTE: "注意：手动更新版本信息可能会影响依赖 manifest.json 的工具（如 Plugin Update Tracker、BRAT），直到你完全重装插件。",
  VERSION_MISMATCH_DISABLE_NAME: "禁用版本不匹配警告",
  VERSION_MISMATCH_DISABLE_DESC: "可在以下位置重新启用：设置 → Excalidraw → 基本 → 警告插件更新不完整",
  VERSION_MISMATCH_REDOWNLOAD: "重新下载插件",
  VERSION_MISMATCH_IGNORE: "忽略",
};
