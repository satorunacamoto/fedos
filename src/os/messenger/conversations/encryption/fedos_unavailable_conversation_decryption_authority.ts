/**
 * Secure Runtime Alpha 942 ("Default Decryption Authority") — Phase B of
 * the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * The exact mirror of `UnavailableFedosConversationEncryptionAuthority`
 * (`./fedos_unavailable_conversation_encryption_authority.ts`) — see that
 * file's own header for the shared rationale.
 */

import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../../../../conversation/encryption/fedos_conversation_decryption_authority.js";

export class UnavailableFedosConversationDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(_request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    return { outcome: "unavailable" };
  }
}
