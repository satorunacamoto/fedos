# Secure Runtime Alpha 440 — Master Seed Authority Phase Gate

Phase A, Stage 10 — the Mandatory Phase Gate this Arc's own instruction
requires before Alpha 441. Each condition verified by REAL execution,
not inference from class names (this Arc's own binding rule).

| # | Condition | Result |
|---|---|---|
| 1 | Authority generation | `generate_succeeds_once_and_transitions_to_available` — real CSPRNG-drawn seed, real state transition |
| 2 | Sealed export | `seal_succeeds_on_an_available_authority_and_never_reveals_the_seed_in_plaintext` |
| 3 | Process/instance restart simulation | `restore_sealed_round_trips_to_the_identical_signing_identity` — a SECOND, independent `FedosMasterSeedAuthority::new()` instance restores from the first's sealed envelope |
| 4 | Sealed restore | Same test as #3 |
| 5 | Stable derived identity | Same test as #3 — asserts the full signed-event JSON (pubkey included) is byte-for-byte identical before/after restore |
| 6 | Stable Nostr account 0/1/u32::MAX keys | `sign_nostr_event_accounts_zero_one_and_u32_max_all_derive_different_pubkeys` |
| 7 | Wrong-key/passphrase failure | `restore_sealed_with_the_wrong_passphrase_fails_closed_and_leaves_authority_empty` |
| 8 | Corrupt-envelope failure | `restore_sealed_with_a_corrupted_ciphertext_fails_closed`, `restore_sealed_with_an_unrecognized_schema_version_fails_closed`, `restore_sealed_with_a_malformed_json_envelope_fails_closed_and_does_not_panic` |
| 9 | Clear behavior | `clear_on_an_available_authority_prevents_further_signing`, `clear_is_idempotent`, `clear_on_an_empty_authority_transitions_directly_to_cleared` |
| 10 | No raw secret getters | Grep-verified (Alpha 449): `FedosMasterSeedAuthority`'s public `impl` has exactly eight methods, none returning seed/key bytes |
| 11 | No nsec | Grep-verified: no `nsec`/`bech32`-secret-encoding function exists anywhere reachable from this authority |
| 12 | No secret in logs/docs/test snapshots | Every doc/test in this Arc asserts ABSENCE of the passphrase string in the sealed envelope (`seal_succeeds_on_an_available_authority_and_never_reveals_the_seed_in_plaintext`) and never prints a real seed/passphrase value |
| 13 | No Board/Outbox coupling | Grep-verified: no `board`/`outbox` identifier appears anywhere in the new `FedosMasterSeedAuthority` code |
| 14 | No p2p coupling | `p2p/` untouched — confirmed via `git status` before, during (per-command), and after this Arc |
| 15 | No new crypto | Every primitive (Argon2id, ChaCha20-Poly1305, CSPRNG) is an existing, already-adopted `Cargo.toml` dependency; base64url/JSON-field encoding is hand-written but is encoding, not cryptography |
| 16 | No generated artifacts committed | `packages/fedos-core-rust/target/`, `Cargo.lock`, `pkg/` all remain absent from `git status` |

## Rust-level result

`cargo check` — GREEN. `cargo test` (external `CARGO_TARGET_DIR`,
avoiding this environment's non-ASCII/space-containing path) — 515
passed, 1 pre-existing failure unrelated to this Arc (dependency-count
regression guard, confirmed via `git stash` to already fail at the
pre-Arc baseline, `Cargo.toml` itself untouched by this Arc). This is
the first Arc in this repository's own recorded history to get a real
`cargo test` run (every prior Arc's README status entry reports `cargo
test` failing to even BUILD due to a MinGW `dlltool` path issue tied to
this repository's own non-ASCII working-directory path) — resolved by
setting `CARGO_TARGET_DIR` to a plain-ASCII path outside the repository,
per this Arc's own "Use an external CARGO_TARGET_DIR if needed for the
Windows path problem" instruction.

## Gate verdict

**PASS.** All sixteen conditions verified by real execution. Phase B
(Alpha 441) may proceed.
