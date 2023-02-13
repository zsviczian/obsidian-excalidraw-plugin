/*
Adds support for pen inversion/hardware erasers.

Simply use the eraser on a supported pen, and it will erase. Your previous tool will be restored when the eraser leaves the screen.
(Tested with a surface pen, but should work with all windows ink devices, and probably others)

**Note:** Run this script *once*, it will stay active until the Obsidian is closed. *(I'd recommend you run this at startup via a commander plugin macro, after a short delay)*

Compatible with my *Auto Draw for Pen* script

```javascript
*/
(function() {
    'use strict';

    let activated
    let revert
    function handlePointer(e) {
        const isEraser = e.pointerType === 'pen' && e.buttons & 32
        if (!activated && isEraser) {
            //Store previous tool
            const btns = document.querySelectorAll('input.ToolIcon_type_radio')
            for (const i in btns) {
                if (btns[i]?.checked) {
                    revert = btns[i]
                }
            }

            // Activate eraser tool
            document.querySelector('[aria-label="Eraser"]')?.click()
            activated = true

            // Force Excalidraw to recognize this the same as pen tip
            // https://github.com/excalidraw/excalidraw/blob/4a9fac2d1e5c4fac334201ef53c6f5d2b5f6f9f5/src/components/App.tsx#L2945-L2951
            Object.defineProperty(e, 'button', {
                value: 0,
                writable: false
            });
        }
        // Keep on eraser!
        if (isEraser && activated) {
            document.querySelector('[aria-label="Eraser"]')?.click()
        }
        if (activated && !isEraser) {
            // Revert tool on release
            revert.click()
            activated = false
            
            // Force delete "limbo" elements
            // This doesn't happen on the web app
            // It's a bug caused by switching to eraser during a stroke
            ea.setView("active");
            var del = []
            for (const i in ea.getViewElements()) {
                const element = ea.getViewElements()[i];
                if (element.opacity === 20) {
                    del.push(element)
                }
            }
            ea.deleteViewElements(del)
        }
    }

    window.addEventListener('pointerdown', handlePointer, { capture: true })
    window.addEventListener('pointermove', handlePointer, { capture: true })
})();