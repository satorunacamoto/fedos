# Secure Runtime Alpha 7481–7560 — Phase A: Reconciliation Report

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

Resumes from Secure Runtime Alpha 7401–7480 (`4c6fa3b3`). Implements the
exact narrow remediation recommended by the committed audit `2eed88d9`
("Archive/Retention/Deletion semantics audit at 194dc448", branch
`review/archive-retention-deletion-audit-194dc448`, a sibling of this
Arc's own base — inspected via `git show`, never checked out or merged).

## The audit's headline finding (verified against current source, unchanged since 194dc448)

`fedos_conversation_archive_collector.ts:111-167` collects Envelopes
(line 121, unconditional) and Payloads (lines 123-128, gated by an
OPTIONAL `retentionAuthority.evaluatePayloadAccess()` check) via two
INDEPENDENT statements — no cross-reference between them. An Envelope
whose own `payloadId` (`fedos_conversation_message_envelope.ts:80`)
points at a tombstoned/removed Payload is exported, and later restored
(`fedos_conversation_archive_restore.ts:167-175`), regardless of whether
that Payload itself made it into the same bundle. Confirmed still true
verbatim at this Arc's own base (`4c6fa3b3` descends from `194dc448`
with zero Archive/Retention file changes in between — Alpha 7401–7480
touched only NIP-17 routing).

## Inspection of every source the audit names, re-confirmed directly

1. **Archive Collector** (`fedos_conversation_archive_collector.ts`) —
   confirmed above; `retentionAuthority` is already an optional
   dependency, already wired through `FedosConversationArchiveRuntime`,
   consulted ONLY for `payloads`.
2. **Archive export schema** (`fedos_conversation_archive_bundle.ts`,
   `fedos_conversation_archive_schema_version.ts`) — one flat
   `schemaVersion: 1` literal, no per-record version, no tombstone/
   redaction record type of any kind. No accepted schema-version bump is
   required for this Arc's own fix (see Phase C/D below — the fix is a
   filtering behavior keyed off an already-existing optional dependency,
   exactly mirroring the Payload gate's own zero-schema-impact shape).
3. **Archive restore validator/importer** (`fedos_conversation_archive_restore.ts`) —
   confirmed: `restoreFedosConversationArchiveBundle()` has NO
   `retentionAuthority` parameter at all today; envelopes and payloads
   are restored via two independent loops with no cross-reference, and
   neither the Envelope validator nor `putEnvelope` ever checks Payload
   existence (confirmed by reading `fedos_conversation_message_envelope_validator.ts`
   and the restore loop directly).
4. **Payload Retention Authority** (`fedos_payload_retention_authority.ts`) —
   `evaluatePayloadAccess(payloadId)` returns exactly `{outcome:"allowed"}`
   / `{outcome:"denied", state:"tombstoned"|"payload-removed"}` /
   `{outcome:"not-found"}` — a pure preview, no decision write, already
   the exact gate Search (Alpha 2581-2620) and Archive Payload
   collection (Alpha 7241-7320) both reuse. This Arc reuses it a third
   time, for Envelope collection and (newly) for restore-time
   re-evaluation — never a second Retention Authority.
5. **Local Deletion capability/status types** (`fedos_deletion_capability_descriptor.ts`) —
   a genuine, PRE-EXISTING discrepancy found, independent of the audit's
   own headline finding: the static registry's `"local-envelope"` entry
   claims `reachableToday: true` with `supportedOperations: ["tombstone",
   "logical-delete"]`, but `fedos_deletion_plan.ts:59-81`'s own plan-step
   `target` union structurally supports only `"local-payload"` and
   `"local-index"` — NEVER `"local-envelope"` — and
   `executeFedosLocalPayloadDeletionPlan()` (`fedos_deletion_execution_coordinator.ts:130-170`)
   calls exactly two things, neither touching Envelope persistence at
   all. There is no real executor, plan-step, or persistence method
   implementing live Envelope deletion anywhere in this codebase. This
   descriptor overclaims a capability that does not exist — closed in
   Phase G below by correcting it to `reachableToday: false`,
   `supportedOperations: []`, consistent with "Fail Closed over
   fabrication."
6. **Search purge semantics** (`fedos_conversation_search_index.ts`) —
   confirmed: `reconcilePayloadRetention()` purges the sub-index
   correctly and is idempotent (Alpha 2581-2600, re-tested by this
   Arc's own regression run). `indexArchiveBundle()` exists, is itself
   correctly retention-gated, but is called from nowhere in `src/` —
   restoring an archive never repopulates Search. Confirmed unchanged;
   left exactly as-is (out of this Arc's own narrow scope — the mission
   explicitly forbids Search redesign, and re-indexing-on-restore is a
   separate completeness gap, not a security/privacy one).
7. **Signed Deletion local execution** (`fedos_deletion_execution_coordinator.ts`,
   the granted-request path in `8981f81`) — confirmed: bottoms out in
   the SAME local-only executor `b3b3a6d` built; touches only Payload +
   Search; never Envelope, Conversation, or Membership. Consistent with
   this codebase's own documented "local-only, non-physical" scope —
   unmodified by this Arc.
8. **Safety Center Archive warnings** (`fedos_safety_center_warning_codes.ts`,
   `fedos_safety_center_summary.ts`, `fedos_desktop_archive_view_model.ts`,
   `fedos_desktop_archive_renderer.ts`) — confirmed: one generic,
   undifferentiated warning (`archives-and-backups-may-retain-copies`),
   surfaced only on the generic Safety Center overview screen; the
   Archive export/restore workflow itself surfaces no warning of any
   kind (neither file imports any warning text). A second, drifted
   inline literal exists in `fedos_safety_center_summary.ts:143` outside
   the canonical lookup table.
9. **Archive versioning/migration policy** — confirmed: `FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION = 1`
   is the ONLY version; `decodeFedosConversationArchiveFileContainer()`
   fails closed (`"unsupported-version"`) on any mismatch, never guesses
   or auto-upgrades — this Arc's own fix requires no version bump and
   inherits this discipline unchanged.

## Envelope metadata field inventory and classification

| Field (on `FedosConversationMessageEnvelope`) | Classification |
|---|---|
| `id` | Required for integrity — restore is keyed by this id (`putEnvelope`, never regenerated); also the target of `replyToEnvelopeId` references elsewhere. |
| `conversationId` | Required for referential consistency — binds the Envelope to its Conversation; already collected/validated as a unit with the Conversation record itself. |
| `senderMembershipId` | Forbidden after retention denial (per this Arc's own chosen policy, Phase B) — sender identity is exactly one of the audit's own named leaked categories. |
| `payloadId` | Required for integrity when the Payload is retained; becomes a dangling (never-resolving) reference when its Payload is denied — an ALREADY-tolerated condition in this codebase (no port anywhere enforces envelope→payload referential integrity; confirmed by reading the restore loop directly). |
| `encryptionSuite` | Derived/reconstructible-adjacent — a fixed, closed enum describing HOW the (now-inaccessible) ciphertext was sealed, not sensitive on its own; retained only insofar as the Envelope itself is retained. |
| `keyEpoch` | Same as `encryptionSuite` — inert once the Payload itself is gone. |
| `createdAt` | Forbidden after retention denial (per Phase B) — timestamp is exactly one of the audit's own named leaked categories. |
| `replyToEnvelopeId` | Optional user-visible history / referential — points at another Envelope's own id; already tolerated as a dangling reference today (no foreign-key enforcement exists anywhere). |

Non-Envelope categories the mission also names, classified:

| Category | Classification |
|---|---|
| Message existence (i.e., does the Envelope record exist at all) | Forbidden after retention denial — the audit's own sharpest finding. |
| Relay event id | Not part of the Envelope/Payload/Archive domain at all — the Archive bundle never stores an outer Relay/Gift-Wrap event id (confirmed by the bundle schema enumeration below); out of scope, nothing to change. |
| Ciphertext | Already correctly forbidden/gated (Alpha 7241-7320, unmodified). |
| Payload reference (i.e. `payloadId` as a value, from the Payload's own side) | Sensitive metadata — an accessible `payloadId` for a denied Payload is itself a fact ("this Payload existed, here's its id") independent of the Envelope; closed by the SAME export/restore gate. |
| Attachment metadata | N/A — no attachment concept exists in this codebase (confirmed, `fedos_deletion_request_target_type.ts:8`). |
| Control-payload discriminator (deletion request/execution/decision records) | Retained permanently, by design, unmodified — explicitly out of scope per the audit's own Option 4 and this Arc's own mission ("Explicitly not recommended: touching control-message metadata"). |
| Ratchet/session metadata | Not part of the Archive bundle schema at all (confirmed by bundle schema enumeration: `conversation`, `memberships[]`, `capabilityEvents[]`, `envelopes[]`, `payloads[]`, optional Group section — no Ratchet/session record type exists anywhere in it); out of scope, nothing to change. |
| Search tokens | Not automatically reintroduced by restore today (confirmed, `indexArchiveBundle()` called from nowhere); unchanged by this Arc, per its own explicit "no Search redesign" prohibition. |

## Assigned Alpha range

**7481–7560**, confirmed genuinely free (no `test/`/`docs/` file, no
README reference, at this Arc's own base `4c6fa3b3`) before any
production edit was made — see the parallel-coordination instructions
this Arc was given.

## Verdict

The audit's own findings are independently reconfirmed, verbatim, at
this Arc's current base. No production edit has been made before this
report. Proceeding to Phase B (Normative Metadata Policy).
