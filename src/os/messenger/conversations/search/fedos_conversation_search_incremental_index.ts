/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * Incremental Index.
 *
 * The dedup/progress guard every other sub-index in this directory is
 * driven through — never a sub-index of message content or metadata
 * itself, but the mechanism that makes indexing INCREMENTAL and
 * IDEMPOTENT: `FedosConversationSearchIndex.indexEnvelope()`
 * (`./fedos_conversation_search_index.ts`) calls `shouldIndex()` before
 * touching any other sub-index, so indexing the SAME envelope id twice
 * is a documented no-op (`"duplicate"`), never a double-counted keyword
 * hit, a doubled date-bucket entry, or a doubled participant credit.
 *
 * This same guard is what makes a full rebuild after a restart safe to
 * express as "call `indexEnvelope()` once per already-durable Envelope,
 * in any order, from a freshly constructed
 * `FedosConversationSearchIndex`" — a fresh instance's guard starts
 * empty, so every envelope indexes exactly once, deterministically,
 * regardless of how many times the SOURCE data (Envelope persistence,
 * Membership, drafts, restored Archives) has already been read before.
 *
 * `markRemoved()` is the ONLY way an id becomes indexable again after
 * `shouldIndex()` has returned `false` for it once — an explicit,
 * caller-initiated delete (`FedosConversationSearchIndex.removeEnvelope()`)
 * is NOT the same event as "this id was already indexed"; a legitimate
 * re-index after a delete must not be mistaken for the duplicate case
 * the guard otherwise exists to catch.
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state — every instance owns its own `Set`.
 *   - No durable state of any kind — no new persistence port, no log,
 *     no file. This Arc introduces none (see the execution spec's own
 *     "no new persistence" decision) — every sub-index in this
 *     directory, this one included, is a pure, rebuildable, in-memory
 *     structure over already-durable data.
 */

import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";

export class FedosConversationSearchIncrementalIndex {
  readonly #indexed = new Set<string>();

  /** `true` iff `envelopeId` has never been indexed, or was indexed and then explicitly removed. */
  shouldIndex(envelopeId: FedosConversationEnvelopeId): boolean {
    return !this.#indexed.has(envelopeId);
  }

  isIndexed(envelopeId: FedosConversationEnvelopeId): boolean {
    return this.#indexed.has(envelopeId);
  }

  markIndexed(envelopeId: FedosConversationEnvelopeId): void {
    this.#indexed.add(envelopeId);
  }

  /** Reopens `envelopeId` for a future `indexEnvelope()` call to succeed again, without that later call being mistaken for a duplicate. */
  markRemoved(envelopeId: FedosConversationEnvelopeId): void {
    this.#indexed.delete(envelopeId);
  }

  size(): number {
    return this.#indexed.size;
  }
}
