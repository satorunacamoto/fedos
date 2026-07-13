/**
 * Secure Runtime Alpha 255 ("Canonical Board Post Model") — Stage 5 of
 * the Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * The minimum IMMUTABLE shape shared by a post arriving from Nostr,
 * ActivityPub, AT Protocol, or a Session gateway, once a (future,
 * out-of-scope) Protocol Adapter has mapped a verified native object into
 * it. This is NOT a Nostr Event wrapper — see Alpha 251's own inventory
 * doc for why none of this repository's existing label-only descriptors
 * (`src/social/event.ts`, `src/thread/types.ts`) could be reused as-is:
 * those carry no `body`/`content` field by design, while a Canonical
 * Board Post must.
 *
 * DECISION (Alpha 255): no `title`/`subject` field this Arc — see Alpha
 * 256's own design doc for the thread-root title-policy decision. No
 * `attachments`, `contentWarning`, `language`, `editedAt`, or
 * `deletedAt` field either — none is required by this Arc's own four
 * entry paths (Alpha 259), and speculative fields are explicitly
 * disallowed by this Arc's own instruction.
 *
 * HARD GUARDRAILS:
 *   - Every field is `readonly`; this type carries no mutation method or
 *     setter of any kind, and no field may ever be reassigned after
 *     construction.
 *   - NO transport object embedded: no Nostr tags, no ActivityPub
 *     Activity, no ATProto record, no Session message object.
 *   - `body` is plain text ONLY for this Arc — HTML/Markdown
 *     interpretation and attachment bytes are explicitly out of scope
 *     (Alpha 260).
 *   - Only a validator (`./fedos_board_post_validator.ts`, Alpha 257) may
 *     construct a value of this type, by convention and module placement
 *     — the same discipline `FedosValidatedNostrEvent`
 *     (`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242) already
 *     established for validated Nostr events.
 */

import type { FedosBoardAuthorReference } from "./fedos_board_author.js";
import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "./fedos_board_identifiers.js";
import type { FedosBoardSourceReference } from "./fedos_board_source.js";

export interface FedosBoardPost {
  readonly id: FedosBoardPostId;
  readonly boardId: FedosBoardId;
  /** The root post's identity for this post's thread. See Alpha 256 for thread/root/reply semantics. */
  readonly threadId: FedosThreadId;
  /** Direct parent post, or `null` for a thread root. */
  readonly replyTo: FedosBoardPostId | null;
  readonly author: FedosBoardAuthorReference;
  /** Plain text only. HTML/Markdown interpretation is out of scope for this Arc. */
  readonly body: string;
  /** Unix seconds, matching `FedosEventDescriptor.createdAt`/`FedosValidatedNostrEvent.created_at`. */
  readonly createdAt: number;
  readonly source: FedosBoardSourceReference;
}
