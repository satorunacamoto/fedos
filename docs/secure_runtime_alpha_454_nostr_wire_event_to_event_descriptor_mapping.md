# Secure Runtime Alpha 454 — Nostr Wire Event to Event Descriptor Mapping

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts`.
Stage 4 of the Alpha 451–460 Canonical Nostr Outbound Publisher
Foundation Arc.**

## 1. Why now

Alpha 451 §2 confirmed `FedosNostrWireEvent` and `FedosEventDescriptor`
are two different types, and that Alpha 234's own header already
anticipated — without building — exactly this adapter. This Stage
builds it.

## 2. What was implemented

```ts
export function nostrWireEventToFedosEventDescriptor(event: FedosNostrWireEvent): FedosEventDescriptor {
  return Object.freeze({
    id: event.id,
    provider: "nostr",
    author: event.pubkey,
    createdAt: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    signature: event.sig,
  });
}
```

- Pure and synchronous — no network I/O, no Relay/Outbox reference, no
  signing, no validation beyond the mapping itself.
- `provider` is always the fixed literal `"nostr"` — this file is
  Nostr-specific, so it is always Nostr; nothing derives or accepts an
  override.
- The mapping is the EXACT mirror of `WebSocketRelay.publish()`'s own
  inbound-direction wire mapping (Alpha 216: `author`→`pubkey`,
  `createdAt`→`created_at`, `signature`→`sig`, `provider` dropped) —
  same six fields, opposite direction, `provider` now supplied instead
  of dropped.
- The return value is `Object.freeze`d, matching this repository's own
  "constructed value is frozen" convention (e.g.
  `createFedosBoardOutboxIntent`, Alpha 414).

## 3. Responsibility boundary

- **Pure mapping only:** no field is validated for well-formedness here
  — the input is trusted to already be a well-formed
  `FedosNostrWireEvent`, produced by `FedosNostrSigningAuthority.signEvent()`
  (Alpha 442/445), which already guarantees its own output shape.
- **No Relay awareness:** this file never imports `FedosRelay` — sending
  the mapped descriptor is exclusively `FedosRelayNostrBoardPublisher`'s
  own concern (Alpha 456).

## 4. What this Stage does NOT do

- Does **not** validate `event`'s own shape — that already happened at
  signing time (Alpha 445's own `isWellFormedFedosNostrUnsignedEventRequest`
  guards the REQUEST; the signed OUTPUT shape is guaranteed by
  `FedosNostrWireEvent`'s own type, Alpha 234).
- Does **not** call `FedosRelay.publish()` or reference `FedosRelay` in
  any way.
- Does **not** modify `fedos_nostr_wire_event.ts`, `fedos_event_descriptor.ts`,
  `fedos_relay.ts`, `websocket_relay.ts`, or `null_relay.ts`.

## 5. See also

- `docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
