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

/** View/file export inputs captured with the source scene revision. */
export interface PreparedSaveExportOptions {
  readonly theme: "light" | "dark";
  readonly embedScene: boolean;
  readonly padding: number;
  readonly scale: number;
  readonly withBackground: boolean;
  readonly includeInternalLinks: boolean;
  readonly isMask: boolean;
}

/** Save-owned input detached from mutable API scene structures. */
export interface SaveSnapshot<
  TScene extends ExcalidrawViewScene = ExcalidrawViewScene,
> extends SaveOperationContext {
  readonly filePath: string;
  readonly sourceFileCtime: number;
  readonly capturedRevision: number;
  readonly sourceText: string;
  readonly scene: TScene;
  /** Binary payloads captured before normalization clears `scene.files`. */
  readonly exportFiles: BinaryFiles;
  readonly deletedElements: ExcalidrawElement[];
  readonly selectedElementIds: AppState["selectedElementIds"];
  readonly exportOptions: PreparedSaveExportOptions;
}

/** Lightweight exact-content identity retained after heavy save inputs release. */
export interface PreparedSaveIdentity extends SaveOperationContext {
  readonly filePath: string;
  readonly capturedRevision: number;
  readonly text: string;
  readonly hasNonDeletedElements: boolean;
}

/** Exact serialized document and normalized export scene owned by one save. */
export interface PreparedSave extends PreparedSaveIdentity {
  readonly sourceFileCtime: number;
  readonly scene: ExcalidrawViewScene;
  readonly deletedElements: readonly ExcalidrawElement[];
  readonly selectedElementIds: AppState["selectedElementIds"];
  readonly exportOptions: PreparedSaveExportOptions;
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
  sourceFileCtime: number;
  capturedRevision: number;
  sourceText: string;
  scene: TScene;
  deletedElements: readonly ExcalidrawElement[];
  selectedElementIds: AppState["selectedElementIds"];
  exportOptions: PreparedSaveExportOptions;
}): SaveSnapshot<TScene> => {
  const scene = cloneSceneForSave(input.scene);
  return {
    ...input.operation,
    filePath: input.filePath,
    sourceFileCtime: input.sourceFileCtime,
    capturedRevision: input.capturedRevision,
    sourceText: input.sourceText,
    scene,
    exportFiles: cloneBinaryFiles(scene.files),
    deletedElements: input.deletedElements.map((element) =>
      cloneElementForSave(element),
    ),
    selectedElementIds: { ...input.selectedElementIds },
    exportOptions: { ...input.exportOptions },
  };
};

export const createPreparedSave = (
  snapshot: SaveSnapshot,
  text: string,
): PreparedSave => {
  const scene = cloneSceneForSave({
    ...snapshot.scene,
    files: snapshot.exportFiles,
  });
  return {
    producerId: snapshot.producerId,
    targetGeneration: snapshot.targetGeneration,
    operationId: snapshot.operationId,
    requestedRevision: snapshot.requestedRevision,
    filePath: snapshot.filePath,
    sourceFileCtime: snapshot.sourceFileCtime,
    capturedRevision: snapshot.capturedRevision,
    text,
    hasNonDeletedElements: scene.elements.length > 0,
    scene,
    deletedElements: snapshot.deletedElements.map((element) =>
      cloneElementForSave(element),
    ),
    selectedElementIds: { ...snapshot.selectedElementIds },
    exportOptions: { ...snapshot.exportOptions },
  };
};

/** Drops heavy scene data once only exact-content classification remains. */
export const createPreparedSaveIdentity = (
  preparedSave: PreparedSave,
): PreparedSaveIdentity => ({
  producerId: preparedSave.producerId,
  targetGeneration: preparedSave.targetGeneration,
  operationId: preparedSave.operationId,
  requestedRevision: preparedSave.requestedRevision,
  filePath: preparedSave.filePath,
  capturedRevision: preparedSave.capturedRevision,
  text: preparedSave.text,
  hasNonDeletedElements: preparedSave.hasNonDeletedElements,
});

/**
 * A physical write acknowledges the revision represented by its captured
 * snapshot, even when the queued request was created at an older revision.
 */
export const getAcknowledgedSaveRevision = (
  requestedRevision: number,
  preparedSave?: PreparedSaveIdentity,
): number => preparedSave?.capturedRevision ?? requestedRevision;
