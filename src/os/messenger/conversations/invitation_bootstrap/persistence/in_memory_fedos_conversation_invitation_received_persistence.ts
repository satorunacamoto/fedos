/**
 * Secure Runtime Alpha 7081-7160 — in-memory, test-only implementation of
 * `FedosConversationInvitationReceivedPersistence`. Mirrors the codebase's
 * own established in-memory-test-double convention exactly (e.g.
 * `InMemoryFedosRatchetPeerCapabilityObservationPersistence`).
 */
import {
  fedosConversationInvitationReceivedRecordKey,
  fedosConversationInvitationReceivedRecordsAreEqual,
  type FedosConversationInvitationReceivedPersistence,
  type FedosConversationInvitationReceivedWriteResult,
} from "../../../../../conversation/invitation_bootstrap/persistence/fedos_conversation_invitation_received_persistence.js";
import type { FedosConversationInvitationReceivedRecordV1 } from "../../../../../conversation/invitation_bootstrap/fedos_conversation_invitation_received_record.js";

export class InMemoryFedosConversationInvitationReceivedPersistence implements FedosConversationInvitationReceivedPersistence {
  readonly #byKey = new Map<string, FedosConversationInvitationReceivedRecordV1>();

  putReceived(record: FedosConversationInvitationReceivedRecordV1): FedosConversationInvitationReceivedWriteResult {
    const key = fedosConversationInvitationReceivedRecordKey(record);
    const existing = this.#byKey.get(key);
    if (existing !== undefined) {
      return fedosConversationInvitationReceivedRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    this.#byKey.set(key, record);
    return "inserted";
  }

  listReceived(): readonly FedosConversationInvitationReceivedRecordV1[] {
    return [...this.#byKey.values()];
  }
}
