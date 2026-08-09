/**
 * Secure Runtime Alpha 783 ("Redemption Authority") — Stage 9 of Phase B
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Responsibilities: verify the bearer secret, enforce expiry, enforce
 * `intendedRecipient`, enforce `maxUses`, produce a Membership admission
 * request, and enforce LOCAL atomicity within one authority instance
 * only (Alpha 784 — no distributed consensus, no network broadcast, no
 * cross-process guarantee).
 *
 * NOT this authority's responsibility: encryption key delivery, URL
 * parsing, GUI, or any protocol/network concern.
 */

import type { FedosConversationCapabilityRedemptionRequest } from "./fedos_conversation_capability_redemption_request.js";
import type { FedosConversationCapabilityRedemptionResult } from "./fedos_conversation_capability_redemption_result.js";

export interface FedosConversationCapabilityRedemptionAuthority {
  redeem(request: FedosConversationCapabilityRedemptionRequest, now: number): FedosConversationCapabilityRedemptionResult;
}
