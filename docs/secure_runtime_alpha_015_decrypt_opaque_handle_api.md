# Secure Runtime Alpha 015 — Public Runtime decrypt() API (Opaque Handle Edition)

Stage 1010. Adds `AppRuntime.decrypt()` — the FOURTH public Crypto API
Runtime exposes, and the SECOND performing a real cryptographic
OPERATION — the counterpart to `encrypt()` (Stage 1009). Built directly
against Alpha 013's opaque `AeadKeyHandle` and Alpha 014's opaque
`AeadCiphertextHandle`: `decrypt()` accepts ONLY these two opaque
handles, never raw bytes for either, and reaches the existing, unchanged
`fedos_decrypt()` through a new thin wasm-bindgen wrapper.

This Stage implements `decrypt()` only. Ciphertext serialization, Secure
Storage, and `importKey()`/`exportKey()` remain unimplemented.

## Scope

**Allowed and done:** one new `#[wasm_bindgen]` item in `lib.rs`
(`decrypt_aead()`), a new `pub(crate) fn inner()` accessor on
`AeadCiphertextHandle` (Stage 1009's own doc comment already
anticipated this — mirroring `AeadKeyHandle::inner()`'s own addition,
which landed the same Stage `encrypt_aead()` itself was added), two
small private comparison helpers, a new Loader-level method
(`FedosWasmLoaderSkeleton.attemptDevOnlyDecryptCall()`), a new Runtime
Service file (`fedos_runtime_decrypt.ts`), a new Public Runtime API
field (`AppRuntime.decrypt()`), docs, tests.

**Forbidden and not done:** `importKey()`, `exportKey()`, Secure
Storage, Worker connection, Production connection, any change to
`fedos_decrypt()`'s own algorithm/signature/implementation, any change
to `encrypt()`/`generateAeadKey()`/`randomBytes()`/`initializeCrypto()`/
`runtimeCapabilities()`, any raw key or raw ciphertext byte returned or
accepted anywhere in the new surface, ciphertext serialization/
deserialization, `package.json` changes.

## The four layers

```
AppRuntime.decrypt()                                  Public Runtime API
    |                                                  (create_runtime.ts / types.ts)
    v
attemptDevOnlyRuntimeDecrypt()                         Runtime Service
    |                                                  (fedos_runtime_decrypt.ts)
    v
FedosWasmLoaderSkeleton.attemptDevOnlyDecryptCall()     Rust Boundary reach
    |                                                  (fedos_wasm_loader.ts)
    v
decrypt_aead()                                          Rust Boundary
    |                                                  (lib.rs, wasm_bindgen)
    v
fedos_decrypt()                                         Internal Rust
                                                        (lib.rs, Stage 166-176, UNCHANGED)
```

### Public Runtime API

```ts
AppRuntime.decrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  ciphertext: AeadCiphertextHandle,
): Promise<Uint8Array | null>
```

Deliberately symmetric with `encrypt()` — same parameter names, same
order (`key`, `algorithm`, `aadDomain`, payload), same `AeadAlgorithm`/
`AeadAadDomain` label types. The ONE asymmetry is the return shape:
`encrypt()` returns an opaque `AeadCiphertextHandle`; `decrypt()`
returns a plain `Uint8Array`. This is deliberate, not an oversight —
see "Why plaintext is a plain `Uint8Array`" below.

### Opaque Handles only — both inputs, never raw bytes

`key` MUST be the SAME opaque `AeadKeyHandle` (Stage 1008)
`generateAeadKey()` produces; `ciphertext` MUST be the SAME opaque
`AeadCiphertextHandle` (Stage 1009) `encrypt()` produces. There is no
code path anywhere in this Stage's new files that accepts, constructs,
or derives either from raw bytes. Both handles' own internal values
(`FedosAeadKeyHandle`/`FedosCiphertextEnvelope`) are read ONLY on the
Rust side, inside `decrypt_aead()` itself — never exposed to JS in any
form.

### Why plaintext is a plain `Uint8Array`

`encrypt()`'s ciphertext output stays opaque because the Ciphertext
boundary's own wire-format design is still undecided (this arc's own
earlier encrypt-boundary review) — an opaque handle sidesteps that
undecided question entirely. `decrypt()`'s plaintext output has no such
open question: recovering the caller's own original plaintext, in the
caller's own original shape, is decrypt's entire purpose. There is
nothing left to keep opaque — the plaintext was never secret FROM the
caller (the caller supplied it to `encrypt()` in the first place), and
wrapping it in a synthetic handle would only add a pointless layer the
caller would immediately have to unwrap. `fedos_decrypt()` itself
already returns plain `Vec<u8>` for exactly this reason (see its own
doc comment: "returning the caller's own requested plaintext is the
entire point of a decrypt call").

### Rust Boundary

```rust
fn fedos_aead_algorithm_matches_envelope(
    algorithm: FedosAeadAlgorithm,
    envelope_algorithm: crate::crypto::ciphertext_envelope::AeadEnvelopeAlgorithm,
) -> bool { /* ... */ }

fn fedos_aead_aad_domain_matches_envelope(
    aad_domain: FedosAeadAadDomain,
    envelope_aad_domain: crate::crypto::ciphertext_envelope::AeadEnvelopeAadDomain,
) -> bool { /* ... */ }

#[wasm_bindgen]
pub fn decrypt_aead(
    key: &AeadKeyHandle,
    algorithm: FedosAeadAlgorithm,
    aad_domain: FedosAeadAadDomain,
    ciphertext: &AeadCiphertextHandle,
) -> Option<Vec<u8>> {
    let envelope = ciphertext.inner();
    let inner_envelope = envelope.inner();
    if !fedos_aead_algorithm_matches_envelope(algorithm, inner_envelope.algorithm())
        || !fedos_aead_aad_domain_matches_envelope(aad_domain, inner_envelope.aad_domain())
    {
        return None;
    }
    let decision = fedos_decrypt(key.inner(), envelope);
    match decision.status {
        FedosDecryptStatus::Ready => decision.plaintext,
        _ => None,
    }
}
```

`decrypt_aead()` takes `key`/`ciphertext` BY REFERENCE, so neither
handle is consumed — both remain valid for a later call. It reaches
the real, permanently-opaque `FedosAeadKeyHandle`/`FedosCiphertextEnvelope`
via `AeadKeyHandle::inner()` (Stage 1008) and a NEW
`AeadCiphertextHandle::inner()` accessor this Stage adds — exactly the
addition Stage 1009's own doc comment already anticipated
("a future, separate, explicitly-reviewed Stage adds this crate's own
`pub(crate) fn inner()` reviewed seam once it exists to consume it").

**Why `algorithm`/`aad_domain` are validated BEFORE calling
`fedos_decrypt`.** `fedos_decrypt()` itself never accepted an
algorithm/AAD-domain parameter — both are already recovered from the
envelope internally (per its own unchanged signature,
`fedos_decrypt(key, envelope)`). This Stage's public `decrypt_aead`
REQUIRES the caller to state, up front, the SAME algorithm/domain
`encrypt()`'s own caller already used — matching the symmetric Public
API shape — and checks that the stated values match what was actually
sealed into `ciphertext` at `encrypt_aead()` time. A mismatch resolves
`None` immediately, WITHOUT ever calling `fedos_decrypt`. This is a
structural input-validation check, not a new cryptographic behavior:
the comparison happens across three label enums this crate's own
"separate label per boundary" discipline already keeps distinct
(`FedosAeadAlgorithm`/`AeadCipher`/`AeadEnvelopeAlgorithm`), using two
small, private, non-secret-touching comparison helpers.

**Why a mismatch is folded into the SAME `None` an authentication
failure produces, not a distinguishable Rust-side status.** This
mirrors `FedosDecryptStatus::AuthenticationFailed`'s own documented
design: "a SINGLE fixed label covering every decryption failure cause
... uniformly; this function never distinguishes WHY, per RFC 8439/
NIST AEAD guidance." Telling a caller WHICH check failed (wrong key vs.
wrong algorithm vs. wrong AAD domain vs. tampered ciphertext) is itself
an oracle — this Stage's own algorithm/AAD-domain pre-check follows the
exact same non-disclosure discipline the crate already established for
authentication failure, rather than inventing a new, more talkative
failure mode.

On ANY non-`Ready` `FedosDecryptStatus` (`InvalidKey`/
`AuthenticationFailed`/`InternalFailure`), `decrypt_aead()` returns
`None` — the SAME null-on-any-non-success pattern every other
wasm-bindgen wrapper in this crate already established. `fedos_decrypt()`
itself (Stage 166–176) — UNCHANGED, byte-for-byte. This Stage adds no
line to this function.

### Rust Boundary reach

`FedosWasmLoaderSkeleton.attemptDevOnlyDecryptCall(key, algorithm, aadDomain, ciphertext)`
— gated on the SAME six previously-recorded conditions every other Rust
Boundary reach method uses, PLUS four structural/label checks run
BEFORE `module.decrypt_aead` is ever read or called:

1. `key` must structurally satisfy `isAeadKeyHandleShape()` (reused
   from Stage 1008's own reach) — else `"InvalidKeyHandle"`.
2. `ciphertext` must structurally satisfy `isAeadCiphertextHandleShape()`
   (reused from Stage 1009's own reach) — else `"InvalidCiphertextHandle"`.
3. `algorithm` must be a known key of `AEAD_ALGORITHM_DISCRIMINANTS` —
   else `"InvalidAlgorithm"`. A runtime defense-in-depth check: TypeScript's
   own literal-union type does not survive an `as any` bypass at a
   public API boundary.
4. `aadDomain` must be a known key of `AEAD_AAD_DOMAIN_DISCRIMINANTS` —
   else `"InvalidAadDomain"`.

Once all four pass: checks, AT RUNTIME, ONLY `typeof module.decrypt_aead
=== "function"`. Absent: `"DecryptUnavailable"`. Present: calls
`module.decrypt_aead(key, algorithm, aadDomain, ciphertext)` (algorithm/
aadDomain translated to `lib.rs`'s own numeric discriminants via the
SAME two lookup tables `attemptDevOnlyEncryptCall()` already uses),
wrapped in `try`/`catch` Failing Closed to `"CallFailed"` on ANY thrown
error. A genuine `undefined` return (every Rust-side semantic failure
cause collapsed uniformly) resolves `"DecryptionFailed"`. A genuine
return that is neither `undefined` nor a real `Uint8Array` resolves
`"InvalidPlaintextShape"`. A genuine `Uint8Array` resolves `"Succeeded"`.

### Runtime Service

`fedos_runtime_decrypt.ts` (NEW file) — mirrors `fedos_runtime_encrypt.ts`
(Stage 1009) exactly: `attemptDevOnlyRuntimeDecrypt()` constructs a
FRESH `FedosWasmLoader` and drives it through the same four-step chain;
`decrypt()` wraps that call in `try`/`catch` — Fail Closed at the
Runtime Service boundary, on top of the Loader's own already-Fail-Closed
chain.

## Fail Closed

Every layer Fails Closed independently:

- **Not Development Runtime / artifact missing / import failed / WASM
  initialization failed**: the SAME six-condition gate every prior
  Crypto API uses; `decrypt_aead` is never even read. Resolves `null`.
- **`key` is not a genuine opaque handle** (`InvalidKeyHandle`): checked
  BEFORE the wasm call is attempted at all. Resolves `null`.
- **`ciphertext` is not a genuine opaque handle** (`InvalidCiphertextHandle`):
  same. Resolves `null`.
- **`algorithm` is not a known label** (`InvalidAlgorithm`): checked
  before the wasm call. Resolves `null`.
- **`aadDomain` is not a known label** (`InvalidAadDomain`): same.
  Resolves `null`.
- **Wrapper not present** (`DecryptUnavailable`): resolves `null`.
- **Rust call throws** (`CallFailed`): resolves `null` — no exception
  ever escapes this layer.
- **Wrong key, wrong algorithm/AAD domain (relative to what was
  actually sealed), a tampered ciphertext, or an internal failure**
  (`DecryptionFailed` — ALL collapsed uniformly, per this crate's own
  "never expose WHY a decrypt failed" AEAD discipline): resolves `null`.
- **Return value is not a genuine `Uint8Array`** (`InvalidPlaintextShape`):
  resolves `null`.
- **Exception anywhere in the Loader chain**: `decrypt()`'s own
  `try`/`catch` (Runtime Service boundary) converts it to `null` — no
  exception ever escapes past the Public Runtime API.

Verified: against this repository's own real, unmocked state (no
locally-generated JS glue committed), `decrypt()` resolves `null`. An
injected-loader test drives a genuine plaintext-recovery success end to
end, plus every Fail-Closed outcome above. Production/Unknown Runtime
Fail Closed even with a real, plaintext-returning mock present.

## Raw key/ciphertext material is never exposed — verified, not assumed

- `decrypt_aead()` reads `key`/`ciphertext`'s own internal values
  ONLY inside Rust, via `AeadKeyHandle::inner()`/`AeadCiphertextHandle::inner()`
  (both `pub(crate)`-only) — never copied, logged, or exposed to JS in
  any form.
- The comparison helpers
  (`fedos_aead_algorithm_matches_envelope`/`fedos_aead_aad_domain_matches_envelope`)
  compare LABEL ENUMS only — never a key byte, nonce byte, or ciphertext
  byte.
- No layer in this Stage's own new/changed TypeScript code reads,
  copies, logs, or serializes a raw key or ciphertext byte anywhere —
  only the RECOVERED PLAINTEXT (the caller's own original data) is ever
  returned, and only as the direct `Uint8Array` `fedos_decrypt()` itself
  already produces.

## Unchanged, confirmed by real calls

- `AppRuntime.initializeCrypto()` — still `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte.
- `AppRuntime.runtimeCapabilities()` — still exactly its Alpha 005 four
  fields.
- `AppRuntime.randomBytes()` — unaffected; constructs its own, entirely
  separate `FedosWasmLoader` instance.
- `AppRuntime.generateAeadKey()` — unaffected; still resolves an opaque
  `AeadKeyHandle` (or `null`).
- `AppRuntime.encrypt()` — unaffected; still resolves an opaque
  `AeadCiphertextHandle` (or `null`), unchanged since Stage 1009.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- Worker (`src/worker.ts`) — no reference to `decrypt`,
  `attemptDevOnlyRuntimeDecrypt`, `attemptDevOnlyDecryptCall`,
  `fedos_runtime_decrypt`, `decrypt_aead`, `fedos_decrypt`, or either
  opaque handle type anywhere.
- Production — no new environment branch, no new deploy-time wiring.
- `importKey()`/`exportKey()`/Secure Storage/ciphertext serialization —
  none implemented anywhere in this Stage.
- `Cargo.toml`/`package.json` — no new dependency.

## What comes after

`importKey()`/`exportKey()` remain deliberately unranked/deferred, per
Alpha 007's own original scoping. Ciphertext serialization (a real wire
format for `AeadCiphertextHandle`) remains its own, later, separate,
unresolved question — needed only once storage or transport requires
real bytes to cross a real boundary. Secure Storage remains
unimplemented and unscheduled. Runtime now has a complete, symmetric,
end-to-end `encrypt()`/`decrypt()` pair, both built entirely on opaque
handles, with no raw key or ciphertext byte ever crossing the Public
Runtime API in either direction.
