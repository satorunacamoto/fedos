/**
 * Secure Runtime Alpha 272 ("Normalized ActivityPub Post Model") —
 * Stage 2 of the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.
 *
 * The smallest immutable, protocol-specific input model the ActivityPub
 * Board Adapter (`./fedos_activitypub_board_adapter.ts`, Alpha 277)
 * consumes. Mirrors `FedosValidatedNostrEvent`'s own construction
 * discipline (`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242):
 * "validated upstream by convention and module placement," not by a
 * runtime brand. This Arc's own scope decision is fixed by this type's
 * very existence: the Board Adapter accepts ONLY an already-normalized,
 * already-authenticated ActivityPub input — never a raw Activity
 * envelope, raw HTTP headers, or an HTTP Signature object.
 *
 * DECISION (Alpha 272 §4): `content` is contractually **sanitized plain
 * text** (Option A of this Arc's own three-way choice) — the ONLY
 * option consistent with `FedosBoardPost.body`'s existing plain-text-only
 * contract (Alpha 255) and with this Arc's own prohibition on adding an
 * HTML parser or sanitizer. No safe upstream plain-text normalizer
 * exists in this repository yet (Alpha 271 §3.5) — constructing a real,
 * live value of this type is explicitly out of this Arc's own scope;
 * this file ships the CONTRACT such a future normalizer must satisfy.
 *
 * HARD GUARDRAILS:
 *   - `FedosValidatedActivityPubPost` is the ONLY export.
 *   - Every field is `readonly` — no mutation method or setter of any
 *     kind, and no field may ever be reassigned after construction.
 *   - Exactly six fields — no raw Activity object, no raw HTTP headers,
 *     no HTTP Signature object, no OAuth/access token, no session
 *     cookie, no `@context`/arbitrary JSON-LD graph, no mutable array,
 *     no metadata bag.
 *   - This file defines a TYPE ONLY — no function, no class, no
 *     construction logic, no HTML parsing/sanitization logic of any
 *     kind.
 */

export interface FedosValidatedActivityPubPost {
  readonly objectId: string;
  readonly actorId: string;
  /** Already sanitized plain text — HTML-free, by upstream contract. See Alpha 272 §4–5. */
  readonly content: string;
  /** Unix seconds, matching `FedosBoardPost.createdAt`. */
  readonly published: number;
  /** The direct parent object id, or `null` for a root post. */
  readonly inReplyTo: string | null;
  /** The thread root object id, required whenever `inReplyTo` is non-null. See Alpha 276. */
  readonly conversationRoot: string | null;
}
