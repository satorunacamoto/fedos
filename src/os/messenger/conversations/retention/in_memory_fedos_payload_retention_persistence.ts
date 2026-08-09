/**
 * Secure Runtime Alpha 796 ("Retention Authority Boundary") — Stage 6
 * of the Alpha 791–820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc.
 *
 * Mirrors `InMemoryFedosConversationPersistence`'s own private-field
 * `Map`-backed convention exactly (Alpha 751).
 */

import {
  fedosPersistedPayloadRetentionDecisionsAreEqual,
  type FedosPayloadRetentionPersistence,
  type FedosPayloadRetentionPersistenceWriteResult,
} from "../../../../conversation/retention/fedos_payload_retention_persistence.js";
import { fedosPayloadRetentionDecisionKey, type FedosPayloadRetentionAction } from "../../../../conversation/retention/fedos_payload_retention_decision.js";
import type { FedosPersistedPayloadRetentionDecisionV1 } from "../../../../conversation/retention/fedos_persisted_payload_retention_decision_v1.js";
import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";

export class InMemoryFedosPayloadRetentionPersistence implements FedosPayloadRetentionPersistence {
  readonly #decisions = new Map<string, FedosPersistedPayloadRetentionDecisionV1>();

  putDecision(record: FedosPersistedPayloadRetentionDecisionV1): FedosPayloadRetentionPersistenceWriteResult {
    const existing = this.#decisions.get(record.id);
    if (existing === undefined) {
      this.#decisions.set(record.id, record);
      return "inserted";
    }
    return fedosPersistedPayloadRetentionDecisionsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getDecision(payloadId: FedosConversationPayloadId, action: FedosPayloadRetentionAction): FedosPersistedPayloadRetentionDecisionV1 | null {
    return this.#decisions.get(fedosPayloadRetentionDecisionKey(payloadId, action)) ?? null;
  }

  listDecisionsForPayload(payloadId: FedosConversationPayloadId): readonly FedosPersistedPayloadRetentionDecisionV1[] {
    return [...this.#decisions.values()].filter((decision) => decision.payloadId === payloadId);
  }

  listDecisions(): readonly FedosPersistedPayloadRetentionDecisionV1[] {
    return [...this.#decisions.values()];
  }
}
