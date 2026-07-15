# Secure Runtime Alpha 502 — Host Dependency Extension Decision

Stage 2 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

## 1. Three new OPTIONAL fields on `FedosDesktopHostDependencies`

```ts
readonly publisher?: FedosBoardOutboxPublisher;
readonly observationRepository?: FedosDeliveryObservationRepository;
readonly deliveryIntervalMs?: number;
```

Mirrors `outboxPersistence?`'s own Alpha 419 shape exactly: OPTIONAL,
each defaulted inside the CONSTRUCTOR body (never in
`createFedosDesktopHost()`, matching that function's own "does not
duplicate that default" discipline, Alpha 334), so every existing
`new FedosDesktopHost({desktopApplication, boardPersistence})` call
site continues to compile and behave identically.

## 2. Why three fields, not one

- `publisher` — required for `startDelivery()` to construct a
  `FedosPublishScheduler` at all (`FedosPublishSchedulerDependencies.publisher`
  is REQUIRED, no default exists on that type, and this Arc must not
  add one — Scheduler変更禁止).
- `observationRepository` — the literal ask ("Host constructorへ
  ObservationRepository を追加").
- `deliveryIntervalMs` — `FedosPublishSchedulerDependencies.intervalMs`
  is ALSO required, with no default; Host needs its own cadence value
  to pass through. Not adding this field would force a hardcoded magic
  number buried inside `startDelivery()`'s own body instead of a named,
  overridable dependency — worse, not better, for a value every other
  injected dependency on this same interface is already override-able.

## 3. What is explicitly NOT added

No `desktopApplication`/`boardPersistence`/`outboxPersistence` field is
touched, renamed, or made required — all three remain byte-for-byte
their Alpha 334/419 shape. No FIFTH field (e.g. a Clock, a
`FedosNostrSigningAuthority`, a Relay URL) is added — none is needed to
satisfy this Arc's own six-item scope, and adding one un-asked-for would
violate "追加のみ" in spirit even though it is textually additive.

## 4. See also

- `docs/secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory.md`
- `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
