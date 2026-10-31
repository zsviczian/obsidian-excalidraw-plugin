/*
图片悬停放大
悬停图片元素 → 右上角全屏图标 → 点击打开遮罩层大图（点空白/ESC 关闭）

用法（二选一）：
1. 自动加载（推荐）：Excalidraw 设置 → Startup Script 指向本文件
2. 手动：在任意画布运行一次；后续打开画布由 onFileOpenHook 自动挂载

迁移到 vault 后，请按实际目录修改 MODULE_DIR。
```javascript
*/
(async function () {
  "use strict";

  const SCRIPT_NAME = "图片悬停放大";
  const MODULE_DIR = "Excalidraw/Module";
  const MODULES = {
    geometry: MODULE_DIR + "/geometry.js",
    lightbox: MODULE_DIR + "/lightbox.js",
    hoverEntry: MODULE_DIR + "/hoverEntry.js",
    eaBindings: MODULE_DIR + "/eaBindings.js",
    globalMount: MODULE_DIR + "/globalMount.js",
    viewEa: MODULE_DIR + "/viewEa.js",
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

  const viewDocumentOf = (data, fallback) => {
    const view = data && data.view && typeof data.view === "object"
      ? data.view
      : data && data.leaf && data.leaf.view && typeof data.leaf.view === "object"
        ? data.leaf.view
        : null;
    const candidates = [
      data && data.ownerDocument,
      data && data.document,
      view && view.ownerDocument,
      view && view.containerEl && view.containerEl.ownerDocument,
      view && view.contentEl && view.contentEl.ownerDocument,
      fallback,
    ];
    return candidates.find((value) => value && typeof value.addEventListener === "function") || fallback;
  };

  const viewWindowOf = (data, ownerDocument) => {
    const view = data && data.view && typeof data.view === "object"
      ? data.view
      : data && data.leaf && data.leaf.view && typeof data.leaf.view === "object"
        ? data.leaf.view
        : null;
    return (data && data.ownerWindow) ||
      (view && view.ownerWindow) ||
      (ownerDocument && ownerDocument.defaultView) ||
      (typeof window !== "undefined" ? window : null);
  };

  // BEGIN MODULE LOADER
  const loadModules = async () => {
    const geometry = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      /**
       * 几何与策略（S1）
       * 坐标对齐 Excalidraw 官方：
       *   screenX = (sceneX + scrollX) * zoom.value + offsetLeft
       *   sceneX  = (screenX - offsetLeft) / zoom.value - scrollX
       * zoom 可能是 number 或 { value:number }
       */

      function normalizeZoom(zoom) {
        if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) return zoom;
        if (zoom && typeof zoom.value === "number" && isFinite(zoom.value) && zoom.value > 0) {
          return zoom.value;
        }
        return 1;
      }

      function normalizeView(view) {
        view = view || {};
        return {
          zoom: normalizeZoom(view.zoom),
          scrollX: typeof view.scrollX === "number" ? view.scrollX : 0,
          scrollY: typeof view.scrollY === "number" ? view.scrollY : 0,
          // 优先用 appState.offsetLeft/Top（比 getBoundingClientRect 更准）
          offsetLeft: typeof view.offsetLeft === "number" ? view.offsetLeft : (view.containerLeft || 0),
          offsetTop: typeof view.offsetTop === "number" ? view.offsetTop : (view.containerTop || 0),
          width: typeof view.width === "number" ? view.width : 0,
          height: typeof view.height === "number" ? view.height : 0,
        };
      }

      /** 屏幕（client）→ 场景 */
      function clientToScene(clientX, clientY, view) {
        const v = normalizeView(view);
        return {
          x: (clientX - v.offsetLeft) / v.zoom - v.scrollX,
          y: (clientY - v.offsetTop) / v.zoom - v.scrollY,
        };
      }

      /** 场景 → 屏幕（client/fixed） */
      function sceneToScreen(sceneX, sceneY, view) {
        const v = normalizeView(view);
        return {
          x: (sceneX + v.scrollX) * v.zoom + v.offsetLeft,
          y: (sceneY + v.scrollY) * v.zoom + v.offsetTop,
        };
      }

      function elementScreenAabb(el, view) {
        const tl = sceneToScreen(el.x, el.y, view);
        const br = sceneToScreen(el.x + el.width, el.y + el.height, view);
        return {
          x: Math.min(tl.x, br.x),
          y: Math.min(tl.y, br.y),
          width: Math.abs(br.x - tl.x),
          height: Math.abs(br.y - tl.y),
        };
      }

      /** 兼容旧：视口坐标 = 相对 offset 的坐标 */
      function elementViewportAabb(el, view) {
        const v = normalizeView(view);
        return {
          x: (el.x + v.scrollX) * v.zoom,
          y: (el.y + v.scrollY) * v.zoom,
          width: el.width * v.zoom,
          height: el.height * v.zoom,
        };
      }

      function scenePointToViewport(px, py, view) {
        const v = normalizeView(view);
        return {
          x: (px + v.scrollX) * v.zoom,
          y: (py + v.scrollY) * v.zoom,
        };
      }

      function pointInAabb(px, py, aabb) {
        return (
          px >= aabb.x &&
          px <= aabb.x + aabb.width &&
          py >= aabb.y &&
          py <= aabb.y + aabb.height
        );
      }

      /** 场景 AABB 命中（忽略旋转） */
      function hitTopmostImage(pointerX, pointerY, els) {
        let hit = null;
        for (const el of els || []) {
          if (!el || el.type !== "image" || el.isDeleted) continue;
          if (
            pointerX >= el.x &&
            pointerX <= el.x + el.width &&
            pointerY >= el.y &&
            pointerY <= el.y + el.height
          ) {
            hit = el;
          }
        }
        return hit;
      }

      const DEFAULT_SMALL = { minWidth: 40, minHeight: 40 };

      function isSmallImage(el, view, thresholds) {
        const t = Object.assign({}, DEFAULT_SMALL, thresholds || {});
        const v = normalizeView(view);
        const w = el.width * v.zoom;
        const h = el.height * v.zoom;
        return w < t.minWidth || h < t.minHeight;
      }

      function isInViewport(aabb, viewportSize) {
        return (
          aabb.x < viewportSize.width &&
          aabb.y < viewportSize.height &&
          aabb.x + aabb.width > 0 &&
          aabb.y + aabb.height > 0
        );
      }

      const DEFAULT_INSET = { x: 6, y: 6 };
      // 悬停按钮的真实固定尺寸；入口 CSS 与屏幕锚点必须共用这组值。
      const BUTTON_SIZE = 30;
      const BUTTON_ICON_SIZE = 16;

      /** 图片内右上角按钮左上角（screen fixed） */
      function buttonAnchorScreen(el, view, container, inset) {
        const i = Object.assign({}, DEFAULT_INSET, inset || {});
        const v = normalizeView(view);
        // 合并 container 到 view offset（若 view 未带 offset）
        if (!view || (view.offsetLeft == null && container)) {
          v.offsetLeft = container.left || 0;
          v.offsetTop = container.top || 0;
          v.width = container.width || v.width;
          v.height = container.height || v.height;
        }
        const aabb = elementScreenAabb(el, v);
        const vp = elementViewportAabb(el, v);
        const vw = v.width || (container && container.width) || 0;
        const vh = v.height || (container && container.height) || 0;
        if (vw > 0 && vh > 0 && !isInViewport(vp, { width: vw, height: vh })) {
          return null;
        }
        return {
          x: aabb.x + aabb.width - BUTTON_SIZE - i.x,
          y: aabb.y + i.y,
        };
      }

      function anchorTopRight(aabb, inset) {
        const i = Object.assign({}, DEFAULT_INSET, inset || {});
        return {
          x: aabb.x + aabb.width - BUTTON_SIZE - i.x,
          y: aabb.y + i.y,
        };
      }

      function toScreenPoint(vpPoint, container) {
        return {
          x: vpPoint.x + ((container && container.left) || 0),
          y: vpPoint.y + ((container && container.top) || 0),
        };
      }

      module.exports = {
        normalizeZoom: normalizeZoom,
        normalizeView: normalizeView,
        clientToScene: clientToScene,
        sceneToScreen: sceneToScreen,
        elementScreenAabb: elementScreenAabb,
        elementViewportAabb: elementViewportAabb,
        scenePointToViewport: scenePointToViewport,
        pointInAabb: pointInAabb,
        hitTopmostImage: hitTopmostImage,
        isSmallImage: isSmallImage,
        isInViewport: isInViewport,
        anchorTopRight: anchorTopRight,
        toScreenPoint: toScreenPoint,
        buttonAnchorScreen: buttonAnchorScreen,
        DEFAULT_SMALL: DEFAULT_SMALL,
        DEFAULT_INSET: DEFAULT_INSET,
        BUTTON_SIZE: BUTTON_SIZE,
        BUTTON_ICON_SIZE: BUTTON_ICON_SIZE,
      };
      return module.exports;
    })();
    const lightbox = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      /**
       * 遮罩层预览（Lightbox）控制器（S2）。
       *
       * 与 Image Toolkit Normal Mode 对齐：全屏半透明遮罩 + 居中大图；
       * 滚轮缩放、拖动平移；点遮罩空白或 ESC 关闭；同时仅一张（单例）。
       *
       * DOM/事件接线通过注入的 adapter（dom）完成，便于在无 Obsidian UI 下
       * 对公开行为（open/close/单例/点空白/ESC）做自动化测试。真实环境的
       * 事件接线由 buildRealDom() 提供（薄适配层，不被深 mock）。
       *
       * 对外公开接口：
       *   open(source) / close() / isOpen()
       *   onBackdropClick(isImageTarget) / onKeyDown(key)
       *   setScale(v) / zoomBy(factor) / panBy(dx, dy) / fitScale(...)
       */

      function clamp(v, min, max) {
        if (v < min) return min;
        if (v > max) return max;
        return v;
      }

      const DEFAULTS = { minScale: 0.1, maxScale: 8, maxRatio: 0.9 };

      function createLightbox(dom, opts) {
        opts = Object.assign({}, DEFAULTS, opts || {});
        const minScale = opts.minScale;
        const maxScale = opts.maxScale;

        let state = null; // { mask, imageEl, scale, panX, panY, source, released }
        let cleanup = null;
        let lastError = null;
        let generation = 0;

        function isOpen() {
          return state !== null;
        }

        function releaseSource(current) {
          if (!current || current.released) return;
          current.released = true;
          const release = current.source && (
            current.source.release ||
            (current.source.source && current.source.source.release)
          );
          if (typeof release === "function") {
            try { release(); } catch (e) { /* 资源释放失败不阻塞关闭 */ }
          }
        }

        function close() {
          if (!state) return false;
          const current = state;
          generation += 1;
          if (cleanup) { try { cleanup(); } catch (e) { /* 忽略卸载异常 */ } }
          cleanup = null;
          try { dom.remove(current.mask); } catch (e) { /* 忽略 */ }
          state = null;
          releaseSource(current);
          return true;
        }

        function _fail(err, expectedGeneration, expectedState) {
          if (expectedGeneration !== generation || expectedState !== state) return;
          lastError = err;
          close();
          if (typeof opts.onError === "function") opts.onError(err);
        }

        /**
         * 打开遮罩层预览。单例：新开替换旧开。
         * @param {object} source 数据源（透传给 loadImage）
         */
        function open(source) {
          close(); // 单例替换：不堆叠
          lastError = null;
          const currentGeneration = ++generation;

          const mask = dom.createLayer();
          const imageEl = dom.createImage();
          if (mask.appendChild) mask.appendChild(imageEl);
          dom.append(mask);
          state = {
            mask,
            imageEl,
            scale: 1,
            panX: 0,
            panY: 0,
            source: source,
            released: false,
          };
          const currentState = state;

          if (typeof dom.wire === "function") {
            cleanup = dom.wire(state) || null;
          }

          const load = opts.loadImage;
          if (typeof load === "function") {
            let out;
            try {
              out = load(imageEl, source);
            } catch (err) {
              _fail(err, currentGeneration, currentState);
              return;
            }
            if (out && typeof out.then === "function") {
              out.then(null, (err) => _fail(err, currentGeneration, currentState));
            }
          }
        }

        /** 点遮罩：点图片本体不关；点遮罩空白关闭。 */
        function onBackdropClick(isImageTarget) {
          if (!isOpen()) return;
          if (isImageTarget) return; // 点大图响应缩放/拖动，不关闭
          close();
        }

        /** ESC 关闭。 */
        function onKeyDown(key) {
          if (!isOpen()) return;
          if (key === "Escape" || key === "Esc") close();
        }

        function setScale(v) {
          if (!isOpen()) return false;
          state.scale = clamp(v, minScale, maxScale);
          return state.scale;
        }

        function zoomBy(factor) {
          if (!isOpen()) return false;
          state.scale = clamp(state.scale * factor, minScale, maxScale);
          return state.scale;
        }

        function panBy(dx, dy) {
          if (!isOpen()) return false;
          state.panX += dx;
          state.panY += dy;
          return { x: state.panX, y: state.panY };
        }

        /** 初始居中缩放：让大图按 maxRatio 适应视口。 */
        function fitScale(naturalW, naturalH, viewportW, viewportH) {
          if (!naturalW || !naturalH || !viewportW || !viewportH) return 1;
          const mw = viewportW * opts.maxRatio;
          const mh = viewportH * opts.maxRatio;
          return clamp(Math.min(mw / naturalW, mh / naturalH), minScale, maxScale);
        }

        return {
          open,
          close,
          isOpen,
          onBackdropClick,
          onKeyDown,
          setScale,
          zoomBy,
          panBy,
          fitScale,
          getState: () => state,
          getLastError: () => lastError,
        };
      }

      /**
       * 真实环境（Obsidian 浏览器上下文）DOM adapter。
       * 用原生 document/window，事件接线含：点遮罩空白/大图、ESC、滚轮缩放、拖动。
       * @param {() => Controller} [getController] 返回当前 lightbox 控制器（用于事件回调）
       * @param {{document?:Document,window?:Window}} [domOptions] 视图所属文档与窗口
       */
        function buildRealDom(getController, domOptions) {
        domOptions = domOptions || {};
        const root = domOptions.document || (typeof document !== "undefined" && document) || null;
        const view = domOptions.window || (root && root.defaultView) ||
          (typeof window !== "undefined" && window) || null;

        const ctrl = () => (typeof getController === "function" ? getController() : null);

        function viewportSize() {
          const el = (root && (root.documentElement || root.body)) || { clientWidth: 0, clientHeight: 0 };
          return {
            width: el.clientWidth || (view && view.innerWidth) || 0,
            height: el.clientHeight || (view && view.innerHeight) || 0,
          };
        }

        function applyTransform(st) {
          const vp = viewportSize();
          const naturalW = st.imageEl.naturalWidth || 0;
          const naturalH = st.imageEl.naturalHeight || 0;
          const c = ctrl();
          if (!st.hasFitted && naturalW > 0 && naturalH > 0 && c) {
            c.setScale(c.fitScale(naturalW, naturalH, vp.width, vp.height));
            st.hasFitted = true;
          }
          const base = naturalW > 0 ? naturalW : Math.min(vp.width, vp.height) * 0.9;
          st.imageEl.style.width = st.scale * base + "px";
          if (naturalW > 0 && naturalH > 0) {
            st.imageEl.style.height = st.scale * naturalH + "px";
          } else {
            st.imageEl.style.height = "auto";
          }
          st.imageEl.style.transform = `translate(${st.panX}px, ${st.panY}px)`;
        }

        return {
          createLayer() {
            const mask = root.createElement("div");
            mask.className = "excalidraw-lightbox-mask";
            Object.assign(mask.style, {
              position: "fixed",
              inset: "0",
              zIndex: "9999",
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
            });
            return mask;
          },
          createImage() {
            const img = root.createElement("img");
            Object.assign(img.style, {
              maxWidth: "none",
              maxHeight: "none",
              userSelect: "none",
              display: "block",
              cursor: "grab",
            });
            img.draggable = false;
            return img;
          },
          append(layer) { (root.body || root).appendChild(layer); },
          remove(layer) { if (layer && layer.parentNode) layer.parentNode.removeChild(layer); },
          wire(st) {
            const mask = st.mask;
            const img = st.imageEl;

            // loadImage 在 wire 之后设置 src；监听 load，按图片真实尺寸重新 fit。
            const loadHandler = () => applyTransform(st);
            img.addEventListener("load", loadHandler);

            // 点遮罩：target 为大图本体 → 不关；否则（遮罩空白）→ 关
            const clickHandler = (e) => {
              if (typeof e.preventDefault === "function") e.preventDefault();
              const c = ctrl();
              if (c) c.onBackdropClick(e.target === img);
            };
            mask.addEventListener("click", clickHandler);

            // ESC 关闭（仅大图打开期间）
            const keyHandler = (e) => {
              const c = ctrl();
              if (c) c.onKeyDown(e.key);
            };
            root.addEventListener("keydown", keyHandler);

            // 滚轮缩放
            const wheelHandler = (e) => {
              if (typeof e.preventDefault === "function") e.preventDefault();
              const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
              const c = ctrl();
              if (c) c.zoomBy(factor);
              applyTransform(st);
            };
            mask.addEventListener("wheel", wheelHandler, { passive: false });

            // 拖动平移
            let drag = null;
            const down = (e) => {
              if (e.button !== 0) return;
              drag = { x: e.clientX, y: e.clientY };
              img.style.cursor = "grabbing";
              if (typeof e.preventDefault === "function") e.preventDefault();
              if (typeof e.stopPropagation === "function") e.stopPropagation();
            };
            const move = (e) => {
              if (!drag) return;
              const dx = e.clientX - drag.x;
              const dy = e.clientY - drag.y;
              drag = { x: e.clientX, y: e.clientY };
              const c = ctrl();
              if (c) c.panBy(dx, dy);
              applyTransform(st);
            };
            const up = () => {
              if (!drag) return;
              drag = null;
              img.style.cursor = "grab";
            };
            mask.addEventListener("mousedown", down);
            root.addEventListener("mousemove", move);
            root.addEventListener("mouseup", up);

            // 初始定位（居中、适应视口）
            applyTransform(st);

            return function cleanup() {
              img.removeEventListener("load", loadHandler);
              mask.removeEventListener("click", clickHandler);
              root.removeEventListener("keydown", keyHandler);
              mask.removeEventListener("wheel", wheelHandler);
              mask.removeEventListener("mousedown", down);
              root.removeEventListener("mousemove", move);
              root.removeEventListener("mouseup", up);
            };
          },
        };
      }

      /**
       * 便捷工厂：给真实环境（Obsidian 页面）使用的 Lightbox。
       * loadImage 由调用方提供（把图片文件解析为 url 赋给 imageEl.src）。
       * domOptions 可指定视图所属的 document/window，支持 Popout 文档隔离。
       */
      function buildLightbox(opts, domOptions) {
        let ctrl = null;
        const dom = buildRealDom(() => ctrl, domOptions);
        ctrl = createLightbox(dom, opts);
        return ctrl;
      }

      module.exports = {
        createLightbox,
        buildRealDom,
        buildLightbox,
        clamp,
        DEFAULTS,
      };
      return module.exports;
    })();
    const hoverEntry = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        if (id === "./geometry.js" || id === "geometry.js") return geometry;
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      /**
       * 悬停入口按钮（03）。复用 geometry + lightbox 的公开接口。
       *
       * 分层：
       *  - decideEntrySnapshot：纯函数。对一次指针命中的即时决策，返回应否显示入口
       *    （未命中 / 小图 / 出可视区 / 预览打开期间 → 不显示）以及按钮屏幕锚点。
       *    可单测。
       *  - createHoverGate：防闪灭延迟状态机。指针离开图→按钮的途中保持显示，
       *    超时未重新命中才隐藏。时钟注入，可单测。
       *  - createHoverEntry：薄适配层（不深 mock）。接线 ea/DOM：监听指针、pan/zoom
       *    重算锚点、创建并定位 DOM 全屏图标、点击图标 stopPropagation 打开 lightbox。
       *    对外暴露 mount()/unmount() 给 04 全局挂载。
       *
       * 约束：入口按钮是 DOM 覆盖层，绝不写入 Excalidraw scene；点击图片本体不打开。
       */

      const geo = require("./geometry.js");

      const SMALL_DEFAULT = { minWidth: 48, minHeight: 48 };
      const INSET_DEFAULT = { x: 6, y: 6 };
      const BUTTON_SIZE = geo.BUTTON_SIZE || 30;
      const BUTTON_ICON_SIZE = geo.BUTTON_ICON_SIZE || 16;

      /**
       * 创建默认悬停入口按钮。
       *
       * 按钮容器与图标尺寸在这里集中定义，几何模块只负责用同一容器尺寸
       * 计算屏幕锚点，避免 CSS 与坐标常量再次分叉。
       */
      function createDefaultButton(doc) {
        const root = doc || (typeof document !== "undefined" ? document : null);
        if (!root || typeof root.createElement !== "function") return null;

        const button = root.createElement("div");
        button.className = "excalidraw-hover-entry-btn";
        button.title = "查看大图";
        if (typeof button.setAttribute === "function") {
          button.setAttribute("aria-label", "查看大图");
        }
        button.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + BUTTON_ICON_SIZE + '" height="' + BUTTON_ICON_SIZE + '" viewBox="0 0 24 24" fill="none" ' +
          'style="display:block;width:' + BUTTON_ICON_SIZE + 'px;height:' + BUTTON_ICON_SIZE + 'px;flex:0 0 ' + BUTTON_ICON_SIZE + 'px;pointer-events:none;" ' +
          'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
          '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
          '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>' +
          '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
          "</svg>";
        button.style.cssText =
          "position:fixed;z-index:2147483000;cursor:pointer;width:" + BUTTON_SIZE + "px;height:" + BUTTON_SIZE + "px;" +
          "display:flex;align-items:center;justify-content:center;" +
          "border-radius:6px;background:rgba(0,0,0,.72);color:#fff;user-select:none;" +
          "box-sizing:border-box;padding:0;border:0;line-height:0;pointer-events:auto;" +
          "box-shadow:0 2px 8px rgba(0,0,0,.35);";
        return button;
      }

      /**
       * 单次命中决策。
       * @param {{x:number,y:number}} pointer 指针场景坐标
       * @param {Array} images 图片元素列表（z 序自底向上）
       * @param {{zoom:number,scrollX:number,scrollY:number}} view 视图参数
       * @param {{left:number,top:number,width:number,height:number}} container 画布容器矩形
       * @param {{inset?:object,small?:object,previewOpen?:boolean}} [opts]
       * @returns {{hitEl:object|null, anchor:{x:number,y:number}|null}}
       */
      function decideEntrySnapshot(pointer, images, view, container, opts) {
        opts = opts || {};
        if (opts.previewOpen) return { hitEl: null, anchor: null };

        const hitEl = geo.hitTopmostImage(pointer.x, pointer.y, images, view);
        if (!hitEl) return { hitEl: null, anchor: null };

        if (geo.isSmallImage(hitEl, view, opts.small || SMALL_DEFAULT)) {
          return { hitEl, anchor: null };
        }

        const anchor = geo.buttonAnchorScreen(hitEl, view, container, opts.inset || INSET_DEFAULT);
        return { hitEl, anchor };
      }

      /**
       * 防闪灭延迟状态机。注入 now 时钟以便单测。
       * @param {{now?:()=>number, delay?:number}} [opts]
       * @returns {{update(hit:boolean)=>boolean, peek():{visible:boolean,pendingHideAt:number|null}}}
       */
      function createHoverGate(opts) {
        opts = opts || {};
        const delay = opts.delay == null ? 150 : opts.delay;
        const now = opts.now || (() =>
          (typeof performance !== "undefined" ? performance.now() : Date.now()));

        let visible = false;
        let pendingHideAt = null;

        function update(hit) {
          const t = now();
          if (hit) {
            visible = true;
            pendingHideAt = null;
          } else if (visible) {
            if (pendingHideAt == null) pendingHideAt = t + delay;
            if (t >= pendingHideAt) {
              visible = false;
              pendingHideAt = null;
            }
          }
          return visible;
        }

        return { update, peek: () => ({ visible, pendingHideAt }) };
      }

      /**
       * 薄适配层：把 ea/DOM 接线到上面的决策与状态机，实现右上角 DOM 全屏图标。
       * 点击图片本体不拦截（Excalidraw 默认）；只在按钮上 stopPropagation 打开预览。
       *
       * @param {object} env 依赖注入
       *  - readSnapshot(): { pointer, images, view, container, opts? }  读取即时参数（ea/EA API）
       *  - isPreviewOpen(): boolean                                     lightbox 是否打开
       *  - openPreview(hitEl): void                                     打开与 02 相同的遮罩层预览
       *  - newButton?(): HTMLElement                                    创建入口按钮（默认 document.createElement）
       *  - delay?: number / now?: () => number                          传给 gate
       * @returns {{ mount():void, unmount():void, update():void }}
       */
      function createHoverEntry(env) {
        if (!env || typeof env.readSnapshot !== "function") {
          throw new Error("hoverEntry: 需要 env.readSnapshot()");
        }

        const doc = env.document || (typeof document !== "undefined" ? document : null);
        const gate = createHoverGate({ delay: env.delay, now: env.now });
        let button = null;
        let mounted = false;
        let lastHitEl = null;
        let lastAnchor = null;
        let activationHandled = false;

        function isPointerOverButton() {
          if (!button || typeof button.getBoundingClientRect !== "function") return false;
          if (typeof env.getClientPointer !== "function") return false;
          const point = env.getClientPointer();
          if (!point || typeof point.x !== "number" || typeof point.y !== "number") return false;
          const rect = button.getBoundingClientRect();
          return point.x >= rect.left && point.x <= rect.right &&
            point.y >= rect.top && point.y <= rect.bottom;
        }

        function ensureButton() {
          if (button) return button;
          if (env.newButton) {
            button = env.newButton();
          } else {
            // 默认：四角「全屏/展开」图标（非放大镜、非方案类文档图标）
            button = createDefaultButton(doc);
          }
          if (button) {
            button.style.display = "none";
            const stopButtonEvent = (e) => {
              if (typeof e.stopPropagation === "function") e.stopPropagation();
              if (typeof e.preventDefault === "function") e.preventDefault();
              if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
            };
            const activate = (e) => {
              stopButtonEvent(e);
              // 一个物理点击可能依次产生 pointerdown/mousedown/click；只打开一次。
              // pointerdown 是下一次物理操作的明确起点，即使上一轮没有 click 也要重置。
              if (e.type === "pointerdown" && activationHandled) activationHandled = false;
              if (activationHandled) {
                if (e.type === "click") activationHandled = false;
                return;
              }
              activationHandled = true;
              if (lastHitEl && typeof env.openPreview === "function") env.openPreview(lastHitEl);
              // 键盘或测试直接触发 click 时，没有 pointerdown 帮忙解锁。
              if (e.type === "click") activationHandled = false;
            };
            // 用 capture 抢在 Excalidraw 之前
            button.addEventListener("pointerdown", activate, true);
            button.addEventListener("mousedown", activate, true);
            button.addEventListener("click", activate, true);
            button._cleanupEntry = () => {
              button.removeEventListener("pointerdown", activate, true);
              button.removeEventListener("mousedown", activate, true);
              button.removeEventListener("click", activate, true);
            };
          }
          return button;
        }

        /** 重算一次：读参数 → 决策 → 更新 gate 可见性 → 定位/显隐按钮。 */
        function update() {
          if (!mounted) return;
          if (!button) ensureButton();
          const snap = env.readSnapshot();
          const previewOpen = env.isPreviewOpen ? env.isPreviewOpen() : false;
          const pointerOverButton = typeof env.isPointerOverButton === "function"
            ? env.isPointerOverButton(button)
            : isPointerOverButton();
          const pointerInside = snap.pointerInside !== false;
          const r = pointerInside
            ? decideEntrySnapshot(
              snap.pointer, snap.images, snap.view, snap.container,
              Object.assign({ previewOpen }, snap.opts || {})
            )
            : { hitEl: null, anchor: null };
          if (r.hitEl) lastHitEl = r.hitEl;
          if (r.anchor) lastAnchor = r.anchor;
          if (previewOpen) {
            gate.update(false);
            if (button) button.style.display = "none";
            return;
          }
          const visible = gate.update((pointerInside && r.anchor != null) || pointerOverButton);
          if (!button) return;
          const anchor = r.anchor || lastAnchor;
          if (visible && anchor) {
            button.style.left = anchor.x + "px";
            button.style.top = anchor.y + "px";
            // 保留按钮工厂的 flex 布局；使用 block 会让图标失去居中约束。
            button.style.display = "flex";
          } else {
            button.style.display = "none";
          }
        }

        function mount() {
          if (mounted) return unmount;
          mounted = true;
          ensureButton();
          if (button && doc && button.parentNode !== doc.body) doc.body.appendChild(button);
          return unmount;
        }

        function unmount() {
          if (!mounted) return;
          mounted = false;
          activationHandled = false;
          lastHitEl = null;
          lastAnchor = null;
          if (button) {
            if (button._cleanupEntry) button._cleanupEntry();
            if (button.parentNode) button.parentNode.removeChild(button);
          }
          button = null;
        }

        return { mount, unmount, update };
      }

      module.exports = {
        decideEntrySnapshot,
        createHoverGate,
        createHoverEntry,
        createDefaultButton,
        SMALL_DEFAULT,
        INSET_DEFAULT,
        BUTTON_SIZE,
        BUTTON_ICON_SIZE,
      };
      return module.exports;
    })();
    const eaBindings = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      const MIME = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        svg: "image/svg+xml",
      };

      function filterImageElements(elements) {
        return (elements || []).filter((e) => e && e.type === "image" && !e.isDeleted);
      }

      function canvasRectOf(canvasEl) {
        if (!canvasEl || typeof canvasEl.getBoundingClientRect !== "function") return null;
        const r = canvasEl.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }

      function normalizeZoom(zoom) {
        if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) return zoom;
        if (zoom && typeof zoom.value === "number" && isFinite(zoom.value) && zoom.value > 0) {
          return zoom.value;
        }
        return 1;
      }

      /** 从 API 读完整视图参数（含 offsetLeft/Top，官方转换必需） */
      function appStateOf(api) {
        if (!api || typeof api.getAppState !== "function") {
          return {
            zoom: 1,
            scrollX: 0,
            scrollY: 0,
            offsetLeft: 0,
            offsetTop: 0,
            width: 0,
            height: 0,
          };
        }
        const s = api.getAppState() || {};
        return {
          zoom: normalizeZoom(s.zoom),
          scrollX: typeof s.scrollX === "number" ? s.scrollX : 0,
          scrollY: typeof s.scrollY === "number" ? s.scrollY : 0,
          offsetLeft: typeof s.offsetLeft === "number" ? s.offsetLeft : 0,
          offsetTop: typeof s.offsetTop === "number" ? s.offsetTop : 0,
          width: typeof s.width === "number" ? s.width : 0,
          height: typeof s.height === "number" ? s.height : 0,
        };
      }

      function mimeFor(name) {
        const ext = String(name || "").trim().split(".").pop().toLowerCase();
        return MIME[ext];
      }

      function resolveImageSource(ea, el) {
        if (!ea || typeof ea.getViewFileForImageElement !== "function") {
          return { ok: false, reason: "ea 缺少 getViewFileForImageElement" };
        }
        let file;
        try {
          file = ea.getViewFileForImageElement(el);
        } catch (error) {
          return { ok: false, reason: "解析图片对应文件失败：" + (error && error.message) };
        }
        if (!file) return { ok: false, reason: "无法解析图片对应的文件" };
        const mime = mimeFor(file.name);
        if (!mime) {
          return {
            ok: false,
            reason: /\.(md|excalidraw\.md)$/i.test(file.name)
              ? "暂不支持笔记/Excalidraw 内嵌预览（请用 PNG/JPG/SVG）"
              : "不支持的图片格式：" + file.name,
          };
        }
        return { ok: true, file: file, mime: mime, name: file.name };
      }

      function findCanvasContainer(root) {
        const scope = root || (typeof document !== "undefined" ? document : null);
        const trySel = (sel) => {
          try {
            return scope && typeof scope.querySelector === "function"
              ? scope.querySelector(sel)
              : null;
          } catch (e) {
            return null;
          }
        };
        return (
          trySel(".excalidraw .excalidraw-wrapper") ||
          trySel(".excalidraw") ||
          trySel("canvas.excalidraw__canvas") ||
          trySel(".excalidraw__canvas")
        );
      }

      /**
       * @param ea
       * @param deps {{ getClientPointer?: () => {x,y}|null }}
       */
      function createEaBindings(ea, deps) {
        deps = deps || {};

        const readBinary =
          typeof deps.readBinary === "function"
            ? deps.readBinary
            : (file) => app.vault.readBinary(file);
        const urlApi = deps.urlApi || URL;

        function readSnapshot() {
          const api = typeof ea.getExcalidrawAPI === "function" ? ea.getExcalidrawAPI() : null;
          const view = appStateOf(api);

          // 容器：优先 appState offset + width/height
          let container = {
            left: view.offsetLeft,
            top: view.offsetTop,
            width: view.width,
            height: view.height,
          };
          // 若 offset/尺寸不完整，回退 DOM rect。宽度有效但高度尚未就绪时也要回退。
          if (!container.width || !container.height) {
            let el = null;
            if (typeof deps.canvasEl === "function") el = deps.canvasEl();
            else if (deps.canvasEl) el = deps.canvasEl;
            if (!el) {
              const root = typeof deps.canvasRoot === "function" ? deps.canvasRoot() : deps.canvasRoot;
              el = findCanvasContainer(root);
            }
            const r = canvasRectOf(el);
            if (r) {
              container = r;
              view.offsetLeft = r.left;
              view.offsetTop = r.top;
              view.width = r.width;
              view.height = r.height;
            }
          }

          // 指针：优先真实鼠标 client 坐标换算（不依赖 EA 内部 lastPointer）
          let pointer = { x: 0, y: 0 };
          let pointerInside = null;
          const client =
            typeof deps.getClientPointer === "function" ? deps.getClientPointer() : null;
          if (client && typeof client.x === "number") {
            const zoom = view.zoom || 1;
            if (container.width > 0 && container.height > 0) {
              pointerInside = client.x >= container.left &&
                client.x <= container.left + container.width &&
                client.y >= container.top &&
                client.y <= container.top + container.height;
            }
            pointer = {
              x: (client.x - view.offsetLeft) / zoom - view.scrollX,
              y: (client.y - view.offsetTop) / zoom - view.scrollY,
            };
          } else if (typeof ea.getViewLastPointerPosition === "function") {
            const p = ea.getViewLastPointerPosition();
            if (p && typeof p.x === "number") pointer = p;
          }

          const raw =
            typeof ea.getViewElements === "function"
              ? ea.getViewElements()
              : api && typeof api.getSceneElements === "function"
                ? api.getSceneElements()
                : [];
          const images = filterImageElements(raw);

          return {
            pointer: pointer,
            images: images,
            view: view,
            container: container,
            pointerInside: pointerInside,
          };
        }

        async function openPreview(hitEl, ctx) {
          const notify = (ctx && ctx.notify) || function () {};
          const src = resolveImageSource(ea, hitEl);
          if (!src.ok) {
            notify(src.reason);
            return;
          }
          let release = null;
          try {
            const data = await readBinary(src.file);
            const blob = new Blob([data], { type: src.mime });
            const url = urlApi.createObjectURL(blob);
            let released = false;
            release = () => {
              if (released) return;
              released = true;
              urlApi.revokeObjectURL(url);
            };
            if (ctx && typeof ctx.isActive === "function" && !ctx.isActive()) {
              release();
              return;
            }
            if (!ctx || !ctx.lightbox) {
              release();
              return;
            }
            ctx.lightbox.open({
              raw: hitEl,
              url: url,
              source: { url: url, release: release },
              file: src.file,
              name: src.name,
              el: { name: src.name },
            });
          } catch (e) {
            if (release) release();
            notify("大图资源解析失败：" + (e && e.message));
          }
        }

        return {
          readSnapshot: readSnapshot,
          openPreview: openPreview,
          resolveImageSource: resolveImageSource,
          findCanvasContainer: findCanvasContainer,
        };
      }

      module.exports = {
        filterImageElements: filterImageElements,
        canvasRectOf: canvasRectOf,
        appStateOf: appStateOf,
        normalizeZoom: normalizeZoom,
        mimeFor: mimeFor,
        resolveImageSource: resolveImageSource,
        findCanvasContainer: findCanvasContainer,
        createEaBindings: createEaBindings,
      };
      return module.exports;
    })();
    const globalMount = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      /**
       * Excalidraw 视图入口的生命周期模块。
       *
       * Interface:
       * - install(host): 注册 onFileOpenHook / onViewUnloadHook。
       * - mountView(data): 为一个视图创建独立 binding、entry、事件监听和刷新计时器。
       * - unmountView(view): 只卸载指定视图。
       * - cleanup(): 卸载全部视图并恢复 host 原有 hooks。
       * - getDocument(data, ea): 可选的视图文档 adapter。
       * - releaseEa(ea, record): 可选的稳定 EA 释放 adapter。
       *
       * createBinding(ea, deps) 与 createEntry(env) 是两个外部 adapter。模块只负责
       * 生命周期和隔离，不依赖 Obsidian 或 Excalidraw 的具体实现。
       */

      function defaultViewKey(data) {
        if (data && data.leaf != null) return data.leaf;
        if (data && data.view && typeof data.view === "object") return data.view;
        if (data && data.ea != null) return data.ea;
        if (data && data.view != null) return data.view;
        return data;
      }

      function defaultEa(data) {
        return data && data.ea ? data.ea : data;
      }

      function createGlobalMount(options) {
        options = options || {};
        if (typeof options.createBinding !== "function") {
          throw new Error("globalMount: 需要 createBinding(ea, deps)");
        }
        if (typeof options.createEntry !== "function") {
          throw new Error("globalMount: 需要 createEntry(env)");
        }

        const document = options.document || (typeof globalThis !== "undefined" ? globalThis.document : null);
        const getViewKey = options.getViewKey || defaultViewKey;
        const resolveEa = options.resolveEa || defaultEa;
        const setIntervalFn = options.setInterval || ((fn, ms) => setInterval(fn, ms));
        const clearIntervalFn = options.clearInterval || ((id) => clearInterval(id));
        const refreshMs = options.refreshMs == null ? 250 : options.refreshMs;
        const records = new Map();

        let installedHost = null;
        let previousOpen = null;
        let previousUnload = null;
        let wrappedOpen = null;
        let wrappedUnload = null;
        let installToken = 0;

        function keyOf(value) {
          const key = getViewKey(value);
          if (key == null) throw new Error("globalMount: 无法确定视图 key");
          return key;
        }

        function removeListener(record, type, listener) {
          const target = (record && record.document) || document;
          if (target && typeof target.removeEventListener === "function") {
            target.removeEventListener(type, listener, true);
          }
        }

        function addListener(record, type, listener) {
          const target = (record && record.document) || document;
          if (target && typeof target.addEventListener === "function") {
            target.addEventListener(type, listener, true);
          }
        }

        function teardown(record) {
          if (!record || record.tornDown) return false;
          record.tornDown = true;

          if (record.timer != null) {
            clearIntervalFn(record.timer);
            record.timer = null;
          }
          removeListener(record, "pointermove", record.onPointer);
          removeListener(record, "mousemove", record.onPointer);
          removeListener(record, "pointerdown", record.onPointer);

          if (typeof options.onUnmount === "function") {
            try { options.onUnmount(record); } catch (error) {
              if (typeof options.onError === "function") options.onError(error, record);
            }
          }
          if (record.entry && typeof record.entry.unmount === "function") {
            try {
              record.entry.unmount();
            } catch (error) {
              if (typeof options.onError === "function") options.onError(error, record);
            }
          }
          if (!record.eaReleased && typeof options.releaseEa === "function") {
            record.eaReleased = true;
            try {
              options.releaseEa(record.ea, record);
            } catch (error) {
              if (typeof options.onError === "function") options.onError(error, record);
            }
          }
          return true;
        }

        function unmountView(view) {
          let key;
          try {
            key = keyOf(view);
          } catch (error) {
            return false;
          }
          const record = records.get(key);
          if (!record) return false;
          records.delete(key);
          return teardown(record);
        }

        function mountView(data) {
          const key = keyOf(data);
          const ea = resolveEa(data);
          if (!ea) throw new Error("globalMount: 打开视图没有 ea");

          const old = records.get(key);
          if (old && old.ea === ea && !old.tornDown) {
            old.entry.mount();
            old.entry.update();
            return old;
          }
          if (old) {
            records.delete(key);
            teardown(old);
          }

          let lastClient = null;
          const record = {
            key,
            data,
            ea,
            binding: null,
            entry: null,
            timer: null,
            document: document,
            tornDown: false,
            eaReleased: false,
            getClientPointer: () => lastClient,
            onPointer: (event) => {
              if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
                lastClient = { x: event.clientX, y: event.clientY };
              }
              try {
                record.entry.update();
              } catch (error) {
                if (typeof options.onError === "function") options.onError(error, record);
              }
            },
          };

          try {
            if (typeof options.getDocument === "function") {
              record.document = options.getDocument(data, ea) || document;
            }
            if (typeof options.beforeMount === "function") {
              options.beforeMount(data, ea, record);
            }
            record.binding = options.createBinding(ea, {
              getClientPointer: record.getClientPointer,
              data,
              document: record.document,
            });
            record.entry = options.createEntry({
              key,
              data,
              ea,
              record,
              document: record.document,
              binding: record.binding,
              getClientPointer: record.getClientPointer,
              isActive: () => records.get(key) === record && !record.tornDown,
            });
            if (!record.entry || typeof record.entry.mount !== "function" ||
                typeof record.entry.unmount !== "function" || typeof record.entry.update !== "function") {
              throw new Error("globalMount: createEntry 返回值缺少 mount/unmount");
            }

            records.set(key, record);
            record.entry.mount();
            record.entry.update();
            addListener(record, "pointermove", record.onPointer);
            addListener(record, "mousemove", record.onPointer);
            addListener(record, "pointerdown", record.onPointer);
            record.timer = setIntervalFn(() => {
              if (record.tornDown) return;
              try {
                record.entry.update();
              } catch (error) {
                if (typeof options.onError === "function") options.onError(error, record);
              }
            }, refreshMs);
          } catch (error) {
            records.delete(key);
            teardown(record);
            throw error;
          }
          return record;
        }

        async function handleOpen(data, token, host, previous) {
          if (typeof previous === "function") await previous(data);
          // Startup Script 可能在旧 hook 尚未返回时被清理或重新安装。
          // 旧调用不能在新的生命周期之外重新创建监听器和计时器。
          if (token !== installToken || installedHost !== host) return false;
          return mountView(data);
        }

        function handleUnload(view, token, host, previous) {
          let previousError = null;
          try {
            if (typeof previous === "function") previous(view);
          } catch (error) {
            previousError = error;
          }
          const removed = token === installToken && installedHost === host
            ? unmountView(view)
            : false;
          if (previousError) throw previousError;
          return removed;
        }

        function install(host) {
          if (!host) throw new Error("globalMount: 需要 hooks host");
          if (installedHost === host) return cleanup;
          if (installedHost) cleanup();

          const token = ++installToken;
          const previous = host.onFileOpenHook;
          const previousUnloadHook = host.onViewUnloadHook;
          installedHost = host;
          previousOpen = previous;
          previousUnload = previousUnloadHook;
          wrappedOpen = (data) => handleOpen(data, token, host, previous);
          wrappedUnload = (view) => handleUnload(view, token, host, previousUnloadHook);
          host.onFileOpenHook = wrappedOpen;
          host.onViewUnloadHook = wrappedUnload;
          return cleanup;
        }

        function cleanup() {
          ++installToken;
          for (const [key, record] of records) {
            records.delete(key);
            teardown(record);
          }
          if (installedHost) {
            if (installedHost.onFileOpenHook === wrappedOpen) installedHost.onFileOpenHook = previousOpen;
            if (installedHost.onViewUnloadHook === wrappedUnload) installedHost.onViewUnloadHook = previousUnload;
          }
          installedHost = null;
          previousOpen = null;
          previousUnload = null;
          wrappedOpen = null;
          wrappedUnload = null;
        }

        return {
          install,
          mountView,
          unmountView,
          cleanup,
          getViewCount: () => records.size,
          getViewKeys: () => Array.from(records.keys()),
        };
      }

      module.exports = { createGlobalMount };
      return module.exports;
    })();
    const viewEa = (() => {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (id) => {
        throw new Error("Unsupported bundled require: " + id);
      };
      "use strict";

      /**
       * 为一个 Excalidraw view 创建并释放长期绑定的 EA。
       * onFileOpenHook 的 data.ea 是临时对象，不能作为这里的长期依赖。
       */

      function extractView(data) {
        if (data && data.view && typeof data.view === "object") return data.view;
        if (data && data.leaf && data.leaf.view && typeof data.leaf.view === "object") {
          return data.leaf.view;
        }
        return data && data._loaded !== undefined ? data : null;
      }

      function createViewEaAdapter(host) {
        if (!host || typeof host.getAPI !== "function") {
          throw new Error("viewEa: ExcalidrawAutomate 缺少 getAPI(view)");
        }

        return {
          resolve(data) {
            const view = extractView(data);
            if (!view) throw new Error("viewEa: 缺少 Excalidraw 视图");
            const ea = host.getAPI(view);
            if (!ea) throw new Error("viewEa: 无法创建稳定视图 EA");
            return ea;
          },
          release(ea) {
            if (ea && typeof ea.destroy === "function") ea.destroy();
          },
        };
      }

      module.exports = { extractView, createViewEaAdapter };
      return module.exports;
    })();
    return { lightbox, hoverEntry, eaBindings, globalMount, viewEa };
  };
  // END MODULE LOADER

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
    const viewEa = mods.viewEa.createViewEaAdapter(host);

    const lightboxes = new Map();

    const makeButton = (ownerDocument) => {
      return mods.hoverEntry.createDefaultButton(ownerDocument || document);
    };

    const getLightbox = (key, ownerDocument, ownerWindow) => {
      if (lightboxes.has(key)) return lightboxes.get(key);
      const lightbox = mods.lightbox.buildLightbox({
        loadImage: async (imageElement, source) => {
          await new Promise((resolve, reject) => {
            imageElement.onload = resolve;
            imageElement.onerror = () => reject(new Error("图片加载失败"));
            imageElement.src = source.url;
          });
        },
        onError: (error) => notify("大图失败：" + (error && error.message)),
      }, {
        document: ownerDocument || document,
        window: ownerWindow || (typeof window !== "undefined" ? window : null),
      });
      lightboxes.set(key, lightbox);
      return lightbox;
    };

    const isAnyLightboxOpen = () => {
      for (const lightbox of lightboxes.values()) {
        if (lightbox.isOpen()) return true;
      }
      return false;
    };

    const lifecycle = mods.globalMount.createGlobalMount({
      document,
      getViewKey: viewKeyOf,
      getDocument: (data) => viewDocumentOf(data, document),
      resolveEa: (data) => viewEa.resolve(data),
      releaseEa: (ea) => viewEa.release(ea),
      beforeMount: (data, eaForView) => {
        try { setViewForData(eaForView, data); } catch (error) {
          throw new Error("无法绑定 Excalidraw 视图：" + (error && error.message));
        }
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
          document: env.document,
          readSnapshot: () => binding.readSnapshot(),
          getClientPointer: env.getClientPointer,
          isPreviewOpen: isAnyLightboxOpen,
          openPreview: (imageElement) => {
            for (const [key, lightbox] of lightboxes) {
              if (key !== env.key) {
                lightbox.close();
                lightboxes.delete(key);
              }
            }
            return binding.openPreview(imageElement, {
              lightbox: getLightbox(
                env.key,
                env.document,
                viewWindowOf(env.data, env.document)
              ),
              notify,
              isActive: env.isActive,
            });
          },
          newButton: () => makeButton(env.document),
        });
      },
      onUnmount: (record) => {
        const lightbox = lightboxes.get(record.key);
        if (lightbox) {
          lightbox.close();
          lightboxes.delete(record.key);
        }
      },
      onError: (error) => console.error("[" + SCRIPT_NAME + "] view lifecycle", error),
    });
    lifecycle.install(host);

    let startupTimer = null;
    const cleanup = () => {
      cancelBoot();
      if (startupTimer != null) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      lifecycle.cleanup();
      for (const lightbox of lightboxes.values()) lightbox.close();
      lightboxes.clear();
      if (window.__exlCleanup === cleanup) window.__exlCleanup = null;
      window.__exlReady = false;
      window.__exlDebug = null;
    };
    window.__exlCleanup = cleanup;
    window.__exlDebug = () => ({
      views: lifecycle.getViewKeys(),
      ready: window.__exlReady,
      previewOpen: isAnyLightboxOpen(),
    });
    window.__exlReady = true;

    // Startup Script 可能在已有标签恢复前执行。每次恢复轮询都重新让 EA
    // 选择当前活动绘图，避免第一次拿到尚未加载的旧视图对象后一直卡住。
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
