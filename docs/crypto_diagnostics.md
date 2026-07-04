# Crypto Diagnostics Preview (Stage 151)

**Status: this document records a real, small implementation.**
`packages/fedos-core-rust/src/crypto/diagnostics.rs` (new file, sibling to
`capability_matrix.rs` under the Stage 150 `crypto` module) fixes
`crypto_diagnostics_preview()`: a fixed, hand-maintained, DISPLAY-ONLY
snapshot pairing each `CryptoCapability` (`docs/crypto_capability_matrix.md`)
with a `CapabilityReadiness` label. It answers "what crypto capability is
currently connected?" for a developer/reviewer, at a glance, without
reading `src/lib.rs` end to end.

This complements, and does not renegotiate, `docs/crypto_capability_matrix.md`
(the label set this reports on) or `docs/hkdf_internal_plan.md` (the HKDF
implementation whose `Ready` status this reflects). Where this document and
any of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **A single, fixed function a developer can call (in `cargo test`, or a
  future internal tool) to see this crate's crypto readiness at a
  glance** — Random/Nonce/SecretHandle/HKDF `Ready`, AEAD `NotConnected`,
  everything else `NotImplemented`.
- **Display-only. Not a live health-check.** This is the single most
  important design decision this document fixes: `crypto_diagnostics_preview`
  NEVER calls `fedos_random_bytes_32`, `fedos_aead_nonce_96`,
  `SecretHandle::new_from_32_bytes_for_internal_use`,
  `derive_secret_handle_internal`, or any other crypto function to compute
  its answer. The table is a constant, reviewed BY HAND each stage a
  capability's status changes — this guarantees the function can never
  accidentally observe, let alone display, a real secret byte, since it
  never runs any operation that would produce one.

## 2. Current snapshot (as of Stage 151)

| Capability | Readiness | Why |
|---|---|---|
| `Random` | `Ready` | `fedos_random_bytes_32` (Stage 137), `cargo test`-verified. |
| `Nonce` | `Ready` | `fedos_aead_nonce_96` (Stage 138), `cargo test`-verified. |
| `SecretHandle` | `Ready` | Real 32-byte storage (Stage 144–146), `cargo test`-verified. |
| `Hkdf` | `Ready` | `derive_secret_handle_internal` (Stage 147), `cargo test`-verified. |
| `Aead` | `NotConnected` | `aead_core` skeleton exists (Stage 80); real seal/open staged in writing (`docs/hkdf_internal_plan.md` §10), not implemented. |
| `Nip44` | `NotImplemented` | No skeleton, no implementation. |
| `Schnorr` | `NotImplemented` | No skeleton, no implementation. |
| `StorageKey` | `NotImplemented` | `HkdfDomain::Storage` label exists (Stage 147); no consumer wired. |
| `ConversationKey` | `NotImplemented` | `HkdfDomain::Conversation` label exists (Stage 147); no consumer wired. |

**This table must be updated BY HAND** the next time any capability's
status changes (e.g. when AEAD moves from `NotConnected` to `Ready`) — it
is not derived from any other source of truth, so it can silently drift if
a future stage forgets to update it. Reviewing this table's accuracy is
part of that future stage's own review, not automated here.

## 3. Shape

- **`CapabilityReadiness`** (`pub(crate) enum`, `Debug`/`Clone`/`Copy`/
  `PartialEq`/`Eq`) — exactly three variants: `Ready`, `NotConnected`,
  `NotImplemented`.
- **`CapabilityReport`** (`pub(crate) struct`, same derives) — `capability:
  CryptoCapability`, `readiness: CapabilityReadiness`. Two non-sensitive
  labels, nothing else.
- **`crypto_diagnostics_preview() -> [CapabilityReport; 9]`** — `pub(crate)`,
  takes no parameter, returns a fixed 9-row table (never a `Vec`, matching
  `CryptoCapability::ALL`'s own fixed-size-array shape) in
  `CryptoCapability::ALL`'s order, every time it is called.

## 4. Not part of this crate's public API

- Every item in `diagnostics.rs` is `pub(crate)`-at-most — never `pub`,
  never re-exported. This crate's public `pub fn` surface is UNCHANGED
  (still twenty-four functions).

## 5. What this module deliberately does NOT do

- Does not call any crypto function to compute a readiness value (§1).
- Does not hold, display, or derive a secret byte, key, seed, plaintext,
  ciphertext, or passphrase — the table's only content is the two label
  enums above.
- Does not connect to the Runtime, Worker, storage, or Nostr in any way —
  no log line, no telemetry event, no network call.
- Does not change `Cargo.toml`.

## 6. Test strategy (implemented, all passing)

- `crypto_diagnostics_preview()` returns exactly nine rows, in
  `CryptoCapability::ALL`'s order.
- The `Ready` capabilities are exactly `Random`/`Nonce`/`SecretHandle`/
  `Hkdf` — no more, no fewer.
- `Aead` is specifically `NotConnected` (not `Ready`, not
  `NotImplemented`) — the one capability with a skeleton but no real
  implementation.
- The `NotImplemented` capabilities are exactly `Nip44`/`Schnorr`/
  `StorageKey`/`ConversationKey`.
- The preview is stable across repeated calls (a fixed table, not
  influenced by any external state).
- No `unwrap`/`expect`/`panic!`/`unsafe` in production code.

## 7. Conclusion

- **A fixed, hand-maintained, display-only crypto readiness snapshot** —
  four capabilities `Ready`, one `NotConnected`, four `NotImplemented`,
  exactly matching this crate's actual implementation state as of Stage
  151. Not a public API addition, not a new dependency, never touches a
  secret byte.
