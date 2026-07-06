# FedOS WASM Artifact — the twelfth link, still not built (Stage 393–400)

**Status: this document records real code.** It explains the ELEVENTH
abstraction link `FedosRuntimeCryptoProvider`'s internal execution
chain now models — `FedosWasmArtifact`, the placeholder for the
"build" step `docs/runtime_wasm_build_plan.md` (Stage 393) describes.

## 1. The complete execution flow

```
Runtime
  |
  v
Provider                                (src/runtime/fedos_runtime_crypto_provider.ts)
  |
  v
Opaque API                              (src/runtime/fedos_opaque_api.ts, Stage 321-323)
  |
  v
Rust Boundary                           (src/runtime/fedos_rust_boundary.ts, Stage 329-331)
  |
  v
Rust API                                (src/runtime/fedos_rust_api.ts, Stage 337-339)
  |
  v
Execution Review                        (src/runtime/fedos_rust_execution_review.ts, Stage 345)
  |
  v
Internal Rust Call (PLANNED ONLY)       (src/runtime/fedos_internal_rust_call.ts, Stage 353)
  |
  v
Rust Invocation Adapter                 (src/runtime/fedos_rust_invocation_adapter.ts, Stage 361-363/377)
  |
  v
WASM Boundary                           (src/runtime/fedos_wasm_boundary.ts, Stage 386-387)
  |
  v
WASM Artifact                           (src/runtime/fedos_wasm_artifact.ts, Stage 394-395)
  |   planBuild()  -> { operation: "build", state: "BlockedByImplementation", ... }
  |   planLoad()   -> { operation: "load",  state: "BlockedByImplementation", ... }  (never called yet)
  v
STOP                                    <-- STAGE 393-400 STOPS HERE
  |
  v
Rust crate (packages/fedos-core-rust)   <-- STILL UNCONNECTED
```

Every link above the STOP line is REAL code, callable today, fully
covered by `npm test`. **The Rust crate remains unconnected** — there
is no function, import, or code path anywhere in this repository that
runs `cargo build --target wasm32-*`, `wasm-bindgen`, or `wasm-pack`.

## 2. What the WASM Artifact actually is

`FedosWasmArtifact` (`src/runtime/fedos_wasm_artifact.ts`) is the
STRUCTURAL placeholder for the "build" step of
`docs/runtime_wasm_build_plan.md`'s pipeline — turning the crate into
a `wasm32` target and running bindgen. Its one implementation,
`FedosWasmArtifactPlaceholder`:

- `status()` — always reports `{ state: "NotBuilt", ... }`.
- `planBuild()` — ALWAYS resolves `{ operation: "build", state: "BlockedByImplementation", ... }`.
- `planLoad()` — ALWAYS resolves the same `"BlockedByImplementation"`
  state. Neither method compiles anything, runs bindgen, or produces
  a byte of output.

**The WASM Artifact itself never invokes `cargo build --target
wasm32-*`, `wasm-bindgen`, `wasm-pack`, `packages/fedos-core-rust`,
`WebAssembly.instantiate`/`compile`, FFI, or a Native Addon.** It
simply receives a request and returns a decision — there is no
build-tooling invocation anywhere in `fedos_wasm_artifact.ts`.

## 3. What the WASM Boundary's extended wiring actually does (Stage 395)

`FedosWasmBoundaryPlaceholder.planLoad()`:

1. (Unchanged) Receive a load request.
2. Build a `FedosWasmArtifact` via `createFedosWasmArtifact()`.
3. Call its `planBuild()` — always `"BlockedByImplementation"`.
4. **Discard the artifact's decision and return the EXISTING
   `"BlockedByImplementation"` answer UNCHANGED.** The artifact's
   decision is never passed to Runtime or Worker, never passed to any
   real build tool.

Only `planBuild()` is ever called from here — `FedosWasmArtifact.planLoad()`
is unreachable from this wiring in this stage, since no real artifact
could ever be loaded before it is built. `planEncrypt()`/`planDecrypt()`
of the WASM Boundary are UNCHANGED by this stage.

## 4. Diagnostics (Stage 396)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
three more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `wasmArtifactState` | `fedosWasmArtifactState()` | `"NotBuilt"` |
| `wasmArtifactReachable` | `fedosWasmArtifactReachable()` | `true` — structurally wired, NOT a claim of a real build |
| `wasmArtifactBuilt` | `fedosWasmArtifactBuilt()` | `false` |

None of these expose any implementation detail beyond these three
values.

## 5. Still true after this stage

- No Rust execution, no WASM build, no WASM load, no FFI, no Native
  Addon, no CLI, anywhere in the chain.
- No `cargo build --target wasm32-*`, no `wasm-bindgen`, no
  `wasm-pack` anywhere in this repository.
- No Runtime activation — `create_runtime.ts` never calls any `plan*`/
  `review*`/`evaluate*` function in this chain.
- No Worker activation — `src/worker.ts` still does not import any of
  these files.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`, even with BOTH
  `FEDOS_CRYPTO_PROVIDER=fedos` AND
  `FEDOS_CRYPTO_ENABLED=explicit-dev-only` set.
- No `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload`
  export — all remain `pub(crate)`-private inside
  `packages/fedos-core-rust`.
- No `Cargo.toml`/`package.json` change, no new Rust `pub fn`, no new
  Rust public API.

## See also

- `docs/runtime_wasm_build_plan.md` (Stage 393) — the planning-only
  pipeline this file's "build" step models.
- `docs/runtime_wasm_boundary.md` (Stage 386–390) — the layer
  immediately above the WASM Artifact.
- `docs/runtime_internal_execution_contract.md` (Stage 356, updated
  Stage 389/397) — the multi-link contract this stage extends by one
  more link.
