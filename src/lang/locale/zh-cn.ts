// 简体中文

import { FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS, FRONTMATTER_KEY_CUSTOM_PREFIX } from "src/constants";

export default {
  // main.ts
  OPEN_AS_EXCALIDRAW: "打开为 Excalidraw 绘图",
  TOGGLE_MODE: "在 Excalidraw 和 Markdown 模式之间切换",
  CONVERT_NOTE_TO_EXCALIDRAW: "转换空白笔记为 Excalidraw 绘图",
  CONVERT_EXCALIDRAW: "转换 *.excalidraw 为 *.md 文件",
  CREATE_NEW : "新建 Excalidraw 绘图",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw 格式 => *.excalidraw.md 格式",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw 格式 => *.md (Logseq compatibility) 格式",
  DOWNLOAD_LIBRARY: "导出 stencil 库为 *.excalidrawlib 文件",
  OPEN_EXISTING_NEW_PANE: "在新面板中打开已存在的绘图",
  OPEN_EXISTING_ACTIVE_PANE: "在当前面板中打开已存在的绘图",
  TRANSCLUDE: "嵌入绘图",
  TRANSCLUDE_MOST_RECENT: "嵌入最近编辑的绘图",
  NEW_IN_NEW_PANE: "在新面板中创建已存在的绘图",
  NEW_IN_ACTIVE_PANE: "在当前面板中创建已存在的绘图",
  NEW_IN_NEW_PANE_EMBED: "在新面板中创建已存在的绘图且嵌入到当前笔记中",
  NEW_IN_ACTIVE_PANE_EMBED: "在当前面板中创建已存在的绘图且嵌入到当前笔记中",
  EXPORT_SVG: "导出 SVG 文件到当前文件的目录中",
  EXPORT_PNG: "导出 PNG 文件到当前文件的目录中",
  TOGGLE_LOCK: "切换文本元素锁定模式",
  INSERT_LINK: "在文件中插入链接",
  INSERT_LATEX: "在文件中插入 LaTeX 符号 (e.g. $\\theta$)",
  ENTER_LATEX: "输入一个 LaTeX 表达式",
  
  //ExcalidrawView.ts
  OPEN_AS_MD: "打开为 Markdown 文件",
  SAVE_AS_PNG: "保存成 PNG 文件到库里（CTRL/CMD 加左键点击来指定导出位置）",
  SAVE_AS_SVG: "保存成 SVG 文件到库里（CTRL/CMD 加左键点击来指定导出位置）",
  OPEN_LINK: "以链接的方式打开文本 \n（按住 SHIFT 来在新面板中打开）",
  EXPORT_EXCALIDRAW: "导出为 .Excalidraw 文件",
  LINK_BUTTON_CLICK_NO_TEXT: '选择带有外部链接或内部链接的文本。\n'+
                             'SHIFT 加左键点击按钮来在新面板中打开链接。\n'+
                             'CTRL/CMD 加左键在画布中点击文本元素也可以打开对应的链接。',
  TEXT_ELEMENT_EMPTY: "文本元素没有链接任何东西.",
  FILENAME_INVALID_CHARS: '文件名不能包含以下符号： * " \\  < > : | ?',
  FILE_DOES_NOT_EXIST: "文件不存在。按住 ALT（或者 ALT + SHIFT）加左键点击来创建新文件。",
  FORCE_SAVE: "强制保存以更新相邻面板中的嵌入。\n（请注意，自动保存始终处于开启状态）",
  RAW: "文本元素正以原文模式显示。 单击按钮更改为预览模式。",
  PARSED: "文本元素正以预览模式显示。 单击按钮更改为原文模式。",
  NOFILE: "Excalidraw (没有文件)",
  COMPATIBILITY_MODE: "*.excalidraw 文件以兼容模式打开。转换为新格式以获得完整的插件功能。",
  CONVERT_FILE: "转换为新格式",

  //settings.ts
  FOLDER_NAME: "Excalidraw 文件夹",
  FOLDER_DESC: "新绘图的默认位置。如果此处为空，将在 Vault 根目录中创建绘图。",
  TEMPLATE_NAME: "Excalidraw 模板文件",
  TEMPLATE_DESC: "Excalidraw 模板的完整文件路径。" +
                 "例如：如果您的模板在默认的 Excalidraw 文件夹中且它的名称是" +
                 "Template.md，你应当设置为：Excalidraw/Template.md。" + 
                 "如果您在兼容模式下使用 Excalidraw，那么您的模板也必须是旧的 excalidraw 文件，" + 
                 "例如 Excalidraw/Template.excalidraw。",
  AUTOSAVE_NAME: "自动保存",
  AUTOSAVE_DESC: "每 30 秒自动保存编辑中的绘图。当您关闭 Excalidraw 或 Obsidian 或焦点移动到另一个面板时，通常会引发保存"+
                 "在极少数情况下自动保存可能会稍微扰乱绘图流程。我在创建此功能时考虑到了手机端（安卓），" +
                 "其中“滑到另一个应用程序”会导致一些数据丢失，并且因为我无法在手机上的应用程序" +
                 " 终止时强制保存。如果您在桌面上使用 Excalidraw，这你可以关掉它。",
  FILENAME_HEAD: "文件名",
  FILENAME_DESC: "<p>自动生成的文件名包括一个前缀和一个日期。" + 
                 "例如 'Drawing 2021-05-24 12.58.07'。</p>"+
                 "<p>点击<a href='https://momentjs.com/docs/#/displaying/format/'>"+
                 "日期和时间格式参考</a>来查看如何修改。</p>",
  FILENAME_SAMPLE: "当前文件名的格式为：<b>",
  FILENAME_PREFIX_NAME: "文件名前缀",
  FILENAME_PREFIX_DESC: "文件名的第一部分",
  FILENAME_DATE_NAME: "文件名日期",
  FILENAME_DATE_DESC: "文件名的第二部分",
  LINKS_HEAD: "链接",
  LINKS_DESC: "CTRL/CMD 加左键点击文本元素来打开链接。" + 
              "如果选中的文本指向多个双链，只会打开其中第一个。" + 
              "如果选中的文本为超链接 (i.e. https:// or http://)，然后" +
              "插件会在浏览器中打开超链接。" +
              "当对应的文件名修改时，匹配的链接也会修改。" +
              "如果你不希望你自己的链接文本突然修改，用别名来替代",
  LINK_BRACKETS_NAME: "在链接上显示双链符号[[",
  LINK_BRACKETS_DESC: "在预览（锁定）模式，当解析文本元素，在链接左右展示中括号。" +
                      "你可以在文件的 Frontmatter 中加入'" + FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS + 
                      ": true/false' 来单独控制某个文件。",
  LINK_PREFIX_NAME:"链接前缀",
  LINK_PREFIX_DESC:"在预览（锁定）模式，如果文本元素包含链接，在文本之前加上这些字符。" +
                   "你可以在文件的 Frontmatter 中加入 \'" + FRONTMATTER_KEY_CUSTOM_PREFIX + 
                   ': "👉 "\' 单独更改',
  LINK_CTRL_CLICK_NAME: "CTRL/CMD 加左键点击文本来打开链接",
  LINK_CTRL_CLICK_DESC: "如果此功能干扰了您要使用的 Excalidraw 功能，您可以将其关闭。 如果" +
                        "关闭此选项，则只有绘图标题栏中的链接按钮可以让你打开链接。",
  EMBED_HEAD: "嵌入 & 导出",
  EMBED_WIDTH_NAME: "嵌入图像的默认宽度",
  EMBED_WIDTH_DESC: "嵌入图形的默认宽度。您可以在使用" +
                    "![[drawing.excalidraw|100]] 或 [[drawing.excalidraw|100x100]]" +
                    "格式指定嵌入图像时的宽度。",
  EXPORT_PNG_SCALE_NAME: "PNG 导出图像比例",
  EXPORT_PNG_SCALE_DESC: "导出的 PNG 图像的大小比例",
  EXPORT_BACKGROUND_NAME: "导出带有背景的图像",
  EXPORT_BACKGROUND_DESC: "如果关闭，导出的图像的背景将是透明的。",
  EXPORT_THEME_NAME: "导出带有主题的图像",
  EXPORT_THEME_DESC: "导出与绘图的暗/亮主题匹配的图像。" +
                     "如果关闭，在深色模式下导出的绘图将和浅色模式下导出的图像一样",
  EXPORT_HEAD: "导出设置",
  EXPORT_SYNC_NAME:"保持 .SVG 和/或 .PNG 文件名与绘图文件同步",
  EXPORT_SYNC_DESC:"打开后，当同一文件夹且同名的绘图被重命名时，插件将自动更新对应的 .SVG 和/或 .PNG 文件的文件名。" +
                  "当同一文件夹的同一名称的绘图被删除时，该插件还将自动删除对应的 .SVG 和/或 .PNG 文件。",
  EXPORT_SVG_NAME: "自动导出 SVG",
  EXPORT_SVG_DESC: "自动导出和你文件同名的 SVG 文件" + 
                   "插件会将 SVG 文件保存到对应的 Excalidraw 所在的文件夹中"+
                   "将 .svg 文件嵌入到文档中，而不是 excalidraw，使您嵌入的页面独立开来" +
                   "当自动导出开关打开时，每次您编辑对应的 excalidraw 绘图时，此文件都会更新。",
  EXPORT_PNG_NAME: "自动导出 PNG",
  EXPORT_PNG_DESC: "和自动导出 SVG 一样，但面向 *.PNG",
  COMPATIBILITY_HEAD: "兼容特性",
  EXPORT_EXCALIDRAW_NAME: "自动导出 Excalidraw 文件",
  EXPORT_EXCALIDRAW_DESC: "和自动导出 SVG 一样，但面向 *.Excalidraw",
  SYNC_EXCALIDRAW_NAME: "同步 .md 格式以及 .excalidraw 格式",
  SYNC_EXCALIDRAW_DESC: "如果 *.excalidraw 文件的修改比 *.md 文件的修改更新" +
                        "，会根据 .excalidraw 文件更新 .md 文件中的绘图",
  COMPATIBILITY_MODE_NAME: "以旧格式创建新绘图",
  COMPATIBILITY_MODE_DESC: "启用此功能后，你使用功能区图标、命令面板、"+
                           "或文件浏览器创建的绘图都将是旧格式 *.excalidraw 文件。 此设置还将" + 
                           "关闭你打开并编辑旧格式绘图文件时的提醒消息",
  EXPERIMENTAL_HEAD: "实验性特性",
  EXPERIMENTAL_DESC: "这些设置不会立即生效，只有在刷新文件资源管理器或重新启动 Obsidian 时才会生效。",
  FILETYPE_NAME: "在文件浏览器中给所有的 Excalidraw 文件加上 ✏️ 标识符",
  FILETYPE_DESC: "Excalidraw 文件将使用下一个设置中定义的表情符号或文本来做标识。",
  FILETAG_NAME: "给 Excalidraw 文件设置标识符",
  FILETAG_DESC: "要显示为标识符的文本或表情符号。",                           



  //openDrawings.ts
  SELECT_FILE: "选择一个文件后按回车。",   
  NO_MATCH: "没有文件匹配你的索引。",  
  SELECT_FILE_TO_LINK: "选择要为其插入链接的文件。",     
  TYPE_FILENAME: "键入要选择的绘图名称。",
  SELECT_FILE_OR_TYPE_NEW: "选择现有绘图或新绘图的类型名称，然后按回车。",
  SELECT_TO_EMBED: "选择要插入到当前文档中的绘图。",
};
