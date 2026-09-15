/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-mouse-wheel-zoom.png)

Automatically converts mouse wheel scroll into zoom in/out. Trackpad gestures are unaffected: two-finger scroll still pans, pinch still zooms. Run the script again to toggle the behavior off.

This script detects whether a wheel event comes from a mouse or a trackpad using heuristics (deltaMode, deltaX/deltaY magnitude, event frequency). When a mouse wheel event is detected, it is intercepted and re-dispatched with ctrlKey set to true, which triggers Excalidraw's built-in zoom-toward-cursor behavior.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
const canvas = document.querySelector(".excalidraw");
if (!canvas) {
    new Notice("No Excalidraw canvas found");
    return;
}

if (canvas._wheelZoomHandler) {
    canvas.removeEventListener("wheel", canvas._wheelZoomHandler, true);
    canvas._wheelZoomHandler = null;
    new Notice("Mouse wheel zoom: OFF");
    return;
}

const WINDOW_MS = 400;
let recentEvents = [];

function isMouseWheel(e) {
    if (e._synthetic) return false;
    if (e.ctrlKey || e.metaKey) return false;
    if (e.deltaMode === 1 || e.deltaMode === 2) return true;
    if (Math.abs(e.deltaX) > 2) return false;

    const now = Date.now();
    recentEvents.push({ t: now, dy: Math.abs(e.deltaY) });
    recentEvents = recentEvents.filter(ev => now - ev.t < WINDOW_MS);

    if (recentEvents.length >= 3) {
        const avg = recentEvents.reduce((s, ev) => s + ev.dy, 0) / recentEvents.length;
        if (avg < 8) return false;
        if (avg >= 20) return true;
    }

    if (Math.abs(e.deltaY) >= 40 && Math.abs(e.deltaX) <= 2) return true;
    if (Math.abs(e.deltaY) < 4) return false;

    return Math.abs(e.deltaY) >= 20;
}

function handleWheel(e) {
    if (e._synthetic) return;
    if (!isMouseWheel(e)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const zoomEvent = new WheelEvent("wheel", {
        deltaX: 0,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        ctrlKey: true,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        bubbles: true,
        cancelable: true,
    });

    Object.defineProperty(zoomEvent, "_synthetic", { value: true });
    e.target.dispatchEvent(zoomEvent);
}

canvas._wheelZoomHandler = handleWheel;
canvas.addEventListener("wheel", handleWheel, { capture: true, passive: false });
new Notice("Mouse wheel zoom: ON");
