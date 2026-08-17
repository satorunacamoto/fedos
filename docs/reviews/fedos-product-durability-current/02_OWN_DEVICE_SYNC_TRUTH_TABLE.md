# Own-Device Sync Truth Table

Distinguishing PEER device discovery (a different account's devices — already
COMPLETE, unrelated) from MY OWN second device (this section) from full state
sync (broader than what's implemented).

## What's real, confirmed via source

- `src/os/messenger/device/sync_package/*` — a real encrypted sync package format: header (`fedos_device_sync_package_header.ts`), AEAD encryption (`fedos_device_sync_package_encryption.ts`), a manifest independently content-hash-bound and re-verified twice on read (identity via header, content via `sha256` over canonical session bytes) — mirrors the already-proven Archive export/import integrity pattern.
- `src/os/messenger/device/sync_scheduler/*` — a real scheduler with conflict detection/authority/query, retry policy, resource limits, abandonment policy — wired into the composition root via the additive `deviceSyncSchedulerEnabled` flag (confirmed: `fedos_profile_initialization_coordinator.ts:220-224,1012-1014`), same pattern as `archiveEnabled`.
- `src/os/messenger/device/runtime/fedos_device_sync_runtime.ts`, `sync_events/fedos_device_sync_event_bridge.ts` — real runtime + event bridge.
- `fedos_device_binding_pairing_exchange.ts` — real same-account device pairing exchange primitive.
- `fedos_device_replacement_coordinator.ts` / `fedos_device_replacement_record.ts` — real device-replacement modeling (lost/retired device → new device, same account).
- Presentation layer exists: `fedos_desktop_device_sync_status_view_model.ts`, `..._status_renderer.ts`, `..._presentation_wiring.ts`, `fedos_device_sync_operational_facade.ts`.

## Answers to mandate §13-16

- **Can one account have 2 devices?** Yes — `FedosDeviceRegistryPersistence` already models multiple Device entries per account (this is the SAME registry Peer Device Discovery already proved COMPLETE against, earlier this session).
- **How does Device 2 prove account authority?** Via the same account-signing-authority binding challenge (`fedos_device_binding_challenge.ts`/`fedos_device_binding_registration_authority.ts`) already proven for Peer Device — no new/central authority, self-sovereign, matches mandate §14's own requirement.
- **Can both send/receive?** Not independently re-verified this pass — Direct Ratchet sessions are already keyed by `(localAccountRef, localDeviceRef, remoteAccountRef, remoteDeviceRef)` (confirmed earlier this session, `fedos_direct_ratchet_session_id.ts`), so per-device sessions are architecturally already the norm; a second OWN device would get its own independent Ratchet sessions with each peer, not a shared one. This is the CORRECT, safe design (mandate §17's own requirement — "do not share one ratchet state between two physical devices" — already true by construction, not something this pass needed to add).
- **Can one revoke the other?** Real revocation primitives exist in `fedos_device_binding.ts`/`fedos_device_lifecycle.ts` — not independently re-tested for the OWN-device case this pass (existing tests cover peer-device revocation; own-device revocation likely reuses the identical mechanism since the registry doesn't distinguish "own" vs "peer" device rows structurally, but this equivalence was not proven this pass — **DEFERRED, worth a focused follow-up**).
- **Does Device Registry understand own devices?** Yes structurally (no separate "own" concept needed — an account's own Device is just another row in the same registry other accounts' Devices occupy).
- **Do conversations/receipts/purchased content sync?** The sync PACKAGE format exists and is real, but this pass did not trace exactly which domains (conversations vs. Commerce vs. purchased-content grants) are actually serialized into `FedosDeviceSyncSessionV1` today — **DEFERRED**, flagged as the single highest-value follow-up for this whole area (mandate §18-19's own specific asks).

## Classification

**Own-Device Sync: PARTIAL, real substantial infrastructure, NOT `PROTOCOL_BLOCKED`** — narrower gap than "not implemented," but this pass could not confirm the exact payload coverage (which domains sync) or independently prove own-device revocation parity with peer-device revocation. Both are real, bounded, answerable questions for a focused next pass, not architectural blockers.
