# Secure Runtime Alpha 5881–5960 — Control Payload / Wire Mapping

**FedOS Signed Recipient Deletion Request Private Transport and Local Policy Integration Arc**

## Wire seam

`FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId, plaintext,
createdAt)` (`src/conversation/transport/fedos_private_transport.ts`, Alpha 1841–1920/5561–5640,
unmodified) — real NIP-17 Rumor → Seal → Gift Wrap pipeline, real Outbox persistence,
real bounded retry via the existing `FedosDeliveryRetryRegistry`, real Relay ACK tracked
separately from recipient processing. No second transport, no second Outbox, no second
Scheduler.

## Envelope (`src/conversation/deletion_request/fedos_deletion_request_control_payload.ts`)

```
{ schemaVersion: 1, kind: "deletion-request-v1",        request: FedosSignedDeletionRequestV1 }
{ schemaVersion: 1, kind: "deletion-acknowledgement-v1", acknowledgement: FedosSignedDeletionAcknowledgementV1 }
```

Mirrors `d825aa0`'s own `fedos_ratchet_peer_capability_control_payload.ts` structurally:
closed, explicit-discriminator envelope; exact field-set check per `kind`; unknown
discriminator or extra/missing field fails closed to `null`; 65536-byte size bound enforced
BEFORE `JSON.parse`. The inner `request`/`acknowledgement` value is never a fresh schema —
it is the ALREADY-real, ALREADY-signed `FedosSignedDeletionRequestV1`/
`FedosSignedDeletionAcknowledgementV1` (`5641-5720`'s own real account-signing boundary,
unmodified): a real, `kind: 1` Nostr event whose own `id`/`sig`/`pubkey` IS the
authenticity proof, wrapped here for wire transit only. This file performs no cryptographic
verification itself — that remains `verifyFedosSignedDeletionRequestV1()`/
`verifyFedosSignedDeletionAcknowledgementV1()`'s own job, run by the Inbound Coordinators
strictly AFTER this file's own structural decode succeeds.

## Dispatch order at `FedosConversationRuntime.receiveNip17Rumor()`

1. Direct Ratchet payload attempt (`5561-5640`, unmodified)
2. Peer Capability control payload attempt (`5721-5800`, unmodified)
3. **Deletion request/acknowledgement control payload attempt (this Arc)** —
   `FedosDeletionRequestRuntime.importDeletionRequestOrAcknowledgementPayload()` tries the
   request discriminator first, falls through to the acknowledgement discriminator, and
   only then falls through to the legacy chat-message coordinator. A control payload is
   therefore NEVER imported as an ordinary chat message, and the ratchet/peer-capability
   attempts always run first (a deletion-request payload can never be mislabeled as either).
4. Legacy/static NIP-17 chat message coordinator (unmodified fallback)

## Route selection

Exactly one explicit route: the standard `"nostr-nip17-v1"` Gift Wrap route, selected via
the SAME `resolveFedosConversationTransportRoute()` every other real send in this codebase
already uses. No fallback route exists in code (Phase Q, guard #16/#17) — a
`"route-unavailable"` outcome from the transport is surfaced to the caller as-is.

## Size/replay/dedup layering

- Gift Wrap ID / inner event ID: the transport's own existing Relay-event dedup
  (unmodified).
- Control-payload discriminator + request/ack body: this file's own strict schema check.
- Logical request ID: `FedosDeletionRequestStatePersistence`'s own monotonic-transition
  enforcement (`5641-5720`, additively extended this Arc — see the execution spec).
- Recipient evaluation ID: `FedosDeletionRecipientDecisionPersistence`'s own monotonic-
  transition enforcement (`5641-5720`, unmodified plus one additive `policy-rejected`
  mutator this Arc adds).
- Local deletion plan ID: `b3b3a6d`'s own `persistence.getRecord(planId)`-first idempotency
  (unmodified).
- Acknowledgement ID: `FedosDeletionAcknowledgementPersistence`'s own requestId-keyed,
  no-delete-method port (`5641-5720`, unmodified) — a duplicate exact acknowledgement is
  `"already-present"`; a conflicting one (same `requestId`, different body) is `"conflict"`.

A rewrapped duplicate (same logical request/ack re-Gift-Wrapped under a fresh outer event)
still carries the SAME inner discriminator envelope and the SAME `requestId`/`nonce` — it is
therefore caught by the SAME logical-id-keyed persistence idempotency above, regardless of
the outer wire event's own identity.
