# Secure Runtime Alpha 6601–6680 — Completion Declaration

**FedOS Secure Memory Store Production Wiring Arc**

## Declared: full completion

- [x] **Store production reachable.** Before this Arc, every
      `SecretHandleStore::new()`/`with_capacity()` call in the crate was
      `#[cfg(test)]`-only (verified by grep, recorded in the
      reconciliation report §3). `FedosMasterSeedAuthority::generate()`/
      `restore_sealed()` now construct one, in real, non-test production
      code, reachable through the SAME public WASM API TypeScript already
      calls today.
- [x] **One authority-owned Store generation.** `FedosMasterSeedAuthorityState::Available`
      now holds `{ store: SecretHandleStore, master_seed_id: SecretHandleId }`
      — one Store per `FedosMasterSeedAuthority` instance, matching this
      crate's own established "one Authority per running Desktop Runtime"
      pattern.
- [x] **Real Master Seed path.** `generate()`/`restore_sealed()`/`seal()`/
      `clear()` all updated; every existing cryptographic output preserved
      byte-for-byte (proven: `restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`
      and the full, unmodified `master_seed_authority_tests` suite).
- [x] **Real signing path.** `sign_nostr_event` now resolves through
      `with_master_seed`, with validation correctly reordered to happen
      BEFORE handle resolution (the mission's own required Phase E
      ordering).
- [x] **Real NIP-44 path.** `resolve_conversation_key`/`encrypt_nip44_wire`/
      `decrypt_nip44_wire` all updated; wire format unchanged; a real
      encrypt→decrypt round trip proven in the vertical slice.
- [x] **Ratchet ownership truth.** Documented explicitly (reconciliation
      report §5): in-memory session state stays unchanged (already
      correct); the seal/restore boundary now transitively inherits
      Store-gated shutdown through the SAME bridge every other production
      method uses — proven by
      `a_sealed_ratchet_secret_cannot_be_restored_through_a_different_authoritys_store`.
- [x] **Explicit shutdown cleanup.** `clear()` → `store.destroy(master_seed_id)`,
      an explicit, ID-based destroy call — not merely relying on `Drop`.
- [x] **Stale-handle denial after restart.** Proven structurally
      (`SecretHandleId` never crosses instance boundaries) and
      behaviorally (`restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`).
- [x] **Real WASM vertical slice.** `real_vertical_slice_generate_store_sign_nip44_ratchet_seal_stop_restart_restore`
      — real two-party signing, real NIP-44 round trip, real Direct
      Ratchet session + seal, real stop, real restart, real restore, real
      continued operation, all through the real, unmodified `#[wasm_bindgen]`
      public API. A real `wasm32-unknown-unknown --release` build was also
      produced.
- [x] **No raw-secret export.** Zero new `#[wasm_bindgen]` items (verified:
      structural guard item 11, plus the real WASM build's own `.d.ts`
      output — 14 exports, unchanged from the prior Arc). One new,
      narrowly-scoped `pub(crate)` accessor on `SecretHandle` itself
      (`expose_bytes_for_internal_master_seed_authority_bridge`), never
      WASM-reachable.

## Headline change

`FedosMasterSeedAuthorityState::Available(FedosMasterSeedHandle)` became
`Available { store: SecretHandleStore, master_seed_id: SecretHandleId }`
— the Master Seed's ownership moved from a direct struct field to a real,
generation-safe, opaque-ID Store registry, for the FIRST time anywhere in
this crate. Ten production call sites (`sign_nostr_event`,
`public_key_hex_for_account`, `resolve_conversation_key`,
`encrypt_nip44_wire`, `decrypt_nip44_wire`, `seal_direct_ratchet_secret`,
`restore_direct_ratchet_secret`, `seal`, `generate`, `restore_sealed`,
`clear`) were updated through two new private bridge helpers
(`with_master_seed`/`with_master_seed_bytes`) — `master_root`'s own
derivation chain, `SecretHandle`, and `SecretHandleStore` themselves were
never touched internally, matching the mission's own explicit "do not
redesign" instructions.

## A finding worth naming: the reconciliation report undercounted two call sites

The Phase A reconciliation report's own §4 enumerated ten call sites
resolving `FedosMasterSeedAuthorityState::Available` directly. During
implementation, a full-file grep after each edit revealed TWO more —
`encrypt_nip44_wire`/`decrypt_nip44_wire` — that the report's own initial
pass missed (both were folded into "resolve_conversation_key" narratively
but are, in fact, separate call sites with their own independent handle
resolution). Both were found and fixed before this commit; the execution
specification's own Phase F section records the correction. This is
named explicitly rather than silently absorbed, since an inventory that
undercounts its own targets — even by two, even when both were still
caught — is worth flagging as a process lesson: the FINAL verification
step (re-grepping for `FedosMasterSeedAuthorityState::Available` after
every edit) is what actually caught it, not the initial reconciliation
pass.

## Named, deliberate scope boundaries

1. **`restore_direct_ratchet_secret`'s own `pub fn` signature still
   returns `Option<Vec<u8>>`** — technically WASM-reachable, though never
   called directly from TypeScript in this crate's own production wiring
   (only from `FedosDirectRatchetSession::restore`, a Rust-to-Rust call).
   This is UNCHANGED from before this Arc; narrowing this signature was
   not this Arc's own scope (see the production secret-flow map's own
   note).
2. **No new page-locking or diagnostics surface.** Both were already
   honest (`Unsupported`/`NotRequested`, safe count-only diagnostics)
   from the prior Arc; this Arc found no new need and added none, per
   its own "no fake completeness" discipline.
3. **`DirectRatchetSessionState`'s own in-memory ownership is unchanged**
   — a deliberate decision (reconciliation report §5), not an oversight.

## Verification run

1. `cargo build --lib` — clean, zero warnings.
2. `cargo test` (native, full crate) — 639 passed (630 baseline + 9 new),
   1 failed (the same pre-existing `secp256k1_dependency_guard` 10-vs-11
   count, unrelated to this Arc, confirmed identical on `ed5128f`).
3. `npm run build:wasm` — real release build succeeded; 14 exports,
   unchanged; zero leaked test-fixture strings.
4. `npx vitest run test/secure_runtime_alpha_6601_6680_structural_guards.test.ts`
   — 11/11 passing.
5. Every pre-existing Secure Memory structural guard suite
   (6281-6360, 6441-6520) plus `fedos_core_rust_secret_handle*`/`dependency`
   — precise JSON-diff against the unmodified `ed5128f` base: **0 tests
   differ**.
6. `npm run typecheck:core` — clean except the same two pre-existing,
   unrelated errors already present on `ed5128f`.
7. No `p2p/`/`.tmp_gen/` file read, written, or referenced. Arc A's own
   worktree/branch (`arc/desktop-production-runtime-configuration-unification`)
   never inspected or touched.

## Files changed

One production Rust file (`lib.rs`) gained: one new narrow `SecretHandle`
accessor, a restructured `FedosMasterSeedAuthorityState` enum, two new
private bridge helpers, ten updated production methods, and one new
`#[cfg(test)]` module (9 tests). One new TypeScript structural guard test
file. Five new docs (this one plus four siblings). No `Cargo.toml`
change. No `package.json` change. No `p2p/`/`.tmp_gen/` change. No
Desktop/Electron/Shell/Host Bridge/Presentation/Renderer/Navigation/
Safety Center/Identity UI/Deletion UI file touched. No `SecretHandle`/
`SecretHandleStore`/Master Seed Authority/Ratchet protocol/NIP/WASM API
redesign.

## Recommend exactly one next Arc

**FedOS Secure Memory Production Secret-Lifetime Audit and Native Host
Isolation Review** — a review-only Arc tracing this Arc's own real
production secret lifetime end to end against
`docs/runtime_secure_memory.md` §12's own "secret lifetime audit"
checklist, and independently assessing whether a genuine native Desktop
Rust host process (as opposed to this crate's current
`wasm32-unknown-unknown`-only reality) is ever planned, which would be
the prerequisite this and every prior Secure Memory Arc's own honest
`Unsupported`/`NotRequested` page-locking status has been waiting on.
