# Secure Runtime Alpha 455 — FedosNostrBoardPublisher Interface

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/publish/nostr/fedos_nostr_board_publisher.ts`. Stage 5 of the
Alpha 451–460 Canonical Nostr Outbound Publisher Foundation Arc.**

## 1. Why now

Alpha 453 decided the entry-pairing shape and the interface/
implementation split. This Stage builds the interface half — the exact
file and type name Alpha 448 already reserved.

## 2. What was implemented

```ts
export interface FedosNostrBoardPublishEntry {
  readonly intent: FedosBoardOutboxIntent;
  readonly event: FedosNostrWireEvent;
}

export interface FedosNostrBoardPublisher {
  publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean>;
  publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]>;
}
```

- `FedosBoardOutboxIntent` (Alpha 414) and `FedosNostrWireEvent` (Alpha
  234) are imported as TYPE ONLY and reused unchanged — no fourth
  duplicate type of either is introduced.
- `publishOne`/`publishBatch` return ONLY a boolean — the Alpha 452
  return-contract decision, applied here at the contract's own
  definition site.
- No third method. No connection-management, delivery-observation, or
  retry-scheduling method of any kind exists on this interface.

## 3. Responsibility boundary

- **Types only:** this file performs no construction, signing, network
  I/O, or transformation of any kind — that is exclusively
  `FedosRelayNostrBoardPublisher`'s own concern (Alpha 456/457).
- **Contract, not policy:** the interface says WHAT a Publisher does
  (publish one entry, publish many), never HOW — retry policy,
  connection lifecycle, and delivery observation are deliberately absent
  so a future, differently-scoped implementation could still satisfy
  this same contract without a breaking change.

## 4. What this Stage does NOT do

- Does **not** add any implementation — `FedosRelayNostrBoardPublisher`
  is a separate file, added by Alpha 456.
- Does **not** add a third method, a result-object return type, or any
  Retry/Backoff/Observation/ACK/Pool vocabulary.
- Does **not** modify `fedos_board_outbox_types.ts`, `fedos_nostr_wire_event.ts`,
  or any file outside `src/board/publish/nostr/`.

## 5. See also

- `docs/secure_runtime_alpha_453_outbox_relay_entry_pairing_model.md`
- `docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`
- `docs/secure_runtime_alpha_445_typescript_nostr_signing_authority_adapter.md`
