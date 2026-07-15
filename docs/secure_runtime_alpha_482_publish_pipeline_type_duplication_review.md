# Secure Runtime Alpha 482 — Publish Pipeline Type Duplication Review

Stage 2 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Observation — TWO unreconciled vocabularies

| | `FedosBoardOutboxObservation` (`src/board/outbox/`, Alpha 475, committed) | `FedosDeliveryObservation` (`src/board/observation/`, Alpha 462, committed) |
|---|---|---|
| subject field | `outboxId: FedosBoardOutboxId` (branded, Outbox-specific) | `subjectId: FedosDeliveryObservationSubjectId` (opaque, protocol-neutral) |
| state field name | `kind` | `state` |
| state values | `attempt-started` / `delivered` / `rejected` / `failed` / `abandoned` | `queued` / `publishing` / `accepted` / `rejected` / `failed` |
| overlap | `rejected`, `failed` share a NAME but not necessarily the SAME meaning (e.g. `abandoned` has no equivalent in the other list at all; `queued`/`publishing`/`accepted`/`attempt-started`/`delivered` do not line up 1:1) | |
| id shape | no separate id field — identified by `(outboxId, kind, observedAt)` tuple only | separate, deterministically derived `id` field |
| persisted? | NOT persisted — Scheduler keeps an in-memory log only | Persisted — has its own Codec + Persistence port + Repository |

No file imports both (confirmed by `test/secure_runtime_alpha_482_...test.ts` §1). No adapter or mapping function between the two exists anywhere in this repository. A caller wanting "the current delivery state of post X" today gets two DIFFERENT, incompatible answers depending on which vocabulary it asks — and, per Alpha 488, no caller currently asks either, since neither is wired to any real Publisher or Host.

## 2. Publisher result — TWO unreconciled return contracts

| | `FedosBoardOutboxPublisher.publish()` (generic, committed, Alpha 471–480) | `FedosNostrBoardPublisher.publishOne()` (Nostr-specific, committed, Alpha 451–460) |
|---|---|---|
| return shape | `Promise<FedosBoardOutboxPublishResult>` — `{ outcome: "delivered"\|"rejected"\|"failed", retryPolicy: "immediate"\|"later"\|"never", reason?: string }` | `Promise<boolean>` |
| rationale (own doc) | rich enough for the Scheduler to drive retry | `docs/secure_runtime_alpha_452_...md` EXPLICITLY rejects a result object as "Observation vocabulary... explicitly prohibited" under its own scope |

These are not merely different types — they are different ANSWERS to
the same design question ("how does a Publisher report its own
result"), each internally consistent, never reconciled. Only the
generic contract is currently load-bearing (the Scheduler depends on
it); the boolean contract has zero caller anywhere in the repository
(Alpha 488).

## 3. Publisher call shape — TWO unreconciled argument shapes

Generic: `publish(record: FedosPersistedBoardOutboxRecordV1)` — the
Outbox's own persisted wire record, protocol carried as data
(`record.target.protocol`). Nostr-specific:
`publishOne(entry: FedosNostrBoardPublishEntry)` where `entry = { intent:
FedosBoardOutboxIntent, event: FedosNostrWireEvent }` — an ALREADY-SIGNED
protocol-native event paired alongside the intent, supplied by a caller
this Arc's own doc (Alpha 451 §2) explicitly does not name. The generic
shape can be satisfied without ever touching signing; the Nostr-specific
shape cannot be constructed without an upstream signing step having
already happened. Directly relevant to Alpha 487 (protocol
extensibility).

## 4. Scheduler Retry — genuinely NOT duplicated

`FedosBoardOutboxRetryPolicy = "immediate" | "later" | "never"` is
defined exactly once, in `fedos_board_outbox_publisher.ts`
(`test/secure_runtime_alpha_482_...test.ts` §4 confirms — a repo-wide
grep for the three-value literal union finds this one file only). The
Nostr-specific Publisher thread deliberately names no retry vocabulary
of its own (Alpha 452 §4's own absolute prohibition). **This is the one
area of the four reviewed where no duplication exists.**

## 5. See also

- `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
- `docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`
- `docs/secure_runtime_alpha_474_retry_policy_model.md`
