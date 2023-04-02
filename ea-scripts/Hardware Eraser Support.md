/*
Adds support for pen inversion, a.k.a. the hardware eraser on the back of your pen.

Simply use the eraser on a supported pen, and it will erase. Your previous tool will be restored when the eraser leaves the screen.
(Tested with a surface pen, but should work with all windows ink devices, and probably others)

**Note:** This script will stay active until the *Obsidian* window is closed.

Compatible with my *Auto Draw for Pen* script

```javascript
*/

(function() {
    'use strict';

    let activated
    let revert
    
    function handlePointer(e) {
        const activeTool = ea.getExcalidrawAPI().getAppState().activeTool;
        const isEraser = e.pointerType === 'pen' && e.buttons & 32
        function setActiveTool(t) {
            ea.getExcalidrawAPI().setActiveTool(t)
        }
        if (!activated && isEraser) {
            //Store previous tool
            const btns = document.querySelectorAll('.App-toolbar input.ToolIcon_type_radio')
            for (const i in btns) {
                if (btns[i]?.checked) {
                    revert = btns[i]
                }
            }
            revert = activeTool

            // Activate eraser tool
            setActiveTool({type: "eraser"})
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
            setActiveTool({type: "eraser"})
        }
        if (activated && !isEraser) {
            // Revert tool on release
            // revert.click()
            setActiveTool(revert)
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
            setActiveTool(revert)
        }
    }
    
    window.addEventListener('pointerdown', handlePointer, { capture: true })
    window.addEventListener('pointermove', handlePointer, { capture: true })
})();