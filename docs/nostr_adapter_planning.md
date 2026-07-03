# Nostr Adapter Planning (research/design docs only — no implementation)

**Status: docs only. This document adds NO relay connection, NO WebSocket,
NO signing, NO NIP-44/NIP-17, NO DM, NO publish/subscribe, and NO change
to `src/`, `packages/`, or `Cargo.toml`.** It fixes how a future real Nostr
adapter behind `FederationProvider` (Stage 110) would connect FedOS's
Board/Chat/Marketplace layers to the Nostr protocol — before any of it is
built.

---

## 1. Purpose

Design, in advance, how FedOS's Board (`src/social/board.ts`), Social
Event Model (`src/social/event.ts`), Chat (`src/chat/`), and Marketplace
(`src/marketplace/`) layers would connect to Nostr specifically, as the
first concrete protocol behind `FederationProvider`
(`docs/federation_boundary.md`). Fixing this now — before any relay code
exists — avoids conflating "how Nostr works" with "how FedOS models social
content", which `src/social/` was already built to keep separate (Stage
110).

---

## 2. Nostr's role, correctly scoped

- **Nostr is a publish/relay layer, not a moderation layer.** A NIP-09
  "delete" is a *request* relays may ignore; copies persist elsewhere (see
  `docs/deniable_storage_research.md` §7 for the same point made about
  storage). FedOS must not model Nostr interactions as if content can be
  reliably erased.
- **Correct mental model: visibility/filter/moderation, not deletion.**
  What FedOS controls is whether IT shows/hides/filters a piece of
  content in ITS OWN board/chat rendering — never whether the underlying
  Nostr event still exists somewhere.
- **Publish layer** — where a signed event is sent (a relay's `["EVENT",
  ...]` handling). Already scaffolded, unconnected to any of this, in
  `src/nostr/publish.ts`.
- **Relay layer** — the transport/network of relay servers themselves.
  FedOS does not operate relays; it is a client of them.
- **FedOS is the context/render/moderation/commerce layer on top.** Board
  grouping, thread rendering, moderation decisions, and any future
  marketplace/entitlement logic are FedOS's own responsibility — Nostr
  supplies raw public events; FedOS decides what they mean and how they're
  shown.

---

## 3. Compatibility posture: interoperate with existing Nostr clients

FedOS should aim for public posts, replies, and reactions to remain
visible and correctly interpreted by existing Nostr clients — Damus,
Primal, Amethyst — using the SAME public event kinds/tags those clients
already expect (NIP-01 kind 1 notes, standard `e`/`p` tags for
replies/reactions). This is a compatibility GOAL for future
implementation, not something built by this document:

- A FedOS "board thread" reply should still look like a normal reply to
  a Damus/Primal user, not a FedOS-proprietary shape they can't render.
- FedOS-specific concepts (a board id, a marketplace listing kind) that
  have no Nostr-native equivalent should degrade gracefully — e.g. as a
  normal note with FedOS-only tags other clients simply ignore, not as a
  malformed event other clients might reject or mis-render.

---

## 4. What FedOS-specific metadata may and may not ride on a Nostr event

- **PUBLIC metadata only.** A future event built from a
  `SocialEventDescriptor`/`BoardDescriptor`/`MarketplaceListingDescriptor`
  may carry public, non-sensitive labels (a board reference, a topic, a
  listing kind) as tags — the same class of information a Reddit
  crosspost flair or a forum category already is.
- **Private, gated, payment, and entitlement data must NEVER be placed on
  a Nostr event.** This includes: gated chat content, an
  `EntitlementDecision`, any `PaymentRequest`/`PaymentDecision` field, a
  buyer's identity tied to a purchase, or a `StoragePacket`'s metadata.
  See `docs/creator_monetization_flow.md` §10 for the monetization-specific
  version of this rule.
- Rationale: a Nostr event is permanently public and effectively
  undeletable in practice (§2) — anything that must stay private or
  access-controlled cannot depend on "nobody will look at this event".

---

## 5. Candidate event mappings (naming only, nothing built)

| FedOS concept | Nostr mapping candidate | Notes |
| --- | --- | --- |
| `post` (`SocialEventKind`) | kind 1 note | Standard NIP-01 text note |
| `reply` | kind 1 note + `e`/`p` tags | Standard reply convention (Damus/Primal-compatible) |
| Board thread (`BoardDescriptor`, kind `thread`) | kind 1 root note + replies, with a FedOS-only board-ref tag | Root note stays a normal note to other clients; the board tag is additive |
| Marketplace announcement (`MarketplaceListingDescriptor`) | kind 1 note (or a future NIP-99-style classified listing kind) | PUBLIC fields only — see §4; price/payment never included |
| Creator profile | kind 0 metadata | Standard NIP-01 profile event |
| Moderation signal | a FedOS-local decision, NOT necessarily a Nostr event | See §7 — moderation is FedOS's own visibility choice, not something that must be published |

This table names candidates for a FUTURE mapping function (e.g. a pure
`socialEventToNostrCandidate`-shaped helper) — none is implemented, and no
event kind number is finalized here.

---

## 6. What this document does NOT implement

- A real relay connection or WebSocket of any kind
- Event signing (NIP-01, or any encrypted variant)
- NIP-44 (versioned encrypted payloads)
- NIP-17 (gift-wrapped private DMs)
- Any DM of any kind
- `publish` (sending an event to a relay)
- `subscribe` (opening a live/filtered event stream)
- Any change to `FederationProvider`'s shipped shape (Stage 110) — this
  document plans a future adapter BEHIND that seam, it does not modify it

---

## 7. Moderation model (design intent, not implemented)

- **Hide/mute/filter, never claim deletion.** FedOS's own board/chat
  rendering can choose not to show an event — this is a LOCAL visibility
  decision, not a request that changes what exists on any relay.
- **Community visibility rules** — a future board/community could set its
  own filter policy (e.g. hide replies from a muted pubkey within that
  board) independent of any other board's rules.
- **Relay choice as a moderation lever** — which relays FedOS reads
  from/publishes to is itself a moderation-adjacent decision (a relay with
  its own moderation policy), tracked as a future design question, not
  decided here.

---

## 8. Cross-protocol future: Nostr is the first adapter, not the only one

`FederationProvider` (Stage 110) already names `bluesky_placeholder` and
`threads_placeholder` alongside `nostr_placeholder` for exactly this
reason: nothing in FedOS's Board/Social/Chat/Marketplace layers should
assume Nostr-only semantics. This document's mapping table (§5) is
Nostr-specific by necessity (protocols differ), but the SocialEventKind/
BoardKind vocabulary it maps FROM stays protocol-neutral on purpose (Stage
110) — a future Bluesky or Threads adapter would need its OWN mapping
table, not a reuse of Nostr's event-kind numbers.

---

## 9. Security / privacy rules for any future implementation

- **No private content in a public event.** Restated from §4: gated chat,
  gated marketplace content, or anything a user marked non-public must
  never be serialized into a Nostr event.
- **No payment state in a public event.** A payment id, amount, or status
  must never appear in event content or tags.
- **No entitlement leak.** Whether a specific pubkey has access to a
  specific gated resource must never be inferable from a public event —
  neither directly (an explicit tag) nor indirectly (e.g. a
  "purchased-by" reply thread).

---

## 10. Future implementation order (design intent, not scheduled)

1. A pure, unsigned mapping function: `SocialEventDescriptor` →
   Nostr-event-candidate shape (no relay, no signing) — the natural next
   boundary skeleton (see Stage 113 candidates).
2. A read-only fetch adapter behind `FederationProvider.fetchPlaceholder`
   for `nostr_placeholder`, still no WebSocket — likely an HTTP-based relay
   query or an injected client, mirroring how `EdgeRecPromotionProvider`
   isolates its `fetch` behind an injected client with a clamped timeout.
3. Real signing, via `CryptoProvider`/identity boundaries — never
   reimplemented inside the adapter (see `docs/federation_boundary.md` §7).
4. A real WebSocket publish path, reusing the ALREADY-scaffolded
   `src/nostr/publish.ts`/`src/nostr/ws_relay.ts` machinery rather than a
   new one.
5. NIP-44/NIP-17 DM support only after the above is stable, and only
   behind `ChatProvider` (`docs/chat_boundary.md`), never inline in the
   federation adapter.

---

## 11. Conclusion

- Nostr is treated as a publish/relay layer FedOS is a CLIENT of — not a
  moderation or deletion mechanism, and not the only protocol
  `FederationProvider` will ever speak.
- Compatibility with Damus/Primal/Amethyst for public posts/replies/
  reactions is a goal for the eventual real adapter.
- No relay connection, signing, encryption, publish, or subscribe exists
  after this document — it fixes the plan, not the implementation.

---

## 12. Stage 113 update note

§10 step 1's "pure, unsigned mapping function" is now shipped as a
SKELETON: `src/federation/nostr_mapping.ts`
(`socialEventToNostrCandidate`/`boardToNostrCandidate`/
`marketplaceListingToNostrCandidate`/`moderationSignalToNostrCandidate`)
and the `NostrEventCandidate`/`NostrEventCandidateKind`/
`NostrEventMappingDecision`/`ModerationSignalInput` types in
`src/federation/types.ts`. This realizes §5's candidate-mapping table as
actual (still unsigned, unconnected) code: `post`/`reply`/`repost`/
`reaction`/`profile`/`article`/`marketplace` (`SocialEventKind`) map to
`text_note_placeholder`/`reply_placeholder`/`text_note_placeholder`/
`reaction_placeholder`/`profile_placeholder`/`long_form_placeholder`/
`marketplace_announcement_placeholder` respectively; `chat` is REJECTED
unconditionally (§9's "no private content" rule applied concretely: chat/
DM activity can never become a public candidate, full stop, regardless of
its declared visibility); a `BoardDescriptor` maps to a root
`text_note_placeholder` candidate carrying its title and topic/category
labels as tags; a `MarketplaceListingDescriptor` maps to a
`marketplace_announcement_placeholder` candidate that structurally cannot
carry a price/payment/checkout/download field (the type has none); and a
new `ModerationSignalInput`/`ModerationAction` (`hide_placeholder`/
`mute_placeholder`/`filter_placeholder`) realizes §7's "hide/mute/filter,
never deletion" model as a `moderation_signal_placeholder` candidate. Only
`public` visibility (`SocialEventDescriptor`) / `public`/`unlisted`
(`MarketplaceListingDescriptor`) is ever candidate-ized; every other
visibility is rejected outright. No relay connection, WebSocket, `fetch`,
signing, private key, NIP-44/NIP-17, publish, or subscribe was added by
this stage; `NostrEventCandidate` still has no event id, signature, or
real pubkey field. See `README.md`'s Stage 113 entry and
`test/nostr_event_mapping.test.ts` for the full verification.

---

## 13. Stage 114+ update note

A read-only Board preview page (`src/render/board_preview.ts`, gated by
`?boardPreview=1`) now calls `boardToNostrCandidate` directly to display a
board's candidate `kindLabel` — this is the first real call site for the
Stage 113 mapping boundary, and it remains a PURE, unsigned call: no relay
is opened, nothing is published, and only the label is shown (never a real
event id/signature/pubkey). A new `BoardInteractionIntentDescriptor`
(`src/social/intent.ts`) also now exists for a future "user clicked
reply/react" flow, entirely separate from this document's event-mapping
concern — an intent is reviewed by `reviewBoardInteractionIntent`
(policy-only), never mapped to a Nostr candidate or sent anywhere.

---

## 14. Stage 115+ update note — moderation/visibility

§7's "hide/mute/filter, never deletion" model now has a COMMUNITY-POLICY-
layer counterpart, one level more general than this document's own
`ModerationSignalInput`/`moderationSignalToNostrCandidate` (§10 step 1's
Nostr-specific mapping): `src/community/moderation.ts` defines
`ModerationVisibilityDecision` (`visible_placeholder`/`hidden_placeholder`/
`muted_placeholder`/`filtered_placeholder`/`rejected`),
`CommunityModerationPolicyKind`, `CommunityModerationTargetKind`, and a
pure `reviewCommunityModerationTarget` that maps a requested
`hide_placeholder`/`mute_placeholder`/`filter_placeholder` action 1:1 to
its visibility label (or `rejected` for a policy-dirty request) — no
delete/remove/purge action exists on the type, by construction. This
boundary has NO Nostr dependency at all and does not call
`moderationSignalToNostrCandidate`; the two stay separate layers, exactly
as §2's "FedOS is the context/render/moderation layer on top" already
described. See `docs/community_moderation_policy.md` for the full
description, including a new read-only preview
(`src/render/community_rules_preview.ts`, gated by
`?communityRulesPreview=1`, added Stage 116) that displays sample rules'
hide/mute/filter effects.

---

## 15. Stage 116+ update note — publish intent

§10 step 1 named a "pure, unsigned mapping function" as the natural next
boundary skeleton; a step BEFORE that mapping now also exists:
`src/federation/publish_intent.ts` defines `PublishIntentDescriptor`
(`idRef?`/`actorRef?`/`targetRef?`/`kind`/`createdAt?`/`metadata?`, no
content/body/bytes field) with seven `PublishIntentKind` placeholders
(`post_`/`reply_`/`reaction_`/`marketplace_announcement_`/
`creator_profile_`/`moderation_signal_`/`test_placeholder` — deliberately
mirroring `NostrEventCandidateKind`'s vocabulary) and a pure
`reviewPublishIntent` that rejects sensitive metadata (including a
signing-specific family: `sig`/`signature`/`privkey`/`nsec`/`relay`, on top
of this codebase's usual conservative marker list). A publish intent is
STRICTLY EARLIER than a `NostrEventCandidate`: it names WHAT a caller wants
to eventually publish, before any mapping, signing, or relay send exists
for it — `reviewPublishIntent` never calls `socialEventToNostrCandidate` or
any other `./nostr_mapping.js` function, and nothing here signs, opens a
relay connection, or publishes/subscribes anything. §6's list of
NOT-implemented items (relay connection, signing, NIP-44/NIP-17, DM,
publish, subscribe) remains entirely unchanged by this addition.

---

## 16. Stage 117 update note — protocol adapter capability matrix

§8's "Nostr is the first adapter, not the only one" now has a fixed,
cross-protocol NAMING boundary: `src/federation/capability_matrix.ts`
defines `ProtocolAdapterKind` (mirroring `FederationProviderKind`'s six
labels) and `ProtocolAdapterCapability` (`read_public_`/`publish_public_`/
`reply_`/`reaction_`/`profile_`/`marketplace_announcement_`/
`moderation_signal_`/`private_message_`/`paid_content_`/`test_placeholder`),
with a pure `getProtocolAdapterCapabilities(adapter)` returning a FIXED row
of `ProtocolAdapterCapabilityDecision` (`allowed`/`state`/`reason?`) for
every capability, and `canProtocolAdapterSupport(adapter, capability)` for a
single lookup. `nostr_placeholder` marks the public-surface set — read/
publish/reply/reaction/profile/marketplace-announcement/moderation-signal —
`available_placeholder`, matching §3/§5's compatibility scope; per §4/§9,
`private_message_placeholder` and `paid_content_placeholder` are `rejected`
for `nostr_placeholder` STRUCTURALLY, never "not yet built" — a private
message or paid/gated content must never ride on a permanently public relay
event. `bluesky_placeholder`/`threads_placeholder`/`rss_placeholder` are
`unavailable` across every non-test capability: a placeholder matrix only,
naming no OAuth/API/adapter design this stage. A new read-only Creator
dashboard preview (`src/render/creator_dashboard_preview.ts`, gated by
`?creatorDashboardPreview=1`) calls `getProtocolAdapterCapabilities` to
display which capability labels a sample creator's federation summary would
show — a pure label lookup, opening no relay/HTTP/OAuth connection. No
adapter behind `FederationProvider` (Stage 110) was built, wired, or changed
by this addition; §6's NOT-implemented list is unchanged.
