/**
 * Secure Runtime Alpha 7081-7160 — the real, production
 * `FedosConversationInvitationIdGenerator`. Mirrors
 * `FedosSecureRandomConstructionIdGenerator`'s own exact idiom (real
 * CSPRNG via `@noble/hashes`, 16 bytes hex-encoded) — the SAME dependency
 * already used throughout this codebase for every other id/nonce
 * generator, no new dependency.
 */
import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { FedosConversationInvitationIdGenerator } from "../../../../conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.js";

export class FedosSecureRandomConversationInvitationIdGenerator implements FedosConversationInvitationIdGenerator {
  generateRequestId(): string {
    return bytesToHex(nobleRandomBytes(16));
  }

  generateNonce(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}
