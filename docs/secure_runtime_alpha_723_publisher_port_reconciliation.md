# Secure Runtime Alpha 723 — Publisher Port Reconciliation

Stage 3.

## Requirement

The Scheduler-facing Publisher port must receive the canonical result
directly, with no parallel boolean contract, no hidden rejection side
channel, no `retryPolicy` in the Publisher-facing result, no `Error`
object, no raw Relay message, no protocol-specific text.

## Decision

Add a NEW, additive interface,
`FedosNostrBoardPublisherWithOutcome`
(`src/board/publish/nostr/fedos_nostr_board_publisher_with_outcome.ts`):

```ts
export interface FedosNostrBoardPublisherWithOutcome {
  publishOneOutcome(entry: FedosNostrBoardPublishEntry): Promise<FedosOutboundPublishResult>;
}
```

— returning the EXISTING, reused `FedosOutboundPublishResult` (Alpha 722)
directly, never a boolean.

A NEW, sibling adapter,
`FedosOutcomeAwareNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher`
(`src/board/publish/nostr/fedos_outcome_aware_nostr_board_publisher_adapter.ts`),
consumes it and maps to `FedosBoardOutboxPublishResult` via the EXISTING,
unchanged `outboundPublishResultToFedosBoardOutboxPublishResult()` (Alpha
497) — the Scheduler-facing port therefore receives the canonical result
with no lossy intermediate boolean step at all.

`FedosNostrBoardPublisher` (Alpha 455, boolean), `FedosRelayNostrBoardPublisher`
(Alpha 456/457), `FedosNostrBoardPublisherAdapter` (Alpha 496), and
`nostrPublishOneResultToOutboundPublishResult()` (Alpha 497) are all left
byte-for-byte UNCHANGED — "prefer adapters for backward compatibility
rather than editing unrelated Publisher implementations," per this Arc's
own explicit instruction. Both adapters/both interfaces coexist; a Local
Runtime chooses which to wire.

`FedosRelayOkCorrelatedNostrBoardPublisher` now implements BOTH
`FedosNostrBoardPublisher` (boolean, backward compatible) AND
`FedosNostrBoardPublisherWithOutcome` (canonical, new) — sharing one
internal `#correlate()` method so neither entry point can ever drift from
the other's behavior.
