# Secure Runtime Alpha 7001–7080 — Execution Specification

**FedOS Desktop Beta Final Runtime Validation and End-to-End Messaging
Acceptance Arc.** Records what was actually implemented and verified,
against the design recorded in the reconciliation report (Phase A) and
topology/ownership document (Phase B).

## Files changed (production, narrow, both real bug fixes/gaps closed)

1. `src/desktop/runtime/fedos_desktop_runtime_config.ts` — one new
   optional field, `directRatchetMessageDeliveryRemoteDeviceRef`. Omitted
   by default; zero behavior change for every existing caller.
2. `src/desktop/runtime/fedos_desktop_runtime.ts` — mirrors the EXISTING
   `directMessageDelivery.sendMailboxNip17` auto-wiring
   (Alpha 1841-1920) for the previously-unwired sibling
   `conversationDirectRatchetDeps.messageDelivery` field, gated on the
   same new optional config field. Closes the real bug the reconciliation
   report names: the packaged app's own real `sendMessage()` always used
   the legacy static NIP-17 route, never Direct Ratchet, even when a
   Ratchet session existed.
3. `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts` —
   one new optional pass-through field/dependency, mirroring
   `directRatchetEnabled`'s own existing pass-through discipline exactly.
4. `src/desktop/shell/fedos_desktop_application_shell.ts` — two new,
   narrow, additive wrapper methods: `activateDirectConversation()`
   (wraps the already-real `FedosConversationRuntime.activateDirectConversation()`)
   and `establishDirectRatchetSession()` (wraps the already-real
   `FedosDirectRatchetConversationRuntime.initializeDirectRatchetSession()`).
   Neither adds new business logic.
5. `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`
   — Phase C: the closed `fedos-acceptance:*` IPC command vocabulary (11
   commands), every one delegating entirely to an already-real Shell
   method, gated by `requireShell()` (rejects with `{outcome:
   "unavailable"}` unless `AUTOTEST_MODE` is set — proven by structural
   guard test 3). Also adds the `AUTOTEST_MODE === "acceptance"` scripted
   multi-step command runner (Phase G/H/J/K's own execution mechanism —
   no precedent existed anywhere in this repository for driving a live
   Electron subprocess through more than one sequential command from an
   external Node test driver; this mode reads an ordered JSON script and
   dispatches each step to the SAME internal handler function
   `registerIpcHandlers()` already uses, logging one JSON result line per
   step).
6. `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts`
   and `fedos_electron_beta_window.d.ts` — expose the 11 new commands as
   `window.fedosAcceptance.*`, with the same bounded-string validation
   discipline the existing `fedosProfile`/`fedosBeta` bridges already use.

## Files added (test/acceptance-fixture only, never under `src/`)

- `test/support/fedos_real_local_websocket_relay_server.ts` — a real,
  minimal, RFC 6455-compliant WebSocket server (genuine TCP accept,
  genuine HTTP Upgrade handshake, genuine frame parsing/writing), plus
  real NIP-01 `REQ`/`EVENT`/`CLOSE`/`OK`/`EOSE` framing matching what
  `src/desktop/websocket_relay.ts` (the real, unmodified production
  client) already produces/expects. Built on `node:http`+`node:crypto`
  only (no `Buffer`, no `@types/node` dependency — `Uint8Array`/`DataView`/
  `TextEncoder`/`TextDecoder` throughout, matching this repository's own
  established no-`@types/node` test convention). Smoke-tested in isolation
  against Node's own real global `WebSocket` client
  (`test/secure_runtime_alpha_7001_7080_relay_server_smoke.test.ts`,
  1/1 passing): real handshake, REQ→EOSE, EVENT→OK+delivery,
  `redeliverLast()` (duplicate-delivery proof), CLOSE→no-further-delivery.
- `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts` — 11
  tests, all passing, proving the above by direct source inspection.

## Test files corrected (narrow, historically-stale claim, not weakened)

- `test/secure_runtime_alpha_6841_6920_structural_guards.test.ts` test 8
  — that Arc's own "byte-for-byte unchanged" claim about
  `fedos_electron_beta_main.cts` was pinned to an open-ended "vs. current
  working tree forever" comparison rather than that Arc's own two real
  endpoints (`f3e0658..4c1f27c`). Since THIS Arc legitimately, narrowly
  extends that same file (an explicit precedent already established by
  the immediately-prior Arc's own 6921-7000 additions elsewhere), the
  comparison is re-pinned to Alpha 6841-6920's own actual boundary — the
  guard still proves exactly what it always claimed (that Arc itself
  didn't touch the file), just no longer misfires for every unrelated
  future Arc that legitimately touches it.

## Environment work (this session, not a source change)

- Verified and wired a real Electron `v43.1.1` binary and a real,
  isolated (non-shared, copied rather than junctioned) `@types/node`
  package into this fresh worktree — neither was present by default.
  **Observed and disclosed environment instability**: the shared,
  concurrently-used `node_modules` target this repository's own
  established multi-worktree convention relies on is mutable — a
  concurrent session's own `npm install` completing mid-session caused
  `@types/node` to transiently become resolvable repo-wide, producing
  ~15 spurious "Unused `@ts-expect-error` directive" errors across
  unrelated, pre-existing files during one `npm run typecheck:core` run.
  Confirmed transient and unrelated to this Arc's own source correctness
  by isolating this Arc's own `@types/node` resolution to a private copy.
- Built `packages/fedos-core-rust/pkg/` fresh (`npm run build:wasm` +
  `npm run build:wasm:manifest`, bypassing `build:production-wasm`'s own
  `cargo test` gate, which hits the same pre-existing, unrelated
  `secp256k1_dependency_guard` dependency-count failure the immediately-
  prior Arc already documented — reconfirmed present, reconfirmed
  unrelated, zero Rust file touched this session).

## What was NOT completed — see the completion declaration for the full,
honest accounting

The real two-party (packaged-Electron-Alice + real-production-Node-Bob)
end-to-end message round trip, lock/restart/restore continuation, crash
recovery, and full failure-matrix/RC-matrix sweep were not built and
proven to completion in this session. The reconciliation work above
surfaced a genuine, load-bearing, previously-undocumented constraint: a
real Direct Conversation between two INDEPENDENTLY-provisioned real
profiles (separate Draft/Membership persistence, no shared backend)
requires either (a) `FedosDesktopApplicationShell.redeemInvitation()` —
confirmed, by direct source read, to be unconditionally `"unavailable"`
on this codebase's own current base, a pre-existing, disclosed limitation
this Arc did not create and is not in scope to close — or (b) test-side
construction of matching Draft/Membership durable records on the second
party's own persistence (the SAME category of technique this
repository's own most rigorous prior 2-party test,
`secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`, already
uses for Device Trust via `seedTrustedDevicePair()`, but not yet attempted
for Conversation/Membership specifically). Neither path was completed and
verified within this session.
