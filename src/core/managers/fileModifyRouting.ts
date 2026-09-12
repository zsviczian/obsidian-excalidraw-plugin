export type DrawingModifyRoute =
  | "full-reload"
  | "incremental-sync"
  | "raw-reload";

interface DrawingModifyRouteInput {
  fileExtension: string;
  isEditingMarkdownSideInSplitView: boolean;
  isDirty: boolean;
  isPersistenceBusy: boolean;
  isStale: boolean;
}

/**
 * Selects how an open drawing consumes one matching Vault modify event.
 *
 * A dirty or busy Markdown view must reconcile rather than replace its live
 * scene, even when the existing inactivity heuristic would otherwise request
 * a full reload.
 */
export const getDrawingModifyRoute = ({
  fileExtension,
  isEditingMarkdownSideInSplitView,
  isDirty,
  isPersistenceBusy,
  isStale,
}: DrawingModifyRouteInput): DrawingModifyRoute => {
  if (
    fileExtension === "md" &&
    (isDirty || isPersistenceBusy || isEditingMarkdownSideInSplitView)
  ) {
    return "incremental-sync";
  }

  if (isStale && !isEditingMarkdownSideInSplitView) {
    return "full-reload";
  }

  return fileExtension === "md" ? "incremental-sync" : "raw-reload";
};
