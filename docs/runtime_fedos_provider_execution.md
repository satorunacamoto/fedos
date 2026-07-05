# FedOS Runtime Provider — internal execution model (Stage 313–320)

**Status: this document records real code.** It explains the internal
execution CHAIN `FedosRuntimeCryptoProvider`
(`src/runtime/fedos_runtime_crypto_provider.ts`) now models — and states
plainly that this stage stops the chain before it ever reaches FedOS.

## 1. The complete execution flow

```
1. FedosRuntimeCryptoProvider          (src/runtime/fedos_runtime_crypto_provider.ts)
     |
     v
2. FedosRuntimeOperation                (src/runtime/fedos_runtime_operation.ts, Stage 313)
     |   planFedosRuntimeOperation(kind) -> { kind }
     |   evaluateFedosRuntimeOperation(operation) -> { status: "Blocked", ... }
     v
3. Opaque Request                       (src/runtime/fedos_runtime_opaque_request.ts, Stage 314)
     |   buildOpaqueRequestFromOperation(operation) -> { operation: kind } (no refs attached)
     v
4. (Not Yet Connected)                  <-- STAGE 313-320 STOPS HERE (Stage 315)
     |
     v
5. FedOS / packages/fedos-core-rust     NOT reachable from this repository's TypeScript today
     |
     v
6. Internal Crypto (NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Every arrow above steps 1–3 is REAL code, callable today, and fully
covered by `npm test`. Every arrow from step 4 onward does not exist as
executable code anywhere in this repository's TypeScript — there is no
function, import, or code path connecting step 3's opaque request to
step 5.

## 2. What `planExecution()` actually does

`FedosRuntimeCryptoProvider.planExecution(kind)`:

1. Calls `planFedosRuntimeOperation(kind)` — builds a `FedosRuntimeOperation` (plain data: `{ kind }`).
2. Calls `evaluateFedosRuntimeOperation(operation)` — always resolves `{ status: "Blocked", ... }`.
3. Calls `buildOpaqueRequestFromOperation(operation)` — builds an EMPTY `FedosOpaqueRequest` (no key/plaintext/ciphertext refs attached — there is none to attach, since nothing outside this chain feeds it real request material).
4. **Discards the opaque request and returns.** The built request is
   never passed to `encrypt()`/`decrypt()`, never passed to
   `packages/fedos-core-rust`, never passed to WASM/FFI, never passed to
   Runtime or Worker.
5. Returns `{ operation: kind, state: "BlockedByImplementation", reason: "..." }` —
   the ONLY state this stage's implementation can ever produce, because
   `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
   (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 305) is fixed
   `false`.

`encrypt()`/`decrypt()` themselves are UNCHANGED — `planExecution()` is
an ADDITIONAL method, never called by them, never calling them.

## 3. What this stage explicitly stops before

- **Before FedOS.** No `packages/fedos-core-rust` function is imported
  or called anywhere in `fedos_runtime_operation.ts`,
  `fedos_runtime_opaque_request.ts`, or
  `fedos_runtime_crypto_provider.ts`.
- **Before Runtime.** `AppRuntime.crypto`/`create_runtime.ts` are
  untouched — nothing calls `planExecution()` automatically.
- **Before Worker.** `src/worker.ts` still does not import any of these
  files.
- **Before Rust.** No `Cargo.toml` change, no new `pub fn`, no WASM, no
  FFI.
- **Before any secret.** `FedosRuntimeOperation`/`FedosOpaqueRequest`
  carry only a `kind`/`operation` label and, at most, OPAQUE handle
  strings — never a `SecretHandle`, `ConversationKey`, `MessageKey`, or
  `Nip44WirePayload` value (all `pub(crate)`-private inside
  `packages/fedos-core-rust`, never exposed to TypeScript at all) — and
  never a plaintext/ciphertext byte.

## 4. Diagnostics (Stage 317)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
three fixed fields, each computed by a standalone, pure function that
needs no `FedosRuntimeCryptoProvider` instance:

| Field | Function | Fixed value today |
|---|---|---|
| `providerImplementationState` | `fedosProviderImplementationState()` | `"NotImplemented"` |
| `providerExecutionState` | `fedosProviderExecutionState()` | `"BlockedByImplementation"` |
| `providerOperationState` | `fedosProviderOperationState()` | `"Blocked"` |

None of these expose a request, a handle, or any byte of secret
material — each is a fixed label determined entirely by
`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`.

## 5. Still true after this stage

- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is STILL `false`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`, even with BOTH
  `FEDOS_CRYPTO_PROVIDER=fedos` AND
  `FEDOS_CRYPTO_ENABLED=explicit-dev-only` set.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- No Runtime, Worker, Relay, Storage, Nostr, or NIP-17 connection of any
  kind.

## See also

- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — the
  implementation flag/capability surface/decision vocabulary this
  stage's operation model builds on top of.
- `docs/runtime_crypto_activation_policy.md` / `docs/runtime_crypto_threat_model.md`
  — the fail-closed activation gate this internal execution model does
  not bypass.
