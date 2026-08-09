/**
 * Secure Runtime Alpha 1139 ("Message List Read Model") — Phase D of the
 * Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * Safe metadata ONLY — never plaintext, never ciphertext, never any
 * decrypt attempt. `listDirectMessages()`
 * (`./fedos_conversation_direct_messaging_coordinator.ts`) composes this
 * shape entirely from `FedosConversationMessageEnvelopePersistence.listConversationEnvelopes()`
 * (Alpha 857, unmodified, already returns everything needed) plus
 * `FedosPayloadRetentionAuthority.evaluatePayloadAccess()` (Alpha 796,
 * unmodified) — decryption stays an entirely separate, EXPLICIT call
 * (`readDirectMessage()`), never triggered merely to list a thread (Alpha
 * 1139's own explicit rule).
 */

import type { FedosPayloadRetentionState } from "../retention/fedos_payload_retention_state.js";

export interface FedosConversationDirectMessageSummary {
  readonly envelopeId: string;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToEnvelopeId: string | null;
  readonly retentionState: FedosPayloadRetentionState;
}
