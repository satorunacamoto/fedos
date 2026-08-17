# Disaster Recovery / Portable Backup — Gate Decision

**Status: DESIGN complete, proceeding to IMPLEMENT.** This file is the
gate artifact the arc's own instructions require: "If the correct
recovery authority is ambiguous: DESIGN_ONLY and stop implementation. If
unambiguous: implement." This Stage concludes the recovery authority is
**unambiguous** — every cryptographic primitive the Recovery Bundle needs
already exists, is already production-real (not a prototype/placeholder),
and is already reused three times over for structurally identical
"seal a local bundle to yourself" problems. No new cryptography, no new
Rust dependency, and (see §4) no Rust source change at all is required.

## 1. What already exists (the recovery authority)

| Primitive | File | Real? | Portable across machines? |
|---|---|---|---|
| Argon2id + ChaCha20-Poly1305 sealed Master Seed envelope (`seal`/`restoreSealed`) | `src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts`, Rust `FedosMasterSeedAuthority::seal`/`restore_sealed` (`packages/fedos-core-rust/src/lib.rs:12228,12328`) | Yes — Alpha 432/433/438, real WASM, real Rust, real RFC 9106 KAT-verified Argon2id | **Yes, by design** (Alpha 433: "Backup/migration: both the envelope... and the passphrase... can travel to a new device — this Arc does not build that UI, but the underlying mechanism does not block it.") |
| `resolveConversationKey(accountIndex, counterpartyPublicKeyHex)` — ECDH-derived, domain-separated "encrypt to self" key | `fedos_wasm_master_seed_authority.ts:187-196` | Yes, real, already reused by Archive Export (`src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.ts`) and Device Sync Package (`src/os/messenger/device/sync_package/fedos_device_sync_package_encryption.ts`) | Yes — pure function of (Master Seed, account index, a public key). Not device-bound. |
| `SealingAuthorityPort.sealDirectRatchetSecret`/`restoreDirectRatchetSecret` | `src/os/core/ports/sealing_authority_port.ts` | Yes, real | **No — deliberately device-bound** (key is a function of `localDeviceRef`+`remoteDeviceRef`+`conversationId`+`generation`). This is *why* Ratchet state cannot and must not travel to a new device — see §5. |

Two decision records already on file settle the shape question definitively,
so this Stage does not re-litigate it:

- `docs/secure_runtime_alpha_433_sealing_key_authority_decision.md` — adopted
  Option B (user passphrase, Argon2id) as *the* wrapping-key authority,
  explicitly for backup/migration portability; rejected OS-bound (DPAPI),
  random-key-in-a-store, hardcoded, and device-metadata-derived alternatives.
- `docs/reviews/private_conversation_security/17_backup_multi_device.md` —
  already worked out which assets are deterministically recoverable from the
  Master Seed alone (keys) vs. which need a separate wrapped-secret or data
  backup (group/epoch keys, message ciphertext, membership/capability/
  deletion history), and named the one hard constraint this Stage must not
  violate: **a backup wrapping key must come from a domain-separated leaf of
  the hierarchy, never bypass it by deriving directly off the raw Master
  Seed.** `resolveConversationKey` already satisfies this (it goes through
  the Nostr Root → Account leaf, exactly like every other reuse of it).

## 2. What the CURRENT shipped story actually is (and why it's not enough)

`docs/desktop_beta_user_guide_backup.md` (current, shipped guidance) already
tells users to back up **the raw profile directory** and restore it by
copying it back onto "a fresh install of the same or compatible Beta
version," with **no guided restore flow**, **no version check**, and an
explicit admission that "version rollback has no tested path." This Stage's
own goal #1 is to prove whether that is genuinely portable. It is not,
for four concrete, structural reasons, independent of any red-team
speculation:

1. **Silent inclusion of device-bound secrets that cannot decrypt on a new
   device.** `direct-ratchet-sealed-secret.ndjson` is sealed under
   `sealDirectRatchetSecret(localDeviceRef, ...)` — a raw copy carries
   ciphertext a new device's own `localDeviceRef` can never open (AEAD
   authentication is keyed to the tuple, not just the payload). This fails
   silently/inertly rather than loudly, which is worse than an explicit
   exclusion: an operator has no signal their "full backup" is partially
   dead weight.
2. **No version marker, no tamper check, no wrong-secret rejection at the
   bundle level.** A raw directory copy is not a *format* at all — nothing
   validates it is complete, uncorrupted, or was ever produced by a
   matching schema version before an operator starts relying on it.
3. **Own-Device Sync's own files travel along for free.** `sync-journal`/
   `sync-schedule`/`sync-conflict` NDJSON logs are Own-Device Sync's fact/
   snapshot model — explicitly out of scope for this arc to touch, and
   restoring them onto a new device re-injects another subsystem's
   internal state with no coordination.
4. **No rollback protection.** Restoring an old raw copy can resurrect
   `deletion-request-*` state, `identity-transition-*` decisions, or
   `device-registry` trust entries that were later superseded — see §5's
   rollback analysis for the concrete mechanism.

## 3. The Recovery Bundle v1 design (see `01_recovery_bundle_format.md` for
the wire format)

Two-part, both reusing existing primitives with **zero Rust/crypto
changes**:

- **Identity Part** — the `master-seed.sealed.json` envelope, copied
  byte-for-byte. Restoring it alone via the existing
  `FedosMasterSeedAuthority.restoreSealed()` deterministically reconstructs
  every seed-derived key (Nostr signing identity, any other Protocol Root,
  DM pairwise conversation keys once a counterparty's public key is known).
  This is IDENTITY, fully recovered, using code that already ships today.
- **Data Part** (optional, requires the Identity Part restored first) — a
  curated set of the profile's own NDJSON logs, serialized, then sealed as
  ONE ciphertext via `resolveConversationKey(accountIndex, selfPublicKeyHex)`
  + the existing Runtime `encrypt`/`exportCiphertext` — the exact same
  "encrypt-to-self" construction Archive Export and Device Sync Package
  already use, reused a third time, no new AAD domain.

Both parts are wrapped in one new, versioned, strictly-parsed JSON container
(`fedos-recovery-bundle`, schema v1) — a thin, non-cryptographic binder
exactly like `FedosDeviceTransferPackageV1`'s own precedent
(`src/os/messenger/device/transfer/fedos_device_transfer_package.ts`).

## 4. Zero Rust changes confirmed

`FedosMasterSeedAuthority::seal()` (Rust) operates on `self`'s own
internally-held master seed — there is no generic "seal arbitrary caller
bytes under Argon2id" export, and this design does not need one: the
Identity Part reuses `seal`/`restore_sealed` completely unmodified (it
already IS a portable, passphrase-sealed blob), and the Data Part reuses
the completely unmodified `resolveConversationKey` + AEAD `encrypt`/
`decrypt` path Archive/Sync Package already exercise. No new WASM export,
no new `AeadAadDomain` variant, no new dependency.

## 5. Hard-requirement traceability (see `03_asset_classification.md` for
the per-asset table)

| Hard requirement | How this design satisfies it |
|---|---|
| No plaintext secret export | Identity Part is already-sealed ciphertext (never touches plaintext seed bytes in TS); Data Part is AEAD ciphertext. |
| No new home-grown crypto | Zero new primitives — see §4. |
| Reuse existing sealing/KDF authority | `seal`/`restoreSealed` (Argon2id) + `resolveConversationKey` (existing HKDF/ECDH chain), verbatim. |
| Versioned format | New `{v:1, kind:"fedos-recovery-bundle"}` container, fixed key set. |
| Strict parser | Structural well-formed check mirroring `isWellFormedFedosSealedMasterSeedEnvelopeV1Json`/`isWellFormedFedosDeviceTransferPackageV1`'s own discipline — reject unknown keys, reject wrong version, never partially trust a malformed bundle. |
| Tamper rejection | AEAD authentication (both parts) fails closed on any bit-flip; Data Part additionally gets a content-hash re-check mirroring the Conversation Archive Manifest's own double-check. |
| Wrong-secret rejection | Wrong passphrase fails `restoreSealed()` closed immediately — nothing else in the bundle is even attempted. |
| Profile isolation | Restore ALWAYS writes into a fresh, empty profile root (reusing `fedosLocalProfilePathsIsolated()`'s own guarantee) — never merges into/overwrites an existing profile directory. |
| No stale live Tor Ready restoration | Tor state is excluded from the Data Part entirely (device-local network/process state, never seed-derived, never durable profile data) — see `01_recovery_bundle_format.md` §2 exclusion list. |
| Do not restore device-bound Ratchet live state onto a different device | `direct-ratchet-*` (all 4 files), `peer-capability-observation`, `device-binding-replay` are excluded from the Data Part by construction — a new device re-negotiates a fresh (generation 0) session via the existing, already-real reset/establishment path (`fedos_direct_ratchet_reset_coordinator.ts`). Classified REESTABLISHED, never RECOVERED. |
| No old-backup silent trust rollback | `device-registry` and `deletion-request-*`/`identity-transition-*` handling — see `02_rollback_analysis.md` (Agent C). |
| No actual cloud backup / no public upload / no shared-directory shortcut in restore E2E | The Bundle is a local file the operator explicitly chooses a path for; the E2E proof (Agent B) uses two genuinely separate `FEDOS_ELECTRON_BETA_DATA_DIR` roots with no shared filesystem shortcut between "Machine A" and "Machine B." |

## 6. Open items this Stage explicitly hands to Agents A–D, not resolved here

- Exact Data Part inclusion/exclusion list per NDJSON log (drafted in
  `01_recovery_bundle_format.md`, red-teamed by Agent C).
- Commerce receipts / purchased content / Tor settings storage location and
  disposition (pending the parallel research fork; folded into
  `03_asset_classification.md` once available).
- Device Registry rollback mechanics (append-only-forward vs. rollback-
  capable) — Agent C's primary red-team target.
- The actual operator-facing "Create Recovery Bundle" / "Restore from
  Recovery Bundle" flow — Agent D.
