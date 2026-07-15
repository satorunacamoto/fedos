# Secure Runtime Alpha 412 — Outbox Responsibility Decision

Stage 2 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc.

## 1. Candidates compared

- **Option A — outbound state inside `FedosBoardPost`.** Add
  delivery-status fields directly to the canonical, immutable post type.
- **Option B — a separate immutable Outbox intent record.** Keep
  `FedosBoardPost` exactly as it is; a new record type names delivery
  intent, referencing the post by id only.
- **Option C — one shared queue storing protocol-native payloads.** A
  generic queue holding whatever wire shape each protocol happens to
  produce.
- **Option D — Relay publish state as the Outbox.** Reuse
  `FedosRelay`/`WebSocketRelay`'s own connection/publish state as the
  source of delivery truth.
- **Option E — the Ontology Engine (`p2p/`) as the delivery queue.**

## 2. Evaluation

**Option A is rejected.** `FedosBoardPost` is immutable by explicit,
repeated design decision since Alpha 255 (see that Stage's own "every
field is `readonly`" guardrail) — adding a delivery-status field would
either force a NEW post per delivery attempt (defeating the immutable
model's own dedup/identity guarantees) or require breaking the
immutability guarantee outright. It also conflates "the post exists
canonically" with "the post is/was delivered to protocol X" — two facts
with independent lifecycles: one post may target zero, one, or several
protocols, and a delivery outcome can change over time while the post
itself never does.

**Option C is rejected.** A shared queue of protocol-native payloads
means the Outbox would need to understand Nostr `Event` shapes,
ActivityPub `Create(Note)` shapes, AT Protocol repository records, and
Session Gateway messages simultaneously — re-coupling the very
transports Alpha 409 (§5, Arc 401–410) already confirmed have "four
genuinely different transports, four genuinely different success
definitions." This Arc's own instruction explicitly rejects this
"generic protocol-native payload storage."

**Option D is rejected.** `FedosRelay`/`WebSocketRelay` connection state
is per-connection, in-memory, and Nostr-specific by construction — using
it as "the Outbox" would make Outbox durability depend on socket
lifetime and would give ActivityPub/AT Protocol/Session no home at all.

**Option E is rejected outright**, per this Arc's own Absolute
Prohibitions: `p2p/` is the user's independent, cryptocurrency-domain
Ontology Engine — untouched, unimported, unprojected-into.

**Option B — adopted**, exactly as this Arc's own required preferred
candidate names, for the reasons the instruction itself gives and this
Stage independently confirms by inspection:

- one post may target multiple protocols (an array of Outbox intents,
  one per target, is the natural shape; a single mutable field on the
  post is not);
- delivery state changes over time, while canonical posts do not;
- local canonical state (Alpha 391–410) must survive a permanent
  external-delivery failure — the post's own durability can never
  depend on whether Nostr/ActivityPub/AT Protocol/Session ever accept
  it;
- each protocol has genuinely distinct delivery semantics (Alpha 409
  §5), which a single shared record type would flatten dishonestly.

## 3. Frozen vocabulary for this Arc and beyond

- **Canonical post** (`FedosBoardPost`) = the authoritative application
  fact that a post exists. Unmodified by this Arc.
- **Outbox intent** (`FedosBoardOutboxIntent`, Alpha 414) = the
  authoritative REQUEST to attempt delivery of a given post to a given
  protocol target. Immutable once created.
- **Delivery observation** (future, protocol-specific) = a historical,
  append-only fact about one delivery ATTEMPT. Never rewrites the
  intent.
- **Publisher** (future, per-protocol, out of scope this Arc) = the
  executor that reads an intent, attempts delivery, and produces
  observations.

No mutable delivery status field is added to `FedosBoardPost` by this
Arc, or by design, ever.

## 4. See also

- `docs/secure_runtime_alpha_411_existing_delivery_outbox_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_409_outbound_publish_readiness_review.md`
