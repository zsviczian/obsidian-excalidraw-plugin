/*
# Image Occlusion for Excalidraw

This script creates image occlusion cards similar to Anki's Image Occlusion Enhanced plugin.

## Usage:
1. Insert an image into Excalidraw
2. Draw rectangles or ellipses over areas you want to occlude
3. Select the image and all shapes you want to use as masks
4. Run this script
5. Choose occlusion mode:
   - ⭐⠀      Add Cards:    Hide One, Guess One: Creates cards where only one shape is hidden at a time
   - ⭐⭐     Add Cards:    Hide All, Guess One: Creates cards where all shapes are hidden except one
   - 🗑️⠀      Delete Cards: Delete old cards (add DELETE marker): Marks all existing cards for deletion by adding DELETE marker
   - 🗑️💥     Delete Cards: Delete old cards file and related images (Be Cautious!! Physical Delection): Permanently deletes all related card files and images

The script will generate masked versions of the image and save them locally.

```javascript
*/

// Check minimum required version of Excalidraw plugin
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.9.0")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

// Get all selected elements from the canvas
const elements = ea.getViewSelectedElements();

// Find all selected image elements
const selectedImages = elements.filter(el => el.type === "image");

// Get all non-image elements to use as masks
const maskElements = elements.filter(el => el.type !== "image");

// Group masks based on their grouping in Excalidraw
const maskGroups = ea.getMaximumGroups(maskElements);

// Process each mask or group of masks
const masks = maskGroups.map(group => {
  // If group contains only one element, return that element
  if (group.length === 1) return group[0];
  // If group contains multiple elements, return the group info
  return {
    type: "group",
    elements: group,
    id: group[0].groupIds?.[0] || ea.generateElementId()
  };
});

// Validate selection - must have one image and at least one mask
if(selectedImages.length === 0 || masks.length === 0) {
  new Notice("Please select at least one image and one element or group to use as mask");
  return;
}

// Verify the selected image and masks are properly grouped
const validateSelection = () => {
  // Get combined bounds of all selected images
  const combinedBounds = selectedImages.reduce((bounds, img) => ({
    minX: Math.min(bounds.minX, img.x),
    maxX: Math.max(bounds.maxX, img.x + img.width),
    minY: Math.min(bounds.minY, img.y),
    maxY: Math.max(bounds.maxY, img.y + img.height)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  });
  
  // Remove bounds checking and always return true
  return true;
};

// Validate selection before proceeding
if (!validateSelection()) {
  return;
}

// Present user with operation mode choices
const mode = await utils.suggester(
  [
    "⭐⠀      Add Cards:    Hide One, Guess One",
    "⭐⭐     Add Cards:    Hide All, Guess One",
    "🗑️⠀      Delete Cards: Delete old cards (add DELETE marker)",
    "🗑️💥     Delete Cards: Delete old cards files and related images (Be Cautious!!)"
  ],
  ["hideOne", "hideAll", "delete", "deleteFiles"],
  "Select operation mode"
);

// Exit if user cancels the operation
if(!mode) return;

// Function to permanently delete related files and images
const deleteRelatedFilesAndImages = async (sourcePath) => {
  // Add delay function for async operations
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  // Initialize collections and counters
  const cardFiles = new Set();
  const batchMarkers = new Set();
  const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
  let deletedCardsCount = 0;
  let deletedFoldersCount = 0;
  
  if (!sourceFile) {
    new Notice(`Source file not found: ${sourcePath}`);
    return;
  }
  
  // Get backlinks to find batch-marker.md files
  const backlinks = app.metadataCache.getBacklinksForFile(sourceFile) || new Map();
  
  // Find all batch-marker.md files that link to the source file
  if (backlinks.data instanceof Map) {
    for (const [filePath, _] of backlinks.data.entries()) {
      if (filePath.endsWith('batch-marker.md')) {
        const markerFile = app.vault.getAbstractFileByPath(filePath);
        if (markerFile) {
          batchMarkers.add(markerFile);
          //  console.log(`Found batch marker: ${filePath}`);
        }
      }
    }
  }
  
  if (batchMarkers.size === 0) {
    //  console.log('No batch markers found. Please check if the source file path is correct:', sourcePath);
    return;
  }
  
  // Process each batch marker file to find cards
  for (const marker of batchMarkers) {
    // console.log(`Processing batch marker: ${marker.path}`);
    const content = await app.vault.read(marker);
    // console.log("Batch marker content:", content);
    const lines = content.split('\n');
    
    // Find the "Generated Cards:" section
    const startIndex = lines.findIndex(line => line.trim() === 'Generated Cards:');
    // console.log("Start index:", startIndex);
    if (startIndex !== -1) {
      // Process each card link after the "Generated Cards:" line
      for (let i = startIndex + 1; i < lines.length; i++) {
        // console.log("Processing line:", lines[i]);
        const match = lines[i].match(/\[\[([^\]]+)\]\]/);
        if (match) {
          const cardPath = match[1];
          // Use Obsidian's API to resolve wiki link
          const cardFile = app.metadataCache.getFirstLinkpathDest(cardPath, marker.path);
          
          if (cardFile) {
            cardFiles.add(cardFile);
            // console.log(`Found card file through wiki link: ${cardFile.path}`);
          } else {
            // console.log(`Card file not found for wiki link: ${cardPath}`);
          }
        }
      }
    }
  }
  
  // First delete all card files
  for (const file of cardFiles) {
    try {
      if (await app.vault.adapter.exists(file.path)) {
        // Notify Obsidian's event system about the deletion
        app.vault.trigger("delete", file);
        await app.vault.delete(file);
        // Add short delay to allow plugins to respond
        await delay(50);
        deletedCardsCount++;
        //  console.log(`Deleted card file: ${file.path}`);
      }
    } catch (error) {
      console.error(`Failed to delete card file: ${file.path}`, error);
    }
  }
  
   // Wait for file deletion operations to complete
  await delay(200);

  // Then delete batch marker folders
  for (const marker of batchMarkers) {
    const parentPath = marker.path.substring(0, marker.path.lastIndexOf('/'));
    const parentFolder = app.vault.getAbstractFileByPath(parentPath);
    
    if (parentFolder && await app.vault.adapter.exists(parentFolder.path)) {
      try {
        // Notify folder deletion
        app.vault.trigger("delete", parentFolder);
        await app.vault.delete(parentFolder, true);
        await delay(50);
        deletedFoldersCount++;
        //  console.log(`Deleted folder: ${parentFolder.path}`);
      } catch (error) {
        console.error(`Failed to delete folder: ${parentFolder.path}`, error);
      }
    }
  }
  
  new Notice(`Summary:
  - Card files deleted: ${deletedCardsCount}
  - Image folders deleted: ${deletedFoldersCount}`);
};

// Function to get batch markers and their parent folders
const getBatchMarkersInfo = async (sourceFile) => {
  const backlinks = app.metadataCache.getBacklinksForFile(sourceFile) || new Map();
  const batchMarkers = new Map(); // Map<folderPath, Set<markerFile>>
  
  if (backlinks.data instanceof Map) {
    for (const [filePath, _] of backlinks.data.entries()) {
      if (filePath.endsWith('batch-marker.md')) {
        const markerFile = app.vault.getAbstractFileByPath(filePath);
        if (markerFile) {
          const folderPath = markerFile.path.substring(0, markerFile.path.lastIndexOf('/'));
          if (!batchMarkers.has(folderPath)) {
            batchMarkers.set(folderPath, new Set());
          }
          batchMarkers.get(folderPath).add(markerFile);
        }
      }
    }
  }
  
  return batchMarkers;
};

// Function to find and mark cards for deletion
const deleteRelatedCards = async (sourcePath, selectedFolders = null) => {
  const cardFiles = new Set();
  const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
  let totalCardsFound = 0;
  let totalNewlyMarked = 0;
  let totalAlreadyMarked = 0;
  
  if (!sourceFile) {
    console.log(`Source file not found: ${sourcePath}`);
    return;
  }
  
  // Get all batch markers grouped by folder
  const batchMarkersMap = await getBatchMarkersInfo(sourceFile);
  
  if (batchMarkersMap.size === 0) {
    console.log('No batch markers found');
    return;
  }
  
  // Get batch markers to process
  let batchMarkersToProcess = new Set();
  if (selectedFolders) {
    // Convert to array if it's not already
    const folderArray = Array.isArray(selectedFolders) ? selectedFolders : [selectedFolders];
    
    // Process each selected folder
    folderArray.forEach(folder => {
      const markers = batchMarkersMap.get(folder);
      if (markers) {
        markers.forEach(marker => batchMarkersToProcess.add(marker));
      }
    });
  } else {
    // Process all markers
    batchMarkersMap.forEach(markers => {
      markers.forEach(marker => batchMarkersToProcess.add(marker));
    });
  }
  
  // Process each batch marker file
  for (const marker of batchMarkersToProcess) {
    // console.log(`Processing batch marker: ${marker.path}`);
    const content = await app.vault.read(marker);
    // console.log("Batch marker content:", content);
    const lines = content.split('\n');
    
    // Find the "Generated Cards:" section
    const startIndex = lines.findIndex(line => line.trim() === 'Generated Cards:');
    // console.log("Start index:", startIndex);
    if (startIndex !== -1) {
      // Process each card link after the "Generated Cards:" line
      for (let i = startIndex + 1; i < lines.length; i++) {
        // console.log("Processing line:", lines[i]);
        const match = lines[i].match(/\[\[([^\]]+)\]\]/);
        if (match) {
          const cardPath = match[1];
          // Use Obsidian's API to resolve wiki link
          const cardFile = app.metadataCache.getFirstLinkpathDest(cardPath, marker.path);
          
          if (cardFile) {
            cardFiles.add(cardFile);
            //  console.log(`Found card file through wiki link: ${cardFile.path}`);
          } else {
            console.log(`Card file not found for wiki link: ${cardPath}`);
          }
        }
      }
    }
  }
  
  // Process each card file to add DELETE markers
  for (const file of cardFiles) {
    // console.log("Processing card file:", file.path);
    // Read file content and split into lines for processing
    const content = await app.vault.read(file);
    // console.log("Card content:", content);
    const lines = content.split('\n');
    let modified = false;
    let cardCount = 0;
    let alreadyMarkedCount = 0;
    
    // Search for Anki card IDs and add DELETE marker before each
    for (let i = 0; i < lines.length; i++) {
      // Look for Anki card ID pattern
      const idMatch = lines[i].match(/<!--ID:.+?-->/);
      if (idMatch) {
        // console.log("Found ID line:", lines[i]);
        cardCount++;
        const cardId = idMatch[0];
        
        // Check if DELETE marker already exists
        if (i > 0 && lines[i-1].trim() === 'DELETE') {
          // console.log("DELETE marker already exists");
          alreadyMarkedCount++;
          continue;
        }
        
        // Insert DELETE marker before the ID line
        lines.splice(i, 0, 'DELETE');
        i++; // Skip the newly inserted line
        modified = true;
        // console.log("Added DELETE marker before:", cardId);
      }
    }
    
    // Save changes if file was modified
    if (modified) {
      // console.log("Saving modified content");
      await app.vault.modify(file, lines.join('\n'));
    } else {
      // console.log("No modifications needed");
    }
    
    totalCardsFound += cardCount;
    totalNewlyMarked += (cardCount - alreadyMarkedCount);
    totalAlreadyMarked += alreadyMarkedCount;
  }
  
  new Notice(`Summary:
  - Files processed: ${cardFiles.size}
  - Total cards found: ${totalCardsFound}
  - Newly marked for deletion: ${totalNewlyMarked}
  - Already marked for deletion: ${totalAlreadyMarked}`);
};

// If delete files mode is selected, delete all related files and exit
if(mode === "deleteFiles") {
  // Show confirmation dialog before permanent deletion
  const confirmed = await utils.suggester(
    ["Delete all files", "Select folders to delete"],
    ["all", "select"],
    "WARNING: This will permanently delete all related card files and image folders. This action cannot be undone. Are you sure?"
  );
  
  if (!confirmed) {
    new Notice("Operation cancelled");
    return;
  }
  
  const currentFile = app.workspace.getActiveFile();
  if (currentFile) {
    // Get all batch markers and their folders
    const batchMarkersMap = await getBatchMarkersInfo(currentFile);
    
    if (batchMarkersMap.size === 0) {
      new Notice("No files found to delete");
      return;
    }
    
    if (confirmed === "select") {
      // Sort folders alphabetically
      const folders = Array.from(batchMarkersMap.keys()).sort();
      
      // Let user select folders
      let selectedFolders = await utils.suggester(
        folders,
        folders,
        "Select folders to delete (ESC to cancel)",
        true  // Allow multi-select
      );
      
      if (!selectedFolders || selectedFolders.length === 0) return;
      
      // Ensure selectedFolders is an array
      if (!Array.isArray(selectedFolders)) {
        selectedFolders = [selectedFolders];
      }
      
      // Delete files from selected folders
      for (const folder of selectedFolders) {
        const markers = batchMarkersMap.get(folder);
        if (markers) {
          for (const marker of markers) {
            // Process each batch marker
            const content = await app.vault.read(marker);
            const lines = content.split('\n');
            const startIndex = lines.findIndex(line => line.trim() === 'Generated Cards:');
            
            if (startIndex !== -1) {
              // Delete card files first
              for (let i = startIndex + 1; i < lines.length; i++) {
                const match = lines[i].match(/\[\[([^\]]+)\]\]/);
                if (match) {
                  const cardPath = match[1];
                  const cardFile = app.metadataCache.getFirstLinkpathDest(cardPath, marker.path);
                  if (cardFile) {
                    try {
                      await app.vault.delete(cardFile);
                      // console.log(`Deleted card file: ${cardFile.path}`);
                    } catch (error) {
                      console.error(`Failed to delete card file: ${cardFile.path}`, error);
                    }
                  }
                }
              }
              
              // Then delete the folder
              const parentFolder = app.vault.getAbstractFileByPath(folder);
              if (parentFolder) {
                try {
                  await app.vault.delete(parentFolder, true);
                  //  console.log(`Deleted folder: ${folder}`);
                } catch (error) {
                  console.error(`Failed to delete folder: ${folder}`, error);
                }
              }
            }
          }
        }
      }
      
      new Notice(`Successfully deleted selected folders and their contents`);
    } else {
      // Delete all files
      const currentFile = app.workspace.getActiveFile();
      if (currentFile) {
        await deleteRelatedFilesAndImages(currentFile.path);
      }
    }
  } else {
    new Notice("No source file found");
  }
  return;
}

// If delete mode is selected, mark old cards for deletion and exit
if(mode === "delete") {
  const currentFile = app.workspace.getActiveFile();
  if (currentFile) {
    // Get all batch markers and their folders
    const batchMarkersMap = await getBatchMarkersInfo(currentFile);
    
    if (batchMarkersMap.size === 0) {
      new Notice("No cards found to delete");
      return;
    }
    
    // Ask user whether to delete all or select folders
    const deleteChoice = await utils.suggester(
      ["Delete all cards", "Select folders to delete"],
      ["all", "select"],
      "How would you like to delete cards?"
    );
    
    if (!deleteChoice) return;
    
    if (deleteChoice === "select") {
      // Sort folders alphabetically
      const folders = Array.from(batchMarkersMap.keys()).sort();
      
      // Let user select folders
      let selectedFolders = await utils.suggester(
        folders,
        folders,
        "Select folders to delete cards from (ESC to cancel)",
        true  // Allow multi-select
      );
      
      if (!selectedFolders || selectedFolders.length === 0) return;
      
      // Ensure selectedFolders is an array
      if (!Array.isArray(selectedFolders)) {
        selectedFolders = [selectedFolders];
      }
      
      // Delete cards from selected folders
      await deleteRelatedCards(currentFile.path, selectedFolders);
    } else {
      // Delete all cards
      await deleteRelatedCards(currentFile.path);
    }
  }
  return;
}

// Extract original image name from the file ID
const getImageName = (fileId) => {
  const imageData = ea.targetView.excalidrawData.getFile(fileId);
  if (imageData?.linkParts?.original) {
    const pathParts = imageData.linkParts.original.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName.split('.')[0]; // Remove extension
  }
  return 'image';
};

// Function to generate current timestamp for file names (For card file names)
const getCurrentTimestamp = () => {
  const now = new Date();
  const baseTimestamp = now.getFullYear() + 
                       (now.getMonth() + 1).toString().padStart(2, '0') +
                       now.getDate().toString().padStart(2, '0') +
                       now.getHours().toString().padStart(2, '0') +
                       now.getMinutes().toString().padStart(2, '0') +
                       now.getSeconds().toString().padStart(2, '0') +
                       now.getMilliseconds().toString().padStart(3, '0');
  return baseTimestamp;
};

// Create timestamp for folder name (For folder naming)
const now = new Date();
const timestamp = now.getFullYear() + '-' +  // 使用完整年份
                 (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                 now.getDate().toString().padStart(2, '0') + ' ' +
                 now.getHours().toString().padStart(2, '0') + '.' +
                 now.getMinutes().toString().padStart(2, '0') + '.' +
                 now.getSeconds().toString().padStart(2, '0');

// Initialize or get script settings for card location
let settings = ea.getScriptSettings();

// Default settings configuration
const defaultSettings = {
  "Output Base Folder": {
    value: "",
    description: "Base folder for storing generated files. Always use forward slash '/' for paths. Example: 'Excalidraw-Image-Occlusions', 'Cards/Image-Occlusions'",
    valueset: []  // Empty array allows free text input
  },
  "Card Location": {
    value: "ask",
    description: "Where to save card files ('default' for same folder as images, or 'choose' for custom location)",
    valueset: ["ask", "default", "choose"]
  },
  "Default Card Path": {
    value: "",
    description: "Default path for card files when 'Card Location' is set to 'default'. Always use forward slash '/' for paths. Examples: 'flashcard/Anki', 'My Notes/Cards/Occlusion'. Leave empty to save with images",
    valueset: []  // Empty array allows free text input
  },
  "Default Template": {
    value: "",
    description: "Default template file path relative to template folder (e.g., 'Anki/Image Occlusion.md'). Leave empty to select template each time",
    valueset: []  // Empty array allows free text input
  },
  "Card File Prefix": {
    value: "",
    description: "Prefix for generated card files. Must be a valid filename without dots. Examples: 'anki - ', 'card ', 'io - '. Leave empty for no prefix",
    valueset: []  // Empty array allows free text input
  },
  "Card File Suffix": {
    value: "",
    description: "Suffix for generated card files (before .md). Examples: ' -card.card3' will generate 'prefix-timestamp-card.card3.md'. Leave empty for no suffix",
    valueset: []  // Empty array allows free text input
  },
  "Image Quality": {
    value: "1.5",
    description: "Export scale for image quality (e.g., 1.5). Higher values mean better quality but larger files. Must be a valid number.",
    valueset: []  // Empty array allows free text input
  },
  "Hide All, Guess One - Highlight Color": {
    value: "#ffd700",
    description: "Color used to highlight the target mask in 'Hide All, Guess One' mode (e.g., #ffd700 for gold, #ff0000 for red)",
    valueset: []  // Empty array allows free text input
  },
  "Generate Images No Matter What": {
    value: "no",
    description: "Always generate images even when template selection is cancelled (yes/no)",
    valueset: ["yes", "no"]
  }
};

// Initialize settings if they don't exist or merge with defaults
if (!settings) {
  settings = defaultSettings;
  await ea.setScriptSettings(settings);
} else {
  // Check and add any missing settings
  let needsUpdate = false;
  Object.entries(defaultSettings).forEach(([key, defaultValue]) => {
    if (!settings[key]) {
      settings[key] = defaultValue;
      needsUpdate = true;
    }
  });
  
  if (needsUpdate) {
    await ea.setScriptSettings(settings);
  }
}

// Validate and get image quality setting
const validateQuality = (quality) => {
  // Try to parse as float and check if it's a valid number
  const value = parseFloat(quality);
  return !isNaN(value) && isFinite(value) && value > 0;
};

// Get image quality with validation
const imageQuality = validateQuality(settings["Image Quality"]?.value) 
  ? settings["Image Quality"].value 
  : "1.5";  // Default to 1.5 if invalid

// Get and validate highlight color setting
const validateColor = (color) => {
  // Check if it's a valid hex color
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

// Get highlight color with validation
const highlightColor = validateColor(settings["Hide All, Guess One - Highlight Color"]?.value) 
  ? settings["Hide All, Guess One - Highlight Color"].value 
  : "#ffd700";  // Default to gold if invalid

// Function to prompt user for card file save location
const askForCardLocation = async (imageFolder) => {
  // Use the initialized settings
  const locationSetting = settings["Card Location"].value;
  const defaultPath = settings["Default Card Path"]?.value?.trim();
  
  // If setting is "default", use configured path or image folder
  if (locationSetting === "default") {
    if (defaultPath) {
      // Normalize path: replace backslashes and remove trailing slash
      const normalizedPath = defaultPath
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');  // Remove trailing slashes
      
      // Create default path if it doesn't exist
      await app.vault.adapter.mkdir(normalizedPath, { recursive: true });
      return normalizedPath;
    }
    return imageFolder;
  }
  
  // If setting is "choose", skip dialog and go straight to folder selection
  if (locationSetting === "choose") {
    // Get list of all available folders for user selection
    const folders = app.vault.getAllLoadedFiles()
      .filter(f => f.children)
      .map(f => f.path)
      .sort();
    
    // Let user choose from available folders
    const selectedFolder = await utils.suggester(
      folders,
      folders,
      "Select folder for card files"
    );
    
    // Return null if user cancels folder selection
    if (selectedFolder === undefined) {
      return null;
    }
    
    return selectedFolder || imageFolder;
  }
  
  // If setting is "ask", show the choice dialog
  const choice = await utils.suggester(
    [
      defaultPath ? `Default location (${defaultPath})` : "Default location (with images)", 
      "Choose custom location"
    ],
    ["default", "custom"],
    "Where would you like to save the card files?"
  );
  
  // If user cancels (presses ESC), return null
  if (choice === undefined) {
    return null;
  }
  
  // Return default location if no choice or default selected
  if(!choice || choice === "default") {
    if (defaultPath) {
      // Normalize path: replace backslashes and remove trailing slash
      const normalizedPath = defaultPath
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');  // Remove trailing slashes
      
      // Create default path if it doesn't exist
      await app.vault.adapter.mkdir(normalizedPath, { recursive: true });
      return normalizedPath;
    }
    return imageFolder;
  }
  
  // Get list of all available folders for user selection
  const folders = app.vault.getAllLoadedFiles()
    .filter(f => f.children)
    .map(f => f.path)
    .sort();
  
  // Let user choose from available folders
  const selectedFolder = await utils.suggester(
    folders,
    folders,
    "Select folder for card files"
  );
  
  // Return null if user cancels folder selection
  if (selectedFolder === undefined) {
    return null;
  }
  
  return selectedFolder || imageFolder;
};

// Function to construct image folder path using image name and timestamp
const getImageFolder = (imageName, timestamp) => {
  const baseFolder = settings["Output Base Folder"]?.value?.trim() || "Excalidraw-Image-Occlusions";
  // Normalize path and remove trailing slash
  const normalizedBase = baseFolder
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  return `${normalizedBase}/${imageName}__${timestamp}`;
};

// Function to determine final output folder path based on settings or user choice
const getOutputFolder = async (imageName, timestamp) => {
  // Get default image folder path
  const imageFolder = getImageFolder(imageName, timestamp);
  
  // Return default path if settings specify default location
  if(settings["Card Location"].value === "default") {
    return imageFolder;
  }
  
  // Get list of all available folders for user selection
  const folders = app.vault.getAllLoadedFiles()
    .filter(f => f.children)
    .map(f => f.path)
    .sort();
  
  // Let user choose output folder
  const selectedFolder = await utils.suggester(
    folders,
    folders,
    "Select folder for card files"
  );
  
  // Return default folder if no selection made
  if(!selectedFolder) {
    return imageFolder;
  }
  
  return selectedFolder;
};

// Helper function to get current Excalidraw file path
const getCurrentFilePath = () => {
  const file = app.workspace.getActiveFile();
  return file ? file.path : '';
};

// Get current editing file name for folder naming
const getSourceFileName = () => {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    return 'image';
  }
  // Remove extension and replace special characters
  return currentFile.basename.replace(/[\\/:*?"<>|]/g, '_');
};

// Create necessary folders for storing images and cards
const imageName = getSourceFileName();
const imageFolder = getImageFolder(imageName, timestamp);
const cardFolder = await askForCardLocation(imageFolder);

// Exit if user cancelled location selection
if (cardFolder === null) {
  new Notice("Operation cancelled");
  return;
}

// Create image folder with all parent directories
await app.vault.adapter.mkdir(imageFolder, { recursive: true });

// Create card folder if different from image folder
if(cardFolder !== imageFolder) {
  await app.vault.adapter.mkdir(cardFolder, { recursive: true });
}

// Create initial batch marker file
const createBatchMarker = async (sourceFile) => {
  const content = `Source: [[${sourceFile}|find edit source]]\n\nGenerated Cards:\n`;
  const fileName = `${imageFolder}/batch-marker.md`;
  await app.vault.create(fileName, content);
  return fileName;
};

// Add card to batch marker
const addCardToBatchMarker = async (cardPath) => {
  const markerPath = `${imageFolder}/batch-marker.md`;
  const currentContent = await app.vault.read(app.vault.getAbstractFileByPath(markerPath));
  // Use full path in batch-marker
  const newContent = currentContent + `[[${cardPath}]]\n`;
  await app.vault.modify(app.vault.getAbstractFileByPath(markerPath), newContent);
};

// Create batch marker file after folders are created
const sourceFile = getCurrentFilePath();
const batchMarkerFile = await createBatchMarker(sourceFile);

// Function to convert base64 image data to binary format
const base64ToBinary = (base64) => {
  // Remove data URL prefix
  const base64Data = base64.replace(/^data:image\/png;base64,/, "");
  // Convert base64 to binary string
  const binaryString = window.atob(base64Data);
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Function to generate image with specified visible and hidden masks
const generateMaskedImage = async (visibleMasks = [], hiddenMasks = []) => {
  // Combine all selected images and masks into one array
  const allElements = [...selectedImages];
  [...visibleMasks, ...hiddenMasks].forEach(mask => {
    if (mask.type === "group") {
      allElements.push(...mask.elements);
    } else {
      allElements.push(mask);
    }
  });
  
  // Copy elements to Excalidraw's editing area
  ea.copyViewElementsToEAforEditing(allElements);
  
  // Get and cache all selected images data
  for (const img of selectedImages) {
    const imageData = ea.targetView.excalidrawData.getFile(img.fileId);
    if (imageData) {
      ea.imagesDict[img.fileId] = {
        id: img.fileId,
        dataURL: imageData.img,
        mimeType: imageData.mimeType,
        created: Date.now()
      };
    }
  }

  // Configure visibility of masks for question image
  visibleMasks.forEach(mask => {
    if (mask.type === "group") {
      // Set all elements in group to fully visible
      mask.elements.forEach(el => {
        const element = ea.getElement(el.id);
        element.opacity = 100;
      });
    } else {
      // Set single element to fully visible
      const element = ea.getElement(mask.id);
      element.opacity = 100;
    }
  });

  // Configure invisibility of masks for answer image
  hiddenMasks.forEach(mask => {
    if (mask.type === "group") {
      // Set all elements in group to invisible
      mask.elements.forEach(el => {
        const element = ea.getElement(el.id);
        element.opacity = 0;
      });
    } else {
      // Set single element to invisible
      const element = ea.getElement(mask.id);
      element.opacity = 0;
    }
  });

  // Generate PNG with specific export settings
  const dataURL = await ea.createPNGBase64(
    null,
    parseFloat(imageQuality),
    {
      exportWithDarkMode: false,
      exportWithBackground: true,
      viewBackgroundColor: "#ffffff",
      exportScale: parseFloat(imageQuality),
      quality: 100
    }
  );

  // Clear Excalidraw's editing area
  ea.clear();
  return dataURL;
};

// Function to get available Templater templates
const getTemplates = () => {
  // Check if Templater plugin is installed
  const templaterPlugin = app.plugins.plugins["templater-obsidian"];
  if (!templaterPlugin) {
    new Notice("Templater plugin is not installed");
    return null;
  }
  
  // Check if template folder is configured
  const templateFolder = templaterPlugin.settings.templates_folder;
  if (!templateFolder) {
    new Notice("Template folder is not set in Templater settings");
    return null;
  }

  // Get template folder and verify it exists
  const templates = app.vault.getAbstractFileByPath(templateFolder);
  if (!templates || !templates.children) {
    new Notice("No templates found");
    return null;
  }

  // Return only markdown files from template folder
  return templates.children.filter(f => f.extension === "md");
};

// Function to create card markdown file from template
const createMarkdownFromTemplate = async (templatePath, cardNumber, imagePath, sourceFile) => {
  const templaterPlugin = app.plugins.plugins["templater-obsidian"];
  const template = await app.vault.read(templatePath);
  
  // Convert absolute file paths to relative paths for Obsidian links
  const vaultPath = app.vault.adapter.getBasePath();
  const relativePath = {
    question: imagePath.question.replace(vaultPath, '').replace(/\\/g, '/'),
    answer: imagePath.answer.replace(vaultPath, '').replace(/\\/g, '/')
  };
  
  // Replace template placeholders with actual values
  let content = template
    .replace(/{{card_number}}/g, cardNumber)
    .replace(/{{question}}/g, relativePath.question)
    .replace(/{{answer}}/g, relativePath.answer)
    .replace(/{{editSource}}/g, sourceFile)
    .replace(/{{batchMarker}}/g, `${imageFolder}/batch-marker.md`);
  
  // Get and validate file prefix from settings
  const validatePrefix = (prefix) => {
    // Allow trailing spaces but validate the actual prefix content
    const actualPrefix = prefix.replace(/^\s+|\s+$/g, '');  // Remove leading and trailing spaces for validation only
    return !actualPrefix || /^[a-zA-Z0-9_\s-]+$/.test(actualPrefix);
  };
  
  // Get and validate file suffix from settings
  const validateSuffix = (suffix) => {
    // Allow trailing spaces but validate the actual suffix content
    const actualSuffix = suffix.replace(/^\s+|\s+$/g, '');  // Remove leading and trailing spaces for validation only
    return !actualSuffix || /^[a-zA-Z0-9_\s\-.]+$/.test(actualSuffix);  // Allow dots in suffix
  };
  
  const filePrefix = settings["Card File Prefix"]?.value || "";  // Don't trim to keep original spaces
  const validatedPrefix = validatePrefix(filePrefix) ? filePrefix : "";
  const prefixPart = validatedPrefix || "";
  
  // Get and validate file suffix from settings
  const fileSuffix = settings["Card File Suffix"]?.value || "";  // Don't trim to keep original spaces
  const validatedSuffix = validateSuffix(fileSuffix) ? fileSuffix : "";
  const suffixPart = validatedSuffix || "";
  
  // Create new card file with generated content
  const fileName = `${cardFolder}/${prefixPart}${cardNumber}${suffixPart}.md`;
  await app.vault.create(fileName, content);
  
  // Add card to batch marker after successful creation
  await addCardToBatchMarker(fileName);
};

// Function to get template file based on settings
const getTemplateFile = async (templates) => {
  // Get default template path from settings
  const defaultTemplate = settings["Default Template"]?.value?.trim();
  
  if (defaultTemplate) {
    // Try to find the default template
    const templateFile = templates.find(t => t.path.endsWith(defaultTemplate));
    if (templateFile) {
      return templateFile;
    }
  }
  
  // If no default template or not found, let user select
  return await utils.suggester(
    templates.map(t => t.basename),
    templates,
    "Select a template for the cards"
  );
};

// Begin card generation process based on selected mode
let counter = 1;
let templateFile = null;  // Move templateFile declaration to outer scope

if(mode === "hideAll") {
  // Get template selection from user for Hide All mode
  const templates = getTemplates();
  
  // Only try to get template if templates exist
  if (templates) {
    // Get template file based on settings or user selection
    templateFile = await getTemplateFile(templates);
  }

  // Check if we should proceed without template
  const generateImagesNoMatterWhat = settings["Generate Images No Matter What"]?.value === "yes";
  if (!templateFile && !generateImagesNoMatterWhat) {
    new Notice("Operation cancelled - no template selected");
    return;
  }

  // Generate cards for each mask in Hide All mode
  for(let i = 0; i < masks.length; i++) {
    // Set current mask as hidden, all others as visible
    const hiddenMasks = [masks[i]];
    const visibleMasks = masks.filter((_, index) => index !== i);
    
    // Generate unique timestamp for this card
    const fileTimestamp = getCurrentTimestamp();
    
    // Create a copy of all masks and highlight the target mask
    const questionMasks = masks.map(mask => {
      if (mask === hiddenMasks[0]) {
        // Handle group type masks
        if (mask.type === "group") {
          return {
            ...mask,
            elements: mask.elements.map(el => ({
              ...el,
              strokeWidth: 4,              
              strokeColor: highlightColor,  
              strokeStyle: "solid",        
              roughness: 0                 
            }))
          };
        }
        // Handle single element masks
        return {
          ...mask,
          strokeWidth: 4,              
          strokeColor: highlightColor,  
          strokeStyle: "solid",        
          roughness: 0                 
        };
      }
      return mask;
    });
    
    if (templateFile || generateImagesNoMatterWhat) {
      // Generate question image with all masks visible
      const questionDataURL = await generateMaskedImage(questionMasks, []);
      const questionPath = `${imageFolder}/q-${fileTimestamp}.png`;
      await app.vault.adapter.writeBinary(
        questionPath,
        base64ToBinary(questionDataURL)
      );
      
      // Generate answer image with one mask hidden and others visible
      const dataURL = await generateMaskedImage(visibleMasks, hiddenMasks);
      const imagePath = `${imageFolder}/a-${fileTimestamp}.png`;
      
      // Save answer image to disk
      await app.vault.adapter.writeBinary(
        imagePath,
        base64ToBinary(dataURL)
      );

      // Only create markdown file if template was selected
      if (templateFile) {
        const fullPaths = {
          question: app.vault.adapter.getFullPath(questionPath),
          answer: app.vault.adapter.getFullPath(imagePath)
        };
        await createMarkdownFromTemplate(
          templateFile,
          fileTimestamp,
          fullPaths,
          sourceFile
        );
      }
    }
  }
} else if(mode === "hideOne") {
  // Process Hide One, Guess One mode
  const templates = getTemplates();
  
  // Only try to get template if templates exist
  if (templates) {
    templateFile = await getTemplateFile(templates);
  }

  // Check if we should proceed without template
  const generateImagesNoMatterWhat = settings["Generate Images No Matter What"]?.value === "yes";
  if (!templateFile && !generateImagesNoMatterWhat) {
    new Notice("Operation cancelled - no template selected");
    return;
  }

  if (templateFile || generateImagesNoMatterWhat) {
    // Generate common answer image first (all masks hidden)
    const commonAnswerTimestamp = getCurrentTimestamp();
    const commonAnswerDataURL = await generateMaskedImage([], masks);
    const commonAnswerPath = `${imageFolder}/a-${commonAnswerTimestamp}.png`;
    await app.vault.adapter.writeBinary(
      commonAnswerPath,
      base64ToBinary(commonAnswerDataURL)
    );
    
    // Get full path for common answer image
    const commonAnswerFullPath = app.vault.adapter.getFullPath(commonAnswerPath);

    // Process each mask individually
    for(const mask of masks) {
      // Set current mask as visible, others as hidden for question
      const visibleMasks = masks.filter(m => m !== mask);
      const hiddenMasks = [mask];
      
      // Generate unique timestamp for this card
      const fileTimestamp = getCurrentTimestamp();
      
      // Generate question image showing only the current mask
      const questionDataURL = await generateMaskedImage([mask], visibleMasks);
      const questionPath = `${imageFolder}/q-${fileTimestamp}.png`;
      await app.vault.adapter.writeBinary(
        questionPath,
        base64ToBinary(questionDataURL)
      );
      
      // Only create markdown file if template was selected
      if (templateFile) {
        const fullPaths = {
          question: app.vault.adapter.getFullPath(questionPath),
          answer: commonAnswerFullPath
        };
        await createMarkdownFromTemplate(
          templateFile,
          fileTimestamp,
          fullPaths,
          sourceFile
        );
      }
    }
  }
} else if(mode === "deleteFiles") {
  try {
    const currentFile = app.workspace.getActiveFile();
    if (currentFile) {
      // Get all batch markers and their folders
      const batchMarkersMap = await getBatchMarkersInfo(currentFile);
      
      if (batchMarkersMap.size === 0) {
        new Notice("No files found to delete");
        return;
      }

      // ... rest of deleteFiles mode code remains the same ...
    }
  } catch (error) {
    console.error("Error during file deletion:", error);
    new Notice("Error occurred during file deletion");
  }
}

// Move completion message inside a try-catch block
try {
  if (templateFile || settings["Generate Images No Matter What"]?.value === "yes") {
    const messagePrefix = templateFile ? "Generated" : "Generated images only with";
    new Notice(`${messagePrefix} ${masks.length} sets of files in ${imageFolder}/`);
  }
} catch (error) {
  console.error("Error showing completion message:", error);
  new Notice("Operation completed with some errors");
} 
