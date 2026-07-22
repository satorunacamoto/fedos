/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Read-Only Authorization Assessment.
 *
 * Phase G (steps 5-12) / Phase H — the ONE function that turns a signed
 * request plus real local state into a
 * `FedosDeletionRequestAuthorizationOutcome`. NEVER mutates anything —
 * no `putEnvelope`/`admit`/`revoke`/`b3b3a6d` execution call anywhere in
 * this file. NEVER creates a delivery event (this Arc has no transport
 * at all, Absolute Prohibitions).
 *
 * Step order (restated from Phase G, this function's own real
 * implementation of steps 5-12; steps 1-4 are
 * `isWellFormedFedosDeletionRequestRecordV1`/expiry, already checked
 * before this function is called from
 * `fedos_deletion_request_validation.ts`):
 *   5. signature (`verifyFedosSignedDeletionRequestV1`)
 *   6. request replay — NOT this function's job (durable-state layer,
 *      Phase I)
 *   7. Conversation existence
 *   8. target existence
 *   9. requester authorship — steps 7-9 are evaluated as ONE combined
 *      lookup (review Doc 11's own oracle-avoidance rule) so their
 *      externally-visible outcome is indistinguishable to anyone but the
 *      request's own true author
 *   10. requester Membership
 *   11. recipient binding
 *   12. local capability compatibility (`b3b3a6d`'s own
 *       `FedosDeletionCapabilityDescriptor`)
 *
 * `assessFedosDeletionRequestAuthorization` returns the DETAILED,
 * internal-only `FedosDeletionRequestAuthorizationOutcome` — a caller
 * constructing anything externally visible (an acknowledgement, Phase K)
 * MUST pass it through `coarsenFedosDeletionRequestAuthorizationOutcome`
 * first.
 *
 * This Arc's own modeling choice, stated plainly: `requesterAccountRef`/
 * `recipientAccountRef` are compared against a
 * `FedosConversationParticipantReference` of
 * `{ authority: "fedos", publicIdentifier: accountRef, identityId: null }`
 * — the SAME "fedos"-authority, opaque-`publicIdentifier` shape this
 * codebase's own existing Membership tests already use. This Arc claims
 * no deeper cryptographic binding between a Nostr pubkey and a
 * `publicIdentifier` beyond this — a future transport-integration Arc
 * may revisit it with real source-grounded evidence.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { getFedosDeletionCapabilityDescriptor } from "../deletion/fedos_deletion_capability_descriptor.js";
import { verifyFedosSignedDeletionRequestV1, type FedosSignedDeletionRequestV1 } from "./fedos_deletion_request_signing.js";
import type { FedosDeletionRequestAuthorizationOutcome } from "./fedos_deletion_request_authorization_outcome.js";

export function participantReferenceForFedosDeletionRequestAccountRef(accountRef: string): FedosConversationParticipantReference {
  return { authority: "fedos", publicIdentifier: accountRef, identityId: null };
}

export interface FedosDeletionRequestAuthorizationAssessmentDependencies {
  readonly conversationPersistence: Pick<FedosConversationPersistence, "getConversation">;
  readonly envelopePersistence: Pick<FedosConversationMessageEnvelopePersistence, "getEnvelope">;
  readonly membershipAuthority: Pick<FedosConversationMembershipAuthority, "findMembership" | "listMemberships">;
  readonly clock: () => number;
  /** This evaluating instance's own opaque, advisory local Device label — `null` if this build tracks no Device identity. Never cryptographically verified (Doc 08 — no real Device key exists). */
  readonly localDeviceRef: string | null;
}

export function assessFedosDeletionRequestAuthorization(
  signed: FedosSignedDeletionRequestV1,
  deps: FedosDeletionRequestAuthorizationAssessmentDependencies,
): FedosDeletionRequestAuthorizationOutcome {
  const { record } = signed;

  // Step 5 — signature.
  if (!verifyFedosSignedDeletionRequestV1(signed)) return "invalid-signature";

  // Step 4 (restated here since it is cheap and load-bearing for every later step) — expiry.
  const now = deps.clock();
  if (now >= record.expiresAt) return "expired";

  // Step 12 (checked early — cheap, and an unsupported scope never needs identity resolution at all).
  const descriptor = getFedosDeletionCapabilityDescriptor("local-payload");
  if (!descriptor.localSupport || !descriptor.reachableToday) return "unsupported";

  const conversationId = record.conversationId as FedosConversationId;

  // Steps 7-9, COMBINED (review Doc 11's own oracle-avoidance rule): conversation existence,
  // target existence, and requester authorship are resolved as ONE lookup whose only
  // externally-visible outcomes (after coarsening) are "authorized" or "unauthorized" --
  // never letting an unauthorized caller distinguish WHICH of the three failed.
  const conversation = deps.conversationPersistence.getConversation(conversationId);
  if (conversation === null) return "conversation-unavailable";

  const envelope = deps.envelopePersistence.getEnvelope(record.targetEnvelopeId);
  if (envelope === null || envelope.conversationId !== conversationId) return "target-unavailable";

  const authoringMembership = deps.membershipAuthority.listMemberships(conversationId).find((m) => m.id === envelope.senderMembershipId);
  if (authoringMembership === undefined) return "target-unavailable";

  const claimedRequester = participantReferenceForFedosDeletionRequestAccountRef(record.requesterAccountRef);
  const isAuthor =
    authoringMembership.participant.authority === claimedRequester.authority &&
    authoringMembership.participant.publicIdentifier === claimedRequester.publicIdentifier &&
    authoringMembership.participant.identityId === claimedRequester.identityId;
  if (!isAuthor) return "requester-not-author";

  // Step 10 — requester Membership (currently active).
  const requesterMembership = deps.membershipAuthority.findMembership(conversationId, claimedRequester);
  if (requesterMembership === null || requesterMembership.state !== "active") return "requester-not-member";

  // Step 11 — recipient binding: the LOCAL account/Device this evaluation is running as
  // must match the request's own claimed recipient. Device is advisory-only (no real key,
  // Doc 08) -- a mismatch is still reported, distinctly from account mismatch.
  const recipientMembership = deps.membershipAuthority.findMembership(conversationId, participantReferenceForFedosDeletionRequestAccountRef(record.recipientAccountRef));
  if (recipientMembership === null || recipientMembership.state !== "active") return "recipient-mismatch";

  // Device is advisory-only (no real per-Device key, Doc 08) -- a KNOWN mismatch is still
  // reported, distinctly from an account-level mismatch, but an absent claim on either side
  // is never treated as a failure (there is nothing cryptographic to fail).
  if (record.recipientDeviceRef !== null && deps.localDeviceRef !== null && record.recipientDeviceRef !== deps.localDeviceRef) {
    return "device-mismatch";
  }

  return "authorized";
}
