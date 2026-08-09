/**
 * Secure Runtime Alpha 782 ("Redemption Result Vocabulary") — Stage 8 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * Coarse, stable reasons only. `"invalid-capability"` covers BOTH an
 * unknown `capabilityId` AND a wrong `bearerSecret` uniformly — per
 * this Arc's own instruction, "do not expose whether a guessed secret
 * was 'almost correct.'" A caller can never distinguish "this id does
 * not exist" from "this id exists but the secret was wrong" from this
 * result alone.
 */

import type { FedosConversationCapabilityDescriptor } from "./fedos_conversation_capability_descriptor.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";

export type FedosConversationCapabilityRedemptionResult =
  | { readonly outcome: "redeemed"; readonly descriptor: FedosConversationCapabilityDescriptor; readonly membership: FedosConversationMembership }
  | { readonly outcome: "already-redeemed" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "exhausted" }
  | { readonly outcome: "invalid-capability" }
  | { readonly outcome: "recipient-mismatch" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "unavailable" };
