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
 * `removeEnvelope()` is one mutation this facade performs beyond
 * indexing — it purges the id from every content/metadata sub-index
 * AND reopens it in the Incremental guard, so a later legitimate
 * re-index of the SAME id is correctly `"indexed"`, not mistakenly
 * treated as a duplicate of the removed entry.
 *
 * ---------------------------------------------------------------------
 * Secure Runtime Alpha 2581–2620 ("Conversation Search Retention
 * Authority and Index Purge Hardening") — closes the High-severity
 * retention-gating defect the Private Conversation Search V1 runtime
 * audit found (`docs/reviews/private_conversation_search_runtime_v1/11_retention_bypass_risk_realized.md`),
 * against commit 3b7143f (this Arc) / bec5142 (the audit). Four
 * concrete changes, all confined to THIS file — no other file under
 * `src/conversation/search/` changes:
 *
 *   1. **Ingestion gate.** `FedosConversationSearchIndexDependencies`
 *      gains one narrow, additive dependency: `retentionAuthority`, a
 *      `Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">`
 *      — the pure-preview method ONLY, never `tombstonePayload()`/
 *      `removeLocalPayload()` (Search Runtime never mutates retention
 *      state, mirroring its existing "never mutates `draftPersistence`/
 *      `membershipAuthority`" guardrail) and never `readPayload()`
 *      (Search Runtime still never reads a payload BYTE — it only ever
 *      asks whether the plaintext it was already handed is currently
 *      authorized). `#ingest()` calls `evaluatePayloadAccess(payloadId)`
 *      BEFORE touching any content sub-index; anything other than
 *      `{ outcome: "allowed" }` — denied, tombstoned, payload-removed,
 *      not-found, or a thrown error from an unavailable Authority —
 *      refuses with a new closed outcome, `"denied"`, added to the
 *      existing `"indexed" | "duplicate"` vocabulary. A denied Envelope
 *      never reaches `FedosConversationSearchIncrementalIndex`, so text
 *      is discarded the instant it is refused and no plaintext is
 *      retained anywhere.
 *   2. **Archive ingestion gate.** `indexArchiveBundle()` resolves each
 *      candidate Envelope's `payloadId` via a second, independent pass
 *      of the SAME reused `deserializeFedosConversationMessageEnvelope`
 *      codec `fedosConversationSearchDocumentsFromArchiveBundle()`
 *      already calls (`./fedos_conversation_search_archive_index.ts`,
 *      unmodified by this Arc — see that file's own header) and gates
 *      each document through the identical `#ingest()` path. A denied
 *      record contributes to a new `denied` count on
 *      `FedosConversationSearchBulkOutcome`, alongside the existing
 *      `indexed`/`duplicate` — a mixed Archive indexes every permitted
 *      record while honestly reporting how many were denied, never
 *      silently dropped and never conflated with `duplicate`. This is
 *      deliberately independent from Archive integrity (a malformed
 *      Envelope record fails `deserializeFedosConversationMessageEnvelope`
 *      and is silently skipped — an EXISTING, unchanged behavior of the
 *      pure conversion function, never counted here at all) and from
 *      Archive decryptability (whether `plaintextByEnvelopeId` supplied
 *      text for a given id — orthogonal to whether that id's payload is
 *      currently retention-permitted). Successful archive decryption or
 *      even a byte-perfect Archive round-trip NEVER implies search
 *      eligibility on its own — only a currently-`"allowed"`
 *      `evaluatePayloadAccess()` result does.
 *   3. **Retention-transition purge.** `reconcilePayloadRetention(payloadId)`
 *      is new, narrow wiring — NOT a second retention policy, NOT a
 *      second index: it re-checks the SAME `evaluatePayloadAccess()`
 *      call the ingestion gate already uses and, if no longer
 *      `"allowed"`, purges every currently-indexed Envelope id this
 *      facade has ever linked to that `payloadId` by calling the
 *      EXISTING `removeEnvelope()` once per id — reusing that method's
 *      own full sub-index purge, never a new removal implementation.
 *      Callers are expected to invoke this once after calling
 *      `FedosPayloadRetentionAuthority.tombstonePayload()`/
 *      `removeLocalPayload()`, mirroring how `removeEnvelope()` itself
 *      was already the caller-invoked hook for an explicit delete.
 *      `removeEnvelope()` additionally now purges the Mode/Archive
 *      sub-indexes' OWN pre-existing (but previously unreachable —
 *      Review 03/14 of the audit) `removeConversation()`/
 *      `forgetConversation()` methods once a conversation's
 *      currently-indexed Envelope count reaches zero — closing the
 *      audit's Medium-severity "dead code" finding with the SMALLEST
 *      possible wiring, not a new sub-index.
 *   4. **Query-time race guard.** Even with (1)-(3), a synchronous,
 *      non-reactive Retention Authority (Alpha 797's own "no
 *      `\"unavailable\"` token... nothing in this synchronous design
 *      ever produces it" — i.e. no push/event notification exists for
 *      this facade to subscribe to) leaves one honest race: an Envelope
 *      indexed while allowed, then denied by a transition the caller has
 *      not yet reconciled via (3), could otherwise still surface through
 *      a query issued in between. Every query surface that can expose
 *      message-adjacent content or its reply/participant graph
 *      (`searchKeyword`, `envelopesBetween`, `repliesTo`, `parentOf`,
 *      `envelopesByParticipant`) therefore re-checks
 *      `evaluatePayloadAccess()` per candidate result before returning
 *      it — a narrow, targeted filter, never a general authorization
 *      system, and never applied to the purely conversation-level
 *      classification surface (`modeOf`/`directConversationIds`/
 *      `groupConversationIds`/`isFromArchive`/`archivedConversationIds`/
 *      `conversationsByParticipant`/`size`), which carries no message
 *      content and is out of this defect's own stated scope. Combined
 *      with (1)/(2) gating ingestion and a restart naturally
 *      re-deriving the index from currently-authorized source data
 *      alone, this closes every window this Arc's own test matrix
 *      checks for.
 *
 * See `docs/secure_runtime_alpha_2581_2620_execution_spec.md` for the
 * full reconciliation, options considered, and security-guarantee
 * writeup this header only summarizes.
 *
 * HARD GUARDRAILS:
 *   - Never mutates any injected dependency (`draftPersistence`,
 *     `membershipAuthority`, `retentionAuthority`) — read-only consumer
 *     of all three.
 *   - Never calls `readPayload()`/`getPayload()` — only the pure-preview
 *     `evaluatePayloadAccess()`; this module still never touches a
 *     payload byte.
 *   - No network, no file, no timer, no `process.env` read.
 *   - Every query method returns a deterministically-ordered result —
 *     never raw `Map`/`Set` iteration order.
 *   - No plaintext, retention outcome, or payload id ever appears in a
 *     thrown error message or log — every failure path here is a typed
 *     return value, never a `throw` surfaced to the caller.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosPrivateConversationMode } from "../construction/fedos_private_conversation_id.js";
import type { FedosConversationArchiveBundleV1 } from "../archive/fedos_conversation_archive_bundle.js";
import type { FedosPrivateConversationConstructionCoordinatorDependencies } from "../construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import { deserializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
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

/**
 * Alpha 2581–2620 — the narrowest additive dependency boundary: ONLY the
 * pure-preview access evaluation. Never `tombstonePayload()`/
 * `removeLocalPayload()` (Search Runtime never mutates retention state)
 * and never `readPayload()` (Search Runtime never reads a payload byte).
 */
export type FedosConversationSearchRetentionAuthorityDependency = Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">;

/**
 * The concrete "Reuse Conversation Runtime" tie-in, PLUS (Alpha 2581–2620)
 * the narrow Retention Authority gate — see this file's own header.
 *
 * Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
 * reduction (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`,
 * `test/architecture_cycle_detector.test.ts`) — this Pick used to source
 * `draftPersistence`/`membershipAuthority` from
 * `FedosConversationRuntimeDependencies` (`../runtime/fedos_conversation_runtime.ts`),
 * which closed a 5-file type-only SCC together with this file, the
 * deletion-request inbound coordinator, and the deletion execution
 * coordinator (`fedos_conversation_runtime.ts` -> ...deletion request/
 * execution... -> `fedos_conversation_search_index.ts` -> back to
 * `fedos_conversation_runtime.ts`, every closing edge type-only). Both
 * fields are, and always were, declared directly on the LOWER-level
 * `FedosPrivateConversationConstructionCoordinatorDependencies`
 * (`../construction/fedos_private_conversation_construction_coordinator.ts`)
 * — `FedosConversationRuntimeDependencies` is a structural intersection
 * (`FedosPrivateConversationConstructionCoordinatorDependencies & {...}`)
 * that does not redeclare either field, so `Pick<...,
 * "draftPersistence" | "membershipAuthority">` resolves to the IDENTICAL
 * shape whichever of the two types it is picked from. Sourcing directly
 * from the lower-level type — the file that actually owns these two
 * fields, rather than the higher-level Runtime type that merely inherits
 * them — is a zero-behavior-change fix, not a redesign: this file's own
 * "reuse the real shape, never a same-shaped lookalike" discipline is
 * unchanged, it now reuses the shape from its true source instead of a
 * downstream re-export of it. This removes the file's only edge into
 * `runtime/`, breaking the cycle without an artificial shared-types file.
 */
export type FedosConversationSearchIndexDependencies = Pick<
  FedosPrivateConversationConstructionCoordinatorDependencies,
  "draftPersistence" | "membershipAuthority"
> & {
  readonly retentionAuthority: FedosConversationSearchRetentionAuthorityDependency;
};

/** One Envelope plus its already-decrypted text, if available — see `fedos_conversation_search_document.ts`'s own plaintext boundary. */
export interface FedosConversationSearchEnvelopeInput {
  readonly envelope: FedosConversationMessageEnvelope;
  readonly text: string | null;
}

/** Alpha 2581–2620 adds `"denied"` — a closed, coarse result; never a leaked retention-state enum. */
export type FedosConversationSearchIndexOutcome = "indexed" | "duplicate" | "denied";
export type FedosConversationSearchRemovalOutcome = "removed" | "not-found";

export interface FedosConversationSearchBulkOutcome {
  readonly indexed: number;
  readonly duplicate: number;
  /** Alpha 2581–2620 — count of candidate records the Retention Authority did not currently permit. Never conflated with `duplicate`. */
  readonly denied: number;
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
  readonly #retentionAuthority: FedosConversationSearchRetentionAuthorityDependency;

  // Alpha 2581–2620 — the narrow bookkeeping this Arc's own purge/query-time
  // gating needs. None of these is a second CONTENT index: they carry no
  // plaintext, only ids already known to this facade's own callers.
  readonly #payloadIdByEnvelope = new Map<FedosConversationEnvelopeId, FedosConversationPayloadId>();
  readonly #envelopeIdsByPayload = new Map<FedosConversationPayloadId, Set<FedosConversationEnvelopeId>>();
  readonly #conversationIdByEnvelope = new Map<FedosConversationEnvelopeId, FedosConversationId>();
  readonly #envelopeCountByConversation = new Map<FedosConversationId, number>();

  constructor(deps: FedosConversationSearchIndexDependencies) {
    this.#participant = new FedosConversationSearchParticipantIndex({ membershipAuthority: deps.membershipAuthority });
    this.#mode = new FedosConversationSearchModeIndex({ draftPersistence: deps.draftPersistence });
    this.#retentionAuthority = deps.retentionAuthority;
  }

  /** Fail-closed: only an explicit `{ outcome: "allowed" }` passes. Any other outcome, or a thrown error from an unavailable Authority, is treated as not-permitted. */
  #isPermitted(payloadId: FedosConversationPayloadId): boolean {
    try {
      return this.#retentionAuthority.evaluatePayloadAccess(payloadId).outcome === "allowed";
    } catch {
      return false;
    }
  }

  #linkEnvelope(doc: FedosConversationSearchEnvelopeDocument, payloadId: FedosConversationPayloadId): void {
    this.#payloadIdByEnvelope.set(doc.envelopeId, payloadId);
    this.#conversationIdByEnvelope.set(doc.envelopeId, doc.conversationId);
    let ids = this.#envelopeIdsByPayload.get(payloadId);
    if (ids === undefined) {
      ids = new Set<FedosConversationEnvelopeId>();
      this.#envelopeIdsByPayload.set(payloadId, ids);
    }
    ids.add(doc.envelopeId);
    this.#envelopeCountByConversation.set(doc.conversationId, (this.#envelopeCountByConversation.get(doc.conversationId) ?? 0) + 1);
  }

  /** Reverses `#linkEnvelope()`. Returns the Envelope's own conversation id (for a caller to re-check whether that conversation is now empty), or `null` if never linked. */
  #unlinkEnvelope(envelopeId: FedosConversationEnvelopeId): FedosConversationId | null {
    const payloadId = this.#payloadIdByEnvelope.get(envelopeId);
    const conversationId = this.#conversationIdByEnvelope.get(envelopeId) ?? null;
    if (payloadId !== undefined) {
      const ids = this.#envelopeIdsByPayload.get(payloadId);
      if (ids !== undefined) {
        ids.delete(envelopeId);
        if (ids.size === 0) this.#envelopeIdsByPayload.delete(payloadId);
      }
    }
    this.#payloadIdByEnvelope.delete(envelopeId);
    this.#conversationIdByEnvelope.delete(envelopeId);
    if (conversationId !== null) {
      const remaining = Math.max(0, (this.#envelopeCountByConversation.get(conversationId) ?? 0) - 1);
      if (remaining === 0) this.#envelopeCountByConversation.delete(conversationId);
      else this.#envelopeCountByConversation.set(conversationId, remaining);
    }
    return conversationId;
  }

  /** Alpha 2581–2620 — closes audit Review 03/14's "dead code" finding: once a conversation has zero currently-indexed Envelopes, its Mode/Archive classification is stale metadata, not a searchable trace worth keeping. Reuses the EXISTING (previously unreachable) `removeConversation()`/`forgetConversation()` methods; never a new removal path. */
  #purgeConversationMetadataIfEmpty(conversationId: FedosConversationId): void {
    if ((this.#envelopeCountByConversation.get(conversationId) ?? 0) > 0) return;
    this.#mode.removeConversation(conversationId);
    this.#archive.forgetConversation(conversationId);
  }

  #ingest(doc: FedosConversationSearchEnvelopeDocument, payloadId: FedosConversationPayloadId): FedosConversationSearchIndexOutcome {
    if (!this.#isPermitted(payloadId)) return "denied";
    if (!this.#incremental.shouldIndex(doc.envelopeId)) return "duplicate";
    this.#keyword.indexDocument(doc);
    this.#date.indexDocument(doc);
    this.#reply.indexDocument(doc);
    this.#participant.indexDocument(doc);
    this.#mode.indexConversation(doc.conversationId);
    this.#incremental.markIndexed(doc.envelopeId);
    this.#linkEnvelope(doc, payloadId);
    return "indexed";
  }

  /** Incremental, idempotent, retention-gated — see this file's own header. */
  indexEnvelope(input: FedosConversationSearchEnvelopeInput): FedosConversationSearchIndexOutcome {
    return this.#ingest(documentFromEnvelope(input.envelope, input.text), input.envelope.payloadId);
  }

  indexEnvelopes(inputs: readonly FedosConversationSearchEnvelopeInput[]): FedosConversationSearchBulkOutcome {
    let indexed = 0;
    let duplicate = 0;
    let denied = 0;
    for (const input of inputs) {
      const outcome = this.indexEnvelope(input);
      if (outcome === "indexed") indexed += 1;
      else if (outcome === "duplicate") duplicate += 1;
      else denied += 1;
    }
    return { indexed, duplicate, denied };
  }

  /**
   * Reuses Archive (`../archive/`) — see this file's own header. `restoredAt`
   * is Unix seconds. Retention-gated per record (Alpha 2581–2620): a
   * successful Archive decrypt/round-trip never implies search
   * eligibility on its own — only a currently-`"allowed"`
   * `evaluatePayloadAccess()` result for that record's own `payloadId`
   * does. Denied records are counted, never silently dropped and never
   * conflated with `duplicate`.
   */
  indexArchiveBundle(
    bundle: FedosConversationArchiveBundleV1,
    plaintextByEnvelopeId: ReadonlyMap<string, string>,
    restoredAt: number,
  ): FedosConversationSearchBulkOutcome {
    const documents = fedosConversationSearchDocumentsFromArchiveBundle(bundle, plaintextByEnvelopeId);

    // A second, independent pass over the SAME reused codec
    // `fedosConversationSearchDocumentsFromArchiveBundle()` already calls,
    // solely to recover each document's own `payloadId` for the retention
    // gate below -- `FedosConversationSearchEnvelopeDocument` deliberately
    // carries no `payloadId` field (see `fedos_conversation_search_document.ts`'s
    // own guardrails), and this Arc does not change that.
    const payloadIdByEnvelopeId = new Map<string, FedosConversationPayloadId>();
    for (const raw of bundle.envelopes) {
      const envelope = deserializeFedosConversationMessageEnvelope(raw);
      if (envelope === null) continue;
      payloadIdByEnvelopeId.set(envelope.id, envelope.payloadId);
    }

    let indexed = 0;
    let duplicate = 0;
    let denied = 0;
    for (const doc of documents) {
      const payloadId = payloadIdByEnvelopeId.get(doc.envelopeId);
      if (payloadId === undefined) {
        // Unreachable in practice (every `doc` here came from an Envelope
        // this SAME pass just deserialized) -- fails closed regardless.
        denied += 1;
        continue;
      }
      const outcome = this.#ingest(doc, payloadId);
      if (outcome === "indexed") indexed += 1;
      else if (outcome === "duplicate") duplicate += 1;
      else denied += 1;
    }

    this.#archive.recordRestoredConversation(bundle.conversationId as FedosConversationId, restoredAt);
    this.#purgeConversationMetadataIfEmpty(bundle.conversationId as FedosConversationId);
    return { indexed, duplicate, denied };
  }

  /** Purges `envelopeId` from every content/metadata sub-index and reopens it for a future legitimate re-index — see this file's own header. Also purges Mode/Archive classification once its conversation has zero remaining indexed Envelopes (Alpha 2581–2620). */
  removeEnvelope(envelopeId: FedosConversationEnvelopeId): FedosConversationSearchRemovalOutcome {
    if (!this.#incremental.isIndexed(envelopeId)) return "not-found";
    this.#keyword.removeDocument(envelopeId);
    this.#date.removeDocument(envelopeId);
    this.#reply.removeDocument(envelopeId);
    this.#participant.removeDocument(envelopeId);
    this.#incremental.markRemoved(envelopeId);
    const conversationId = this.#unlinkEnvelope(envelopeId);
    if (conversationId !== null) this.#purgeConversationMetadataIfEmpty(conversationId);
    return "removed";
  }

  /**
   * Alpha 2581–2620 — the retention-transition purge hook. Callers are
   * expected to invoke this once after
   * `FedosPayloadRetentionAuthority.tombstonePayload()`/
   * `removeLocalPayload()` transitions `payloadId` away from `"active"`
   * (mirroring how `removeEnvelope()` is itself the caller-invoked hook
   * for an explicit delete). Re-checks the SAME `evaluatePayloadAccess()`
   * the ingestion gate uses; if still permitted, this is a no-op. If not,
   * purges every currently-indexed Envelope this facade has linked to
   * `payloadId` via the EXISTING `removeEnvelope()` — never a new removal
   * implementation. Returns the number of Envelopes purged.
   */
  reconcilePayloadRetention(payloadId: FedosConversationPayloadId): number {
    if (this.#isPermitted(payloadId)) return 0;
    const envelopeIds = this.#envelopeIdsByPayload.get(payloadId);
    if (envelopeIds === undefined) return 0;
    let purged = 0;
    for (const envelopeId of [...envelopeIds]) {
      if (this.removeEnvelope(envelopeId) === "removed") purged += 1;
    }
    return purged;
  }

  /** Alpha 2581–2620 — re-checks `evaluatePayloadAccess()` per candidate before returning it (Phase F query-time race guard); an id this facade cannot currently vouch for (no linkage) fails closed. */
  #filterPermitted(envelopeIds: readonly FedosConversationEnvelopeId[]): readonly FedosConversationEnvelopeId[] {
    return envelopeIds.filter((id) => {
      const payloadId = this.#payloadIdByEnvelope.get(id);
      if (payloadId === undefined) return false;
      return this.#isPermitted(payloadId);
    });
  }

  searchKeyword(query: string): readonly FedosConversationEnvelopeId[] {
    return this.#filterPermitted(this.#keyword.search(query));
  }

  envelopesBetween(fromInclusive: number, toInclusive: number): readonly FedosConversationEnvelopeId[] {
    return this.#filterPermitted(this.#date.envelopesBetween(fromInclusive, toInclusive));
  }

  repliesTo(envelopeId: FedosConversationEnvelopeId): readonly FedosConversationEnvelopeId[] {
    return this.#filterPermitted(this.#reply.repliesTo(envelopeId));
  }

  parentOf(envelopeId: FedosConversationEnvelopeId): FedosConversationEnvelopeId | null {
    const parent = this.#reply.parentOf(envelopeId);
    if (parent === null) return null;
    return this.#filterPermitted([parent])[0] ?? null;
  }

  envelopesByParticipant(participant: FedosConversationParticipantReference): readonly FedosConversationEnvelopeId[] {
    return this.#filterPermitted(this.#participant.envelopesByParticipant(participant));
  }

  /** Conversation-level classification only -- not gated per-record (see this file's own header): carries no message content. */
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

  /**
   * Secure Runtime Alpha 3081-3160 — narrow read accessor exposing this
   * facade's own EXISTING internal envelope -> conversation linkage
   * (`#conversationIdByEnvelope`, already required to purge Mode/Archive
   * metadata correctly in `#unlinkEnvelope()`/`#purgeConversationMetadataIfEmpty()`
   * above) to an application-layer caller assembling a search result view.
   * NOT a second index — reads the SAME map `#linkEnvelope()`/
   * `#unlinkEnvelope()` already maintain, never a new one. `null` for an
   * unknown or already-removed envelope id (mirrors this file's own
   * established "fails closed to `null`" convention throughout).
   */
  conversationIdForEnvelope(envelopeId: FedosConversationEnvelopeId): FedosConversationId | null {
    return this.#conversationIdByEnvelope.get(envelopeId) ?? null;
  }
}
