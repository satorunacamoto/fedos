# RSS Adapter Planning (research/design docs only — no implementation)

**Status: docs only. This document adds NO `fetch`, NO HTTP request, NO
feed parser, NO subscribe, and NO change to `src/`, `packages/`, or
`Cargo.toml`.** It fixes how a future real RSS adapter behind
`FederationProvider` (Stage 110) would connect FedOS's Board layer to
RSS/Atom feeds specifically — before any of it is built.

---

## 1. Purpose

Name the RSS-specific version of the same mapping questions already fixed
for Nostr, Bluesky, and Threads, completing the four-protocol planning set
`FederationProviderKind`/`ProtocolAdapterKind` already name.

---

## 2. RSS's role, correctly scoped

- **RSS/Atom is a one-way, unauthenticated READ format, not a social
  protocol.** There are no accounts, no replies, no reactions, no DMs, and
  no publish path FedOS could ever originate — a feed is a static or
  periodically-updated document a client polls.
- **FedOS would be exclusively a CONSUMER**, never a publisher, of any RSS
  feed — this is the only one of the four protocols with no write
  direction to even plan for.
- **FedOS remains the context/render layer** for whatever a feed's items
  are interpreted as — a feed item maps, at most, to a read-only
  `SocialEventKind: "post"`-shaped candidate; nothing about replies,
  reactions, profiles, or moderation exists in the format itself.

---

## 3. Compatibility posture

There is no "client compatibility" question for RSS in the sense §3 of the
Nostr/Bluesky documents describes — a feed is either well-formed XML a
parser can read, or it is not. The only compatibility goal is READING
standard RSS 2.0/Atom 1.0 feeds correctly; FedOS does not produce feeds
under this plan, so there is no "would this look normal to another RSS
reader" question to answer.

---

## 4. What FedOS-specific metadata may and may not ride on an RSS item

This section is structurally simpler than the other three documents: since
FedOS never WRITES an RSS item under this plan, there is no FedOS-specific
metadata to place on one at all. The only data flow is feed → FedOS; the
private/payment/entitlement exclusion rules from the other three documents
apply symmetrically in the other direction — nothing gated, paid, or
private should ever be exposed to a public feed URL a future adapter
fetches (the URL itself, and whatever a feed publishes, are both outside
FedOS's control once public).

---

## 5. Candidate mappings (naming only, nothing built)

| FedOS concept | RSS/Atom mapping candidate | Notes |
| --- | --- | --- |
| `post` (`SocialEventKind`) | one `<item>`/`<entry>` element | Title/link/summary only — READ direction only |
| `reply` | NOT modeled — RSS has no reply concept | Structurally absent from the format |
| `reaction` | NOT modeled — RSS has no reaction concept | Structurally absent from the format |
| Board thread (`BoardDescriptor`) | a whole FEED could map to a read-only board-like list of items | No thread/reply grouping — a flat list only |
| Marketplace announcement | NOT modeled | Out of scope for a syndication format |
| Creator profile | feed-level `<title>`/`<description>`/`<link>` only | Coarse, feed-level metadata only, never a per-post identity |
| Moderation signal | NOT modeled — see §6 | RSS has no moderation primitive of any kind |

---

## 6. What this document does NOT implement

- Any `fetch`/HTTP request to any feed URL
- Any feed parser (XML/RSS/Atom) of any kind
- Any polling schedule or cache of fetched items
- Any write/publish path (RSS has none to build toward)
- Any change to `FederationProvider`'s shipped shape (Stage 110) or to
  `src/federation/capability_matrix.ts`'s `rss_placeholder` row (Stage 117,
  still `unavailable` for every non-test capability)

---

## 7. Moderation model (design intent, not implemented)

See `docs/protocol_moderation_compatibility.md` §5: RSS has no moderation
primitive at all. Whether a given feed is included in FedOS's own read list
is entirely FedOS's own local, `filtered_placeholder`-shaped choice — never
a protocol-native moderation action, because RSS defines none.

---

## 8. Security / privacy rules for any future implementation

- **Treat every feed URL as untrusted input.** A future fetch adapter must
  validate/allowlist feed URLs the same conservative way `RELAY_ALLOWLIST`
  already gates relay URLs (`src/worker.ts`) — this document does not
  implement that allowlist, only names the requirement.
- **No credential of any kind rides on a feed fetch.** Public RSS feeds are
  unauthenticated by design; a future adapter must never attach a
  cookie/token/API key to a feed request that would turn an anonymous read
  into an identifiable one.
- **No private FedOS data is ever exposed via a feed FedOS might someday
  publish** — restated from §4, even though no publish path exists in this
  plan.

---

## 9. Future implementation order (design intent, not scheduled)

1. A pure, unsigned mapping function: a parsed feed item → a read-only
   `SocialEventCandidate`-shaped structure — no fetch, no parser yet.
2. A URL allowlist/validation policy, mirroring `RELAY_ALLOWLIST`'s
   conservative posture.
3. A minimal, injected-client-based fetch adapter behind
   `FederationProvider.fetchPlaceholder` for `rss_placeholder` — reusing
   the same "injected client with a clamped timeout" posture already used
   for `EdgeRecPromotionProvider`'s `fetch` isolation
   (`docs/nostr_adapter_planning.md` §10 step 2 names the same pattern for
   Nostr).
4. A feed parser, chosen and reviewed separately from this plan.
5. A polling/refresh policy — RSS has no push mechanism, so this is a
   FedOS-side scheduling decision, not a protocol requirement.

---

## 10. Conclusion

- RSS is treated as a one-way, unauthenticated, READ-ONLY syndication
  format — the simplest and most constrained of the four protocols this
  codebase names, with no reply/reaction/moderation/write concept to plan
  for at all.
- The only compatibility goal is correctly reading standard RSS 2.0/Atom
  1.0 feeds; FedOS never produces one under this plan.
- No `fetch`, HTTP request, feed parser, or subscription exists after this
  document — it fixes the plan, not the implementation.
