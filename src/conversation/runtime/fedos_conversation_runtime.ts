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
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
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
 * The full injected dependency set — the coordinator's own (reused verbatim so
 * reads and writes share one backend set), extended ADDITIVELY (Alpha 1011)
 * with the optional Invitation-transport and Draft-management backends this Arc
 * introduces. Every added field is OPTIONAL: when a field is absent, the
 * corresponding operation fails closed (`"unavailable"` / `[]` / `null`),
 * never throws — mirroring the coordinator's own optional
 * `capabilityIssuerAuthority` discipline. The assembly (Alpha 1011) always
 * supplies them (in-memory by default), so a fully-assembled runtime always has
 * the full surface.
 */
export type FedosConversationRuntimeDependencies = FedosPrivateConversationConstructionCoordinatorDependencies & {
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
  /** `null` when the invitation backends were not injected — every invitation method then fails closed. */
  readonly #invitationTransport: FedosConversationInvitationTransport | null;
  /** `null` when the draft-management backends were not injected — every management method then fails closed. */
  readonly #draftManager: FedosConversationDraftManager | null;

  constructor(deps: FedosConversationRuntimeDependencies) {
    this.#deps = deps;
    this.#coordinator = new FedosPrivateConversationConstructionCoordinator(deps);

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
