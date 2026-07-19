/**
 * Secure Runtime Alpha 1365 ("Group Runtime API") — Phase E of the Alpha
 * 1321–1390 Private Group Pairwise Fanout Foundation Arc.
 *
 * A dedicated, additive facade — never widening
 * `FedosConversationRuntime`'s own existing method signatures. Composes
 * every narrow authority this Arc adds (`FedosGroupGenerationAuthority`,
 * `FedosGroupDirectPathAuthority`, `FedosGroupSendCoordinator`,
 * `FedosGroupReadFacade`, `FedosGroupAdmission`) plus the frozen
 * `FedosConversationIdentityResolver`/`FedosConversationMembershipAuthority`/
 * `FedosConversationDraftPersistence` this Arc reuses, unmodified,
 * throughout. Exposes no Direct path internal (`FedosGroupDirectPathRecord`
 * never crosses this boundary) — a caller only ever sees group-level
 * ids, generations, messages, and usability results.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import { evaluateFedosGroupUsability, type FedosGroupUsabilityResult } from "./fedos_group_usability.js";
import { FedosGroupGenerationAuthority, type FedosGroupCreateNextGenerationResult } from "./fedos_group_generation_authority.js";
import type { FedosGroupGenerationRecord } from "./fedos_group_generation.js";
import { FedosGroupAdmission, type FedosGroupAddMemberResult, type FedosGroupRemoveMemberResult } from "./fedos_group_admission.js";
import { FedosGroupSendCoordinator, type FedosGroupSendMessageCommand, type FedosGroupSendResult } from "./fedos_group_send_coordinator.js";
import { FedosGroupReadFacade, type FedosGroupMessageSummary } from "./fedos_group_read_facade.js";
import type { FedosGroupDirectPathPersistence } from "./fedos_group_direct_path.js";
import type { FedosGroupFanoutDeliveryPersistence } from "./fedos_group_fanout_delivery.js";
import type { FedosGroupMessagePersistence } from "./fedos_group_message.js";
import type { FedosConversationDirectMessagingCoordinator } from "../messaging/fedos_conversation_direct_messaging_coordinator.js";
import type { FedosGroupMessageLocalReadResult } from "./fedos_group_message_local_read_result.js";

export type FedosGroupRuntimeAddMemberResult =
  | { readonly outcome: "admitted"; readonly generation: FedosGroupCreateNextGenerationResult }
  | { readonly outcome: "already-member" }
  | { readonly outcome: "issuance-failed" }
  | { readonly outcome: "redemption-failed" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "unavailable" };

export type FedosGroupRuntimeRemoveMemberResult =
  | { readonly outcome: "revoked"; readonly generation: FedosGroupCreateNextGenerationResult }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "revocation-failed" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "unavailable" };

export interface FedosConversationGroupRuntimeDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly generationAuthority: FedosGroupGenerationAuthority;
  /** `null` when the Capability issuer/redemption backends were not injected — `addPrivateGroupMember()`/`removePrivateGroupMember()` then fail closed to `"unavailable"`. */
  readonly admission: FedosGroupAdmission | null;
  readonly sendCoordinator: FedosGroupSendCoordinator;
  readonly readFacade: FedosGroupReadFacade;
  /**
   * Secure Runtime Alpha 3081-3160 — the SAME three instances
   * `sendCoordinator`/`readFacade` above are already built over (never a
   * second, divergent set), so `resolveLocalGroupMessagePlaintext()` can
   * resolve the local participant's own fanned-out delivery -> Direct path
   * -> Direct read, exactly mirroring `FedosGroupSendCoordinator`'s own
   * existing "read the delivery/path facts, then delegate to the SAME
   * `FedosConversationDirectMessagingCoordinator`" composition.
   */
  readonly directPathPersistence: FedosGroupDirectPathPersistence;
  readonly deliveryPersistence: FedosGroupFanoutDeliveryPersistence;
  readonly messagePersistence: FedosGroupMessagePersistence;
  readonly directMessagingCoordinator: FedosConversationDirectMessagingCoordinator;
  readonly usabilityDeps: Parameters<typeof evaluateFedosGroupUsability>[0];
  readonly clock: () => number;
}

export class FedosConversationGroupRuntime {
  readonly #deps: FedosConversationGroupRuntimeDependencies;

  constructor(deps: FedosConversationGroupRuntimeDependencies) {
    this.#deps = deps;
  }

  /** Ensures the group's own current generation reflects its CURRENT active Membership — safe to call repeatedly. */
  preparePrivateGroup(groupConversationId: string): FedosGroupCreateNextGenerationResult {
    return this.#deps.generationAuthority.createNextGeneration(groupConversationId as FedosConversationId, this.#deps.clock());
  }

  readinessForPrivateGroup(groupConversationId: string): FedosGroupUsabilityResult {
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "member-invalid" };
    return evaluateFedosGroupUsability(this.#deps.usabilityDeps, groupConversationId as FedosConversationId, identity.creator);
  }

  async sendPrivateGroupMessage(command: FedosGroupSendMessageCommand): Promise<FedosGroupSendResult> {
    return this.#deps.sendCoordinator.sendGroupMessage(command);
  }

  listPrivateGroupMessages(groupConversationId: string): readonly FedosGroupMessageSummary[] {
    return this.#deps.readFacade.listMessages(groupConversationId as FedosConversationId);
  }

  listPrivateGroupGenerations(groupConversationId: string): readonly FedosGroupGenerationRecord[] {
    return this.#deps.readFacade.listGenerations(groupConversationId as FedosConversationId);
  }

  addPrivateGroupMember(groupConversationId: string, newMember: FedosConversationParticipantReference): FedosGroupRuntimeAddMemberResult {
    if (this.#deps.admission === null) return { outcome: "unavailable" };
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const now = this.#deps.clock();
    const result: FedosGroupAddMemberResult = this.#deps.admission.addMember(groupConversationId as FedosConversationId, identity.creator, newMember, now);
    if (result.outcome !== "admitted" && result.outcome !== "already-member") return result;
    const generation = this.#deps.generationAuthority.createNextGeneration(groupConversationId as FedosConversationId, now);
    return { outcome: "admitted", generation };
  }

  removePrivateGroupMember(groupConversationId: string, member: FedosConversationParticipantReference): FedosGroupRuntimeRemoveMemberResult {
    if (this.#deps.admission === null) return { outcome: "unavailable" };
    const now = this.#deps.clock();
    const result: FedosGroupRemoveMemberResult = this.#deps.admission.removeMember(groupConversationId as FedosConversationId, member, now);
    if (result.outcome !== "revoked") return result;
    const generation = this.#deps.generationAuthority.createNextGeneration(groupConversationId as FedosConversationId, now);
    return { outcome: "revoked", generation };
  }

  /**
   * Secure Runtime Alpha 3081-3160 — reads the LOCAL participant's own
   * fanned-out copy of one Group Message, by resolving their own
   * `FedosGroupFanoutDeliveryRecord` (never the sender's own canonical
   * `FedosGroupMessageRecord`, which carries no plaintext/ciphertext of any
   * kind — see that type's own header) and delegating to the SAME frozen
   * `FedosConversationDirectMessagingCoordinator.readDirectMessage()` every
   * Direct read already uses. Invents no crypto, no new Envelope lookup, no
   * second retention gate (the reused Direct read already enforces
   * retention). `"own-message"`/`"not-a-recipient"` are the two honest,
   * structural outcomes this composition alone needs — see
   * `./fedos_group_message_local_read_result.ts`'s own header for why.
   */
  async resolveLocalGroupMessagePlaintext(groupConversationId: string, groupMessageId: string): Promise<FedosGroupMessageLocalReadResult> {
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localMembership = this.#deps.membershipAuthority.findMembership(groupConversationId as FedosConversationId, identity.creator);
    if (localMembership === null || localMembership.state !== "active") return { outcome: "unauthorized" };
    const localMembershipId = localMembership.id as string;

    const message = this.#deps.messagePersistence.getMessage(groupMessageId);
    if (message === null || message.groupConversationId !== groupConversationId) return { outcome: "not-found" };
    if (message.senderMembershipId === localMembershipId) return { outcome: "own-message" };

    const delivery = this.#deps.deliveryPersistence.getDelivery(groupMessageId, localMembershipId);
    if (delivery === null) return { outcome: "not-a-recipient" };
    if (delivery.state !== "stored" || delivery.envelopeId === null) return { outcome: "payload-unavailable" };

    const path = this.#deps.directPathPersistence.getPath(delivery.pathId);
    if (path === null) return { outcome: "payload-unavailable" };

    return this.#deps.directMessagingCoordinator.readDirectMessage({
      conversationId: path.directConversationId,
      envelopeId: delivery.envelopeId,
    });
  }
}
