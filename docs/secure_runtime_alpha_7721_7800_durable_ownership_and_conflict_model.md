# Secure Runtime Alpha 7721–7800 — Durable Ownership and Conflict Model (Phase E)

## One local source of truth

`FedosArchiveSuppressionObservationAuthority`
(`src/conversation/retention/fedos_archive_suppression_observation_authority.ts`)
is the ONE local authority for suppression observations on a given
Device (Phase E's own "choose exactly one" requirement). It records both:

- this Device's own self-authored facts (`recordSelfSuppression`) —
  created when the local `FedosPayloadRetentionAuthority` makes a new
  tombstone/removal decision, via the standalone bridge
  `fedos_archive_suppression_local_bridge.ts` (see below);
- facts imported from other trusted, same-account Devices
  (`recordImportedSuppression`), called ONLY after the Inbound Handler
  (Phase G) has already verified account/Device trust — this class
  itself performs NO authentication.

Both paths converge on the identical `#tryRecord()` write path and the
identical `FedosPersistedArchiveSuppressionObservationV1` record shape,
distinguished only by `origin: "self" | "imported"` and `evidenceLevel`.

## Why a standalone bridge, not a Deletion Execution Coordinator edit

`fedos_deletion_execution_coordinator.ts`'s own header states it is "the
ONLY mutating layer" for local deletion execution and names no
suppression-fact concept. `fedos_archive_suppression_local_bridge.ts`
(`createAndRecordLocalArchiveSuppressionFact()`) is deliberately a
STANDALONE function — it derives the next monotonic revision
(`nextRevisionForSubject()`), builds and records a fact, but never
modifies the Deletion Execution Coordinator and adds no new mutation
path of its own to that file. A caller invokes both independently, in
whatever order the caller's own local deletion flow dictates — this Arc
intentionally does not wire that call site into the coordinator itself,
since doing so would touch a file explicitly out of scope.

## Conflict/rollback rule (Phase A reconciliation report §8's own decision)

A flat, per-`(subjectRef, sourceDeviceId)` monotonic `revision`:

```
maxRevisionSoFar = max(revision of every existing observation for this
                        exact (subjectRef, sourceDeviceId) pair, or -1)

if NOT already-have-this-exact-factId AND candidate.revision <= maxRevisionSoFar:
    -> "rollback-rejected"
```

This mirrors Identity Transition's own rollback rule
(`candidate.revision <= maxRevisionSoFar`) **without** that domain's
heavier predecessor-chain/cycle-detection machinery — not justified
here, since a suppression fact has no lineage to walk, only a flat
monotonic count per originating Device.

### The five possible write outcomes

| Outcome | When |
|---|---|
| `"recorded"` | A genuinely new fact, `revision` strictly greater than every prior one for this `(subject, sourceDevice)`. |
| `"already-present"` | The identical `factId` was already durably recorded with identical content — idempotent replay, not an error. |
| `"rollback-rejected"` | A different `factId` at a `revision` ≤ the max already recorded for this `(subject, sourceDevice)` — an attacker or stale replay cannot regress a suppression decision. |
| `"conflict"` | The identical `factId` (same `accountRef`/`sourceDeviceId`/`subjectRef`/`suppressionMeaning`/`revision` — since `factId` excludes `decidedAt`/`nonce`) but DIFFERENT content — flagged, never silently overwritten. |
| `"failed"` | The underlying persistence write itself failed. |

Both `recordSelfSuppression` and `recordImportedSuppression` are subject
to the identical rule — a caller cannot accidentally regress this
Device's own prior revision either, and a locally-stronger (higher
revision) self-authored decision is never weakened by a later-arriving,
lower-revision imported fact (proven directly in Phase M, failure matrix
test 13).

## `evaluateSuppression()` — the one query Archive restore consults

```ts
evaluateSuppression(payloadId, "restore" | "envelope-restore" | "search-reindex"): "active" | "suppressed"
```

`"suppressed"` iff at least one durable observation exists for
`payloadId` whose `suppressionMeaning` covers the requested `meaning`
AND whose `evidenceLevel` is not `"device-evidence-invalid"`. `origin`
(self vs. imported) does not matter here — both are equally
authoritative once past their own respective trust gate. This is
deliberately the ONLY query surface Archive restore (Phase H) is given;
it never receives raw records, so a restore-time caller cannot
accidentally branch on `origin`/`evidenceLevel` itself and reintroduce a
second, disagreeing suppression policy.

## Durability

Two backends exist, mirroring `AppendOnlyFedosPayloadRetentionPersistence`'s
own established pattern exactly: `InMemoryFedosArchiveSuppressionObservationPersistence`
(tests) and `AppendOnlyFedosArchiveSuppressionObservationPersistence`
(production — independent NDJSON log file, insert-only, no
compaction/delete/rewrite, full `replayLog()` on every call so there is
no in-memory cache to go stale across a restart). A truncated/corrupt
log line fails closed by throwing rather than silently dropping or
fabricating recovered state (Phase M, tests 18–19).
