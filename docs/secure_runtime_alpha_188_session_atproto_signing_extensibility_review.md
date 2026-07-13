# Secure Runtime Alpha 188 — Session/ATProto Signing Extensibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 8 of the Alpha 181–190 Nostr Schnorr Signing Foundation Arc,
following Alpha 187's own Event Builder Compatibility Review.**

## 1. Why now

Alpha 179 already reviewed Identifier-layer extensibility (Descriptor
shape, Source Boundary pattern, `HkdfDomain` separation) against
Session/ATProto/Wallet. This Stage runs the SAME kind of review one
layer deeper — SIGNING — since a signature scheme, unlike an
identifier STRING format, carries real algorithmic content (curve
choice, signature equation) that a future protocol's own signing need
might either share or not.

## 2. Do Session and ATProto even use BIP-340 Schnorr? Reviewed, not
   assumed

- **Session** (the messenger protocol `HkdfDomain::Session` already
  reserves a domain for, Alpha 152) uses Ed25519 keys for its own
  identity/session-key material — a COMPLETELY DIFFERENT elliptic
  curve (Curve25519/Edwards, not secp256k1) with a different point
  representation, different scalar field, and a different signature
  scheme (EdDSA, not BIP-340 Schnorr-over-secp256k1) — even though
  EdDSA is ALSO, historically, a Schnorr-family construction (Alpha
  181 §2's own citation of k256's own doc comment already noted this:
  "EdDSA and its concrete instantiation Ed25519... becoming the first
  Schnorr variant to see mainstream standardization" — the SAME family
  NAME, a DIFFERENT curve and wire format entirely).
- **ATProto** (`HkdfDomain::ATProto`, Alpha 152) signs repository
  commits with ECDSA over EITHER secp256k1 OR P-256 (NIST), per the
  `did:key`/`multikey` conventions the AT Protocol specification
  itself uses — ECDSA, not Schnorr, even in the secp256k1 case:
  a DIFFERENT signature equation (`(r, s)` computed via a different
  formula, verified via a different pairing check) over the SAME
  curve `k256` already provides arithmetic for, but NOT the SAME
  scheme this Arc implements.

**Neither Session nor ATProto's own real-world signing convention is
BIP-340 Schnorr.** This Stage's own answer to "would Session/ATProto
signing reuse `FedosNostrSignatureHandle`/`derive_nostr_signature_internal`
as-is" is therefore NO, confirmed by reviewing each protocol's own
actual convention rather than assuming shared Schnorr-family lineage
implies shared code.

## 3. Four explicit prohibitions, extended to Signing specifically

Restating Alpha 175 §4/Alpha 179 §5's own established pattern, now for
the Signing layer:

- **`FedosNostrSignatureHandle` must NEVER be repurposed for an Ed25519
  Session signature or an ECDSA ATProto signature.** Neither shares
  this type's own 64-byte `r || s` BIP-340 layout with the SAME
  semantics — an Ed25519 signature is ALSO 64 bytes by coincidence
  (32-byte `R` + 32-byte `S`), but the two halves mean something
  DIFFERENT mathematically (Ed25519's own point-compression + scalar,
  not BIP-340's own field-element x-coordinate + scalar) — a byte-
  count coincidence is never sufficient reason to reuse a type
  (Alpha 175 §4's own "It's a PublicIdentifier is NEVER sufficient
  reason" principle, restated here one layer deeper: "it's 64 bytes"
  is never sufficient reason either).
- **`k256::schnorr` must NEVER be assumed reusable for Session's own
  Ed25519 signing.** A completely different curve library (e.g.
  `ed25519-dalek` or RustCrypto's own `ed25519`/`curve25519-dalek`)
  would be that protocol's OWN future dependency decision — explicitly
  NOT decided, foreclosed, or pre-approved by this Arc.
- **`k256::schnorr` must NEVER be assumed reusable for ATProto's own
  ECDSA signing, even though BOTH may use the SAME secp256k1 curve.**
  `k256`'s OWN `"ecdsa"` feature (a SEPARATE feature from `"schnorr"`,
  Alpha 181 §5, still EXCLUDED by this crate's `Cargo.toml`) would be
  that future Stage's own decision to enable — this Arc's own
  `"schnorr"` feature choice does not, and must not, imply `"ecdsa"`
  is now also approved.
- **`derive_nostr_signature_internal`'s own PATTERN generalizes; its
  own CODE does not.** A future
  `derive_session_signature_internal`/`derive_atproto_signature_internal`
  would take the SAME shape (`&SecretKeyHandle, &[u8; N]) -> Option<SignatureHandle>`,
  Fail Closed, deterministic where the underlying scheme allows it)
  but would call a DIFFERENT underlying library function, over a
  DIFFERENT secret key type, producing a DIFFERENT Handle type — never
  a parameterized/generic version of THIS Arc's own Nostr-specific
  functions.

## 4. What generalizes — the PROCESS, confirmed unchanged from Alpha
   179 §6, now demonstrated one layer deeper

Alpha 179 §6 already named what generalizes at the Identifier layer:
the Root → Account Index → deterministic-derivation PROCESS and the
`HkdfDomain` separation SCAFFOLD. This Arc's own Signing work adds
ONE further generalizable pattern, demonstrated (not merely
described) by Alpha 182/183's own concrete shape:

**Opaque output Handle (no `Clone`/`Debug`/`Serialize`/`wasm_bindgen`/
raw-byte-export) + a `derive_*_internal(&SecretKeyHandle, &Message) ->
Option<OutputHandle>` function, calling an existing, audited,
protocol-native library, Fail Closed on every invalid input, verified
by real determinism/separation/fail-closed execution tests.** A future
`Session`/`ATProto` signing Stage inherits this exact SHAPE — it does
not need to invent its own Handle-boundary discipline from scratch —
while supplying its OWN curve, its OWN library, and its OWN Handle
type, exactly as this Arc supplied Nostr's.

## 5. Structural confirmation (real inspection, this Stage)

- `HkdfDomain`'s ten variants (`RootKey`, `Identity`, `Storage`,
  `Conversation`, `Application`, `Nostr`, `Session`, `ATProto`,
  `Wallet`, `TestOnly`) remain unchanged — this Stage adds none.
- `SecretHandleKind`'s thirteen variants remain unchanged — no
  `SessionKeyMaterial`/`ATProtoKeyMaterial`/`WalletKeyMaterial` variant
  exists yet, confirming no Session/ATProto/Wallet secret derivation
  of any kind has been built ahead of a real need for one.
- `Cargo.toml`'s `k256` feature list (Alpha 181 §5): `arithmetic` +
  `schnorr` only — no `ed25519`-family crate, no `p256` crate, no
  second elliptic-curve library of any kind was added by this Arc.
- Zero reference to `Session`/`ATProto`/`Ed25519`/`ed25519` exists
  anywhere in `FedosNostrSignatureHandle`'s or
  `derive_nostr_signature_internal`'s own code (doc-comment mentions
  IN THIS STAGE'S OWN DESIGN DOC, reviewing the topic, are expected
  and excluded from this check — the check is against `lib.rs`, not
  this doc).

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add `SessionKeyMaterial`/`ATProtoKeyMaterial`/
  `WalletKeyMaterial` to `SecretHandleKind`.
- Does **not** add `ed25519`/`p256`/any second elliptic-curve crate to
  `Cargo.toml`.
- Does **not** enable `k256`'s own `"ecdsa"` feature.
- Does **not** implement any Session or ATProto signing function of
  any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_187_event_builder_compatibility_review.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`
- `docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md`
