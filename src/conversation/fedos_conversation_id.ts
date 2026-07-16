/**
 * Secure Runtime Alpha 743 ("Conversation ID Type") — Stage 3 of the
 * Alpha 741–760 Canonical Conversation Identity and Record Foundation
 * Arc.
 *
 * Adopts Option B from Alpha 742 ("new opaque Conversation ID with
 * explicit Thread mapping") — an opaque, branded type, DETERMINISTICALLY
 * derived from an already-existing `(FedosBoardId, FedosThreadId)` pair,
 * never randomly minted independent of one. See
 * `docs/secure_runtime_alpha_743_conversation_id_type.md` for the full
 * rationale and why Option A (Conversation ID === Thread ID, no new
 * type) was rejected despite being simpler.
 *
 * HARD GUARDRAILS:
 *   - `FedosConversationId`/`toFedosConversationId` are the ONLY exports.
 *   - No random generation of any kind — `toFedosConversationId` is a
 *     PURE function: the same `(boardId, threadId)` pair always produces
 *     the identical id, and no two DIFFERENT pairs ever collide (see
 *     the separator choice below).
 *   - No protocol-native id (Nostr event id, ActivityPub URI, AT
 *     Protocol record key, Session id) is ever accepted or embedded —
 *     this id is FedOS's own application-level identifier, mirroring
 *     `FedosBoardId`/`FedosThreadId`/`FedosBoardPostId`'s own existing
 *     discipline (`../board/fedos_board_identifiers.ts`).
 *   - No secret material of any kind.
 *   - The branded type is an immutable primitive (`string & brand`) —
 *     never a mutable object.
 */

import type { FedosBoardId, FedosThreadId } from "../board/fedos_board_identifiers.js";

export type FedosConversationId = string & { readonly __brand: "FedosConversationId" };

/**
 * Deterministic construction, mirroring `makeFedosBoardOutboxId()`'s own
 * established `::`-joined convention
 * (`../board/outbox/fedos_board_outbox_types.ts`, Alpha 413) rather than
 * inventing a second id-construction idiom. `boardId`/`threadId` are
 * both non-empty, `::`-free branded strings by construction
 * (`toFedosBoardId`/`toFedosThreadId`, Alpha 252) — no separator
 * collision between the two parts is possible.
 */
export function toFedosConversationId(boardId: FedosBoardId, threadId: FedosThreadId): FedosConversationId {
  return `${boardId}::${threadId}` as FedosConversationId;
}
