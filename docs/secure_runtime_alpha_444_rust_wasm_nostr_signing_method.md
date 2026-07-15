# Secure Runtime Alpha 444 — Rust/WASM Nostr Signing Method

Phase B, Stage 4. Implements `FedosMasterSeedAuthority::sign_nostr_event`
— a method ON the Master Seed Authority itself (not a separate struct;
see Alpha 441/445 for why), the narrow signing facade this Stage's own
instruction names.

```rust
pub fn sign_nostr_event(
    &self,
    account_index: u32,
    created_at: f64,
    kind: u32,
    tags: Vec<String>,
    content: String,
) -> Option<String>
```

## Requirements met

- **Authority must be available** — returns `None` immediately if
  `self.state` is not `Available` (`sign_nostr_event_fails_closed_on_an_empty_authority`).
- **Supported kind checked** — `kind != 1` rejected before any
  derivation runs (`sign_nostr_event_rejects_every_kind_other_than_one`,
  all of `[0, 2, 3, 5, 7, 40, 10002]` rejected).
- **`created_at` validated** — must be finite, non-negative, a whole
  number, and within `u64` range before conversion
  (`sign_nostr_event_rejects_malformed_created_at`: `NaN`, `±Infinity`,
  `-1.0`, `1.5` all rejected).
- **Existing account derivation reused** — `derive_nostr_secret_key_internal`,
  unchanged.
- **Existing public-key derivation reused** — `derive_nostr_public_key_internal`,
  unchanged.
- **Existing canonical serializer reused** — the pre-image this
  function's own `derive_nostr_event_id_internal` hashes is produced by
  the SAME `serialize_nostr_event_canonical_internal` every other Event
  ID derivation in this crate already uses.
- **Existing Event ID derivation reused** — `derive_nostr_event_id_internal`,
  unchanged.
- **Existing BIP-340 signer reused** — `sign_nostr_event_internal`,
  unchanged.
- **Temporary secret material zeroized** — `secret_key.clear()` runs on
  EVERY exit path of `sign_nostr_event_from_master_seed_internal`
  (success and every failure branch), and every intermediate Root
  (`identity_root`/`application_root`/`nostr_root`) is `clear()`-ed
  immediately after its own single use — the same "borrow, derive,
  clear the derived intermediate" discipline every `derive_*_internal`
  function in this module already follows.
- **No arbitrary `sign(hash)`** — the ONLY thing ever signed is a
  NIP-01 event `Sha256` digest this function itself computes from
  caller-supplied `(account_index, created_at, kind, tags, content)` —
  there is no method anywhere that accepts a caller-supplied 32-byte
  hash to sign directly (grep-verified, Alpha 449).
- **No private-key export, no Relay logic, no Outbox mutation, no
  panic** — confirmed by direct inspection; every fallible step returns
  `Option`, propagated via `?`/explicit `match`.

## Determinism, verified

`sign_nostr_event_same_account_is_deterministic_across_calls`,
`..._different_content_derives_different_id_and_signature`,
`..._different_created_at_derives_different_id_and_signature`,
`..._different_tags_derive_different_id_and_signature`,
`..._accounts_zero_one_and_u32_max_all_derive_different_pubkeys` — five
tests covering every input dimension independently.
