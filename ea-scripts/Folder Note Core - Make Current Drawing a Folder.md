/*
This script adds the `Folder Note Core: Make current document folder note` function to Excalidraw drawings. Running this script will convert the active Excalidraw drawing into a folder note. If you already have embedded images in your drawing, those attachments will not be moved when the folder note is created. You need to take care of those attachments separately, or convert the drawing to a folder note prior to adding the attachments. The script requires the [Folder Note Core](https://github.com/aidenlx/folder-note-core) plugin. 

```javascript*/
const FNC = app.plugins.plugins['folder-note-core']?.resolver;
const file = ea.targetView.file;
if(!FNC) return;
if(!FNC.createFolderForNoteCheck(file)) return;
FNC.createFolderForNote(file);