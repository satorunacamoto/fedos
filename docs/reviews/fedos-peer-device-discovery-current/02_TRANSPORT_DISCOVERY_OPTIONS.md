# Transport/Signing/Observation Infrastructure for a Future Cross-Account Peer-Device-Announcement Protocol

Agent P — Phase A (read-only). Worktree `C:\wt\fedos-installed-startup-root-cause`
(branch `arc/fedos-installed-startup-root-cause`). No source file under `src/` or
`packages/` was modified.

All citations are exact `file:line` against this worktree as checked out.

---

## 1. What real transport(s) exist today, exactly

Two genuinely different, non-interoperating "publish a signed fact via Nostr relay"
mechanisms exist in this checkout. They must not be conflated.

### 1a. `FedosPrivateTransport` / NIP-17 Gift Wrap — the real, current, cross-account transport

- `src/os/messenger/adapters/nostr/transport/fedos_private_transport.ts` — the class.
  `sendMailboxNip17Control()` (`fedos_private_transport.ts:381-433`) is the exact seam
  `peer_capability`, `invitation_bootstrap`, `identity_transition/peer_integration`, and
  `deletion_request` all reuse verbatim.
- Wire format: real NIP-59 Gift Wrap (`kind:1059`) wrapping a NIP-59 Seal wrapping a
  NIP-17 Rumor, built via `NostrNip17V1WireAdapter` —
  `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip59_gift_wrap.ts:1-46`
  confirms `FEDOS_GIFT_WRAP_KIND` = 1059 per `docs/normative/nostr-protocol-nips/59.md`,
  a fresh single-use ephemeral signing key for the outer Gift Wrap layer, NIP-44 encryption
  at each layer.
- Signing scheme: account-level = real BIP-340 Schnorr via `FedosNostrSigningAuthority`
  (Seal layer, signed by the real sender); Gift Wrap outer layer signed by a fresh
  ephemeral key (`fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`) — this is
  intentional NIP-59 metadata protection, not a trust boundary.
- **Hard-bound to an existing Direct Conversation with exactly two `"active"`
  memberships.** `resolveFedosConversationTransportRoute()` —
  `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_routing.ts:55-83`
  — filters `request.memberships` to `state === "active"` (line 63); anything other than
  exactly 2 active memberships fails closed to `"not-direct"` (line 65). Group conversations
  are explicitly rejected (file header, line 20-21). `sendMailboxNip17Control()` calls this
  routing resolver every time (`fedos_private_transport.ts:396-405`) and fails closed to
  `"unauthorized"` on `"not-direct"`.
- Durable, retried, Outbox-backed: `putIntent()` writes to
  `FedosConversationTransportOutboxPersistence` (`fedos_private_transport.ts:429`), and the
  existing `FedosConversationTransportScheduler` (constructed once,
  `fedos_private_transport.ts:225-234`) retries/tracks delivery/abandonment across restart —
  restart hydration is real: `hydrateFedosConversationTransportDeliveryRecoveryState()`
  (`fedos_private_transport.ts:223`, comment at 212-221) rebuilds terminal delivery state
  from the already-durable Delivery Observation history before the Scheduler is even
  constructed, so a restart does not re-treat delivered intents as pending.
- Offline/reconnect on the RECEIVE side: `FedosConversationInboundSubscription`
  (`src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_inbound_subscription.ts:1-45`)
  opens a `FedosSubscriptionFilter` (real NIP-01 `ids/authors/kinds/since/until/limit`,
  line 8-9) on every relay — because `kind:1059` Gift Wraps are ordinary, relay-stored
  events (the file's own header at `fedos_nip59_gift_wrap.ts:10-15` states this explicitly:
  "mailbox delivery, the SAME durable-delivery model `FedosPrivateTransport`'s own existing
  Mailbox/Outbox already assumes"), a device that reconnects after being offline can
  re-subscribe with a `since` filter and receive Gift Wraps a relay stored while it was
  offline. This is genuine "publish while I was offline, receive on reconnect" — but it is
  the SAME conversation-scoped Direct transport as everything else in 1a, not a separate
  sync system.
- **Test double, not a real transport:** `NullRelay`
  (`src/os/messenger/desktop/null_relay.ts:132-197`) is explicitly documented (file header,
  lines 1-121) as dependency-free, in-memory-only bookkeeping with NO networking of any
  kind. `WebSocketRelay` (`src/os/messenger/desktop/websocket_relay.ts`) is the real
  networked implementation. Do not mistake `NullRelay` for "the transport."

### 1b. `FedosDeviceRelaySync` — a SEPARATE, same-account-only, non-NIP-17 mechanism

- `src/os/messenger/device/relay_sync/fedos_device_relay_sync_event.ts:1-51` states this
  explicitly in its own header: **"this checkout has no NIP-17 code at all — see this Arc's
  own Phase A report"** (Arc 3641-3720) and explains NIP-17 Gift Wrap was evaluated and
  REJECTED for that reason at that point in the codebase's history (Option A, lines 20-23).
  It also explicitly rejected reusing `FedosPrivateTransport` wholesale (Option B, lines
  24-30) because that routing is "hard-bound to Direct-mode Conversation membership... a
  structural mismatch for Device Sync, which pairs two DEVICES of one account, never a
  Conversation."
- Wire format instead: a proprietary `kind:1` event, marker tag
  `["fedos-device-sync","1"]`, `["p", accountPublicIdentifier]` (self-addressed — same
  account, not a counterparty), `["d-session", transferSessionId]`, content = plaintext
  JSON of `FedosDeviceRelaySyncWirePayloadV1` with one opaque ciphertext field
  (`encryptedPackageBase64`) — `fedos_device_relay_sync_event.ts:77-86`.
- Signing: real BIP-340 Schnorr via the SAME `FedosNostrSigningAuthority.signEvent()`
  (unwidened, `kind:1` only), verified via the SAME `NobleSignatureVerifier` —
  `src/os/messenger/device/relay_sync/fedos_device_relay_sync_inbound_handler.ts:128`.
- This checkout (the one under investigation) DOES now have real NIP-17 code (confirmed —
  `src/os/messenger/adapters/nostr/conversation_delivery/nip17/` contains
  `fedos_nip59_gift_wrap.ts`, `fedos_nip59_seal.ts`, `fedos_nip17_rumor.ts`,
  `fedos_nostr_nip17_v1_wire_adapter.ts`, `fedos_nip17_inbound_import_coordinator.ts`), so
  the `relay_sync` Arc's stated rationale (NIP-17 absent) no longer holds in THIS checkout —
  `relay_sync` predates the NIP-17 merge into this lineage and was never revisited. It
  remains genuinely useful precedent for offline-target delivery (24h TTL, dedup), but it is
  legacy-shaped relative to what now exists, and it is **scoped to one account's own
  devices**, never a counterparty account (`["p", accountPublicIdentifier]` — self, not
  counterparty; `fedos_device_relay_sync_event.ts:34-40` says this explicitly).

**Bottom line for Q1:** the one real cross-account transport in this checkout is NIP-17
Gift Wrap over `FedosPrivateTransport`, hard-bound to an already-established Direct
Conversation (exactly 2 active memberships). `relay_sync` is real, durable, offline-capable,
account-scoped-only, and structurally cannot address a different account without redesign
(it addresses `["p", accountPublicIdentifier]` = self).

---

## 2. Is peer_capability's request/response-shaped wire format safely reusable for a durable/long-lived announcement?

**No — not as-is. A real design gap exists.** Concretely:

- Every peer_capability record (`FedosRatchetPeerCapabilityAdvertisementV1`,
  `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.ts:62-67`,
  and `FedosRatchetPeerLifecycleNotificationV1`) carries a **mandatory, short-TTL
  `expiresAt`** validated to be strictly `> issuedAt`
  (`fedos_ratchet_peer_capability_advertisement.ts:148`, "must expire" is enforced
  structurally, not optional) plus a monotonic per-subject `revision` counter. This is
  freshness-of-a-live-claim semantics ("here is my capability set as of now, valid until
  X"), not a durable/long-lived announcement's semantics ("this fact remains true until
  explicitly superseded/revoked").
- The acceptance policy —
  `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts:83`
  — hard-rejects (`"expired"`) once `now > expiresAt`. A cross-account discovery
  announcement that a device wants durably queryable weeks/months later (e.g. "this is my
  current device set") would silently expire and need re-publication indefinitely, which is
  a request/response renewal shape, not an announcement shape.
- **The record is explicitly recipient-bound, not broadcast/discoverable-by-anyone**:
  `recipientAccountRef`/`recipientDeviceRef` are mandatory fields checked for exact match
  on import (`fedos_ratchet_peer_capability_inbound_coordinator.ts:157-158`); an
  announcement meant to be discoverable by an account that has never established a Direct
  Conversation with the sender cannot use this shape at all, because the transport itself
  (`resolveFedosConversationTransportRoute()`, see Q1) requires 2 pre-existing active
  memberships to send it.
- **Acceptance is gated on pre-existing Device trust**, which is circular for a discovery
  protocol: `evaluateFedosRatchetPeerCapabilityAcceptance()`
  (`fedos_ratchet_peer_capability_acceptance_policy.ts:81-82`) returns `"untrusted-device"`
  unless `peerDeviceTrustState === "trusted"`. A genuinely new/unknown peer Device
  (the exact case a discovery protocol exists to handle) is recorded as an observation but
  with acceptance outcome `"untrusted-device"`, never `"accepted"` — the observation is
  logged, not "trusted"/actionable. Reusing this policy verbatim for discovery would either
  silently no-op on first contact, or require a separate bootstrap trust mechanism that does
  not exist here.
- **`FedosConversationInvitationOutboundCoordinator`
  (`src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.ts:91-179`)
  is the one existing precedent for breaking the 2-active-membership circularity**: it
  locally admits BOTH the inviter (`"owner"`) and invitee (`"member"`) memberships
  (`fedos_conversation_invitation_outbound_coordinator.ts:136-139`) BEFORE ever sending,
  purely as local bookkeeping ("never shared, never implying the invitee has agreed to
  anything," line 12-14), which is what makes `resolveFedosConversationTransportRoute()`
  accept the send. This is the reusable trick a discovery protocol would need: to publish a
  signed fact to an account with no prior conversation, you must first fabricate a local
  Direct-mode membership pair to unlock the transport — the transport itself has no
  "publish to an arbitrary pubkey with no conversation" primitive. Even the invitation
  record, though, carries the same mandatory `expiresAt`/nonce request-shaped fields (7-day
  default TTL, `fedos_conversation_invitation_outbound_coordinator.ts:56,160`) — it is not a
  durable-announcement template either, just the closest existing "cold-start send" trick.
- **`FedosBoardPost`
  (`src/os/messenger/board/fedos_board_post.ts:41-54`) is the actual durable-standing-fact
  template that exists in this codebase**: no `expiresAt`, no `revision`, no nonce, no
  recipient — an immutable, permanently-valid, publicly signed record (file header,
  lines 21-24: "Every field is `readonly`; this type carries no mutation method"). It is
  public/broadcast rather than recipient-scoped, and it has no acceptance/trust policy of
  its own (that's a different layer), but its SHAPE — durable, unexpiring, superseded only
  by an explicit later post — is the correct template for an "announcement," not
  peer_capability's advertisement shape.

**Concrete gap statement:** a peer-device-announcement protocol needs (a) no mandatory
expiry, or a much longer default with an explicit, separate "supersede/revoke" mechanism
(peer_capability's own `supersedesNotificationId` field on lifecycle notifications,
`fedos_ratchet_peer_capability_outbound_coordinator.ts:86`, is the right shape for
"supersede" — that part IS reusable), (b) a way to publish to an account with no
pre-existing Direct Conversation (today only achievable via the invitation coordinator's
"fabricate local membership first" trick, itself carrying its own 7-day-expiry request
shape), and (c) an acceptance/trust model that doesn't hard-reject first contact from an
unknown Device as `"untrusted-device"`.

---

## 3. Exact replay/duplicate/reorder handling that already exists and is reusable vs. what's missing

**Nonce generation** —
`src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.ts:12-14`
— `generateFedosRatchetPeerCapabilityNonce()` returns 16 bytes (128-bit) CSPRNG, hex-encoded,
via `@noble/hashes`. Well-formedness check is a fixed 32-hex-char pattern
(`FEDOS_RATCHET_PEER_CAPABILITY_NONCE_HEX_PATTERN`, line 16). This is directly reusable
as-is for any new record type; it has no coupling to peer_capability's own schema.

**Layered dedup/replay handling actually implemented (inbound coordinator):**
1. Exact-nonce/sourceId replay short-circuit, run BEFORE acceptance re-evaluation —
   `#existingObservationForSource()`
   (`fedos_ratchet_peer_capability_inbound_coordinator.ts:146-154`, applied at lines 179-181
   for advertisements and 259-261 for notifications): a resubmission of the identical
   `sourceId` for the identical subject is always `"duplicate"`, never re-decided. The
   comment at lines 134-145 explains exactly why this must run first: without it, replaying
   the same fact a second time would see its own prior acceptance as `priorAccepted` and get
   re-evaluated as `"stale"`, producing a spurious conflicting write for an identical fact.
2. Conflicting-duplicate-at-same-revision detection — `#hasConflictingDuplicateAtSameRevision()`
   (lines 123-132): a DIFFERENT `sourceId` claiming the SAME `revision` for the SAME subject
   is flagged `"conflicting"` by the acceptance policy
   (`fedos_ratchet_peer_capability_acceptance_policy.ts:84`).
3. Staleness/reorder — `priorAccepted.revision >= incoming.revision` →
   `"stale"` (`fedos_ratchet_peer_capability_acceptance_policy.ts:85`). Advertisement and
   lifecycle-notification revisions are explicitly INDEPENDENT counters, scoped by
   `sourceKind` (comment,
   `fedos_ratchet_peer_capability_inbound_coordinator.ts:100-107` — mixing them would let an
   unrelated notification's revision spuriously satisfy/fail an advertisement's own
   ordering check).
4. Persistence-level idempotency as a final backstop —
   `AppendOnlyFedosRatchetPeerCapabilityObservationPersistence.putObservation()`
   (`src/os/messenger/conversations/ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.ts:71-83`)
   returns `"already-present"` for a structurally-identical duplicate key and `"conflict"`
   for a same-key-different-content write, keyed by
   `fedosRatchetPeerCapabilityObservationKey()` = `(localDeviceRef, peerAccountRef,
   peerDeviceRef, sourceKind, sourceId)`
   (`src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts:73-83`).
   A corrupt or irreconcilable log line throws unconditionally on replay (fail-closed on
   corruption, file header lines 6-11 and `replayLog()` at
   `append_only_fedos_ratchet_peer_capability_observation_persistence.ts:43-61`).

**Downgrade detection** (a genuinely separate concern from replay, but co-located in the
same acceptance policy): `isRouteDowngrade()`
(`fedos_ratchet_peer_capability_acceptance_policy.ts:62-69`) rejects a fresh, validly-signed,
non-replayed advertisement if it silently drops a previously-claimed stronger route
(`"nostr-nip17-v1-ratchet"`) — `"downgrade-detected"` is a distinct terminal outcome, never
confusable with acceptance (comment, lines 9-14).

**What's reusable as-is:** the nonce generator; the "exact-sourceId short-circuit before
re-evaluating acceptance" pattern; the append-only "already-present vs conflict" persistence
idempotency discipline; the per-`sourceKind`-independent revision counters idea.

**What's missing for a durable announcement (not present anywhere in this precedent):**
- No cross-relay outer-event-id dedup layer here (unlike `relay_sync`'s two-layer dedup —
  `relayEventId` primary key PLUS `transferSessionId`+`packageContentHash` secondary key,
  `src/os/messenger/device/relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts:5-23`).
  peer_capability's inbound coordinator dedups only on its OWN payload-level `sourceId`, not
  on the outer Gift-Wrap/Rumor envelope id — it explicitly documents this as a disclosed,
  deferred simplification, not a silent gap:
  `fedos_ratchet_peer_capability_inbound_coordinator.ts:18-27` ("this coordinator does not
  itself dedup on the Rumor's own envelope id before processing... deferred, not silently
  skipped... still safe, merely not free" — i.e. a duplicate redelivery still re-verifies
  the signature every time before landing on the same idempotent `"duplicate"` outcome).
- No monotonic-revision-free "long-lived, only superseded by explicit action" replay model
  exists anywhere for a NON-expiring fact — every replay-safe pattern in this codebase
  (peer_capability, session-reset, relay_sync) assumes either a `revision` counter or a
  bounded TTL as its anti-replay backstop. A durable announcement with no expiry needs its
  own explicit "supersede" event (which peer_capability's `supersedesNotificationId` shape
  demonstrates is buildable, but nothing here builds it for an unbounded-lifetime fact).

---

## 4. Confirm/refute: "the transport/relay is never itself an authority, only a delivery mechanism"

**Confirmed — holds throughout everything inspected.**

- Inbound coordinator: acceptance is decided ONLY after
  `verifyFedosRatchetPeerCapabilityAccountAuthorization()`
  (`fedos_ratchet_peer_capability_inbound_coordinator.ts:161-164`) succeeds — real BIP-340
  Schnorr verification via `NobleSignatureVerifier.verify(event)`
  (`fedos_ratchet_peer_capability_authentication.ts:118`), with the canonical content
  re-derived by the RECEIVER from the record's own fields and compared byte-for-byte against
  `event.content` (`fedos_ratchet_peer_capability_authentication.ts:115`) — never trusting
  the sender's claimed content. `accountPublicKeyHex` is populated ONLY on `"valid"`
  (`fedos_ratchet_peer_capability_authentication.ts:90-91,120`), and the caller compares it
  against the claimed `senderAccountRef.publicIdentifier`
  (`fedos_ratchet_peer_capability_inbound_coordinator.ts:162`) — the account identity is
  read from the cryptographically-verified signer, never from an unverified field.
- `relay_sync` inbound handler is explicit about the SAME discipline, and additionally
  explicit that relay acceptance means nothing: "Relay ACK means Relay acceptance only"
  (`fedos_device_relay_sync_outbound_coordinator.ts:19`), and the inbound handler's own
  header states "Does NOT import merely because the outer Nostr event was well-formed or
  relay-accepted... every one of the checks above must independently pass first"
  (`fedos_device_relay_sync_inbound_handler.ts:26-28`), backed by a real signature check at
  `fedos_device_relay_sync_inbound_handler.ts:124-131` gating everything that follows.
- Outbound side never conflates relay ACK with peer acceptance either: the peer_capability
  outbound coordinator's own header states this explicitly — "Relay ACK (`"delivered"`) is
  surfaced as its own outcome, never conflated with peer acceptance — this coordinator has
  no way to know whether the peer ever imports, verifies, or accepts what it publishes"
  (`fedos_ratchet_peer_capability_outbound_coordinator.ts:15-17`), and
  `relay_sync`'s outbound coordinator returns `relayOutcomes` as a field kept structurally
  SEPARATE from the local/session outcome (`fedos_device_relay_sync_outbound_coordinator.ts:65-68`,
  "kept SEPARATE... Phase D's own explicit instruction").
- `NullRelay` cannot masquerade as a trust source even accidentally — it performs no
  cryptographic operation of any kind, purely in-memory bookkeeping
  (`null_relay.ts` header, full file).

No counter-example found anywhere in the files inspected: no code path treats "relay
accepted the publish" or "an event arrived from a relay" as sufficient for trust; the
account-level Schnorr signature verified against receiver-reconstructed canonical content is
the actual, sole gate in every mechanism examined.

---

## 5. Offline/reconnect: does any existing sync mechanism already solve "receive something published while I was offline"?

Yes, in two structurally different ways, both already covered above — restated here
answering the account-scope question directly:

- **`relay_sync`** (`src/os/messenger/device/relay_sync/`) is the mechanism explicitly built
  and named for this ("a genuinely offline target Device," comment,
  `fedos_device_relay_sync_outbound_coordinator.ts:50`): 24-hour default TTL
  (`DEFAULT_TTL_SECONDS`, same line), publish-once/durable-Outbox-cached-package
  (`fedos_device_relay_sync_outbound_coordinator.ts:137-146`, "no duplicate package
  construction for the same transfer/session revision"), two-layer inbound dedup surviving
  restart (`fedos_device_relay_sync_inbound_dedup_persistence.ts`, both layers backed by
  `append_only_fedos_device_relay_sync_inbound_dedup_persistence.ts`). **This is
  account-scoped only** — `["p", accountPublicIdentifier]` self-addresses the SAME account
  (`fedos_device_relay_sync_event.ts:34-40`), and both source and target Device bindings are
  independently required to belong to the SAME `accountRef`
  (`fedos_device_relay_sync_outbound_coordinator.ts:118,125-126`;
  `fedos_device_relay_sync_inbound_handler.ts:140-145`). It would NOT generalize to
  cross-account discovery without redesigning the addressing (currently self-addressed) and
  the trust checks (currently same-account-binding checks) — it is architecturally a
  same-account mechanism, not merely configured that way.
- **NIP-17 Gift Wrap mailbox delivery** (see Q1a) already generalizes to cross-account,
  because relays durably store `kind:1059` events and a reconnecting subscriber re-queries
  with a `since` filter (`FedosSubscriptionFilter`,
  `fedos_conversation_inbound_subscription.ts:8-9`) — this is the SAME mechanism ordinary
  Direct Conversation messages, peer_capability advertisements, invitations, and lifecycle
  notifications all already ride, so "offline, then reconnect and receive" is already solved
  for any cross-account Direct-Conversation-scoped fact today. The limitation is not
  offline-delivery — it's the prerequisite (2 active Direct-Conversation memberships) needed
  to address the recipient at all (see Q2).

**Neither existing mechanism solves "receive a published fact from an account you have never
had a conversation with, while offline"** — `relay_sync` cannot address a different account
at all, and the NIP-17 mailbox path requires the sender to first fabricate local Direct
Conversation membership (the invitation-coordinator trick) before it can publish to that
recipient in the first place. That combination (fabricate local membership + long-TTL/no-TTL
signed fact + NIP-17 mailbox durability) is close to a workable design for a
peer-device-announcement protocol, but no existing code assembles those three pieces
together — it would be new integration work, not a wiring change.

---

## Summary table

| Property | peer_capability advertisement/notification | relay_sync (device transfer) | NIP-17 mailbox (general) | Board post |
|---|---|---|---|---|
| Cross-account capable | Yes (needs pre-existing Direct Conversation) | No — same account only | Yes (needs pre-existing Direct Conversation) | Yes (public, no recipient) |
| Signing | Real Schnorr, account + optional best-effort Device | Real Schnorr, account only | Real Schnorr (Seal layer) | Real Schnorr (assumed via Nostr adapter, not reviewed here) |
| Expiry | Mandatory, short (structurally enforced `expiresAt > issuedAt`) | 24h default TTL | N/A (envelope-level, not fact-level) | None — immutable, no expiry field at all |
| Replay/dedup | sourceId short-circuit + revision ordering + append-only key idempotency | 2-layer (relay-event-id + session+hash) | Relay-level event id dedup (`FedosRelayEventDeduplicator`) | Not reviewed in this pass |
| Offline reconnect | Rides NIP-17 mailbox (yes, once conversation exists) | Yes, dedicated (same-account only) | Yes, dedicated | N/A (public feed, different model) |
| Relay ever authoritative | No — signature is the gate | No — explicitly documented | No | Not reviewed, but same signing authority used elsewhere |
| Shape fit for a durable announcement | Poor (request/response freshness semantics) | Poor (same-account, session-scoped) | Neutral (just a pipe) | **Best shape available** (durable, no expiry) but public-broadcast, not recipient-scoped |

## Gaps, stated honestly

1. No existing mechanism publishes a durable, non-expiring, cross-account-recipient-scoped
   signed fact. The closest shape (Board Post) is public/broadcast, not recipient-addressed;
   the closest recipient-addressed mechanism (peer_capability) is expiry-bound and
   trust-circular for first contact.
2. Sending to an account/Device with no pre-existing Direct Conversation requires the
   invitation coordinator's "fabricate local membership before sending" trick — this is a
   real, working precedent, but it is not documented anywhere as a general-purpose "cold
   send" primitive; a future protocol would need to consciously decide whether to reuse it
   or build a first-class cold-send capability.
3. peer_capability's acceptance policy structurally cannot say "accepted" for a genuinely
   unknown Device (`"untrusted-device"` outcome) — a discovery protocol's entire point is
   handling unknown Devices, so this policy is not reusable unmodified; only its
   replay/nonce/idempotency machinery is.
4. relay_sync's two-layer dedup (outer event id + content hash) is a better replay/redelivery
   pattern than peer_capability's own (which is explicitly disclosed as not deduping on the
   outer envelope id yet) — a new protocol should borrow relay_sync's dedup shape, not
   peer_capability's, even though peer_capability is the closer cross-account precedent.
