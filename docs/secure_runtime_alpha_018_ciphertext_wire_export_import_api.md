# FedOS Secure Runtime Alpha 018 — Public Ciphertext Wire Export / Import APIs

**Status: IMPLEMENTED.** Executes
`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`'s
own formally-decided contract end to end — Rust Boundary through
`AppRuntime` — with no deviation from any of that document's ten
decided items. `Cargo.toml`/`package.json` are unchanged (no new
dependency); `encrypt()`, `decrypt()`, `generateAeadKey()`,
`randomBytes()`, `initializeCrypto()`, `runtimeCapabilities()`, and
`AeadCiphertextHandle` itself are all byte-for-byte unchanged.

## 1. Public Runtime API

```ts
exportCiphertext(
  ciphertext: AeadCiphertextHandle,
): Promise<AeadCiphertextWire | null>;

importCiphertext(
  serialized: AeadCiphertextWire,
): Promise<AeadCiphertextHandle | null>;
```

Both are wired into `AppRuntime` (`create_runtime.ts`/`types.ts`) as the
FIFTH and SIXTH public Crypto APIs, alongside `initializeCrypto`/
`runtimeCapabilities`/`randomBytes`/`generateAeadKey`/`encrypt`/`decrypt`
— none of which is modified, called, or read by either new field's own
implementation.

## 2. Why export and import shipped together, in this same Stage

`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` §7
formally decided this, executing Alpha 016 §3.1/§3.2's own reasoning:
export-without-import produces a wire string nobody can ever reverse —
not an independently useful primitive the way `encrypt()`-without-
`decrypt()` was (Alpha 009 §6/Alpha 011 §6's staged-Alpha precedent does
not transfer to a serialization PAIR). Both directions were designed,
reviewed, and implemented in this one Stage; at no point did this
repository's shipped `AppRuntime` expose one without the other.

## 3. The four-layer architecture, both directions

```
Export
AppRuntime.exportCiphertext()                              Public Runtime API
  |                                                        (create_runtime.ts / types.ts)
  v
attemptDevOnlyRuntimeExportCiphertext()                     Runtime Service
  |                                                        (fedos_runtime_export_ciphertext.ts)
  v
FedosWasmLoaderSkeleton.attemptDevOnlyExportCiphertextCall()  Rust Boundary reach
  |                                                        (fedos_wasm_loader.ts)
  v
serialize_aead_ciphertext()                                 Rust Boundary
  |                                                        (lib.rs, wasm_bindgen)
  v
encode_envelope_internal()                                  Internal Rust
                                                             (ciphertext_serialization.rs, Stage 186, UNCHANGED)

Import
AppRuntime.importCiphertext()                               Public Runtime API
  |                                                        (create_runtime.ts / types.ts)
  v
attemptDevOnlyRuntimeImportCiphertext()                     Runtime Service
  |                                                        (fedos_runtime_import_ciphertext.ts)
  v
FedosWasmLoaderSkeleton.attemptDevOnlyImportCiphertextCall()  Rust Boundary reach
  |                                                        (fedos_wasm_loader.ts)
  v
deserialize_aead_ciphertext()                                Rust Boundary
  |                                                        (lib.rs, wasm_bindgen)
  v
decode_envelope_internal()                                   Internal Rust
                                                              (ciphertext_serialization.rs, Stage 186, UNCHANGED)
```

## 4. Canonical JSON + base64url — reused, not reinvented

The `AeadCiphertextWire` string `exportCiphertext()` produces (and
`importCiphertext()` consumes) is the SAME canonical
`v`/`alg`/`aad`/`n`/`ct`/`tag` JSON + base64url text
`docs/ciphertext_serialization_format_decision.md` (Stage 182) fixed and
`packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs`
(Stage 186) already implements. This Stage adds **zero** new
serialization logic: `serialize_aead_ciphertext()`/
`deserialize_aead_ciphertext()` are thin `#[wasm_bindgen]` wrappers, each
calling its one existing codec function EXACTLY ONCE:

```rust
#[wasm_bindgen]
pub fn serialize_aead_ciphertext(ciphertext: &AeadCiphertextHandle) -> Option<String> {
    crate::crypto::ciphertext_serialization::encode_envelope_internal(ciphertext.inner().inner())
}

#[wasm_bindgen]
pub fn deserialize_aead_ciphertext(serialized: &str) -> Option<AeadCiphertextHandle> {
    let decision = crate::crypto::ciphertext_serialization::decode_envelope_internal(serialized);
    match decision.status {
        crate::crypto::ciphertext_serialization::CiphertextSerializationStatus::Valid => {
            decision.envelope.map(|envelope| AeadCiphertextHandle {
                inner: FedosCiphertextEnvelope::from_inner(envelope),
            })
        }
        _ => None,
    }
}
```

`encode_envelope_internal`/`decode_envelope_internal` themselves are
untouched. No `Cargo.toml` change — `serde`/`serde_json`/`hex` remain
`[dev-dependencies]`-only, exactly as before this Stage.

## 5. Branding — a compile-time boundary only

```ts
export type AeadCiphertextWire = string & {
  readonly __brand: "AeadCiphertextWire";
};
```

**This brand is a TypeScript-only, compile-time API-misuse boundary. It
is NEVER a runtime security boundary.** `__brand` is a phantom field —
erased at compile time, present on no actual runtime value, and
trivially bypassable via `"anything" as AeadCiphertextWire`. **All real
Fail-Closed security enforcement happens entirely inside Rust's
`decode_envelope_internal`**, which validates the ACTUAL string content
(version/algorithm/AAD-domain labels, base64url text, field
completeness) regardless of whether a caller obtained the brand honestly
or via a cast. A forged brand assignment gains a caller nothing beyond
silencing the type checker — `importCiphertext()` still Fails Closed to
`null` for any string, branded or not, that does not satisfy the real
Rust-side decoder.

## 6. Import input is COMPLETELY untrusted

`importCiphertext()`'s `serialized` argument may originate from a
future Secure Storage layer, a future network peer, or an adversarial
caller constructing an arbitrary string by hand. The Loader-level
`attemptDevOnlyImportCiphertextCall()` performs exactly ONE pre-Rust-call
check — is `serialized` even a genuine `string`? (`InvalidWireInputShape`
if not) — and defers ALL content validation
(version/algorithm/AAD-domain/base64url/field-completeness) entirely to
`decode_envelope_internal`, never duplicating or approximating that
logic in TypeScript. This mirrors
`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` §8's
Trust Boundary exactly.

## 7. `importCiphertext()`/`decrypt()` responsibility separation

**`importCiphertext()` validates WIRE STRUCTURE only.** It holds no key
and performs no AEAD operation — it neither checks nor guesses whether
the reconstructed envelope will later authenticate successfully against
any key. **A wire string CAN and WILL import successfully even if it
will later fail `decrypt()`'s own authentication check** (wrong key,
wrong AAD, tampering) — this is BY DESIGN, not a gap
(`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` §9).
`importCiphertext()` succeeding is a NECESSARY, but never SUFFICIENT,
precondition for a subsequent `decrypt()` call to succeed. The two
checks belong to two entirely separate, independently reviewed layers:

- **`importCiphertext()`** — "Is this a well-formed envelope." Structural
  only.
- **`decrypt()`** — "Does this envelope actually decrypt with this
  key/algorithm/aadDomain." Cryptographic only, per Alpha 015's own
  no-oracle discipline: key mismatch, AAD mismatch, algorithm mismatch,
  and tampering are ALL folded into the SAME undistinguishable `null`.

## 8. Distinguishing wire-structure failure from cryptographic failure — where each is checked

| Failure class | Checked by | Outcome |
|---|---|---|
| Malformed JSON, unknown version, unknown algorithm label, unknown AAD-domain label, invalid base64url, wrong nonce/tag length, missing/unknown/reordered field | `decode_envelope_internal` (Rust, Stage 186, unchanged) | `importCiphertext()` resolves `null` — structural rejection, before any cryptographic operation is ever attempted. |
| Wrong key, wrong AAD domain, wrong algorithm relative to what was actually sealed, tampered ciphertext | `fedos_decrypt()` via `decrypt_aead()` (Rust, Stage 166–176/1010, unchanged) | `decrypt()` resolves `null` — cryptographic rejection, collapsed into the SAME undistinguishable outcome as every other cause (Alpha 015). |

`importCiphertext()` never attempts to guess or verify cryptographic
validity; `decrypt()` never re-validates wire structure (it receives an
already-reconstructed, in-memory `AeadCiphertextEnvelope`).

## 9. Raw key / raw internal envelope are never exposed

- `exportCiphertext()` accepts ONLY a genuine `AeadCiphertextHandle`,
  verified structurally via the existing `isAeadCiphertextHandleShape()`
  BEFORE `serialize_aead_ciphertext` is ever called. A structurally-valid
  but non-genuine plain object (e.g. `{ kind: "AeadCiphertextHandle" }`
  with no other property) still passes that shape check — the REAL
  wasm-bindgen runtime type check inside `serialize_aead_ciphertext`
  itself is what then rejects it, surfacing as `CallFailed`
  (collapsed to `null`), never as a false success.
- Neither `serialize_aead_ciphertext` nor `deserialize_aead_ciphertext`
  ever touches a raw key. `AeadKeyHandle` is not a parameter of either
  function.
- The wire string exposes ONLY what Stage 182 §3 already fixed as
  wire-safe: a version tag, algorithm/AAD-domain LABELS (never raw AAD
  bytes), the nonce (not secret, per `docs/nonce_generation_policy.md`
  §9), and the ciphertext/tag bytes themselves. No raw internal
  `AeadCiphertextEnvelope`/`FedosCiphertextEnvelope` Rust struct is ever
  handed to JS directly — only the reviewed codec's own string output.
- `AeadCiphertextHandle` itself gains NO new public method: still
  exactly one `#[wasm_bindgen]`-annotated method (`kind`), no
  `Clone`/`Debug`/`Serialize` derive, no raw-byte getter, no `toBytes`/
  `serialize`-shaped method on the class itself. The ONLY way to obtain
  a NEW `AeadCiphertextHandle` from wire data is the single reviewed
  `deserialize_aead_ciphertext` seam.

## 10. Storage / Network / Worker / Production — still not connected

This Stage implements the Public API pair and nothing more:

- **No Secure Storage** of any kind — nothing is written to or read from
  disk, `localStorage`, IndexedDB, or any storage backend.
- **No Network connection** — nothing is sent to or received from any
  network transport.
- **No Worker connection** — `src/worker.ts` is untouched and contains no
  reference to `exportCiphertext`/`importCiphertext`/
  `serialize_aead_ciphertext`/`deserialize_aead_ciphertext`.
- **No Production connection** — Production remains fully unconnected to
  ANY Crypto API, unaffected by this Stage.

A text-safe, structured-clone-safe `AeadCiphertextWire` string is now
the correct PREREQUISITE shape for all of these — Secure Storage,
Network transport, Worker `postMessage`, Runtime-restart recovery,
Marketplace content delivery, DM, and BBS-style content posting — but
connecting to any of them remains its own, future, separately-reviewed
Stage.

## 11. Fail-Closed reason model (Loader-internal only, never surfaced publicly)

```ts
interface FedosWasmLoaderExportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly wire: AeadCiphertextWire | null;
  readonly reason:
    | "Succeeded"
    | "InvalidCiphertextHandle"
    | "SerializationFailed"
    | "InvalidWireOutputShape"
    | "NotInitialized"
    | "ExportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

interface FedosWasmLoaderImportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
  readonly reason:
    | "Succeeded"
    | "InvalidWireInputShape"
    | "DeserializationFailed"
    | "InvalidHandleOutputShape"
    | "NotInitialized"
    | "ImportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}
```

`exportCiphertext()`/`importCiphertext()` themselves resolve ONLY
`AeadCiphertextWire | null` / `AeadCiphertextHandle | null` — the
detailed reasons above exist purely for Loader-level diagnostics/testing
(mirroring `FedosWasmLoaderEncryptExecution`/`DecryptExecution`'s own
established shape exactly), never surfaced to a Public API caller, never
surfaced in Runtime/Worker diagnostics.

**Every one of the following resolves `null` at the Public API, with no
exception ever escaping:**

- Not Development Runtime (`PrototypeStillClosed`/`NotInitialized`).
- Generated artifact missing.
- JS Glue import failure.
- WASM initialization failure.
- `ciphertext` is not a genuine opaque handle shape (export) /
  `serialized` is not a genuine `string` (import).
- The wrapper function is absent from the retained module.
- The Rust call throws (including wasm-bindgen's own runtime rejection
  of a structurally-shaped-but-non-genuine handle).
- Rust returns a genuine `undefined`/`None` (`SerializationFailed`/
  `DeserializationFailed`).
- The return value is a genuine value but the wrong shape
  (`InvalidWireOutputShape`/`InvalidHandleOutputShape`) — including an
  empty string on the export side.

## 12. Confirmed unchanged

- `AppRuntime.initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
  `generateAeadKey()`/`encrypt()`/`decrypt()` — all confirmed unchanged
  by actual calls.
- `FedosWasmLoader`'s seven Plan interfaces and `planLoad()` — untouched.
- `encode_envelope_internal`/`decode_envelope_internal` — byte-for-byte
  unchanged.
- `fedos_encrypt()`/`fedos_decrypt()`/`fedos_generate_aead_key_32()` —
  byte-for-byte unchanged.
- `Cargo.toml`/`package.json` — no new dependency, no count change.
- `importKey()`/`exportKey()` — remain unimplemented.
- No Worker/Production/Secure Storage/Network connection of any kind.

## 13. What comes after

`importKey()`/`exportKey()` (for `AeadKeyHandle`) remain explicitly
deferred, per Alpha 007 §1/§9 and Alpha 012 §4's original deferral —
unaffected by this Stage. Connecting `exportCiphertext()`/
`importCiphertext()` to any real Secure Storage, Network transport, or
Worker channel remains its own, future, separately-reviewed Stage.

## 14. See also

- `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` —
  the binding contract this Stage executes without deviation.
- `docs/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review.md` —
  the review that opened this arc's ciphertext-wire question.
- `docs/ciphertext_serialization_format_decision.md` (Stage 182) /
  `packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs`
  (Stage 186) — the reused, unmodified wire codec.
- `docs/public_crypto_opaque_handles.md` — the opaque-wrapper discipline
  this Stage's raw-material non-exposure claims (§9) reaffirm.
- `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md` /
  `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md` — the
  `AeadCiphertextHandle`/no-oracle precedents this Stage's §7 extends.
