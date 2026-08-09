/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * Keyword Index.
 *
 * Full-text-over-plaintext index, keyed by token. Operates ONLY on
 * `FedosConversationSearchEnvelopeDocument.text`
 * (`./fedos_conversation_search_document.ts`) — an already-decrypted
 * string the CALLER supplies; see that file's own header for the
 * plaintext boundary this Arc names and does not cross. `text: null`
 * indexes nothing for that document — never an error, never a
 * placeholder token.
 *
 * Tokenization is intentionally minimal and Unicode-aware (`\p{L}`/
 * `\p{N}`, lower-cased): every maximal run of letters/digits is one
 * token, everything else is a separator. No stemming, no stop-word
 * list, no language-specific normalization — a future Arc's own scope
 * if ever needed; this Arc's own instruction is a search INDEX, not a
 * search-relevance engine.
 *
 * `search()` is AND-semantics across every token in the query (a
 * result must contain every query token, not merely one) — the
 * smallest honest contract for a "keyword index," matching this
 * codebase's own "no field/method that overpromises" discipline
 * elsewhere (e.g. `FedosPayloadRetentionAuthority`'s own Security
 * Claims section, `../retention/fedos_payload_retention_authority.ts`).
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state — every instance owns its own Maps.
 *   - `removeDocument()` fully reverses `indexDocument()` — no residual
 *     token→id entry survives a removal (verified by the reverse
 *     `#tokensByEnvelope` map, mirroring
 *     `FedosConversationSearchReplyIndex`'s own parent/child pairing
 *     discipline).
 *   - Query results are returned in a deterministic (sorted) order —
 *     never insertion-order-dependent, never `Set` iteration order
 *     leaked directly.
 */

import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationSearchEnvelopeDocument } from "../../../../conversation/search/fedos_conversation_search_document.js";

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): readonly string[] {
  const matches = text.toLowerCase().match(TOKEN_PATTERN);
  if (matches === null) return [];
  return [...new Set(matches)];
}

export class FedosConversationSearchKeywordIndex {
  readonly #envelopesByToken = new Map<string, Set<FedosConversationEnvelopeId>>();
  readonly #tokensByEnvelope = new Map<FedosConversationEnvelopeId, readonly string[]>();

  indexDocument(doc: FedosConversationSearchEnvelopeDocument): void {
    if (doc.text === null) return;
    const tokens = tokenize(doc.text);
    this.#tokensByEnvelope.set(doc.envelopeId, tokens);
    for (const token of tokens) {
      let bucket = this.#envelopesByToken.get(token);
      if (bucket === undefined) {
        bucket = new Set<FedosConversationEnvelopeId>();
        this.#envelopesByToken.set(token, bucket);
      }
      bucket.add(doc.envelopeId);
    }
  }

  removeDocument(envelopeId: FedosConversationEnvelopeId): void {
    const tokens = this.#tokensByEnvelope.get(envelopeId);
    if (tokens === undefined) return;
    for (const token of tokens) {
      const bucket = this.#envelopesByToken.get(token);
      if (bucket === undefined) continue;
      bucket.delete(envelopeId);
      if (bucket.size === 0) this.#envelopesByToken.delete(token);
    }
    this.#tokensByEnvelope.delete(envelopeId);
  }

  has(envelopeId: FedosConversationEnvelopeId): boolean {
    return this.#tokensByEnvelope.has(envelopeId);
  }

  /** AND-semantics across every token in `query` — see this file's own header. Empty/all-separator query yields an empty result. */
  search(query: string): readonly FedosConversationEnvelopeId[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    let candidates: Set<FedosConversationEnvelopeId> | null = null;
    for (const token of queryTokens) {
      const bucket = this.#envelopesByToken.get(token);
      if (bucket === undefined || bucket.size === 0) return [];
      if (candidates === null) {
        candidates = new Set(bucket);
        continue;
      }
      for (const id of candidates) {
        if (!bucket.has(id)) candidates.delete(id);
      }
      if (candidates.size === 0) return [];
    }
    return [...(candidates ?? new Set<FedosConversationEnvelopeId>())].sort();
  }
}
