/**
 * Secure Runtime Alpha 288 ("Record Update / Delete Boundary Review")
 * — Stage 8 of the Alpha 281–290 AT Protocol Canonical Board Adapter
 * Arc.
 *
 * **Status: this file defines TYPES ONLY — no function, no class, no
 * enforcement, no storage call, no mutation of any `FedosBoardPost`.**
 * This Arc does NOT implement repository mutations (this Arc's own
 * instruction, verbatim). It only formally separates initial-record/
 * update/delete responsibility from both the AT Protocol Board Adapter
 * (`./fedos_atproto_board_adapter.ts`, Alpha 287) and `FedosBoardPost`
 * (`../fedos_board_post.js`, Alpha 255) itself.
 *
 * An initial record already has its own real path this Arc: a
 * `FedosValidatedAtprotoPost` value's very existence implies it is a
 * normalization of the current record at its own AT URI (Alpha 282/288
 * §2) — the Board Adapter maps it into a `FedosBoardPost` candidate.
 * An update (same AT URI, new CID) and a deletion do NOT: `FedosBoardPost`
 * is immutable and MUST NOT be mutated in place, and a deletion MUST
 * NOT erase the canonical post automatically (source deletion does not
 * necessarily equal local board deletion — the SAME distinction Alpha
 * 258 §5 and Alpha 278 §4 already drew for Nostr/ActivityPub). Repost,
 * Like, Follow, and Profile records are simply out of scope — no type
 * exists for any of them here.
 *
 * HARD GUARDRAILS:
 *   - Every field is `readonly`.
 *   - NO boolean `deleted`/`updated`/`repost` field anywhere in this
 *     file.
 *   - NO enforcement function, NO storage/network call — this file is
 *     inert by construction: it exports types and one label-array
 *     constant only.
 *   - NOT wired into `fedos_atproto_board_adapter.ts` or any other
 *     file — never constructed anywhere in this Arc.
 */

/**
 * A label naming WHICH kind of AT Protocol record event was observed —
 * never a claim that anything was applied, enforced, or stored.
 * `_placeholder`-suffixed, matching `FedosBoardModerationRecord`'s
 * (`../fedos_board_moderation.js`, Alpha 258) and
 * `FedosActivityPubMutationObservation`'s
 * (`../activitypub/fedos_activitypub_mutation_boundary.js`, Alpha 278)
 * own established convention.
 */
export type FedosAtprotoObservedRecordEventKind =
  | "initial_record_placeholder"
  | "updated_record_placeholder"
  | "deleted_record_placeholder";

/**
 * A non-sensitive record naming that SOME record event was observed for
 * a given AT URI — kept entirely separate from `FedosBoardPost`, which
 * it never references by type, only by the plain `uri` string
 * (mirroring `FedosBoardModerationRecord.postId`'s own "the ONLY link"
 * discipline). Carries `cid` alongside `uri` — unlike
 * `FedosActivityPubMutationObservation`, since AT Protocol's own CID is
 * a protocol-native content-version marker (Alpha 283 §4/§7) worth
 * retaining here even though nothing in this Arc reads or acts on it.
 */
export interface FedosAtprotoRecordObservation {
  readonly uri: string;
  readonly cid: string;
  readonly kind: FedosAtprotoObservedRecordEventKind;
  /** Unix seconds. */
  readonly observedAt: number;
}

/** Every observed-record-event-kind label (for mapping/documentation helpers). */
export const FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS: readonly FedosAtprotoObservedRecordEventKind[] = [
  "initial_record_placeholder",
  "updated_record_placeholder",
  "deleted_record_placeholder",
];
