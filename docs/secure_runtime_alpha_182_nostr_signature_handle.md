# Secure Runtime Alpha 182 — FedosNostrSignatureHandle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, adding one new opaque type and
nothing else in this Stage's own scope. This is Stage 2 of the
Alpha 181–190 Nostr Schnorr Signing Foundation Arc, following Alpha
181's own decision to enable k256's `"schnorr"` Cargo feature.**

## 1. Why now

Alpha 181 confirmed k256 already ships a real, audited BIP-340
`Signature` type. Before deriving a real signature (Alpha 183), this
Arc's own Objective requires a dedicated, Opaque, crate-private Handle
type to hold one — the SAME "never a raw type from a third-party
crate crosses this crate's own internal boundary unwrapped" discipline
every other Handle in `master_root` already follows
(`FedosNostrSecretKeyHandle`, `FedosNostrPublicKeyHandle`,
`FedosProtocolRootHandle`, and further up the chain).

## 2. What was implemented

```rust
pub(crate) struct FedosNostrSignatureHandle {
    bytes: [u8; 64],
}

impl FedosNostrSignatureHandle {
    fn new_from_64_bytes_for_internal_use(bytes: [u8; 64]) -> Self {
        Self { bytes }
    }

    pub(crate) fn matches_for_internal_verification(&self, other: &Self) -> bool {
        bool::from(self.bytes.ct_eq(&other.bytes))
    }
}
```

Placed directly after `derive_nostr_public_key_internal` in
`master_root`, immediately before the `nostr_identifier_encoding`
module — grouping the three Nostr-key-material types
(`FedosNostrSecretKeyHandle` → `FedosNostrPublicKeyHandle` →
`FedosNostrSignatureHandle`) contiguously, without reordering or
touching any existing code around them.

## 3. Requirements — satisfied item by item

This Arc's own Alpha 182 instruction named five explicit requirements.
Each is satisfied, and independently confirmed by this Stage's own
structural inspection (§5 below), not merely asserted:

- **Opaque handle.** The single field, `bytes: [u8; 64]`, is
  module-private (no `pub`, not even `pub(crate)`) — unreachable from
  outside `master_root` by Rust's own privacy rules alone, with no
  further annotation needed.
- **No `Clone`.** No `#[derive(Clone)]`, no manual `impl Clone`.
- **No `Debug`.** No `#[derive(Debug)]`, no manual `impl Debug` (unlike
  `FedosNostrPublicKeyHex`/`FedosNostrNpub`, Alpha 172, which DO derive
  `Debug` because they are DEFINITIONALLY public string values — a
  signature Handle, by contrast, follows the SAME no-`Debug` discipline
  as every secret-adjacent Handle, even though a signature itself is
  not secret, for the SAME reason `FedosNostrPublicKeyHandle` also
  carries no `Debug`: uniform Handle-boundary discipline, not a
  secrecy claim about the specific bytes).
- **No `Serialize`.** No `serde::Serialize` derive or impl of any
  kind — this crate has never enabled `serde` in a production
  dependency (`docs/ciphertext_serialization_format_decision.md`,
  reconfirmed unchanged by Alpha 181 §5's own feature list).
- **No `wasm_bindgen`.** No `#[wasm_bindgen]` attribute anywhere on
  this type — confirmed by this Stage's own count check (§5): the
  crate's total stays fixed at 13, unchanged from Alpha 180's own
  closing state.
- **No raw byte export.** Zero public accessor of any kind returns
  `bytes`. This is STRICTER than `FedosNostrPublicKeyHandle`, which
  carries exactly ONE narrowly-scoped byte accessor for its own
  reviewed Encoder Boundary (Alpha 173) — no Encoder, Event Builder,
  or Runtime Boundary exists yet for a signature (Alpha 187/189, both
  review-only this Arc), so no accessor is added ahead of a real,
  reviewed need for one. `matches_for_internal_verification` — a
  constant-time (`subtle::ConstantTimeEq`) boolean comparison, the
  SAME shape every other Handle in this module exposes — is the ONLY
  operation this type supports.

## 4. Why plain bytes, not a `SecretHandle`

A BIP-340 signature is 64 PUBLIC bytes, meant to travel alongside the
event it signs — it is not secret material by definition, the SAME
reasoning `FedosNostrPublicKeyHandle` (Alpha 168 §4) already
established for the public key one level up this same chain. This
type therefore holds `[u8; 64]` directly, no `SecretHandle`/
`secrecy`/`zeroize` involved — but stays Opaque anyway, for the SAME
boundary-design-consistency reason `FedosNostrPublicKeyHandle` does:
one uniform Handle convention crate-wide, not because this specific
value needs secrecy protection.

## 5. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged (this type's own
  one non-constructor method, `matches_for_internal_verification`, is
  `pub(crate) fn`, which the crate's own count convention has never
  counted as a `pub fn` — the SAME distinction every prior Handle's own
  `pub(crate)` methods already relied on).
- `SecretHandleKind`'s thirteen variants: unchanged — no new variant
  added, since this type never wraps a `SecretHandle`.
- Zero `derive(...)` attribute of any kind appears on
  `FedosNostrSignatureHandle`'s own struct declaration.

## 6. What this Stage does NOT do

- Does **not** implement `derive_nostr_signature_internal` — that is
  Alpha 183's own deliverable (landed in the same `lib.rs` edit as
  this Stage, per this Arc's single-commit instruction).
- Does **not** add any accessor exposing `bytes` outside this type's
  own `matches_for_internal_verification` boolean comparison.
- Does **not** add a `PartialEq`/`Eq`/`Hash` derive of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml` (beyond Alpha 181's own already-landed feature-flag
  change), or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
