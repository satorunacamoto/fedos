# Review 11 — Delivery Result Semantics

## The result vocabulary, adapted from two existing, real result unions

`FedosOutboundPublishResult` (`src/board/publish/fedos_outbound_publish_result.ts:34-37`)
already distinguishes `accepted`/`rejected`/`failed` with a required
`externalReference` on `accepted`. `FedosDeliveryObservationState`
(`src/board/observation/fedos_delivery_observation.ts:40`) already
names `queued|publishing|accepted|rejected|failed`. This review adopts
the same five-state shape, adding **`unsupported`** and
**`mapping-failed`** — two states the public-post pipeline has never
needed, because every public target it names (`nostr`/`activitypub`/
`atproto`) at least has a real inbound adapter to reason about, whereas
private delivery (`04`/`06`/`07`/`08`) has protocols with **no wire
mapping at all**:

| State | Meaning | Distinct from |
|---|---|---|
| `accepted` | Transport completed; protocol/server acknowledged receipt (e.g. a Nostr relay's own `OK true`) | `delivered`-to-recipient — never implied, see below |
| `rejected` | Transport completed; protocol/server explicitly refused (e.g. relay `OK false`) | `failed` — a rejection is informative, not transient |
| `transient-failed` | Transport attempt did not complete (timeout, connection failure); retry may succeed | `rejected` — no server verdict was ever received |
| `unsupported` | No Publisher/wire-mapping exists for this protocol at all (`06`/`07`/`08` today) | `mapping-failed` — this is a static, permanent fact about the destination, not a per-attempt outcome |
| `mapping-failed` | A wire-mapping exists in principle but this specific Envelope failed to convert (e.g. a field `03` names as lossy) | `unsupported` — the protocol is supported in general; this one message could not be encoded |

## The four distinct notions of "success," never allowed to collapse into one

Per the task's own required distinction, restated against real code
that already respects exactly this boundary:

1. **Local encryption success** — `FedosConversationEncryptionCoordinator`
   returning `{outcome: "encrypted", envelope}` (`fedos_conversation_encryption_coordinator.ts:126`).
   This happens entirely before any Outbox intent exists (`02`).
2. **Transport send** — the Publisher's own attempt completing without
   a local error. Confirmed this repository already keeps this
   distinct from server acceptance: `nostrPublishOneResultToOutboundPublishResult`
   (`src/board/publish/nostr/fedos_nostr_publish_result_to_outbound_publish_result.ts:11-22`)
   documents its own boolean input as "this repository's own transport
   attempt completed without a local error," explicitly **not** relay
   confirmation, and its `true` case never produces `"rejected"` —
   only `FedosRelayOkCorrelatedNostrBoardPublisher`'s real OK-correlation
   path can.
3. **Protocol/server acceptance** — a relay's `OK true`/ActivityPub
   server's 2xx/etc. This repository has exactly one place this is
   real: `FedosRelayOkCorrelatedNostrBoardPublisher` (`04`).
4. **Recipient decryption** — never observable by this repository at
   all, for any protocol, today or in any design this review proposes.
   No read-receipt/decryption-ACK mechanism exists anywhere in `src/`.

## "Do not call server acceptance recipient delivery" — why this is not a pedantic distinction here specifically

A relay accepting an event (`OK true`) confirms only that the relay
stored/relayed the event — it says nothing about whether the intended
recipient's client ever fetched, received, or successfully decrypted
it. For a **public** board post this gap is low-stakes (anyone can
re-fetch a public event from any relay indefinitely). For a **private**
message, conflating "the relay accepted my gift-wrapped event" with
"my counterparty received this message" would misrepresent a
confidentiality-relevant guarantee: the recipient may never come
online, may not be subscribed to that relay, or may fail decryption
silently (e.g. a stale/rotated key, `17`) — none of which this
repository can detect from the sender's own side. Any future UI/API
surfacing delivery state must show `accepted` (or better, `sent`), not
`delivered`, for this exact reason.

## See also

- `10_outbox_intent.md`, `12_retry_duplicates.md`
- `04_nostr_readiness.md`
