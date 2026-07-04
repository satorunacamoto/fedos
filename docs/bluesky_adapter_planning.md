# Bluesky Adapter Planning (research/design docs only — no implementation)

**Status: docs only. This document adds NO AT Protocol session, NO OAuth
flow, NO `fetch`, NO WebSocket/firehose subscription, NO signing, NO
publish/subscribe, and NO change to `src/`, `packages/`, or `Cargo.toml`.**
It fixes how a future real Bluesky adapter behind `FederationProvider`
(Stage 110) would connect FedOS's Board/Chat/Marketplace layers to the AT
Protocol specifically, mirroring `docs/nostr_adapter_planning.md`'s
structure for a second protocol — before any of it is built.

---

## 1. Purpose

Nostr was the first protocol planned behind `FederationProvider`
(`docs/nostr_adapter_planning.md`). This document names the SAME kind of
mapping/compatibility questions for Bluesky specifically, so a future
adapter has a fixed plan to build against instead of improvising AT
Protocol-specific choices ad hoc.

---

## 2. Bluesky's role, correctly scoped

- **The AT Protocol is a repository + firehose model, not FedOS's board
  model.** Each account owns a Personal Data Repository (PDR) hosted by a
  Personal Data Server (PDS); a relay/firehose aggregates public writes
  across PDSes for consumers to index. FedOS would be a CONSUMER of that
  firehose (or a PDS's own API), never an operator of a PDS — identical to
  Nostr's relay-network posture: a client, not an infrastructure operator.
- **Correct mental model: repository records, not "posts on a timeline".**
  A Bluesky "post" is a record (`app.bsky.feed.post`) in the author's own
  repository — FedOS's Board/thread model would read/interpret these
  records, exactly as it already treats Nostr events as raw input it
  contextualizes (`docs/nostr_adapter_planning.md` §2).
- **FedOS remains the context/render/moderation/commerce layer on top** —
  identical framing to the Nostr document; nothing about this changes
  per-protocol.

---

## 3. Compatibility posture

FedOS should aim for public posts/replies/reactions to remain visible and
correctly interpreted by existing Bluesky clients (the official app,
third-party clients) — using the SAME public record types (`app.bsky.feed.post`,
`app.bsky.feed.like`, `app.bsky.feed.repost`) those clients already expect.
This is a compatibility GOAL for a future implementation, not something
built by this document. FedOS-specific concepts with no Bluesky-native
equivalent should degrade gracefully or simply not be published to Bluesky,
never as a malformed record other clients might reject.

---

## 4. What FedOS-specific metadata may and may not ride on a Bluesky record

Identical rule to `docs/nostr_adapter_planning.md` §4: PUBLIC, non-sensitive
labels only (a board reference, a topic) may ride on a future record as an
additive, ignorable field. Private, gated, payment, and entitlement data —
gated chat content, an `EntitlementDecision`, any `PaymentRequest`/
`PaymentDecision` field, a buyer's identity, a `StoragePacket`'s metadata —
must NEVER be placed on a Bluesky record. A PDS-hosted record is
effectively public and, per §2, the author's OWN host can remove it, but no
OTHER party's cached copy is guaranteed erased — the same "cannot rely on
disappearance" caution as Nostr, adjusted for AT Protocol's single-host
detail (see `docs/protocol_moderation_compatibility.md` §3).

---

## 5. Candidate record mappings (naming only, nothing built)

| FedOS concept | Bluesky mapping candidate | Notes |
| --- | --- | --- |
| `post` (`SocialEventKind`) | `app.bsky.feed.post` record | Standard public post record |
| `reply` | `app.bsky.feed.post` + `reply` ref | Standard reply convention |
| `reaction` | `app.bsky.feed.like` record | Standard like record |
| Board thread (`BoardDescriptor`) | root `app.bsky.feed.post` + replies, with an ADDITIVE FedOS-only board-ref facet/label | Root record stays a normal post to other clients |
| Marketplace announcement (`MarketplaceListingDescriptor`) | `app.bsky.feed.post` record (no dedicated commerce lexicon assumed) | PUBLIC fields only — price/payment never included |
| Creator profile | `app.bsky.actor.profile` record | Standard profile record |
| Moderation signal | a labeler-service LABEL candidate, NOT necessarily a record FedOS itself publishes | See `docs/protocol_moderation_compatibility.md` §3 |

No lexicon field, NSID, or record shape is finalized here — this table
names FUTURE candidates for a mapping function that does not exist yet
(mirroring `docs/nostr_adapter_planning.md` §5 / `src/federation/nostr_mapping.ts`'s
role for Nostr).

---

## 6. What this document does NOT implement

- Any AT Protocol session, OAuth flow, or PDS API call
- Any firehose subscription (real-time or otherwise)
- Any labeler-service client
- Record signing of any kind
- `publish` (writing a record to a repository) or `subscribe`
- Any change to `FederationProvider`'s shipped shape (Stage 110) or to
  `src/federation/capability_matrix.ts`'s `bluesky_placeholder` row (Stage
  117, still `unavailable` for every non-test capability)

---

## 7. Moderation model (design intent, not implemented)

See `docs/protocol_moderation_compatibility.md` §3 for the full comparison.
In short: Bluesky's labeler-service model is closer to FedOS's own
`filtered_placeholder` (label-driven, view-dependent exclusion) than to a
peer-to-peer mute list, and a PDS-hosted record CAN actually be removed by
its own host — but FedOS never claims a removal succeeded without
confirmation from a future adapter that does not exist yet.

---

## 8. Security / privacy rules for any future implementation

Identical posture to `docs/nostr_adapter_planning.md` §9: no private
content in a public record, no payment state in a public record, no
entitlement leak (direct or inferable) via any public record or label.

---

## 9. Future implementation order (design intent, not scheduled)

1. A pure, unsigned mapping function: `SocialEventDescriptor` → a Bluesky
   record-candidate shape (no PDS call, no signing) — mirroring
   `src/federation/nostr_mapping.ts`'s role for Nostr.
2. A read-only fetch adapter behind `FederationProvider.fetchPlaceholder`
   for `bluesky_placeholder`, reading a public firehose/PDS endpoint —
   still no OAuth, still no write path.
3. Real OAuth/session handling, via identity boundaries — never
   reimplemented inside the adapter.
4. A real write path (creating a repository record), reusing whatever
   signing/session machinery step 3 established.
5. Labeler-service read integration, only after the above is stable.

---

## 10. Conclusion

- Bluesky is treated as a repository + firehose protocol FedOS is a CLIENT
  of — not a moderation/deletion mechanism, and not the only protocol
  `FederationProvider` will ever speak.
- Compatibility with existing Bluesky clients for public posts/replies/
  reactions is a goal for the eventual real adapter.
- No AT Protocol session, OAuth, signing, publish, or subscribe exists
  after this document — it fixes the plan, not the implementation.
