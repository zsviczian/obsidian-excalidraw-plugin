import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { request } from "http";
import { Notice } from "obsidian";
import { DEVICE } from "src/constants/constants";
import { getEA } from "src/core";
import { t } from "src/lang/helpers";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";

export interface ScreenshotOptions {
  zoom: number;
  margin: number;
  selectedOnly: boolean;
  theme: string;
}

export async function captureScreenshot(view: ExcalidrawView, options: ScreenshotOptions): Promise<Blob | null> {
  if (!DEVICE.isDesktop) {
    new Notice(t("SCREENSHOT_DESKTOP_ONLY"));
    return null;
  }

  (view.excalidrawAPI as ExcalidrawImperativeAPI).setForceRenderAllEmbeddables(true);

  const remote = window.require("electron").remote;
  const scene = view.getScene();
  const viewSelectedElements = view.getViewSelectedElements();
  const selectedIDs = new Set(options.selectedOnly ? viewSelectedElements.map(el => el.id) : []);
  const savedOpacity: { id: string; opacity: number }[] = [];
  const ea = getEA(view) as ExcalidrawAutomate;

  // Save the current browser zoom level
  const webContents = remote.getCurrentWebContents();
  const originalZoomFactor = webContents.getZoomFactor();
  
  // Set browser zoom to 100%
  webContents.setZoomFactor(1.0);
  await sleep(100); // Give the browser time to apply zoom
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  if (options.selectedOnly) {
    ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(el => !selectedIDs.has(el.id)));
    ea.getElements().forEach(el => {
      savedOpacity.push({
        id: el.id,
        opacity: el.opacity
      });
      el.opacity = 0;
    });
    if (savedOpacity.length > 0) {
      await ea.addElementsToView(false, false, false, false);
    }
  }

  let boundingBox = ea.getBoundingBox(options.selectedOnly ? viewSelectedElements : scene.elements);
  boundingBox = {
    topX: Math.ceil(boundingBox.topX),
    topY: Math.ceil(boundingBox.topY),
    width: Math.ceil(boundingBox.width),
    height: Math.ceil(boundingBox.height)
  }
  
  const margin = options.margin;
  const availableWidth = Math.floor(view.excalidrawAPI.getAppState().width);
  const availableHeight = Math.floor(view.excalidrawAPI.getAppState().height);
  
  // Apply zoom to the total dimensions
  const totalWidth = Math.ceil(boundingBox.width * options.zoom + margin * 2);
  const totalHeight = Math.ceil(boundingBox.height * options.zoom + margin * 2);
  
  // Calculate number of tiles
  const cols = Math.ceil(totalWidth / availableWidth);
  const rows = Math.ceil(totalHeight / availableHeight);
  
  // Use exact tile sizes to avoid rounding issues
  const tileWidth = Math.ceil(totalWidth / cols);
  const tileHeight = Math.ceil(totalHeight / rows);
  
  // Adjust totalWidth and totalHeight to be multiples of tileWidth and tileHeight
  const adjustedTotalWidth = tileWidth * cols;
  const adjustedTotalHeight = tileHeight * rows;
  
  // Save and set state
  const saveState = () => {
    const {
      scrollX,
      scrollY,
      zoom,
      viewModeEnabled,
      linkOpacity,
      theme,
    } = view.excalidrawAPI.getAppState();
    return {
      scrollX,
      scrollY,
      zoom,
      viewModeEnabled,
      linkOpacity,
      theme,
    };
  }
  
  const restoreState = (st: any) => {
    view.updateScene({
      appState: {
        ...st
      }
    });
  }
  
  const savedState = saveState();
  
  // Switch to view mode for layerUIWrapper to be rendered so it can be hidden
  view.updateScene({
    appState: {
      viewModeEnabled: true,
      linkOpacity: 0,
      theme: options.theme,
    },
  });
  
  await sleep(50);
  
  // Hide UI elements (must be after changing to view mode)
  const container = view.excalidrawWrapperRef.current;
  const layerUIWrapper = container.querySelector(".layer-ui__wrapper");
  const layerUIWrapperOriginalDisplay = layerUIWrapper.style.display;
  layerUIWrapper.style.display = "none";
  
  const originalStyle = {
    width: container.style.width,
    height: container.style.height,
    left: container.style.left,
    top: container.style.top,
    position: container.style.position,
    overflow: container.style.overflow,
  };

  try {
    
    container.style.width = tileWidth + "px";
    container.style.height = tileHeight + "px";
    container.style.overflow = "visible";
    
    // Set canvas size and zoom value for capture
    view.updateScene({
      appState: {
        zoom: {
          value: options.zoom
        },
        width: tileWidth,
        height: tileHeight
      },
    });
    
    await sleep(50); // wait for frame to render
    
    // Prepare to collect tile images as data URLs
    const rect = container.getBoundingClientRect();
    const tiles = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate scroll position for this tile (adjusted for zoom)
        const scrollX = boundingBox.topX - margin / options.zoom + (col * tileWidth) / options.zoom;
        const scrollY = boundingBox.topY - margin / options.zoom + (row * tileHeight) / options.zoom;
        
        view.updateScene({
          appState: {
            scrollX: -scrollX,
            scrollY: -scrollY,
            zoom: {
              value: options.zoom
            },
            width: tileWidth,
            height: tileHeight
          },
        });
        
        await sleep(250);
        
        // Calculate the exact width/height for this tile
        const captureWidth = col === cols - 1 ? adjustedTotalWidth - tileWidth * (cols - 1) : tileWidth;
        const captureHeight = row === rows - 1 ? adjustedTotalHeight - tileHeight * (rows - 1) : tileHeight;
        
        const image = await remote.getCurrentWebContents().capturePage({
          x: rect.left * devicePixelRatio,
          y: rect.top * devicePixelRatio,
          width: captureWidth * devicePixelRatio,
          height: captureHeight * devicePixelRatio,
        });
        
        tiles.push({
          url: "data:image/png;base64," + image.toPNG().toString("base64"),
          width: captureWidth,
          height: captureHeight,
          col: col,
          row: row
        });
      }
    }
    
    // Restore original styles
    Object.assign(container.style, originalStyle);
    
    // Stitch tiles together using a browser canvas
    const canvas = document.createElement("canvas");
    canvas.width = adjustedTotalWidth * devicePixelRatio;
    canvas.height = adjustedTotalHeight * devicePixelRatio;
    canvas.style.width = `${adjustedTotalWidth}px`;
    canvas.style.height = `${adjustedTotalHeight}px`;
    
    const ctx = canvas.getContext("2d");
    ctx.scale(1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    let y = 0;
    for (let row = 0; row < rows; row++) {
      let x = 0;
      for (let col = 0; col < cols; col++) {
        const tile = tiles[row * cols + col];
        const img = new window.Image();
        img.src = tile.url;
        await new Promise(res => {
          img.onload = res;
        });
        ctx.drawImage(img, x, y);
        x += tile.width * devicePixelRatio;
      }
      y += tiles[row * cols].height * devicePixelRatio; // Use the height of the first tile in the row
    }
    
    // Return the blob for the caller to handle
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
    
  } catch (e) {
    console.error(e);
    new Notice(t("SCREENSHOT_ERROR"));
    return null;
  } finally {
    // Restore browser zoom to its original value
    webContents.setZoomFactor(originalZoomFactor);
    
    // Restore UI elements
    try {
      const container = view.excalidrawWrapperRef.current;
      const layerUIWrapper = container.querySelector(".layer-ui__wrapper");
      if (layerUIWrapper) {
        layerUIWrapper.style.display = layerUIWrapperOriginalDisplay;
      }
      
      // Restore original state
      restoreState(savedState);
      
      // Restore opacity for selected elements if necessary
      if (options.selectedOnly && savedOpacity.length > 0) {
        ea.clear();
        ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(el => !selectedIDs.has(el.id)));
        savedOpacity.forEach(x => {
          ea.getElement(x.id).opacity = x.opacity;
        });
        await ea.addElementsToView(false, false, false, false);
      }
    } catch (e) {
      console.error("Error in cleanup:", e);
    }
  }
}
