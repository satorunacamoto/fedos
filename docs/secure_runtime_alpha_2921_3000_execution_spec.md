# Secure Runtime Alpha 2921–3000: Device Trust and Multi-Device Runtime Integration — Execution Spec

Architecture frozen. This Arc redesigns nothing: no change to `src/sync/` (Alpha 2421–2500), Conversation Runtime, or Archive's own accepted shapes; no new Rust/WASM primitive; no cloud account/server; no push notifications; no MLS; no Onion/Tor; no new dependency. It follows the reviewed recommendation in `docs/reviews/multi_device_device_trust_v1/` (commit `4672244`): account identity + independent Device keys (Option B), implemented as a new, additive `src/device/` domain, wired into the Desktop Runtime through one opt-in configuration flag.

Base revision: worktree `C:\wt\device-trust-runtime`, branch `arc/device-trust-runtime-integration`, based on `master` tip `3eb9ead` (Secure Runtime Alpha 2581–2620), which already contains the Multi-Device Synchronization Foundation (Alpha 2421–2500), the Master Seed/account identity model, Desktop Runtime, Conversation Runtime, Archive/Restore, and Search Retention hardening.

## Phase A — Source reconciliation (verified against real source)

1. **Current Device files, real or disconnected**: `src/identity/device_registration.ts` (Stage 127) and `src/identity/device_trust.ts` (Stage 128) are pure, disconnected label-review boundaries — types + a `reviewDeviceRegistration`/`reviewDeviceTrust` pure function each, no persistence, no crypto, zero callers outside their own module (confirmed by direct read; matches the `4672244` review's own "disconnected island" finding). `src/sync/fedos_sync_device_binding.ts` and `src/sync/fedos_sync_device_registry.ts` (Alpha 2421–2500) are REAL, wired, and tested, but explicitly opaque-label-only by their own header: `deviceRef`/`accountRef` are unauthenticated strings, no `schemaVersion`, no persistence port, trust is literally "does the string match" (`FedosSyncDeviceRegistry`'s own `#deviceOwner` conflict check). Neither of the two pairs was merged or renamed by this Arc.
2. **Multi-Device Foundation files**: `src/sync/fedos_sync_device_binding.ts`, `fedos_sync_device_registry.ts`, `fedos_sync_journal.ts`, `fedos_sync_cursor.ts`, `fedos_sync_conflict.ts`, `fedos_sync_state.ts`, `fedos_sync_queue.ts`, `fedos_sync_pending_changes.ts`, `fedos_sync_recovery.ts` — all in-memory, all unmodified by this Arc.
3. **Device identity type (before this Arc)**: none with a schema. After: `FedosDeviceBindingV1` (`src/device/fedos_device_binding.ts`) — `schemaVersion: 1`, `deviceId`, `accountRef`, `devicePublicKeyRef` (opaque, nullable), `label`, `createdAt`, `trustState`, `capabilityVersion: 1`, `revokedAt`.
4. **Account identity type**: `FedosIdentityRecord` (`src/identity/fedos_identity_record.ts`) is the canonical identity type; `FedosConversationParticipantReference`'s `{authority, publicIdentifier, identityId}` shape is what every Conversation-domain port (Membership, Capability) actually references at runtime. `FedosDeviceBindingAccountRef` mirrors that exact shape — additive beneath it, never a modification.
5. **Sync Journal schema**: `FedosSyncJournalEntryV1` — `sequence` (monotonic, append-order), `changeId` (dedup key), `accountRef`, `originDeviceRef`, `conversationId`, `kind: "upsert"|"tombstone"`, `contentHash` (opaque), `recordedAt`. Unchanged by this Arc.
6. **Cursor model**: `FedosSyncCursorStore` — per-`deviceRef` position, `advance()` takes `max(current, requested)`, never regresses; missing cursor reads as sequence `0`. Unchanged.
7. **Conflict vocabulary**: `FedosSyncConflictKind = "none"|"duplicate"|"tombstone-vs-upsert"|"concurrent-update"` (`classifyFedosSyncConflict`), a pure classification, no resolution. Unchanged.
8. **Persistence backends (before this Arc)**: `FedosSyncJournal`/`FedosSyncCursorStore`/`FedosSyncState` are 100% in-memory, no codec, no disk backend of any kind. `src/conversation/capability/persistence/` and `src/conversation/membership/persistence/` establish this codebase's own event-sourced codec + in-memory + append-only pattern (`*_codec.ts`, `in_memory_*_persistence.ts`, `append_only_*_persistence.ts`, a `persisted_*_authority.ts` orchestrator) — reused verbatim in shape for `src/device/persistence/`.
9. **Current Runtime callers**: none. `git grep` for `FedosSyncState`/`FedosSyncDeviceRegistry` outside `src/sync/` and its own tests returns nothing before this Arc — `fedos_desktop_runtime.ts` never constructed or referenced Sync Foundation at all.
10. **Current crypto ability for independent Device keys**: none. `src/crypto/types.ts` (Stage 34) is a pure placeholder seam — "NO real encryption... NO key generation/derivation here," every operation resolves `"unavailable"`/denied. `packages/fedos-core-rust` is unrelated (Nostr/Board primitives). Confirmed unchanged by this Arc. This is the exact blocker Phase E names.
11. **Expected production changes**: a new `src/device/` domain (binding, registration-authority port + unavailable adapter, persistence codec/port/in-memory/append-only backends, orchestrating Trust Authority); a new, standalone `src/sync/fedos_sync_record_allowlist.ts`; a new `src/desktop/runtime/fedos_device_trust_runtime.ts` facade; additive edits to `src/desktop/runtime/fedos_desktop_runtime.ts` and `fedos_desktop_runtime_config.ts` (one new opt-in flag, mirroring `privateTransportEnabled`'s exact discipline). `src/sync/`, `src/identity/device_*.ts`, Conversation Runtime, and Archive are all byte-for-byte unmodified.
12. **Baseline failures**: `npm run typecheck` clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` error (already named by every recent completion declaration, confirmed present before any edit in this worktree).

## Phase B/C — Device Binding V1 and trust states

`src/device/fedos_device_binding.ts`. Two creation producers only: `createPendingFedosDeviceBinding` (a registration authority verified the request) and `createUnavailableFedosDeviceBinding` (it could not — `devicePublicKeyRef` is forced to `null` regardless of caller input). Closed transition table: `pending -> {trusted, revoked}`, `trusted -> {revoked}`, `unavailable -> {revoked}`, `revoked -> {}` (terminal — no function can mutate a revoked binding). `"online"`/`"offline"` are not trust states anywhere in this Arc.

## Phase D — Persistence

`src/device/persistence/`: `fedos_persisted_device_binding_event_v1.ts` (three event kinds — `registered`/`trusted`/`revoked`, event-sourced exactly like Capability's `issued`/`redeemed`), `fedos_device_binding_codec.ts` (fails closed to `null` on anything malformed or off-schema), `fedos_device_registry_persistence.ts` (port + `reconstructFedosDeviceBindingRecord` fold), `in_memory_fedos_device_registry_persistence.ts`, `append_only_fedos_device_registry_persistence.ts` (NDJSON, one corrupt/unparseable line throws unconditionally — "one corrupt record voids the backend," the same precedent Alpha 840 already set), `persisted_fedos_device_trust_authority.ts` (the orchestrator: `registerDevice`/`confirmTrust`/`revokeDevice`/queries). A completely separate file tree from `src/conversation/membership/persistence/` and `src/conversation/persistence/` — never merged.

## Phase E — Device registration authority

`src/device/fedos_device_registration_authority.ts` defines the port only (`authorizeRegistration`/`authorizeTrustConfirmation`). `src/device/unavailable_fedos_device_registration_authority.ts` is the **only production adapter this Arc ships**: `authorizeRegistration` still returns `allowed: true` (a Device Registry that refuses to durably record even an unverified attempt is less honest, not more) but `capability: "unavailable"` always — so the orchestrator always creates the binding in the `"unavailable"` trust state, never `"pending"`. `authorizeTrustConfirmation` always returns `allowed: false`. Net effect: **no device — legitimate or attacker-controlled — can ever reach `"trusted"` through the shipped production adapter.** This is the fail-closed guarantee in place of any attempt to distinguish real from self-asserted ownership, which this codebase cannot yet do honestly. A test-only `StubVerifiedFedosDeviceRegistrationAuthority` (`test/support/`) exists solely to prove the `pending -> trusted` path and the account-ownership check work correctly once a real Authority exists — it ships nowhere in `src/`, mirroring `fedos_conversation_capability_issuer_authority.ts`'s own documented "test convenience, never a default this file itself supplies" precedent.

## Phase F — Runtime ownership

`FedosDesktopRuntimeConfig` gains `deviceTrustEnabled?`, `localDeviceId?`, `localAccountRef?`, `deviceRegistryLogPath?`, `deviceRegistrationAuthority?` — all optional, mirroring `privateTransportEnabled`'s exact "no widened required-field surface" discipline. `startFedosDesktopRuntime()` validates `localDeviceId`/`localAccountRef` synchronously when `deviceTrustEnabled` is `true`, before constructing anything (mirrors the `deliveryEnabled`/`privateTransportEnabled` guards exactly). `FedosRunningDesktopRuntime.deviceTrust()` is a new accessor returning `FedosDeviceTrustRuntime` — "not enabled" if never configured, "inaccessible after stop" once `stop()` has run, the identical two-state contract `privateTransport()` already uses. No global singleton: each `startFedosDesktopRuntime()` call constructs its own independent Device Registry, Trust Authority, and `FedosSyncState`.

## Phase G — Sync Journal allowlist

`src/sync/fedos_sync_record_allowlist.ts` — a pure, standalone, additive guard. Zero modification to `FedosSyncJournalEntryV1`/`FedosSyncLocalChangeInput`. `FEDOS_SYNC_ALLOWED_RECORD_TYPES` names exactly six kinds: `conversation-identity-metadata`, `membership-metadata`, `capability-public-event`, `retention-tombstone-fact`, `archive-reference`, `search-canonical-id`. `reviewFedosSyncRecordForJournal()` rejects any other `recordType` outright, and rejects metadata whose keys/values match a sensitive marker (`secret`/`seed`/`password`/`passphrase`/`recovery`/`phrase`/`mnemonic`/`privatekey`/`bearer`/`plaintext`/`token` — reusing `device_trust.ts`/`device_registration.ts`'s own established marker family). `FedosDeviceTrustRuntime.recordLocalChange()` is the one production caller: it runs this review, AND requires the origin device to currently be `"trusted"`, before the existing `FedosSyncState.recordLocalChange()` is ever invoked.

## Phase H — Cursor and restart (stated honestly)

This Arc adds **no disk persistence for the Sync Journal or Sync Cursor themselves** — Phase G/H's own "use the EXISTING Sync Journal" instruction, and the absolute prohibition on redesigning the Sync Foundation, both point the same direction. `FedosSyncJournal`/`FedosSyncCursorStore` remain exactly the in-memory, single-process structures Alpha 2421–2500 built. What this Arc verifies, through `FedosDeviceTrustRuntime`: journal append and duplicate-changeId detection (`"appended"`/`"duplicate"`), deterministic cursor advancement, the EXISTING `captureRecoverySnapshot()`/`restoreDeviceFromRecoverySnapshot()` pair as the restart-recovery mechanism (gated, additionally, on the target device currently being `"trusted"` — Phase J), out-of-order/cross-device conflict classification (`"concurrent-update"`), and fail-closed rejection of a structurally inconsistent snapshot (the same id claimed both pending and resolved). **Single-writer limitation, stated plainly**: there is still no multi-process/multi-writer Journal anywhere in this codebase; "restart recovery" means one process's own snapshot round-trip, not concurrent multi-device write ordering beyond what the existing conflict vocabulary already classifies.

## Phase I — Revocation

`FedosDeviceTrustRuntime.revokeDevice()` revokes the Device Binding (terminal, Phase C) and then best-effort revokes the device's own entry in the existing `FedosSyncState` registry, so `listSyncDevices()`/fan-out immediately excludes it. `recordLocalChange()` refuses any change whose `originDeviceRef` is not currently `"trusted"` before the Journal is ever touched — a "pending command from a revoked device" fails at the Runtime facade, not the Journal. No historical Device Binding fact is ever erased (`getDevice()` still returns the revoked record, with `revokedAt` set); no claim of retroactive remote deletion is made anywhere; Sender-Key device rekey is explicitly out of scope and not implemented.

## Phase J — Archive separation

Proven directly, not asserted: `restoreFedosConversationArchiveBundle`'s own dependency shape (`FedosConversationArchiveRestoreDependencies`) has zero Device/Sync port of any kind — confirmed by direct read and by a passing test that restores a bundle over fresh Conversation-domain persistence and asserts the Device Trust Authority still reports zero bindings afterward. `FedosDeviceTrustRuntime.restoreDeviceFromRecoverySnapshot()` additionally requires the target device to currently be `"trusted"` in THIS Runtime's own Device Trust Authority — a Sync recovery snapshot alone can never imply trust, and a freshly started Runtime (as Archive Restore would populate) starts with zero trusted devices until its own, separate Device Trust process runs. A wrong Device identity re-registering an already-bound `deviceId` under a different account is refused (`"conflict"`), the original binding untouched.

## Failure/outcome matrix

| Operation | Condition | Outcome |
| --- | --- | --- |
| `registerDevice` | new `deviceId`, production (unavailable) authority | `"registered"`, `trustState: "unavailable"`, `devicePublicKeyRef: null` |
| `registerDevice` | new `deviceId`, verified authority (test-only) | `"registered"`, `trustState: "pending"` |
| `registerDevice` | same `deviceId`, same account, already exists | `"already-registered"` |
| `registerDevice` | same `deviceId`, different account | `"conflict"` |
| `registerDevice` | same `deviceId`, already revoked | `"revoked"` (terminal, no reuse) |
| `registerDevice` | wrong account per a real authority | `"denied"` |
| `confirmTrust` | binding not `"pending"` | `"invalid-transition"` |
| `confirmTrust` | production (unavailable) authority | always `"denied"` (fail-closed ceiling) |
| `revokeDevice` | already `"revoked"` | `"already-revoked"` (idempotent) |
| `recordLocalChange` | origin device not `"trusted"` | rejected, `"device-not-trusted"`, Journal untouched |
| `recordLocalChange` | unknown/disallowed `recordType` | rejected, `"record-type-not-allowed"`, Journal untouched |
| `recordLocalChange` | sensitive-marker metadata | rejected, Journal untouched |
| `restoreDeviceFromRecoverySnapshot` | target device not `"trusted"` | rejected (`false`) |
| `restoreDeviceFromRecoverySnapshot` | structurally inconsistent snapshot | rejected (`false`) |
| `runtime.deviceTrust()` | not configured | throws `"not enabled"` |
| `runtime.deviceTrust()` | after `stop()` | throws `"inaccessible after stop"` |

## Security guarantees this Arc makes

- No private key, Master Seed, or passphrase field exists anywhere in `FedosDeviceBindingV1`, its persisted events, or its codec (verified structurally by test and by the Phase L source scan).
- The production `UnavailableFedosDeviceRegistrationAuthority` can never produce a `"trusted"` binding — verified directly, not merely asserted.
- Device Registry conflict detection is a distinct, complementary invariant to Authority-level verification, never a substitute for it — a `deviceId` belongs to at most one account, but that alone was never treated as proof of ownership.
- The Sync Journal allowlist rejects every unknown `recordType` and every sensitive-marker metadata value before the Journal is touched — verified directly for a `"sender-key-secret"`-shaped and a `"device-private-key"`-shaped record type.
- Archive Restore is proven, not merely stated, to never create Device trust.
- No claim anywhere in this Arc's docs or code states or implies that Archive Restore equals synchronization, or that a Relay ACK equals device sync (neither concept is touched by this Arc).
