# Secure Runtime Alpha 7641–7720 — Phase A Reconciliation Report

**FedOS Delivery Observation Repository Subject Index and Query Scalability Arc.**

Base: `1e79c831` (Secure Runtime Alpha 7561–7640, "FedOS Conversation Outbox
Restart Hydration and Scheduler Scalability Arc," FULL COMPLETION),
confirmed a descendant of `4c6fa3b3` (Alpha 7401–7480) via
`git merge-base --is-ancestor`. Worktree: `C:/wt/delivery-observation-subject-index`.
Branch: `arc/delivery-observation-subject-index-query-scalability`.

Ran as "Arc A" of a two-Arc parallel-execution assignment; "Arc B" (FedOS
Archive Multi-Device Suppression Propagation) runs independently in a
separate worktree/branch and is never touched by this Arc (see Phase L's
own structural guard).

## 1. The complete audit, read in full

`212b8420` ("Conversation Outbox + Scheduler: Read-Only Scalability
Audit") — measured the Outbox persistence layer itself
(`AppendOnlyFedosConversationTransportOutboxPersistence`) as O(T),
genuinely cheap (~1.45 μs/record) even at T=100,000; root-caused the
Scheduler's own restart-replay storm to a missing hydration seed; its
own §14 option 1 (port Board's Alpha 585/586 hydration) was the
recommended, narrowest fix — implemented FULLY by Alpha 7561–7640.

## 2. The Alpha 7561–7640 implementation and completion docs, read in full

`hydrateFedosConversationTransportDeliveryRecoveryState()`
(`src/conversation/transport/fedos_conversation_transport_delivery_recovery_hydration.ts`)
closed the named defect. While measuring it, that Arc discovered and
fully disclosed (not fixed, out of its own scope) a SECOND, DEEPER,
shared bottleneck: `FedosDeliveryObservationQuery.historyFor()` and
`FedosDeliveryRetryQuery.historyFor()` scale
**O(historyBearingSubjectCount²)**, not O(T), because every per-subject
history read re-scans the ENTIRE Observation repository. Measured
cleanly: 5 consecutive doublings (deliveredCount 100→3,200) showing a
consistent ~4x time-per-2x-count ratio, the textbook O(n²) signature.
This Arc's own mission is to close exactly that gap, per that Arc's own
named "Recommended next Arc" section verbatim.

## 3. `FedosDeliveryObservationRepository` (Alpha 466), read in full

`src/board/observation/fedos_delivery_observation_repository.ts`, 96
lines. Three public methods: `record()` (validates, then
`persistence.putObservation()`, mapping `"inserted"` → `"recorded"`),
`get(id)` (single lookup via `persistence.getObservation()`), `list()`
(full deserialize of every persisted record, skipping corrupt ones
silently — "a pure, best-effort read," no caching claimed or implied).
No existing in-memory index of any kind. Constructor takes exactly one
argument, `persistence`.

## 4. Every constructor/caller, found via `git grep`

Exactly four production construction sites, none of which pass more
than the single `persistence` argument (confirming the fix can be
purely internal, with zero call-site changes required):

- `src/desktop/runtime/fedos_desktop_runtime.ts:670` (Board, real
  `AppendOnlyFedosDeliveryObservationPersistence` when
  `config.observationLogPath` is configured — **the real, durable,
  production path**).
- `src/desktop/runtime/fedos_desktop_runtime.ts:1307` (Conversation
  Transport, same durable/in-memory choice pattern).
- `src/desktop/host/fedos_desktop_host.ts:381` (Board, in-memory
  default).
- `src/conversation/runtime/fedos_conversation_runtime.ts:1060` and
  `fedos_conversation_runtime_assembly.ts:328` (Conversation's own,
  deliberately SEPARATE, never-shared subject-id namespace — confirmed
  by that file's own header comment).

## 5. Board and Conversation subject shapes

Both domains share the exact same `FedosDeliveryObservationSubjectId`
opaque-string vocabulary (Alpha 462) — Conversation's own repository
instance is a structurally separate object (separate persistence,
separate in-memory Map once this Arc's index exists), never a shared
Map keyed across domains, so no cross-domain collision risk exists
even though the key TYPE is shared.

## 6. Append/write operations

`FedosDeliveryObservationRepository.record()` is the ONLY write path.
`FedosValidatingDeliveryObservationRepository.record()`
(`fedos_delivery_observation_write_validator.ts`) wraps it with a
PRE-write read (`query.currentStateFor(subjectId)`) for transition/
staleness validation, then delegates to the real `record()` — meaning
every validated write already pays one `historyFor()`-shaped read
before its own O(1) persistence append; this read benefits from this
Arc's fix automatically, with zero changes to this validator file.

## 7. History query operations

`FedosDeliveryObservationQuery.historyFor(subjectId)`
(`fedos_delivery_observation_query.ts:49-54`) — `repository.list()`
then `.filter()` then `.sort()`. `currentStateFor()` derives from
`historyFor()`'s own last element. `listByState(state)` is a genuinely
CROSS-subject query (used by callers that need every Observation in one
state across every subject) — explicitly OUT of this Arc's own scope
per its own mission text ("Keep `list()`'s own existing full-scan
behavior for callers that genuinely need every Observation across all
subjects") — `listByState()` stays on `repository.list()` unchanged.

`FedosDeliveryRetryQuery.historyFor(originalSubjectId)`
(`fedos_delivery_retry_query.ts:56-73`) probes attempt-scoped subject
ids 1, 2, 3, … via `query.currentStateFor()` until one returns `null` —
each probe is its own full `historyFor()` call, so this class's own
cost is `(probe count) × (historyFor() cost)`; it needs ZERO changes,
it benefits transitively and automatically once `historyFor()` itself
is fixed.

## 8. Revision/conflict/rollback behavior

`isAllowedFedosDeliveryObservationTransition()` (Alpha 494) and the
staleness check in `validateFedosDeliveryObservationTransition()`
(Alpha 495) both operate on `currentStateFor()`'s own single derived
read — unaffected in MEANING by this Arc, only in cost. A rejected
transition (`"invalid-transition"`/`"stale"`) never reaches
`record()`, so it never reaches this Arc's own index-update path either
— consistent, no new inconsistency window introduced.

## 9. Corruption/truncated-tail behavior

`FedosDeliveryObservationRepository.list()`'s own discipline: a corrupt
persisted record deserializes to `null` (via
`deserializeFedosDeliveryObservation`) and is silently skipped, never
thrown. The REAL durable backend,
`AppendOnlyFedosDeliveryObservationPersistence.listObservations()`
(`replayLog()`), is STRICTER: an unparsable JSON line or a
conflicting-duplicate-id THROWS, uncaught — this is the backend's own
pre-existing, deliberate fail-closed discipline (mirrors the sibling
Board Outbox backend exactly), unrelated to and unweakened by this
Arc's own change. This Arc's new index-build-at-construction step calls
`persistence.listObservations()` exactly once (same call `list()`
already made) — if that call throws (a genuinely corrupt durable log),
construction itself throws, exactly matching what calling `list()`
immediately after construction would already have done. No new failure
mode; the failure moment moves from first-`list()`-call to
construction-time, which is FASTER fail-closed behavior (a corrupt log
is now discovered at startup, not on first read), never slower or
silent.

## 10. Repository startup/load behavior

No prior "startup rebuild" existed — every `list()` call independently
replayed from scratch, on every single call, discarding the result
immediately after. This Arc introduces the FIRST persistent in-memory
structure this class has ever held, built once at construction.

## 11. Concurrency assumptions

This codebase's persistence layer is synchronous and single-threaded
(no worker threads, no async I/O in the Node file backend) — the
existing `record()`/`list()`/`get()` methods already assume single-
threaded, one-Node-process access (consistent with every other
append-only backend in this repository). This Arc's own index inherits
the identical assumption; no new concurrency primitive is introduced,
none is needed.

## 12. Tests that pin record counts or file shapes

`test/secure_runtime_alpha_466_delivery_observation_repository.test.ts`
(7 tests) and `test/secure_runtime_alpha_467_delivery_observation_query.test.ts`
(8 tests) assert exact ordering (including an out-of-insertion-order
`historyFor()` case, test 1, and a same-`observedAt` tie-break-by-id
case, test 3) — this Arc's own `historyFor()` refactor MUST preserve
identical output for both, which requires the per-subject index array
to still be sorted at READ time (`historyFor()`'s own existing
`.sort(compareByObservedAtThenId)` call), not assumed pre-sorted by
insertion order. Both suites re-run unmodified as regression proof.

## 13. Reproducing the O(n²)-class behavior with a bounded, unmodified harness

Confirmed via a temporary, uncommitted benchmark script (`npx tsx`,
deleted after use, `git status --short` clean before/after) reusing the
EXACT method from the prior Arc's own §Part 1 methodology — see Phase H
below for the full before/after results.

## 14. Expected files to change

- `src/board/observation/fedos_delivery_observation_repository.ts` —
  add `#bySubject` index, `listForSubject()`, incremental update in
  `record()`.
- `src/board/observation/fedos_delivery_observation_query.ts` —
  `historyFor()` uses `listForSubject()` instead of `list()`+`filter()`.

## 15. Frozen files (touched by neither Phase C/D nor any later phase)

`fedos_delivery_observation.ts`, `fedos_delivery_observation_codec.ts`,
`fedos_delivery_observation_persistence.ts`,
`in_memory_fedos_delivery_observation_persistence.ts`,
`append_only_fedos_delivery_observation_persistence.ts`,
`fedos_delivery_observation_transition_graph.ts`,
`fedos_delivery_observation_write_validator.ts`,
`fedos_delivery_retry_query.ts`, `fedos_delivery_retry_reason_codec.ts`,
`fedos_delivery_retry_registry.ts`, every Board Outbox file, every
Conversation Outbox/Scheduler file, every Archive/Retention/Deletion
file, `p2p/`, `.tmp_gen/`.

## Honest scope boundary found during this reconciliation (disclosed, not fixed)

`AppendOnlyFedosDeliveryObservationPersistence.putObservation()` (the
REAL durable backend used at the real production construction site,
`fedos_desktop_runtime.ts:670`) calls `this.getObservation(record.id)`
FIRST — a full `listObservations()` replay — before its own O(1)
`appendFileSync`. This is a PERSISTENCE-LAYER duplicate-check cost,
structurally identical in shape to the ORIGINAL audit's own disclosed
(never fixed) Outbox `putIntent()` duplicate-check finding, and it is
UNRELATED to and UNCHANGED by this Arc's own Repository-level index —
fixing it would require a persistence-layer schema/index change,
explicitly prohibited by this Arc's own "Do not redesign persistence"
and "no persistence schema change" instructions. Disclosed precisely in
the complexity report below, not silently absorbed into an
over-broad O(1) append claim.

## Alpha range assignment

Historical **5401–5480 collision recorded**, per instruction: two
distinct commits both claim this exact range —
`be1bc0d9` ("FedOS Direct Ratchet State and Sealed Persistence
Foundation Arc") and `b3b3a6d2` ("FedOS Local Deletion Capability and
Deletion-State Foundation Arc"). Neither is renumbered; recorded here
as a permanent historical fact per "never rewrite or renumber earlier
commits."

Verified via `git log --all --oneline` that no commit anywhere claims
7641–7720 or 7721–7800. **This Arc reserves 7641–7720** (the earlier of
the two free ranges, per coordination instructions); the sibling Arc B
reserves 7721–7800.

No source changes were made before this report existed.
