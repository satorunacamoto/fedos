# Secure Runtime Alpha 701 — Current Delivery Activation Inventory

Stage 1 of Phase B of the Alpha 681–720 Arc.

## Trace

```
BoardRuntime
→ Host submitPostWithOutbox
→ Outbox
→ Scheduler
→ Nostr Publisher Adapter
→ Nostr Publisher
→ Signing Authority
→ Relay
```

Every piece except ONE already existed, fully built and tested (Alpha
451–530): `FedosBoardOutboxPublisher` (Alpha 473), `FedosPublishScheduler`
(Alpha 476), `FedosNostrBoardPublisherAdapter` (Alpha 496),
`FedosNostrBoardPublisher`/`FedosRelayNostrBoardPublisher` (Alpha
455/456/457), `FedosRelay`/`WebSocketRelay` (Alpha 212–238),
`FedosWasmNostrSigningAuthority` (Alpha 445).

## Missing ownership/injection edge found

`FedosNostrBoardPublisherAdapter`'s own second constructor argument,
`eventSource: (record) => Promise<FedosNostrWireEvent | null>`, had **no
production implementation anywhere in this repository** — confirmed by
`grep`: every existing usage of `FedosNostrBoardPublisherAdapter` is in a
test file, supplying a hand-scripted fixture event. No code mapped a
`FedosBoardPost` into a `FedosNostrUnsignedEventRequest` for the Signing
Authority to sign. This is the ONE real gap Phase B closes (Alpha 703/704).

A second, smaller gap: `FedosDesktopRuntimeConfig` had no field for a
Nostr signing authority, Relay, or account index — `startFedosDesktopRuntime()`
constructs no Signing Authority/Relay of its own by design (Alpha 610), so
a caller had no wiring surface to assemble a real Nostr publisher through
config alone. Closed by Alpha 697 (Phase A) — the same
`nostrAuthorBindingAuthority`/`nostrAccountIndex` fields serve both the
binding check and (via a caller-constructed `publisher`) delivery.

Every actual object in the chain IS constructible in the same Local
Runtime — verified end to end in
`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` and
`test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`.
