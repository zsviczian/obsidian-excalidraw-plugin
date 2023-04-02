/*
Automatically switches between the select and draw tools, based on whether a pen is being used.

1. Choose the select tool
2. Hover/use the pen to draw, move it away to return to select mode
*This is based on pen hover status, so will only work if your pen supports hover!*
If you click draw with the mouse or press select with the pen, switching will be disabled until the opposite input method is used.

**Note:** This script will stay active until the *Obsidian* window is closed.

Compatible with my *Hardware Eraser Support* script

```javascript
*/
(function() {
    'use strict';
    
    let promise
    let timeout
    let disable

    function handlePointer(e) {
        ea.setView("active");
        var activeTool = ea.getExcalidrawAPI().getAppState().activeTool;
        function setActiveTool(t) {
            ea.getExcalidrawAPI().setActiveTool(t)
        }

        if (e.pointerType === 'pen') {
            if (disable) return
            if (!promise && activeTool.type==='selection') {
                setActiveTool({type:"freedraw"})
            }

            if (timeout) clearTimeout(timeout)

            function setTimeoutX(a,b) {
                timeout = setTimeout(a,b)
                return timeout
            }
    
            function revert() {
                activeTool = ea.getExcalidrawAPI().getAppState().activeTool;
                disable = false
                if (activeTool.type==='freedraw') {
                    setActiveTool({type:"selection"})
                } else if (activeTool.type==='selection') {
                    disable = true
                }
                promise = false
            }

            promise = new Promise(resolve => setTimeoutX(resolve, 500))
            promise.then(() => revert())
        }
    }
    function handleClick(e) {
        ea.setView("active");
        if (e.pointerType !== 'pen') {
            disable = false
        }
    }

    window.addEventListener('pointermove', handlePointer, { capture: true })
    window.addEventListener('pointerdown', handleClick, { capture: true })

})();