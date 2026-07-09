# FedOS Secure Runtime Alpha 004 — Runtime State Model Review

**Status: REVIEW ONLY. No code change of any kind — every Runtime,
Worker, Rust, Cargo, and package.json file is byte-for-byte
unchanged. This document reviews the state model `runtimeCapabilities()`
(Alpha 003, Stage 999) introduced, to confirm Alpha's growing surface
does not fracture into duplicated or conflated state before more is
built on top of it.**

## 0. Current Runtime state — inventory

| State | Shape | Kind | Owner |
|---|---|---|---|
| `initializeCrypto()` | `{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` | Fixed, pinned, sync | `create_runtime.ts` (Stage 691/697) |
| `runtimeCapabilities()` | `{ prototypeCompleted, rustReachable, rustVersion, runtimeState }` | Live, async | `fedos_runtime_prototype_execution.ts` (Stage 999) |
| `attemptDevOnlyRuntimeRustIntegration()` | `{ reachedRust, rustVersion }` | Live, async, standalone (not on `AppRuntime`) | `fedos_runtime_prototype_execution.ts` (Stage 994) |
| `FedosWasmLoader.status()` | `{ state, mode, policy, reason }` | Fixed, pinned, sync | `fedos_wasm_loader.ts` (Stage 489) |
| `FedosWasmLoader.planningState()` | `{ state, decision, loaded }` | Fixed, pinned, sync | `fedos_wasm_loader.ts` (Stage 809) |
| `FedosWasmLoader.policy()` | `{ allowed, decision, reason }` | Fixed, pinned, sync | `fedos_wasm_loader.ts` (Stage 817) |
| `FedosWasmLoader.planLoad()` | `{ operation, state, policy, reason }`, always `BlockedByPolicy` | Real evaluation, fixed answer, sync | `fedos_wasm_loader.ts` (Stage 489/793) |
| Seven `FedosWasmLoader*Plan` readers | each `{ created, should*, backend, reason, currentStage, nextRequiredCheck }` | Fixed, pinned | `fedos_wasm_loader.ts` (Stage 865–905) |
| `generatedArtifactCheckResult()`/`devOnlyGateEvaluation()`/`importReadiness()` | real evaluation results | Live, sync, cached on the instance | `fedos_wasm_loader.ts` (Stage 921/929/937) |
| `importExecution()`/`jsGlueModule()`/`wasmInitialization()`/`rustVersionExecution()` | real attempt results | Live, async, cached on the instance | `fedos_wasm_loader.ts` (Stage 945–993) |
| `runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` | diagnostics snapshot | Fixed, DISPLAY-only, sync | `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` |

Two independent environment classifiers exist today, both reading the
SAME `process.env.NODE_ENV`:

1. `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()` (Stage 929) — a GATE,
   returns `{ evaluated, developmentAllowed, reason: "DevelopmentRuntime"
   | "ProductionRuntime" | "UnknownRuntime" | "PrototypeStillClosed" }`.
2. `determineRuntimeState()` (Stage 999) — a LABEL, returns
   `"Prototype" | "Development" | "Production"`.

## 1. Does Runtime State duplicate — is Prototype/Development/Production handled consistently?

**Finding: the CONCEPT is duplicated across two independent
implementations; the RESULT is consistent today, but the vocabulary
is not, and this is worth fixing before more code depends on either.**

- Both classifiers read `NODE_ENV` independently and would always
  AGREE in real usage (the env var does not change mid-call in any
  real deployment) — this is NOT a correctness bug.
- The vocabularies differ: the Loader's gate has FOUR values
  (`DevelopmentRuntime`/`ProductionRuntime`/`UnknownRuntime`/
  `PrototypeStillClosed` — the last one meaning "never evaluated",
  not an environment); the Capability Reader's label has THREE
  (`Development`/`Production`/`Prototype` — collapsing "unset",
  `"test"`, and "unreadable" all into `"Prototype"`).
- **The word "Prototype" is now overloaded THREE separate ways in this
  codebase**, worth naming explicitly:
  1. The historical arc name (Stage 689–995, now COMPLETE per
     `docs/fedos_prototype_completion.md`).
  2. `RuntimeCapabilities.runtimeState: "Prototype"` (Stage 999) — an
     ENVIRONMENT FALLBACK label (unset/unknown `NODE_ENV`), unrelated
     to arc completion.
  3. `RuntimeInitializeCryptoReason: "PrototypeDisabled"` (Stage 691) —
     a DISABLEMENT reason, unrelated to environment.
  A reader encountering `runtimeState: "Prototype"` after the
  Prototype arc's own completion declaration could reasonably, but
  incorrectly, read it as "the Prototype is still running" rather
  than its actual meaning, "environment could not be determined."

**Recommendation**: this duplication and naming overload should be
resolved in a FUTURE Stage (see §6) — not by removing either
classifier (the Loader's gate MUST stay a real Fail-Closed decision
point; the Capability Reader's label MUST stay a light, non-gating
report), but by giving the Capability Reader's own fallback value a
name that does not collide with "the Prototype arc" (e.g.
`"Unknown"`, matching the Loader's own `"UnknownRuntime"` more
directly) and/or documenting the collision explicitly beside both
definitions so it cannot silently drift further.

## 2. Is `runtimeCapabilities()` taking on too much responsibility?

**Finding: NOT today. All four current fields are strictly about "how
far Runtime currently reaches into Rust" — none touch Secure Storage,
Worker, Network, or Backend Resolver state.** The risk is in the
NAME's generality, not its current content: `runtimeCapabilities()`
is broad enough to invite unrelated concerns being added to it over
time without a fresh review each time.

**Recommendation**: treat `runtimeCapabilities()`'s current scope —
"facts about REACHABILITY, never facts about ACTIVATION or
OPERATIONAL health" — as an explicit, enforced boundary, not an
implicit one. Any future field proposed for it should be checked
against that ONE sentence before being added (see §4 for a
field-by-field check against exactly this rule).

## 3. Is `initializeCrypto()`'s responsibility mixed with a Reader's?

**Finding: NO functional mixing — but a NAMING/BEHAVIOR mismatch worth
documenting now that a genuine Reader exists beside it for
comparison.**

- `initializeCrypto()` is named like an ACTION (imperative verb) but
  behaves like a pure READER today (always the same fixed value, no
  side effect) — this was always true, but the mismatch is more
  visible now that `runtimeCapabilities()` — genuinely reader-shaped,
  in both name and behavior — exists right beside it on the same
  `AppRuntime` object.
- Both functions are, in fact, side-effect-free today; the
  ACTION/READER split IS clean at the BEHAVIORAL level.
- `initializeCrypto()`'s own name is deliberate, historical intent
  (`docs/runtime_initialize_crypto_prototype.md`: "This adds the
  door. It does not open it.") — it is RESERVED for when a real
  action eventually happens behind it, and should not be renamed to
  look more reader-like now.

**Recommendation**: keep `initializeCrypto()`'s name as-is (renaming it
now would break a contract this whole arc has pinned since Stage
691), but make the naming/behavior gap an explicit, documented fact —
this document is that record — rather than an implicit one future
contributors have to rediscover.

## 4. Candidate future `RuntimeCapabilities` fields (NOT added this Phase)

Checked against §2's own rule ("reachability only, never activation or
operational health"):

| Candidate | Fit | Note |
|---|---|---|
| `backend: "WasmPlanned" \| "WasmActive" \| ...` | Good fit | Matches Alpha 002 §6's own recommendation to leave room for this; purely reachability/capability-shaped. |
| `secureStorageAvailable: boolean` | Reasonable fit, IF scoped narrowly | Must mean "is the PATHWAY to storage reachable," never "is a key currently stored" (that would be Storage's own, operational concern). |
| `workerConnected: boolean` | Premature | Worker connection design does not exist yet (every Alpha Phase so far has kept Worker fully unconnected); adding this field ahead of that design risks pre-committing to a shape before the connection itself is reviewed. |
| `cryptoReady: boolean` | Risky naming | "Ready" implies more than "reachable" — same category of risk Alpha 002 already flagged for `cryptoRuntime()`. If ever added, a more precise name (e.g. `wasmInitialized`) would avoid implying real cryptography is safe to use. |
| `productionReady: boolean` | **Reject as named** | This is a SAFETY judgment, not a reachability fact — exactly the kind of claim Alpha 001's own new principle ("no implicit environment trust for Production authorization") warns against baking into a passive reader. A "production readiness" concept, if ever needed, deserves its own, separately and heavily reviewed surface — never a boolean on this reader. |

## 5. Should `RuntimeState` become an independent type? Responsibility-split comparison

**Not implemented this Phase — comparison only.**

| Candidate | Own responsibility | Relationship to today's `RuntimeCapabilities` |
|---|---|---|
| `RuntimeCapabilities` (existing) | "What COULD Runtime reach" — mostly static/slow-changing potential | The current, single surface |
| `RuntimeState` | "What IS true RIGHT NOW" — e.g. current environment, current Loader phase | Would OVERLAP with the EXISTING `runtimeState` FIELD inside `RuntimeCapabilities` today — the exact SAME class of naming collision Alpha 002 already found once (the Facade's own `initializeCrypto()` vs `AppRuntime.initializeCrypto()`). This collision MUST be resolved (rename the field or the future type) before any such split, not after. |
| `RuntimeHealth` | "Is everything operating correctly" — liveness/error state | A different axis (health vs. capability); not yet meaningful — nothing long-running exists yet for anything to be "unhealthy." Premature. |
| `RuntimeDiagnostics` | Human/telemetry DISPLAY only, never behavior-affecting | Already exists (`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()`) — should stay explicitly separate from `RuntimeCapabilities`, which — unlike diagnostics — is meant to be programmatically read by real callers to make decisions. |

**Directional recommendation (not actioned)**: a future split along these
lines is reasonable — `RuntimeCapabilities` = structural/potential,
`RuntimeState` = live/current, `RuntimeDiagnostics` = display-only
(unchanged), `RuntimeHealth` = deferred until something exists that
can genuinely be unhealthy. Any Stage that performs this split MUST
resolve the `runtimeState`-field-vs-`RuntimeState`-type naming
collision §1/§5 both already flag, as its own, first step.

## 6. Alpha 005 — recommended priority, ranked

1. **Resolve the state-model naming/duplication issues this review
   found** (§1's `runtimeState`/"Prototype" overload, §5's
   field-vs-type collision) — hygiene before growth; every field
   added on top of the current ambiguity makes it more expensive to
   fix later.
2. **Add the `backend` field to `RuntimeCapabilities`** (§4) — but
   ONLY once the Backend Resolver has real content to report; adding
   it as a permanently-fixed `"WasmPlanned"` label today would add
   surface without adding information.
3. **Proceed to Crypto API Surface work** (Alpha 001 §3 item 3) — the
   actual value-add this whole state-model foundation exists to
   support; resuming Alpha 001's own original ranking now that the
   Public Runtime Surface (item 1) has a working first implementation
   and its own model has been reviewed for soundness.

Everything Worker/Storage/Production-related remains correctly
deferred, per every prior Alpha review.

## 7. What this Phase does NOT do

- Does **not** change any Runtime implementation code (`create_runtime.ts`,
  `fedos_runtime_prototype_execution.ts`, `fedos_wasm_loader.ts`,
  `types.ts`, or any other `src/runtime/` file).
- Does **not** change `runtimeCapabilities()`.
- Does **not** change `initializeCrypto()`.
- Does **not** change `FedosWasmLoader`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `src/worker.ts`.
- Does **not** change any Production code path.
- Does **not** add Secure Storage of any kind.
- Does **not** add any new Crypto API.
- Does **not** change any `FedosWasmLoader*Plan` interface.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_003_capability_reader.md` (Secure Runtime
  Alpha 003) — the `runtimeCapabilities()` implementation this review
  examines.
- `docs/secure_runtime_alpha_002_public_surface_review.md` (Secure
  Runtime Alpha 002) — named the `backend` field placeholder and the
  Fail-Closed rules this review's §2/§4 build on.
- `docs/secure_runtime_alpha_001_baseline.md` (Secure Runtime Alpha
  001) — the original seven-item priority ranking this review's §6
  resumes.
- `docs/fedos_prototype_completion.md` (Stage 996) — the completion
  declaration §1 notes is a THIRD, distinct meaning of "Prototype"
  from `runtimeState`'s own fallback label.
