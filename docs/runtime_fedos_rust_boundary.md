# FedOS Rust Boundary — private wiring (Stage 329–336)

**Status: this document records real code.** It explains the FIFTH
link `FedosRuntimeCryptoProvider`'s internal execution chain now models
— and states plainly that this stage stops the chain before it ever
reaches real Rust crypto.

## 1. The complete execution flow

```
1. FedosRuntimeCryptoProvider          (src/runtime/fedos_runtime_crypto_provider.ts)
     |
     v
2. FedosRuntimeOperation                (src/runtime/fedos_runtime_operation.ts, Stage 313)
     |
     v
3. Opaque Request                       (src/runtime/fedos_runtime_opaque_request.ts, Stage 314)
     |
     v
4. Opaque API                           (src/runtime/fedos_opaque_api.ts, Stage 321-323)
     |
     v
5. Rust Boundary                        (src/runtime/fedos_rust_boundary.ts, Stage 329-331)
     |   planRustEncrypt(request) -> { state: "BlockedByImplementation", ... }
     |   planRustDecrypt(request) -> { state: "BlockedByImplementation", ... }
     v
6. STOP                                 <-- STAGE 329-336 STOPS HERE (Stage 330)
     |
     v
7. Rust Crypto (packages/fedos-core-rust: NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–5 are REAL code, callable today, fully covered by `npm test`.
There is no function, import, or code path anywhere in this repository
connecting step 5's Rust Boundary to step 7's real Rust crypto.

## 2. What the Rust Boundary actually is

`FedosRustBoundary` (`src/runtime/fedos_rust_boundary.ts`) is an
INTERNAL abstraction — imported ONLY by `fedos_opaque_api.ts`, never
by `AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`. Its one
implementation, `FedosRustBoundaryPlaceholder`:

- `status()` — always reports `{ state: "NotConnected", ... }`.
- `planRustEncrypt(request)` / `planRustDecrypt(request)` — ALWAYS
  resolve `{ state: "BlockedByImplementation", ... }`. No crypto, no
  Rust call, no payload processing, no plaintext, no ciphertext is
  ever constructed, read, or returned.

**The Rust Boundary itself never invokes Rust, WASM, or FFI.** It
simply RECEIVES a `FedosOpaqueRequest` and returns a decision — the
request terminates immediately upon reaching it. There is no
`packages/fedos-core-rust` import, no WASM, no FFI anywhere in
`fedos_rust_boundary.ts`.

## 3. What the Opaque API's extended wiring actually does (Stage 330)

`FedosOpaqueApiPlaceholder.planEncrypt()`/`planDecrypt()`:

1. (Unchanged) Receive an opaque request.
2. Build a `FedosRustBoundary` via `createFedosRustBoundary()`.
3. Route the request to it via `planFedosRustBoundaryExecution` —
   always `"BlockedByImplementation"`.
4. **Discard the Rust Boundary's decision and return the Opaque API's
   OWN, unchanged `"BlockedByImplementation"` answer.** The boundary's
   decision is never passed to `encrypt()`/`decrypt()`, never passed to
   Rust/WASM/FFI, never passed to Runtime or Worker.

## 4. The implementation-stage milestone (Stage 332)

`FedosProviderImplementationStage` now tracks FIVE steps:

| Stage | Meaning | Reached? |
|---|---|---|
| `"Unavailable"` | No operation/opaque-request model exists | — (superseded) |
| `"ProviderReady"` | Provider/Operation/Opaque-Request models exist (Stage 313–320) | — (superseded) |
| `"OpaqueApiReady"` | Opaque API abstraction exists and is wired (Stage 321–328) | — (superseded) |
| `"RustBoundaryReady"` | Rust Boundary abstraction exists and is wired (Stage 329–336) | **YES — current state** |
| `"RustReady"` | RESERVED — real Rust crypto connection exists | No — unreachable this stage |

`fedosProviderImplementationStage()` is fixed, hand-maintained, and
returns `"RustBoundaryReady"` today.

## 5. Diagnostics (Stage 333)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
two more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `rustBoundaryState` | `fedosRustBoundaryState()` | `"NotConnected"` |
| `rustBoundaryReachable` | `fedosRustBoundaryReachable()` | `true` — the code path exists and is called, NOT a claim that real crypto executes |

`providerImplementationStage` now reports `"RustBoundaryReady"`. None
of these expose a request, a handle, or any byte of secret material.

## 6. Still true after this stage

- No Rust crypto invocation, no WASM, no FFI, anywhere in the chain.
- No Runtime execution — `create_runtime.ts` never calls
  `planExecution()`/`planEncrypt()`/`planDecrypt()`/`planRustEncrypt()`/
  `planRustDecrypt()`.
- No Worker execution — `src/worker.ts` still does not import any of
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
- No `Cargo.toml`/`package.json` change, no new Rust `pub fn`.

## See also

- `docs/runtime_fedos_opaque_api.md` (Stage 321–328) — the Opaque API
  abstraction this stage's Rust Boundary sits behind.
- `docs/runtime_fedos_provider_execution.md` (Stage 313–320) — the
  operation/opaque-request model underneath.
- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — the
  implementation flag this whole chain still gates on.
- `docs/runtime_crypto_activation_policy.md` / `docs/runtime_crypto_threat_model.md`
  — the fail-closed activation gate this internal execution model does
  not bypass.
