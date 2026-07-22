# 15 — Master Seed Replacement

## What current architecture permits, verified directly

- **Changing the passphrase while retaining the same Master Seed**: NOT
  implemented. `seal(passphrase)` (`lib.rs:11229-11290`) only *borrows*
  the held seed and could in principle be called twice with two
  passphrases while the authority is `Available` — but no coordinator
  exposes this, and `FileFedosSealedMasterSeedEnvelopePersistence.writeIfAbsent()`
  (`fedos_sealed_master_seed_envelope_persistence.ts:86-94`) never
  overwrites an existing sealed file at the profile's own path, so even a
  second, differently-passphrase-sealed envelope could not be persisted
  in place of the first without a new persistence method. **No production
  path achieves this today.**
- **Resealing the same Master Seed**: same conclusion — theoretically
  reachable at the Rust API surface, not wired, not persisted safely.
- **Replacing the Master Seed while preserving account identity**: **not
  possible**, and not merely unimplemented — it is a contradiction under
  this architecture, since account identity IS the Nostr key IS a pure
  deterministic function of the Master Seed (`04`, `05`). A different
  seed necessarily derives a different key; "same identity, different
  seed" has no meaning here without first building the rotation
  indirection layer `06` explicitly declines to build for V1.
- **Migrating account/Device secrets under a new Master Seed**: not
  possible for the same reason — there is no "same identity" to migrate
  secrets under; a new seed is a new identity by definition.
- **Recovery from a compromised Master Seed**: the only honest answer is
  Replacement (`06`, `09`) — create a brand-new profile/seed/identity and
  optionally issue an evidence-leveled continuity claim (`07`) if any
  uncompromised evidence (a trusted Device, per `09`) remains available.
- **Recovery from a lost passphrase**: `restoreSealed()` requires the
  correct passphrase; a lost passphrase with no other recovery secret
  means the sealed Master Seed is permanently unrecoverable. No
  passphrase-independent recovery code exists anywhere in this codebase
  (confirmed by `01`'s inventory) — this review does not invent one.

## Distinguishing the three

- **Passphrase rotation** (same seed, new wrapping secret) changes NO
  identity at all — it is purely a local-storage-security operation.
- **Master Seed replacement** (new seed) is impossible to distinguish
  from full **account identity Replacement** in this architecture — they
  are the same event.
- **Account identity rotation** (same logical identity, new key) remains
  architecturally unbuilt (`06`) regardless of what happens to the seed.

## V1 policy — chosen

1. **No Master Seed replacement that preserves account identity is
   recommended or built.** Any "new Master Seed" event is, and is treated
   as, a full account/Nostr identity Replacement (`06`), following the
   normative path this review specifies end to end.
2. **Passphrase rotation is identified as a genuinely separate, low-risk,
   identity-preserving operation worth its OWN narrow future Arc** —
   NOT bundled with identity rotation, and NOT built by this review.
   Its own Arc would need: a new, explicitly-reviewed "supersede sealed
   envelope" persistence primitive (since `writeIfAbsent()`'s current
   no-overwrite contract is itself a deliberate safety property that a
   reseal operation must replace carefully, not bypass) and would touch
   ONLY the sealed-envelope layer — no account/Nostr/Device/Ratchet
   consequence at all, since the same seed continues to derive the same
   identity.
3. **Recovery remains exactly `restoreSealed()` as it exists today** — no
   change recommended.
4. **No mechanism in this review exports raw secrets through TypeScript.**
   Every Rust-side secret (Master Seed, derived Nostr key, Device signing
   key) remains behind its existing opaque-handle/process-memory-only
   discipline; this review's own continuity-claim signing (`08`) is
   performed through the SAME existing `FedosNostrSigningAuthority`/
   `FedosDeviceSigningKeypair` interfaces, never a new raw-key-export API.
