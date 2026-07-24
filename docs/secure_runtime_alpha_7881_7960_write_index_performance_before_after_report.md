# Secure Runtime Alpha 7881–7960 — Phases F/G: Regression and Performance Before/After Report

## Phase F — Board and Conversation regression

Ran, unmodified, against the fixed `AppendOnlyFedosDeliveryObservationPersistence`:

- `test/secure_runtime_alpha_7641_7720_failure_matrix.test.ts` — 11/11 passed
- `test/secure_runtime_alpha_7641_7720_subject_index_rebuild_restart.test.ts` — 14/14 passed
- `test/secure_runtime_alpha_7641_7720_real_vertical_slice.test.ts` — 4/4 passed (real Board hydration entry point `hydrateFedosDeliveryRecoveryState()` + real Conversation `FedosDeliveryObservationQuery`/`FedosDeliveryRetryQuery` read path, over the same real durable file)
- `test/secure_runtime_alpha_7561_7640_real_vertical_slice.test.ts` — 1/1 passed (Outbox restart hydration)

Delivered/abandoned recovery, pending retry, Relay ACK distinction, recipient
import distinction, duplicate delivery protection, and revision/conflict
detection are all exercised by the above and all unchanged.

## New Persistence-layer tests (Phases D/E/G)

- `test/secure_runtime_alpha_7881_7960_write_index_persistence.test.ts` — 10/10
  passed (empty log, duplicate id, conflicting id, corrupt line, truncated
  tail, failed append, sequential same-instance append, stale second-instance,
  restart rebuild, duplicate retry after failure).
- `test/secure_runtime_alpha_7881_7960_write_index_performance_acceptance.test.ts` — 4/4 passed.

## Full repository regression sweep

`npx vitest run test/` — **860 passed / 273 failed files** (14,355 tests
passed / 365 failed), unchanged in character from the pre-existing,
previously-documented **worktree raw-import artifact** (see
`[[project_worktree_raw_import_artifact]]`, most recently sized at 292
files/386 tests by the Desktop Runtime Config Unification Arc). Confirmed,
not assumed:

- `git config --get core.autocrlf` → `true` in this worktree; a spot-checked
  failing file (`fedos_conversation_encryption_coordinator.ts`, a file this
  Arc never touches) is checked out with CRLF line endings, breaking a
  regex-based raw-source-text review test that expects `\n`. This is a
  worktree-checkout artifact, not a code regression.
- A second spot-checked failure
  (`test/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.test.ts`,
  an Alpha-076-era Rust/WASM `pub fn`/`#[wasm_bindgen]` count assertion, "23"
  vs. an expected "21") is the separately-documented Rust raw-import/pub-fn-count
  artifact, also unrelated to this Arc's own TypeScript-only change.
- Every failing file name related to "Observation" is `identity_bootstrap_observation`
  (an unrelated, much earlier Identity Bootstrap domain, Alpha 076–085) — NOT
  `fedos_delivery_observation`/Board/Outbox/Conversation. No failing test in
  the full sweep imports or exercises
  `append_only_fedos_delivery_observation_persistence.ts`.

## Before/after write-time numbers

| scenario                                            | before (O(T)/call) | after (warm instance) |
|------------------------------------------------------|---------------------|------------------------|
| single new-id write, T=100 prior                     | 1.7–1.8 ms          | first-ever call on an instance still pays one O(T) rebuild; every SUBSEQUENT call on that instance is O(1) average |
| single new-id write, T=10,000 prior                  | 18.0–19.8 ms        | second write on a warm T=100,000 instance: **0.45 ms** |
| duplicate/conflict lookup, T=10,000                  | 16.3–18.1 ms        | warm-instance duplicate/conflict lookup: **0.03–0.28 ms** |
| N=10,000 sequential appends on ONE instance, aggregate| not run (would be ≈O(N²), impractically slow — see design doc §Phase B) | **3.29 s**, ratio of cumulative(10000)/cumulative(1000) ≈ **9.8×** (linear, not the ≈100× an O(N²) curve would produce) |
| restart rebuild, T=10,000                             | 15.9–17.4 ms (this cost is NOT eliminated — see below) | 17.1 ms (unchanged, as expected) |
| restart rebuild, T=100,000                            | 195.7–214.5 ms      | 248.9 ms (unchanged, as expected — first call on a fresh instance) |

**Honest scope of the fix**: restart/rebuild remains O(T) — this Arc never
claims otherwise. What changes is that a single **already-running,
already-warm** instance no longer re-pays that O(T) cost on every
subsequent write/lookup; a normal append after startup is now O(1) average
instead of O(T). Repository-level subject reads (`d5979ae`'s own
`#bySubject` index) are untouched by this Arc and retain their existing
performance, confirmed by the unmodified 7641-7720 test suite passing
unchanged above.
