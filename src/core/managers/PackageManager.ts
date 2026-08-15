import { updateExcalidrawLib } from "src/constants/constants";
import { ExcalidrawLib } from "../../types/excalidrawLib";
import { Packages } from "../../types/types";
import { Notice } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { errorHandler } from "../../utils/ErrorHandler";
import React from "react";
import ReactDOM from "react-dom/client";
import { createObsidianCommonHostAdapter } from "./obsidianCommonHostAdapter";
import { createObsidianExcalidrawHostAdapter } from "./obsidianExcalidrawHostAdapter";

declare let REACT_PACKAGES: string;
declare let react: typeof React;
declare let reactDOM: typeof ReactDOM;
declare let excalidrawLib: typeof ExcalidrawLib;
declare let ReactJSXRuntime: unknown;
declare let ReactJSXDevRuntime: unknown;
declare const unpackExcalidraw: () => string;

const normalizeError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : "Unknown error");

export class PackageManager {
  private packageMap: Map<Window, Packages> = new Map<Window, Packages>();
  private EXCALIDRAW_PACKAGE: string;
  private plugin: ExcalidrawPlugin;
  private fallbackPackage: Packages | null = null;
  private commonHostDisposerMap = new Map<Window, () => void>();
  private excalidrawHostDisposerMap = new Map<Window, () => void>();

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;

    try {
      this.EXCALIDRAW_PACKAGE = unpackExcalidraw();

      // Evaluate Excalidraw in the main window with the same private React
      // instance used by the plugin bundle. The runtime is passed explicitly
      // because window.React and window.ReactDOM are deliberately not set.
      const loadExcalidraw = errorHandler.safeEval<
        (
          reactInstance: typeof React,
          reactDOMInstance: typeof ReactDOM,
          jsxRuntime: unknown,
          jsxDevRuntime: unknown,
        ) => typeof ExcalidrawLib
      >(
        `(function(React, ReactDOM, ReactJSXRuntime, ReactJSXDevRuntime) {
          ${this.EXCALIDRAW_PACKAGE};
          return ExcalidrawLib;
        })`,
        "PackageManager constructor - excalidrawLib initialization",
        window,
      );
      excalidrawLib = loadExcalidraw(
        react,
        reactDOM,
        ReactJSXRuntime,
        ReactJSXDevRuntime,
      );

      if (!excalidrawLib) {
        throw new Error("Failed to initialize excalidrawLib");
      }

      // Update the exported functions
      updateExcalidrawLib();

      // Create a package with the loaded libraries
      const initialPackage = { react, reactDOM, excalidrawLib };

      // Validate the package before storing
      if (this.validatePackage(initialPackage)) {
        this.setPackage(window, initialPackage);
        this.fallbackPackage = initialPackage; // Store a valid package as fallback
      } else {
        throw new Error("Invalid initial package");
      }
    } catch (e: unknown) {
      errorHandler.handleError(
        normalizeError(e),
        "PackageManager constructor",
      );
      new Notice(
        "Error loading the Excalidraw package. Some features may not work correctly.",
        10000,
      );
      console.error("Error loading the Excalidraw package", e);
    }

    plugin.logStartupEvent("Excalidraw package unpacked");
  }

  /**
   * Validates that a package contains all required components
   */
  private validatePackage(pkg: Packages): boolean {
    if (!pkg) {
      return false;
    }

    // Check that all components exist
    if (!pkg.react || !pkg.reactDOM || !pkg.excalidrawLib) {
      return false;
    }

    // Verify that excalidrawLib has essential methods
    const lib = pkg.excalidrawLib;
    return (
      typeof lib === "object" &&
      lib !== null &&
      typeof lib.restoreElements === "function" &&
      typeof lib.exportToSvg === "function"
    );
  }

  /**
   * Registers plugin capabilities with one evaluated Excalidraw runtime.
   * Older package artifacts remain usable through their legacy bridge until
   * the coordinated package-version handoff is complete.
   */
  private configureObsidianCommonHost(win: Window, pkg: Packages): void {
    this.commonHostDisposerMap.get(win)?.();
    this.commonHostDisposerMap.delete(win);

    const lib = pkg.excalidrawLib;
    if (
      !lib ||
      typeof lib.configureObsidianCommonHost !== "function" ||
      typeof lib.OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION !== "number"
    ) {
      return;
    }

    const adapter = createObsidianCommonHostAdapter(
      this.plugin,
      lib.OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION,
    );
    this.commonHostDisposerMap.set(
      win,
      lib.configureObsidianCommonHost(adapter),
    );
  }

  /** Registers plugin-wide settings with one evaluated Excalidraw runtime. */
  private configureObsidianExcalidrawHost(win: Window, pkg: Packages): void {
    this.excalidrawHostDisposerMap.get(win)?.();
    this.excalidrawHostDisposerMap.delete(win);

    const lib = pkg.excalidrawLib;
    if (
      !lib ||
      typeof lib.configureObsidianExcalidrawHost !== "function" ||
      typeof lib.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION !== "number"
    ) {
      return;
    }

    const adapter = createObsidianExcalidrawHostAdapter(
      this.plugin,
      lib.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION,
    );
    this.excalidrawHostDisposerMap.set(
      win,
      lib.configureObsidianExcalidrawHost(adapter),
    );
  }

  /** Disposes every host registration owned by an evaluated window runtime. */
  private disposeObsidianHosts(win: Window): void {
    this.commonHostDisposerMap.get(win)?.();
    this.commonHostDisposerMap.delete(win);
    this.excalidrawHostDisposerMap.get(win)?.();
    this.excalidrawHostDisposerMap.delete(win);
  }

  /**
   * Store a package for a specific window
   */
  public setPackage(window: Window, pkg: Packages) {
    if (this.validatePackage(pkg)) {
      try {
        this.configureObsidianCommonHost(window, pkg);
        this.configureObsidianExcalidrawHost(window, pkg);
      } catch (error: unknown) {
        this.disposeObsidianHosts(window);
        throw normalizeError(error);
      }
      this.packageMap.set(window, pkg);

      // Update fallback if we don't have one
      if (!this.fallbackPackage) {
        this.fallbackPackage = pkg;
      }
    } else {
      errorHandler.handleError(
        "Attempted to set invalid package",
        "PackageManager.setPackage",
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
      // Return existing package if available
      if (this.packageMap.has(win)) {
        const pkg = this.packageMap.get(win);
        if (this.validatePackage(pkg)) {
          return pkg;
        }
        // If package exists but is invalid, delete it so we can recreate it
        this.deletePackage(win);
      }

      // Create new package
      return errorHandler.wrapWithTryCatch(
        () => {
          // Use safe evaluation to load packages in the window context
          const evalResult = errorHandler.safeEval<{
            react: typeof React;
            reactDOM: typeof ReactDOM;
            excalidrawLib: typeof ExcalidrawLib;
          }>(
            `(function() {
            ${REACT_PACKAGES + this.EXCALIDRAW_PACKAGE};
            return {
              react: React,
              reactDOM: ReactDOM,
              excalidrawLib: ExcalidrawLib,
            };
          })()`,
            "PackageManager.getPackage - package evaluation",
            win,
          );

          if (!evalResult || !this.validatePackage(evalResult)) {
            throw new Error("Failed to create valid package");
          }

          const newPackage = {
            react: evalResult.react,
            reactDOM: evalResult.reactDOM,
            excalidrawLib: evalResult.excalidrawLib,
          };

          this.setPackage(win, newPackage);
          return newPackage;
        },
        "PackageManager.getPackage",
        this.fallbackPackage,
      );
    } catch (error: unknown) {
      errorHandler.handleError(
        normalizeError(error),
        "PackageManager.getPackage",
      );

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
      this.disposeObsidianHosts(win);

      const pkg = this.packageMap.get(win);
      if (!pkg) {
        return;
      }

      const { excalidrawLib } = pkg;
      if (win.ExcalidrawLib === excalidrawLib) {
        errorHandler.wrapWithTryCatch(() => {
          if (
            excalidrawLib &&
            typeof excalidrawLib.destroyObsidianUtils === "function"
          ) {
            excalidrawLib.destroyObsidianUtils();
          }
          delete win.ExcalidrawLib;
        }, "PackageManager.deletePackage - cleanup ExcalidrawLib");
      }

      this.packageMap.delete(win);
    } catch (error: unknown) {
      errorHandler.handleError(
        normalizeError(error),
        "PackageManager.deletePackage",
      );
    }
  }

  public setExcalidrawPackage(pkg: string) {
    this.EXCALIDRAW_PACKAGE = pkg;
  }

  public destroy() {
    try {
      REACT_PACKAGES = "";

      Array.from(this.packageMap.entries()).forEach(([win, _]) => {
        this.deletePackage(win);
      });

      this.packageMap.clear();
      this.commonHostDisposerMap.clear();
      this.excalidrawHostDisposerMap.clear();
      this.EXCALIDRAW_PACKAGE = "";
      this.fallbackPackage = null;

      react = null;
      reactDOM = null;
      excalidrawLib = null;
    } catch (error: unknown) {
      errorHandler.handleError(
        normalizeError(error),
        "PackageManager.destroy",
      );
    }
  }
}
