/**
 * Secure Runtime Alpha 767 ("Membership Identity") — Stage 7 of the
 * Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Compared:
 *   A. `conversationId` + participant `authority` + `publicIdentifier`
 *      — a deterministic, application-derived identity.
 *   B. a generated (random) membership id.
 *   C. the redeeming Capability's own `capabilityId`.
 *   D. a protocol-native id.
 *
 * ADOPTED: Option A — mirrors `toFedosConversationId`'s own
 * "deterministic from an already-existing pair, never randomly minted"
 * discipline (`../fedos_conversation_id.ts`, Alpha 743). Gives honest
 * idempotency for free: admitting the SAME participant into the SAME
 * Conversation twice always derives the identical id, so
 * `InMemoryFedosConversationMembershipAuthority.admit()` (Alpha 771) can
 * detect "already a member" by a plain map lookup, no separate index.
 * Option B is rejected — a random id would make two `admit()` calls for
 * the same participant produce two DIFFERENT ids, breaking that
 * idempotency. Option C is rejected per this Arc's own instruction ("do
 * not make capability identity equal membership identity") — a
 * Capability is a one-time issuance fact, a Membership is an ongoing
 * relationship; a participant admitted without ever redeeming a
 * Capability (a future non-Capability admission path) would have no
 * `capabilityId` to key off of. Option D is rejected — this Arc's own
 * Absolute Prohibitions forbid embedding any protocol-native id as a
 * FedOS application identifier (mirrors `FedosConversationId`'s own
 * Alpha 743 guardrail).
 *
 * Uses the SAME `::`-joined convention as `toFedosConversationId`
 * (Alpha 743) and `makeFedosBoardOutboxId` (Alpha 413), joining THREE
 * parts instead of two. As with those precedents, this assumes none of
 * the three parts contains the `::` separator; `publicIdentifier` is
 * caller-supplied and not itself `::`-stripped (matching
 * `toFedosBoardId`'s own identical, pre-existing limitation) — a
 * theoretical collision between two DIFFERENT `(authority,
 * publicIdentifier)` pairs is not newly introduced by this file, only
 * inherited from that established precedent.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "./fedos_conversation_participant_reference.js";

export type FedosConversationMembershipId = string & { readonly __brand: "FedosConversationMembershipId" };

export function toFedosConversationMembershipId(
  conversationId: FedosConversationId,
  participant: FedosConversationParticipantReference,
): FedosConversationMembershipId {
  return `${conversationId}::${participant.authority}::${participant.publicIdentifier}` as FedosConversationMembershipId;
}
