/*
 * ExcaliMath: Advanced LaTeX and Graph Editor Sidepanel
 *
 * This script provides a rich Sidepanel UI featuring:
 * 1. Advanced LaTeX Editor (powered by Excalidraw-Extras MathJax and CodeMirror 6)
 * 2. Scientific Graphing Editor (plots Math formulas as native scalable Excalidraw lines with axes)
 * 3. Saved Templates Library for quick reuse
 * 4. Responsive Live Previews directly rendered as SVGs with scene-aware background (Light/Dark mode)
 * 5. Automatic detection of selected LaTeX images or Math Graph lines on the canvas to edit them
 ```js*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.25.3")) {
    new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
    return;
}

// ---------------------------------------------------------
// 1. Localization & Strings
// ---------------------------------------------------------
const LOCALE = (localStorage.getItem("language") || "en").toLowerCase();

const STRINGS = {
  en: {
    TAB_FORMULA: "Formula",
    TAB_GRAPH: "Graph",
    TAB_LIBRARY: "Library",
    FORMULA_INPUT_PLACEHOLDER: "Enter LaTeX formula here...\nExample: \\sum_{i=1}^n i = \\frac{n(n+1)}{2}",
    INSERT: "Insert",
    UPDATE: "Update Selected",
    SCALE: "Scale",
    GRAPH_TYPE: "Function Type",
    GRAPH_FORMULA: "f(x) =",
    GRAPH_POLY: "Coefficients (highest power first)",
    GRAPH_GAUSS: "Mean (μ) / StdDev (σ)",
    GRAPH_POISSON: "Lambda (λ)",
    DOMAIN: "Domain (Min / Max X)",
    SCALE_XY: "Pixel Scale (X / Y)",
    RESOLUTION: "Resolution",
    SHOW_AXES: "Show Axes",
    AXES_COLOR: "Axes Color",
    CLOSE_PLOT: "Close Plot (Connect ends)",
    STROKE_COLOR: "Stroke Color",
    STROKE_WIDTH: "Stroke Width",
    ROUGHNESS: "Roughness",
    ADD_TO_LIBRARY: "Save to Library",
    ERROR_MATHJAX: "Excalidraw-Extras (MathJax) is required to render LaTeX formulas. Please install and enable it.",
    INFO_LATEX_SUITE: "Install 'Obsidian LaTeX Suite' for faster formula entry.",
    LIBRARY_EMPTY: "Library is empty. Save formulas or graphs to see them here.",
    LOAD: "Load",
    INVALID_FORMULA: "Invalid formula. Cannot render preview.",
    PROMPT_NAME: "Name for this preset:",
    CUSTOM_FORMULA: "Custom f(x)",
    POLYNOMIAL: "Polynomial",
    GAUSSIAN: "Gaussian (Normal)",
    POISSON: "Poisson",
    PREVIEW_TITLE: "Live Preview",
    DELETE: "Delete"
  },
  zh: {
    TAB_FORMULA: "公式",
    TAB_GRAPH: "图表",
    TAB_LIBRARY: "库",
    FORMULA_INPUT_PLACEHOLDER: "在此输入LaTeX公式...\n例如: \\sum_{i=1}^n i = \\frac{n(n+1)}{2}",
    INSERT: "插入",
    UPDATE: "更新已选",
    SCALE: "缩放",
    GRAPH_TYPE: "函数类型",
    GRAPH_FORMULA: "f(x) =",
    GRAPH_POLY: "系数 (最高次幂在前)",
    GRAPH_GAUSS: "均值 (μ) / 标准差 (σ)",
    GRAPH_POISSON: "Lambda (λ)",
    DOMAIN: "定义域 (最小 / 最大 X)",
    SCALE_XY: "像素缩放 (X / Y)",
    RESOLUTION: "分辨率",
    SHOW_AXES: "显示坐标轴",
    AXES_COLOR: "坐标轴颜色",
    CLOSE_PLOT: "闭合图表 (连接首尾)",
    STROKE_COLOR: "线条颜色",
    STROKE_WIDTH: "线条粗细",
    ROUGHNESS: "粗糙度",
    ADD_TO_LIBRARY: "保存至库",
    ERROR_MATHJAX: "需要安装并启用 Excalidraw-Extras (MathJax) 插件才能渲染 LaTeX 公式。",
    INFO_LATEX_SUITE: "建议安装 'Obsidian LaTeX Suite' 以加快公式输入。",
    LIBRARY_EMPTY: "库为空。保存公式或图表后将在此显示。",
    LOAD: "加载",
    INVALID_FORMULA: "公式无效。无法渲染预览。",
    PROMPT_NAME: "为该预设命名：",
    CUSTOM_FORMULA: "自定义 f(x)",
    POLYNOMIAL: "多项式",
    GAUSSIAN: "高斯分布 (正态)",
    POISSON: "泊松分布",
    PREVIEW_TITLE: "实时预览",
    DELETE: "删除"
  }
};
const t = (key) => STRINGS[LOCALE]?.[key] ?? STRINGS.en[key] ?? key;

// ---------------------------------------------------------
// 2. Global State Management
// ---------------------------------------------------------
const GRAPH_DEFAULTS = {
  custom: { customFormula: "Math.sin(x) * x", xMin: -10, xMax: 10, xScale: 30, yScale: 30, resolution: 100, showAxes: true, axesColor: "#888888", closePlot: false, strokeColor: "#000000", strokeWidth: 2, roughness: 0 },
  polynomial: { polyCoeffs: "1, 0, -5", xMin: -4, xMax: 4, xScale: 50, yScale: 10, resolution: 100, showAxes: true, axesColor: "#888888", closePlot: false, strokeColor: "#000000", strokeWidth: 2, roughness: 0 },
  gaussian: { gaussMean: 0, gaussStdDev: 1, xMin: -4, xMax: 4, xScale: 80, yScale: 300, resolution: 100, showAxes: true, axesColor: "#888888", closePlot: false, strokeColor: "#000000", strokeWidth: 2, roughness: 0 },
  poisson: { poissonLambda: 4, xMin: 0, xMax: 12, xScale: 30, yScale: 300, resolution: 100, showAxes: true, axesColor: "#888888", closePlot: false, strokeColor: "#000000", strokeWidth: 2, roughness: 0 }
};

let state = {
  activeTab: "formula",
  editTargetId: null,
  formula: {
    text: "\\sum_{i=1}^n i = \\frac{n(n+1)}{2}",
    scale: 3
  },
  graph: {
    type: "custom",
  },
  graphParams: JSON.parse(JSON.stringify(GRAPH_DEFAULTS)),
  library: []
};

let globalContentEl = null;
let previewTimeout = null;

const hasMathJax = !!app.plugins.plugins["excalidraw-extras"]?.api.features.isActive("mathjax");
const hasLatexSuite = !!app.plugins.plugins["obsidian-latex-suite"];

// Fetch CodeMirror 6 constructors dynamically by instantiating a temporary Markdown view
async function getCodeMirrorConstructors() {
  try {
    let mdViews = app.workspace.getLeavesOfType("markdown");
    let mdView = mdViews[0]?.view;
    let tempLeaf = null;
    
    if (!mdView) {
      tempLeaf = app.workspace.getLeaf("split");
      await tempLeaf.setViewState({ type: "markdown" });
      mdView = tempLeaf.view;
    }
    
    const liveEditorView = mdView.editor?.cm;
    if (!liveEditorView) {
      if (tempLeaf) tempLeaf.detach();
      return null;
    }
    
    const EditorViewConstructor = liveEditorView.constructor;
    const EditorStateClass = liveEditorView.state.constructor;
    
    if (tempLeaf) {
      tempLeaf.detach();
    }
    
    return { EditorViewConstructor, EditorStateClass };
  } catch(e) {
    console.error("ExcaliMath: Failed to extract CodeMirror:", e);
    return null;
  }
}

async function loadSettings() {
  const settings = ea.getScriptSettings();
  if (settings["ExcaliMath"]) {
    try {
      const saved = JSON.parse(settings["ExcaliMath"].value);
      // Migrate old graph settings if graphParams doesn't exist
      if (!saved.graphParams && saved.graph) {
         saved.graphParams = JSON.parse(JSON.stringify(GRAPH_DEFAULTS));
         saved.graphParams[saved.graph.type || "custom"] = { ...saved.graphParams[saved.graph.type || "custom"], ...saved.graph };
      }
      state = { ...state, ...saved };
      state.editTargetId = null; 
    } catch(e) {}
  }
}

async function saveSettings() {
  const settings = ea.getScriptSettings();
  settings["ExcaliMath"] = { value: JSON.stringify(state) };
  await ea.setScriptSettings(settings);
}

// ---------------------------------------------------------
// 3. UI Construction & Rendering
// ---------------------------------------------------------
function injectCSS(contentEl) {
  contentEl.createEl("style", { text: `
    .excalimath-sidepanel { display: flex; flex-direction: column; height: 100%; padding: 10px; overflow-y: auto; overflow-x: hidden; }
    .excalimath-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 10px; }
    .excalimath-header h2 { margin: 0; display: flex; align-items: center; gap: 8px;}
    .excalimath-warning { padding: 8px; border-radius: 4px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.9em; background-color: var(--background-modifier-error-hover); color: var(--text-error); border: 1px solid var(--background-modifier-error); }
    .excalimath-info { background: var(--background-secondary-alt); color: var(--text-muted); padding: 8px; border-radius: 4px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.9em; }
    .excalimath-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 10px; flex-shrink: 0; }
    .excalimath-tabs button { flex: 1; border-radius: 4px 4px 0 0; border: 1px solid transparent; border-bottom: none; background: transparent; padding: 8px; box-shadow: none; cursor: pointer; color: var(--text-muted); }
    .excalimath-tabs button:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
    .excalimath-tabs button.is-active { background: var(--background-secondary); border-color: var(--background-modifier-border); color: var(--text-normal); font-weight: bold; }
    .excalimath-preview-wrapper { flex: 0 0 180px; min-height: 180px; border: 1px solid var(--background-modifier-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 15px 0; overflow: hidden; padding: 10px; position: relative; }
    .excalimath-preview-title { position: absolute; top: 4px; left: 8px; font-size: 0.75em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; z-index: 10;}
    .excalimath-preview-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .excalimath-preview-container svg, .excalimath-preview-container img { width: 100%; height: 100%; object-fit: contain; }
    .excalimath-tab-content { flex: 1; padding-right: 5px; display: flex; flex-direction: column; gap: 10px; overflow: visible; }
    .excalimath-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: auto; padding-top: 15px; border-top: 1px solid var(--background-modifier-border); flex-shrink: 0; }
    .excalimath-lib-card { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; margin-bottom: 10px; }
    .excalimath-lib-card strong { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: var(--text-accent); }
    .excalimath-lib-preview { width: 100%; height: 80px; background: var(--background-primary); border-radius: 4px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; padding: 4px; border: 1px solid var(--background-modifier-border);}
    .excalimath-lib-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .excalimath-lib-actions { display: flex; justify-content: space-between; gap: 8px; }
    .excalimath-lib-actions button { display: flex; align-items: center; justify-content: center; gap: 4px; }
    .excalimath-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
    .excalimath-setting { border: none !important; padding: 0 !important; }
    .excalimath-setting .setting-item-info { flex: 1; }
    .excalimath-setting .setting-item-control { flex: 1; justify-content: flex-end; }
    .excalimath-cm-container { width: 100%; overflow: visible !important; }
    .excalidraw-sidepanel-tab__content.excalimath-sidepanel .excalimath-cm-container.excalidraw-LatexPrompt .cm-tooltip-cursor {display: none !important;}
  `});
}

async function renderFullUI() {
  if(!globalContentEl) return;
  globalContentEl.empty();
  globalContentEl.addClass("excalimath-sidepanel");
  
  injectCSS(globalContentEl);
  
  const header = globalContentEl.createDiv({ cls: "excalimath-header" });
  header.innerHTML = `<h2>${ea.obsidian.getIcon("radical").outerHTML} ExcaliMath</h2>`;
  
  if(!hasMathJax) {
    const w = globalContentEl.createDiv({ cls: "excalimath-warning mod-warning" });
    w.innerHTML = `${ea.obsidian.getIcon("alert-triangle").outerHTML} <span>${t("ERROR_MATHJAX")}</span>`;
  } else if (!hasLatexSuite && state.activeTab === "formula") {
    const info = globalContentEl.createDiv({ cls: "excalimath-info" });
    info.innerHTML = `${ea.obsidian.getIcon("info").outerHTML} <span>${t("INFO_LATEX_SUITE")}</span>`;
  }
  
  const tabsContainer = globalContentEl.createDiv({ cls: "excalimath-tabs" });
  ["formula", "graph", "library"].forEach(tab => {
    const btn = tabsContainer.createEl("button", { text: t(`TAB_${tab.toUpperCase()}`) });
    if(state.activeTab === tab) btn.addClass("is-active");
    btn.onclick = () => {
      // If the user manually changes tabs, clear the edit target so the UI resets to "Insert"
      if (state.activeTab !== tab) {
        state.activeTab = tab;
        state.editTargetId = null;
        saveSettings();
        renderFullUI();
      }
    };
  });
  
  const tabContent = globalContentEl.createDiv({ cls: "excalimath-tab-content" });
  if(state.activeTab === "formula") await renderFormulaTab(tabContent);
  else if(state.activeTab === "graph") renderGraphTab(tabContent);
  else if(state.activeTab === "library") renderLibraryTab(tabContent);
}

function createPreviewArea(container) {
  const previewWrapper = container.createDiv({ cls: "excalimath-preview-wrapper" });
  previewWrapper.createDiv({ cls: "excalimath-preview-title", text: t("PREVIEW_TITLE") });
  const previewContainer = previewWrapper.createDiv({ cls: "excalimath-preview-container" });
  
  updatePreviewBackground(previewWrapper);
  return previewContainer;
}

function updatePreviewBackground(wrapper = null) {
  if (!wrapper) wrapper = globalContentEl?.querySelector(".excalimath-preview-wrapper");
  if (!wrapper) return;
  const st = ea.getExcalidrawAPI()?.getAppState();
  const isDark = st?.theme === "dark";
  const bgColor = st?.viewBackgroundColor || "#ffffff";
  
  wrapper.style.backgroundColor = bgColor;
  if (isDark) {
      wrapper.style.filter = "invert(93%) hue-rotate(180deg) saturate(1.25)";
  } else {
      wrapper.style.filter = "none";
  }
}

function updatePreviewArea(targetContainer = null) {
  const container = targetContainer || globalContentEl?.querySelector(".excalimath-preview-container");
  if(!container) return;
  
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(async () => {
    if(state.activeTab === "formula") await renderFormulaPreview(container);
    else if(state.activeTab === "graph") await renderGraphPreview(container);
  }, 300);
}

// ---------------------------------------------------------
// 4. Formula Editor logic
// ---------------------------------------------------------
async function renderFormulaTab(container) {
  const cmContainer = container.createDiv({ cls: "excalimath-cm-container excalidraw-LatexPrompt" });
  const CM = ea.getCM6();

  if (CM) {
    const extensions = ea.getMathEditorExtensions();
    
    // Add update listener to sync state dynamically and trigger preview renders
    extensions.push(CM.EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newVal = update.state.doc.toString();
        if (newVal !== state.formula.text) {
          state.formula.text = newVal;
          updatePreviewArea();
          saveSettings();
        }
      }
    }));
    
    const myEditorView = new CM.EditorView({
        state: CM.EditorState.create({
            doc: state.formula.text,
            extensions: extensions
        }),
        parent: cmContainer
    });

    // Store globally so tab.onFocus can refocus it when returning to the view
    window.excalimathEditorView = myEditorView;

    myEditorView.dom.addEventListener("focusout", () => {
        const newVal = myEditorView.state.doc.toString();
        if (newVal !== state.formula.text) {
            state.formula.text = newVal;
            updatePreviewArea();
            saveSettings();
        }
    });

    // Auto-focus the editor when the tab renders
    setTimeout(() => myEditorView.focus(), 100);
  } else {
    // Fallback to TextArea if CM extraction fails
    const textAreaSetting = new ea.obsidian.Setting(cmContainer).setClass("excalimath-setting");
    textAreaSetting.addTextArea(text => {
      text.setValue(state.formula.text);
      text.inputEl.style.width = "100%";
      text.inputEl.style.height = "120px";
      text.inputEl.style.fontFamily = "monospace";
      text.setPlaceholder(t("FORMULA_INPUT_PLACEHOLDER"));
      
      text.onChange(val => {
        state.formula.text = val;
        updatePreviewArea();
        saveSettings();
      });

      // Auto-focus the textarea when the tab renders
      setTimeout(() => text.inputEl.focus(), 100);
    });
    textAreaSetting.settingEl.style.display = "block";
    textAreaSetting.controlEl.style.width = "100%";
  }
  
  // Clean up legacy scales saved in user settings to default 1 (Small)
  let currentScale = state.formula.scale || 1;
  if (![0.5, 1, 1.6, 2.4, 3.5].includes(currentScale)) {
    currentScale = 1;
    state.formula.scale = 1;
  }

  new ea.obsidian.Setting(container)
    .setName(t("SCALE"))
    .setClass("excalimath-setting")
    .addDropdown(d => d
      .addOption("0.5", "Extra small")
      .addOption("1", "Small")
      .addOption("1.6", "Medium")
      .addOption("2.4", "Large")
      .addOption("3.5", "Extra large")
      .setValue(String(currentScale))
      .onChange(val => {
        state.formula.scale = parseFloat(val);
        updatePreviewArea();
        saveSettings();
      })
    );
    
  const previewContainer = createPreviewArea(container);
  
  const actions = container.createDiv({ cls: "excalimath-actions" });
  
  const isEditing = !!state.editTargetId;
  
  // Create Insert/Update button FIRST in the DOM to receive Tab focus first
  const insertBtn = actions.createEl("button", { cls: "mod-cta" });
  insertBtn.innerHTML = `${ea.obsidian.getIcon(isEditing ? "refresh-cw" : "plus-circle").outerHTML} ${isEditing ? t("UPDATE") : t("INSERT")}`;
  insertBtn.style.order = "2"; // Display visually on the right
  insertBtn.onclick = () => insertFormula();

  // Create Save to Library button SECOND in the DOM
  const saveLibBtn = actions.createEl("button", { text: t("ADD_TO_LIBRARY") });
  saveLibBtn.innerHTML = `${ea.obsidian.getIcon("bookmark").outerHTML} ${t("ADD_TO_LIBRARY")}`;
  saveLibBtn.style.order = "1"; // Display visually on the left
  saveLibBtn.onclick = () => addToLibrary("formula", state.formula);

  updatePreviewArea(previewContainer);
}

async function renderDynamicLibraryPreview(item, container) {
  ea.clear();
  let svg = null;
  try {
    if (item.type === "formula") {
      await ea.addLaTex(0, 0, item.data.text);
      const exportSettings = { withBackground: false, withTheme: false };
      svg = await ea.createSVG(null, false, exportSettings, undefined, "light", 10);
    } else {
      const elements = generateGraphElements(item.data.type, item.data.config);
      if (elements.length > 0) {
        elements.forEach(el => {
          ea.elementsDict[el.id] = el;
        });
        const exportSettings = { withBackground: false, withTheme: false };
        svg = await ea.createSVG(null, false, exportSettings, undefined, "light", 20);
      }
    }
  } catch(e) {
    console.error("ExcaliMath: Failed to render library preview", e);
  } finally {
    ea.clear();
  }

  if (svg) {
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.objectFit = "contain";
    container.appendChild(svg);
  } else {
    // Fallback to text description if SVG generation fails
    let desc = item.type === "formula" ? item.data.text : 
               (item.data.type === "custom" ? item.data.config.customFormula : item.data.type);
    container.createDiv({ text: desc, cls: "excalimath-lib-desc" });
  }
}

async function renderFormulaPreview(container) {
  container.empty();
  if(!state.formula.text || !hasMathJax) return;
  try {
    ea.clear();
    await ea.addLaTex(0, 0, state.formula.text);
    
    // Generate an isolated SVG straight from the EA workbench without rendering back to the canvas
    const exportSettings = { withBackground: false, withTheme: false };
    const svg = await ea.createSVG(null, false, exportSettings, undefined, "light", 10);
    ea.clear();
    
    if(svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.objectFit = "contain";
      container.appendChild(svg);
    }
  } catch(e) {
    container.createEl("div", { text: t("INVALID_FORMULA") });
  }
}

async function insertFormula() {
  if(!state.formula.text || !hasMathJax) return;
  ea.clear();
  
  let x = ea.getViewCenterPosition().x;
  let y = ea.getViewCenterPosition().y;
  let oldEl = null;
  
  // Default to the scale chosen in the UI dropdown (fallback to 1 "Small")
  let scale = state.formula.scale || 1;
  
  if (state.editTargetId) {
    oldEl = ea.getViewElements().find(e => e.id === state.editTargetId);
    if (oldEl) {
      x = oldEl.x;
      y = oldEl.y;
      ea.copyViewElementsToEAforEditing([oldEl]);
      ea.getElement(oldEl.id).isDeleted = true;
      
      // Extract the user's manual resize transformations on the canvas
      try {
        // Prevent errors by strictly ensuring the target is an image before querying original size
        if (oldEl.type === "image") {
          const origSize = await ea.getOriginalImageSize(oldEl);
          if (origSize && origSize.width && origSize.width > 0) {
            const baseScale = oldEl.customData?.latexscale?.scaleX || 1;
            const resizeMultiplier = oldEl.width / origSize.width;
            scale = baseScale * resizeMultiplier;
          }
        }
      } catch(e) {
        console.warn("ExcaliMath: Failed to compute resized scale", e);
      }
    }
  }
  
  const id = await ea.addLaTex(x, y, state.formula.text, scale, scale);
  const newEl = ea.getElement(id);
  
  if(oldEl) {
    newEl.groupIds = [...oldEl.groupIds];
    newEl.angle = oldEl.angle;
  } else {
    newEl.x -= newEl.width / 2;
    newEl.y -= newEl.height / 2;
  }
  
  await ea.addElementsToView(false, false, true);
  const finalEl = ea.getViewElements().find(e => e.id === id);
  if(finalEl) ea.selectElementsInView([finalEl]);
}

// ---------------------------------------------------------
// 5. Graph Editor logic
// ---------------------------------------------------------
function renderGraphTab(container) {
  new ea.obsidian.Setting(container)
    .setName(t("GRAPH_TYPE"))
    .setClass("excalimath-setting")
    .addDropdown(d => d
      .addOption("custom", t("CUSTOM_FORMULA"))
      .addOption("polynomial", t("POLYNOMIAL"))
      .addOption("gaussian", t("GAUSSIAN"))
      .addOption("poisson", t("POISSON"))
      .setValue(state.graph.type)
      .onChange(val => { 
        state.graph.type = val; 
        saveSettings();
        renderFullUI(); 
      })
    );
    
  const dynamicInputsContainer = container.createDiv();
  const type = state.graph.type;
  const activeParams = state.graphParams[type];
  
  if (type === "custom") {
    new ea.obsidian.Setting(dynamicInputsContainer)
      .setName(t("GRAPH_FORMULA"))
      .setClass("excalimath-setting")
      .addText(text => {
        text.setValue(activeParams.customFormula);
        text.inputEl.style.width = "100%";
        text.inputEl.style.fontFamily = "monospace";
        text.onChange(v => { activeParams.customFormula = v; updatePreviewArea(); saveSettings(); });
      });
  } else if (type === "polynomial") {
    new ea.obsidian.Setting(dynamicInputsContainer)
      .setName(t("GRAPH_POLY"))
      .setClass("excalimath-setting")
      .addText(text => text.setValue(activeParams.polyCoeffs).onChange(v => { activeParams.polyCoeffs = v; updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  } else if (type === "gaussian") {
    const gaussSetting = new ea.obsidian.Setting(dynamicInputsContainer).setName(t("GRAPH_GAUSS")).setClass("excalimath-setting");
    gaussSetting.controlEl.addClass("excalimath-grid-2");
    gaussSetting.addText(text => text.setValue(String(activeParams.gaussMean)).onChange(v => { activeParams.gaussMean = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
    gaussSetting.addText(text => text.setValue(String(activeParams.gaussStdDev)).onChange(v => { activeParams.gaussStdDev = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  } else if (type === "poisson") {
    new ea.obsidian.Setting(dynamicInputsContainer)
      .setName(t("GRAPH_POISSON"))
      .setClass("excalimath-setting")
      .addText(text => text.setValue(String(activeParams.poissonLambda)).onChange(v => { activeParams.poissonLambda = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  }

  const rangeSetting = new ea.obsidian.Setting(container).setName(t("DOMAIN")).setClass("excalimath-setting");
  rangeSetting.controlEl.addClass("excalimath-grid-2");
  rangeSetting.addText(text => text.setValue(String(activeParams.xMin)).onChange(v => { activeParams.xMin = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  rangeSetting.addText(text => text.setValue(String(activeParams.xMax)).onChange(v => { activeParams.xMax = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  
  const scaleSetting = new ea.obsidian.Setting(container).setName(t("SCALE_XY")).setClass("excalimath-setting");
  scaleSetting.controlEl.addClass("excalimath-grid-2");
  scaleSetting.addText(text => text.setValue(String(activeParams.xScale)).onChange(v => { activeParams.xScale = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  scaleSetting.addText(text => text.setValue(String(activeParams.yScale)).onChange(v => { activeParams.yScale = parseFloat(v); updatePreviewArea(); saveSettings(); }).inputEl.style.width="100%");
  
  new ea.obsidian.Setting(container)
    .setName(t("RESOLUTION"))
    .setClass("excalimath-setting")
    .addSlider(slider => slider.setLimits(10, 1000, 10).setValue(activeParams.resolution).onChange(v => { activeParams.resolution = v; updatePreviewArea(); saveSettings(); }));

  const colorSetting = new ea.obsidian.Setting(container).setName(t("STROKE_COLOR")).setClass("excalimath-setting");
  let textInput, colorPicker;
  colorSetting.addText(text => {
      textInput = text;
      text.setValue(activeParams.strokeColor).onChange(v => {
          activeParams.strokeColor = v;
          colorPicker.setValue(v);
          updatePreviewArea(); saveSettings();
      }).inputEl.style.width = "100px";
  });
  colorSetting.addColorPicker(picker => {
      colorPicker = picker;
      picker.setValue(activeParams.strokeColor).onChange(v => {
          activeParams.strokeColor = v;
          textInput.setValue(v);
          updatePreviewArea(); saveSettings();
      });
  });
  colorSetting.addButton(btn => btn
      .setIcon("swatch-book")
      .onClick(async () => {
          const selected = await ea.showColorPicker(btn.buttonEl, "elementStroke");
          if (selected) {
              activeParams.strokeColor = selected;
              textInput.setValue(selected);
              colorPicker.setValue(selected);
              updatePreviewArea(); saveSettings();
          }
      })
  );

  new ea.obsidian.Setting(container)
    .setName(t("STROKE_WIDTH"))
    .setClass("excalimath-setting")
    .addSlider(slider => slider.setLimits(0.5, 10, 0.5).setValue(activeParams.strokeWidth).onChange(v => { activeParams.strokeWidth = v; updatePreviewArea(); saveSettings(); }));

  new ea.obsidian.Setting(container)
    .setName(t("ROUGHNESS"))
    .setClass("excalimath-setting")
    .addSlider(slider => slider.setLimits(0, 2, 1).setValue(activeParams.roughness).onChange(v => { activeParams.roughness = v; updatePreviewArea(); saveSettings(); }));

  const bottomToggles = container.createDiv({ cls: "excalimath-grid-2" });

  new ea.obsidian.Setting(bottomToggles)
    .setName(t("SHOW_AXES"))
    .setClass("excalimath-setting")
    .addToggle(tgl => tgl.setValue(activeParams.showAxes).onChange(v => { activeParams.showAxes = v; renderFullUI(); saveSettings(); }));

  new ea.obsidian.Setting(bottomToggles)
    .setName(t("CLOSE_PLOT"))
    .setClass("excalimath-setting")
    .addToggle(tgl => tgl.setValue(activeParams.closePlot).onChange(v => { activeParams.closePlot = v; updatePreviewArea(); saveSettings(); }));
    
  if (activeParams.showAxes) {
      const axesColorSetting = new ea.obsidian.Setting(container).setName(t("AXES_COLOR")).setClass("excalimath-setting");
      let axesTextInput, axesColorPicker;
      axesColorSetting.addText(text => {
          axesTextInput = text;
          text.setValue(activeParams.axesColor).onChange(v => {
              activeParams.axesColor = v;
              axesColorPicker.setValue(v);
              updatePreviewArea(); saveSettings();
          }).inputEl.style.width = "100px";
      });
      axesColorSetting.addColorPicker(picker => {
          axesColorPicker = picker;
          picker.setValue(activeParams.axesColor).onChange(v => {
              activeParams.axesColor = v;
              axesTextInput.setValue(v);
              updatePreviewArea(); saveSettings();
          });
      });
      axesColorSetting.addButton(btn => btn
          .setIcon("swatch-book")
          .onClick(async () => {
              const selected = await ea.showColorPicker(btn.buttonEl, "elementStroke");
              if (selected) {
                  activeParams.axesColor = selected;
                  axesTextInput.setValue(selected);
                  axesColorPicker.setValue(selected);
                  updatePreviewArea(); saveSettings();
              }
          })
      );
  }

  const previewContainer = createPreviewArea(container);

  const actions = container.createDiv({ cls: "excalimath-actions" });
  
  const saveLibBtn = actions.createEl("button", { text: t("ADD_TO_LIBRARY") });
  saveLibBtn.innerHTML = `${ea.obsidian.getIcon("bookmark").outerHTML} ${t("ADD_TO_LIBRARY")}`;
  saveLibBtn.onclick = () => addToLibrary("graph", { type: state.graph.type, config: activeParams });
  
  const isEditing = !!state.editTargetId;
  const insertBtn = actions.createEl("button", { cls: "mod-cta" });
  insertBtn.innerHTML = `${ea.obsidian.getIcon(isEditing ? "refresh-cw" : "plus-circle").outerHTML} ${isEditing ? t("UPDATE") : t("INSERT")}`;
  insertBtn.onclick = () => insertGraph();

  updatePreviewArea(previewContainer);
}

function normalizePoints(points) {
  if(points.length === 0) return { offsetX: 0, offsetY: 0, points: [] };
  const minX = Math.min(...points.map(p=>p[0]));
  const minY = Math.min(...points.map(p=>p[1]));
  const normalized = points.map(p => [p[0] - minX, p[1] - minY]);
  return { offsetX: minX, offsetY: minY, points: normalized };
}

function createRawLineElement(points, color, width, roughness, isPolygon) {
  const norm = normalizePoints(points);
  const w = Math.abs(Math.max(...norm.points.map(p=>p[0])) - Math.min(...norm.points.map(p=>p[0])));
  const h = Math.abs(Math.max(...norm.points.map(p=>p[1])) - Math.min(...norm.points.map(p=>p[1])));
  
  return {
    id: ea.generateElementId(),
    type: "line",
    x: norm.offsetX,
    y: norm.offsetY,
    width: w,
    height: h,
    angle: 0,
    strokeColor: color || "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: width || 2,
    strokeStyle: "solid",
    roughness: roughness || 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: norm.points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    polygon: isPolygon
  };
}

function generateGraphPoints(type, graphConfig) {
  const points = [];
  const step = (graphConfig.xMax - graphConfig.xMin) / (Math.max(1, graphConfig.resolution - 1));
  for(let i=0; i<graphConfig.resolution; i++) {
    const x = graphConfig.xMin + i * step;
    let y = 0;
    try {
      if(type === "custom") {
        if(!window.mathGraphCustomFunc || window.mathGraphCustomFuncString !== graphConfig.customFormula) {
          window.mathGraphCustomFunc = new Function('x', `with (Math) { return ${graphConfig.customFormula}; }`);
          window.mathGraphCustomFuncString = graphConfig.customFormula;
        }
        y = window.mathGraphCustomFunc(x);
      } else if (type === "polynomial") {
        const coeffs = graphConfig.polyCoeffs.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        let result = 0;
        const order = coeffs.length - 1;
        for (let j = 0; j < coeffs.length; j++) {
            result += coeffs[j] * Math.pow(x, order - j);
        }
        y = result;
      } else if (type === "gaussian") {
        const mu = graphConfig.gaussMean || 0;
        const sigma = graphConfig.gaussStdDev || 1;
        const a = 1 / (sigma * Math.sqrt(2 * Math.PI));
        const b = -0.5 * Math.pow((x - mu) / sigma, 2);
        y = a * Math.exp(b);
      } else if (type === "poisson") {
        const lambda = graphConfig.poissonLambda || 1;
        const rx = Math.round(x);
        if (rx < 0) continue; 
        let fact = 1;
        for (let j = 2; j <= rx; j++) fact *= j;
        y = (Math.pow(lambda, rx) * Math.exp(-lambda)) / fact;
      }
    } catch(e) {
      continue;
    }
    if(isNaN(y) || !isFinite(y)) continue;
    
    const px = x * graphConfig.xScale;
    const py = -y * graphConfig.yScale;
    points.push([px, py]);
  }
  if(graphConfig.closePlot && points.length > 0) {
    points.push([points[0][0], points[0][1]]);
  }
  return points;
}

function generateGraphElements(type, graphConfig) {
  const points = generateGraphPoints(type, graphConfig);
  if(points.length < 2) return [];

  const elements = [];

  if (graphConfig.showAxes) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 0);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 0);
    
    const xPad = Math.max(Math.abs(maxX - minX) * 0.05, 20);
    const yPad = Math.max(Math.abs(maxY - minY) * 0.05, 20);

    const xAxis = createRawLineElement([[minX - xPad, 0], [maxX + xPad, 0]], graphConfig.axesColor || "#888888", 1, 0, false);
    const yAxis = createRawLineElement([[0, minY - yPad], [0, maxY + yPad]], graphConfig.axesColor || "#888888", 1, 0, false);
    elements.push(xAxis, yAxis);
  }

  const mainLine = createRawLineElement(points, graphConfig.strokeColor, graphConfig.strokeWidth, graphConfig.roughness, graphConfig.closePlot);
  mainLine.customData = { mathGraph: { type, config: { ...graphConfig } } };
  elements.push(mainLine);

  return elements;
}

async function getPreviewDataURL(tabType, data) {
  ea.clear();
  
  if (tabType === "formula") {
     await ea.addLaTex(0, 0, data.text);
  } else {
     const elements = generateGraphElements(data.type, data.config);
     if (elements.length === 0) return null;
     
     // Inject newly generated elements into the workbench mapping
     elements.forEach(el => {
        ea.elementsDict[el.id] = el;
     });
  }

  // Create SVG exclusively from the workbench contents
  const exportSettings = { withBackground: false, withTheme: false };
  const svg = await ea.createSVG(null, false, exportSettings, undefined, "light", 20);
  ea.clear();
  
  if (!svg) return null;
  
  // Convert the exported SVG to a fully formed Base64 Data URL for the Library `img.src`
  const svgString = svg.outerHTML;
  const base64 = btoa(unescape(encodeURIComponent(svgString)));
  return "data:image/svg+xml;base64," + base64;
}

async function renderGraphPreview(container) {
  container.empty();
  ea.clear();
  const type = state.graph.type;
  const config = state.graphParams[type];
  
  const elements = generateGraphElements(type, config);
  if(elements.length === 0) {
    container.createEl("div", { text: t("INVALID_FORMULA") });
    return;
  }
  
  // Push elements into the EA workbench manually
  elements.forEach(el => {
     ea.elementsDict[el.id] = el;
  });
  
  const exportSettings = { withBackground: false, withTheme: false };
  const svg = await ea.createSVG(null, false, exportSettings, undefined, "light", 20);
  ea.clear();
  
  if(svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.objectFit = "contain";
      container.appendChild(svg);
  }
}

async function insertGraph() {
  ea.clear();
  const type = state.graph.type;
  const config = state.graphParams[type];
  const elementsData = generateGraphElements(type, config);
  
  if(elementsData.length === 0) {
    new Notice(t("INVALID_FORMULA"));
    return;
  }
  
  let x = ea.getViewCenterPosition().x;
  let y = ea.getViewCenterPosition().y;
  let oldEl = null;
  
  if (state.editTargetId) {
    oldEl = ea.getViewElements().find(e => e.id === state.editTargetId || (e.groupIds && e.groupIds.includes(state.editTargetId)));
    if (oldEl) {
      const groupToDel = oldEl.groupIds?.length ? ea.getViewElements().filter(e => e.groupIds.includes(oldEl.groupIds[0])) : [oldEl];
      
      const bb = ea.getBoundingBox(groupToDel);
      x = bb.topX + bb.width / 2;
      y = bb.topY + bb.height / 2;

      ea.copyViewElementsToEAforEditing(groupToDel);
      ea.getElements().forEach(e => e.isDeleted = true);
    }
  }
  
  const ids = [];
  elementsData.forEach(elData => {
    ea.elementsDict[elData.id] = elData;
    ids.push(elData.id);
  });
  
  if (ids.length > 1) {
    ea.addToGroup(ids);
  }
  
  const bb = ea.getBoundingBox(ids.map(id => ea.getElement(id)));
  
  const dx = x - (bb.width/2) - bb.topX;
  const dy = y - (bb.height/2) - bb.topY;
  ids.forEach(id => {
    const e = ea.getElement(id);
    e.x += dx; e.y += dy;
  });
  
  await ea.addElementsToView(false, false, true);
  const finalEls = ea.getViewElements().filter(e => ids.includes(e.id));
  if(finalEls.length > 0) ea.selectElementsInView(finalEls);
}

// ---------------------------------------------------------
// 6. Library logic
// ---------------------------------------------------------
function renderLibraryTab(container) {
  if (state.library.length === 0) {
    container.createEl("p", { text: t("LIBRARY_EMPTY"), cls: "excalimath-info" });
    return;
  }
  
  state.library.forEach((item, idx) => {
    const card = container.createDiv({ cls: "excalimath-lib-card" });
    card.innerHTML = `<strong>${ea.obsidian.getIcon(item.type === "formula" ? "radical" : "trending-up").outerHTML} ${item.name}</strong>`;
    
    const previewDiv = card.createDiv({ cls: "excalimath-lib-preview" });
    
    const st = ea.getExcalidrawAPI()?.getAppState();
    const isDark = st?.theme === "dark";
    const bgColor = st?.viewBackgroundColor === "transparent" 
        ? (isDark ? "#1e1e1e" : "#ffffff") 
        : (st?.viewBackgroundColor || "#ffffff");
        
    previewDiv.style.backgroundColor = bgColor;
    if (isDark) {
        previewDiv.style.filter = "invert(93%) hue-rotate(180deg) saturate(1.25)";
    }

    // Render the preview dynamically on the fly
    renderDynamicLibraryPreview(item, previewDiv);

    const actions = card.createDiv({ cls: "excalimath-lib-actions" });
    
    const delBtn = actions.createEl("button", { text: t("DELETE") });
    delBtn.innerHTML = `${ea.obsidian.getIcon("trash").outerHTML} ${t("DELETE")}`;
    delBtn.style.color = "var(--text-error)";
    delBtn.onclick = () => {
      state.library.splice(idx, 1);
      saveSettings();
      renderFullUI();
    };
    
    const loadBtn = actions.createEl("button", { text: t("LOAD"), cls: "mod-cta" });
    loadBtn.innerHTML = `${ea.obsidian.getIcon("upload").outerHTML} ${t("LOAD")}`;
    loadBtn.onclick = () => {
      if(item.type === "formula") {
        state.formula = { ...state.formula, ...item.data };
        state.activeTab = "formula";
      } else {
        state.graph.type = item.data.type;
        state.graphParams[item.data.type] = { ...state.graphParams[item.data.type], ...item.data.config };
        state.activeTab = "graph";
      }
      saveSettings();
      renderFullUI();
    };
  });
}

async function addToLibrary(type, data) {
  const name = await utils.inputPrompt(t("PROMPT_NAME"), "", `My ${type}`);
  if(!name) return;
  
  // Exclusively store the configuration parameters. No bloated data URLs.
  state.library.push({
    id: ea.generateElementId(),
    name,
    type,
    data: JSON.parse(JSON.stringify(data))
  });
  
  await saveSettings();
  new Notice(`Saved to library: ${name}`);
  renderFullUI();
}

// ---------------------------------------------------------
// 7. Event Hooks & Setup
// ---------------------------------------------------------
function checkSelection() {
  const selected = ea.getViewSelectedElements();
  let changed = false;
  
  if(selected.length > 0) {
    let mathGraphEl = selected.find(el => el.customData?.mathGraph);
    if (!mathGraphEl && selected[0].groupIds?.length > 0) {
       const groupElements = ea.getViewElements().filter(e => e.groupIds.includes(selected[0].groupIds[0]));
       mathGraphEl = groupElements.find(e => e.customData?.mathGraph);
    }
    
    if (mathGraphEl && state.editTargetId !== mathGraphEl.id) {
      state.editTargetId = mathGraphEl.id;
      state.activeTab = "graph";
      
      const md = mathGraphEl.customData.mathGraph;
      if (md.type) {
         state.graph.type = md.type;
         state.graphParams[md.type] = { ...state.graphParams[md.type], ...md.config };
      } else {
         // Backwards compatibility for older saved graphs
         state.graph.type = "custom";
         state.graphParams.custom = { ...state.graphParams.custom, ...md };
      }
      changed = true;
    } else if (selected.length === 1 && selected[0].type === "image") {
      const el = selected[0];
      const eq = ea.targetView.excalidrawData.getEquation(el.fileId);
      if(eq && state.editTargetId !== el.id) {
        state.editTargetId = el.id;
        state.activeTab = "formula";
        state.formula.text = eq.latex;
        if(el.customData?.latexscale) {
           state.formula.scale = el.customData.latexscale.scaleX || 3;
        }
        changed = true;
      }
    } else if (state.editTargetId && (!mathGraphEl || state.editTargetId !== mathGraphEl.id)) {
      state.editTargetId = null;
      changed = true;
    }
  } else if (state.editTargetId) {
    state.editTargetId = null;
    changed = true;
  }
  
  if (changed) {
    saveSettings();
    renderFullUI();
  }
  return changed;
}

// ---------------------------------------------------------
// Main Execution
// ---------------------------------------------------------
async function main() {
  const existingTab = ea.checkForActiveSidepanelTabForScript();
  if (existingTab) {
    const hostEA = existingTab.getHostEA();
    if (hostEA && hostEA !== ea) {
      hostEA.setView(ea.targetView);
      existingTab.open();
      return;
    }
  }

  await loadSettings();

  const tab = await ea.createSidepanelTab("ExcaliMath", true, true);
  if (!tab) return;

  globalContentEl = tab.contentEl;

  tab.onOpen = () => {
    renderFullUI();
    checkSelection();
  };

  tab.onFocus = (view) => {
    if (view && view !== ea.targetView) {
      ea.setView(view);
      ea.clear();
    }
    updatePreviewBackground();
    if (state.activeTab !== "library") {
       updatePreviewArea();
    }
    checkSelection();

    // Auto-focus the formula editor whenever the sidepanel receives focus
    if (state.activeTab === "formula") {
      if (window.excalimathEditorView) {
        window.excalimathEditorView.focus();
      } else {
        globalContentEl?.querySelector('textarea')?.focus();
      }
    }
  };

  tab.onClose = () => {
    ea.onSceneChangeHook = null;
    saveSettings();
    delete window.excalimathEditorView;
  };

  ea.onSceneChangeHook = {
    appStateKeys: ["selectedElementIds", "theme", "viewBackgroundColor"],
    trackElements: false,
    triggerWhenInvisible: false,
    callback: (elements, appState, files, view, hookEA) => {
      if (view && view !== ea.targetView) {
        ea.setView(view);
        ea.clear();
      }
      
      let needsPreviewUpdate = false;
      const st = appState;
      const currentBgColor = st.viewBackgroundColor === "transparent" 
          ? (st.theme === "dark" ? "#1e1e1e" : "#ffffff") 
          : (st.viewBackgroundColor || "#ffffff");
          
      const isDark = st.theme === "dark";
      const wrapper = globalContentEl?.querySelector(".excalimath-preview-wrapper");
      
      if (wrapper) {
         if (wrapper.style.backgroundColor !== currentBgColor || 
            (isDark && wrapper.style.filter === "none") ||
            (!isDark && wrapper.style.filter !== "none")
         ) {
             updatePreviewBackground(wrapper);
         }
      }
      
      const selectionChanged = checkSelection();
      
      if (!selectionChanged && needsPreviewUpdate && state.activeTab !== "library") {
         updatePreviewArea();
      }
    }
  };

  tab.open();
}

main();