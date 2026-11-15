/**
 * Same-file reloads already apply the incoming data. Retain the loaded-file
 * marker for incremental reloads, and for full reloads in split views, so a
 * duplicate TextFileView delivery does not reapply the saved viewport.
 */
export const shouldRetainLoadedFileAfterReload = (
  fullReload: boolean,
  loadOnModifyTrigger: boolean,
  isOpenInMultipleLeaves: boolean,
): boolean => loadOnModifyTrigger && (!fullReload || isOpenInMultipleLeaves);
