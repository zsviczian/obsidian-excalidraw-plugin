/**
 * A non-full same-file reload refreshes the Markdown envelope while retaining
 * the reconciled live scene. The following TextFileView delivery is therefore
 * a duplicate bridge notification, not a new drawing load.
 */
export const shouldRetainLoadedFileAfterReload = (
  fullReload: boolean,
  loadOnModifyTrigger: boolean,
): boolean => !fullReload && loadOnModifyTrigger;
