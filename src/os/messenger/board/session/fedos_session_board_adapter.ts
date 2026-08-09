/**
 * Secure Runtime Alpha 297 ("Session Board Adapter Implementation") —
 * Stage 7 of the Alpha 291–300 Session Canonical Board Gateway Adapter
 * Arc.
 *
 * The FOURTH and FINAL Protocol Adapter: a pure, one-way, fail-closed
 * translation from an already-Gateway-verified, already-normalized
 * `FedosValidatedSessionPost` (`./fedos_validated_session_post.ts`,
 * Alpha 292) into a `FedosBoardPost` (`../fedos_board_post.js`, Alpha
 * 255). Follows `fedos_board_nostr_adapter.ts` (Alpha 266),
 * `fedos_activitypub_board_adapter.ts` (Alpha 277), and
 * `fedos_atproto_board_adapter.ts` (Alpha 287)'s own shared pattern
 * exactly: a pure mapping step composed with the UNMODIFIED
 * `validateFedosBoardPost` (`../fedos_board_post_validator.js`, Alpha
 * 257). Never the reverse: nothing in this file constructs a Session
 * message, an Oxen network frame, or mutates a Session object of any
 * kind.
 *
 * This Arc's own boundary is the narrowest of the four: it has NO
 * responsibility before the Gateway (Session network, Oxen connection,
 * private keys, encryption/decryption, DM retrieval, storage sync are
 * all explicitly out of scope and absolutely prohibited) and NO
 * responsibility after the Board (persistence, feed, repository are
 * likewise out of scope). This file consumes ONLY the already-normalized
 * input type.
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Nothing here throws.
 *   - No mutation of `post` of any kind.
 *   - No network, no storage, no Relay/Runtime/Worker/Desktop/GUI/
 *     Observation/Session/Oxen access of any kind — a pure, synchronous,
 *     in-memory translation.
 *   - `sessionId` is read only for its own non-emptiness check — it
 *     never appears in the returned `FedosBoardPostInput` (Alpha 296/297
 *     §7).
 *   - Does not duplicate any check `validateFedosBoardPost` already
 *     performs on the assembled input (Alpha 297 §6).
 */

import type { FedosValidatedSessionPost } from "./fedos_validated_session_post.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Maps a `FedosValidatedSessionPost` into a typed `FedosBoardPostInput`
 * (`../fedos_board_post_validator.js`, Alpha 257), WITHOUT running
 * Board validation itself — exposed separately so determinism and
 * boundary-purity tests can exercise the pure mapping step in
 * isolation, mirroring every prior adapter. `boardId` is supplied by
 * the caller, never derived from `post`: Session carries no native
 * "which local board" concept (Alpha 295 §6).
 *
 * Returns `null` (never throws) when any required field is the wrong
 * type or empty, or when `boardId` is empty.
 */
export function mapValidatedSessionPostToBoardPostInput(
  post: FedosValidatedSessionPost,
  boardId: string,
): FedosBoardPostInput | null {
  if (post === null || typeof post !== "object") return null;
  if (!isNonEmptyString(post.messageId)) return null;
  if (!isNonEmptyString(post.sessionId)) return null;
  if (!isNonEmptyString(post.authorId)) return null;
  if (typeof post.body !== "string") return null;
  if (typeof post.createdAt !== "number") return null;
  if (post.replyTo !== null && !isNonEmptyString(post.replyTo)) return null;
  if (!isNonEmptyString(boardId)) return null;

  // Session carries no root information -- the adopted Gateway
  // contract (Alpha 295 §2), applied with no inference of any kind:
  //   replyTo === null -> root (threadId = own id)
  //   replyTo !== null -> threadId = replyTo (the direct parent, not a
  //                        transitively-resolved "true" root)
  const threadId = post.replyTo === null ? post.messageId : post.replyTo;
  const replyTo = post.replyTo;

  return {
    id: post.messageId,
    boardId,
    threadId,
    replyTo,
    author: {
      identityId: null,
      protocol: "session",
      publicIdentifier: post.authorId,
    },
    body: post.body,
    createdAt: post.createdAt,
    source: {
      protocol: "session",
      reference: post.messageId,
    },
  };
}

/**
 * The Session Board Adapter's single public entry point: converts an
 * already-Gateway-verified `FedosValidatedSessionPost` into a
 * `FedosBoardPost`, or `null` if it cannot be honestly represented.
 * Composes `mapValidatedSessionPostToBoardPostInput` (this file,
 * protocol-specific mapping) with `validateFedosBoardPost`
 * (`../fedos_board_post_validator.js`, Alpha 257, protocol-neutral
 * validation) — the SAME two-step boundary `validateNostrBoardPost`
 * (Alpha 266), `validateActivityPubBoardPost` (Alpha 277), and
 * `validateAtprotoBoardPost` (Alpha 287) already established. Performs
 * NO Session network, Oxen connection, cryptographic, or DM-retrieval
 * work of its own: the caller must have already produced `post` via a
 * Gateway layer entirely outside this Arc's own scope.
 */
export function validateSessionBoardPost(
  post: FedosValidatedSessionPost,
  boardId: string,
): FedosBoardPost | null {
  const input = mapValidatedSessionPostToBoardPostInput(post, boardId);
  if (input === null) return null;
  return validateFedosBoardPost(input);
}
