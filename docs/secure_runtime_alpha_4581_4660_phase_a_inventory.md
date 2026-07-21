# Secure Runtime Alpha 4581-4660 — Phase A Source Inventory

Base commit: `8b0492e` (Alpha 4501-4580, Desktop Device Sync Electron Main
Integration Arc). Branch `arc/desktop-device-registration-pairing-durable-journal`,
worktree `C:\wt\desktop-device-pairing`. Ancestry of all nine named prerequisite
arcs was verified by the coordinator via `git merge-base --is-ancestor` before
this session started (single linear history, no divergent lineages) — this
document covers the API-level source verification, not that ancestry
archaeology.

## 1. Device Binding request schema

`src/device/binding_challenge/fedos_device_binding_challenge.ts` —
`FedosDeviceBindingChallengeV1`: `schemaVersion(1)`, `domain` (fixed constant
`FEDOS_DEVICE_BINDING_DOMAIN_V1 = "fedos:device-binding:v1"`), `action`
(`"register-device" | "revoke-device"`), `deviceId`, `devicePublicKeyHex`
(64-hex), `issuedAt`/`expiresAt` (unix seconds, `expiresAt > issuedAt`),
`nonce` (32-64 hex). `isWellFormedFedosDeviceBindingChallengeV1()` validates
structurally (exact 8-key shape); never checks signatures/expiry/replay.

## 2. Canonical challenge serialization

`serializeFedosDeviceBindingChallengeV1()` — fixed-order JSON array tuple
(mirrors `src/nostr/event.ts`'s `serializeForId()`), so no object-key-order
ambiguity. This exact string is the one preimage both signature roles below
sign (under different prefixes/wrapping).

## 3. Account authorization proof

`src/device/binding_challenge/fedos_device_binding_account_authorization.ts`
— wraps the canonical challenge serialization as the `content` of an
ordinary kind:1 Nostr event (fixed tag `["t","fedos-device-binding-v1"]`),
signed via the EXISTING `FedosNostrSigningAuthority` (no widened kind, no new
WASM export). Verification (`verifyFedosDeviceBindingAccountAuthorization()`)
re-derives the exact content, checks the tag, and calls the existing
`NobleSignatureVerifier.verify()` (real BIP-340 Schnorr). `accountPublicKeyHex`
is populated ONLY from `event.pubkey` after a real signature check — never a
caller claim.

## 4. Device proof of possession

`src/device/binding_challenge/fedos_device_binding_proof_of_possession.ts` —
independent Device keypair (`FedosDeviceSigningKeypair`,
`src/device/crypto/fedos_device_signing_keypair.ts`, real `@noble/curves`
Schnorr/secp256k1, generated via `schnorr.utils.randomSecretKey()`, opaque
handle, no private-key getter). Signs `sha256("fedos-device-binding-proof-of-
possession-v1:" + serializeFedosDeviceBindingChallengeV1(challenge))` — a
DIFFERENT preimage prefix than the account authorization's own Nostr-event
preimage, so the two signature roles are never interchangeable.
`verifyFedosDeviceBindingProofOfPossession()` checks key match, real Schnorr
verification (`verifyFedosDeviceSigningSignature()`), then expiry.

## 5. Replay persistence

Port: `src/device/persistence/fedos_device_binding_challenge_replay_persistence.ts`
(`getConsumption(nonce)`/`putConsumption(record)`). Two implementations:
`in_memory_fedos_device_binding_challenge_replay_persistence.ts` (process-only)
and `append_only_fedos_device_binding_challenge_replay_persistence.ts`
(durable NDJSON, insert-only, fail-closed on corrupt/conflicting-duplicate
line, mirrors `append_only_fedos_device_registry_persistence.ts` exactly —
this is the established precedent Phase F's durable Sync Journal backend
follows).

## 6. Registration outcomes

`src/device/binding_challenge/fedos_device_binding_registration_authority.ts`
— `FedosDeviceBindingRegistrationAuthority.registerDevice()` returns one of
`"registered-trusted" | "already-present" | "conflict" | "invalid-account-proof"
| "invalid-device-proof" | "expired" | "replayed" | "revoked" | "unsupported"
| "failed"`. Requires BOTH a valid account authorization AND a valid Device
proof over the byte-identical challenge; replay is keyed on `nonce` with
idempotent-identical vs. conflicting-different content distinguished.

## 7. Revocation outcomes

Same file, `revokeDevice()` — `"revoked" | "already-revoked" | "not-found" |
"wrong-account" | "device-mismatch" | "invalid-account-proof" | "expired" |
"replayed" | "unsupported" | "failed"`. Account-authorization only (no Device
cooperation required); bound to `deviceId` AND `devicePublicKeyHex`; terminal
via `fedos_device_binding.ts`'s own closed transition table (no outgoing edge
from `"revoked"`).

## 8. Device Registry ownership

`PersistedFedosDeviceTrustAuthority` (`src/device/persistence/
persisted_fedos_device_trust_authority.ts`) is a STATELESS, read-through
orchestrator over an injected `FedosDeviceRegistryPersistence` — every method
re-reads the persistence backend directly, no in-memory cache. This means
MULTIPLE `PersistedFedosDeviceTrustAuthority` instances constructed over the
SAME persistence instance (or, for the Append-Only backend, the same log
file path) observe and mutate identical durable state — confirmed safe by
`fedos_already_verified_device_registration_authority.ts`'s own documented
precedent ("the ONLY caller that ever holds a reference to the
PersistedFedosDeviceTrustAuthority instance built with
AlreadyVerifiedFedosDeviceRegistrationAuthority is
FedosDeviceBindingRegistrationAuthority itself"). This is the key fact this
Arc's Phase B/E wiring relies on to avoid a "second Device Registry": the new
pairing facade's own `FedosDeviceBindingRegistrationAuthority` is constructed
over the EXACT SAME `deviceRegistryPersistence`/`FedosDeviceBindingChallengeReplayPersistence`
instances the Runtime's own `FedosDeviceTrustRuntime` already owns — one
durable backend, two thin orchestrator objects over it (one gated
"already-verified" for the crypto-checked path, one plain for direct
Runtime/Scheduler reads) — never a second log file, never divergent state.

## 9. Device Trust Runtime ownership

`src/desktop/runtime/fedos_device_trust_runtime.ts` — `FedosDeviceTrustRuntime`,
owned exactly once per `FedosRunningDesktopRuntime`, returned by
`runtime.deviceTrust()`. Constructed with `trustAuthority` (a
`PersistedFedosDeviceTrustAuthority` built from
`config.deviceRegistrationAuthority ?? new UnavailableFedosDeviceRegistrationAuthority()`)
and `syncState` (`FedosSyncState`). `revokeDevice()` cascades into
`FedosSyncState.revokeDevice()` (future sync eligibility only; no history
erasure). `registerSyncDevice()` only ever admits a currently-`"trusted"`
device into the Sync fabric.

## 10. Desktop Runtime ownership

`src/desktop/runtime/fedos_desktop_runtime.ts` — `startFedosDesktopRuntime()`
constructs, inside the `config.deviceTrustEnabled` gate: one
`AppendOnlyFedosDeviceRegistryPersistence`/`InMemoryFedosDeviceRegistryPersistence`
(`deviceRegistryPersistence`), one `PersistedFedosDeviceTrustAuthority`
(injected with `config.deviceRegistrationAuthority ??
UnavailableFedosDeviceRegistrationAuthority` — this is the confirmed
blocker: nothing in this base ever supplies the REAL, Alpha 3161-3240
`FedosDeviceBindingRegistrationAuthority`-gated capability here, so every
registration reachable through `FedosDeviceTrustRuntime.registerDevice()`
directly is capped at `"unavailable"`, never `"trusted"`), one
`FedosSyncState` (`syncStateInstance`, in-memory `FedosSyncJournal` inside
it), one `FedosDeviceTrustRuntime`, and (when `deviceSyncSchedulerEnabled`)
one `FedosDeviceSyncScheduler` + one `FedosDeviceSyncOperationalFacade`. The
returned `FedosRunningDesktopRuntime` exposes `deviceTrust()` and
`deviceSyncOperational()`, throwing `"not enabled"`/`"inaccessible after
stop"` per the established two-state contract every other accessor uses.

`src/device/binding_challenge/fedos_device_binding_boundary_factory.ts`
(`createFedosDeviceBindingBoundary()`) already exists, unused by any
production caller, and its own header explicitly documents the exact
intended integration this Arc performs: "`FedosRunningDesktopRuntime` would
gain one opt-in flag ... and one narrow `deviceBinding()` accessor that
calls `createFedosDeviceBindingBoundary()` once, exactly like `deviceTrust()`
already does." This Arc adopts that named integration point verbatim.

## 11. Shell's existing Device commands

`src/desktop/shell/fedos_desktop_application_shell.ts` — `deviceStatus()`
(always `"unavailable"`, unrelated legacy `src/sync/*` gap, own reason
string, untouched by this Arc), plus 12 Device Sync Operational commands
(`devicesList`, `deviceDetail`, `deviceSyncStatus`, `deviceSyncStart`,
`deviceSyncStop`, `deviceSyncNow`, `syncSchedulesList`, `syncTransfersList`,
`syncConflictsList`, `syncConflictDetail`, `syncConflictAcknowledge`), all
delegating to `runtime.deviceSyncOperational()`, gated on
`config.deviceTrustEnabled`. Confirmed: **no registration/pairing-initiating
Shell method exists at all** — reproduces blocker #1 exactly.

## 12. Host command vocabulary

`src/desktop/host_boundary/fedos_desktop_host_command.ts` —
`FedosDesktopHostCommand` closed union: `runtime-status`, `device-status`,
`conversations-list`, `conversation-open`, `conversation-create-direct`,
`conversation-create-group`, `messages-list`, `message-reveal`,
`message-send`, `message-reply`, `membership-list`, `invitation-descriptor`,
`search`, `archive-inspect`. **Non-obvious finding**: none of the 11 Device
Sync Operational Shell commands (item 11 above) are in this vocabulary
either — they were never exposed through the Host/IPC command layer by any
prior Arc. The immediately-prior Arc (Alpha 4501-4580, "Desktop Device Sync
Electron Main Integration") wired Device Sync status into the Electron MAIN
process's own badge/tray/notification adapters (`fedos_electron_badge_*`,
`fedos_electron_notifications_tray_*`), never into the renderer-facing
`dispatch()` command surface. This Arc's Phase H/J additions are therefore
the FIRST Device-anything commands ever added to this specific vocabulary.

## 13. Preload/main IPC vocabulary

`packages/fedos-desktop-electron-spike/src/fedos_electron_host_adapter_dispatch_translation.ts`
— `fedosElectronHandleInvoke()` is a thin, ALREADY-GENERIC multiplexer over
exactly 3 ops (`dispatch`/`render`/`status`); `dispatch` forwards its
`command` payload verbatim into `FedosDesktopHostBridge.dispatch()`, which
itself re-validates against `validateFedosDesktopHostCommand()` (item 12).
**Consequence**: adding new command types to the Host command vocabulary
(item 12) and to `FedosDesktopHostBridge.#dispatchOne()`'s own switch is
SUFFICIENT to make them reachable through the existing Electron IPC path —
`fedos_electron_host_adapter_dispatch_translation.ts` and
`fedos_electron_host_adapter_main.cts`/`_preload.cts` need NO change
whatsoever. This closes Phase J at a single, narrow point.

## 14. Device Management screens

`src/desktop/presentation/device_management/` (controller, navigation state,
presentation limits, screen enum, screen model) and
`src/desktop/renderer/device_management/` (action descriptor, renderer) —
built by Alpha 3941-4020, already wired into
`FedosDesktopConversationUiPresentationBoundary.deviceManagement`. The
`"registration"` and `"revocation-confirmation"` screens already exist and
are ALREADY HONEST about being non-functional:
`fedosDeviceManagementBuildRegistration()` hardcodes `available: false` with
reason "Device registration has no Shell/Facade command on this base -- see
Alpha 3941-4020 Phase A finding"; `fedosDeviceManagementBuildRevocationConfirmation()`
hardcodes `confirmAvailable: false` with an analogous reason. This Arc's
Phase I activates these two screens (and adds pairing-exchange-specific
sub-states) now that real Shell commands exist.

## 15. Current Sync Journal implementations

`src/sync/fedos_sync_journal.ts` — `FedosSyncJournal`: ONE concrete class, no
port/interface, no injected persistence at all — a private `#entries: []`
array and `#byChangeId: Map` held directly in the instance. No durable
backend of any kind exists for it anywhere in this codebase today (confirmed
by grep: every `FedosSyncJournal` reference is either the class itself or a
type-only import of `FedosSyncJournalEntryV1`/`FedosSyncJournalAppendResult`).

## 16. Current Journal construction path

`src/sync/fedos_sync_state.ts` line 84: `readonly #journal = new
FedosSyncJournal();` — constructed INTERNALLY, unconditionally, with no
constructor parameter to inject an alternative. `FedosSyncState`'s own
constructor accepts only `(accountRef, deps: { archiveAwareness? })` — no
journal-injection seam exists today.

`src/desktop/runtime/fedos_desktop_runtime.ts` line 706: `const
syncStateInstance = new FedosSyncState(syncAccountKey);` — the ONE
production call site, inside the `deviceTrustEnabled` gate, with no journal
durability option in `FedosDesktopRuntimeConfig` today.

## 17. Scheduler Journal dependency

`FedosDeviceSyncScheduler` (`src/device/sync_scheduler/
fedos_device_sync_scheduler.ts`) takes `syncState: FedosSyncState` at
construction (the SAME instance `FedosDeviceTrustRuntime` owns, per
`fedos_desktop_runtime.ts`'s own comment: "so the Scheduler/Import
Coordinator below can share the EXACT SAME Sync Journal instance
FedosDeviceTrustRuntime itself owns"). It reads journal entries only via
`FedosSyncState`'s own public methods (`journalEntries()`,
`listPendingChanges()`, etc.) — never touches `FedosSyncJournal` directly.

## 18. Transfer/import Journal dependency

`FedosDeviceSyncImportCoordinator` (`src/device/sync_scheduler/
fedos_device_sync_import_coordinator.ts`) reads `syncState.journalEntries()`
the same way. Neither the Scheduler nor the Import Coordinator constructs or
holds a `FedosSyncJournal` reference of their own — both go through
`FedosSyncState`. This means Phase F's durable backend can be added at
EITHER the `FedosSyncJournal` layer (an optional injected write-through/
hydration backend, entirely internal to that class) or by giving
`FedosSyncState` an optional externally-constructed `FedosSyncJournal`
instance — either way, zero ripple into the Scheduler/Import Coordinator,
since both consume `FedosSyncState`'s own public surface only, unchanged.

## 19. Current restart behavior

Confirmed by direct reading of `fedos_device_trust_runtime.ts`'s own header
(Alpha 2921-3000, unmodified by every intervening Arc through 4501-4580):
"`FedosSyncJournal`/`FedosSyncCursorStore` remain ... an in-memory,
single-process structure. This Arc does not add disk persistence for the
Journal or Cursor." A fresh `startFedosDesktopRuntime()` call always
constructs a brand-new, EMPTY `FedosSyncJournal` (via a brand-new
`FedosSyncState`) regardless of `deviceRegistryLogPath` — reproduces blocker
#2 exactly: the Device Registry survives a restart (durable NDJSON), but
every journaled Sync record, cursor, and pending-change entry is lost the
instant the process exits, even with every other `*LogPath` config field
populated.

## 20. Exact unavailable reproduction from the real Electron/Desktop stack

Reproduced for real in this session (see
`test/secure_runtime_alpha_4581_4660_baseline_blocker_reproduction.test.ts`):
(a) a `FedosDesktopApplicationShell` started with `deviceTrustEnabled: true`
and NO `deviceRegistrationAuthority` supplied exposes no method whatsoever to
mint a challenge, submit an account authorization, or submit a device proof
— `runtime.deviceTrust().registerDevice()` is reachable only by importing
the Runtime handle directly (never through the Shell), and even then is
capped at `initialTrustState: "unavailable"` by
`UnavailableFedosDeviceRegistrationAuthority`, never promotable past that
via `confirmTrust()` (`authorizeTrustConfirmation()` always `allowed:
false`). (b) Two independent `startFedosDesktopRuntime()` calls over the
IDENTICAL `deviceRegistryLogPath` but no journal-durability config each
start with a fresh, empty in-memory `FedosSyncJournal` — a change recorded
before the first `stop()` is entirely absent from `journalEntries()` after
the second `startFedosDesktopRuntime()` call, even though the Device Registry
itself (a separate durable log) correctly rehydrates the same Device
bindings across the same two calls.

## 21. Exact production files expected to change

- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — additive config fields (Phase G).
- `src/desktop/runtime/fedos_desktop_runtime.ts` — wire `deviceBinding()`/durable Journal (Phase E/F).
- `src/sync/fedos_sync_journal.ts` — optional injected durable backend (Phase F), additive only.
- `src/sync/fedos_sync_state.ts` — optional injected `FedosSyncJournal` instance (Phase F), additive only.
- NEW: `src/device/persistence/append_only_fedos_sync_journal_persistence.ts` + `fedos_sync_journal_persistence.ts` (port) + `in_memory_fedos_sync_journal_persistence.ts` — durable Journal backend, mirrors item 5's precedent.
- NEW: `src/desktop/runtime/fedos_device_pairing_facade.ts` — Phase B facade.
- NEW: `src/device/binding_challenge/fedos_device_binding_pairing_exchange.ts` — Phase C/D pairing exchange format + transport-neutral export/import port.
- `src/desktop/shell/fedos_desktop_application_shell.ts` — Phase H commands.
- `src/desktop/host_boundary/fedos_desktop_host_command.ts` + `fedos_desktop_host_bridge.ts` — Phase H/J vocabulary + dispatch.
- `src/desktop/presentation/device_management/fedos_device_management_screen_model.ts` + `fedos_device_management_controller.ts` — Phase I activation.
- `src/desktop/renderer/device_management/fedos_device_management_renderer.ts` — Phase I render content.
- `README.md` — chronological status blurb.
- NEW test files under `test/`.
- NEW docs under `docs/`.

## 22. Baseline test failures

Captured in this exact worktree before any production edit (see Verification
section of the completion declaration for the full, current re-run). Known
pre-existing, not-ours-to-fix items per this lineage's own carried-over
notes: `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
plus the fresh-worktree `?raw`-import/missing-WASM-artifact class of
failures and the `test/reviews/**` git-status-clean-only failures, both
already documented as environment artifacts by this lineage's memory notes
and confirmed here by the same A/B method (comparing against
`C:\wt\desktop-device-sync-electron-main`) rather than re-litigated from
scratch.
