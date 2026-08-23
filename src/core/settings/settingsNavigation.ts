import type { App } from "obsidian";

/** Returns whether the current Obsidian runtime exposes page navigation. */
export function canNavigateSettingsPages(app: App): boolean {
  return (
    typeof app.setting.openPagePath === "function" ||
    (typeof app.setting.findTabById === "function" &&
      typeof app.setting.navigateToPage === "function")
  );
}

/**
 * Navigates to a declarative settings page through Obsidian's unpublished
 * settings API.
 *
 * The method is deliberately isolated behind structural and exception guards
 * because it is not part of Obsidian's public compatibility contract.
 *
 * @returns `true` when Obsidian accepted the navigation request, otherwise
 * `false` so callers can leave the current page intact.
 */
export function navigateToSettingsPage(
  app: App,
  tabId: string,
  pagePath: readonly string[],
): boolean {
  try {
    if (typeof app.setting.openPagePath === "function") {
      return app.setting.openPagePath(tabId, [...pagePath]) !== null;
    }

    if (
      typeof app.setting.findTabById !== "function" ||
      typeof app.setting.navigateToPage !== "function"
    ) {
      return false;
    }
    const tab = app.setting.findTabById(tabId);
    if (!tab) {
      return false;
    }
    app.setting.navigateToPage(tab, [...pagePath]);
    return true;
  } catch (error) {
    console.warn(
      "Excalidraw: Obsidian settings page navigation is unavailable.",
      error,
    );
    return false;
  }
}
