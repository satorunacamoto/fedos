# Secure Runtime Alpha 7561-7640 — Reconciliation Report

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc — Phase A

Status: investigation only. No source files were changed to produce this report.
Worktree: `C:\wt\conversation-outbox-restart-hydration`
Branch: `arc/conversation-outbox-restart-hydration-scalability`
Base commit: `4c6fa3b3` (Secure Runtime Alpha 7401-7480, FedOS Direct Conversation Route
Binding and NIP-17 Inbound Isolation Arc)

## 0. Alpha range verification

Per the coordination instructions, before any production edit:

- `master` and this branch's own history both sit strictly behind `4c6fa3b3`; no branch in
  the repository (124+ local branches enumerated) is a descendant of `4c6fa3b3` as of the
  start of this Arc — confirmed via `git merge-base --is-ancestor 4c6fa3b3 <branch>` over
  every local branch, zero matches with nonzero commits ahead.
- The sibling parallel Arc, **A — FedOS Archive Envelope Retention Parity and Metadata
  Deletion Semantics**, owns `C:\wt\archive-envelope-retention-parity` on branch
  `arc/archive-envelope-retention-parity-metadata-semantics`, based on the same `4c6fa3b3`
  tip, not yet diverged at the time this report was written. Its expected range,
  **7481-7560**, is genuinely free (no commit anywhere claims it).
- This Arc's own expected range, **7561-7640**, is genuinely free (no commit anywhere
  claims it, no branch references "7561" or "7481" in any commit message).
- **Historical 5401-5480 collision, recorded per instruction**: two independent Arc
  lineages both originally claimed Alpha 5401-5480 — a Direct-Ratchet-State line and the
  Local Deletion Capability and Deletion-State Foundation Arc (`b3b3a6d`). Per prior
  session memory, these were reconciled before Alpha 6681-6760 (two internal reconciliation
  merges are already baked into the 5401-7320 chain, alongside the 6521-6600/6601-6680
  Desktop-Config-vs-Secure-Memory-Store split). This precedent is why explicit, verified
  range reservation (this section) is mandatory before any production edit in this Arc,
  rather than assuming a range is free from a stale memory of prior state.
- **Assigned range for this Arc: Alpha 7561-7640.** Reserved by this report; the primary
  implementation commit's title will use this exact range.

## 1. The complete audit (commit `212b842`)

`212b842` ("Add read-only scalability audit of the durable Conversation Outbox and
Scheduler") is **not an ancestor of this branch's HEAD** (`git merge-base --is-ancestor
212b842 HEAD` fails) — it sits on a separate review branch
(`review/conversation-outbox-scheduler-scalability-audit`), authored in a prior session.
Its single file, `docs/secure_runtime_conversation_outbox_scheduler_scalability_audit.md`,
was read via `git show 212b842:<path>` and every structural claim in it was independently
re-verified against this exact worktree's real source (not merely trusted). All claims
checked out. Summary of its findings, re-confirmed:

- `listIntents()`/`getIntent()`/`putIntent()` are all O(T) (T = total-ever-appended
  records in the shared, whole-profile log) — no cache or index exists at any layer.
  Measured (real benchmark, Node v24.15.0): ~1.45 microseconds/record, linear, consistent
  across all three operations, at T=1,000/10,000/100,000.
- `FedosConversationTransportScheduler#tick()` is O(T) (one full `listIntents()` replay)
  plus O(P x L) sequential attempt processing, where P = genuinely-pending count and L =
  per-attempt latency.
- Root cause: the Scheduler's constructor already declares `initialDelivered`/
  `initialAbandoned` dependency fields, but its one production construction site
  (`FedosPrivateTransport`) never populates them — so every restart starts both Sets empty,
  and every historical intent is treated as pending on the first tick after restart.
- Illustrative (not measured) restart-cost projection: ~83 minutes of unnecessary
  re-publish traffic at 1,000 conversations / 100,000 total intents, assuming 50ms/round
  trip.
- Recommended next Arc (ranked highest-precedent of four options considered): port Board's
  Alpha 585/586 hydration pattern into `FedosPrivateTransport`'s Scheduler construction,
  deriving `initialDelivered`/`initialAbandoned` from the already-durable Delivery
  Observation history. This is the mission this Arc (7561-7640) implements.

## 2. Conversation Outbox persistence format

- Port: `FedosConversationTransportOutboxPersistence`
  (`src/conversation/transport/fedos_conversation_transport_outbox_persistence.ts:31-35`)
  — `putIntent`, `getIntent`, `listIntents`. `WriteResult` =
  `"inserted"|"already-present"|"conflict"|"failed"`.
- Backend: `AppendOnlyFedosConversationTransportOutboxPersistence`
  (`.../append_only_fedos_conversation_transport_outbox_persistence.ts:78-105`) — plain
  `node:fs` JSON-Lines append-only file. Own header states explicitly: "NO in-memory
  cache/index of any kind is held between calls," "NO automatic repair of any kind, ever,"
  "NO default file path."
- Record: `FedosConversationTransportOutboxIntent`
  (`fedos_conversation_transport_outbox_types.ts:48-53`) = `{ id, envelopeId,
  conversationId, createdAt }`. **No status/state field exists on the record itself** — by
  design ("delivery intent only, never a Relay queue, never a retry/scheduling field").
  Persisted wire shape is a closed `V1 | V2` union
  (`fedos_conversation_transport_outbox_codec.ts:37-60`); V2 additionally carries `route`,
  `recipientPublicKeyHex`, and an embedded signed `nativeEvent`. Neither version carries
  delivered/abandoned state.
- One record per `envelopeId` (deterministic id), unlike Board's per-`(post, target)`-pair
  fan-out model — multi-relay fan-out is entirely the Publisher's concern in Conversation,
  never multiple Outbox rows.

## 3. listIntents/getIntent/putIntent

All three replay the entire on-disk log from scratch on every call, confirmed by direct
read of `append_only_fedos_conversation_transport_outbox_persistence.ts:58-104`:
`listIntents()` -> `replayLog()` (split, parse, dedup-by-id into a fresh `Map`, spread to
array) every call; `getIntent()` -> `listIntents().find(...)`, strictly more expensive;
`putIntent()` -> `getIntent()` first (a full replay), then an O(1) append. No caching or
indexing exists at any layer.

## 4. Scheduler construction

`FedosConversationTransportScheduler`
(`src/conversation/transport/fedos_conversation_transport_scheduler.ts`).
`FedosConversationTransportSchedulerDependencies` (lines 57-77) **already declares**
`initialDelivered?: ReadonlySet<string>` (75) and `initialAbandoned?: ReadonlySet<string>`
(76) — the exact same shape as Board's equivalent seam. Constructor (107-121): `this.#delivered
= new Set(dependencies.initialDelivered ?? [])`, same for abandoned — **when omitted, both
default to empty**, so every intent is pending on the very first tick after any
construction. **This confirms the hydration seam already exists on the Scheduler itself;
this Arc's job is populating it at the one call site that constructs it, not adding a new
constructor field for these two.**

## 5. Production construction sites

Exactly one: `src/conversation/transport/fedos_private_transport.ts:196-203`, inside
`FedosPrivateTransport`'s constructor — confirmed by repo-wide grep, no
`initialDelivered`/`initialAbandoned` passed. One level up, `FedosPrivateTransport` itself
has exactly one production construction site,
`src/desktop/runtime/fedos_desktop_runtime.ts:1372` (inside `if
(config.privateTransportEnabled)`), independently enforced by an existing structural guard
test (`test/secure_runtime_alpha_1471_1540_structural_guards.test.ts:36-39`, asserting
exactly one match via regex over the raw source). No second construction site of either
class exists anywhere in `src/`.

## 6. Delivered/abandoned transitions

`#attemptIntent()` (`fedos_conversation_transport_scheduler.ts:166-184`) mutates two
purely in-memory `Set`s on outcome — never written to disk, lost on every restart. **But**
the underlying per-attempt facts each classification derives from ARE already durable
today: `#attemptOnce()` (187-213) calls `observationRepository.record(...)` with state
`"accepted"`/`"rejected"`/`"failed"`, backed in production by
`AppendOnlyFedosDeliveryObservationPersistence(config.conversationTransportObservationLogPath!)`
— a required (non-optional) durable log whenever `privateTransportEnabled` is true
(`fedos_desktop_runtime.ts:1307-1309`). **This means the hydration source data already
exists and is already durable** — this Arc's job is reading it at startup and deriving the
rollup, exactly as Board's own hydration does over the identical, protocol-agnostic
Delivery Observation vocabulary.

## 7. Retry/backoff state

Reactive per-attempt, not scheduled backoff (`retryPolicy`: `"immediate"|"later"|"never"`,
returned by the Publisher). `FedosDeliveryRetryRegistry`
(`src/board/observation/fedos_delivery_retry_registry.ts`) is purely in-memory by its own
explicit doc comment ("No persistence, no durability of any kind"). It has an
additive-only `hydrateAttemptCount()` seam, but the only caller anywhere is Board's own
`createFedosDeliveryScheduler()` — never wired for Conversation. **Decision needed for this
Arc** (recorded in Section 12): attempt-number reset on restart is characterized by the
prior audit as "cosmetic" (does not affect correctness — a subject's own attempt count
resets to 1, which only affects any attempt-count-based backoff/abandonment policy, and
Conversation's Scheduler has no `abandonmentPolicy` concept at all today, unlike Board's).
This Arc treats it as explicitly out of scope, named here rather than silently dropped.

## 8. Relay ACK semantics

Confirmed real at the code level, not merely UI text: `"accepted"` in the Delivery
Observation vocabulary literally means "a relay OK'd it"
(`FedosMultiRelayOkCorrelatedConversationTransportPublisher`, any-relay-accept-wins), and
this class never reads or references any recipient-side data structure. Matches the
Safety Center warning `"relay-ack-is-not-recipient-delivery"` verbatim.

## 9. Recipient-import semantics

A distinct, real, durable signal exists (`FedosNip17InboundImportCoordinator.receiveRumor()`
-> `FedosPrivateNostrImportRecord{importResult:"imported"|"duplicate"}` via
`AppendOnlyFedosPrivateNostrImportRecordPersistence`), but it lives entirely on the
**recipient's own device** and structurally never reaches the sender's Outbox/Scheduler —
no read-receipt/ack-back protocol exists anywhere in the transport layer. **This confirms
the hydration this Arc builds must and can only ever seed delivered/abandoned from
relay-ack history (Section 6/8), never recipient-import — exactly matching how Board's own
hydration already works**, and this Arc must not introduce or imply a conflation between
the two.

## 10. Board Outbox Alpha 585/586 hydration — the precedent to port

`src/desktop/host/fedos_delivery_recovery_hydration.ts` is the single most load-bearing
reference file for this Arc.

`hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery)` (lines 95-128): for
every intent in `outboxPersistence.listIntents()`, derives a subject id, reads attempt
history via `historyForSafe()` (a try/catch wrapper that returns `[]` on any throw — never
propagates a read failure into a false classification). If the latest attempt's state is
`"accepted"` -> delivered; else if the latest attempt `isFinal` -> abandoned; else records a
`completedAttempts` count. Returns `{ delivered, abandoned, completedAttempts,
nextAttemptCountBySubject }`.

**Fail-closed discipline, stated explicitly in the file's own header** (quoted): "a
delivery-history read failure for one intent NEVER marks that intent delivered or
abandoned — it is left exactly as if no history existed... Marking an unread intent
'delivered' or 'abandoned' would be the UNSAFE direction... leaving it pending costs, at
most, one redundant-but-safe extra attempt." Also: "one intent's own unreadable history
never voids recovery for any other intent." **This exact discipline is the normative
model this Arc's own hydration function must follow** (Phase C).

Wiring: `createFedosDeliveryScheduler()` (147-166) calls the hydration function, seeds
`retryRegistry.hydrateAttemptCount()` for each subject, then constructs a fresh
`FedosPublishScheduler` with the hydrated Sets. **One call site**:
`FedosDesktopHost.startDelivery()` (`fedos_desktop_host.ts:583-611`), called "on EVERY
`startDelivery()` call, same-process cycle or genuine process restart alike, since the
Scheduler itself is always freshly constructed here."

The classes this hydration builds on (`FedosDeliveryObservationRepository`,
`FedosDeliveryRetryQuery`, `FedosDeliveryRetryRegistry`, `FedosDeliveryObservationState`)
are already generic/protocol-agnostic (each carries an explicit "No Board, Outbox,
Publisher, Nostr..." guardrail in its own header), and Conversation Transport already
writes into this exact same vocabulary (Section 6). **This is why the read-side machinery
needs no new abstraction — only new call-site wiring, mirroring Board's exact shape.**

## 11. Board vs. Conversation record shape comparison

Deliberately similar by design (Conversation's own type-file header states it "mirrors
`FedosBoardOutboxIntent` field-for-field in SHAPE and semantics"), with these concrete
differences:

| | Board | Conversation |
|---|---|---|
| id derivation | Deterministic hash of `postId::protocol::destination` | The `envelopeId` itself |
| Fan-out model | One row per `(postId, target)` pair | One row per `envelopeId` only |
| Schema versions | Single schema | Closed `V1 \| V2` union |
| Scheduler `initialCompletedAttempts` seam | **Present** (`FedosPublishSchedulerDependencies`) | **Absent** |
| Scheduler `abandonmentPolicy` concept | Present | Absent — writes canonical Observation facts directly, "one fewer bridging layer" per its own header |

**The one gap that blocks a literal 1:1 port and requires an explicit decision**:
`hydrateFedosDeliveryRecoveryState()`'s return shape has three fields
(`delivered`, `abandoned`, `completedAttempts`), but
`FedosConversationTransportSchedulerDependencies` only has seams for two of them
(`initialDelivered`, `initialAbandoned`). **Decision for this Arc**: consume only
`delivered`/`abandoned` from the shared hydration function's output for the Scheduler seed;
do not add a new `initialCompletedAttempts` constructor field to
`FedosConversationTransportScheduler` in this Arc, since it has no `abandonmentPolicy`
consumer for that value at all today (unlike Board) and adding an unconsumed field would be
scope creep beyond "port the proven pattern; preserve durability and delivery semantics."
This is recorded here as a named, deliberate scope boundary, not a silent drop. Attempt-count
hydration into `FedosDeliveryRetryRegistry` (Section 7) is likewise out of scope for the
same reason (cosmetic, cross-cutting to Board too, no correctness impact).

## 12. Restart tests and their scale

`test/secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts` — real
relay, real encryption, real file-backed persistence, ~240 messages total, 2 full restarts
through the real production `fedos_desktop_runtime.ts` construction path.
`test/secure_runtime_alpha_7241_7320_failure_matrix.test.ts` — smaller message counts, up
to 3 consecutive restarts. **These prove correctness (no loss, no duplication) at small
scale via Nostr's content-addressed event id plus receiver-side dedup — never efficiency.**
None approaches the 1,000/10,000/100,000-intent scale where O(T) replay-on-every-tick cost
becomes measurable. This Arc's own Phase G/I work must add tests at that scale
specifically, since the existing suite structurally cannot detect the defect being fixed
here (that's precisely why the audit's own findings survived undetected through Alpha
7241-7320's and 7401-7480's own extensive verification).

## 13. Corruption handling

`replayLog()` (`append_only_fedos_conversation_transport_outbox_persistence.ts:58-76`):
missing file is treated as empty (not corruption); a line that fails `JSON.parse` **throws,
uncaught**; two records sharing an id with differing content also throw. No skip-and-
continue, no partial recovery — a single corrupted byte anywhere makes the entire shared
log unreadable/unwritable until manual repair. **This means the persistence layer already
fails closed** in exactly the direction Phase B/C requires ("corrupt records do not
silently become pending") — a corrupt log throws loudly rather than silently resolving to
an empty/all-pending hydration result. Board's own `hydrateFedosDeliveryRecoveryState()`
does not additionally guard against this (it only wraps the *retry-history* read, not the
initial `listIntents()` call) — this is a pre-existing characteristic of the pattern being
ported, not a new gap this Arc introduces. **Decision for this Arc**: the hydration
function must not add a try/catch around `listIntents()` itself that would convert a
corrupt-log throw into a silent empty/all-pending result — that would be the unsafe
direction relative to what the persistence layer already guarantees. It is preserved as-is,
consistent with the "no persistence rewrite" prohibition.

## 14. Shared-log ownership

Confirmed genuinely shared/whole-profile: `FedosDesktopRuntimeConfig.
conversationTransportOutboxLogPath?: string`
(`src/desktop/runtime/fedos_desktop_runtime_config.ts:238`) is a single, singular field,
read once, backing exactly one `AppendOnlyFedosConversationTransportOutboxPersistence`
instance injected into the single `FedosPrivateTransport`. Each record carries a
`conversationId` field, but purely as routing metadata, never a partition/sharding key —
all conversations' intents interleave in the one file. This is why T is whole-account
(unbounded with account lifetime), not per-conversation, and why P (genuinely pending) is
the metric this Arc must make tick cost track instead.

## Decisions this report makes, carried into Phases B onward

1. **Assigned Alpha range: 7561-7640** (Section 0).
2. **Hydration function will be new, generic-shaped, and will live alongside (not replace)
   `fedos_delivery_recovery_hydration.ts`'s pattern** — reusing the same
   `FedosDeliveryObservationRepository`/`FedosDeliveryRetryQuery` abstractions Board already
   built (Section 10), since those are already protocol-agnostic and Conversation already
   writes into them (Section 6).
3. **Only `delivered`/`abandoned` are seeded into `FedosConversationTransportScheduler`**;
   `completedAttempts`/attempt-count hydration into `FedosDeliveryRetryRegistry` is
   explicitly out of scope for this Arc (Section 7, Section 11) — named, not silently
   dropped.
4. **No change to corruption handling** — the existing fail-closed persistence-layer
   behavior already satisfies this Arc's requirement; the hydration function must not soften
   it (Section 13).
5. **Exactly one production wiring change**: `FedosPrivateTransport`'s constructor
   (Section 5), calling the new hydration function and passing its result into the existing
   `initialDelivered`/`initialAbandoned` seam on `FedosConversationTransportScheduler`
   (Section 4) — no new Scheduler, no new timer, no second construction path.
