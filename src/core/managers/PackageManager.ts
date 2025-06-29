import { updateExcalidrawLib } from "src/constants/constants";
import { ExcalidrawLib } from "../../types/excalidrawLib";
import { Packages } from "../../types/types";
import { debug, DEBUGGING } from "../../utils/debugHelper";
import { Notice } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { errorHandler } from "../../utils/ErrorHandler";
import React from "react";
import ReactDOM from "react-dom";

declare let REACT_PACKAGES:string;
declare let react: typeof React;
declare let reactDOM:typeof ReactDOM;
declare let excalidrawLib: typeof ExcalidrawLib;
declare const unpackExcalidraw: Function;

export class PackageManager {
  private packageMap: Map<Window, Packages> = new Map<Window, Packages>();
  private EXCALIDRAW_PACKAGE: string;
  private plugin: ExcalidrawPlugin;
  private fallbackPackage: Packages | null = null;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    
    try {
      this.EXCALIDRAW_PACKAGE = unpackExcalidraw();
      
      // Use safe evaluation for unpacking the Excalidraw package
      excalidrawLib = errorHandler.safeEval(
        `(function() {${this.EXCALIDRAW_PACKAGE};return ExcalidrawLib;})()`, 
        "PackageManager constructor - excalidrawLib initialization", 
        window
      );
      
      if (!excalidrawLib) {
        throw new Error("Failed to initialize excalidrawLib");
      }
      
      // Update the exported functions
      updateExcalidrawLib();
      
      // Create a package with the loaded libraries
      const initialPackage = {react, reactDOM, excalidrawLib};
      
      // Validate the package before storing
      if (this.validatePackage(initialPackage)) {
        this.setPackage(window, initialPackage);
        this.fallbackPackage = initialPackage; // Store a valid package as fallback
      } else {
        throw new Error("Invalid initial package");
      }
    } catch (e) {
      errorHandler.handleError(e, "PackageManager constructor");
      new Notice("Error loading the Excalidraw package. Some features may not work correctly.", 10000);
      console.error("Error loading the Excalidraw package", e);
    }
    
    plugin.logStartupEvent("Excalidraw package unpacked");
  }

  /**
   * Validates that a package contains all required components
   */
  private validatePackage(pkg: Packages): boolean {
    if (!pkg) return false;
    
    // Check that all components exist
    if (!pkg.react || !pkg.reactDOM || !pkg.excalidrawLib) {
      return false;
    }
    
    // Verify that excalidrawLib has essential methods
    const lib = pkg.excalidrawLib;
    return (
      typeof lib === 'object' && 
      lib !== null &&
      typeof lib.restore === 'function' && 
      typeof lib.exportToSvg === 'function'
    );
  }

  /**
   * Store a package for a specific window
   */
  public setPackage(window: Window, pkg: Packages) {
    if (this.validatePackage(pkg)) {
      this.packageMap.set(window, pkg);
      
      // Update fallback if we don't have one
      if (!this.fallbackPackage) {
        this.fallbackPackage = pkg;
      }
    } else {
      errorHandler.handleError(
        "Attempted to set invalid package", 
        "PackageManager.setPackage"
      );
    }
  }

  public getPackageMap() {
    return this.packageMap;
  }

  /**
   * Gets a package for a window, creating it if necessary
   * with robust error handling
   */
  public getPackage(win: Window): Packages {
    try {
      if ((process.env.NODE_ENV === 'development') && DEBUGGING) {
        debug(this.getPackage, `PackageManager.getPackage`, win);
      }

      // Return existing package if available
      if (this.packageMap.has(win)) {
        const pkg = this.packageMap.get(win);
        if (this.validatePackage(pkg)) {
          return pkg;
        }
        // If package exists but is invalid, delete it so we can recreate it
        this.packageMap.delete(win);
      }

      // Create new package
      return errorHandler.wrapWithTryCatch(() => {
        // Use safe evaluation to load packages in the window context
        const evalResult = errorHandler.safeEval<{react: typeof React, reactDOM: typeof ReactDOM, excalidrawLib: typeof ExcalidrawLib}>(
          `(function() {
            ${REACT_PACKAGES + this.EXCALIDRAW_PACKAGE};
            return {react: React, reactDOM: ReactDOM, excalidrawLib: ExcalidrawLib};
          })()`,
          "PackageManager.getPackage - package evaluation",
          win
        );
        
        if (!evalResult || !this.validatePackage(evalResult)) {
          throw new Error("Failed to create valid package");
        }
        
        const newPackage = {
          react: evalResult.react,
          reactDOM: evalResult.reactDOM,
          excalidrawLib: evalResult.excalidrawLib
        };
        
        this.packageMap.set(win, newPackage);
        return newPackage;
      }, "PackageManager.getPackage", this.fallbackPackage);
    } catch (error) {
      errorHandler.handleError(error, "PackageManager.getPackage");
      
      // Return fallback package if available to prevent data loss
      if (this.fallbackPackage) {
        return this.fallbackPackage;
      }
      
      // If no fallback, throw error to prevent undefined behavior
      throw new Error("Failed to get package and no fallback available");
    }
  }

  public deletePackage(win: Window) {
    try {
      const pkg = this.packageMap.get(win);
      if (!pkg) return;

      const { react, reactDOM, excalidrawLib } = pkg;

      if (win.ExcalidrawLib === excalidrawLib) {
        // Safely clean up resources
        errorHandler.wrapWithTryCatch(() => {
          if (excalidrawLib && typeof excalidrawLib.destroyObsidianUtils === 'function') {
            excalidrawLib.destroyObsidianUtils();
          }
          delete win.ExcalidrawLib;
        }, "PackageManager.deletePackage - cleanup ExcalidrawLib");
      }

      if (win.React === react) {
        errorHandler.wrapWithTryCatch(() => {
          Object.keys(win.React || {}).forEach((key) => {
            delete win.React[key];
          });
          delete win.React;
        }, "PackageManager.deletePackage - cleanup React");
      }

      if (win.ReactDOM === reactDOM) {
        errorHandler.wrapWithTryCatch(() => {
          Object.keys(win.ReactDOM || {}).forEach((key) => {
            delete win.ReactDOM[key];
          });
          delete win.ReactDOM;
        }, "PackageManager.deletePackage - cleanup ReactDOM");
      }

      this.packageMap.delete(win);
    } catch (error) {
      errorHandler.handleError(error, "PackageManager.deletePackage");
    }
  }

  public setExcalidrawPackage(pkg: string) {
    this.EXCALIDRAW_PACKAGE = pkg;
  }

  public destroy() {
    try {
      REACT_PACKAGES = "";
      
      Array.from(this.packageMap.entries()).forEach(([win, p]) => {
        this.deletePackage(win);
      });
      
      this.packageMap.clear();
      this.EXCALIDRAW_PACKAGE = "";
      this.fallbackPackage = null;
      
      react = null;
      reactDOM = null;
      excalidrawLib = null;
    } catch (error) {
      errorHandler.handleError(error, "PackageManager.destroy");
    }
  }
}