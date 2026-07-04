# Ciphertext Envelope Plan (binding, docs only — no code)

**Status: this document adds no code.** It fixes, in writing, the FIELD
LIST a future ciphertext envelope format would need — naming it, not
building it — the same "fix the shape before the implementation" approach
`docs/secret_handle_api_shape.md` used for `SecretHandle` before Stage
144–146 implemented it. Nothing under `src/`, `packages/`, `Cargo.toml`,
or `test/` is changed by this document, and no envelope type, struct, or
serialization function exists anywhere in this crate as of Stage 152–156.

This complements, and does not renegotiate,
`docs/aead_internal_implementation.md` (the AEAD implementation this
future envelope would wrap the output of),
`docs/nonce_generation_policy.md` (the nonce this envelope would carry),
and `docs/hkdf_internal_plan.md` (the key-derivation domain labels this
envelope's algorithm/domain fields relate to). Where this document and any
of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Name the fields a future ciphertext envelope format needs**, so the
  eventual implementing stage has a reviewed field list to build against
  instead of inventing one under pressure — before any public `encrypt`/
  `decrypt` API exists to produce or consume such a format.
- **Not an implementation.** No struct, no serialization
  (`serde`/binary/JSON) format, no version negotiation logic, no code of
  any kind.
- **Binding on whichever future stage implements it.** That stage
  satisfies this field list (extending it only via its own explicit
  review, not silently) before shipping any wire format.

## 2. Why an envelope is needed at all

- `seal_internal` (`docs/aead_internal_implementation.md`) returns a bare
  `ciphertext‖tag` byte buffer — it does NOT include which algorithm
  sealed it, which nonce was used, or which AAD domain was bound. A
  caller storing or transmitting this ciphertext needs all of that
  metadata to ever open it again — an "envelope" is the format that
  carries the ciphertext together with the metadata needed to open it.
- **This is a data-format design question, independent of the AEAD
  implementation itself** — `docs/aead_internal_implementation.md` §10
  already named this exact gap and deferred it here, per this crate's
  standing discipline of giving each design decision its own reviewed
  stage rather than bundling format design into the crypto primitive's
  own implementation stage.

## 3. Future envelope fields (named, not built)

A future envelope is expected to carry, at minimum:

| Field | Purpose | Notes |
|---|---|---|
| `version` | Format version, for forward compatibility | A small fixed-width integer or label; MUST be checked before any other field is interpreted, so a future format change can be detected and rejected cleanly rather than misparsed. |
| `algorithm` label | Which `AeadCipher` sealed this ciphertext (`ChaCha20Poly1305` / `Aes256Gcm`) | MUST be carried explicitly — `open_internal` needs to know which cipher to invoke; it does not "detect" the algorithm from the bytes themselves. |
| `nonce` | The 12-byte nonce used to seal | A nonce is not a secret (`docs/nonce_generation_policy.md` §9) — it is expected to travel alongside its ciphertext, so including it in the envelope is the whole point of that policy's own design. |
| `ciphertext` | The sealed bytes (`ciphertext‖tag`, or `ciphertext` and `tag` as separate fields — an open question for the implementing stage, see §5) | The variable-length payload. |
| `tag` | The authentication tag (if not already bundled into `ciphertext` per the cipher crate's own convention) | RustCrypto's `Aead::encrypt` already returns `ciphertext‖tag` concatenated — the implementing stage decides whether the envelope re-splits this or keeps it concatenated. |
| `aad` domain label | Which `AeadAadDomain` was bound as AAD | MUST be carried explicitly, for the same reason as `algorithm` — `open_internal` needs the exact same AAD domain used to seal, or authentication fails by design. |

## 4. What this plan does NOT fix

- **Serialization format is NOT decided.** Binary (fixed-offset fields),
  a length-prefixed/TLV format, JSON, CBOR, or something else — this
  document names the FIELDS, not their byte layout, encoding, or a
  `serde` derive. That is the implementing stage's own decision.
- **No struct exists yet.** No `pub(crate) struct CiphertextEnvelope { .. }`
  or equivalent is added by this document.
- **No version-negotiation policy is fixed** beyond "a version field must
  exist and must be checked first" — how many versions are supported
  simultaneously, deprecation policy, etc. are the implementing stage's
  own decisions.
- **No public API is authorized.** An envelope type existing internally
  does not, by itself, authorize a public `encrypt`/`decrypt` function
  that produces/consumes it — that remains its own, later, separate,
  explicitly-reviewed stage (Stage 157 candidate: "Public encrypt/decrypt
  API planning").

## 5. Open questions for the implementing stage

- Should `ciphertext` and `tag` be separate envelope fields, or should the
  envelope simply store the RustCrypto-convention concatenated
  `ciphertext‖tag` as one field? Either is defensible; the implementing
  stage picks one and documents why.
- Should the envelope be a `pub(crate)` type only (mirroring
  `AeadSealDecision`/`AeadOpenDecision`'s current scope), or does it need
  to eventually cross a public API boundary (once `encrypt`/`decrypt`
  goes public)? This plan takes no position — that is Stage 157's
  question, not this one's.
- Should `version` be a numeric integer, a label enum (mirroring this
  crate's existing `HkdfDomain`/`AeadAadDomain`/`AeadCipher` "fixed label,
  not a caller-chosen value" shape), or something else? Not fixed here.

## 6. NIP-44 is out of scope, explicitly

- **NIP-44 is its own, separate, future stage** (Stage 157 candidate:
  "NIP-44 internal implementation planning") — this envelope plan does
  not name NIP-44-specific fields (e.g. NIP-44's own versioned encryption
  scheme, its own padding scheme, or its own conversation-key derivation).
  A future NIP-44 stage may reuse this crate's `AeadCipher`/`AeadAadDomain`
  vocabulary, or may need its own — that decision is deferred to that
  stage's own review, not decided here.

## 7. Conclusion (Stage 152–156 status)

- **Six fields named** (`version`, `algorithm`, `nonce`, `ciphertext`,
  `tag`, `aad` domain label) as the minimum a future ciphertext envelope
  needs — a naming record, not an implementation.
- **Serialization format, struct definition, and public API exposure are
  all explicitly UNFIXED** — left to the implementing stage's own review.
- **NIP-44 remains its own, separate, later stage** — not designed here.
- No code, test, or `Cargo.toml` change is authorized or made by this
  document.

## 8. Stage 157–158 update — the skeleton is now IMPLEMENTED

- **`packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs` (new)
  turns §3's six fields into a concrete, `pub(crate)`-only skeleton**:
  `AeadCiphertextEnvelope` holds `version: AeadEnvelopeVersion`,
  `algorithm: AeadEnvelopeAlgorithm`, `nonce: [u8; 12]`, a fixed
  `ciphertext_placeholder: [u8; 4]` marker (NOT real ciphertext‖tag — see
  below), and `aad_domain: AeadEnvelopeAadDomain`.
- **§5's open questions are now answered for THIS skeleton, though not
  necessarily forever**: `ciphertext`/`tag` are kept as ONE combined
  field (matching RustCrypto's own `ciphertext‖tag` convention) rather
  than split; the envelope stays `pub(crate)`-only, not crossing any
  public boundary (there is none yet); `version` is a label enum
  (`AeadEnvelopeVersion`, exactly one variant, `V1`, mirroring this
  crate's "fixed label, no open choice" shape for what it currently
  produces), paired with a raw `u8` tag for the SEPARATE concern of
  validating an untrusted candidate version number (see below) — a future
  stage MAY revisit any of these, but they are no longer unfixed.
- **The ciphertext/tag field is STILL a placeholder, not real output.**
  `AeadCiphertextEnvelope::new_for_internal_use` always sets it to a
  fixed, non-secret 4-byte marker constant — it is NOT populated from
  `crypto::aead_internal`'s real seal function. Connecting the two is
  explicitly deferred to Stage 161 (§9 below fixes that future bridge's
  shape in writing, still not building it).
- **`validate_envelope_internal` fixes a validation layer, not a codec.**
  It takes untrusted CANDIDATE values — raw version/algorithm/AAD-domain
  discriminant bytes, a nonce byte slice, and a ciphertext-placeholder
  byte slice — and checks each structurally (version first, per §3's
  "MUST be checked before any other field" rule), returning a fixed
  `AeadEnvelopeStatus` (`Valid` / `InvalidVersion` / `InvalidAlgorithm` /
  `InvalidAadDomain` / `InvalidNonceLength` / `InvalidCiphertextPlaceholder`)
  and, on `Valid`, a constructed `AeadCiphertextEnvelope`. It performs NO
  authenticated-decryption verification (there is no real ciphertext to
  authenticate yet) and NO byte-level parsing of a single combined
  buffer — §4's "serialization format is NOT decided" still holds in
  full; this is deliberately validation-of-already-split-fields, not a
  wire-format decoder.
- **The algorithm/AAD-domain labels are deliberately NEW, SEPARATE types**
  (`AeadEnvelopeAlgorithm`/`AeadEnvelopeAadDomain`) from
  `crypto::aead_internal`'s own `AeadCipher`/`AeadAadDomain` — this
  skeleton stays unconnected from the real AEAD implementation, the same
  "leave unrelated skeletons unconnected" discipline this crate has used
  since Stage 79.

## 9. Stage 161 candidate — the future seal/open bridge (planning only, not built)

This section fixes, in writing, the shape a FUTURE stage connecting
`crypto::aead_internal`'s real seal/open results to
`AeadCiphertextEnvelope` would take — naming it, not building it.

- **A `pub(crate)` bridge function, not a public one.** E.g.
  `envelope_from_seal_decision_internal(decision: &AeadSealDecision,
  nonce: [u8; 12], algorithm: AeadEnvelopeAlgorithm, aad_domain:
  AeadEnvelopeAadDomain) -> Option<AeadCiphertextEnvelope>` — takes an
  `AeadSealDecision` (Stage 152–154) plus the same nonce/algorithm/AAD
  domain used to produce it, and constructs a REAL envelope whose
  ciphertext field is no longer the Stage 157–158 placeholder. This
  function stays `pub(crate)`-at-most, per this plan's §4 ("no public API
  is authorized").
- **The `ciphertext_placeholder: [u8; 4]` field's type itself would need
  to change** (to something that can hold the real, variable-length
  `ciphertext‖tag` `Vec<u8>` `AeadSealDecision::ciphertext` already
  produces) — that type change is this future stage's own decision to
  make and review, not pre-authorized here.
- **The reverse direction** (extracting an `AeadOpenDecision`-compatible
  input FROM an `AeadCiphertextEnvelope`, to call the real open function)
  is the same shape, mirrored: a `pub(crate)` bridge, not a public one.
- **Still no public `encrypt`/`decrypt`.** A working internal bridge does
  not, by itself, authorize crossing the public API boundary — that is
  `docs/public_encrypt_decrypt_api_plan.md`'s own, later, separate
  concern.
- **Still no serialization.** A real envelope (post-bridge) still does
  not need to be serialized to be useful internally — turning it into
  wire bytes remains its own, further, later stage.

## 10. Conclusion (Stage 157–158 update)

- **The envelope skeleton is now real code**, not just a field list —
  `AeadCiphertextEnvelope` + `validate_envelope_internal`, both
  `pub(crate)`-only, `cargo test`-verified.
- **The ciphertext field remains a fixed placeholder** — the real
  seal/open bridge (§9) is Stage 161 candidate work, not built here.
- **No public API, no serialization, no NIP-44** — all three remain
  exactly as unfixed/unbuilt as this document originally left them.

## 11. Stage 161–163 update — the bridge is now IMPLEMENTED

§9's planned bridge is now real code, in a new file,
`packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs` — see
test/fedos_core_rust_aead_envelope_bridge.test.ts for its dedicated checks.

- **`AeadCiphertextEnvelope`'s ciphertext field changes shape**, as §9
  anticipated: `ciphertext_placeholder: [u8; 4]` becomes
  `ciphertext: Vec<u8>`. The struct drops its `Copy` derive (`Vec<u8>` is
  not `Copy`) but keeps `Debug`/`Clone`/`PartialEq`/`Eq`. The ORIGINAL
  `new_for_internal_use` constructor is unchanged in signature and still
  produces a placeholder envelope (now storing the marker as a `Vec<u8>`);
  a NEW constructor, `new_with_ciphertext_for_internal_use`, is the only
  way to populate the field with real bytes.
- **`envelope_from_seal_decision_internal(decision: AeadSealDecision,
  nonce: [u8; 12], aad_domain: AeadAadDomain) -> Option<AeadCiphertextEnvelope>`**
  — takes an `AeadSealDecision` BY VALUE (not by reference, as §9's draft
  signature had it — avoids an unnecessary ciphertext clone) plus the same
  nonce/AAD domain used to produce it. Returns `None` if the decision's
  status was not `Ready` (there is no ciphertext to carry). This is the
  ONE place `AeadCipher`/`AeadAadDomain` (`aead_internal`) are mapped onto
  `AeadEnvelopeAlgorithm`/`AeadEnvelopeAadDomain` (`ciphertext_envelope`).
- **`open_decision_from_envelope_internal(envelope: &AeadCiphertextEnvelope,
  key: &SecretHandle) -> AeadOpenDecision`** — the reverse direction,
  exactly as §9 anticipated: extracts the algorithm/nonce/AAD-domain/
  ciphertext already carried by the envelope and calls
  `aead_internal::open_internal`. The caller never separately supplies a
  nonce or algorithm.
- **A Stage 157–158 SKELETON (placeholder) envelope is rejected by the
  open bridge via ORDINARY AEAD authentication failure** — there is no
  special-case "is this a placeholder" branch; the placeholder marker
  simply cannot authenticate against any real key, so it fails exactly
  like any other wrong/tampered ciphertext would
  (`AeadStatus::AuthenticationFailed`). This is verified directly by this
  module's own `placeholder_envelope_is_rejected_by_open_bridge` test.
- **Both bridge functions stay `pub(crate)`-only**, per this plan's §4 —
  no public API is authorized by this bridge existing. The public
  `fedos_encrypt`/`fedos_decrypt` functions that call into it are their
  own, separate, later stage — see `docs/public_crypto_api.md`.
- **Still no serialization.** The bridge converts between in-memory Rust
  types only; no wire format, JSON, base64, or CBOR encoding exists
  anywhere in this module.
