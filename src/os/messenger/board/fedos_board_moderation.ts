/**
 * Secure Runtime Alpha 258 ("Moderation and Deletion Boundary Review") —
 * Stage 8 of the Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * **Status: this file defines TYPES ONLY — no function, no class, no
 * enforcement, no storage call, no mutation of any `FedosBoardPost`.**
 * This Arc does NOT implement a moderation system (see this Arc's own
 * Absolute Prohibitions). It only decides WHERE moderation state will
 * eventually live once a future Arc implements it.
 *
 * DECISION (Alpha 258): "Option B" of this Arc's own instruction — a
 * SEPARATE `FedosBoardModerationRecord`, never a field embedded on
 * `FedosBoardPost` (`./fedos_board_post.ts`, Alpha 255). A
 * `FedosBoardPost` stays immutable and carries no `deleted`/`hidden`
 * boolean of any kind: moderation state changes over time (a post can be
 * reported, then reviewed, then reinstated) while the canonical post
 * itself — what was said, by whom, when — never does. Mirrors this
 * codebase's own existing "hide/mute/filter, never delete" discipline
 * (`src/community/moderation.ts`, Stage 115) at the Canonical Board Model
 * layer instead of the community-policy layer.
 *
 * IMPORTANT DISTINCTION carried forward from this Arc's own instruction:
 * source-protocol deletion does NOT necessarily equal local board
 * deletion — a post whose Nostr/ActivityPub/ATProto/Session-side original
 * was withdrawn does not thereby stop existing in FedOS's own local
 * board state; `reasonCode` names which of these two cases applies, but
 * neither `state` value here means "the row was deleted" — this
 * repository's storage boundary (`src/storage/`) is untouched by this
 * Arc and performs no deletion of any kind in response to either.
 *
 * HARD GUARDRAILS:
 *   - Every field is `readonly`.
 *   - NO boolean `deleted` field anywhere in this file.
 *   - NO enforcement function, NO storage/network call — this file is
 *     inert by construction: it exports types and label constants only.
 */

import type { FedosBoardPostId } from "./fedos_board_identifiers.js";

/**
 * FedOS's own local visibility state for a post — never a claim about
 * whether the content still exists at its source. Naming mirrors
 * `ModerationVisibilityDecision` (`src/community/moderation.ts`) and
 * `ModerationAction` (`src/federation/types.ts`)'s own `_placeholder`
 * discipline: nothing in this repository enforces any of these states
 * yet.
 */
export type FedosBoardModerationState =
  | "visible_placeholder"
  | "hidden_placeholder"
  | "quarantined_placeholder"
  | "removed_placeholder"
  | "reported_placeholder";

/** Why a moderation record's `state` was set — a label of intent only. */
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

/**
 * A non-sensitive moderation record, kept entirely separate from the
 * `FedosBoardPost` it targets. `postId` is the ONLY link between the two
 * — no back-reference exists on `FedosBoardPost` itself.
 */
export interface FedosBoardModerationRecord {
  readonly postId: FedosBoardPostId;
  readonly state: FedosBoardModerationState;
  readonly reasonCode: FedosBoardModerationReasonCode;
  /** Local `FedosIdentityRecord.id` of the moderator, or `null` for an automated/source-originated record. */
  readonly moderatorId: string | null;
  /** Non-sensitive display note only — never raw reported content. */
  readonly note?: string;
  /** Unix seconds. */
  readonly appliedAt: number;
}

/** Every moderation-state label (for mapping/documentation helpers). */
export const FEDOS_BOARD_MODERATION_STATES: readonly FedosBoardModerationState[] = [
  "visible_placeholder",
  "hidden_placeholder",
  "quarantined_placeholder",
  "removed_placeholder",
  "reported_placeholder",
];

/** Every moderation-reason-code label (for mapping/documentation helpers). */
export const FEDOS_BOARD_MODERATION_REASON_CODES: readonly FedosBoardModerationReasonCode[] = [
  "spam_placeholder",
  "illegal_content_placeholder",
  "policy_violation_placeholder",
  "user_report_placeholder",
  "appeal_upheld_placeholder",
  "appeal_denied_placeholder",
  "source_protocol_deletion_placeholder",
  "local_only_deletion_placeholder",
  "test_placeholder",
];
