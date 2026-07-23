# Secure Runtime Alpha 6441–6520 — Execution Report

**FedOS Secure Memory Secret-Flow Migration and Native Page-Locking
Readiness Arc**

## Phase A — Inventory

See `docs/secure_runtime_alpha_6441_6520_migration_inventory.md` for the
full table. Summary: of the eight named example categories, five are
entirely out of this Rust crate's scope (Device signing keys, Sender
keys, Archive wrapping keys, Capability secrets, Deletion signing keys —
none implemented in `packages/fedos-core-rust/src/` at all), three
(Identity signing keys, Master Seed root hierarchy, in-memory Ratchet
chain/root keys) were already `SecretHandle`-backed before this Arc, and
one real, previously-undetected gap was found: the Direct Ratchet
seal/restore boundary (`FedosDirectRatchetSession::seal_*`/`restore`),
where raw key bytes crossed multiple un-zeroized stack/heap locations on
their way into and out of `SecretHandle`-wrapped storage.

## Phase B — Replace remaining owned Vec<u8> secret storage

Migrated: the Direct Ratchet seal/restore boundary's zeroization
discipline (not its storage TYPE — the in-memory state was already
`SecretHandle`-backed; the gap was in the ephemeral copies at the
seal/unseal crossing). See the migration inventory document for the exact
before/after per function.

**Why no `SecretHandleStore`/opaque-ownership change was made here**: the
seal/restore boundary is inherently a byte-crossing point (Rust ↔ AEAD
ciphertext ↔ persisted string) — the raw bytes MUST exist transiently to
be sealed or to be reconstructed into a `SecretHandle`. `SecretHandleStore`
(prior Arc) governs ID-addressed ownership of ALREADY-constructed
`SecretHandle` values; it has no bearing on the transient copies that
exist for the single AEAD operation itself. The correct, narrow fix here
is exactly what was applied: explicit `.zeroize()` on every transient
copy, at every hop, matching this crate's own established convention
(`docs/runtime_secure_memory.md` §8-9) — not a redesign of `SecretHandle`
or the Runtime, per this Arc's own explicit prohibition.

## Phase C — Verification: no secret reaches TS, no Debug, no Serialize, no Clone

- `FedosDirectRatchetSession` (`lib.rs`) and `DirectRatchetSessionState`
  (`crypto/direct_ratchet_session.rs`) both carry **zero derive
  attributes** — confirmed unchanged by this Arc (structural guard item 7,
  `test/secure_runtime_alpha_6441_6520_structural_guards.test.ts`).
- `seal_root_key`/`seal_sending_chain_key`/`seal_receiving_chain_key`/
  `seal_local_ratchet_private_key` return `Option<String>` (an opaque,
  AEAD-sealed blob — never raw bytes); `seal_all_skipped_keys` returns
  `Vec<String>` of the same shape; `restore` returns
  `Option<FedosDirectRatchetSession>` — never a raw byte, in either
  direction (structural guard item 8).
- No `println!`/`eprintln!`/`dbg!` anywhere in the touched files
  (structural guard item 5).
- The one `format!` call in the touched region (`seal_all_skipped_keys`,
  building the returned `"{counter}:{public_hex}:{created_at}:{sealed}"`
  string) only ever interpolates the PUBLIC key (hex-encoded), a counter,
  a timestamp, and the already-AEAD-sealed ciphertext blob — never the raw
  secret `bytes` local (structural guard item 6).

## Phase D — Native page-lock readiness

Already satisfied by the prior Arc's own `mod page_locking`
(`lib.rs`, `PageLockingCapability::{Unsupported, NotRequested,
FutureNativeOnly, Active}`, `page_locking_capability()`). Re-verified this
Arc: `Active` is never returned by any code in this crate (this Arc adds
none), `mlock`/`VirtualLock`/`libc`/`windows-sys`/`region`/`memsec` are
still never called/imported/wrapped in `unsafe` anywhere. No native
Desktop Rust host process was added or found by this Arc's own inventory
sweep, so `Unsupported`/`NotRequested` remain the only real, honest
answers for this crate's two actual build targets
(`wasm32-unknown-unknown`, native `cargo test`/`cargo check`). No new code
was needed — this phase's own requirement ("expose Unsupported/Future
Native/Available, never overclaim") was already met.

## Phase E — Real Rust/WASM verification

| System | Verification | Result |
|---|---|---|
| Master Seed | `master_seed_authority_tests` (pre-existing, unchanged) | 630-test full-suite run passing |
| Ratchet | **New**: `direct_ratchet_session_sealing_tests::seal_and_restore_a_real_sender_session_round_trips_and_can_still_send` — real two-party session (real Master Seed authorities, real DH init, real seal of root/sending-chain/local-private keys, real restore, real post-restore encrypt proving the sending chain key survived correctly) | Passing |
| Ratchet (failure path) | **New**: `direct_ratchet_session_sealing_tests::restore_fails_closed_on_a_wrong_conversation_id` — a mismatched binding tuple fails AEAD authentication and returns `None`, never a partial/corrupted session | Passing |
| Ratchet (pre-existing) | `crypto::direct_ratchet_session::tests` (61 tests, including `restore_preserves_skipped_keys_so_a_late_out_of_order_message_still_decrypts`, exercising this Arc's own skipped-key zeroize fix) | Passing, unchanged |
| Signing | NIP-44/Nostr signing test suites (pre-existing, unchanged) | Passing |
| Archive | Out of scope — no Rust-side Archive code exists (see inventory) | N/A |
| Identity | Master/Identity/Application/Protocol Root hierarchy tests (pre-existing, unchanged) | Passing |

`npm run build:wasm` — real `wasm32-unknown-unknown --release` build
succeeded; generated `.d.ts` export surface confirmed byte-identical (14
`export class`/`export function` items, same as the prior Arc — zero new
WASM surface added by this Arc's own changes).

**No test of the `FedosDirectRatchetSession::seal_*`/`restore` WASM class
methods existed anywhere in this crate before this Arc** — every
pre-existing test exercised `DirectRatchetSessionState`'s own lower-level
methods directly. This Arc's two new tests are the first real, end-to-end
proof of the exact surface it modified.

## Phase F — Leak scan

Searched `lib.rs` (the touched seal/restore region) and
`crypto/direct_ratchet_session.rs` for: `hex`, `base64`, raw `String`
construction from secret bytes, un-zeroized `Vec<u8>`, `Debug`,
`println!`, `format!`. Findings:

- `hex`: only `fedos_encode_fixed_32_hex(&public)` — the PUBLIC ratchet
  key, never a secret.
- `base64`: none in the touched region.
- `String`: only device refs/conversation IDs/session IDs (already
  non-secret metadata) and the opaque sealed-blob strings themselves
  (AEAD ciphertext, not plaintext).
- `Vec<u8>`: `restore_direct_ratchet_secret`'s own returned decrypted
  plaintext — now zeroized on every exit path (Phase B).
- `Debug`: zero derive on either touched type (Phase C).
- `println!`/`format!`: see Phase C — clean.

## Verification run (this worktree)

1. `cargo build --lib` — clean.
2. `cargo test` (native, full crate) — 630 passed, 1 failed (the
   pre-existing `secp256k1_dependency_guard` 10-vs-11 count, confirmed
   identical via `git stash` A/B against `33f29f2`, unrelated to this
   Arc).
3. `npm run build:wasm` — real release build succeeded; `.d.ts`/`.wasm`
   scanned, zero new export surface, zero leaked fixture content.
4. `npx vitest run test/secure_runtime_alpha_6441_6520_structural_guards.test.ts`
   — 8/8 passing.
5. `npx vitest run test/secure_runtime_alpha_6281_6360_structural_guards.test.ts`
   — 20/20 passing, unchanged (prior Arc's own guards, re-verified).
6. `npx vitest run test/fedos_core_rust_secret_handle*.test.ts test/fedos_core_rust_dependency.test.ts`
   — precise JSON-diff against `33f29f2` (unmodified): **0 tests differ**.
   The 17 apparent failures observed during a manual re-run were confirmed,
   by the same A/B method, to be identical on the unmodified base commit
   too (pre-existing worktree-level flakiness, unrelated to this Arc's own
   diff — matches the precedent recorded in the prior Arc's own completion
   declaration).
7. `npm run typecheck:core` — clean except the same two pre-existing,
   unrelated errors already present on `33f29f2`.
8. No `p2p/`/`.tmp_gen/` file read, written, or referenced. Desktop Safety
   Center not read or touched.
