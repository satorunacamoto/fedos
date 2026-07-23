# Secure Runtime Alpha 6601–6680 — Execution Specification

**FedOS Secure Memory Store Production Wiring Arc**

See the reconciliation report for the full inventory. This document
records what was actually built, phase by phase.

## Phase B — Store ownership model

**One `SecretHandleStore` owned by one `FedosMasterSeedAuthority`
instance.** This crate's own established pattern — the TypeScript side
already constructs exactly ONE `FedosMasterSeedAuthority` per running
Desktop Runtime (`src/desktop/production_activation/`) — already gives
this the "one Store per Runtime generation" shape the mission requires,
with zero new lifecycle concept needed.

| Requirement | Implementation |
|---|---|
| Creation | `generate()`/`restore_sealed()` each construct a fresh `SecretHandleStore::with_capacity(1)` |
| Unique Store generation | Every `FedosMasterSeedAuthority` instance owns its OWN Store — never shared, never a global |
| Maximum live handles | `with_capacity(1)` — this Authority's Store ever holds exactly one secret, for its entire lifetime |
| Handle identity generation | `SecretHandleId`'s own generation counter (prior Arc's `secret_handle_store` module, unmodified) |
| Access synchronization | None needed — `use_handle` takes `&self`, safe for concurrent shared reads by construction (Phase J) |
| Scoped borrow/use | `with_master_seed`/`with_master_seed_bytes` — the ONLY two call paths into the Store |
| Consume | N/A — the Master Seed itself is never "consumed" (moved out); every consumer gets a scoped, zeroized COPY |
| Destroy | `clear()` → `store.destroy(master_seed_id)` |
| Shutdown | `clear()` is the shutdown path; `Store::drop()` is the backstop |
| Drop fallback | `SecretHandleStore::drop()` (prior Arc, unmodified) — zeroizes any still-live handle |
| Restart behavior | A NEW `FedosMasterSeedAuthority::new()` owns a NEW, independent Store — no `SecretHandleId` ever crosses instance boundaries (it is a private field) |

**Not built**: one Store per operation (explicitly prohibited by the
mission) — a single Store lives for the Authority's own full lifetime.
**Not built**: a global process-wide singleton — each Authority instance
owns its own Store, matching the existing architecture's own "one
Authority per Runtime" pattern exactly, never requiring a singleton.

## Phase C — generation-safe handles

Every requirement is satisfied by the PRIOR Arc's own `SecretHandleStore`
(unmodified) plus this Arc's own consistent use of it:

| Requirement | Mechanism |
|---|---|
| Stale generation rejected | `SecretHandleStoreDenial::StaleGeneration` |
| Wrong Store rejected | Structural — a `SecretHandleId` from one Store instance is never presented to another (never exposed outside the Authority) |
| Wrong kind rejected | `SecretHandleStoreDenial::WrongKind` — every `use_handle` call in this Arc passes `SecretHandleKind::MasterSeedMaterial` explicitly |
| Destroyed handle rejected | `SecretHandleStoreDenial::Unknown` |
| Double destroy closed | `SecretHandleStoreDestroyOutcome::AlreadyDestroyed` — proven by `double_clear_is_idempotent_and_never_panics` |
| Unknown handle rejected | `SecretHandleStoreDenial::Unknown` |
| Handle ID reuse cannot revive a stale handle | Generation-bump on destroy (prior Arc) — `a_stale_id_is_denied_after_its_slot_is_reused` (prior Arc's own test, still passing, unchanged) |
| Bounded handle count | `with_capacity(1)` |
| No enumeration of secret content | `SecretHandleStore` has no iterator (prior Arc, structurally guarded) |
| Safe count/status diagnostics only | `secure_memory_foundation_diagnostics` (prior Arc) — not extended this Arc; no new diagnostic need was found |

No generation internals are exposed as an oracle: `SecretHandleId` never
leaves `FedosMasterSeedAuthority`'s own private field.

## Phase D — production Master Seed wiring

`generate()`/`restore_sealed()`/`seal()`/`clear()` all updated — see the
reconciliation report §4 items 2-5. Preserved exactly: every existing
cryptographic output (signature bytes, derived public keys, sealed
envelope ciphertext) is byte-for-byte identical to before this Arc —
proven by `restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`
(same public identity survives seal→restore through the NEW Store-backed
path) and the full, unmodified `master_seed_authority_tests` suite (all
passing, unchanged).

- No raw Master Seed returned to TypeScript: unchanged (already true
  before this Arc — `seal()`/`public_key_hex_for_account()`/
  `sign_nostr_event()` never returned raw bytes; this Arc's own new
  `debug_log_and_leak_scan_the_signed_event_and_sealed_envelope_never_contain_the_raw_seed_material`
  test re-confirms it for the NEW code path specifically).
- Temporary copies zeroized: `with_master_seed`'s own `temp.clear()`;
  `with_master_seed_bytes`'s returned copy is zeroized by each caller
  exactly as it already was before this Arc (`seal()`'s own existing
  `seed_bytes.zeroize()` calls, unchanged).
- Wrong passphrase constructs no usable handle:
  `wrong_passphrase_constructs_no_usable_handle_and_leaves_authority_empty`.
- Store owns the live Master Seed handle: structurally, per Phase B.
- Destroyed Master Seed handle cannot sign or derive:
  `real_vertical_slice_...` and `every_production_method_fails_closed_on_a_never_generated_authority`.

## Phase E — production signing authority

`sign_nostr_event`'s own body now follows the mission's exact required
ordering:

1. Validate `kind`/`created_at`/`tags` — moved BEFORE handle resolution
   (previously resolved the handle first).
2. `self.with_master_seed(...)` resolves the handle.
3. `SecretHandleStore::use_handle` verifies generation/kind internally.
4. The closure borrows the reconstructed `FedosMasterSeedHandle` — never
   held beyond the closure's own scope.
5. `master_root::sign_nostr_event_from_master_seed_internal` signs
   (UNCHANGED function).
6. The borrow ends when the closure returns.
7. `temp.clear()` zeroizes the temporary wrapper.
8. Only the signed event JSON is returned — no private key output, no
   fingerprint/hash diagnostic.

Concurrent sign/destroy is addressed in Phase J.

## Phase F — NIP-44 production wiring

`resolve_conversation_key`/`encrypt_nip44_wire`/`decrypt_nip44_wire` all
updated (reconciliation report §4 items 8, plus the two additional sites
found during implementation, `encrypt_nip44_wire`/`decrypt_nip44_wire`,
which the reconciliation report's own call-site enumeration undercounted
— corrected here). Wire format unchanged — `master_root::encrypt_nip44_wire_from_master_seed_internal`/
`decrypt_nip44_wire_from_master_seed_internal` are UNCHANGED functions.
Wrong handle kind/destroyed/stale handle all denied via the SAME
`with_master_seed` bridge every other production method uses. ChaCha/HMAC
key zeroization on every exit path was already closed by the PRIOR Arc
(6441-6520) inside `nip44_wire_encrypt`/`nip44_wire_decrypt` — unchanged,
unrelated to the Master Seed's own ownership model, re-verified passing
(163 NIP-44 tests, unchanged). No plaintext is ever held in the Store —
the Store holds only the Master Seed; NIP-44 plaintext/ciphertext never
touches it.

## Phase G — Direct Ratchet production wiring

See the reconciliation report §5 for the full ownership decision.
Summary: `DirectRatchetSessionState`'s own in-memory secret ownership is
UNCHANGED (already correct). The seal/restore boundary
(`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`) now
resolves its own sealing-key-derivation input through `with_master_seed`
— the SAME bridge signing/NIP-44 use — so a destroyed/cleared Authority
correctly denies Ratchet sealing/restoring too, without touching the
Ratchet session's own per-conversation ownership model at all. Proven by
`a_sealed_ratchet_secret_cannot_be_restored_through_a_different_authoritys_store`
and the real vertical slice's own seal step.

## Phase H — production activation facade

Not modified this Arc. `FedosMasterSeedAuthority` itself IS this crate's
production activation facade (the mission's own Phase H "Allowed
examples" list — create/restore, derive public identity, sign, NIP-44
operation, Ratchet operation, seal/restore, destroy, shutdown — is
EXACTLY `FedosMasterSeedAuthority`'s own existing public method set,
unchanged by this Arc in shape, only in internal implementation).
`SecretHandleStore` itself is never exposed — it is a private field,
never `pub`, never returned from any method, never reachable from
TypeScript. No new facade was needed since the existing one already had
the correct shape; this Arc's own contribution is making its INTERNALS
real.

## Phase I — Runtime start/stop

| Lifecycle | Implementation |
|---|---|
| Start | `new()` (Empty) → `generate()`/`restore_sealed()` (constructs the Store generation) |
| Stop | `clear()` — irreversible, denies every subsequent operation, destroys the Store-owned handle explicitly |
| Restart | A NEW `FedosMasterSeedAuthority::new()` instance — a fresh Store, independent of any prior instance |

`Drop` is a backstop (via `SecretHandleStore::drop`'s own prior-Arc
behavior), not the primary shutdown path — `clear()` is. Proven:
`restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`.

## Phase J — concurrency

`with_master_seed`/`with_master_seed_bytes` both take `&self` (shared
borrow) — `SecretHandleStore::use_handle` (prior Arc) likewise takes
`&self`. Rust's own borrow checker makes concurrent SHARED reads
(multiple simultaneous `sign`/`encrypt`/`resolve_conversation_key` calls)
safe by construction, with no lock needed — this satisfies the mission's
own "prefer narrow locking... no secret clone merely to avoid
synchronization design" instruction by needing NO synchronization
primitive at all for the read path. `clear()`/`generate()`/`restore_sealed()`
require `&mut self` — Rust's own aliasing rules make it structurally
impossible to call `clear()` while a `sign`/`encrypt` call holds a `&self`
borrow on the SAME instance (the borrow checker enforces this at compile
time across any single-threaded caller; a genuinely multi-threaded
caller sharing one `FedosMasterSeedAuthority` across threads is not a
shape this crate's own WASM/JS-single-threaded execution model produces
today — `#[wasm_bindgen]` types are not `Send`/`Sync` by default and this
Arc does not make them so). "Sign while destroy requested"/"encrypt while
shutdown begins" therefore reduce to: whichever call the single-threaded
caller issues first completes before the next one can begin — proven
observably by `real_vertical_slice_...`'s own sign-then-clear-then-sign
sequence (the post-clear sign correctly fails).

## Phase K — failure and cleanup truth

Every failure path in the ten updated methods either returns `None`/
`false` with no state mutation (validation failures, `use_handle` denials)
or leaves the Authority in its pre-call state (`generate()`/
`restore_sealed()` only mutate `self.state` on their own final success
line, matching the pre-existing, unchanged control flow). No path
returns a "partially live" handle — `with_master_seed`'s own `temp` is
always either fully constructed-and-cleared or never constructed at all
(if `use_handle` denies first). No failure result contains a
secret-derived diagnostic — `Option<String>`/`Option<Vec<u8>>`/`bool`
returns only, never a distinguishing reason.

## Phase L — page-locking readiness

Unchanged from the prior Arc (`PageLockingCapability`, `lib.rs`). Not
touched, not re-verified with new tests (no new claim is made) — this
Arc introduces no native host boundary of any kind.

## Phase M — safe diagnostics

Unchanged from the prior Arc (`secure_memory_foundation_diagnostics`).
Not extended — no new diagnostic surface was found necessary for this
Arc's own scope (the Authority's own `is_available()`/`is_cleared()`
already serve as its own safe, non-sensitive status diagnostics, matching
what existed before this Arc).

## Phase N — real vertical slice

`secret_handle_store_production_wiring_tests::real_vertical_slice_generate_store_sign_nip44_ratchet_seal_stop_restart_restore`
— see the completion declaration for the itemized step-by-step mapping
against the mission's own 28-step list, and the production secret-flow
map document for the full ownership diagram.

## Phase O — failure matrix

9 new tests in `secret_handle_store_production_wiring_tests`, covering
the production-wiring-specific subset of the mission's own list (the
Store's own lower-level failure matrix — unknown handle, stale
generation, wrong kind, double destroy, handle-limit exhaustion,
concurrent use/destroy — was already fully covered by the PRIOR Arc's own
12 `secret_handle_store::tests`, unmodified and re-verified passing this
Arc).

## Phase P — structural guards

`test/secure_runtime_alpha_6601_6680_structural_guards.test.ts` — 11
tests. Every pre-existing guard test (both prior Secure Memory Arcs' own
suites, plus the crate-wide `fedos_core_rust_secret_handle*`/`dependency`
guards) re-verified: **0 tests differ** (precise JSON-diff against the
unmodified `ed5128f` base).
