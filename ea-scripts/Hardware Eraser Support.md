/*
Adds support for pen inversion, a.k.a. the hardware eraser on the back of your pen.

Simply use the eraser on a supported pen, and it will erase. Your previous tool will be restored when the eraser leaves the screen.
(Tested with a surface pen, but should work with all windows ink devices, and probably others)

**Note:** This script will stay active until the *Obsidian* window is closed.

Compatible with my *Auto Draw for Pen* script

```javascript
*/

let eaGlobal = ea

(function() {
    'use strict';

    let activated
    let revert
    
    function handlePointer(e) {
        const activeTool = eaGlobal.getExcalidrawAPI().getAppState().activeTool
        const isEraser = e.pointerType === 'pen' && e.buttons & 32
        function setActiveTool(t) {
            eaGlobal.getExcalidrawAPI().setActiveTool(t)
        }
        if (!activated && isEraser) {
            if (activeTool.type == "eraser") {
                //console.log("Multiple instances running, cancelled this one")
                return
            } 
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
            Object.defineProperty(e, 'button', {
                value: 0,
                writable: false
            });
        }
        if (activated && !isEraser) {
            // Revert tool on releaGlobalse
            setActiveTool(revert)
            activated = false
            // Force delete "limbo" elements
            // This doesn't happen on the web app
            // It's a bug caused by switching to eraser during a stroke
            eaGlobal.setView("active");
            var del = []
            for (const i in eaGlobal.getViewElements()) {
                const element = eaGlobal.getViewElements()[i];
                if (element.opacity === 20) {
                    del.push(element)
                }
            }
            eaGlobal.deleteViewElements(del)
            setActiveTool(revert)
    
        }
    }
    
    window.addEventListener('pointerdown', handlePointer, { capture: true })
    window.addEventListener('pointermove', handlePointer, { capture: true })
})();
