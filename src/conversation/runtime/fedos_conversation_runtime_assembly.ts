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
import { InMemoryFedosConversationCapabilityAuthority } from "../capability/in_memory_fedos_conversation_capability_authority.js";
import { PersistedFedosConversationCapabilityAuthority } from "../capability/persistence/persisted_fedos_conversation_capability_authority.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import type { FedosConversationCapabilityIdGenerator } from "../capability/in_memory_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilitySecretGenerator } from "../capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationDraftPersistence } from "../construction/in_memory_fedos_conversation_draft_persistence.js";
import { AppendOnlyFedosConversationDraftPersistence } from "../construction/append_only_fedos_conversation_draft_persistence.js";
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
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationPayloadStorage } from "../payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../payload_storage/append_only_fedos_conversation_payload_storage.js";
import type { FedosConversationEncryptionCoordinationPersistence } from "../encryption/coordination/fedos_conversation_encryption_coordination_persistence.js";
import { InMemoryFedosConversationEncryptionCoordinationPersistence } from "../encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import type { FedosConversationEncryptionAuthority } from "../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosNostrAuthorBindingAuthority } from "../../board/runtime/identity/fedos_nostr_author_binding_types.js";
import type { FedosConversationEnvelopeIdGenerator } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadIdGenerator } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationEncryptionIdempotencyKeyGenerator } from "../encryption/fedos_conversation_encryption_coordinator.js";

export interface FedosConversationRuntimeAssemblyConfig {
  /** Explicit, caller-supplied append-only log path for the private-draft record; omitted, an in-memory backend is used. */
  readonly draftLogPath?: string;
  /** Explicit append-only log path for creator/participant Membership; omitted, in-memory. */
  readonly membershipLogPath?: string;
  /** Explicit append-only log path for Capabilities; omitted, in-memory. */
  readonly capabilityLogPath?: string;
  /** Explicit append-only log path for the construction-coordination facts; omitted, in-memory. */
  readonly constructionCoordinationLogPath?: string;
  /** Alpha 949 — explicit append-only log path for private-message Envelope metadata; omitted, in-memory. */
  readonly envelopeLogPath?: string;
  /** Alpha 949 — explicit append-only log path for opaque ciphertext payload bytes; omitted, in-memory. */
  readonly payloadLogPath?: string;
  /** Alpha 949 — optional, only meaningful with `payloadLogPath`; default `1_000_000` bytes, matching this codebase's own established `AppendOnlyFedosConversationPayloadStorage` convention (`test/secure_runtime_alpha_809_append_only_payload_storage.test.ts`). */
  readonly maxPayloadByteLength?: number;
  /** Alpha 949 — explicit append-only log path for the encryption-coordination facts; omitted, in-memory. */
  readonly encryptionCoordinationLogPath?: string;
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
  /** Alpha 949 — optional, default `UnavailableFedosConversationEncryptionAuthority` (Alpha 942). */
  readonly encryptionAuthority?: FedosConversationEncryptionAuthority;
  /** Alpha 949 — optional, default `UnavailableFedosConversationDecryptionAuthority` (Alpha 942). */
  readonly decryptionAuthority?: FedosConversationDecryptionAuthority;
  /** Alpha 949 — optional, default delegates to `creatorIdentityAuthority` (Alpha 931). */
  readonly identityResolver?: FedosConversationIdentityResolver;
  /** Alpha 949 — optional, default fixed `0` (Alpha 933). */
  readonly accountIndexAuthority?: FedosConversationLocalAccountIndexAuthority;
  /** Alpha 949 — optional; omitted, a `"nostr"`-authority local identity fails closed (Alpha 935). */
  readonly nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority;
  /** Alpha 949 — optional, default secure-random. */
  readonly envelopeIdGenerator?: FedosConversationEnvelopeIdGenerator;
  /** Alpha 949 — optional, default secure-random. */
  readonly payloadIdGenerator?: FedosConversationPayloadIdGenerator;
  /** Alpha 949 — optional, default secure-random. */
  readonly encryptionIdempotencyKeyGenerator?: FedosConversationEncryptionIdempotencyKeyGenerator;
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

  const capabilityIssuerAuthority: FedosConversationCapabilityIssuerAuthority =
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

  // Alpha 949 — the Encryption Runtime Wiring's own additive backends,
  // append-only when a log path is supplied, in-memory otherwise; mirrors
  // every backend construction above exactly.
  const envelopePersistence: FedosConversationMessageEnvelopePersistence =
    config.envelopeLogPath !== undefined
      ? new AppendOnlyFedosConversationMessageEnvelopePersistence(config.envelopeLogPath)
      : new InMemoryFedosConversationMessageEnvelopePersistence();

  const payloadStorage: FedosConversationPayloadStorage =
    config.payloadLogPath !== undefined
      ? new AppendOnlyFedosConversationPayloadStorage(config.payloadLogPath, config.maxPayloadByteLength ?? 1_000_000)
      : new InMemoryFedosConversationPayloadStorage();

  const encryptionCoordinationPersistence: FedosConversationEncryptionCoordinationPersistence =
    config.encryptionCoordinationLogPath !== undefined
      ? new AppendOnlyFedosConversationEncryptionCoordinationPersistence(config.encryptionCoordinationLogPath)
      : new InMemoryFedosConversationEncryptionCoordinationPersistence();

  return {
    draftPersistence,
    coordinationPersistence,
    membershipAuthority,
    capabilityIssuerAuthority,
    creatorIdentityAuthority: config.creatorIdentityAuthority ?? new AnonymousLocalFedosConversationCreatorIdentityAuthority(),
    encryptionReadinessAuthority:
      config.encryptionReadinessAuthority ?? new UnavailableFedosConversationEncryptionReadinessAuthority(),
    idGenerator: config.constructionIdGenerator ?? new FedosSecureRandomConstructionIdGenerator(),
    clock: config.clock,
    requireResolvedCreatorIdentity: config.requireResolvedCreatorIdentity,
    encryptionAuthority: config.encryptionAuthority,
    decryptionAuthority: config.decryptionAuthority,
    envelopePersistence,
    payloadStorage,
    encryptionCoordinationPersistence,
    identityResolver: config.identityResolver,
    accountIndexAuthority: config.accountIndexAuthority,
    nostrAuthorBindingAuthority: config.nostrAuthorBindingAuthority,
    envelopeIdGenerator: config.envelopeIdGenerator,
    payloadIdGenerator: config.payloadIdGenerator,
    encryptionIdempotencyKeyGenerator: config.encryptionIdempotencyKeyGenerator,
  };
}
