# FedOS WASM Loader — Dev-only Rust `version()` Call (Prototype EXECUTION Phase 012)

**Status: this document records ONE new, separate, PUBLIC, ASYNC method
on `FedosWasmLoaderSkeleton` — `attemptDevOnlyRustVersionCall()`
(Stage 993) — the FIRST time this arc calls a real Rust API through the
retained JS glue module. `planLoad()`, `initializeCrypto()`, and both
Runtime/Worker diagnostics files are byte-for-byte unchanged.**

## 1. What this Phase adds

```ts
export interface FedosWasmLoaderRustVersionExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly version: string | null;
  readonly reason: "Succeeded" | "NotInitialized" | "VersionUnavailable" | "CallFailed" | "PrototypeStillClosed";
}
```

```ts
async attemptDevOnlyRustVersionCall(): Promise<FedosWasmLoaderRustVersionExecution>
```

A private field `#rustVersionExecution` stores the most recent result;
a public `rustVersionExecution()` reader exposes it. `planLoad()` is
NOT called from, and does NOT call, this method — it remains
byte-for-byte unchanged, exactly as every prior Stage in this arc has
kept it. `initializeCrypto()` is likewise unchanged.

## 2. Call conditions — ALL SIX required

`attemptDevOnlyRustVersionCall()` only calls `module.version()` when
ALL SIX of the following, each populated by an EARLIER method call on
the SAME instance, hold:

1. `this.#generatedArtifactCheckResult.artifactsExist` — Generated
   Artifact Check succeeded (Stage 921).
2. `this.#devOnlyGateEvaluation.developmentAllowed` — Development
   Runtime (Stage 929).
3. `this.#importReadiness.ready` — Import Ready (Stage 937).
4. `this.#importExecution.succeeded` — JS Glue Import succeeded
   (Stage 945).
5. `this.#jsGlueModule !== null` — JS Glue Module retained (Stage 961).
6. `this.#wasmInitialization.succeeded` — WASM Initialization
   succeeded (Stage 969).

None of the six is re-evaluated here — this method only READS state a
prior call already recorded on the same instance.

## 3. Fail Closed — two distinct "not ready" reasons

- **Any of the six missing entirely** (its recording method was never
  called on this instance): `module.version` is never read.
  `{ attempted: false, succeeded: false, version: null, reason: "PrototypeStillClosed" }`.
- **All six present, but at least one condition unmet** (e.g. Import
  Readiness recorded `ready: false`, or WASM Initialization recorded
  `succeeded: false`): `module.version` is never read.
  `{ attempted: false, succeeded: false, version: null, reason: "NotInitialized" }`.

## 4. `version()` discovery — `module.version` only

When all six conditions hold, this method checks EXACTLY ONE thing:
`typeof module.version === "function"`. No export-list enumeration, no
`Object.keys(module)`, no search for any other name.

- **Absent**: `{ attempted: true, succeeded: false, version: null, reason: "VersionUnavailable" }`.
- **Present**: calls `module.version()` — see §5.

## 5. `version()` call — no argument, `string`-only success

```ts
const result = module.version();
```

Called with NO argument, wrapped in `try`/`catch`:

- Any thrown/rejected error: `{ attempted: true, succeeded: false, version: null, reason: "CallFailed" }`.
- A return value that is NOT a `string` (e.g. `undefined`, a `Promise`,
  an object): `{ attempted: true, succeeded: false, version: null, reason: "CallFailed" }`.
- A genuine `string` return value: `{ attempted: true, succeeded: true, version: <the string>, reason: "Succeeded" }`.

## 6. What is retained — `succeeded`/`version`/`reason` only

The full `FedosWasmLoaderRustVersionExecution` result (which also
carries `attempted`) is stored on `#rustVersionExecution` — the SAME
"record only, never the source object" discipline Stage 945/969
already established for `#importExecution`/`#wasmInitialization`. The
module itself, and any raw Rust/WASM object the call might have
touched, is NEVER retained, NEVER inspected, and NEVER read anywhere
beyond the single `module.version()` call site.

## 7. What this Phase does NOT do

- Does **not** change `initializeCrypto()`.
- Does **not** change `planLoad()`.
- Does **not** change any Runtime return value.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** call `encrypt()`, `decrypt()`, `randomBytes()`,
  `deriveKey()`, or any other Rust API — `version()` only.
- Does **not** change `Cargo.toml` or `package.json`.
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.

## 8. What remains before "Prototype termination"

- `initializeCrypto()` still never reaches
  `attemptDevOnlyRustVersionCall()` — a future, separate stage would
  wire that connection (still Dev-only, still discarding the result,
  matching this arc's own "connect one link deeper, change nothing
  about the caller's own return value" precedent).
- `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` still
  carry no field naming this call's outcome.
- No cryptographic Rust API (`encrypt`/`decrypt`/`randomBytes`/
  `deriveKey`) has been added to `src/lib.rs`, exported via
  `#[wasm_bindgen]`, or called from TypeScript — `version()` remains
  the crate's only JS-reachable function.
- Worker and Production remain entirely unconnected to this arc.

## 9. See also

- `docs/runtime_wasm_rust_version_export.md` (Prototype EXECUTION
  Phase 010) — added the Rust `version()` function this Phase calls.
- `docs/runtime_wasm_js_glue_version_export_verification.md`
  (Prototype EXECUTION Phase 011) — confirmed the generated JS glue
  exports `version` and that it calls `wasm.version()` under the hood.
- `docs/runtime_wasm_loader_dev_only_wasm_initialization_execution.md`
  (Stage 969) — the immediately-prior async method this Phase's own
  sixth gate condition depends on.
