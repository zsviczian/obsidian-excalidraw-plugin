import {
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS
} from "src/constants/constants";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";

declare const PLUGIN_VERSION:string;

// 简体中文
export default {
  // Sugester
  SELECT_FILE_TO_INSERT: "选择一个要插入的文件",
  // main.ts
  CONVERT_URL_TO_FILE: "从 URL 下载图像到本地",
  UNZIP_CURRENT_FILE: "解压当前 Excalidraw 文件",
  ZIP_CURRENT_FILE: "压缩当前 Excalidraw 文件",
  PUBLISH_SVG_CHECK: "Obsidian Publish：搜索过期的 SVG 和 PNG 导出文件",
  EMBEDDABLE_PROPERTIES: "Embeddable 元素设置",
  EMBEDDABLE_RELATIVE_ZOOM: "使元素的缩放等级等于当前画布的缩放等级",
  OPEN_IMAGE_SOURCE: "打开 Excalidraw 绘图文件",
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
  TOGGLE_SPLASHSCREEN: "在新绘图中显示启动画面",
  FLIP_IMAGE: "打开当前所选 excalidraw 图像的“背景笔记”",
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
  DELETE_FILE: "从库中删除所选图像（或以图像形式嵌入绘图中的 Markdown）的源文件",
  COPY_ELEMENT_LINK: "复制所选元素的链接（形如 [[file#^id]]）",
  COPY_DRAWING_LINK: "复制绘图的嵌入链接（形如 ![[drawing]]）",
  INSERT_LINK_TO_ELEMENT:
    `复制所选元素为内部链接（形如 [[file#^id]] ）。\n按住 ${labelCTRL()} 可复制元素所在分组为内部链接（形如 [[file#^group=id]] ）。\n按住 ${labelSHIFT()} 可复制所选元素所在区域为内部链接（形如 [[file#^area=id]] ）。`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "复制所选元素所在分组为嵌入链接（形如 ![[file#^group=id]] ）",
  INSERT_LINK_TO_ELEMENT_AREA:
    "复制所选元素所在区域为嵌入链接（形如 ![[file#^area=id]] ）",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "复制所选框架为嵌入链接（形如 ![[file#^frame=id]] ）",
    INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "复制所选框架（内容）为嵌入链接（形如 ![[file#^clippedframe=id]] ）",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "复制所选元素为内部链接（形如 [[file#^id]] ）",
  INSERT_LINK_TO_ELEMENT_ERROR: "未选择画布里的单个元素",
  INSERT_LINK_TO_ELEMENT_READY: "链接已生成并复制到剪贴板",
  INSERT_LINK: "插入任意文件（以内部链接形式嵌入，形如 [[drawing]] ）到当前绘图中",
  INSERT_COMMAND: "插入 Obsidian 命令（以内部链接形式嵌入）到当前绘图中",
  INSERT_IMAGE: "插入图像或 Excalidraw 绘图（以图像形式嵌入）到当前绘图中",
  IMPORT_SVG: "从 SVG 文件导入图形元素到当前绘图中（暂不支持文本元素）",
  IMPORT_SVG_CONTEXTMENU: "转换 SVG 到线条 - 有限制",
  INSERT_MD: "插入 Markdown 文档（以图像形式嵌入）到当前绘图中",
  INSERT_PDF: "插入 PDF 文档（以图像形式嵌入）到当前绘图中",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE: "将最后激活的 PDF 页面插入为图片",
  UNIVERSAL_ADD_FILE: "插入任意文件（以交互形式嵌入，或者以图像形式嵌入）到当前绘图中",
  INSERT_CARD: "插入“背景笔记”卡片",
  CONVERT_CARD_TO_FILE: "将“背景笔记”卡片保存到文件",
  ERROR_TRY_AGAIN: "请重试。",
  PASTE_CODEBLOCK: "粘贴代码块",
  INSERT_LATEX:
    `插入 LaTeX 公式（例如：\\binom{n}{k} = \\frac{n!}{k!(n-k)!}）。`,
  ENTER_LATEX: "输入 LaTeX 表达式",
  READ_RELEASE_NOTES: "阅读本插件的更新说明",
  RUN_OCR: "OCR 整个画布：识别涂鸦和图片里的文本并复制到剪贴板和文档属性中",
  RERUN_OCR: "重新 OCR 整个画布：识别涂鸦和图片里的文本并复制到剪贴板和文档属性中",
  RUN_OCR_ELEMENTS: "OCR 选中的元素：识别涂鸦和图片里的文本并复制到剪贴板",
  TRAY_MODE: "绘图工具属性页：面板模式 ⟺ 托盘模式",
  SEARCH: "搜索文本",
  CROP_PAGE: "对所选页面裁剪并添加蒙版",
  CROP_IMAGE: "对图片裁剪并添加蒙版",
  ANNOTATE_IMAGE : "在 Excalidraw 中标注图像",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "将当前激活的 PDF 页面作为图片插入",
  RESET_IMG_TO_100: "重置图像元素的尺寸为 100%",
  RESET_IMG_ASPECT_RATIO: "重置所选图像元素的纵横比",
  TEMPORARY_DISABLE_AUTOSAVE: "临时禁用自动保存功能，直到本次 Obsidian 退出（小白慎用！）",
  TEMPORARY_ENABLE_AUTOSAVE: "启用自动保存功能",
  FONTS_LOADED : "Excalidraw: CJK 字体已加载" ,
  FONTS_LOAD_ERROR : "Excalidraw: 在资源文件夹下找不到 CJK 字体\n" ,

  //Prompt.ts
  SELECT_LINK_TO_OPEN: "选择要打开的链接",

  //ExcalidrawView.ts
  ERROR_CANT_READ_FILEPATH : "错误，无法读取文件路径。正在改为导入文件",
  NO_SEARCH_RESULT: "在绘图中未找到匹配的元素",
  FORCE_SAVE_ABORTED: "自动保存被中止，因为文件正在保存中",
  LINKLIST_SECOND_ORDER_LINK: "二级链接",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE: "自定义嵌入文件链接",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT: "请不要在文件名周围添加 [[方括号]]！<br>" +
    "对于 markdown 图像，在编辑链接时请遵循以下格式：<mark>文件名#^块引用|宽度x最大高度</mark><br>" +
    "您可以通过在链接末尾添加 <code>|100%</code> 来将 Excalidraw 图像锚定为 100% 的大小。<br>" +
    "您可以通过将 <code>#page=1</code> 更改为 <code>#page=2</code> 等来更改 PDF 页码。<br>" +
    "PDF 矩形裁剪值为：<code>左, 下, 右, 上</code>。例如：<code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "渲染框架：已启用",
  FRAME_CLIPPING_DISABLED: "渲染框架：已禁用",
  ARROW_BINDING_INVERSE_MODE: "反转模式：默认方向按键已禁用。需要时请使用 Ctrl/CMD 临时启用。",
  ARROW_BINDING_NORMAL_MODE: "正常模式：方向键已启用。需要时请使用 Ctrl/CMD 临时禁用。",
  EXPORT_FILENAME_PROMPT: "请提供文件名",
  EXPORT_FILENAME_PROMPT_PLACEHOLDER: "请输入文件名，留空以取消操作",
  WARNING_SERIOUS_ERROR: "警告：Excalidraw 遇到了未知的问题!\n\n" +
    "您最近的更改可能无法保存。\n\n" +
    "为了安全起见，请按以下步骤操作：\n" +
    "1) 使用 Ctrl/CMD+A 选择您的绘图，然后使用 Ctrl/CMD+C 进行复制。\n" +
    "2) 然后在新窗格中，通过 Ctrl/CMD 点击 Excalidraw 功能区按钮创建一个空白绘图。\n" +
    "3) 最后，使用 Ctrl/CMD+V 将您的作品粘贴到新文档中。",
  ARIA_LABEL_TRAY_MODE: "托盘模式提供了一个更宽敞的画布空间",
  MASK_FILE_NOTICE: "这是一个蒙版图像。长按本提示来观看视频讲解。",
  INSTALL_SCRIPT_BUTTON: "安装或更新 Excalidraw 脚本",
  OPEN_AS_MD: "打开为 Markdown 文档",
  EXPORT_IMAGE: `导出为图像`,
  OPEN_LINK: "打开所选元素里的链接 \n（按住 Shift 在新面板打开）",
  EXPORT_EXCALIDRAW: "导出为 .excalidraw 文件（旧版绘图文件格式）",
  LINK_BUTTON_CLICK_NO_TEXT:
    "请选择一个包含内部或外部链接的元素。\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR:
    "箭头和线元素的链接无法通过 " + labelCTRL() + " + 点击元素来导航，因为这也会激活线编辑器。\n" +
    "请使用右键上下文菜单打开链接，或点击元素右上角的链接指示器。\n",
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
  ERROR_SAVING_IMAGE: "获取图像时发生未知错误。可能是由于某种原因，图像不可用或拒绝了 Obsidian 的获取请求。",
  WARNING_PASTING_ELEMENT_AS_TEXT: "你不能将 Excalidraw 元素粘贴为文本元素！",
  USE_INSERT_FILE_MODAL: "使用“插入任意文件”功能来嵌入 Markdown 文档",
  RECURSIVE_INSERT_ERROR: "你不能将图像的一部分嵌入到此图像中，因为这可能导致无限循环。",
  CONVERT_TO_MARKDOWN: "转存为 Markdown 文档（并嵌入为 MD-Embeddable）",
  SELECT_TEXTELEMENT_ONLY: "只选择文本元素（非容器）",
  REMOVE_LINK: "移除文字元素链接",
  LASER_ON: "启用激光笔",
  LASER_OFF: "关闭激光笔",
  WELCOME_RANK_NEXT: "张绘图之后，可以到达下一等级！",
  WELCOME_RANK_LEGENDARY: "您已是绘图大师，请续写传奇~",
  WELCOME_COMMAND_PALETTE: '在命令面板中输入 "Excalidraw"',
  WELCOME_OBSIDIAN_MENU: "探索右上角的 Obsidian 菜单",
  WELCOME_SCRIPT_LIBRARY: "访问脚本库",
  WELCOME_HELP_MENU: "在汉堡菜单（三横线）中寻找帮助",
  WELCOME_YOUTUBE_ARIA: "可视化个人知识管理的 YouTube 频道",
  WELCOME_YOUTUBE_LINK: "查看可视化个人知识管理的 YouTube 频道",
  WELCOME_DISCORD_ARIA: "加入 Discord 服务器",
  WELCOME_DISCORD_LINK: "加入 Discord 服务器",
  WELCOME_TWITTER_ARIA: "在 Twitter 上关注我",
  WELCOME_TWITTER_LINK: "在 Twitter 上关注我",
  WELCOME_LEARN_ARIA: "学习“可视化个人知识管理”（Visual PKM）",
  WELCOME_LEARN_LINK: "报名加入视觉思维工作坊",
  WELCOME_DONATE_ARIA: "捐赠以支持 Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: '感谢并支持此插件。',
  SAVE_IS_TAKING_LONG: "保存您之前的文件花费的时间较长，请稍候...",
  SAVE_IS_TAKING_VERY_LONG: "为了更好的性能，请考虑将大型绘图拆分成几个较小的文件。",

  //settings.ts
  RELEASE_NOTES_NAME: "显示更新说明",
  RELEASE_NOTES_DESC:
    "<b>开启：</b>每次更新本插件后，显示最新发行版本的说明。<br>" +
    "<b>关闭：</b>您仍可以在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a> 上阅读更新说明。",
  NEWVERSION_NOTIFICATION_NAME: "通知插件更新",
  NEWVERSION_NOTIFICATION_DESC:
      "<b>开启：</b>当本插件存在可用更新时，显示通知。<br>" +
      "<b>关闭：</b>您需要手动检查本插件的更新（设置 - 第三方插件 - 检查更新）。",

  BASIC_HEAD: "基本",
  BASIC_DESC: `包括：更新说明，更新提示，新绘图文件、模板文件、脚本文件的存储路径等的设置。`,
  FOLDER_NAME: "Excalidraw 文件夹（區分大小寫！）",
  FOLDER_DESC:
    "新绘图的默认存储路径。若为空，将在库的根目录中创建新绘图。",
  CROP_PREFIX_NAME: "剪贴文件的前缀",
  CROP_PREFIX_DESC:
    "当剪贴图片进来时保存的文件名的前缀。 " +
    "留空则使用 'cropped_'",
  ANNOTATE_PREFIX_NAME: "标注文件的前缀",
  ANNOTATE_PREFIX_DESC:
    "在标注图像时创建新绘图的文件名的第一部分。" +
    "留空则使用'annotated_'",
  ANNOTATE_PRESERVE_SIZE_NAME: "在标注时保留图像尺寸",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "当在 Markdown 中标注图像时，替换后的图像链接将包含原始图像的宽度。",
  CROP_FOLDER_NAME: "剪贴文件文件夹（區分大小寫！）",
  CROP_FOLDER_DESC:
    "剪贴图像时创建新绘图的默认存储路径。如果留空，将按照 Vault 附件设置创建。",
  ANNOTATE_FOLDER_NAME: "图片标注文件文件夹（區分大小寫！）",
  ANNOTATE_FOLDER_DESC:
    "创建图片标注是的默认存储路径。如果留空，将按照 Vault 附件设置创建。",
  FOLDER_EMBED_NAME:
    "将 Excalidraw 文件夹用于“新建绘图”系列命令",
  FOLDER_EMBED_DESC:
    "在命令面板中执行“新建绘图”系列命令时，" +
    "新建的绘图文件的存储路径。<br>" +
    "<b>开启：</b>使用上面的 Excalidraw 文件夹。 <br><b>关闭：</b>使用 Obsidian 设置的新附件默认位置。",
  TEMPLATE_NAME: "Excalidraw 模板文件（區分大小寫！）",
  TEMPLATE_DESC:
    "Excalidraw 模板文件（文件夹）的存储路径。<br>" +
    "<b>模板文件：</b>比如：如果您的模板在默认的 Excalidraw 文件夹中且文件名是 " +
    "Template.md，则此项应设为 Excalidraw/Template.md（也可省略 .md 扩展名，即 Excalidraw/Template）。" +
    "如果您在兼容模式下使用 Excalidraw，那么您的模板文件也必须是旧的 *.excalidraw 格式，" +
    "例如 Excalidraw/Template.excalidraw。<br><b>模板文件夹：</b> 你还可以将文件夹设置为模板。 " +
    "在这种情况下，创建新绘图时将提示您选择使用哪个模板。<br>" +
    "<b>专业提示：</b> 如果您正在使用 Obsidian Templater 插件，您可以将 Templater 代码添加到不同的" +
    "Excalidraw 模板中，以自动配置您的绘图",
  SCRIPT_FOLDER_NAME: "Excalidraw 自动化脚本的文件夹（區分大小寫！）",
  SCRIPT_FOLDER_DESC:
    "此文件夹用于存放 Excalidraw 自动化脚本。" +
    "您可以在 Obsidian 命令面板中执行这些脚本，" +
    "还可以为喜欢的脚本分配快捷键，就像为其他 Obsidian 命令分配快捷键一样。<br>" +
    "该项不能设为库的根目录。",
  AI_HEAD: "AI（实验性）",
  AI_DESC: `OpenAI GPT API 的设置。 ` +
    `目前 OpenAI API 还处于测试中，您需要在自己的。` +
    `OpenAI 账户中充值至少 5 美元后才能生成 API key，` +
    `然后就可以在 Excalidraw 中配置并使用 AI。`,
  AI_ENABLED_NAME : "启用 AI 功能" ,
  AI_ENABLED_DESC : "您需要重新打开 Excalidraw 才能使更改生效。" ,
  AI_OPENAI_TOKEN_NAME: "OpenAI API key",
  AI_OPENAI_TOKEN_DESC:
    "您可以访问您的<a href='https://platform.openai.com/api-keys'> OpenAI 账户</a>来获取自己的 OpenAI API key。",
  AI_OPENAI_TOKEN_PLACEHOLDER: "OpenAI API key",
  AI_OPENAI_DEFAULT_MODEL_NAME: "默认的文本 AI 模型",
  AI_OPENAI_DEFAULT_MODEL_DESC:
    "使用哪个 AI 模型来生成文本。请填写有效的 OpenAI 模型名称。" +
    "您可访问<a href='https://platform.openai.com/docs/models'> OpenAI 网站</a>了解更多模型信息。",
  AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER: "gpt-3.5-turbo-1106",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME: "默认的图像 AI 模型",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC:
    "使用哪个 AI 模型来生成图像（在编辑和调整图像时会强制使用 dall-e-2 模型，" +
    "因为目前只有该模型支持编辑和调整图像）。" +
    "请填写有效的 OpenAI 模型名称。" +
    "您可访问<a href='https://platform.openai.com/docs/models'>OpenAI 网站</a>了解更多模型信息。",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER: "dall-e-3",
  AI_OPENAI_DEFAULT_VISION_MODEL_NAME: "默认的 AI 视觉模型",
  AI_OPENAI_DEFAULT_VISION_MODEL_DESC:
    "根据文本生成图像时，使用哪个 AI 视觉模型。请填写有效的 OpenAI 模型名称。" +
    "您可访问<a href='https://platform.openai.com/docs/models'> OpenAI 网站</a>了解更多模型信息。",
  AI_OPENAI_DEFAULT_API_URL_NAME: "OpenAI API URL",
  AI_OPENAI_DEFAULT_API_URL_DESC:
    "默认的 OpenAI API URL。请填写有效的 OpenAI API URL。" +
    "Excalidraw 会通过该 URL 发送 API 请求给 OpenAI。我没有对此选项做任何错误处理，请谨慎修改。",
  AI_OPENAI_DEFAULT_IMAGE_API_URL_NAME: "OpenAI 图像生成 API URL",
  AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER: "输入你的默认 AI 模型名称，例如：gpt-4o",
  SAVING_HEAD: "保存",
  SAVING_DESC: "包括：压缩，自动保存的时间间隔，文件的命名格式和扩展名等的设置。",
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
  DECOMPRESS_FOR_MD_NAME: "在 Markdown 视图中解压缩 Excalidraw JSON",
  DECOMPRESS_FOR_MD_DESC:
    "通过启用此功能，Excalidraw 将在切换到 Markdown 视图时自动解压缩绘图 JSON。" +
    "这将使您能够轻松阅读和编辑 JSON 字符串。" +
    "一旦您切换回 Excalidraw 视图并保存绘图（Ctrl+S），绘图将再次被压缩。<br>" +
    "我建议关闭此功能，因为这可以获得更小的文件尺寸，并避免在 Obsidian 搜索中出现不必要的结果。 " +
    "您始终可以使用命令面板中的“Excalidraw: 解压缩当前 Excalidraw 文件”命令"+
    "在需要阅读或编辑时手动解压缩绘图 JSON。",
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
  DISPLAY_HEAD: "界面 & 行为",
  DISPLAY_DESC: "在 Excalidraw 设置的 '外观和行为' 部分，您可以微调 Excalidraw 的外观和行为。这包括动态样式、左手模式、匹配 Excalidraw 和 Obsidian 主题、默认模式等选项。",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME : "限制 Obsidian 字体大小为编辑器文本" ,
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC :
    "Obsidian 的自定义字体大小设置会影响整个界面，包括 Excalidraw 和依赖默认字体大小的主题。" +
    "启用此选项将限制字体大小更改为编辑器文本，这将改善 Excalidraw 的外观。" +
    "如果启用后发现界面的某些部分看起来不正确，请尝试关闭此设置。" ,
  DYNAMICSTYLE_NAME: "动态样式",
  DYNAMICSTYLE_DESC:
    "根据画布颜色自动调节 Excalidraw 界面颜色",
  LEFTHANDED_MODE_NAME: "左手模式",
  LEFTHANDED_MODE_DESC:
    "目前只在托盘模式下生效。若开启此项，则托盘（绘图工具属性页）将位于右侧。" +
    "<br><b>开启：</b>左手模式。<br><b>关闭：</b>右手模式。",
  IFRAME_MATCH_THEME_NAME: "使 Embeddable 匹配 Excalidraw 主题",
  IFRAME_MATCH_THEME_DESC:
    "<b>开启：</b>当 Obsidian 和 Excalidraw 一个使用黑暗主题、一个使用明亮主题时，" +
    "开启此项后，以交互形式嵌入到绘图中的元素（Embeddable） 将会匹配 Excalidraw 主题。<br>" +
    "<b>关闭：</b>如果您想要 Embeddable 匹配 Obsidian 主题，请关闭此项。",
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
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME : "启用双击文本创建",
  DISABLE_DOUBLE_TAP_ERASER_NAME: "启用手写模式下的双击橡皮擦功能",
  DISABLE_SINGLE_FINGER_PANNING_NAME: "启用手写模式下的单指平移功能",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "在触控笔模式下显示十字准星（+）",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "在触控笔模式下使用涂鸦功能会显示十字准星 <b><u>打开:</u></b> 显示 <b><u>关闭:</u></b> 隐藏<br>"+
    "效果取决于设备。十字准星通常在绘图板、MS Surface 上可见。但在 iOS 上不可见。",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME: "在鼠标悬停预览时将 Excalidraw 文件渲染文图片",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "...即使文件具有 `<b>excalidraw-open-md: true</b>` frontmatter 属性。<br>" +
    "当此设置关闭且文件默认设置为以 md 格式打开时，悬停预览将显示文档的 Markdown 部分（背景笔记）。" +
    "",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME: "Excalidraw 文件在 Markdown 阅读模式下渲染为图片",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC:
    "当您处于 Markdown 阅读模式（即查看绘图的背景笔记）时，Excalidraw 绘图是否应该渲染为图像？" +
    "此设置不会影响您在 Excalidraw 模式下的绘图显示，或者在将绘图嵌入 Markdown 文档时，或在渲染悬停预览时。<br><ul>" +
    "<li>请参阅下面‘嵌入和导出’部分的 <a href='#"+TAG_PDFEXPORT+"'>PDF 导出</a> 相关设置。</li></ul><br>" +
    "您必须关闭当前的 Excalidraw/Markdown 文件并重新打开，以使此更改生效。",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME : "在 Obsidian 中导出为 PDF 格式时将 Excalidraw 渲染为图像" ,
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC:
    "此设置控制在使用 Obsidian 内置的<b>导出为 PDF</b>功能，如何将 Excalidraw 文件导出为 PDF。<br>" +
    "<ul><li><b>启用：</b>PDF 将包含图像格式的 Excalidraw 绘图。</li>" +
    "<li><b>禁用：</b>PDF 将包含作为文本的 Markdown 内容。</li></ul>" +
    "注意：此设置不会影响 Excalidraw 本身的 PDF 导出功能。<br>" +
    "请参阅上方“外观和行为”部分中与<a href='#" + TAG_MDREADINGMODE + "'>Markdown 阅读模式</a>相关的其他设置。<br>" +
    "⚠️ 您必须关闭并重新打开 Excalidraw/Markdown 文件，设置更改才会生效。⚠️",
  HOTKEY_OVERRIDE_HEAD: "热键覆盖",
  HOTKEY_OVERRIDE_DESC: `一些 Excalidraw 的热键，例如 ${labelCTRL()}+Enter 用于编辑文本，或 ${labelCTRL()}+K 用于创建元素链接。` +
    "与 Obsidian 的热键设置发生冲突。您在下面添加的热键组合将在使用 Excalidraw 时覆盖 Obsidian 的热键设置，" +
    `因此如果您希望在 Excalidraw 中默认选择“组合对象”，而不是打开“图形视图”，您可以添加 ${labelCTRL()}+G。`,
  THEME_HEAD: "主题和样式",
  ZOOM_HEAD: "缩放",
  DEFAULT_PINCHZOOM_NAME: "允许在触控笔模式下进行双指缩放",
  DEFAULT_PINCHZOOM_DESC:
    "在触控笔模式下使用自由画笔工具时，双指缩放可能造成干扰。<br>" +
    "<b>开启:：</b>允许在触控笔模式下进行双指缩放<br><b>关闭： </b>禁止在触控笔模式下进行双指缩放",

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
  PEN_HEAD: "手写笔",
  GRID_HEAD: "网格",
  GRID_DYNAMIC_COLOR_NAME: "动态网格颜色",
  GRID_DYNAMIC_COLOR_DESC:
    "<b><u>开启：</u></b>更改网格颜色以匹配画布颜色<br><b><u>关闭：</u></b>将以下颜色用作网格颜色",
  GRID_COLOR_NAME: "网格颜色",
  GRID_OPACITY_NAME: "网格透明度",
  GRID_OPACITY_DESC: "网格透明度还将控制将箭头绑定到元素时绑定框的透明度。<br>"+
    "设置网格的不透明度。 0 表示完全透明，100 表示完全不透明。",
  GRID_DIRECTION_NAME : "网格方向" ,
  GRID_DIRECTION_DESC : "第一个开关显示/隐藏水平网格，第二个开关显示/隐藏垂直网格。" ,
  GRID_HORIZONTAL : "渲染水平网格" ,
  GRID_VERTICAL : "渲染垂直网格" ,
  LASER_HEAD: "激光笔工具（更多工具 > 激光笔）",
  LASER_COLOR: "激光笔颜色",
  LASER_DECAY_TIME_NAME: "激光笔消失时间",
  LASER_DECAY_TIME_DESC: "单位是毫秒，默认是 1000（即 1 秒）。",
  LASER_DECAY_LENGTH_NAME: "激光笔轨迹长度",
  LASER_DECAY_LENGTH_DESC: "默认是 50。",
  LINKS_HEAD: "链接 & 以内部链接形式嵌入到绘图中的 Markdown 文档（MD-Transclusion）& 待办任务（Todo）",
  LINKS_HEAD_DESC: "包括：链接的打开和显示，MD-Transclusion 的显示，Todo 的显示等设置。",
  LINKS_DESC:
    `按住 ${labelCTRL()} 并点击包含 <code>[[链接]]</code> 的文本元素可以打开其中的链接。` +
    "如果所选文本元素包含多个 <code>[[有效的内部链接]]</code> ，只会打开第一个链接；" +
    "如果所选文本元素包含有效的 URL 链接（如 <code>https://</code> 或 <code>http://</code>），" +
    "插件会在浏览器中打开链接。<br>" +
    "链接的源文件被重命名时，绘图中相应的 <code>[[内部链接]]</code> 也会同步更新。" +
    "若您不愿绘图中的链接外观因此而变化，可使用 <code>[[内部链接|别名]]</code>。",
  DRAG_MODIFIER_NAME: "修饰键",
  DRAG_MODIFIER_DESC: "在您按住点击链接或拖放元素时，可以触发某些行为。您可以为这些行为添加修饰键。" +
    "Excalidraw 不会检查您的设置是否合理，因此请谨慎设置，避免冲突。" +
    "以下选项在苹果和非苹果设备上区别很大，如果您在多个硬件平台上使用 Obsidian，需要分别进行设置。"+
    "选项里的 4 个开关依次代表 " +
    (DEVICE.isIOS || DEVICE.isMacOS ? "Shift, CMD, OPT, CONTROL." : "Shift, Ctrl, Alt, META (Win 键)。"),
  LONG_PRESS_DESKTOP_NAME: "长按打开（电脑端）",
  LONG_PRESS_DESKTOP_DESC: "长按(以毫秒为单位)打开在 Markdown 文件中嵌入的 Excalidraw 绘图。",
  LONG_PRESS_MOBILE_NAME: "长按打开（移动端）",
  LONG_PRESS_MOBILE_DESC: "长按(以毫秒为单位)打开在 Markdown 文件中嵌入的 Excalidraw 绘图。",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE: "在查看模式下允许双击打开链接",

  FOCUS_ON_EXISTING_TAB_NAME: "聚焦于当前标签页",
  FOCUS_ON_EXISTING_TAB_DESC: "当打开一个链接时，如果该文件已经打开，Excalidraw 将会聚焦到现有的标签页上 " +
    "启用这个设置会在文件已经打开的情况下覆盖“重用相邻窗格”的设置。",
  SECOND_ORDER_LINKS_NAME: "显示二级链接",
  SECOND_ORDER_LINKS_DESC: "在 Excalidraw 中点击链接时显示链接。二级链接是指指向被点击链接的反向链接" +
    "当使用图标连接相似的笔记时，二级链接可以让你直接到达相关笔记，而不需要两次点击。" +
    "请观看 <a href='https://youtube.com/shorts/O_1ls9c6wBY?feature=share'>这个 YouTube Shorts 视频</a> 以了解更多信息。",
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
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> 的键值对。`,
  LINK_PREFIX_NAME: "内部链接的前缀",
  LINK_PREFIX_DESC: `${
    "文本元素处于预览（PREVIEW）模式时，如果其中包含链接，则添加此前缀。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> 的键值对。`,
  URL_PREFIX_NAME: "外部链接的前缀",
  URL_PREFIX_DESC: `${
    "文本元素处于预览（PREVIEW）模式时，如果其中包含外部链接，则添加此前缀。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> 的键值对。`,
  PARSE_TODO_NAME: "待办任务（Todo）",
  PARSE_TODO_DESC: "将文本元素中的 <code>- [ ]</code> 和 <code>- [x]</code> 前缀显示为方框。",
  TODO_NAME: "未完成项目",
  TODO_DESC: "未完成的待办项目的符号",
  DONE_NAME: "已完成项目",
  DONE_DESC: "已完成的待办项目的符号",
  HOVERPREVIEW_NAME: "鼠标悬停预览内部链接",
  HOVERPREVIEW_DESC:
    `<b>开启：</b>在 Excalidraw <u>阅读模式（View）</u>下，鼠标悬停在 <code>[[内部链接]]</code> 上即可预览；` +
    "而在<u>普通模式（Normal）</u>下，鼠标悬停在内部链接右上角的蓝色标识上即可预览。<br> " +
    `<b>关闭：</b>鼠标悬停在 <code>[[内部链接]]</code> 上，并且按住 ${labelCTRL()} 才能预览。`,
  LINKOPACITY_NAME: "链接标识的透明度",
  LINKOPACITY_DESC:
    "含有链接的元素，其右上角的链接标识的透明度。介于 0（全透明）到 1（不透明）之间。",
  LINK_CTRL_CLICK_NAME:
    `按住 ${labelCTRL()} 并点击含有 [[链接]] 或 [别名](链接) 的文本来打开链接`,
  LINK_CTRL_CLICK_DESC:
    "如果此功能影响到您使用某些原版 Excalidraw 功能，可将其关闭。" +
    "关闭后，您可以使用 ${labelCTRL()} + ${labelMETA()} 或者元素右上角的链接指示器来打开链接。",
  TRANSCLUSION_WRAP_NAME: "MD-Transclusion 的折行方式",
  TRANSCLUSION_WRAP_DESC:
    "中的 number 表示嵌入的文本溢出时，在第几个字符处进行折行。<br>" +
    "此开关控制具体的折行方式。若开启，则严格在 number 处折行，禁止溢出；" +
    "若关闭，则允许在 number 位置后最近的空格处折行。",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "MD-Transclusion 的默认折行位置",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "除了通过 <code>![[doc#^block]]{number}</code> 中的 number 来控制折行位置，您也可以在此设置 number 的默认值。<br>" +
    "一般设为 0 即可，表示不设置固定的默认值，这样当您需要嵌入文档到便签中时，" +
    "Excalidraw 能更好地帮您自动处理。",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "MD-Transclusion 的最大显示字符数",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "以 <code>![[内部链接]]</code> 或 <code>![](内部链接)</code> 的形式将文档以文本形式嵌入到绘图中时，" +
    "该文档在绘图中可显示的最大字符数量。",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "隐藏 MD-Transclusion 行首的引用符号",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "不显示 MD-Transclusion 中每一行行首的 > 符号，以提高纯文本 MD-Transclusion 的可读性。<br>" +
    "<b>开启：</b>隐藏 > 符号<br><b>关闭：</b>不隐藏 > 符号（注意，由于 Obsidian API 的原因，首行行首的 > 符号不会被隐藏）",
  GET_URL_TITLE_NAME: "使用 iframly 获取页面标题",
  GET_URL_TITLE_DESC:
    "拖放链接到 Excalidraw 时，使用 <code>http://iframely.server.crestify.com/iframely?url=</code> 来获取页面的标题。",
  PDF_TO_IMAGE: "以图像形式嵌入到绘图中的 PDF 文档",
  PDF_TO_IMAGE_SCALE_NAME: "分辨率",
  PDF_TO_IMAGE_SCALE_DESC: "分辨率越高，图像越清晰，但内存占用也越大。" +
    "此外，如果您想要复制这些图像到 Excalidraw.com，可能会超出其 2MB 大小的限制。",
  EMBED_TOEXCALIDRAW_HEAD: "嵌入到绘图中的文件",
  EMBED_TOEXCALIDRAW_DESC: "包括：以图像形式嵌入到绘图中的 PDF 文档、以交互形式嵌入到绘图中的 Markdown 文档（MD-Embeddable）、以图像形式嵌入的 Markdown 文档（MD-Embed）等。",
  MD_HEAD: "以图像形式嵌入到绘图中的 Markdown 文档（MD-Embed）",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "以交互形式嵌入到绘图中的 Markdown 文档（MD-Embeddable）",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `以下设置只会影响以后的嵌入。已存在的嵌入保持不变。嵌入框的主题设置位于 “Excalidraw 外观和行为” 部分。`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "单击以编辑嵌入的 markdown。",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "单击嵌入的 markdown 文件以进行编辑。 " +
    "当此功能关闭时，markdown 文件将首先以预览模式打开，然后在您再次单击时切换到编辑模式。",
  MD_TRANSCLUDE_WIDTH_NAME: "MD-Embed 的默认宽度",
  MD_TRANSCLUDE_WIDTH_DESC:
    "MD-Embed 的宽度。该选项会影响到折行，以及图像元素的宽度。<br>" +
    "您可为绘图中的某个 MD-Embed 单独设置此项，方法是将绘图切换至 Markdown 模式，" +
    "并修改相应的 <code>[[Embed 文件名#标题|宽度x最大高度]]</code>。",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "MD-Embed 的默认最大高度",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "MD-Embed 的高度取决于 Markdown 文档内容的多少，但最大不会超过该值。<br>" +
    "您可为绘图中的某个 MD-Embed 单独设置此项，方法是将绘图切换至 Markdown 模式，并修改相应的 <code>[[Embed 文件名#^块引ID|宽度x最大高度]]</code>。",
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
    "如果您要查询 CSS 所作用的 HTML 节点，请在 Obsidian 开发者控制台（Ctrl+Shift+I）中键入命令：" +
    "<code>ExcalidrawAutomate.mostRecentMarkdownSVG</code> —— 这将显示 Excalidraw 最近生成的 SVG。<br>" +
    "此外，在 CSS 中不能任意地设置字体，您一般只能使用系统默认的标准字体（详见 README），" +
    "但可以通过上面的设置来额外添加一个自定义字体。<br>" +
    "您可为某个 MD-Embed 单独设置此项，方法是在其源文件的 frontmatter 中添加形如 <code>excalidraw-css: 库中的 CSS 文件或 CSS 片段</code> 的键值对。",
  EMBED_HEAD: "嵌入到 Markdown 文档中的绘图",
  EMBED_DESC: `包括：嵌入到 Markdown 文档中的绘图的预览图类型（SVG、PNG）、源文件类型（Excalidraw 绘图文件、SVG、PNG）、缓存、图像大小、图像主题，以及嵌入的语法等。
    此外，还有自动导出 SVG 或 PNG 文件并保持与绘图文件状态同步的设置。`,
  EMBED_CANVAS: "Obsidian 白板支持",
  EMBED_CANVAS_NAME: "沉浸式嵌入",
  EMBED_CANVAS_DESC:
    "当嵌入绘图到 Obsidian 白板中时，隐藏元素的边界和背景。" +
    "注意：如果想要背景完全透明，您依然需要在 Excalidraw 中设置“导出的图像不包含背景”。",
  EMBED_CACHING : "图像缓存和渲染优化" ,
  RENDERING_CONCURRENCY_NAME : "图像渲染并发性" ,
  RENDERING_CONCURRENCY_DESC :
    "用于图像渲染的并行工作线程数。增加此数值可以加快渲染速度，但可能会减慢系统的其他部分运行速度。" +
    "默认值为 3。如果您的系统性能强大，可以增加此数值。" ,
  EXPORT_SUBHEAD: "导出",
  EMBED_SIZING: "图像尺寸",
  EMBED_THEME_BACKGROUND: "图像的主题和背景色",
  EMBED_IMAGE_CACHE_NAME: "为嵌入到 Markdown 文档中的绘图创建预览图缓存",
  EMBED_IMAGE_CACHE_DESC: "可提高下次嵌入的速度。" +
    "但如果绘图中又嵌入了子绘图，当子绘图改变时，您需要打开子绘图并手动保存，才能够更新父绘图的预览图。",
  SCENE_IMAGE_CACHE_NAME: "缓存场景中嵌套的 Excalidraw",
  SCENE_IMAGE_CACHE_DESC: "缓存场景中嵌套的 Excalidraw 以加快场景渲染速度。这将加快渲染过程，特别是在您的场景中有深度嵌套的 Excalidraw 时。" +
    "Excalidraw 将智能地尝试识别嵌套 Excalidraw 的子元素是否发生变化，并更新缓存。 " +
    "如果您怀疑缓存未能正确更新，您可能需要关闭此功能。",
  EMBED_IMAGE_CACHE_CLEAR: "清除缓存",
  BACKUP_CACHE_CLEAR: "清除备份",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "该操作将删除所有绘图文件的备份。备份是绘图文件损坏时的一种补救手段。每次您打开 Obsidian 时，本插件会自动清理无用的备份。您确定要现在删除所有备份吗？",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "将之前已导出的图像作为预览图",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "该选项与<a href='#"+TAG_AUTOEXPORT+"'>自动导出 SVG/PNG 副本</a>选项配合使用。如果嵌入到 Markdown 文档中的绘图文件存在同名的 SVG/PNG 副本，则将其作为预览图，而不再重新生成。<br>" +
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
    "<b>Native SVG：</b>高品质、可交互。<br>" +
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
  EMBED_HEIGHT_NAME: "预览图的默认高度",
  EMBED_HEIGHT_DESC:
    "嵌入到 Markdown 文档中的绘图的预览图得默认高度。该选项也适用于实时预览编辑和阅读模式，以及悬停预览。" +
    "您可以在使用 <code>![[drawing.excalidraw|100]]</code> 或者 <code>[[drawing.excalidraw|100x100]]</code>" +
    "格式在嵌入图像时指定自定义高度。",
  EMBED_TYPE_NAME: "“嵌入绘图到当前 Markdown 文档中”系列命令的源文件类型",
  EMBED_TYPE_DESC:
    "在命令面板中执行“嵌入绘图到当前 Markdown 文档中”系列命令时，要嵌入绘图文件本身，还是嵌入其 PNG 或 SVG 副本。<br>" +
    "如果您想选择 PNG 或 SVG 副本，需要先开启下方的<a href='#"+TAG_AUTOEXPORT+"'>自动导出 PNG / SVG 副本</a>。<br>" +
    "如果您选择了 PNG 或 SVG 副本，当副本不存在时，该命令将会插入一条损坏的链接，您需要打开绘图文件并手动导出副本才能修复 —— " +
    "也就是说，该选项不会自动帮您生成 PNG/SVG 副本，而只会引用已有的 PNG/SVG 副本。",
  EMBED_MARKDOWN_COMMENT_NAME: "将链接作为注释嵌入",
  EMBED_MARKDOWN_COMMENT_DESC:
    "在图像下方以 Markdown 链接的形式嵌入原始 Excalidraw 文件的链接，例如：<code>%%[[drawing.excalidraw]]%%</code>。<br>" +
    "除了添加 Markdown 注释之外，您还可以选择嵌入的 SVG 或 PNG，并使用命令面板：" +
    "'<code>Excalidraw: 打开 Excalidraw 绘图</code>'来打开该绘图",
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
    "导出的 SVG/PNG 图像四周的空白边距（单位：像素）。对于裁剪框架引用，间距被设置为 0。<br>" +
    "增加该值，可以避免在导出图像时，靠近图像边缘的图形被裁掉。<br>" +
    "您可为某个绘图单独设置此项，方法是在其 frontmatter 中添加形如 <code>excalidraw-export-padding: 5<code> 的键值对。",
  EXPORT_THEME_NAME: "导出的图像匹配主题",
  EXPORT_THEME_DESC:
    "导出与绘图的黑暗/明亮主题匹配的图像。" +
    "如果关闭，在黑暗主题下导出的图像将和明亮主题一样。",
  EXPORT_EMBED_SCENE_NAME: "在导出的图片中嵌入场景",
  EXPORT_EMBED_SCENE_DESC:
    "在导出的图像中嵌入 Excalidraw 场景。可以通过在文件级别添加 <code>excalidraw-export-embed-scene: true/false</code> frontmatter 元数据键来覆盖此设置。" +
    "此设置仅在您下次(重新)打开绘图时生效。",
  PDF_EXPORT_SETTINGS : "PDF 导出设置",
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
  COMPATIBILITY_DESC: "如果没有特殊原因（例如您想同时在 VSCode / Logseq 和 Obsidian 中使用 Excalidraw），建议您使用 Markdown 格式的绘图文件，而不是旧的 excalidraw.com 格式，因为本插件的很多功能在旧格式中无法使用。",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "代码格式化（Linting）兼容性",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC: "Excalidraw 对 <code># Excalidraw Data</code> 下的文件结构非常敏感。文档的自动代码格式化（linting）可能会在 Excalidraw 数据中造成错误。" +
    "虽然我已经努力使数据加载对自动代码格式化（linting）变更具有一定的抗性，但这种解决方案并非万无一失。<br>"+
    "<mark>最好的方法是避免使用不同的插件对 Excalidraw 文档进行自动更改。</mark><br>" +
    "如果出于某些合理的原因，您决定忽略我的建议并配置了 Excalidraw 文件的自动代码格式化，那么可以使用这个设置<br> " +
    "<code>## Text Elements</code> 部分对空行很敏感。一种常见的代码格式化是在章节标题后添加一个空行。但对于 Excalidraw 来说，这将破坏/改变您绘图中的第一个文本元素。" +
    "为了解决这个问题，您可以启用这个设置。启用后 Excalidraw 将在 <code>## Text Elements</code> 的开头添加一个虚拟元素，供自动代码格式化工具修改。" ,
  PRESERVE_TEXT_AFTER_DRAWING_NAME: "Zotero 和脚注（footnotes）的兼容性",
  PRESERVE_TEXT_AFTER_DRAWING_DESC: "保留 Markdown 文件中 <code>## Drawing</code> 部分之后的文本内容。保存非常大的绘图时，这可能会造成微小的性能影响。",
  DEBUGMODE_NAME: "开启 debug 信息",
  DEBUGMODE_DESC: "我建议在启用/禁用此设置后重新启动 Obsidian。这将在控制台中启用调试消息。这对于排查问题很有帮助。" +
    "如果您在使用插件时遇到问题，请启用此设置，重现问题，并在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/issues'>GitHub</a> 上提出的问题中包含控制台日志。",
  SLIDING_PANES_NAME: "Sliding panes 插件支持",
  SLIDING_PANES_DESC:
    "设置此项后需要重启 Obsidian 才能生效。<br>" +
    "如果您使用 <a href='https://github.com/deathau/sliding-panes-obsidian' target='_blank'>Sliding Panes 插件</a>，" +
    "您可以开启此项来使 Excalidraw 绘图兼容此插件。<br>" +
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
    "⚠️ 慎用！99.9% 的情况下您不需要开启此项。" +
    "开启此功能后，您通过功能区按钮、命令面板、" +
    "文件浏览器等创建的绘图都将是旧格式（*.excalidraw）。" +
    "此外，您打开旧格式绘图文件时将不再收到警告消息。",
  MATHJAX_NAME: "MathJax (LaTeX) 的 javascript 库服务器",
  MATHJAX_DESC: "如果您在绘图中使用 LaTeX，插件需要从服务器获取并加载一个 javascript 库。" +
    "如果您的网络无法访问某些库服务器，可以尝试通过此选项更换库服务器。"+
    "更改此选项后，您可能需要重启 Obsidian 来使其生效。",
  LATEX_DEFAULT_NAME: "插入 LaTeX 时的默认表达式",
  LATEX_DEFAULT_DESC: "允许留空。允许使用类似 <code>\\color{white}</code> 的格式化表达式。",
  LATEX_PREAMBLE_NAME : "LaTeX 前言文件（區分大小寫！）" ,
  LATEX_PREAMBLE_DESC : "前言文件的完整路径，留空则使用默认值。如果文件不存在，此选项将被忽略。<br><strong>重要：</strong>更改后需要重新加载 Obsidian 才能生效！" ,
  NONSTANDARD_HEAD: "非 Excalidraw.com 官方支持的特性",
  NONSTANDARD_DESC: `这些特性不受 Excalidraw.com 官方支持。如果在 Excalidraw.com 导入绘图，这些特性将会发生不可预知的变化。
    包括：自定义画笔工具的数量，自定义字体等。`,
  RENDER_TWEAK_HEAD: "渲染优化",
  MAX_IMAGE_ZOOM_IN_NAME: "最大图像放大倍数",
  MAX_IMAGE_ZOOM_IN_DESC: "为了节省内存，并且因为 Apple Safari (Obsidian on iOS) 有一些硬编码的限制，Excalidraw.com 在放大时会限制图像和大型对象的最大分辨率。您可以使用乘数来覆盖这个限制。" +
    "这意味着将乘以 Excalidraw 默认设置的限制，乘数越大，图像放大分辨率就越高，但也会消耗更多内存。" +
    "我建议尝试多个值来设置这个参数。当您放大一个较大的 PNG 图像时，如果图像突然从视图中消失，那就说明您已经达到了极限。默认值为 1。此设置对 iOS 无效。",
  CUSTOM_PEN_HEAD: "自定义画笔",
  CUSTOM_PEN_NAME: "自定义画笔工具的数量",
  CUSTOM_PEN_DESC: "在画布上的 Obsidian 菜单按钮旁边切换自定义画笔。长按（双击）画笔按钮可以修改其样式。",
  EXPERIMENTAL_HEAD: "杂项",
  EXPERIMENTAL_DESC: `包括：默认的 LaTeX 公式，字段建议，绘图文件的类型标识符，OCR 等设置。`,
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
    "可通过下一项设置来自定义类型标识符。",
  FILETAG_NAME: "excalidraw.md 文件的类型标识符",
  FILETAG_DESC: "要显示为类型标识符的 emoji 或文本。",
  INSERT_EMOJI: "插入 emoji",
  LIVEPREVIEW_NAME: "嵌入绘图到文档时，模拟嵌入图像的语法",
  LIVEPREVIEW_DESC:
    "开启此项，则可在 Obsidian 实时预览模式的编辑视图下，用形如 <code>![[绘图|宽度|样式]]</code> 的语法来嵌入绘图。<br>" +
    "该选项不会在已打开的文档中立刻生效 —— " +
    "你需要重新打开此文档来使其生效。",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "淡化 Excalidraw 标记",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC: "在 Markdown 视图模式下，在 Markdown 注释 %% " +
    "之后的部分会淡化。文本仍然存在，但视觉杂乱感会减少。请注意，您可以将 %% 放在 # Text Elements 行的上一行，" +
    "这样，整个 Excalidraw Markdown 都会淡化，包括 # Text Elements。 副作用是您将无法在其他 Markdown 笔记中引用文本块，即 %% 注释部分之后的内容。这应该不是大问题。" +
    "如果您想编辑 Excalidraw Markdown 脚本，只需切换到 Markdown 视图模式并暂时删除 %% 注释。",
  EXCALIDRAW_PROPERTIES_NAME: "将 Excalidraw 属性加载到 Obsidian 的自动提示中",
  EXCALIDRAW_PROPERTIES_DESC: "切换此设置以在插件启动时将 Excalidraw 文档属性加载到 Obsidian 的属性自动提示中。"+
   "启用此功能简化了 Excalidraw 前置属性的使用，使您能够利用许多强大的设置。如果您不希望自动加载这些属性，" +
   "您可以禁用此功能，但您将需要手动从自动提示中移除任何不需要的属性。" +
   "请注意，启用此设置需要重启插件，因为属性是在启动时加载的。",
  FONTS_HEAD: "字体",
  FONTS_DESC: "配置本地字体并下载的 CJK 字体以供 Excalidraw 使用。",
  CUSTOM_FONT_HEAD: "本地字体",
  ENABLE_FOURTH_FONT_NAME: "为文本元素启用本地字体",
  ENABLE_FOURTH_FONT_DESC:
    "启用此选项将在文本元素的属性面板的字体列表中添加一个本地字体。" +
    "请注意，使用这个本地字体可能会破坏平台的独立性。" +
    "使用自定义字体的文件在不同的库中打开或在以后打开时，根据字体设置，可能会以不同的方式呈现。" +
    "此外，在excalidraw.com 或其他 Excalidraw 版本中，默认的本地字体字体将使用系统字体。",
  FOURTH_FONT_NAME: "本地字体文件",
  FOURTH_FONT_DESC:
    "从您的库中选择一个 .otf、.ttf、.woff 或 .woff2 字体文件作为本地字体使用。"+
    "如果没有选择文件，Excalidraw 将默认使用 Virgil 字体。"+
    "为了获得最佳性能，建议使用 .woff2 文件，因为当导出到 SVG 格式的图像时，Excalidraw 只会编码必要的字形。"+
    "其他字体格式将在导出文件中嵌入整个字体，可能会导致文件大小显著增加。<mark>译者注：</mark>您可以在<a href='https://wangchujiang.com/free-font/' target='_blank'>Free Font</a>获取免费商用中文手写字体。",
  OFFLINE_CJK_NAME: "离线 CJK 字体支持",
  OFFLINE_CJK_DESC:
    `<strong>您在这里所做的更改将在重启 Obsidian 后生效。</strong><br>
    Excalidraw.com 提供手写风格的 CJK 字体。默认情况下，这些字体并未在插件中本地包含，而是从互联网获取。
    如果您希望 Excalidraw 完全本地化，以便在没有互联网连接的情况下使用，可以从 <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip" target="_blank">GitHub 下载所需的字体文件</a>。
    下载后，将内容解压到您的 Vault 中的一个文件夹内。<br>
    预加载字体会影响启动性能。因此，您可以选择加载哪些字体。`,
  CJK_ASSETS_FOLDER_NAME: "CJK 字体文件夹（區分大小寫！）",
  CJK_ASSETS_FOLDER_DESC: `您可以在此设置 CJK 字体文件夹的位置。例如，您可以选择将其放置在 <code>Excalidraw/CJK Fonts</code> 下。<br><br>
    <strong>重要：</strong> 请勿将此文件夹设置为 Vault 根目录！请勿在此文件夹中放置其他字体。<br><br>
    <strong>注意：</strong> 如果您使用 Obsidian Sync 并希望在设备之间同步这些字体文件，请确保 Obsidian Sync 设置为同步“所有其他文件类型”。`,
  LOAD_CHINESE_FONTS_NAME: "启动时从文件加载中文字体",
  LOAD_JAPANESE_FONTS_NAME: "启动时从文件加载日文字体",
  LOAD_KOREAN_FONTS_NAME: "启动时从文件加载韩文字体",
  SCRIPT_SETTINGS_HEAD: "已安装脚本的设置",
  SCRIPT_SETTINGS_DESC: "有些 Excalidraw 自动化脚本包含设置项，当执行这些脚本时，它们会在该列表下添加设置项。",
  TASKBONE_HEAD: "Taskbone OCR（光学符号识别）",
  TASKBONE_DESC: "这是一个将 OCR 融入 Excalidraw 的实验性功能。请注意，Taskbone 是一项独立的外部服务，而不是由 Excalidraw 或 Obsidian-excalidraw-plugin 项目提供的。" +
    "OCR 能够对画布上用自由画笔工具写下的涂鸦或者嵌入的图像进行文本识别，并将识别出来的文本写入绘图文件的 frontmatter，同时复制到剪贴板。" +
    "之所以要写入 frontmatter 是为了便于您在 Obsidian 中能够搜索到这些文本。" +
    "注意，识别的过程不是在本地进行的，而是通过在线 API，图像会被上传到 taskbone 的服务器（仅用于识别目的）。如果您介意，请不要使用这个功能。",
  TASKBONE_ENABLE_NAME: "启用 Taskbone",
  TASKBONE_ENABLE_DESC: "启用意味着您同意 Taskbone <a href='https://www.taskbone.com/legal/terms/' target='_blank'>条款及细则</a> 以及 " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>隐私政策</a>。",
  TASKBONE_APIKEY_NAME: "Taskbone API Key",
  TASKBONE_APIKEY_DESC: "Taskbone 的免费 API key 提供了一定数量的每月识别次数。如果您非常频繁地使用此功能，或者想要支持 " +
    "Taskbone 的开发者（您懂的，没有人能用爱发电，Taskbone 开发者也需要投入资金来维持这项 OCR 服务）您可以" +
    "到 <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a> 购买一个商用 API key。购买后请将它填写到旁边这个文本框里，替换掉原本自动生成的免费 API key。",

  //HotkeyEditor
  HOTKEY_PRESS_COMBO_NANE: "按下您的组合键",
  HOTKEY_PRESS_COMBO_DESC: "请按下所需的组合键",
  HOTKEY_BUTTON_ADD_OVERRIDE: "添加新的（热键）覆写",
  HOTKEY_BUTTON_REMOVE: "移除",

  //openDrawings.ts
  SELECT_FILE: "选择一个文件后按回车。",
  SELECT_COMMAND: "选择一个命令后按回车。",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `选择一个文件后按回车，或者 ${labelSHIFT()}+${labelMETA()}+Enter 以 100% 尺寸插入。`,
  NO_MATCH: "查询不到匹配的文件。",
  NO_MATCHING_COMMAND: "查询不到匹配的命令。",
  SELECT_FILE_TO_LINK: "选择要插入（以内部链接形式嵌入）到当前绘图中的文件。",
  SELECT_COMMAND_PLACEHOLDER: "选择要插入到当前绘图中的命令。",
  SELECT_DRAWING: "选择要插入（以图像形式嵌入）到当前绘图中的图像或绘图文件。",
  TYPE_FILENAME: "键入要选择的绘图名称。",
  SELECT_FILE_OR_TYPE_NEW:
    "选择已有绘图，或者键入新绘图文件的名称，然后按回车。",
  SELECT_TO_EMBED: "选择要插入（嵌入）到当前 Markdown 文档中的绘图。",
  SELECT_MD: "选择要插入（以图像形式嵌入）到当前绘图中的 Markdown 文档。",
  SELECT_PDF: "选择要插入（以图像形式嵌入）到当前绘图中的 PDF 文档。",
  PDF_PAGES_HEADER: "页码范围",
  PDF_PAGES_DESC: "示例：1, 3-5, 7, 9-11",

  //SelectCard.ts
  TYPE_SECTION: "输入章节名称（标题）进行选择",
  SELECT_SECTION_OR_TYPE_NEW:
    "选择现有章节（标题）或输入新章节（标题）的名称，然后按 Enter。",
  INVALID_SECTION_NAME: "无效的章节名称（标题）",
  EMPTY_SECTION_MESSAGE: "输入章节（标题）名称以创建",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW 警告\n停止加载嵌入的图像，因为此文件中存在死循环：\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "脚本运行错误。请在开发者控制台中查看错误信息。",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "Excalidraw 文件已损坏。尝试从备份文件中加载。",
  FONT_LOAD_SLOW: "正在加载字体...\n\n 这比预期花费的时间更长。如果这种延迟经常发生，您可以将字体下载到您的 Vault 中。\n\n" +
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
        <li>解压并将文件复制到 Vault 文件夹中（默认：<code>Excalidraw/${CJK_FONTS}</code>; 文件夹名称區分大小寫！）。</li>
        <li><mark>请勿</mark>将此文件夹设置为 Vault 根目录或与其他本地字体混合。</li>
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
  TOGGLE_FRAME_RENDERING: "开启或关闭框架渲染",
  TOGGLE_FRAME_CLIPPING: "开启或关闭框架裁剪",
  OPEN_LINK_CLICK: "打开所选的图形或文本元素里的链接",
  OPEN_LINK_PROPS: "打开图像链接或 LaTeX 公式编辑器",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "缩放至标题",
  NARROW_TO_BLOCK: "缩放至块",
  SHOW_ENTIRE_FILE: "显示全部",
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
  ES_FILENAME_VISIBLE: "显示文件名",
  ES_BACKGROUND_HEAD: "背景色",
  ES_BACKGROUND_DESC_INFO : "点击此处了解更多颜色信息" ,
  ES_BACKGROUND_DESC_DETAIL : "背景颜色仅影响 Markdown 嵌入预览模式。在编辑模式下，它会根据场景（通过文档属性设置）或插件设置，遵循 Obsidian 的浅色/深色主题。背景颜色有两层：元素背景颜色（下层）和上层颜色。选择“匹配元素背景”意味着两层都遵循元素颜色。选择“匹配画布”或特定背景颜色时，保留元素背景层。设置透明度（例如 50%）会将画布或选定的颜色与元素背景颜色混合。要移除元素背景层，可以在 Excalidraw 的元素属性编辑器中将元素颜色设置为透明，这样只有上层颜色生效。" ,
  ES_BACKGROUND_MATCH_ELEMENT: "匹配元素背景色",
  ES_BACKGROUND_MATCH_CANVAS: "匹配画布背景色",
  ES_BACKGROUND_COLOR: "背景色",
  ES_BORDER_HEAD: "边框颜色",
  ES_BORDER_COLOR: "边框颜色",
  ES_BORDER_MATCH_ELEMENT: "匹配元素边框颜色",
  ES_BACKGROUND_OPACITY: "背景透明度",
  ES_BORDER_OPACITY: "边框透明度",
  ES_EMBEDDABLE_SETTINGS: "MD-Embeddable 设置",
  ES_USE_OBSIDIAN_DEFAULTS: "使用 Obsidian 默认设置",
  ES_ZOOM_100_RELATIVE_DESC: "使元素的缩放等级等于当前画布的缩放等级",
  ES_ZOOM_100: "Relative 100%",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "文件不存在。要创建吗？",
  PROMPT_ERROR_NO_FILENAME: "错误：文件名不能为空",
  PROMPT_ERROR_DRAWING_CLOSED: "未知错误。绘图文件可能已关闭或丢失",
  PROMPT_TITLE_NEW_FILE: "新建文件",
  PROMPT_TITLE_CONFIRMATION: "确认",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "创建 Excalidraw 绘图",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA: "创建 Excalidraw 绘图并在新页签中打开",
  PROMPT_BUTTON_CREATE_MARKDOWN: "创建 Markdown 文档",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA: "创建 Markdown 文档并在新页签中打开",
  PROMPT_BUTTON_EMBED_MARKDOWN: "嵌入",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA: "将所选元素替换为 MD-Embeddable",
  PROMPT_BUTTON_NEVERMIND: "算了",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "取消",
  PROMPT_BUTTON_INSERT_LINE: "插入一行",
  PROMPT_BUTTON_INSERT_SPACE: "插入空格",
  PROMPT_BUTTON_INSERT_LINK: "插入内部链接",
  PROMPT_BUTTON_UPPERCASE: "大写",
  PROMPT_SELECT_TEMPLATE: "选择一个模板",

  //ModifierKeySettings
  WEB_BROWSER_DRAG_ACTION: "从浏览器拖进来时",
  LOCAL_FILE_DRAG_ACTION: "从本地文件系统拖进来时",
  INTERNAL_DRAG_ACTION: "在 Obsidian 内部拖放时",
  PANE_TARGET: "点击链接时",
  DEFAULT_ACTION_DESC: "无修饰键时的行为：",

  //FrameSettings.ts
  FRAME_SETTINGS_TITLE: "框架设置",
  FRAME_SETTINGS_ENABLE: "启用框架",
  FRAME_SETTIGNS_NAME: "显示框架名称",
  FRAME_SETTINGS_OUTLINE: "显示框架外边框",
  FRAME_SETTINGS_CLIP: "启用框架裁剪",

  //InsertPDFModal.ts
  IPM_PAGES_TO_IMPORT_NAME: "要导入的页面",
  IPM_SELECT_PAGES_TO_IMPORT: "请选择页面以进行导入",
  IPM_ADD_BORDER_BOX_NAME: "添加带边框的盒子容器",
  IPM_ADD_FRAME_NAME: "添加页面到框架",
  IPM_ADD_FRAME_DESC: "为了更方便的操作，我建议将页面锁定在框架内。" +
    "如果，你将锁定页面在框架内，则唯一的解锁方法是右键点击框架，选择‘从框架中移除元素’，然后解锁页面。",
  IPM_GROUP_PAGES_NAME: "建立页面组",
  IPM_GROUP_PAGES_DESC: "这将把所有页面建立为一个单独的组。如果您在导入后锁定页面，建议使用此方法，因为这样可以更方便地解锁整个组，而不是逐个解锁。",
  IPM_SELECT_PDF: "请选择一个 PDF 文件",

  //Utils.ts
  UPDATE_AVAILABLE: `Excalidraw 的新版本已在社区插件中可用。\n\n您正在使用 ${PLUGIN_VERSION}。\n最新版本是`,
  ERROR_PNG_TOO_LARGE: "导出 PNG 时出错 - PNG 文件过大，请尝试较小的分辨率",

  // ModifierkeyHelper.ts
  // WebBrowserDragAction
  WEB_DRAG_IMPORT_IMAGE : "导入图片到 Vault" ,
  WEB_DRAG_IMAGE_URL : "通过 URL 插入图片或 YouTube 缩略图" ,
  WEB_DRAG_LINK : "插入链接" ,
  WEB_DRAG_EMBEDDABLE : "插入交互框架" ,

  // LocalFileDragAction
  LOCAL_DRAG_IMPORT : "导入外部文件，或在路径来自 Vault 时复用现有文件" ,
  LOCAL_DRAG_IMAGE : "插入图片：使用本地 URI，或在路径来自 Vault 时使用内部链接" ,
  LOCAL_DRAG_LINK : "插入链接：使用本地 URI，或在路径来自 Vault 时使用内部链接" ,
  LOCAL_DRAG_EMBEDDABLE : "插入交互框架：使用本地 URI，或在路径来自 Vault 时使用内部链接" ,

  // InternalDragAction
  INTERNAL_DRAG_IMAGE : "插入图片" ,
  INTERNAL_DRAG_IMAGE_FULL : "插入图片（100% 尺寸）" ,
  INTERNAL_DRAG_LINK : "插入链接" ,
  INTERNAL_DRAG_EMBEDDABLE : "插入交互框架" ,

  // LinkClickAction
  LINK_CLICK_ACTIVE : "在当前活动窗口中打开" ,
  LINK_CLICK_NEW_PANE : "在相邻的新窗口中打开" ,
  LINK_CLICK_POPOUT : "在弹出窗口中打开" ,
  LINK_CLICK_NEW_TAB : "在新标签页中打开" ,
  LINK_CLICK_MD_PROPS : "显示 Markdown 图片属性对话框（仅在嵌入 Markdown 文档为图片时适用）" ,

// 导出对话框
// 对话框和标签页
EXPORTDIALOG_TITLE: "导出图形",
EXPORTDIALOG_TAB_IMAGE: "图像",
EXPORTDIALOG_TAB_PDF: "PDF",
// 设置持久化
EXPORTDIALOG_SAVE_SETTINGS: "将图像设置保存到文件 doc.properties 吗？",
EXPORTDIALOG_SAVE_SETTINGS_SAVE: "保存为预设",
EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "仅本次使用",
// 图像设置
EXPORTDIALOG_IMAGE_SETTINGS: "图像",
EXPORTDIALOG_IMAGE_DESC: "PNG 支持透明。外部文件可以包含 Excalidraw 场景数据。",
EXPORTDIALOG_PADDING: "边距",
EXPORTDIALOG_SCALE: "缩放",
EXPORTDIALOG_CURRENT_PADDING: "当前边距：",
EXPORTDIALOG_SIZE_DESC: "缩放会影响输出大小",
EXPORTDIALOG_SCALE_VALUE: "缩放：",
EXPORTDIALOG_IMAGE_SIZE: "大小：",
// 主题和背景
EXPORTDIALOG_EXPORT_THEME: "主题",
EXPORTDIALOG_THEME_LIGHT: "浅色",
EXPORTDIALOG_THEME_DARK: "深色",
EXPORTDIALOG_BACKGROUND: "背景",
EXPORTDIALOG_BACKGROUND_TRANSPARENT: "透明",
EXPORTDIALOG_BACKGROUND_USE_COLOR: "使用场景颜色",
// 选择
EXPORTDIALOG_SELECTED_ELEMENTS: "导出",
EXPORTDIALOG_SELECTED_ALL: "整个场景",
EXPORTDIALOG_SELECTED_SELECTED: "仅选中部分",
// 导出选项
EXPORTDIALOG_EMBED_SCENE: "包含场景数据吗？",
EXPORTDIALOG_EMBED_YES: "是",
EXPORTDIALOG_EMBED_NO: "否",
// PDF 设置
EXPORTDIALOG_PDF_SETTINGS: "PDF",
EXPORTDIALOG_PAGE_SIZE: "页面大小",
EXPORTDIALOG_PAGE_ORIENTATION: "方向",
EXPORTDIALOG_ORIENTATION_PORTRAIT: "纵向",
EXPORTDIALOG_ORIENTATION_LANDSCAPE: "横向",
EXPORTDIALOG_PDF_FIT_TO_PAGE: "页面适配",
EXPORTDIALOG_PDF_FIT_OPTION: "适配页面",
EXPORTDIALOG_PDF_FIT_2_OPTION: "适配至最多 2 页" ,
EXPORTDIALOG_PDF_FIT_4_OPTION: "适配至最多 4 页" ,
EXPORTDIALOG_PDF_FIT_6_OPTION: "适配至最多 6 页" ,
EXPORTDIALOG_PDF_FIT_8_OPTION: "适配至最多 8 页" ,
EXPORTDIALOG_PDF_FIT_12_OPTION: "适配至最多 12 页" ,
EXPORTDIALOG_PDF_FIT_16_OPTION: "适配至最多 16 页" ,
EXPORTDIALOG_PDF_SCALE_OPTION: "使用图像缩放（可能跨多页）",
EXPORTDIALOG_PDF_PAPER_COLOR: "纸张颜色",
EXPORTDIALOG_PDF_PAPER_WHITE: "白色",
EXPORTDIALOG_PDF_PAPER_SCENE: "使用场景颜色",
EXPORTDIALOG_PDF_PAPER_CUSTOM: "自定义颜色",
EXPORTDIALOG_PDF_ALIGNMENT: "页面位置",
EXPORTDIALOG_PDF_ALIGN_CENTER: "居中",
EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "左对齐居中" ,
EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "右对齐居中" ,
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
// 按钮
EXPORTDIALOG_PNGTOFILE: "导出 PNG 文件",
EXPORTDIALOG_SVGTOFILE: "导出 SVG 文件",
EXPORTDIALOG_PNGTOVAULT: "PNG 保存到 Vault",
EXPORTDIALOG_SVGTOVAULT: "SVG 保存到 Vault",
EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
EXPORTDIALOG_PNGTOCLIPBOARD: "PNG 复制到剪贴板",
EXPORTDIALOG_SVGTOCLIPBOARD: "SVG 复制到剪贴板",
EXPORTDIALOG_PDF: "导出 PDF 文件",

EXPORTDIALOG_PDF_PROGRESS_NOTICE: "正在导出 PDF。如果图像较大，可能需要一些时间。" ,
EXPORTDIALOG_PDF_PROGRESS_DONE: "导出完成" ,
EXPORTDIALOG_PDF_PROGRESS_ERROR: "导出 PDF 时出错，请检查开发者控制台以获取详细信息" ,

// Screenshot tab
EXPORTDIALOG_NOT_AVAILALBE : "抱歉，此功能仅在绘图在主 Obsidian 工作区打开时可用。",
EXPORTDIALOG_TAB_SCREENSHOT : "截图" ,
EXPORTDIALOG_SCREENSHOT_DESC : "截图将包括可嵌入的内容，例如 markdown 页面、YouTube、网站等。它们仅在桌面端可用，无法自动导出，并且仅支持 PNG 格式。" ,
SCREENSHOT_DESKTOP_ONLY : "截图功能仅在桌面端可用" ,
SCREENSHOT_FILE_SUCCESS : "截图已保存到仓库" ,
SCREENSHOT_CLIPBOARD_SUCCESS : "截图已复制到剪贴板" ,
SCREENSHOT_CLIPBOARD_ERROR : "无法复制截图到剪贴板：" ,
SCREENSHOT_ERROR : "截图出错 - 请查看控制台日志" ,

// exportUtils.ts
PDF_EXPORT_DESKTOP_ONLY: "PDF 导出功能仅限桌面端使用" ,
};