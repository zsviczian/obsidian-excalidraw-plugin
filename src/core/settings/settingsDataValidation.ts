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

/**
 * Accepts nonempty settings records, including unknown forward-compatible keys.
 * An empty object can be produced by a late save after teardown; accepting it
 * would replace both user preferences and their recovery snapshot with defaults.
 */
export const isSettingsDataRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

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
