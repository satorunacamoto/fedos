# Secure Runtime Alpha 2421–2500: Multi Device Synchronization Foundation — Execution Spec

Architecture frozen. This Arc adds no new Rust/WASM primitive, no new `AeadAadDomain` variant, no new key-derivation domain, no Host/GUI wiring, no network transport, and no Sender-Key change. It is a pure, in-memory TypeScript orchestration layer — additive synchronization PRIMITIVES only, under a new `src/sync/` module.

## Scope

**Implement** (new, under `src/sync/`):

- Device Binding (`fedos_sync_device_binding.ts`) — a pure three-state (`bound`/`unbound`/`revoked`) state machine over an opaque `(deviceRef, accountRef)` pair. The first file in this codebase to carry a real "sync" concept in its own name; every earlier device-shaped boundary (`../identity/device_registration.ts`, `../identity/device_trust.ts`, Stage 127/128) explicitly deferred it.
- Device Registry (`fedos_sync_device_registry.ts`) — the durable per-account set of bindings, mirroring `InMemoryFedosConversationPersistence`'s private-`Map`, no-delete convention (Alpha 751). Enforces the one real invariant it owns: a `deviceRef` belongs to at most one `accountRef` (`"conflict"` otherwise).
- Sync Journal (`fedos_sync_journal.ts`) — the single append-only, per-account source of truth for "what changed." Assigns monotonic sequence numbers; `changeId` de-duplication is a hard invariant of `append()`.
- Sync Cursor (`fedos_sync_cursor.ts`) — a per-device, monotonic-only position marker into the Journal.
- Sync Queue (`fedos_sync_queue.ts`) — the durable per-target-device OUTBOUND delivery queue a local change fans out into (`"queued"` -> `"delivered"` -> `"acknowledged"`, with a `"failed"` retry state). Transport-agnostic: no network I/O, mirrors `FedosPrivateTransport`'s own Outbox/Publisher split in spirit only (Alpha 1471–1540).
- Pending Changes (`fedos_sync_pending_changes.ts`) — the per-device INBOUND staging area a delivered/redelivered entry lands in before it is resolved; the one place duplicate delivery is caught independently of the Journal's own `changeId` check.
- Conflict Vocabulary (`fedos_sync_conflict.ts`) — a pure CLASSIFICATION (`"none" | "duplicate" | "tombstone-vs-upsert" | "concurrent-update"`) of one conversation's next candidate entry against the last entry actually applied. Classification only, never resolution — resolution policy is explicitly out of scope (see below).
- Sync State (`fedos_sync_state.ts`) — the per-account coordinator composing every primitive above: `recordLocalChange`/`deliverQueuedChanges`/`redeliverChange`/`applyPendingChanges`/`acknowledgeApplied`, plus device and recovery lifecycle methods.
- Recovery State (`fedos_sync_recovery.ts`) — a serializable snapshot (`FedosSyncRecoverySnapshotV1`) of exactly the LOCAL, per-device state a device process needs to survive a restart without loss or duplication: its Cursor position, still-pending `changeId`s, and already-resolved `changeId`s.

## Key design decisions

1. **What a device "restart" loses vs. keeps**: a device's own Sync Cursor and Pending Changes are modeled as fragile in-memory state a process can lose (`FedosSyncState.resetDeviceRuntimeState()`); the Sync Journal, Device Registry, Sync Queue, and each device's own already-applied local-conversation state (`#lastAppliedByConversationPerDevice`) are modeled as durable and unaffected by a restart. Recovery State restores exactly the first category from a snapshot captured before the (simulated) crash — it never re-derives the Journal from nothing.

2. **Per-device local-application state, never shared cross-device**: `FedosSyncState` tracks "the last entry each device applied, per conversation" keyed by `(deviceRef, conversationId)`, not just `conversationId` — three devices independently applying the same journal entry must each see it as their own first application, never as a `"duplicate"` because a sibling device already applied it. (An earlier draft of this Arc shared this map across devices; the 3-device end-to-end test caught the bug before it shipped.)

3. **Conflict Vocabulary classifies, never resolves**: `classifyFedosSyncConflict()` names what kind of conflict exists (concurrent cross-device edit, tombstone-vs-upsert, or a re-seen duplicate) and nothing more. Last-write-wins, CRDT merge, or a user prompt are all real resolution policies a caller could apply on top of a `"conflict"` outcome — none is implemented here, mirroring the Archive Arc's own "Restore ≠ new persistence logic" discipline (Alpha 1541–1610) of never inventing behavior a later, separate Arc should own.

4. **Archive interaction via a narrow injected port, not a hard dependency**: `FedosSyncState` accepts an optional `archiveAwareness: { isConversationArchived(conversationId): boolean }`. A pending change targeting an archived conversation is reported `"archived-skip"` and still advances the device's Cursor (so it can never block the rest of the Journal), but `src/sync/` never imports `../conversation/archive/` directly. Real wiring of this port to the Archive module's own bundle/restore types is deliberately left to a future Arc — mirroring Archive's own 1541–1610 deferral of Sync.

5. **`conversationId`/`contentHash` are opaque strings, not `FedosConversationId`/ciphertext**: the Journal never imports the conversation module's branded id type or carries plaintext/ciphertext — an entry's `contentHash` is a reference to content living in this codebase's existing envelope/payload ports (Alpha 854/858, 803/804/806). Binding this Arc's own id shape to the real `FedosConversationId` brand, and to real encrypted content, is future Host-wiring work, not this Foundation.

## Deliberately out of scope (named, not silently dropped)

- Any network transport / relay wiring for Sync Queue delivery — `deliverQueuedChanges()`/`redeliverChange()` are driven by a caller (a test, or a future transport Arc), never a socket this Arc owns.
- Conflict RESOLUTION policy of any kind (last-write-wins, CRDT, user prompt).
- Any change to Sender-Key material, key exchange, or device pairing/attestation — Device Binding names a state, nothing about how a device authenticates.
- Any Host/file-path/GUI wiring for where a Recovery snapshot is persisted.
- Hard integration with `src/conversation/archive/`'s own bundle/restore types — this Arc's archive-awareness port is intentionally caller-implemented.
