/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") — Date
 * Index.
 *
 * `createdAt` (Unix seconds, matching every other timestamp convention
 * in this codebase) → the set of Envelope ids created at that exact
 * second, plus the reverse map a clean `removeDocument()` needs.
 * `envelopesBetween()` is an inclusive range scan, returned in
 * deterministic `(createdAt, envelopeId)` order — never a `Map`
 * iteration order leaked directly, and never assumes insertion order
 * happened to be chronological (a restored Archive or a bulk rebuild
 * commonly is not).
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state.
 *   - `removeDocument()` fully reverses `indexDocument()`.
 */

import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationSearchEnvelopeDocument } from "../../../../conversation/search/fedos_conversation_search_document.js";

export class FedosConversationSearchDateIndex {
  readonly #envelopesByCreatedAt = new Map<number, Set<FedosConversationEnvelopeId>>();
  readonly #createdAtByEnvelope = new Map<FedosConversationEnvelopeId, number>();

  indexDocument(doc: FedosConversationSearchEnvelopeDocument): void {
    let bucket = this.#envelopesByCreatedAt.get(doc.createdAt);
    if (bucket === undefined) {
      bucket = new Set<FedosConversationEnvelopeId>();
      this.#envelopesByCreatedAt.set(doc.createdAt, bucket);
    }
    bucket.add(doc.envelopeId);
    this.#createdAtByEnvelope.set(doc.envelopeId, doc.createdAt);
  }

  removeDocument(envelopeId: FedosConversationEnvelopeId): void {
    const createdAt = this.#createdAtByEnvelope.get(envelopeId);
    if (createdAt === undefined) return;
    const bucket = this.#envelopesByCreatedAt.get(createdAt);
    if (bucket !== undefined) {
      bucket.delete(envelopeId);
      if (bucket.size === 0) this.#envelopesByCreatedAt.delete(createdAt);
    }
    this.#createdAtByEnvelope.delete(envelopeId);
  }

  createdAtOf(envelopeId: FedosConversationEnvelopeId): number | null {
    return this.#createdAtByEnvelope.get(envelopeId) ?? null;
  }

  /** Inclusive range scan, deterministic `(createdAt, envelopeId)` order. */
  envelopesBetween(fromInclusive: number, toInclusive: number): readonly FedosConversationEnvelopeId[] {
    const results: { readonly createdAt: number; readonly envelopeId: FedosConversationEnvelopeId }[] = [];
    for (const [createdAt, bucket] of this.#envelopesByCreatedAt) {
      if (createdAt < fromInclusive || createdAt > toInclusive) continue;
      for (const envelopeId of bucket) results.push({ createdAt, envelopeId });
    }
    results.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.envelopeId < b.envelopeId ? -1 : 1));
    return results.map((entry) => entry.envelopeId);
  }
}
