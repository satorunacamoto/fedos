# Disaster Recovery / Portable Backup — Red Team + Asset Classification

Covers goals #5 ("analyze old-backup rollback"), #6 ("preserve identity-
transition / signed-deletion / device-revocation truth"), and #7
("produce exact unrecoverable-state list"). Every claim below is
verified directly against the real source, not assumed.

## 1. Device Registry — CONFIRMED rollback vulnerability if included; exclusion is correct

`src/os/messenger/device/fedos_device_binding.ts:32-33`: **`"revoked"` is
TERMINAL — no function in this file can transition a `"revoked"` binding
to any other state.** `src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.ts`
confirms the mechanism: `device-registry.ndjson` is an event-sourced,
append-only log; current trust state is *reconstructed* by replaying
every event for a device (`reconstructFedosDeviceBindingRecord`,
`fedos_device_registry_persistence.ts:91`, applying `revokeFedosDeviceBinding`).

**Consequence if `device-registry.ndjson` were included in the Data
Part:** a bundle built BEFORE a later revocation event would carry only
the old events. Restoring it reconstructs the device as still
`"trusted"` — the revocation is not merely stale, it is **silently
absent**, because the reconstruction is a pure function of whatever
events happen to be in the log handed to it. This is the exact failure
mode the arc's hard requirement ("no old-backup silent trust rollback")
names. **`01_recovery_bundle_format.md`'s exclusion of `device-registry`
is CONFIRMED correct, not merely cautious.**

## 2. Device Binding Replay — confirmed safe to omit (not merely excluded out of caution)

`src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts:37-45`:
`deviceBindingReplayLogFile` is a nonce-keyed ledger recording every
accepted/denied device-registration or revocation challenge outcome, so
a replayed challenge with identical content is idempotent and a replayed
nonce with DIFFERENT content is refused. This ledger is meaningful only
in the context of the SPECIFIC device that issued/received those
challenges. A fresh, empty ledger on a new device is the safe default —
there is no scenario where restoring a stale copy of someone else's (or
an old device's) replay history helps; at best inert, at worst binds an
unrelated nonce space to a new device's own future challenges for no
benefit. Exclusion confirmed correct.

## 3. Direct Ratchet — cryptographically enforced exclusion, not policy alone

`src/os/core/ports/sealing_authority_port.ts:45-51`:
`sealDirectRatchetSecret(localDeviceRef, remoteDeviceRef, conversationId, generation, secretBytes)`
— the wrapping key is a pure function of the FULL device-binding tuple.
A new device's own `localDeviceRef` differs from the one the secret was
sealed under, so `restoreDirectRatchetSecret` fails AEAD authentication
by construction — this is not a policy choice this arc could get wrong,
it is cryptographically enforced upstream of this arc's own design.
Excluding `direct-ratchet-*` from the Data Part avoids shipping
permanently-inert ciphertext, nothing more; the real safety property
already existed.

**Re-establishment path exists and is real, not speculative**:
`fedos_direct_ratchet_reset_coordinator.ts` names `generation === 0` as
a first-class "very first establishment" case alongside reset/supersede
— a new device negotiating a fresh session with an existing contact is
the SAME code path as any other first-time or reset establishment.
Classification: **REESTABLISHED**, never RECOVERED, never LOST outright
— confirmed via `fedos_disaster_recovery_portable_backup_fresh_machine_restore_real_vertical_slice.test.ts`
proving the identity that would drive re-establishment IS recovered.

## 4. Own-Device Sync files — structurally never read, verified by test

`sync-journal`/`sync-schedule`/`sync-conflict` are absent from
`FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS`
(`fedos_recovery_bundle_profile_selection.ts`) and test #25/#27 in
`fedos_disaster_recovery_portable_backup_recovery_bundle.test.ts` assert
the included/excluded lists partition every `FedosLocalProfilePaths`
field with no overlap and no gap. The real-WASM vertical slice
additionally seeds a live `sync-journal.ndjson` on "Machine A" and
asserts it is absent by name from the built Data Part entries AND absent
from Machine B's restored profile root. Structural guarantee, not a
convention someone could forget.

## 5. Deletion Request / Identity Transition / Payload Retention — bounded, DISCLOSED staleness, not silent rollback

These ARE append-only truth logs, and a bundle restored from before a
later deletion/transition event will not reflect that later event
either — the same shape of staleness as §1's device-registry finding,
in isolation. The reason this arc's design still includes them (unlike
device-registry) is that this product ALREADY has a disclosed,
accepted precedent for exactly this staleness, for a materially
identical reason: `docs/desktop_beta_user_guide_backup.md`'s own Archive
Export section states plainly — *"restoring an Archive applies your
CURRENT retention/suppression state at restore time, so some
previously-deleted content may come back marked as redacted/tombstoned
rather than fully restored, by design."* `fedos_payload_retention_authority.ts`
is the mechanism that re-evaluates restored content against
whatever-is-current, rather than blindly trusting a restored "already
handled" flag — this is a re-evaluation safety net device trust has no
analogue of.

**This is the one place this design imposes a REQUIREMENT on Agent D
(UX), not a code guarantee alone**: the restore flow MUST disclose "this
reflects your account as of the backup's creation time — deletions,
identity transitions, and device changes made afterward are not
included," mirroring the Archive restore copy verbatim in spirit. Silent
would violate the hard requirement's intent; DISCLOSED staleness,
consistent with an already-shipped product convention, does not.

## 6. Commerce receipts / purchased content / Tor settings — nothing to back up on this lineage, confirmed two independent ways

1. This arc's own source audit: `fedos_local_profile_paths.ts` has no
   receipt/purchased-content/Tor field of any kind; `src/os/commerce/`
   on this branch has no durable persistence file for either (confirmed
   by grep — the durable commerce persistence work lives only on ~40
   divergent, unmerged `commerce-*` branches, not this lineage).
2. Independently, the concurrent session's own real-Electron E2E test
   (`packages/fedos-desktop-electron-spike/test/fedos_disaster_recovery_fresh_machine_restore.test.ts`,
   header comments) reaches the same conclusion from the shipped-UI
   side: no Tor/onion/socks key exists anywhere in the real
   `FedosDesktopSettingsController` schema (asserted directly against a
   real seeded `settings.json`), and `src/os/commerce/creator/entitlement.ts`
   is documented "inert scaffolding, not reachable from the shipped
   Electron app."

Two independently-arrived-at findings agreeing is strong confirmation,
not a coincidence to double-check further. Classification for both:
**LOST is not the right word (nothing was ever created to lose)** — see
§7's classification table for the precise label.

## 7. Final per-asset classification

| Asset | Classification | Why |
|---|---|---|
| IDENTITY | **RECOVERED** | Deterministic from the Argon2id-sealed Master Seed envelope + passphrase — proven bit-for-bit (identical Nostr pubkey) by the real-WASM vertical slice, Machine A → Machine B. |
| CONTACTS | **RECOVERED** (as of backup time) | This product's only notion of "contact" is a conversation counterparty (confirmed by the concurrent session's own E2E finding — no separate address book); recovered via `conversation`/`conversation-membership` in the Data Part. |
| CONVERSATIONS | **RECOVERED** (as of backup time) | `conversation`/`conversation-envelope`/`conversation-membership`/`conversation-invitation-received`/`conversation-draft` all included; content-hash + AEAD verified on restore. |
| MESSAGES | **RECOVERED** (as of backup time) | `conversation-payload` included; message keys are deterministic from the Master Seed (`resolveConversationKey`, not device-bound) per `docs/reviews/private_conversation_security/17_backup_multi_device.md` §1 — proven by the real-WASM vertical slice's own board/conversation entry round-trip. |
| DEVICE TRUST | **REESTABLISHED** | Deliberately excluded (§1) to avoid silent trust rollback; a restored profile starts with an empty Device Registry and re-learns trust via the real pairing flow, never an imported snapshot. |
| COMMERCE RECEIPTS | **N/A — no durable state exists on this lineage to recover or lose** | §6. Not a gap this arc introduces; nothing to back up. |
| PURCHASED CONTENT | **N/A — same as above** | §6. |
| RATCHET | **REESTABLISHED** | §3 — cryptographically cannot travel to a new device by construction; a fresh session negotiates naturally via the existing, already-real reset/establishment path once IDENTITY is recovered. |
| TOR SETTINGS | **N/A — no durable state exists on this lineage to recover or lose** | §6. The real settings schema carries no Tor/proxy field at all. |

No category is described as fully "complete" without qualification —
CONTACTS/CONVERSATIONS/MESSAGES/etc. are honestly qualified "as of
backup time" per §5.

## 8. Hard-requirement compliance — verified, not asserted

Every hard requirement in the arc's own instructions is either
structurally enforced (cited above) or proven by a passing, real-WASM
test in `fedos_disaster_recovery_portable_backup_fresh_machine_restore_real_vertical_slice.test.ts`:
wrong-passphrase fail-closed (test #2), bit-flipped tamper rejection
(test #3), profile isolation (fresh target root, never Machine A's
directory), and device-bound/sync files never leaving Machine A's disk
(asserted directly against the built Data Part entries and Machine B's
restored root). "No actual cloud backup," "no public upload," and "no
shared-directory shortcut in restore E2E" hold trivially — the Bundle is
a local file the test writes to a temp directory and reads back with no
network call anywhere in this arc's own code.
