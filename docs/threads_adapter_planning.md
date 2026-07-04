# Threads Adapter Planning (research/design docs only — no implementation)

**Status: docs only. This document adds NO Threads API call, NO OAuth flow,
NO OAuth token, NO `fetch`, NO webhook subscription, NO publish, and NO
change to `src/`, `packages/`, or `Cargo.toml`.** It fixes how a future real
Threads adapter behind `FederationProvider` (Stage 110) would connect
FedOS's Board/Chat/Marketplace layers to Meta's Threads platform
specifically — before any of it is built.

---

## 1. Purpose

Name the Threads-specific version of the same mapping/compatibility
questions already fixed for Nostr (`docs/nostr_adapter_planning.md`) and
Bluesky (`docs/bluesky_adapter_planning.md`), so a future adapter has a
fixed plan rather than an improvised one.

---

## 2. Threads' role, correctly scoped

- **Threads is a CENTRALIZED platform, not a protocol FedOS could ever be a
  peer on.** There is no relay network and no self-hosted repository —
  every post lives on Meta's own infrastructure, reachable only through
  Meta's official Threads API under Meta's own terms and rate limits.
- **FedOS would be an API CLIENT, never remotely a co-equal participant.**
  This is the least "federated" of the four protocols this codebase names
  (`docs/protocol_moderation_compatibility.md` §4) — Threads' authority
  over content, moderation, and account state is total and unilateral.
- **FedOS remains the context/render layer for whatever public content a
  future adapter reads** — same framing as Nostr/Bluesky, with the caveat
  that a Threads-sourced post's continued existence is entirely up to Meta.

---

## 3. Compatibility posture

A future adapter's goal, once built, would be READING public Threads posts
into FedOS's board/thread model for display — not necessarily posting FROM
FedOS TO Threads (Meta's API terms and app-review requirements for
write access are a separate, much higher bar than read access, and are not
evaluated by this document). No client compatibility claim is made here
comparable to §3 of the Nostr/Bluesky documents, since Threads has no
alternate-client ecosystem FedOS would need to interoperate with — there is
exactly one authoritative client surface (Meta's own apps/API).

---

## 4. What FedOS-specific metadata may and may not ride on a Threads post

Same rule as the other two documents, restated: PUBLIC, non-sensitive
labels only, and only in a field the Threads API itself supports (a caption,
for instance) — never as an invented field Threads does not define. Private,
gated, payment, and entitlement data must NEVER be sent to the Threads API
in any field, full stop; unlike Nostr/Bluesky, this is not merely a privacy
best practice but also almost certainly a violation of Meta's platform
terms for what first-party-collected user data may be shared with a
third-party integration.

---

## 5. Candidate mappings (naming only, nothing built)

| FedOS concept | Threads mapping candidate | Notes |
| --- | --- | --- |
| `post` (`SocialEventKind`) | a Threads Media Container / Post via the Threads API | Read-direction candidate only — see §3 |
| `reply` | a reply post via the Threads API | Same read-direction caveat |
| `reaction` | NOT modeled — the Threads API's reaction/like surface for third-party apps is far narrower than Nostr/Bluesky's | Left unresolved intentionally |
| Board thread (`BoardDescriptor`) | NOT modeled as a Threads-native concept | Would stay FedOS-side context only |
| Marketplace announcement | NOT modeled — no commerce-relevant public surface identified | Deliberately out of scope |
| Creator profile | Threads user profile, READ-only | Public profile fields only |
| Moderation signal | NOT modeled — see §6 | Threads' own moderation is unilateral and opaque to a third-party client |

This table is deliberately sparser than the Nostr/Bluesky ones — Threads'
API surface for third-party integrations is narrower, and several rows are
left unresolved on purpose rather than guessed at.

---

## 6. What this document does NOT implement

- Any Threads API call, OAuth flow, or OAuth token of any kind
- Any webhook/subscription of any kind
- Any write/publish path to Threads
- Any change to `FederationProvider`'s shipped shape (Stage 110) or to
  `src/federation/capability_matrix.ts`'s `threads_placeholder` row (Stage
  117, still `unavailable` for every non-test capability)

---

## 7. Moderation model (design intent, not implemented)

See `docs/protocol_moderation_compatibility.md` §4 for the full comparison.
In short: Threads has no client-facing moderation primitive comparable to
Nostr's mute lists or Bluesky's labeler services — a future adapter could,
at most, reflect Threads' own reported visibility state for a piece of
content, never originate a moderation action on Threads' side, and FedOS's
own `ModerationVisibilityDecision` stays the only thing FedOS's own
rendering trusts.

---

## 8. Security / privacy rules for any future implementation

- No private content, payment state, or entitlement data in any Threads API
  call, request, or response field (§4).
- No OAuth token, app secret, or session credential is ever named, stored,
  or referenced by this document or by anything in `src/`.
- Given Threads' platform-terms sensitivity (§4), any future real
  implementation would need a dedicated compliance review BEFORE step 2 of
  §9 — a review this document does not perform.

---

## 9. Future implementation order (design intent, not scheduled)

1. A pure, unsigned mapping function for the READ-direction rows named in
   §5 — no API call.
2. A platform-terms/compliance review (not a code change) confirming what
   read (and, separately, write) access Meta's API terms actually permit
   for FedOS's intended use.
3. A read-only fetch adapter behind `FederationProvider.fetchPlaceholder`
   for `threads_placeholder`, only after step 2 clears.
4. OAuth/token handling, via identity boundaries — never reimplemented
   inside the adapter.
5. A write path, only if step 2's review permits it — otherwise Threads
   stays a read-only source indefinitely.

---

## 10. Conclusion

- Threads is treated as a centralized, API-gated platform FedOS could at
  most be a READ client of — not a peer, not a moderation mechanism, and
  the narrowest-scoped of the four protocols this codebase names.
- Several mapping rows are deliberately left unresolved rather than guessed
  at, given Threads' narrower third-party API surface.
- No Threads API call, OAuth, token, publish, or subscribe exists after
  this document — it fixes the plan, not the implementation.
