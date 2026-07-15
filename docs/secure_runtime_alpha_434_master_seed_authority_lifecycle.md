# Secure Runtime Alpha 434 — Master Seed Authority Lifecycle

Phase A, Stage 4. Defines `FedosMasterSeedAuthority`'s lifecycle,
implemented in `packages/fedos-core-rust/src/lib.rs` as
`FedosMasterSeedAuthorityState`.

## States (three, coarse, as this Stage's own instruction prefers)

```
Empty  ──generate()──▶  Available  ──clear()──▶  Cleared
  │                          │
  └──restore_sealed()────────┘   (also lands in Available)
  Empty ──clear()───────────────────────────────▶ Cleared
```

- **Empty** — constructed, nothing generated or restored yet. The ONLY
  state `new()` produces.
- **Available** — a real Master Seed (`FedosMasterSeedHandle`) is held.
- **Cleared** — `clear()` was called. Irreversible for this instance.

## Operations adopted

- `generate()` — Rust-only CSPRNG generation. Fails closed (`false`, no
  state change) unless currently `Empty`.
- `restore_sealed(envelope_json, passphrase)` — Argon2id-unwraps and
  AEAD-opens a sealed envelope (Alpha 435). Fails closed unless
  currently `Empty`.
- `seal(passphrase)` — exports the CURRENTLY held seed as a sealed
  envelope. Requires `Available`; never mutates state.
- `clear()` — zeroizes the held seed (if any) and transitions to
  `Cleared`. Idempotent; safe from any state.
- `is_available()` / `is_cleared()` — pure, non-secret state reads.

**Not added**: no `reset()`/`reinitialize()` (a cleared or already-
generated authority is permanent for its own instance — construct a
NEW `FedosMasterSeedAuthority` for a new Identity, per this Stage's own
instruction), no raw-byte getter of any kind, no `Debug`/`Clone`/
`Serialize` derive on `FedosMasterSeedAuthorityState` or
`FedosMasterSeedAuthority` itself (grep-verified in Alpha 449).

## Rules enforced (verified by `master_seed_authority_tests`, 28 tests, all passing)

- Generation occurs only inside Rust (`fedos_random_bytes_32`, the
  crate's existing CSPRNG call) — TypeScript supplies no seed material
  to `generate()`.
- `generate()` never overwrites an `Available` or `Cleared` authority
  (`generate_fails_closed_on_an_already_available_authority`,
  `generate_fails_closed_on_a_cleared_authority`).
- `restore_sealed()` never overwrites an `Available` authority
  (`restore_sealed_never_overwrites_an_already_available_authority`) —
  it does not even attempt to parse/decrypt the envelope first, so a
  malicious or accidental restore call against a live identity fails
  before touching the envelope at all.
- `clear()` is irreversible for the instance
  (`clear_on_an_available_authority_prevents_further_signing`) and
  idempotent (`clear_is_idempotent`).
- No hidden automatic generation in the constructor, no module-load
  generation — `new_authority_starts_empty_not_available_not_cleared`
  confirms a freshly-constructed authority is neither `Available` nor
  `Cleared`.
