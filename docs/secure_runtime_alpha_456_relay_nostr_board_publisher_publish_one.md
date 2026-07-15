# Secure Runtime Alpha 456 — FedosRelayNostrBoardPublisher: publishOne

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts`, with the
`publishOne()` method. Stage 6 of the Alpha 451–460 Canonical Nostr
Outbound Publisher Foundation Arc. `publishBatch()` (Alpha 457, the
following Stage) is added to this SAME file, presented separately in
`docs/secure_runtime_alpha_457_relay_nostr_board_publisher_publish_batch.md`.**

## 1. Why now

Alpha 455 shipped the contract; this Stage ships the ONE real
implementation, mirroring `FedosWasmNostrSigningAuthority`'s own
identical relationship to `FedosNostrSigningAuthority` (Alpha 445).

## 2. What was implemented

```ts
export class FedosRelayNostrBoardPublisher implements FedosNostrBoardPublisher {
  readonly #relay: FedosRelay;

  constructor(relay: FedosRelay) {
    this.#relay = relay;
  }

  async publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean> {
    if (entry.intent.target.protocol !== "nostr") {
      return false;
    }
    const descriptor = nostrWireEventToFedosEventDescriptor(entry.event);
    try {
      await this.#relay.publish(descriptor);
      return true;
    } catch {
      return false;
    }
  }
}
```

- The constructor takes exactly one argument, `relay: FedosRelay`
  (injected, never constructed inline — the same "inject the transport"
  discipline `WebSocketRelay` itself already follows via its own
  `FedosRelaySocketFactory`, Alpha 214), and performs no async work.
- `publishOne()` calls `nostrWireEventToFedosEventDescriptor` (Alpha
  454, UNCHANGED) for the Outbox→Relay conversion, then
  `this.#relay.publish(descriptor)` (Alpha 216, UNCHANGED) EXACTLY ONCE.
- `FedosRelay.publish()` already throws when not connected (Alpha 216)
  — this method does not duplicate an `isConnected()` check; it only
  wraps the one call and reports the outcome as a boolean.
- Protocol mismatch (`entry.intent.target.protocol !== "nostr"`) fails
  closed to `false` before any conversion or Relay call is attempted —
  the Alpha 453 §2 decision, implemented here.

## 3. Responsibility boundary

- **Transport only:** one `relay.publish()` call, one boolean result —
  no retry, no backoff, no ACK correlation, no delivery-observation
  field.
- **Never throws:** every failure path — protocol mismatch, a
  thrown/rejected `relay.publish()` — resolves to `false`, never
  propagates an exception to the caller.

## 4. What this Stage does NOT do

- Does **not** add `publishBatch()` — Alpha 457, the next Stage, adds it
  to this same file.
- Does **not** call `relay.connect()`/`relay.isConnected()` — connection
  lifecycle management is out of this Arc's own scope; a disconnected
  Relay's own `publish()` rejection is what already yields `false` here.
- Does **not** retry, delay, or re-attempt `relay.publish()` under any
  circumstance.
- Does **not** modify `fedos_relay.ts`, `websocket_relay.ts`, or
  `null_relay.ts`.

## 5. See also

- `docs/secure_runtime_alpha_455_fedos_nostr_board_publisher_interface.md`
- `docs/secure_runtime_alpha_454_nostr_wire_event_to_event_descriptor_mapping.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
