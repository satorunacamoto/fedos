/**
 * Secure Runtime Alpha 7081-7160 — codec for
 * `FedosConversationInvitationReceivedRecordV1`. Mirrors
 * `encodeFedosRatchetPeerCapabilityObservationV1`/`decodeFedosRatchetPeerCapabilityObservationV1`'s
 * own total, never-throwing discipline exactly.
 */
import {
  isWellFormedFedosConversationInvitationReceivedRecordV1,
  type FedosConversationInvitationReceivedRecordV1,
} from "../../../../../conversation/invitation_bootstrap/fedos_conversation_invitation_received_record.js";

export function encodeFedosConversationInvitationReceivedRecordV1(record: FedosConversationInvitationReceivedRecordV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosConversationInvitationReceivedRecordV1(line: string): FedosConversationInvitationReceivedRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosConversationInvitationReceivedRecordV1(parsed) ? parsed : null;
}
