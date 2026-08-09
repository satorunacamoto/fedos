/**
 * Secure Runtime Alpha 1334/1335/1338 ("Path Creation Authority" /
 * "Path Idempotency" / "Unsupported Identity Domains") — Phase B of the
 * Alpha 1321–1390 Private Group Pairwise Fanout Foundation Arc.
 *
 * Prepares exactly one pairwise Direct path, composed ENTIRELY over
 * existing, unmodified application boundaries — never constructing an
 * "active" fact directly:
 *   - `FedosPrivateConversationConstructionCoordinator.createDirectDraft()`
 *     (Alpha 915) for the underlying Direct draft + one-time recipient
 *     Capability.
 *   - `FedosConversationCapabilityRedemptionAuthority.redeem()`
 *     (Alpha 783) to admit the counterparty's own Membership.
 *   - `FedosConversationDirectActivationCoordinator.activateDirectConversation()`
 *     (Alpha 1122, unmodified) to activate it.
 *
 * A counterparty whose `authority !== "nostr"` can never resolve a
 * pairwise key (`resolveFedosConversationCounterpartyPublicKeyHex`,
 * Alpha 934, unmodified) — this authority marks such a path
 * `"unavailable"` PERMANENTLY (Alpha 1338: "do not automatically bridge
 * protocol identities") without ever attempting construction for it.
 *
 * KNOWN, NAMED LIMITATION (honest, not silently papered over): the
 * one-time Capability bearer secret `createDirectDraft()` returns exists
 * only in that single call's own return value. If THIS process crashes
 * between that call succeeding and this SAME function's own redemption
 * call completing, the secret is unrecoverable and this path
 * permanently reports `"admission-failed"` on every future retry — a
 * real, narrow gap inherent to self-serve, single-Runtime redemption
 * this Arc does not solve (a multi-device/protocol-delivered invitation
 * flow would not share this gap, but does not exist yet, per
 * `docs/reviews/private_protocol_delivery_group_v1/`).
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { toFedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosPrivateConversationConstructionCoordinator } from "../construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../capability/fedos_conversation_capability_redemption_authority.js";
import type { FedosConversationDirectActivationCoordinator } from "../activation/fedos_conversation_direct_activation_coordinator.js";
import { toFedosPrivateConversationId } from "../construction/fedos_private_conversation_id.js";
import {
  toFedosGroupDirectPathId,
  toFedosGroupPairKey,
  type FedosGroupDirectPathPersistence,
  type FedosGroupDirectPathRecord,
} from "./fedos_group_direct_path.js";

export type FedosGroupPreparePathResult =
  | { readonly outcome: "ready"; readonly path: FedosGroupDirectPathRecord }
  | { readonly outcome: "unavailable"; readonly path: FedosGroupDirectPathRecord }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "construction-failed" }
  | { readonly outcome: "admission-failed" }
  | { readonly outcome: "activation-failed" }
  | { readonly outcome: "persistence-failed" };

export interface FedosGroupDirectPathAuthorityDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly pathPersistence: FedosGroupDirectPathPersistence;
  readonly constructionCoordinator: FedosPrivateConversationConstructionCoordinator;
  /** Optional — when omitted, a path that ever needs redemption fails closed to `"admission-failed"` (mirrors this file's own "Known, named limitation"). */
  readonly redemptionAuthority?: FedosConversationCapabilityRedemptionAuthority;
  readonly activationCoordinator: FedosConversationDirectActivationCoordinator;
}

export class FedosGroupDirectPathAuthority {
  readonly #deps: FedosGroupDirectPathAuthorityDependencies;

  constructor(deps: FedosGroupDirectPathAuthorityDependencies) {
    this.#deps = deps;
  }

  async preparePath(
    groupConversationId: FedosConversationId,
    generationId: string,
    localParticipant: FedosConversationParticipantReference,
    counterpartyParticipant: FedosConversationParticipantReference,
    now: number,
  ): Promise<FedosGroupPreparePathResult> {
    if (typeof generationId !== "string" || generationId.length === 0) return { outcome: "invalid-input" };
    const localMembershipId = toFedosConversationMembershipId(groupConversationId, localParticipant) as string;
    const counterpartyMembershipId = toFedosConversationMembershipId(groupConversationId, counterpartyParticipant) as string;
    const pathId = toFedosGroupDirectPathId(groupConversationId, generationId, localMembershipId, counterpartyMembershipId);

    const existing = this.#deps.pathPersistence.getPath(pathId);
    if (existing !== null && (existing.state === "ready" || existing.state === "unavailable")) {
      return { outcome: existing.state, path: existing };
    }

    // Alpha 1338 — permanent, never attempted, never retried.
    if (counterpartyParticipant.authority !== "nostr") {
      return this.#writePath(pathId, groupConversationId, generationId, localMembershipId, counterpartyMembershipId, "", "unavailable", now);
    }

    const pairKey = toFedosGroupPairKey(groupConversationId, localMembershipId, counterpartyMembershipId);
    const directConversationId = toFedosPrivateConversationId("direct", pairKey);

    let issuedCapability: { readonly capabilityId: string; readonly bearerSecret: unknown } | null = null;
    if (this.#deps.draftPersistence.getDraft(directConversationId) === null) {
      const construction = this.#deps.constructionCoordinator.createDirectDraft({
        recipient: { authority: counterpartyParticipant.authority, publicIdentifier: counterpartyParticipant.publicIdentifier },
        idempotencyKey: pairKey,
      });
      if (construction.outcome === "draft-created" && construction.capability !== undefined) {
        issuedCapability = {
          capabilityId: construction.capability.descriptor.capabilityId,
          bearerSecret: construction.capability.bearerSecret,
        };
      } else if (construction.outcome !== "already-present") {
        return { outcome: "construction-failed" };
      }
    }

    const recipientMembership = this.#deps.membershipAuthority.findMembership(directConversationId, counterpartyParticipant);
    if (recipientMembership === null || recipientMembership.state !== "active") {
      if (issuedCapability === null || this.#deps.redemptionAuthority === undefined) return { outcome: "admission-failed" }; // Known limitation — see this file's own header.
      const redemption = this.#deps.redemptionAuthority.redeem(
        {
          capabilityId: issuedCapability.capabilityId as never,
          bearerSecret: issuedCapability.bearerSecret as never,
          redeemer: counterpartyParticipant,
        },
        now,
      );
      if (redemption.outcome !== "redeemed") return { outcome: "admission-failed" };
    }

    const activation = await this.#deps.activationCoordinator.activateDirectConversation(directConversationId);
    if (activation.outcome !== "activated" && activation.outcome !== "already-active") {
      return { outcome: "activation-failed" };
    }

    return this.#writePath(pathId, groupConversationId, generationId, localMembershipId, counterpartyMembershipId, directConversationId, "ready", now);
  }

  #writePath(
    pathId: string,
    groupConversationId: string,
    generationId: string,
    senderMembershipId: string,
    recipientMembershipId: string,
    directConversationId: string,
    state: "ready" | "unavailable",
    now: number,
  ): FedosGroupPreparePathResult {
    const record: FedosGroupDirectPathRecord = {
      pathId,
      groupConversationId,
      generationId,
      senderMembershipId,
      recipientMembershipId,
      directConversationId,
      state,
      createdAt: now,
      updatedAt: now,
    };
    const write = this.#deps.pathPersistence.putPathFact(record);
    if (write === "failed" || write === "conflict") return { outcome: "persistence-failed" };
    return { outcome: state, path: record };
  }
}
