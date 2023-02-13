/*
Automatically switches between the select and draw tools, based on whether a pen is being used.

1. Choose the select tool
2. Hover, then use the pen to draw, move it away to return to select mode
*This is based on pen hover status, so will only work if your pen supports hover!*

**Note:** Run this script *once*, it will stay active until the Obsidian is closed. *(I'd recommend you run this at startup via a commander plugin macro, after a short delay)*

Compatible with my *Hardware eraser support* script

```javascript
*/
(function() {
    'use strict';
    
    let promise
    let timeout
    function pointerSwitch(e) {
        const pen = document.querySelector('[data-testid="toolbar-freedraw"]' )  
        const sel = document.querySelector('[data-testid="toolbar-selection"]')

        if (e.pointerType === 'pen') {
            if (sel.checked) {
                pen.click()
            }

            if (timeout) clearTimeout(timeout)

            function setTimeoutX(a,b) {
                timeout = setTimeout(a,b)
                return timeout
            }
    
            function revert() {
                if (pen.checked) {
                    sel.click()
                }
            }

            promise = new Promise(resolve => setTimeoutX(resolve, 500))
            promise.then(() => revert())
        }
    }

    function test(e) {
        console.log('aa')
    }

    window.addEventListener('pointermove', pointerSwitch, { capture: true })
    window.addEventListener('pointerleave', test, { capture: true })
})();