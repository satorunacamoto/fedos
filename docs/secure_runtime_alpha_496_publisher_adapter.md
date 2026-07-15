# Secure Runtime Alpha 496 — Publisher Adapter

Stage 6 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. What was built

`FedosNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher`
(`src/board/publish/nostr/fedos_nostr_board_publisher_adapter.ts`) —
the Alpha 487 §4 / Alpha 490 §4 gap this Arc closes: the ALREADY-BUILT
`FedosRelayNostrBoardPublisher` (Alpha 456/457, UNCHANGED) can now serve
`FedosPublishScheduler` (Alpha 476, UNCHANGED) without either side being
rewritten.

```ts
export type FedosNostrBoardPublisherAdapterEventSource = (
  record: FedosPersistedBoardOutboxRecordV1,
) => Promise<FedosNostrWireEvent | null>;

export class FedosNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher {
  constructor(
    publisher: FedosNostrBoardPublisher,
    eventSource: FedosNostrBoardPublisherAdapterEventSource,
  ) { /* ... */ }

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> { /* ... */ }
}
```

## 2. Solving the unavoidable event-sourcing gap, without signing

`FedosBoardOutboxPublisher.publish()`'s own input, `record`, carries NO
signed event body (Alpha 451 §2 — the Outbox never has one to give).
`FedosNostrBoardPublisher.publishOne()`'s own input REQUIRES one. This
Arc does not implement signing (out of scope — see this Arc's own
"重要" instruction: integration only, no new capability) — so the
adapter takes a SECOND injected dependency, `eventSource`, a plain
function from `record` to an already-signed `FedosNostrWireEvent` (or
`null` if none is available yet). This mirrors this repository's own
"inject the transport/dependency, never construct it inline" discipline
applied to signing exactly as it already applies to sockets
(`FedosRelaySocketFactory`, Alpha 214) and Publishers themselves — the
adapter never signs, never touches `FedosNostrSigningAuthority`, and
imports neither.

## 3. Result conversion (three layers, each pure)

1. `record` → `FedosBoardOutboxIntent`, via `deserializeFedosBoardOutboxIntent`
   (Alpha 416, UNCHANGED). A malformed record, or `intent.target.protocol
   !== "nostr"`, is `{ outcome: "failed", retryPolicy: "never" }` —
   fails closed, this Publisher is definitionally never going to handle
   a non-Nostr target.
2. No available signed event (`eventSource` returns `null`) is
   `{ outcome: "failed", retryPolicy: "later" }` — a TRANSIENT
   condition (signing may complete before the next `tick()`), not
   `"never"`.
3. `publisher.publishOne({ intent, event })`'s own `boolean` →
   `FedosOutboundPublishResult` (Alpha 492) via
   `nostrPublishOneResultToOutboundPublishResult` — `true` → `{
   outcome: "accepted", externalReference: event.id }` (Alpha 492 §5's
   own named limitation: evidence is the LOCAL event id, never a
   relay-issued token); `false` → `{ outcome: "failed",
   externalReference: null }` — NEVER `"rejected"` (Alpha 492 §5, no
   negative-signal channel exists).
4. `FedosOutboundPublishResult` → `FedosBoardOutboxPublishResult`, via
   the fixed, protocol-neutral retry-policy table Alpha 497 formally
   establishes (built alongside this Stage, reused here unchanged).

## 4. Requirements satisfied, confirmed by direct inspection

- **Observationを書かない** — no import of either Observation
  vocabulary anywhere in this file.
- **Schedulerを知らない** — no import of `fedos_publish_scheduler.ts`.
- **Retry directiveを決めない** — no per-call, protocol-aware
  transience judgment; the ONE fixed table (Alpha 497) is applied
  uniformly, the same table any future protocol adapter would reuse.
- **Outboxを削除しない** — no `FedosBoardOutboxPersistence` import; this
  adapter never reads or writes the Outbox at all.
- **Boardを変更しない** — no Board Repository/Reader import.

## 5. What this Stage does NOT do

- Does not modify `FedosRelayNostrBoardPublisher`,
  `FedosNostrBoardPublisher`, `FedosBoardOutboxPublisher`, or
  `deserializeFedosBoardOutboxIntent` — all four imported unchanged.
- Does not implement signing, does not construct a
  `FedosNostrSigningAuthority` of any kind, does not choose a default
  `eventSource` — the caller MUST inject one.
- Does not wire this adapter into `FedosPublishScheduler` or any Host —
  that remains uninstantiated outside tests (Alpha 499 exercises it
  directly; no production caller is added by this Arc, per its own
  absolute prohibition on Host ownership).

## 6. See also

- `docs/secure_runtime_alpha_492_canonical_publisher_result_decision.md`
- `docs/secure_runtime_alpha_487_four_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
