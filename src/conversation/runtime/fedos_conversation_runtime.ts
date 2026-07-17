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

  constructor(deps: FedosConversationRuntimeDependencies) {
    this.#deps = deps;
    this.#coordinator = new FedosPrivateConversationConstructionCoordinator(deps);

    // Alpha 949 — every field below is either already REQUIRED above (and
    // reused, never duplicated) or has a safe, fail-closed default; see
    // this file's own header.
    const identityResolver = deps.identityResolver ?? new DelegatingFedosConversationIdentityResolver(deps.creatorIdentityAuthority);
    const accountIndexAuthority = deps.accountIndexAuthority ?? new FixedFedosConversationLocalAccountIndexAuthority();
    const keyResolver = new FedosConversationKeyResolver({
      identityResolver,
      participantResolver: new MembershipFedosConversationParticipantResolver(deps.membershipAuthority),
      accountIndexAuthority,
      nostrAuthorBindingAuthority: deps.nostrAuthorBindingAuthority,
    });
    const envelopePersistence = deps.envelopePersistence ?? new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = deps.payloadStorage ?? new InMemoryFedosConversationPayloadStorage();

    this.#encryptionCoordinator = new FedosConversationEncryptionCoordinator({
      draftPersistence: deps.draftPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      keyResolver,
      encryptionAuthority: deps.encryptionAuthority ?? new UnavailableFedosConversationEncryptionAuthority(),
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
      membershipAuthority: deps.membershipAuthority,
      identityResolver,
      keyResolver,
      decryptionAuthority: deps.decryptionAuthority ?? new UnavailableFedosConversationDecryptionAuthority(),
      envelopePersistence,
      payloadStorage,
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
}

/** Thin factory — mirrors `createFedosBoardRuntime()`'s own style. Constructs no port/authority itself; only assembles the runtime over injected ones. */
export function createFedosConversationRuntime(deps: FedosConversationRuntimeDependencies): FedosConversationRuntime {
  return new FedosConversationRuntime(deps);
}
