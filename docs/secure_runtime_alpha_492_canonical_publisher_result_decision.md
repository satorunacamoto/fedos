# Secure Runtime Alpha 492 — Canonical Publisher Result Decision

Stage 2 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. Adopted type

```ts
export type FedosOutboundPublishResult =
  | { readonly outcome: "accepted"; readonly externalReference: string }
  | { readonly outcome: "rejected"; readonly externalReference: string | null }
  | { readonly outcome: "failed"; readonly externalReference: string | null };
```

Adopted as proposed, unmodified — verified against real source (Alpha
491 §1) to be constructible by both existing Publisher families without
further type changes.

## 2. Why `retryPolicy` is excluded

This Arc's own absolute requirement. Also independently justified by
Alpha 491 §1: `FedosNostrBoardPublisher` has NEVER carried retry
vocabulary (Alpha 452 §4's own prohibition) — a canonical type that
required it would be unconstructible by half of this Arc's own two
target families. Retryability becomes a SEPARATE, fixed, outcome-keyed
lookup, decided outside the Publisher (Alpha 497 §2) — reusing the
EXISTING `FedosBoardOutboxRetryPolicy` vocabulary unchanged, never a
new algorithm.

## 3. Why `outcome: "accepted"` replaces `"delivered"`

Aligns the vocabulary with the canonical Observation state (Alpha
493) verbatim, so a caller building an Observation record from a
`FedosOutboundPublishResult` never re-translates a word for no reason.

## 4. `externalReference` — required for `"accepted"`, nullable otherwise, and what it must NOT be mistaken for

Required non-null for `"accepted"` BY DESIGN: it forces every future
Publisher claiming acceptance to supply SOME concrete evidence — a
counterparty-issued id, a receipt, or (per §5 below) the best available
substitute when no counterparty signal exists at all — rather than an
empty, unfalsifiable claim. It is never an Error object, never a raw
Relay/HTTP message body, and never Observation metadata; it is a single
opaque string, or `null`.

## 5. Named tension: this Arc's own Nostr Relay boundary has NO acceptance evidence, at all

This Arc's own absolute instruction: **"acceptedとtransport-send-successを混同しない"**
(do not conflate "accepted" with "transport send success"). Direct
inspection of the ENTIRE Nostr transport chain confirms this is not a
hypothetical risk:

- `FedosRelay.publish(event): Promise<void>` (`fedos_relay.ts`, Alpha
  216) returns **no value of any kind** — not even the event id echoed
  back — by explicit, unchanged design ("No ACK handling").
- `WebSocketRelay.publish()`/`NullRelay.publish()` (Alpha 216) resolve
  as soon as the local `send()`/append call returns; neither registers
  a `"message"` listener inside `publish()` itself, so neither can ever
  learn whether the relay's own `["OK", ...]` response was `true` or
  `false` — this repository has NO OK-correlation mechanism anywhere.
- `FedosRelayNostrBoardPublisher.publishOne()` (Alpha 456) therefore
  returns `true` for exactly one reason: the local `relay.publish()`
  call resolved without throwing. It carries no information about
  whether the relay stored, forwarded, or silently dropped the event.

**Decision:** `FedosNostrBoardPublisherAdapter` (Alpha 496) DOES map a
successful send to `outcome: "accepted"` — but `externalReference` is
set to `entry.event.id` (the event's own deterministically-computed
NIP-01 id, already known locally before the send, NOT a
counterparty-issued token) — and this file, plus Alpha 496's own doc,
states PLAINLY: **this specific adapter's `"accepted"` means "this
repository's own transport attempt completed without a local error,"
never "the relay confirmed receipt."** This is a real, named limitation
of the CURRENT Relay boundary (Alpha 216, unchanged, out of this Arc's
own scope to extend with OK-correlation — that would be new Observation
wiring at the transport layer, not reconciliation), not a claim this
adapter silently overstates. A future OK-correlation Arc can replace
`entry.event.id` with a real relay-issued reference without changing
`FedosOutboundPublishResult`'s own shape.

A direct, mechanical consequence of the SAME evidence gap: the Nostr
adapter can **never** produce `outcome: "rejected"` — rejection implies
an explicit NEGATIVE signal from the counterparty (an `["OK", id,
false, reason]` message), which requires the same OK-correlation this
repository does not have. `false` from `publishOne()` therefore always
maps to `outcome: "failed"`, `externalReference: null` (§ Alpha 496).

## 6. Options rejected

- **Reuse `FedosBoardOutboxPublishResult` as-is (do nothing).** Rejected
  — it embeds `retryPolicy` (§2) and cannot be produced by
  `FedosNostrBoardPublisher` without inventing per-call retry judgment
  this Arc's own thread has never had.
- **Reuse the bare `boolean` as canonical.** Rejected — cannot express
  `externalReference`, and collapses `rejected`/`failed` into one bit,
  which the generic `FedosBoardOutboxPublisher` family already
  distinguishes today and must not regress.
- **Make `externalReference` optional (not required) even for
  `"accepted"`.** Rejected — would silently permit an evidence-free
  acceptance claim, the exact conflation §5 forbids.

## 7. See also

- `docs/secure_runtime_alpha_491_implementation_inventory.md`
- `docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
