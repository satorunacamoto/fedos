# Protocol Moderation Compatibility (docs only — no implementation)

**Status: docs only. This document adds NO relay connection, NO WebSocket,
NO OAuth, NO AT Protocol call, NO Threads API call, NO signing, and NO
change to `src/`, `packages/`, or `Cargo.toml`.** It fixes how a future real
adapter behind `FederationProvider` (Stage 110) for EACH protocol would
express a moderation action, and how that differs from FedOS's OWN internal
moderation model (`src/community/moderation.ts`, Stage 115) — before any of
it is built.

---

## 1. Purpose

`docs/nostr_adapter_planning.md` §7 already fixed Nostr's moderation model
("hide/mute/filter, never deletion") and `docs/community_moderation_policy.md`
generalized that into a protocol-neutral community-policy layer
(`src/community/moderation.ts`). This document goes one level narrower: for
EACH protocol `ProtocolAdapterKind`/`FederationProviderKind` already names
(Nostr, Bluesky, Threads, RSS), it names what "moderation" would even MEAN
at the protocol layer, and how that maps onto — or fails to map onto —
FedOS's own internal visibility model. Naming these differences now, before
any adapter exists, avoids building a moderation UI that silently assumes
one protocol's semantics apply to all of them.

---

## 2. Nostr: hide/mute/filter, never delete (restated, protocol-specific detail)

Already fixed in `docs/nostr_adapter_planning.md` §7 and
`docs/community_moderation_policy.md` §2; the protocol-specific detail this
document adds:

- **NIP-09 "delete" is a relay-cooperation REQUEST, not an erasure.** A
  relay MAY drop the event on request, MAY ignore it, and other relays that
  already have a copy are entirely unaffected. FedOS must never present a
  NIP-09 delete request to a user as "this is gone."
- **NIP-51 mute lists** are the closest Nostr-native primitive to FedOS's
  own `mute_placeholder` — a client-side, per-user filter list, not a
  request the moderated pubkey's content disappears for anyone else.
- **Correct FedOS framing:** a Nostr "moderation signal"
  (`ModerationSignalInput` → `moderation_signal_placeholder`, `../federation/
  nostr_mapping.ts`) is, at most, a candidate for a NIP-09/NIP-51-shaped
  event — it is FedOS's own local visibility choice first, a protocol
  artifact second, and never a deletion claim either way.

---

## 3. Bluesky: adapter differences (design note, no AT Protocol call)

Bluesky (AT Protocol) has structurally DIFFERENT moderation primitives than
Nostr, none of which this document builds:

- **Labels, not (only) hide/mute.** AT Protocol's moderation model is
  centered on labeler services attaching LABELS to content/accounts, which
  a client then applies its own display policy to. This is closer to
  FedOS's own `filtered_placeholder` (label-driven, view-dependent
  exclusion) than to a peer-to-peer mute list.
- **Real deletion is more plausible, but still not FedOS's to promise.** A
  Bluesky PDS (the user's own repository host) CAN actually remove a
  record it hosts — unlike Nostr's copy-everywhere model, there is a single
  authoritative host per account. Even so, a future FedOS adapter must not
  claim removal succeeded without confirmation FROM that adapter — a claim
  this document does not build any mechanism to make.
- **No OAuth/session/labeler-service call exists.** `bluesky_placeholder`'s
  capability row (`../src/federation/capability_matrix.ts`) stays
  `unavailable` for every non-test capability — this section names a FUTURE
  difference, it does not implement a labeler client.

---

## 4. Threads: adapter differences (design note, no Threads API call)

Threads (Meta's platform) is a centralized, single-authority system —
the LEAST similar to Nostr's model of the four:

- **Centralized moderation and takedown.** Meta's own trust/safety systems
  are authoritative; there is no relay-cooperation request or client-side
  label list — a "removal" from Threads is an actual platform action FedOS
  has no visibility into or control over.
- **No client-side mute-list equivalent to surface.** Unlike Nostr (NIP-51)
  or Bluesky (labeler services), Threads exposes no protocol-level
  moderation primitive a future FedOS adapter could read and mirror into
  FedOS's own `ModerationVisibilityDecision` — at most, a future adapter
  could reflect Threads' OWN visibility state for a given piece of content
  (e.g. "restricted by Threads"), never originate a moderation action on
  Threads' side.
- **No API/OAuth call exists.** `threads_placeholder`'s capability row stays
  `unavailable` for every non-test capability, same as Bluesky — this
  section names a future difference, not a client.

---

## 5. RSS: no moderation primitive at all

RSS is a one-way, unauthenticated read format with no user accounts, no
mute lists, and no labels:

- **There is nothing to moderate AT the protocol layer.** An RSS feed is
  either included in FedOS's read list or it is not — that inclusion
  decision is entirely FedOS's own (a `filtered_placeholder`-shaped local
  choice), never a protocol-native moderation action.
- **`rss_placeholder`'s capability row stays `unavailable`** for every
  non-test capability, consistent with Bluesky/Threads — RSS has no
  publish/reply/reaction/private-message/paid-content concept to begin
  with, moderation included.

---

## 6. Relationship to FedOS's own internal moderation

`src/community/moderation.ts` (Stage 115) already answers "what would this
hide/mute/filter action visually do" as a protocol-INDEPENDENT boundary —
this document does not change that function, its types, or its guardrails.
The relationship is layered, restated from
`docs/community_moderation_policy.md` §1:

- **FedOS's internal model is the SOURCE OF TRUTH for FedOS's own
  rendering.** Whatever a Nostr NIP-09 request, a Bluesky label, or a
  Threads restriction state eventually reports, FedOS's own board/chat view
  decides its OWN visibility via `reviewCommunityModerationTarget` — never
  by directly trusting a protocol-reported state as FedOS's display logic.
- **A protocol's moderation signal is, at most, an INPUT a future adapter
  could translate into a `CommunityModerationTargetInput`** — no such
  translation exists yet for any protocol; §§2–5 above name the SHAPE of
  that future translation problem per protocol, not an implementation.
- **No protocol's moderation state is ever treated as proof of deletion.**
  Even Bluesky's more centralized removal (§3) is never presented as "gone
  everywhere" — a future adapter would, at most, stop rendering it in
  FedOS's own view (a `hidden_placeholder`-shaped local reaction), the same
  posture already fixed for Nostr.

---

## 7. What this document does NOT implement

- No AT Protocol session, labeler-service client, or OAuth flow of any kind
- No Threads API call of any kind
- No RSS fetch of any kind
- No change to `src/community/moderation.ts`'s shipped shape (Stage 115)
- No change to `src/federation/capability_matrix.ts`'s shipped shape
  (Stage 117) — every non-Nostr adapter's capability row stays
  `unavailable` exactly as that stage left it
- No relay connection, signing, publish, or subscribe of any kind

---

## 8. Conclusion

- Nostr, Bluesky, Threads, and RSS each have a STRUCTURALLY different
  moderation model — hide/mute/filter-and-copy-everywhere, label-and-single-
  host, centralized-platform-authority, and none-at-all, respectively.
- FedOS's own `ModerationVisibilityDecision` stays the single source of
  truth for FedOS's own rendering regardless of which protocol a piece of
  content came from — no protocol's moderation state is ever trusted
  directly as FedOS's display logic.
- Nothing in this document builds an adapter, a client, a translation
  function, or a network call — it fixes the plan, not the implementation.
