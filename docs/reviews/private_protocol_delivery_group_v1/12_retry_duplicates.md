# Review 12 — Retry and Duplicate Semantics

## Reuse existing Retry/Observation architecture — confirmed reusable, not merely intended to be

`10` already establishes that `FedosDeliveryObservation`'s whole
transition-graph/retry-registry/retry-query stack
(`src/board/observation/`) is domain-agnostic and can be reused
unmodified, keyed by a `FedosConversationOutboxIntent`'s own `id`. This
document specifies exactly how the six required properties map onto
that existing machinery.

**Deterministic protocol event/message ID.** Nostr's own `computeEventId`
(`src/nostr/event.ts`) already derives a NIP-01 event id deterministically
from `serializeForId` (canonical `[0,pubkey,created_at,kind,tags,content]`,
`event.ts:87-96`) — **the same plaintext-derived-content input this
event id hashes over must, for an encrypted event, hash over the
ciphertext/gift-wrap bytes, not the pre-encryption plaintext** (a
consequence of `03`'s "no lossless mapping" finding: the wire content
IS the ciphertext once a wrapping exists). This gives Nostr delivery a
real, already-implemented deterministic-id mechanism for free once
wire-mapping (`04`) lands; ActivityPub/AT Protocol/Session (`06`/`07`/`08`)
have no equivalent today and this review does not invent one before
their own wire mapping exists.

**Resend safety.** `FedosConversationEncryptionCoordinator`'s own
`idempotencyKey` mechanism (`fedos_conversation_encryption_coordinator.ts:104-114,222-244`)
already proves the pattern this review recommends extending to
delivery: a caller-supplied (or freshly generated) idempotency key maps
to one coordination attempt; recovery re-reads durable state rather
than re-running side-effecting work. A future delivery Arc should key
its own Outbox intent id off the **same idempotency key** the
Encryption Coordinator used to produce the Envelope, so a resend after
a crash reuses the same `FedosConversationOutboxIntent.id` rather than
minting a new one and risking a duplicate transport attempt for an
Envelope that already has one in flight.

**Duplicate server acceptance.** Because a Nostr event id is a
deterministic hash of its own content, resending the identical
(already-encrypted) event to the same relay is naturally idempotent at
the relay's own level — a second `OK true` for the same id is not a
second message. This falls out of NIP-01's own design, confirmed
already exploited correctly elsewhere in this repository
(`FedosRelayOkCorrelatedNostrBoardPublisher` keys pending publishes by
event id specifically, `04`).

**Recipient duplicate display.** Out of scope for this repository —
whatever a recipient's client does with two deliveries of the same
event id (deduplicate on id, as any correct Nostr client should) is
that client's own responsibility, not this repository's sender-side
concern.

**Restart recovery.** Exactly the pattern `FedosConversationEncryptionCoordinator`'s
own header already documents (lines 46-69): "read how far a prior
attempt got, only move forward, never re-spend an already-consumed
resource." A future delivery coordination log should mirror this
verbatim, using the Outbox intent's own durable state (`10`) plus
`FedosDeliveryObservation`'s own history (`currentStateFor`,
`fedos_delivery_observation_query.ts:57-59`) to determine whether a
transport attempt already reached a terminal state before retrying.

**Permanent protocol rejection.** Already modeled:
`fedos_delivery_retry_reason_codec.ts`'s `encodeFedosDeliveryRetryReason`/
`decodeFedosDeliveryRetryReason` (lines 27-46) already encode
`isFinal` on a terminal observation's own `reason` string, failing
closed to `{isFinal: false, ...}` for any unrecognized input (lines 18-19,
45) — i.e., an unrecognized rejection reason is treated as retryable
by default, never as silently permanent. This review recommends the
same fail-open-to-retry (never fail-open-to-permanent-abandonment)
default for private delivery.

## See also

- `10_outbox_intent.md`, `11_delivery_results.md`
- `04_nostr_readiness.md`
