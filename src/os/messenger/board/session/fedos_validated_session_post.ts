/**
 * Secure Runtime Alpha 292 ("Normalized Session Post Model") — Stage 2
 * of the Alpha 291–300 Session Canonical Board Gateway Adapter Arc.
 *
 * The smallest immutable, protocol-specific input model the Session
 * Board Adapter (`./fedos_session_board_adapter.ts`, Alpha 297)
 * consumes. Mirrors `FedosValidatedNostrEvent`'s
 * (`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242),
 * `FedosValidatedActivityPubPost`'s
 * (`../activitypub/fedos_validated_activitypub_post.ts`, Alpha 272),
 * and `FedosValidatedAtprotoPost`'s
 * (`../atproto/fedos_validated_atproto_post.ts`, Alpha 282) own
 * construction discipline: "validated upstream by convention and module
 * placement," not by a runtime brand. This Arc's own scope decision is
 * fixed by this type's very existence: the Board Adapter accepts ONLY
 * an already-Gateway-verified, already-normalized Session input — this
 * Arc has NO responsibility for the Session network, Oxen connection,
 * private keys, encryption/decryption, DM retrieval, or storage sync
 * that must already have happened before this type is ever constructed.
 *
 * `sessionId` is retained here (Alpha 292 §3) but is NEVER copied onto
 * `FedosBoardAuthorReference`, `FedosBoardSourceReference`, or anywhere
 * else on `FedosBoardPost` — only `authorId` (Alpha 293) and
 * `messageId` (Alpha 296) cross that boundary.
 *
 * HARD GUARDRAILS:
 *   - `FedosValidatedSessionPost` is the ONLY export.
 *   - Every field is `readonly` — no mutation method or setter of any
 *     kind, and no field may ever be reassigned after construction.
 *   - Exactly six fields — no Attachment, Group, Reaction, Voice, or
 *     Typing field of any kind, no raw Session/Oxen protocol object, no
 *     auth/session credential, no arbitrary payload bag.
 *   - This file defines a TYPE ONLY — no function, no class, no
 *     construction logic, no Session/Oxen network or cryptography logic
 *     of any kind.
 */

export interface FedosValidatedSessionPost {
  readonly messageId: string;
  /** Gateway-scoped ingestion-session reference — retained, never carried onto FedosBoardPost. See Alpha 292 §3. */
  readonly sessionId: string;
  readonly authorId: string;
  /** Plain text — no rich content shape. See Alpha 294. */
  readonly body: string;
  /** Unix seconds, matching `FedosBoardPost.createdAt`. */
  readonly createdAt: number;
  /** The direct parent message id, or `null` for a root post. See Alpha 295's own Gateway contract. */
  readonly replyTo: string | null;
}
