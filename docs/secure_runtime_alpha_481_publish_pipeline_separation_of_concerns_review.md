# Secure Runtime Alpha 481 — Publish Pipeline Separation of Concerns Review

Stage 1 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only — **no production code is modified anywhere in this Arc**;
every claim below is verified directly against the CURRENT, unmodified
source. Note: the Alpha 451–460 Nostr Publisher thread was still
uncommitted when this Arc's own review began and was committed
(`cd03154`) partway through this Arc's own work, by a process outside
this Arc's control — this Arc reviews its final, now-committed content,
re-confirmed unchanged from what was read while still uncommitted, but
does not touch or adopt it.

## 1. Scope reviewed

- **Outbox** — `src/board/outbox/fedos_board_outbox_{types,codec,persistence,in_memory_persistence,append_only_persistence}.ts` (committed, Alpha 411–420).
- **Publisher** — TWO coexisting implementations (see Alpha 482 for why this is itself a finding):
  - `FedosBoardOutboxPublisher` (generic port + `MockFedosBoardOutboxPublisher`), `src/board/outbox/fedos_board_outbox_publisher.ts` (committed, Alpha 471–480).
  - `FedosNostrBoardPublisher`/`FedosRelayNostrBoardPublisher`, `src/board/publish/nostr/*` (committed, Alpha 451–460).
- **Delivery Observation** — TWO coexisting vocabularies:
  - `FedosBoardOutboxObservation`, `src/board/outbox/fedos_board_outbox_observation.ts` (committed, Alpha 471–480).
  - `FedosDeliveryObservation`, `src/board/observation/*` (committed, Alpha 461–470).
- **Scheduler** — `FedosPublishScheduler`, `src/board/outbox/fedos_publish_scheduler.ts` (committed, Alpha 471–480).

## 2. Publisher — responsibility is clean

`FedosBoardOutboxPublisher.publish()` does exactly one thing: accept a
persisted Outbox record, return a `FedosBoardOutboxPublishResult`. It
imports nothing from `fedos_board_outbox_observation.ts` — it never
constructs an Observation itself
(`test/secure_runtime_alpha_481_...test.ts` §1 confirms this
mechanically). `FedosNostrBoardPublisher`/`FedosRelayNostrBoardPublisher`
are equally narrow: transport only, no Observation construction, no
retry loop, no persistence call (Alpha 484 confirms the Outbox-mutation
half of this separately).

**One real coupling, not a violation but worth naming**: the generic
Publisher's own return contract includes `retryPolicy`
(`"immediate" | "later" | "never"`) — a SCHEDULING-adjacent decision
embedded in the Publisher's own output. The Publisher decides
RETRYABILITY (a domain judgment — e.g. "this error is transient"); the
Scheduler decides EXECUTION (when/how many times to actually retry
within one `tick()`). This is a defensible split (mirrors how an HTTP
client library returns a status code and the retry LOOP lives one layer
up), but it does mean "Publisher" is not a pure transport component —
it also renders a retry-worthiness verdict. `FedosNostrBoardPublisher`
avoids this entirely by returning a bare `boolean` and naming no retry
vocabulary at all (its own Alpha 452 decision doc), which is a cleaner
separation at the cost of the Scheduler being unable to distinguish
"retry-worthy failure" from "permanent failure" if it were ever wired to
that Publisher instead.

## 3. Observation — responsibility is clean

Neither `FedosBoardOutboxObservation` nor `FedosDeliveryObservation`
imports anything Publisher-shaped (Alpha 485 confirms this
mechanically). Both are pure, immutable historical-fact records with a
single fail-closed constructor and zero mutation methods.

## 4. Scheduler — two responsibilities live in one class, one of them arguably not "Scheduler"

`FedosPublishScheduler` owns:

1. **Cadence and orchestration** (`start`/`stop`/`tick`, retry-directive
   application, the same-tick immediate-retry-then-downgrade guardrail)
   — squarely Scheduler responsibility, matches its own design doc
   (`docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`).
2. **Observation authorship AND storage** — `#observe()` constructs
   every `FedosBoardOutboxObservation` directly inline, and the
   Scheduler holds its OWN private `#observationLog` array, exposed via
   `observationLog()`. Authoring an Observation at the moment of a
   state change is a natural Scheduler role (it is the thing that
   witnesses the attempt). Owning the LOG's storage/retrieval, however,
   is exactly the responsibility `FedosDeliveryObservationRepository`/
   `FedosDeliveryObservationQuery` (Alpha 466/467) already exist to
   provide — the Scheduler currently reimplements a narrow, in-memory,
   non-durable version of that same responsibility itself rather than
   depending on any Observation-storage abstraction. This is the same
   finding as Alpha 475's own header ("Deliberately NOT persisted this
   Arc... `FedosPublishScheduler` keeps its own in-memory observation
   log"), now re-confirmed against the actually-committed code and
   named explicitly as a responsibility overlap rather than a deferred
   footnote.

## 5. See also

- `docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`
- `docs/secure_runtime_alpha_475_outbox_observation_realization.md`
- `docs/secure_runtime_alpha_461_existing_observation_vocabulary_inventory.md`
