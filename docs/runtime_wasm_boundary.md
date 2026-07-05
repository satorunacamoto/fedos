# FedOS WASM Boundary — the formally-decided chain terminus (Stage 385–392)

**Status: this document records real code AND a real architecture
decision.** It explains the TENTH abstraction link
`FedosRuntimeCryptoProvider`'s internal execution chain now models —
the boundary `docs/runtime_rust_boundary_decision.md` (Stage 385)
formally decided is the sole official MVP mechanism for ever reaching
`packages/fedos-core-rust`.

## 1. The complete execution flow

```
Runtime
  |
  v
Provider                                (src/runtime/fedos_runtime_crypto_provider.ts)
  |
  v
Operation                               (src/runtime/fedos_runtime_operation.ts, Stage 313)
  |
  v
Opaque Request                          (src/runtime/fedos_runtime_opaque_request.ts, Stage 314)
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
  |   planLoad()     -> { operation: "load",    state: "BlockedByImplementation", ... }
  |   planEncrypt()  -> { operation: "encrypt", state: "BlockedByImplementation", ... }  (never called yet)
  |   planDecrypt()  -> { operation: "decrypt", state: "BlockedByImplementation", ... }  (never called yet)
  v
STOP                                    <-- STAGE 385-392 STOPS HERE
  |
  v
Rust crate (packages/fedos-core-rust)   <-- STILL UNCONNECTED
```

Every link above the STOP line is REAL code, callable today, fully
covered by `npm test`. **The Rust crate remains unconnected** — there
is no function, import, or code path anywhere in this repository that
loads a `.wasm` module or calls into compiled Rust.

## 2. What the WASM Boundary actually is

`FedosWasmBoundary` (`src/runtime/fedos_wasm_boundary.ts`) is the
STRUCTURAL placeholder for the boundary `docs/runtime_rust_boundary_decision.md`
formally decided on: WebAssembly, not a Node Native Addon, not a
spawned CLI process, not raw FFI. Its one implementation,
`FedosWasmBoundaryPlaceholder`:

- `status()` — always reports `{ state: "NotLoaded", ... }`.
- `planLoad()` — ALWAYS resolves `{ operation: "load", state: "BlockedByImplementation", ... }`.
- `planEncrypt(request)` / `planDecrypt(request)` — ALWAYS resolve the
  same `"BlockedByImplementation"` state. Neither method executes
  anything, loads anything, or allocates a payload, plaintext,
  ciphertext, or key of any kind.

**The WASM Boundary itself never calls `WebAssembly.instantiate`/
`WebAssembly.compile`, never imports `wasm-bindgen`-generated
bindings, never invokes `packages/fedos-core-rust`, and never uses FFI
or a Native Addon.** It simply receives a request and returns a
decision — there is no WASM-loading code anywhere in
`fedos_wasm_boundary.ts`.

## 3. What the Rust Invocation Adapter's extended wiring actually does (Stage 387)

`FedosRustInvocationAdapterPlaceholder.planEncrypt()`/`planDecrypt()`:

1. (Unchanged) Receive a `FedosInternalRustCall`.
2. Build a `FedosWasmBoundary` via `createFedosWasmBoundary()`.
3. Call its `planLoad()` — always `"BlockedByImplementation"`.
4. **Discard the boundary's decision and return the EXISTING
   `"BlockedByImplementation"` answer UNCHANGED.** The boundary's
   decision is never passed to Runtime or Worker, never passed to
   `packages/fedos-core-rust`, never passed to a real WASM/FFI/Native
   Addon call.

Only `planLoad()` is ever called from here — `FedosWasmBoundary.planEncrypt()`/
`planDecrypt()` are unreachable from this wiring in this stage, since
no real WASM module could ever be loaded first. `planPing()` is
UNCHANGED by this stage — it still reaches Rust's contract via its own
separate, pure TypeScript mirror (`docs/runtime_first_rust_ping_execution.md`),
entirely independently of this WASM Boundary wiring.

## 4. Diagnostics (Stage 388)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
three more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `wasmBoundaryState` | `fedosWasmBoundaryState()` | `"NotLoaded"` |
| `wasmBoundaryReachable` | `fedosWasmBoundaryReachable()` | `true` — structurally wired, NOT a claim of a real load |
| `wasmLoaded` | `fedosWasmLoaded()` | `false` |

None of these expose any implementation detail beyond these three
values; no payload, plaintext, ciphertext, or key material is ever
involved.

## 5. Still true after this stage

- No Rust execution, no WASM load, no FFI, no Native Addon, no CLI,
  anywhere in the chain.
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
- No Relay, Storage, Nostr, or NIP-17 connection of any kind.
- No `Cargo.toml`/`package.json` change, no new Rust `pub fn`, no new
  Rust public API.

## See also

- `docs/runtime_rust_boundary_decision.md` (Stage 385) — the formal
  architecture decision this file's model implements structurally.
- `docs/runtime_fedos_rust_invocation_adapter.md` (Stage 361–368) — the
  layer immediately above the WASM Boundary.
- `docs/runtime_internal_execution_contract.md` (Stage 356) — the
  multi-link contract this stage extends by one more link.
- `test/fedos_core_wasm_loader.test.ts` (Stage 63) — the pre-existing
  WASM loader boundary this stage's decision is consistent with.
