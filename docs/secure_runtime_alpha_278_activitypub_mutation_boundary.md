# Secure Runtime Alpha 278 — Create/Update/Delete Boundary Review

**Status: this Stage IMPLEMENTS a MINIMAL, INERT type only. It adds
exactly one new file,
`src/board/activitypub/fedos_activitypub_mutation_boundary.ts`,
containing types and label constants — no function, no class, no
enforcement logic, no storage call. This Arc does NOT implement
federation mutation handling** (this Arc's own instruction, verbatim).
Stage 8 of the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

`FedosValidatedActivityPubPost` (Alpha 272) and the Board Adapter (Alpha
277) together answer "how does a `Create(Note)` become a
`FedosBoardPost`" — but ActivityPub also defines `Update`, `Delete`,
`Announce`, `Like`, `Follow`, and `Undo`. This Stage formally separates
their responsibility from both the Board Adapter and from
`FedosBoardPost` itself, before any future Stage is tempted to bolt one
onto either.

## 2. `Create(Note)` — this Arc's own scope, confirmed

A `FedosValidatedActivityPubPost` value's very EXISTENCE already implies
"this came from a `Create(Note)`" — by upstream construction, not by any
field on the type itself (Alpha 272 has no `activityType` field). The
Board Adapter (Alpha 277) creates/imports a canonical `FedosBoardPost`
CANDIDATE from it. Nothing in this Arc ever produces a
`FedosValidatedActivityPubPost` from an `Update`, `Delete`, `Announce`,
`Like`, `Follow`, or `Undo` — no code path exists for any of the six.

## 3. `Update(Note)` — future separate revision model, not a mutation

**`FedosBoardPost` is immutable (Alpha 255) and MUST NOT be mutated in
place** — this Arc does not add any update/edit path, in-place or
otherwise. A future revision model (out of scope) would need its OWN
separate type — analogous to how `FedosBoardModerationRecord` (Alpha
258) is kept separate from `FedosBoardPost` rather than adding a
`deleted` boolean to it — never a field or method on `FedosBoardPost`
itself.

## 4. `Delete` — future moderation/tombstone/source-state record, not an
automatic deletion

**A `Delete` activity must NOT delete the canonical post automatically.**
Exactly the distinction Alpha 258 §5 (prior Arc) already drew for Nostr:
"source deletion does not necessarily equal local board deletion." A
future Stage that wants to honor an ActivityPub `Delete`/tombstone would
record it on a SEPARATE moderation/source-state record (the SAME
`FedosBoardModerationRecord` shape, or a future ActivityPub-specific
sibling of it) — never as a boolean flip on the immutable
`FedosBoardPost` this Arc already shipped.

## 5. `Announce`, `Like`, `Follow`, `Undo` — out of scope, no type at all

Per this Arc's own instruction, verbatim, each is simply "out of scope"
— unlike `Update`/`Delete`, none is even named on the minimal inert type
this Stage introduces (§6). No `FedosBoardPost`-adjacent concept exists
for a repost, a reaction, a follow relationship, or an activity retraction
anywhere in this Arc.

## 6. The minimal, inert type

```ts
export type FedosActivityPubObservedMutationKind =
  | "create_placeholder"
  | "update_placeholder"
  | "delete_placeholder";

export interface FedosActivityPubMutationObservation {
  readonly objectId: string;
  readonly kind: FedosActivityPubObservedMutationKind;
  readonly observedAt: number;
}
```

`_placeholder`-suffixed labels, matching `FedosBoardModerationRecord`'s
own established convention (Alpha 258) — nothing in this repository
enforces, applies, or acts on ANY of these three states yet; the naming
says so honestly. This type is NOT wired into the Board Adapter (Alpha
277), NOT constructed anywhere in this Arc, and carries no relationship
field back to `FedosBoardPost` beyond the plain `objectId` string —
mirroring `FedosBoardModerationRecord.postId`'s own "the ONLY link
between the two" discipline (Alpha 258 §6).

## 7. Hard guardrails, confirmed by direct inspection (and this Stage's
own structural test)

- Every field on `FedosActivityPubMutationObservation` is `readonly`.
- **No boolean `deleted`/`updated` field anywhere in this file.**
- **No enforcement function** — the file exports types and one
  label-array constant (`FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS`)
  only; no function of any kind is defined.
- **No storage/network call** — no import from `src/storage/` or any
  network-capable module; the file is inert by construction.
- **Never constructed anywhere in this Arc** — confirmed structurally:
  no `src/board/activitypub/` file other than this one references
  `FedosActivityPubMutationObservation`.

## 8. See also

- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
