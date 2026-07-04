# Crypto Capability Matrix (Stage 150)

**Status: this document records a real, small implementation.**
`packages/fedos-core-rust/src/crypto/capability_matrix.rs` (new file, under
a new crate-private `crypto` module — `src/crypto.rs`) fixes
`CryptoCapability`: a nine-variant, non-sensitive label enumeration
naming every crypto capability this crate's design currently tracks. It is
a label ONLY — no status, no byte, no operation; `docs/crypto_diagnostics.md`
(Stage 151) is the companion document that pairs each label with a
readiness status.

This complements, and does not renegotiate, `docs/hkdf_internal_plan.md`
(the HKDF implementation this matrix's `Hkdf` entry names),
`docs/secret_lifecycle_implementation_plan.md`/`docs/secret_handle_api_shape.md`
(`SecretHandle`), and `docs/nonce_generation_policy.md`/
`docs/public_random_boundary.md` (`Random`/`Nonce`). Where this document and
any of those disagree, the earlier binding docs win — this is a naming
record, not a new design decision.

---

## 1. Purpose

- **Give every crypto capability this crate's design tracks one fixed,
  stable name**, so future docs, diagnostics, and reviews can refer to
  "the `Hkdf` capability" or "the `StorageKey` capability" unambiguously,
  instead of re-describing it in prose each time.
- **Not a status report.** `CryptoCapability` carries no readiness
  information — see `docs/crypto_diagnostics.md` for that.

## 2. The nine capabilities

| Variant | What it names | Backing implementation (if any) |
|---|---|---|
| `Random` | General-purpose CSPRNG bytes | `fedos_random_bytes_32` (Stage 137) |
| `Nonce` | AEAD nonce generation | `fedos_aead_nonce_96` (Stage 138) |
| `SecretHandle` | Real secret-byte holding | `secret_handle` module (Stage 79/144–146) |
| `Hkdf` | HKDF-SHA256 key derivation | `kdf_core::derive_secret_handle_internal` (Stage 147) |
| `Aead` | Authenticated encryption | `aead_core` skeleton (Stage 80); real seal/open staged, not built (`docs/hkdf_internal_plan.md` §10) |
| `Nip44` | NIP-44 encrypted direct messages | none yet |
| `Schnorr` | BIP-340/Nostr event signing | none yet |
| `StorageKey` | A storage-encryption-key derivation | `HkdfDomain::Storage` label exists (Stage 147); no consumer wired |
| `ConversationKey` | A conversation/messaging-key derivation | `HkdfDomain::Conversation` label exists (Stage 147); no consumer wired |

## 3. Shape

- **`CryptoCapability`** (`pub(crate) enum`, `Debug`/`Clone`/`Copy`/
  `PartialEq`/`Eq`) — nine variants, listed above, in the fixed order
  `CryptoCapability::ALL` (a `pub(crate) const [CryptoCapability; 9]`)
  enumerates them.
- **`as_static_label(self) -> &'static str`** — a fixed, lowercase
  `snake_case` string per variant (`"random"`, `"hkdf"`,
  `"conversation_key"`, ...), mirroring
  `crate::domain_label::DomainLabelKind::as_static_label`'s (Stage 88)
  "fixed label chosen at compile time" shape. Never built, formatted, or
  derived from any input.

## 4. Not part of this crate's public API

- `crypto` (`src/crypto.rs`), `capability_matrix`, and every item inside
  are `pub(crate)`-at-most — never `pub`, never re-exported from the crate
  root. This crate's public `pub fn` surface is UNCHANGED (still
  twenty-four functions).

## 5. What this module deliberately does NOT do

- Does not hold, compute, or expose a readiness status — that is
  `crypto_diagnostics_preview` (Stage 151, `docs/crypto_diagnostics.md`).
- Does not call `fedos_random_bytes_32`, `fedos_aead_nonce_96`,
  `SecretHandle`, `derive_secret_handle_internal`, or any AEAD/NIP-44/
  Schnorr function — it is a plain label enumeration, nothing more.
- Does not connect to the Runtime, Worker, storage, or Nostr in any way.
- Does not change `Cargo.toml`.

## 6. Test strategy (implemented, all passing)

- `CryptoCapability::ALL` contains all nine variants exactly once, in the
  documented order.
- `as_static_label` returns the documented fixed string for every variant,
  is stable across repeated calls, and every label is unique.
- No public (`pub`) item anywhere in the module.
- No secret byte, key, seed, plaintext, ciphertext, or passphrase field
  anywhere.
- No `unwrap`/`expect`/`panic!`/`unsafe` in production code.

## 7. Conclusion

- **Nine fixed, `pub(crate)`-only capability labels**, one per crypto
  concern this crate's design tracks — a naming convenience, not a status
  report, not a public API addition, not a new dependency.
