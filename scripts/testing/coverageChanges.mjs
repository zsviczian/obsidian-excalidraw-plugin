/** Honest evidence counts relative to the prior checkpoint; never an acceptance allowlist. */
export function coverageChanges(
  reports,
  baselineIds,
  { notRunInProfile = [] } = {},
) {
  const baseline = new Set(baselineIds),
    omitted = new Set(notRunInProfile),
    current = new Set(reports.flatMap((r) => r.tests.map((t) => t.testId)));
  const lanes = reports.map((report) => ({
    suiteId: report.suiteId,
    total: report.tests.length,
    reused: report.tests.filter((t) => baseline.has(t.testId)).length,
    new: report.tests.filter((t) => !baseline.has(t.testId)).length,
    passed: report.tests.filter((t) => t.status === "passed").length,
  }));
  const native = reports
    .filter((r) => r.suiteId.startsWith("native-"))
    .flatMap((r) => r.tests);
  const commandCases = native.filter(
    (t) =>
      t.testId === "native-cli-authoring" ||
      t.testId === "lucide-3019" ||
      t.evidenceKind === "native-cli-commands",
  );
  const emulated = native.filter(
    (t) =>
      t.testId.startsWith("native:device:") ||
      /^native:behavior:(phone|tablet):/.test(t.testId),
  );
  return {
    policy:
      "New/reused identity accounting only; a call or inventory entry does not establish behavior.",
    lanes,
    removedOrReplaced: [...baseline].filter(
      (id) => !current.has(id) && !omitted.has(id),
    ),
    notRunInProfile: [...baseline].filter(
      (id) => !current.has(id) && omitted.has(id),
    ),
    native: {
      pluginCommandCases: commandCases.length,
      hostEAAndTrustedInputCases: native.length - commandCases.length,
      emulatedContextCases: emulated.length,
      physicalDeviceCases: 0,
      commandCaseIds: commandCases.map((t) => t.testId),
      mobileProtocolCases: native.filter(
        (t) => t.evidenceKind === "in-process-ea-cli",
      ).length,
      mobileProtocolCaseIds: native
        .filter((t) => t.evidenceKind === "in-process-ea-cli")
        .map((t) => t.testId),
    },
    newCaseIds: [...current].filter((id) => !baseline.has(id)),
  };
}
