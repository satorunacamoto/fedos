# Secure Runtime Alpha 008 — Public Runtime `randomBytes()` API

Stage 1004. Implements Alpha 007's own four-layer architecture recommendation
(`docs/secure_runtime_alpha_007_crypto_api_surface_review.md` §7-8) end to
end, for exactly one operation: `AppRuntime.randomBytes()`, the FIRST public
Crypto API Runtime exposes. Per Alpha 007 §9's own implementation ranking,
`randomBytes()` was first because it is closest to `version()`'s own
Stage 986 precedent and is backed by already-tested Rust code
(`fedos_random_bytes_32`, Stage 137).

## Scope

**Allowed and done:** a new Rust Boundary wrapper function
(`random_bytes_32`, `#[wasm_bindgen]`); a new Loader-level method
(`FedosWasmLoaderSkeleton.attemptDevOnlyRandomBytesCall()`); a new Runtime
Service file (`fedos_runtime_random_bytes.ts`); a new Public Runtime API
field (`AppRuntime.randomBytes()`); docs; tests.

**Forbidden and not done:** Worker connection, Production connection,
`FedosWasmLoader` Plan changes (all seven Plan interfaces are unchanged),
`initializeCrypto()` changes, `runtimeCapabilities()` changes,
`Cargo.toml`/`package.json` changes, a second new Rust API, any change to
`fedos_random_bytes_32()`'s own algorithm/implementation, Secure Storage.

## The four layers

```
AppRuntime.randomBytes()                              Public Runtime API
    |                                                  (create_runtime.ts / types.ts)
    v
attemptDevOnlyRuntimeRandomBytes()                     Runtime Service
    |                                                  (fedos_runtime_random_bytes.ts)
    v
FedosWasmLoaderSkeleton.attemptDevOnlyRandomBytesCall() Rust Boundary reach
    |                                                  (fedos_wasm_loader.ts)
    v
random_bytes_32()                                      Rust Boundary
    |                                                  (lib.rs, #[wasm_bindgen])
    v
fedos_random_bytes_32()                                Internal Rust
                                                        (lib.rs, Stage 137, UNCHANGED)
```

### Public Runtime API

`AppRuntime.randomBytes(): Promise<Uint8Array | null>` (`types.ts`,
`create_runtime.ts`). The one thing an application ever calls. Resolves
either 32 real random bytes or `null` — never a partial/zeroed/degraded
result, never a thrown exception.

### Runtime Service

`fedos_runtime_random_bytes.ts` — a NEW file, mirroring
`fedos_runtime_prototype_execution.ts`'s own `attemptDevOnlyRuntimeRustIntegration()`
(Stage 994) exactly. `attemptDevOnlyRuntimeRandomBytes()` constructs a FRESH
`FedosWasmLoader`, drives it through `planLoad()` ->
`attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()` ->
`attemptDevOnlyRandomBytesCall()`, then reads back `succeeded`/`bytes`. The
exported `randomBytes()` wraps that call in `try`/`catch` — Fail Closed at
the Runtime Service boundary, on top of the Loader's own already-Fail-Closed
six-condition chain.

### Rust Boundary reach

`FedosWasmLoaderSkeleton.attemptDevOnlyRandomBytesCall()`
(`fedos_wasm_loader.ts`) — mirrors `attemptDevOnlyRustVersionCall()` (Stage
993) exactly: gated on the SAME six previously-recorded conditions
(Generated Artifact Check, Development Runtime, Import Ready, JS Glue
Import, JS Glue Module retained, WASM Initialization). Checks, at runtime,
only `typeof module.random_bytes_32 === "function"`; calls it with no
argument inside `try`/`catch`. A genuine `Uint8Array` return resolves
`succeeded: true`; a genuine `undefined` return (Rust's own
`EntropySourceUnavailable`) resolves `reason: "EntropySourceUnavailable"`
— not `"CallFailed"`, since nothing threw; any thrown error resolves
`"CallFailed"`.

### Rust Boundary

`random_bytes_32()` (`lib.rs`, `#[wasm_bindgen]`) — a thin, non-cryptographic
wrapper. Calls `fedos_random_bytes_32()` EXACTLY ONCE and reshapes its
`Option<[u8; 32]>` `bytes` field into `Option<Vec<u8>>`, which
`wasm-bindgen` maps to `Uint8Array | undefined`. No new entropy source, no
new algorithm, no new random draw — verified against the real generated
`.d.ts` during this Stage's own build-and-inspect step.

### Internal Rust

`fedos_random_bytes_32()` (`lib.rs`, Stage 137) — UNCHANGED, byte-for-byte.
Calls `getrandom::fill` into a `[u8; 32]` buffer; `Ready`/`Some(bytes)` on
success, `EntropySourceUnavailable`/`None` on failure. This Stage adds no
line to this function.

## Fail Closed

Every layer Fails Closed independently:

- **Rust**: `fedos_random_bytes_32()` returns `None` on CSPRNG failure —
  never panics, never returns zeroed/predictable bytes.
- **Rust Boundary**: `random_bytes_32()` propagates `None` as `undefined`
  — no default substitution.
- **Loader**: any of the six pre-conditions unmet, the export absent, or
  the call throwing all resolve `bytes: null` — never a partial result.
- **Runtime Service**: `randomBytes()`'s own `try`/`catch` ensures NO
  exception — synchronous or asynchronous, from any layer below — ever
  escapes past the Public Runtime API. A caller only ever sees
  `Uint8Array` or `null`.

Verified live: with `NODE_ENV=development` and the real, locally-built WASM
artifact present, `randomBytes()` resolved 32 real bytes end to end. With
`NODE_ENV=production` (or unset), it resolved `null` — the Loader's
Development Runtime gate is unmet, so `random_bytes_32()` is never called.

## Unchanged, confirmed by real calls

- `AppRuntime.initializeCrypto()` — still `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte.
- `AppRuntime.runtimeCapabilities()` — still exactly its Alpha 005 four
  fields (`prototypeCompleted`/`rustReachable`/`rustVersion`/`runtimeMode`),
  and never reads or is read by `randomBytes()`'s own control flow — they
  construct entirely separate `FedosWasmLoader` instances.
- `FedosWasmLoader`'s seven Plan interfaces (`FedosWasmLoaderDecision`,
  `FedosWasmLoaderPolicyDecision`, `FedosWasmLoaderPlanningStatus`, and the
  four internal Plan builders) — untouched.
- Worker (`src/worker.ts`) — no reference to `randomBytes`,
  `fedos_runtime_random_bytes.ts`, `random_bytes_32`, or
  `attemptDevOnlyRandomBytesCall` anywhere.
- Production — no new environment branch, no new deploy-time wiring.
- `Cargo.toml`/`package.json` — no new dependency; `random_bytes_32()`
  uses only `getrandom` (already a Stage 137 dependency) via the
  pre-existing `fedos_random_bytes_32()`.

## What comes after

Per Alpha 007 §9's ranking, `encrypt()`/`decrypt()` are the recommended
next Public API additions — the crate's actual value proposition, already
NIST-CAVP-tested. `deriveKey()`, `hash()`, `sign()`/`verify()` follow in
that order; `generateKey`/`importKey`/`exportKey` remain deliberately
unranked pending their own scoping review.
