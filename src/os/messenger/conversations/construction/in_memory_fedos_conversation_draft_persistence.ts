/**
 * Secure Runtime Alpha 894 — in-memory `FedosConversationDraftPersistence`
 * backend. Mirrors `InMemoryFedosConversationPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 751).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable
 *     state.
 *   - `listDrafts()` returns a NEW array every call.
 */

import {
  fedosPersistedConversationDraftRecordsAreEqual,
  type FedosConversationDraftPersistence,
  type FedosConversationDraftPersistenceWriteResult,
} from "../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../../../../conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";

export class InMemoryFedosConversationDraftPersistence implements FedosConversationDraftPersistence {
  readonly #records = new Map<string, FedosPersistedConversationDraftRecordV1>();

  putDraft(record: FedosPersistedConversationDraftRecordV1): FedosConversationDraftPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedConversationDraftRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getDraft(id: FedosConversationId): FedosPersistedConversationDraftRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listDrafts(): readonly FedosPersistedConversationDraftRecordV1[] {
    return [...this.#records.values()];
  }
}
