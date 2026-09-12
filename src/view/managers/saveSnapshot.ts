import type {
  AppState,
  BinaryFiles,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

import type { ExcalidrawViewScene } from "../../types/excalidrawViewTypes";

/** Coordinator identity for one physical save attempt. */
export interface SaveOperationContext {
  readonly producerId: string;
  readonly targetGeneration: number;
  readonly operationId: number;
  readonly requestedRevision: number;
}

/** Save-owned input detached from mutable API scene structures. */
export interface SaveSnapshot<
  TScene extends ExcalidrawViewScene = ExcalidrawViewScene,
> extends SaveOperationContext {
  readonly filePath: string;
  readonly capturedRevision: number;
  readonly sourceText: string;
  readonly scene: TScene;
  readonly deletedElements: ExcalidrawElement[];
  readonly selectedElementIds: AppState["selectedElementIds"];
}

/** Exact serialized document produced from one captured save snapshot. */
export interface PreparedSave extends SaveOperationContext {
  readonly filePath: string;
  readonly capturedRevision: number;
  readonly text: string;
  readonly hasNonDeletedElements: boolean;
}

const clonePlainValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => clonePlainValue(entry));
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return value;
  }
  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = clonePlainValue(entry);
  }
  return clone;
};

const cloneElementForSave = <T extends ExcalidrawElement>(element: T): T => {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element)) {
    // These are runtime render caches, not serialized element data.
    if (key === "shape" || key === "canvas") {
      continue;
    }
    clone[key] = clonePlainValue(value);
  }
  return clone as T;
};

const cloneBinaryFiles = (files: BinaryFiles): BinaryFiles =>
  Object.fromEntries(
    Object.entries(files).map(([id, file]) => [id, { ...file }]),
  );

/**
 * Creates a mutable save-owned working scene with no shared mutable element,
 * app-state, or binary-file records. Immutable data-URL strings remain shared.
 */
export const cloneSceneForSave = <TScene extends ExcalidrawViewScene>(
  scene: TScene,
): TScene => ({
  ...scene,
  elements: scene.elements.map((element) => cloneElementForSave(element)),
  appState: clonePlainValue(scene.appState),
  files: cloneBinaryFiles(scene.files),
});

export const createSaveSnapshot = <TScene extends ExcalidrawViewScene>(input: {
  operation: SaveOperationContext;
  filePath: string;
  capturedRevision: number;
  sourceText: string;
  scene: TScene;
  deletedElements: readonly ExcalidrawElement[];
  selectedElementIds: AppState["selectedElementIds"];
}): SaveSnapshot<TScene> => ({
  ...input.operation,
  filePath: input.filePath,
  capturedRevision: input.capturedRevision,
  sourceText: input.sourceText,
  scene: cloneSceneForSave(input.scene),
  deletedElements: input.deletedElements.map((element) =>
    cloneElementForSave(element),
  ),
  selectedElementIds: { ...input.selectedElementIds },
});

export const createPreparedSave = (
  snapshot: SaveSnapshot,
  text: string,
): PreparedSave => ({
  producerId: snapshot.producerId,
  targetGeneration: snapshot.targetGeneration,
  operationId: snapshot.operationId,
  requestedRevision: snapshot.requestedRevision,
  filePath: snapshot.filePath,
  capturedRevision: snapshot.capturedRevision,
  text,
  hasNonDeletedElements: snapshot.scene.elements.length > 0,
});

/**
 * A physical write acknowledges the revision represented by its captured
 * snapshot, even when the queued request was created at an older revision.
 */
export const getAcknowledgedSaveRevision = (
  requestedRevision: number,
  preparedSave?: PreparedSave,
): number => preparedSave?.capturedRevision ?? requestedRevision;
