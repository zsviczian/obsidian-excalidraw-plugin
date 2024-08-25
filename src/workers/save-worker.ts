import { ExcalidrawElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import ExcalidrawView from "src/ExcalidrawView";
import { debug, DEBUGGING, ts } from "src/utils/DebugHelper";
import { imageCache } from "src/utils/ImageCache";

interface SaveWorkerMessageData {
  superSave: () => Promise<void>;
  view: ExcalidrawView;
  forcesave: boolean;
  preventReload: boolean;
}

onmessage = async function (e: MessageEvent<SaveWorkerMessageData>) {
  const { superSave, view, forcesave, preventReload } = e.data;

  try {
    (process.env.NODE_ENV === 'development') && ts("allow save",1);
    const scene = view.getScene();

    if (view.compatibilityMode) {
      await view.excalidrawData.syncElements(scene);
    } else if (
      await view.excalidrawData.syncElements(scene, view.excalidrawAPI.getAppState().selectedElementIds)
      && !view.semaphores.popoutUnload //Obsidian going black after REACT 18 migration when closing last leaf on popout
    ) {
      (process.env.NODE_ENV === 'development') && ts("ExcalidrawView.beforeLoadDrawing",1);
      await view.loadDrawing(
        false,
        view.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted)
      );
      (process.env.NODE_ENV === 'development') && ts("ExcalidrawView.afterLoadDrawing",1);
    }
    (process.env.NODE_ENV === 'development') && ts("after sync elements",1);

    //reload() is triggered indirectly when saving by the modifyEventHandler in main.ts
    //prevent reload is set here to override reload when not wanted: typically when the user is editing
    //and we do not want to interrupt the flow by reloading the drawing into the canvas.
    view.clearDirty();
    view.clearPreventReloadTimer();

    view.semaphores.preventReload = preventReload;
    //added this to avoid Electron crash when terminating a popout window and saving the drawing, need to check back
    //can likely be removed once this is resolved: https://github.com/electron/electron/issues/40607
    if(view.semaphores?.viewunload) {
      const d = view.getViewData();
      const plugin = view.plugin;
      const file = view.file;
      window.setTimeout(async ()=>{
        await plugin.app.vault.modify(file,d);
        await imageCache.addBAKToCache(file.path,d);                        
      },200)
      return;
    }

    (process.env.NODE_ENV === 'development') && ts("before super.save",1);
    await superSave();
    (process.env.NODE_ENV === 'development') && ts("after super.save",1);
    if (process.env.NODE_ENV === 'development') {
      if (DEBUGGING) {
        debug(self.onmessage, `ExcalidrawView.save, super.save finished`, view.file);
        console.trace();
      }
    }
    //saving to backup with a delay in case application closes in the meantime, I want to avoid both save and backup corrupted.
    const path = view.file.path;
    //@ts-ignore
    const data = view.lastSavedData;
    window.setTimeout(()=>imageCache.addBAKToCache(path,data),50);
    const triggerReload = (view.lastSaveTimestamp === view.file.stat.mtime) &&
      !preventReload && forcesave;
    view.lastSaveTimestamp = view.file.stat.mtime;
    //view.clearDirty(); //moved to right after allow save, to avoid autosave collision with load drawing
    
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/629
    //there were odd cases when preventReload semaphore did not get cleared and consequently a synchronized image
    //did not update the open drawing
    if(preventReload) {
      view.setPreventReload();
    }

    postMessage({ success: true, triggerReload });
  } catch (error) {
    postMessage({ success: false, error: (error as Error).message });
  }
};


/* ExcalidrawView

import SaveWorker from "web-worker:./workers/save-worker.ts";

//...

    try {
      if (allowSave) {
        const worker = new SaveWorker({name: "Excalidraw File Save Worker"});
        const promise = new Promise<{success:boolean, error?:Error, triggerReload?: boolean}>((resolve, reject) => {
          worker.onmessage = (e: MessageEvent<{ success: boolean; error?: Error; triggerReload?: boolean }>) => {
            resolve(e.data);
          };
          worker.onerror = (e: ErrorEvent) => {
            reject(new Error(e.message));
          };
          worker.postMessage({
            superSave: super.save.bind(this),
            view: this,
            preventReload,
            forcesave,
          });
        });
        const { success, error, triggerReload: tr } = await promise;
        worker.terminate();
        if(error) {
          throw error;
        }
        if(typeof tr !== "undefined") {
          triggerReload = tr;
        }
      }

      // !triggerReload means file has not changed. No need to re-export
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1209 (added popout unload to the condition)
      if (!triggerReload && !this.semaphores.autosaving && (!this.semaphores.viewunload || this.semaphores.popoutUnload)) {
        const autoexportPreference = this.excalidrawData.autoexportPreference;
        if (
          (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportSVG) ||
          autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.svg
        ) {
          this.saveSVG();
        }
        if (
          (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportPNG) ||
          autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.png
        ) {
          this.savePNG();
        }
        if (
          !this.compatibilityMode &&
          this.plugin.settings.autoexportExcalidraw
        ) {
          this.saveExcalidraw();
        }
      }
    } catch (e) {
      errorlog({
        where: "ExcalidrawView.save",
        fn: this.save,
        error: e,
      });
      warningUnknowSeriousError();
    }

*/