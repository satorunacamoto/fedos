# Secure Runtime Alpha 685 — Rust/WASM Boundary Review

Stage 5 of Phase A.

## Finding

The existing WASM authority (`FedosMasterSeedAuthority`,
`packages/fedos-core-rust/src/lib.rs`) could not already return the derived
public key — `sign_nostr_event()` derives one internally but never returns
it independently of a full signed event.

## Change made

One new, narrow `pub fn` on the existing `#[wasm_bindgen] impl
FedosMasterSeedAuthority` block:

```rust
pub fn public_key_hex_for_account(&self, account_index: u32) -> Option<String>
```

- Reuses the existing derivation chain byte-for-byte via a new
  `pub(crate)` sibling function in `mod master_root`,
  `derive_nostr_public_key_hex_from_master_seed_internal`, which mirrors
  `sign_nostr_event_from_master_seed_internal`'s own first five steps and
  stops before constructing/signing an event.
- Returns only the canonical lowercase hex public key.
- No secret getter of any kind is added. No `Debug`/`Clone`/`Serialize` on
  any secret-holding type. Fails closed (`None`) on an `Empty`/`Cleared`
  authority or any derivation failure. Never panics.
- No new Cargo dependency (`Cargo.toml` is byte-for-byte unchanged).

## Verification

`cargo test` — 9 new unit tests in `master_seed_authority_tests`:
empty/cleared-authority fail-closed, 64-char lowercase hex format,
determinism, differs across accounts (0, 1, `u32::MAX`), differs across
independently generated seeds, matches `sign_nostr_event()`'s own `pubkey`
for the same account, and restore-from-sealed-envelope yields the
identical hex. All pass; full crate `cargo test` shows 533 passed / 1
pre-existing unrelated failure (a stale Cargo.toml dependency-count guard,
already failing before this Arc — see Alpha 700's completion report).

This crossed the "stop and report before Cargo.toml changes" gate cleanly:
no Cargo.toml change was ever needed.
