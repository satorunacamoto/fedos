/**
 * Secure Runtime Alpha 278 ("Create/Update/Delete Boundary Review") —
 * Stage 8 of the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.
 *
 * **Status: this file defines TYPES ONLY — no function, no class, no
 * enforcement, no storage call, no mutation of any `FedosBoardPost`.**
 * This Arc does NOT implement federation mutation handling (this Arc's
 * own instruction, verbatim). It only formally separates
 * `Create`/`Update`/`Delete` responsibility from both the ActivityPub
 * Board Adapter (`./fedos_activitypub_board_adapter.ts`, Alpha 277) and
 * `FedosBoardPost` (`../fedos_board_post.js`, Alpha 255) itself.
 *
 * `Create(Note)` already has its own real path this Arc: a
 * `FedosValidatedActivityPubPost` value's very existence implies it came
 * from one (Alpha 272/278 §2) — the Board Adapter maps it into a
 * `FedosBoardPost` candidate. `Update`/`Delete` do NOT: `FedosBoardPost`
 * is immutable and MUST NOT be mutated in place, and a `Delete` MUST NOT
 * delete the canonical post automatically (source deletion does not
 * necessarily equal local board deletion — the SAME distinction Alpha
 * 258 §5 already drew for Nostr). `Announce`/`Like`/`Follow`/`Undo` are
 * simply out of scope — no type exists for any of them here.
 *
 * HARD GUARDRAILS:
 *   - Every field is `readonly`.
 *   - NO boolean `deleted`/`updated` field anywhere in this file.
 *   - NO enforcement function, NO storage/network call — this file is
 *     inert by construction: it exports types and one label-array
 *     constant only.
 *   - NOT wired into `fedos_activitypub_board_adapter.ts` or any other
 *     file — never constructed anywhere in this Arc.
 */

/**
 * A label naming WHICH kind of ActivityPub mutation was observed —
 * never a claim that anything was applied, enforced, or stored.
 * `_placeholder`-suffixed, matching `FedosBoardModerationRecord`'s own
 * established convention (`../fedos_board_moderation.js`, Alpha 258).
 */
export type FedosActivityPubObservedMutationKind =
  | "create_placeholder"
  | "update_placeholder"
  | "delete_placeholder";

/**
 * A non-sensitive record naming that SOME mutation was observed for a
 * given ActivityPub object id — kept entirely separate from
 * `FedosBoardPost`, which it never references by type, only by the
 * plain `objectId` string (mirroring
 * `FedosBoardModerationRecord.postId`'s own "the ONLY link" discipline).
 */
export interface FedosActivityPubMutationObservation {
  readonly objectId: string;
  readonly kind: FedosActivityPubObservedMutationKind;
  /** Unix seconds. */
  readonly observedAt: number;
}

/** Every observed-mutation-kind label (for mapping/documentation helpers). */
export const FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS: readonly FedosActivityPubObservedMutationKind[] = [
  "create_placeholder",
  "update_placeholder",
  "delete_placeholder",
];
