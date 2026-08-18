/*
Adds a ready-to-use Focus Embed timer to the active Excalidraw canvas.

The timer is hosted on GitHub Pages and opens in count-up mode with the Doodle
theme and Excalidraw purple colorway. Run the script, then interact with the
timer directly inside the canvas.

Project and self-hosting instructions:
https://github.com/Ker102/focus-embed-timer

```javascript
*/
const TIMER_URL =
  "https://ker102.github.io/focus-embed-timer/embed.html?mode=countup&theme=doodle&accent=purple";
const TIMER_WIDTH = 560;
const TIMER_HEIGHT = 650;
const pointer = ea.getViewLastPointerPosition();

ea.addEmbeddable(
  pointer.x - TIMER_WIDTH / 2,
  pointer.y - TIMER_HEIGHT / 2,
  TIMER_WIDTH,
  TIMER_HEIGHT,
  TIMER_URL,
);
ea.addElementsToView(true, true);

new Notice("Focus Embed timer added.", 3000);
