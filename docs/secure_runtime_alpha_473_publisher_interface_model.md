# Secure Runtime Alpha 473 — Publisher Interface Model

Stage 3 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Candidates compared

- **Option A — a Nostr-only Publisher shape (e.g. requiring a signed
  `FedosNostrWireEvent` alongside the intent).** REJECTED: this Arc's
  own instruction forbids any Nostr reference; a Nostr-only shape would
  also make the Scheduler unusable once ActivityPub/AT Protocol/Session
  gain a Publisher, and duplicates the concern the separate, uncommitted
  `FedosNostrBoardPublisher` (Alpha 471 §4–5) already exists to own.
- **Option B — reuse `RelayPublisher` (`src/nostr/publish.ts`, Alpha
  216) directly as the Scheduler's dependency.** REJECTED:
  `RelayPublisher.publish(event)` takes an already-built
  `FedosNostrWireEvent`, not a `FedosPersistedBoardOutboxRecordV1`; it
  is transport-only and Nostr-specific (confirmed by direct re-read of
  `src/nostr/publish.ts`), and importing it would violate this Arc's own
  `Nostr変更禁止` scope boundary even as a read-only import.
- **Option C — a new, generic `FedosBoardOutboxPublisher` port, typed
  exactly to `FedosPersistedBoardOutboxRecordV1` (the same record
  `FedosBoardOutboxPersistence.listIntents()` already returns), returning
  a structured `{ outcome, retryPolicy, reason? }` result.** ADOPTED.

## 2. Why a structured result, not a bare boolean

The separate, uncommitted Alpha 452 decision (Alpha 471 §4) adopted a
bare `boolean` for `FedosNostrBoardPublisher` specifically BECAUSE its
own scope excludes retry policy entirely. This Arc's own scope is the
opposite: this Arc's entire purpose is to apply a three-value Retry
Policy (Alpha 474) that has to come from somewhere. A bare boolean
cannot distinguish "permanently rejected, never retry" from "transient
failure, worth retrying" — collapsing that distinction back onto the
Scheduler would force it to invent delivery-outcome semantics for every
possible Publisher, the opposite of "the Publisher decides, the
Scheduler applies." `outcome` (`"delivered" | "rejected" | "failed"`)
and `retryPolicy` (`"immediate" | "later" | "never"`, Alpha 474) are
therefore both part of `FedosBoardOutboxPublisher.publish()`'s own
return type, not two separate calls.

## 3. Why no default/concrete implementation ships this Arc

Per this Arc's own `Publisher内部変更禁止`, no real, protocol-wired
`FedosBoardOutboxPublisher` implementation (Nostr, ActivityPub, AT
Protocol, or Session) is created here. `MockFedosBoardOutboxPublisher`
(`src/board/outbox/fedos_board_outbox_publisher.ts`) exists ONLY for
this Arc's own tests, mirroring `MockRelayPublisher`'s identical
"in-memory, tests only" role for a different interface
(`src/nostr/publish.ts`, Alpha 216) — never wired to a real Relay,
signing authority, or network of any kind.

## 4. Fail-closed posture toward the injected Publisher

A `FedosBoardOutboxPublisher` is an INJECTED boundary — this Arc treats
its return value with the same "verify, don't trust" posture this
repository already applies to every other injected/external boundary
(e.g. `deserializeFedosBoardOutboxIntent`, Alpha 416).
`isValidFedosBoardOutboxPublishResult()` structurally validates every
`publish()` return value; `FedosPublishScheduler` treats a malformed
result, a rejected Promise, or a thrown synchronous error identically —
as `{ outcome: "failed", retryPolicy: "later" }` — never propagating the
throw, never trusting an unchecked shape.

## 5. See also

- `docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`
- `docs/secure_runtime_alpha_474_retry_policy_model.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
