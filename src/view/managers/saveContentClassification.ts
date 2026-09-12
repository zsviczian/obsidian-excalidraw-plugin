import type { PreparedSave } from "./saveSnapshot";

export type ObservedWriteState =
  | "prepared"
  | "successful"
  | "failed"
  | "handed-off";

export interface ObservedWriteAttempt {
  readonly preparedSave: PreparedSave;
  readonly state: ObservedWriteState;
}

export interface AcceptedContentIdentity {
  readonly filePath: string;
  readonly targetGeneration: number;
  readonly text: string;
}

export type ObservedContentKind =
  | "matches-successful-write"
  | "matches-accepted-content"
  | "matches-pending-write"
  | "matches-failed-write"
  | "matches-unconfirmed-handoff"
  | "different-from-known-content"
  | "unknown";

export interface ObservedContentClassification {
  readonly kind: ObservedContentKind;
  readonly hasNewerLocalRevision: boolean;
}

/** Whether the observed Vault bytes are already represented by this view. */
export const isRedundantObservedSaveContent = (
  classification: ObservedContentClassification,
): boolean =>
  classification.kind === "matches-successful-write" ||
  classification.kind === "matches-accepted-content";

interface ObservedContentInput {
  filePath: string;
  targetGeneration: number;
  observedText: string;
  currentRevision: number;
  savedRevision: number;
  successfulWrite: PreparedSave | null;
  latestAttempt: ObservedWriteAttempt | null;
  acceptedContent: AcceptedContentIdentity | null;
}

const matchesTarget = (
  identity: { filePath: string; targetGeneration: number },
  filePath: string,
  targetGeneration: number,
): boolean =>
  identity.filePath === filePath &&
  identity.targetGeneration === targetGeneration;

export const isSameSaveOperation = (
  left: PreparedSave,
  right: PreparedSave,
): boolean =>
  left.producerId === right.producerId &&
  left.targetGeneration === right.targetGeneration &&
  left.operationId === right.operationId &&
  left.filePath === right.filePath;

/** Classifies observed Vault content against the view's confirmed identities. */
export const classifyObservedSaveContent = ({
  filePath,
  targetGeneration,
  observedText,
  currentRevision,
  savedRevision,
  successfulWrite,
  latestAttempt,
  acceptedContent,
}: ObservedContentInput): ObservedContentClassification => {
  if (
    successfulWrite &&
    matchesTarget(successfulWrite, filePath, targetGeneration) &&
    successfulWrite.text === observedText
  ) {
    return {
      kind: "matches-successful-write",
      hasNewerLocalRevision: currentRevision > successfulWrite.capturedRevision,
    };
  }

  if (
    acceptedContent &&
    matchesTarget(acceptedContent, filePath, targetGeneration) &&
    acceptedContent.text === observedText
  ) {
    return {
      kind: "matches-accepted-content",
      hasNewerLocalRevision: currentRevision > savedRevision,
    };
  }

  if (
    latestAttempt &&
    matchesTarget(latestAttempt.preparedSave, filePath, targetGeneration) &&
    latestAttempt.preparedSave.text === observedText
  ) {
    const kindByState: Record<ObservedWriteState, ObservedContentKind> = {
      prepared: "matches-pending-write",
      successful: "matches-successful-write",
      failed: "matches-failed-write",
      "handed-off": "matches-unconfirmed-handoff",
    };
    return {
      kind: kindByState[latestAttempt.state],
      hasNewerLocalRevision:
        currentRevision > latestAttempt.preparedSave.capturedRevision,
    };
  }

  const hasApplicableIdentity =
    (successfulWrite &&
      matchesTarget(successfulWrite, filePath, targetGeneration)) ||
    (latestAttempt &&
      matchesTarget(latestAttempt.preparedSave, filePath, targetGeneration)) ||
    (acceptedContent &&
      matchesTarget(acceptedContent, filePath, targetGeneration));

  return {
    kind: hasApplicableIdentity ? "different-from-known-content" : "unknown",
    hasNewerLocalRevision: false,
  };
};
