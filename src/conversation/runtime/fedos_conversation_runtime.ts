/**
 * Secure Runtime Alpha 921 ("Runtime Ownership Decision") / Alpha 922
 * ("Conversation Runtime API") / Alpha 925 ("Read Facade") — Phase D of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * Alpha 921 compared: (A) extend `FedosBoardRuntime`, (B) a NEW
 * `FedosConversationRuntime`, (C) commands on Host, (D) commands on the
 * Local Runtime handle. ADOPTED: B — a dedicated `FedosConversationRuntime`,
 * a NEW peer to `FedosBoardRuntime` (never a wrapper, never a subclass),
 * owned by the Local Runtime (Alpha 923). `FedosBoardRuntime` keeps owning
 * PUBLIC Board construction unchanged; Host keeps owning process/resource
 * lifecycle; private-draft construction is Conversation APPLICATION logic
 * and lives here. Confirmed feasible against the real
 * `fedos_desktop_runtime.ts` shape (`12_runtime_ownership.md`).
 *
 * API (Alpha 922) — construction plus an immutable read facade; NEVER
 * exposes a persistence port, a raw Authority, a bearer verifier, an
 * encryption handle, or any Host internal (Alpha 922/925). The bearer
 * secret of an initial Capability is returned ONLY on the construction
 * result, exactly once, and never through any read method.
 *
 * `createFedosConversationRuntime()` is a THIN factory mirroring
 * `createFedosBoardRuntime()`'s own style — it constructs the coordinator
 * from the injected already-durable ports/authorities and returns one
 * runtime. No singleton, no Host lifecycle ownership, no automatic
 * network/timer.
 *
 * Secure Runtime Alpha 949 ("Encryption Runtime Wiring") — Phase C of the
 * Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc. Adds `encryptMessage()`/`decryptMessage()`, delegating
 * to a newly-owned `FedosConversationEncryptionCoordinator`/
 * `FedosConversationDecryptionCoordinator` (Alpha 943/946) — the SAME
 * "runtime owns exactly one coordinator, methods delegate to it"
 * pattern `createPrivateGroupDraft()`/`createDirectDraft()` already use
 * for `FedosPrivateConversationConstructionCoordinator`, applied a
 * second time rather than invented fresh. Every new dependency this
 * needs is OPTIONAL with a safe, fail-closed default (an
 * `UnavailableFedosConversationEncryptionAuthority`/
 * `UnavailableFedosConversationDecryptionAuthority` pair, Alpha 942,
 * mirroring `UnavailableFedosConversationEncryptionReadinessAuthority`'s
 * own already-adopted default shape exactly) — so
 * `fedos_desktop_runtime.ts`'s EXISTING, unmodified call to
 * `assembleFedosConversationRuntimeDependencies()` continues to work
 * byte-for-byte unchanged and automatically gains
 * `conversationRuntime().encryptMessage()`/`decryptMessage()`, both
 * fail-closed by default. No existing public method's signature changes.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import {
  FedosConversationEncryptionCoordinator,
  FedosSecureRandomEncryptionIdempotencyKeyGenerator,
  type FedosConversationEncryptMessageCommand,
  type FedosConversationEncryptionCoordinatorResult,
  type FedosConversationEncryptionIdempotencyKeyGenerator,
} from "../encryption/fedos_conversation_encryption_coordinator.js";
import {
  FedosConversationDecryptionCoordinator,
  type FedosConversationDecryptMessageCommand,
  type FedosConversationDecryptionCoordinatorResult,
} from "../encryption/fedos_conversation_decryption_coordinator.js";
import type { FedosConversationEncryptionAuthority } from "../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../encryption/fedos_conversation_decryption_authority.js";
import { UnavailableFedosConversationEncryptionAuthority } from "../encryption/fedos_unavailable_conversation_encryption_authority.js";
import { UnavailableFedosConversationDecryptionAuthority } from "../encryption/fedos_unavailable_conversation_decryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import { FedosConversationSearchIndex } from "../search/fedos_conversation_search_index.js";
import { resolveFedosConversationActiveConversation, type FedosConversationActiveLookupResult } from "../activation/fedos_conversation_active_lookup.js";
import { FedosSecureRandomConversationEnvelopeIdGenerator, type FedosConversationEnvelopeIdGenerator } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationPayloadStorage } from "../payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { FedosSecureRandomConversationPayloadIdGenerator, type FedosConversationPayloadIdGenerator } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationEncryptionCoordinationPersistence } from "../encryption/coordination/fedos_conversation_encryption_coordination_persistence.js";
import { InMemoryFedosConversationEncryptionCoordinationPersistence } from "../encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js";
import { DelegatingFedosConversationIdentityResolver, type FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority, type FedosConversationLocalAccountIndexAuthority } from "../encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../encryption/identity/fedos_conversation_key_resolver.js";
import type { FedosNostrAuthorBindingAuthority } from "../../board/runtime/identity/fedos_nostr_author_binding_types.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationCapabilityDescriptor } from "../capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityId } from "../capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../capability/fedos_conversation_capability_redemption_authority.js";
import type { FedosConversationReadiness } from "../readiness/fedos_conversation_readiness.js";
import {
  FedosPrivateConversationConstructionCoordinator,
  type FedosPrivateConversationConstructionCoordinatorDependencies,
} from "../construction/fedos_private_conversation_construction_coordinator.js";
import { deserializeFedosConversationDraftRecord } from "../construction/fedos_conversation_draft_record_codec.js";
import { resolveFedosPrivateConversationPolicy } from "../construction/fedos_private_conversation_policy.js";
import type {
  CreateDirectDraftCommand,
  CreatePrivateGroupDraftCommand,
} from "../construction/fedos_private_conversation_construction_command.js";
import type { FedosPrivateConversationConstructionResult } from "../construction/fedos_private_conversation_construction_result.js";
import type { FedosConversationDraftView } from "../construction/fedos_conversation_draft_view.js";
import {
  fedosConversationConstructionCoordinationId,
  type FedosConversationConstructionCoordinationPhase,
} from "../construction/coordination/fedos_persisted_conversation_construction_coordination_v1.js";
import {
  FedosConversationDraftManager,
  type FedosConversationDraftManagementAuthorizationCheck,
} from "../construction/fedos_conversation_draft_manager.js";
import type { FedosConversationDraftManagementPersistence } from "../construction/fedos_conversation_draft_management_persistence.js";
import type {
  FedosConversationDraftSearchQuery,
  FedosConversationDraftSummary,
} from "../construction/fedos_conversation_managed_draft_state.js";
import type {
  FedosConversationDraftDeleteResult,
  FedosConversationDraftRestoreResult,
} from "../construction/fedos_conversation_draft_management_result.js";
import {
  FedosConversationInvitationTransport,
  type FedosConversationInvitationCreationRequest,
  type FedosConversationInvitationRevocationAuthorizationCheck,
} from "../invitation/fedos_conversation_invitation_transport.js";
import type { FedosConversationInvitationRevocationRegistry } from "../invitation/fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationInvitationToken } from "../invitation/fedos_conversation_invitation_token.js";
import type {
  FedosConversationInvitationCreationResult,
  FedosConversationInvitationRedemptionResult,
  FedosConversationInvitationRevocationResult,
  FedosConversationInvitationSummary,
} from "../invitation/fedos_conversation_invitation_result.js";
import type { FedosConversationActivationPersistence } from "../activation/fedos_conversation_activation_persistence.js";
import { InMemoryFedosConversationActivationPersistence } from "../activation/in_memory_fedos_conversation_activation_persistence.js";
import { FedosConversationDirectActivationCoordinator } from "../activation/fedos_conversation_direct_activation_coordinator.js";
import type { FedosConversationDirectActivationResult } from "../activation/fedos_conversation_direct_activation_result.js";
import { FedosConversationReactivationCoordinator } from "../activation/fedos_conversation_reactivation_coordinator.js";
import type { FedosConversationReactivationResult } from "../activation/fedos_conversation_reactivation_result.js";
import type { FedosPayloadRetentionPersistence } from "../retention/fedos_payload_retention_persistence.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import {
  FedosConversationDirectMessagingCoordinator,
  type FedosConversationDirectMessageSendCommand,
  type FedosConversationDirectMessageReadCommand,
} from "../messaging/fedos_conversation_direct_messaging_coordinator.js";
import type { FedosConversationDirectMessageSendResult } from "../messaging/fedos_conversation_direct_message_send_result.js";
import type { FedosConversationDirectMessageReadResult } from "../messaging/fedos_conversation_direct_message_read_result.js";
import type { FedosConversationDirectMessageSummary } from "../messaging/fedos_conversation_direct_message_summary.js";
import type { FedosGroupGenerationPersistence } from "../group/fedos_group_generation.js";
import { InMemoryFedosGroupGenerationPersistence } from "../group/in_memory_fedos_group_generation_persistence.js";
import type { FedosGroupDirectPathPersistence } from "../group/fedos_group_direct_path.js";
import { InMemoryFedosGroupDirectPathPersistence } from "../group/in_memory_fedos_group_direct_path_persistence.js";
import type { FedosGroupMessagePersistence } from "../group/fedos_group_message.js";
import { InMemoryFedosGroupMessagePersistence } from "../group/in_memory_fedos_group_message_persistence.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../group/fedos_group_fanout_delivery.js";
import { InMemoryFedosGroupFanoutDeliveryPersistence } from "../group/in_memory_fedos_group_fanout_delivery_persistence.js";
import { FixedFedosGroupParticipantLimitPolicy, type FedosGroupParticipantLimitPolicy } from "../group/fedos_group_participant_limit.js";
import { FedosGroupGenerationAuthority } from "../group/fedos_group_generation_authority.js";
import { FedosGroupDirectPathAuthority } from "../group/fedos_group_direct_path_authority.js";
import { FedosGroupAdmission } from "../group/fedos_group_admission.js";
import { FedosGroupSendCoordinator } from "../group/fedos_group_send_coordinator.js";
import { FedosGroupReadFacade } from "../group/fedos_group_read_facade.js";
import { FedosConversationGroupRuntime } from "../group/fedos_conversation_group_runtime.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../../board/observation/in_memory_fedos_delivery_observation_persistence.js";
import type { FedosPrivateNostrDeliveryMode } from "../delivery/nostr/fedos_private_nostr_delivery_mode.js";
import type { FedosPrivateNostrDeliveryRequestPersistence } from "../delivery/nostr/fedos_private_nostr_delivery_request.js";
import { InMemoryFedosPrivateNostrDeliveryRequestPersistence } from "../delivery/nostr/in_memory_fedos_private_nostr_delivery_request_persistence.js";
import type { FedosPrivateNostrImportRecordPersistence } from "../delivery/nostr/fedos_private_nostr_import_record.js";
import { InMemoryFedosPrivateNostrImportRecordPersistence } from "../delivery/nostr/in_memory_fedos_private_nostr_import_record_persistence.js";
import type { FedosPrivateNostrDeliveryPublisher } from "../delivery/nostr/fedos_private_nostr_delivery_publisher.js";
import { FedosConversationPrivateNostrDeliveryRuntime } from "../delivery/nostr/fedos_conversation_private_nostr_delivery_runtime.js";

/**
 * The full injected dependency set — the construction coordinator's own
 * fields, reused verbatim (so reads/writes share one backend set), PLUS
 * the Alpha 931–990 Encryption Runtime Wiring's own additive fields PLUS
 * the Alpha 991–1050 Invitation-transport and Draft-management additive
 * fields — every added field OPTIONAL, with a safe fail-closed default
 * (see this file's own header). No existing field is renamed, removed, or
 * made required.
 */
export type FedosConversationRuntimeDependencies = FedosPrivateConversationConstructionCoordinatorDependencies & {
  /** Optional — default `UnavailableFedosConversationEncryptionAuthority` (Alpha 942): every call fails closed to `"unavailable"`. */
  readonly encryptionAuthority?: FedosConversationEncryptionAuthority;
  /** Optional — default `UnavailableFedosConversationDecryptionAuthority` (Alpha 942): every call fails closed to `"unavailable"`. */
  readonly decryptionAuthority?: FedosConversationDecryptionAuthority;
  /** Optional — default in-memory. */
  readonly envelopePersistence?: FedosConversationMessageEnvelopePersistence;
  /** Optional — default in-memory. */
  readonly payloadStorage?: FedosConversationPayloadStorage;
  /** Optional — default in-memory. */
  readonly encryptionCoordinationPersistence?: FedosConversationEncryptionCoordinationPersistence;
  /** Optional — default delegates to `creatorIdentityAuthority` (already required above), Alpha 931. */
  readonly identityResolver?: FedosConversationIdentityResolver;
  /** Optional — default fixed `0` (Alpha 933, mirroring Alpha 689's own precedent). */
  readonly accountIndexAuthority?: FedosConversationLocalAccountIndexAuthority;
  /** Optional — when omitted, a "nostr"-authority local identity fails closed to `"identity-binding-unavailable"` (Alpha 935's own documented default). */
  readonly nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority;
  /** Optional — default secure-random. */
  readonly envelopeIdGenerator?: FedosConversationEnvelopeIdGenerator;
  /** Optional — default secure-random. */
  readonly payloadIdGenerator?: FedosConversationPayloadIdGenerator;
  /** Optional — default secure-random. */
  readonly encryptionIdempotencyKeyGenerator?: FedosConversationEncryptionIdempotencyKeyGenerator;
  /** Redemption half of the Capability boundary — the same authority instance that also issues. Required for `redeemInvitation()`. */
  readonly capabilityRedemptionAuthority?: FedosConversationCapabilityRedemptionAuthority;
  /** The additive revocation registry (Alpha 996). Required for revocation and for the revocation gate on redemption. */
  readonly invitationRevocationRegistry?: FedosConversationInvitationRevocationRegistry;
  /** Injected revocation authorization (Alpha 1011). */
  readonly invitationRevocationAuthorizationCheck?: FedosConversationInvitationRevocationAuthorizationCheck;
  /** The additive draft-management-state persistence (Alpha 1003). Required for listing/search/delete/restore. */
  readonly draftManagementPersistence?: FedosConversationDraftManagementPersistence;
  /** Injected draft-management authorization (Alpha 1011). */
  readonly draftManagementAuthorizationCheck?: FedosConversationDraftManagementAuthorizationCheck;
  /** Alpha 1121 — optional; default in-memory. The ONE durable source of truth for "is this Conversation active" (Alpha 1116/1160). */
  readonly activationPersistence?: FedosConversationActivationPersistence;
  /** Alpha 1143 — optional; default in-memory. Backs the retention gate `readDirectMessage()` enforces. */
  readonly retentionPersistence?: FedosPayloadRetentionPersistence;
  /**
   * Alpha 1321–1390 — Private Group Pairwise Fanout Foundation Arc.
   * Every field below is OPTIONAL with a safe in-memory default, mirroring
   * `envelopePersistence`/`payloadStorage`'s own discipline exactly. None
   * of this widens the Direct Activation Coordinator's own Private-Group
   * Gate — `groupRuntime()` is a NEW, additive facade composing the SAME
   * frozen Direct pipeline N times, never a change to it.
   */
  readonly groupGenerationPersistence?: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence?: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence?: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence?: FedosGroupFanoutDeliveryPersistence;
  readonly groupParticipantLimitPolicy?: FedosGroupParticipantLimitPolicy;
  /**
   * Alpha 1391–1470 — Nostr Private Direct and Pairwise Fanout Delivery
   * Arc. Every field below is OPTIONAL with a safe in-memory/fail-closed
   * default, mirroring `envelopePersistence`/`groupGenerationPersistence`'s
   * own discipline exactly. `privateNostrSigningAuthority`/
   * `privateNostrDeliveryPublisher` follow `publisher`'s own established
   * "this runtime constructs no Signing Authority/Relay of its own"
   * precedent (Alpha 610) — omitted, `privateNostrDelivery()` is
   * constructed but every one of its methods fails closed to
   * `"unavailable"` (Alpha 1440).
   */
  readonly privateNostrDeliveryRequestPersistence?: FedosPrivateNostrDeliveryRequestPersistence;
  readonly privateNostrImportRecordPersistence?: FedosPrivateNostrImportRecordPersistence;
  readonly privateNostrDeliveryObservationRepository?: FedosDeliveryObservationRepository;
  readonly privateNostrSigningAuthority?: FedosNostrSigningAuthority;
  readonly privateNostrDeliveryPublisher?: FedosPrivateNostrDeliveryPublisher;
  /** Alpha 1434 — optional; omitted, `"mailbox"` (the explicit, documented default). */
  readonly privateNostrDefaultMode?: FedosPrivateNostrDeliveryMode;
  /** Optional; omitted, `[]` (a caller must then supply `relayUrls` per call). */
  readonly privateNostrDefaultRelayUrls?: readonly string[];
};

export class FedosConversationRuntime {
  readonly #deps: FedosConversationRuntimeDependencies;
  readonly #coordinator: FedosPrivateConversationConstructionCoordinator;
  readonly #encryptionCoordinator: FedosConversationEncryptionCoordinator;
  readonly #decryptionCoordinator: FedosConversationDecryptionCoordinator;
  /** `null` when the invitation backends were not injected — every invitation method then fails closed. */
  readonly #invitationTransport: FedosConversationInvitationTransport | null;
  /** `null` when the draft-management backends were not injected — every management method then fails closed. */
  readonly #draftManager: FedosConversationDraftManager | null;
  readonly #activationCoordinator: FedosConversationDirectActivationCoordinator;
  readonly #directMessagingCoordinator: FedosConversationDirectMessagingCoordinator;
  readonly #groupRuntime: FedosConversationGroupRuntime;
  readonly #privateNostrDeliveryRuntime: FedosConversationPrivateNostrDeliveryRuntime;
  /** Alpha 2041–2120 — see `../activation/fedos_conversation_reactivation_coordinator.ts`'s own header. */
  readonly #reactivationCoordinator: FedosConversationReactivationCoordinator;
  /**
   * Secure Runtime Alpha 3081-3160 — the SAME already-resolved
   * `identityResolver`/`retentionAuthority`/`envelopePersistence`
   * instances every Coordinator above already shares, retained here ONLY
   * so this Arc's own new narrow accessors below
   * (`resolveLocalParticipant()`/`createSearchIndex()`/
   * `getConversationMessageEnvelope()`) can reuse them — never a second,
   * divergent instance (Alpha 1114's own "one coherent graph" rule,
   * unchanged). None of the three was reachable from outside this class
   * before this Arc.
   */
  readonly #identityResolver: FedosConversationIdentityResolver;
  readonly #retentionAuthority: FedosPayloadRetentionAuthority;
  readonly #envelopePersistence: FedosConversationMessageEnvelopePersistence;
  /**
   * Secure Runtime Alpha 3081-3160 — the SAME `activationPersistence`
   * instance every Coordinator above already shares (Alpha 1121's own "ONE
   * durable source of truth"), retained here ONLY so `resolveActiveConversation()`
   * below can answer "is this Conversation active" the SAME way
   * `resolveFedosConversationActiveConversation()` already answers it inside
   * `FedosConversationDirectMessagingCoordinator`/`FedosGroupSendCoordinator` —
   * never a second, divergent instance. Not reachable from outside this class
   * before this Arc.
   */
  readonly #activationPersistence: FedosConversationActivationPersistence;

  constructor(deps: FedosConversationRuntimeDependencies) {
    this.#deps = deps;
    this.#coordinator = new FedosPrivateConversationConstructionCoordinator(deps);

    // Alpha 949 — every field below is either already REQUIRED above (and
    // reused, never duplicated) or has a safe, fail-closed default; see
    // this file's own header.
    const identityResolver = deps.identityResolver ?? new DelegatingFedosConversationIdentityResolver(deps.creatorIdentityAuthority);
    const accountIndexAuthority = deps.accountIndexAuthority ?? new FixedFedosConversationLocalAccountIndexAuthority();
    const participantResolver = new MembershipFedosConversationParticipantResolver(deps.membershipAuthority);
    const keyResolver = new FedosConversationKeyResolver({
      identityResolver,
      participantResolver,
      accountIndexAuthority,
      nostrAuthorBindingAuthority: deps.nostrAuthorBindingAuthority,
    });
    const envelopePersistence = deps.envelopePersistence ?? new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = deps.payloadStorage ?? new InMemoryFedosConversationPayloadStorage();
    const encryptionAuthority = deps.encryptionAuthority ?? new UnavailableFedosConversationEncryptionAuthority();
    const decryptionAuthority = deps.decryptionAuthority ?? new UnavailableFedosConversationDecryptionAuthority();
    // Alpha 1121 — the ONE durable source of truth for "is this Conversation
    // active" (Alpha 1116/1160), shared by BOTH Coordinators below AND the
    // new Direct Activation Coordinator (Alpha 1122) — never a second,
    // disagreeing instance.
    const activationPersistence = deps.activationPersistence ?? new InMemoryFedosConversationActivationPersistence();
    // Alpha 1143 — always constructed (mirrors envelopePersistence/
    // payloadStorage's own "safe in-memory default" discipline); an empty
    // retention log means every payload reads "active" by default, so this
    // never denies a read that Alpha 796's own established behavior would
    // not already deny.
    const retentionPersistence = deps.retentionPersistence ?? new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: deps.clock });

    this.#encryptionCoordinator = new FedosConversationEncryptionCoordinator({
      draftPersistence: deps.draftPersistence,
      activationPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      keyResolver,
      encryptionAuthority,
      envelopePersistence,
      payloadStorage,
      coordinationPersistence: deps.encryptionCoordinationPersistence ?? new InMemoryFedosConversationEncryptionCoordinationPersistence(),
      envelopeIdGenerator: deps.envelopeIdGenerator ?? new FedosSecureRandomConversationEnvelopeIdGenerator(),
      payloadIdGenerator: deps.payloadIdGenerator ?? new FedosSecureRandomConversationPayloadIdGenerator(),
      idempotencyKeyGenerator: deps.encryptionIdempotencyKeyGenerator ?? new FedosSecureRandomEncryptionIdempotencyKeyGenerator(),
      clock: deps.clock,
    });
    this.#decryptionCoordinator = new FedosConversationDecryptionCoordinator({
      draftPersistence: deps.draftPersistence,
      activationPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      keyResolver,
      decryptionAuthority,
      envelopePersistence,
      payloadStorage,
    });

    // Alpha 1122 — the Direct Activation Coordinator reuses every one of
    // the SAME instances above (identity/participant/key resolvers,
    // encryption/decryption Authorities, storage) — never a second,
    // divergent graph (Alpha 1114's own "one coherent graph" rule).
    this.#activationCoordinator = new FedosConversationDirectActivationCoordinator({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      activationPersistence,
      identityResolver,
      participantResolver,
      keyResolver,
      encryptionAuthority,
      decryptionAuthority,
      envelopePersistence,
      payloadStorage,
      retentionAuthority,
      clock: deps.clock,
    });

    // Alpha 1126 — the direct-messaging facade delegates every crypto/
    // Envelope/Payload decision to the SAME two Coordinators above; it
    // owns only input validation, authorization, and the retention gate
    // (Alpha 1136/1138/1143).
    this.#directMessagingCoordinator = new FedosConversationDirectMessagingCoordinator({
      draftPersistence: deps.draftPersistence,
      activationPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      envelopePersistence,
      retentionAuthority,
      encryptionCoordinator: this.#encryptionCoordinator,
      decryptionCoordinator: this.#decryptionCoordinator,
    });

    // Secure Runtime Alpha 3081-3160 — retain the SAME instances just used
    // to build the coordinators above; see this class's own field-level
    // doc comment. No new construction, no divergent instance.
    this.#identityResolver = identityResolver;
    this.#retentionAuthority = retentionAuthority;
    this.#envelopePersistence = envelopePersistence;
    this.#activationPersistence = activationPersistence;

    // Alpha 1321–1390 — the Group Runtime facade. Always constructible
    // (safe in-memory defaults for every new persistence backend, mirroring
    // envelopePersistence/payloadStorage above); reuses the SAME
    // identityResolver/coordinator instances already built above, never a
    // second, divergent graph. `admission` is `null` only when the
    // Capability issuer/redemption backends were not injected — matching
    // `#invitationTransport`'s own "null when not assembled" precedent.
    const groupGenerationPersistence = deps.groupGenerationPersistence ?? new InMemoryFedosGroupGenerationPersistence();
    const groupDirectPathPersistence = deps.groupDirectPathPersistence ?? new InMemoryFedosGroupDirectPathPersistence();
    const groupMessagePersistence = deps.groupMessagePersistence ?? new InMemoryFedosGroupMessagePersistence();
    const groupFanoutDeliveryPersistence = deps.groupFanoutDeliveryPersistence ?? new InMemoryFedosGroupFanoutDeliveryPersistence();
    const groupParticipantLimitPolicy = deps.groupParticipantLimitPolicy ?? new FixedFedosGroupParticipantLimitPolicy();
    const groupGenerationAuthority = new FedosGroupGenerationAuthority({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      generationPersistence: groupGenerationPersistence,
      pathPersistence: groupDirectPathPersistence,
      participantLimitPolicy: groupParticipantLimitPolicy,
      identityResolver,
    });
    const groupDirectPathAuthority = new FedosGroupDirectPathAuthority({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      pathPersistence: groupDirectPathPersistence,
      constructionCoordinator: this.#coordinator,
      redemptionAuthority: deps.capabilityRedemptionAuthority,
      activationCoordinator: this.#activationCoordinator,
    });
    const groupSendCoordinator = new FedosGroupSendCoordinator({
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      generationPersistence: groupGenerationPersistence,
      pathPersistence: groupDirectPathPersistence,
      pathAuthority: groupDirectPathAuthority,
      messagePersistence: groupMessagePersistence,
      deliveryPersistence: groupFanoutDeliveryPersistence,
      directMessagingCoordinator: this.#directMessagingCoordinator,
      idempotencyKeyGenerator: deps.encryptionIdempotencyKeyGenerator ?? new FedosSecureRandomEncryptionIdempotencyKeyGenerator(),
      clock: deps.clock,
    });
    const groupReadFacade = new FedosGroupReadFacade({
      generationPersistence: groupGenerationPersistence,
      messagePersistence: groupMessagePersistence,
      deliveryPersistence: groupFanoutDeliveryPersistence,
    });
    const groupAdmission =
      deps.capabilityIssuerAuthority !== undefined && deps.capabilityRedemptionAuthority !== undefined
        ? new FedosGroupAdmission({
            membershipAuthority: deps.membershipAuthority,
            capabilityIssuerAuthority: deps.capabilityIssuerAuthority,
            redemptionAuthority: deps.capabilityRedemptionAuthority,
          })
        : null;
    this.#groupRuntime = new FedosConversationGroupRuntime({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      generationAuthority: groupGenerationAuthority,
      admission: groupAdmission,
      sendCoordinator: groupSendCoordinator,
      readFacade: groupReadFacade,
      // Secure Runtime Alpha 3081-3160 — the SAME instances just used to build
      // groupSendCoordinator/groupReadFacade above (never a second, divergent
      // set), so `resolveLocalGroupMessagePlaintext()` can compose the local
      // participant's own fanned-out delivery -> Direct path -> Direct read,
      // exactly mirroring how `groupSendCoordinator` itself already reaches
      // `directMessagingCoordinator` for the fan-out send.
      directPathPersistence: groupDirectPathPersistence,
      deliveryPersistence: groupFanoutDeliveryPersistence,
      messagePersistence: groupMessagePersistence,
      directMessagingCoordinator: this.#directMessagingCoordinator,
      usabilityDeps: {
        draftPersistence: deps.draftPersistence,
        membershipAuthority: deps.membershipAuthority,
        generationPersistence: groupGenerationPersistence,
        pathPersistence: groupDirectPathPersistence,
      },
      clock: deps.clock,
    });

    // Alpha 2041–2120 — reuses every EXISTING instance already constructed
    // above (draftPersistence, membershipAuthority, identityResolver, the
    // SAME #activationCoordinator, groupGenerationPersistence,
    // groupDirectPathPersistence) rather than a second, divergent graph —
    // see `../activation/fedos_conversation_reactivation_coordinator.ts`'s
    // own header for the full rationale.
    this.#reactivationCoordinator = new FedosConversationReactivationCoordinator({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      groupGenerationPersistence,
      groupDirectPathPersistence,
      activationCoordinator: this.#activationCoordinator,
    });

    // Alpha 1391–1470 — the additive Private Nostr Delivery facade. Reuses
    // every EXISTING instance already constructed above (envelopePersistence,
    // payloadStorage, membershipAuthority, identityResolver,
    // decryptionAuthority, activationPersistence, the Group persistence
    // instances) rather than constructing a second, divergent graph — the
    // SAME "one coherent graph" discipline this file's own header already
    // applies everywhere else. Always constructible; every method fails
    // closed to `"unavailable"` when `privateNostrSigningAuthority`/
    // `privateNostrDeliveryPublisher` were not injected (Alpha 1440).
    this.#privateNostrDeliveryRuntime = new FedosConversationPrivateNostrDeliveryRuntime({
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      accountIndexAuthority,
      envelopePersistence,
      payloadStorage,
      decryptionAuthority,
      draftPersistence: deps.draftPersistence,
      activationPersistence,
      envelopeIdGenerator: deps.envelopeIdGenerator ?? new FedosSecureRandomConversationEnvelopeIdGenerator(),
      payloadIdGenerator: deps.payloadIdGenerator ?? new FedosSecureRandomConversationPayloadIdGenerator(),
      groupMessagePersistence,
      groupFanoutDeliveryPersistence,
      groupDirectPathPersistence,
      deliveryRequestPersistence: deps.privateNostrDeliveryRequestPersistence ?? new InMemoryFedosPrivateNostrDeliveryRequestPersistence(),
      importRecordPersistence: deps.privateNostrImportRecordPersistence ?? new InMemoryFedosPrivateNostrImportRecordPersistence(),
      observationRepository:
        deps.privateNostrDeliveryObservationRepository ??
        new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
      signingAuthority: deps.privateNostrSigningAuthority,
      publisher: deps.privateNostrDeliveryPublisher,
      defaultMode: deps.privateNostrDefaultMode ?? "mailbox",
      defaultRelayUrls: deps.privateNostrDefaultRelayUrls ?? [],
      clock: deps.clock,
    });

    // Alpha 1011 — assemble the invitation transport ONLY when every frozen +
    // additive backend it composes is present; otherwise it stays null and the
    // invitation methods fail closed. The transport re-implements nothing — it
    // delegates to the same issuer/redemption authorities the coordinator uses.
    if (
      deps.capabilityIssuerAuthority !== undefined &&
      deps.capabilityRedemptionAuthority !== undefined &&
      deps.invitationRevocationRegistry !== undefined &&
      deps.invitationRevocationAuthorizationCheck !== undefined
    ) {
      this.#invitationTransport = new FedosConversationInvitationTransport({
        issuerAuthority: deps.capabilityIssuerAuthority,
        redemptionAuthority: deps.capabilityRedemptionAuthority,
        revocationRegistry: deps.invitationRevocationRegistry,
        revocationAuthorizationCheck: deps.invitationRevocationAuthorizationCheck,
        clock: deps.clock,
      });
    } else {
      this.#invitationTransport = null;
    }

    if (deps.draftManagementPersistence !== undefined && deps.draftManagementAuthorizationCheck !== undefined) {
      this.#draftManager = new FedosConversationDraftManager({
        draftPersistence: deps.draftPersistence,
        managementPersistence: deps.draftManagementPersistence,
        authorizationCheck: deps.draftManagementAuthorizationCheck,
        clock: deps.clock,
      });
    } else {
      this.#draftManager = null;
    }
  }

  /**
   * Alpha 943/949 — encrypt and durably persist one Envelope+Payload for
   * an ACTIVE Conversation. Fails closed to `"conversation-not-active"`
   * for every draft this repository can currently construct (nothing
   * constructs `"active"` yet — see this Arc's own completion
   * declaration). Never throws.
   */
  async encryptMessage(command: FedosConversationEncryptMessageCommand): Promise<FedosConversationEncryptionCoordinatorResult> {
    return this.#encryptionCoordinator.encrypt(command);
  }

  /** Alpha 946/949 — decrypt an already-persisted Envelope. Same fail-closed gates as `encryptMessage()`. Never throws. */
  async decryptMessage(command: FedosConversationDecryptMessageCommand): Promise<FedosConversationDecryptionCoordinatorResult> {
    return this.#decryptionCoordinator.decrypt(command);
  }

  /**
   * Alpha 1122 — activate a real, durable `direct` draft. Every required
   * fact (Alpha 1117) is proven fresh on every call; never activates a
   * `private-group` draft (Alpha 1123's own gate — always
   * `"unsupported-mode"`). No message is ever sent by this call. Never
   * throws.
   */
  async activateDirectConversation(conversationId: string): Promise<FedosConversationDirectActivationResult> {
    return this.#activationCoordinator.activateDirectConversation(conversationId);
  }

  /**
   * Alpha 2041–2120 — reactivate a conversation whose identity/data an
   * Archive `restoreConversationArchive()` already recovered, but whose
   * Draft(+Activation, for `direct`) facts that restore deliberately never
   * replays (Archive's own frozen exclusion, unchanged by this Arc — see
   * `docs/secure_runtime_alpha_2041_2120_reconciliation_report.md`).
   * Deterministically re-derives the missing Draft(s) from already-restored
   * Membership `"owner"` facts (never invented), then activates every
   * `direct` id through the SAME, unmodified `activateDirectConversation()`
   * — for a `private-group` id, its OWN Draft is restored (so
   * `createNextGeneration()`/`readinessForPrivateGroup()` keep working) and
   * every distinct pairwise child Direct Conversation its restored Paths
   * reference is reactivated independently. Requires the local identity to
   * already hold an ACTIVE Membership on whatever id is being reactivated
   * (the SAME authorization this codebase's own activation/send paths
   * already apply) — never reactivates a conversation the caller has no
   * legitimate claim to. Idempotent: calling it once, twice, or on an
   * already-active conversation never duplicates or corrupts anything.
   * Never throws.
   */
  async reactivateRestoredConversation(conversationId: string): Promise<FedosConversationReactivationResult> {
    return this.#reactivationCoordinator.reactivateRestoredConversation(conversationId);
  }

  /**
   * Alpha 1126/1127 — send one encrypted direct message. The caller
   * supplies ONLY `conversationId`/`body`/`replyToEnvelopeId` — sender
   * identity, Envelope/payload id, nonce, key material, and encryption
   * suite are all resolved internally. Never throws.
   */
  async sendDirectMessage(command: FedosConversationDirectMessageSendCommand): Promise<FedosConversationDirectMessageSendResult> {
    return this.#directMessagingCoordinator.sendDirectMessage(command);
  }

  /**
   * Alpha 1126/1136 — authorize, enforce retention, and decrypt one
   * already-persisted Envelope. Never throws.
   */
  async readDirectMessage(command: FedosConversationDirectMessageReadCommand): Promise<FedosConversationDirectMessageReadResult> {
    return this.#directMessagingCoordinator.readDirectMessage(command);
  }

  /** Alpha 1126/1139 — safe Envelope metadata only, deterministically ordered; never decrypts. `[]` for an unknown or non-active Conversation. */
  listDirectMessages(id: string): readonly FedosConversationDirectMessageSummary[] {
    return this.#directMessagingCoordinator.listDirectMessages(id);
  }

  /**
   * Secure Runtime Alpha 3081-3160 — the local participant this running
   * Runtime resolves for EVERY identity-gated operation above
   * (`sendDirectMessage`/`readDirectMessage`/`activateDirectConversation`/
   * `reactivateRestoredConversation`/the Group Runtime's own
   * `readinessForPrivateGroup`) — never a caller-supplied identity, exactly
   * mirroring every one of those methods' own "the caller never asserts who
   * they are" discipline. A narrow, PUBLIC, read-only passthrough to the
   * SAME `FedosConversationIdentityResolver` those methods already use
   * internally — never exposed before this Arc. `null` when identity
   * resolution is currently unavailable (matches every other
   * `identity-unavailable`-shaped outcome in this file). The returned
   * `FedosConversationParticipantReference` carries no secret of any kind
   * (its own type's established guarantee, unchanged).
   */
  resolveLocalParticipant(): FedosConversationParticipantReference | null {
    const identity = this.#identityResolver.resolveLocalParticipant();
    return identity.outcome === "unavailable" ? null : identity.creator;
  }

  /**
   * Secure Runtime Alpha 3081-3160 — ONE already-persisted Envelope's
   * metadata (id/conversationId/senderMembershipId/payloadId/
   * encryptionSuite/keyEpoch/createdAt/replyToEnvelopeId) — NEVER
   * ciphertext, NEVER plaintext, NEVER the Envelope persistence PORT
   * itself (mirrors `listMemberships()`'s own "real domain objects, never
   * the port" shape, Alpha 922). `null` for an unknown envelope id or one
   * belonging to a DIFFERENT conversation than `conversationId` (the same
   * "wrong-conversation lookup denied identically to missing" rule
   * `readDirectMessage()` itself already applies, Alpha 1136/1141). Exists
   * SOLELY so an application-layer caller (the Conversation Content
   * Accessor, Alpha 3081-3160) can feed `FedosConversationSearchIndex.indexEnvelope()`
   * its required `envelope` field without this class exposing
   * `envelopePersistence` itself.
   */
  getConversationMessageEnvelope(conversationId: string, envelopeId: string): FedosConversationMessageEnvelope | null {
    const persisted = this.#envelopePersistence.getEnvelope(envelopeId);
    if (persisted === null) return null;
    const envelope = deserializeFedosConversationMessageEnvelope(persisted);
    if (envelope === null) return null;
    if (envelope.conversationId !== conversationId) return null;
    return envelope;
  }

  /**
   * Secure Runtime Alpha 3081-3160 — a freshly-constructed
   * `FedosConversationSearchIndex` (Alpha 2501-2620, UNCHANGED) wired over
   * the SAME `draftPersistence`/`membershipAuthority` ports this Runtime
   * already holds plus the SAME `FedosPayloadRetentionAuthority` instance
   * every message-read path already enforces retention through — never a
   * second, divergent Retention Authority. Returns the INDEX object itself
   * (an application-level facade this Runtime's own caller is expected to
   * retain and incrementally feed via `indexEnvelope()`), never a raw
   * persistence port. Callers MUST retain and reuse ONE instance per
   * running Runtime (mirrors `groupRuntime()`'s own "always available,
   * caller keeps the reference" shape) — calling this twice builds two
   * independent, empty indexes, never a shared one.
   */
  createSearchIndex(): FedosConversationSearchIndex {
    return new FedosConversationSearchIndex({
      draftPersistence: this.#deps.draftPersistence,
      membershipAuthority: this.#deps.membershipAuthority,
      retentionAuthority: this.#retentionAuthority,
    });
  }

  /**
   * Secure Runtime Alpha 3081-3160 — the SAME "is this Conversation active"
   * answer `FedosConversationDirectMessagingCoordinator`/`FedosGroupSendCoordinator`
   * already consult internally (`../activation/fedos_conversation_active_lookup.ts`,
   * Alpha 1116/1160, UNCHANGED) — never the draft record's own `lifecycleState`
   * field, which is permanently `"draft"` by construction and carries no
   * activation information of its own (see that file's own header). Exists so
   * an application-layer caller (the Conversation Content Accessor, Alpha
   * 3081-3160) can gate a send/read attempt on the REAL activation fact
   * instead of re-deriving (or, worse, misreading) it from `findConversation()`.
   */
  resolveActiveConversation(conversationId: string): FedosConversationActiveLookupResult {
    return resolveFedosConversationActiveConversation(this.#deps.draftPersistence, this.#activationPersistence, conversationId as FedosConversationId);
  }

  /** Alpha 901/915 — construct a private-group draft. Never activates, never sends a message. */
  createPrivateGroupDraft(command: CreatePrivateGroupDraftCommand): FedosPrivateConversationConstructionResult {
    return this.#coordinator.createPrivateGroupDraft(command);
  }

  /** Alpha 902/915 — construct a direct draft (creator + recipient-bound Capability). Never activates, never sends a message. */
  createDirectDraft(command: CreateDirectDraftCommand): FedosPrivateConversationConstructionResult {
    return this.#coordinator.createDirectDraft(command);
  }

  /** Alpha 922/925 — immutable read view of a draft, or `null`. Never returns a persistence port. */
  findConversation(id: string): FedosConversationDraftView | null {
    const persisted = this.#deps.draftPersistence.getDraft(id as FedosConversationId);
    if (persisted === null) return null;
    const record = deserializeFedosConversationDraftRecord(persisted);
    if (record === null) return null;
    return Object.freeze({
      id: record.id,
      mode: record.mode,
      lifecycleState: record.lifecycleState,
      policyReference: record.policyReference,
      policy: resolveFedosPrivateConversationPolicy(record.policyReference),
      creator: record.creator,
      createdAt: record.createdAt,
    });
  }

  /** Alpha 922/13 — LIVE readiness re-evaluation (never a construction-time snapshot). `null` for an unknown draft. */
  readinessForConversation(id: string): FedosConversationReadiness | null {
    const persisted = this.#deps.draftPersistence.getDraft(id as FedosConversationId);
    if (persisted === null) return null;
    const record = deserializeFedosConversationDraftRecord(persisted);
    if (record === null) return null;
    return this.#coordinator.readinessForDraft(record);
  }

  /** Alpha 922 — participant Membership summaries via a read facade. Already deep-frozen; no persistence port exposed. */
  listMemberships(id: string): readonly FedosConversationMembership[] {
    return this.#deps.membershipAuthority.listMemberships(id as FedosConversationId);
  }

  /**
   * Alpha 922 — the PUBLIC descriptors of Capabilities issued for this
   * draft that the calling `issuer` itself issued. Descriptors ONLY —
   * never a bearer secret (Alpha 907/925). Scoped by issuer, matching
   * `13_read_api.md`. Composed over the coordination log's recorded
   * `issuedCapabilityId` (the one initial Capability this Arc issues) plus
   * `inspectDescriptor()`.
   */
  issuedCapabilityDescriptors(
    id: string,
    issuer: FedosConversationParticipantReference,
  ): readonly FedosConversationCapabilityDescriptor[] {
    if (this.#deps.capabilityIssuerAuthority === undefined) return [];
    const coordination = this.#deps.coordinationPersistence.getCoordination(
      fedosConversationConstructionCoordinationId(id),
    );
    const issuedId = coordination?.issuedCapabilityId ?? null;
    if (issuedId === null) return [];
    const descriptor = this.#deps.capabilityIssuerAuthority.inspectDescriptor(issuedId as FedosConversationCapabilityId);
    if (descriptor === null) return [];
    if (descriptor.issuer.authority !== issuer.authority || descriptor.issuer.publicIdentifier !== issuer.publicIdentifier) {
      return [];
    }
    return [descriptor];
  }

  /** Alpha 925 — the coarse construction status (coordination phase), or `null` for an unknown draft. */
  constructionStatus(id: string): FedosConversationConstructionCoordinationPhase | null {
    const coordination = this.#deps.coordinationPersistence.getCoordination(
      fedosConversationConstructionCoordinationId(id),
    );
    return coordination?.phase ?? null;
  }

  // --- Alpha 991–1050: Invitation transport (a facade over the Capability boundary) ---

  /** Alpha 991 — create an invitation (= issue a join Capability). Fails closed `"unavailable"` when the invitation backends were not assembled. */
  createInvitation(request: FedosConversationInvitationCreationRequest): FedosConversationInvitationCreationResult {
    if (this.#invitationTransport === null) return { outcome: "unavailable" };
    return this.#invitationTransport.createInvitation(request);
  }

  /** Alpha 993/994 — validate + redeem an invitation. The revocation gate is consulted first. Fails closed `"unavailable"` when not assembled. */
  redeemInvitation(
    token: FedosConversationInvitationToken,
    redeemer: FedosConversationParticipantReference,
  ): FedosConversationInvitationRedemptionResult {
    if (this.#invitationTransport === null) return { outcome: "unavailable" };
    return this.#invitationTransport.redeemInvitation(token, redeemer);
  }

  /** Alpha 995 — revoke an invitation (terminal, one-way). Fails closed `"unavailable"` when not assembled. */
  revokeInvitation(
    capabilityId: FedosConversationCapabilityId,
    revoker: FedosConversationParticipantReference,
  ): FedosConversationInvitationRevocationResult {
    if (this.#invitationTransport === null) return { outcome: "unavailable" };
    return this.#invitationTransport.revokeInvitation(capabilityId, revoker);
  }

  /** Alpha 1011 — non-secret read of one invitation (descriptor + revoked flag), or `null`. Never returns a bearer secret. */
  inspectInvitation(capabilityId: FedosConversationCapabilityId): FedosConversationInvitationSummary | null {
    if (this.#invitationTransport === null) return null;
    return this.#invitationTransport.inspectInvitation(capabilityId);
  }

  /** Alpha 1011 — every invitation issued for a conversation, as non-secret summaries. `[]` when not assembled or unsupported. */
  listConversationInvitations(id: string): readonly FedosConversationInvitationSummary[] {
    if (this.#invitationTransport === null) return [];
    return this.#invitationTransport.listConversationInvitations(id as FedosConversationId);
  }

  // --- Alpha 991–1050: Draft management (listing / search / delete / restore) ---

  /** Alpha 1006 — every draft as an immutable summary (base metadata + current managed state). `[]` when not assembled. */
  listDrafts(): readonly FedosConversationDraftSummary[] {
    if (this.#draftManager === null) return [];
    return this.#draftManager.listDrafts();
  }

  /** Alpha 1006 — drafts matching a closed set of optional filters. `[]` when not assembled. */
  searchDrafts(query: FedosConversationDraftSearchQuery): readonly FedosConversationDraftSummary[] {
    if (this.#draftManager === null) return [];
    return this.#draftManager.searchDrafts(query);
  }

  /** Alpha 1006 — soft-delete (tombstone) a draft. Fails closed `"unavailable"` when not assembled. */
  deleteDraft(id: string, actor: FedosConversationParticipantReference): FedosConversationDraftDeleteResult {
    if (this.#draftManager === null) return { outcome: "unavailable" };
    return this.#draftManager.deleteDraft(id, actor);
  }

  /** Alpha 1006 — restore a tombstoned draft back to `"draft"`. Fails closed `"unavailable"` when not assembled. */
  restoreDraft(id: string, actor: FedosConversationParticipantReference): FedosConversationDraftRestoreResult {
    if (this.#draftManager === null) return { outcome: "unavailable" };
    return this.#draftManager.restoreDraft(id, actor);
  }

  /**
   * Alpha 1321–1390 — the additive Private Group Pairwise Fanout facade.
   * ALWAYS available (every backend it needs has a safe default); never
   * activates a `private-group` draft itself and never widens the Direct
   * Activation Coordinator's own Private-Group Gate — it composes the
   * SAME frozen Direct pipeline once per active OTHER group member.
   */
  groupRuntime(): FedosConversationGroupRuntime {
    return this.#groupRuntime;
  }

  /**
   * Alpha 1391–1470 — the additive Private Nostr Delivery facade. ALWAYS
   * available as an object (every backend it needs has a safe default);
   * its own methods fail closed to `"unavailable"` when no Signing
   * Authority/Publisher were injected (Alpha 1440).
   */
  privateNostrDelivery(): FedosConversationPrivateNostrDeliveryRuntime {
    return this.#privateNostrDeliveryRuntime;
  }
}

/** Thin factory — mirrors `createFedosBoardRuntime()`'s own style. Constructs no port/authority itself; only assembles the runtime over injected ones. */
export function createFedosConversationRuntime(deps: FedosConversationRuntimeDependencies): FedosConversationRuntime {
  return new FedosConversationRuntime(deps);
}
