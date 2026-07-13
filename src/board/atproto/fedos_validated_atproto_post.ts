/**
 * Secure Runtime Alpha 282 ("Normalized AT Protocol Post Model") —
 * Stage 2 of the Alpha 281–290 AT Protocol Canonical Board Adapter Arc.
 *
 * The smallest immutable, protocol-specific input model the AT Protocol
 * Board Adapter (`./fedos_atproto_board_adapter.ts`, Alpha 287)
 * consumes. Mirrors `FedosValidatedNostrEvent`'s
 * (`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242) and
 * `FedosValidatedActivityPubPost`'s
 * (`../activitypub/fedos_validated_activitypub_post.ts`, Alpha 272) own
 * construction discipline: "validated upstream by convention and module
 * placement," not by a runtime brand. This Arc's own scope decision is
 * fixed by this type's very existence: the Board Adapter accepts ONLY
 * an already-validated, already-normalized AT Protocol input — never a
 * raw XRPC response, CAR file, repository block, firehose frame, or
 * arbitrary Lexicon record.
 *
 * `cid` is retained here (Alpha 282 §4) but MUST NOT be copied onto
 * `FedosBoardSourceReference` or anywhere else on `FedosBoardPost` — see
 * Alpha 283 §2 ("CID does not leak into generic metadata").
 *
 * HARD GUARDRAILS:
 *   - `FedosValidatedAtprotoPost` is the ONLY export.
 *   - Every field is `readonly` — no mutation method or setter of any
 *     kind, and no field may ever be reassigned after construction.
 *   - Exactly seven fields — no raw Lexicon object, no XRPC response,
 *     no CAR block, no repository proof, no auth/refresh token, no app
 *     password, no PDS session, no arbitrary record bag, no mutable
 *     array.
 *   - This file defines a TYPE ONLY — no function, no class, no
 *     construction logic, no DID/AT-URI/CID parsing logic of any kind.
 */

export interface FedosValidatedAtprotoPost {
  readonly uri: string;
  readonly cid: string;
  readonly authorDid: string;
  /** Plain UTF-8 text by Lexicon schema design — no HTML-normalization concern. See Alpha 282 §5. */
  readonly text: string;
  /** Unix seconds, matching `FedosBoardPost.createdAt`. */
  readonly createdAt: number;
  /** The thread root record's AT URI, or `null` for a root post. */
  readonly replyRootUri: string | null;
  /** The direct parent record's AT URI, or `null` for a root post. */
  readonly replyParentUri: string | null;
}
