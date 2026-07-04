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

## 7. Conclusion

- **Six fields named** (`version`, `algorithm`, `nonce`, `ciphertext`,
  `tag`, `aad` domain label) as the minimum a future ciphertext envelope
  needs — a naming record, not an implementation.
- **Serialization format, struct definition, and public API exposure are
  all explicitly UNFIXED** — left to the implementing stage's own review.
- **NIP-44 remains its own, separate, later stage** — not designed here.
- No code, test, or `Cargo.toml` change is authorized or made by this
  document.
