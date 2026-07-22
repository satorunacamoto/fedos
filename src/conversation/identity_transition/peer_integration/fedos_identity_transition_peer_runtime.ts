/**
 * Secure Runtime Alpha 5961–6040 — Phase N: the safe, standalone Peer
 * Runtime facade. Mirrors
 * `../../ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.ts`'s
 * own composition style exactly: one dependency bundle, internally
 * composes the Outbound/Inbound coordinators, exposes only a narrow,
 * named set of operations. A sibling Runtime, never merged into the
 * peer-capability Runtime or the Identity Transition Foundation's own
 * `FedosIdentityTransitionFacade`.
 *
 * Does NOT expose: private keys, raw transition secret data, root/chain
 * keys, arbitrary profile mutation, direct Device Registry mutation, or a
 * generic trust override.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosDirectRatchetOutboundIntegration } from "../../ratchet/fedos_direct_ratchet_outbound_integration.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../../ratchet/fedos_direct_ratchet_session_record.js";
import {
  FedosIdentityTransitionOutboundNotificationCoordinator,
  type FedosIdentityTransitionNotifyParams,
  type FedosIdentityTransitionOutboundOutcome,
} from "./fedos_identity_transition_outbound_notification_coordinator.js";
import {
  FedosIdentityTransitionInboundNotificationCoordinator,
  type FedosIdentityTransitionInboundOutcome,
} from "./fedos_identity_transition_inbound_notification_coordinator.js";
import type { FedosIdentityTransitionPeerObservationPersistence } from "./persistence/fedos_identity_transition_peer_observation_persistence.js";
import type { FedosIdentityTransitionPeerObservationV1 } from "./fedos_identity_transition_peer_observation.js";
import { isFedosIdentityTransitionPeerObservationSuperseded } from "./fedos_identity_transition_peer_observation_conflict_detection.js";
import { computeFedosIdentityTransitionAcceptanceState, type FedosIdentityTransitionAcceptanceState, type FedosIdentityTransitionExplicitLocalDecision } from "../fedos_identity_transition_acceptance_state.js";
import {
  planFedosIdentityTransitionAffectedSessions,
  authorizeFedosIdentityTransitionRatchetReset,
  type FedosIdentityTransitionAffectedSession,
} from "./fedos_identity_transition_ratchet_reset_authorization.js";
import type { FedosIdentityTransitionRatchetResetLinkPersistence } from "./fedos_identity_transition_ratchet_reset_link.js";
import type { FedosIdentityTransitionLocalPolicy } from "../fedos_identity_transition_evidence_evaluation.js";

export interface FedosIdentityTransitionPeerRuntimeDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly nonceGenerator: () => string;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<{ readonly outcome: string }>;
  readonly observationPersistence: FedosIdentityTransitionPeerObservationPersistence;
  readonly resetLinkPersistence: FedosIdentityTransitionRatchetResetLinkPersistence;
  readonly localPolicy?: FedosIdentityTransitionLocalPolicy;
}

export interface FedosIdentityTransitionPeerStatusView {
  readonly transitionId: string;
  readonly revision: number;
  readonly previousTransitionId: string | null;
  readonly evidenceOutcome: FedosIdentityTransitionPeerObservationV1["evidenceOutcome"];
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly superseded: boolean;
}

export class FedosIdentityTransitionPeerRuntime {
  readonly #deps: FedosIdentityTransitionPeerRuntimeDependencies;
  readonly #outbound: FedosIdentityTransitionOutboundNotificationCoordinator;
  readonly #inbound: FedosIdentityTransitionInboundNotificationCoordinator;
  #stopped = false;

  constructor(deps: FedosIdentityTransitionPeerRuntimeDependencies) {
    this.#deps = deps;
    this.#outbound = new FedosIdentityTransitionOutboundNotificationCoordinator(deps);
    this.#inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: deps.deviceRegistry,
      localAccountRef: deps.localAccountRef,
      localDeviceRef: deps.localDeviceRef,
      clock: deps.clock,
      observationPersistence: deps.observationPersistence,
      localPolicy: deps.localPolicy,
    });
  }

  stop(): void {
    this.#stopped = true;
    this.#outbound.stop();
  }

  async publishIdentityTransitionNotification(params: FedosIdentityTransitionNotifyParams): Promise<FedosIdentityTransitionOutboundOutcome> {
    if (this.#stopped) return { outcome: "runtime-stopped" };
    return this.#outbound.publishTransitionNotification(params);
  }

  async importIdentityTransitionNotification(content: string): Promise<FedosIdentityTransitionInboundOutcome | { readonly outcome: "runtime-stopped" }> {
    if (this.#stopped) return { outcome: "runtime-stopped" };
    return this.#inbound.importRumorContent(content);
  }

  /** Explicit local decision, layered on top of an already-recorded observation. Mirrors the Foundation facade's own `recordLocalDecision()` exactly — never automatic. */
  recordIdentityTransitionDecision(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
    decision: FedosIdentityTransitionExplicitLocalDecision,
  ): FedosIdentityTransitionPeerStatusView | null {
    if (this.#stopped) return null;
    return this.#inspect(peerAccountRef, peerDeviceRef, transitionId, decision);
  }

  inspectPeerIdentityTransitionStatus(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosIdentityTransitionPeerStatusView | null {
    if (this.#stopped) return null;
    return this.#inspect(peerAccountRef, peerDeviceRef, transitionId, "none");
  }

  #inspect(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
    decision: FedosIdentityTransitionExplicitLocalDecision,
  ): FedosIdentityTransitionPeerStatusView | null {
    const observation = this.#deps.observationPersistence.getObservation(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    if (observation === null) return null;
    const lineage = this.#deps.observationPersistence.listLineage(
      this.#deps.localDeviceRef,
      observation.oldAccountIdentity.authority,
      observation.oldAccountIdentity.publicIdentifier,
      observation.oldAccountIdentity.identityId,
    );
    const superseded = isFedosIdentityTransitionPeerObservationSuperseded(observation, lineage);
    const acceptanceState = superseded ? "superseded" : computeFedosIdentityTransitionAcceptanceState(observation.evidenceOutcome, decision);
    return {
      transitionId: observation.transitionId,
      revision: observation.revision,
      previousTransitionId: observation.previousTransitionId,
      evidenceOutcome: observation.evidenceOutcome,
      acceptanceState,
      superseded,
    };
  }

  /** Phase I — read-only. Never mutates anything. */
  assessIdentityTransitionRatchetImpact(
    oldAccountIdentity: FedosDeviceBindingAccountRef,
    liveSessions: readonly FedosDirectRatchetSessionRecordV1[],
  ): readonly FedosIdentityTransitionAffectedSession[] {
    return planFedosIdentityTransitionAffectedSessions(oldAccountIdentity, liveSessions);
  }

  /** Phase J — the ONE method that mutates Ratchet state, and only for an ALREADY-`"accepted"` transition. */
  async authorizeIdentityTransitionRatchetReset(params: {
    readonly transitionId: string;
    readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
    readonly affectedSessions: readonly FedosIdentityTransitionAffectedSession[];
    readonly outboundIntegration: Pick<FedosDirectRatchetOutboundIntegration, "establishSession">;
  }) {
    if (this.#stopped) return { outcome: "not-accepted" as const };
    return authorizeFedosIdentityTransitionRatchetReset({
      transitionId: params.transitionId,
      acceptanceState: params.acceptanceState,
      affectedSessions: params.affectedSessions,
      outboundIntegration: params.outboundIntegration,
      resetLinkPersistence: this.#deps.resetLinkPersistence,
      now: this.#deps.clock,
    });
  }
}
