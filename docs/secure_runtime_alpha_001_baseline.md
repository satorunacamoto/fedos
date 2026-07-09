# FedOS Secure Runtime Alpha 001 — Prototype Handoff & Alpha Baseline

**Status: BASELINE / REVIEW DOCUMENT. No new feature is implemented
this Phase. No code change of any kind — `src/runtime/`,
`src/worker.ts`, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
`package.json`, both diagnostics files
(`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`), and
Production code paths are all byte-for-byte unchanged. This document
opens the "Secure Runtime Alpha" arc that `docs/fedos_prototype_completion.md`
(Prototype EXECUTION Phase 015) named as the Prototype's successor,
and establishes the baseline Alpha work should build from.**

## 1. Prototype outcomes

### Achieved

- A real, generated `wasm-bindgen` boundary exists and compiles
  (`packages/fedos-core-rust`, `wasm-bindgen = "0.2.126"`, Stage 985).
- A real Rust function is JS-callable: `#[wasm_bindgen] pub fn
  version() -> String` (Stage 986), confirmed present in the generated
  glue's export list (Stage 987).
- A real, Fail-Closed, six-condition gate governs every step of the
  reach — Generated Artifact Check, Development Runtime, Import
  Ready, JS Glue Import, JS Glue Module retention, WASM
  Initialization — each independently real, each independently
  tested (Stage 921–969).
- Runtime-layer code genuinely calls that Rust function and receives
  its return value back — `attemptDevOnlyRuntimeRustIntegration()`
  (Stage 994), verified end-to-end against a real, freshly-built
  artifact: `{ reachedRust: true, rustVersion: "fedos-core-rust/0.0.0" }`.
- The public entry point (`AppRuntime.initializeCrypto()`) was never
  put at risk to achieve any of the above — its contract is
  byte-for-byte identical to the one Stage 691 first defined.

### Not achieved (by design, not by omission)

- No real cryptographic operation is reachable from JS —
  `encrypt`/`decrypt`/`deriveKey`/`randomBytes` all exist only as
  internal, `#[wasm_bindgen]`-free Rust code.
- No public Runtime API surfaces `rustVersion` or any other real Rust
  return value — Phase 014 reviewed this and explicitly deferred it.
- Worker was never connected to any part of this chain.
- Production was never connected to any part of this chain.
- No Secure Storage of any kind exists.
- NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion-like
  routing remain entirely unimplemented.

### What is deliberately retained as Fail Closed going into Alpha

- `AppRuntime.initializeCrypto()` still ALWAYS resolves `{ allowed:
  false, initialized: false, reason: "PrototypeDisabled" }`.
- `FedosWasmLoader.planLoad()` still ALWAYS resolves `BlockedByPolicy`.
- The Dual-Lock Activation Gate (`FEDOS_CRYPTO_PROVIDER` +
  `FEDOS_CRYPTO_ENABLED=explicit-dev-only`) still cannot reach
  `"Allowed"` — no real `FedosRuntimeCryptoProvider` exists to unlock
  even if both env vars were set.
- The real Rust reach (`attemptDevOnlyRuntimeRustIntegration()`) only
  ever activates in Development Runtime (`NODE_ENV === "development"`)
  — every one of its six upstream conditions Fails Closed outside it.
- Nothing calls the real reach automatically from any Runtime, Worker,
  or Production code path — it is opt-in, explicit-call-only.

## 2. Alpha baseline — current Runtime structure

```text
Application
    ↓
FedOS Runtime  (create_runtime.ts)
    ↓
AppRuntime.initializeCrypto()                     [PUBLIC API — pinned, Stage 691/697]
    ↓
Crypto Loader Facade        (fedos_crypto_loader_facade.ts)     [PLANNING-ONLY — fixed value]
    ↓
Crypto Loader Backend Abstraction (fedos_crypto_loader_backend.ts) [PLANNING-ONLY — fixed value]
    ↓
Crypto Backend Interface    (fedos_crypto_backend_interface.ts)  [PLANNING-ONLY — fixed value]
    ↓
  ┌─────────────────────────┬──────────────────────────┐
  ↓                         ↓
WASM Backend Planning    Backend Resolver              [PLANNING-ONLY — both terminate here]
(fedos_wasm_backend.ts)  (fedos_crypto_backend_resolver.ts)
  ↓
FedosWasmLoader.planLoad()                             [PLANNING-ONLY — always BlockedByPolicy, STOP]


  --- a SEPARATE entry point, not reached from the chain above ---

attemptDevOnlyRuntimeRustIntegration()                 [EXECUTION-ONLY — Stage 994, standalone,
(fedos_runtime_prototype_execution.ts)                  not wired into AppRuntime, opt-in call only]
    ↓
FedosWasmLoader (a FRESH instance)
    ↓
Generated JS Glue           (packages/fedos-core-rust/pkg/fedos_core_rust.js, never committed)  [EXECUTION-ONLY — real]
    ↓
WASM Initialization         (real initSync/default)                                             [EXECUTION-ONLY — real]
    ↓
Rust `#[wasm_bindgen] pub fn version()`                                                          [EXECUTION-ONLY — real]
    ↓
back to Runtime as RuntimePrototypeExecutionState
```

**This split is the single most important fact for Alpha to internalize:
the "official" chain (`initializeCrypto()` down to `planLoad()`) and
the real Rust reach are TWO SEPARATE PATHS today, not one.** They
share the `FedosWasmLoader` CLASS but never the same instance, and
`initializeCrypto()` never calls into the Execution-only path at all.
Any Alpha work that assumes `initializeCrypto()` already "does"
something real must first close this gap explicitly (see §3 item 1).

**Auxiliary, Planning-only components** (built for the Planning Chain,
never touch real state): the seven `FedosWasmLoader*Plan` interfaces
(`ImportPlan`, `WebAssemblyPlan`, `RustApiCallPlan`,
`JsGlueAccessPlan`, `GeneratedArtifactCheckPlan`, `DevOnlyGatePlan`,
`LoadPlan`); `FedosWasmLoaderContract`/`planningState()`/`policy()`.
All remain fixed-value readers, called by `planLoad()`, but never
altering its answer.

**Auxiliary, Execution-only components** (built for the Execution
Chain, real but Development-only): `FedosWasmLoaderImportExecution`,
`FedosWasmLoaderWasmInitialization`, `FedosWasmLoaderRustVersionExecution`,
and their three owning async methods
(`attemptDevOnlyJsGlueImport`/`attemptDevOnlyWasmInitialization`/
`attemptDevOnlyRustVersionCall`) plus `RuntimePrototypeExecutionState`.
None of these is called by `planLoad()`, `initializeCrypto()`, or any
Production/Worker code path.

## 3. Alpha priority items, ranked with reasoning

1. **Public Runtime Surface.** Decide — as its own, explicitly-reviewed
   Alpha Stage — HOW (if at all) `attemptDevOnlyRuntimeRustIntegration()`'s
   result becomes reachable outside `src/runtime/`. This must come
   first: it determines the shape every other item below builds
   against, it is the lowest-risk of the seven (Phase 014 already
   compared five concrete options), and every later item risks
   duplicating design work if decided ad hoc mid-implementation.
2. **Runtime State整理 (consolidation).** Before adding new real
   capability on top of the Prototype's scaffolding, resolve the
   overlap between the seven fixed-`false` Plan interfaces and the
   real state that has grown up beside them (§4). Doing this BEFORE
   new features avoids building yet more code on top of the
   soon-to-be-redundant layer.
3. **Crypto API Surface.** Once the surface question (item 1) and the
   scaffolding are settled, decide which ONE real cryptographic
   primitive gets its own `#[wasm_bindgen]` export first, following
   the exact `version()` precedent (Stage 986: one function, zero side
   effects, reviewed before called). This is Alpha's actual
   value-add; everything above exists to make this step safe.
4. **Secure Storage.** Only becomes meaningful once real key material
   can exist (after item 3) — designing storage for a capability that
   doesn't exist yet risks guessing wrong about what needs storing.
5. **Backend Resolver拡張.** The Resolver is currently a pure,
   always-`"WasmPlanned"` leaf; expanding it (e.g. genuine
   backend-selection logic) only matters once there is more than one
   real candidate to choose between — premature before item 3 proves
   out what WASM-backed crypto actually requires.
6. **Worker接続.** Only after Runtime-side real crypto is proven safe
   (items 1–5) does extending the SAME capability into a second
   execution context (Worker) become a bounded, well-understood
   change rather than a second, parallel unknown.
7. **Production接続.** Last and highest-stakes — requires everything
   above validated, and its own separate authorization mechanism (see
   §5's proposed new principle) beyond "flip `NODE_ENV`."

## 4. Prototype-derived technical debt — classified

**将来削除予定 (future removal candidates)**

- The overlap between the seven `FedosWasmLoader*Plan` interfaces'
  fixed-`false` fields and the real state that now sits beside them
  (e.g. `ImportPlan.shouldImport` vs. real `importReadiness().ready`)
  — candidates for consolidation once Alpha's real capability fully
  supersedes the need for a planning-only placeholder.
- The `"PrototypeStillClosed"` reason-enum value, and the
  `"Prototype"`-prefixed naming convention generally — likely renamed
  once "Prototype" is no longer the active arc name, though the
  underlying Fail-Closed BEHAVIOR each one guards should not change.
- The one-narrow-doc-per-Stage convention (dozens of single-Stage
  `docs/runtime_wasm_*.md`/`docs/fedos_core_rust_*.md` files) — valuable
  as a Prototype-era audit trail, a reasonable future consolidation
  candidate once the WASM/Rust boundary stabilizes.
- `attemptDevOnlyRuntimeRustIntegration()`'s own standalone,
  fresh-loader-per-call shape — likely superseded (not just deleted)
  once Alpha's Public Runtime Surface decision (§3 item 1) settles on
  a real, shared calling convention.

**Alphaでも維持 (keep during Alpha)**

- The six-condition Fail-Closed gate structure itself (it may gain
  MORE conditions as new capabilities are added, but the pattern —
  "read prior state, never re-evaluate, Fail Closed on any gap" —
  should persist).
- The `NODE_ENV === "development"` Dev-only gating discipline, until a
  dedicated, later Alpha Stage explicitly designs Production's own
  separate authorization path.
- The generated-artifact-never-committed convention
  (`target/`/`Cargo.lock`/`pkg/`).
- The two-tier "reachable internally" vs. "safe to expose publicly"
  review discipline.
- `initializeCrypto()`'s pinned contract, until Alpha's own Public
  Runtime Surface Stage (§3 item 1) explicitly revises it.

**Productionまで維持 (keep through Production)**

- Fail Closed as the DEFAULT posture for any new capability — never
  assume "ready" without an explicit, positive check.
- No secret/plaintext/ciphertext byte ever logged, diagnosed, or
  otherwise surfaced outside the boundary that legitimately needs it
  (already true of every diagnostics field added across the entire
  Prototype).
- The requirement that every NEW capability crossing a Fail-Closed
  boundary gets its own explicitly-reviewed Stage — this discipline
  itself is permanent, not Prototype-scoped.
- The requirement that Worker and Production connections are each
  their own, separately-authorized decision — never a side effect of
  a Runtime-only change.

## 5. Alpha design principles

**Continued from the Prototype, unchanged:**

- **1 Stage = 1 responsibility.** Every Stage in this arc added
  exactly one narrowly-scoped capability or performed exactly one
  review — never both, never more than one capability at a time.
- **Fail Closed.** Every new capability defaults to denied/absent
  until an explicit, positive condition proves otherwise; every error
  path resolves a named Fail-Closed reason, never throws past its own
  boundary.
- **Runtime/Worker separation.** Nothing built for Runtime is ever
  assumed safe for Worker without its own explicit review and its own
  Stage.
- **Don't casually change public contracts.** `initializeCrypto()`'s
  return shape has survived unchanged across thirty-five Stages
  specifically because every temptation to extend it was redirected
  into a NEW, separate, additive surface instead.
- **Design before implementation.** Every real capability in this arc
  was preceded by a review Stage (readiness reviews, pre-checks, or
  explicit option comparisons) before being implemented.

**Proposed new for Alpha:**

- **Real capability before public exposure, always as two separate
  Stages.** This was an emergent pattern in the Prototype (JS glue
  retention before WASM init; `version()` added before called; Runtime
  reach before public review); Alpha should adopt it as an EXPLICIT
  rule, not merely a repeated coincidence, given the stakes rise once
  real cryptography enters the picture.
- **No implicit environment trust for Production authorization.**
  `NODE_ENV === "development"` has been sufficient to gate every
  Prototype capability because nothing behind it was real
  cryptography. Before Production connection (§3 item 7), Alpha MUST
  design a separate, explicit authorization mechanism — a dev flag
  must never become a de facto production safety boundary.
- **Every Fail-Closed boundary crossing a language boundary (JS ↔
  Rust ↔ WASM) is verified against a REAL build before being declared
  done, not only against mocks.** Every Execution Chain Stage in the
  Prototype did this (Stage 945/969/985–987/993/994 each ran a real
  `cargo build`/`npm run build:wasm` and, where applicable, a real
  end-to-end call); Alpha should keep this as a hard verification
  requirement, not an optional nicety.

## 6. What this Phase does NOT do

- Does **not** change `src/runtime/` (including `create_runtime.ts`,
  `fedos_wasm_loader.ts`, `fedos_runtime_prototype_execution.ts`).
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** change any Production code path.
- Does **not** implement any of the seven priority items named in §3
  — all are recorded as a ranked plan, none is started this Phase.

## 7. See also

- `docs/fedos_prototype_completion.md` (Prototype EXECUTION Phase 015)
  — the completion declaration this Alpha Baseline picks up from.
- `docs/runtime_prototype_public_completion_surface_review.md`
  (Prototype EXECUTION Phase 014) — the five-option comparison §3 item
  1 (Public Runtime Surface) will need to resolve.
- `docs/runtime_prototype_execution_runtime_integration.md`
  (Prototype EXECUTION Phase 013) — the real Runtime → Rust → Runtime
  round trip §2's diagram documents.
- `docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
  EXECUTION Phase 008) — the `version()`-first, one-function-per-Stage
  precedent §3 item 3 (Crypto API Surface) should follow.
