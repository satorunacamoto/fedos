# FedOS Opaque API — internal abstraction (Stage 321–328)

**Status: this document records real code.** It explains the FOURTH
link `FedosRuntimeCryptoProvider`'s internal execution chain now models
— and states plainly that this stage stops the chain before it ever
reaches Rust.

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
     |   planEncrypt(request) -> { state: "BlockedByImplementation", ... }
     |   planDecrypt(request) -> { state: "BlockedByImplementation", ... }
     v
5. STOP                                 <-- STAGE 321-328 STOPS HERE (Stage 322)
     |
     v
6. Rust / packages/fedos-core-rust      NOT reachable from this repository's TypeScript today
     |
     v
7. Internal Crypto (NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–4 are REAL code, callable today, fully covered by `npm test`.
There is no function, import, or code path anywhere in this repository
connecting step 4's Opaque API to step 6's Rust crate.

## 2. What the Opaque API actually is

`FedosOpaqueApi` (`src/runtime/fedos_opaque_api.ts`) is an INTERNAL
abstraction — imported ONLY by `fedos_runtime_crypto_provider.ts`, never
by `AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`. Its one
implementation, `FedosOpaqueApiPlaceholder`:

- `status()` — always reports `{ state: "NotConnected", ... }`.
- `planEncrypt(request)` / `planDecrypt(request)` — ALWAYS resolve
  `{ state: "BlockedByImplementation", ... }`. No ciphertext, no
  plaintext, no `SecretHandle`, no `ConversationKey`, no `MessageKey`
  is ever constructed, read, or returned.

**The Opaque API itself never invokes Rust.** It simply RECEIVES a
`FedosOpaqueRequest` and returns a decision — there is no
`packages/fedos-core-rust` import, no WASM, no FFI anywhere in
`fedos_opaque_api.ts`.

## 3. What `#planInternalExecution` actually does (Stage 322)

`FedosRuntimeCryptoProvider`'s private `#planInternalExecution(kind)`:

1. Plans and evaluates a `FedosRuntimeOperation` (Stage 313) — always `"Blocked"`.
2. Builds the corresponding `FedosOpaqueRequest` (Stage 314) — empty, no refs attached.
3. Calls `createFedosOpaqueApi()` to build a `FedosOpaqueApi`.
4. Calls `planFedosOpaqueApiExecution(api, request)`, which routes to
   `planEncrypt`/`planDecrypt` — always `"BlockedByImplementation"`.
5. **Discards the Opaque API's decision and returns.** It is never
   passed to `encrypt()`/`decrypt()`, never passed to Rust/WASM/FFI,
   never passed to Runtime or Worker.

`encrypt()`/`decrypt()` themselves remain UNCHANGED — this chain is
never called by them, never calls them.

## 4. The implementation-stage milestone (Stage 324)

`FedosProviderImplementationStage` tracks how far the INTERNAL
ARCHITECTURE (not any single operation) has progressed:

| Stage | Meaning | Reached? |
|---|---|---|
| `"Unavailable"` | No operation/opaque-request model exists | — (superseded) |
| `"ProviderReady"` | Provider/Operation/Opaque-Request models exist (Stage 313–320) | — (superseded) |
| `"OpaqueApiReady"` | Opaque API abstraction exists and is wired (Stage 321–328) | **YES — current state** |
| `"RustReady"` | RESERVED — Rust connection exists | No — unreachable this stage |

`fedosProviderImplementationStage()` is fixed, hand-maintained, and
returns `"OpaqueApiReady"` today.

## 5. Diagnostics (Stage 325)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
three more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `providerImplementationStage` | `fedosProviderImplementationStage()` | `"OpaqueApiReady"` |
| `opaqueApiState` | `fedosOpaqueApiState()` | `"NotConnected"` |
| `runtimeExecutionState` | `fedosProviderExecutionState()` (same computation as `providerExecutionState`) | `"BlockedByImplementation"` |

None of these expose a request, a handle, or any byte of secret
material.

## 6. Still true after this stage

- No Rust invocation, no WASM, no FFI, anywhere in the chain.
- No Runtime execution — `create_runtime.ts` never calls `planExecution()`.
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

- `docs/runtime_fedos_provider_execution.md` (Stage 313–320) — the
  operation/opaque-request model this stage's Opaque API sits on top of.
- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — the
  implementation flag this whole chain still gates on.
- `docs/runtime_crypto_activation_policy.md` / `docs/runtime_crypto_threat_model.md`
  — the fail-closed activation gate this internal execution model does
  not bypass.
