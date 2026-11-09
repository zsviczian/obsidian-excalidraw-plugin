/*

Style Preset Manager

Extract styles from selected elements then save with names and groups, and apply them to other elements with one click.

Features:
- Select elements → save as style (with name + group)
- Click a style → apply to currently selected elements (multi-select supported)
- Update existing styles / rename / delete
- Style library persisted to a JSON file (styles.json in the same folder as the script)

Supports "container + text" bound structure: handles stroke color and text color separately.
Requires Excalidraw plugin 2.19.1 or higher (side panel API).

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

// ============================================================
// 版本检查（侧边面板 API 需 2.19.0+）
// ============================================================
if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.1")) {
  new Notice("请更新 Excalidraw 插件至 2.19.1 或更高版本");
  return;
}

// ============================================================
// 常量定义
// ============================================================
// 动态获取脚本所在目录：scriptFolderPath + activeScript 去掉脚本名后的目录部分
// activeScript 形如 "Downloaded/样式预设管理器"（不含 .md）
const _excalidrawPlugin = app.plugins?.plugins?.["obsidian-excalidraw-plugin"];
const _excalidrawSettings = _excalidrawPlugin?.settings;
const _scriptFolderPath = _excalidrawSettings?.scriptFolderPath || "Excalidraw/Scripts";
const _activeScript = ea.activeScript || "";                     // 例："Downloaded/样式预设管理器"
const _scriptDir = _activeScript.includes("/")
  ? _scriptFolderPath + "/" + _activeScript.substring(0, _activeScript.lastIndexOf("/"))
  : _scriptFolderPath;
const STYLE_FILE = _scriptDir + "/styles.json";                 // 样式库 JSON 路径（与脚本同目录）
const adapter = app.vault.adapter;                               // Obsidian Vault Adapter

// ============================================================
// StyleStore 模块 — 样式库的 CRUD 与 JSON 持久化
// ============================================================

// 读取样式库（文件不存在则返回空结构）
async function loadStore() {
  if (await adapter.exists(STYLE_FILE)) {
    try {
      const text = await adapter.read(STYLE_FILE);
      return JSON.parse(text);
    } catch (e) {
      new Notice("样式库解析失败，已重置为空");
      return { version: 1, groups: [], styles: [] };
    }
  }
  return { version: 1, groups: [], styles: [] };
}

// 写入样式库（首次写入即自动创建文件，自动创建不存在的目录）
async function saveStore(store) {
  // 确保目标目录存在（adapter.write 不会自动创建目录）
  const dir = STYLE_FILE.substring(0, STYLE_FILE.lastIndexOf("/"));
  const dirs = dir.split("/");
  let cur = "";
  for (const d of dirs) {
    cur = cur ? cur + "/" + d : d;
    if (!(await adapter.exists(cur))) {
      await adapter.mkdir(cur);
    }
  }
  await adapter.write(STYLE_FILE, JSON.stringify(store, null, 2));
}

// 生成唯一 ID（前缀 + 时间戳 + 随机串）
function genId(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 根据 groupId 获取分组名（找不到则返回"未分组"）
function getGroupName(groups, groupId) {
  if (!groupId) return "未分组";
  const g = groups.find(g => g.id === groupId);
  return g ? g.name : "未分组";
}

// ============================================================
// ElementStyleExtractor 模块 — 从选中元素抽取样式属性
// 处理"容器+文本"绑定结构：分别从容器抽取形状属性、从文本抽取文字属性
// ============================================================

function extractStyle(elements, ea) {
  // 初始化 props，所有字段默认 null（表示该维度不适用）
  const props = {
    strokeColor: null, backgroundColor: null, strokeWidth: null,
    strokeStyle: null, roughness: null, roundness: null,
    textColor: null, textAlign: null, verticalAlign: null
  };

  // 分类选中元素：容器（带绑定文本）/ 独立形状 / 文本
  const containers = elements.filter(el => el.boundElements && el.boundElements.some(b => b.type === "text"));
  const standaloneShapes = elements.filter(el =>
    el.type !== "text" && !el.containerId && !(el.boundElements && el.boundElements.some(b => b.type === "text"))
  );
  const texts = elements.filter(el => el.type === "text");

  // 情况一：容器+文本绑定结构 → 分别从两者抽取
  if (containers.length > 0) {
    const c = containers[0];                      // 取第一个容器
    fillShapeProps(props, c);                      // 从容器抽取形状属性
    const textId = c.boundElements.find(b => b.type === "text").id;
    const textEl = ea.getViewElements().find(e => e.id === textId);
    if (textEl) fillTextProps(props, textEl);      // 从文本抽取文字属性
    return props;
  }
  // 情况二：纯形状（无绑定文本）→ 只抽取形状属性
  if (standaloneShapes.length > 0) {
    fillShapeProps(props, standaloneShapes[0]);
    return props;                                  // textColor / textAlign 保持 null
  }
  // 情况三：纯文本（无容器）→ 只抽取文字属性
  if (texts.length > 0) {
    fillTextProps(props, texts[0]);
    return props;                                  // strokeColor 等形状属性保持 null
  }
  return props;
}

// 从形状/容器抽取属性
function fillShapeProps(props, el) {
  props.strokeColor     = el.strokeColor;
  props.backgroundColor = el.backgroundColor;
  props.strokeWidth     = el.strokeWidth;
  props.strokeStyle     = el.strokeStyle;
  props.roughness       = el.roughness;
  props.roundness       = el.roundness ? "round" : "sharp"; // 内部枚举，应用时再转 {type:3}/null
}

// 从文本元素抽取属性（关键：文本的 strokeColor = 文字颜色 → 存入 textColor）
function fillTextProps(props, el) {
  props.textColor      = el.strokeColor;           // 关键映射
  props.textAlign      = el.textAlign;
  props.verticalAlign  = el.verticalAlign;
}

// ============================================================
// StyleApplier 模块 — 将样式应用到选中元素
// ============================================================

// 扩展选中集：把绑定关系的"另一半"也加进来（选中容器时补上文本，反之亦然）
function expandSelection(elements, allViewElements) {
  const ids = new Set(elements.map(e => e.id));
  const expanded = [...elements];
  for (const el of elements) {
    // 容器 → 找绑定的文本
    if (el.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === "text" && !ids.has(b.id)) {
          const t = allViewElements.find(e => e.id === b.id);
          if (t) { expanded.push(t); ids.add(b.id); }
        }
      }
    }
    // 文本 → 找绑定的容器
    if (el.containerId && !ids.has(el.containerId)) {
      const c = allViewElements.find(e => e.id === el.containerId);
      if (c) { expanded.push(c); ids.add(c.id); }
    }
  }
  return expanded;
}

// 按元素类型应用样式（核心逻辑）
function applyStyleToElement(el, props) {
  const isText = el.type === "text";
  // 形状属性：仅应用到非文本元素；字段为 null 则跳过不覆盖
  if (!isText) {
    if (props.strokeColor     != null) el.strokeColor     = props.strokeColor;
    if (props.backgroundColor != null) el.backgroundColor = props.backgroundColor;
    if (props.strokeWidth     != null) el.strokeWidth     = props.strokeWidth;
    if (props.strokeStyle     != null) el.strokeStyle     = props.strokeStyle;
    if (props.roughness       != null) el.roughness       = props.roughness;
    if (props.roundness       != null) el.roundness       = props.roundness === "round" ? { type: 3 } : null;
  } else {
    // 文字属性：仅应用到文本元素；textColor 映射到文本的 strokeColor
    if (props.textColor      != null) el.strokeColor     = props.textColor;
    if (props.textAlign      != null) el.textAlign        = props.textAlign;
    if (props.verticalAlign  != null) el.verticalAlign    = props.verticalAlign;
  }
}

// 应用样式到当前选中元素（含扩展绑定元素）
async function applyStyle(styleId, ea) {
  const selected = ea.getViewSelectedElements();
  if (selected.length === 0) {
    new Notice("请先选中元素");
    return;
  }
  const store = await loadStore();
  const style = store.styles.find(s => s.id === styleId);
  if (!style) {
    new Notice("样式不存在");
    return;
  }
  const allView = ea.getViewElements();
  const expanded = expandSelection(selected, allView);
  // 构建选中元素 ID 集合（含扩展的绑定元素）
  const targetIds = new Set(expanded.map(e => e.id));

  // 获取场景所有元素，只修改选中的那些，保留其他元素不变
  // 参考 Invert colors 脚本：用完整元素数组调用 viewUpdateScene，避免丢失其他元素
  const api = ea.getExcalidrawAPI();
  const sceneElements = api.getSceneElements();
  const updatedElements = sceneElements.map(el => {
    if (targetIds.has(el.id)) {
      // 创建可变副本并应用样式（不修改原始元素）
      const clone = JSON.parse(JSON.stringify(el));
      applyStyleToElement(clone, style.props);
      // 递增版本号，生成新 nonce，让 Excalidraw 识别为更新
      clone.version = (el.version || 0) + 1;
      clone.versionNonce = Math.floor(Math.random() * 1000000000);
      clone.updated = Date.now();
      return clone;
    }
    return el;
  });

  // viewUpdateScene + storeAction:"capture"：立即捕获到 undo/redo 历史 + 触发保存
  ea.viewUpdateScene({
    elements: updatedElements,
    storeAction: "capture"
  });
  new Notice("已应用到 " + selected.length + " 个元素");
}

// ============================================================
// 命令操作 — 保存/更新/重命名/删除
// ============================================================

// 保存当前选中元素为样式
async function saveAsStyle(ea) {
  const selected = ea.getViewSelectedElements();
  if (selected.length === 0) {
    new Notice("请先选中元素");
    return;
  }
  const props = extractStyle(selected, ea);
  const name = await utils.inputPrompt("样式名称", "text", "");
  if (!name) return;                               // 用户取消

  const store = await loadStore();
  // 构造分组选项：现有分组 + 新建分组 + 不分组
  const groupLabels = store.groups.map(g => g.name);
  const groupItems = store.groups.slice();
  groupLabels.push("➕ 新建分组...");
  groupItems.push({ id: "__new__", name: "➕ 新建分组..." });
  groupLabels.push("（不分组）");
  groupItems.push({ id: null, name: "（不分组）" });

  const chosen = await utils.suggester(groupLabels, groupItems);
  if (!chosen) return;                             // 用户取消

  let groupId = null;
  if (chosen.id === "__new__") {
    const gname = await utils.inputPrompt("新分组名称", "text", "");
    if (!gname) return;
    groupId = genId("group");
    store.groups.push({ id: groupId, name: gname });
  } else {
    groupId = chosen.id;
  }

  const now = Date.now();
  const style = {
    id: genId("style"), name: name, groupId: groupId,
    createdAt: now, updatedAt: now, props: props
  };
  store.styles.push(style);
  await saveStore(store);
  new Notice("已保存样式：" + name);
}

// 用当前选中元素的样式覆盖已有样式
async function updateStyleCmd(ea) {
  const selected = ea.getViewSelectedElements();
  if (selected.length === 0) {
    new Notice("请先选中元素");
    return;
  }
  const store = await loadStore();
  if (store.styles.length === 0) {
    new Notice("暂无样式可更新");
    return;
  }
  const labels = store.styles.map(s => "[" + getGroupName(store.groups, s.groupId) + "] " + s.name);
  const chosen = await utils.suggester(labels, store.styles);
  if (!chosen) return;

  const props = extractStyle(selected, ea);
  chosen.props = props;
  chosen.updatedAt = Date.now();
  await saveStore(store);
  new Notice("已更新样式：" + chosen.name);
}

// 重命名样式
async function renameStyleCmd() {
  const store = await loadStore();
  if (store.styles.length === 0) {
    new Notice("暂无样式");
    return;
  }
  const labels = store.styles.map(s => "[" + getGroupName(store.groups, s.groupId) + "] " + s.name);
  const chosen = await utils.suggester(labels, store.styles);
  if (!chosen) return;

  const newName = await utils.inputPrompt("新名称", "text", chosen.name);
  if (!newName || newName === chosen.name) return;
  chosen.name = newName;
  await saveStore(store);
  new Notice("已重命名");
}

// 删除样式（含二次确认）
async function deleteStyleCmd() {
  const store = await loadStore();
  if (store.styles.length === 0) {
    new Notice("暂无样式");
    return;
  }
  const labels = store.styles.map(s => "[" + getGroupName(store.groups, s.groupId) + "] " + s.name);
  const chosen = await utils.suggester(labels, store.styles);
  if (!chosen) return;

  // 二次确认
  const ok = await utils.suggester(
    ["确认删除：" + chosen.name, "取消"],
    [true, false]
  );
  if (!ok) return;

  store.styles = store.styles.filter(s => s.id !== chosen.id);
  await saveStore(store);
  new Notice("已删除：" + chosen.name);
}

// ============================================================
// UI 模块 — Side panel 渲染
// ============================================================

// ============================================================
// 折叠状态管理（localStorage 持久化，跨会话保留）
// ============================================================
const COLLAPSE_KEY = "spm-collapsed-groups-v1";    // localStorage 存储 key

// 读取已折叠的 groupId 集合
function loadCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

// 保存折叠状态到 localStorage
function saveCollapsed(set) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]));
}

// 注入面板 CSS 样式
function injectStyles(panelEl) {
  const style = document.createElement("style");
  style.textContent = `
    .spm-panel { padding: 8px; font-size: 13px; }
    .spm-toolbar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .spm-toolbar button {
      padding: 4px 8px; font-size: 12px; cursor: pointer;
      background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
      border-radius: 4px; color: var(--text-normal);
    }
    .spm-toolbar button:hover { background: var(--background-modifier-hover); }
    .spm-search {
      width: 100%; box-sizing: border-box; padding: 6px 8px; margin-bottom: 8px;
      background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
      border-radius: 4px; color: var(--text-normal); font-size: 13px;
    }
    .spm-group { margin-bottom: 8px; }
    .spm-group-title {
      font-weight: 600; padding: 4px 0; color: var(--text-accent);
      border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 4px;
    }
    .spm-item {
      display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer;
      border-radius: 4px;
    }
    .spm-item:hover { background: var(--background-modifier-hover); }
    .spm-preview { display: inline-flex; align-items: center; gap: 4px; }
    .spm-swatch { display: inline-block; width: 18px; height: 18px; border-radius: 3px; }
    .spm-text-swatch { font-size: 14px; font-weight: 700; line-height: 1; }
    .spm-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .spm-empty { color: var(--text-muted); padding: 16px 8px; text-align: center; }
  `;
  panelEl.appendChild(style);
}

// 渲染面板骨架并绑定事件
function renderPanel(tab, ea) {
  const el = tab.contentEl;
  el.innerHTML = "";
  injectStyles(el);
  el.insertAdjacentHTML("beforeend", `
    <div class="spm-panel">
      <div class="spm-toolbar">
        <button class="spm-btn-save">💾 保存为样式</button>
        <button class="spm-btn-update">🔄 更新已有</button>
        <button class="spm-btn-rename">✏️ 重命名</button>
        <button class="spm-btn-delete">🗑️ 删除</button>
        <button class="spm-btn-refresh">↻ 刷新</button>
        <button class="spm-btn-collapse-all">⊡ 全部折叠</button>
        <button class="spm-btn-expand-all">⊞ 全部展开</button>
      </div>
      <input class="spm-search" type="text" placeholder="🔍 搜索样式..." />
      <div class="spm-list"></div>
    </div>
  `);

  // 工具栏按钮绑定（操作后刷新列表）
  el.querySelector(".spm-btn-save").onclick = async () => {
    try { await saveAsStyle(ea); await refreshList(el, ea, ""); }
    catch (e) { new Notice("操作失败：" + e.message); }
  };
  el.querySelector(".spm-btn-update").onclick = async () => {
    try { await updateStyleCmd(ea); await refreshList(el, ea, ""); }
    catch (e) { new Notice("操作失败：" + e.message); }
  };
  el.querySelector(".spm-btn-rename").onclick = async () => {
    try { await renameStyleCmd(); await refreshList(el, ea, ""); }
    catch (e) { new Notice("操作失败：" + e.message); }
  };
  el.querySelector(".spm-btn-delete").onclick = async () => {
    try { await deleteStyleCmd(); await refreshList(el, ea, ""); }
    catch (e) { new Notice("操作失败：" + e.message); }
  };
  el.querySelector(".spm-btn-refresh").onclick = async () => {
    await refreshList(el, ea, "");
  };
  // 全部折叠：把当前所有分组加入折叠集合（只折叠实际有显示样式的分组）
  el.querySelector(".spm-btn-collapse-all").onclick = async () => {
    const store = await loadStore();
    const allIds = [...store.groups.map(g => g.id), "__none__"];
    saveCollapsed(new Set(allIds));
    await refreshList(el, ea, searchInput.value);
  };
  // 全部展开：清空折叠集合
  el.querySelector(".spm-btn-expand-all").onclick = async () => {
    saveCollapsed(new Set());
    await refreshList(el, ea, searchInput.value);
  };

  // 搜索框输入过滤
  const searchInput = el.querySelector(".spm-search");
  searchInput.oninput = async () => {
    await refreshList(el, ea, searchInput.value);
  };

  // 初次渲染样式列表
  refreshList(el, ea, "");
}

// 渲染样式列表（按分组组织，支持过滤）
async function refreshList(panelEl, ea, filter) {
  const store = await loadStore();
  const listEl = panelEl.querySelector(".spm-list");
  listEl.innerHTML = "";

  // 按分组聚合样式
  const grouped = {};
  for (const s of store.styles) {
    const gid = s.groupId || "__none__";
    if (!grouped[gid]) grouped[gid] = [];
    grouped[gid].push(s);
  }

  // 过滤匹配函数
  const f = (filter || "").toLowerCase();
  const matchFilter = (s) => !f || s.name.toLowerCase().includes(f);

  // 按分组顺序渲染（已定义分组 + 未分组）
  const collapsed = loadCollapsed();                    // 读取折叠状态
  const groupIds = [...store.groups.map(g => g.id), "__none__"];
  for (const gid of groupIds) {
    const styles = (grouped[gid] || []).filter(matchFilter);
    if (styles.length === 0) continue;
    const gname = gid === "__none__" ? "未分组" : getGroupName(store.groups, gid);
    const isCollapsed = collapsed.has(gid);             // 当前分组是否折叠

    const groupDiv = document.createElement("div");
    groupDiv.className = "spm-group";
    const titleDiv = document.createElement("div");
    titleDiv.className = "spm-group-title";
    titleDiv.style.cursor = "pointer";                 // 标题可点击
    titleDiv.textContent = (isCollapsed ? "▶ " : "▼ ") + gname + " (" + styles.length + ")";
    groupDiv.appendChild(titleDiv);

    // 内容容器：折叠时隐藏
    const contentDiv = document.createElement("div");
    contentDiv.className = "spm-group-content";
    contentDiv.style.display = isCollapsed ? "none" : "";

    for (const s of styles) {
      const itemDiv = document.createElement("div");
      itemDiv.className = "spm-item";
      itemDiv.dataset.styleId = s.id;
      // 预览色块：背景色块（带边框色边框）+ 文字色 "A"
      const strokeColor = s.props.strokeColor || "#999";
      const bgColor = (s.props.backgroundColor && s.props.backgroundColor !== "transparent") ? s.props.backgroundColor : "transparent";
      const textColor = s.props.textColor || "#999";
      itemDiv.innerHTML = `
        <span class="spm-preview">
          <span class="spm-swatch" style="background:${bgColor};border:2px solid ${strokeColor};"></span>
          <span class="spm-text-swatch" style="color:${textColor};">A</span>
        </span>
        <span class="spm-name">${s.name}</span>
      `;
      // 点击样式项 → 应用到当前选中元素
      itemDiv.onclick = async () => {
        try { await applyStyle(s.id, ea); }
        catch (e) { new Notice("应用失败：" + e.message); }
      };
      contentDiv.appendChild(itemDiv);
    }
    // 点击标题切换折叠状态（仅更新 DOM，不重新渲染列表，性能更好）
    titleDiv.onclick = () => {
      const set = loadCollapsed();
      let nowExpanded;
      if (set.has(gid)) { set.delete(gid); nowExpanded = true; }
      else { set.add(gid); nowExpanded = false; }
      saveCollapsed(set);
      titleDiv.textContent = (nowExpanded ? "▼ " : "▶ ") + gname + " (" + styles.length + ")";
      contentDiv.style.display = nowExpanded ? "" : "none";
    };
    groupDiv.appendChild(contentDiv);
    listEl.appendChild(groupDiv);
  }

  // 空状态提示
  if (listEl.children.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "spm-empty";
    emptyDiv.textContent = f ? "无匹配样式" : "暂无样式，选中元素后点击「保存为样式」";
    listEl.appendChild(emptyDiv);
  }
}

// ============================================================
// 主入口 — 检查/创建侧边面板
// ============================================================

// 若已有同脚本的面板，则复用并切换到当前视图
const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.setView(ea.targetView);                // 重新绑定到当前视图
  }
  existingTab.open();                              // 显示已有面板
  return;
}

// 创建新面板（标题, persist=false, reveal=true）
const tab = await ea.createSidepanelTab("🎨 样式预设管理器", false, true);
if (!tab) {
  // 移动端可能返回 null，降级提示
  new Notice("当前环境不支持侧边面板");
  return;
}

// 视图切换回调：用户切换到另一个 Excalidraw 文件时重新绑定
tab.onFocus = (view) => {
  if (view !== ea.targetView) {
    ea.setView(view);
  }
};

// 渲染面板 UI
renderPanel(tab, ea);
new Notice("样式预设管理器已打开");
