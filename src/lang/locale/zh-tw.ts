import {
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS,
} from "src/constants/constants";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";

declare const PLUGIN_VERSION:string;

// 繁體中文
export default {
  // Sugester
  SELECT_FILE_TO_INSERT: "選擇要嵌入到當前繪圖中的檔案",
  // main.ts
  CONVERT_URL_TO_FILE: "從 URL 下載圖片到本地",
  UNZIP_CURRENT_FILE: "解壓當前 Excalidraw 檔案",
  ZIP_CURRENT_FILE: "壓縮當前 Excalidraw 檔案",
  PUBLISH_SVG_CHECK: "Obsidian Publish：搜尋過期的 SVG 和 PNG 匯出檔案",
  EMBEDDABLE_PROPERTIES: "Embeddable 元素設定",
  EMBEDDABLE_RELATIVE_ZOOM: "使元素的縮放級別等於當前繪圖的縮放級別",
  OPEN_IMAGE_SOURCE: "開啟 Excalidraw 繪圖",
  INSTALL_SCRIPT: "安裝此指令碼",
  UPDATE_SCRIPT: "有可用更新 - 點選安裝",
  CHECKING_SCRIPT:
    "檢查更新中 - 點選重新安裝",
  UNABLETOCHECK_SCRIPT:
    "檢查更新失敗 - 點選重新安裝",
  UPTODATE_SCRIPT:
    "指令碼已是最新 - 點選重新安裝",
  OPEN_AS_EXCALIDRAW: "開啟為 Excalidraw 繪圖",
  TOGGLE_MODE: "在 Excalidraw 和 Markdown 模式之間切換",
  DUPLICATE_IMAGE: "複製所選影像，並分配一個不同的影像 ID",
  CONVERT_NOTE_TO_EXCALIDRAW: "轉換：空白 Markdown 文件 => Excalidraw 繪圖",
  CONVERT_EXCALIDRAW: "轉換： *.excalidraw => *.md",
  CREATE_NEW: "新建繪圖檔案",
  CONVERT_FILE_KEEP_EXT: "轉換：*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "轉換：*.excalidraw => *.md (相容 Logseq)",
  DOWNLOAD_LIBRARY: "匯出 stencil 庫為 *.excalidrawlib 檔案",
  OPEN_SIDEPANEL: "開啟 Excalidraw 側邊面板",
  OPEN_EXISTING_NEW_PANE: "開啟已有的繪圖 - 於新面板",
  OPEN_EXISTING_ACTIVE_PANE:
    "開啟已有的繪圖 - 於當前面板",
  TRANSCLUDE: "嵌入繪圖 ![[drawing]] 到當前 Markdown 文件中",
  TRANSCLUDE_MOST_RECENT: "嵌入最近編輯過的繪圖 ![[drawing]] 到當前 Markdown 文件中",
  TOGGLE_LEFTHANDED_MODE: "切換左手模式",
  TOGGLE_SPLASHSCREEN: "在新繪圖中顯示啟動畫面",
  FLIP_IMAGE: "在彈出視窗中開啟所選繪圖的背景筆記",
  NEW_IN_NEW_PANE: "新建繪圖 - 於新面板",
  NEW_IN_NEW_TAB: "新建繪圖 - 於新標籤頁",
  NEW_IN_ACTIVE_PANE: "新建繪圖 - 於當前面板",
  NEW_IN_POPOUT_WINDOW: "新建繪圖 - 於新視窗",
  NEW_IN_NEW_PANE_EMBED:
    "新建繪圖 - 於新面板 - 並嵌入到當前 Markdown 文件中",
  NEW_IN_NEW_TAB_EMBED:
    "新建繪圖 - 於新標籤頁 - 並嵌入到當前 Markdown 文件中",
  NEW_IN_ACTIVE_PANE_EMBED:
    "新建繪圖 - 於當前面板 - 並嵌入到當前 Markdown 文件中",
  NEW_IN_POPOUT_WINDOW_EMBED: "新建繪圖 - 於新視窗 - 並嵌入到當前 Markdown 文件中",
  TOGGLE_LOCK: "文字元素：原文模式（RAW）⟺ 預覽模式（PREVIEW）",
  DELETE_FILE: "從倉庫中刪除所選圖片（或以影像形式嵌入的 Markdown）原始檔",
  MARKER_FRAME_SHOW: "顯示標記畫框",
  MARKER_FRAME_HIDE: "隱藏標記畫框",
  MARKER_FRAME_TITLE_SHOW: "顯示標記畫框名稱",
  MARKER_FRAME_TITLE_HIDE: "隱藏標記畫框名稱",
  COPY_ELEMENT_LINK: "複製所選元素的 [[file#^id]] 連結",
  FRAME_WITH_NAME: "按名稱複製畫框連結",
  COPY_DRAWING_LINK: "複製繪圖的 ![[drawing]] 連結",
  INSERT_LINK_TO_ELEMENT:
    `單擊=複製所選元素的 [[file#^id]] 連結\n${labelCTRL()}=複製元素所在分組為 [[file#^group=id]] 連結\n${labelSHIFT()}=複製所選元素所在區域為 [[file#^area=id]] 連結`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "複製所選元素所在分組為 ![[file#^group=id]] 連結",
  INSERT_LINK_TO_ELEMENT_AREA:
    "複製所選元素所在區域為 ![[file#^area=id]] 連結",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "複製所選畫框為 ![[file#^frame=id]] 連結",
  INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "複製所選畫框（裁切）為 ![[file#^clippedframe=id]] 連結",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "複製所選元素的 [[file#^id]] 連結",
  INSERT_LINK_TO_ELEMENT_ERROR: "選擇場景中的單個元素",
  INSERT_LINK_TO_ELEMENT_READY: "連結已生成並複製到剪貼簿",
  INSERT_LINK: "以連結形式插入檔案",
  INSERT_COMMAND: "插入 Obsidian 命令到當前繪圖中",
  INSERT_IMAGE: "以影像形式嵌入圖片或 Excalidraw 繪圖到當前繪圖中",
  IMPORT_SVG: "匯入 SVG 檔案為線條（暫不支援文字元素）",
  IMPORT_SVG_CONTEXTMENU: "轉換 SVG 為線條 - 有限制",
  INSERT_MD: "以影像形式嵌入 Markdown 文件到當前繪圖中",
  INSERT_PDF: "以影像形式嵌入 PDF 到當前繪圖中",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE: "以影像形式嵌入最後啟用的 PDF 頁面",
  UNIVERSAL_ADD_FILE: "嵌入檔案 (Insert ANY file)",
  INSERT_CARD: "插入“背景筆記”卡片",
  CONVERT_CARD_TO_FILE: "將“背景筆記”卡片儲存到檔案",
  ERROR_TRY_AGAIN: "請重試。",
  PASTE_CODEBLOCK: "貼上程式碼塊",
  INVERT_IMAGES_IN_DARK_MODE: "深色主題下反轉顏色",
  DO_NOT_INVERT_IMAGES_IN_DARK_MODE: "取消深色主題下反轉顏色",
  INSERT_LATEX:
    `插入 LaTeX 公式到當前繪圖中`,
  ENTER_LATEX: "輸入 LaTeX 公式",
  READ_RELEASE_NOTES: "閱讀本外掛的更新說明",
  RUN_OCR: "OCR 整個繪圖：識別塗鴉和圖片裡的文字並複製到剪貼簿和筆記屬性中",
  RERUN_OCR: "重新 OCR 整個繪圖：識別塗鴉和圖片裡的文字並複製到剪貼簿和筆記屬性中",
  RUN_OCR_ELEMENTS: "OCR 選中的元素：識別塗鴉和圖片裡的文字並複製到剪貼簿",
  UI_MODE: "切換 UI 模式",
  SEARCH: "搜尋文字",
  CROP_PAGE: "裁剪所選頁面並新增蒙版",
  CROP_IMAGE: "裁剪圖片並新增蒙版",
  ANNOTATE_IMAGE : "在 Excalidraw 中標註圖片",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "以影像形式嵌入當前啟用的 PDF 頁面",
  RESET_IMG_TO_100: "重置影像尺寸為 100%",
  RESET_IMG_ASPECT_RATIO: "重置所選影像的縱橫比",
  TEMPORARY_DISABLE_AUTOSAVE: "臨時停用自動儲存功能，直到本次 Obsidian 退出（小白慎用！）",
  TEMPORARY_ENABLE_AUTOSAVE: "啟用自動儲存功能",
  FONTS_LOADED: "Excalidraw: CJK 字型已載入",
  FONTS_LOAD_ERROR: "Excalidraw: 在資原始檔夾下找不到 CJK 字型\n",
  TOGGLE_ENABLE_CONTEXT_MENU: "切換是否啟用上下文選單（在移動裝置上很有用）",

  //Prompt.ts
  SELECT_LINK_TO_OPEN: "選擇要開啟的連結",

  //ExcalidrawView.ts
  ABOUT_LIBRARIES: "如何載入素材庫",
  ERROR_CANT_READ_FILEPATH: "錯誤，無法讀取檔案路徑。正在改為匯入檔案",
  NO_SEARCH_RESULT: "在繪圖中未找到匹配的元素",
  FORCE_SAVE_ABORTED: "自動儲存被中止，因為檔案正在儲存中",
  LINKLIST_SECOND_ORDER_LINK: "二級連結",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE: "自定義嵌入檔案連結",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT: "請不要在檔名周圍新增 [[方括號]]！<br>" +
    "對於 Markdown 影像，在編輯連結時請遵循以下格式：<mark>檔名#^塊引用|寬度x最大高度</mark><br>" +
    "您可以透過在連結末尾新增 <code>|100%</code> 來將 Excalidraw 影像錨定為 100% 的大小。<br>" +
    "您可以透過將 <code>#page=1</code> 更改為 <code>#page=2</code> 等來更改 PDF 頁碼。<br>" +
    "PDF 矩形裁剪值為：<code>左, 下, 右, 上</code>。例如：<code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "畫框渲染：已啟用",
  FRAME_CLIPPING_DISABLED: "畫框渲染：已停用",
  ARROW_BINDING_INVERSE_MODE: "反轉模式：預設方向按鍵已停用。需要時請使用 Ctrl/CMD 臨時啟用。",
  ARROW_BINDING_NORMAL_MODE: "正常模式：方向鍵已啟用。需要時請使用 Ctrl/CMD 臨時停用。",
  EXPORT_FILENAME_PROMPT: "請提供檔名",
  EXPORT_FILENAME_PROMPT_PLACEHOLDER: "請輸入檔名，留空以取消操作",
  WARNING_SERIOUS_ERROR: "警告：Excalidraw 遇到了未知的問題!\n\n" +
    "您最近的更改可能無法儲存。\n\n" +
    "為了安全起見，請按以下步驟操作：\n" +
    "1) 使用 Ctrl/CMD+A 選擇您的繪圖，然後使用 Ctrl/CMD+C 進行復制。\n" +
    "2) 然後在新窗格中，透過 Ctrl/CMD 點選 Excalidraw 功能區按鈕建立一個空白繪圖。\n" +
    "3) 最後，使用 Ctrl/CMD+V 將您的作品貼上到新檔案中。",
  ARIA_LABEL_TRAY_MODE: "切換 3 種 UI 模式：完整模式（桌面端）、緊湊模式、托盤模式。手機端只有手機端模式。",
  TRAY_TRAY_MODE: "切換 UI 模式",
  TRAY_SCRIPT_LIBRARY: "指令碼庫",
  TRAY_SCRIPT_LIBRARY_ARIA: "瀏覽 Excalidraw 指令碼庫",
  TRAY_EXPORT: "匯出繪圖…",
  TRAY_EXPORT_ARIA: "匯出繪圖為 PNG、SVG、或 Excalidraw",
  TRAY_SAVE: "儲存",
  TRAY_SWITCH_TO_MD: "開啟為 Markdown",
  TRAY_SWITCH_TO_MD_ARIA: "切換至 Markdown 檢視模式",
  MASK_FILE_NOTICE: "這是一個蒙版影像。長按本提示觀看幫助影片。",
  INSTALL_SCRIPT_BUTTON: "安裝或更新 Excalidraw 指令碼",
  OPEN_AS_MD: "開啟為 Markdown",
  EXPORT_IMAGE: `匯出為圖片`,
  OPEN_LINK: "開啟所選元素裡的連結 \n（按住 Shift 在新面板開啟）",
  EXCALIDRAW_SIDEPANEL: "Excalidraw 側邊面板",
  EXPORT_EXCALIDRAW: "匯出為 .excalidraw 檔案（舊版繪圖檔案格式）",
  LINK_BUTTON_CLICK_NO_TEXT:
    "請選擇一個包含內部或外部連結的元素。\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR:
    "箭頭和線條元素的連結無法透過 " + labelCTRL() + " + 點選元素來跳轉，因為這也會啟用線條編輯器。\n" +
    "請使用右鍵上下文選單開啟連結，或點選元素右上角的連結指示器。\n",
  FILENAME_INVALID_CHARS:
    '檔名不能包含以下符號： * " \\ < > : | ? #',
  FORCE_SAVE:
    "儲存（同時更新嵌入了該繪圖的 Markdown 文件）",
  RAW: "正以 RAW 模式顯示連結\n點選切換到 PREVIEW 模式",
  PARSED:
    "正以 PREVIEW 模式顯示連結\n點選切換到 RAW 模式",
  NOFILE: "Excalidraw（沒有檔案）",
  COMPATIBILITY_MODE:
    "*.excalidraw 是相容舊版的繪圖檔案格式。需要轉換為新格式才能解鎖本外掛的全部功能。",
  CONVERT_FILE: "轉換為新格式",
  BACKUP_AVAILABLE: "載入繪圖檔案時出錯，可能是由於 Obsidian 在上次儲存時意外退出了（移動裝置上更容易發生這種意外）。<br><br><b>好訊息：</b>這臺裝置上存在備份。您是否想要恢復本裝置上的備份？<br><br>（我建議您先嚐試在最近使用過的其他裝置上開啟該繪圖，以檢查是否有更新的備份。）",
  BACKUP_RESTORED: "已恢復備份",
  BACKUP_SAVE_AS_FILE: "此繪圖為空。但有一個非空的備份可用。您想將其恢復為新檔案並在新標籤頁中開啟嗎？",
  BACKUP_SAVE: "恢復",
  BACKUP_DELETE: "刪除備份",
  BACKUP_CANCEL: "取消",
  CACHE_NOT_READY: "抱歉，載入繪圖檔案時出錯。<br><br><mark>現在有耐心，將來更省心。</mark><br><br>外掛有備份機制，但您似乎剛開啟 Obsidian，需要等待一分鐘或更長的時間來讀取快取。快取讀取完畢時，您會在右上角收到通知。<br><br>請點選 OK 並耐心等待，或者，選擇點選取消後手動修復檔案。<br>",
  OBSIDIAN_TOOLS_PANEL: "Obsidian 工具面板",
  ERROR_SAVING_IMAGE: "獲取圖片時發生未知錯誤。可能是由於某種原因，圖片不可用或拒絕了 Obsidian 的獲取請求。",
  WARNING_PASTING_ELEMENT_AS_TEXT: "不能將 Excalidraw 元素貼上為文字元素！",
  USE_INSERT_FILE_MODAL: "使用“嵌入檔案”功能來嵌入 Markdown 文件",
  RECURSIVE_INSERT_ERROR: "不能將影像的一部分嵌入到此影像中，因為這可能導致無限迴圈。",
  CONVERT_TO_MARKDOWN: "轉存為 Markdown 文件（並嵌入當前繪圖）",
  SELECT_TEXTELEMENT_ONLY: "只選擇文字元素（非容器）",
  REMOVE_LINK: "移除文字元素連結",
  LASER_ON: "啟用雷射筆",
  LASER_OFF: "關閉雷射筆",
  WELCOME_RANK_NEXT: "張繪圖之後，到達下一等級！",
  WELCOME_RANK_LEGENDARY: "您已是繪圖大師，續寫傳奇吧！",
  WELCOME_COMMAND_PALETTE: '在命令面板中輸入 "Excalidraw"',
  WELCOME_OBSIDIAN_MENU: "瀏覽右上角的 Obsidian 選單",
  WELCOME_SCRIPT_LIBRARY: "訪問指令碼庫",
  WELCOME_HELP_MENU: "點選漢堡選單（三橫線）獲取幫助",
  WELCOME_YOUTUBE_ARIA: "Visual PKM 的 YouTube 頻道",
  WELCOME_YOUTUBE_LINK: "檢視 Visual PKM 的 YouTube 頻道",
  WELCOME_DISCORD_ARIA: "加入 Discord 伺服器",
  WELCOME_DISCORD_LINK: "加入 Discord 伺服器",
  WELCOME_TWITTER_ARIA: "在 Twitter 上關注我",
  WELCOME_TWITTER_LINK: "在 Twitter 上關注我",
  WELCOME_LEARN_ARIA: "學習 Visual PKM（視覺化個人知識管理）",
  WELCOME_LEARN_LINK: "報名加入視覺思維研討會",
  WELCOME_DONATE_ARIA: "捐贈以支援 Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: '感謝並支援此外掛。',
  SAVE_IS_TAKING_LONG: "儲存您之前的檔案花費的時間較長，請稍候…",
  SAVE_IS_TAKING_VERY_LONG: "為了更好的效能，請考慮將大型繪圖拆分成幾個較小的檔案。",

  //ContentSearcher.ts
  SEARCH_COPIED_TO_CLIPBOARD: "Markdown 內容已複製到剪貼簿",
  SEARCH_COPY_TO_CLIPBOARD_ARIA: "將整個設定對話方塊以 Markdown 格式複製到剪貼簿。適合與 ChatGPT 等工具配合使用進行搜尋和理解。",
  SEARCH_SHOWHIDE_ARIA: "顯示/隱藏搜尋欄",
  SEARCH_NEXT: "下一個",
  SEARCH_PREVIOUS: "上一個",



  //settings.ts
  DISABLE_CONTEXT_MENU_NAME: "停用 Excalidraw 上下文選單",
  DISABLE_CONTEXT_MENU_DESC: "停用 Excalidraw 的上下文選單。這在移動裝置上很有用，因為上下文選單有時會在不需要的時候彈出。",
  NOTEBOOKLM_LINK_ARIA: "向 NotebookLM 諮詢有關外掛的幫助。此模型已預載入了我所有的影片轉錄稿、釋出說明和其他幫助內容。與 NotebookLM 聊天，瀏覽我的 250+ 影片和 Excalidraw 檔案。",
  NOTEBOOKLM_LINK_TEXT: "學習外掛。訪問 NotebookLM 知識庫。",
  LINKS_BUGS_ARIA: "在外掛的 GitHub 頁面報告錯誤和提交功能請求",
  LINKS_BUGS: "報告錯誤",
  LINKS_YT_ARIA: "訪問我的 YouTube 頻道學習視覺思維和 Excalidraw",
  LINKS_YT: "在 YouTube 學習",
  LINKS_DISCORD_ARIA: "加入視覺思維研討會 Discord 伺服器",
  LINKS_DISCORD: "加入社群",
  LINKS_TWITTER: "關注我",
  LINKS_VTW_ARIA: "學習 Visual PKM、Excalidraw、Obsidian、ExcaliBrain 等內容",
  LINKS_VTW: "加入研討會",
  LINKS_BOOK_ARIA: "閱讀我的視覺思維著作《Sketch Your Mind》",
  LINKS_BOOK: "閱讀書籍",
  LINKS_WIKI: "外掛維基",
  LINKS_WIKI_ARIA: "瀏覽 Excalidraw 外掛維基",

  RELEASE_NOTES_NAME: "顯示更新說明",
  RELEASE_NOTES_DESC:
    "<b>開啟：</b>每次更新本外掛後，顯示最新發行版本的說明。<br>" +
    "<b>關閉：</b>您仍可以在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a> 上閱讀更新說明。",
  WARN_ON_MANIFEST_MISMATCH_NAME: "警告外掛更新不完整",
  WARN_ON_MANIFEST_MISMATCH_DESC: "檢查已安裝的 Excalidraw 可執行檔案是否與 Obsidian 外掛列表中顯示的版本一致。如果不一致（通常源於同步不完整），你會看到警告並可以選擇更新。關閉該項可停用檢查。",
  NEWVERSION_NOTIFICATION_NAME: "外掛更新通知",
  NEWVERSION_NOTIFICATION_DESC:
    "<b>開啟：</b>當本外掛存在可用更新時，顯示通知。<br>" +
    "<b>關閉：</b>您需要手動檢查外掛更新（設定 - 第三方外掛 - 檢查更新）。",

  BASIC_HEAD: "基本",
  BASIC_DESC: `包括：更新說明，更新通知，新繪圖檔案、模板檔案、指令碼檔案的儲存路徑等。`,
  FOLDER_NAME: "Excalidraw 資料夾（區分大小寫！）",
  FOLDER_DESC:
    "新繪圖的預設儲存路徑。若為空，將在倉庫根目錄中建立新繪圖。",
  CROP_SUFFIX_NAME: "裁剪檔案的字尾",
  CROP_SUFFIX_DESC:
    "裁剪影像時建立的新繪圖檔名的最後部分。" +
    "如果不需要字尾，請留空。",
  CROP_PREFIX_NAME: "裁剪檔案的字首",
  CROP_PREFIX_DESC:
    "裁剪影像時建立的新繪圖檔名的第一部分。" +
    "如果不需要字首，請留空。",
  ANNOTATE_SUFFIX_NAME: "標註檔案的字尾",
  ANNOTATE_SUFFIX_DESC:
    "標註影像時建立的新繪圖檔名的最後部分。" +
    "如果不需要字尾，請留空。",
  ANNOTATE_PREFIX_NAME: "標註檔案的字首",
  ANNOTATE_PREFIX_DESC:
    "標註影像時建立的新繪圖檔名的第一部分。" +
    "如果不需要字首，請留空。",
  ANNOTATE_PRESERVE_SIZE_NAME: "在標註時保留影像尺寸",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "當在 Markdown 中標註影像時，替換後的影像連結將包含原始影像的寬度。",
  CROP_FOLDER_NAME: "裁剪檔案所在資料夾（區分大小寫！）",
  CROP_FOLDER_DESC:
    "裁剪影像時建立的新繪圖的預設儲存路徑。如果留空，將按照倉庫附件設定建立。",
  ANNOTATE_FOLDER_NAME: "標註檔案所在資料夾（區分大小寫！）",
  ANNOTATE_FOLDER_DESC:
    "標註影像時建立的新繪圖的預設儲存路徑。如果留空，將按照倉庫附件設定建立。",
  FOLDER_EMBED_NAME:
    "將 Excalidraw 資料夾用於“新建繪圖”系列命令",
  FOLDER_EMBED_DESC:
    "在命令面板中執行“新建繪圖”系列命令時，" +
    "新建的繪圖檔案的儲存路徑。<br>" +
    "<b>開啟：</b>使用上面的 Excalidraw 資料夾。 <br><b>關閉：</b>使用 Obsidian 設定的新附件預設位置。",
  TEMPLATE_NAME: "Excalidraw 模板檔案（區分大小寫！）",
  TEMPLATE_DESC:
    "Excalidraw 模板檔案（資料夾）的儲存路徑。<br>" +
    "<b>模板檔案：</b>例如：您的模板在預設的 Excalidraw 資料夾中且檔名是 Template.md，" +
    "則該項應設為 Excalidraw/Template.md 或 Excalidraw/Template（省略 .md 副檔名）。<br>" +
    "如果您在相容模式下使用 Excalidraw，那麼您的模板檔案也必須是舊的 *.excalidraw 格式，" +
    "如 Excalidraw/Template.excalidraw。<br><b>模板資料夾：</b> 您還可以將資料夾設定為模板。" +
    "這時，建立新繪圖時將提示您選擇使用哪個模板。<br>" +
    "<b>專業提示：</b> 如果您正在使用 Obsidian Templater 外掛，您可以將 Templater 程式碼新增到不同的" +
    "Excalidraw 模板中，以自動配置您的繪圖。",
  SCRIPT_FOLDER_NAME: "Excalidraw 自動化指令碼所在資料夾（區分大小寫！）",
  SCRIPT_FOLDER_DESC:
    "此資料夾用於存放 Excalidraw 自動化指令碼。" +
    "您可以在 Obsidian 命令面板中執行這些指令碼，" +
    "還可以為喜歡的指令碼分配熱鍵，就像為其他 Obsidian 命令分配熱鍵一樣。<br>" +
    "該項不能設為倉庫根目錄。",
  AI_HEAD: "AI（實驗性）",
  AI_DESC: `OpenAI GPT API 的設定。` +
    `目前 OpenAI API 還處於測試階段，您需要使用自己的 API key。` +
    `建立 OpenAI 賬戶，充值至少 5 美元，生成 API key，` +
    `然後就可以在 Excalidraw 中配置並使用 AI。`,
  AI_ENABLED_NAME: "啟用 AI 功能",
  AI_ENABLED_DESC: "您需要重新開啟 Excalidraw 才能使更改生效。",
  AI_OPENAI_TOKEN_NAME: "OpenAI API key",
  AI_OPENAI_TOKEN_DESC:
    "您可以訪問您的 <a href='https://platform.openai.com/api-keys'>OpenAI 賬戶</a> 來獲取自己的 OpenAI API key。",
  AI_OPENAI_TOKEN_PLACEHOLDER: "OpenAI API key",
  AI_OPENAI_DEFAULT_MODEL_NAME: "預設的文字 AI 模型",
  AI_OPENAI_DEFAULT_MODEL_DESC:
    "使用哪個 AI 模型來生成文字。請填寫有效的 OpenAI 模型名稱。" +
    "您可訪問 <a href='https://platform.openai.com/docs/models'>OpenAI 網站</a> 瞭解更多模型資訊。",
  AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER: "gpt-5-mini",
  AI_OPENAI_DEFAULT_MAX_TOKENS_NAME: "最大 token 數",
  AI_OPENAI_DEFAULT_MAX_TOKENS_DESC:
    "API 響應中生成的最大 token 數。設定為 0 以忽略 max_tokens 欄位（適用於不支援該引數的模型，如 GPT-5）。",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME: "預設的圖片 AI 模型",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC:
    "使用哪個 AI 模型來生成圖片。圖生圖目前只有 dall-e-2 和 gpt-image-1 模型支援 Image editing and variations。" +
    "請填寫有效的 OpenAI 模型名稱。" +
    "您可訪問 <a href='https://platform.openai.com/docs/models'>OpenAI 網站</a> 瞭解更多模型資訊。",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER: "gpt-image-1",
  AI_OPENAI_DEFAULT_VISION_MODEL_NAME: "預設的 AI 視覺模型",
  AI_OPENAI_DEFAULT_VISION_MODEL_DESC:
    "根據文字生成圖片時，使用哪個 AI 視覺模型。請填寫有效的 OpenAI 模型名稱。" +
    "您可訪問 <a href='https://platform.openai.com/docs/models'>OpenAI 網站</a> 瞭解更多模型資訊。",
  AI_OPENAI_DEFAULT_API_URL_NAME: "OpenAI API URL",
  AI_OPENAI_DEFAULT_API_URL_DESC:
    "預設的 OpenAI API URL。請填寫有效的 OpenAI API URL。" +
    "Excalidraw 會透過該 URL 傳送 API 請求給 OpenAI。我沒有對該項做任何錯誤處理，請謹慎修改。",
  AI_OPENAI_DEFAULT_IMAGE_API_URL_NAME: "OpenAI 圖片生成 API URL",
  AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER: "輸入預設 AI 模型名稱，如 gpt-5-mini",
  SAVING_HEAD: "儲存",
  SAVING_DESC: "包括：壓縮，自動儲存的時間間隔，檔案的命名格式和副檔名等。",
  COMPRESS_NAME: "壓縮 Excalidraw JSON",
  COMPRESS_DESC:
    "Excalidraw 預設將元素記錄為 JSON 格式。開啟該項，可將元素的 JSON 資料以 Base64 編碼" +
    "（使用 <a href='https://pieroxy.net/blog/pages/lz-string/index.html'>LZ-String</a> 演算法）。" +
    "這樣一方面可以避免原來的明文 JSON 資料干擾 Obsidian 的文字搜尋結果，" +
    "另一方面減小了繪圖檔案的體積。<br>" +
    "當您透過選單按鈕或命令將繪圖切換至 Markdown 檢視模式時，" +
    "資料將被解碼回 JSON 格式以便閱讀和編輯；" +
    "而當您切換回 Excalidraw 模式時，資料就會被再次編碼。<br>" +
    "開啟該項後，對於之前已存在但未壓縮的繪圖檔案，" +
    "需要重新開啟並儲存才能生效。",
  DECOMPRESS_FOR_MD_NAME: "在 Markdown 檢視中解壓縮 Excalidraw JSON",
  DECOMPRESS_FOR_MD_DESC:
    "透過啟用此功能，Excalidraw 將在切換到 Markdown 檢視時自動解壓縮繪圖 JSON。" +
    "這將使您能夠輕鬆閱讀和編輯 JSON 字串。" +
    "一旦您切換回 Excalidraw 檢視並儲存繪圖（Ctrl+S），繪圖將再次被壓縮。<br>" +
    "我建議關閉此功能，因為這可以獲得更小的檔案尺寸，並避免在 Obsidian 搜尋中出現不必要的結果。" +
    "您始終可以使用命令面板中的“Excalidraw: 解壓縮當前 Excalidraw 檔案”命令" +
    "在需要閱讀或編輯時手動解壓縮繪圖 JSON。",
  AUTOSAVE_INTERVAL_DESKTOP_NAME: "桌面端自動儲存時間間隔",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "每隔多長時間自動儲存一次。如果繪圖檔案沒有發生改變，將不會儲存。" +
    "當 Obsidian 應用內的焦點離開活動檔案，如關閉某個標籤頁、點選功能區、切換到其他標籤頁等時，也會觸發自動儲存；" +
    "直接退出 Obsidian 應用（不管是終結程序還是點關閉按鈕）不會觸發自動儲存。",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "移動端自動儲存時間間隔",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "建議在移動端設定更短的時間間隔。" +
    "當 Obsidian 應用內的焦點離開活動檔案時，也會觸發自動儲存；" +
    "直接退出 Obsidian 應用（在應用切換器中劃掉）不會觸發自動儲存。" +
    "此外，當您切換到其他應用時，有時系統會自動清理 Obsidian 後臺以釋放資源。這種情況下，自動儲存會失效。",
  FILENAME_HEAD: "檔名",
  FILENAME_DESC:
    "<p>點選閱讀 " +
    "<a href='https://momentjs.com/docs/#/displaying/format/'>日期和時間格式參考</a>。</p>",
  FILENAME_SAMPLE: "“新建繪圖”系列命令建立的檔名如：",
  FILENAME_EMBED_SAMPLE: "“新建繪圖並嵌入到當前 Markdown 文件中”系列命令建立的檔名如：",
  FILENAME_PREFIX_NAME: "“新建繪圖”系列命令建立的檔名字首",
  FILENAME_PREFIX_DESC: "“新建繪圖”系列命令建立的檔名的第一部分",
  FILENAME_PREFIX_EMBED_NAME:
    "“新建繪圖並嵌入到當前 Markdown 文件中”系列命令建立的檔名字首",
  FILENAME_PREFIX_EMBED_DESC:
    "執行“新建繪圖並嵌入到當前 Markdown 文件中”系列命令時，" +
    "建立的繪圖檔名是否以當前文件名作為字首？<br>" +
    "<b>開啟：</b>是。<b>關閉：</b>否。",
  FILENAME_POSTFIX_NAME:
    "“新建繪圖並嵌入到當前 Markdown 文件中”系列命令建立的檔名的中間部分",
  FILENAME_POSTFIX_DESC:
    "介於檔名字首和日期時間之間的文字。僅對“新建繪圖並嵌入到當前 Markdown 文件中”系列命令建立的繪圖生效。",
  FILENAME_DATE_NAME: "檔名裡的日期時間",
  FILENAME_DATE_DESC:
    "檔名的最後一部分。允許留空。",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: "副檔名（.excalidraw.md 或 .md）",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "該項在非 Excalidraw Markdown 文件（相容模式）不會生效。<br>" +
    "<b>開啟：</b>使用 .excalidraw.md 作為副檔名。<br><b>關閉：</b>使用 .md 作為副檔名。",
  DISPLAY_HEAD: "介面 & 行為",
  DISPLAY_DESC: "包括：左手模式、動態樣式、匹配 Excalidraw 和 Obsidian 主題、預設執行模式等。",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME: "限制 Obsidian 字型大小為編輯器文字",
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC:
    "Obsidian 的自定義字型大小設定會影響整個介面，包括 Excalidraw 和依賴預設字型大小的主題。" +
    "啟用該項將限制字型大小更改為編輯器文字，這將改善 Excalidraw 的外觀。" +
    "如果啟用後發現介面的某些部分看起來不正確，請嘗試關閉該項。",
  DYNAMICSTYLE_NAME: "動態樣式",
  DYNAMICSTYLE_DESC:
    "根據繪圖顏色自動調整 Excalidraw 介面顏色",
  LEFTHANDED_MODE_NAME: "左手模式",
  LEFTHANDED_MODE_DESC:
    "目前只在托盤模式下生效。控制托盤（繪圖工具屬性頁）位置。" +
    "<br><b>開啟：</b>左手模式 - 位於右側。<b>關閉：</b>右手模式 - 位於左側。",
  IFRAME_MATCH_THEME_NAME: "使 Embeddable 匹配 Excalidraw 主題",
  IFRAME_MATCH_THEME_DESC:
    "<b>開啟：</b>當 Obsidian 和 Excalidraw 一個使用深色主題、一個使用淺色主題時，" +
    "開啟該項後，以互動形式嵌入到繪圖中的元素將會匹配 Excalidraw 主題。<br>" +
    "<b>關閉：</b>如果您想要 Embeddable 匹配 Obsidian 主題，請關閉該項。",
  MATCH_THEME_NAME: "使新建的繪圖匹配 Obsidian 主題",
  MATCH_THEME_DESC:
    "如果 Obsidian 使用深色主題，新建的繪圖檔案也將使用深色主題。<br>" +
    "但是若設定了模板，新建的繪圖檔案將跟隨模板主題；另外，此功能不會作用於已有的繪圖。" +
    "<br><b>開啟：</b>跟隨 Obsidian 主題。<br><b>關閉：</b>跟隨模板主題。",
  MATCH_THEME_ALWAYS_NAME: "使已有的繪圖匹配 Obsidian 主題",
  MATCH_THEME_ALWAYS_DESC:
    "如果 Obsidian 使用深色主題，則繪圖檔案也將以深色主題開啟；反之亦然。" +
    "<br><b>開啟：</b>匹配 Obsidian 主題。<br><b>關閉：</b>採用上次儲存時的主題。",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw 主題跟隨 Obsidian 主題變化",
  MATCH_THEME_TRIGGER_DESC:
    "開啟該項，則切換 Obsidian 的深色/淺色主題時，已開啟的 Excalidraw 面板的主題會隨之改變。" +
    "<br><b>開啟：</b>跟隨主題變化。<br><b>關閉：</b>不跟隨主題變化。",
  DEFAULT_OPEN_MODE_NAME: "Excalidraw 的預設執行模式",
  DEFAULT_OPEN_MODE_DESC:
    "設定 Excalidraw 的執行模式：普通模式（Normal）/禪模式（Zen）/檢視模式（View）。<br>" +
    "可為某個繪圖單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-default-mode: normal/zen/view</code> 的鍵值對。",
  DEFAULT_PEN_MODE_NAME: "觸控筆模式（Pen mode）",
  DEFAULT_PEN_MODE_DESC:
    "開啟繪圖時，是否自動開啟觸控筆模式？",
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME: "啟用雙擊文字建立",
  DISABLE_DOUBLE_TAP_ERASER_NAME: "啟用手寫模式下的雙擊橡皮擦功能",
  DISABLE_SINGLE_FINGER_PANNING_NAME: "啟用手寫模式下的單指平移功能",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "在觸控筆模式下顯示十字準星（+）",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "在觸控筆模式下使用塗鴉功能會顯示十字準星。<b>開啟：</b>顯示。<b>關閉：</b>隱藏。<br>" +
    "效果取決於裝置。十字準星通常在繪圖板、MS Surface 上可見，但在 iOS 上不可見。",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME: "滑鼠懸停預覽時 Excalidraw 將渲染為影像",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "…即使檔案具有 <code>excalidraw-open-md: true</code> 筆記屬性。<br>" +
    "當該項關閉且設定了預設開啟為 Markdown 時，" +
    "懸停預覽將顯示 Markdown 模式的繪圖。<br>" +
    "注意：<b>excalidraw-open-md</b> 不同於 <b>excalidraw-embed-md</b>。如果 <b>excalidraw-embed-md</b> 設定為 true，則懸停預覽始終顯示 Markdown 模式的繪圖，不受該項影響。要強制將嵌入到 Markdown 文件的繪圖渲染為影像，請使用 <code>![[drawing#^as-image]]</code>。",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME: "Markdown 模式的 Excalidraw 在閱讀模式將渲染為影像",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC:
    "當您在 Markdown Reading 模式（又名“閱讀繪圖的背景筆記”）時，Excalidraw 繪圖是否渲染為影像。<br>" +
    "該項不會影響：Excalidraw 模式的、嵌入到 Markdown 文件的、或懸停預覽時的繪圖顯示。<br>" +
    "請參閱餘下部分中與 <a href='#" + TAG_MDREADINGMODE + "'>Markdown Reading 模式</a> 相關的其他設定。<br>" +
    "⚠️ 關閉並重新開啟 Excalidraw/Markdown 檔案後生效。",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME: "在 Obsidian 中匯出為 PDF 時 Excalidraw 將渲染為圖片",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC:
    "該項控制在使用 Obsidian 內建的 <b>匯出為 PDF</b> 功能，如何將 Excalidraw 檔案匯出為 PDF。<br>" +
    "<ul><li><b>啟用：</b>PDF 將包含 Excalidraw 繪圖圖片。</li>" +
    "<li><b>停用：</b>PDF 將包含 Markdown 模式的繪圖。</li></ul>" +
    "注意：該項不會影響 Excalidraw 本身的 PDF 匯出功能。<br>" +
    "請參閱下方 <a href='#"+TAG_PDFEXPORT+"'>PDF 匯出設定</a>。<br>" +
    "⚠️ 關閉並重新開啟 Excalidraw/Markdown 檔案後生效。",
  MODES_HEAD: "UI 模式",
  DESKTOP_UI_MODE_NAME: "桌面端偏好模式",
  DESKTOP_UI_MODE_DESC: "桌面端裝置預設 UI 模式。",
  TABLET_UI_MODE_NAME: "平板端偏好模式",
  TABLET_UI_MODE_DESC: "平板端裝置預設 UI 模式。",
  PHONE_UI_MODE_NAME: "手機端偏好模式",
  PHONE_UI_MODE_DESC: "手機端裝置預設 UI 模式。",
  MODE_FULL: "Desktop-mode",
  MODE_COMPACT: "Compact-mode",
  MODE_TRAY: "Tray-mode",
  MODE_PHONE: "Phone-mode",
  REAPPLY_UI_MODE_BUTTON: "重新應用 UI 模式",
  TRAY_MODE_NAME: "啟用托盤模式",
  PREFER_COMPACT_MODE_DESKTOP_NAME: "在桌面端偏好緊湊模式",
  PREFER_COMPACT_MODE_DESKTOP_DESC: "切換托盤模式時，開啟該項，Excalidraw 將在緊湊模式與托盤模式之間切換。" +
    "關閉該項，則在完整模式與托盤模式之間切換。",
  COMPACT_MODE_NAME: "在平板端偏好緊湊模式",
  COMPACT_MODE_DESC: "該項允許平板端和桌面端設定不同的預設模式。你可以在平板端預設使用緊湊模式，而在桌面端預設使用托盤模式。",
  HOTKEY_OVERRIDE_HEAD: "熱鍵覆蓋",
  HOTKEY_OVERRIDE_DESC: `一些 Excalidraw 的熱鍵，如 ${labelCTRL()}+Enter 用於編輯文字，或 ${labelCTRL()}+K 用於建立元素連結，` +
    "與 Obsidian 的熱鍵設定衝突。您在下面新增的熱鍵組合將在使用 Excalidraw 時覆蓋 Obsidian 的熱鍵設定，" +
    `因此如果您希望在 Excalidraw 中預設“編組”，而不是“檢視關係圖譜”（核心外掛 - 關係圖譜），您可以新增 ${labelCTRL()}+G。`,
  THEME_HEAD: "主題和樣式",
  ZOOM_AND_PAN_HEAD: "縮放和平移",
  PAN_WITH_RIGHT_MOUSE_BUTTON_NAME: "右鍵拖動平移",
  PAN_WITH_RIGHT_MOUSE_BUTTON_DESC: "右鍵點選並拖動來平移繪圖（和線上白板工具 Miro 類似）。按 'm' 鍵開啟上下文選單。",
  DEFAULT_PINCHZOOM_NAME: "允許在觸控筆模式下進行雙指縮放",
  DEFAULT_PINCHZOOM_DESC:
    "在觸控筆模式下使用自由畫筆工具時，雙指縮放可能造成干擾。<br>" +
    "<b>開啟：</b>允許雙指縮放。<b>關閉： </b>禁止雙指縮放。",

  DEFAULT_WHEELZOOM_NAME: "滑鼠滾輪縮放",
  DEFAULT_WHEELZOOM_DESC:
    `<b>開啟：</b>滑鼠滾輪為縮放繪圖，${labelCTRL()}+滑鼠滾輪為滾動繪圖。<br><b>關閉：</b>滑鼠滾輪為滾動繪圖，${labelCTRL()}+滑鼠滾輪為縮放繪圖。`,

  ZOOM_TO_FIT_NAME: "調整面板尺寸後自動縮放",
  ZOOM_TO_FIT_DESC: "調整面板尺寸後，自適應地縮放繪圖。" +
    "<br><b>開啟：</b>自動縮放。<b>關閉：</b>停用自動縮放。",
  ZOOM_TO_FIT_ONOPEN_NAME: "開啟繪圖時自動縮放",
  ZOOM_TO_FIT_ONOPEN_DESC: "開啟繪圖檔案時，自適應地縮放繪圖。" +
    "<br><b>開啟：</b>自動縮放。<b>關閉：</b>停用自動縮放。",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "自動縮放的最高級別",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "自動縮放繪圖時，允許放大的最高級別。該值不能低於 0.5（50%）且不能超過 10（1000%）。",
  ZOOM_STEP_NAME: "縮放增量",
  ZOOM_STEP_DESC: "執行縮放操作時，每次縮放的百分比增量。該值越小，控制精度越高，但完成同樣的縮放需要操作更多次。預設：5%。",
  ZOOM_MIN_NAME: "最小縮放",
  ZOOM_MIN_DESC: "繪圖縮小（顯示更多內容）的極限。預設：10%。低於 10% 可能不穩定——謹慎調低，出現問題請重置為 10%。",
  ZOOM_MAX_NAME: "最大縮放",
  ZOOM_MAX_DESC: "繪圖放大的極限。預設：3000%。通常無需修改，考慮完整性而提供。",
  PEN_HEAD: "手寫筆",
  GRID_HEAD: "網格",
  GRID_DYNAMIC_COLOR_NAME: "動態網格顏色",
  GRID_DYNAMIC_COLOR_DESC:
    "<b>開啟：</b>更改網格顏色以匹配繪圖顏色。<br><b>關閉：</b>將以下顏色用作網格顏色。",
  GRID_COLOR_NAME: "網格顏色",
  GRID_OPACITY_NAME: "網格不透明度",
  GRID_OPACITY_DESC: "設定網格的不透明度。0 全透明 ⟺ 100 不透明。",
  GRID_DIRECTION_NAME: "網格方向",
  GRID_DIRECTION_DESC: "第一個開關顯示/隱藏水平網格，第二個開關顯示/隱藏垂直網格。",
  GRID_HORIZONTAL: "渲染水平網格",
  GRID_VERTICAL: "渲染垂直網格",
  LASER_HEAD: "雷射筆工具（更多工具 > 雷射筆）",
  LASER_COLOR: "雷射筆顏色",
  LASER_DECAY_TIME_NAME: "雷射筆消失時間",
  LASER_DECAY_TIME_DESC: "單位是毫秒，預設 1000（即 1 秒）。",
  LASER_DECAY_LENGTH_NAME: "雷射筆軌跡長度",
  LASER_DECAY_LENGTH_DESC: "預設 50。",
  LINKS_HEAD: "連結 & 待辦任務（Todo）& 嵌入到繪圖中的 Markdown 文件（MD-Transclusion）",
  LINKS_HEAD_DESC: "包括：連結的開啟和顯示，Todo 的顯示，MD-Transclusion 的顯示等。",
  LINKS_DESC:
    `按住 ${labelCTRL()} 並點選包含 <code>[[連結]]</code> 的文字元素可以開啟其中的連結。<br>` +
    "如果所選文字元素包含多個 <code>[[有效的內部連結]]</code> ，只會開啟第一個連結；<br>" +
    "如果所選文字元素包含有效的 URL 連結（如 <code>https://</code> 或 <code>http://</code>），" +
    "外掛會在瀏覽器中開啟連結。<br>" +
    "連結的原始檔被重新命名時，繪圖中相應的 <code>[[內部連結]]</code> 也會同步更新。" +
    "若您不願繪圖中的連結外觀因此而變化，可使用 <code>[[內部連結|別名]]</code>。",
  DRAG_MODIFIER_NAME: "修飾鍵",
  DRAG_MODIFIER_DESC: "在您按住點選連結或拖動元素時，可以觸發某些行為。您可以為這些行為新增修飾鍵。" +
    "Excalidraw 不會檢查您的設定是否合理，因此請謹慎設定，避免衝突。" +
    "以下選項在蘋果和非蘋果裝置上區別很大，如果您在多個硬體平臺上使用 Obsidian，需要分別進行設定。" +
    "選項裡的 4 個開關依次代表 " +
    (DEVICE.isIOS || DEVICE.isMacOS ? "Shift, CMD, OPT, CONTROL." : "Shift, Ctrl, Alt, Meta (Win 鍵)。"),
  LONG_PRESS_DESKTOP_NAME: "長按開啟（電腦端）",
  LONG_PRESS_DESKTOP_DESC: "長按開啟在 Markdown 文件中嵌入的 Excalidraw 繪圖。單位：毫秒。",
  LONG_PRESS_MOBILE_NAME: "長按開啟（移動端）",
  LONG_PRESS_MOBILE_DESC: "長按開啟在 Markdown 文件中嵌入的 Excalidraw 繪圖。單位：毫秒。",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE: "在檢視模式下允許雙擊開啟連結",
  ELEMENT_LINK_SYNC_NAME: "文字元素同步正文連結",
  ELEMENT_LINK_SYNC_DESC: "若開啟，Excalidraw 將匹配 2.19.0 之前的行為：始終將正文第一個連結複製到元素連結欄位。匯出 SVG/PNG 僅在元素連結欄位包含單個連結（不包括正文內的連結）時保留連結。開啟：若你依賴正文連結並希望元素連結始終映象第一個連結。關閉：若你獨立管理元素連結，用於標籤、行內連結本體等元資料、或多個連結，如 Dataview 風格的筆記 '(reminds me of:: [[link]]) #noteToSelf'。",
  FOCUS_ON_EXISTING_TAB_NAME: "聚焦於當前標籤頁",
  FOCUS_ON_EXISTING_TAB_DESC: "當開啟一個連結時，如果該檔案已經開啟，Excalidraw 將會聚焦到現有的標籤頁上。" +
    "啟用該項時，如果檔案已開啟，將覆蓋“在相鄰面板中開啟”，但“開啟所選繪圖的背景筆記”命令面板操作除外。",
  SECOND_ORDER_LINKS_NAME: "顯示二級連結",
  SECOND_ORDER_LINKS_DESC: "在 Excalidraw 中開啟連結時顯示連結及二級連結。二級連結是指向被點選連結的反向連結。" +
    "當使用例如圖示的嵌入連結時，二級連結可以直達組成它的相關筆記，無需點選兩次。" +
    "觀看 <a href='https://youtube.com/shorts/O_1ls9c6wBY?feature=share'>這個 YouTube Shorts 影片</a> 以瞭解更多資訊。",
  ADJACENT_PANE_NAME: "在相鄰面板中開啟",
  ADJACENT_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 並點選繪圖裡的內部連結時，外掛預設會在新面板中開啟該連結。<br>` +
    "若開啟該項，Excalidraw 會先嚐試尋找已有的相鄰面板（按照右側、左側、上方、下方的順序），" +
    "並在其中開啟該連結。如果找不到，" +
    "再在新面板中開啟。",
  MAINWORKSPACE_PANE_NAME: "在主工作區中開啟",
  MAINWORKSPACE_PANE_DESC:
    `按住 ${labelCTRL()}+${labelSHIFT()} 並點選繪圖裡的內部連結時，外掛預設會在當前視窗的新面板中開啟該連結。<br>` +
    "若開啟該項，Excalidraw 會在主工作區的面板中開啟該連結。",
  LINK_BRACKETS_NAME: "在連結的兩側顯示 <code>[[中括號]]</code>",
  LINK_BRACKETS_DESC: `${
    "文字元素處於 PREVIEW 模式時，在內部連結的兩側顯示中括號。<br>" +
    "可為某個繪圖單獨設定該項，方法是在其 frontmatter 中新增如 <code>"
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> 的鍵值對。`,
  /*LINK_DETECTION_NAME: "Do not auto-create element link from text",
  LINK_DETECTION_DESC: "By default, Excalidraw will automatically create an element link when you type or paste a valid " +
    "[[Obsidian link]] or a (web link) into a Text Element. This link overrides whatever element link you may have set previously. " +
    "Even if you delete the element link, if the text element contains a valid link, Excalidraw will recreate the element link. " +
    "If you turn this setting on, Excalidraw will not auto-create element links from text. You can still manually set element links " +
    `Links in the text will still be navigable when you ${labelCTRL()} + CLICK the element.`,*/
  LINK_PREFIX_NAME: "內部連結的字首",
  LINK_PREFIX_DESC: `${
    "文字元素處於 PREVIEW 模式時，如果其中包含連結，則新增此字首。<br>" +
    "可為某個繪圖單獨設定該項，方法是在其 frontmatter 中新增如 <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> 的鍵值對。`,
  URL_PREFIX_NAME: "外部連結的字首",
  URL_PREFIX_DESC: `${
    "文字元素處於 PREVIEW 模式時，如果其中包含外部連結，則新增此字首。<br>" +
    "可為某個繪圖單獨設定該項，方法是在其 frontmatter 中新增如 <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> 的鍵值對。`,
  PARSE_TODO_NAME: "待辦任務（Todo）",
  PARSE_TODO_DESC: "將文字元素中的 <code>- [ ]</code> 和 <code>- [x]</code> 字首顯示為方框。",
  TODO_NAME: "未完成專案",
  TODO_DESC: "未完成的待辦專案的符號",
  DONE_NAME: "已完成專案",
  DONE_DESC: "已完成的待辦專案的符號",
  HOVERPREVIEW_NAME: "滑鼠懸停預覽內部連結",
  HOVERPREVIEW_DESC:
    `<b>開啟：</b>在 Excalidraw <u>檢視模式（View）</u>下，滑鼠懸停在 <code>[[內部連結]]</code> 上即可預覽；` +
    "而在<u>普通模式（Normal）</u>下，滑鼠懸停在內部連結右上角的藍色標識上即可預覽。<br>" +
    `<b>關閉：</b>滑鼠懸停在 <code>[[內部連結]]</code> 上，並且按住 ${labelCTRL()} 才能預覽。`,
  LINKOPACITY_NAME: "連結標識的不透明度",
  LINKOPACITY_DESC:
    "含有連結的元素，其右上角的連結標識的不透明度。0 全透明 ⟺ 100 不透明。",
  LINK_CTRL_CLICK_NAME:
    `按住 ${labelCTRL()} 並點選含有 [[連結]] 或 [別名](連結) 的文字來開啟連結`,
  LINK_CTRL_CLICK_DESC:
    "如果此功能影響到您使用某些原版 Excalidraw 功能，可將其關閉。" +
    `關閉後，您可以使用 ${labelCTRL()} + ${labelMETA()} 或者元素右上角的連結指示器來開啟連結。`,
  TRANSCLUSION_WRAP_NAME: "MD-Transclusion 的折行方式",
  TRANSCLUSION_WRAP_DESC:
    "中的 number 表示嵌入的文字溢位時，在第幾個字元處進行折行。<br>" +
    "此開關控制具體的折行方式。<b>開啟：</b>嚴格在 number 處折行，禁止溢位；" +
    "<b>關閉：</b>允許在 number 位置後最近的空格處折行。",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "MD-Transclusion 的預設折行位置",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "除了透過 <code>![[doc#^block]]{number}</code> 中的 number 來控制折行位置，您也可以在此設定 number 的預設值。<br>" +
    "一般設為 0 即可，表示不設定固定的預設值，這樣當您需要嵌入文件到便籤中時，" +
    "Excalidraw 能更好地幫您自動處理。",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "MD-Transclusion 的最大顯示字元數",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "透過 <code>![[內部連結]]</code> 或 <code>![](內部連結)</code> 格式，將文件以文字形式嵌入到繪圖中時，" +
    "該文件在繪圖中可顯示的最大字元數量。",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "隱藏 MD-Transclusion 行首的引用符號",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "不顯示 MD-Transclusion 中每一行行首的 > 符號，以提高純文字 MD-Transclusion 的可讀性。<br>" +
    "<b>開啟：</b>隱藏 > 符號。<b>關閉：</b>不隱藏 > 符號。<br>注意，由於 Obsidian API 的原因，首行行首的 > 符號不會被隱藏。",
  GET_URL_TITLE_NAME: "使用 iframly 獲取頁面標題",
  GET_URL_TITLE_DESC:
    "拖動連結到 Excalidraw 時，使用 <code>http://iframely.server.crestify.com/iframely?url=</code> 來獲取頁面的標題。",
  PDF_TO_IMAGE: "以影像形式嵌入到繪圖中的 PDF",
  PDF_TO_IMAGE_SCALE_NAME: "解析度",
  PDF_TO_IMAGE_SCALE_DESC: "解析度越高，影像越清晰，但記憶體佔用也越大。" +
    "此外，如果您想要複製這些影像到 Excalidraw.com，可能會超出其 2MB 大小的限制。",
  EMBED_TOEXCALIDRAW_HEAD: "嵌入到繪圖中的檔案",
  EMBED_TOEXCALIDRAW_DESC: "包括：以影像形式嵌入到繪圖中的 PDF、以互動或影像形式嵌入到繪圖中的 Markdown 文件等。",
  MD_HEAD: "以影像形式嵌入到繪圖中的 Markdown 文件（MD-Embed）",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "以互動形式嵌入到繪圖中的 Markdown 文件（MD-Embeddable）",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `以下設定只會影響以後的嵌入。已存在的嵌入保持不變。嵌入框的主題設定位於“介面 & 行為”部分。`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "單擊以編輯嵌入的 Markdown",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "單擊嵌入的 Markdown 文件以進行編輯。 " +
    "當此功能關閉時，Markdown 文件將首先以預覽模式開啟，然後在您再次單擊時切換到編輯模式。",
  MD_TRANSCLUDE_WIDTH_NAME: "MD-Embed 的預設寬度",
  MD_TRANSCLUDE_WIDTH_DESC:
    "該項會影響到折行，以及影像的寬度。<br>" +
    "可為繪圖中的某個 MD-Embed 單獨設定，方法是將繪圖切換至 Markdown 檢視模式，" +
    "並修改相應的 <code>[[Embed 檔名#標題|寬度x最大高度]]</code>。",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "MD-Embed 的預設最大高度",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "MD-Embed 的高度取決於 Markdown 文件內容的多少，但最大不會超過該值。<br>" +
    "可為繪圖中的某個 MD-Embed 單獨設定，方法是將繪圖切換至 Markdown 檢視模式，並修改相應的 <code>[[Embed 檔名#^塊引ID|寬度x最大高度]]</code>。",
  MD_DEFAULT_FONT_NAME:
    "MD-Embed 的預設字型",
  MD_DEFAULT_FONT_DESC:
    "可以設為 Virgil、Casadia 或其他有效的 .ttf/.woff/.woff2 字型檔案，如 <code>我的字型.woff2</code>。<br>" +
    "可為某個 MD-Embed 單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-font: 字型名或檔名</code> 的鍵值對。",
  MD_DEFAULT_COLOR_NAME:
    "MD-Embed 的預設文字顏色",
  MD_DEFAULT_COLOR_DESC:
    "可以填寫 HTML 顏色名，如 steelblue（參考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 進位制顏色值，如 #e67700，或者任何其他有效的 CSS 顏色。<br>" +
    "可為某個 MD-Embed 單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-font-color: steelblue</code> 的鍵值對。",
  MD_DEFAULT_BORDER_COLOR_NAME:
    "MD-Embed 的預設邊框顏色",
  MD_DEFAULT_BORDER_COLOR_DESC:
    "可以填寫 HTML 顏色名，如 steelblue（參考 <a href='https://www.w3schools.com/colors/colors_names.asp'>HTML Color Names</a>），或者有效的 16 進位制顏色值，如 #e67700，或者任何其他有效的 CSS 顏色。<br>" +
    "可為某個 MD-Embed 單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-border-color: gray</code> 的鍵值對。<br>" +
    "如果您不想要邊框，請留空。",
  MD_CSS_NAME: "MD-Embed 的預設 CSS 樣式表",
  MD_CSS_DESC:
    "MD-Embed 影像所採用的 CSS 樣式表文件名。需包含副檔名，如 md-embed.css。" +
    "允許使用 Markdown 文件（如 md-embed-css.md），但其內容應符合 CSS 語法。<br>" +
    "如果您要查詢 CSS 所作用的 HTML 節點，請在 Obsidian 開發者控制檯（Ctrl+Shift+I）中鍵入命令：" +
    "<code>ExcalidrawAutomate.mostRecentMarkdownSVG</code> —— 這將顯示 Excalidraw 最近生成的 SVG。<br>" +
    "此外，在 CSS 中不能任意地設定字型，您一般只能使用系統預設的標準字型（詳見 README），" +
    "但可以透過上面的選項來額外新增一個自定義字型。<br>" +
    "可為某個 MD-Embed 單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-css: 倉庫中的 CSS 檔案或 CSS 片段</code> 的鍵值對。",
  EMBED_HEAD: "嵌入到 Markdown 文件中的繪圖",
  EMBED_DESC: `包括：嵌入到 Markdown 文件中的繪圖的預覽圖型別（SVG、PNG）、原始檔型別（Excalidraw、SVG、PNG）、快取、影像尺寸、影像主題，以及嵌入的語法等。
    此外，還有自動匯出 SVG 或 PNG 檔案並保持與繪圖檔案狀態同步的設定。`,
  EMBED_CANVAS: "Obsidian 白板支援",
  EMBED_CANVAS_NAME: "沉浸式嵌入",
  EMBED_CANVAS_DESC:
    "當嵌入繪圖到 Obsidian 白板中時，隱藏節點的邊界和背景。" +
    "注意：如果想要背景完全透明，您依然需要設定匯出背景為透明（關閉“匯出圖片包含背景”）。",
  EMBED_CACHING: "影像快取和渲染最佳化",
  RENDERING_CONCURRENCY_NAME: "影像渲染併發性",
  RENDERING_CONCURRENCY_DESC:
    "用於影像渲染的並行工作執行緒數。增加該值可以加快渲染速度，但可能會減慢系統其他部分的執行速度。" +
    "預設值為 3。如果您的系統性能強大，可以增加該值。",
  EXPORT_SUBHEAD: "匯出",
  EMBED_SIZING: "影像尺寸",
  EMBED_THEME_BACKGROUND: "影像的主題和背景色",
  EMBED_IMAGE_CACHE_NAME: "為嵌入到 Markdown 文件中的繪圖建立預覽圖快取",
  EMBED_IMAGE_CACHE_DESC: "可提高下次嵌入的速度。" +
    "但如果繪圖包含子繪圖，（當子繪圖改變時）預覽圖不會更新，直到您開啟繪圖並手動儲存。",
  SCENE_IMAGE_CACHE_NAME: "快取場景中巢狀的繪圖",
  SCENE_IMAGE_CACHE_DESC: "Excalidraw 將智慧地嘗試識別巢狀的繪圖的子元素是否發生變化，並更新快取。" +
    "這將加快渲染過程，特別是在您的場景中有深度巢狀的繪圖時。<br>" +
    "如果您懷疑快取未能正確更新，您可能需要關閉此功能。",
  EMBED_IMAGE_CACHE_CLEAR: "清除快取",
  BACKUP_CACHE_CLEAR: "清除備份",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "該操作將刪除所有繪圖檔案的備份。備份是繪圖檔案損壞時的一種補救手段。每次您開啟 Obsidian 時，本外掛會自動清理無用的備份。您確定要現在刪除所有備份嗎？",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "將之前已匯出圖片作為預覽圖",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "該項與下方“匯出”部分“匯出設定”中的 <a href='#"+TAG_AUTOEXPORT+"'>自動匯出 SVG/PNG 副本</a> 選項配合使用。如果嵌入到 Markdown 文件中的繪圖檔案存在同名的 SVG/PNG 副本，則將其作為預覽圖，而不再重新生成。<br>" +
    "該項能夠提高 Markdown 文件的開啟速度，尤其是當嵌入到 Markdown 文件中的繪圖檔案中含有大量圖片或 MD-Embed 時。" +
    "但是，該項也可能導致預覽圖無法立即響應繪圖檔案或者 Obsidian 主題的修改。<br>" +
    "該項僅作用於嵌入到 Markdown 文件中的繪圖。" +
    "該項無法提升繪圖檔案的開啟速度。詳見 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.23' target='_blank'>此說明</a>。",
  /*EMBED_PREVIEW_SVG_NAME: "生成 SVG 格式的預覽圖",
  EMBED_PREVIEW_SVG_DESC:
    "<b>開啟：</b>為嵌入到 Markdown 文件中的繪圖生成 <a href='https://en.wikipedia.org/wiki/Scalable_Vector_Graphics' target='_blank'>SVG</a> 格式的預覽圖。<br>" +
    "<b>關閉：</b>為嵌入到 Markdown 文件中的繪圖生成 <a href='' target='_blank'>PNG</a> 格式的預覽圖。注意：PNG 格式預覽圖不支援某些 <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>繪圖元素的塊引用特性</a>。",*/
  EMBED_PREVIEW_IMAGETYPE_NAME: "預覽圖的格式",
  EMBED_PREVIEW_IMAGETYPE_DESC:
    "<b>Native SVG：</b>高品質、可互動。<br>" +
    "<b>SVG：</b>高品質、不可互動。<br>" +
    "<b>PNG：</b>高效能、<a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>不可互動</a>。",
  PREVIEW_MATCH_OBSIDIAN_NAME: "預覽圖匹配 Obsidian 主題",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "開啟該項，則當 Obsidian 處於深色主題時，嵌入到 Markdown 文件中的繪圖的預覽圖也會以深色主題渲染；當 Obsidian 處於淺色主題時，預覽圖也會以淺色主題渲染。<br>" +
    "您可能還需要關閉“匯出圖片包含背景”，來獲得與 Obsidian 更加協調的觀感。",
  EMBED_WIDTH_NAME: "預覽圖的預設寬度",
  EMBED_WIDTH_DESC:
    "嵌入到 Markdown 文件中的繪圖的預覽圖的預設寬度。該項也適用於滑鼠懸停時浮現的預覽圖。<br>" +
    "可為某個要嵌入到 Markdown 文件中的繪圖單獨設定，" +
    "方法是修改相應的內部連結格式為如 <code>![[drawing.excalidraw|100]]</code> 或 <code>[[drawing.excalidraw|100x100]]</code>。",
  EMBED_HEIGHT_NAME: "預覽圖的預設高度",
  EMBED_HEIGHT_DESC:
    "嵌入到 Markdown 文件中的繪圖的預覽圖得預設高度。該項也適用於即時預覽編輯和閱讀模式，以及懸停預覽。" +
    "您可以在使用 <code>![[drawing.excalidraw|100]]</code> 或者 <code>[[drawing.excalidraw|100x100]]</code>" +
    "格式在嵌入影像時指定自定義高度。",
  EMBED_TYPE_NAME: "“嵌入繪圖到當前 Markdown 文件中”系列命令的原始檔型別",
  EMBED_TYPE_DESC:
    "執行“嵌入繪圖到當前 Markdown 文件中”系列命令時，要嵌入繪圖檔案本身，還是嵌入其 SVG 或 PNG 副本。<br>" +
    "如果您想選擇 SVG/PNG 副本，需要先開啟下方“匯出”部分“匯出設定”中的 <a href='#"+TAG_AUTOEXPORT+"'>自動匯出 SVG/PNG 副本</a>。<br>" +
    "如果您選擇了 SVG/PNG 副本，當副本不存在時，該命令將會插入一條損壞的連結，您需要開啟繪圖檔案並手動匯出副本才能修復——" +
    "也就是說，該項不會自動幫您生成 SVG/PNG 副本，而只會引用已有的 SVG/PNG 副本。",
  EMBED_MARKDOWN_COMMENT_NAME: "將連結作為註釋插入",
  EMBED_MARKDOWN_COMMENT_DESC:
    "在影像下方以 Markdown 連結形式插入原始 Excalidraw 檔案的連結，如 <code>%%[[drawing.excalidraw]]%%</code>。<br>" +
    "除了新增 Markdown 註釋之外，您還可以選擇嵌入的 SVG 或 PNG，並使用命令面板：" +
    "'<code>Excalidraw: 開啟 Excalidraw 繪圖</code>'來開啟該繪圖",
  EMBED_WIKILINK_NAME: "“嵌入繪圖到當前 Markdown 文件中”系列命令產生的內部連結型別",
  EMBED_WIKILINK_DESC:
    "<b>開啟：</b>將產生 <code>![[Wiki 連結]]</code>。<b>關閉：</b>將產生 <code>![](Markdown 連結)</code>。",
  EXPORT_PNG_SCALE_NAME: "匯出 PNG 圖片的比例",
  EXPORT_PNG_SCALE_DESC: "匯出 PNG 圖片的大小比例",
  EXPORT_BACKGROUND_NAME: "匯出圖片包含背景",
  EXPORT_BACKGROUND_DESC:
    "如果關閉，將匯出透明背景的圖片。",
  EXPORT_PADDING_NAME: "匯出圖片的空白邊距",
  EXPORT_PADDING_DESC:
    "匯出 SVG/PNG 圖片四周的空白邊距。單位：畫素。對於 ![[file#^clippedframe=id]]，邊距被設定為 0。<br>" +
    "增加該值，可以避免在匯出圖片時，圖片邊緣的部分被裁掉。<br>" +
    "可為某個繪圖單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-export-padding: 5</code> 的鍵值對。",
  EXPORT_THEME_NAME: "匯出圖片匹配主題",
  EXPORT_THEME_DESC:
    "匯出與繪圖的深色/淺色主題匹配的圖片。" +
    "如果關閉，深色主題下的匯出圖片將和淺色主題一樣。",
  EXPORT_EMBED_SCENE_NAME: "在匯出圖片中嵌入場景",
  EXPORT_EMBED_SCENE_DESC:
    "在匯出圖片中嵌入 Excalidraw 場景。可以在其 frontmatter 中新增如 <code>excalidraw-export-embed-scene: true/false</code> 的鍵值對來覆蓋該項。" +
    "該項僅在您下次（重新）開啟繪圖時生效。",
  PDF_EXPORT_SETTINGS: "PDF 匯出設定",
  EXPORT_HEAD: "匯出設定",
  EXPORT_SYNC_NAME:
    "保持 SVG/PNG 檔名與繪圖檔案同步",
  EXPORT_SYNC_DESC:
    "開啟後，當繪圖檔案被重新命名時，外掛將同步更新同文件夾下的同名 .SVG 和 .PNG 檔案。" +
    "當繪圖檔案被刪除時，外掛將自動刪除同文件夾下的同名 .SVG 和 .PNG 檔案。",
  EXPORT_SVG_NAME: "自動匯出 SVG 副本",
  EXPORT_SVG_DESC:
    "自動匯出和繪圖檔案同名的 SVG 副本。" +
    "外掛會將副本儲存到繪圖檔案所在資料夾中。" +
    "在文件中嵌入 SVG 檔案，相比直接嵌入繪圖檔案，具有更強的跨平臺能力。<br>" +
    "此開關開啟時，每次您編輯 Excalidraw 繪圖，其 SVG 檔案副本都會同步更新。<br>" +
    "可為某個繪圖單獨設定，方法是在其 frontmatter 中新增如 <code>excalidraw-autoexport: none/both/svg/png</code>" +
    "的鍵值對。",
  EXPORT_PNG_NAME: "自動匯出 PNG 副本",
  EXPORT_PNG_DESC: "和“自動匯出 SVG 副本”類似，但是匯出格式為 *.PNG。",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "同時匯出深色和淺色主題的圖片",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC: "若開啟，Excalidraw 將匯出兩個檔案：filename.dark.png（或 .svg）和 filename.light.png（或 .svg）。<br>" +
    "該項可作用於“自動匯出 SVG 副本”、“自動匯出 PNG 副本”，以及其他的手動的匯出命令。",
  COMPATIBILITY_HEAD: "相容性設定",
  COMPATIBILITY_DESC: "如果沒有特殊原因（例如：您想同時在 VSCode/Logseq 和 Obsidian 中使用 Excalidraw），建議您使用 Markdown 格式的繪圖檔案，而不是舊的 Excalidraw.com 格式，因為本外掛的很多功能在舊格式中無法使用。",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "相容程式碼格式化（Linting）",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC: "Excalidraw 對 <code># Excalidraw Data</code> 下的檔案結構非常敏感。文件的自動格式化可能會在 Excalidraw 資料中造成錯誤。" +
    "雖然我已經努力使資料載入對自動格式化變更具有一定的抗性，但這種解決方案並非萬無一失。<br>" +
    "<mark>最好的方法是避免使用不同的外掛對 Excalidraw 檔案進行自動更改。</mark><br>" +
    "如果出於某些合理的原因，您決定忽略我的建議並配置了 Excalidraw 檔案的自動格式化，那麼可以啟用該項。<br>" +
    "<code>## Text Elements</code> 部分對空行很敏感。一種常見的程式碼格式化是在章節標題後新增一個空行。但對於 Excalidraw 來說，這將破壞/改變您繪圖中的第一個文字元素。" +
    "為了解決這個問題，您可以啟用該項。啟用後 Excalidraw 將在 <code>## Text Elements</code> 的開頭新增一個虛擬元素，供自動格式化工具修改。",
  PRESERVE_TEXT_AFTER_DRAWING_NAME: "相容 Zotero 和腳註（footnotes）",
  PRESERVE_TEXT_AFTER_DRAWING_DESC: "保留 Excalidraw Markdown 中 <code>## Drawing</code> 部分之後的文字內容。儲存非常大的繪圖時，這可能會造成微小的效能影響。",
  DEBUGMODE_NAME: "開啟 debug 資訊",
  DEBUGMODE_DESC: "我建議在啟用/停用該項後重新啟動 Obsidian。這將在控制檯中啟用除錯訊息，有助於排查問題。" +
    "如果您在使用外掛時遇到問題，請啟用該項，重現問題，並在 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/issues'>GitHub</a> 上提出的問題中包含控制檯日誌。",
  SLIDING_PANES_NAME: "支援 Sliding Panes 外掛",
  SLIDING_PANES_DESC:
    "該項需要重啟 Obsidian 才能生效。<br>" +
    "如果您使用 <a href='https://github.com/deathau/sliding-panes-obsidian' target='_blank'>Sliding Panes 外掛</a>，" +
    "您可以開啟該項來使 Excalidraw 繪圖相容此外掛。<br>" +
    "注意，開啟後會產生一些與 Obsidian 工作空間的相容性問題。<br>" +
    "另外，Obsidian 現在已經原生支援 Stack Tabs（堆疊標籤），基本實現了 Sliding Panes 外掛的功能。",
  EXPORT_EXCALIDRAW_NAME: "自動匯出 Excalidraw 舊格式副本",
  EXPORT_EXCALIDRAW_DESC: "和“自動匯出 SVG 副本”類似，但是匯出格式為 *.excalidraw。",
  SYNC_EXCALIDRAW_NAME:
    "新舊格式繪圖檔案的內容保持同步",
  SYNC_EXCALIDRAW_DESC:
    "如果舊格式（*.excalidraw）繪圖檔案的修改日期比新格式（*.md）更新，" +
    "則根據舊格式檔案的內容來更新新格式檔案。",
  COMPATIBILITY_MODE_NAME: "以舊格式建立新繪圖",
  COMPATIBILITY_MODE_DESC:
    "⚠️ 慎用！99.9% 的情況下您無需開啟該項。" +
    "開啟此功能後，您透過功能區按鈕、命令面板、" +
    "檔案瀏覽器等建立的繪圖都將是舊格式（*.excalidraw）。" +
    "此外，您開啟舊格式繪圖檔案時將不再收到警告訊息。",
  MATHJAX_NAME: "MathJax (LaTeX) 的 javascript 庫伺服器",
  MATHJAX_DESC: "如果您在繪圖中使用 LaTeX，外掛需要從伺服器獲取並載入一個 javascript 庫。" +
    "如果您的網路無法訪問某些庫伺服器，可以嘗試透過該項更換庫伺服器。" +
    "該項可能需要重啟 Obsidian 才能生效。",
  LATEX_DEFAULT_NAME: "插入 LaTeX 時的預設公式",
  LATEX_DEFAULT_DESC: "允許留空。允許使用類似 <code>\\color{white}</code> 的格式化表示式。",
  LATEX_PREAMBLE_NAME: "LaTeX 前言檔案（區分大小寫！）",
  LATEX_PREAMBLE_DESC: "前言檔案的完整路徑，留空則使用預設值。如果檔案不存在，該項將被忽略。<br><strong>重要：</strong>更改後需要重新載入 Obsidian 才能生效！",
  NONSTANDARD_HEAD: "非 Excalidraw.com 官方支援的特性",
  NONSTANDARD_DESC: `這些特性不受 Excalidraw.com 官方支援。如果在 Excalidraw.com 匯入繪圖，這些特性將會發生不可預知的變化。
    包括：自定義畫筆工具的數量，自定義字型等。`,
  RENDER_TWEAK_HEAD: "渲染最佳化",
  MAX_IMAGE_ZOOM_IN_NAME: "最大圖片放大倍數",
  MAX_IMAGE_ZOOM_IN_DESC: "為節省記憶體，並且因為 Apple Safari (Obsidian on iOS) 存在硬編碼的限制，Excalidraw.com 在放大時會限制圖片和大型物件的最大解析度。您可以設定一個倍數來覆蓋這個限制。" +
    "倍數越大，放大後的圖片解析度越高，但記憶體佔用也越大。" +
    "您可以多試幾個設定值。當您放大一張較大的 PNG 圖片時，如果圖片突然從檢視中消失，說明已經達到了極限。預設值為 1。該項對 iOS 無效。",
  CUSTOM_PEN_HEAD: "自定義畫筆",
  CUSTOM_PEN_NAME: "自定義畫筆工具的數量",
  CUSTOM_PEN_DESC: "在繪圖上的 Obsidian 選單按鈕旁邊切換自定義畫筆。長按（雙擊）畫筆按鈕可以修改其樣式。",
  EXPERIMENTAL_HEAD: "雜項",
  EXPERIMENTAL_DESC: `包括：預設的 LaTeX 公式，欄位建議，繪圖檔案的型別識別符號，OCR 等。`,
  EA_HEAD: "Excalidraw 自動化",
  EA_DESC:
    "ExcalidrawAutomate 是用於 Excalidraw 自動化指令碼的 API，但是目前說明文件還不夠完善，" +
    "建議閱讀 <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts'>ExcalidrawAutomate.d.ts</a> 檔案原始碼，" +
    "參考 <a href='https://zsviczian.github.io/obsidian-excalidraw-plugin/'>ExcalidrawAutomate How-to</a> 網頁（不過該網頁" +
    "有一段時間未更新了），並開啟下方的欄位建議。欄位建議功能能夠在您鍵入時提示可用的" +
    "函式及相應的引數，而且附帶描述，相當於最新的“文件”。",
  FIELD_SUGGESTER_NAME: "開啟欄位建議",
  FIELD_SUGGESTER_DESC:
    "開啟後，當您在編輯器中輸入 <code>excalidraw-</code> 或者 <code>ea.</code> 時，會彈出一個帶有函式說明的自動補全提示選單。<br>" +
    "該功能借鑑了 Breadcrumbs 和 Templater 外掛。",
  STARTUP_SCRIPT_NAME: "起動指令碼",
  STARTUP_SCRIPT_DESC:
    "外掛啟動時將自動執行該指令碼。可用於為您的 Excalidraw 自動化指令碼設定鉤子。" +
    "起動指令碼請用 javascript 程式碼編寫，並儲存為 Markdown 格式。",
  STARTUP_SCRIPT_BUTTON_CREATE: "建立起動指令碼",
  STARTUP_SCRIPT_BUTTON_OPEN: "開啟起動指令碼",
  STARTUP_SCRIPT_EXISTS: "起動指令碼已存在",
  FILETYPE_NAME: "在檔案瀏覽器中為 excalidraw.md 檔案新增型別識別符號（如 ✏️）",
  FILETYPE_DESC:
    "可透過下一選項來自定義型別識別符號。",
  FILETAG_NAME: "excalidraw.md 檔案的型別識別符號",
  FILETAG_DESC: "要顯示為型別識別符號的 emoji 或文字。",
  INSERT_EMOJI: "插入 emoji",
  LIVEPREVIEW_NAME: "嵌入繪圖到文件時，模擬嵌入圖片的語法",
  LIVEPREVIEW_DESC:
    "開啟該項，則可在 Obsidian 即時預覽模式的編輯檢視下，用如 <code>![[繪圖|寬度|樣式]]</code> 的語法來嵌入繪圖。<br>" +
    "對於已開啟的文件，需要重新開啟來使設定生效。" +
    "",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "淡化 Excalidraw 標記",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC: "在 Markdown 檢視模式下，在 Markdown 註釋 %% " +
    "之後的部分會淡化。文字仍然存在，但視覺雜亂感會減少。請注意，您可以將 %% 放在 # Text Elements 行的上一行，" +
    "這樣，整個 Excalidraw Markdown 都會淡化，包括 # Text Elements。 副作用是您將無法在其他 Markdown 筆記中引用文字塊，即 %% 註釋部分之後的內容。這應該不是大問題。" +
    "如果您想編輯 Excalidraw Markdown 指令碼，只需切換至 Markdown 檢視模式並暫時刪除 %% 註釋。",
  EXCALIDRAW_PROPERTIES_NAME: "將 Excalidraw 屬性載入到 Obsidian 的自動提示中",
  EXCALIDRAW_PROPERTIES_DESC: "切換該項以在外掛啟動時將 Excalidraw 筆記屬性載入到 Obsidian 的屬性自動提示中。" +
   "啟用此功能簡化了 Excalidraw 前置屬性的使用，使您能夠利用許多強大的設定。如果您不希望自動載入這些屬性，" +
   "您可以停用此功能，但您將需要手動從自動提示中移除任何不需要的屬性。" +
   "請注意，啟用該項需要重啟外掛，因為屬性是在啟動時載入的。",
  FONTS_HEAD: "字型",
  FONTS_DESC: "配置供 Excalidraw 使用的本地字型。",
  CUSTOM_FONT_HEAD: "本地字型",
  ENABLE_FOURTH_FONT_NAME: "為文字元素啟用本地字型",
  ENABLE_FOURTH_FONT_DESC:
    "啟用該項將在文字元素的屬性面板的字型列表中新增一個本地字型。" +
    "請注意，使用這個本地字型可能會破壞平臺的獨立性。" +
    "使用自定義字型的檔案在不同倉庫中開啟或在以後開啟時，根據字型設定，可能會以不同的方式呈現。" +
    "此外，在 Excalidraw.com 或其他 Excalidraw 版本中，預設的本地字型字型將使用系統字型。",
  FOURTH_FONT_NAME: "本地字型檔案",
  FOURTH_FONT_DESC:
    "從倉庫中選擇一個 .otf/.ttf/.woff/.woff2 字型檔案作為本地字型使用。" +
    "Excalidraw 預設使用 Virgil 字型。" +
    "為了獲得最佳效能，建議使用 .woff2 檔案，因為當匯出 SVG 格式的圖片時，Excalidraw 只會編碼必要的字形。" +
    "其他字型格式將在匯出檔案中嵌入整個字型，可能會導致檔案大小顯著增加。<b>譯者注：</b>可在 <a href='https://wangchujiang.com/free-font/' target='_blank'>Free Font</a> 獲取免費商用中文手寫字型。",
  OFFLINE_CJK_NAME: "離線 CJK 字型支援",
  OFFLINE_CJK_DESC:
    `<strong>該項需要重啟 Obsidian 才能生效。</strong><br>
    Excalidraw.com 提供手寫風格的 CJK 字型。預設情況下，這些字型不會包含在外掛本地，而是從網際網路獲取。
    如果您希望 Excalidraw 完全本地化，以便在沒有網際網路連線的情況下使用，可以從 <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip" target="_blank">GitHub 下載所需的字型檔案</a>。
    下載後，將內容解壓到您的倉庫中的一個資料夾內。<br>
    預載入字型會影響啟動效能。因此，您可以選擇載入哪些字型。`,
  CJK_ASSETS_FOLDER_NAME: "CJK 字型資料夾（區分大小寫！）",
  CJK_ASSETS_FOLDER_DESC: `您可以在此設定 CJK 字型資料夾的位置。例如：<code>Excalidraw/CJK Fonts</code>。<br>
    <strong>重要：</strong> 請勿將此資料夾設定為倉庫根目錄！請勿在此資料夾中放置其他字型。<br>
    <strong>注意：</strong> 如果您使用 Obsidian Sync 並希望在裝置之間同步這些字型檔案，請確保 Obsidian Sync 設定為同步“所有其他檔案型別”。`,
  LOAD_CHINESE_FONTS_NAME: "啟動時從檔案載入中文字型",
  LOAD_JAPANESE_FONTS_NAME: "啟動時從檔案載入日文字型",
  LOAD_KOREAN_FONTS_NAME: "啟動時從檔案載入韓文字型",
  SCRIPT_SETTINGS_HEAD: "已安裝指令碼的設定",
  SCRIPT_SETTINGS_DESC: "有些 Excalidraw 自動化指令碼包含設定項，當執行這些指令碼時，它們會在該列表下新增設定項。",
  TASKBONE_HEAD: "Taskbone OCR（光學符號識別）",
  TASKBONE_DESC: "這是一個將 OCR 融入 Excalidraw 的實驗性功能。請注意，Taskbone 是一項獨立的外部服務，而不是由 Excalidraw 或 obsidian-excalidraw-plugin 專案提供的。" +
    "OCR 能夠對繪圖上用自由畫筆工具寫下的塗鴉或者嵌入的影像進行文字識別，並將識別出來的文字寫入繪圖檔案的 frontmatter，同時複製到剪貼簿。" +
    "之所以要寫入 frontmatter 是為了便於您在 Obsidian 中能夠搜尋到這些文字。" +
    "注意，識別的過程不是在本地進行的，而是透過線上 API，影像會被上傳到 taskbone 的伺服器（僅用於識別目的）。如果您介意，請不要使用這個功能。",
  TASKBONE_ENABLE_NAME: "啟用 Taskbone",
  TASKBONE_ENABLE_DESC: "啟用意味著您同意 Taskbone <a href='https://www.taskbone.com/legal/terms/' target='_blank'>條款及細則</a> 以及 " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>隱私政策</a>。",
  TASKBONE_APIKEY_NAME: "Taskbone API Key",
  TASKBONE_APIKEY_DESC: "Taskbone 的免費 API key 提供了一定數量的每月識別次數。如果您非常頻繁地使用此功能，或者想要支援 " +
    "Taskbone 的開發者（您懂的，沒有人能用愛發電，Taskbone 開發者也需要投入資金來維持這項 OCR 服務），您可以" +
    "到 <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a> 購買一個商用 API key。購買後請將它填寫到旁邊這個文字框裡，替換掉原本自動生成的免費 API key。",

  //HotkeyEditor
  HOTKEY_PRESS_COMBO_NANE: "按下您的組合鍵",
  HOTKEY_PRESS_COMBO_DESC: "請按下所需的組合鍵",
  HOTKEY_BUTTON_ADD_OVERRIDE: "新增新的熱鍵覆蓋",
  HOTKEY_BUTTON_REMOVE: "移除",

  //openDrawings.ts
  SELECT_FILE: "選擇一個檔案後按回車",
  SELECT_COMMAND: "選擇一個命令後按回車",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `選擇一個檔案後按回車，或者 ${labelSHIFT()}+${labelMETA()}+Enter 以 100% 尺寸嵌入。`,
  NO_MATCH: "查詢不到匹配的檔案",
  NO_MATCHING_COMMAND: "查詢不到匹配的命令",
  SELECT_FILE_TO_LINK: "選擇要以連結形式插入到當前繪圖中的檔案",
  SELECT_COMMAND_PLACEHOLDER: "選擇要插入到當前繪圖中的命令",
  SELECT_DRAWING: "選擇要以影像形式嵌入到當前繪圖中的圖片或繪圖檔案",
  TYPE_FILENAME: "輸入要選擇的繪圖名稱",
  SELECT_FILE_OR_TYPE_NEW:
    "選擇已有繪圖，或者輸入新繪圖檔案的名稱，然後按回車。",
  SELECT_TO_EMBED: "選擇要嵌入到當前 Markdown 文件中的繪圖",
  SELECT_MD: "選擇要以影像形式嵌入到當前繪圖中的 Markdown 文件",
  SELECT_PDF: "選擇要以影像形式嵌入到當前繪圖中的 PDF",
  PDF_PAGES_HEADER: "頁碼範圍",
  PDF_PAGES_DESC: "示例：1, 3-5, 7, 9-11",

  //SelectCard.ts
  TYPE_SECTION: "輸入章節標題進行選擇",
  SELECT_SECTION_OR_TYPE_NEW:
    "選擇現有章節標題或輸入新的章節標題，然後按 Enter。",
  INVALID_SECTION_NAME: "無效的章節標題",
  EMPTY_SECTION_MESSAGE: "輸入章節標題以建立",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "EXCALIDRAW 警告\n停止載入嵌入的影像，因為此檔案中存在死迴圈：\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "指令碼執行錯誤。請在開發者控制檯中檢視錯誤資訊。",

  //ExcalidrawViewUtils.ts
  MARKER_FRAME_RENDERING_DISABLED_NOTICE: "場景中有隱藏的標記畫框。",
  //DRAWING_HAS_BACK_OF_THE_CARD: "There are notes on the back of this drawing.",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "Excalidraw 檔案已損壞。嘗試從備份檔案中載入。",
  FONT_LOAD_SLOW: "正在載入字型…\n\n這比預期花費的時間更長。如果這種延遲經常發生，您可以將字型下載到您的倉庫中。\n\n" +
    "(點選=忽略提示，右鍵=更多資訊)",
  FONT_INFO_TITLE: "從網際網路載入 v2.5.3 字型",
  FONT_INFO_DETAILED: `
      <p>
        為了提高 Obsidian 的啟動時間並管理大型 <strong>CJK 字體系列</strong>，
        我已將 CJK 字型移出外掛的 <code>main.js</code>。預設情況下，CJK 字型將從網際網路載入。
        這通常不會造成問題，因為 Obsidian 在首次使用後會快取這些檔案。
      </p>
      <p>
        如果您希望 Obsidian 完全離線或遇到效能問題，可以下載字型資源。
      </p>
      <h3>說明：</h3>
      <ol>
        <li>從 <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip">GitHub</a> 下載字型。</li>
        <li>解壓並將檔案複製到倉庫資料夾中（預設：<code>Excalidraw/${CJK_FONTS}</code>; 資料夾名稱區分大小寫！）。</li>
        <li><mark>請勿</mark>將此資料夾設定為倉庫根目錄或與其他本地字型混合。</li>
      </ol>
      <h3>對於 Obsidian Sync 使用者：</h3>
      <p>
        確保 Obsidian Sync 設定為同步“所有其他檔案型別”，或者在所有裝置上下載並解壓檔案。
      </p>
      <h3>注意：</h3>
      <p>
        如果您覺得這個過程繁瑣，請向 Obsidian.md 提交功能請求，以支援外掛資料夾中的資源。
        目前，僅支援（同步）單個 <code>main.js</code>，這導致大型檔案和複雜外掛（如 Excalidraw）啟動時間較慢。
        對此帶來的不便，我深表歉意。
      </p>
    `,

  //ObsidianMenu.tsx
  GOTO_FULLSCREEN: "進入全屏模式",
  EXIT_FULLSCREEN: "退出全屏模式",
  TOGGLE_FULLSCREEN: "切換全屏模式",
  TOGGLE_DISABLEBINDING: "開啟或關閉繫結",
  TOGGLE_FRAME_RENDERING: "開啟或關閉畫框渲染",
  TOGGLE_FRAME_CLIPPING: "開啟或關閉畫框裁切",
  OPEN_LINK_CLICK: "開啟所選元素裡的連結",
  OPEN_LINK_PROPS: "開啟影像連結或 LaTeX 公式編輯器",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "縮放至標題",
  PIN_VIEW: "鎖定檢視",
  DO_NOT_PIN_VIEW: "解鎖檢視",
  NARROW_TO_BLOCK: "縮放至塊",
  SHOW_ENTIRE_FILE: "顯示全部",
  SELECT_SECTION: "從文件選擇章節",
  SELECT_VIEW: "從 base 選擇檢視",
  ZOOM_TO_FIT: "縮放至合適大小",
  RELOAD: "過載連結",
  OPEN_IN_BROWSER: "在瀏覽器中開啟",
  PROPERTIES: "屬性",
  COPYCODE: "複製原始檔",

  //EmbeddableSettings.tsx
  ES_TITLE: "Embeddable 元素設定",
  ES_RENAME: "重新命名",
  ES_ZOOM: "縮放",
  ES_YOUTUBE_START: "YouTube 起始時間",
  ES_YOUTUBE_START_DESC: "ss, mm:ss, hh:mm:ss",
  ES_YOUTUBE_START_INVALID: "YouTube 起始時間無效。請檢查格式並重試",
  ES_FILENAME_VISIBLE: "顯示頁內標題",
  ES_BACKGROUND_HEAD: "背景色",
  ES_BACKGROUND_DESC_INFO: "點選此處檢視更多顏色資訊",
  ES_BACKGROUND_DESC_DETAIL: "背景色僅影響預覽模式的 MD-Embeddable。在編輯模式，它會根據場景（透過筆記屬性設定）或外掛設定，遵循 Obsidian 的深色/淺色主題。背景色有兩層：元素背景色（下層顏色）和上層顏色。選擇“匹配元素”表示兩層都遵循元素背景色。選擇“匹配繪圖”或特定背景色不會改變元素背景色。設定不透明度（如 50%）會將繪圖或所選顏色與元素背景色混合。要移除元素背景色，可以在 Excalidraw 的元素屬性編輯器中將元素背景色設定為透明，這樣只有上層顏色生效。",
  ES_BACKGROUND_MATCH_ELEMENT: "匹配元素背景色",
  ES_BACKGROUND_MATCH_CANVAS: "匹配繪圖背景色",
  ES_BACKGROUND_COLOR: "背景色",
  ES_BORDER_HEAD: "邊框顏色",
  ES_BORDER_COLOR: "邊框顏色",
  ES_BORDER_MATCH_ELEMENT: "匹配元素邊框顏色",
  ES_BACKGROUND_OPACITY: "背景不透明度",
  ES_BORDER_OPACITY: "邊框不透明度",
  ES_EMBEDDABLE_SETTINGS: "MD-Embeddable 設定",
  ES_USE_OBSIDIAN_DEFAULTS: "使用 Obsidian 預設設定",
  ES_ZOOM_100_RELATIVE_DESC: "使元素的縮放級別等於當前繪圖的縮放級別",
  ES_ZOOM_100: "Relative 100%",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "檔案不存在。要建立嗎？",
  PROMPT_ERROR_NO_FILENAME: "錯誤：檔名不能為空",
  PROMPT_ERROR_DRAWING_CLOSED: "未知錯誤。繪圖檔案可能已關閉或丟失",
  PROMPT_TITLE_NEW_FILE: "新建檔案",
  PROMPT_TITLE_CONFIRMATION: "確認",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "建立 Excalidraw 繪圖",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA: "建立 Excalidraw 繪圖並在新標籤頁中開啟",
  PROMPT_BUTTON_CREATE_MARKDOWN: "建立 Markdown 文件",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA: "建立 Markdown 文件並在新標籤頁中開啟",
  PROMPT_BUTTON_EMBED_MARKDOWN: "嵌入",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA: "將所選元素替換為 MD-Embeddable",
  PROMPT_BUTTON_NEVERMIND: "算了",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "取消",
  PROMPT_BUTTON_INSERT_LINE: "插入一行",
  PROMPT_BUTTON_INSERT_SPACE: "插入空格",
  PROMPT_BUTTON_INSERT_LINK: "插入內部連結",
  PROMPT_BUTTON_UPPERCASE: "大寫",
  PROMPT_BUTTON_SPECIAL_CHARS: "特殊字元",
  PROMPT_SELECT_TEMPLATE: "選擇一個模板",

  //ModifierKeySettings
  WEB_BROWSER_DRAG_ACTION: "從瀏覽器拖入時",
  LOCAL_FILE_DRAG_ACTION: "從本地檔案系統拖入時",
  INTERNAL_DRAG_ACTION: "在 Obsidian 內部拖動時",
  PANE_TARGET: "點選連結時",
  DEFAULT_ACTION_DESC: "無修飾鍵時的行為：",

  //FrameSettings.ts
  FRAME_SETTINGS_TITLE: "畫框設定",
  FRAME_SETTINGS_ENABLE: "啟用畫框",
  FRAME_SETTIGNS_NAME: "顯示畫框名稱",
  FRAME_SETTINGS_OUTLINE: "顯示畫框邊框",
  FRAME_SETTINGS_CLIP: "啟用畫框裁切",

  //InsertPDFModal.ts
  IPM_PAGES_TO_IMPORT_NAME: "要匯入的頁面",
  IPM_SELECT_PAGES_TO_IMPORT: "請選擇頁面以進行匯入",
  IPM_ADD_BORDER_BOX_NAME: "新增帶邊框的盒子容器",
  IPM_ADD_FRAME_NAME: "新增頁面到畫框",
  IPM_ADD_FRAME_DESC: "為了更方便的操作，我建議將頁面鎖定在畫框內。" +
    "但是，如果您確實將頁面鎖定在畫框內，則唯一的解鎖方法是右鍵點選畫框，選擇“從畫框中移除元素”，然後解鎖頁面。",
  IPM_GROUP_PAGES_NAME: "編組頁面",
  IPM_GROUP_PAGES_DESC: "這將把所有頁面編為一個組。如果您在匯入後鎖定頁面，建議使用此方法，因為這樣可以更方便地解鎖整個組，而不是逐個解鎖。",
  IPM_SELECT_PDF: "請選擇一個 PDF",

  //Utils.ts
  UPDATE_AVAILABLE: `Excalidraw 的新版本已在社群外掛中可用。\n\n您正在使用 ${PLUGIN_VERSION}。\n最新版本是`,
  SCRIPT_UPDATES_AVAILABLE: `指令碼更新可用 - 請檢查指令碼儲存。\n\n${DEVICE.isDesktop ? `此訊息可在控制檯日誌中檢視 (${DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"})\n\n` : ""}如果您已將指令碼組織到指令碼儲存資料夾下的子資料夾中，並且存在同一指令碼的多個副本，可能需要清理未使用的版本以消除此警報。對於無需更新的私人指令碼副本，請將它們儲存在指令碼儲存資料夾之外。`,
  ERROR_PNG_TOO_LARGE: "匯出 PNG 時出錯 - PNG 檔案過大，請嘗試較小的解析度",

  //modifierkeyHelper.ts
  // WebBrowserDragAction
  WEB_DRAG_IMPORT_IMAGE: "匯入圖片到倉庫",
  WEB_DRAG_IMAGE_URL: "透過 URL 嵌入圖片或 YouTube 縮圖",
  WEB_DRAG_LINK: "連結形式插入",
  WEB_DRAG_EMBEDDABLE: "互動形式嵌入",

  // LocalFileDragAction
  LOCAL_DRAG_IMPORT: "匯入檔案到倉庫，或在路徑來自倉庫時複用現有檔案",
  LOCAL_DRAG_IMAGE: "影像形式嵌入：使用本地 URI，或在路徑來自倉庫時使用內部連結",
  LOCAL_DRAG_LINK: "連結形式插入：使用本地 URI，或在路徑來自倉庫時使用內部連結",
  LOCAL_DRAG_EMBEDDABLE: "互動形式嵌入：使用本地 URI，或在路徑來自倉庫時使用內部連結",

  // InternalDragAction
  INTERNAL_DRAG_IMAGE: "影像形式嵌入",
  INTERNAL_DRAG_IMAGE_FULL: "影像形式嵌入（100% 尺寸）",
  INTERNAL_DRAG_LINK: "連結形式插入",
  INTERNAL_DRAG_EMBEDDABLE: "互動形式嵌入",

  // LinkClickAction
  LINK_CLICK_ACTIVE: "在當前活動視窗中開啟",
  LINK_CLICK_NEW_PANE: "在相鄰的新視窗中開啟",
  LINK_CLICK_POPOUT: "在彈出視窗中開啟",
  LINK_CLICK_NEW_TAB: "在新標籤頁中開啟",
  LINK_CLICK_MD_PROPS: "顯示 Markdown 圖片屬性對話方塊（僅在以影像形式嵌入 Markdown 文件時適用）",

  //ExportDialog
  // Dialog and tabs
  EXPORTDIALOG_TITLE: "匯出為",
  EXPORTDIALOG_TAB_IMAGE: "圖片",
  EXPORTDIALOG_TAB_PDF: "PDF",
  // Settings persistence
  EXPORTDIALOG_SAVE_SETTINGS: "將圖片設定儲存到檔案 doc.properties 嗎？",
  EXPORTDIALOG_SAVE_SETTINGS_SAVE: "儲存為預設",
  EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "僅本次使用",
  // Image settings
  EXPORTDIALOG_IMAGE_SETTINGS: "圖片",
  EXPORTDIALOG_IMAGE_DESC: "PNG 支援透明。外部檔案可以包含 Excalidraw 場景資料。",
  EXPORTDIALOG_PADDING: "邊距",
  EXPORTDIALOG_SCALE: "縮放",
  EXPORTDIALOG_CURRENT_PADDING: "當前邊距：",
  EXPORTDIALOG_SIZE_DESC: "縮放會影響輸出大小",
  EXPORTDIALOG_SCALE_VALUE: "縮放：",
  EXPORTDIALOG_IMAGE_SIZE: "大小：",
  // Theme and background
  EXPORTDIALOG_EXPORT_THEME: "主題",
  EXPORTDIALOG_THEME_LIGHT: "淺色",
  EXPORTDIALOG_THEME_DARK: "深色",
  EXPORTDIALOG_BACKGROUND: "背景",
  EXPORTDIALOG_BACKGROUND_TRANSPARENT: "透明",
  EXPORTDIALOG_BACKGROUND_USE_COLOR: "使用場景顏色",
  EXPORTDIALOG_INCLUDE_INTERNAL_LINKS: "匯出內部連結為 SVG/PDF？",
  // Selection
  EXPORTDIALOG_SELECTED_ELEMENTS: "匯出",
  EXPORTDIALOG_SELECTED_ALL: "整個場景",
  EXPORTDIALOG_SELECTED_SELECTED: "僅選中部分",
  // Export options
  EXPORTDIALOG_EMBED_SCENE: "包含場景資料嗎？",
  EXPORTDIALOG_EMBED_YES: "是",
  EXPORTDIALOG_EMBED_NO: "否",
  // PDF settings
  EXPORTDIALOG_PDF_SETTINGS: "PDF",
  EXPORTDIALOG_PAGE_SIZE: "頁面大小",
  EXPORTDIALOG_PAGE_ORIENTATION: "方向",
  EXPORTDIALOG_ORIENTATION_PORTRAIT: "縱向",
  EXPORTDIALOG_ORIENTATION_LANDSCAPE: "橫向",
  EXPORTDIALOG_PDF_FIT_TO_PAGE: "頁面適配",
  EXPORTDIALOG_PDF_FIT_OPTION: "適配頁面",
  EXPORTDIALOG_PDF_FIT_2_OPTION: "適配至最多 2 頁",
  EXPORTDIALOG_PDF_FIT_4_OPTION: "適配至最多 4 頁",
  EXPORTDIALOG_PDF_FIT_6_OPTION: "適配至最多 6 頁",
  EXPORTDIALOG_PDF_FIT_8_OPTION: "適配至最多 8 頁",
  EXPORTDIALOG_PDF_FIT_12_OPTION: "適配至最多 12 頁",
  EXPORTDIALOG_PDF_FIT_16_OPTION: "適配至最多 16 頁",
  EXPORTDIALOG_PDF_SCALE_OPTION: "使用圖片縮放（可能跨多頁）",
  EXPORTDIALOG_PDF_PAPER_COLOR: "紙張顏色",
  EXPORTDIALOG_PDF_PAPER_WHITE: "白色",
  EXPORTDIALOG_PDF_PAPER_SCENE: "使用場景顏色",
  EXPORTDIALOG_PDF_PAPER_CUSTOM: "自定義顏色",
  EXPORTDIALOG_PDF_ALIGNMENT: "頁面位置",
  EXPORTDIALOG_PDF_ALIGN_CENTER: "居中",
  EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "左對齊居中",
  EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "右對齊居中",
  EXPORTDIALOG_PDF_ALIGN_TOP_LEFT: "左上角",
  EXPORTDIALOG_PDF_ALIGN_TOP_CENTER: "頂部居中",
  EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT: "右上角",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT: "左下角",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER: "底部居中",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT: "右下角",
  EXPORTDIALOG_PDF_MARGIN: "邊距",
  EXPORTDIALOG_PDF_MARGIN_NONE: "無",
  EXPORTDIALOG_PDF_MARGIN_TINY: "小",
  EXPORTDIALOG_PDF_MARGIN_NORMAL: "正常",
  EXPORTDIALOG_SAVE_PDF_SETTINGS: "儲存 PDF 設定",
  EXPORTDIALOG_SAVE_CONFIRMATION: "PDF 配置已儲存為外掛預設設定",
  // Buttons
  EXPORTDIALOG_PNGTOFILE : "匯出 PNG",
  EXPORTDIALOG_SVGTOFILE : "匯出 SVG",
  EXPORTDIALOG_PNGTOVAULT : "PNG 儲存到倉庫",
  EXPORTDIALOG_SVGTOVAULT : "SVG 儲存到倉庫",
  EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
  EXPORTDIALOG_PNGTOCLIPBOARD : "PNG 複製到剪貼簿",
  EXPORTDIALOG_SVGTOCLIPBOARD : "SVG 複製到剪貼簿",
  EXPORTDIALOG_PDF: "匯出 PDF",

  EXPORTDIALOG_PDF_PROGRESS_NOTICE: "正在匯出 PDF。如果影像較大，可能需要一些時間。",
  EXPORTDIALOG_PDF_PROGRESS_DONE: "匯出完成",
  EXPORTDIALOG_PDF_PROGRESS_ERROR: "匯出 PDF 時出錯，請檢查開發者控制檯以獲取詳細資訊",

  // Screenshot tab
  EXPORTDIALOG_NOT_AVAILALBE: "抱歉，此功能僅在繪圖在主 Obsidian 工作區開啟時可用。",
  EXPORTDIALOG_TAB_SCREENSHOT: "截圖",
  EXPORTDIALOG_SCREENSHOT_DESC: "截圖將包含可嵌入的內容，如 Markdown 頁面、YouTube、網站等。它們僅在桌面端可用，無法自動匯出，並且僅支援 PNG 格式。",
  SCREENSHOT_DESKTOP_ONLY: "截圖功能僅在桌面端可用",
  SCREENSHOT_FILE_SUCCESS: "截圖已儲存到倉庫",
  SCREENSHOT_CLIPBOARD_SUCCESS: "截圖已複製到剪貼簿",
  SCREENSHOT_CLIPBOARD_ERROR: "無法複製截圖到剪貼簿：",
  SCREENSHOT_ERROR: "截圖出錯 - 請檢視控制檯日誌",

  //exportUtils.ts
  PDF_EXPORT_DESKTOP_ONLY: "PDF 匯出功能僅限桌面端使用",

  //UniversalInsertFileModal.ts
  UIFM_TITLE: "從倉庫中嵌入檔案",
  UIFM_SECTION_HEAD: "選擇章節標題",
  UIFM_ANCHOR: "錨定為原始大小的 100%",
  UIFM_ANCHOR_DESC: "這是一個專業功能，請在瞭解其作用的情況下再使用。啟用後，即使你在 Excalidraw 中調整了匯入影像的大小，下次開啟繪圖時，該影像仍會恢復為原始大小的 100%。當你將一個獨立的 Excalidraw 點子嵌入到另一份筆記中，並希望保持文字和圖示的相對尺寸時，這會很有用。",
  UIFM_BTN_EMBEDDABLE: "以互動形式",
  UIFM_BTN_PDF: "PDF 頁面",
  UIFM_BTN_IMAGE: "以影像形式",

  //ReleaseNotes.ts
  RN_WELCOME: "歡迎使用 Excalidraw",

  //Excalidraw component
  COMP_IMG: "圖片 & 檔案",
  COMP_IMG_FROM_SYSTEM: "從系統匯入",
  COMP_IMG_ANY_FILE: "倉庫中任意檔案",
  COMP_IMG_LaTeX: "LaTeX 公式",
  COMP_FRAME: "畫框操作",
  COMP_FRAME_HINT: "切換標記畫框。標記畫框僅用於引導，用於定義幻燈片/列印區域/[[file#^frame=id]]，" +
    "匯出時會隱藏；也不會包含元素。透過上下文選單顯示/隱藏標記畫框。",

  //CustomEmbeddable.tsx
  NOTICE_PDF_THEME: "已覆蓋 PDF 主題。\n" +
    "透過檔案的 'excalidraw-embeddable-theme' 筆記屬性設定（將覆蓋外掛設定）。\n\n" +
    "值：dark/light/auto/default，表示深色、淺色、跟隨 Excalidraw 或 Obsidian 主題。",

  //EmbeddableActionsMenu.tsx
  BOOKMARK_PAGE: "儲存當前進度",
  CAPTURE_PAGE: "以影像形式擷取當前頁面",

  //VersionMismatch.ts
  //WARNING: Do not change the {VAL_RECORDED} and {VAL_ACTUAL} strings, they are replaced by the actual version values at runtime!
  VERSION_MISMATCH_NOTICE: `Obsidian 顯示的版本是 <b>{VAL_RECORDED}</b>，但已安裝的 Excalidraw 程式碼顯示的版本是 <b>{VAL_ACTUAL}</b>。`,

  VERSION_MISMATCH_HEADING: "Excalidraw 版本不匹配",
  VERSION_MISMATCH_CAUSE: "通常源於同步不完整，大檔案未能同步（如使用 Obsidian Sync Standard，main.js > 5MB），只更新了 <code>manifest.json</code>。",
  VERSION_MISMATCH_OPTIONS: "選項：<br><b>1.</b> 重新下載外掛（推薦）。<br><b>2.</b> 暫時忽略。",
  VERSION_MISMATCH_NOTE: "注意：手動更新版本資訊可能會影響依賴 manifest.json 的工具（如 Plugin Update Tracker、BRAT），直到你完全重灌外掛。",
  VERSION_MISMATCH_DISABLE_NAME: "停用版本不匹配警告",
  VERSION_MISMATCH_DISABLE_DESC: "可在以下位置重新啟用：設定 → Excalidraw → 基本 → 警告外掛更新不完整",
  VERSION_MISMATCH_REDOWNLOAD: "重新下載外掛",
  VERSION_MISMATCH_IGNORE: "忽略",

  //InlineLinkSuggester.ts
  INLINE_HINT: "輸入 [[ 以搜尋並插入連結",

  //SuggestionModal.ts
  SUGGESTION_NOMATCH: "未找到匹配結果",
};
