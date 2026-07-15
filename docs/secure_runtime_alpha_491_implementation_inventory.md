# Secure Runtime Alpha 491 — Implementation Inventory

Stage 1 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc. Review only. Re-verifies, by direct source
inspection against the CURRENT worktree (branched from
`master`'s real HEAD, which now includes Alpha 451–460, 461–470,
471–480, and 481–490 all committed), every finding Alpha 481–490
already made — nothing here is asserted from memory of that Arc alone.

## 1. Publisher interfaces (two, coexisting)

| | `FedosBoardOutboxPublisher` | `FedosNostrBoardPublisher` |
|---|---|---|
| file | `src/board/outbox/fedos_board_outbox_publisher.ts` (Alpha 473) | `src/board/publish/nostr/fedos_nostr_board_publisher.ts` (Alpha 455) |
| method | `publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult>` | `publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean>` / `publishBatch(entries): Promise<readonly boolean[]>` |
| input | the Outbox's own persisted wire record — protocol carried as data | `{ intent: FedosBoardOutboxIntent, event: FedosNostrWireEvent }` — an ALREADY-SIGNED event, supplied by an unnamed caller |
| result | object: `{ outcome: "delivered"\|"rejected"\|"failed", retryPolicy: "immediate"\|"later"\|"never", reason?: string }` | bare `boolean` |
| production caller | `FedosPublishScheduler` (Alpha 476) — real dependency | none anywhere in the repository |
| concrete implementation(s) | `MockFedosBoardOutboxPublisher` (test-only) | `FedosRelayNostrBoardPublisher` (real, wraps a `FedosRelay`) |
| tests/docs | `test/secure_runtime_alpha_473_*`, `docs/secure_runtime_alpha_473_*` | `test/secure_runtime_alpha_455-457_*`, `docs/secure_runtime_alpha_455-457_*` |

**Semantically different, not the same type twice.** `FedosBoardOutboxPublisher` answers "given an unsigned intent record, do everything and report a rich result." `FedosNostrBoardPublisher` answers "given an ALREADY-SIGNED event, transport it and report success/failure only." No adapter between them exists (Alpha 482 §2–3, re-confirmed here by grep: zero references to `FedosNostrBoardPublisher`/`FedosRelayNostrBoardPublisher` anywhere under `src/board/outbox/`, and zero references to `FedosBoardOutboxPublisher` anywhere under `src/board/publish/`).

## 2. Scheduler publisher port

`FedosPublishSchedulerDependencies.publisher: FedosBoardOutboxPublisher` (`fedos_publish_scheduler.ts`, Alpha 476) — the Scheduler depends on the GENERIC contract only, injected, never constructed inline. No protocol-specific import exists anywhere in this file (re-confirmed: `grep -i "nostr\|relay" src/board/outbox/fedos_publish_scheduler.ts` finds nothing outside this doc-comment prose describing the absence).

## 3. Observation types (two, coexisting)

| | `FedosBoardOutboxObservation` | `FedosDeliveryObservation` |
|---|---|---|
| file | `src/board/outbox/fedos_board_outbox_observation.ts` (Alpha 475) | `src/board/observation/fedos_delivery_observation.ts` (Alpha 462) |
| subject field | `outboxId: FedosBoardOutboxId` (branded, Outbox-specific) | `subjectId: FedosDeliveryObservationSubjectId` (opaque, protocol-neutral) |
| state field | `kind` | `state` |
| state values | `attempt-started` \| `delivered` \| `rejected` \| `failed` \| `abandoned` | `queued` \| `publishing` \| `accepted` \| `rejected` \| `failed` |
| id | none — identified by `(outboxId, kind, observedAt)` tuple | deterministic `id`, derived `subjectId + state + observedAt` |
| durable? | NO — `FedosPublishScheduler` keeps a private in-memory `#observationLog` array only | YES — `FedosDeliveryObservationPersistence` + `FedosDeliveryObservationRepository` (`record`/`get`/`list`) + `FedosDeliveryObservationQuery` (`historyFor`/`currentStateFor`/`listByState`) |
| production writer | `FedosPublishScheduler#observe()` (Alpha 476) — real, exercised on every `tick()` | none anywhere in the repository |
| transition enforcement | NONE — Alpha 483 confirms neither constructor nor Repository write path checks prior state | NONE — same finding, same Stage |

**`FedosDeliveryObservation`'s own five states are already byte-identical to this Arc's own required canonical vocabulary** (`queued`/`publishing`/`accepted`/`rejected`/`failed`) — see Alpha 493.

## 4. Retry directive — one definition, not duplicated

`FedosBoardOutboxRetryPolicy = "immediate" | "later" | "never"`, defined exactly once in `fedos_board_outbox_publisher.ts` (Alpha 474; re-confirmed by repo-wide grep for the three-value literal union — one file only). `FedosNostrBoardPublisher` names no retry vocabulary of its own (Alpha 452 §4's own absolute prohibition, still honored, unchanged).

## 5. State-name census (exact literal strings, across the whole pipeline)

- Outbox Observation kinds: `attempt-started`, `delivered`, `rejected`, `failed`, `abandoned`
- Delivery Observation states: `queued`, `publishing`, `accepted`, `rejected`, `failed`
- Publisher outcomes (generic): `delivered`, `rejected`, `failed`
- Publisher result (Nostr): `true`/`false` only, no named states
- Retry directive: `immediate`, `later`, `never`

`rejected` and `failed` are the only two literal strings shared verbatim across BOTH Observation vocabularies AND the generic Publisher outcome — everywhere else, the same real-world event is named differently by different files.

## 6. Production callers (re-confirmed, Alpha 488's own finding)

`grep -rl "new FedosPublishScheduler\|new FedosRelayNostrBoardPublisher" src/` (excluding `test/`) → **zero matches**. Neither Scheduler nor either concrete Publisher is constructed anywhere outside a test file. `FedosDesktopHost` (`src/desktop/host/`) owns Outbox WRITE (`submitPostWithOutbox`) only — no Publisher/Scheduler/Observation field of any kind. This Arc does not change that (`Host所有...は実装しない`, this Arc's own instruction).

## 7. What this Arc will and will not do, given the above

Reconcile (492–497): Publisher result, Observation vocabulary, transition
enforcement, one real Adapter, Scheduler wiring to the canonical shapes
— entirely additive, zero edits to any file named in §1–4 above (their
own existing interfaces/classes/tests remain byte-for-byte unchanged;
see each Stage's own doc for the specific "no existing file touched"
confirmation).

Will NOT do: give the Scheduler/Publisher a Host owner, start any
Scheduler automatically, wire durable Observation storage into the
Scheduler's own write path (that remains a `FedosDeliveryObservation`
VALUE-producing bridge only — persisting it is Alpha 500's own named
"Next Arc"), add a Relay Pool, add a new retry algorithm, or build an
ActivityPub/AT Protocol/Session Publisher.

## 8. See also

- `docs/secure_runtime_alpha_482_publish_pipeline_type_duplication_review.md`
- `docs/secure_runtime_alpha_483_delivery_state_transition_closure_review.md`
- `docs/secure_runtime_alpha_488_desktop_host_ownership_review.md`
- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
