# Secure Runtime Alpha 288 — Record Update / Delete Boundary Review

**Status: this Stage IMPLEMENTS a MINIMAL, INERT type only. It adds
exactly one new file,
`src/board/atproto/fedos_atproto_mutation_boundary.ts`, containing types
and label constants — no function, no class, no enforcement logic, no
storage call. This Arc does NOT implement repository mutations** (this
Arc's own instruction, verbatim). Stage 8 of the Alpha 281–290 AT
Protocol Canonical Board Adapter Arc.

## 1. Why now

`FedosValidatedAtprotoPost` (Alpha 282) and the Board Adapter (Alpha
287) together answer "how does an initial record become a
`FedosBoardPost`" — but AT Protocol repositories also support record
UPDATES (same AT URI, new CID) and record DELETIONS, plus entirely
different collections (reposts, likes, follows, profiles). This Stage
formally separates all of their responsibility from both the Board
Adapter and from `FedosBoardPost` itself, mirroring Alpha 278's
identical review for ActivityPub's `Update`/`Delete`/`Announce`/`Like`/
`Follow`/`Undo`.

## 2. Initial record — this Arc's own scope, confirmed

A `FedosValidatedAtprotoPost` value's very EXISTENCE already implies
"this is (a normalization of) the current record at this AT URI" — by
upstream construction, not by any field on the type itself. The Board
Adapter (Alpha 287) creates/imports a canonical `FedosBoardPost`
CANDIDATE from it.

## 3. Updated record at the same AT URI, new CID — future separate
revision/source-state model, not a mutation

**`FedosBoardPost` is immutable (Alpha 255) and MUST NOT be mutated in
place.** Exactly Alpha 278 §3's identical rule for ActivityPub's
`Update`, restated: a future revision model (out of scope) would need
its OWN separate type, never a field or method on `FedosBoardPost`
itself. AT Protocol's own CID gives this future model something Nostr
and ActivityPub never could: an explicit, protocol-native marker for
"this is a DIFFERENT observed version of the SAME logical record" (the
retained `cid` on `FedosValidatedAtprotoPost`, Alpha 282 §4) — but
using it remains entirely future work; this Arc reads `cid` only to
confirm its presence (Alpha 287 §4) and never acts on a CID change in
any way.

## 4. Deleted record — future tombstone/source-state or moderation
record, not an automatic erasure

**A deleted record must NOT automatically erase canonical Board
content.** Exactly Alpha 278 §4's identical rule for ActivityPub's
`Delete`, restated for AT Protocol's own repository-deletion event:
"source deletion does not necessarily equal local board deletion" (the
distinction Alpha 258 §5 first drew, prior-prior Arc). A future Stage
that wants to honor a repository deletion would record it on a SEPARATE
moderation/source-state record — never as a boolean flip on the
immutable `FedosBoardPost` this Arc already shipped.

## 5. Repost, Like, Follow, Profile records — out of scope, no type at all

Per this Arc's own instruction, verbatim, each is simply "out of scope"
— unlike the update/delete case, none is even named on the minimal
inert type this Stage introduces (§6). No `FedosBoardPost`-adjacent
concept exists for `app.bsky.feed.repost`, `app.bsky.feed.like`,
`app.bsky.graph.follow`, or `app.bsky.actor.profile` anywhere in this
Arc.

## 6. The minimal, inert type

```ts
export type FedosAtprotoObservedRecordEventKind =
  | "initial_record_placeholder"
  | "updated_record_placeholder"
  | "deleted_record_placeholder";

export interface FedosAtprotoRecordObservation {
  readonly uri: string;
  readonly cid: string;
  readonly kind: FedosAtprotoObservedRecordEventKind;
  readonly observedAt: number;
}
```

`_placeholder`-suffixed labels, matching `FedosBoardModerationRecord`'s
(Alpha 258) and `FedosActivityPubMutationObservation`'s (Alpha 278) own
established convention — nothing in this repository enforces, applies,
or acts on ANY of these three states yet.

**One deliberate difference from `FedosActivityPubMutationObservation`
(Alpha 278):** this type carries BOTH `uri` (record identity) AND `cid`
(the observed content version) — ActivityPub's own equivalent type
carries only `objectId`, since ActivityPub gave this Arc's predecessor
no protocol-native content-version marker to retain. AT Protocol's own
CID is exactly that marker (Alpha 283 §4/§7), so it is retained here
even though, like the rest of this type, it is never read or acted upon
by anything in this Arc.

This type is NOT wired into the Board Adapter (Alpha 287), NOT
constructed anywhere in this Arc, and carries no relationship field back
to `FedosBoardPost` beyond the plain `uri` string — mirroring
`FedosBoardModerationRecord.postId`'s and
`FedosActivityPubMutationObservation.objectId`'s own "the ONLY link"
discipline.

## 7. Rejected additions to `FedosBoardPost` — confirmed absent

Per this Arc's own instruction, verbatim, NONE of the following was
added to `FedosBoardPost`, and none is — confirmed structurally
(`FedosBoardPost`'s own field set is unchanged since Alpha 255, eight
fields, unmodified by this Arc):

- `deleted` boolean
- `updated` boolean
- `repost` boolean
- like count
- generic metadata

## 8. Hard guardrails, confirmed by direct inspection (and this Stage's
own structural test)

- Every field on `FedosAtprotoRecordObservation` is `readonly`.
- **No boolean `deleted`/`updated`/`repost` field anywhere in this
  file.**
- **No enforcement function** — the file exports types and one
  label-array constant (`FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS`)
  only; no function of any kind is defined.
- **No storage/network call** — no import from `src/storage/` or any
  network-capable module; the file is inert by construction.
- **Never constructed anywhere in this Arc** — confirmed structurally:
  no `src/board/atproto/` file other than this one references
  `FedosAtprotoRecordObservation`.

## 9. See also

- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
- `docs/secure_runtime_alpha_283_atproto_source_provenance.md`
- `docs/secure_runtime_alpha_278_activitypub_mutation_boundary.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
