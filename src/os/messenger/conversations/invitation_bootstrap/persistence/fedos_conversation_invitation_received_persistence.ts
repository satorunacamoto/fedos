/**
 * Secure Runtime Alpha 7081-7160 — Received-Invitation Persistence Port.
 * Mirrors `../../ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * own port shape — a DELIBERATELY SEPARATE port, never merged into any
 * existing persistence port.
 */
import {
  fedosConversationInvitationReceivedRecordKey,
  fedosConversationInvitationReceivedRecordsAreEqual,
  type FedosConversationInvitationReceivedRecordV1,
} from "../../../../../conversation/invitation_bootstrap/fedos_conversation_invitation_received_record.js";

export type FedosConversationInvitationReceivedWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationInvitationReceivedPersistence {
  putReceived(record: FedosConversationInvitationReceivedRecordV1): FedosConversationInvitationReceivedWriteResult;
  listReceived(): readonly FedosConversationInvitationReceivedRecordV1[];
}

export { fedosConversationInvitationReceivedRecordKey, fedosConversationInvitationReceivedRecordsAreEqual };
