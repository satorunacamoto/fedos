# FedOS Secure Runtime Alpha 002 — Public Runtime Surface Review

**Status: REVIEW ONLY. No code change of any kind — `src/runtime/`,
`src/worker.ts`, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
`package.json`, both diagnostics files, and Production code paths are
all byte-for-byte unchanged. This document works through Alpha 001's
own §3 item 1 ("Public Runtime Surface") — the item it named as
Alpha's first, lowest-risk, shape-determining priority.**

## 1. Current Public Runtime Surface — classified

**Public API** (part of `AppRuntime`, the object `createRuntime()`
assembles — the ONLY surface any code outside `src/runtime/` actually
receives):

```text
AppRuntime.initializeCrypto: () => RuntimeInitializeCryptoResult
    -- createRuntimeInitializeCryptoResult(), create_runtime.ts, Stage 691/697
    -- ALWAYS { allowed: false, initialized: false, reason: "PrototypeDisabled" }

AppRuntime.crypto: RuntimeCryptoProvider
    -- selectRuntimeCryptoProvider(), create_runtime.ts, Stage 65
    -- encrypt()/decrypt() ALWAYS resolve { state: "Unsupported", allowed: false }
```

These are the ONLY two crypto-related members `AppRuntime` exposes
today. Everything else described below requires importing a
`fedos_*.ts`/`runtime_*.ts` file directly — none of it is reachable
through `createRuntime()`'s own return value.

**Internal API** (exported — technically importable by any TS file —
but NOT part of `AppRuntime`, and by convention only called from
elsewhere inside the `fedos_*.ts` chain or from tests):

```text
createCryptoLoaderFacade() / initializeCrypto()*  (fedos_crypto_loader_facade.ts)
createCryptoLoaderBackend()                       (fedos_crypto_loader_backend.ts)
createCryptoBackendInterface()                    (fedos_crypto_backend_interface.ts)
createCryptoBackendResolver()                     (fedos_crypto_backend_resolver.ts)
createWasmBackend()                                (fedos_wasm_backend.ts)
createFedosWasmLoader() -> FedosWasmLoader          (fedos_wasm_loader.ts)
  .status() / .planLoad() / .planInitialize() / .planUnload()
  .planningState() / .policy()
~50 standalone loaderXxx()/cryptoLoaderFacadeXxx() readers
runtimeCryptoActivationStatus() / workerCryptoActivationStatus()  (diagnostics)
```

`*` — **naming collision, called out explicitly**: `fedos_crypto_loader_facade.ts`
exports its OWN function ALSO named `initializeCrypto()`, with a
DIFFERENT shape (`{ allowed, reason: "FacadeInitializationPending" }`,
no `initialized` field) than `AppRuntime.initializeCrypto()`. Neither
this document nor any future public-surface work should ever conflate
the two — the Facade-level one is Internal API, never re-exported.

**Prototype-only API** (explicitly `attemptDevOnly`-prefixed,
Development-Runtime-gated, never called automatically, never wired
into `AppRuntime`):

```text
FedosWasmLoaderSkeleton.attemptDevOnlyJsGlueImport()        (Stage 945)
FedosWasmLoaderSkeleton.attemptDevOnlyWasmInitialization()  (Stage 969)
FedosWasmLoaderSkeleton.attemptDevOnlyRustVersionCall()     (Stage 993)
attemptDevOnlyRuntimeRustIntegration()                      (fedos_runtime_prototype_execution.ts, Stage 994)
  -> RuntimePrototypeExecutionState { reachedRust, rustVersion }
```

This is the ONLY category that ever reaches real Rust. Everything in
the "Internal API" category above terminates at `planLoad()`'s fixed
`BlockedByPolicy` and never executes anything.

## 2. Alpha public-API candidates — compared

| Candidate | What it would return | Risk | Fit |
|---|---|---|---|
| `initializeCrypto()` (existing) | pinned action result | none — already exists, already reviewed | Anchor; not itself a redesign candidate (see §3) |
| `runtimeState()` | a live snapshot of crypto-related Runtime state | Medium — new shape to design and pin; if it duplicates `runtimeCryptoActivationStatus()`'s existing shape, it is redundant | Reasonable IF scoped narrowly (state, not action) |
| `runtimeStatus()` | a coarser boolean-heavy summary | Medium — overlaps `runtimeState()` conceptually; picking BOTH risks two competing "the truth" surfaces | Reject alongside `runtimeState()` unless one is chosen, not both |
| `runtimeCapabilities()` | a fixed, enumerable list of what Runtime COULD do (labels, not live values) | Low — this SHAPE already exists at the Rust layer (`fedos_capability_descriptors()`/`FedosCapabilityDescriptor`) and the Loader layer (`loaderGeneratedArtifactCheckTargets()` etc.); extending the same pattern to Runtime is low-novelty | Good fit — matches an established convention |
| `cryptoRuntime()` | (implied) a live, usable provider/handle | High — the name itself implies ACTIVATION, not observation; even if internally still `Unsupported`, the name conflicts with this arc's own careful "Activation" vocabulary (`docs` repeatedly reserve "Activation"/"Allowed" as NOT YET REACHABLE) | Reject as named; a differently-named, explicitly read-only variant could be revisited later |
| `diagnostics()` | the SAME shape `runtimeCryptoActivationStatus()` already returns | Lowest — reuses an EXISTING, already-pinned, already-tested type; would just mean putting a reference to the existing function on `AppRuntime` | Best-fit, lowest-implementation-risk option, PROVIDED it remains read-only and never gates behavior (§5) |

## 3. `initializeCrypto()` — how it should be treated going forward

| Option | Description | Verdict |
|---|---|---|
| 現状維持 (status quo) | Keep the exact pinned `{ allowed, initialized, reason }` shape, unchanged | **Recommended, short-term and long-term for THIS function specifically.** Matches Phase 014's own conclusion; nothing in this review changes that conclusion. |
| 機能追加 (add functionality directly) | Merge `rustVersion` or any other live field into its own return value | **Rejected**, same reasoning Phase 014 already gave (§4 Option A there): breaks a pinned, test-snapshotted contract; forces either an async signature or a cached side effect, both against this arc's own PURE-function discipline. |
| 内部専用化 (demote to internal-only) | Stop calling it "the" public surface; keep it exactly as-is, but let it become ONE OF SEVERAL public members on `AppRuntime` rather than the ONLY crypto-related one | **Recommended as the actual path forward.** `initializeCrypto()` keeps its role as the pinned ACTION entry point (the thing a caller eventually calls to attempt real activation); a SEPARATE, READ-ONLY reader (§2, `runtimeCapabilities()` or `diagnostics()`-shaped) becomes the primary way callers OBSERVE state, without either function needing to change once the other exists. |
| 将来Deprecated (eventual deprecation) | Phase it out entirely | **Rejected.** It is the one surface every future real caller would already depend on if this shipped; nothing in this arc's own history suggests removing a pinned public entry point rather than adding beside it. |

## 4. Should `version()` be exposed publicly, and from where?

**Yes, eventually — but not from `initializeCrypto()`, and not this
Phase.** This extends, rather than re-litigates, Phase 014's own
five-option review
(`docs/runtime_prototype_public_completion_surface_review.md` §4):

- Phase 014 already rejected baking it into `initializeCrypto()`
  (Option A) and already recommended the standalone async function
  that exists today, `attemptDevOnlyRuntimeRustIntegration()` (Option
  C).
- This review's own addition: the natural home for a PUBLICLY exposed
  `rustVersion` is a NEW, READ-ONLY reader — the same
  `runtimeCapabilities()`-shaped candidate §2 already favors — carrying
  a field like `rustReachable: boolean` / `rustVersion: string | null`,
  populated by calling the EXISTING `attemptDevOnlyRuntimeRustIntegration()`
  internally. This is Option B and Option C from Phase 014 COMBINED:
  a diagnostics-shaped surface (B) backed by the already-existing
  standalone function (C), rather than either in isolation.
- This function would necessarily be ASYNC (since
  `attemptDevOnlyRuntimeRustIntegration()` itself is), which is fine
  for a NEW, clearly-named, opt-in reader — unlike forcing
  `initializeCrypto()` itself to become async, which would break every
  existing synchronous caller.
- It should be named distinctly from BOTH `initializeCrypto()` and
  `diagnostics()`/`runtimeCryptoActivationStatus()` to avoid the exact
  kind of naming collision §1 already found once (the Facade-level
  `initializeCrypto()`). A candidate name: `runtimeCapabilities()`
  returning `{ ..., rustReachable, rustVersion }`, or a narrower,
  explicitly-Prototype-labeled `probeRustCapability()` if the team
  prefers keeping its exploratory nature visible in the name.

## 5. Fail Closed — can the surface grow without breaking it?

**Yes, provided three rules hold for every new reader:**

1. **Read-only, never gating.** Any new public function may REPORT
   state; none may be consulted by `initializeCrypto()`'s own `if`
   logic, by `planLoad()`, or by any activation policy. This is
   already how `runtimeCryptoActivationStatus()`/diagnostics work
   throughout this entire arc — the new surface should follow the
   identical rule.
2. **Default absent/false, positive proof required.** Exactly the
   discipline the six-condition Rust-reach gate already uses — a new
   `runtimeCapabilities()`-style reader must default every field to
   its safest value and only report otherwise after a real,
   successful check, mirroring `FedosWasmLoaderRustVersionExecution`'s
   own `attempted`/`succeeded`/`reason` shape.
3. **`initializeCrypto()`'s own answer stays independent.** Nothing a
   new reader reports may ever be merged into, or change, what
   `initializeCrypto()` itself returns — the two must remain provably
   decoupled, the same way `attemptDevOnlyRuntimeRustIntegration()`
   and `createRuntimeInitializeCryptoResult()` are decoupled today
   (Stage 994, verified by direct test).

Under these three rules, the surface CAN grow — Fail Closed is a
property of what a public function is ALLOWED to cause, not of how
many public functions exist.

## 6. Consistency with Worker, Production, Backend Resolver, and Secure Storage futures

- **Worker.** Whatever shape Alpha 003 picks for a new public reader
  should avoid `create_runtime.ts`-specific coupling in its OWN type
  definition, so the identical shape could be mirrored (not
  necessarily identically implemented) into a future Worker-side
  reader without a redesign.
- **Production.** A read-only capability reader is SAFE to expose even
  under a real Production `NODE_ENV`, because the six-condition gate
  it would report on already Fails Closed correctly outside
  Development Runtime — a Production caller would simply observe
  `rustReachable: false`, which is both true and safe to say.
- **Backend Resolver.** Currently a fixed `"WasmPlanned"` leaf. Any new
  public reader's type should leave room for a future `backend` field
  (e.g. `backend: "WasmPlanned" | "WasmActive" | ...`) without
  redesigning the reader's own shape when the Resolver eventually
  becomes real.
- **Secure Storage.** No public reader should ever return raw key
  material, a `SecretHandle`, or any exportable secret — already
  naturally true of every value discussed in this document
  (`rustVersion` is a non-secret label), but worth stating as a
  standing rule for anything added to this surface in the future.

## 7. Recommendation — first Public API for Alpha 003

**Implement ONE new, read-only, `AppRuntime`-attached reader —
tentatively `runtimeCapabilities()` — that wires
`attemptDevOnlyRuntimeRustIntegration()` into `AppRuntime` for the
first time, without touching `initializeCrypto()`'s own contract.**

Reasoning, in order of weight:

1. It resolves Alpha 001's own still-open item (`attemptDevOnlyRuntimeRustIntegration()`
   "not wired into `AppRuntime`'s own assembled object") in the
   lowest-risk way this review found (§2).
2. It satisfies §4's recommendation without requiring
   `initializeCrypto()` to change at all.
3. It is naturally Fail-Closed under §5's three rules — it can only
   ever report what the existing six-condition gate already decided.
4. It keeps `initializeCrypto()` exactly as `内部専用化` in §3
   recommends — still the pinned action entry point, now
   demonstrably not the ONLY crypto-related member of `AppRuntime`.
5. It is additive only — no existing test, type, or caller needs to
   change; only new tests are needed, matching every prior Phase's
   own "don't touch what already works" discipline.

Alpha 003 is expected to design this reader's exact shape (which
fields beyond `rustReachable`/`rustVersion`, whether async or a
lazily-resolved promise field, exact naming) as its own, separate,
explicitly-reviewed Stage — this review recommends the DIRECTION, not
the final API shape.

## 8. What this Phase does NOT do

- Does **not** change `src/runtime/` (including `create_runtime.ts`,
  `fedos_wasm_loader.ts`, `fedos_runtime_prototype_execution.ts`).
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** change any Production code path.
- Does **not** implement `runtimeCapabilities()`, `diagnostics()`, or
  any other candidate named in §2/§7 — all are recorded as reviewed
  options, none is adopted in code this Phase.

## 9. See also

- `docs/secure_runtime_alpha_001_baseline.md` (Secure Runtime Alpha
  001) — named "Public Runtime Surface" as Alpha's first, highest
  priority item; this document resolves that item.
- `docs/runtime_prototype_public_completion_surface_review.md`
  (Prototype EXECUTION Phase 014) — the five-option comparison §4
  extends rather than re-litigates.
- `docs/runtime_prototype_execution_runtime_integration.md`
  (Prototype EXECUTION Phase 013) — the real Rust reach
  (`attemptDevOnlyRuntimeRustIntegration()`) this review recommends
  wiring into `AppRuntime`.
- `docs/fedos_prototype_completion.md` (Prototype EXECUTION Phase 015)
  — the completion declaration that closed the Prototype before this
  Alpha arc began.
