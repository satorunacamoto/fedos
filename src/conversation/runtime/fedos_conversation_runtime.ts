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

/** The full injected dependency set — the coordinator's own, reused verbatim so reads and writes share one backend set. */
export type FedosConversationRuntimeDependencies = FedosPrivateConversationConstructionCoordinatorDependencies;

export class FedosConversationRuntime {
  readonly #deps: FedosConversationRuntimeDependencies;
  readonly #coordinator: FedosPrivateConversationConstructionCoordinator;

  constructor(deps: FedosConversationRuntimeDependencies) {
    this.#deps = deps;
    this.#coordinator = new FedosPrivateConversationConstructionCoordinator(deps);
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
}

/** Thin factory — mirrors `createFedosBoardRuntime()`'s own style. Constructs no port/authority itself; only assembles the runtime over injected ones. */
export function createFedosConversationRuntime(deps: FedosConversationRuntimeDependencies): FedosConversationRuntime {
  return new FedosConversationRuntime(deps);
}
