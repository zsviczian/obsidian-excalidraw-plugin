/*
Toggles the Stroke color panel on and off when fire with the (Option+D) shortcut.Useful especially when drawing with a pen and need to change stroke color.

[Video Link](https://www.youtube.com/watch?v=vWigXs03XqU)

```javascript
*/

if (ea.verifyMinimumPluginVersion && ea.verifyMinimumPluginVersion("2.4.0")) {
  async function toggleStrokeColorPanel() {
    await ea.setView("active"); // Ensure Excalidraw is active

    // Get Excalidraw API
    const api = ea.getExcalidrawAPI();
    if (!api) {
      new Notice("Excalidraw API not available. Ensure Excalidraw is open.");
      return;
    }

    //Keep the canvas in selected tool state only ,no need to change tool

    // Open/Close the Edit button on click
    let editButton = document.querySelector('button[aria-label="Edit"]');
    if (editButton) {
      editButton.click();
    }

    //Wait for UI update button on click
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Find and open/close the Stroke Color Panel
    let strokeColorButton = document.querySelector('button[aria-label="Stroke"], button[title="Show stroke color picker"]');
    if (strokeColorButton) {
      strokeColorButton.click();
      new Notice("Use arrow keys to navigate ,press mentioned key to pick a color ");
    }
  }

  toggleStrokeColorPanel(); // Run the function
} else {
  new Notice("This script requires Excalidraw version 2.4.0 or higher.");
}