/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase A
 * reconciliation finding: `assessFedosDeletionRequestAuthorization()`
 * (`5641-5720`) depends on `Pick<FedosConversationPersistence,
 * "getConversation">` — a port `FedosConversationRuntime` itself never
 * holds (real Direct Conversations there are modeled entirely through
 * `draftPersistence`/`activationPersistence`, never through a discrete
 * `FedosPersistedConversationRecordV1`; confirmed by direct source
 * inspection — no `FedosConversationPersistence` reference exists
 * anywhere in `fedos_conversation_runtime.ts`). This is a genuine,
 * narrow integration seam, not a redesign of either side: this file
 * adapts the Runtime's own already-real `resolveActiveConversation()`
 * (`fedos_conversation_active_lookup.ts`, unmodified) to the ONE method
 * the assessment actually calls.
 *
 * `assessFedosDeletionRequestAuthorization()`'s own body uses the
 * returned value for EXISTENCE ONLY (`if (conversation === null) return
 * "conversation-unavailable"`; the resolved record itself is never read
 * again) — so the synthetic record this adapter returns for an ACTIVE
 * conversation carries no real board/thread/policy fact of its own
 * (a private Direct Conversation has none) and is never a fabricated
 * claim of anything beyond "a real, currently-active Conversation with
 * this id exists locally".
 */
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosConversationActiveLookupResult } from "../activation/fedos_conversation_active_lookup.js";

export class FedosDeletionRequestConversationExistenceAdapter implements Pick<FedosConversationPersistence, "getConversation"> {
  readonly #resolveActiveConversation: (conversationId: FedosConversationId) => FedosConversationActiveLookupResult;

  constructor(resolveActiveConversation: (conversationId: FedosConversationId) => FedosConversationActiveLookupResult) {
    this.#resolveActiveConversation = resolveActiveConversation;
  }

  getConversation(id: FedosConversationId): FedosPersistedConversationRecordV1 | null {
    const lookup = this.#resolveActiveConversation(id);
    if (lookup.outcome !== "active") return null;
    return {
      schemaVersion: 1,
      id,
      mode: "private",
      boardId: "",
      rootThreadId: "",
      rootPostId: "",
      policyReference: "private-draft-activated",
      createdAt: lookup.draft.createdAt,
    };
  }
}
