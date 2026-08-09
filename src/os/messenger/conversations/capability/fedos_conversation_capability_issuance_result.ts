/**
 * Secure Runtime Alpha 779 ("Capability Issuance Result") — Stage 5 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * Explicit, closed outcomes — no boolean, no raw `Error` object. An
 * `"issued"` result carries the PUBLIC descriptor plus the bearer
 * secret through this ONE dedicated boundary — never an internal
 * authority/repository reference (this Arc's own instruction: "Never
 * return internal authority/repository references").
 */

import type { FedosConversationCapabilityDescriptor } from "../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityBearerSecret } from "../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";

export type FedosConversationCapabilityIssuanceResult =
  | {
      readonly outcome: "issued";
      readonly descriptor: FedosConversationCapabilityDescriptor;
      readonly bearerSecret: FedosConversationCapabilityBearerSecret;
    }
  | { readonly outcome: "denied"; readonly reason: "conversation-not-found" | "issuer-not-authorized" }
  | { readonly outcome: "invalid-request" }
  | { readonly outcome: "unavailable" };
