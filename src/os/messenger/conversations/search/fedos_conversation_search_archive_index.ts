/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * Archive Index.
 *
 * REUSES Archive (`../archive/fedos_conversation_archive_bundle.ts`,
 * Alpha 1541–1610) two ways:
 *
 *   1. `fedosConversationSearchDocumentsFromArchiveBundle()` converts a
 *      `FedosConversationArchiveBundleV1`'s own already-collected
 *      `envelopes` (persisted wire records) into indexable
 *      `FedosConversationSearchEnvelopeDocument`s
 *      (`./fedos_conversation_search_document.ts`), reusing the
 *      EXISTING `deserializeFedosConversationMessageEnvelope` codec
 *      verbatim (`../envelope/persistence/fedos_conversation_message_envelope_codec.ts`,
 *      Alpha 858) — this file invents no new envelope validation of its
 *      own, mirroring `fedos_conversation_archive_restore.ts`'s own
 *      "deep-validate via the record's own existing codec" discipline.
 *      A malformed envelope record is silently skipped (never thrown),
 *      matching Restore's own "a partially-invalid Archive should not
 *      block the rest" precedent. Plaintext (see
 *      `fedos_conversation_search_document.ts`'s own boundary header)
 *      is supplied by the caller per envelope id, keyed by the RAW
 *      string id (a bundle's own envelope records are plain wire
 *      shapes, not yet branded) — never derived from anything in the
 *      Bundle itself, which carries no plaintext.
 *
 *   2. `FedosConversationSearchArchiveIndex` tracks WHICH conversation
 *      ids in the search index were populated by a restored Archive —
 *      distinct from a conversation whose Envelopes were indexed
 *      organically as they were sent/received — so a caller can answer
 *      "did this conversation's history arrive via Archive Restore?"
 *      without re-deriving it from anything else.
 *
 * HARD GUARDRAILS:
 *   - `fedosConversationSearchDocumentsFromArchiveBundle()` never
 *     throws and never mutates `bundle`.
 *   - `FedosConversationSearchArchiveIndex` holds no durable state of
 *     its own — a pure, rebuildable, in-memory record, exactly like
 *     every sibling index in this directory.
 */

import { deserializeFedosConversationMessageEnvelope } from "../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationArchiveBundleV1 } from "../../../../conversation/archive/fedos_conversation_archive_bundle.js";
import type { FedosConversationSearchEnvelopeDocument } from "../../../../conversation/search/fedos_conversation_search_document.js";

/**
 * Converts every valid Envelope in `bundle` into a search document.
 * `plaintextByEnvelopeId` is keyed by the Envelope's raw string id;
 * an id absent from that map indexes with `text: null` (see
 * `fedos_conversation_search_document.ts`'s own plaintext boundary).
 */
export function fedosConversationSearchDocumentsFromArchiveBundle(
  bundle: FedosConversationArchiveBundleV1,
  plaintextByEnvelopeId: ReadonlyMap<string, string>,
): readonly FedosConversationSearchEnvelopeDocument[] {
  const documents: FedosConversationSearchEnvelopeDocument[] = [];
  for (const raw of bundle.envelopes) {
    const envelope = deserializeFedosConversationMessageEnvelope(raw);
    if (envelope === null) continue;
    documents.push({
      envelopeId: envelope.id,
      conversationId: envelope.conversationId,
      senderMembershipId: envelope.senderMembershipId,
      createdAt: envelope.createdAt,
      replyToEnvelopeId: envelope.replyToEnvelopeId,
      text: plaintextByEnvelopeId.get(envelope.id) ?? null,
    });
  }
  return documents;
}

export class FedosConversationSearchArchiveIndex {
  readonly #restoredAtByConversation = new Map<FedosConversationId, number>();

  /** Unix seconds `restoredAt`, matching every other timestamp convention in this codebase. */
  recordRestoredConversation(conversationId: FedosConversationId, restoredAt: number): void {
    this.#restoredAtByConversation.set(conversationId, restoredAt);
  }

  forgetConversation(conversationId: FedosConversationId): void {
    this.#restoredAtByConversation.delete(conversationId);
  }

  isFromArchive(conversationId: FedosConversationId): boolean {
    return this.#restoredAtByConversation.has(conversationId);
  }

  restoredAt(conversationId: FedosConversationId): number | null {
    return this.#restoredAtByConversation.get(conversationId) ?? null;
  }

  /** Every currently-recorded archive-sourced conversation id, deterministically sorted. */
  archivedConversationIds(): readonly FedosConversationId[] {
    return [...this.#restoredAtByConversation.keys()].sort();
  }
}
