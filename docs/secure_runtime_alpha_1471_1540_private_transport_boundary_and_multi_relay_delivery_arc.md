# Secure Runtime Alpha 1471–1540: Private Transport Boundary and Multi-Relay Delivery Arc

## Starting point

`master` (pre-arc HEAD `8b65609`, "Alpha 1051–1110: Conversation Runtime
Consolidation Arc") had a complete Private Delivery stack — Conversation
Membership, the Message Envelope model, and the Encryption Authority
(Direct-mode) — that could turn plaintext into ciphertext plus a
`payloadId`, and a complete Conversation Runtime that could construct and
read Conversation drafts. Nothing downstream ever sent that ciphertext
anywhere: no Conversation-scoped Outbox, no Publisher, no delivery
Observation vocabulary, no relay concept beyond the single-connection
`FedosRelay` the Board pipeline already used. The Board Outbox/
Publisher/Scheduler/Retry/Observation pipeline that DID exist was hard-
bound to public Board posts and one relay at a time.

This arc builds `FedosPrivateTransport` — the boundary that actually
moves an already-encrypted Conversation Envelope over one or more Nostr
relays — by reusing what could be reused verbatim, mirroring what could
only be mirrored (Board's types are `postId`/record-bound and this arc's
own instruction forbids redesigning them), and composing what already
exists (`FedosRelay`, `FedosNostrSigningAuthority`, Conversation
Membership, Conversation Runtime) without modifying any of it.

## What was reused verbatim (no new code, direct import)

- `FedosDeliveryObservation`/`FedosDeliveryObservationRepository`/
  `FedosDeliveryObservationQuery`/`FedosValidatingDeliveryObservationRepository`
  (`src/board/observation/*`) — already fully generic over an opaque
  branded `subjectId: string`. Mailbox Delivery and Ephemeral Delivery
  both write directly into this SAME vocabulary, keyed by the envelope's
  own id.
- `FedosDeliveryRetryRegistry`/`makeFedosDeliveryAttemptSubjectId`/
  `encodeFedosDeliveryRetryReason` (`src/board/observation/*`) — the
  exact "one fresh attempt-scoped subject id per publish attempt"
  machinery `FedosHostDeliveryController` already established for Board
  delivery, reused unchanged by the new Mailbox Scheduler.
- `FedosBoardOutboxPublishResult`/outcome/retryPolicy vocabulary and
  `isValidFedosBoardOutboxPublishResult` (`src/board/outbox/fedos_board_outbox_publisher.ts`)
  — imported directly as the Conversation Transport Publisher's own
  result type; no second, parallel vocabulary was invented.
- `FedosRelay`, `FedosEventDescriptor`, `FedosNostrWireEvent`,
  `FedosSubscriptionFilter`, `FedosSubscription`,
  `nostrWireEventToFedosEventDescriptor` — composed, never modified.
- `FedosNostrSigningAuthority.signEvent()`/`.publicIdentityForAccount()` —
  composed, never modified. `FedosConversationMembership`/
  `FedosConversationRuntime.listMemberships()` — composed, never
  modified.

## What was mirrored (new, parallel classes — Board's own classes stay untouched)

`src/conversation/transport/` mirrors `src/board/outbox/` and
`src/board/publish/nostr/`'s architecture — Outbox (delivery-intent
persistence), Publisher (send-side port), Scheduler (cadence/retry-
directive orchestration) — the same pattern the Conversation domain
already mirrors from the Board domain everywhere else in this
repository (Conversation Persistence mirrors Board Persistence,
Conversation Membership mirrors nothing Board has but follows the same
discipline, etc.). Board's own `FedosPublishScheduler`/
`FedosBoardOutboxPublisher`/`FedosBoardOutboxTypes` are byte-for-byte
unchanged.

## Design decisions

**Routing resolves the Alpha 890 "localAccountIndex/counterpartyPublicKeyHex"
blocker for Direct conversations.** `fedos_conversation_transport_routing.ts`
applies the exact verification idiom `FedosSigningAuthorityNostrAuthorBinding`
(`src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`,
Alpha 688) already established for Board Authors — compare
`signingAuthority.publicIdentityForAccount(accountIndex).publicKeyHex`
against a `FedosConversationParticipantReference.publicIdentifier` — to
Conversation Membership instead of Board Authorship. Scope is Direct-mode
only (exactly two `"active"` memberships); a group conversation fails
closed to `"not-direct"`. This is reuse of an established idiom, not a
new identity design, and it is intentionally narrow: it does not attempt
group-conversation routing.

**Wire packaging is constrained to `kind: 1`.**
`FedosNostrSigningAuthority.signEvent()`'s own request validator hard-
fixes `kind` to `1` (Alpha 424's own V1 policy) — no other kind is
structurally acceptable, and this arc does not touch that validator (no
new crypto, no new protocol surface). A private-transport event is
therefore `kind: 1`, distinguished from a public Board post purely by
tags: `["fedos-private","1"]` marks it as a private-transport event at
all, `["p", counterpartyPublicKeyHex]` names the intended recipient
(NIP-01 tag-naming convention reused as an idiom, not a NIP-04/NIP-17/
NIP-44 implementation), and `["e-envelope", envelopeId]` lets a receiver
correlate delivery before ever decrypting. `content` is the ciphertext,
base64-encoded — the same encoding-only boundary discipline
`fedos_conversation_payload_codec.ts` (Alpha 806) already established for
Conversation Payload bytes crossing a JSON-string wire boundary.

**Inbound Subscription has a named, real limitation.**
`FedosSubscriptionFilter` has exactly six fields (`ids/authors/kinds/
since/until/limit`) — there is no server-side tag filter (`#p`) anywhere
in this repository's Relay boundary, and this arc adds none (no new
crypto/protocol surface). Inbound Subscription therefore filters
server-side by `authors`/`kinds` only, and does the `#p`-equivalent
"is this addressed to me" check CLIENT-side, after
`FedosRelayEventMessage` arrives, via `parseFedosPrivateTransportEventDescriptor()`'s
own `recipientPublicKeyHex` comparison. This is a real, load-bearing
narrowing, not silently glossed over — a caller subscribing across many
counterparties receives more raw traffic than a `#p`-filtered relay
subscription would return, filtered down locally.

**Multiple Relay fan-out: "any relay accepts wins."**
`FedosMultiRelayOkCorrelatedConversationTransportPublisher` runs the
SAME per-relay `onRelayMessage` OK-correlation idiom
`FedosRelayOkCorrelatedNostrBoardPublisher` (Alpha 710/711/724) already
established, once per relay in the set, in parallel — ONE listener
registered per relay at construction time, never per `publish()` call
(a per-call registration would leak a permanently-live listener on every
relay across a long-running transport's lifetime, since `FedosRelay`
exposes no listener-removal method). Aggregation: `"delivered"` if ANY
relay's own correlation accepts; `"rejected"` only if EVERY relay
explicitly, terminally rejects (never retried again, mirroring Alpha
728's "a real rejection is never retried" precedent); otherwise
`"failed"`/`"later"` (any mix involving a timeout or transport failure).
This favors delivery redundancy over consensus — appropriate for a
fan-out whose whole purpose is resilience against any single relay being
unreachable.

**Relay Deduplication is a single shared gate, keyed by the Nostr event's
own deterministic id** (`fedos_relay_event_deduplicator.ts`) — a bounded,
FIFO-evicted `Set<string>`. Every relay in an Inbound Subscription's own
set funnels through the SAME deduplicator instance, so the caller's
envelope callback fires exactly once per genuinely-new event no matter
how many relays deliver it — the concrete case Multiple Relay fan-out
itself creates on the receiving side.

**Mailbox Delivery vs. Ephemeral Delivery is a durability/orchestration
split over the SAME Publisher/Observation ports, not two different
transports.** Mailbox Delivery goes through a durable
`FedosConversationTransportOutboxPersistence` + `FedosConversationTransportScheduler`
(tick/single-flight/retry-directive-application, mirroring
`FedosPublishScheduler`) — survives a restart, retried per the
Publisher's own `retryPolicy`. Ephemeral Delivery
(`fedos_conversation_ephemeral_transport.ts`) never writes an Outbox row
and never consults the Retry Registry — one publish attempt, one
`publishing → terminal` Observation pair, done. Both share the exact
same `FedosConversationTransportPublisher` (and therefore the same
Multi-Relay fan-out, the same signed-event resolution pipeline) — the
architectural difference is entirely in the ORCHESTRATION around it, not
a second parallel send path.

**`sendMailbox()`'s `createdAt` reuses the already-persisted Envelope's
own `createdAt`**, never a fresh clock read — mirroring
`FedosDesktopHost.submitPostWithOutbox()`'s (Alpha 419) identical
discipline, for the identical reason: a `Date.now()`-derived value would
make two `sendMailbox()` calls for the SAME envelope, milliseconds
apart, produce two structurally different records for the same
deterministic Outbox id — a `"conflict"`, not the intended idempotent
`"already-present"`.

## Explicit exclusions (verified, not just claimed)

No Tor, no onion routing, no ActivityPub, no AT Protocol, no new
cryptographic primitive (the Encryption/Decryption Authority and Master
Seed Authority are never modified — this arc only moves already-produced
ciphertext), no GUI, no `src/worker.ts` change. `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts`
enforces: exactly one `FedosPrivateTransport` construction site;
`privateTransport()` is a sibling accessor to `boardRuntime()`/
`conversationRuntime()`; no new production dependency (`package.json`'s
`dependencies` stays exactly `@noble/curves`/`@noble/hashes`); no new
build/start script; the wire-packaging event builder hard-fixes `kind`
to `1`; no import anywhere under the new module references a Tor/onion/
ActivityPub/AT-Protocol path; the Mailbox Scheduler imports the Retry
Registry/attempt-subject-id/retry-reason codec from the EXISTING
`board/observation` module rather than redefining them.

## Runtime wiring

`fedos_desktop_runtime_config.ts` adds an OPTIONAL `privateTransportEnabled`
field (kept optional, unlike `deliveryEnabled`, specifically so every
pre-existing caller that constructs a `FedosDesktopRuntimeConfig`
continues to compile unchanged — the same "no widened required-field
surface" discipline `outboxPersistence?`/`publisher?`, Alpha 419/502,
already established) plus the Relay/Signing Authority/log-path fields
Transport needs. `startFedosDesktopRuntime()` mirrors `deliveryEnabled`'s
own guard exactly: `privateTransportEnabled: true` without
`conversationTransportObservationLogPath`, without
`conversationTransportRelays`, or without
`conversationTransportSigningAuthority` throws synchronously before any
Persistence backend or Host is constructed — never a silent in-memory/
no-op fallback. `FedosRunningDesktopRuntime.privateTransport()` is a new
sibling accessor to `boardRuntime()`/`conversationRuntime()`, throwing
`"not enabled"` if never configured and `"inaccessible after stop()"`
once `stop()` has run (`stop()` tears the transport down first, before
Board delivery, before the Host itself — reverse of construction order).
This arc also wires the Conversation Message Envelope and Payload
Storage durable backends (Alpha 857/804) into the runtime for the first
time — no prior arc ever constructed them there.

## Verification

- `npm run typecheck` and `npm test`: zero new failures versus the
  pre-arc baseline (18 pre-existing failing test files / 29 failing
  tests, all `git status`-cleanliness checks unrelated to this arc — see
  `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`
  and the untracked `p2p/` directory / uncommitted `src/conversation/
  archive/` and `src/conversation/capability/persistence/*` files already
  present in the working tree before this arc began).
- 59 new tests across 8 files, including one full end-to-end test
  (`test/secure_runtime_alpha_1471_1540_end_to_end_verification.test.ts`)
  exercising two independent `FedosPrivateTransport` instances (sender +
  receiver) over two independent relay connections each, to two shared
  in-process relay servers: real Mailbox queueing, a real Scheduler
  `tick()`, real Multi-Relay fan-out publish + OK correlation on BOTH
  relays, a real canonical Observation record showing `"accepted"`, a
  real Inbound Subscription receiving the identical event from BOTH
  relays with Relay Deduplication firing the envelope callback EXACTLY
  ONCE, and the opaque payload bytes surviving the full
  sign → publish → OK-correlate → subscribe → dedup → parse →
  base64-decode pipeline byte-for-byte.
