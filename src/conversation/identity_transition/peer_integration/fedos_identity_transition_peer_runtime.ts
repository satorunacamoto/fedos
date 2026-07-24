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
import {
  isKnownFedosIdentityTransitionManualVerificationMethod,
  isKnownFedosIdentityTransitionManualVerificationNoteCode,
  type FedosIdentityTransitionManualVerificationFactV1,
  type FedosIdentityTransitionManualVerificationMethod,
  type FedosIdentityTransitionManualVerificationNoteCode,
  type FedosIdentityTransitionManualVerificationPersistence,
} from "./fedos_identity_transition_manual_verification.js";
import type {
  FedosIdentityTransitionConversationContinuityPersistence,
  FedosIdentityTransitionConversationContinuityRecordV1,
  FedosIdentityTransitionConversationContinuityWriteOutcome,
} from "./fedos_identity_transition_conversation_continuity.js";
import { isFedosIdentityTransitionConversationContinuitySuperseded } from "./fedos_identity_transition_conversation_continuity.js";
import { fedosIdentityTransitionBuildSafeView, type FedosIdentityTransitionSafeViewV1 } from "./fedos_identity_transition_safe_view.js";
import type { FedosIdentityTransitionLocalDecisionPersistence } from "./fedos_identity_transition_local_decision.js";

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
  readonly manualVerificationPersistence: FedosIdentityTransitionManualVerificationPersistence;
  readonly continuityPersistence: FedosIdentityTransitionConversationContinuityPersistence;
  readonly localDecisionPersistence: FedosIdentityTransitionLocalDecisionPersistence;
  readonly localPolicy?: FedosIdentityTransitionLocalPolicy;
}

const MAX_INBOX_LIMIT = 200;

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

  /**
   * Explicit local decision. Unlike the prior Arc's own first draft of
   * this method (which only computed a decision's EFFECT for one call),
   * this now durably persists WHICH decision was made via
   * `localDecisionPersistence` — required so `"accepted"`/`"rejected"`
   * survive a restart (this Arc's own Phase C/R requirement). `"defer"`
   * is recorded as a fact too but never changes the computed
   * `acceptanceState` (mirrors `"none"` — deferring is explicitly NOT a
   * decision, Phase C's own "opening a screen must never accept or
   * reset anything" extended to "deferring must never silently reject
   * either").
   */
  recordIdentityTransitionDecision(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
    decision: "accept" | "reject" | "defer",
  ): FedosIdentityTransitionPeerStatusView | null {
    if (this.#stopped) return null;
    const observation = this.#deps.observationPersistence.getObservation(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    if (observation === null) return null;
    const priorFact = this.#deps.localDecisionPersistence.getLatestDecisionFact(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    const nextRevision = priorFact === null ? 0 : priorFact.revision + 1;
    const writeOutcome = this.#deps.localDecisionPersistence.putDecision({
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      peerAccountRef,
      peerDeviceRef,
      transitionId,
      decision,
      decidedAt: this.#deps.clock(),
      revision: nextRevision,
    });
    if (writeOutcome !== "inserted" && writeOutcome !== "already-present") return null;
    return this.#inspect(peerAccountRef, peerDeviceRef, transitionId);
  }

  inspectPeerIdentityTransitionStatus(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosIdentityTransitionPeerStatusView | null {
    if (this.#stopped) return null;
    return this.#inspect(peerAccountRef, peerDeviceRef, transitionId);
  }

  #inspect(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionPeerStatusView | null {
    const observation = this.#deps.observationPersistence.getObservation(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    if (observation === null) return null;
    const lineage = this.#deps.observationPersistence.listLineage(
      this.#deps.localDeviceRef,
      observation.oldAccountIdentity.authority,
      observation.oldAccountIdentity.publicIdentifier,
      observation.oldAccountIdentity.identityId,
    );
    const superseded = isFedosIdentityTransitionPeerObservationSuperseded(observation, lineage);
    const decision = this.#deps.localDecisionPersistence.getLatestDecision(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
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

  /** Phase B/C — the full, safe, combined review DTO for one transition (evidence outcome, acceptance state, per-Device evidence rows, manual verification if any, centralized warnings). Opening this view never mutates anything. */
  getIdentityTransitionSafeView(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionSafeViewV1 | null {
    if (this.#stopped) return null;
    const observation = this.#deps.observationPersistence.getObservation(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    if (observation === null) return null;
    const lineage = this.#deps.observationPersistence.listLineage(
      this.#deps.localDeviceRef,
      observation.oldAccountIdentity.authority,
      observation.oldAccountIdentity.publicIdentifier,
      observation.oldAccountIdentity.identityId,
    );
    const superseded = isFedosIdentityTransitionPeerObservationSuperseded(observation, lineage);
    const decision = this.#deps.localDecisionPersistence.getLatestDecision(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef, transitionId);
    const acceptanceState = superseded ? "superseded" : computeFedosIdentityTransitionAcceptanceState(observation.evidenceOutcome, decision);
    const sameTransitionObservations = this.#deps.observationPersistence.listObservationsForTransition(this.#deps.localDeviceRef, transitionId);
    const supersededTransitionIds = new Set(lineage.filter((o) => isFedosIdentityTransitionPeerObservationSuperseded(o, lineage)).map((o) => o.transitionId));
    const manualVerification = this.#deps.manualVerificationPersistence.getLatestFact(this.#deps.localDeviceRef, this.#deps.localAccountRef, transitionId);
    return fedosIdentityTransitionBuildSafeView({
      observation,
      superseded,
      acceptanceState,
      sameTransitionObservations,
      supersededTransitionIds,
      manualVerification,
    });
  }

  /** Phase J — bounded, deterministic, one-row-per-logical-transition inbox for THIS local Device. Never mutates anything. */
  listIdentityTransitionInbox(limit: number, offset: number): readonly FedosIdentityTransitionPeerStatusView[] {
    if (this.#stopped) return [];
    const boundedLimit = Math.max(0, Math.min(limit, MAX_INBOX_LIMIT));
    const boundedOffset = Math.max(0, offset);
    const all = this.#deps.observationPersistence.listObservationsForLocalDevice(this.#deps.localDeviceRef);
    const byTransitionId = new Map<string, FedosIdentityTransitionPeerObservationV1>();
    for (const o of all) {
      // One logical transition shown once — first-writer-wins is fine since every row for the same transitionId shares identical transition-level facts (only `peerDeviceRef`/`sourceNotificationId` differ).
      if (!byTransitionId.has(o.transitionId)) byTransitionId.set(o.transitionId, o);
    }
    const deduped = [...byTransitionId.values()].sort((a, b) => (b.observedAt - a.observedAt) || a.transitionId.localeCompare(b.transitionId));
    return deduped.slice(boundedOffset, boundedOffset + boundedLimit).map((observation) => {
      const lineage = this.#deps.observationPersistence.listLineage(
        this.#deps.localDeviceRef,
        observation.oldAccountIdentity.authority,
        observation.oldAccountIdentity.publicIdentifier,
        observation.oldAccountIdentity.identityId,
      );
      const superseded = isFedosIdentityTransitionPeerObservationSuperseded(observation, lineage);
      const decision = this.#deps.localDecisionPersistence.getLatestDecision(this.#deps.localDeviceRef, observation.peerAccountRef, observation.peerDeviceRef, observation.transitionId);
      const acceptanceState = superseded ? "superseded" : computeFedosIdentityTransitionAcceptanceState(observation.evidenceOutcome, decision);
      return {
        transitionId: observation.transitionId,
        revision: observation.revision,
        previousTransitionId: observation.previousTransitionId,
        evidenceOutcome: observation.evidenceOutcome,
        acceptanceState,
        superseded,
      };
    });
  }

  /** Phase D — a local trust decision, never universal proof. Fails closed on an unknown method/note code. */
  recordManualVerification(params: {
    readonly transitionId: string;
    readonly method: FedosIdentityTransitionManualVerificationMethod;
    readonly verifiedAt: number;
    readonly noteCode: FedosIdentityTransitionManualVerificationNoteCode;
  }): "recorded" | "already-present" | "conflict" | "stale-revision" | "failed" | "unavailable" {
    if (this.#stopped) return "unavailable";
    if (!isKnownFedosIdentityTransitionManualVerificationMethod(params.method)) return "unavailable";
    if (!isKnownFedosIdentityTransitionManualVerificationNoteCode(params.noteCode)) return "unavailable";
    const prior = this.#deps.manualVerificationPersistence.getLatestFact(this.#deps.localDeviceRef, this.#deps.localAccountRef, params.transitionId);
    const nextRevision = prior === null ? 0 : prior.revision + 1;
    const fact: FedosIdentityTransitionManualVerificationFactV1 = {
      schemaVersion: 1,
      transitionId: params.transitionId,
      verifierAccountRef: this.#deps.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      method: params.method,
      verifiedAt: params.verifiedAt,
      noteCode: params.noteCode,
      revision: nextRevision,
    };
    const outcome = this.#deps.manualVerificationPersistence.putFact(fact);
    return outcome === "inserted" ? "recorded" : outcome;
  }

  /** Phase F/G — records that THIS local Device has linked a Direct Conversation to an accepted transition. Never rewrites the Conversation ID; never touches Membership/Archive/Search. */
  recordConversationContinuity(params: {
    readonly conversationId: string;
    readonly transitionId: string;
    readonly acceptedAt: number;
    readonly newSessionRequired: boolean;
  }): FedosIdentityTransitionConversationContinuityWriteOutcome | "unavailable" | "not-accepted" {
    if (this.#stopped) return "unavailable";
    const observation = this.#deps.observationPersistence
      .listObservationsForLocalDevice(this.#deps.localDeviceRef)
      .find((o) => o.transitionId === params.transitionId);
    if (observation === undefined) return "unavailable";
    const decision = this.#deps.localDecisionPersistence.getLatestDecision(this.#deps.localDeviceRef, observation.peerAccountRef, observation.peerDeviceRef, params.transitionId);
    const lineage = this.#deps.observationPersistence.listLineage(
      this.#deps.localDeviceRef,
      observation.oldAccountIdentity.authority,
      observation.oldAccountIdentity.publicIdentifier,
      observation.oldAccountIdentity.identityId,
    );
    const superseded = isFedosIdentityTransitionPeerObservationSuperseded(observation, lineage);
    const acceptanceState = superseded ? "superseded" : computeFedosIdentityTransitionAcceptanceState(observation.evidenceOutcome, decision);
    if (acceptanceState !== "accepted") return "not-accepted";
    const manualVerification = this.#deps.manualVerificationPersistence.getLatestFact(this.#deps.localDeviceRef, this.#deps.localAccountRef, params.transitionId);
    const record: FedosIdentityTransitionConversationContinuityRecordV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      conversationId: params.conversationId,
      oldAccountIdentity: observation.oldAccountIdentity,
      newAccountIdentity: observation.newAccountIdentity,
      transitionId: params.transitionId,
      revision: observation.revision,
      evidenceLevel: acceptanceState,
      verificationMethod: manualVerification === null ? null : manualVerification.method,
      acceptedAt: params.acceptedAt,
      newSessionRequired: params.newSessionRequired,
    };
    return this.#deps.continuityPersistence.putRecord(record);
  }

  /** Read-only. `superseded` is derived, never stored mutably. */
  getConversationContinuity(conversationId: string): (FedosIdentityTransitionConversationContinuityRecordV1 & { readonly superseded: boolean }) | null {
    if (this.#stopped) return null;
    const current = this.#deps.continuityPersistence.getCurrentForConversation(this.#deps.localDeviceRef, conversationId);
    if (current === null) return null;
    const lineage = this.#deps.continuityPersistence.listForConversation(this.#deps.localDeviceRef, conversationId);
    return { ...current, superseded: isFedosIdentityTransitionConversationContinuitySuperseded(current, lineage) };
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
