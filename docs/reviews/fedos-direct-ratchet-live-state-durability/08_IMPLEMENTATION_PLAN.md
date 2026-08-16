# Implementation Plan

**Status**: Coordinator-adopted, ordered. Written against commit `3b78add1`.

## Sequencing (dependency order)

1. **`FileFedosDirectRatchetLiveStateSnapshotPersistence` storage-shape fix** (must land before
   step 2, or step 2 wires in the vulnerable shape). Change from append-forever NDJSON to
   atomic rewrite-in-place, one current record per `(sessionId, secretKind)`, mirroring
   `FileFedosSealedMasterSeedEnvelopePersistence`'s temp-file-then-rename pattern. Keep the
   exact same `put`/`get` interface — no caller changes needed elsewhere.
2. **Freshness check at restore** — add chain-position validation against durably-persisted
   session counters (`commitCounters()`'s own durable record) before trusting a decrypted
   snapshot. Reject (do not restore) if the snapshot's position is behind the known-durable
   ceiling.
3. **Composition-root wiring** (`fedos_desktop_runtime.ts`) — add
   `directRatchetLiveStateSnapshotLogPath`/`directRatchetRemotePublicKeyLogPath` config fields
   (mirroring `directRatchetSessionLogPath`'s own established pattern exactly), construct the
   two File-backed persistence classes when the path is supplied, wire into
   `conversationDirectRatchetDeps`. Update `FedosProfileInitializationCoordinator#buildRuntimeConfig()`
   to populate the new paths (matching how it already populates every sibling Direct Ratchet log
   path) — real profiles get durability automatically, not just test configs.
4. **`FedosDirectRatchetLiveVerificationState` + derivation function** — new pure function,
   new field on `getDirectRatchetStatus()`'s return shape (additive), wired into
   `FedosConversationSecurityStateController`'s Axis 2/3 fact-gathering and
   `deriveConversationSecurityState()`'s Axis 2/3 evaluation.
5. **Stale config comment correction** — `fedos_desktop_runtime_config.ts`'s doc comment
   claiming no durable backend exists must be corrected once it's wired.

## Ownership for parallel implementation (mirrors Phase A roles)

- **Agent S** (persistence): steps 1-3.
- **Agent U** (truthfulness): step 4.
- **Coordinator**: step 5, composition-root file conflicts if S and U's changes overlap in
  `fedos_desktop_runtime.ts`, final integration.
- **Agent R** (red team, post-implementation): the negative-test matrix from `06_RED_TEAM_MATRIX.md`
  against the real implementation once steps 1-4 land.
