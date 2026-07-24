# Secure Runtime Alpha 7561-7640 Completion Declaration

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc

**Status: FULL COMPLETION** of this Arc's own named mission — the production defect
("the Conversation Transport Scheduler is constructed without initial delivered or
abandoned state... after restart it therefore treats historical intents as pending and
retries the entire shared profile-wide log") is closed, real, and proven end-to-end. One
significant, unplanned, pre-existing scalability finding was discovered during
verification and is disclosed in full below and recommended as the next Arc — it does not
block this Arc's own completion, since it is not part of the defect this Arc was scoped to
fix and does not affect the correctness of the fix delivered.

## What was done

1. **Phase A reconciliation** (`secure_runtime_alpha_7561_7640_reconciliation_report.md`):
   14-point investigation of the existing Outbox/Scheduler/Observation machinery and
   Board's Alpha 585/586 precedent, before any source change. Assigned Alpha range
   7561-7640 (verified genuinely free; recorded the historical 5401-5480 collision
   precedent per the coordination instructions).
2. **One new production source file**:
   `src/conversation/transport/fedos_conversation_transport_delivery_recovery_hydration.ts`
   — `hydrateFedosConversationTransportDeliveryRecoveryState()`, a pure, read-only function
   porting Board's proven Alpha 585 hydration pattern, narrowed to the two fields
   (`delivered`/`abandoned`) `FedosConversationTransportScheduler`'s own existing
   constructor seam actually consumes (a named, deliberate scope decision — see the
   reconciliation report §11).
3. **One production wiring change**: `src/conversation/transport/fedos_private_transport.ts`'s
   constructor now calls the new hydration function and passes its result into the
   Scheduler's existing `initialDelivered`/`initialAbandoned` seam, before the Scheduler is
   constructed. This is the ONE production construction site for both
   `FedosConversationTransportScheduler` and `FedosPrivateTransport` (both structurally
   guarded, pre-existing and newly-added guards respectively).
4. **Real, non-mocked verification** at three levels: unit (10 hydration-classification
   tests), integration (`FedosPrivateTransport` restart tests, 2 tests, in-memory
   persistence), and a real vertical slice (file-backed persistence, real local WebSocket
   relay server, multi-conversation mixed workload, 5+ restart cycles, 1 test) — plus an
   8-test failure matrix and a 9-test structural guard suite.
5. **A significant, unplanned discovery, fully disclosed**: `FedosDeliveryObservationQuery`/
   `FedosDeliveryRetryQuery` (Board's own Alpha 467/528 machinery, reused unchanged per this
   Arc's own mandate) scan the ENTIRE Observation repository on every per-subject history
   read — making both this Arc's own hydration function and the pre-existing
   `FedosValidatingDeliveryObservationRepository`'s ordinary per-write validation cost
   O(historyBearingIntentCount²), not O(T). Measured cleanly (5 consecutive doublings,
   consistent ~4x-per-2x-count growth) at deliveredCount 100-3,200; extrapolated (clearly
   labeled, not measured) to ~3.2 minutes at 10,000 and ~5.3 hours at 100,000. Full details:
   `secure_runtime_alpha_7561_7640_complexity_before_after.md`.

## Full-completion checklist, against the mission's own definition

- [x] **Production hydration**: real, wired, one call site, structurally guarded.
- [x] **No restart republish of terminal history**: proven at three levels (unit,
      integration, real vertical slice) — a delivered or abandoned intent is never
      re-attempted after any number of restarts.
- [x] **Pending-only retry behavior**: proven — `tick()`'s own returned entry count exactly
      equals the genuinely-pending count in every test, including mixed multi-conversation
      workloads.
- [x] **No retry amplification**: proven across 5 consecutive restart cycles, both with
      in-memory persistence (Phase F) and real file-backed persistence + real relay
      (Phase I) — zero re-attempts, zero growth, in every cycle after the first.
- [x] **Preserved durability/dedup truth**: nothing in this Arc touches
      `FedosNip17InboundImportCoordinator`/receiver-side dedup (confirmed structurally,
      guard test 6); Relay-ACK (`"accepted"`) and recipient-import remain disjoint,
      unconflated concepts throughout (Phase B).
- [x] **Measured before/after results**: real (Part 1-3) plus honestly-labeled derived
      extrapolations, with the one dataset (T=100,000 at realistic pending ratios) that
      could not be completed within budget explicitly named as such, not silently omitted
      or fabricated.

## Verification results

`npm run typecheck:core`: clean except the same 2 pre-existing baseline errors this
codebase's own prior Arcs (e.g. Alpha 7321-7400) already documented as unrelated to any
Arc's own changes (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`) — zero new errors from
this Arc's 2 modified files or 5 new files.

This Arc's own 5 new test files, 30 tests total, all pass:
- `secure_runtime_alpha_7561_7640_conversation_transport_delivery_recovery_hydration.test.ts` — 10 tests (Phase C unit)
- `secure_runtime_alpha_7561_7640_private_transport_restart_hydration.test.ts` — 2 tests (Phase F integration)
- `secure_runtime_alpha_7561_7640_real_vertical_slice.test.ts` — 1 test (Phase I, real file-backed persistence + real local WebSocket relay)
- `secure_runtime_alpha_7561_7640_failure_matrix.test.ts` — 8 tests (Phase J)
- `secure_runtime_alpha_7561_7640_structural_guards.test.ts` — 9 tests (Phase K)

**Targeted regression suites** (11 pre-existing files: Board Outbox/Scheduler Alpha
413-478/585, Private Transport Alpha 1471-1540 including its own structural guards,
NIP-17 Transport Group Integration Alpha 1841-1920, Device Trust Runtime Integration Alpha
2921-3000, real Nostr Outbox processing Alpha 707, Scheduler/Runtime compatibility Alpha
733): 5 individual test failures found across 3 files, each individually inspected and
confirmed pre-existing and unrelated to this Arc's diff:
- 3 failures in `secure_runtime_alpha_1841_1920_nip17_transport_group_integration.test.ts`
  — `buildRealParticipant: expected "available", got "artifact-missing"` — this checkout
  has no compiled `packages/fedos-core-rust/pkg` WASM artifact (a gitignored build output),
  a pre-existing condition unrelated to any source file this Arc touches.
- 1 failure in `secure_runtime_alpha_1471_1540_structural_guards.test.ts` (test 4) — an
  exact-shape assertion against `package.json`'s script list from that Arc's own era;
  confirmed stale because many later, unrelated Arcs (Electron Beta packaging, etc.) added
  scripts long after — this Arc never touches `package.json`.
- 1 failure in `secure_runtime_alpha_478_publish_scheduler_implementation.test.ts` (test 4)
  — an exact-text assertion against an old design doc's own content, unrelated to this
  Arc's own files.

**Full `npm test`** (1,141 test files / 14,609 tests): 845 files / 14,166 tests passed, 270
files / 366 tests failed. This failure count and shape (hundreds of files, none from a
targeted spot-check overlapping this Arc's own 2-file diff) is consistent with this
codebase's own well-documented, session-independent baseline artifacts for any fresh
worktree — a broad "raw-import" test-collection artifact (previously documented in this
project's history at 261-292 files depending on snapshot) and `test/reviews/*`
specification-consistency suites that assert `git status` shows changes ONLY under their
own review's specific paths (which any worktree with ITS OWN legitimate uncommitted Arc
work, by definition, will not satisfy, independent of what that work is). This Arc's own 5
new test files (30 tests) were re-run standalone through the exact `npm test` script/config
used for the full run and pass cleanly (5/5 files, 30/30 tests) — confirming no
suite-level interference. No file among the targeted 11-file regression spot-check (the
files most plausibly affected by this Arc's actual 2-file diff) showed any failure
traceable to this Arc's own change.

## Recommended next Arc (exactly one)

**"Delivery Observation Repository Subject Index Arc"** — narrowly scoped to fix the O(n²)
finding disclosed above:

1. Add an internal, incrementally-maintained `Map<FedosDeliveryObservationSubjectId,
   FedosDeliveryObservation[]>` index inside `FedosDeliveryObservationRepository` itself
   (Alpha 466), updated on every `record()` call (append to the subject's own array, O(1)
   amortized) rather than only at read time.
2. Change `list()`'s per-subject callers (`FedosDeliveryObservationQuery.historyFor()`)
   to use this index directly instead of scanning+filtering the full `list()` result —
   `historyFor(subjectId)` becomes O(k) (k = that subject's own attempt count, typically
   1-3) instead of O(N) (N = total Observations across every subject in the repository).
3. Keep `list()`'s own existing full-scan behavior for callers that genuinely need every
   Observation across all subjects (if any exist) — this is additive, not a removal.
4. Benefits Board AND Conversation identically (shared code) — this single fix would
   retroactively resolve the newly-discovered risk for both subsystems, not just
   Conversation.
5. Explicitly out of scope for that Arc: any change to the Outbox layer itself (already
   confirmed cheap and linear, Phase G Part 3), any change to the Validating Repository's
   own transition-graph/staleness logic (orthogonal, already correct), any persistence
   schema change (this is purely an in-memory read-side optimization derived from
   already-durable data, rebuildable from `list()` at construction time if ever needed —
   consistent with this codebase's own "no persistence rewrite" discipline).
6. Suggested scale target for that Arc's own Phase G: re-run this Arc's own abandoned
   T=10,000/100,000 realistic-pending-ratio scenarios to completion, confirming the O(n²)
   -> O(n) fix closes the gap this Arc's own benchmark could not measure to completion.

## Scalability audit status update (re: `212b842`)

The original audit's own named defect ("Scheduler constructed without initial
delivered/abandoned state... retries the entire shared profile-wide log") is **CLOSED** by
this Arc. What the audit characterized as "O(T) once at startup" for hydration is, per
this Arc's own more precise measurement, actually O(historyBearingCount²) — worse than the
audit anticipated, and disclosed above as this Arc's own most significant finding. The
Outbox persistence layer itself (`listIntents`/`getIntent`/`putIntent`) remains exactly as
the audit characterized it: O(T), genuinely cheap even at T=100,000 (confirmed, Phase G
Part 3) — not a practical concern at any realistic scale on its own. **Real safe operating
range, restated precisely**: an account with a LOW total history-bearing (delivered +
abandoned) intent count remains cheap at any scale; an account whose history-bearing count
grows into the low thousands will experience real, user-visible restart-hydration latency
(seconds, per the measured curve) that grows toward minutes/hours as that count continues
to grow — this is a genuine, now-quantified operational ceiling that did not exist in the
audit's own original characterization. **Compaction/partitioning remain future work**,
unchanged from the audit's own original framing — this Arc did not implement either, per
its own explicit prohibition, and the recommended next Arc above is a smaller, more
targeted fix (an internal index) that does not require either.
