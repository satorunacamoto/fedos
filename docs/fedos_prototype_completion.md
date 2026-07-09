# FedOS Prototype — Completion Declaration (Prototype EXECUTION Phase 015)

**Status: DECLARATION, not an implementation. No code change of any
kind — `src/runtime/`, `src/worker.ts`,
`packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, `package.json`,
Production code paths, and both diagnostics files
(`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`) are
all byte-for-byte unchanged. This document formally declares the
FedOS Prototype arc COMPLETE, per Phase 014's own review
(`docs/runtime_prototype_public_completion_surface_review.md`), and
records everything a future "Secure Runtime Alpha" arc needs to know
before building on top of it.**

## 1. Prototype's original purpose

The Prototype existed to answer ONE question safely: **can Runtime
reach the Rust core through a real, generated `wasm-bindgen` boundary,
and can the answer come back — without ever allowing that reach to
imply real cryptography is active?** Every one of its thirty-five
Stages (689 through 995) served that single question, split into two
disciplined sub-arcs:

- A **Planning Chain** (Prototype Phase 001–021, Stage 689–913) that
  built the ENTIRE call graph — Facade, Backend Abstraction, Backend
  Interface, Backend Resolver, WASM Backend Planning, the WASM Loader
  itself, and seven internal "Plan" objects — as fixed-value,
  discarded-result, `PlanningOnly` code. Nothing in this chain ever
  read a file, imported a module, or touched WebAssembly.
- An **Execution Chain** (Prototype EXECUTION Phase 001–014, Stage
  921–995) that, ONE narrowly-scoped capability at a time, turned
  specific links of that same graph real — a real file-existence
  check, a real environment read, a real `import()`, a real WASM
  `initSync`, a real `#[wasm_bindgen]` Rust function, a real call to
  it, and finally a real round trip from Runtime-layer code back to
  Runtime-layer code — while the PUBLIC entry point,
  `AppRuntime.initializeCrypto()`, was pinned unchanged throughout.

The stated Prototype termination condition, set at the start of the
Execution Chain and reviewed in Phase 014: **"Runtime reaches the Rust
minimal API, and its return value reaches back to Runtime."** Nothing
more was ever in scope — no cryptography, no key handling, no
Worker/Production connection.

## 2. Final reached chain

Two chains exist in the codebase today, and they are DIFFERENT paths —
this distinction matters and is preserved deliberately, not an
oversight.

**(a) The PlanningOnly chain — real up to `FedosWasmLoader.planLoad()`,
then stops by policy, exactly as it always has:**

```text
Runtime
    ↓
AppRuntime.initializeCrypto()          (create_runtime.ts, Stage 691/697)
    ↓
Crypto Loader Facade                   (fedos_crypto_loader_facade.ts, Stage 594)
    ↓
Crypto Loader Backend Abstraction      (fedos_crypto_loader_backend.ts, Stage 714)
    ↓
Crypto Backend Interface               (fedos_crypto_backend_interface.ts, Stage 746)
    ↓
{ WASM Backend Planning, Backend Resolver }   (fedos_wasm_backend.ts / fedos_crypto_backend_resolver.ts, Stage 730/763)
    ↓
FedosWasmLoader.planLoad()             (fedos_wasm_loader.ts, Stage 793)
    ↓
BlockedByPolicy — STOP (unchanged since Stage 793; `initializeCrypto()`
                          always resolves { allowed: false, initialized: false,
                          reason: "PrototypeDisabled" })
```

**(b) The Execution reach chain — genuinely real, genuinely round-trips
to Rust and back, entered from a SEPARATE, standalone function (not
through `initializeCrypto()`):**

```text
Runtime (attemptDevOnlyRuntimeRustIntegration(), fedos_runtime_prototype_execution.ts, Stage 994)
    ↓
FedosWasmLoader.planLoad()                        (sync, fresh instance)
    ↓
FedosWasmLoader.attemptDevOnlyJsGlueImport()       (real import(), Stage 945/961)
    ↓
FedosWasmLoader.attemptDevOnlyWasmInitialization() (real initSync/default, Stage 969)
    ↓
FedosWasmLoader.attemptDevOnlyRustVersionCall()    (real module.version(), Stage 993)
    ↓
Rust #[wasm_bindgen] pub fn version() -> String    (packages/fedos-core-rust/src/lib.rs, Stage 986)
    ↓
back to Runtime as RuntimePrototypeExecutionState  ({ reachedRust: true, rustVersion: "fedos-core-rust/0.0.0" })
```

Chain (b) was verified against a REAL, freshly-built artifact during
Phase 013's own implementation — not a mock. Chain (a) is the ONLY
path any caller of `createRuntime()` actually exercises today; chain
(b) exists, is real, and is Fail-Closed end-to-end, but is reached
from NOWHERE that Runtime, Worker, or Production code calls
automatically — see §5.

## 3. Planning Chain — Prototype Phase 001–021 (Stage 689–913)

| Phase | Stage | Role |
|---|---|---|
| 001 | 689–696 | `AppRuntime.initializeCrypto()` added — first callable Runtime API, fixed `{ allowed: false, initialized: false, reason: "PrototypeDisabled" }`. |
| 002 | 697–712 | Reaches the Crypto Loader Facade (`fedos_crypto_loader_facade.ts`); result discarded. |
| 003 | 713–728 | Adds the Crypto Loader Backend Abstraction (`fedos_crypto_loader_backend.ts`). |
| 004 | 729–744 | Adds WASM Backend Planning, a fixed backend candidate (`fedos_wasm_backend.ts`). |
| 005 | 745–760 | Adds the backend-agnostic Crypto Backend Interface (`fedos_crypto_backend_interface.ts`). |
| 006 | 762–776 | Adds the Crypto Backend Resolver, a pure "which backend is planned" leaf (`fedos_crypto_backend_resolver.ts`). |
| *(numbering gap — no "Phase 007" entry exists in the changelog; Stage 777–792 carries no separate Phase label)* |
| 008 | 793–808 | WASM Backend Planning reaches the REAL `FedosWasmLoader.planLoad()` for the first time; a pre-existing call-graph cycle was discovered and fixed in the same Stage. |
| 009–010 | 809–817 | `FedosWasmLoader` gains independent `planningState()` and `policy()` readers, neither calling `planLoad()`. |
| 011 | 825–840 | `planLoad()` reaches `policy()` — a read, result discarded, still `BlockedByPolicy`. |
| 012 | 833–848 | `planLoad()` genuinely branches on `policy()`'s answer via a real `if` — still resolves `BlockedByPolicy` either way. |
| 013 | 841–856 | `planLoad()` builds an internal Load Plan object. |
| 014 | 857 | WASM Loader Activation Readiness Review (review-only checkpoint). |
| 015 | 865 | Builds the JS Glue Access Plan. |
| 016 | 873 | Builds the Generated Artifact Check Plan. |
| 017 | 881 | Builds the Dev-only Gate Plan. |
| 018 | 889 | Builds the Import Plan. |
| 019 | 897 | Builds the WebAssembly Plan. |
| 020 | 905 | Builds the Rust API Call Plan — the eight-part internal Planning Chain is complete. |
| 021 | 913 | WASM Loader Execution Readiness Review — names the first real Execution candidate, closing the Planning Chain. |

Every Phase above ends with `planLoad()` still resolving
`BlockedByPolicy`, and `initializeCrypto()` still resolving
`PrototypeDisabled` — none of them ever executed anything.

## 4. Execution Chain — Prototype EXECUTION Phase 001–014 (Stage 921–995)

| Phase | Stage | Role |
|---|---|---|
| 001 | 921 | First REAL action: a read-only `existsSync` check for the two generated artifact files. |
| 002 | 929 | Real Development Runtime evaluation (`NODE_ENV`). |
| 003 | 937 | Real Import Readiness evaluation, combining the two prior results. |
| 004 | 945 | First real, gated `import()` of the generated JS Glue (`attemptDevOnlyJsGlueImport()`), as a NEW async method — `planLoad()` itself untouched. |
| 005 | 953 | Review-only: confirms `planLoad()` stays synchronous, recommends separating import from WASM init (Option B). |
| 006 | 961 | Retains the imported JS Glue module on success — opaque, never inspected or executed. |
| 007 | 969 | First real, gated WASM initialization (`attemptDevOnlyWasmInitialization()`) via whichever of `initSync`/`default` the module exposes. |
| 008 | 977 | Rust Export Readiness Review — inventories 27 `pub fn`, 0 `#[wasm_bindgen]`, recommends a new, minimal `version()` candidate. |
| 009 | 985 | Adds `wasm-bindgen = "0.2.126"` as a direct `Cargo.toml` dependency — the only way `#[wasm_bindgen]` becomes usable. |
| 010 | 986 | Adds `#[wasm_bindgen] pub fn version() -> String` — the crate's 28th `pub fn`, its first `#[wasm_bindgen]`-annotated function. |
| 011 | 987 | One-time real `npm run build:wasm` run confirms the generated glue exports exactly `version`/`initSync`/`default`. |
| 012 | 993 | First real Rust API call (`attemptDevOnlyRustVersionCall()`) through the retained module, gated on six prior conditions, `string`-only success. |
| 013 | 994 | **Runtime Integration**: a new, standalone file connects Runtime-layer code to `FedosWasmLoader` for the first time; a real end-to-end call returned `rustVersion: "fedos-core-rust/0.0.0"`; `initializeCrypto()` itself untouched. |
| 014 | 995 | Public Runtime Completion Surface Review — declares the literal termination condition satisfied without changing `initializeCrypto()`; compares five public-exposure options, recommends the one that already exists. |

Every Phase above is additive: each one adds exactly one new,
separate, narrowly-scoped capability, never modifies `planLoad()`'s or
`initializeCrypto()`'s own return value, and leaves Worker and
Production completely unconnected.

## 5. Fail Closed — currently maintained, verified this Phase

- `AppRuntime.initializeCrypto()` still ALWAYS resolves `{ allowed:
  false, initialized: false, reason: "PrototypeDisabled" }` — pinned
  since Stage 691, unchanged across all 35 Stages, reconfirmed by an
  actual call in this Phase's own guard test.
- `FedosWasmLoader.planLoad()` still ALWAYS resolves `BlockedByPolicy`
  — pinned since Stage 489, unchanged across every Planning and
  Execution Phase.
- Worker remains fully unconnected — `src/worker.ts` references
  neither `fedos_wasm_loader.ts`'s async methods nor
  `fedos_runtime_prototype_execution.ts`, directly or indirectly, and
  is untouched by this Phase.
- Production remains fully unconnected — `create_runtime.ts`'s own
  assembled `AppRuntime` object carries no field referencing any of
  the Execution Chain's real capabilities; nothing calls
  `attemptDevOnlyRuntimeRustIntegration()` automatically from any code
  path a real deployment would exercise.
- The Dual-Lock Activation Gate (`FEDOS_CRYPTO_PROVIDER` +
  `FEDOS_CRYPTO_ENABLED=explicit-dev-only`) still cannot reach
  `"Allowed"` — no real `FedosRuntimeCryptoProvider` implementation
  exists, `encrypt`/`decrypt` still resolve `"Unsupported"`
  unconditionally.

## 6. Intentionally NOT implemented

The Prototype deliberately implements none of the following — every
one remains exactly as absent as it was at Stage 689:

- `encrypt()` / `decrypt()` (real AEAD operation)
- `deriveKey()`
- `randomBytes()` (as a public, callable Runtime operation — the
  crate's own internal CSPRNG helpers exist and are tested in
  isolation, but are never exposed)
- NIP-17 (private direct messages)
- NIP-44 (the full public encryption primitive — `ConversationKey`/
  `MessageKey` exist internally, per `test/nip44_key_derivation_stage_guard.test.ts`,
  but no NIP-44 encrypt/decrypt function exists)
- NIP-59 (gift wrap)
- Onion-like routing
- Double Ratchet
- Triple Ratchet

## 7. Open items at Prototype completion

- `AppRuntime.initializeCrypto()` does not surface `rustVersion` —
  Phase 014 reviewed this and concluded it is NOT required for
  completion, but remains a legitimate, unscheduled future decision
  (`docs/runtime_prototype_public_completion_surface_review.md` §4/§5).
- `attemptDevOnlyRuntimeRustIntegration()` is not wired into
  `AppRuntime`'s own assembled object — it exists and works, but no
  Runtime Service currently calls it.
- The seven `FedosWasmLoader*Plan` interfaces partially overlap with
  REAL state added later (e.g. `ImportPlan.shouldImport`, always
  `false`, sits beside the real `importReadiness().ready`) — a future
  consolidation candidate, not a correctness issue.
- `docs/runtime_internal_execution_contract.md`'s own running diagram
  was last updated at Stage 969 (Phase 007) — it does not reflect
  Stage 993–995 (Phases 012–014); this completion document is the
  up-to-date record going forward.
- No real crypto backend (`FedosRuntimeCryptoProvider`) exists — the
  Dual-Lock Activation Gate has nothing to unlock even if both
  environment variables were set correctly.
- The Rust crate exposes exactly one `#[wasm_bindgen]` function
  (`version()`); every real cryptographic primitive
  (`encrypt`/`decrypt`/KDF/random) exists only as internal, untested-
  from-JS Rust code.

## 8. Handoff to the next arc — "Secure Runtime Alpha"

What the next arc inherits, and should treat as load-bearing:

- **A proven, real, Fail-Closed Rust reach.** The six-condition gate
  (Generated Artifact Check → Development Runtime → Import Ready → JS
  Glue Import → Module Retention → WASM Initialization) is a working,
  tested template for gating ANY future real Rust call — reuse its
  shape, don't rebuild it.
- **The two-tier "reachable internally" vs. "safe to expose publicly"
  discipline.** Every risky step in this arc was split into a
  capability-adding Phase and a separate exposure-reviewing Phase. The
  next arc should keep doing this, especially once real key material
  is involved.
- **`initializeCrypto()`'s pinned contract is a deliberate boundary,
  not dead weight.** Any future Phase changing it should do so as its
  OWN, explicitly-reviewed step — never as a side effect of adding a
  new capability underneath it.
- **The generated-artifact-never-committed convention.** `target/`,
  `Cargo.lock`, and `pkg/` have been built and deleted dozens of times
  across this arc and never once committed — keep this invariant.
- **Real cryptography is unstarted.** `encrypt`/`decrypt`/KDF/random
  exist in Rust but are unreachable from JS. The next arc's first real
  decision is which ONE of these to expose next, following the SAME
  `#[wasm_bindgen]`-one-function-at-a-time discipline Stage 986
  established for `version()`.
- **Worker and Production have never been touched.** Whatever the next
  arc builds, connecting Worker or a real Production path is its own,
  separate, and significantly higher-stakes decision than anything in
  this Prototype.

## 9. See also

- `docs/runtime_prototype_public_completion_surface_review.md`
  (Prototype EXECUTION Phase 014) — the review this declaration acts
  on.
- `docs/runtime_prototype_execution_runtime_integration.md`
  (Prototype EXECUTION Phase 013) — the real Runtime → Rust → Runtime
  round trip this declaration records as complete.
- `docs/runtime_internal_execution_contract.md` — the original,
  running target-architecture diagram this document supersedes as the
  up-to-date record.
- `docs/runtime_initialize_crypto_prototype.md` (Stage 691) — the
  origin of the `{ allowed: false, initialized: false, reason:
  "PrototypeDisabled" }` contract this Prototype leaves unchanged.
