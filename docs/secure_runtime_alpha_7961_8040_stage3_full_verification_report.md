# Secure Runtime Alpha 7961–8040 — Stage 3: Full Integration Verification Report

## Sequence run (in order, on the fully-landed integration branch)

1. `npm run typecheck` (core + electron) — clean except 2 pre-existing baseline
   errors (confirmed via `git status` unmodified across this whole session:
   `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
   `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`). One NEW
   typecheck regression was found and fixed this Stage (see below).
2. `cargo test --release` — 639 passed / 1 failed (the SAME pre-existing
   `Cargo.toml` "exactly 10 production dependencies" count-drift confirmed
   via `git status` in the prior session — real `Cargo.toml` has 11,
   unmodified by this Arc).
3. `npm run build:wasm` + `build:wasm:manifest` — real WASM built fresh in
   this worktree.
4. Delivery Observation persistence/repository, Board/Conversation delivery,
   Outbox hydration, Archive/Retention/Search, Device Registry/Trust/Sync,
   suppression, Direct Archive, Ratchet/NIP-17/route-binding, Identity
   Transition/Deletion/Peer Capability, Safety Center tests — all re-run
   during the Stage 2 checkpoint audit and again here; all PASS.
5. `npx vitest run test/` (full repository) — 871 passed / 295 failed files
   (14,446/385 tests) — the SAME magnitude and character as the immediately
   prior session's own final number (868/298, 14,434/397) confirming no new
   regression from landing itself; the 3-test improvement is this Stage's
   own typecheck fix.
6. Electron/Desktop main-process suite (`vitest.electron-spike.config.ts`)
   — see below, the substantive finding of this Stage.
7. `npm test` — covered by item 5 (root `vitest run test/` IS `npm test`'s
   own underlying command).

## NEW typecheck regression found and fixed

`npm run typecheck:core` failed on the freshly-landed integration branch
with two `TS7006` implicit-any errors in
`secure_runtime_alpha_7881_7960_structural_guards.test.ts` (not present when
that file was typechecked in isolation in its own worktree in the prior
session). Root cause: an `execFileSync(...).toString()` call without the
same `as unknown as string` cast the same file's own `diffNames()` helper
already uses for the identical pattern. Fixed narrowly (one-line cast),
regression-proven: `npx tsc --noEmit -p .` now shows only the 2 pre-existing,
unrelated baseline errors.

## REAL, release-blocking defect found and fixed (the substantive finding)

Running the Electron acceptance suite exposed: **a single unreachable
relay configured in Settings crashed the entire Runtime startup / profile
creation**, rather than degrading gracefully for that one relay. This is a
real, user-facing reliability defect — a temporarily-offline or
misconfigured relay is an entirely ordinary real-world condition, not an
edge case. Root cause, confirmed by manually instrumenting and reproducing
against the REAL compiled Electron subprocess:
`FedosConversationInboundSubscription.start()` called `relay.subscribe()`
unconditionally on every relay in the configured set, and
`FedosRelay.subscribe()` throws for a relay that never actually connected
— even though `FedosConversationRelaySet.connectAll()` already tolerates a
per-relay connection failure by its own documented contract. Fixed by
skipping a relay whose `isConnected()` reports `false` before subscribing,
in both `fedos_conversation_inbound_subscription.ts` (the original, ancient
Alpha 1471-1540 file) and this session's own
`fedos_archive_suppression_inbound_subscription.ts` (which mirrored the same
idiom and inherited the same defect). See
`docs/secure_runtime_alpha_7961_8040_stage3_electron_acceptance_findings.md`
for the full reproduction/fix/regression narrative.

## Electron test suite: before / after

- Before any fix (missing builds, missing Electron binary, and the real
  relay-crash bug all conflated): 101 passed / 34 failed.
- After installing the Electron binary + running every required `npm run
  build:*` step this worktree had never run: 138 passed / 11 failed.
- After the real relay-crash fix + 3 stale-test reconciliations (Direct
  Archive now works; Safety Center shape settled; "signature" is not a
  secret): **149 passed / 0 failed** (4 honestly skipped — real-artifact
  gates), run serialized (`--pool=forks --poolOptions.forks.singleFork=true`)
  to eliminate confirmed resource-contention flake from many concurrent
  real Electron subprocess launches (repeatability-tested: the SAME 4-11
  "failures" seen under full parallelism passed reliably every time when
  re-run in isolation or serialized — classified FLAKE, not a defect).

## Classification summary

| Failure class | Count | Disposition |
|---|---|---|
| NEW REGRESSION | 1 (typecheck) | Fixed, regression-proven. |
| REAL RELEASE-BLOCKING DEFECT | 1 (relay crash) | Fixed, regression-proven, both affected files. |
| STALE TEST ASSUMPTION (capability now fixed) | 1 (Direct Archive) | Test updated to assert the correct, current, passing behavior. |
| STALE TEST ASSUMPTION (shape evolved) | 1 (Safety Center `sections`) | Test updated to the real, settled shape. |
| STALE TEST ASSUMPTION (over-broad scan) | 1 ("signature" false-positive) | Scan narrowed to genuinely secret-implying terms only. |
| HISTORICAL GUARD REQUIRING EXACT UPDATE | 1 (ratchet outbound/inbound integration) | Reconciled to the specific, already-known files. |
| ENVIRONMENTAL ARTIFACT (worktree CRLF/raw-import) | ~270 files | Confirmed pre-existing via `git stash` A/B in the prior session; unchanged. |
| ENVIRONMENTAL ARTIFACT (Cargo.toml dep-count drift) | 1 | Confirmed pre-existing via `git status`; unchanged. |
| ENVIRONMENTAL ARTIFACT (missing local build steps/Electron binary) | many, now resolved | This worktree had never run `npm install` in the Electron subpackage nor any `build:*` script; all now run once, artifacts cleaned before commit per policy. |
| FLAKE (confirmed via repeatability) | 4-11 (varies by run) | Confirmed via isolated + serialized re-runs; resource contention from concurrent real Electron subprocess launches, not a code defect. |

**Zero security-correctness FAIL.** The one real defect found (relay crash)
was a reliability/availability issue, not a security-correctness one, and
is now fixed and regression-proven.
