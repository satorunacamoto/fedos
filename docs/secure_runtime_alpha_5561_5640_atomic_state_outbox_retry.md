# Secure Runtime Alpha 5561–5640 — Atomic State / Outbox / Retry

## Outbound ordering (Phase E, as-built)

`FedosDirectRatchetOutboundIntegration.sendMessage()`:

1. Resolve counterparty (local/remote account refs) — caller-injected accessor, no crypto.
2. Resolve the explicit route via `resolveFedosDirectRatchetRoute()` — fails closed to `"route-unavailable"` with a specific reason before any encrypt.
3. Resolve/restore the live `FedosDirectRatchetCryptographicSession` (cache hit, or real restore from durable sealed state).
4. Real `encrypt()` — runs exactly once per logical send.
5. Read the LIVE session's own `sendCounter`/`receiveCounter`/`previousSendingChainLength()` and `remoteRatchetPublicKeyHex()` (never locally assumed increments — see the execution spec's own bug #2) and commit them via `FedosDirectRatchetStateRuntime.commitCounters()`.
6. Re-seal (`sealState()`) and checkpoint the four fixed-kind secrets + any skipped keys.
7. Construct the `"message"` payload (Phase F).
8. Hand the JSON-encoded payload to the injected `sendMailboxNip17`-shaped thunk — the EXISTING, unmodified `FedosPrivateTransport.sendMailboxNip17()` seam builds the real Rumor→Seal→Gift Wrap, persists the additive `schemaVersion: 2` Outbox record, and the existing Scheduler publishes it on its own next tick.

## Why a failed publish never reuses a consumed message key

`encrypt()` (step 4) runs exactly once. Its result — the already-consumed
wire message — is embedded in an already-signed native Gift Wrap event by
`NostrNip17V1WireAdapter.build()` (step 8), and `FedosPrivateTransport`'s own
Outbox persists that **exact signed event** (Option A, the same
retry-safety answer the static NIP-17 lineage already adopted — see
`fedos_private_wire_prepared_delivery.ts`'s own header). A retry replays the
identical already-signed bytes verbatim; it never calls `encrypt()` again,
so a failed publish can never cause the same ratchet message key to be
consumed twice.

## Durable state commit vs. Outbox vs. publish vs. ACK — kept as separate facts

| Fact | Where it lives |
|---|---|
| Ratchet state committed | `FedosDirectRatchetStateRuntime` (session record revision) + the two current-value snapshot ports |
| Private event constructed | `NostrNip17V1WireAdapter.build()`'s return value |
| Outbox persisted | `FedosConversationTransportOutboxPersistence` (`schemaVersion: 2`) |
| Relay publish attempted / ACK accepted-or-rejected | `FedosDeliveryObservationRepository` (existing, unmodified) |
| Recipient received / decrypted / imported | The counterpart's own `FedosDirectRatchetInboundIntegration` outcome — a fact this side never observes directly |

This Arc introduces no new conflation of these facts — it reuses the
existing Outbox/Observation/Scheduler machinery exactly as the static
NIP-17 route already does, and adds nothing that would let a Relay ACK be
mistaken for recipient delivery.

## Inbound ordering (Phase G/H, as-built)

`FedosDirectRatchetInboundIntegration.receiveRumor()`:

1. Decode the inner payload — `"not-ratchet-payload"` falls through to the legacy coordinator (never the reverse).
2. Dedup by the Rumor's own id (`FedosPrivateNostrImportRecordPersistence`, a namespace dedicated to this Arc) — **before** any decrypt.
3. Resolve sender/Conversation via the existing, unmodified `resolveFedosPrivateNostrInboundDirectConversation()`.
4. For `"session-init"`: validate every binding field against this runtime's own local configuration (conversation, recipient account/Device, sender account) — mismatches fail closed (`wrong-conversation`/`wrong-recipient`) before any session is created.
5. For `"message"`: resolve the claimed `sessionId`'s own ALREADY-persisted binding and verify the resolved sender/Conversation genuinely match it — a wire-supplied `sessionId` is trusted only after this check, never on its own say-so.
6. Real `decrypt()` — the Rust ratchet core's own fail-closed rejection covers tamper, wrong Device, and replay/duplicate message number uniformly (`"decrypt-failed"`, deliberately not a distinguishing oracle).
7. Commit counters (`commitCounters()`) and re-checkpoint secrets — same discipline as outbound, symmetric.
8. Import plaintext through the existing, unmodified Conversation Envelope/Payload/Retention/Search pipeline (Alpha 861/863/870's own reviewed local-storage-at-rest boundary).

## Layered deduplication (Phase H) — reused, not reinvented

- **Outer Gift Wrap event id**: Relay-level dedup, already handled by `FedosRelayEventDeduplicator` (unmodified) before this Arc's own code is ever reached.
- **Rumor/inner payload identity**: `FedosPrivateNostrImportRecordPersistence`, keyed by the Rumor's own id — catches a re-wrap of the identical Rumor inside a different Gift Wrap.
- **Ratchet message-number replay**: the Rust ratchet core's own `decrypt()` (proven directly in the real vertical slice test — replaying a consumed message number returns `None`).

No new dedup mechanism was invented; this Arc wires the three pre-existing,
independent layers together in the required order (Relay → Rumor id →
ratchet counter) rather than relying on any single one alone or on Relay
arrival order.
