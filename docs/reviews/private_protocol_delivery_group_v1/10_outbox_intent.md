# Review 10 — Outbox Intent Model

## Can the existing Outbox V1 carry private protocol delivery safely? No — by design, and that design should not change

`FedosBoardOutboxIntent` (`src/board/outbox/fedos_board_outbox_types.ts:96-101`):

```ts
export interface FedosBoardOutboxIntent {
  readonly id: FedosBoardOutboxId;
  readonly postId: FedosBoardPostId;
  readonly target: FedosBoardOutboxTarget;
  readonly createdAt: number;
}
```

This type is **board-post-specific** by its own field name (`postId`)
and by its own header's explicit statement (lines 25-32): it carries a
post "BY REFERENCE ONLY... never a body duplicate, never author-secret
data, never a protocol-native payload, never a delivery result, retry
count, or scheduling policy." Retrofitting a private `envelopeId`
reference into this exact type would either (a) require a union/optional
field distinguishing "board post" from "conversation envelope," coupling
two domains `01` confirmed are currently fully independent (zero
cross-references in either direction), or (b) require every board-only
consumer of this type to newly handle a private-delivery case that
never applies to it. Both violate this review's own "minimize ripple,
prefer adapters" instruction more than the alternative below.

## Recommendation: a new, sibling `FedosConversationOutboxIntent`, mirroring the same shape, never reusing the same type

```ts
interface FedosConversationOutboxIntent {
  readonly id: FedosConversationOutboxId;         // deterministic, mirroring makeFedosBoardOutboxId
  readonly envelopeId: FedosConversationEnvelopeId; // by-reference only, mirrors postId
  readonly recipientReference: FedosConversationParticipantReference; // who this specific delivery attempt targets
  readonly target: { protocol: FedosConversationOutboundProtocol; destination: string | null }; // mirrors FedosBoardOutboxTarget shape exactly
  readonly wireFormatVersion: number;              // NEW field, absent from the board type — see below
  readonly createdAt: number;
}
```

This is an **adapter of the existing pattern**, not a redesign: same
by-reference discipline, same deterministic-id discipline
(`makeFedosBoardOutboxId`'s own construction, `id` derived from
`envelopeId + recipientReference + target`, never random), same
"no delivery result/retry count/scheduling policy on the intent itself"
discipline. Two differences are load-bearing, not stylistic:

- **`recipientReference` is required, not implied.** A board post's
  `target` alone identifies where to publish (a public relay/inbox);
  a private delivery additionally needs to know **which specific
  Membership participant** this delivery attempt is for, because — per
  `09` — private delivery has no automatic fanout. For a `direct`
  Conversation this is redundant with "the one other member," but the
  field must exist so a future Arc never has to guess it back out of
  Membership state at Publisher-invocation time (violating `02`'s
  "Publisher must not decide policy" boundary by forcing it to look
  up Membership itself).
- **`wireFormatVersion` is new.** The board Outbox has no equivalent
  because a `FedosBoardPost` maps to exactly one wire shape per
  protocol today. `03`'s own finding — protocol-native wire mapping is
  research-gated and may change (e.g., NIP-17 gift wrap arriving after
  an interim NIP-44-only mapping) — means an intent durably queued
  before a wire-mapping change must record which mapping it was built
  against, so an in-flight intent is never silently reinterpreted
  under a newer, incompatible mapping after a restart.

## What must never appear on this intent, restated as an explicit negative requirement

No plaintext, no raw key material, no bearer token of any kind. The
ciphertext itself already lives in `FedosConversationPayloadStorage`
(`src/conversation/payload_storage/fedos_conversation_payload_storage.ts`),
referenced by `payloadId` on the Envelope, never duplicated. The
Outbox intent needs only `envelopeId` to reach both the Envelope
record and, transitively, its Payload — exactly mirroring how
`FedosBoardOutboxIntent.postId` never duplicates a post body.

## Observation/Retry: reuse as-is, no adapter needed

Unlike the Outbox intent, `FedosDeliveryObservation`
(`src/board/observation/fedos_delivery_observation.ts:83-89`) and its
whole transition-graph/retry-registry machinery (`12`) are already
**domain-agnostic** — `subjectId` is an opaque string, never typed to
`FedosBoardPostId`. Confirmed by grep (`01`/`02`): nothing in
`src/board/observation/` references the Conversation domain, but
nothing about the type shapes requires a board post either. This
review recommends **reusing `FedosDeliveryObservation`/
`FedosDeliveryObservationRepository`/`FedosDeliveryRetryRegistry`
unmodified**, keyed by the new `FedosConversationOutboxIntent`'s own
`id` — the one piece of this review's recommendation that is genuine
reuse, not an adapter, because the existing type already asks nothing
domain-specific of its caller.

## See also

- `01_source_inventory.md`, `02_delivery_responsibility.md`, `09_delivery_eligibility.md`
- `11_delivery_results.md`, `12_retry_duplicates.md`, `13_delivery_storage.md`
