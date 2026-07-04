# Public encrypt/decrypt API Plan (binding, docs only — no code)

**Status: this document adds no code.** It fixes, in writing, the SHAPE a
future public `encrypt`/`decrypt` API would take — naming it, not building
it — the same "fix the shape before the implementation" approach
`docs/secret_handle_api_shape.md` used for `SecretHandle` and
`docs/ciphertext_envelope_plan.md` used for the ciphertext envelope.
Nothing under `src/`, `packages/`, `Cargo.toml`, or `test/` is changed by
this document, and no public `encrypt`/`decrypt`/`deriveKey` function
exists anywhere in this crate as of Stage 157–160 —
`encrypt_placeholder`/`decrypt_placeholder`/`derive_key_placeholder`
(Stage 69) remain the only public entry points, still returning a fixed
placeholder status, still implementing no cryptography.

This complements, and does not renegotiate,
`docs/aead_internal_implementation.md` (the internal AEAD implementation
this future API would eventually call), `docs/ciphertext_envelope_plan.md`
(the envelope this future API would eventually produce/consume),
`docs/secret_lifecycle_implementation_plan.md`/
`docs/secret_handle_api_shape.md` (`SecretHandle`, the only key-material
input this future API would ever accept), and
`docs/fedos_core_public_api_design.md` (this crate's standing public-API
design rules, which this document applies to the specific `encrypt`/
`decrypt` case). Where this document and any of those disagree, the
earlier binding docs win.

---

## 1. Purpose

- **Name the shape a future public `encrypt`/`decrypt` API would take**,
  so the eventual implementing stage has a reviewed shape to build
  against instead of inventing one under pressure.
- **Not an implementation.** No public function signature is added by
  this document. No code of any kind.
- **Binding on whichever future stage implements it.** That stage
  satisfies this shape (extending it only via its own explicit review,
  not silently) before shipping any public `encrypt`/`decrypt` function.

## 2. Why this is planned now, and not built now

- `docs/aead_internal_implementation.md` (Stage 152–156) and
  `docs/ciphertext_envelope_plan.md` (Stage 157–158) both explicitly
  deferred crossing the public API boundary to their own, later, separate
  stage. This document is that stage's PLANNING half — fixing the shape —
  while the ACTUAL public function remains future work
  (`docs/implementation_phase_roadmap.md` §1 item 6).
- **Order matters**: per `docs/implementation_phase_roadmap.md` §7 and
  this crate's Stage 156 recommendation, the internal AEAD seal/open
  bridge (connecting `AeadSealDecision`/`AeadOpenDecision` to
  `AeadCiphertextEnvelope`, `docs/ciphertext_envelope_plan.md` §9) is
  expected to land BEFORE this plan's shape is actually implemented — a
  public function needs something real to call internally; building the
  public boundary first would leave it either unimplemented or hastily
  wired straight to the internal seal/open functions without an envelope
  in between, undermining the whole point of Stage 157–158.

## 3. What a future public `encrypt`/`decrypt` API would accept

- **A key: `SecretHandle` only, never a raw byte.** Per
  `docs/fedos_core_public_api_design.md` and every internal AEAD/HKDF
  stage's own discipline so far, a public `encrypt`/`decrypt` function
  would accept a key ONLY as an already-provisioned `SecretHandle` (or a
  future public-facing handle type wrapping one) — never a `[u8; 32]`,
  never a `Vec<u8>`, never a `String`/password. A caller that has a raw
  key byte would need to go through a dedicated, narrowly-scoped
  provisioning function to obtain a `SecretHandle` first — that
  provisioning function is itself out of scope for this document, per
  `docs/secret_lifecycle_implementation_plan.md` §8.
- **Plaintext (for `encrypt`) or an envelope (for `decrypt`) — never a
  raw nonce parameter.** `encrypt` would draw its own nonce internally
  (via `fedos_aead_nonce_96()`, exactly as
  `docs/nonce_generation_policy.md` already requires of any future AEAD
  entry point) and return it bundled inside the resulting envelope —
  never accepting a caller-supplied nonce, for the same reasons
  `crypto::aead_internal::seal_internal` already enforces internally.
  `decrypt` would accept the envelope produced by a prior `encrypt` call
  (or received from another party) and extract the nonce FROM it, never
  as a separate parameter.
- **An envelope type, not raw ciphertext bytes.** Per
  `docs/ciphertext_envelope_plan.md`, the public API's ciphertext
  input/output would be a (by-then-public-facing, or public-crossing)
  envelope type carrying `version`/`algorithm`/`nonce`/`ciphertext`/`tag`/
  `aad` domain together — never a bare `Vec<u8>` the caller must
  separately track metadata for.
- **An AAD domain SELECTION, not free-form AAD text.** Mirroring
  `crypto::aead_internal::AeadAadDomain`'s "fixed label, never
  caller-supplied text" discipline — a public caller would select FROM a
  fixed, exposed set of domain labels (however that future stage chooses
  to expose them), never pass an arbitrary string as AAD.

## 4. What a future public `encrypt`/`decrypt` API would NEVER accept

- **A raw secret byte of any kind** — no `[u8; 32]` key, no password, no
  seed phrase, no mnemonic. `SecretHandle` (or its eventual public-facing
  wrapper) is the ONLY key-material input.
- **A caller-supplied nonce** — nonces are always drawn internally
  (`encrypt`) or extracted from a received envelope (`decrypt`), never
  passed in as a parameter, per `docs/nonce_generation_policy.md`.
- **Free-form AAD text** — only a fixed domain-label selection, never an
  arbitrary string, byte slice, or caller-constructed structure.
- **A raw ciphertext byte buffer with metadata tracked separately by the
  caller** — the envelope type carries everything needed to `decrypt`
  what `encrypt` produced; splitting that responsibility back onto the
  caller would defeat the entire point of Stage 157–158's envelope work.

## 5. Runtime/Storage connection — explicitly deferred, not designed here

- **Wiring a public `encrypt`/`decrypt` API into the Runtime (so
  application code can call it through `FedosCoreCrypto` or an equivalent
  seam) is its OWN, later, separate, explicitly-reviewed stage** — not
  authorized or designed by this document. This document fixes the
  Rust-side function SHAPE only; how (or whether) the TypeScript Runtime
  surface calls it is a distinct decision.
- **Wiring persisted ciphertext envelopes into storage (D1/KV/R2, or
  whatever this project's storage layer is at the time) is likewise its
  OWN, later, separate, explicitly-reviewed stage** — this document does
  not name a storage schema, a table column, or a serialization format
  for at-rest envelopes.
- **Neither connection is a prerequisite for this document to be
  useful.** The whole point of fixing the API shape now is so that,
  WHENEVER the Runtime/Storage connection stages happen, they build
  against an already-reviewed function signature rather than negotiating
  it under the pressure of also wiring two other systems at once —
  matching `docs/implementation_phase_roadmap.md` §2–§3's standing
  "one reviewed decision per stage" discipline.

## 6. NIP-44 — explicitly out of scope, its own future stage

- **NIP-44 is NOT a thin wrapper this plan pre-authorizes.** NIP-44 has
  its own versioned encryption scheme, its own padding scheme, and its
  own conversation-key derivation (distinct from this crate's `HkdfDomain`
  vocabulary, though a future NIP-44 stage may choose to reuse parts of
  it) — a future NIP-44 internal implementation planning stage (Stage 157
  candidate 2, still pending) makes that determination on its own, not
  here.
- **This crate's general-purpose `encrypt`/`decrypt` and a future
  NIP-44-specific implementation are two different things** that may or
  may not share code — this document does not decide that either way.

## 7. What this plan does NOT fix

- **No function signature.** No parameter list, no return type, no error
  enum for the eventual public API — those are the implementing stage's
  own decision, informed by (but not fixed by) this document's
  constraints above.
- **No timing for when this is implemented.** This document does not
  schedule the implementing stage — see
  `docs/implementation_phase_roadmap.md` for the roadmap ordering.
- **No decision on whether `encrypt`/`decrypt` become ONE function
  (algorithm-agnostic, matching the internal `AeadCipher` selection) or
  TWO PER ALGORITHM (mirroring how this crate currently keeps
  `ChaCha20Poly1305`/`Aes256Gcm` as sibling internal paths rather than one
  merged one)** — either is defensible; the implementing stage decides.

## 8. Conclusion

- **Key input: `SecretHandle` only** — never a raw byte, password, seed,
  or mnemonic.
- **Nonce: always internal (`encrypt`) or envelope-extracted (`decrypt`)**
  — never a caller-supplied parameter.
- **Ciphertext: an envelope type, not a bare byte buffer** — carrying
  version/algorithm/nonce/ciphertext/tag/AAD-domain together.
- **AAD: a fixed domain-label selection, never free-form text.**
- **Runtime and Storage connections are explicitly deferred** to their
  own, later, separate stages — not designed or authorized here.
- **NIP-44 remains its own, separate, future stage** — not designed here.
- No code, test, or `Cargo.toml` change is authorized or made by this
  document.
