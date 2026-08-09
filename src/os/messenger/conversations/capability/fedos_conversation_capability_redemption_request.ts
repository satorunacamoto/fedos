/**
 * Secure Runtime Alpha 781 ("Redemption Request") — Stage 7 of Phase B
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * A caller supplies exactly the bearer capability, who is redeeming it,
 * and when — nothing else. Deliberately excludes, per this Arc's own
 * instruction: use count, issuer, conversation mapping, role, Membership
 * state, or the acceptance result itself — every one of those is
 * Authority-derived, never caller-supplied, mirroring
 * `CreatePublicThreadCommand`'s own "no id/author/source/createdAt on
 * the command side" discipline (`../../board/runtime/fedos_board_runtime_command_types.ts`,
 * Alpha 624).
 */

import type { FedosConversationCapabilityId } from "../../../../conversation/capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilityBearerSecret } from "../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";

export interface FedosConversationCapabilityRedemptionRequest {
  readonly capabilityId: FedosConversationCapabilityId;
  readonly bearerSecret: FedosConversationCapabilityBearerSecret;
  readonly redeemer: FedosConversationParticipantReference;
}
