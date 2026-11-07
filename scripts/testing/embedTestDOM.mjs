/** Small lifecycle/DOM boundary for production embed-controller tests; no rendering claim. */
export function embedTestDOM() {
  const observers = [], frames = new Map(); let listeners = 0, nextFrame = 0;
  const window = { events: new Map(), closed: false, innerWidth: 800, MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
    fire() { if (this.connected) this.callback(); }
  } };
  window.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.ResizeObserver = class extends window.MutationObserver {
    constructor(callback) { super(callback); this.resize = true; }
    observe(target) { super.observe(); this.target = target; }
  };
  const document = { defaultView: window, activeElement: null };
  class Element {
    constructor(options = {}) { this.children = []; this.attrs = { ...options.attr }; this.classes = new Set((options.cls || "").split(" ")); this.events = new Map(); this.style = {}; this.ownerDocument = document; this.isConnected = true; this.captures = new Set(); this.bounds = { left: 0, top: 0, right: 700, bottom: 130, width: 700, height: 130 }; }
    createDiv(options) { return this.createEl("div", typeof options === "string" ? { cls: options } : options); }
    createSpan(options) { return this.createEl("span", options); }
    createEl(tag, options) { const el = new Element(options); el.tagName = tag.toUpperCase(); this.append(el); return el; }
    append(el) { el.remove(); el.isConnected = true; el.parentElement = this; this.children.push(el); }
    addClass(...classes) { for (const cls of classes) this.classes.add(cls); }
    removeClass(...classes) { for (const cls of classes) this.classes.delete(cls); }
    toggleClass(cls, value) { if (value) this.classes.add(cls); else this.classes.delete(cls); }
    hasClass(cls) { return this.classes.has(cls); }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    setText(text) { this.text = text; }
    focus() { document.activeElement = this; }
    remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(el => el !== this); this.parentElement = null; }
    empty() { for (const child of [...this.children]) child.remove(); }
    matches(selector) { return selector.startsWith(".") ? this.classes.has(selector.slice(1)) : this.tagName === selector.toUpperCase(); }
    querySelectorAll(selector) { return this.children.flatMap(el => [...(selector.split(",").some(part => el.matches(part.trim())) ? [el] : []), ...el.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) { for (let el = this; el; el = el.parentElement) if (selector.split(",").some(part => el.matches(part.trim()))) return el; return null; }
    getBoundingClientRect() { return this.bounds; }
    fire(name, event = {}) { return fire(this, name, event); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const fire = (target, name, event = {}) => {
    const e = { currentTarget: target, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...event };
    for (const callback of [...target.events.get(name) || []]) callback(e); return e;
  };
  class Component {
    cleanups = [];
    load() { this.onload?.(); }
    register(callback) { this.cleanups.push(callback); }
    registerDomEvent(el, event, callback) {
      if (!el.events.has(event)) el.events.set(event, new Set());
      el.events.get(event).add(callback); listeners++;
      this.register(() => { el.events.get(event).delete(callback); listeners--; });
    }
    unload() { for (const cleanup of this.cleanups.splice(0)) cleanup(); this.onunload?.(); }
  }
  class MarkdownRenderChild extends Component { constructor(containerEl) { super(); this.containerEl = containerEl; } }
  return { Element, Component, MarkdownRenderChild, window, document, fire, observers, listenerCount: () => listeners,
    pendingFrames: () => frames.size, flushFrames: () => { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(); } };
}
