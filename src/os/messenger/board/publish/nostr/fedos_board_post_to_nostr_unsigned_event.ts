/**
 * Secure Runtime Alpha 703 ("Canonical Board-to-Nostr Mapping Recheck") —
 * Stage 3 of Phase B of the Alpha 681–720 Nostr Identity Binding &
 * Outbound Delivery Activation Arc.
 *
 * The ONE missing link Alpha 701's inventory found: every piece of the
 * Nostr Outbox→Publisher→Relay chain already existed (Alpha 451–500), but
 * no production code ever mapped a `FedosBoardPost`
 * (`../../fedos_board_post.js`) into a `FedosNostrUnsignedEventRequest`
 * (`../../../nostr/sign/fedos_nostr_signing_authority.js`) for the
 * Signing Authority to sign. This file is that mapping.
 *
 * Mapping (deterministic, pure):
 *   - `content` <- `post.body` verbatim.
 *   - `createdAt` <- `post.createdAt` verbatim (already Unix seconds,
 *     matching `FedosNostrUnsignedEventRequest`'s own field).
 *   - `kind` <- fixed `1` (Alpha 424's own V1 scope decision, unchanged).
 *   - `accountIndex` <- the caller-supplied, explicit account index
 *     (never inferred from `post.author` — Alpha 689).
 *   - `tags` <- `[]` for EVERY post in V1, including replies. A real
 *     NIP-01 reply "e" tag would need the PARENT post's own previously
 *     delivered Nostr event id, which requires a postId-keyed Delivery
 *     Observation lookup this codebase does not expose today
 *     (`FedosDeliveryObservationRepository` exposes `get(id)`/`list()`
 *     only, keyed by intent/event id, not by `FedosBoardPostId`). This is
 *     an honest, disclosed V1 gap — never a silently wrong or fabricated
 *     tag — left for a future Arc with a demonstrated need (see Alpha
 *     720's own recommendation).
 *
 * `post.author`/`post.id`/`post.threadId`/`post.source` are deliberately
 * NEVER read here — this file trusts the caller (`FedosSigningAuthorityBoardPostEventSource`,
 * Alpha 704) to have already confirmed eligibility and binding
 * (Phase A) before ever reaching this mapping. No imported-author
 * impersonation path exists here: this function does not even look at
 * who the author is.
 */

import type { FedosBoardPost } from "../../fedos_board_post.js";
import type { FedosNostrUnsignedEventRequest } from "../../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";

const NOSTR_POST_KIND = 1;

export function boardPostToNostrUnsignedEventRequest(
  post: FedosBoardPost,
  accountIndex: number,
): FedosNostrUnsignedEventRequest {
  return Object.freeze({
    accountIndex,
    createdAt: post.createdAt,
    kind: NOSTR_POST_KIND,
    tags: Object.freeze([]),
    content: post.body,
  });
}
