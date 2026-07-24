# Secure Runtime Alpha 6281–6360 — Zeroization Assurance and Non-Guarantees

**FedOS Secure Memory Secret Buffer and Zeroization Foundation Arc**

## What "zeroization" means in this codebase

A Secret Buffer's backing bytes are overwritten with a fixed, non-secret
pattern (all-zero) at the moment of retirement — either an explicit
`clear()` call, or (as a backstop) when the Rust value holding it goes out
of scope and `Drop` runs. This Arc changes nothing about that mechanism
(`zeroize`/`secrecy`, adopted Stage 78) — it extends WHERE it is applied
(the new Store's own `destroy()`, and two newly-migrated NIP-44 key
values) using the exact same, already-proven primitive.

## What this Arc proves, concretely

- `SecretHandle::clear()` zeroizes its payload and is idempotent
  (pre-existing, re-verified unchanged).
- `secrecy::SecretBox`'s own `Drop` zeroizes a payload that was never
  explicitly cleared (pre-existing, re-verified unchanged).
- `SecretHandleStore::destroy()` calls the held handle's own `clear()`
  before freeing its slot — proven by 9 dedicated tests including a real,
  non-fixture-only secret shape in the vertical slice.
- `SecretHandleStore::drop()` calls `clear_all()`, which calls `destroy()`
  on every still-live slot — proven not to panic even with live handles
  present (`dropping_the_store_without_clear_all_still_frees_every_slot_safely`).
- The two newly `SecretHandle`-migrated NIP-44 values
  (`Nip44StreamKeyMaterial`/`Nip44HmacKeyMaterial`) inherit this same
  proven zeroize-on-clear/drop behavior instead of living in a plain,
  never-zeroized `Vec<u8>` as they did before this Arc.
- Both live NIP-44 consumers (`nip44_wire_encrypt`/`nip44_wire_decrypt`)
  now explicitly zeroize their own local `[u8; 32]` stack copies once the
  one-shot cipher/HMAC call that needed them completes — including on the
  early-return failure path inside `encrypt_wire_from_key_decisions`,
  not only the success path.

## What this Arc does NOT claim

Restating `docs/secret_lifecycle_implementation_plan.md` §10 and
`docs/runtime_secure_memory.md` §8, unchanged and unrelaxed:

- **No guarantee against compiler-introduced copies.** `zeroize`'s own
  documented purpose is defeating dead-store elimination for the ONE write
  it performs — it says nothing about an earlier, separate copy the
  compiler's own optimizer may have produced before that write ever runs
  (e.g. a value spilled to a second stack slot, or moved through an
  intermediate register/stack location by the optimizer's own choices).
- **No guarantee against OS paging/swap.** A page containing a secret,
  written to swap/pagefile BEFORE zeroization runs, persists on disk
  outside this process's own memory-safety guarantees entirely. This
  Arc's own Phase J page-locking capability status honestly reports
  `Unsupported`/`NotRequested` for every real build target this crate
  has today — see that document's own section for detail.
- **No guarantee against a core dump, debugger attach, or physically
  present attacker with memory-inspection access.** Restating
  `docs/runtime_crypto_threat_model.md` §3's own scope limits.
- **No guarantee about WASM linear memory specifically.** A
  `wasm32-unknown-unknown` build shares this crate's own zeroize
  discipline (the SAME Rust source compiles to that target), but WASM's
  own memory model (a single contiguous linear-memory buffer, snapshot-able
  by the host) is a materially different exposure surface than a native
  process's own virtual memory — `docs/fedos_core_wasm_safety.md` is the
  authoritative document for that surface; this Arc does not extend or
  narrow its claims.
- **No claim that JavaScript/TypeScript memory can be reliably
  zeroized, anywhere, ever.** A JS string is immutable and may already be
  interned/copied by the engine before any Rust code ever sees it — this
  Arc's own scope stops at the Rust boundary (`&[u8]` in, never a `String`)
  precisely because nothing on the TypeScript side of that boundary can be
  reliably zeroized at all, a fact this document states rather than
  works around.
- **No claim this Arc migrated every secret-bearing type in this crate.**
  See the migration inventory document for the complete, explicit list of
  what was and was not touched.
- **No claim of RAM-dump immunity, screenshot/clipboard/keylogger
  prevention, or swap-disable.** None of these were ever in scope for a
  Rust-only secret-memory foundation and this document does not imply
  otherwise by omission.

## Layered evidence, not a single proof

No single test or mechanism in this Arc (or the codebase it extends)
constitutes a complete proof that a secret byte never lingered anywhere in
process memory. The evidence is deliberately layered — compile-time type
guarantees (no `Clone`/`Serialize`), a proven `Drop`/zeroize mechanism, a
new Store-level use-after-destroy/generation-safety contract, structural
source guards, and a real compiled-artifact scan — each closing a
DIFFERENT gap, none claiming to close all of them at once. See the
execution specification's own Phase I for the itemized list of what each
piece of evidence actually establishes.
