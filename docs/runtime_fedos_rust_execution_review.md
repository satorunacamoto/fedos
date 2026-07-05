# FedOS Rust Execution Review — the last stop before real crypto (Stage 345–352)

**Status: this document records real code.** It explains the SEVENTH
and FINAL abstraction link `FedosRuntimeCryptoProvider`'s internal
execution chain now models — and states plainly that this stage stops
the chain here, permanently, with no real Rust crypto executed.

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
     |   reviewEncrypt(request) -> { approved: false, reason: "BlockedBeforeCrypto" }
     |   reviewDecrypt(request) -> { approved: false, reason: "BlockedBeforeCrypto" }
     v
8. STOP                                 <-- STAGE 345-352 STOPS HERE (Stage 346)
     |
     v
9. Rust Crypto (packages/fedos-core-rust: NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–7 are REAL code, callable today, fully covered by `npm test`.
There is no function, import, or code path anywhere in this repository
connecting step 7's Execution Review to step 9's real Rust crypto.

## 2. What the Execution Review actually is

`FedosRustExecutionReview` (`src/runtime/fedos_rust_execution_review.ts`)
is the LAST stop before any real Rust crypto invocation — imported
ONLY by `fedos_rust_api.ts`, never by `AppRuntime`/`create_runtime.ts`,
never by `src/worker.ts`. Its one implementation,
`FedosRustExecutionReviewPlaceholder`:

- `status()` — always reports `{ state: "Blocked", ... }`.
- `reviewEncrypt(request)` / `reviewDecrypt(request)` — ALWAYS resolve
  `{ approved: false, reason: "BlockedBeforeCrypto" }`. No crypto, no
  Rust/WASM/FFI call, no payload, no plaintext, no ciphertext, no key
  material is ever constructed, read, or returned.

**The Execution Review itself never invokes Rust, WASM, or FFI.** It
simply RECEIVES a `FedosOpaqueRequest` and returns a decision — there
is no `packages/fedos-core-rust` import, no WASM, no FFI anywhere in
`fedos_rust_execution_review.ts`.

## 3. What the Rust API's extended wiring actually does (Stage 346)

`FedosRustApiPlaceholder.planRustApiEncrypt()`/`planRustApiDecrypt()`:

1. (Unchanged) Receive an opaque request.
2. Build a `FedosRustExecutionReview` via `createFedosRustExecutionReview()`.
3. Route the request to it via `reviewFedosRustExecution` — always
   `{ approved: false, reason: "BlockedBeforeCrypto" }`.
4. **Discard the review's decision and return the Rust API's OWN,
   unchanged `"BlockedByImplementation"` answer.** The review's decision
   is never passed to `encrypt()`/`decrypt()`, never passed to
   Rust/WASM/FFI, never passed to Runtime or Worker.

## 4. Why the review is fixed at `BlockedBeforeCrypto`

`FedosRustExecutionReviewReason` names FIVE labels, but this stage's
implementation can only ever produce ONE:

| Reason | Meaning | Reachable this stage? |
|---|---|---|
| `"BlockedBeforeCrypto"` | Real Rust crypto execution has not been reviewed or approved at all yet | **YES — the only value produced** |
| `"RuntimeNotActivated"` | RESERVED — would apply once a real implementation exists but Runtime hasn't activated it | No |
| `"WorkerNotActivated"` | RESERVED — would apply once a real implementation exists but Worker hasn't activated it | No |
| `"RustExecutionNotApproved"` | RESERVED — would apply once dev-only execution approval becomes a real, distinct gate | No |
| `"FutureOnly"` | RESERVED — reserved for a future, separate, explicitly-reviewed stage | No |

`reviewEncrypt()`/`reviewDecrypt()` never branch on any condition in
this stage — `"BlockedBeforeCrypto"` is a fixed, hardcoded literal, not
computed from any check. This means it is not merely UNLIKELY that the
other four reasons appear; there is NO code path in this file that
could ever produce them.

## 5. Still true after this stage

- No real Rust crypto execution — `encrypt`/`decrypt` never run.
- No Runtime activation — `create_runtime.ts` never calls
  `reviewEncrypt()`/`reviewDecrypt()` or anything upstream of it.
- No Worker activation — `src/worker.ts` still does not import any of
  these files.
- No dev-only execution — `fedosRustExecutionApproved()` is fixed
  `false`, with no env path, parameter, or override anywhere.
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

## 6. Update (Stage 353–360): Internal Rust Call planning completed

`reviewEncrypt()`/`reviewDecrypt()` now ALSO build and evaluate a
`FedosInternalRustCall` (`src/runtime/fedos_internal_rust_call.ts`,
Stage 353) internally — then discard it and return this review's own,
unchanged answer. **Internal Rust Call planning is completed. Execution
still blocked.** See `docs/runtime_internal_rust_call.md` for the full
specification.

## See also

- `docs/runtime_internal_rust_call.md` (Stage 353–360) — the Internal
  Rust Call planning layer now sitting behind this Execution Review.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  the eight-item checklist tracking exactly what remains before real
  execution could ever be considered.
- `docs/runtime_fedos_rust_api.md` (Stage 337–344) — the Rust API seam
  this stage's Execution Review sits behind.
- `docs/runtime_fedos_rust_boundary.md` (Stage 329–336) — the Rust
  Boundary abstraction underneath that.
- `docs/runtime_crypto_activation_policy.md` / `docs/runtime_crypto_threat_model.md`
  — the fail-closed activation gate this internal execution model does
  not bypass.
