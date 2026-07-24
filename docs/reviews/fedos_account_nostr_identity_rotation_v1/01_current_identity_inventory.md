# 01 — Current Identity Inventory (Lineage Table)

Verified by direct source inspection at `d825aa0` and `git show`/`git log`
against the commits named in the index. LIVE = production-reachable on
this branch's own history. GATED = real code exists but requires an
optional dependency/toolchain not always present (e.g. WASM). TEST-ONLY =
exists only to exercise other code. HISTORICAL-BRANCH = exists only on an
unmerged branch (`git merge-base --is-ancestor <hash> HEAD` is false).
PROPOSED = named in a review document, no code. REJECTED = a review
explicitly declined the option. UNBUILT = no code and no review decision
in favor.

| Capability | Source file | Commit/branch | Merged into base? | Production reachable? | Rotatable today? | Replaceable today? | Current limitation |
|---|---|---|---|---|---|---|---|
| Master Seed generation | `packages/fedos-core-rust/src/lib.rs` (`FedosMasterSeedAuthority::generate`) | `be1bc0d`-era lineage, LIVE | Yes | LIVE | No | Only via a brand-new profile (no reseal) | `Empty→Available→Cleared` state machine forbids re-generating an `Available` authority |
| Master Seed sealing/restore | same file (`seal`, `restore_sealed`) | LIVE | Yes | LIVE | No (no reseal-under-new-passphrase primitive) | N/A | `writeIfAbsent()` never overwrites a sealed file |
| Account identity derivation | `fedos_profile_initialization_coordinator.ts:337,373-377` | LIVE | Yes | LIVE | No | Only by creating a new profile (new seed) | Equal to Nostr pubkey; no independent value |
| Nostr key derivation | `lib.rs` `derive_nostr_secret_key_internal`/`derive_nostr_public_key_internal` | LIVE | Yes | LIVE | No | Same as account identity | Pure deterministic `(seed, accountIndex)` function, no indirection |
| `accountIndex` multiplicity | `FixedFedosConversationLocalAccountIndexAuthority` | LIVE (Alpha 689) | Yes | LIVE, fixed to 0 | N/A | N/A | Explicitly rejected as a caller-selectable identity switch (Alpha 689 decision) |
| Nostr signing authorities | `fedos_wasm_nostr_signing_authority.ts`, `fedos_production_nostr_signing_authority.ts` | LIVE | Yes | LIVE / GATED (WASM) | No | No | Both are pure re-derivation adapters, no rotation surface |
| Device Binding record | `fedos_device_binding.ts` | Alpha 2921-3000, LIVE | Yes | LIVE | Trust-state only (pending/trusted/revoked/unavailable) | No (new `deviceId` required) | Snapshot `accountRef.publicIdentifier`; no re-association mechanism |
| Account-to-Device signature boundary | `fedos_device_binding_registration_authority.ts` | Alpha 3161-3240, LIVE | Yes | LIVE | N/A | N/A | Re-derives signer per call, but compares against the STATIC stored `accountRef` |
| Device signing keypair | `fedos_device_signing_keypair.ts` | Alpha 3161-3240, LIVE | Yes | LIVE | N/A | N/A | Process-memory-only; no durable storage (reconfirmed at HEAD) |
| Device Replacement | `fedos_device_replacement_coordinator.ts` | `f80889d`, LIVE | Yes | LIVE | N/A (Device-scoped, not account-scoped) | Yes, at Device level | Register-then-revoke; never inherits key/session; account stays fixed |
| Authenticated Session Reset | `fedos_direct_ratchet_session_reset_authority.ts`/`_reason.ts` | `f80889d`, LIVE | Yes | LIVE | N/A | N/A | 4-value reason vocabulary explicitly excludes "identity rotation" |
| Ratchet session identity | `fedos_direct_ratchet_session_id.ts`, `fedos_direct_ratchet_device_pair_resolver.ts` | `be1bc0d`/`b8e9e06`, LIVE | Yes | LIVE | No | No | `accountRefToSessionIdComponent()` bakes the account's Nostr pubkey directly into the id; no re-keying path |
| Ratchet Cryptographic Core | `packages/fedos-core-rust/src/crypto/direct_ratchet*.rs` | `080cb99`, LIVE | Yes | GATED (WASM) | No | No | Fixed Device-pair scope for session lifetime |
| Peer Capability Advertisement | `fedos_ratchet_peer_capability_advertisement.ts` | `d825aa0`, LIVE | Yes | LIVE | N/A | N/A | `senderAccountRef`/`recipientAccountRef` are static snapshots |
| Peer Capability Observation | `fedos_ratchet_peer_capability_observation.ts` | `d825aa0`, LIVE | Yes | LIVE | No | No | Keyed by `peerAccountRef.publicIdentifier`; a rotated peer starts a disconnected key-space |
| Peer Lifecycle Notification facts | `fedos_ratchet_peer_lifecycle_notification.ts` | `d825aa0`, LIVE | Yes | LIVE | N/A | N/A | 6 closed kinds; none represents identity rotation (by explicit header disclaimer) |
| Conversation participant reference | `fedos_conversation_participant_reference.ts` | LIVE | Yes | LIVE | No | No | `publicIdentifier` is the raw pubkey; two different pubkeys are never treated as the same participant |
| Conversation Membership | `fedos_conversation_membership.ts`/`_state.ts` | LIVE | Yes | LIVE | No | No | 3-value state (`active`/`revoked`/`left`); no "superseded-by-transition" state |
| Conversation ID | `fedos_conversation_id.ts` | LIVE | Yes | LIVE | N/A | N/A | Pure function of `(boardId, threadId)` — no pubkey dependency at all |
| Archive Restore | `fedos_conversation_archive_restore.ts` | LIVE | Yes | LIVE | N/A | N/A | Never re-verifies participant identity; pure idempotent replay |
| Conversation Reactivation | `fedos_conversation_reactivation_coordinator.ts` | LIVE | Yes | LIVE | N/A | N/A | Checks the caller's OWN current membership only, not any other participant's |
| Search participant index | `fedos_conversation_search_participant_index.ts` | LIVE | Yes | LIVE | N/A | N/A | Keyed live off Membership, but bucketed by `authority::publicIdentifier` — a rotated pubkey starts a new bucket |
| Device Sync / Transfer / Relay Sync | `fedos_device_sync_session.ts`, `fedos_device_transfer_coordinator.ts`, `fedos_device_relay_sync_*.ts` | LIVE | Yes | LIVE | No | No | Every lookup gates on exact-match `accountRef.publicIdentifier`; zero live ratchet secrets confirmed by fresh grep |
| Signed Recipient Deletion Request | `fedos_deletion_request_record.ts` | `22f9277` | **No** — HISTORICAL-BRANCH (`arc/signed-recipient-deletion-request-state-foundation`) | N/A on this base | N/A | N/A | Not inspected as a production dependency; read only for authorship-identity coupling |
| Group Sender-Key rotation | `docs/reviews/.../sender_key_rotation_v1/*` | `41da82d` | **No** — HISTORICAL-BRANCH | N/A | N/A | N/A | A different identity layer (Group epoch key), kept separate per `3ebfa37` §03 |

## What this table proves

1. **Account identity and Nostr identity are the same live value today**,
   fully deterministic from `(Master Seed, accountIndex=0)`, with zero
   existing indirection layer.
2. **Every downstream record (Device Binding, Ratchet session, peer
   capability observation, Conversation participant, Device Sync/Transfer)
   snapshots this value as a static string** and has no code path that
   re-associates an existing record with a changed value.
3. **The only existing "identity change" precedent in this codebase is
   Device Replacement** (`f80889d`) — register-then-revoke, brand-new
   identifier, zero inheritance — which is Device-scoped, not
   account-scoped, but is the structural template this review reuses.
4. **No production file this review's own scope requires touching is
   modified by this review** — confirmed by the empty `git diff -- src
   packages package.json package-lock.json Cargo.toml p2p .tmp_gen` in
   the Verification section.
