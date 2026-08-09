/**
 * Secure Runtime Alpha 287 ("AT Protocol Board Adapter Implementation")
 * — Stage 7 of the Alpha 281–290 AT Protocol Canonical Board Adapter
 * Arc.
 *
 * The THIRD Protocol Adapter: a pure, one-way, fail-closed translation
 * from an already-validated, already-normalized
 * `FedosValidatedAtprotoPost` (`./fedos_validated_atproto_post.ts`,
 * Alpha 282) into a `FedosBoardPost` (`../fedos_board_post.js`, Alpha
 * 255). Follows `fedos_board_nostr_adapter.ts` (Alpha 266) and
 * `fedos_activitypub_board_adapter.ts` (Alpha 277)'s own shared pattern
 * exactly: a pure mapping step composed with the UNMODIFIED
 * `validateFedosBoardPost` (`../fedos_board_post_validator.js`, Alpha
 * 257). Never the reverse: nothing in this file constructs an
 * `app.bsky.feed.post` record, a repository write, or mutates an AT
 * Protocol object of any kind.
 *
 * Architecture rule, confirmed by this file's own imports: this Board
 * Adapter consumes ONLY the already-normalized input type — it performs
 * no XRPC call, no DID resolution, no repository/CAR access, and no
 * Lexicon parsing. All of that is a separate, future, out-of-scope
 * layer (this Arc's own "Important Scope Decision").
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Nothing here throws.
 *   - No mutation of `post` of any kind.
 *   - No network, no storage, no Relay/Runtime/Worker/Desktop/GUI/XRPC/
 *     repository access of any kind — a pure, synchronous, in-memory
 *     translation.
 *   - `cid` is read only for its own non-emptiness check — it never
 *     appears in the returned `FedosBoardPostInput` (Alpha 283/287 §7).
 *   - Does not duplicate any check `validateFedosBoardPost` already
 *     performs on the assembled input (Alpha 287 §6).
 */

import type { FedosValidatedAtprotoPost } from "./fedos_validated_atproto_post.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Maps a `FedosValidatedAtprotoPost` into a typed `FedosBoardPostInput`
 * (`../fedos_board_post_validator.js`, Alpha 257), WITHOUT running
 * Board validation itself — exposed separately so determinism and
 * boundary-purity tests can exercise the pure mapping step in
 * isolation, mirroring both prior adapters. `boardId` is supplied by
 * the caller, never derived from `post`: AT Protocol carries no native
 * "which local board" concept (Alpha 286 §5).
 *
 * Returns `null` (never throws) when any required field is the wrong
 * type or empty, when `replyRootUri`/`replyParentUri` form an invalid
 * combination (one present without the other, or a self-root
 * contradiction — Alpha 286 §4), or when `boardId` is empty.
 */
export function mapValidatedAtprotoPostToBoardPostInput(
  post: FedosValidatedAtprotoPost,
  boardId: string,
): FedosBoardPostInput | null {
  if (post === null || typeof post !== "object") return null;
  if (!isNonEmptyString(post.uri)) return null;
  if (!isNonEmptyString(post.cid)) return null;
  if (!isNonEmptyString(post.authorDid)) return null;
  if (typeof post.text !== "string") return null;
  if (typeof post.createdAt !== "number") return null;
  if (post.replyRootUri !== null && !isNonEmptyString(post.replyRootUri)) return null;
  if (post.replyParentUri !== null && !isNonEmptyString(post.replyParentUri)) return null;
  if (!isNonEmptyString(boardId)) return null;

  let threadId: string;
  let replyTo: string | null;

  if (post.replyRootUri === null && post.replyParentUri === null) {
    // Root post (Alpha 286 §2): threadId equals the post's own AT URI.
    threadId = post.uri;
    replyTo = null;
  } else if (post.replyRootUri !== null && post.replyParentUri !== null) {
    // Reply (Alpha 286 §3): AT Protocol supplies root and parent
    // explicitly -- no upstream-resolver deferral is needed, unlike
    // ActivityPub. Reject the one contradictory combination: claiming
    // to be one's own thread root while genuinely replying to a
    // DIFFERENT post (a direct reply to the real root, where
    // replyRootUri === replyParentUri, is valid and NOT rejected here).
    if (post.replyRootUri === post.uri && post.replyParentUri !== post.uri) return null;
    threadId = post.replyRootUri;
    replyTo = post.replyParentUri;
  } else {
    // Root without parent, or parent without root -- both invalid.
    return null;
  }

  return {
    id: post.uri,
    boardId,
    threadId,
    replyTo,
    author: {
      identityId: null,
      protocol: "atproto",
      publicIdentifier: post.authorDid,
    },
    body: post.text,
    createdAt: post.createdAt,
    source: {
      protocol: "atproto",
      reference: post.uri,
    },
  };
}

/**
 * The AT Protocol Board Adapter's single public entry point: converts
 * an already-validated `FedosValidatedAtprotoPost` into a
 * `FedosBoardPost`, or `null` if it cannot be honestly represented.
 * Composes `mapValidatedAtprotoPostToBoardPostInput` (this file,
 * protocol-specific mapping) with `validateFedosBoardPost`
 * (`../fedos_board_post_validator.js`, Alpha 257, protocol-neutral
 * validation) — the SAME two-step boundary `validateNostrBoardPost`
 * (Alpha 266) and `validateActivityPubBoardPost` (Alpha 277) already
 * established. Performs NO DID resolution, XRPC call, or repository
 * access of its own: the caller must have already produced `post` via
 * a (future, out-of-scope) AT Protocol transport/validation/
 * normalization layer.
 */
export function validateAtprotoBoardPost(
  post: FedosValidatedAtprotoPost,
  boardId: string,
): FedosBoardPost | null {
  const input = mapValidatedAtprotoPostToBoardPostInput(post, boardId);
  if (input === null) return null;
  return validateFedosBoardPost(input);
}
