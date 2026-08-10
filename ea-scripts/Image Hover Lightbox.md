/*
Image Hover Lightbox / 图片悬停放大
version: 1.0.4
repo: https://github.com/otto-OBplugins/excalidraw-image-hover-lightbox
Hover an image -> fullscreen-corner button -> mask lightbox (click outside / Esc to close).

Enable:
1. Recommended: Excalidraw Settings -> Startup Script -> this file (auto on open)
2. Or run once on any Excalidraw canvas (session hooks via onFileOpenHook)
```javascript
*/
(async function () {
  "use strict";

  const SCRIPT_NAME = "Image Hover Lightbox";
  const SCRIPT_VERSION = "1.0.4";
  const REPO_RAW =
    "https://raw.githubusercontent.com/otto-OBplugins/excalidraw-image-hover-lightbox/main";
  const CACHE_DIR = "Excalidraw/Module/otto-OBplugins/image-hover-lightbox";
  const MOD_FILES = {
    geometry: "geometry.js",
    lightbox: "lightbox.js",
    hoverEntry: "hoverEntry.js",
    eaBindings: "eaBindings.js",
    globalMount: "globalMount.js",
  };

  const BOOT_POLL_MS = 250;
  const BOOT_TIMEOUT_MS = 30000;

  // 重复运行时同时取消上一轮的等待，避免旧脚本在稍后拿到 host 后又注册一套 hooks。
  const bootId = (window.__exlBootId || 0) + 1;
  window.__exlBootId = bootId;
  if (typeof window.__exlBootCancel === "function") {
    try { window.__exlBootCancel(); } catch (error) { console.warn("[" + SCRIPT_NAME + "] cancel boot", error); }
  }

  // 重复运行时先清理上一轮，避免旧 hooks、计时器和按钮叠加。
  if (window.__exlCleanup) {
    try { window.__exlCleanup(); } catch (error) { console.warn("[" + SCRIPT_NAME + "] cleanup", error); }
  }
  window.__exlReady = false;

  const notify = (message, duration) => new Notice(String(message), duration == null ? 5000 : duration);

  const ensureFolder = async (path) => {
    const parts = String(path || "").split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      if (!(await app.vault.adapter.exists(current))) {
        try { await app.vault.createFolder(current); } catch (error) { /* 并发创建时可忽略 */ }
      }
    }
  };

  const validateModuleText = (text, url) => {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("远程模块为空：" + url);
    }
    if (/^\s*<(?:!doctype\s+html|html\b)/i.test(text) || !text.includes("module.exports")) {
      throw new Error("远程模块内容无效：" + url);
    }
    return text;
  };

  const fetchRemoteText = async (url) => {
    let lastError = null;
    try {
      const eaHost = window.ExcalidrawAutomate;
      if (eaHost && eaHost.obsidian && typeof eaHost.obsidian.requestUrl === "function") {
        const response = await eaHost.obsidian.requestUrl({ url: url });
        if (response && response.status != null &&
            (response.status < 200 || response.status >= 300)) {
          throw new Error("requestUrl failed " + response.status);
        }
        return validateModuleText(response && response.text, url);
      }
    } catch (error) {
      lastError = error;
    }
    if (typeof fetch === "function") {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("fetch failed " + response.status);
        return validateModuleText(await response.text(), url);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("无法加载模块：" + url);
  };

  const loadText = async (vaultPath, rawUrl, forceRefresh) => {
    let cachedText = null;
    if (await app.vault.adapter.exists(vaultPath)) {
      try {
        cachedText = validateModuleText(await app.vault.adapter.read(vaultPath), vaultPath);
      } catch (error) {
        console.warn("[" + SCRIPT_NAME + "] 缓存模块无效，将尝试远程：", vaultPath, error);
      }
    }
    if (!forceRefresh && cachedText != null) {
      return { text: cachedText, fromRemote: false };
    }
    try {
      const text = await fetchRemoteText(rawUrl);
      await ensureFolder(vaultPath.replace(/\/[^/]+$/, ""));
      try { await app.vault.adapter.write(vaultPath, text); } catch (error) { /* 缓存写入失败不阻塞本次运行 */ }
      return { text: text, fromRemote: true };
    } catch (remoteError) {
      if (cachedText != null) {
        console.warn("[" + SCRIPT_NAME + "] 远程拉取失败，回退缓存：", vaultPath, remoteError);
        return { text: cachedText, fromRemote: false };
      }
      throw remoteError;
    }
  };

  const getHookHost = () => {
    if (typeof window !== "undefined" && window.ExcalidrawAutomate) return window.ExcalidrawAutomate;
    try {
      if (typeof ExcalidrawAutomate !== "undefined") return ExcalidrawAutomate;
    } catch (error) { /* 启动脚本可能没有该全局变量 */ }
    try {
      if (typeof ea !== "undefined" && ea) return ea;
    } catch (error) { /* 脚本引擎可能没有活动 ea */ }
    return null;
  };

  let bootTimer = null;
  let bootResolve = null;
  let bootCancelled = false;
  const isCurrentBoot = () => !bootCancelled && window.__exlBootId === bootId;
  const cancelBoot = () => {
    bootCancelled = true;
    if (bootTimer != null) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }
    if (bootResolve) {
      const resolve = bootResolve;
      bootResolve = null;
      resolve(null);
    }
    if (window.__exlBootCancel === cancelBoot) window.__exlBootCancel = null;
  };
  window.__exlBootCancel = cancelBoot;

  const waitForHookHost = () => new Promise((resolve) => {
    const startedAt = Date.now();
    bootResolve = resolve;

    const finish = (host) => {
      if (bootTimer != null) {
        clearTimeout(bootTimer);
        bootTimer = null;
      }
      if (bootResolve === resolve) bootResolve = null;
      if (window.__exlBootCancel === cancelBoot) window.__exlBootCancel = null;
      resolve(host);
    };

    const poll = () => {
      if (!isCurrentBoot()) return finish(null);
      const host = getHookHost();
      if (host) return finish(host);
      if (Date.now() - startedAt >= BOOT_TIMEOUT_MS) return finish(null);
      bootTimer = setTimeout(poll, BOOT_POLL_MS);
    };
    poll();
  });

  const viewMember = (data, name) => {
    const candidates = [
      data && data[name],
      data && data.view && typeof data.view === "object" && data.view[name],
      data && data.leaf && data.leaf.view && data.leaf.view[name],
    ];
    return candidates.find((value) => value != null) || null;
  };

  const moduleCache = Object.create(null);
  const loadCommonJS = (name, content, extraRequire) => {
    if (moduleCache[name]) return moduleCache[name];
    const exportsObject = {};
    const moduleObject = { exports: exportsObject };
    const requireFn = (id) => {
      if (extraRequire && extraRequire[id]) return extraRequire[id];
      if (moduleCache[id]) return moduleCache[id];
      throw new Error("无法 require：" + id);
    };
    const factory = new Function("exports", "module", "require", content + "\n;return module.exports;");
    const result = factory(exportsObject, moduleObject, requireFn);
    moduleCache[name] = result;
    return result;
  };

  const loadModules = async () => {
    const versionPath = CACHE_DIR + "/.version";
    let cachedVersion = null;
    try {
      if (await app.vault.adapter.exists(versionPath)) {
        cachedVersion = (await app.vault.adapter.read(versionPath)).trim();
      }
    } catch (error) { /* 缓存版本不可读时按需刷新 */ }
    const forceRefresh = cachedVersion !== SCRIPT_VERSION;
    const contents = {};
    let usedStaleCache = false;
    for (const key of Object.keys(MOD_FILES)) {
      const file = MOD_FILES[key];
      const loaded = await loadText(
        CACHE_DIR + "/" + file,
        REPO_RAW + "/Module/" + file,
        forceRefresh
      );
      contents[key] = loaded.text;
      if (forceRefresh && !loaded.fromRemote) usedStaleCache = true;
    }
    if (!usedStaleCache) {
      try {
        await ensureFolder(CACHE_DIR);
        await app.vault.adapter.write(versionPath, SCRIPT_VERSION + "\n");
      } catch (error) { /* 版本标记写入失败不阻塞本次运行 */ }
    }

    const geometry = loadCommonJS("geometry.js", contents.geometry);
    const lightbox = loadCommonJS("lightbox.js", contents.lightbox);
    const hoverEntry = loadCommonJS("hoverEntry.js", contents.hoverEntry, {
      "./geometry.js": geometry,
      "geometry.js": geometry,
    });
    const eaBindings = loadCommonJS("eaBindings.js", contents.eaBindings);
    const globalMount = loadCommonJS("globalMount.js", contents.globalMount);
    return { lightbox, hoverEntry, eaBindings, globalMount };
  };

  const viewKeyOf = (data) => {
    if (data && data.leaf && data.leaf.id != null) return data.leaf.id;
    if (data && data.leaf != null) return data.leaf;
    if (data && data.viewId != null) return data.viewId;
    if (data && data.view && typeof data.view === "object") return data.view;
    if (data && typeof data.view === "string" && data.view !== "active") return data.view;
    if (data && data.ea && data.ea.targetView && typeof data.ea.targetView === "object") {
      return data.ea.targetView;
    }
    if (data && data.ea != null) return data.ea;
    return data;
  };

  const setViewForData = (eaForView, data) => {
    if (!eaForView || typeof eaForView.setView !== "function") return;
    const target = data && data.view != null ? data.view : "active";
    eaForView.setView(target);
  };

  try {
    const host = await waitForHookHost();
    if (!host) {
      if (isCurrentBoot()) {
        notify("「" + SCRIPT_NAME + "」等待 ExcalidrawAutomate 超时，未注册全局挂载。", 7000);
      }
      return;
    }
    if (!isCurrentBoot()) return;
    const mods = await loadModules();
    if (!isCurrentBoot()) return;

    let sharedLightbox = null;
    let previewKey = null;
    let mount = null;

    const makeButton = () => {
      return mods.hoverEntry.createDefaultButton(document);
    };

    const getLightbox = () => {
      if (sharedLightbox) return sharedLightbox;
      sharedLightbox = mods.lightbox.buildLightbox({
        loadImage: async (imageElement, source) => {
          await new Promise((resolve, reject) => {
            imageElement.onload = resolve;
            imageElement.onerror = () => reject(new Error("图片加载失败"));
            imageElement.src = source.url;
          });
        },
        onError: (error) => notify("大图失败：" + (error && error.message)),
      });
      return sharedLightbox;
    };

    const lifecycle = mods.globalMount.createGlobalMount({
      document,
      getViewKey: viewKeyOf,
      resolveEa: (data) => (data && data.ea) || host,
      beforeMount: (data, eaForView) => {
        try { setViewForData(eaForView, data); } catch (error) {
          throw new Error("无法绑定 Excalidraw 视图：" + (error && error.message));
        }
        try {
          if (typeof eaForView.registerThisAsViewEA === "function") eaForView.registerThisAsViewEA();
        } catch (error) { console.warn("[" + SCRIPT_NAME + "] registerThisAsViewEA", error); }
      },
      createBinding: (eaForView, deps) => mods.eaBindings.createEaBindings(eaForView, {
        getClientPointer: deps.getClientPointer,
        canvasEl: viewMember(deps.data, "canvasEl"),
        canvasRoot: viewMember(deps.data, "canvasRoot") ||
          viewMember(deps.data, "containerEl") ||
          (eaForView.targetView && (eaForView.targetView.containerEl || eaForView.targetView.contentEl)),
        readBinary: (file) => app.vault.readBinary(file),
        urlApi: URL,
      }),
      createEntry: (env) => {
        const binding = env.binding;
        return mods.hoverEntry.createHoverEntry({
          readSnapshot: () => binding.readSnapshot(),
          getClientPointer: env.getClientPointer,
          isPreviewOpen: () => !!(sharedLightbox && sharedLightbox.isOpen()),
          openPreview: (imageElement) => {
            previewKey = env.key;
            return binding.openPreview(imageElement, {
              lightbox: getLightbox(),
              notify,
              isActive: env.isActive,
            });
          },
          newButton: makeButton,
        });
      },
      onUnmount: (record) => {
        if (previewKey === record.key) {
          if (sharedLightbox) sharedLightbox.close();
          previewKey = null;
        }
      },
      onError: (error) => console.error("[" + SCRIPT_NAME + "] view lifecycle", error),
    });
    mount = lifecycle.install(host);

    let startupTimer = null;
    const cleanup = () => {
      cancelBoot();
      if (startupTimer != null) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      lifecycle.cleanup();
      if (sharedLightbox) sharedLightbox.close();
      sharedLightbox = null;
      previewKey = null;
      if (window.__exlCleanup === cleanup) window.__exlCleanup = null;
      window.__exlReady = false;
      window.__exlDebug = null;
    };
    window.__exlCleanup = cleanup;
    window.__exlDebug = () => ({
      views: lifecycle.getViewKeys(),
      ready: window.__exlReady,
      previewOpen: !!(sharedLightbox && sharedLightbox.isOpen()),
    });
    window.__exlReady = true;

    // Startup Script 可能在已有标签恢复前执行。只对确认存在的活动视图挂载，
    // 并在短时间内重试恢复过程，不调用 setView 伪造视图。
    const mountActiveView = () => {
      if (lifecycle.getViewCount() > 0) return true;
      const activeEA = getHookHost() || host;
      if (!activeEA) return false;
      if (typeof activeEA.setView === "function") {
        try { activeEA.setView("active"); } catch (error) { /* startup recovery retries */ }
      }
      const activeView = activeEA.targetView;
      if (!activeView ||
          (typeof activeView._loaded !== "undefined" && !activeView._loaded)) return false;
      try {
        lifecycle.mountView({ ea: activeEA, view: activeView });
        return lifecycle.getViewCount() > 0;
      } catch (error) {
        return false;
      }
    };
    if (!mountActiveView()) {
      const startedAt = Date.now();
      const retryActiveView = () => {
        startupTimer = null;
        if (!window.__exlReady || !isCurrentBoot()) return;
        if (mountActiveView() || Date.now() - startedAt >= BOOT_TIMEOUT_MS) return;
        startupTimer = setTimeout(retryActiveView, BOOT_POLL_MS);
      };
      startupTimer = setTimeout(retryActiveView, BOOT_POLL_MS);
    }

    notify("「" + SCRIPT_NAME + "」已注册全局挂载。打开 Excalidraw 画布后悬停图片 → 点右上角全屏图标。", 5000);
  } catch (error) {
    console.error("[" + SCRIPT_NAME + "]", error);
    notify("启用失败：" + (error && error.message), 7000);
  }
})();
