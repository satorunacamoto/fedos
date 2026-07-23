# Secure Runtime Alpha 6601–6680 — Phase A Reconciliation Report

**FedOS Secure Memory Store Production Wiring Arc**

Worktree: `C:\wt\secure-memory-store-production`
Branch: `arc/secure-memory-store-production-wiring`
Base commit: `ed5128f` ("Add Secure Runtime Alpha 6441-6520: FedOS Secure
Memory Secret-Flow Migration and Native Page-Locking Readiness Arc")

## 1. Alpha range verification

- Confirmed recorded, unrepaired historical collision: **5401–5480**
  (`be1bc0d9` "Direct Ratchet State and Sealed Persistence Foundation" /
  `b3b3a6d2` "Local Deletion Capability and Deletion-State Foundation").
- `git log --all --oneline --grep="6521-6600\|6601-6680"` returns zero
  hits — **6521–6600 and 6601–6680 are genuinely unused.**
- Arc A's own branch, `arc/desktop-production-runtime-configuration-unification`,
  already exists (confirmed via `git branch -a`) — expected to claim
  **6521–6600**, the earlier of the two reserved ranges, per the
  coordination brief.
- This Arc claims the next free range: **6601–6680**.
- Per the coordination brief: Arc A's worktree/branch/uncommitted files
  are not inspected, read, staged, or merged anywhere in this Arc.

## 2. Note on 6361–6440 / 6441–6520 renumbering

The prior session's own "Secure Memory Secret-Flow Migration" work was
originally committed as `df10a6c` under the range 6361-6440, which
collided with a concurrently-landed Desktop Beta Arc also claiming
6361-6440 (merge commit `76f7fab`, itself merging `fc48d64c` +
`33f29f22`). That collision was resolved (by a coordinating process
outside this Arc, before this Arc began) by re-landing the identical
content as `ed5128f` under 6441-6520 instead — this Arc's own base
commit. This report records that fact rather than re-litigating it; no
further action is taken here.

## 3. Full inventory — every remaining production secret category

Per mission instruction, for each candidate: Store-backed today?
production reachable? temporary raw copy? zeroized? destroyed? shutdown
cleanup? restart generation-safe? in scope? deferred?

| Category | Store-backed today | Production reachable | Temp raw copy | Zeroized | Destroyed | Shutdown cleanup | Restart generation-safe | In scope |
|---|---|---|---|---|---|---|---|---|
| **Master Seed** (`master_root::FedosMasterSeedHandle`, `FedosMasterSeedAuthority`) | No — held as a direct struct field, `Available(FedosMasterSeedHandle)` | Yes (the field itself) | N/A (field, not copy) | Yes (`clear()`) | Only via `clear()` (irreversible, no ID-based destroy) | Only via `Drop`/`clear()` | N/A — no generation concept exists today | **YES — Phase B/D primary target** |
| **`SecretHandleStore` itself** | — | **No — every construction site is `#[cfg(test)]`-only** (verified: `grep SecretHandleStore::new\|with_capacity` in `lib.rs` returns matches exclusively inside `mod tests`/`mod ...tests` blocks) | N/A | N/A | N/A | N/A | N/A | **YES — this is the wiring gap itself** |
| Identity/Application/Protocol Root | No (derived on-demand, never cached as a field) | Yes, transiently, inside each `master_root::derive_*_internal` call | Yes — each derivation step exposes bytes via its own narrow accessor, already zeroized (prior Arc verified) | Yes | N/A (never held beyond one derivation call) | N/A | N/A | Out of scope — already correct, on-demand, zeroized; no field-level gap exists to migrate |
| Nostr signing key (derived) | No (derived on-demand from Master Seed inside `sign_nostr_event_from_master_seed_internal`) | Yes, transiently | Yes, zeroized (verified) | Yes | N/A | N/A | N/A | Out of scope — same as above |
| **Signing operation itself** (`FedosMasterSeedAuthority::sign_nostr_event`) | Resolves the Master Seed via direct field access | Yes | N/A | N/A | N/A | N/A | N/A | **YES — Phase E, follows from the Master Seed fix** |
| **`resolve_conversation_key` (NIP-44 entry point)** | Resolves the Master Seed via direct field access | Yes | N/A | N/A | N/A | N/A | N/A | **YES — Phase F, follows from the Master Seed fix** |
| NIP-44 per-message keys (`Nip44MessageKeyDecision.handle`) | Yes (prior Arc, 6281–6360) | Yes | N/A | Yes (verified) | N/A (short-lived per-message, not authority-scoped) | N/A | N/A | Out of scope — already migrated, unrelated ownership model (per-message, not per-Runtime-generation) |
| Ratchet root/chain/ephemeral-private/message keys (in-memory session state) | Yes — each is its OWN `SecretHandle` field on `DirectRatchetSessionState` (verified unchanged, prior Arc's own finding re-confirmed) | Yes | N/A | N/A | Via the session's own `Drop` | Via `Drop` | N/A — sessions are per-conversation, not Runtime-generation-scoped | **Deferred — see §5** |
| **Ratchet seal/restore boundary** (`FedosMasterSeedAuthority::seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`, `FedosDirectRatchetSession::seal_*`/`restore`) | Zeroization already closed (prior Arc, 6441-6520); resolves the Master Seed via direct field access for the SEALING key derivation | Yes | Already zeroized (prior Arc) | Yes | N/A | N/A | N/A | **YES, transitively — the sealing key derivation goes through the SAME `FedosMasterSeedAuthority::with_master_seed` bridge this Arc adds, so it inherits Store-gated shutdown for free** |
| Device signing keys, Sender keys, Archive wrapping keys, Capability secrets, Deletion signing keys | — | — | — | — | — | — | — | Out of scope — confirmed (prior Arc) none of these exist anywhere in `packages/fedos-core-rust/src/` |

## 4. Exact production call sites resolving `FedosMasterSeedAuthorityState::Available`

Grepped `lib.rs` for `FedosMasterSeedAuthorityState::Available` — every
occurrence, all inside `impl FedosMasterSeedAuthority`:

1. `is_available()` — `matches!` check only, no handle access.
2. `generate()` — CONSTRUCTS the `Available` variant.
3. `seal()` — reads `handle.expose_bytes_for_internal_sealing()`.
4. `restore_sealed()` — CONSTRUCTS the `Available` variant.
5. `clear()` — DESTRUCTS the `Available` variant (via `std::mem::replace`).
6. `sign_nostr_event()` — passes `handle` into `master_root::sign_nostr_event_from_master_seed_internal`.
7. `public_key_hex_for_account()` — passes `handle` into `master_root::derive_nostr_public_key_hex_from_master_seed_internal`.
8. `resolve_conversation_key()` — passes `handle` into `master_root::derive_conversation_key_bytes_from_master_seed_internal`.
9. `seal_direct_ratchet_secret()` — passes `handle` into `fedos_derive_direct_ratchet_session_sealing_key_internal`.
10. `restore_direct_ratchet_secret()` — passes `handle` into the same function.

Every one of 6, 7, 8, 9, 10 needs a `&crate::master_root::FedosMasterSeedHandle`
— the derivation chain functions' own signatures are unchanged by this
Arc (per the mission's own "do not redesign the Master Seed Authority").

## 5. Ratchet ownership decision (Phase G, decided in Phase A per mission's own "document exact ownership" requirement)

`DirectRatchetSessionState` (`crypto/direct_ratchet_session.rs`) is a
**per-conversation** object with its own independent lifecycle — a
running Desktop Runtime may hold MANY concurrent Ratchet sessions, each
for a different peer/conversation, entirely independent of the ONE
Master Seed Authority (and its ONE Store generation) for the whole
Runtime. Forcing every session's own root/chain/private/message keys
into the SAME Store the Master Seed Authority owns would violate this
Arc's own mission instruction: "No Store sharing across unrelated
account/profile Runtime generations" — a Ratchet session is not the same
generation-scoped unit as the Authority itself, and collapsing them
would also risk the exact atomicity/redesign concern the mission
explicitly warns against ("Do not force every internal Ratchet field into
separate handles if that would weaken atomicity or redesign the
cryptographic core").

**Decision**: `DirectRatchetSessionState`'s own in-memory `SecretHandle`
fields remain exactly as they are (already correct, prior Arc's own
finding) — NOT moved into `FedosMasterSeedAuthority`'s Store. The
integration point this Arc actually wires is the SEAL/RESTORE boundary,
which ALREADY calls through `FedosMasterSeedAuthority::seal_direct_ratchet_secret`/
`restore_direct_ratchet_secret` — both of which resolve the Master Seed
via the SAME `with_master_seed` bridge this Arc adds for signing/NIP-44,
so sealing/restoring Ratchet secrets transitively becomes Store-gated
(denied once the Authority's Store generation is destroyed) WITHOUT
touching the Ratchet session's own internal ownership model at all. This
is named explicitly as the "narrowest production Store integration
consistent with the accepted Ratchet architecture" the mission's own
Phase G asks for.

## 6. Existing fixed-count/export guard tests inspected

- `crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
  — pre-existing 10-vs-11 discrepancy (unrelated to this Arc, recorded by
  the prior two Arcs, not touched here either).
- `test/fedos_core_rust_dependency.test.ts` — asserts `wasm-bindgen` wired
  to exactly one `#[wasm_bindgen]` fn (`version()`) and various
  `SecretBox`/`Secret`/`Zeroize`-never-`pub` checks — this Arc adds ZERO
  new `#[wasm_bindgen]` items, so this guard is expected to remain
  unaffected.
- `test/fedos_core_rust_secret_handle*.test.ts` — source-scans
  `mod secret_handle` for exact `pub fn` surface and forbidden algorithm
  names — this Arc adds ONE new narrow accessor
  (`expose_bytes_for_internal_master_seed_authority_bridge`) inside that
  module, matching its own established "one accessor per consumer"
  convention exactly (mirrors the 6281-6360 Arc's own precedent).

## 7. Conclusion — what this Arc actually builds

`FedosMasterSeedAuthorityState::Available(FedosMasterSeedHandle)` becomes
`Available { store: SecretHandleStore, master_seed_id: SecretHandleId }`
— the ONE production owner (Phase B), one Store per Authority instance
(= one Runtime generation, matching this crate's own established "one
Authority per running Desktop Runtime" pattern the TypeScript side
already uses). Every one of the ten call sites in §4 is updated through
two new private bridge helpers (`with_master_seed`/`with_master_seed_bytes`)
that resolve the Master Seed through `SecretHandleStore::use_handle`,
temporarily reconstruct a `FedosMasterSeedHandle` (or raw bytes) for the
scope of ONE derivation/seal call, and explicitly zeroize the temporary
copy immediately after — never touching `master_root`'s own derivation
chain, `SecretHandle`, or `SecretHandleStore` internals. `clear()` becomes
an explicit `store.destroy(master_seed_id)` call (previously
`handle.clear()`) — the SAME observable behavior, now going through the
Store's own generation-bumping destroy path.
