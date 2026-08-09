/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * Reply Index.
 *
 * The reply-thread graph over `FedosConversationMessageEnvelope.replyToEnvelopeId`
 * (`../envelope/fedos_conversation_message_envelope.ts`, Alpha 854) —
 * `null` for a root message, otherwise the Envelope id it replies to.
 * Maintains both directions (`parentOf`/`repliesTo`) so a caller never
 * needs to re-scan every document to answer either question.
 *
 * `removeDocument()` deliberately does NOT cascade: removing a parent
 * leaves its children's OWN `replyToEnvelopeId` pointer exactly as it
 * was (now pointing at a removed id) — this mirrors this codebase's
 * own established "no cascading delete" discipline on every
 * append-only-backed port (Board/Envelope/Payload/Membership all
 * accept no delete method at all; `FedosPayloadRetentionAuthority`'s
 * own removal is a gated-read change, never a rewrite of anything
 * downstream). A child's `parentOf()` after its parent is removed
 * simply returns `null` (this index's own record of "no longer an
 * indexed parent"), not a dangling reference to a removed node.
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state.
 *   - `removeDocument()` detaches the removed id from its OWN parent's
 *     children set (no orphaned membership in `#childrenByParent`), and
 *     drops its own children linkage cleanly (see above).
 */

import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationSearchEnvelopeDocument } from "../../../../conversation/search/fedos_conversation_search_document.js";

export class FedosConversationSearchReplyIndex {
  readonly #childrenByParent = new Map<FedosConversationEnvelopeId, Set<FedosConversationEnvelopeId>>();
  readonly #parentByChild = new Map<FedosConversationEnvelopeId, FedosConversationEnvelopeId>();

  indexDocument(doc: FedosConversationSearchEnvelopeDocument): void {
    if (doc.replyToEnvelopeId === null) return;
    this.#parentByChild.set(doc.envelopeId, doc.replyToEnvelopeId);
    let children = this.#childrenByParent.get(doc.replyToEnvelopeId);
    if (children === undefined) {
      children = new Set<FedosConversationEnvelopeId>();
      this.#childrenByParent.set(doc.replyToEnvelopeId, children);
    }
    children.add(doc.envelopeId);
  }

  removeDocument(envelopeId: FedosConversationEnvelopeId): void {
    const parent = this.#parentByChild.get(envelopeId);
    if (parent !== undefined) {
      const siblings = this.#childrenByParent.get(parent);
      if (siblings !== undefined) {
        siblings.delete(envelopeId);
        if (siblings.size === 0) this.#childrenByParent.delete(parent);
      }
      this.#parentByChild.delete(envelopeId);
    }
    this.#childrenByParent.delete(envelopeId);
  }

  /** The Envelope `envelopeId` itself replies to, or `null` for a root message / unknown id. */
  parentOf(envelopeId: FedosConversationEnvelopeId): FedosConversationEnvelopeId | null {
    return this.#parentByChild.get(envelopeId) ?? null;
  }

  /** Every currently-indexed Envelope that replies directly to `envelopeId`, deterministically sorted. */
  repliesTo(envelopeId: FedosConversationEnvelopeId): readonly FedosConversationEnvelopeId[] {
    const children = this.#childrenByParent.get(envelopeId);
    if (children === undefined) return [];
    return [...children].sort();
  }
}
