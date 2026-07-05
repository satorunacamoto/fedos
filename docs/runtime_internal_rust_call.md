# FedOS internal Rust call — specification (Stage 353–360)

**Status: this document records real code AND a future specification.**
It explains what `FedosInternalRustCall`
(`src/runtime/fedos_internal_rust_call.ts`) models today, and
specifies — WITHOUT implementing — what a real call would eventually
look like.

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
     |   planFedosInternalRustCall(kind) -> { kind }
     |   evaluateFedosInternalRustCall(call) -> { status: "Planned", ... }
     v
9. STOP                                 <-- STAGE 353-360 STOPS HERE (Stage 354)
     |
     v
10. Rust Crypto (packages/fedos-core-rust: NIP-44 wire, HKDF, ConversationKey, MessageKey, ChaCha20, HMAC, ...)
```

Steps 1–8 are REAL code, callable today, fully covered by `npm test`.
**Step 8 only PLANS a call — it never makes one.** There is no
function, import, or code path anywhere in this repository connecting
step 8 to step 10's real Rust crypto.

## 2. What is real today

`FedosInternalRustCall` (`kind: "Encrypt" | "Decrypt"`) is PLAIN DATA —
a label naming which operation a future call would represent, nothing
more. `planFedosInternalRustCall(kind)` builds one; `evaluateFedosInternalRustCall(call)`
always resolves `{ status: "Planned", reason: "..." }` — `"Executed"`
exists in `FedosInternalRustCallStatus` only as a RESERVED label;
nothing in this file can ever produce it.

`FedosRustExecutionReview.reviewEncrypt()`/`reviewDecrypt()` (Stage
354) now build and evaluate a `FedosInternalRustCall` internally — then
DISCARD the result and return their own, unchanged
`{ approved: false, reason: "BlockedBeforeCrypto" }` answer. **The
current implementation stops before invocation.**

## 3. Future call target (specification only — not implemented)

A future, separate, explicitly-reviewed stage would eventually connect
`FedosInternalRustCall`'s `"Encrypt"`/`"Decrypt"` kinds to
`packages/fedos-core-rust`'s existing `fedos_encrypt`/`fedos_decrypt`
`pub fn`s (`packages/fedos-core-rust/src/lib.rs`) — the SAME functions
already covered by that crate's own `cargo test` suite
(`docs/nip44_wire_crypto_completion.md`). No NEW Rust function would be
needed; the target already exists and is already tested independently
of this TypeScript chain.

## 4. Future input (specification only — not implemented)

The eventual call would need to translate an `OpaqueEncryptRequest`/
`OpaqueDecryptRequest` (`fedos_runtime_opaque_request.ts`) — which
carries only OPAQUE string handles — into whatever real key/plaintext/
ciphertext material those handles resolve to, via a SEPARATE, not-yet-
designed resolution step. This chain's own files will never resolve an
opaque handle to real bytes themselves; that resolution is explicitly
out of scope for `fedos_internal_rust_call.ts` and every file upstream
of it.

## 5. Future output (specification only — not implemented)

The eventual call's result would need to be translated back into a
`RuntimeCryptoDecision` (`src/runtime/crypto_provider.ts`) — `allowed`,
`state`, and a non-sensitive `reason` string — WITHOUT ever including
raw ciphertext/plaintext bytes in that decision object itself (mirroring
`RuntimeCryptoDecision`'s existing "no output bytes" discipline,
already enforced since Stage 249).

## 6. Future failure handling (specification only — not implemented)

Any real call would need to handle: an unresolvable opaque handle, a
Rust-side panic or error, and a malformed/unsupported operation kind —
each translating to a DENIED `RuntimeCryptoDecision`, never a thrown
exception that could crash Runtime or Worker. No such handling exists
today because no such call exists today.

## 7. Required invariants (apply to any future implementation)

- MUST NOT execute unless `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
  (`src/runtime/fedos_runtime_crypto_provider.ts`) is genuinely `true`
  — itself a future, separate, explicitly-reviewed stage's decision.
- MUST NOT execute unless `FedosRustExecutionReview` genuinely approves
  (`approved: true`) — itself a future, separate, explicitly-reviewed
  stage's decision (`docs/runtime_fedos_execution_approval_checklist.md`).
- MUST NOT expose `SecretHandle`/`ConversationKey`/`MessageKey`/
  `Nip44WirePayload` (all `pub(crate)`-private inside
  `packages/fedos-core-rust`) to TypeScript, ever.
- MUST NOT retain plaintext/ciphertext bytes beyond the single call —
  no caching, no logging, no diagnostics exposure.
- MUST remain independently invocable from Runtime and Worker
  activation — connecting this call to a real invocation path is NOT
  the same act as connecting Runtime/Worker to call it automatically
  (`docs/runtime_fedos_execution_approval_checklist.md` items 6–8).

## 8. Still true after this stage

- No Rust crypto execution, no WASM, no FFI, anywhere in the chain.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- **The current implementation stops before invocation** —
  `FedosInternalRustCall` is planned only, never executed.

## See also

- `docs/runtime_internal_execution_contract.md` (Stage 356) — the full
  precondition contract, naming which of the eight links exist today
  and which remain disconnected.
- `docs/runtime_fedos_rust_execution_review.md` (Stage 345–352) — the
  Execution Review layer this Internal Rust Call plan sits behind.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  the eight-item approval checklist this specification's invariants
  reference.
