# Secure Runtime Alpha 436 — Rust Master Seed Authority Implementation

Phase A, Stage 6. Implements `FedosMasterSeedAuthority`
(`packages/fedos-core-rust/src/lib.rs`, crate-root level, NOT inside
`mod master_root`) — the narrowest opaque Rust/WASM authority owning a
real Master Seed.

## Placement decision

Defined at crate-root level, mirroring the existing AEAD section's own
placement, specifically so `master_root` itself continues to carry NO
`#[wasm_bindgen]` attribute anywhere in its own body — Alpha 422's own
regression guard, unbroken by this Arc (verified: `grep wasm_bindgen`
inside `mod master_root { ... }` still matches nothing).

## Requirements met

- **Zero leaking derives**: no `Clone`, `Debug`, `Serialize`,
  `PartialEq` on `FedosMasterSeedAuthority` or
  `FedosMasterSeedAuthorityState` (grep-verified, Alpha 449).
- **No raw-byte getter of any kind** — the public `#[wasm_bindgen] impl`
  exposes exactly seven methods: `new`, `is_available`, `is_cleared`,
  `generate`, `seal`, `restore_sealed`, `clear`, plus `sign_nostr_event`
  (Phase B, Alpha 444) — none return seed/key bytes.
- **Random seed generation in Rust only** — `generate()` calls
  `fedos_random_bytes_32()`, the crate's existing, already-reviewed
  CSPRNG entry point (`getrandom::fill`), not a new entropy source.
- **Existing root derivation reused** — `sign_nostr_event_from_master_seed_internal`
  (inside `mod master_root`) walks the COMPLETE, UNCHANGED Alpha
  146–200 chain (Identity Root → Application Root → Nostr Root →
  Account Secret Key → Public Key → Event → Event ID → BIP-340
  Signature).
- **Explicit `clear()`/`is_cleared()`**, fail-closed after clear
  (Alpha 434).
- **No panic across WASM** — every fallible internal step returns
  `Option`/`bool`; `restore_sealed()` and `seal()` never `unwrap()` on
  caller-controlled input.
- **Temporary buffers zeroized** — `seed_bytes`, `wrapping_key_bytes`,
  the Argon2 `memory_blocks` scratch buffer, and `plaintext` (in
  `restore_sealed`) are all explicitly `.zeroize()`d on every return
  path, success or failure, via the existing `zeroize` dependency.
- **No generic secret export** — `seal()` returns a sealed envelope,
  never raw bytes; there is no `export_raw_seed`/`sign(hash)`-style
  escape hatch.
- **No Relay/Board/Outbox logic, no account state cache** — the struct
  holds exactly one `FedosMasterSeedAuthorityState` field and nothing
  else.

## Why a `#[wasm_bindgen]` export, not an alternative boundary

Alpha 431 confirmed the existing `AeadKeyHandle`/`AeadCiphertextHandle`
precedent already proves a non-`Clone` opaque `#[wasm_bindgen]` struct
survives real cross-boundary use in this exact codebase; no other
"better existing secure boundary" was found for a value that must be
held, mutated (`generate`/`restore_sealed`/`clear`), and read
(`is_available`/`sign_nostr_event`) across multiple calls from
TypeScript. A `#[wasm_bindgen]` class is therefore the correct, already-
established choice, not a new architecture.

## Verification

28 dedicated tests in `master_seed_authority_tests` (`lib.rs`), plus
the full pre-existing crate suite — `cargo test` (external
`CARGO_TARGET_DIR`, see Alpha 440) — 515 passed, 1 pre-existing,
unrelated failure (`cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`,
confirmed via `git stash` to already fail at this Arc's own baseline,
before any file this Arc touches changed).
