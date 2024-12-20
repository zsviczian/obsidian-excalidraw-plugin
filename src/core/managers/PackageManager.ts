import { updateExcalidrawLib } from "src/constants/constants";
import { ExcalidrawLib } from "../../types/excalidrawLib";
import { Packages } from "../../types/types";
import { debug, DEBUGGING } from "../../utils/debugHelper";
import { Notice } from "obsidian";
import ExcalidrawPlugin from "src/core/main";

declare let REACT_PACKAGES:string;
declare let react:any;
declare let reactDOM:any;
declare let excalidrawLib: typeof ExcalidrawLib;
declare const unpackExcalidraw: Function;

export class PackageManager {
  private packageMap: Map<Window, Packages> = new Map<Window, Packages>();
  private EXCALIDRAW_PACKAGE: string;

  constructor(plugin: ExcalidrawPlugin) {
    try {
      this.EXCALIDRAW_PACKAGE = unpackExcalidraw();
      excalidrawLib = window.eval.call(window,`(function() {${this.EXCALIDRAW_PACKAGE};return ExcalidrawLib;})()`);
      updateExcalidrawLib();
      this.setPackage(window,{react, reactDOM, excalidrawLib});
    } catch (e) {
      new Notice("Error loading the Excalidraw package", 6000);
      console.error("Error loading the Excalidraw package", e);
    }
    plugin.logStartupEvent("Excalidraw package unpacked");
  }

  public setPackage(window: Window, pkg: Packages) {
    this.packageMap.set(window, pkg);
  }

  public getPackageMap() {
    return this.packageMap;
  }

  public getPackage(win:Window):Packages {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getPackage, `ExcalidrawPlugin.getPackage`, win);

    if(this.packageMap.has(win)) {
      return this.packageMap.get(win);
    }

    const {react:r, reactDOM:rd, excalidrawLib:e} = win.eval.call(win,
      `(function() {
        ${REACT_PACKAGES + this.EXCALIDRAW_PACKAGE};
        return {react:React,reactDOM:ReactDOM,excalidrawLib:ExcalidrawLib};
       })()`);
    this.packageMap.set(win,{react:r, reactDOM:rd, excalidrawLib:e});
    return {react:r, reactDOM:rd, excalidrawLib:e};
  }

  public deletePackage(win: Window) {
    const { react, reactDOM, excalidrawLib } = this.getPackage(win);

    if (win.ExcalidrawLib === excalidrawLib) {
      excalidrawLib.destroyObsidianUtils();
      delete win.ExcalidrawLib;
    }

    if (win.React === react) {
      Object.keys(win.React).forEach((key) => {
        delete win.React[key];
      });
      delete win.React;
    }

    if (win.ReactDOM === reactDOM) {
      Object.keys(win.ReactDOM).forEach((key) => {
        delete win.ReactDOM[key];
      });
      delete win.ReactDOM;
    }

    this.packageMap.delete(win);
  }

  public setExcalidrawPackage(pkg: string) {
    this.EXCALIDRAW_PACKAGE = pkg;
  }

  public destroy() {
    REACT_PACKAGES = "";
    Object.values(this.packageMap).forEach((p: Packages) => {
      delete p.excalidrawLib;
      delete p.reactDOM;
      delete p.react;
    });
    this.packageMap.clear();
    this.EXCALIDRAW_PACKAGE = "";
    react = null;
    reactDOM = null;
    excalidrawLib = null;
  }
}