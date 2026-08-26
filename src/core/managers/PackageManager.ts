import { updateExcalidrawLib } from "src/constants/constants";
import { ExcalidrawLib } from "../../types/excalidrawLib";
import { PackageLease, Packages } from "../../types/types";
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

/**
 * Feasibility spike: let popout views use the React/Excalidraw runtime that was
 * evaluated in the main Obsidian window.
 *
 * Keep this switch isolated until owner-document event, portal, observer, and
 * teardown behavior has been validated in Obsidian. Window leases deliberately
 * remain keyed by the view's real owner window; only the package value is shared.
 */
const USE_SHARED_MAIN_WINDOW_RUNTIME_FOR_POPOUTS = true;

const normalizeError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : "Unknown error");

export class PackageManager {
  private packageMap: Map<Window, Packages> = new Map<Window, Packages>();
  private EXCALIDRAW_PACKAGE: string;
  private plugin: ExcalidrawPlugin;
  private fallbackPackage: Packages | null = null;
  private packageLeaseCountMap = new Map<Window, number>();
  private commonHostDisposerMap = new Map<Window, () => void>();
  private excalidrawHostDisposerMap = new Map<Window, () => void>();
  private sharedRuntimeAliasWindows = new Set<Window>();

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
      throw new Error("Excalidraw package is missing the common host boundary");
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
      throw new Error(
        "Excalidraw package is missing the package host boundary",
      );
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
  public setPackage(win: Window, pkg: Packages) {
    if (this.validatePackage(pkg)) {
      try {
        this.configureObsidianCommonHost(win, pkg);
        this.configureObsidianExcalidrawHost(win, pkg);
      } catch (error: unknown) {
        this.disposeObsidianHosts(win);
        throw normalizeError(error);
      }
      this.packageMap.set(win, pkg);

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
   * Acquires an idempotent lease for the package owned by `win`.
   *
   * @remarks
   * Popout packages are deleted when their last lease is released. The main
   * package remains pinned for the plugin lifetime because it is also the
   * fallback runtime and is initialized as part of plugin startup.
   */
  public acquirePackage(win: Window): PackageLease {
    const packages = this.getPackage(win);
    const leaseCount = (this.packageLeaseCountMap.get(win) ?? 0) + 1;
    this.packageLeaseCountMap.set(win, leaseCount);

    let released = false;
    return {
      window: win,
      packages,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.releasePackageLease(win);
      },
    };
  }

  /** Releases one view-owned package lease without consulting mutable DOM. */
  private releasePackageLease(win: Window): void {
    const leaseCount = this.packageLeaseCountMap.get(win);
    if (leaseCount === undefined) {
      return;
    }

    const remainingLeases = Math.max(0, leaseCount - 1);
    if (remainingLeases === 0) {
      this.packageLeaseCountMap.delete(win);
      if (win !== window) {
        this.deletePackage(win);
      }
    } else {
      this.packageLeaseCountMap.set(win, remainingLeases);
    }

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

      if (
        USE_SHARED_MAIN_WINDOW_RUNTIME_FOR_POPOUTS &&
        win !== window &&
        this.fallbackPackage &&
        this.validatePackage(this.fallbackPackage)
      ) {
        // Preserve the documented compatibility surface in the popout without
        // evaluating another React/Excalidraw runtime in that window.
        win.ExcalidrawLib = this.fallbackPackage.excalidrawLib;
        this.sharedRuntimeAliasWindows.add(win);
        return this.fallbackPackage;
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
      const pkg = this.packageMap.get(win);
      const sharedRuntimeAlias = this.sharedRuntimeAliasWindows.has(win)
        ? this.fallbackPackage?.excalidrawLib
        : null;
      const packageLib = pkg?.excalidrawLib ?? sharedRuntimeAlias;
      if (packageLib && win.ExcalidrawLib === packageLib) {
        errorHandler.wrapWithTryCatch(() => {
          delete win.ExcalidrawLib;
        }, "PackageManager.deletePackage - cleanup ExcalidrawLib");
      }
      this.sharedRuntimeAliasWindows.delete(win);

      if (pkg) {
        this.disposeObsidianHosts(win);
        this.packageMap.delete(win);
      }
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

      Array.from(this.sharedRuntimeAliasWindows).forEach((win) => {
        this.deletePackage(win);
      });
      Array.from(this.packageMap.entries()).forEach(([win, _]) => {
        this.deletePackage(win);
      });

      this.packageMap.clear();
      this.packageLeaseCountMap.clear();
      this.commonHostDisposerMap.clear();
      this.excalidrawHostDisposerMap.clear();
      this.sharedRuntimeAliasWindows.clear();
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
