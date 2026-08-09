/**
 * Secure Runtime Alpha 277 ("ActivityPub Board Adapter Implementation")
 * — Stage 7 of the Alpha 271–280 ActivityPub Canonical Board Adapter
 * Arc.
 *
 * The SECOND Protocol Adapter: a pure, one-way, fail-closed translation
 * from an already-normalized, already-authenticated
 * `FedosValidatedActivityPubPost` (`./fedos_validated_activitypub_post.ts`,
 * Alpha 272) into a `FedosBoardPost` (`../fedos_board_post.js`, Alpha
 * 255). Follows `fedos_board_nostr_adapter.ts`'s own pattern (Alpha
 * 266) exactly: a pure mapping step composed with the UNMODIFIED
 * `validateFedosBoardPost` (`../fedos_board_post_validator.js`, Alpha
 * 257). Never the reverse: nothing in this file constructs or mutates
 * an ActivityPub object of any kind.
 *
 * Architecture rule, confirmed by this file's own imports: this Board
 * Adapter consumes ONLY the already-normalized input type — it performs
 * no HTTP, no signature verification, no Actor resolution, no JSON-LD
 * parsing, and no content normalization of its own. All of that is a
 * separate, future, out-of-scope layer (this Arc's own "Important Scope
 * Decision").
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Nothing here throws.
 *   - No mutation of `post` of any kind.
 *   - No network, no storage, no Relay/Runtime/Worker/Desktop/GUI/HTTP
 *     access of any kind — a pure, synchronous, in-memory translation.
 *   - No HTML parser or sanitizer: the one markup guard below performs
 *     no tokenization, no tag-tree construction, and produces no
 *     transformed output — see Alpha 275 §4.
 *   - Does not duplicate any check `validateFedosBoardPost` already
 *     performs on the assembled input (Alpha 277 §6).
 */

import type { FedosValidatedActivityPubPost } from "./fedos_validated_activitypub_post.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * A deliberately minimal, non-parsing fail-closed backstop: rejects any
 * content that still carries a raw `<`/`>` character, since no safe
 * upstream HTML-to-plain-text normalizer exists in this repository yet
 * (Alpha 271 §3.5, Alpha 275 §4). This is NOT an HTML parser or
 * sanitizer — it performs no transformation and has exactly two
 * possible outcomes: accept the string unchanged, or reject the whole
 * post.
 */
function containsRawMarkupCharacter(content: string): boolean {
  return content.includes("<") || content.includes(">");
}

/**
 * Maps a `FedosValidatedActivityPubPost` into a typed
 * `FedosBoardPostInput` (`../fedos_board_post_validator.js`, Alpha 257),
 * WITHOUT running Board validation itself — exposed separately so
 * determinism and boundary-purity tests can exercise the pure mapping
 * step in isolation, mirroring `mapValidatedNostrEventToBoardPostInput`
 * (`../fedos_board_nostr_adapter.js`, Alpha 266). `boardId` is supplied
 * by the caller, never derived from `post`: ActivityPub carries no
 * native "which local board" concept (Alpha 276 §6).
 *
 * Returns `null` (never throws) when any required field is the wrong
 * type or empty, when `content` still carries a raw `<`/`>` character
 * (Alpha 275 §4), or when `inReplyTo` is present without a resolved
 * `conversationRoot` (Alpha 276 §4, "Option C").
 */
export function mapValidatedActivityPubPostToBoardPostInput(
  post: FedosValidatedActivityPubPost,
  boardId: string,
): FedosBoardPostInput | null {
  if (post === null || typeof post !== "object") return null;
  if (!isNonEmptyString(post.objectId)) return null;
  if (!isNonEmptyString(post.actorId)) return null;
  if (typeof post.content !== "string") return null;
  if (typeof post.published !== "number") return null;
  if (post.inReplyTo !== null && !isNonEmptyString(post.inReplyTo)) return null;
  if (post.conversationRoot !== null && !isNonEmptyString(post.conversationRoot)) return null;
  if (!isNonEmptyString(boardId)) return null;

  if (containsRawMarkupCharacter(post.content)) return null;

  let threadId: string;
  let replyTo: string | null;

  if (post.inReplyTo === null) {
    // Root post (Alpha 276 §2): threadId equals the post's own id.
    threadId = post.objectId;
    replyTo = null;
  } else {
    // Reply (Alpha 276 §3-4): conversationRoot MUST already be
    // resolved by an upstream layer -- this adapter never performs
    // network resolution and never guesses a provisional root.
    if (post.conversationRoot === null) return null;
    threadId = post.conversationRoot;
    replyTo = post.inReplyTo;
  }

  return {
    id: post.objectId,
    boardId,
    threadId,
    replyTo,
    author: {
      identityId: null,
      protocol: "activitypub",
      publicIdentifier: post.actorId,
    },
    body: post.content,
    createdAt: post.published,
    source: {
      protocol: "activitypub",
      reference: post.objectId,
    },
  };
}

/**
 * The ActivityPub Board Adapter's single public entry point: converts
 * an already-normalized `FedosValidatedActivityPubPost` into a
 * `FedosBoardPost`, or `null` if it cannot be honestly represented.
 * Composes `mapValidatedActivityPubPostToBoardPostInput` (this file,
 * protocol-specific mapping) with `validateFedosBoardPost`
 * (`../fedos_board_post_validator.js`, Alpha 257, protocol-neutral
 * validation) — the SAME two-step boundary `validateNostrBoardPost`
 * (`../fedos_board_nostr_adapter.js`, Alpha 266) already established.
 * Performs NO signature verification, Actor resolution, or HTTP call of
 * its own: the caller must have already produced `post` via a (future,
 * out-of-scope) ActivityPub transport/validation/normalization layer.
 */
export function validateActivityPubBoardPost(
  post: FedosValidatedActivityPubPost,
  boardId: string,
): FedosBoardPost | null {
  const input = mapValidatedActivityPubPostToBoardPostInput(post, boardId);
  if (input === null) return null;
  return validateFedosBoardPost(input);
}
