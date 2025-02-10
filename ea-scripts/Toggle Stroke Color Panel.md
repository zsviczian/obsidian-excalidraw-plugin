/*
Toggles the Stroke color panel on and off when fire with the (Option+D) shortcut.Useful especially when drawing with a pen and need to change stroke color.

[Add video link describing script feature]: #

```javascript
*/
if (ea.verifyMinimumPluginVersion && ea.verifyMinimumPluginVersion("2.4.0")) {
  let isPanelOpen = false; // Track panel state

  async function toggleStrokeColorPanel() {
    await ea.setView("active"); // Ensure Excalidraw is active

    // Get Excalidraw API
    const api = ea.getExcalidrawAPI();
    if (!api) {
      new Notice("Excalidraw API not available. Ensure Excalidraw is open.");
      return;
    }

    if (isPanelOpen) {
      // Close the Edit button and return to previous state
      let editButton = document.querySelector('button[aria-label="Edit"]');
      if (editButton) {
        editButton.click();
      }
      isPanelOpen = false;
      return;
    }

    // Select the Draw (freedraw) tool by updating appState
    api.updateScene({
      appState: { activeTool: { type: "freedraw" } }
    });


    // Wait briefly to allow UI updates
    // await new Promise((resolve) => setTimeout(resolve, 10));

    // Open the Edit button
    let editButton = document.querySelector('button[aria-label="Edit"]');
    if (editButton) {
      editButton.click();
    }

    // Wait for UI update
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Find and open the Stroke Color Panel
    let strokeColorButton = document.querySelector('button[aria-label="Stroke"], button[title="Show stroke color picker"]');
    if (strokeColorButton) {
      strokeColorButton.click();
    }
    
    isPanelOpen = true; // Mark panel as open
  }

  toggleStrokeColorPanel(); // Run the function
} else {
  new Notice("This script requires Excalidraw version 2.4.0 or higher.");
}