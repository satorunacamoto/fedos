/**
 * Secure Runtime Alpha 1122 ("Direct Activation Coordinator") — Phase B of
 * the Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * `activateDirectConversation(conversationId)` — the ONE narrow operation
 * that transitions a real, durable `direct` draft into a genuinely active
 * Conversation, proven by EVERY required fact (Alpha 1117), never one
 * stored boolean. Composed entirely over EXISTING, unmodified machinery —
 * this file invents no new cryptography, no new Membership concept, no new
 * identity resolution:
 *
 *   - `FedosConversationIdentityResolver` (Alpha 931) — resolves the LOCAL
 *     controlled participant.
 *   - `FedosConversationMembershipAuthority` (Alpha 761–790, unmodified) —
 *     proves the local participant's own active Membership.
 *   - `MembershipFedosConversationParticipantResolver` (Alpha 932) —
 *     resolves (and, by construction, proves ACTIVE) the one counterparty.
 *   - `FedosConversationKeyResolver` (Alpha 935) — proves pairwise key
 *     readiness in ONE call: identity resolution, account-index
 *     resolution, counterparty public-key resolution, and Nostr-binding
 *     verification are ALL already inside it; this coordinator re-derives
 *     none of them.
 *   - `resolveFedosPrivateConversationPolicy()` (Alpha 896, unmodified) —
 *     proves policy permits direct messaging.
 *
 * SEQUENCE (Alpha 1122's own list), REVALIDATED IN FULL on every call
 * rather than resuming from a mid-sequence phase — the smallest
 * restart-recoverable design (Alpha 1119's own "reject a generic
 * transaction framework" ruling): every check below is a pure, side-
 * effect-free read, so re-running all of them on a recovery call is cheap
 * and, unlike skipping forward from a stale phase, never trusts a fact
 * that may have stopped being true between attempts (Alpha 1125's own
 * "readiness remains valid or is revalidated honestly" requirement). The
 * ONLY short-circuit is `"completed"` itself — once genuinely active, a
 * repeat call is a pure, non-mutating `"already-active"` read.
 *
 * No message is ever sent during activation (Alpha 1122's own explicit
 * rule) — this coordinator writes ONLY Activation coordination facts, never
 * an Envelope or a Payload.
 */

import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { resolveFedosPrivateConversationPolicy } from "../construction/fedos_private_conversation_policy.js";
import type { FedosPrivateConversationPolicyReference } from "../construction/fedos_conversation_draft_record.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationParticipantResolver } from "../encryption/identity/fedos_conversation_participant_resolver.js";
import type { FedosConversationKeyResolver } from "../encryption/identity/fedos_conversation_key_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../encryption/fedos_conversation_decryption_authority.js";
import { UnavailableFedosConversationEncryptionAuthority } from "../encryption/fedos_unavailable_conversation_encryption_authority.js";
import { UnavailableFedosConversationDecryptionAuthority } from "../encryption/fedos_unavailable_conversation_decryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import type { FedosConversationActivationPersistence } from "./fedos_conversation_activation_persistence.js";
import {
  fedosConversationActivationId,
  type FedosConversationActivationPhase,
  type FedosPersistedConversationActivationV1,
} from "./fedos_persisted_conversation_activation_v1.js";
import type { FedosConversationDirectActivationResult } from "./fedos_conversation_direct_activation_result.js";

export interface FedosConversationDirectActivationCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly participantResolver: FedosConversationParticipantResolver;
  readonly keyResolver: FedosConversationKeyResolver;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly decryptionAuthority: FedosConversationDecryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly retentionAuthority: FedosPayloadRetentionAuthority;
  readonly clock: FedosBoardRuntimeClock;
}

export class FedosConversationDirectActivationCoordinator {
  readonly #deps: FedosConversationDirectActivationCoordinatorDependencies;

  constructor(deps: FedosConversationDirectActivationCoordinatorDependencies) {
    this.#deps = deps;
  }

  async activateDirectConversation(conversationId: string): Promise<FedosConversationDirectActivationResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { outcome: "conversation-not-found" };
    }
    const id = conversationId as FedosConversationId;

    // Step 1 -- find draft.
    const draft = this.#deps.draftPersistence.getDraft(id);
    if (draft === null) return { outcome: "conversation-not-found" };

    // Step 2 -- verify direct mode. Alpha 1123's own Private-Group Gate:
    // never activate, never invent a group/shared key, no message API
    // ever becomes reachable for a private-group draft.
    if (draft.mode !== "direct") return { outcome: "unsupported-mode" };

    const activationId = fedosConversationActivationId(id);
    const existing = this.#deps.activationPersistence.getActivation(activationId);
    if (existing?.phase === "completed") return { outcome: "already-active" };

    const now = this.#deps.clock();
    const startedAt = existing?.startedAt ?? now;
    this.#putFact(activationId, id, "prepared", startedAt, now);

    // Step 3 -- resolve policy. A direct draft's own fixed policy (Alpha
    // 896) must genuinely permit private, member-restricted messaging.
    const policy = resolveFedosPrivateConversationPolicy(draft.policyReference as FedosPrivateConversationPolicyReference);
    if (policy.mode !== "direct" || policy.writeAccess !== "restricted" || policy.readAccess !== "members-only") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "policy-invalid" };
    }

    // Step 4 -- resolve the LOCAL controlled participant.
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "identity-unavailable" };
    }
    const localParticipant = identity.creator;

    // Step 4b -- the LOCAL participant must hold real, active Membership.
    const localMembership = this.#deps.membershipAuthority.findMembership(id, localParticipant);
    if (localMembership === null || localMembership.state !== "active") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "membership-invalid" };
    }

    // Step 4c -- resolve (and, by construction, prove ACTIVE) the ONE
    // counterparty (Alpha 932's own V1 "exactly one other active member"
    // scope).
    const participants = this.#deps.participantResolver.resolveCounterparty(id, localParticipant);
    if (participants.outcome === "not-member") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "membership-invalid" };
    }
    if (participants.outcome === "no-counterparty" || participants.outcome === "ambiguous-counterparty") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "participant-unavailable" };
    }

    // Step 5 -- resolve pairwise crypto readiness. ONE call already proves
    // identity resolution, account-index resolution, counterparty
    // public-key resolution, and (for a Nostr-keyed local identity)
    // cryptographic binding verification (Alpha 935) -- never re-derived
    // here.
    const keyResolution = await this.#deps.keyResolver.resolve(id);
    if (keyResolution.outcome !== "resolved") {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return this.#mapKeyResolutionFailure(keyResolution.outcome);
    }

    // Encryption/Decryption Authority availability -- the default
    // `Unavailable*` placeholders (Alpha 942) never claim readiness they
    // cannot back; activation must not proceed over them (Alpha 1115's
    // own "direct activation is unavailable" fail-closed default).
    if (
      this.#deps.encryptionAuthority instanceof UnavailableFedosConversationEncryptionAuthority ||
      this.#deps.decryptionAuthority instanceof UnavailableFedosConversationDecryptionAuthority
    ) {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "encryption-unavailable" };
    }

    if (
      this.#deps.envelopePersistence === undefined ||
      this.#deps.payloadStorage === undefined ||
      !(this.#deps.retentionAuthority instanceof FedosPayloadRetentionAuthority)
    ) {
      this.#putFact(activationId, id, "terminal-failed", startedAt, now);
      return { outcome: "storage-unavailable" };
    }

    this.#putFact(activationId, id, "readiness-confirmed", startedAt, now);
    this.#putFact(activationId, id, "lifecycle-activated", startedAt, now);
    const completionWrite = this.#putFact(activationId, id, "completed", startedAt, now);
    if (completionWrite === "failed") return { outcome: "persistence-failed" };
    if (completionWrite === "conflict") return { outcome: "conflict" };

    return { outcome: "activated" };
  }

  #mapKeyResolutionFailure(outcome: string): FedosConversationDirectActivationResult {
    switch (outcome) {
      case "identity-unavailable":
      case "identity-binding-unavailable":
      case "identity-binding-mismatch":
        return { outcome: "identity-unavailable" };
      case "not-member":
        return { outcome: "membership-invalid" };
      case "no-counterparty":
      case "ambiguous-counterparty":
      case "unsupported-counterparty-authority":
      case "invalid-counterparty-public-key":
        return { outcome: "participant-unavailable" };
      default:
        return { outcome: "unavailable" };
    }
  }

  #putFact(
    activationId: string,
    conversationId: string,
    phase: FedosConversationActivationPhase,
    startedAt: number,
    now: number,
  ): "inserted" | "already-present" | "conflict" | "failed" {
    const fact: FedosPersistedConversationActivationV1 = {
      schemaVersion: 1,
      activationId,
      conversationId,
      phase,
      startedAt,
      updatedAt: now,
    };
    return this.#deps.activationPersistence.putActivationFact(fact);
  }
}
