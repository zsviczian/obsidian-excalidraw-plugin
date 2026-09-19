```javascript
/*
name: SimpleDrawingRename
description: Renames a new drawing to the name of the PDF file by pressing a hotkey.
author: anicev1
type: action
jpg: https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/SimpleDrawingRename.png
*/

/*
#exclude
```js*/

(async () => {
    // 1. Get the Active View
    const leaf = app.workspace.activeLeaf;
    if (!leaf || !leaf.view) {
        console.log("AutoRenameDrawing: No active view found.");
        return;
    }
    
    const view = leaf.view;
    if (view.getViewType() !== "excalidraw") {
        console.log("AutoRenameDrawing: Active view is not Excalidraw.");
        return;
    }

    // 2. Check File Object
    const file = view.file;
    if (!file) {
        console.log("AutoRenameDrawing: No file associated with view.");
        return; 
    }

    // 3. GET LIVE ELEMENTS
    if (!view.excalidrawAPI) return;
    const elements = view.excalidrawAPI.getSceneElements();
    if (!elements || elements.length === 0) {
        console.log("AutoRenameDrawing: No elements found in scene.");
        return;
    }

    // 4. Filter for Images, Embeddables, or Text
    const candidates = elements.filter(e => !e.isDeleted && (e.type === "image" || e.type === "embeddable" || e.type === "text"));
    if (candidates.length === 0) {
        console.log("AutoRenameDrawing: No images, embeddables, or text found.");
        return;
    }

    // 5. FIND THE SOURCE FILE
    // We need the plugin instance to access the "Master Memory"
    const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
    let renamed = false;

    for (const item of candidates) {
        let nameCandidate = "";

        // --- ATTEMPT 1: Standard View Lookup ---
        if (item.fileId && view.excalidrawData && view.excalidrawData.getFile) {
            const f = view.excalidrawData.getFile(item.fileId);
            if (f) {
                // Try different properties where the name might hide
                nameCandidate = f.basename || f.name || (f.file ? f.file.basename : "");
            }
        }

        // --- ATTEMPT 2: Plugin Master Manager (The Deep Search) ---
        // If Attempt 1 failed, check the plugin's central memory
        if (!nameCandidate && item.fileId && plugin && plugin.filesMasterManager) {
            const f = plugin.filesMasterManager.get(item.fileId);
            if (f) {
                // Sometimes the master manager has the file path
                if (f.path) {
                    // Extract "ResearchPaper" from "Attachments/ResearchPaper.pdf"
                    const parts = f.path.split("/");
                    const fullName = parts[parts.length - 1];
                    nameCandidate = fullName.replace(/\.[^/.]+$/, ""); // Remove extension
                } else if (f.basename) {
                    nameCandidate = f.basename;
                }
            }
        }

        // --- ATTEMPT 3: Link Property (For Embeddables) ---
        if (!nameCandidate && item.link) {
            const linkText = item.link.replace(/^\[\[/, "").replace(/\]\]$/, "");
            // Resolve the link to a file
            const f = app.metadataCache.getFirstLinkpathDest(linkText, file.path);
            if (f) nameCandidate = f.basename;
        }

        // --- ATTEMPT 4: Text Element ---
        if (!nameCandidate && item.type === "text" && item.text) {
            // Use the first line of text, sanitize it to be a valid filename
            nameCandidate = item.text.split('\n')[0].trim().replace(/[\\/:"*?<>|]/g, "");
        }

        // --- VALIDATE AND RENAME ---
        if (nameCandidate && typeof nameCandidate === 'string') {
            
            // Skip "Pasted image" or empty names
            if (nameCandidate.startsWith("Pasted image") || nameCandidate.trim() === "") continue;

            console.log("Renamer: MATCH FOUND -> " + nameCandidate);

            // Construct new filename
            const isExcalidrawFile = file.name.endsWith(".excalidraw.md");
            const suffix = isExcalidrawFile ? ".excalidraw.md" : ".md";
            const newName = nameCandidate + suffix;
            
            const parentPath = file.parent.path === "/" ? "" : file.parent.path + "/";
            const finalPath = parentPath + newName;

            // Stop if name is already correct
            if (file.name === newName) {
                console.log("AutoRenameDrawing: File is already correctly named.");
                renamed = true;
                break;
            }

            // Stop if target file already exists
            if (app.vault.getAbstractFileByPath(finalPath)) {
                new Notice("⚠️ AutoRenameDrawing: Target file already exists, skipping.");
                renamed = true;
                break;
            }

            // EXECUTE RENAME
            try {
                await app.fileManager.renameFile(file, finalPath);
                new Notice("✅ Renamed to: " + nameCandidate);
                renamed = true;
            } catch (err) {
                console.error("Renamer: Error", err);
                new Notice("❌ AutoRenameDrawing: Error during renaming.");
            }
            
            // Success! Stop looping.
            break; 
        }
    }

    if (!renamed) {
        console.log("AutoRenameDrawing: No valid text, PDF, or image found to rename from.");
    }
})();
```
