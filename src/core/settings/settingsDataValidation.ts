/** Classification helpers for safely loading plugin settings data. */

/** Observable state of the plugin's `data.json` file before loading it. */
export type SettingsDataFileState =
  | "missing"
  | "empty"
  | "present"
  | "unknown";

/** Result of validating one settings load attempt. */
export type SettingsDataLoadClassification =
  | "valid"
  | "first-installation"
  | "invalid";

/** Returns true for the object shape accepted as persisted settings data. */
export const isSettingsDataRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Distinguishes a genuine first installation from an empty, malformed, or
 * failed settings load that must not replace already loaded settings.
 */
export function classifySettingsDataLoad(options: {
  value: unknown;
  fileState: SettingsDataFileState;
  loadFailed: boolean;
  isInitialLoad: boolean;
}): SettingsDataLoadClassification {
  if (isSettingsDataRecord(options.value)) {
    return "valid";
  }
  if (
    options.isInitialLoad &&
    !options.loadFailed &&
    (options.value === null || typeof options.value === "undefined") &&
    options.fileState === "missing"
  ) {
    return "first-installation";
  }
  return "invalid";
}
