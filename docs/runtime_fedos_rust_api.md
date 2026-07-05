# FedOS Rust API — private connection point (Stage 337–344)

**Status: this document records real code.** It explains the SIXTH
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
     |
     v
6. Rust API                             (src/runtime/fedos_rust_api.ts, Stage 337-339)
     |   planRustApiEncrypt(request) -> { state: "BlockedByImplementation", ... }
     |   planRustApiDecrypt(request) -> { state: "BlockedByImplementation", ... }
     v
7. STOP                                 <-- STAGE 337-344 STOPS HERE (Stage 338)
     |
     v
8. Rust Crypto (packages/fedos-core-rust: NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–6 are REAL code, callable today, fully covered by `npm test`.
There is no function, import, or code path anywhere in this repository
connecting step 6's Rust API to step 8's real Rust crypto.

## 2. What the Rust API actually is

`FedosRustApi` (`src/runtime/fedos_rust_api.ts`) is the ONE seam a
future, separate, explicitly-reviewed stage would eventually connect to
`packages/fedos-core-rust`'s real functions — imported ONLY by
`fedos_rust_boundary.ts`, never by `AppRuntime`/`create_runtime.ts`,
never by `src/worker.ts`. Its one implementation,
`FedosRustApiPlaceholder`:

- `status()` — always reports `{ state: "NotConnected", ... }`.
- `planRustApiEncrypt(request)` / `planRustApiDecrypt(request)` — ALWAYS
  resolve `{ state: "BlockedByImplementation", ... }`. No payload
  processing, no plaintext, no ciphertext, no key material is ever
  constructed, read, or returned.

**The Rust API itself never invokes Rust, WASM, or FFI.** It simply
RECEIVES a `FedosOpaqueRequest` and returns a decision — execution
stops immediately before the actual Rust implementation. There is no
`packages/fedos-core-rust` import, no WASM, no FFI anywhere in
`fedos_rust_api.ts`.

## 3. What the Rust Boundary's extended wiring actually does (Stage 338)

`FedosRustBoundaryPlaceholder.planRustEncrypt()`/`planRustDecrypt()`:

1. (Unchanged) Receive an opaque request.
2. Build a `FedosRustApi` via `createFedosRustApi()`.
3. Route the request to it via `planFedosRustApiExecution` — always
   `"BlockedByImplementation"`.
4. **Discard the Rust API's decision and return the Rust Boundary's
   OWN, unchanged `"BlockedByImplementation"` answer.** The API's
   decision is never passed to `encrypt()`/`decrypt()`, never passed to
   Rust/WASM/FFI, never passed to Runtime or Worker.

## 4. The implementation-stage milestone (Stage 340)

`FedosProviderImplementationStage` now tracks SIX steps:

| Stage | Meaning | Reached? |
|---|---|---|
| `"Unavailable"` | No operation/opaque-request model exists | — (superseded) |
| `"ProviderReady"` | Provider/Operation/Opaque-Request models exist (Stage 313–320) | — (superseded) |
| `"OpaqueApiReady"` | Opaque API abstraction exists and is wired (Stage 321–328) | — (superseded) |
| `"RustBoundaryReady"` | Rust Boundary abstraction exists and is wired (Stage 329–336) | — (superseded) |
| `"RustApiReady"` | Rust API abstraction exists and is wired (Stage 337–344) | **YES — current state** |
| `"RustReady"` | RESERVED — real Rust crypto connection exists | No — unreachable this stage |

`fedosProviderImplementationStage()` is fixed, hand-maintained, and
returns `"RustApiReady"` today.

## 5. Diagnostics (Stage 341)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
two more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `rustApiState` | `fedosRustApiState()` | `"NotConnected"` |
| `rustApiReachable` | `fedosRustApiReachable()` | `true` — the code path exists and is called, NOT a claim that real crypto executes |

`providerImplementationStage` now reports `"RustApiReady"`. None of
these expose a request, a handle, or any byte of secret material.

## 6. Still true after this stage

- No Rust crypto invocation, no WASM, no FFI, anywhere in the chain.
- No Runtime execution — `create_runtime.ts` never calls
  `planExecution()`/`planEncrypt()`/`planDecrypt()`/`planRustEncrypt()`/
  `planRustDecrypt()`/`planRustApiEncrypt()`/`planRustApiDecrypt()`.
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

- `docs/runtime_fedos_rust_boundary.md` (Stage 329–336) — the Rust
  Boundary abstraction this stage's Rust API sits behind.
- `docs/runtime_fedos_opaque_api.md` (Stage 321–328) — the Opaque API
  abstraction underneath.
- `docs/runtime_fedos_provider_execution.md` (Stage 313–320) — the
  operation/opaque-request model underneath that.
- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — the
  implementation flag this whole chain still gates on.
- `docs/runtime_crypto_activation_policy.md` / `docs/runtime_crypto_threat_model.md`
  — the fail-closed activation gate this internal execution model does
  not bypass.
