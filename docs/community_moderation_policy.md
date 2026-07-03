# Community Moderation Policy (boundary docs — types + pure policy shipped)

**Status: this document describes a SHIPPED boundary
(`src/community/moderation.ts`, Stage 115) plus a read-only preview UI
(`src/render/community_rules_preview.ts`, Stage 116) — not a design sketch.
Both stay strictly within the "hide/mute/filter, never deletion" model
already fixed for the future Nostr adapter in
`docs/nostr_adapter_planning.md` §7. Nothing in either file deletes,
removes, or purges any content, and neither connects to `StorageBackend`,
`FederationProvider`, `ChatProvider`, or `MarketplaceProvider`.**

---

## 1. Purpose

Fix, as a pure boundary, how FedOS's OWN rendering decides whether to show a
piece of community content — separate from whatever protocol (Nostr or
otherwise) the underlying content came from. This is the community-POLICY
layer; it is a different, more general layer than
`../federation/nostr_mapping.ts`'s `moderationSignalToNostrCandidate`, which
maps a moderation signal to a Nostr event candidate specifically. This
document's boundary has no protocol dependency at all.

---

## 2. The core invariant: visibility, never deletion

Restated from `docs/nostr_adapter_planning.md` §7, generalized beyond Nostr:

- **FedOS controls only what IT shows.** A `ModerationVisibilityDecision`
  (`visible_placeholder`/`hidden_placeholder`/`muted_placeholder`/
  `filtered_placeholder`/`rejected`) is a claim about FedOS's OWN rendering
  choice — never a claim that content was deleted, removed, or purged
  anywhere, including in FedOS's own storage.
- **No delete/remove/purge action exists on the type.** The only
  requestable actions are `hide_placeholder`/`mute_placeholder`/
  `filter_placeholder` (`CommunityModerationRequestedAction`) — this is
  enforced by the shape of the type itself, not by a convention a future
  caller could accidentally violate.
- **A `rejected` review is not a moderation outcome.** It means the
  moderation TARGET (the request itself) failed policy review — e.g. it
  carried a sensitive reason/metadata field — so no visibility decision was
  reached at all.

---

## 3. `reviewCommunityModerationTarget` (`src/community/moderation.ts`)

A single pure function: takes a `CommunityModerationTargetInput` (opaque
`idRef`/`targetRef`, a `targetKind`, a `policyKind`, a requested `action`,
an optional display `reason`, optional `metadata`) and returns a
`CommunityModerationReview` (`decision` + `reason`). It:

- Rejects (never throws) when `reason` or `metadata` contains a sensitive
  marker (the same conservative family used elsewhere in this codebase:
  secret/key/seed/token/payment/entitlement/dm/body/content/message).
- Otherwise maps the requested action 1:1 to its visibility label
  (`hide_placeholder` → `hidden_placeholder`, etc.) — a pure lookup, no
  branching on content.
- Never mutates its input.
- Never contacts `StorageBackend`, `FederationProvider`, `ChatProvider`, or
  `MarketplaceProvider` — this function REPORTS a decision only; applying
  it to a real UI is entirely a future caller's responsibility.

---

## 4. Policy/target vocabulary (names only, all placeholders)

- `CommunityModerationPolicyKind`: `default_placeholder` /
  `creator_space_placeholder` / `marketplace_placeholder` /
  `chat_placeholder` / `test_placeholder` — WHICH community surface a
  policy applies to.
- `CommunityModerationTargetKind`: `post_placeholder` / `reply_placeholder`
  / `listing_placeholder` / `profile_placeholder` / `chat_placeholder` /
  `test_placeholder` — WHAT kind of thing is being moderated.

Neither list is wired to an actual space/board/marketplace/chat lookup in
this stage — they are display/documentation vocabulary only, same as every
other `_placeholder` enum in this codebase.

---

## 5. Relationship to `creator/profile.ts`'s `reported_placeholder` label

A creator profile's `reported_placeholder` trust label
(`docs/creator_monetization_flow.md` §13) is a STATUS label about the
creator, not a moderation ACTION by itself — the same separation this
codebase already draws between "a payment was accepted" and "access is
granted" (§5 of that document). A future real system might set
`reported_placeholder` as a consequence of an accumulated set of
`reviewCommunityModerationTarget` reviews, but no such wiring exists yet;
today the two boundaries do not call each other at all.

---

## 6. Read-only preview UI (Stage 116, `src/render/community_rules_preview.ts`)

A fixed, static array of four sample rules (`SAMPLE_COMMUNITY_RULES`) is
rendered as a read-only page, gated behind `?communityRulesPreview=1` in
`src/worker.ts`. Each rule is run through the real (pure)
`reviewCommunityModerationTarget` to display the visibility label it maps
to — this exercises the boundary function directly, but nothing on the page
is ever applied to a live board/chat/marketplace view; there is no
apply/save button, no form, and no `content`/`body`/bytes field anywhere on
the page. The page's own lead note explicitly states content is never
deleted/removed/purged by anything shown.

---

## 7. What is explicitly NOT implemented

- No real moderation enforcement — nothing here actually hides a post from
  a live board render; `reviewCommunityModerationTarget` only reports what
  a caller SHOULD do.
- No moderator role/permission check (see `src/community/policy.ts`'s
  `canModerate` for the SEPARATE, already-shipped "who may moderate"
  question — this boundary answers a different question: "what would this
  moderation action visually do").
- No appeal mechanism, no audit log, no notification to the moderated
  party.
- No connection to `StorageBackend`, `FederationProvider`, `ChatProvider`,
  or `MarketplaceProvider`.

---

## 8. Conclusion

- Community moderation, at this stage, is a pure LABEL boundary: given a
  requested hide/mute/filter action, it reports the matching visibility
  decision (or `rejected` for a policy-dirty request) — nothing more.
- Deletion, removal, and purging are not concepts this boundary has any
  vocabulary for, by design.
- A read-only preview UI exists to show the model, not to apply it.
