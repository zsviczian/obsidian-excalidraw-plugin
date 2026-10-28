# Test contracts, schema 2

The plugin owns the native coordinator; fork and Extras own independent suites.
All files below are test tooling and must stay outside production graphs.

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
