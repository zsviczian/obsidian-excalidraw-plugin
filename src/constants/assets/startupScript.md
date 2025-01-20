/*
#exclude
```js*/
/**
 * If set, this callback is triggered when the user closes an Excalidraw view.
 *   onViewUnloadHook: (view: ExcalidrawView) => void = null;
 */
//ea.onViewUnloadHook = (view) => {};

/**
 * If set, this callback is triggered, when the user changes the view mode.
 * You can use this callback in case you want to do something additional when the user switches to view mode and back.
 *   onViewModeChangeHook: (isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void = null;
 */
//ea.onViewModeChangeHook = (isViewModeEnabled, view, ea) => {};

/**
 * If set, this callback is triggered, when the user hovers a link in the scene.
 * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
 *   onLinkHoverHook: (
 *     element: NonDeletedExcalidrawElement,
 *     linkText: string,
 *     view: ExcalidrawView,
 *     ea: ExcalidrawAutomate
 *   ) => boolean = null;
 */
//ea.onLinkHoverHook = (element, linkText, view, ea) => {};
   
/**
 * If set, this callback is triggered, when the user clicks a link in the scene.
 * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
 *   onLinkClickHook:(
 *     element: ExcalidrawElement,
 *     linkText: string,
 *     event: MouseEvent,
 *     view: ExcalidrawView,
 *     ea: ExcalidrawAutomate
 *   ) => boolean = null;
 */
//ea.onLinkClickHook = (element,linkText,event, view, ea) => {};
   
/**
 * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
 * You can use this callback in case you want to do something additional when the onDrop event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
 *   onDropHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     event: React.DragEvent<HTMLDivElement>;
 *     draggable: any; //Obsidian draggable object
 *     type: "file" | "text" | "unknown";
 *     payload: {
 *       files: TFile[]; //TFile[] array of dropped files
 *       text: string; //string
 *     };
 *     excalidrawFile: TFile; //the file receiving the drop event
 *     view: ExcalidrawView; //the excalidraw view receiving the drop
 *     pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
 *   }) => boolean = null;
 */
//ea.onDropHook = (data) => {};
 
/**
 * If set, this callback is triggered, when Excalidraw receives an onPaste event.
 * You can use this callback in case you want to do something additional when the
 * onPaste event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onPaste action you must return false,
 * it will stop the native excalidraw onPaste management flow.
 *   onPasteHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     payload: ClipboardData;
 *     event: ClipboardEvent;
 *     excalidrawFile: TFile; //the file receiving the paste event
 *     view: ExcalidrawView; //the excalidraw view receiving the paste
 *     pointerPosition: { x: number; y: number }; //the pointer position on canvas
 *   }) => boolean = null;
 */
//ea.onPasteHook = (data) => {};

/**
 * if set, this callback is triggered, when an Excalidraw file is opened
 * You can use this callback in case you want to do something additional when the file is opened.
 * This will run before the file level script defined in the `excalidraw-onload-script` frontmatter.
 *   onFileOpenHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     excalidrawFile: TFile; //the file being loaded
 *     view: ExcalidrawView;
 *   }) => Promise<void>;
 */
//ea.onFileOpenHook = (data) => {};

/**
 * if set, this callback is triggered, when an Excalidraw file is created
 * see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124
 *   onFileCreateHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     excalidrawFile: TFile; //the file being created
 *     view: ExcalidrawView;
 *   }) => Promise<void>;
 */
//ea.onFileCreateHook = (data) => {}; 

/**
 * If set, this callback is triggered when a image is being saved in Excalidraw.
 * You can use this callback to customize the naming and path of pasted images to avoid
 * default names like "Pasted image 123147170.png" being saved in the attachments folder,
 * and instead use more meaningful names based on the Excalidraw file or other criteria,
 * plus save the image in a different folder.
 * 
 * If the function returns null or undefined, the normal Excalidraw operation will continue
 * with the excalidraw generated name and default path.
 * If a filepath is returned, that will be used. Include the full Vault filepath and filename
 * with the file extension.
 * The currentImageName is the name of the image generated by excalidraw or provided during paste.
 * 
 * @param data - An object containing the following properties:
 *   @property {string} [currentImageName] - Default name for the image.
 *   @property {string} drawingFilePath - The file path of the Excalidraw file where the image is being used.
 * 
 * @returns {string} - The new filepath for the image including full vault path and extension.
 * 
 * Example usage:
 * ```
 * onImageFilePathHook: (data) => {
 *   const { currentImageName, drawingFilePath } = data;
 *   const ext = currentImageName.split('.').pop();
 *   // Generate a new filepath based on the drawing file name and other criteria
 *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
 * }
 * ```
 *  onImageFilePathHook: (data: {
 *   currentImageName: string; // Excalidraw generated name of the image, or the name received from the file system.
 *   drawingFilePath: string; // The full filepath of the Excalidraw file where the image is being used.
 * }) => string = null;  
*/
//ea.onImageFilePathHook = (data) => {};

/**
 * If set, this callback is triggered whenever the active canvas color changes
 *   onCanvasColorChangeHook: (
 *     ea: ExcalidrawAutomate,
 *     view: ExcalidrawView, //the excalidraw view 
 *     color: string,
 *   ) => void = null;
 */
//ea.onCanvasColorChangeHook = (ea, view, color) => {};