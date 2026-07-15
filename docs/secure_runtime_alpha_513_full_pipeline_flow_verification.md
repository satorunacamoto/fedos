# Secure Runtime Alpha 513 — Full Pipeline Flow Verification

Stage 13 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc. Verification only.

## What is verified

A real `FedosDesktopHost`, constructed with a real
`FedosNostrBoardPublisherAdapter` (Alpha 496, wrapping a real
`FedosRelayNostrBoardPublisher` over a connected `NullRelay`) injected
as `publisher`, drives a real Outbox intent through:

**Host.startDelivery() → FedosPublishScheduler.tick() →
FedosNostrBoardPublisherAdapter.publish() →
FedosRelayNostrBoardPublisher.publishOne() → NullRelay.publish() →
(bridged) FedosValidatingDeliveryObservationRepository.record() →
Host.observationQuery()**

— the exact chain this Arc's own "Verification" section names,
end to end, using the SAME concrete classes this repository already
built across Alpha 451–500, none of them modified by this Arc.

## Result

`relay.published` contains exactly the one converted
`FedosEventDescriptor`; `Host.observationQuery().historyFor(subjectId)`
contains the bridged `publishing`/`accepted` facts; all GREEN. See the
accompanying test file for the exact assertions.

## See also

- `docs/secure_runtime_alpha_496_publisher_adapter.md`
- `docs/secure_runtime_alpha_508_host_start_delivery.md`
