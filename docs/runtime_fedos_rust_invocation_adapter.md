# FedOS Rust Invocation Adapter — the final abstraction layer (Stage 361–368)

**Status: this document records real code.** It explains the NINTH and
FINAL abstraction link `FedosRuntimeCryptoProvider`'s internal
execution chain now models — and states plainly that this stage stops
execution at the Rust Invocation Adapter.

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
     |
     v
7. Execution Review                     (src/runtime/fedos_rust_execution_review.ts, Stage 345)
     |
     v
8. Internal Rust Call (PLANNED ONLY)    (src/runtime/fedos_internal_rust_call.ts, Stage 353)
     |
     v
9. Rust Invocation Adapter              (src/runtime/fedos_rust_invocation_adapter.ts, Stage 361-363)
     |   planEncrypt(call) -> { state: "BlockedByImplementation", ... }
     |   planDecrypt(call) -> { state: "BlockedByImplementation", ... }
     v
10. STOP                                <-- STAGE 361-368 STOPS HERE (Stage 362)
     |
     v
11. Rust Crypto (packages/fedos-core-rust: NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–9 are REAL code, callable today, fully covered by `npm test`.
**Current execution stops at the Rust Invocation Adapter.** There is
no function, import, or code path anywhere in this repository
connecting step 9 to step 11's real Rust crypto.

## 2. What the Rust Invocation Adapter actually is

`FedosRustInvocationAdapter` (`src/runtime/fedos_rust_invocation_adapter.ts`)
is the FINAL abstraction layer a future, separate, explicitly-reviewed
stage would eventually fill in with a real `packages/fedos-core-rust`
call — imported ONLY by `fedos_internal_rust_call.ts`, never by
`AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`. Its one
implementation, `FedosRustInvocationAdapterPlaceholder`:

- `status()` — always reports `{ state: "NotConnected", ... }`.
- `planEncrypt(call)` / `planDecrypt(call)` — ALWAYS resolve
  `{ state: "BlockedByImplementation", ... }`. Neither method executes
  anything, allocates a payload, a plaintext buffer, a ciphertext
  buffer, or a key of any kind.

**The Rust Invocation Adapter itself never invokes Rust, WASM, or
FFI.** It simply RECEIVES a `FedosInternalRustCall` (the plain-data
plan from Stage 353) and returns a decision — there is no
`packages/fedos-core-rust` import, no WASM, no FFI anywhere in
`fedos_rust_invocation_adapter.ts`.

## 3. What the Internal Rust Call's extended wiring actually does (Stage 362)

`evaluateFedosInternalRustCall(call)`:

1. (Unchanged) Receive a `FedosInternalRustCall` (plain data: `{ kind }`).
2. Build a `FedosRustInvocationAdapter` via `createFedosRustInvocationAdapter()`.
3. Route `call` to it via `planFedosRustInvocationAdapterExecution` —
   always `"BlockedByImplementation"`.
4. **Discard the adapter's decision and return the EXISTING `"Planned"`
   status UNCHANGED.** The adapter's decision is never passed to
   `encrypt()`/`decrypt()`, never passed to Rust/WASM/FFI, never passed
   to Runtime or Worker.

## 4. The implementation-stage milestone (Stage 364)

`FedosProviderImplementationStage` now tracks SEVEN steps:

| Stage | Meaning | Reached? |
|---|---|---|
| `"Unavailable"` | No operation/opaque-request model exists | — (superseded) |
| `"ProviderReady"` | Provider/Operation/Opaque-Request models exist (Stage 313–320) | — (superseded) |
| `"OpaqueApiReady"` | Opaque API abstraction exists and is wired (Stage 321–328) | — (superseded) |
| `"RustBoundaryReady"` | Rust Boundary abstraction exists and is wired (Stage 329–336) | — (superseded) |
| `"RustApiReady"` | Rust API abstraction exists and is wired (Stage 337–344) | — (superseded) |
| `"RustInvocationAdapterReady"` | Rust Invocation Adapter exists and is wired (Stage 361–368) | **YES — current state** |
| `"RustReady"` | RESERVED — real Rust crypto connection exists | No — unreachable this stage |

`fedosProviderImplementationStage()` is fixed, hand-maintained, and
returns `"RustInvocationAdapterReady"` today.

## 5. Diagnostics (Stage 365)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` gain
three more fixed fields:

| Field | Function | Fixed value today |
|---|---|---|
| `rustInvocationAdapterState` | `fedosRustInvocationAdapterState()` | `"NotConnected"` |
| `rustInvocationAdapterReachable` | `fedosRustInvocationAdapterReachable()` | `true` — structurally wired, NOT a claim of real execution |
| `rustInvocationAdapterExecuted` | `fedosRustInvocationAdapterExecuted()` | `false` |

`providerImplementationStage` now reports `"RustInvocationAdapterReady"`.
None of these expose a payload, plaintext, ciphertext, or key of any
kind.

## 6. Still true after this stage

- No Rust execution, no WASM, no FFI, anywhere in the chain.
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
- No `Cargo.toml`/`package.json` change, no new Rust `pub fn`.

## See also

- `docs/runtime_internal_rust_call.md` (Stage 353–360) — the Internal
  Rust Call plan this stage's adapter sits behind.
- `docs/runtime_internal_execution_contract.md` (Stage 356) — the
  eight-link (now nine-link) contract this document extends.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  what remains before real execution could ever be considered.
