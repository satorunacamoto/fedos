# FedOS Trust / Offline Monetization + OSS Release Closure — Final Validation

Arc scope: `src/os/trust/` (new capability) + OSS release closure docs/audits.
Starting point: CandidateHead `512b1703`, EvidenceHead `693cfdcc`
(Runtime Ownership Extraction arc). This document records the evidence
backing the arc's final report, following this repo's own "verified, not
assumed" evidence discipline.

## Method note on the full regression numbers below

Every "full regression" number in this document comes from an **exact
FAIL-line-set diff** against a real, complete run of the pristine
`693cfdcc` baseline (run in full, in a separate dedicated worktree checked
out at that exact commit, untouched by this arc) — not from grepping for
keywords or assuming a
failure is "probably pre-existing" because it doesn't mention Trust. Four
full 1198→1198-file candidate runs were executed over the course of this
arc (each ~300-380s, `--pool=forks --poolOptions.forks.minForks=1
--poolOptions.forks.maxForks=4`, sequential — never run concurrently with
another heavy build/test/package operation), each diffed against the same
baseline run, to drive the new-failure count from 194 → 19 → 1 → 0
(effectively; see below) as fixes landed.

## Full regression — final numbers (post-commit, at CandidateHead)

```
Baseline (693cfdcc, pristine):  452 failed tests /  14544 passed / 15076 total (1187 files, no Trust tests exist yet)
Candidate (e6b2386a, this arc): 453 failed tests /  14623 passed / 15156 total (1198 files, +11 new Trust test files)
```

**Exact-set diff: baseline-only (fixed) = 0. Candidate-only (new) = 1.**

The one candidate-only failure —
`test/secure_runtime_alpha_7881_7960_writetime_reproduction_benchmark.test.ts
> ... > 1. a single new-id 'putObservation' call costs more as prior log
size T grows` — is a wall-clock performance-threshold benchmark, unrelated
to `src/os/trust/` or anything this arc touched (an O(T) write-time
regression benchmark in the Observation/Outbox subsystem). Verified in
isolation (`npx vitest run <file>`, single-file, no concurrent load): **4/4
tests pass reliably.** This matches the exact same pattern already
observed once earlier in this arc's own iteration
(`secure_runtime_alpha_7561_7640_private_transport_restart_hydration.test.ts`'s
"five restart cycles ... zero retry amplification" — also verified passing
in isolation, and which did NOT reappear in the final run) — both are
timing-sensitive benchmarks that occasionally read as failed under the
`--maxForks=4` full-suite CPU contention this repository's own `BUILDING.md`
already documents as a known flake class ("A single test failing ... with
no code change in between, is almost always this contention class, not a
regression"). **Net new functional failures: 0.**

### The 194 → 0 path (what actually changed)

This arc's one new runtime dependency (`qrcode`, for `src/os/trust/qr/`)
changed root `package.json`'s `dependencies` from 2 to 3 entries (and
`devDependencies` from 3 to 4, for `@types/qrcode`). That broke **194**
pre-existing historical "Stage N regression" tests scattered across this
repository that each independently hardcoded package.json's exact
dependency count and/or exact sorted key list as a frozen invariant
(`expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2)` and
variants). None of these 194 were testing anything about Trust — they
were all re-deriving the SAME stale "exactly these 2 packages, forever"
assumption independently.

Per this arc's explicit instruction, these were not just bumped to a new
hardcoded number — the underlying invariant was corrected:
`test/helpers/fedos_root_dependency_invariant.ts` is now the single
canonical source of truth (`FEDOS_ROOT_REQUIRED_DEPENDENCIES`/
`FEDOS_ROOT_ALLOWED_DEPENDENCIES`, and the `devDependencies` equivalents),
checked via `assertFedosRootDependencyInvariant()`/
`assertFedosRootDevDependencyInvariant()` — "every required dependency is
present, nothing outside the reviewed allowlist" — instead of a frozen
count. 184 test files (176 via a verified, dry-run-previewed scripted
codemod + 8 hand-verified `test/reviews/**` files) now call the shared
helper; 2 files with an additional `devDependencies` check were fixed by
hand for the same reason. 10 further candidate-only failures were git
working-tree/git-status confinement checks (`test/reviews/**`, checking
`git status` is empty or confined to specific directories) — expected to
fail while this arc's own work was uncommitted, and reverified PASSING
immediately after the CandidateHead commit (worktree clean).

Verified along the way: 0 new typecheck errors at every stage (the
error-file SET, not just the count, is byte-identical before/after —
`comm -13` on sorted error-file lists returns empty every time), and 0
new circular dependencies (`test/architecture_cycle_detector.test.ts`
still 6/6 passing).

## Targeted test results

```
TRUST (all 11 test files, combined):        80/80 pass
  trust_envelope_foundation.test.ts:          8/8
  trust_pseudonymous_credential.test.ts:      7/7
  trust_possession.test.ts:                   8/8
  trust_capabilities.test.ts:                 7/7
  trust_subscription_entitlement.test.ts:     8/8
  trust_subscription_signing_request.test.ts: 7/7
  trust_issuer_cli.test.ts:                   7/7
  trust_signed_qr.test.ts:                   11/11
  trust_contract_artifact_proof.test.ts:     12/12
BOUNDARY (architecture_boundary_trust.test.ts): 2/2
FACTORY COMPOSITION (trust_factory_composition.test.ts): 3/3
CYCLE DETECTOR (architecture_cycle_detector.test.ts): 6/6 (0 new SCCs)
```

Negative/security tests actually present and passing (arc brief §38-39):
tampered payload byte, wrong `type`/`issuer`/`subject`, wrong scope,
expired, not-yet-valid, unknown issuer key, key-rotation-window violation,
replay under same audience, reuse under different audience, unsupported
envelope version fails closed, oversized/malformed/truncated QR text
fails closed before parsing, contract-digest tamper (artifact signature
INVALID while content claim stays NOT_EVALUATED — never collapsed).

## Typecheck

`npx tsc --noEmit -p tsconfig.json`: 841 errors, identical error-FILE-SET
before and after every change this arc made (verified via `comm -13` on
sorted file lists at 4 separate checkpoints). **0 new type errors.** All
841 are the pre-existing, previously-documented `@ts-expect-error`/
`@types/node` shared-environment artifact and other unrelated historical
drift (confirmed: 2 of them are the identical known pattern already
present, unmodified, in the pre-existing `architecture_boundary_commerce.test.ts`/
`architecture_boundary_messenger.test.ts`).

## Package / packaged real launch

```
npm run build:beta-runtime                                     -> clean, no errors
npm run build --prefix packages/fedos-desktop-electron-spike   -> clean, no errors
node scripts/run_electron_builder_package_beta.mjs (nsis+zip)  -> succeeded
```

Artifacts produced: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (NSIS
installer, unsigned — `signtool.exe` runs but no production certificate
is configured anywhere in this environment, matching `BUILDING.md`'s own
documented `unsigned:true` status) and `FedOS Desktop Beta-0.1.0-beta.1-win.zip`
(portable). `packages/fedos-core-rust/pkg/` (compiled WASM) is absent —
a pre-existing, already-documented gap (`BUILDING.md`, Release Review
item R-5) this arc did not need to close, since `src/os/trust/` has no
Rust/WASM dependency of any kind.

**Real packaged launch**: `FedOS Desktop Beta.exe` launched
(`win-unpacked/`), confirmed alive 5s later (`Responding: True`, 32
threads, ~62MB working set), spawned the expected multi-process Electron
topology (main + 2 child processes). **Zero TCP connections across all 3
processes** (`Get-NetTCPConnection`, checked per-PID) — confirmed no
external network contact. Shut down cleanly via `taskkill /PID <owned
pid> /T /F`; reverified zero leftover `FedOS*` processes afterward. No
global Node/Electron process was touched — only this launch's own owned
PID tree.

`src/os/trust/` is **not yet wired into this packaged app's runtime**
(no packaging tsconfig references it, no composition root constructs
`createTrust()`) — per the arc's own §41 instruction ("minimal
adapters/extension points only... not a product-feature explosion") and
matching `os/commerce`'s own established precedent for a real-but-unwired
capability. The packaged launch above therefore validates that Trust's
addition **does not affect** the existing packaged app (same launch
behavior, same zero-network-contact result as before this arc) — it does
not exercise Trust code inside the packaged process, because nothing in
the shipped app calls it yet.

## Clean OSS checkout verification

Fresh `git worktree add` at CandidateHead `e6b2386a` (detached HEAD,
zero uncommitted state carried over):

```
git status --short                    -> 0 (clean)
find . -iname "*.key" -o -iname "*secret*"  -> only SOURCE FILE NAMES about
                                              secret-handling code; zero
                                              actual secret VALUES/material
npm install (root)                    -> 80 packages, clean
npx tsc --noEmit -p tsconfig.json     -> 841 errors, IDENTICAL set to the
                                          main worktree, 0 trust-related
npx vitest run <all 11 trust files>   -> 11/11 files, 80/80 tests pass
npm run trust:issuer -- generate-key <path>
                                       -> builds + runs correctly, prints
                                          ONLY the public key hex to
                                          stdout, writes secret to the
                                          given path with an explicit
                                          "keep out of version control"
                                          warning
npm run trust:issuer -- inspect-key   -> correctly reads FEDOS_ISSUER_KEY_FILE,
                                          prints publicKeyHex/keyId only
```

**Confirmed: the OSS build requires zero FedOS Official private-key
material of any kind.** The offline issuer CLI generates and uses its own
fresh, disposable key entirely locally; the test key generated for this
verification was deleted immediately after use and never committed.

`npm audit` in the clean checkout reports 7 vulnerabilities (1 critical,
2 high, 4 moderate) — every one traces to `vitest`'s own transitive
dev-tooling dependency tree (`vite`/`esbuild`/`nanoid`/`postcss`), a
pre-existing devDependency predating this arc, never shipped in the
packaged app or any production code path. Not introduced by this arc's
one new dependency (`qrcode`, which has zero flagged vulnerabilities).

## Dependency license audit

`THIRD_PARTY_NOTICES.md` regenerated (`node scripts/generate_third_party_notices.mjs`):
335 npm packages (root + `packages/fedos-desktop-electron-spike`), 82
Rust crates. `qrcode`/`@types/qrcode` (this arc's only new dependency):
**MIT**, permissive. Scanned the regenerated file for GPL/AGPL/unknown/
proprietary classifications: **0 matches** — no forced-copyleft or
unclassified dependency. `LICENSE_STATUS.md`'s own header claim was also
corrected (it hardcoded stale "not yet selected" boilerplate contradicting
the actual, already-decided MPL-2.0 state — fixed at the generator-script
source, not hand-edited into the generated file).

## Secret scan / privacy audit

Agent O's scan (this arc): ran the real secret-scanner
(`packages/fedos-desktop-electron-spike/scripts/scan_release_artifacts_for_secrets.mjs`),
independently grepped `git log --all`, `docs/`, `test/`, and
`src/os/trust/` for PEM headers / dotenv-style secret assignments /
known token formats. One PEM-pattern hit, confirmed to be a synthetic
fixture inside a unit test that asserts the scanner *detects* such
patterns (`test/secure_runtime_alpha_5241_5320_packaging.test.ts`), not a
real key. Test fixtures use only RFC-2606 reserved-domain placeholder
emails (`@relay.example`, `@example.social`) — no real PII anywhere.
**Result: PASS, 0 blockers.** Reconfirmed independently during this
document's own clean-checkout verification above (no real secret VALUE
in any tracked file).

## OSS release blockers vs. package extraction blockers

Per arc brief §66, kept strictly separate:

- **OSS release blockers introduced or left open by this arc: 0.**
- **Package extraction blockers**: unchanged from the starting state (3,
  carried forward from the Runtime Ownership Extraction arc's own final
  count) — this arc did not touch workspace/multi-package extraction at
  all, per its own explicit "do not start workspace extraction" instruction.
  `src/os/trust/` was added as a new single-repository capability
  following the exact same `src/os/<capability>/` convention as
  `os/core`/`os/messenger`/`os/commerce` — it introduces no new
  extraction blocker of its own (it has no dependency on Messenger,
  Commerce, Electron, or any Nostr SDK, verified by
  `test/architecture_boundary_trust.test.ts`).

## Worktree state

A dedicated worktree (branch `arc/fedos-trust-offline-monetization-oss-release`),
created fresh off `693cfdcc` at the start of this arc to avoid disturbing
the shared main working directory (found already checked out to an
unrelated branch with unrelated uncommitted work from a concurrent
session). **CLEAN** at CandidateHead `e6b2386a` — `git status --short`
returns 0 lines.
