/*
Excalidraw Notebooks v0.1.0

```javascript
*/

const MINIMUM_PLUGIN_VERSION = "2.29.0";
const RUNNING_FLAG = "__excalidrawNotebooks";

(() => {
  var PAGE_MARK = "exnPage";
  var PAGE_PAPER_MARK = "exnPagePaper";
  var PAGE_SEQ_MARK = "exnSeq";
  var PAPER_MARK = "exnPaper";
  var NOTEBOOK_FRONTMATTER_KEY = "exn-notebook";

  var positionTolerance = 0.01;
  var paperKinds = ["plain", "ruled", "dotted", "grid"];
  var viewModes = ["paged", "scroll"];
  var PAGE_SIZE_RANGE = { min: 200, max: 1e4 };
  var PAGE_GAP_RANGE = { min: 0, max: 400 };
  function defaultSettings() {
    return {
      pageWidth: 794,
      pageHeight: 1123,
      gap: 40,
      paper: "dotted",
      viewMode: "paged",
      showThumbnails: false
    };
  }
  function normalizeSettings(input) {
    const defaults = defaultSettings();
    if (!input || typeof input !== "object") {
      return defaults;
    }
    return {
      pageWidth: pageSizeOr(input.pageWidth, defaults.pageWidth),
      pageHeight: pageSizeOr(input.pageHeight, defaults.pageHeight),
      gap: clamp(finiteOr(input.gap, defaults.gap), PAGE_GAP_RANGE.min, PAGE_GAP_RANGE.max),
      paper: oneOf(input.paper, paperKinds, defaults.paper),
      viewMode: oneOf(input.viewMode, viewModes, defaults.viewMode),
      showThumbnails: input.showThumbnails === true
    };
  }
  function isPageFrame(element) {
    return element.type === "frame" && element.customData?.[PAGE_MARK] === true;
  }
  function isPaperElement(element) {
    return element.customData?.[PAPER_MARK] === true;
  }
  function getPages(elements) {
    const live = elements.filter(isLive);
    const frames = live.filter(isPageFrame).sort(byPosition);
    return frames.map((frame, index) => toPage(frame, index + 1, live));
  }
  function findPage(pages, pageNumber) {
    return pages.find((page) => page.number === pageNumber);
  }
  function pageNumberAt(pages, y) {
    const page = pages.find((candidate) => y >= candidate.y && y < candidate.y + candidate.height);
    return page?.number ?? null;
  }
  function pageFrameName(pageNumber) {
    return `Page ${pageNumber}`;
  }
  function stepPage(pages, current, step) {
    const last = pages.length;
    if (last === 0) {
      return 1;
    }
    return clampPageNumber(clampPageNumber(current, last) + step, last);
  }
  function insertPosition(pages, afterNumber, settings) {
    const first = pages[0];
    if (!first) {
      return {
        x: 0,
        y: 0,
        width: settings.pageWidth,
        height: settings.pageHeight,
        name: pageFrameName(1)
      };
    }
    if (afterNumber < 1 || !Number.isFinite(afterNumber)) {
      return {
        x: first.x,
        y: first.y - (settings.pageHeight + settings.gap),
        width: settings.pageWidth,
        height: settings.pageHeight,
        name: pageFrameName(1)
      };
    }
    const anchor = pages[clampPageNumber(afterNumber, pages.length) - 1] ?? first;
    return {
      x: anchor.x,
      y: anchor.y + anchor.height + settings.gap,
      width: settings.pageWidth,
      height: settings.pageHeight,
      name: pageFrameName(anchor.number + 1)
    };
  }
  function pageRemovalIds(pages, pageNumber, elements) {
    const page = findPage(pages, pageNumber);
    if (!page) {
      return [];
    }
    const live = elements.filter(isLive);
    const attached = live.filter((element) => element.frameId === page.id);
    const unframed = strayElements(pages, live).filter((element) => containsBox(page, element));
    const roots = [page.id, ...attached.map(idOf), ...unframed.map(idOf)];
    return withDescendants(roots, live);
  }
  function strayElements(_pages, elements) {
    return elements.filter(isStray);
  }
  function adoptAssignments(pages, elements) {
    const assignments = [];
    for (const stray of strayElements(pages, elements)) {
      const page = largestOverlap(pages, stray);
      if (page) {
        assignments.push({ id: stray.id, frameId: page.id });
      }
    }
    return assignments;
  }
  function currentPageForScroll(pages, viewportTop, viewportHeight) {
    if (pages.length === 0) {
      return 1;
    }
    const line = viewportTop + Math.min(viewportHeight * 0.3, 240);
    const hit = pageNumberAt(pages, line);
    if (hit !== null) {
      return hit;
    }
    const below = pages.find((page) => page.y > line);
    return (below ?? pages[pages.length - 1])?.number ?? 1;
  }
  function pageOrigin(page) {
    const data = page.frame.customData;
    const seq = data?.[PAGE_SEQ_MARK];
    const paper = data?.[PAGE_PAPER_MARK];
    if (typeof seq !== "number" || !Number.isFinite(seq)) {
      return null;
    }
    if (typeof paper !== "string" || !paperKinds.includes(paper)) {
      return null;
    }
    return { paper, seq };
  }
  function paperLabel(paper) {
    return `${paper.charAt(0).toUpperCase()}${paper.slice(1)}`;
  }
  function rememberedPaper(pages, fallback) {
    let best = null;
    for (const page of pages) {
      const origin = pageOrigin(page);
      if (origin && (!best || origin.seq > best.seq)) {
        best = origin;
      }
    }
    return best ? best.paper : fallback;
  }
  function nextPageSeq(pages) {
    let highest = 0;
    for (const page of pages) {
      const seq = page.frame.customData?.[PAGE_SEQ_MARK];
      if (typeof seq === "number" && Number.isFinite(seq)) {
        highest = Math.max(highest, Math.trunc(seq));
      }
    }
    return highest + 1;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function clampPageNumber(value, count) {
    if (!Number.isFinite(value)) {
      return 1;
    }
    return clamp(Math.trunc(value), 1, count);
  }
  function finiteOr(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function pageSizeOr(value, fallback) {
    return clamp(finiteOr(value, fallback), PAGE_SIZE_RANGE.min, PAGE_SIZE_RANGE.max);
  }
  function oneOf(value, options, fallback) {
    return options.find((option) => option === value) ?? fallback;
  }
  function isLive(element) {
    return element.isDeleted !== true;
  }
  function idOf(element) {
    return element.id;
  }
  function byPosition(a, b) {
    return a.y - b.y || a.x - b.x;
  }
  function toPage(frame, pageNumber, live) {
    const attached = live.filter((element) => element.frameId === frame.id);
    return {
      id: frame.id,
      number: pageNumber,
      frame,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      elementIds: attached.filter((element) => !isPaperElement(element)).map(idOf),
      paperId: attached.find(isPaperElement)?.id ?? null
    };
  }
  function isStray(element) {
    return isLive(element) && !isPageFrame(element) && !isPaperElement(element) && !element.frameId;
  }
  function withDescendants(roots, live) {
    const childrenOf = /* @__PURE__ */ new Map();
    for (const element of live) {
      if (element.frameId) {
        childrenOf.set(element.frameId, [...childrenOf.get(element.frameId) ?? [], element.id]);
      }
    }
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const queue = [...roots];
    for (const id of queue) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
      queue.push(...childrenOf.get(id) ?? []);
    }
    return ids;
  }
  function largestOverlap(boxes, target) {
    let best;
    let bestArea = 0;
    for (const box of boxes) {
      const area = overlapArea(box, target);
      if (area > bestArea) {
        best = box;
        bestArea = area;
      }
    }
    return best;
  }
  function overlapArea(a, b) {
    const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return width > 0 && height > 0 ? width * height : 0;
  }
  function containsBox(outer, inner) {
    return inner.x >= outer.x - positionTolerance && inner.y >= outer.y - positionTolerance && inner.x + inner.width <= outer.x + outer.width + positionTolerance && inner.y + inner.height <= outer.y + outer.height + positionTolerance;
  }

  function focusMove(key, axis, rtl = false) {
    const horizontal = {
      ArrowRight: { step: rtl ? -1 : 1, jump: false },
      ArrowLeft: { step: rtl ? 1 : -1, jump: false }
    };
    const vertical = {
      ArrowDown: { step: 1, jump: false },
      ArrowUp: { step: -1, jump: false }
    };
    const edges = {
      Home: { step: 1, jump: true },
      End: { step: -1, jump: true }
    };
    return (axis === "vertical" ? vertical : horizontal)[key] ?? edges[key] ?? null;
  }
  function focusTargetIndex(length, from, move, isDisabled) {
    let index = move.jump ? move.step > 0 ? 0 : length - 1 : from + move.step;
    while (index >= 0 && index < length) {
      if (!isDisabled(index)) {
        return index;
      }
      index += move.step;
    }
    return -1;
  }
  function indexOfTarget(items, target) {
    for (let index = 0; index < items.length; index += 1) {
      if (items[index] === target) {
        return index;
      }
    }
    return -1;
  }
  function isRtl(doc) {
    return doc.documentElement.dir === "rtl" || doc.body.dir === "rtl";
  }

  function createEl(doc, tag, className, text) {
    const el = doc.createElement(tag);
    if (className !== void 0) {
      el.className = className;
    }
    if (text !== void 0) {
      el.textContent = text;
    }
    return el;
  }
  function setIconOnce(kit, holder, icon) {
    if (holder.dataset.exnIcon === icon) {
      return;
    }
    holder.dataset.exnIcon = icon;
    holder.replaceChildren();
    kit.setIcon(holder, icon);
  }
  function captureFocus(doc, root) {
    const active = doc.activeElement;
    const view = doc.defaultView;
    if (!view || !(active instanceof view.HTMLElement) || !root.contains(active)) {
      return null;
    }
    return active;
  }
  function restoreFocus(doc, root, target) {
    if (!target) {
      return;
    }
    const active = doc.activeElement;
    if (active === null || active === doc.body || root.contains(active)) {
      target.focus({ preventScroll: true });
    }
  }
  var hasModifier = (event) => event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  var beginsBusy = (wasBusy, busy) => busy && wasBusy !== true;
  var endsBusy = (wasBusy, busy) => !busy && wasBusy === true;
  function createFocusGuard(doc, root) {
    let target = null;
    return {
      hold() {
        target ??= captureFocus(doc, root);
      },
      release() {
        restoreFocus(doc, root, target);
        target = null;
      }
    };
  }
  function handleArrowKeys(event, items, axis, doc) {
    if (hasModifier(event)) {
      return false;
    }
    const index = indexOfTarget(items, event.target);
    const move = index < 0 ? null : focusMove(event.key, axis, isRtl(doc));
    if (!move) {
      return false;
    }
    const disabled = (position) => items[position]?.matches(":disabled") === true;
    const target = focusTargetIndex(items.length, index, move, disabled);
    const next = target < 0 ? void 0 : items[target];
    if (!next) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    next.focus();
    return true;
  }

  var PAGE_BAR_LABELS = {
    previous: "Previous page",
    next: "Next page",
    addPage: "Add page after this page",
    addPageWith: "Add {paper} page after this page",
    choosePageType: "Choose page type",
    goToPage: "Go to page",
    pageOf: "Page {page} of {total}, go to page",
    more: "More actions",
    toolbar: "Notebook pages",
    noPages: "No pages"
  };
  var VIEW_TOGGLE = {
    paged: { icon: "gallery-vertical", label: "Switch to scrolling view" },
    scroll: { icon: "move-vertical", label: "Switch to paged view" }
  };
  var PAGE_BAR_ICONS = {
    previous: "chevron-left",
    next: "chevron-right",
    addPage: "plus",
    choosePageType: "chevron-down",
    more: "more-horizontal",
    thumbnails: "panel-left"
  };
  var digitCount = (value) => String(Math.trunc(Math.abs(value))).length;
  var toCount = (count) => Number.isFinite(count) ? Math.max(Math.trunc(count), 0) : 0;
  var addPageLabel = (paperLabel2) => {
    const paper = paperLabel2.trim().toLowerCase();
    return paper === "" ? PAGE_BAR_LABELS.addPage : PAGE_BAR_LABELS.addPageWith.replace("{paper}", paper);
  };
  var indicatorLabel = (current, total) => PAGE_BAR_LABELS.pageOf.replace("{page}", current).replace("{total}", total);
  function pageBarModel(state) {
    const count = toCount(state.count);
    const requested = Number.isFinite(state.page) ? Math.trunc(state.page) : 1;
    const page = count === 0 ? 0 : Math.min(Math.max(requested, 1), count);
    const toggle = VIEW_TOGGLE[state.viewMode] ?? VIEW_TOGGLE.paged;
    const current = String(page);
    const total = String(count);
    return {
      busy: state.busy,
      page,
      count,
      digits: digitCount(count) * 2,
      previousDisabled: page <= 1,
      nextDisabled: page >= count,
      indicator: count === 0 ? PAGE_BAR_LABELS.noPages : `${current} / ${total}`,
      indicatorLabel: count === 0 ? PAGE_BAR_LABELS.noPages : indicatorLabel(current, total),
      announcement: count === 0 ? PAGE_BAR_LABELS.noPages : `Page ${current} of ${total}`,
      viewIcon: toggle.icon,
      viewLabel: toggle.label,
      thumbnailsPressed: state.showThumbnails,
      thumbnailsLabel: state.showThumbnails ? "Hide page thumbnails" : "Show page thumbnails",
      addLabel: addPageLabel(state.paperLabel)
    };
  }
  function samePageBarModel(a, b) {
    return a.busy === b.busy && a.page === b.page && a.count === b.count && a.viewIcon === b.viewIcon && a.viewLabel === b.viewLabel && a.thumbnailsPressed === b.thumbnailsPressed && a.thumbnailsLabel === b.thumbnailsLabel && a.addLabel === b.addLabel;
  }

  function iconButton(kit, icon, label) {
    const button = createEl(kit.doc, "button", "exn-bar-btn");
    const holder = createEl(kit.doc, "span", "exn-icon");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.appendChild(holder);
    setIconOnce(kit, holder, icon);
    return { button, holder };
  }
  function buildIndicator(kit) {
    const doc = kit.doc;
    const button = createEl(doc, "button", "exn-bar-btn exn-bar-indicator");
    const sep = createEl(doc, "span", "exn-bar-sep");
    const spinner = createEl(doc, "span", "exn-spinner");
    const current = createEl(doc, "span", "exn-bar-now");
    const total = createEl(doc, "span", "exn-bar-total");
    button.type = "button";
    button.title = PAGE_BAR_LABELS.goToPage;
    button.setAttribute("aria-label", PAGE_BAR_LABELS.goToPage);
    spinner.setAttribute("aria-hidden", "true");
    sep.append(createEl(doc, "span", "exn-bar-mark", "/"), spinner);
    button.append(
      current,
      sep,
      total,
      createEl(doc, "span", "exn-bar-empty", PAGE_BAR_LABELS.noPages)
    );
    return { button, current, total };
  }
  function buildPaging(kit) {
    const indicator = buildIndicator(kit);
    const previous = iconButton(kit, PAGE_BAR_ICONS.previous, PAGE_BAR_LABELS.previous);
    const next = iconButton(kit, PAGE_BAR_ICONS.next, PAGE_BAR_LABELS.next);
    const group = createEl(kit.doc, "div", "exn-bar-group");
    group.append(previous.button, indicator.button, next.button);
    return {
      group,
      previous: previous.button,
      next: next.button,
      indicator: indicator.button,
      current: indicator.current,
      total: indicator.total
    };
  }
  function buildActions(kit) {
    const doc = kit.doc;
    const addPage = iconButton(kit, PAGE_BAR_ICONS.addPage, PAGE_BAR_LABELS.addPage);
    const choose = iconButton(kit, PAGE_BAR_ICONS.choosePageType, PAGE_BAR_LABELS.choosePageType);
    const viewMode = iconButton(kit, "gallery-vertical", "Switch to scrolling view");
    const thumbnails = iconButton(kit, PAGE_BAR_ICONS.thumbnails, "Show page thumbnails");
    const more = iconButton(kit, PAGE_BAR_ICONS.more, PAGE_BAR_LABELS.more);
    addPage.button.classList.add("exn-split-main");
    choose.button.classList.add("exn-split-chevron");
    choose.button.setAttribute("aria-haspopup", "menu");
    thumbnails.button.setAttribute("aria-pressed", "false");
    more.button.setAttribute("aria-haspopup", "menu");
    const split = createEl(doc, "div", "exn-split");
    split.setAttribute("role", "group");
    split.setAttribute("aria-label", PAGE_BAR_LABELS.addPage);
    split.append(addPage.button, choose.button);
    const divider = createEl(doc, "div", "exn-bar-divider");
    divider.setAttribute("aria-hidden", "true");
    const group = createEl(doc, "div", "exn-bar-group");
    group.append(split, divider, viewMode.button, thumbnails.button, more.button);
    return {
      group,
      addPage: addPage.button,
      choosePageType: choose.button,
      viewMode,
      thumbnails: thumbnails.button,
      more: more.button
    };
  }
  function buildBar(kit) {
    const doc = kit.doc;
    const root = createEl(doc, "div", "exn-page-bar");
    const divider = createEl(doc, "div", "exn-bar-divider");
    const live = createEl(doc, "span", "exn-sr-only");
    const paging = buildPaging(kit);
    const actions = buildActions(kit);
    root.dataset.viewportUi = "bottom";
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", PAGE_BAR_LABELS.toolbar);
    divider.setAttribute("aria-hidden", "true");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    root.append(paging.group, divider, actions.group, live);
    return { root, paging: paging.group, actions: actions.group, ...paging, ...actions, live };
  }
  function applyModel(kit, refs, model) {
    const { root } = refs;
    const label = (button, text) => {
      button.title = text;
      button.setAttribute("aria-label", text);
    };
    root.setAttribute("aria-busy", String(model.busy));
    root.dataset.empty = String(model.count === 0);
    root.style.setProperty("--exn-digits", String(model.digits));
    refs.previous.disabled = model.busy || model.previousDisabled;
    refs.next.disabled = model.busy || model.nextDisabled;
    for (const button of [
      refs.addPage,
      refs.choosePageType,
      refs.viewMode.button,
      refs.thumbnails,
      refs.more
    ]) {
      button.disabled = model.busy;
    }
    refs.indicator.disabled = model.busy || model.count === 0;
    refs.current.textContent = String(model.page);
    refs.total.textContent = String(model.count);
    label(refs.indicator, model.indicatorLabel);
    label(refs.addPage, model.addLabel);
    label(refs.viewMode.button, model.viewLabel);
    label(refs.thumbnails, model.thumbnailsLabel);
    refs.thumbnails.setAttribute("aria-pressed", String(model.thumbnailsPressed));
    setIconOnce(kit, refs.viewMode.holder, model.viewIcon);
  }
  function bindEvents(refs, handlers, signal) {
    const doc = refs.root.ownerDocument;
    const clicks = [
      [refs.previous, handlers.onPrevious],
      [refs.indicator, handlers.onGoToPage],
      [refs.next, handlers.onNext],
      [refs.addPage, handlers.onAddPage],
      [refs.choosePageType, () => handlers.onChoosePageType(refs.choosePageType)],
      [refs.viewMode.button, handlers.onToggleViewMode],
      [refs.thumbnails, handlers.onToggleThumbnails]
    ];
    const buttons = clicks.map(([button]) => button);
    for (const [button, handler] of clicks) {
      button.addEventListener("click", handler, { signal });
    }
    refs.more.addEventListener("click", () => handlers.onOpenMenu(refs.more), { signal });
    buttons.push(refs.more);
    refs.root.addEventListener(
      "keydown",
      (event) => {
        handleArrowKeys(event, buttons, "horizontal", doc);
      },
      { signal }
    );
  }
  function syncWrapped(refs) {
    const { root } = refs;
    if (!root.isConnected) {
      root.dataset.wrapped = "false";
      return;
    }
    root.dataset.wrapped = "false";
    const pagingTop = refs.paging.getBoundingClientRect().top;
    const actionsTop = refs.actions.getBoundingClientRect().top;
    if (Math.abs(pagingTop - actionsTop) > 1) {
      root.dataset.wrapped = "true";
    }
  }
  function sideInsets(root, rtl) {
    const parent = root.parentElement;
    if (!parent) {
      return { start: 0, end: 0 };
    }
    const box = parent.getBoundingClientRect();
    const middle = box.left + box.width / 2;
    let left = 0;
    let right = 0;
    const sides = Array.from(parent.querySelectorAll('[data-viewport-ui="side"]'));
    for (const side of sides) {
      const rect = side.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const before = rect.left + rect.width / 2 < middle;
        left = Math.max(left, before ? rect.right - box.left : 0);
        right = Math.max(right, before ? 0 : box.right - rect.left);
      }
    }
    return rtl ? { start: right, end: left } : { start: left, end: right };
  }
  function syncSide(doc, root) {
    const insets = sideInsets(root, isRtl(doc));
    root.style.setProperty("--exn-bar-start", `${insets.start}px`);
    root.style.setProperty("--exn-bar-end", `${insets.end}px`);
  }
  function createLayoutSync(kit, refs) {
    let frame = 0;
    let watched = null;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => run());
    function run() {
      const parent = refs.root.parentElement;
      frame = 0;
      if (observer && parent && parent !== watched) {
        observer.disconnect();
        observer.observe(parent);
        watched = parent;
      }
      syncWrapped(refs);
      syncSide(kit.doc, refs.root);
    }
    return {
      request() {
        if (frame === 0) {
          frame = requestAnimationFrame(run);
        }
      },
      stop() {
        cancelAnimationFrame(frame);
        observer?.disconnect();
      }
    };
  }
  function announce(refs, last, model) {
    if (last && last.announcement !== model.announcement) {
      refs.live.textContent = model.announcement;
    }
  }
  function createPageBar(kit, handlers) {
    const refs = buildBar(kit);
    const doc = kit.doc;
    const controller = new AbortController();
    const focus = createFocusGuard(doc, refs.root);
    const layout = createLayoutSync(kit, refs);
    let last = null;
    bindEvents(refs, handlers, controller.signal);
    layout.request();
    return {
      el: refs.root,
      update(state) {
        const model = pageBarModel(state);
        const wasBusy = last?.busy;
        if (last && samePageBarModel(last, model)) {
          return;
        }
        if (beginsBusy(wasBusy, model.busy)) {
          focus.hold();
        }
        applyModel(kit, refs, model);
        if (endsBusy(wasBusy, model.busy)) {
          focus.release();
        }
        announce(refs, last, model);
        last = model;
        layout.request();
      },
      destroy() {
        controller.abort();
        layout.stop();
        refs.root.remove();
      }
    };
  }

  var DEFAULT_THUMB_ASPECT = 210 / 297;
  function normalizeAspect(aspect) {
    return Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_THUMB_ASPECT;
  }
  function normalizePageNumber(value, fallback) {
    return Number.isFinite(value) && value >= 1 ? Math.trunc(value) : Math.trunc(fallback);
  }
  function isCurrentPage(page, current) {
    return page === current;
  }
  function revealMode(previous, next) {
    if (previous?.pages.length !== next.pages.length) {
      return "jump";
    }
    return previous.current === next.current ? "none" : "slide";
  }
  function revealTarget(top, height, viewTop, viewHeight) {
    const bottom = top + height;
    if (top < viewTop) {
      return top;
    }
    return bottom > viewTop + viewHeight ? bottom - viewHeight : viewTop;
  }

  function parsePreview(doc, svg) {
    const view = doc.defaultView;
    if (!view) {
      return null;
    }
    const parsed = new view.DOMParser().parseFromString(svg, "image/svg+xml");
    const root = parsed.documentElement;
    if (!(root instanceof view.SVGSVGElement)) {
      return null;
    }
    if (parsed.getElementsByTagName("parsererror").length > 0) {
      return null;
    }
    root.querySelectorAll("script").forEach((node) => node.remove());
    Array.from(root.querySelectorAll("*")).forEach((node) => {
      Array.from(node.attributes).forEach((attr2) => {
        if (/^on/i.test(attr2.name)) {
          node.removeAttribute(attr2.name);
        }
      });
    });
    root.removeAttribute("width");
    root.removeAttribute("height");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return doc.adoptNode(root);
  }
  function createItem(kit, page, busy) {
    const doc = kit.doc;
    const li = createEl(doc, "li", "exn-thumb");
    const button = createEl(doc, "button", "exn-thumb-button");
    const box = createEl(doc, "span", "exn-thumb-box");
    const skeleton = createEl(doc, "span", "exn-thumb-skeleton");
    const preview = createEl(doc, "span", "exn-thumb-preview");
    const label = createEl(doc, "span", "exn-thumb-number");
    const number2 = normalizePageNumber(page.number, 1);
    button.type = "button";
    button.disabled = busy;
    button.dataset.page = String(number2);
    button.setAttribute("aria-label", `Page ${number2}`);
    box.setAttribute("aria-hidden", "true");
    label.textContent = String(number2);
    li.dataset.preview = "loading";
    box.append(skeleton, preview);
    button.append(box, label);
    li.appendChild(button);
    return { li, button, preview, label, number: number2, current: false, svg: void 0 };
  }
  function renderPreview(kit, item, source) {
    const svg = source === null ? null : parsePreview(kit.doc, source);
    const state = source === null ? "loading" : svg ? "ready" : "failed";
    item.li.dataset.preview = state;
    if (svg) {
      item.preview.replaceChildren(svg);
    } else {
      item.preview.replaceChildren();
    }
  }
  function patchItem(kit, item, page, current) {
    const number2 = normalizePageNumber(page.number, item.number);
    if (item.number !== number2) {
      item.number = number2;
      item.button.dataset.page = String(number2);
      item.button.setAttribute("aria-label", `Page ${number2}`);
      item.label.textContent = String(number2);
    }
    const active = isCurrentPage(number2, current);
    if (item.current !== active) {
      item.current = active;
      if (active) {
        item.button.setAttribute("aria-current", "page");
      } else {
        item.button.removeAttribute("aria-current");
      }
    }
    if (item.svg !== page.svg) {
      item.svg = page.svg;
      renderPreview(kit, item, page.svg);
    }
  }
  function syncLength(kit, refs, pages, busy) {
    for (const item of refs.items.splice(pages.length)) {
      item.li.remove();
    }
    if (refs.items.length === pages.length) {
      return;
    }
    const fragment = kit.doc.createDocumentFragment();
    for (const page of pages.slice(refs.items.length)) {
      const item = createItem(kit, page, busy);
      refs.items.push(item);
      fragment.appendChild(item.li);
    }
    refs.list.appendChild(fragment);
  }
  function syncBusy(refs, busy) {
    refs.list.setAttribute("aria-busy", String(busy));
    for (const item of refs.items) {
      item.button.disabled = busy;
    }
  }
  function patchPages(kit, refs, state, current) {
    for (const [index, page] of state.pages.entries()) {
      const item = refs.items[index];
      if (item) {
        patchItem(kit, item, page, current);
      }
    }
  }
  function prefersReducedMotion(list) {
    const reduce = "(prefers-reduced-motion: reduce)";
    return list.ownerDocument.defaultView?.matchMedia(reduce).matches === true;
  }
  function revealCurrent(refs, mode) {
    if (mode === "none") {
      return;
    }
    const { list } = refs;
    const item = refs.items.find((candidate) => candidate.current);
    if (!item) {
      return;
    }
    const viewTop = list.scrollTop;
    const target = revealTarget(item.li.offsetTop, item.li.offsetHeight, viewTop, list.clientHeight);
    const slide = mode === "slide" && !prefersReducedMotion(list);
    if (target !== viewTop) {
      list.scrollTo({ top: target, behavior: slide ? "smooth" : "instant" });
    }
  }
  function build(kit) {
    const root = createEl(kit.doc, "nav", "exn-thumbs");
    const list = createEl(kit.doc, "ol", "exn-thumbs-list");
    const gap = createEl(kit.doc, "li", "exn-thumbs-gap");
    const empty = createEl(kit.doc, "p", "exn-thumbs-empty");
    root.dataset.viewportUi = "side";
    root.setAttribute("aria-label", "Pages");
    list.setAttribute("role", "list");
    gap.setAttribute("aria-hidden", "true");
    empty.textContent = "No pages yet. Add the first one from the bar below.";
    list.appendChild(gap);
    root.append(list, empty);
    return {
      root,
      list,
      empty,
      items: [],
      attached: false,
      focus: createFocusGuard(kit.doc, root)
    };
  }
  function bindEvents2(refs, handlers, signal) {
    const doc = refs.root.ownerDocument;
    refs.list.addEventListener(
      "click",
      (event) => {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        const page = button instanceof HTMLButtonElement ? Number(button.dataset.page) : NaN;
        if (button instanceof HTMLButtonElement && !button.disabled && Number.isFinite(page)) {
          handlers.onSelect(page);
        }
      },
      { signal }
    );
    refs.list.addEventListener(
      "keydown",
      (event) => {
        handleArrowKeys(
          event,
          refs.items.map((item) => item.button),
          "vertical",
          doc
        );
      },
      { signal }
    );
  }
  function syncAspect(root, memory, aspect) {
    if (aspect !== memory.aspect) {
      root.style.setProperty("--exn-thumb-aspect", String(aspect));
      memory.aspect = aspect;
    }
  }
  function applyState(kit, refs, memory, state) {
    const { root } = refs;
    const wasBusy = memory.busy;
    const attached = root.isConnected && !refs.attached;
    const mode = attached ? "jump" : revealMode(memory.last, state);
    refs.attached = root.isConnected;
    if (beginsBusy(wasBusy, state.busy)) {
      refs.focus.hold();
    }
    syncLength(kit, refs, state.pages, state.busy);
    if (state.busy !== wasBusy) {
      syncBusy(refs, state.busy);
    }
    syncAspect(root, memory, normalizeAspect(state.aspect));
    refs.empty.hidden = state.pages.length > 0;
    patchPages(kit, refs, state, normalizePageNumber(state.current, 1));
    if (endsBusy(wasBusy, state.busy)) {
      refs.focus.release();
    }
    memory.last = state;
    memory.busy = state.busy;
    revealCurrent(refs, mode);
  }
  function syncAttached(refs) {
    const connected = refs.root.isConnected;
    refs.attached = connected;
    if (connected) {
      revealCurrent(refs, "jump");
    }
  }
  function createThumbnails(kit, handlers) {
    const refs = build(kit);
    const controller = new AbortController();
    const memory = { last: null, aspect: NaN, busy: false };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => syncAttached(refs));
    bindEvents2(refs, handlers, controller.signal);
    observer?.observe(refs.root);
    return {
      el: refs.root,
      update(state) {
        applyState(kit, refs, memory, state);
      },
      destroy() {
        controller.abort();
        observer?.disconnect();
        refs.items.length = 0;
        refs.root.remove();
      }
    };
  }

  var MIN_CONTRAST = 4.5;
  var MIX_STEPS = 16;
  var ERROR_TEXT = ".exn-dialog-error, .exn-error";
  var ACCENT_TEXT = "button.mod-cta, button.mod-warning, .exn-bar-btn[aria-pressed]";
  var FITTED = `${ERROR_TEXT}, ${ACCENT_TEXT}`;
  var WHITE = { r: 255, g: 255, b: 255, a: 1 };
  var BLACK = { r: 0, g: 0, b: 0, a: 1 };
  var HEX = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
  var RGBA = /^rgba\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)$/;
  var palettes = /* @__PURE__ */ new WeakMap();
  var luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  var contrastRatio = (first, second) => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  var weakest = (color, surfaces) => Math.min(...surfaces.map((surface) => contrastRatio(color, surface)));
  var mix = (color, target, amount) => {
    const blend = (from, to) => Math.round(from + (to - from) * amount);
    return {
      r: blend(color.r, target.r),
      g: blend(color.g, target.g),
      b: blend(color.b, target.b),
      a: 1
    };
  };
  var pole = (surfaces) => weakest(WHITE, surfaces) >= weakest(BLACK, surfaces) ? WHITE : BLACK;
  var pickCandidate = (candidates, surfaces) => candidates.find((color) => weakest(color, surfaces) >= MIN_CONTRAST) ?? candidates.find((color) => contrastRatio(color, surfaces[0] ?? BLACK) >= MIN_CONTRAST) ?? null;
  var tint = (base, surfaces) => {
    const target = pole(surfaces);
    for (let step = 1; step <= MIX_STEPS; step += 1) {
      const next = mix(base, target, step / MIX_STEPS);
      if (weakest(next, surfaces) >= MIN_CONTRAST) {
        return next;
      }
    }
    return target;
  };
  var readableText = (current, surfaces, options) => {
    if (current && weakest(current, surfaces) >= MIN_CONTRAST) {
      return null;
    }
    if (!options.keepHue) {
      const pick = pickCandidate(options.candidates, surfaces);
      if (pick) {
        return pick;
      }
    }
    const target = pole(surfaces);
    return tint(current ?? (target === BLACK ? WHITE : BLACK), surfaces);
  };
  var parseStored = (stored) => {
    const hex = HEX.exec(stored);
    if (hex) {
      return {
        r: Number.parseInt(hex[1] ?? "0", 16),
        g: Number.parseInt(hex[2] ?? "0", 16),
        b: Number.parseInt(hex[3] ?? "0", 16),
        a: 1
      };
    }
    const rgba = RGBA.exec(stored);
    return rgba ? { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4]) } : null;
  };
  var createPalette = (doc) => {
    const context = doc.createElement("canvas").getContext("2d");
    return (value) => {
      if (!context || !value) {
        return null;
      }
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillStyle = value;
      return parseStored(context.fillStyle);
    };
  };
  var paletteFor = (doc) => {
    const cached = palettes.get(doc);
    if (cached) {
      return cached;
    }
    const palette = createPalette(doc);
    palettes.set(doc, palette);
    return palette;
  };
  var backgroundOf = (el, view, palette) => {
    for (let node = el; node; node = node.parentElement) {
      const color = palette(view.getComputedStyle(node).backgroundColor);
      if (color && color.a >= 0.95) {
        return color;
      }
      if (color && color.a > 0.05) {
        return null;
      }
    }
    return null;
  };
  var createFitter = (view, palette, candidates) => {
    const solid = (value) => {
      const color = palette(value);
      return color && color.a >= 0.95 ? color : null;
    };
    return (el, keepHue) => {
      const style = view.getComputedStyle(el);
      const background = backgroundOf(el, view, palette);
      if (!background) {
        return;
      }
      const hovered = keepHue ? null : solid(style.getPropertyValue("--interactive-accent-hover").trim());
      const next = readableText(
        palette(style.color),
        hovered ? [background, hovered] : [background],
        { candidates, keepHue }
      );
      if (next) {
        el.style.color = `rgb(${next.r}, ${next.g}, ${next.b})`;
      }
    };
  };
  var fitContrast = (root) => {
    const view = root.ownerDocument.defaultView;
    if (!view) {
      return;
    }
    const palette = paletteFor(root.ownerDocument);
    const rootStyle = view.getComputedStyle(root);
    const candidates = [
      palette(rootStyle.getPropertyValue("--text-on-accent-inverted").trim()),
      palette(rootStyle.getPropertyValue("--text-normal").trim()),
      BLACK,
      WHITE
    ].filter((color) => color !== null);
    const fit = createFitter(view, palette, candidates);
    for (const el of Array.from(root.querySelectorAll(ERROR_TEXT))) {
      if (el.textContent?.trim()) {
        fit(el, true);
      }
    }
    for (const el of Array.from(root.querySelectorAll(ACCENT_TEXT))) {
      if (el.hasAttribute("aria-pressed") && el.getAttribute("aria-pressed") !== "true") {
        el.style.removeProperty("color");
      } else {
        const warning = el.classList.contains("mod-warning");
        fit(el, warning);
      }
    }
  };
  var watchContrast = (root) => {
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    fitContrast(root);
    if (!view || !doc.body) {
      return () => {
      };
    }
    const frame = view.requestAnimationFrame(() => fitContrast(root));
    const changes = new view.MutationObserver(() => fitContrast(root));
    changes.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden"]
    });
    const theme = new view.MutationObserver(() => {
      for (const el of Array.from(root.querySelectorAll(FITTED))) {
        el.style.removeProperty("color");
      }
      fitContrast(root);
    });
    theme.observe(doc.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      view.cancelAnimationFrame(frame);
      changes.disconnect();
      theme.disconnect();
    };
  };

  var PAPER_OPTIONS = [
    { value: "plain", label: "Plain" },
    { value: "ruled", label: "Ruled" },
    { value: "dotted", label: "Dotted" },
    { value: "grid", label: "Grid" }
  ];
  var VIEW_OPTIONS = [
    { value: "paged", label: "One page per screen" },
    { value: "scroll", label: "Scrolling pages" }
  ];
  function validateRange(value, range) {
    const text = value.trim();
    const number2 = Number(text);
    if (text === "") {
      return "Enter a number.";
    }
    if (!Number.isInteger(number2)) {
      return "Use a whole number.";
    }
    if (number2 < range.min || number2 > range.max) {
      return `Use a number between ${range.min} and ${range.max}.`;
    }
    return null;
  }
  function validateSettings(values) {
    const errors = {};
    const checks = [
      ["pageWidth", validateRange(values.pageWidth, PAGE_SIZE_RANGE)],
      ["pageHeight", validateRange(values.pageHeight, PAGE_SIZE_RANGE)],
      ["gap", validateRange(values.gap, PAGE_GAP_RANGE)]
    ];
    for (const [field, message] of checks) {
      if (message !== null) {
        errors[field] = message;
      }
    }
    return errors;
  }
  function parseNumber(value) {
    const text = value.trim();
    const number2 = Number(text);
    return text === "" || !Number.isFinite(number2) ? NaN : number2;
  }
  function parseSettings(values) {
    return {
      pageWidth: parseNumber(values.pageWidth),
      pageHeight: parseNumber(values.pageHeight),
      gap: parseNumber(values.gap),
      paper: values.paper,
      viewMode: values.viewMode,
      showThumbnails: values.showThumbnails
    };
  }
  function settingsValues(settings) {
    return {
      pageWidth: Number.isFinite(settings.pageWidth) ? String(settings.pageWidth) : "",
      pageHeight: Number.isFinite(settings.pageHeight) ? String(settings.pageHeight) : "",
      gap: Number.isFinite(settings.gap) ? String(settings.gap) : "",
      paper: settings.paper,
      viewMode: settings.viewMode,
      showThumbnails: settings.showThumbnails === true
    };
  }

  var FIELDS = [
    {
      key: "pageWidth",
      label: "Page width",
      description: "Width of new pages, in pixels.",
      kind: "number"
    },
    {
      key: "pageHeight",
      label: "Page height",
      description: "Height of new pages, in pixels.",
      kind: "number"
    },
    {
      key: "gap",
      label: "Gap between pages",
      description: "Space between pages in scrolling view, in pixels.",
      kind: "number"
    },
    {
      key: "paper",
      label: "Default paper",
      description: "Paper for new pages.",
      kind: "select",
      options: PAPER_OPTIONS
    },
    {
      key: "viewMode",
      label: "Default view",
      description: "View notebooks open in.",
      kind: "select",
      options: VIEW_OPTIONS
    },
    {
      key: "showThumbnails",
      label: "Show thumbnails",
      description: "Show the page list on the left.",
      kind: "toggle"
    }
  ];
  var formCount = 0;
  function buildSelect(kit, spec, id, value) {
    const select = createEl(kit.doc, "select", "dropdown exn-input");
    for (const option of spec.options ?? []) {
      const item = createEl(kit.doc, "option", void 0, option.label);
      item.value = option.value;
      select.appendChild(item);
    }
    select.id = id;
    select.value = value;
    return { control: select, input: select, toggle: null };
  }
  function buildToggle(kit, id, checked) {
    const toggle = createEl(kit.doc, "label", "checkbox-container exn-toggle");
    const input = createEl(kit.doc, "input", "exn-toggle-input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    toggle.classList.toggle("is-enabled", checked);
    toggle.appendChild(input);
    return { control: toggle, input, toggle };
  }
  function buildText(kit, spec, id, value) {
    const input = createEl(kit.doc, "input", "text-input exn-input");
    input.type = spec.kind;
    input.id = id;
    input.value = value;
    if (spec.kind === "number") {
      input.step = "1";
      input.inputMode = "numeric";
      input.classList.add("exn-input-number");
    }
    return { control: input, input, toggle: null };
  }
  function buildControl(kit, spec, id, values) {
    if (spec.kind === "select") {
      return buildSelect(kit, spec, id, String(values[spec.key]));
    }
    if (spec.kind === "toggle") {
      return buildToggle(kit, id, values.showThumbnails);
    }
    return buildText(kit, spec, id, String(values[spec.key]));
  }
  function buildRow(kit, spec, values) {
    const doc = kit.doc;
    const id = `exn-${formCount}-${spec.key}`;
    const row = createEl(doc, "div", "setting-item exn-field");
    const info = createEl(doc, "div", "setting-item-info");
    const control = createEl(doc, "div", "setting-item-control exn-control");
    const error = createEl(doc, "div", "exn-error");
    const label = createEl(doc, "label", "setting-item-name exn-label", spec.label);
    const description = createEl(doc, "div", "setting-item-description", spec.description);
    const built = buildControl(kit, spec, id, values);
    row.dataset.field = spec.key;
    label.htmlFor = id;
    description.id = `${id}-desc`;
    error.id = `${id}-error`;
    error.hidden = true;
    error.setAttribute("role", "alert");
    built.input.setAttribute("aria-describedby", `${id}-desc ${id}-error`);
    info.append(label, description);
    control.append(built.control, error);
    row.append(info, control);
    return { key: spec.key, row, input: built.input, toggle: built.toggle, error };
  }
  function readInput(field) {
    const input = field?.input;
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      return input.checked;
    }
    return input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? input.value : "";
  }
  function collect(fields) {
    const byKey = new Map(fields.map((field) => [field.key, field]));
    const text = (key) => String(readInput(byKey.get(key)));
    return {
      pageWidth: text("pageWidth"),
      pageHeight: text("pageHeight"),
      gap: text("gap"),
      paper: text("paper"),
      viewMode: text("viewMode"),
      showThumbnails: readInput(byKey.get("showThumbnails")) === true
    };
  }
  function showError(field, message) {
    field.error.textContent = message ?? "";
    field.error.hidden = message === void 0;
    if (message === void 0) {
      field.input.removeAttribute("aria-invalid");
    } else {
      field.input.setAttribute("aria-invalid", "true");
    }
  }
  function showErrors(fields) {
    const errors = validateSettings(collect(fields));
    for (const field of fields) {
      showError(field, errors[field.key]);
    }
    return errors;
  }
  function validateOne(fields, field) {
    showError(field, validateSettings(collect(fields))[field.key]);
  }
  function focusFirstError(fields) {
    const field = fields.find((candidate) => !candidate.error.hidden);
    if (!field) {
      return false;
    }
    field.input.focus();
    return true;
  }
  function bindValidation(form, fields, options) {
    const fieldFor = (target) => fields.find((field) => field.input === target);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (Object.keys(showErrors(fields)).length === 0) {
        options?.onSubmit?.();
      } else {
        focusFirstError(fields);
      }
    });
    form.addEventListener("focusout", (event) => {
      const field = fieldFor(event.target);
      if (field) {
        validateOne(fields, field);
      }
    });
    form.addEventListener("input", (event) => {
      const field = fieldFor(event.target);
      if (field && !field.error.hidden) {
        validateOne(fields, field);
      }
    });
  }
  function bindControls(form, fields) {
    const isTextInput = (target) => target instanceof HTMLInputElement && target.type !== "checkbox";
    form.addEventListener("change", (event) => {
      const field = fields.find((candidate) => candidate.input === event.target);
      if (field?.toggle && field.input instanceof HTMLInputElement) {
        field.toggle.classList.toggle("is-enabled", field.input.checked);
      }
    });
    form.addEventListener("keydown", (event) => {
      if (isTextInput(event.target) && event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }
  function createSettingsForm(kit, settings, options) {
    const fields = FIELDS.map((spec) => buildRow(kit, spec, settingsValues(settings)));
    const form = createEl(kit.doc, "form", "exn-settings");
    formCount += 1;
    form.noValidate = true;
    form.append(...fields.map((field) => field.row));
    bindValidation(form, fields, options);
    bindControls(form, fields);
    return {
      el: form,
      validate: () => showErrors(fields),
      read: () => parseSettings(collect(fields)),
      focusFirstError: () => focusFirstError(fields)
    };
  }

  var make = (doc, tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== void 0) {
      node.textContent = text;
    }
    return node;
  };
  var makeButton = (doc, className, text) => {
    const button = make(doc, "button", className, text);
    button.type = "button";
    return button;
  };
  var buildActions2 = (doc, submitLabel, submitClass) => {
    const el = make(doc, "div", "exn-dialog-actions");
    const cancel = makeButton(doc, "mod-muted", "Cancel");
    const submit = makeButton(doc, submitClass, submitLabel);
    el.append(cancel, submit);
    return { el, submit, cancel };
  };
  var buildTextForm = (doc, options) => {
    const el = make(doc, "div", "exn-dialog");
    if (options.description) {
      el.appendChild(make(doc, "p", "exn-dialog-text", options.description));
    }
    const field = make(doc, "div", "exn-dialog-field");
    const input = doc.createElement("input");
    input.type = "text";
    input.className = "exn-dialog-input";
    input.value = options.value;
    input.placeholder = options.placeholder ?? "";
    const label = make(doc, "label", "exn-dialog-label", options.label);
    const error = make(doc, "div", "exn-dialog-error");
    error.setAttribute("aria-live", "polite");
    input.id = `exn-input-${Math.random().toString(36).slice(2, 8)}`;
    error.id = `${input.id}-error`;
    label.htmlFor = input.id;
    input.setAttribute("aria-describedby", error.id);
    field.append(label, input, error);
    const actions = buildActions2(
      doc,
      options.submitLabel,
      options.warning ? "mod-warning" : "mod-cta"
    );
    el.append(field, actions.el);
    return { ...actions, el, input, error };
  };
  var focusable = (root) => Array.from(
    root.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
    )
  );
  var trapTab = (root, event) => {
    if (event.key !== "Tab") {
      return;
    }
    const items = focusable(root);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = root.ownerDocument.activeElement;
    const outside = !active || !root.contains(active);
    const wrapBack = event.shiftKey && (active === first || outside);
    const wrapForward = !event.shiftKey && (active === last || outside);
    if (wrapBack) {
      event.preventDefault();
      last.focus();
    } else if (wrapForward) {
      event.preventDefault();
      first.focus();
    }
  };
  var activeElement = (doc) => doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  var decorate = (modal, previousFocus) => {
    const onKeydown = (event) => trapTab(modal.modalEl, event);
    const onClick = (event) => {
      if (event.target === modal.containerEl) {
        modal.close();
      }
    };
    modal.modalEl.classList.add("exn-dialog-modal");
    modal.modalEl.addEventListener("keydown", onKeydown);
    modal.containerEl.addEventListener("click", onClick);
    const unwatch = watchContrast(modal.modalEl);
    return () => {
      unwatch();
      modal.modalEl.removeEventListener("keydown", onKeydown);
      modal.containerEl.removeEventListener("click", onClick);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  };
  var textDialogClass = (ob) => {
    const ModalClass = ob.Modal;
    return class TextDialog extends ModalClass {
      constructor(options, done) {
        super(app);
        this.options = options;
        this.done = done;
        this.titleEl.setText(options.title);
        const doc = this.contentEl.ownerDocument;
        this.form = buildTextForm(doc, options);
        this.contentEl.appendChild(this.form.el);
        this.release = decorate(this, activeElement(doc));
        this.wire(this.form, () => this.submit());
      }
      options;
      done;
      answer = null;
      form;
      release;
      onOpen() {
        this.form.input.focus();
        this.form.input.select();
      }
      onClose() {
        this.release();
        this.done(this.answer);
      }
      wire(form, submit) {
        form.cancel.addEventListener("click", () => this.close());
        form.submit.addEventListener("click", submit);
        form.input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        });
        form.input.addEventListener("input", () => this.showError(null));
        form.input.addEventListener("blur", () => {
          if (form.input.value.trim() !== "") {
            this.showError(this.options.validate(form.input.value));
          }
        });
      }
      showError(message) {
        this.form.error.textContent = message ?? "";
        this.form.input.setAttribute("aria-invalid", message ? "true" : "false");
      }
      submit() {
        const message = this.options.validate(this.form.input.value);
        this.showError(message);
        if (message) {
          this.form.input.focus();
          return;
        }
        this.answer = this.form.input.value.trim();
        this.close();
      }
    };
  };
  var openTextDialog = (ob, options) => new Promise((resolve) => {
    new (textDialogClass(ob))(options, resolve).open();
  });
  var confirmClass = (ob) => {
    const ModalClass = ob.Modal;
    return class ConfirmDialog extends ModalClass {
      constructor(options, done) {
        super(app);
        this.options = options;
        this.done = done;
        this.titleEl.setText(options.title);
        const doc = this.contentEl.ownerDocument;
        this.contentEl.appendChild(make(doc, "p", "exn-dialog-text", options.message));
        const actions = buildActions2(doc, options.actionLabel, "mod-warning");
        this.contentEl.appendChild(actions.el);
        this.release = decorate(this, activeElement(doc));
        this.initialFocus = actions.cancel;
        actions.cancel.addEventListener("click", () => this.close());
        actions.submit.addEventListener("click", () => {
          this.confirmed = true;
          this.close();
        });
      }
      options;
      done;
      confirmed = false;
      release;
      initialFocus;
      onOpen() {
        this.initialFocus.focus();
      }
      onClose() {
        this.release();
        this.done(this.confirmed);
      }
    };
  };
  var openConfirm = (ob, options) => new Promise((resolve) => {
    new (confirmClass(ob))(options, resolve).open();
  });
  var settingsClass = (ob, kit) => {
    const ModalClass = ob.Modal;
    return class SettingsDialog extends ModalClass {
      constructor(initial, onSave) {
        super(app);
        this.onSave = onSave;
        this.titleEl.setText("Excalidraw Notebooks settings");
        const doc = this.contentEl.ownerDocument;
        this.form = createSettingsForm(kit, initial, {
          onSubmit: () => {
            void this.save();
          }
        });
        const body = make(doc, "div", "exn-dialog");
        body.appendChild(this.form.el);
        const actions = buildActions2(doc, "Save", "mod-cta");
        body.appendChild(actions.el);
        this.contentEl.appendChild(body);
        this.release = decorate(this, activeElement(doc));
        this.submit = actions.submit;
        actions.cancel.addEventListener("click", () => this.close());
        actions.submit.addEventListener("click", () => {
          void this.save();
        });
      }
      onSave;
      form;
      release;
      submit;
      saving = false;
      onOpen() {
        this.form.el.querySelector("input, select, button")?.focus();
      }
      onClose() {
        this.release();
      }
      async save() {
        if (this.saving) {
          return;
        }
        if (Object.keys(this.form.validate()).length > 0) {
          this.form.focusFirstError();
          return;
        }
        this.saving = true;
        this.submit.disabled = true;
        try {
          await this.onSave(this.form.read());
          this.close();
        } finally {
          this.saving = false;
          this.submit.disabled = false;
        }
      }
    };
  };
  var openSettingsDialog = (ob, kit, settings, onSave) => {
    new (settingsClass(ob, kit))(settings, onSave).open();
  };
  var pdfPickerClass = (ob, done) => {
    const Picker = ob.FuzzySuggestModal;
    return class PdfPicker extends Picker {
      chosen = null;
      constructor() {
        super(app);
        this.setPlaceholder("Type to find a PDF in the vault");
        this.limit = 100;
      }
      getItems() {
        return app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "pdf");
      }
      getItemText(file) {
        return file.path;
      }
      onChooseItem(file) {
        this.chosen = file;
        done(file);
      }
      onClose() {
        const win = this.containerEl.ownerDocument.defaultView ?? window;
        win.setTimeout(() => {
          if (this.chosen === null) {
            done(null);
          }
        }, 0);
      }
    };
  };
  var pickPdf = (ob) => new Promise((resolve) => {
    new (pdfPickerClass(ob, resolve))().open();
  });

  function placeAfter(items, item, title, label) {
    const at = items.indexOf(item);
    if (at < 0) {
      return false;
    }
    const target = items.findIndex((entry, index) => index !== at && label(entry) === title);
    if (target < 0) {
      return false;
    }
    items.splice(at, 1);
    items.splice(target < at ? target + 1 : target, 0, item);
    return true;
  }

  var pluginInternals = (ea2) => ea2.plugin;
  var commandRegistry = (ea2) => ea2.plugin.app;
  var clearFileOpenHook = (gea) => {
    gea.onFileOpenHook = null;
  };
  var NEW_NOTE_KEY = "plugins.file-explorer.menu-opt-new-note";
  var NEW_NOTE_FALLBACK = "New note";
  var newNoteTitle = () => {
    const i18n = window.i18next;
    const title = i18n?.t(NEW_NOTE_KEY, { ns: "default" });
    return typeof title === "string" && title !== "" && !title.includes("menu-opt-new-note") ? title : NEW_NOTE_FALLBACK;
  };
  var placeAfterNewNote = (menu, item) => {
    const items = menu.items;
    placeAfter(
      items,
      item,
      newNoteTitle(),
      (other) => other.titleEl?.textContent
    );
  };
  var hostFont = (view) => {
    const container = liveView(view).containerEl;
    const host = container.parentElement ?? container;
    return host.ownerDocument.defaultView?.getComputedStyle(host).fontFamily ?? "";
  };
  var applyViewport = (api, request) => Promise.resolve(api.setViewport(request)).then(() => void 0);
  var releaseViewport = (api) => {
    try {
      api.updateScene({ appState: { scrollConstraints: null } });
      void applyViewport(api, null);
    } catch {
    }
  };
  var viewLocked = (view) => {
    const api = liveView(view).excalidrawAPI;
    return Boolean(api?.getAppState().scrollConstraints);
  };
  var liveView = (view) => view;
  var newEa = (gea, view) => {
    const holder = window;
    return new holder.ExcalidrawAutomate.constructor(gea.plugin, view);
  };
  var isTextTarget = (target) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  };
  var delay = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  function liveElements(ea2) {
    return ea2.getViewElements().filter((element) => !element.isDeleted);
  }
  function pickLive(ea2, ids) {
    const wanted = new Set(ids);
    return liveElements(ea2).filter((element) => wanted.has(element.id));
  }
  async function editLive(ea2, ids, edit) {
    if (ids.length === 0) {
      return true;
    }
    const live = pickLive(ea2, ids);
    if (live.length === 0) {
      return false;
    }
    ea2.clear();
    try {
      ea2.copyViewElementsToEAforEditing(live);
      for (const element of live) {
        const copy = ea2.getElement(element.id);
        if (copy) {
          edit(copy);
        }
      }
      return await ea2.addElementsToView(false, true);
    } finally {
      ea2.clear();
    }
  }
  function applyShifts(ea2, shifts) {
    const byId = new Map(shifts.map((shift) => [shift.id, shift]));
    return editLive(ea2, [...byId.keys()], (element) => {
      const shift = byId.get(element.id);
      if (shift) {
        element.x += shift.dx;
        element.y += shift.dy;
      }
    });
  }
  async function removeByIds(ea2, ids) {
    if (ids.length === 0) {
      return true;
    }
    const targets = pickLive(ea2, ids);
    if (targets.length === 0) {
      return false;
    }
    return ea2.deleteViewElements(targets);
  }
  function setFrameIds(ea2, assignments) {
    const frameById = new Map(
      assignments.map((assignment) => [assignment.id, assignment.frameId])
    );
    return editLive(ea2, [...frameById.keys()], (element) => {
      element.frameId = frameById.get(element.id) ?? null;
    });
  }
  function setLocked(ea2, ids, locked) {
    return editLive(ea2, ids, (element) => {
      element.locked = locked;
    });
  }
  function addPageFrame(ea2, spec, origin) {
    const id = ea2.addFrame(spec.x, spec.y, spec.width, spec.height, spec.name);
    const marks = { [PAGE_MARK]: true };
    if (origin) {
      marks[PAGE_PAPER_MARK] = origin.paper;
      marks[PAGE_SEQ_MARK] = origin.seq;
    }
    ea2.addAppendUpdateCustomData(id, marks);
    const frame = ea2.getElement(id);
    if (frame) {
      frame.locked = true;
    }
    return id;
  }
  async function addPaperElement(ea2, frameId, spec, source) {
    const id = await ea2.addImage(spec.x, spec.y, source);
    if (!id) {
      return null;
    }
    const element = ea2.getElement(id);
    element.frameId = frameId;
    element.x = spec.x;
    element.y = spec.y;
    element.width = spec.width;
    element.height = spec.height;
    element.locked = true;
    ea2.addAppendUpdateCustomData(id, { [PAPER_MARK]: true });
    return id;
  }
  async function commitWorkbench(ea2, onTop) {
    try {
      return await ea2.addElementsToView(false, true, onTop);
    } finally {
      ea2.clear();
    }
  }
  function sendToBack(ea2, id) {
    ea2.moveViewElementToZIndex(id, -1);
  }

  var pdfPageMargin = 24;
  function hasUsableSize(box) {
    return Number.isFinite(box.width) && Number.isFinite(box.height) && box.width > 0 && box.height > 0;
  }
  function fitInside(area, box, margin) {
    const innerWidth = Math.max(0, area.width - 2 * margin);
    const innerHeight = Math.max(0, area.height - 2 * margin);
    let width = innerWidth;
    let height = innerHeight;
    if (hasUsableSize(box)) {
      height = width * box.height / box.width;
      if (height > innerHeight) {
        height = innerHeight;
        width = height * box.width / box.height;
      }
    }
    return {
      x: area.x + (area.width - width) / 2,
      y: area.y + (area.height - height) / 2,
      width,
      height
    };
  }
  async function readPdfPages(file, deps = {}) {
    const lib = (deps.window ?? window).pdfjsLib;
    if (!lib) {
      throw new Error("The PDF reader is not available in this window.");
    }
    const data = new Uint8Array(await (deps.app ?? app).vault.readBinary(file));
    const doc = await lib.getDocument({ data }).promise;
    try {
      const pages = [];
      for (let number2 = 1; number2 <= doc.numPages; number2 += 1) {
        const page = await doc.getPage(number2);
        const viewport = page.getViewport({ scale: 1 });
        pages.push({
          number: number2,
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation
        });
      }
      return pages;
    } finally {
      if (doc.destroy) {
        await doc.destroy().catch(() => void 0);
      }
    }
  }
  async function addPdfPageElement(ea2, frameId, pdfFile, page, spec) {
    const id = await ea2.addImage(spec.x, spec.y, `${pdfFile.path}#page=${page.number}`);
    if (!id) {
      return null;
    }
    const element = ea2.getElement(id);
    const rect = fitInside(spec, { width: element.width, height: element.height }, pdfPageMargin);
    element.frameId = frameId;
    element.x = rect.x;
    element.y = rect.y;
    element.width = rect.width;
    element.height = rect.height;
    ea2.addAppendUpdateCustomData(id, { pdfPage: page.number });
    return id;
  }

  var NOTEBOOK_UI_STYLES = `
.exn-sr-only {
  position: absolute;
  width: var(--size-2-1);
  height: var(--size-2-1);
  margin: calc(var(--size-2-1) * -1);
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.exn-page-bar,
.exn-thumbs,
.exn-settings {
  --exn-ring: calc(var(--border-width) * 2) solid var(--interactive-accent);
  --exn-ring-offset: var(--size-2-1);
  --exn-ease: var(--anim-duration-fast) var(--anim-motion-smooth);
  color: var(--text-normal);
  font-family: inherit;
  line-height: var(--line-height-tight);
}

.exn-page-bar {
  --exn-bar-button: calc(var(--input-height) - var(--size-2-2));
  --exn-bar-bottom: calc(var(--input-height) + var(--size-4-4));
  --exn-bar-start: 0px;
  --exn-bar-end: 0px;
  position: absolute;
  inset-inline-start: var(--exn-bar-start);
  inset-inline-end: var(--exn-bar-end);
  bottom: var(--exn-bar-bottom);
  z-index: var(--layer-sidedock);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--size-4-1);
  box-sizing: border-box;
  width: max-content;
  max-width: calc(
    100% - var(--exn-bar-start) - var(--exn-bar-end) - var(--size-4-4) * 2
  );
  margin-inline: auto;
  padding: var(--size-4-1);
  border: var(--border-width) solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  background: var(--background-secondary);
  box-shadow: var(--shadow-s);
  font-size: var(--font-ui-small);
}

.exn-bar-group {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--size-4-1);
}

.exn-bar-divider {
  flex: none;
  width: var(--divider-width);
  height: calc(var(--exn-bar-button) - var(--size-4-2));
  background: var(--divider-color);
}

.exn-page-bar[data-wrapped="true"] {
  flex-direction: column;
  align-items: center;
  row-gap: var(--size-4-2);
}

.exn-page-bar[data-wrapped="true"] .exn-bar-divider {
  align-self: stretch;
  width: auto;
  height: var(--divider-width);
}

.exn-page-bar .exn-bar-btn {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--exn-bar-button);
  height: var(--exn-bar-button);
  margin: 0;
  padding: 0;
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-s);
  background: transparent;
  box-shadow: none;
  color: var(--icon-color);
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: var(--cursor);
  transition:
    background-color var(--exn-ease),
    border-color var(--exn-ease),
    color var(--exn-ease);
}

.exn-page-bar .exn-bar-btn:hover:not(:disabled) {
  background: var(--interactive-normal);
  color: var(--icon-color-hover);
}

.exn-page-bar .exn-bar-btn:active:not(:disabled) {
  background: var(--interactive-hover);
  color: var(--icon-color-active);
}

.exn-page-bar .exn-bar-btn:focus-visible {
  outline: var(--exn-ring);
  outline-offset: var(--exn-ring-offset);
}

.exn-page-bar .exn-bar-btn:disabled {
  background: transparent;
  color: var(--text-faint);
  cursor: default;
}

.exn-split {
  display: inline-flex;
  flex: none;
  align-items: stretch;
}

.exn-split .exn-split-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.exn-split .exn-split-chevron {
  width: calc(var(--size-4-3) + var(--size-4-2));
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.exn-split .exn-split-chevron .exn-icon {
  width: var(--size-4-3);
  height: var(--size-4-3);
}

.exn-page-bar .exn-bar-btn[aria-pressed="true"] {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.exn-page-bar .exn-bar-btn[aria-pressed="true"]:hover:not(:disabled) {
  background: var(--interactive-accent-hover);
  color: var(--text-on-accent);
}

.exn-page-bar .exn-bar-btn[aria-pressed="true"]:disabled {
  opacity: var(--icon-muted);
}

.exn-icon {
  display: inline-flex;
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  pointer-events: none;
}

.exn-icon > svg {
  display: block;
  width: 100%;
  height: 100%;
  stroke-width: var(--icon-stroke);
}

.exn-page-bar .exn-bar-indicator {
  width: auto;
  min-width: max(
    calc(var(--exn-bar-button) * 2),
    calc(var(--exn-digits, 4) * 1ch + var(--size-4-4) + var(--size-4-2))
  );
  padding-inline: var(--size-4-1);
  color: var(--text-normal);
  white-space: nowrap;
}

.exn-bar-sep {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: var(--size-4-3);
  color: var(--text-muted);
}

.exn-spinner {
  display: none;
  box-sizing: border-box;
  width: calc(var(--size-4-2) + var(--size-2-1));
  height: calc(var(--size-4-2) + var(--size-2-1));
  border: var(--border-width) solid var(--background-modifier-border-focus);
  border-top-color: var(--text-normal);
  border-radius: 50%;
}

.exn-bar-empty {
  display: none;
}

.exn-page-bar[data-empty="true"] :is(.exn-bar-now, .exn-bar-sep, .exn-bar-total) {
  display: none;
}

.exn-page-bar[data-empty="true"] .exn-bar-empty {
  display: inline;
}

.exn-page-bar[aria-busy="true"] .exn-bar-mark {
  display: none;
}

.exn-page-bar[aria-busy="true"] .exn-spinner {
  display: block;
  animation: exn-spin var(--anim-duration-moderate) linear infinite;
}

.exn-page-bar[aria-busy="true"] .exn-bar-indicator {
  color: var(--text-muted);
}

.exn-thumbs {
  --exn-thumbs-width: calc(var(--size-4-3) * 11);
  --exn-thumb-aspect: 0.70707;
  --exn-thumb-pad: calc(var(--exn-ring-offset) + var(--border-width) * 2);
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: var(--layer-sidedock);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--exn-thumbs-width);
  border-inline-end: var(--border-width) solid var(--background-modifier-border);
  background: var(--background-secondary);
  font-size: var(--font-ui-small);
}

.exn-thumbs-list {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  margin: 0;
  padding: 0 var(--size-4-1) var(--size-4-1);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  list-style: none;
}

.exn-thumbs-gap {
  position: sticky;
  top: 0;
  z-index: 1;
  flex: none;
  height: var(--exn-thumbs-top, var(--size-4-1));
  background: var(--background-secondary);
}

.exn-thumb {
  flex: none;
  padding: var(--exn-thumb-pad);
}

.exn-thumbs .exn-thumb-button {
  appearance: none;
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  margin: 0;
  padding: var(--size-4-1);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-m);
  background: transparent;
  box-shadow: none;
  color: var(--text-normal);
  font: inherit;
  text-align: center;
  cursor: var(--cursor);
  transition:
    background-color var(--exn-ease),
    border-color var(--exn-ease);
}

.exn-thumbs .exn-thumb-button:hover:not(:disabled) {
  background: var(--interactive-normal);
}

.exn-thumbs .exn-thumb-button:active:not(:disabled) {
  background: var(--interactive-hover);
}

.exn-thumbs .exn-thumb-button:focus-visible {
  outline: var(--exn-ring);
  outline-offset: var(--exn-ring-offset);
}

.exn-thumbs .exn-thumb-button:disabled {
  cursor: default;
}

.exn-thumb-box {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: var(--exn-thumb-aspect);
  overflow: hidden;
  border: var(--border-width) solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: var(--background-primary);
  transition: border-color var(--exn-ease);
}

.exn-thumb-skeleton {
  position: absolute;
  inset: 0;
  background: var(--background-modifier-hover);
  animation: exn-pulse var(--anim-duration-slow) ease-in-out infinite alternate;
}

.exn-thumb-preview {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--exn-ease);
}

.exn-thumb-preview > svg {
  display: block;
  width: 100%;
  height: 100%;
}

.exn-thumb:is([data-preview="ready"], [data-preview="failed"]) .exn-thumb-skeleton {
  display: none;
}

.exn-thumb[data-preview="ready"] .exn-thumb-preview {
  opacity: 1;
}

.exn-thumbs .exn-thumb-button[aria-current="page"] .exn-thumb-box {
  border-color: var(--interactive-accent);
  outline: var(--border-width) solid var(--interactive-accent);
  outline-offset: calc(var(--border-width) * -1);
}

.exn-thumb-number {
  display: block;
  margin-block-start: var(--size-4-1);
  font-size: var(--font-ui-small);
  line-height: var(--size-4-4);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.exn-thumbs .exn-thumb-button[aria-current="page"] .exn-thumb-number {
  font-weight: var(--font-semibold);
}

.exn-thumbs .exn-thumb-button:disabled .exn-thumb-number {
  color: var(--text-muted);
}

.exn-thumbs-empty {
  margin: 0;
  padding: var(--size-4-2);
  font-size: var(--font-ui-smaller);
  line-height: var(--line-height-normal);
}

.exn-settings {
  display: flex;
  flex-direction: column;
  container: exn-settings / inline-size;
  margin: 0;
  font-size: var(--font-ui-medium);
  line-height: var(--line-height-normal);
}

.exn-label {
  display: block;
  cursor: var(--cursor);
}

.exn-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--size-4-2);
  min-width: 0;
}

.exn-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0;
  font-family: inherit;
}

.exn-input-number {
  width: calc(var(--size-4-8) * 4);
}

.exn-error {
  color: var(--text-error);
  font-size: var(--font-ui-small);
  line-height: var(--line-height-tight);
  text-align: right;
}

.exn-error[hidden] {
  display: none;
}

.exn-settings .text-input[aria-invalid="true"] {
  border-color: var(--text-error);
}

.exn-toggle:has(.exn-toggle-input:focus-visible) {
  outline: var(--exn-ring);
  outline-offset: var(--exn-ring-offset);
}

.exn-settings .exn-toggle > .exn-toggle-input {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
}

@container exn-root (max-width: 479px) {
  .exn-page-bar {
    --exn-bar-button: calc(var(--size-4-12) - var(--size-2-2));
  }

  .exn-thumbs {
    --exn-thumbs-width: calc(var(--size-4-8) * 3);
  }

  .exn-thumb-number {
    font-size: var(--font-ui-smaller);
  }
}

@container exn-settings (max-width: 479px) {
  .exn-settings .setting-item {
    flex-direction: column;
    align-items: stretch;
  }

  .exn-settings .setting-item-info {
    margin-right: 0;
    margin-bottom: var(--size-4-2);
  }

  .exn-control {
    align-items: stretch;
  }

  .exn-toggle {
    align-self: flex-start;
  }

  .exn-settings :is(.text-input, .dropdown) {
    min-height: var(--size-4-12);
  }

  .exn-settings .exn-toggle > .exn-toggle-input {
    top: calc((var(--toggle-thumb-height) + var(--toggle-border-width) * 2 - var(--size-4-12)) / 2);
    left: calc((var(--toggle-width) - var(--size-4-12)) / 2);
    width: var(--size-4-12);
    height: var(--size-4-12);
  }

  .exn-error {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .exn-page-bar .exn-bar-btn,
  .exn-thumbs .exn-thumb-button,
  .exn-thumb-box,
  .exn-thumb-preview {
    transition: none;
  }

  .exn-page-bar[aria-busy="true"] .exn-spinner,
  .exn-thumb-skeleton {
    animation: none;
  }
}

@keyframes exn-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes exn-pulse {
  from {
    opacity: 1;
  }

  to {
    opacity: 0.35;
  }
}
`;

  var STYLE_ID = "exn-notebook-styles";
  var RUNTIME_STYLES = `
.exn-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  container: exn-root / inline-size;
}
.exn-root > * {
  pointer-events: auto;
}
.exn-root .exn-icon svg.svg-icon,
.exn-root svg {
  color: inherit;
}
.exn-mask {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  background: var(--exn-mask-color, var(--background-primary));
}
.exn-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--size-4-3);
  min-width: min(24rem, 70vw);
}
.exn-dialog-modal {
  container: exn-dialog / inline-size;
  --background-modifier-border-focus: var(--interactive-accent);
}
.exn-dialog-text {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  line-height: var(--line-height-normal);
}
.exn-dialog-field {
  display: flex;
  flex-direction: column;
  gap: var(--size-4-1);
}
.exn-dialog-label {
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: var(--font-semibold);
}
.exn-dialog-input {
  width: 100%;
}
.exn-dialog-modal .exn-dialog-input[aria-invalid="true"] {
  border-color: var(--text-error);
}
.exn-dialog-error {
  min-height: 1.5em;
  color: var(--text-error);
  font-size: var(--font-ui-smaller);
  line-height: var(--line-height-normal);
}
.exn-dialog-error:empty {
  min-height: 1.5em;
}
.exn-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--size-4-2);
  margin-top: var(--size-4-2);
}
@container exn-dialog (max-width: 479px) {
  .exn-dialog-modal :is(.exn-dialog-actions button, .exn-dialog-input) {
    min-height: var(--size-4-12);
  }
}
`;
  var ensureStyles = (doc) => {
    const css = `${NOTEBOOK_UI_STYLES}
${RUNTIME_STYLES}`;
    const existing = doc.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = css;
      return;
    }
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    doc.head.appendChild(style);
  };

  var NOTEBOOK_PAPER_COLORS = {
    page: "#f3f1ea",
    line: "#d8dbe0",
    margin: "#e2b4b4"
  };
  var cellSize = 20;
  var ruledTop = 72;
  var ruledStep = 28;
  var marginX = 64;
  var dotDiameter = 2.2;
  var dotDash = "0.01 19.99";
  var paperKinds2 = ["plain", "ruled", "dotted", "grid"];
  var crisp = 'fill="none" stroke-width="1" shape-rendering="crispEdges"';
  function buildPaperSvg(kind, width, height, colors) {
    if (!paperKinds2.includes(kind) || !isSize(width) || !isSize(height)) {
      return null;
    }
    const opening = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(
      height
    )}" viewBox="0 0 ${num(width)} ${num(height)}">`;
    const background = `<rect width="${num(width)}" height="${num(height)}" fill="${attr(
      colors.page
    )}"/>`;
    return `${opening}${background}${pattern(kind, width, height, colors)}${outline(width, height, colors)}</svg>`;
  }
  function outline(width, height, colors) {
    return `<rect x="0.5" y="0.5" width="${num(width - 1)}" height="${num(
      height - 1
    )}" fill="none" stroke="${attr(colors.line)}" stroke-width="1" shape-rendering="crispEdges"/>`;
  }
  function pattern(kind, width, height, colors) {
    switch (kind) {
      case "ruled":
        return ruled(width, height, colors);
      case "dotted":
        return dotted(width, height, colors);
      case "grid":
        return grid(width, height, colors);
      default:
        return "";
    }
  }
  function ruled(width, height, colors) {
    let rules = "";
    for (let y = ruledTop; y < height; y += ruledStep) {
      rules += `M0 ${num(y + 0.5)}h${num(width)}`;
    }
    const margin = `M${num(marginX + 0.5)} 0v${num(height)}`;
    return strokePath(crisp, colors.line, rules) + strokePath(crisp, colors.margin, margin);
  }
  function dotted(width, height, colors) {
    const columns = lattice(width);
    const first = columns[0];
    const last = columns[columns.length - 1];
    if (first === void 0 || last === void 0) {
      return "";
    }
    const reach = num(last - first + cellSize / 2);
    const rows = lattice(height).map((y) => `<path d="M${first} ${y}h${reach}"/>`).join("");
    const dots = `stroke-linecap="round" stroke-dasharray="${dotDash}"`;
    const style = `fill="none" stroke="${attr(colors.line)}" stroke-width="${dotDiameter}" ${dots}`;
    return rows ? `<g ${style}>${rows}</g>` : "";
  }
  function grid(width, height, colors) {
    const xs = lattice(width);
    const ys = lattice(height);
    if (xs.length === 0 || ys.length === 0) {
      return "";
    }
    const columns = xs.map((x) => `M${x + 0.5} 0v${num(height)}`).join("");
    const rows = ys.map((y) => `M0 ${y + 0.5}h${num(width)}`).join("");
    return strokePath(crisp, colors.line, columns + rows);
  }
  function lattice(size) {
    const count = Math.max(0, Math.floor((size - cellSize) / cellSize) + 1);
    const first = Math.floor((size - (count - 1) * cellSize) / 2);
    return Array.from({ length: count }, (_, index) => first + index * cellSize);
  }
  function strokePath(style, color, data) {
    return data ? `<path ${style} stroke="${attr(color)}" d="${data}"/>` : "";
  }
  function isSize(value) {
    return Number.isFinite(value) && value > 0;
  }
  function num(value) {
    return String(Math.round(value * 100) / 100);
  }
  function attr(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  var PAPER_FOLDER_NAME = "Notebook paper";
  var number = (value) => String(Math.round(value * 100) / 100);
  function paperFilePath(folder, kind, size) {
    const base = folder.trim().replace(/^\/+|\/+$/g, "");
    const file = `${kind}-${number(size.width)}x${number(size.height)}.svg`;
    return base === "" ? `${PAPER_FOLDER_NAME}/${file}` : `${base}/${PAPER_FOLDER_NAME}/${file}`;
  }
  async function mkdir(vault, folder) {
    let at = "";
    for (const part of folder.split("/").filter(Boolean)) {
      at = at === "" ? part : `${at}/${part}`;
      if (!vault.getAbstractFileByPath(at)) {
        await vault.createFolder(at).catch(() => void 0);
      }
    }
  }
  async function ensurePaperFile(vault, path, svg) {
    const existing = vault.getAbstractFileByPath(path);
    if (existing) {
      if (await vault.cachedRead(existing) !== svg) {
        await vault.modify(existing, svg);
      }
      return path;
    }
    const cut = path.lastIndexOf("/");
    if (cut > 0) {
      await mkdir(vault, path.slice(0, cut));
    }
    await vault.create(path, svg);
    return path;
  }
  async function paperSource(ea2, kind, size) {
    const svg = buildPaperSvg(kind, size.width, size.height, NOTEBOOK_PAPER_COLORS);
    if (!svg) {
      return null;
    }
    const vault = ea2.plugin.app.vault;
    const folder = pluginInternals(ea2).settings.folder ?? "";
    return ensurePaperFile(vault, paperFilePath(folder, kind, size), svg);
  }

  var LINE_TOLERANCE = 0.5;
  var ownedByPage = (element, pageIds) => typeof element.frameId === "string" && pageIds.has(element.frameId);
  var addChildFrames = (ids, elements) => {
    let grew = true;
    while (grew) {
      grew = false;
      for (const element of elements) {
        if (element.frameId && ids.has(element.frameId) && !ids.has(element.id)) {
          ids.add(element.id);
          grew = true;
        }
      }
    }
  };
  function belowLine(pages, elements, line, dy) {
    const ids = /* @__PURE__ */ new Set();
    for (const page of pages) {
      if (page.y < line - LINE_TOLERANCE) {
        continue;
      }
      ids.add(page.id);
      if (page.paperId) {
        ids.add(page.paperId);
      }
      for (const id of page.elementIds) {
        ids.add(id);
      }
    }
    const pageIds = new Set(pages.map((page) => page.id));
    for (const element of elements) {
      const loose = !ownedByPage(element, pageIds) && !isPageFrame(element);
      if (loose && element.y >= line - LINE_TOLERANCE) {
        ids.add(element.id);
      }
    }
    addChildFrames(ids, elements);
    return [...ids].map((id) => ({ id, dx: 0, dy }));
  }

  async function pageThumbnailSvg(ea2, page, theme) {
    try {
      const svg = await ea2.createViewSVG({
        exportArea: { x: page.x, y: page.y, width: page.width, height: page.height },
        padding: 0,
        theme
      });
      return svg?.outerHTML || null;
    } catch {
      return null;
    }
  }

  var DEFAULT_ZOOM = 1;
  var VIEW_LOCK = { scroll: true, zoom: false, overscroll: 120 };
  var EDGE_SLACK = 2;
  var FLIP_ANIMATION = { duration: 220 };
  var REFRESH_DELAY = 120;
  var RESIZE_DELAY = 150;
  var WHEEL_FLIP_THRESHOLD = 90;
  var FLIP_COOLDOWN = 450;
  var WHEEL_REST = 220;
  var SCROLL_HEAD_MARGIN = 24;
  var CONTAINER_TIMEOUT = 3e3;
  var SETTLE_DELAY = 1800;
  var MASK_DARKEN = 0.6;
  var MASK_LIGHTEN = 0.95;
  var BACKGROUND_RETRIES = 25;
  var BACKGROUND_RETRY_DELAY = 120;
  var MASK_SIDES = ["top", "bottom", "left", "right"];
  var SAMPLE_POINTS = [
    [10, 10],
    [26, 18],
    [44, 30],
    [16, 44],
    [60, 12],
    [34, 58]
  ];
  var luminanceOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  var readCanvasColor = (container, points) => {
    const canvas = container.querySelector("canvas.excalidraw__canvas.static");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return null;
    }
    try {
      const scale = canvas.width / Math.max(1, canvas.clientWidth);
      const counts = /* @__PURE__ */ new Map();
      for (const [x, y] of points) {
        const data = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        if ((data[3] ?? 0) < 255) {
          return null;
        }
        const key = `${data[0] ?? 0},${data[1] ?? 0},${data[2] ?? 0}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!best) {
        return null;
      }
      const [red, green, blue] = best.split(",").map(Number);
      return [red ?? 0, green ?? 0, blue ?? 0];
    } catch {
      return null;
    }
  };
  var describeError = (error) => error instanceof Error ? error.message : String(error);
  var shiftedElements = (elements, shifts) => {
    const ids = new Set(shifts.map((shift) => shift.id));
    return elements.filter((element) => ids.has(element.id));
  };
  var signatureOf = (elements, page) => {
    let total = 0;
    let count = 0;
    for (const element of elements) {
      if (element.frameId === page.id || element.id === page.id) {
        total += element.version;
        count += 1;
      }
    }
    return `${page.x},${page.y},${page.width},${page.height},${count},${total}`;
  };
  var findContainer = async (view) => {
    const deadline = Date.now() + CONTAINER_TIMEOUT;
    while (Date.now() < deadline) {
      const container = view.contentEl.querySelector(".excalidraw.excalidraw-container");
      if (container) {
        return container;
      }
      await delay(100);
    }
    return null;
  };
  var suppressAutozoom = (view) => {
    const target = liveView(view);
    target.suppressAutozoomOnce?.();
  };
  var NotebookController = class _NotebookController {
    constructor(host, view, file, container) {
      this.host = host;
      this.view = view;
      this.file = file;
      this.api = liveView(view).excalidrawAPI;
      this.doc = view.ownerDocument;
      ensureStyles(this.doc);
      this.ea = newEa(host.gea, view);
      this.buildUi(container);
      this.releaseContrast = watchContrast(this.root);
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(view.contentEl);
      this.wireEvents();
      this.wireHooks();
    }
    host;
    file;
    view;
    ea;
    api;
    doc;
    root;
    bar;
    thumbs;
    masks;
    thumbCache = /* @__PURE__ */ new Map();
    signatures = /* @__PURE__ */ new Map();
    resizeObserver;
    pages = [];
    current = 1;
    busy = false;
    navigating = false;
    disposed = false;
    rendering = false;
    refreshTimer = null;
    resizeTimer = null;
    wheelTimer = null;
    settleTimer = null;
    wheelAccum = 0;
    flipCooldownUntil = 0;
    opened = false;
    lastScroll = null;
    background = "";
    releaseContrast;
    buildUi(container) {
      const ob = this.host.gea.obsidian;
      const kit = {
        doc: this.doc,
        setIcon: (el, icon) => {
          ob.setIcon(el, icon);
        }
      };
      this.root = this.doc.createElement("div");
      this.root.className = "exn-root";
      this.root.style.fontFamily = hostFont(this.view);
      container.appendChild(this.root);
      this.bar = createPageBar(kit, {
        onPrevious: () => {
          void this.step(-1);
        },
        onNext: () => {
          void this.step(1);
        },
        onAddPage: () => {
          void this.addPage();
        },
        onChoosePageType: (anchor) => this.host.openPageTypeMenu(this, anchor),
        onGoToPage: () => {
          void this.host.goToPage(this);
        },
        onToggleViewMode: () => {
          void this.host.toggleViewMode();
        },
        onToggleThumbnails: () => {
          void this.host.toggleThumbnails();
        },
        onOpenMenu: (anchor) => this.host.openMenu(this, anchor)
      });
      this.thumbs = createThumbnails(kit, {
        onSelect: (page) => {
          void this.showPage(page, true);
        }
      });
      this.masks = MASK_SIDES.map((side) => {
        const mask = this.doc.createElement("div");
        mask.className = `exn-mask exn-mask-${side}`;
        mask.hidden = true;
        this.root.appendChild(mask);
        return mask;
      });
      this.root.appendChild(this.bar.el);
    }
    updateMasks() {
      const page = findPage(this.pages, this.current);
      const paged = this.host.settings().viewMode === "paged";
      const [top, bottom, left, right] = this.masks;
      if (!page || !paged || !top || !bottom || !left || !right) {
        for (const mask of this.masks) {
          mask.hidden = true;
        }
        return;
      }
      const state = this.api.getAppState();
      const zoom = state.zoom.value;
      const box = {
        top: Math.max(0, (page.y + state.scrollY) * zoom),
        bottom: Math.min(state.height, (page.y + page.height + state.scrollY) * zoom),
        left: Math.max(0, (page.x + state.scrollX) * zoom),
        right: Math.min(state.width, (page.x + page.width + state.scrollX) * zoom)
      };
      const height = Math.max(0, box.bottom - box.top);
      this.place(top, 0, 0, state.width, box.top);
      this.place(bottom, 0, box.bottom, state.width, Math.max(0, state.height - box.bottom));
      this.place(left, 0, box.top, box.left, height);
      this.place(right, box.right, box.top, Math.max(0, state.width - box.right), height);
      for (const mask of this.masks) {
        mask.hidden = false;
      }
    }
    sampleBackground(attempt = 0) {
      const color = readCanvasColor(this.view.contentEl, SAMPLE_POINTS);
      if (!color) {
        if (!this.disposed && attempt < BACKGROUND_RETRIES) {
          this.view.ownerWindow.setTimeout(
            () => this.sampleBackground(attempt + 1),
            BACKGROUND_RETRY_DELAY
          );
        }
        return;
      }
      const [red, green, blue] = color;
      const factor = luminanceOf(red, green, blue) < 0.5 ? MASK_DARKEN : MASK_LIGHTEN;
      this.background = `rgb(${color.map((channel) => Math.round(channel * factor)).join(", ")})`;
      this.root.style.setProperty("--exn-mask-color", this.background);
      this.updateMasks();
    }
    place(mask, x, y, width, height) {
      mask.style.transform = `translate(${x}px, ${y}px)`;
      mask.style.width = `${Math.max(0, width)}px`;
      mask.style.height = `${Math.max(0, height)}px`;
    }
    static async open(host, view, file) {
      const container = await findContainer(view);
      if (!container) {
        return null;
      }
      suppressAutozoom(view);
      const controller = new _NotebookController(host, view, file, container);
      await controller.start();
      controller.settleTimer = view.ownerWindow.setTimeout(() => {
        controller.settleTimer = null;
        void controller.refit();
      }, SETTLE_DELAY);
      return controller;
    }
    get pageNumber() {
      return this.current;
    }
    get pageCount() {
      return this.pages.length;
    }
    get viewRef() {
      return this.view;
    }
    pageParts() {
      const paperIds = [];
      for (const page of this.pages) {
        if (page.paperId) {
          paperIds.push(page.paperId);
        }
      }
      return {
        frameIds: this.pages.map((page) => page.id),
        paperIds,
        childIds: this.pages.flatMap((page) => page.elementIds)
      };
    }
    wireEvents() {
      const content = this.view.contentEl;
      content.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
      content.addEventListener("keydown", this.onKeyDown, true);
    }
    wireHooks() {
      this.ea.onViewUnloadHook = () => this.host.detach(this.view);
      this.ea.onFileOpenHook = (data) => {
        this.host.fileOpened(this.view, data.excalidrawFile);
        return Promise.resolve();
      };
      this.ea.onSceneChangeHook = {
        appStateKeys: [
          "scrollX",
          "scrollY",
          "zoom",
          "width",
          "height",
          "theme",
          "viewBackgroundColor"
        ],
        trackElements: true,
        callback: () => this.onSceneChange()
      };
      this.ea.registerThisAsViewEA();
    }
    async start() {
      await this.refreshPages();
      await this.refreshPaper();
      this.current = this.initialPage();
      await this.showPage(this.current, false);
      this.afterPaint(() => {
        this.sampleBackground();
        this.updateMasks();
      });
    }
    afterPaint(task) {
      const win = this.view.ownerWindow;
      win.requestAnimationFrame(
        () => win.requestAnimationFrame(() => {
          if (!this.disposed) {
            task();
          }
        })
      );
    }
    initialPage() {
      const state = this.api.getAppState();
      const center = (state.height / 2 - state.scrollY) / state.zoom.value;
      const at = pageNumberAt(this.pages, center);
      if (at) {
        return at;
      }
      let best = this.pages[0]?.number ?? 1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const page of this.pages) {
        const distance = Math.abs(page.y + page.height / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = page.number;
        }
      }
      return best;
    }
    onSceneChange() {
      if (this.disposed) {
        return;
      }
      const state = this.api.getAppState();
      const next = {
        x: state.scrollX,
        y: state.scrollY,
        zoom: state.zoom.value
      };
      const moved = this.lastScroll !== null && (this.lastScroll.x !== next.x || this.lastScroll.y !== next.y || this.lastScroll.zoom !== next.zoom);
      const reskinned = this.lastScroll !== null && (this.lastScroll.theme !== state.theme || this.lastScroll.color !== state.viewBackgroundColor);
      this.lastScroll = { ...next, theme: state.theme, color: state.viewBackgroundColor };
      if (moved && this.host.settings().viewMode === "scroll" && !this.busy && !this.navigating) {
        this.trackScrollPage();
      }
      if (moved || reskinned) {
        if (reskinned) {
          this.afterPaint(() => {
            this.sampleBackground();
            this.updateMasks();
            void this.renderThumbnails(liveElements(this.ea));
          });
        }
        this.updateMasks();
      }
      if (this.background === "") {
        this.sampleBackground();
      }
      this.scheduleRefresh();
    }
    trackScrollPage() {
      const state = this.api.getAppState();
      const offsets = this.insets();
      const zoom = state.zoom.value;
      const top = offsets.top / zoom - state.scrollY;
      const height = (state.height - offsets.top - offsets.bottom) / zoom;
      const page = currentPageForScroll(this.pages, top, height);
      if (page !== this.current) {
        this.current = page;
        this.syncUi();
      }
    }
    scheduleRefresh() {
      if (this.refreshTimer !== null) {
        return;
      }
      this.refreshTimer = this.view.ownerWindow.setTimeout(() => {
        this.refreshTimer = null;
        void this.refreshPages();
      }, REFRESH_DELAY);
    }
    scheduleResize() {
      if (this.resizeTimer !== null) {
        return;
      }
      this.resizeTimer = this.view.ownerWindow.setTimeout(() => {
        this.resizeTimer = null;
        void this.refit();
      }, RESIZE_DELAY);
    }
    async refreshPages() {
      if (this.disposed) {
        return;
      }
      const elements = liveElements(this.ea);
      this.pages = getPages(elements);
      this.hideFrameChrome();
      const unlocked = this.pages.filter((page) => page.frame.locked !== true);
      if (unlocked.length > 0) {
        await setLocked(
          this.ea,
          unlocked.map((page) => page.id),
          true
        );
      }
      if (this.canAdopt()) {
        const assignments = adoptAssignments(this.pages, elements);
        if (assignments.length > 0) {
          await setFrameIds(this.ea, assignments);
        }
      }
      this.current = Math.min(Math.max(this.current, 1), Math.max(this.pages.length, 1));
      if (this.api.getAppState().showWelcomeScreen) {
        this.api.updateScene({ appState: { showWelcomeScreen: false } });
      }
      this.syncUi();
      void this.renderThumbnails(elements);
    }
    hideFrameChrome() {
      const rendering = this.api.getAppState().frameRendering;
      if (rendering.outline || rendering.name) {
        this.api.updateScene({
          appState: { frameRendering: { ...rendering, outline: false, name: false } },
          captureUpdate: "NEVER"
        });
      }
    }
    canAdopt() {
      const state = this.api.getAppState();
      return state.cursorButton !== "down" && !state.selectedElementsAreBeingDragged && !state.editingTextElement && state.editingGroupId === null;
    }
    async refit() {
      this.sampleBackground();
      const page = findPage(this.pages, this.current) ?? this.pages[0];
      if (page) {
        await this.fitPage(page, false);
      }
      this.updateMasks();
    }
    async showPage(number2, animate) {
      if (this.disposed) {
        return;
      }
      const page = findPage(this.pages, number2) ?? this.pages[0];
      if (!page) {
        return;
      }
      this.current = page.number;
      this.syncUi();
      await this.fitPage(page, animate);
      this.updateMasks();
    }
    async step(direction) {
      if (this.busy) {
        return;
      }
      const target = stepPage(this.pages, this.current, direction);
      if (target !== this.current) {
        await this.showPage(target, true);
      }
    }
    insets() {
      const offsets = this.api.getViewportOffsets();
      const insets = {
        top: offsets.top ?? 0,
        right: offsets.right ?? 0,
        bottom: offsets.bottom ?? 0,
        left: offsets.left ?? 0
      };
      this.thumbs.el.style.setProperty("--exn-thumbs-top", `${Math.ceil(insets.top)}px`);
      return insets;
    }
    async fitPage(page, animate) {
      const frame = this.frameOf(page);
      if (!frame) {
        return;
      }
      const paged = this.host.settings().viewMode === "paged";
      const zoom = this.opened ? this.api.getAppState().zoom.value : DEFAULT_ZOOM;
      this.opened = true;
      const offsets = this.insets();
      this.navigating = true;
      try {
        await applyViewport(this.api, {
          target: this.viewportAt(page, zoom, offsets, paged),
          fit: "contain",
          lock: VIEW_LOCK,
          offsets,
          animation: animate ? FLIP_ANIMATION : false
        });
        await this.settleViewport();
        this.lockTo(page, zoom, offsets, paged);
        if (!paged) {
          this.trackScrollPage();
        }
        this.syncUi();
      } finally {
        this.navigating = false;
      }
      this.updateMasks();
    }
    scrollKey() {
      const state = this.api.getAppState();
      return `${state.scrollX.toFixed(2)}|${state.scrollY.toFixed(2)}|${state.zoom.value}`;
    }
    async settleViewport() {
      let last = this.scrollKey();
      let stable = 0;
      for (let attempt = 0; attempt < 80 && stable < 3 && !this.disposed; attempt += 1) {
        await delay(40);
        const next = this.scrollKey();
        stable = next === last ? stable + 1 : 0;
        last = next;
      }
    }
    stackBounds() {
      const first = this.pages[0];
      const last = this.pages[this.pages.length - 1];
      if (!first || !last) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      const left = Math.min(...this.pages.map((page) => page.x));
      const right = Math.max(...this.pages.map((page) => page.x + page.width));
      return {
        x: left,
        y: first.y,
        width: right - left,
        height: last.y + last.height - first.y
      };
    }
    viewportAt(page, zoom, offsets, paged) {
      const state = this.api.getAppState();
      const width = (state.width - offsets.left - offsets.right) / zoom;
      const height = (state.height - offsets.top - offsets.bottom) / zoom;
      const stack = this.stackBounds();
      const centerX = paged ? page.x + page.width / 2 : stack.x + stack.width / 2;
      const centerY = paged && page.height <= height ? page.y + page.height / 2 : page.y + height / 2 - SCROLL_HEAD_MARGIN / zoom;
      return { x: centerX - width / 2, y: centerY - height / 2, width, height, name: "" };
    }
    lockTo(page, zoom, offsets, paged) {
      const bounds = paged ? { x: page.x, y: page.y, width: page.width, height: page.height } : this.stackBounds();
      this.api.updateScene({
        appState: {
          scrollConstraints: {
            ...bounds,
            lockScroll: true,
            lockZoom: false,
            zoom,
            overscroll: VIEW_LOCK.overscroll,
            offsets: {
              top: offsets.top,
              right: offsets.right,
              bottom: offsets.bottom,
              left: offsets.left
            }
          }
        }
      });
    }
    frameOf(page) {
      return liveElements(this.ea).find((element) => element.id === page.id);
    }
    syncUi() {
      if (this.disposed) {
        return;
      }
      const settings = this.host.settings();
      this.bar.update({
        page: this.current,
        count: this.pages.length,
        viewMode: settings.viewMode,
        showThumbnails: settings.showThumbnails,
        busy: this.busy,
        paperLabel: paperLabel(this.paperToAdd())
      });
      this.thumbs.update({
        pages: this.pages.map((page) => ({
          number: page.number,
          svg: this.thumbCache.get(page.id) ?? null
        })),
        current: this.current,
        aspect: this.pages[0] ? this.pages[0].width / this.pages[0].height : 0.707,
        busy: this.busy
      });
      const attached = this.thumbs.el.parentElement === this.root;
      if (settings.showThumbnails && !attached) {
        this.root.appendChild(this.thumbs.el);
      } else if (!settings.showThumbnails && attached) {
        this.thumbs.el.remove();
      }
      fitContrast(this.root);
    }
    async renderThumbnails(elements) {
      if (this.rendering || !this.host.settings().showThumbnails) {
        return;
      }
      this.rendering = true;
      try {
        for (const page of this.pages) {
          if (this.disposed || !this.host.settings().showThumbnails) {
            return;
          }
          const theme = this.api.getAppState().theme;
          const signature = `${theme}:${signatureOf(elements, page)}`;
          if (this.signatures.get(page.id) === signature) {
            continue;
          }
          const svg = await pageThumbnailSvg(this.ea, page, theme);
          if (!svg) {
            continue;
          }
          this.thumbCache.set(page.id, svg);
          this.signatures.set(page.id, signature);
          this.syncUi();
          await delay(0);
        }
      } finally {
        this.rendering = false;
      }
    }
    pageFitsVertically() {
      const page = findPage(this.pages, this.current);
      const state = this.api.getAppState();
      if (!page || state.height <= 0) {
        return true;
      }
      const offsets = this.insets();
      return page.height * state.zoom.value <= state.height - offsets.top - offsets.bottom + EDGE_SLACK;
    }
    atPageEdge(direction) {
      const page = findPage(this.pages, this.current);
      const state = this.api.getAppState();
      if (!page || direction === 0) {
        return false;
      }
      const offsets = this.insets();
      const zoom = state.zoom.value;
      const top = (page.y + state.scrollY) * zoom;
      const bottom = (page.y + page.height + state.scrollY) * zoom;
      if (direction > 0) {
        return bottom <= state.height - offsets.bottom + EDGE_SLACK;
      }
      return top >= offsets.top - EDGE_SLACK;
    }
    wheelFlips(event) {
      if (this.disposed || this.busy || this.host.settings().viewMode !== "paged") {
        return false;
      }
      if (event.ctrlKey || event.metaKey) {
        return false;
      }
      const target = event.target;
      if (target instanceof Node && this.root.contains(target)) {
        return false;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      return this.pageFitsVertically() || this.atPageEdge(event.deltaY * unit);
    }
    onWheel = (event) => {
      if (!this.wheelFlips(event)) {
        this.wheelAccum = 0;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const now = Date.now();
      if (now < this.flipCooldownUntil) {
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const delta = event.deltaY * unit;
      this.wheelAccum = this.wheelAccum * delta >= 0 ? this.wheelAccum + delta : delta;
      if (this.wheelTimer !== null) {
        this.view.ownerWindow.clearTimeout(this.wheelTimer);
      }
      this.wheelTimer = this.view.ownerWindow.setTimeout(() => {
        this.wheelAccum = 0;
        this.wheelTimer = null;
      }, WHEEL_REST);
      if (Math.abs(this.wheelAccum) >= WHEEL_FLIP_THRESHOLD) {
        const direction = this.wheelAccum > 0 ? 1 : -1;
        this.wheelAccum = 0;
        this.flipCooldownUntil = now + FLIP_COOLDOWN;
        void this.step(direction);
      }
    };
    onKeyDown = (event) => {
      if (this.isSelectAll(event)) {
        this.selectPageContent();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "PageDown" && event.key !== "PageUp") {
        return;
      }
      if (isTextTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void this.step(event.key === "PageDown" ? 1 : -1);
    };
    isSelectAll(event) {
      const typing = isTextTarget(event.target) || this.api.getAppState().editingTextElement !== null;
      const active = this.host.gea.plugin.app.workspace.activeLeaf === this.view.leaf;
      return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a" && !typing && active && !this.disposed;
    }
    selectPageContent() {
      const paged = this.host.settings().viewMode === "paged";
      const current = paged ? findPage(this.pages, this.current) : void 0;
      const pageIds = new Set(this.pages.map((page) => page.id));
      const chosen = liveElements(this.ea).filter(
        (element) => !element.locked && element.type !== "frame" && typeof element.frameId === "string" && pageIds.has(element.frameId) && (!current || element.frameId === current.id)
      );
      this.api.selectElements(chosen);
    }
    async applySettings() {
      if (this.disposed) {
        return;
      }
      this.syncUi();
      await this.refit();
      void this.renderThumbnails(liveElements(this.ea));
    }
    paperToAdd() {
      return rememberedPaper(this.pages, this.host.settings().paper);
    }
    async addPage(after = this.current, kind = this.paperToAdd()) {
      await this.run(async () => {
        const settings = this.host.settings();
        const plan = this.insertionPlan(liveElements(this.ea), after, 1, settings);
        const spec = plan.specs[0];
        if (!spec) {
          return;
        }
        this.ea.clear();
        this.ea.copyViewElementsToEAforEditing(shiftedElements(liveElements(this.ea), plan.shifts));
        this.applyShiftsToWorkbench(plan.shifts);
        const frameId = addPageFrame(this.ea, spec, {
          paper: kind,
          seq: nextPageSeq(this.pages)
        });
        await this.addPaperTo(frameId, spec, kind);
        await commitWorkbench(this.ea, true);
        await this.refreshPages();
        await this.showPage(this.numberOf(frameId), true);
      });
    }
    async addPageWith(kind) {
      await this.addPage(this.current, kind);
    }
    insertionPlan(elements, after, count, settings) {
      const first = insertPosition(this.pages, after, settings);
      const pitch = settings.pageHeight + settings.gap;
      const specs = Array.from({ length: count }, (_, index) => ({
        x: first.x,
        y: first.y + index * pitch,
        width: first.width,
        height: first.height,
        name: pageFrameName(after + 1 + index)
      }));
      const anchor = after >= 1 ? findPage(this.pages, Math.min(after, this.pages.length)) : void 0;
      const line = anchor ? anchor.y + anchor.height + settings.gap : after >= 1 ? null : this.pages[0]?.y ?? null;
      const shifts = line === null ? [] : belowLine(this.pages, elements, line, pitch * count);
      return { specs, shifts };
    }
    numberOf(frameId) {
      return this.pages.find((page) => page.id === frameId)?.number ?? this.current;
    }
    applyShiftsToWorkbench(shifts) {
      for (const shift of shifts) {
        const copy = this.ea.getElement(shift.id);
        if (copy) {
          copy.x += shift.dx;
          copy.y += shift.dy;
        }
      }
    }
    async deletePage(number2 = this.current) {
      await this.run(async () => {
        const page = findPage(this.pages, number2);
        if (!page) {
          return;
        }
        const title = `Delete page ${page.number}?`;
        const message = page.elementIds.length > 0 ? "This page and everything on it will be removed. You can undo with Command Z." : "This empty page will be removed.";
        const ok = await openConfirm(this.host.gea.obsidian, {
          title,
          message,
          actionLabel: "Delete page"
        });
        if (!ok) {
          return;
        }
        await removeByIds(this.ea, pageRemovalIds(this.pages, number2, liveElements(this.ea)));
        await this.closeGap(page);
        await this.refreshPages();
        await this.showPage(Math.min(number2, this.pages.length), false);
      });
    }
    async closeGap(removed) {
      const settings = this.host.settings();
      const elements = liveElements(this.ea);
      const rest = getPages(elements);
      if (rest.length > 0) {
        const line = removed.y + removed.height;
        await applyShifts(this.ea, belowLine(rest, elements, line, -(removed.height + settings.gap)));
        return;
      }
      const spec = {
        x: removed.x,
        y: removed.y,
        width: removed.width,
        height: removed.height,
        name: pageFrameName(1)
      };
      this.ea.clear();
      const frameId = addPageFrame(this.ea, spec);
      await this.addPaperTo(frameId, spec, settings.paper);
      await commitWorkbench(this.ea, true);
    }
    async refreshPaper() {
      const settings = this.host.settings();
      const sizes = /* @__PURE__ */ new Map();
      const add = (width, height) => {
        sizes.set(`${width}x${height}`, { width, height });
      };
      add(settings.pageWidth, settings.pageHeight);
      for (const page of this.pages) {
        add(page.width, page.height);
      }
      for (const size of sizes.values()) {
        for (const kind of paperKinds) {
          await paperSource(this.ea, kind, size);
        }
      }
    }
    async ensurePaper() {
      const page = findPage(this.pages, this.current) ?? this.pages[0];
      if (!page || page.paperId) {
        return;
      }
      await this.setPaper(this.host.settings().paper, page.number);
    }
    async setPaper(kind, number2 = this.current) {
      await this.run(async () => {
        const page = findPage(this.pages, number2);
        if (!page) {
          return;
        }
        const spec = {
          x: page.x,
          y: page.y,
          width: page.width,
          height: page.height,
          name: page.frame.name ?? ""
        };
        if (page.paperId) {
          await removeByIds(this.ea, [page.paperId]);
        }
        this.ea.clear();
        this.markPagePaper(page, kind);
        const paperId = await this.addPaperTo(page.id, spec, kind);
        await commitWorkbench(this.ea, true);
        if (paperId) {
          sendToBack(this.ea, paperId);
        }
        this.thumbCache.delete(page.id);
        this.signatures.delete(page.id);
        await this.refreshPages();
      });
    }
    markPagePaper(page, kind) {
      if (typeof page.frame.customData?.[PAGE_SEQ_MARK] !== "number") {
        return;
      }
      this.ea.copyViewElementsToEAforEditing([page.frame]);
      const frame = this.ea.getElement(page.id);
      if (frame) {
        this.ea.addAppendUpdateCustomData(frame.id, { [PAGE_PAPER_MARK]: kind });
      }
    }
    async addPaperTo(frameId, spec, kind) {
      const source = await paperSource(this.ea, kind, spec);
      if (!source) {
        return null;
      }
      return addPaperElement(this.ea, frameId, spec, source);
    }
    async importPdf(file, numbers) {
      await this.run(async () => {
        const wanted = await this.wantedPdfPages(file, numbers);
        if (wanted.length === 0) {
          return;
        }
        const plan = this.insertionPlan(
          liveElements(this.ea),
          this.current,
          wanted.length,
          this.host.settings()
        );
        this.ea.clear();
        this.ea.copyViewElementsToEAforEditing(shiftedElements(liveElements(this.ea), plan.shifts));
        this.applyShiftsToWorkbench(plan.shifts);
        let firstFrame = "";
        for (const [index, pdfPage] of wanted.entries()) {
          const spec = plan.specs[index];
          if (!spec) {
            continue;
          }
          const frameId = addPageFrame(this.ea, spec);
          firstFrame ||= frameId;
          await addPdfPageElement(this.ea, frameId, file, pdfPage, spec);
        }
        await commitWorkbench(this.ea, true);
        await this.refreshPages();
        await this.showPage(this.numberOf(firstFrame), true);
        const suffix = wanted.length === 1 ? "page" : "pages";
        new this.host.gea.obsidian.Notice(`Imported ${wanted.length} ${suffix} from ${file.name}.`);
      });
    }
    async wantedPdfPages(file, numbers) {
      const info = await readPdfPages(file);
      return numbers.slice().sort((a, b) => a - b).map((number2) => info[number2 - 1]).filter((page) => page !== void 0);
    }
    async run(task) {
      if (this.busy || this.disposed) {
        return;
      }
      this.busy = true;
      this.syncUi();
      try {
        await task();
      } catch (error) {
        new this.host.gea.obsidian.Notice(`Excalidraw Notebooks: ${describeError(error)}`, 6e3);
      } finally {
        this.busy = false;
        if (!this.disposed) {
          await this.refreshPages();
          this.syncUi();
        }
      }
    }
    dispose(releaseViewport2 = true) {
      if (this.disposed) {
        return;
      }
      this.disposed = true;
      const content = this.view.contentEl;
      content.removeEventListener("wheel", this.onWheel, { capture: true });
      content.removeEventListener("keydown", this.onKeyDown, true);
      this.resizeObserver.disconnect();
      for (const timer of [this.refreshTimer, this.resizeTimer, this.wheelTimer, this.settleTimer]) {
        if (timer !== null) {
          this.view.ownerWindow.clearTimeout(timer);
        }
      }
      this.bar.destroy();
      this.thumbs.destroy();
      this.releaseContrast();
      this.root.remove();
      if (releaseViewport2) {
        releaseViewport(this.api);
      }
      this.ea.destroy();
    }
  };

  var WRAP_MARGIN = 48;
  function contentBounds(elements) {
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const element of elements) {
      left = Math.min(left, element.x);
      top = Math.min(top, element.y);
      right = Math.max(right, element.x + element.width);
      bottom = Math.max(bottom, element.y + element.height);
    }
    if (!Number.isFinite(left)) {
      return null;
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  function wrapPage(bounds, page, margin = WRAP_MARGIN) {
    const width = Math.max(page.width, (bounds?.width ?? 0) + margin * 2);
    const height = Math.max(page.height, (bounds?.height ?? 0) + margin * 2);
    return {
      x: bounds ? Math.round(bounds.x + bounds.width / 2 - width / 2) : 0,
      y: bounds ? Math.round(bounds.y + bounds.height / 2 - height / 2) : 0,
      width: Math.round(width),
      height: Math.round(height),
      name: pageFrameName(1)
    };
  }
  var looseIds = (elements) => elements.filter((element) => !element.frameId).map((element) => element.id);
  async function wrapIntoPage(ea2, elements, spec, paper) {
    ea2.clear();
    const frameId = addPageFrame(ea2, spec, { paper, seq: 1 });
    const source = await paperSource(ea2, paper, spec);
    const paperId = source ? await addPaperElement(ea2, frameId, spec, source) : null;
    await commitWorkbench(ea2, true);
    if (paperId) {
      sendToBack(ea2, paperId);
    }
    const loose = looseIds(elements);
    if (loose.length > 0) {
      await setFrameIds(
        ea2,
        loose.map((id) => ({ id, frameId }))
      );
    }
  }
  async function unwrapPages(ea2, parts) {
    const locked = [...parts.frameIds, ...parts.paperIds];
    if (locked.length > 0) {
      await setLocked(ea2, locked, false);
    }
    await removeByIds(ea2, [...parts.paperIds, ...parts.frameIds]);
    const frames = new Set(parts.frameIds);
    const stranded = liveElements(ea2).filter(
      (element) => typeof element.frameId === "string" && frames.has(element.frameId)
    );
    if (stranded.length > 0) {
      await setFrameIds(
        ea2,
        stranded.map((element) => ({ id: element.id, frameId: null }))
      );
    }
  }

  var fileNameLimit = 120;
  var headLimit = 400;
  var drawingExtension = ".excalidraw.md";
  function notebookFileName(title) {
    const safe = title.replace(/[\\\/:*?"<>|]/g, "-").trim().replace(/\r\n?|\n/g, "-").replace(/\s+/g, " ").trim();
    const name = Array.from(safe).slice(0, fileNameLimit).join("").trim();
    return name === "" ? "Notebook" : name;
  }
  function isNotebookEntry(text) {
    const separator = text.indexOf(":");
    if (separator === -1) {
      return false;
    }
    const key = text.slice(0, separator).trimEnd();
    const value = text.slice(separator + 1).trim().toLowerCase();
    return key === NOTEBOOK_FRONTMATTER_KEY && value === "true";
  }
  function headDeclaresNotebook(head) {
    const lines = head.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") {
      return false;
    }
    for (const line of lines.slice(1)) {
      const text = line.trim();
      if (text === "---") {
        return false;
      }
      if (isNotebookEntry(text)) {
        return true;
      }
    }
    return false;
  }
  function vaultOf(deps) {
    if (deps.app) {
      return deps.app.vault;
    }
    return app.vault;
  }
  async function isNotebookFile(file, deps = {}) {
    const head = (await vaultOf(deps).cachedRead(file)).slice(0, headLimit);
    return headDeclaresNotebook(head);
  }
  function normalizeFolder(folder) {
    return folder.replace(/\\/g, "/").split("/").map((part) => part.trim()).filter(Boolean).join("/");
  }
  function notebookTheme(bodyClass) {
    return /(?:^|\s)theme-dark(?:\s|$)/.test(bodyClass) ? "dark" : "light";
  }
  function newNotebookName(now = /* @__PURE__ */ new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
    return `Notebook ${date} ${time}`;
  }
  function notebookPath(folder, title) {
    const name = `${notebookFileName(title)}${drawingExtension}`;
    const normalized = normalizeFolder(folder);
    return normalized === "" ? name : `${normalized}/${name}`;
  }
  function availablePath(vault, path) {
    const stem = path.slice(0, -drawingExtension.length);
    for (let copy = 2; ; copy += 1) {
      if (!vault.getAbstractFileByPath(path)) {
        return path;
      }
      path = `${stem} ${copy}${drawingExtension}`;
    }
  }
  function newWorkbench(plugin, win = window) {
    const Maker = win.ExcalidrawAutomate.constructor;
    return new Maker(plugin);
  }
  async function createNotebook(ea2, folder, title, fill, deps = {}) {
    const vault = vaultOf(deps);
    const target = normalizeFolder(folder);
    if (target !== "") {
      await ea2.checkAndCreateFolder(target);
    }
    const path = availablePath(vault, notebookPath(target, title));
    const host = deps.window ?? window;
    const maker = newWorkbench(ea2.plugin, host);
    if (maker.canvas) {
      maker.canvas.theme = notebookTheme(host.document.body.className);
    }
    try {
      await fill(maker);
      await maker.create({
        exactPath: path,
        frontmatterKeys: {
          "excalidraw-plugin": "parsed",
          [NOTEBOOK_FRONTMATTER_KEY]: "true"
        },
        silent: true
      });
    } finally {
      maker.clear();
    }
    const file = vault.getFileByPath(path);
    if (!file) {
      throw new Error(`Notebook file was not created: ${path}`);
    }
    return file;
  }
  async function openInNewTab(file) {
    const leaf = app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    return leaf;
  }

  var PAPER_NAMES = [
    ["Plain", "plain"],
    ["Ruled", "ruled"],
    ["Dotted", "dotted"],
    ["Grid", "grid"]
  ];
  function moreMenu(pageNumber, actions) {
    return [
      { icon: "file-digit", title: "Go to page", run: actions.goToPage },
      { icon: "file-up", title: "Import PDF", run: actions.importPdf },
      {
        icon: "sticky-note",
        title: "Change paper type",
        choices: PAPER_NAMES.map(([title, kind]) => [title, () => actions.setPaper(kind)])
      },
      { icon: "trash-2", title: `Delete page ${pageNumber}`, run: actions.deletePage },
      { separator: true },
      { icon: "undo-2", title: "Turn into a drawing", warning: true, run: actions.turnIntoDrawing },
      { separator: true },
      { icon: "settings", title: "Settings", run: actions.openSettings }
    ];
  }
  function pageTypeMenu(current, actions) {
    return [
      ...PAPER_NAMES.map(([title, kind]) => {
        const name = title.toLowerCase();
        return {
          icon: "sticky-note",
          title: `Add ${name} page`,
          checked: kind === current,
          run: () => actions.addPage(kind)
        };
      }),
      { icon: "file-up", title: "Import PDF", run: actions.importPdf }
    ];
  }
  var fillSubmenu = (item, choices) => {
    if (!choices || !item.setSubmenu) {
      return;
    }
    const submenu = item.setSubmenu();
    submenu.setUseNativeMenu?.(false);
    for (const [title, run] of choices) {
      submenu.addItem((entry) => {
        entry.setTitle(title).onClick(run);
      });
    }
  };
  var fillEntry = (item, entry) => {
    let built = item.setIcon(entry.icon).setTitle(entry.title);
    if (entry.warning) {
      built = built.setWarning?.(true) ?? built;
    }
    if (entry.checked !== void 0) {
      built = built.setChecked?.(entry.checked) ?? built;
    }
    fillSubmenu(built, entry.choices);
    if (entry.run) {
      built.onClick(entry.run);
    }
  };
  function fillMenu(menu, lines) {
    for (const line of lines) {
      if ("separator" in line) {
        menu.addSeparator();
      } else {
        menu.addItem((item) => fillEntry(item, line));
      }
    }
  }

  var allPages = (count) => {
    const pages = [];
    for (let page = 1; page <= count; page += 1) {
      pages.push(page);
    }
    return pages;
  };
  var fail = (error) => ({ pages: [], error });
  var parsePageRange = (text, count) => {
    if (count < 1) {
      return fail("This PDF has no pages.");
    }
    const trimmed = text.trim();
    if (trimmed === "") {
      return { pages: allPages(count), error: null };
    }
    const pages = /* @__PURE__ */ new Set();
    const compact = trimmed.replace(/(\d)\s*-\s*(\d)/g, "$1-$2");
    for (const part of compact.split(/[\s,]+/).filter(Boolean)) {
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
      if (!match) {
        return fail("Use page numbers like 3 or ranges like 1-10, separated by commas.");
      }
      const from = Number(match[1]);
      const to = match[2] ? Number(match[2]) : from;
      if (from < 1 || to > count || from > to) {
        return fail(`Pages must be between 1 and ${count}, with the start before the end.`);
      }
      for (let page = from; page <= to; page += 1) {
        pages.add(page);
      }
    }
    if (pages.size === 0) {
      return fail("Enter at least one page.");
    }
    return { pages: [...pages].sort((a, b) => a - b), error: null };
  };

  var STORE_KEY = "Notebooks/excalidraw-notebooks";
  var asPartial = (value) => typeof value === "object" && value !== null ? value : void 0;
  var loadSettings = (gea) => normalizeSettings(asPartial(pluginInternals(gea).settings.scriptEngineSettings[STORE_KEY]));
  var saveSettings = async (gea, settings) => {
    pluginInternals(gea).settings.scriptEngineSettings[STORE_KEY] = { ...settings };
    await pluginInternals(gea).saveSettings();
  };

  var COMMAND_PREFIX = "exn-";
  var MOUNT_TIMEOUT = 6e3;
  var SCENE_TIMEOUT = 8e3;
  var POLL_DELAY = 100;
  var DRAWING_PATH = /\.excalidraw\.md$/i;
  var describeError2 = (error) => error instanceof Error ? error.message : String(error);
  var rangePlaceholder = (count) => {
    if (count <= 1) {
      return "All 1 page";
    }
    const example = count >= 12 ? "1-10 or 3, 7, 12" : count === 2 ? "1 or 2" : `1-${count - 1} or ${count}`;
    return `All ${count} pages, or for example ${example}`;
  };
  var parentFolder = (path) => {
    const cut = path.lastIndexOf("/");
    return cut < 0 ? "" : path.slice(0, cut);
  };
  var markedAsNotebook = (cache) => {
    const value = cache?.frontmatter?.[NOTEBOOK_FRONTMATTER_KEY];
    return value === true || value === "true";
  };
  var commandsFor = (app2, launch, onActive) => [
    ["new-notebook", "Notebooks: New notebook", launch(() => app2.newNotebook())],
    ["add-page", "Notebooks: Add page after this page", onActive((c) => c.addPage())],
    ["delete-page", "Notebooks: Delete this page", onActive((c) => c.deletePage())],
    ["previous-page", "Notebooks: Previous page", onActive((c) => c.step(-1))],
    ["next-page", "Notebooks: Next page", onActive((c) => c.step(1))],
    ["go-to-page", "Notebooks: Go to page", onActive((c) => app2.goToPage(c))],
    [
      "toggle-view-mode",
      "Notebooks: Toggle paged or scrolling view",
      launch(() => app2.toggleViewMode())
    ],
    ["toggle-thumbnails", "Notebooks: Toggle page thumbnails", launch(() => app2.toggleThumbnails())],
    ["change-paper", "Notebooks: Change paper of this page", onActive((c) => app2.changePaper(c))],
    ["import-pdf", "Notebooks: Import PDF pages", onActive((c) => app2.importPdf(c))],
    [
      "turn-into-notebook",
      "Notebooks: Turn this drawing into a notebook",
      () => app2.turnActiveIntoNotebook()
    ],
    [
      "turn-into-drawing",
      "Notebooks: Turn this notebook into a drawing",
      onActive((c) => app2.switchType(c.file))
    ],
    ["settings", "Notebooks: Open settings", () => app2.openSettings()]
  ];
  var sceneReady = (view) => {
    const live = liveView(view);
    return live._loaded === true && Boolean(live.excalidrawAPI);
  };
  var sceneHasPage = (view) => {
    const api = liveView(view).excalidrawAPI;
    if (!api) {
      return false;
    }
    return api.getSceneElements().some((element) => !element.isDeleted && isPageFrame(element));
  };
  var NotebookApp = class {
    constructor(gea, utils2) {
      this.gea = gea;
      this.utils = utils2;
      this.settingsValue = loadSettings(gea);
    }
    gea;
    utils;
    settingsValue;
    controllers = /* @__PURE__ */ new Map();
    pending = /* @__PURE__ */ new Map();
    fileMenu = null;
    disposed = false;
    fileOpenHook = async (data) => {
      await this.attach(data.view, data.excalidrawFile);
    };
    settings() {
      return this.settingsValue;
    }
    async start() {
      this.gea.onFileOpenHook = this.fileOpenHook;
      this.registerCommands();
      this.fileMenu = this.gea.plugin.app.workspace.on(
        "file-menu",
        (menu, file) => this.addFileMenuItems(menu, file)
      );
      for (const leaf of this.gea.plugin.app.workspace.getLeavesOfType("excalidraw")) {
        const view = leaf.view;
        const file = liveView(view).file;
        if (file) {
          await this.attach(view, file);
        }
      }
    }
    dispose() {
      this.disposed = true;
      if (this.gea.onFileOpenHook === this.fileOpenHook) {
        clearFileOpenHook(this.gea);
      }
      if (this.fileMenu) {
        this.gea.plugin.app.workspace.offref(this.fileMenu);
        this.fileMenu = null;
      }
      for (const controller of [...this.controllers.values()]) {
        controller.dispose(false);
      }
      this.controllers.clear();
    }
    active() {
      const leaf = this.gea.plugin.app.workspace.activeLeaf;
      const view = leaf?.view;
      if (!view) {
        return null;
      }
      return this.controllers.get(view) ?? null;
    }
    async attach(view, file) {
      const existing = this.controllers.get(view);
      if (existing) {
        if (existing.file === file) {
          return;
        }
        this.controllers.delete(view);
        existing.dispose();
      }
      if (this.disposed || this.pending.get(view) === file) {
        return;
      }
      this.pending.set(view, file);
      try {
        if (!await isNotebookFile(file)) {
          return;
        }
        const controller = await NotebookController.open(this, view, file);
        if (controller && !this.disposed) {
          this.controllers.set(view, controller);
        }
      } finally {
        this.pending.delete(view);
      }
    }
    detach(view) {
      const controller = this.controllers.get(view);
      if (controller) {
        this.controllers.delete(view);
        controller.dispose(false);
      }
    }
    fileOpened(view, file) {
      void this.attach(view, file);
    }
    registerCommands() {
      const plugin = pluginInternals(this.gea);
      for (const [id, name, callback] of this.commandTable()) {
        const command = plugin.addCommand({ id: `${COMMAND_PREFIX}${id}`, name, callback });
        this.gea.registerCleanup(() => {
          if (command.id) {
            commandRegistry(this.gea).removeCommand(command.id);
          }
        });
      }
    }
    commandTable() {
      const onActive = (task) => () => {
        const controller = this.active();
        if (!controller) {
          new this.gea.obsidian.Notice("Open a notebook first, then run the command again.");
          return;
        }
        void task(controller);
      };
      const launch = (task) => () => {
        void task();
      };
      return commandsFor(this, launch, onActive);
    }
    async toggleViewMode() {
      const next = this.settingsValue.viewMode === "paged" ? "scroll" : "paged";
      await this.updateSettings({ viewMode: next });
    }
    async toggleThumbnails() {
      await this.updateSettings({ showThumbnails: !this.settingsValue.showThumbnails });
    }
    async updateSettings(patch) {
      this.settingsValue = normalizeSettings({ ...this.settingsValue, ...patch });
      await saveSettings(this.gea, this.settingsValue);
      for (const controller of this.controllers.values()) {
        await controller.applySettings();
      }
    }
    openSettings() {
      const ob = this.gea.obsidian;
      openSettingsDialog(
        ob,
        { doc: document, setIcon: (el, icon) => ob.setIcon(el, icon) },
        this.settingsValue,
        async (next) => {
          this.settingsValue = normalizeSettings(next);
          await saveSettings(this.gea, this.settingsValue);
          for (const controller of this.controllers.values()) {
            await controller.applySettings();
          }
        }
      );
    }
    openMenu(controller, anchor) {
      this.showMenu(anchor, "center", (menu) => {
        fillMenu(
          menu,
          moreMenu(controller.pageNumber, {
            goToPage: () => {
              void this.goToPage(controller);
            },
            importPdf: () => {
              void this.importPdf(controller);
            },
            setPaper: (kind) => {
              void controller.setPaper(kind);
            },
            deletePage: () => {
              void controller.deletePage();
            },
            turnIntoDrawing: () => {
              void this.switchType(controller.file);
            },
            openSettings: () => this.openSettings()
          })
        );
      });
    }
    openPageTypeMenu(controller, anchor) {
      this.showMenu(anchor, "start", (menu) => {
        fillMenu(
          menu,
          pageTypeMenu(controller.paperToAdd(), {
            addPage: (kind) => {
              void controller.addPageWith(kind);
            },
            importPdf: () => {
              void this.importPdf(controller);
            }
          })
        );
      });
    }
    showMenu(anchor, align, build2) {
      const rect = anchor.getBoundingClientRect();
      const x = align === "center" ? rect.left + rect.width / 2 : rect.left;
      anchor.ownerDocument.defaultView?.setTimeout(() => {
        if (this.disposed) {
          return;
        }
        const menu = new this.gea.obsidian.Menu();
        menu.setUseNativeMenu(false);
        build2(menu);
        menu.showAtPosition({ x, y: rect.top - 8 });
      }, 0);
    }
    async goToPage(controller) {
      const count = controller.pageCount;
      const value = await openTextDialog(this.gea.obsidian, {
        title: "Go to page",
        label: `Page, from 1 to ${count}`,
        value: String(controller.pageNumber),
        submitLabel: "Go",
        validate: (text) => {
          const page = Number(text.trim());
          return Number.isInteger(page) && page >= 1 && page <= count ? null : `Enter a whole number from 1 to ${count}.`;
        }
      });
      if (value === null) {
        return;
      }
      await controller.showPage(Number(value), true);
    }
    async changePaper(controller) {
      const kind = await this.utils.suggester(
        PAPER_NAMES.map(([label]) => label),
        PAPER_NAMES.map(([, paper]) => paper),
        "Paper for this page"
      );
      if (kind) {
        await controller.setPaper(kind);
      }
    }
    async importPdf(controller) {
      const file = await pickPdf(this.gea.obsidian);
      if (!file) {
        return;
      }
      const count = (await readPdfPages(file)).length;
      const range = await openTextDialog(this.gea.obsidian, {
        title: "Import PDF pages",
        description: `${file.name} has ${count === 1 ? "1 page" : `${count} pages`}. Each imported page becomes a notebook page after page ${controller.pageNumber}.`,
        label: "Pages to import",
        value: "",
        placeholder: rangePlaceholder(count),
        submitLabel: "Import",
        validate: (text) => parsePageRange(text, count).error
      });
      if (range === null) {
        return;
      }
      await controller.importPdf(file, parsePageRange(range, count).pages);
    }
    async newNotebook(folder = null) {
      const ob = this.gea.obsidian;
      const settings = this.settingsValue;
      const target = folder ?? pluginInternals(this.gea).settings.folder ?? "";
      try {
        const file = await createNotebook(this.gea, target, newNotebookName(), async (maker) => {
          addPageFrame(
            maker,
            {
              x: 0,
              y: 0,
              width: settings.pageWidth,
              height: settings.pageHeight,
              name: pageFrameName(1)
            },
            { paper: settings.paper, seq: 1 }
          );
        });
        const leaf = await openInNewTab(file);
        const controller = await this.waitForController(leaf.view);
        if (controller) {
          await controller.ensurePaper();
          await controller.showPage(1, false);
        }
      } catch (error) {
        new ob.Notice(`Excalidraw Notebooks: ${describeError2(error)}`, 6e3);
      }
    }
    addFileMenuItems(menu, file) {
      const ob = this.gea.obsidian;
      const folder = file instanceof ob.TFolder ? file.path : file instanceof ob.TFile ? parentFolder(file.path) : null;
      let create;
      menu.addItem((item) => {
        create = item;
        item.setSection("action-primary").setTitle("New notebook").setIcon("notebook").onClick(() => {
          void this.newNotebook(folder);
        });
      });
      if (create) {
        placeAfterNewNote(menu, create);
      }
      if (file instanceof ob.TFile && DRAWING_PATH.test(file.path)) {
        const notebook = markedAsNotebook(this.gea.plugin.app.metadataCache.getFileCache(file));
        menu.addItem(
          (item) => item.setTitle(notebook ? "Turn into a drawing" : "Turn into a notebook").onClick(() => {
            void this.switchType(file);
          })
        );
      }
    }
    turnActiveIntoNotebook() {
      if (this.active()) {
        new this.gea.obsidian.Notice("This drawing is already a notebook.");
        return;
      }
      const view = this.gea.plugin.app.workspace.activeLeaf?.view;
      const live = view ? liveView(view) : null;
      const file = live?.getViewType?.() === "excalidraw" ? live.file : null;
      if (!file) {
        new this.gea.obsidian.Notice("Open a drawing first, then run the command again.");
        return;
      }
      void this.switchType(file);
    }
    async switchType(file) {
      try {
        if (await isNotebookFile(file)) {
          await this.notebookToDrawing(file);
        } else {
          await this.drawingToNotebook(file);
        }
      } catch (error) {
        new this.gea.obsidian.Notice(`Excalidraw Notebooks: ${describeError2(error)}`, 6e3);
      }
    }
    async drawingToNotebook(file) {
      const view = await this.openDrawing(file);
      if (!view || this.controllers.has(view)) {
        return;
      }
      const ready = await this.waitFor(() => sceneReady(view));
      if (!ready) {
        throw new Error("The drawing did not finish opening.");
      }
      const settings = this.settingsValue;
      const ea2 = newEa(this.gea, view);
      try {
        const elements = liveElements(ea2);
        const page = { width: settings.pageWidth, height: settings.pageHeight };
        await wrapIntoPage(ea2, elements, wrapPage(contentBounds(elements), page), settings.paper);
      } finally {
        ea2.destroy();
      }
      await this.saveView(view);
      await this.markNotebook(file, true);
      await this.waitFor(async () => {
        const cache = this.gea.plugin.app.metadataCache.getFileCache(file);
        return markedAsNotebook(cache) && this.sceneSettled(view) && sceneHasPage(view);
      });
      await this.attach(view, file);
    }
    async notebookToDrawing(file) {
      const view = await this.openDrawing(file);
      if (!view) {
        return;
      }
      const controller = await this.waitFor(() => this.controllers.get(view));
      if (!controller) {
        throw new Error("The notebook did not finish opening.");
      }
      const ok = await openConfirm(this.gea.obsidian, {
        title: "Turn this notebook into a drawing?",
        message: "The pages and their paper will be removed. Everything drawn on them stays where it is. You can turn it back into a notebook later.",
        actionLabel: "Turn into drawing"
      });
      if (!ok) {
        return;
      }
      const parts = controller.pageParts();
      this.release(view);
      const ea2 = newEa(this.gea, view);
      try {
        await unwrapPages(ea2, parts);
      } finally {
        ea2.destroy();
      }
      await this.saveView(view);
      await this.markNotebook(file, false);
      await this.waitFor(async () => {
        const cache = this.gea.plugin.app.metadataCache.getFileCache(file);
        if (markedAsNotebook(cache) || !this.sceneSettled(view)) {
          return false;
        }
        if (viewLocked(view)) {
          releaseViewport(liveView(view).excalidrawAPI);
          return false;
        }
        return true;
      });
    }
    release(view) {
      const controller = this.controllers.get(view);
      if (controller) {
        this.controllers.delete(view);
        controller.dispose();
      }
    }
    async openDrawing(file) {
      const workspace = this.gea.plugin.app.workspace;
      const open = workspace.getLeavesOfType("excalidraw").find((leaf2) => liveView(leaf2.view).file === file);
      const leaf = open ?? workspace.getLeaf("tab");
      if (!open) {
        await leaf.openFile(file);
      }
      const view = leaf.view;
      return liveView(view).file === file ? view : null;
    }
    sceneSettled(view) {
      const live = liveView(view);
      return sceneReady(view) && live.isDirty?.() !== true && live.isPersistenceBusy?.() !== true;
    }
    async saveView(view) {
      await liveView(view).save?.();
      await this.waitFor(() => this.sceneSettled(view));
    }
    async markNotebook(file, notebook) {
      await this.gea.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (notebook) {
          frontmatter[NOTEBOOK_FRONTMATTER_KEY] = true;
        } else {
          delete frontmatter[NOTEBOOK_FRONTMATTER_KEY];
        }
      });
    }
    async waitFor(probe) {
      const deadline = Date.now() + SCENE_TIMEOUT;
      while (Date.now() < deadline) {
        const found = await probe();
        if (found) {
          return found;
        }
        await delay(POLL_DELAY);
      }
      return null;
    }
    async waitForController(view) {
      const deadline = Date.now() + MOUNT_TIMEOUT;
      while (Date.now() < deadline) {
        const controller = this.controllers.get(view);
        if (controller) {
          return controller;
        }
        await delay(100);
      }
      return null;
    }
  };

  async function main() {
    const ob = ea.obsidian;
    if (!ea.verifyMinimumPluginVersion(MINIMUM_PLUGIN_VERSION)) {
      new ob.Notice(
        `Excalidraw Notebooks needs the Excalidraw plugin ${MINIMUM_PLUGIN_VERSION} or newer.`
      );
      return;
    }
    const running = window[RUNNING_FLAG];
    if (running) {
      if (utils.executionSource !== "plugin-startup") {
        running.openSettings();
      }
      return;
    }
    const notebooks = new NotebookApp(ea, utils);
    await notebooks.start();
    window[RUNNING_FLAG] = notebooks;
    ea.registerCleanup(() => {
      if (window[RUNNING_FLAG] === notebooks) {
        delete window[RUNNING_FLAG];
      }
      notebooks.dispose();
    });
    if (utils.executionSource !== "plugin-startup") {
      new ob.Notice(
        "Excalidraw Notebooks is running for this session. Set it as the startup script in the Excalidraw settings, under Excalidraw Automate, to keep it running.",
        8e3
      );
    }
  }
  void main();
})();
