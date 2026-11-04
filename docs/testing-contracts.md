# Test contracts, schema 2

The plugin owns the native coordinator; fork and Extras own independent suites.
All files below are test tooling and must stay outside production graphs.

The native working vault is always
`.test-work/vaults/excalidraw-auto-test/` in this checkout. `npm run test:native`
builds, freezes and deploys the selected workspace revisions, including current
Extras when present, before executing scenarios. Installed hashes and running
vault/config identities must match. The immutable seed includes both plugin
`data.json` files and the enabled-plugin/core-plugin configuration; generated
executable files are installed only in the ignored working copy. Ownership
markers and the shared host lock span all preparation, deployment and cleanup.

`tests/features.json.behaviorMatrix` contains reviewed factor domains, case
templates with expected behavior/assertions, all required host contexts and the
expanded canonical case IDs. Missing important cases fail the regression audit;
the previous core count cannot substitute for the expanded matrix. Reports keep
native plugin-command cases, native host/EA/trusted-input cases, emulated layout
cases, source simulations and actual built-browser cases distinct. Synthetic
drop payloads never establish real OS drag transport or physical-device input.

PDF export itself has no introduced deadline or per-document lock. Tooling has
bounded deadlines but cannot cancel an Electron print: a pending native promise
retains its content, style, listener, controller and owned paths for recovery.
Only actual completion or a settled error allows cleanup. Single-export native
evidence retains the generated PDF and decoded page beside its report.

The required `core-regression` report combines independent current-product
suites. It requires native CLI/EA, popout lifecycle and device case identities unless explicitly run in
portable mode; missing suites, failed cleanup, unexpected errors and coverage
regressions remain failures. Upstream diagnostic mismatches and supplemental
platform/restart obligations do not define the accepted fork baseline. Keep
suspected defects visible in TESTING_FINDINGS_3022.md for maintainer decisions.

`scripts/testing/contracts.mjs` is the executable artifact/report contract.
Sibling producers may import it from an explicit `--contract-root` supplied by
the coordinator. Their independent tests must not require this checkout. Keep
contract fixtures and producer adapters versioned in their own repository.

Artifact manifests contain `schemaVersion: 2`, kind (`plugin`, `fork`, `extras`),
`repository`, 40-character `commit`, `dirty`, SHA-256 `diffHash` and
`lockfileHash`, `buildCommand`, `toolchain`, `evidence` and `artifacts`.
Each artifact has `role`, slash-separated producer-relative `relativePath`,
`sha256` and `bytes`. Empty files, duplicate paths/roles, missing roles, path
escapes and redirected ancestors fail validation. The coordinator freezes a
verified snapshot and revalidates both source and destination; it consumes only
that snapshot. Workspace byte tests and published-package checks remain separate.

Required roles:

| Producer | Roles |
| --- | --- |
| plugin | main, manifest, styles |
| fork | production-js, production-css, development-js, development-css, declarations |
| extras | main, manifest, styles, declarations |

Suite reports contain `schemaVersion: 2`, `suiteId`, `status`, `cleanup` and
`tests`, plus source/profile/environment/fixture/evidence metadata appropriate
to the layer. Every test has a globally unique `testId`, `featureIds`, `status`
and assertions. Status is `passed`, `failed`, `blocked` or `notApplicable`;
nonpasses require a reason. Required blocked/not-applicable/missing tests, zero
discovery, duplicate identities, unsuccessful suites and cleanup failure fail
the aggregate. Legacy schema-1 native reports require `adaptSmokeReport()`;
adaptation does not assign feature coverage to unexecuted scenarios.

Native scenario contributions export an async function taking the existing
`{ cli, drawingPath, reportDir }` context and returning a scenario result with
`id`, `status`, assertions and evidence. Contribute in a producer-owned file;
only the plugin coordinator edits registration/staging files. Native calls,
debugger/input, staging and device transitions run serially under
`host/hostLock.mjs`, keyed to the explicit canonical application user-data path.
Independent suites do not acquire the host lock or control Obsidian.

The complete feature registry is an obligation list. A foundation checkpoint
does not satisfy unexecuted rendering, lifecycle, device or service obligations.
