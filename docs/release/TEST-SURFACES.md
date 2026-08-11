# Test Surfaces

FedOS's `test/` directory contains 1198 test files spanning the project's
entire development history, going back to its origin as a small Reddit-style
Nostr reader prototype. A fresh contributor who runs the documented default
test command should not be greeted by hundreds of failures and conclude the
repository is broken. This document explains the three-way split that
resolves that tension, and states honestly what is and is not green today.

## 1. CURRENT SUPPORTED TESTS — `npm run test:current`

This is the default "is this repo healthy" signal for a new contributor.

- **Config:** [`vitest.current.config.ts`](../../vitest.current.config.ts) —
  an explicit, hand-audited file list (not a broad glob), wired as
  `npm run test:current` in `package.json`.
- **Result as of this arc:** **132 test files / 1902 tests — 100% passing,
  0 failures.** Verified with a real `npm run test:current` run at this
  arc's HEAD.

### Selection logic

A file is on the current supported surface if it satisfies at least one of:

1. **`test/architecture_*.test.ts`** (13 files) — structural boundary and
   cycle-detector guards (import-graph cycle detection, package-extraction
   boundary scanning, compatibility-shim auditing, commerce/messenger/core/
   trust boundary enforcement). These are load-bearing for any contributor
   who touches the package graph, and they describe the repo's *current*
   architecture, not a historical snapshot of it.

2. **`test/trust_*.test.ts`** (10 files) — the Trust capability's own
   current suite (envelope foundation, possession, pseudonymous credential,
   signed QR, subscription entitlement/signing, issuer CLI, contract
   artifact proof, factory composition, capabilities).

3. **Every other file whose import graph touches at least one *current*
   source package** — `src/os/commerce/`, `src/os/messenger/`,
   `src/os/core/`, `src/os/trust/`, `packages/fedos-core-rust/` (the real
   Rust crypto engine, exercised via direct source-text assertions in many
   `fedos_core_rust_*` tests), or a non-`_legacy_prototype` top-level
   `src/*` module (e.g. `src/runtime/`, `src/notification/`) — **and is not
   scoped exclusively to `src/os/_legacy_prototype/`** (109 files, e.g.
   `commerce_bridge.test.ts`, `worker_crypto_boundary.test.ts`,
   `fedos_core_rust_skeleton.test.ts`, `identity_device_suite.test.ts`).

   `src/os/_legacy_prototype/` is this repo's own name for the code that
   does not ship: the project's original ~145-file Reddit-style Nostr
   reader prototype, superseded by the `src/os/{commerce,messenger,core,
   trust}` package tree that `tsconfig.runtime.json` actually compiles and
   ships (10 entry files under `src/os/messenger/`, all that
   `npm run build:runtime` touches). A test file whose entire import
   surface resolves into `src/os/_legacy_prototype/` (and/or
   `packages/meshkv/`, verified to be consumed *only* by
   `_legacy_prototype/asset/*` — never by `src/os/messenger/sync/`, which
   has its own independent `fedos_sync_*` implementation) is testing code
   that a contributor will never hit through the shipped app, so it is
   excluded from the default green path — not because it's failing, but
   because it's out of scope for "is the current product healthy."

   Many included files *also* import `src/os/_legacy_prototype/` types
   (e.g. to build a legacy fixture object that's then fed into a current
   `os/commerce` bridge/classify function under test) — that's fine and
   expected; the compatibility-facade pattern between the legacy prototype
   and the current package tree is itself current, documented behavior
   (see `docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md`). The
   exclusion is specifically for files with **zero** contact with any
   current package.

### Explicit exclusions (by design)

- **`test/reviews/**`** — point-in-time audit snapshots (see §2).
- **`test/secure_runtime_alpha_*.test.ts` / `test/runtime_*.test.ts`** —
  these self-identify, in their own `describe()`/`it()` text, as numbered
  "Stage N" historical regression checkpoints (see §2). No file matching
  either pattern was found to have a specific current-behavior reason to
  override the exclusion this arc.
- Any file, from any of the categories above, that self-identifies via its
  own test text as a "review only / no code change" historical checkpoint
  (checked with a targeted grep across every candidate file before
  inclusion — none of the 132 selected files matched this pattern; a
  handful of candidates do carry incidental "Stage N" provenance comments,
  which is a pervasive repo-wide labeling convention and not itself a
  historical-checkpoint signal — see the file header comment in
  `vitest.current.config.ts` for the exact check performed).
- Any file that is not, right now, in the passing set of a real `npm test`
  run — cross-checked file-by-file, zero exceptions. If the principled
  filter above would have picked a file that's currently failing, that
  would be reported as a genuine current failure (see §3), not silently
  dropped. As it happens, this did not occur this arc: the filter's 132
  files were all already in the passing set.

## 2. HISTORICAL REGRESSION TESTS — `npm test`

`npm test` (`vitest run`, using `vitest.config.ts`'s
`include: ["test/**/*.test.ts"]`) runs the full 1198-file suite and remains
fully runnable. It is **not** removed, disabled, or hidden — it is simply
not the default "is this repo healthy" signal for a new contributor.

What it is: a chronological archive of every prior development arc's own
regression guards, most visibly the `test/secure_runtime_alpha_NNN_*.test.ts`
family (the single largest slice of the suite) and `test/runtime_*.test.ts`.
These were written, arc by arc, as literal "Stage N" checkpoints — their own
`describe()`/`it()` titles say things like *"Stage 202-208 adds the
Authentication row"* or *"no serialization change: no serde derive on
ConversationKey/MessageKey"* — snapshotting an exact structural fact about
the codebase (an exact `pub fn` count in a Rust module, an exact file count
under `src/runtime/` or `src/identity/`, an exact enum variant count) at the
moment that arc completed. `test/reviews/**` is the same idea in a different
shape: point-in-time audit/consistency snapshots for a specific past
decision review.

These are valuable as a historical audit trail and as regression guards
*for the specific fact they assert*, but they are not "does the current
product work" tests, and their own hardcoded exact-count assertions are
expected to go stale as the codebase legitimately grows (see §3). Nothing in
this arc rewrites or fixes them.

## 3. KNOWN LEGACY FAILURES

As of this arc (verified via a real `npm test` run at HEAD `a980a230`):

> **227 failed files / 942 passed files / 29 skipped** out of 1198 test
> files.
> **453 failed tests / 14623 passed tests / 80 skipped** out of 15156 tests.

This is the real, current number — it is not lower than this, and this arc
does not promise to reduce it. Fixing these is explicitly out of scope here
(see the arc brief: "Do not rewrite hundreds of historical tests just for
aesthetics").

### Root cause class

An arc-over-arc diff (performed by the preceding "Trust / Offline
Monetization" arc) established that **0 of these 227 failures are new
functional regressions**. Virtually all of them share one root cause class:
**stale hardcoded exact-count snapshots that age out as the codebase
legitimately grows.** Concretely, this includes tests that assert things
like:

- an exact `pub fn` count in a `packages/fedos-core-rust` module (adding a
  legitimate new public function anywhere in that module trips every test
  that hardcodes the old count),
- an exact file count under `src/runtime/` or `src/identity/` (adding or
  moving a single file trips it),
- other "byte-for-byte unchanged since Stage N" structural assertions that
  were accurate the day they were written and are not maintained as the
  codebase's own arcs move it forward.

This is a known, previously-documented pattern in this repository — see
`BUILDING.md`'s own references to the "RIPPLE" convention (a change in one
place is expected to "ripple" into stale downstream exact-count guards, and
updating every rippled guard on every arc has never been this project's
practice). It is a test-suite maintenance debt, not a product defect.

### What this arc does and does not claim

- It **does** establish `npm run test:current` as a genuinely, currently
  green 132-file / 1902-test subset a new contributor can trust today.
- It **does not** touch any of the 227 failing files' content, and it does
  not reduce the 227/453 counts. Those numbers belong to the "Historical
  Regression Tests" surface (§2), which remains available for anyone doing
  historical-guard archaeology, but is explicitly not the onboarding
  signal.
- If a future arc wants to reduce the 227, the honest path is arc-by-arc
  triage of each stale snapshot, not a blanket rewrite — see the arc brief
  for why that's out of scope here.
