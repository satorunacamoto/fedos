# 08 — Protocol Extensibility

## Question

Can ActivityPub / AT Protocol / Session be added later without changing
the Host API this review designs?

## Finding: yes, if and only if the registry design (Alpha 01) is followed, and only against the generic Publisher family

The prior review's own Alpha 487 already proved, by real (unmodified)
code execution, that `FedosBoardOutboxPublisher` accepts an arbitrary
NEW implementation with zero interface change — a test-local
`FakeFourthProtocolPublisher` drove a real `FedosPublishScheduler.tick()`
successfully. This review's own Alpha 01 registry design
(`Map<FedosBoardOutboundProtocol, FedosBoardOutboxPublisher>`, injected)
inherits that property directly: adding ActivityPub means a caller
constructs `new SomeActivityPubOutboxPublisher()` (implementing the
SAME `FedosBoardOutboxPublisher` interface) and adds one registry entry
at Host-construction time — `FedosDesktopHost`'s own public API (the
facade methods from Alpha 05) is untouched, and so is
`FedosPublishScheduler`'s.

## The Nostr-specific family does NOT get this for free

Per the prior review's own Alpha 482/487 findings, `FedosNostrBoardPublisher`
(`publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean>`) is
a STRUCTURALLY different contract — it is not a
`FedosBoardOutboxPublisher` and cannot be registered in the Alpha 01
registry as-is. Two consequences for this Host design specifically:

1. The registry, as designed, can only ever hold GENERIC-family
   Publishers. A caller wanting to wire the ALREADY-BUILT
   `FedosRelayNostrBoardPublisher` into this Host design needs an
   adapter class implementing `FedosBoardOutboxPublisher.publish(record)`
   that internally calls `FedosRelayNostrBoardPublisher.publishOne(entry)`
   — which itself requires solving "where does the already-signed
   `FedosNostrWireEvent` paired with this record come from" (Alpha
   451 §2's own unresolved question from the prior arc), since
   `FedosPersistedBoardOutboxRecordV1` alone never carries one. This
   review does not solve that; it names the adapter as the exact,
   necessary shape of the "Nostr Publisher -> Generic Publisher Adapter"
   Arc candidate (§11), a DIRECT consequence of this Host design's own
   registry choice.
2. Because the Host API itself never references `FedosBoardOutboxPublisher`
   vs. `FedosNostrBoardPublisher` by name anywhere in its own public
   surface (Alpha 05's facade exposes `registeredProtocols` — an array
   of protocol labels, not Publisher types), the Host API's own
   STABILITY claim in this section's own title holds regardless of
   which family ends up wired behind any given protocol slot — the
   adapter question is entirely internal to how a caller CONSTRUCTS the
   registry, never Host's own method signatures.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_11_deliverables_and_dependency_order.md`
- `docs/secure_runtime_alpha_487_four_protocol_extensibility_review.md`
