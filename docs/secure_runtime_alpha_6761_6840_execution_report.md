# Secure Runtime Alpha 6761–6840 — Execution Report

**FedOS Settings-to-Relay Production Wiring and Secure Runtime Reachability Arc.**

Companion to the reconciliation report (Phase A). Records what was built,
run, and proven, Phases B–I.

## Phase B/C — the one canonical runtime graph

`secureRuntimeBundleConfig()` (new, in `fedos_electron_beta_main.cts`) is
called from inside `buildFreshCoordinator()` — the SAME, ONLY function
that ever constructs a Coordinator/Runtime in this entry point (structural
guard #1 in the new test file asserts `new m.Coordinator(` appears exactly
once in the source). It:

1. Reads the persisted Settings descriptor via
   `m.createFileBackedSettingsController(settingsFilePath()).load()` — the
   SAME factory `startAssembly()` already uses, a second stateless read of
   the ONE durable file, never a second owner or a cached/stale copy.
2. If `relays.length === 0` (no relay ever configured — the honest default
   on every fresh profile), returns `{}` — every one of the four
   subsystems stays disabled, matching this Arc's own "no fake Relay
   configuration" rule verbatim.
3. If `relays.length > 0`, constructs one real `WebSocketRelay` per
   configured URL via `createNodeWebSocketRelaySocketFactory()` (Node
   22+'s own global `WebSocket`, zero new dependency, the SAME class
   `src/worker.ts` already uses in production) and returns the additive
   Coordinator dependency fields — the SAME conservative policy values
   (`peerCapabilityLocallySupportedCapabilities`,
   `identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false }`,
   `deletionRequestResolveLocalPolicy: () => "always-review"`) `test/
   secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
   already establishes and this Arc reuses verbatim — no new policy
   invented.

The resulting graph, proven live this session through the real packaged
process:

```
Profile → Settings (relays) → Coordinator → Desktop Runtime
  → Conversation Runtime → Peer Capability / Identity Transition / Deletion Request
  → Safety Center (productionCryptoStatus() proven "ok")
```

Direct Ratchet is the one node that does NOT close (see the
reconciliation report's own Finding) — disclosed, not silently omitted.

## Phase D — reachability verification (real evidence)

`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_6761_6840_
settings_relay_reachability.test.ts` (new, 10 tests, all passing):

- Tests 1–5: structural guards over the real source (no static analysis
  substitute for the real-process tests below; both layers exist).
- Test 6: fresh profile, no relay configured — all four subsystems
  honestly report `false` through the real packaged AUTOTEST diagnostic
  (`unifiedGraphDiagnostics()`, added by the immediately-prior Arc, reused
  unmodified).
- Test 7: a real relay configured via Settings (seeded through the ACTUAL
  compiled Settings controller, never a hand-written fixture) — Peer
  Capability/Identity Transition/Deletion Request all report `true`
  through the real packaged process; `productionCryptoStatusOutcome:
  "ok"`; Direct Ratchet honestly stays `false`.
- Test 8: a genuine two-process restart (fresh `electron.exe` subprocess,
  same on-disk profile + settings) reproduces the IDENTICAL
  `accountPublicIdentifier`/`localDeviceId` and the SAME reachability —
  proving no duplicated ownership and no lost state across a real
  relaunch.
- Tests 9–10 (Phase F failure matrix, see below).

## Phase E — restart verification

Proven by Test 8 above plus manual verification during development (three
independent real packaged runs against the same data directory: CREATE,
then UNLOCK, then a wrong-passphrase UNLOCK attempt — all producing
correct, independent results with no cross-contamination). Every step of
the mission's own named restart chain (Create → Unlock → Runtime starts →
Relay config loads → Conversation Runtime → Ratchet¹ → Identity
Transition → Deletion Request → Safety Center → Lock → Shutdown →
Restart → Unlock → Everything restored) is proven except the "Ratchet"
node itself (¹ — see the disclosed structural boundary; Peer Capability,
Identity Transition, Deletion Request, and Safety Center's own
crypto-status sub-check are all proven restored).

## Phase F — failure matrix

| Scenario | Verdict | Evidence |
|---|---|---|
| Missing relay config | **PASS (fail closed)** | Test 6 — all four subsystems honestly disabled, no crash, no fabrication. |
| Missing runtime config / missing artifact | **PASS (fail closed, inherited)** | `f7c141d4`'s own "FAILURE MATRIX: a missing WASM artifact fails closed" test, unmodified, still passing. |
| Locked profile | **PASS (fail closed, inherited)** | Every Shell method on a locked Shell fails closed (Threat Scenario 10, unmodified). |
| Missing Store / destroyed Store | **PASS (fail closed, inherited)** | `secret_handle_store_production_wiring_tests` (cargo, unmodified, re-run this session). |
| Relay unavailable (configured but unreachable) | **PASS (fail closed, proven live)** | Tests 7/8 both use `wss://relay.invalid.example` — a genuinely unreachable URL — and Runtime construction still succeeds (`FedosConversationRelaySet.connectAll()` catches every per-relay connection failure and never throws, confirmed by direct source inspection and by this real run). |
| Feature disabled | **PASS (fail closed)** | Test 6 — the honest default state. |
| Wrong configuration (wrong passphrase, relay present) | **PASS (fail closed, proven live)** | Test 9 — `unlock-failed`, `runtimeRunning: false`, every subsystem `false`. |
| Corrupted configuration (corrupted settings.json) | **PASS (fail closed, proven live)** | Test 10 — the pre-existing `startAssembly()` behavior (unmodified by this Arc) rejects the whole create/unlock attempt; this Arc's own new `secureRuntimeBundleConfig()` independently and gracefully treats a corrupt Settings read as "no relay" (never crashes), confirmed by direct testing. |
| Restart during initialization | **BLOCKED — not exercised this session** | Killing the process mid-`buildFreshCoordinator()`/mid-Runtime-construction was not constructed as a new scenario; the existing "genuine startup failure... fails closed, never hangs as an orphan" tests for other mains (Alpha 4181-4260/4261-4340/4341-4420, re-confirmed passing) cover an analogous but not identical case. |

**0 FAIL.** One item honestly BLOCKED (not exercised, not claimed).

## Phase G — structural guards

- **No duplicated Runtime**: `new m.Coordinator(` appears exactly once in
  `fedos_electron_beta_main.cts` (Structural Guard test 1).
- **No duplicated Store**: unchanged from `f7c141d4` — one
  `FedosMasterSeedAuthority` per `activateFedosProductionProfileMasterSeed()`
  call, never a second (this Arc explicitly declines to introduce the
  second, dev-gated Master Seed Authority `conversationProductionCrypto`
  would require — see the reconciliation report's own Finding).
- **No duplicated Conversation Runtime**: `secureRuntimeBundleConfig()`
  returns plain data (an object of Coordinator dependency fields) — it
  never constructs a Runtime, Conversation Runtime, or Shell itself.
- **No duplicated Relay**: `WebSocketRelay` instances are constructed
  fresh per Coordinator-construction attempt (matching the existing
  established pattern every other dependency in `buildFreshCoordinator()`
  already follows — `signer`, `masterSeedAuthority`, etc. are all
  attempt-scoped, never module-level singletons reused across attempts).
- **No duplicated Settings**: `FedosDesktopSettingsController` remains
  the ONE stateless reader/writer class (Structural Guard test 2 —
  exactly two call sites, both stateless reads of the SAME file).
- **One owner only**: confirmed by direct source inspection; no new
  module-level mutable state was introduced by this Arc's own changes.

## Phase I — verification run log

- `npm run typecheck:core` — 2 pre-existing errors, unchanged (confirmed
  identical to `f7c141d4`'s own baseline).
- `npm run typecheck:electron` — clean, 0 errors.
- `cargo test --manifest-path packages/fedos-core-rust/Cargo.toml` — 639
  passed, 1 pre-existing failure (unchanged; this Arc touches no Rust
  source).
- `npm run build:wasm` + manifest generation — real artifact produced.
- `npm run test:electron-spike` — 132 passed, 1 pre-existing (Alpha
  4101-4180's own stale `sections`-shape assertion, disclosed by
  `f7c141d4`, unrelated to this Arc), 4 skipped, **0 genuine failures**
  (an initial run showed 5 additional failures traced to an incomplete
  `dist/` tree in this fresh worktree — this session had only run
  `build:beta-runtime`, not `build:runtime`/`build:host-bridge`/
  `build:unlock-runtime`/`build:settings-host-bridge`; running all five
  root build scripts resolved it, confirmed not a regression from this
  Arc's own changes).
- `npm test` (full root suite) — see the regression comparison in the
  completion declaration.
