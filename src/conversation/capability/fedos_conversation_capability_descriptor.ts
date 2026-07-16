/**
 * Secure Runtime Alpha 777 ("Public Capability Descriptor") — Stage 3 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * Directly adopts the prior reviews' own converged Capability shape
 * (`docs/reviews/conversation_foundation_v1/12_invitation_capability.md`,
 * `docs/reviews/private_conversation_security/09_capability_invitation.md`),
 * narrowed to this Arc's own V1 scope (Alpha 776: `"join-conversation"`
 * only — no `"invite-participant"`/`"join-and-write"` action yet, no
 * `keyEpochReference` — this Arc implements no encryption).
 *
 * Explicitly EXCLUDED, per both prior reviews and this Arc's own
 * instruction:
 *   - bearer secret — `FedosConversationCapabilityBearerSecret`
 *     (`./fedos_conversation_capability_bearer_secret.ts`, Alpha 778) is
 *     a SEPARATE type, never a field here.
 *   - raw token / URL — a descriptor is server-side authority state,
 *     never a transport representation.
 *   - key material of any kind.
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`.
 *   - Only `validateFedosConversationCapabilityIssueRequest`
 *     (`./fedos_conversation_capability_issuer_authority.ts`, Alpha 780)
 *     constructs one, mirroring every other domain's "validator is the
 *     sole constructor" discipline.
 *   - `issuedAt`/`expiresAt` are Unix seconds, matching
 *     `FedosConversationRecord.createdAt`'s own convention.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationCapabilityId } from "./fedos_conversation_capability_id.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";

/** Alpha 776 — V1 supports exactly one action. A future Arc widens this additively, never rewriting this one. */
export type FedosConversationCapabilityAction = "join-conversation";

export interface FedosConversationCapabilityDescriptor {
  readonly capabilityId: FedosConversationCapabilityId;
  readonly conversationId: FedosConversationId;
  readonly action: FedosConversationCapabilityAction;
  readonly issuer: FedosConversationParticipantReference;
  /** `null` for a general (any redeemer) capability; a specific participant for a capability intended for exactly one person. */
  readonly intendedRecipient: FedosConversationParticipantReference | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
  readonly issuedAt: number;
}
