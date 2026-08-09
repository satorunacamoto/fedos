/**
 * Secure Runtime Alpha 1328 ("Group Usability Result") — Phase A of the
 * Alpha 1321–1390 Private Group Pairwise Fanout Foundation Arc.
 *
 * A Group Container is never called `"active"` merely because a
 * generation exists — `"active"` remains the frozen Direct Activation
 * Coordinator's own vocabulary for exactly one thing (a `direct`
 * Conversation, Alpha 1123's own Private-Group Gate,
 * `docs/reviews/private_group_pairwise_fanout/03_runtime_compatibility.md`).
 * `"usable"` is this Arc's own, deliberately distinct word for "fanout
 * can be attempted right now."
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { toFedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosGroupGenerationPersistence } from "./fedos_group_generation.js";
import type { FedosGroupDirectPathPersistence } from "./fedos_group_direct_path.js";

export type FedosGroupUsabilityResult =
  | { readonly outcome: "usable" }
  | { readonly outcome: "draft-only" }
  | { readonly outcome: "no-current-generation" }
  | { readonly outcome: "insufficient-members" }
  | { readonly outcome: "member-invalid" }
  | { readonly outcome: "direct-path-unavailable" }
  | { readonly outcome: "storage-unavailable" }
  | { readonly outcome: "failed" };

export interface FedosGroupUsabilityDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly generationPersistence: FedosGroupGenerationPersistence;
  readonly pathPersistence: FedosGroupDirectPathPersistence;
}

export function evaluateFedosGroupUsability(
  deps: FedosGroupUsabilityDependencies,
  groupConversationId: FedosConversationId,
  localParticipant: FedosConversationParticipantReference,
): FedosGroupUsabilityResult {
  const draft = deps.draftPersistence.getDraft(groupConversationId);
  if (draft === null || draft.mode !== "private-group") return { outcome: "failed" };

  const localMembership = deps.membershipAuthority.findMembership(groupConversationId, localParticipant);
  if (localMembership === null || localMembership.state !== "active") return { outcome: "member-invalid" };

  const activeCount = deps.membershipAuthority.listMemberships(groupConversationId).filter((m) => m.state === "active").length;

  let generation;
  try {
    generation = deps.generationPersistence.currentGenerationForGroup(groupConversationId);
  } catch {
    return { outcome: "storage-unavailable" };
  }

  if (generation === null) {
    return activeCount < 2 ? { outcome: "draft-only" } : { outcome: "no-current-generation" };
  }
  if (activeCount < 2) return { outcome: "insufficient-members" };

  let paths;
  try {
    paths = deps.pathPersistence.listPathsForGeneration(groupConversationId, generation.generationId);
  } catch {
    return { outcome: "storage-unavailable" };
  }
  const localMembershipId = toFedosConversationMembershipId(groupConversationId, localParticipant);
  const hasReadyPath = paths.some(
    (p) => p.state === "ready" && (p.senderMembershipId === localMembershipId || p.recipientMembershipId === localMembershipId),
  );
  if (!hasReadyPath) return { outcome: "direct-path-unavailable" };

  return { outcome: "usable" };
}
