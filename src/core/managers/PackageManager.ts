import { updateExcalidrawLib } from "src/constants/constants";
import { ExcalidrawLib } from "../../types/excalidrawLib";
import { PackageLease, Packages } from "../../types/types";
import { Notice } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { errorHandler } from "../../utils/ErrorHandler";
import React from "react";
import * as ReactDOMLegacy from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as ReactJSXRuntime from "react/jsx-runtime";
import * as ReactJSXDevRuntime from "react/jsx-dev-runtime";
import { createObsidianCommonHostAdapter } from "./obsidianCommonHostAdapter";
import { createObsidianExcalidrawHostAdapter } from "./obsidianExcalidrawHostAdapter";

declare let excalidrawLib: typeof ExcalidrawLib;
declare const unpackExcalidraw: () => string;

const reactDOM = Object.assign({}, ReactDOMLegacy, ReactDOMClient);
const reactJSXDevRuntime = Object.assign({}, ReactJSXDevRuntime, {
  // React's production jsx-dev-runtime deliberately leaves jsxDEV undefined,
  // while the Excalidraw artifact accepts either external runtime entrypoint.
  jsxDEV: ReactJSXDevRuntime.jsxDEV ?? ReactJSXRuntime.jsx,
});

const normalizeError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : "Unknown error");

/**
 * Owns the plugin's single private React/Excalidraw runtime.
 *
 * Each view receives the same package but retains an idempotent lease keyed by
 * its actual window. The window key governs migration persistence and the
 * temporary `ExcalidrawLib` compatibility alias only; rendering ownership is
 * supplied independently through each Excalidraw instance's `ownerDocument`.
 */
export class PackageManager {
  private runtimePackage: Packages | null = null;
  private packageLeaseCountMap = new Map<Window, number>();
  private commonHostDisposer: (() => void) | null = null;
  private excalidrawHostDisposer: (() => void) | null = null;
  private runtimeAliasWindows = new Set<Window>();

  constructor(private readonly plugin: ExcalidrawPlugin) {
    let excalidrawPackage = "";

    try {
      excalidrawPackage = unpackExcalidraw();

      // Evaluate Excalidraw in the main window with the same private React
      // instance used by the plugin bundle. The runtime is passed explicitly
      // because window.React and window.ReactDOM are deliberately not set.
      const loadExcalidraw = errorHandler.safeEval<
        (
          reactInstance: typeof React,
          reactDOMInstance: typeof reactDOM,
          jsxRuntime: unknown,
          jsxDevRuntime: unknown,
        ) => typeof ExcalidrawLib
      >(
        `(function(React, ReactDOM, ReactJSXRuntime, ReactJSXDevRuntime) {
          ${excalidrawPackage};
          return ExcalidrawLib;
        })`,
        "PackageManager constructor - excalidrawLib initialization",
        window,
      );
      excalidrawLib = loadExcalidraw(
        React,
        reactDOM,
        ReactJSXRuntime,
        reactJSXDevRuntime,
      );

      if (!excalidrawLib) {
        throw new Error("Failed to initialize excalidrawLib");
      }

      // Update the exported functions
      updateExcalidrawLib();

      // Create a package with the loaded libraries
      const initialPackage = { react: React, reactDOM, excalidrawLib };

      // Validate the package before storing
      if (this.validatePackage(initialPackage)) {
        this.setRuntimePackage(initialPackage);
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
    } finally {
      // Per-window evaluation has been removed. Release the decompressed
      // Excalidraw source after the one runtime is initialized instead of
      // retaining it for hypothetical future popouts.
      excalidrawPackage = "";
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
  private configureObsidianCommonHost(pkg: Packages): void {
    this.commonHostDisposer?.();
    this.commonHostDisposer = null;

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
    this.commonHostDisposer = lib.configureObsidianCommonHost(adapter);
  }

  /** Registers plugin-wide settings with one evaluated Excalidraw runtime. */
  private configureObsidianExcalidrawHost(pkg: Packages): void {
    this.excalidrawHostDisposer?.();
    this.excalidrawHostDisposer = null;

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
    this.excalidrawHostDisposer =
      lib.configureObsidianExcalidrawHost(adapter);
  }

  /** Disposes the plugin capabilities registered with the shared runtime. */
  private disposeObsidianHosts(): void {
    this.commonHostDisposer?.();
    this.commonHostDisposer = null;
    this.excalidrawHostDisposer?.();
    this.excalidrawHostDisposer = null;
  }

  /** Stores and configures the plugin's single evaluated runtime package. */
  private setRuntimePackage(pkg: Packages): void {
    if (this.validatePackage(pkg)) {
      try {
        this.configureObsidianCommonHost(pkg);
        this.configureObsidianExcalidrawHost(pkg);
      } catch (error: unknown) {
        this.disposeObsidianHosts();
        throw normalizeError(error);
      }
      this.runtimePackage = pkg;
    } else {
      errorHandler.handleError(
        "Attempted to set invalid package",
        "PackageManager.setRuntimePackage",
      );
    }
  }

  /** Returns the one runtime used by every main-window and popout view. */
  public getRuntimePackage(): Packages {
    if (!this.runtimePackage || !this.validatePackage(this.runtimePackage)) {
      throw new Error("Excalidraw runtime package is unavailable");
    }
    return this.runtimePackage;
  }

  /**
   * Acquires the shared runtime while retaining the view's actual window.
   *
   * @remarks
   * Window identity remains view-owned migration/persistence state. Popout
   * leases additionally own the temporary `window.ExcalidrawLib` compatibility
   * alias and remove it when the final view in that window releases its lease.
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
        this.removeRuntimeAlias(win);
      }
    } else {
      this.packageLeaseCountMap.set(win, remainingLeases);
    }
  }

  /**
   * Returns the shared runtime and exposes its compatibility API in `win`.
   *
   * @remarks
   * The runtime is never evaluated in the supplied window. Rendering ownership
   * is provided separately through Excalidraw's stable `ownerDocument` prop.
   */
  public getPackage(win: Window): Packages {
    const pkg = this.getRuntimePackage();
    if (win !== window) {
      win.ExcalidrawLib = pkg.excalidrawLib;
      this.runtimeAliasWindows.add(win);
    }
    return pkg;
  }

  /** Removes only the window-local alias; the shared runtime remains alive. */
  private removeRuntimeAlias(win: Window): void {
    const packageLib = this.runtimePackage?.excalidrawLib;
    errorHandler.wrapWithTryCatch(() => {
      if (packageLib && win.ExcalidrawLib === packageLib) {
        delete win.ExcalidrawLib;
      }
    }, "PackageManager.removeRuntimeAlias");
    this.runtimeAliasWindows.delete(win);
  }

  /**
   * Compatibility facade retained for callers that explicitly clean a window.
   * The plugin-wide runtime and host registrations live until `destroy()`.
   */
  public deletePackage(win: Window) {
    try {
      if (win !== window) {
        this.removeRuntimeAlias(win);
      }
    } catch (error: unknown) {
      errorHandler.handleError(
        normalizeError(error),
        "PackageManager.deletePackage",
      );
    }
  }

  public destroy() {
    try {
      Array.from(this.runtimeAliasWindows).forEach((win) => {
        this.removeRuntimeAlias(win);
      });
      this.removeRuntimeAlias(window);

      this.packageLeaseCountMap.clear();
      this.runtimeAliasWindows.clear();
      this.disposeObsidianHosts();
      this.runtimePackage = null;

      excalidrawLib = null;
    } catch (error: unknown) {
      errorHandler.handleError(
        normalizeError(error),
        "PackageManager.destroy",
      );
    }
  }
}
