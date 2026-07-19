/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * `FedosConversationSearchIndex`, the top-level facade (satisfies the
 * "search index" scope item) composing every sub-index in this
 * directory: Incremental (`./fedos_conversation_search_incremental_index.ts`),
 * Keyword (`./fedos_conversation_search_keyword_index.ts`), Date
 * (`./fedos_conversation_search_date_index.ts`), Reply
 * (`./fedos_conversation_search_reply_index.ts`), Participant
 * (`./fedos_conversation_search_participant_index.ts`), Mode/Group/Direct
 * (`./fedos_conversation_search_mode_index.ts`), and Archive
 * (`./fedos_conversation_search_archive_index.ts`).
 *
 * REUSES Conversation Runtime directly: `FedosConversationSearchIndexDependencies`
 * is a `Pick` of the SAME `FedosConversationRuntimeDependencies`
 * (`../runtime/fedos_conversation_runtime.ts`, Alpha 921–930) shape —
 * `draftPersistence` and `membershipAuthority` — rather than a
 * separately-declared, merely same-shaped lookalike; a caller already
 * holding a `FedosConversationRuntimeDependencies` (e.g. from
 * `assembleFedosConversationRuntimeDependencies()`,
 * `../runtime/fedos_conversation_runtime_assembly.ts`) can pass it
 * straight through.
 *
 * NO NEW PERSISTENCE: this Arc introduces no new durable port, log, or
 * file of any kind. `FedosConversationSearchIndex` is a pure,
 * rebuildable, IN-MEMORY structure over already-durable data (Envelope,
 * Membership, Draft, Archive) — mirroring `FedosBoardService`'s own
 * hydration-time index-rebuild precedent (`../../board/`) and
 * `FedosConversationReader`'s own Alpha 753 finding that a derived
 * index needs no persistence of its own when the source of truth
 * already durably exists elsewhere. Concretely: after a restart, a
 * freshly constructed instance fed the identical source Envelopes (via
 * `indexEnvelope`/`indexEnvelopes`) and/or the identical restored
 * Archive Bundles (via `indexArchiveBundle`) reproduces IDENTICAL query
 * results — there is no hidden index-only state that could ever drift
 * from source.
 *
 * `indexEnvelope`/`indexEnvelopes`/`indexArchiveBundle` are all
 * INCREMENTAL and IDEMPOTENT — driven through
 * `FedosConversationSearchIncrementalIndex`'s own dedup guard, so
 * indexing the same Envelope id twice (whether directly or via two
 * overlapping Archive Bundles) is a documented `"duplicate"`, never a
 * double-counted keyword hit or date/participant bucket entry.
 * `removeEnvelope()` is the one mutation this facade performs beyond
 * indexing — it purges the id from every content/metadata sub-index
 * AND reopens it in the Incremental guard, so a later legitimate
 * re-index of the SAME id is correctly `"indexed"`, not mistakenly
 * treated as a duplicate of the removed entry.
 *
 * HARD GUARDRAILS:
 *   - Never mutates any injected dependency (`draftPersistence`,
 *     `membershipAuthority`) — read-only consumer of both.
 *   - No network, no file, no timer, no `process.env` read.
 *   - Every query method returns a deterministically-ordered result —
 *     never raw `Map`/`Set` iteration order.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosPrivateConversationMode } from "../construction/fedos_private_conversation_id.js";
import type { FedosConversationArchiveBundleV1 } from "../archive/fedos_conversation_archive_bundle.js";
import type { FedosConversationRuntimeDependencies } from "../runtime/fedos_conversation_runtime.js";
import type { FedosConversationSearchEnvelopeDocument } from "./fedos_conversation_search_document.js";
import { FedosConversationSearchIncrementalIndex } from "./fedos_conversation_search_incremental_index.js";
import { FedosConversationSearchKeywordIndex } from "./fedos_conversation_search_keyword_index.js";
import { FedosConversationSearchDateIndex } from "./fedos_conversation_search_date_index.js";
import { FedosConversationSearchReplyIndex } from "./fedos_conversation_search_reply_index.js";
import { FedosConversationSearchParticipantIndex } from "./fedos_conversation_search_participant_index.js";
import { FedosConversationSearchModeIndex } from "./fedos_conversation_search_mode_index.js";
import {
  FedosConversationSearchArchiveIndex,
  fedosConversationSearchDocumentsFromArchiveBundle,
} from "./fedos_conversation_search_archive_index.js";

/** The concrete "Reuse Conversation Runtime" tie-in — see this file's own header. */
export type FedosConversationSearchIndexDependencies = Pick<
  FedosConversationRuntimeDependencies,
  "draftPersistence" | "membershipAuthority"
>;

/** One Envelope plus its already-decrypted text, if available — see `fedos_conversation_search_document.ts`'s own plaintext boundary. */
export interface FedosConversationSearchEnvelopeInput {
  readonly envelope: FedosConversationMessageEnvelope;
  readonly text: string | null;
}

export type FedosConversationSearchIndexOutcome = "indexed" | "duplicate";
export type FedosConversationSearchRemovalOutcome = "removed" | "not-found";

export interface FedosConversationSearchBulkOutcome {
  readonly indexed: number;
  readonly duplicate: number;
}

function documentFromEnvelope(envelope: FedosConversationMessageEnvelope, text: string | null): FedosConversationSearchEnvelopeDocument {
  return {
    envelopeId: envelope.id,
    conversationId: envelope.conversationId,
    senderMembershipId: envelope.senderMembershipId,
    createdAt: envelope.createdAt,
    replyToEnvelopeId: envelope.replyToEnvelopeId,
    text,
  };
}

export class FedosConversationSearchIndex {
  readonly #incremental = new FedosConversationSearchIncrementalIndex();
  readonly #keyword = new FedosConversationSearchKeywordIndex();
  readonly #date = new FedosConversationSearchDateIndex();
  readonly #reply = new FedosConversationSearchReplyIndex();
  readonly #participant: FedosConversationSearchParticipantIndex;
  readonly #mode: FedosConversationSearchModeIndex;
  readonly #archive = new FedosConversationSearchArchiveIndex();

  constructor(deps: FedosConversationSearchIndexDependencies) {
    this.#participant = new FedosConversationSearchParticipantIndex({ membershipAuthority: deps.membershipAuthority });
    this.#mode = new FedosConversationSearchModeIndex({ draftPersistence: deps.draftPersistence });
  }

  #ingest(doc: FedosConversationSearchEnvelopeDocument): FedosConversationSearchIndexOutcome {
    if (!this.#incremental.shouldIndex(doc.envelopeId)) return "duplicate";
    this.#keyword.indexDocument(doc);
    this.#date.indexDocument(doc);
    this.#reply.indexDocument(doc);
    this.#participant.indexDocument(doc);
    this.#mode.indexConversation(doc.conversationId);
    this.#incremental.markIndexed(doc.envelopeId);
    return "indexed";
  }

  /** Incremental, idempotent — see this file's own header. */
  indexEnvelope(input: FedosConversationSearchEnvelopeInput): FedosConversationSearchIndexOutcome {
    return this.#ingest(documentFromEnvelope(input.envelope, input.text));
  }

  indexEnvelopes(inputs: readonly FedosConversationSearchEnvelopeInput[]): FedosConversationSearchBulkOutcome {
    let indexed = 0;
    let duplicate = 0;
    for (const input of inputs) {
      if (this.indexEnvelope(input) === "indexed") indexed += 1;
      else duplicate += 1;
    }
    return { indexed, duplicate };
  }

  /** Reuses Archive (`../archive/`) — see this file's own header. `restoredAt` is Unix seconds. */
  indexArchiveBundle(
    bundle: FedosConversationArchiveBundleV1,
    plaintextByEnvelopeId: ReadonlyMap<string, string>,
    restoredAt: number,
  ): FedosConversationSearchBulkOutcome {
    const documents = fedosConversationSearchDocumentsFromArchiveBundle(bundle, plaintextByEnvelopeId);
    let indexed = 0;
    let duplicate = 0;
    for (const doc of documents) {
      if (this.#ingest(doc) === "indexed") indexed += 1;
      else duplicate += 1;
    }
    this.#archive.recordRestoredConversation(bundle.conversationId as FedosConversationId, restoredAt);
    return { indexed, duplicate };
  }

  /** Purges `envelopeId` from every content/metadata sub-index and reopens it for a future legitimate re-index — see this file's own header. */
  removeEnvelope(envelopeId: FedosConversationEnvelopeId): FedosConversationSearchRemovalOutcome {
    if (!this.#incremental.isIndexed(envelopeId)) return "not-found";
    this.#keyword.removeDocument(envelopeId);
    this.#date.removeDocument(envelopeId);
    this.#reply.removeDocument(envelopeId);
    this.#participant.removeDocument(envelopeId);
    this.#incremental.markRemoved(envelopeId);
    return "removed";
  }

  searchKeyword(query: string): readonly FedosConversationEnvelopeId[] {
    return this.#keyword.search(query);
  }

  envelopesBetween(fromInclusive: number, toInclusive: number): readonly FedosConversationEnvelopeId[] {
    return this.#date.envelopesBetween(fromInclusive, toInclusive);
  }

  repliesTo(envelopeId: FedosConversationEnvelopeId): readonly FedosConversationEnvelopeId[] {
    return this.#reply.repliesTo(envelopeId);
  }

  parentOf(envelopeId: FedosConversationEnvelopeId): FedosConversationEnvelopeId | null {
    return this.#reply.parentOf(envelopeId);
  }

  envelopesByParticipant(participant: FedosConversationParticipantReference): readonly FedosConversationEnvelopeId[] {
    return this.#participant.envelopesByParticipant(participant);
  }

  conversationsByParticipant(participant: FedosConversationParticipantReference): readonly FedosConversationId[] {
    return this.#participant.conversationsByParticipant(participant);
  }

  modeOf(conversationId: FedosConversationId): FedosPrivateConversationMode | null {
    return this.#mode.modeOf(conversationId);
  }

  directConversationIds(): readonly FedosConversationId[] {
    return this.#mode.directConversationIds();
  }

  groupConversationIds(): readonly FedosConversationId[] {
    return this.#mode.groupConversationIds();
  }

  isFromArchive(conversationId: FedosConversationId): boolean {
    return this.#archive.isFromArchive(conversationId);
  }

  archivedConversationIds(): readonly FedosConversationId[] {
    return this.#archive.archivedConversationIds();
  }

  /** Count of currently-indexed (not removed) Envelopes. */
  size(): number {
    return this.#incremental.size();
  }
}
