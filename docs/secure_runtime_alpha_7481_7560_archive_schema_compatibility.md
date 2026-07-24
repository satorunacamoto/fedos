# Secure Runtime Alpha 7481–7560 — Archive Schema and Compatibility Document

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

## Schema version: unchanged

`FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION = 1` remains the only Archive
bundle schema version. This Arc's own fix is a FILTERING behavior at
collection/restore time, gated by an already-existing OPTIONAL dependency
(`retentionAuthority`) — not a change to any wire record's own shape. No
field was added, removed, or renamed on `FedosConversationArchiveBundleV1`,
`FedosPersistedConversationMessageEnvelopeV1`, or
`FedosPersistedConversationPayloadV1`.

## What DID change, and its own compatibility posture

1. **`FedosConversationArchiveCollectorDependencies.retentionAuthority`**
   (already existed) now ALSO gates Envelope collection, in addition to
   Payload collection. A caller who never supplies it (every pre-Arc
   caller) gets byte-for-byte unchanged behavior. A caller who already
   supplies it for Payload gating (the ONE existing production caller,
   `FedosConversationArchiveRuntime`) automatically gets Envelope gating
   too, with no further wiring required on their part.
2. **`FedosConversationArchiveRestoreDependencies.retentionAuthority`**
   (NEW, optional) — a caller who omits it gets byte-for-byte unchanged
   restore behavior (the pre-Arc default for every existing caller,
   until `FedosConversationArchiveRuntime` was updated in this same
   commit to supply it). Supplying it enables restore-time
   re-evaluation, symmetric with export.
3. **`FedosConversationArchiveSingleRecordOutcome`** gains one new
   member, `"denied"`, additive to the existing closed union
   (`"inserted" | "duplicate" | "conflict" | "failed" | "invalid"`).
   Any code pattern-matching this union EXHAUSTIVELY (a `switch` with no
   `default`) would need updating — none exists in this codebase today
   (confirmed: every consumer either uses `.length`/counts, or the
   `fromWriteResult()`/`tally()` helpers this Arc itself updates).
4. **`FedosConversationArchiveRestoreOutcomeCounts`** gains one new
   field, `denied: number`, additive to the existing five. Any test
   asserting an EXACT literal shape (`toEqual({inserted, duplicate,
   conflict, failed, invalid})`) needed updating to include `denied: 0`
   — done for every affected pre-existing test in this same commit (see
   the completion declaration's own accounting).
5. **`FedosConversationArchiveRestoreOutcome`** gains one new member,
   `"partially-denied"`, additive to the existing closed union, mirroring
   `"partially-invalid"`'s own precedent exactly.

## Unknown-version handling: unchanged

`decodeFedosConversationArchiveFileContainer()` still fails closed
(`"unsupported-version"`) on any schema-version mismatch — this Arc adds
no new version value to check against, so this discipline is inherited
verbatim, not re-implemented.

## Old-archive-version handling

Every existing Archive file (schema version 1, produced by any prior
Arc) remains fully readable and restorable — this Arc changes only
WHETHER an Envelope/Payload pair is filtered at read/write time, never
HOW the bundle itself is parsed. An old archive containing an Envelope
whose Payload this device now denies will have that Envelope skipped
(or, before this Arc, would not have been) — this is the intended fix,
not a compatibility break.

## No silent downgrade

Nothing in this Arc's own change path ever silently reduces a
`"restored"` result to something else without the caller being able to
tell why — the new `"partially-denied"` outcome, and the per-domain
`denied` counts inside `details`, together give a caller everything
needed to distinguish "fully restored," "some records denied by
retention," and "some records structurally invalid," rather than
collapsing any of these into one ambiguous signal.
