# Secure Runtime Alpha 6601–6680 — Shutdown/Restart/Cleanup Truth

**FedOS Secure Memory Store Production Wiring Arc**

## Shutdown (`clear()`)

1. `std::mem::replace(&mut self.state, Cleared)` — atomically swaps out
   whatever state was live (`Empty`/`Available`/already-`Cleared`) for the
   terminal `Cleared` state. From this instant on, `is_available()`
   returns `false` and `is_cleared()` returns `true` — no window where a
   caller could observe a half-transitioned state.
2. If the previous state was `Available { store, master_seed_id }`:
   `store.destroy(master_seed_id)` — zeroizes the held `SecretHandle` via
   its own `clear()`, bumps the slot's generation, frees the slot. The
   RETURN VALUE of `destroy()` (`Destroyed`/`AlreadyDestroyed`) is not
   inspected — both are safe, non-error outcomes by the Store's own
   design (prior Arc), and `clear()`'s own job is done either way.
3. `store` itself (the local binding from the destructured `previous`) is
   dropped at the end of the `if let` block. `SecretHandleStore::drop()`
   (prior Arc, unmodified) calls `clear_all()`, which is a safe no-op on
   an already-empty Store (the ONE slot was already destroyed in step 2).
4. Every subsequent call to `sign_nostr_event`/`public_key_hex_for_account`/
   `resolve_conversation_key`/`encrypt_nip44_wire`/`decrypt_nip44_wire`/
   `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`/`seal`
   resolves `self.state` to the `_ => return None` catch-all arm inside
   `with_master_seed`/`with_master_seed_bytes` — denied, permanently, for
   the rest of this instance's lifetime.

**No in-flight operation can observe a partially-destroyed handle.**
Rust's own borrow rules make this structural: `clear()` requires `&mut
self`; every production method requires only `&self`. A single-threaded
caller cannot call `clear()` while a `&self`-borrowing call is still
executing on the same instance — the borrow checker enforces this at
compile time, not at runtime, so there is no race window to reason about
for this crate's own single-threaded WASM/JS execution model.

## Restart

**There is no "restart" method or state on `FedosMasterSeedAuthority` —
restart means constructing a NEW instance.** This is unchanged by this
Arc; it was already true before (a `Cleared` authority has no reset
path). What THIS Arc adds is the PROOF that this already-correct external
contract now ALSO gives real, Store-level generation-safety for free:

- A new `FedosMasterSeedAuthority::new()` owns a Store that has never
  existed before — no `SecretHandleId` from any prior instance (stopped
  or not) can ever be presented to it, because `SecretHandleId` is never
  exposed outside `FedosMasterSeedAuthority`'s own private fields in the
  first place. There is no "ID reuse" question to even ask.
- Restoring the SAME underlying Master Seed (byte-identical, via
  `restore_sealed` from a real sealed envelope) into the NEW instance
  produces the SAME public identity (`public_key_hex_for_account`
  matches) — proven by
  `restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`.
  The OLD, stopped instance remains permanently denied even though a
  byte-identical seed is now live in the new instance's own,
  independent Store.
- No live secret migration ever occurs between instances — restoration
  always goes through the sealed-envelope/passphrase path, never a
  direct in-memory handoff.

## Drop as backstop, not primary path

`SecretHandleStore::drop()` (prior Arc, unmodified) is the LAST line of
defense — a caller that drops a `FedosMasterSeedAuthority` without ever
calling `clear()` (e.g., the WASM object is simply garbage-collected on
the TypeScript side) still gets its held Master Seed zeroized, because
dropping the Authority drops its own `store: SecretHandleStore` field,
which drops every still-`Occupied` slot inside it, each of which is a
`SecretHandle` that ALSO zeroizes on its own drop (`secrecy::SecretBox`'s
own guarantee, unchanged since Stage 78). Three independent layers all
converge on the same guarantee — this is deliberate redundancy, not
accidental duplication, mirroring `docs/runtime_secure_memory.md` §9's own
"Drop is the backstop, not the primary retirement path" principle,
restated at the Authority's own layer.

## What this does NOT guarantee

Restated, not weakened, from the prior Secure Memory Arc's own
zeroization assurance document
(`docs/secure_runtime_alpha_6281_6360_zeroization_assurance.md`): no
guarantee against compiler-introduced copies, OS paging/swap, a core dump
or debugger-attached attacker, or anything about WASM linear-memory
snapshots specifically. This Arc adds no new claim and narrows none of
the existing ones.
