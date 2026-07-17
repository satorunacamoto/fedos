/**
 * Secure Runtime Alpha 923 ("Running Runtime Integration") — Phase D of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * The ONE wiring point that assembles a `FedosConversationRuntimeDependencies`
 * from durable log paths (or in-memory defaults) plus optional injected
 * authorities. The Local Runtime (`../../desktop/runtime/fedos_desktop_runtime.ts`)
 * calls this to build the conversation-runtime dependency set alongside
 * its Board/Host wiring, keeping the desktop file's own diff small.
 *
 * The Capability authority's `existenceCheck`/`authorizationCheck` are
 * REAL, honest checks (never the always-true test convenience the Alpha
 * 780 header warns against): existence is "a durable draft record exists
 * for this id," and authorization is "the issuer is an ACTIVE owner or
 * moderator Member of this draft." That is exactly the authority a
 * just-constructed private draft's creator legitimately holds to issue
 * its initial join Capability — resolved from real durable Membership,
 * never asserted.
 *
 * Every optional dependency has a safe default: anonymous-local creator
 * identity, UNAVAILABLE encryption readiness (Alpha 924 — no fallback
 * crypto), and secure-random id/secret generators. No `process.env` read,
 * no automatic network/timer, no Host internal reached.
 */

import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationMembershipAuthority } from "../membership/in_memory_fedos_conversation_membership_authority.js";
import { PersistedFedosConversationMembershipAuthority } from "../membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMembershipPersistence } from "../membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityIssuerAuthority } from "../capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../capability/fedos_conversation_capability_redemption_authority.js";
import type { FedosConversationCapabilityDescriptor } from "../capability/fedos_conversation_capability_descriptor.js";
import { InMemoryFedosConversationCapabilityAuthority } from "../capability/in_memory_fedos_conversation_capability_authority.js";
import { PersistedFedosConversationCapabilityAuthority } from "../capability/persistence/persisted_fedos_conversation_capability_authority.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import type { FedosConversationCapabilityIdGenerator } from "../capability/in_memory_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilitySecretGenerator } from "../capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationDraftPersistence } from "../construction/in_memory_fedos_conversation_draft_persistence.js";
import { AppendOnlyFedosConversationDraftPersistence } from "../construction/append_only_fedos_conversation_draft_persistence.js";
import type { FedosConversationDraftRecord } from "../construction/fedos_conversation_draft_record.js";
import type { FedosConversationDraftManagementPersistence } from "../construction/fedos_conversation_draft_management_persistence.js";
import { InMemoryFedosConversationDraftManagementPersistence } from "../construction/in_memory_fedos_conversation_draft_management_persistence.js";
import { AppendOnlyFedosConversationDraftManagementPersistence } from "../construction/append_only_fedos_conversation_draft_management_persistence.js";
import type { FedosConversationInvitationRevocationRegistry } from "../invitation/fedos_conversation_invitation_revocation_registry.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import { AppendOnlyFedosConversationInvitationRevocationRegistry } from "../invitation/append_only_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationConstructionCoordinationPersistence } from "../construction/coordination/fedos_conversation_construction_coordination_persistence.js";
import { InMemoryFedosConversationConstructionCoordinationPersistence } from "../construction/coordination/in_memory_fedos_conversation_construction_coordination_persistence.js";
import { AppendOnlyFedosConversationConstructionCoordinationPersistence } from "../construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.js";
import {
  AnonymousLocalFedosConversationCreatorIdentityAuthority,
  type FedosConversationCreatorIdentityAuthority,
} from "../construction/fedos_conversation_creator_identity_authority.js";
import {
  FedosSecureRandomConstructionIdGenerator,
  type FedosConversationConstructionIdGenerator,
} from "../construction/fedos_private_conversation_construction_coordinator.js";
import {
  UnavailableFedosConversationEncryptionReadinessAuthority,
  type FedosConversationEncryptionReadinessAuthority,
} from "../readiness/fedos_conversation_encryption_readiness_authority.js";
import {
  FedosSecureRandomCapabilityIdGenerator,
  FedosSecureRandomCapabilitySecretGenerator,
} from "./fedos_conversation_capability_generators.js";
import type { FedosConversationRuntimeDependencies } from "./fedos_conversation_runtime.js";

export interface FedosConversationRuntimeAssemblyConfig {
  /** Explicit, caller-supplied append-only log path for the private-draft record; omitted, an in-memory backend is used. */
  readonly draftLogPath?: string;
  /** Explicit append-only log path for creator/participant Membership; omitted, in-memory. */
  readonly membershipLogPath?: string;
  /** Explicit append-only log path for Capabilities; omitted, in-memory. */
  readonly capabilityLogPath?: string;
  /** Explicit append-only log path for the construction-coordination facts; omitted, in-memory. */
  readonly constructionCoordinationLogPath?: string;
  /** Explicit append-only log path for invitation-revocation facts (Alpha 996); omitted, in-memory. */
  readonly invitationRevocationLogPath?: string;
  /** Explicit append-only log path for draft-management-state facts (Alpha 1003); omitted, in-memory. */
  readonly draftManagementLogPath?: string;
  readonly clock: FedosBoardRuntimeClock;
  /** Optional — default anonymous-local (Alpha 904). */
  readonly creatorIdentityAuthority?: FedosConversationCreatorIdentityAuthority;
  /** Optional — default UNAVAILABLE (Alpha 924); a future encryption Arc injects a real one. */
  readonly encryptionReadinessAuthority?: FedosConversationEncryptionReadinessAuthority;
  /** Optional — default secure-random. */
  readonly constructionIdGenerator?: FedosConversationConstructionIdGenerator;
  /** Optional — default secure-random. */
  readonly capabilityIdGenerator?: FedosConversationCapabilityIdGenerator;
  /** Optional — default secure-random. */
  readonly capabilitySecretGenerator?: FedosConversationCapabilitySecretGenerator;
  /** Optional — default `false` (Alpha 904). */
  readonly requireResolvedCreatorIdentity?: boolean;
}

function participantIsActiveInviter(
  membershipAuthority: FedosConversationMembershipAuthority,
  conversationId: FedosConversationId,
  issuer: FedosConversationParticipantReference,
): boolean {
  const membership = membershipAuthority.findMembership(conversationId, issuer);
  return membership !== null && membership.state === "active" && (membership.role === "owner" || membership.role === "moderator");
}

/**
 * Assembles the full dependency set. Pure with respect to the filesystem
 * beyond the append-only backends' own lazy reads — constructs no file,
 * starts no timer, reads no `process.env`. The caller (the Local Runtime)
 * is responsible for ensuring any log path's parent directory exists,
 * exactly as it already does for its Board/Outbox logs.
 */
export function assembleFedosConversationRuntimeDependencies(
  config: FedosConversationRuntimeAssemblyConfig,
): FedosConversationRuntimeDependencies {
  const draftPersistence: FedosConversationDraftPersistence =
    config.draftLogPath !== undefined
      ? new AppendOnlyFedosConversationDraftPersistence(config.draftLogPath)
      : new InMemoryFedosConversationDraftPersistence();

  const membershipAuthority: FedosConversationMembershipAuthority =
    config.membershipLogPath !== undefined
      ? new PersistedFedosConversationMembershipAuthority(new AppendOnlyFedosConversationMembershipPersistence(config.membershipLogPath))
      : new InMemoryFedosConversationMembershipAuthority();

  const coordinationPersistence: FedosConversationConstructionCoordinationPersistence =
    config.constructionCoordinationLogPath !== undefined
      ? new AppendOnlyFedosConversationConstructionCoordinationPersistence(config.constructionCoordinationLogPath)
      : new InMemoryFedosConversationConstructionCoordinationPersistence();

  const capabilityIdGenerator = config.capabilityIdGenerator ?? new FedosSecureRandomCapabilityIdGenerator();
  const capabilitySecretGenerator = config.capabilitySecretGenerator ?? new FedosSecureRandomCapabilitySecretGenerator();

  const existenceCheck = (conversationId: FedosConversationId): boolean => draftPersistence.getDraft(conversationId) !== null;
  const authorizationCheck = (conversationId: FedosConversationId, issuer: FedosConversationParticipantReference): boolean =>
    participantIsActiveInviter(membershipAuthority, conversationId, issuer);

  // One concrete instance implements BOTH the issuer and redemption halves of
  // the frozen Capability boundary (Alpha 786/841) — the invitation transport
  // (Alpha 999) needs both, so it is typed as their intersection and shared.
  const capabilityAuthority: FedosConversationCapabilityIssuerAuthority & FedosConversationCapabilityRedemptionAuthority =
    config.capabilityLogPath !== undefined
      ? new PersistedFedosConversationCapabilityAuthority({
          persistence: new AppendOnlyFedosConversationCapabilityPersistence(config.capabilityLogPath),
          idGenerator: capabilityIdGenerator,
          secretGenerator: capabilitySecretGenerator,
          existenceCheck,
          authorizationCheck,
          membershipAuthority,
        })
      : new InMemoryFedosConversationCapabilityAuthority({
          idGenerator: capabilityIdGenerator,
          secretGenerator: capabilitySecretGenerator,
          existenceCheck,
          authorizationCheck,
          membershipAuthority,
        });

  // Alpha 996/1003 — the two NEW additive backends this Arc introduces.
  const invitationRevocationRegistry: FedosConversationInvitationRevocationRegistry =
    config.invitationRevocationLogPath !== undefined
      ? new AppendOnlyFedosConversationInvitationRevocationRegistry(config.invitationRevocationLogPath)
      : new InMemoryFedosConversationInvitationRevocationRegistry();

  const draftManagementPersistence: FedosConversationDraftManagementPersistence =
    config.draftManagementLogPath !== undefined
      ? new AppendOnlyFedosConversationDraftManagementPersistence(config.draftManagementLogPath)
      : new InMemoryFedosConversationDraftManagementPersistence();

  // Alpha 1011 — REAL, honest authorization (never always-true). A revoker may
  // revoke an invitation iff they issued it OR are an active owner/moderator
  // member of its conversation — the same authority that could have issued it.
  const invitationRevocationAuthorizationCheck = (
    descriptor: FedosConversationCapabilityDescriptor,
    revoker: FedosConversationParticipantReference,
  ): boolean => {
    if (descriptor.issuer.authority === revoker.authority && descriptor.issuer.publicIdentifier === revoker.publicIdentifier) {
      return true;
    }
    return participantIsActiveInviter(membershipAuthority, descriptor.conversationId as FedosConversationId, revoker);
  };

  // Alpha 1011 — a draft's creator, or an active owner/moderator member, may
  // delete/restore it.
  const draftManagementAuthorizationCheck = (
    draft: FedosConversationDraftRecord,
    actor: FedosConversationParticipantReference,
  ): boolean => {
    if (draft.creator.authority === actor.authority && draft.creator.publicIdentifier === actor.publicIdentifier) {
      return true;
    }
    return participantIsActiveInviter(membershipAuthority, draft.id, actor);
  };

  return {
    draftPersistence,
    coordinationPersistence,
    membershipAuthority,
    capabilityIssuerAuthority: capabilityAuthority,
    capabilityRedemptionAuthority: capabilityAuthority,
    invitationRevocationRegistry,
    invitationRevocationAuthorizationCheck,
    draftManagementPersistence,
    draftManagementAuthorizationCheck,
    creatorIdentityAuthority: config.creatorIdentityAuthority ?? new AnonymousLocalFedosConversationCreatorIdentityAuthority(),
    encryptionReadinessAuthority:
      config.encryptionReadinessAuthority ?? new UnavailableFedosConversationEncryptionReadinessAuthority(),
    idGenerator: config.constructionIdGenerator ?? new FedosSecureRandomConstructionIdGenerator(),
    clock: config.clock,
    requireResolvedCreatorIdentity: config.requireResolvedCreatorIdentity,
  };
}
