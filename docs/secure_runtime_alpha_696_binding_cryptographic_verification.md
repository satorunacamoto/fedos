# Secure Runtime Alpha 696 — Binding Cryptographic Verification

Stage 16 of Phase A. Real cryptographic execution, at the layer where this
codebase already places its real-crypto test coverage: Rust `cargo test`
(the WASM loader's dev-only gate — `process.env.NODE_ENV === "development"`
exactly — means no existing TypeScript test in this repository exercises
real WASM signing/derivation; every existing TS-level signing test uses a
scripted loader-boundary mock, and this Arc follows that same, already-
established convention).

`packages/fedos-core-rust/src/lib.rs`, `master_seed_authority_tests`, 9
new tests:

1. `public_key_hex_for_account_fails_closed_on_an_empty_authority`
2. `public_key_hex_for_account_fails_closed_on_a_cleared_authority`
3. `public_key_hex_for_account_returns_exactly_64_lowercase_hex_chars`
4. `public_key_hex_for_account_is_deterministic_across_calls`
5. `public_key_hex_for_account_differs_across_accounts` (0, 1, `u32::MAX`)
6. `public_key_hex_for_account_differs_across_independently_generated_seeds`
7. `public_key_hex_for_account_matches_sign_nostr_events_own_pubkey_for_the_same_account`
   — the binding invariant itself, proven directly against real BIP-340
   derivation.
8. `public_key_hex_for_account_never_signs_and_never_touches_a_secret_byte`
9. `public_key_hex_for_account_restored_from_the_same_sealed_envelope_yields_the_identical_hex`

All 9 pass. Full crate `cargo test`: 533 passed, 1 pre-existing unrelated
failure (a stale Cargo.toml dependency-count guard already broken before
this Arc — see Alpha 700).

At the TypeScript level, the comparison LOGIC of
`FedosSigningAuthorityNostrAuthorBinding` is independently verified against
a scriptable fake `FedosNostrSigningAuthority` in
`test/secure_runtime_alpha_688_nostr_author_binding_authority.test.ts`,
covering account 0 vs. account 1 independence, mismatch, and unavailability
— the same "real crypto in Rust, wiring/logic in TypeScript" split this
codebase already established for `signEvent()` itself.
