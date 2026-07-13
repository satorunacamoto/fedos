# Secure Runtime Alpha 258 — Moderation and Deletion Boundary Review

**Status: this Stage IMPLEMENTS a MINIMAL, INERT type only. It adds
exactly one new file, `src/board/fedos_board_moderation.ts`, containing
types and label constants — no function, no class, no enforcement logic,
no storage call. This Arc does NOT implement a full moderation system**
(this Arc's own Absolute Prohibitions list). Stage 8 of the Alpha
251–260 Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 255 deliberately withheld `deletedAt`/`deleted` from
`FedosBoardPost` (Alpha 255 §3), promising this Stage would decide where
moderation state belongs instead. This Stage keeps that promise.

## 2. The three options and the adopted one

- **Option A — moderation fields embedded directly in `FedosBoardPost`.**
  Rejected. `FedosBoardPost` is immutable (Alpha 255 §5); moderation
  state changes over time (reported → reviewed → reinstated, or
  reported → removed) while the post's own content never does — forcing
  every moderation-state change to mint a whole new `FedosBoardPost`
  would conflate two independently-evolving concerns into one type.
- **Option B — separate `FedosBoardModerationRecord`.** **Adopted**,
  exactly this Arc's own preferred candidate.
- **Option C — derive moderation only at presentation time.** Rejected
  alone: gives no place to actually STORE a moderator's decision or a
  report count between renders — a pure "derive at render time" function
  needs input to derive FROM, and nothing in this repository holds that
  input without Option B's own record type existing first. (A future
  presentation layer may still derive a display DECISION from a
  `FedosBoardModerationRecord` using logic in the shape of
  `reviewCommunityModerationTarget`, `src/community/moderation.ts`,
  Stage 115 — but the record itself has to exist somewhere first.)

## 3. The shape

```ts
export type FedosBoardModerationState =
  | "visible_placeholder"
  | "hidden_placeholder"
  | "quarantined_placeholder"
  | "removed_placeholder"
  | "reported_placeholder";

export type FedosBoardModerationReasonCode =
  | "spam_placeholder"
  | "illegal_content_placeholder"
  | "policy_violation_placeholder"
  | "user_report_placeholder"
  | "appeal_upheld_placeholder"
  | "appeal_denied_placeholder"
  | "source_protocol_deletion_placeholder"
  | "local_only_deletion_placeholder"
  | "test_placeholder";

export interface FedosBoardModerationRecord {
  readonly postId: FedosBoardPostId;
  readonly state: FedosBoardModerationState;
  readonly reasonCode: FedosBoardModerationReasonCode;
  readonly moderatorId: string | null;
  readonly note?: string;
  readonly appliedAt: number;
}
```

`_placeholder`-suffixed state/reason labels deliberately match the
existing `ModerationVisibilityDecision`/`ModerationAction` convention
(`src/community/moderation.ts` Stage 115, `src/federation/types.ts`) —
nothing in this repository enforces ANY of these states yet, at either
layer, and the naming says so honestly rather than implying a working
enforcement path exists.

## 4. Future requirements named, none implemented

This Arc's own instruction lists: hidden, quarantined, removed, reported,
spam, illegal-content handling, moderator reason, appeal,
source-protocol deletion, local-only deletion. Every one of these maps to
either a `FedosBoardModerationState` value or a
`FedosBoardModerationReasonCode` value above (`appeal_upheld_placeholder`/
`appeal_denied_placeholder` cover "appeal"). None has an enforcement path
— no function reads, writes, or acts on a `FedosBoardModerationRecord`
anywhere in this repository after this Stage; the type exists so a future
Arc has a fixed vocabulary to build against, not a working system.

## 5. Source deletion vs. local board deletion — the important distinction

This Arc's own instruction states plainly: "Source deletion does not
necessarily equal local board deletion." This Stage encodes that
distinction as two SEPARATE reason codes —
`source_protocol_deletion_placeholder` (the post's original, at its
protocol source, was withdrawn) and `local_only_deletion_placeholder`
(FedOS's own moderation removed/hid it locally, independent of the
source) — rather than a single boolean. Neither reason code, nor any
`state` value, means the underlying `FedosBoardPost` row was actually
deleted from any store: this repository's Storage boundary (`src/storage/`)
is untouched by this Arc and performs no deletion of any kind in response
to either reason code.

## 6. Hard guardrails, confirmed by direct inspection (and this Stage's
own structural test)

- Every field on `FedosBoardModerationRecord` is `readonly`.
- **No boolean `deleted` field anywhere in this file** — searched and
  confirmed absent.
- **No enforcement function** — the file exports types and two label-array
  constants (`FEDOS_BOARD_MODERATION_STATES`,
  `FEDOS_BOARD_MODERATION_REASON_CODES`) only; no function of any kind is
  defined.
- **No storage/network call** — no import from `src/storage/` or any
  network-capable module; the file is inert by construction.

## 7. See also

- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_251_existing_board_model_inventory.md` (§3.5)
