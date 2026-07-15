# Secure Runtime Alpha 413 — Outbox Identifier and Target Model

Stage 3 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements `src/board/outbox/fedos_board_outbox_types.ts`.

## 1. Identifier

`FedosBoardOutboxId` is an opaque branded string, mirroring
`FedosBoardPostId`/`FedosBoardId` (Alpha 252) exactly — structurally
distinct from a plain `string` and from every other branded id in this
repository.

**Deterministic derivation, not randomness.** `makeFedosBoardOutboxId(postId, target)`
composes `${postId}::${target.protocol}::${target.destination ?? ""}`.
This Arc's own instruction requires exactly this: "Identical logical
intent must map consistently enough to support idempotency," and "Do
not use randomness unless an existing secure ID authority exists" (none
does, for this purpose, anywhere in this repository). The practical
payoff: submitting the same `(postId, target)` pair twice always
produces the same id, so `FedosBoardOutboxPersistence.putIntent()`'s own
`"already-present"` semantics (Alpha 417) give idempotency for free —
no separate dedupe index is needed anywhere in this Arc.

The `::` separator cannot collide with any of the three parts:
`FedosBoardPostId` is always non-empty and is never validated to
contain `::` specifically by convention of every other branded id in
this codebase; `FedosBoardOutboundProtocol` is one of four fixed
literals, none containing `::`. A caller-supplied `destination`
containing `::` cannot cause a FALSE collision with a different
`(postId, protocol)` pair, because `postId`/`protocol` are always
consumed first, in fixed positions, before `destination`'s own
contents are ever compared as a whole trailing segment.

## 2. Supported target protocols

`FedosBoardOutboundProtocol = "nostr" | "activitypub" | "atproto" | "session"`
— the SAME four labels `FedosBoardSourceProtocol` (Alpha 253) already
uses for INBOUND provenance, deliberately reusing the vocabulary rather
than inventing a second, only-slightly-different one. (`FedosBoardSourceProtocol`
also has a fifth label, `"fedos"`, naming content authored directly
through FedOS — not a valid OUTBOUND wire protocol, so it is
deliberately excluded from `FedosBoardOutboundProtocol`.)

## 3. Target model

```ts
export interface FedosBoardOutboxTarget {
  readonly protocol: FedosBoardOutboundProtocol;
  readonly destination: string | null;
}
```

`destination` is INERT VOCABULARY this Arc, never an active network
address:

- **Nostr**: reserved for a future Relay policy/URL, or `null` for a
  future publisher-selected destination. No Relay is dialed here.
- **ActivityPub**: reserved for a future inbox/actor destination URI.
  No HTTP request is ever made here.
- **AT Protocol**: reserved for a future repository/account authority
  reference. No XRPC call is ever made here.
- **Session**: reserved for a future explicit Gateway destination. No
  Gateway is ever contacted here.

No target may ever carry an access token, private key, Relay socket,
HTTP header, OAuth credential, Session credential, protocol-native
event/record object, or free-form metadata bag — enforced structurally:
the type has exactly two fields, and nothing in this file's own runtime
validator (`isValidTarget`, private) accepts anything else.

## 4. See also

- `docs/secure_runtime_alpha_252_canonical_board_identifiers.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_414_immutable_outbox_intent_model.md`
