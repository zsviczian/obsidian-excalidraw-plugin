---
author: Shravya Katapally (https://github.com/shravya-katapally)
description: When creating presentations using frames with Slideshow Script in Excalidraw, frames need to be numbered (or named) in order manually. Download this script, add it to the "Scripts" folder, run it from the Command Palette (or bind a hotkey) to automate that process instead, and it will number frames in chronological order. Therefore, draw the frames in the order in which you want the slides to appear.
---

```js
/*
Sequential Frame Renamer for Excalidraw-Obsidian
*/

if (!ea.targetView) {
  new ea.obsidian.Notice("No active Excalidraw view found.");
  return;
}

const allElements = ea.getViewElements();
const frameElements = allElements.filter(el => el.type === "frame" && !el.isDeleted);

const totalFrames = frameElements.length;

if (totalFrames === 0) {
  new ea.obsidian.Notice("No frames found in this drawing.");
  return;
}

// Dynamically determine how many digits we need based on the total count
const paddingLength = String(totalFrames).length;

ea.copyViewElementsToEAforEditing(frameElements);

frameElements.forEach((frame, index) => {
  // Use the dynamic padding length instead of a hardcoded number
  const sequentialNumber = String(index + 1).padStart(paddingLength, '0');
  const workbenchFrame = ea.getElement(frame.id);
  if (workbenchFrame) {
    workbenchFrame.name = sequentialNumber;
  }
});

await ea.addElementsToView();
new ea.obsidian.Notice(`Successfully renamed ${totalFrames} frames sequentially!`);
