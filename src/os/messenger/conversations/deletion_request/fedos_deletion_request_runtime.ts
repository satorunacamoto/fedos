/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase M: the
 * narrow safe Runtime facade. Composes the Outbound Request, Inbound
 * Request, Acknowledgement Outbound, and Acknowledgement Inbound
 * Coordinators over one shared dependency bundle, and exposes ONLY the
 * named safe operations this Arc's own mission lists. Mirrors
 * `FedosRatchetPeerCapabilityRuntime`'s own "safe facade over a narrow,
 * injected dependency bundle" shape (`d825aa0`), deliberately a SIBLING
 * Runtime, never a merge into either that frozen class or
 * `FedosConversationRuntime` itself.
 *
 * Never exposes: filesystem paths, raw signatures to a UI, the deletion
 * execution coordinator directly, arbitrary target operations, or
 * generic remote command execution — every method here takes closed,
 * named parameters and returns a closed, named outcome.
 *
 * Each wire operation (`importDeletionRequestPayload()` /
 * `publishDeletionAcknowledgement()` / `importDeletionAcknowledgement()`)
 * is deliberately NOT auto-chained into the next — mission's own "do not
 * execute before all validation completes" / "explicit execution
 * authorization" discipline applies at the Runtime-facade boundary too:
 * a caller inspects one step's own outcome before deciding to invoke the
 * next, exactly like the real vertical-slice test in this Arc does.
 */
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import {
  FedosDeletionRequestOutboundCoordinator,
  type FedosDeletionRequestCreateParams,
  type FedosDeletionRequestOutboundDependencies,
  type FedosDeletionRequestOutboundOutcome,
} from "../../../../conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import {
  FedosDeletionRequestInboundCoordinator,
  type FedosDeletionRequestInboundDependencies,
  type FedosDeletionRequestInboundOutcome,
} from "../../../../conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import {
  FedosDeletionAcknowledgementOutboundCoordinator,
  type FedosDeletionAcknowledgementOutboundDependencies,
  type FedosDeletionAcknowledgementOutboundOutcome,
} from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.js";
import {
  FedosDeletionAcknowledgementInboundCoordinator,
  type FedosDeletionAcknowledgementInboundDependencies,
  type FedosDeletionAcknowledgementInboundOutcome,
} from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.js";
import {
  evaluateFedosDeletionRecipientPolicy,
  type FedosDeletionRecipientPolicy,
  type FedosDeletionRecipientPolicyDecision,
} from "../../../../conversation/deletion_request/fedos_deletion_recipient_policy.js";
import type { FedosDeletionRequestScope } from "../../../../conversation/deletion_request/fedos_deletion_request_scope.js";
import type { FedosDeletionRecipientDecisionState } from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js";
import type { FedosDeletionAcknowledgementRecordV1, FedosDeletionAcknowledgementAppliedScope } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_record.js";
import type { FedosDeletionRequestAcknowledgementOutcome } from "../../../../conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.js";
import type { FedosSignedDeletionRequestV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestStatePersistence } from "../../../../conversation/deletion_request/fedos_deletion_request_state_persistence.js";
import { safeStatusForFedosDeletionRequestLifecycle, type FedosDeletionRequestSafeStatus } from "../../../../conversation/deletion_request/fedos_deletion_request_safe_status.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import type { FedosDeletionRequestInboxSummaryV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_inbox_summary.js";

export interface FedosDeletionRequestRuntimeDependencies {
  readonly outbound: FedosDeletionRequestOutboundDependencies;
  readonly inbound: FedosDeletionRequestInboundDependencies;
  readonly acknowledgementOutbound: FedosDeletionAcknowledgementOutboundDependencies;
  readonly acknowledgementInbound: FedosDeletionAcknowledgementInboundDependencies;
  /** Shared with `outbound.requestStatePersistence` in every real assembly — kept as a separate, explicit field so `inspectDeletionRequestStatus()` never needs to reach into the Outbound Coordinator's own private state. */
  readonly requestStatePersistence: FedosDeletionRequestStatePersistence;
  readonly recipientAccountIndex: number;
  readonly clock: () => number;
}

export interface FedosDeletionRequestSafeStatusView {
  readonly requestId: string;
  readonly safeStatus: FedosDeletionRequestSafeStatus;
}

const AN_HONEST_OVERCLAIM_GUARD: readonly FedosDeletionAcknowledgementAppliedScope[] = [];

/** Pure mapping from a real, already-recorded recipient decision to an honest, closed acknowledgement shape — never invents a scope/outcome pair `isFedosDeletionAcknowledgementRecordHonest()` would reject. */
function acknowledgementFieldsForDecision(
  decisionState: FedosDeletionRecipientDecisionState,
  requestedScope: FedosDeletionRequestScope,
  grantedScope: "local-history" | "local-history-and-index" | null,
): {
  readonly outcome: FedosDeletionRequestAcknowledgementOutcome;
  readonly appliedScopes: readonly FedosDeletionAcknowledgementAppliedScope[];
  readonly retainedScopes: readonly FedosDeletionAcknowledgementAppliedScope[];
  readonly evidenceClass: "none" | "local-observed" | "local-verified" | "unverifiable";
} {
  switch (decisionState) {
    case "unauthorized":
      return { outcome: "unauthorized", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "none" };
    case "expired":
      return { outcome: "expired", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "none" };
    case "unsupported":
      return { outcome: "unsupported-scope", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "none" };
    case "policy-rejected":
      return { outcome: "rejected-policy", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "none" };
    case "failed":
      return { outcome: "failed", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "unverifiable" };
    case "partially-applied":
      return { outcome: "applied-partial", appliedScopes: ["local-history"], retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "local-observed" };
    case "locally-applied": {
      if (grantedScope === "local-history-and-index") {
        return { outcome: "applied-local-history-and-index", appliedScopes: ["local-history", "local-index"], retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "local-verified" };
      }
      const retained: readonly FedosDeletionAcknowledgementAppliedScope[] = requestedScope === "local-history-and-index" ? ["local-index"] : AN_HONEST_OVERCLAIM_GUARD;
      return { outcome: "applied-local-history", appliedScopes: ["local-history"], retainedScopes: retained, evidenceClass: "local-verified" };
    }
    default:
      // "received" / "validated" / "policy-pending" / "local-plan-ready" — never actually
      // reachable here (the Runtime facade only calls this for a TERMINAL decision), but this
      // function fails closed rather than throwing or fabricating an "applied-*" claim.
      return { outcome: "accepted-pending", appliedScopes: AN_HONEST_OVERCLAIM_GUARD, retainedScopes: AN_HONEST_OVERCLAIM_GUARD, evidenceClass: "none" };
  }
}

export class FedosDeletionRequestRuntime {
  readonly #deps: FedosDeletionRequestRuntimeDependencies;
  readonly #outbound: FedosDeletionRequestOutboundCoordinator;
  readonly #inbound: FedosDeletionRequestInboundCoordinator;
  readonly #ackOutbound: FedosDeletionAcknowledgementOutboundCoordinator;
  readonly #ackInbound: FedosDeletionAcknowledgementInboundCoordinator;

  constructor(deps: FedosDeletionRequestRuntimeDependencies) {
    this.#deps = deps;
    this.#outbound = new FedosDeletionRequestOutboundCoordinator(deps.outbound);
    this.#inbound = new FedosDeletionRequestInboundCoordinator(deps.inbound);
    this.#ackOutbound = new FedosDeletionAcknowledgementOutboundCoordinator(deps.acknowledgementOutbound);
    this.#ackInbound = new FedosDeletionAcknowledgementInboundCoordinator(deps.acknowledgementInbound);
  }

  /** Irreversible for this instance. */
  stop(): void {
    this.#outbound.stop();
  }

  /** Sender side — builds, signs, durably persists, and publishes one new deletion request in one call. */
  async createDeletionRequest(params: FedosDeletionRequestCreateParams): Promise<FedosDeletionRequestOutboundOutcome> {
    return this.#outbound.createSignPublishRequest(params);
  }

  /** Alias, matching this Arc's own brief naming exactly — identical to `createDeletionRequest()` in this Arc (create, sign, and publish happen atomically; there is no separate unsent-draft state a caller can hold and publish later). */
  async publishDeletionRequest(params: FedosDeletionRequestCreateParams): Promise<FedosDeletionRequestOutboundOutcome> {
    return this.createDeletionRequest(params);
  }

  /** Recipient side — `content` is the already-unwrapped Rumor's own `content: string`. */
  async importDeletionRequestPayload(content: string): Promise<FedosDeletionRequestInboundOutcome> {
    return this.#inbound.importRumorContent(content);
  }

  /**
   * The ONE combined inbound dispatch point this domain's own control
   * payload envelope (`fedos_deletion_request_control_payload.ts`)
   * requires — peeks the envelope's own discriminator (never re-decodes
   * twice past that point) and routes to the request or acknowledgement
   * Inbound Coordinator accordingly. Mirrors
   * `FedosRatchetPeerCapabilityInboundCoordinator.importRumorContent()`'s
   * own single-discriminator dispatch, one level up (two discriminators
   * here, not one) — the call site for `FedosConversationRuntime.receiveNip17Rumor()`'s
   * own dispatch chain.
   */
  async importDeletionRequestOrAcknowledgementPayload(
    content: string,
  ): Promise<FedosDeletionRequestInboundOutcome | FedosDeletionAcknowledgementInboundOutcome> {
    const request = await this.#inbound.importRumorContent(content);
    if (request.outcome !== "not-deletion-request-payload") return request;
    return this.#ackInbound.importAcknowledgementPayload(content);
  }

  /** Read-only inspection of what LOCAL policy would decide for a given requester/scope pair — never mutates, never touches the wire. */
  assessRecipientDeletionPolicy(policy: FedosDeletionRecipientPolicy, requestedScope: FedosDeletionRequestScope): FedosDeletionRecipientPolicyDecision {
    return evaluateFedosDeletionRecipientPolicy(policy, requestedScope);
  }

  /** Recipient side — explicit human/caller approval of a request an `"always-review"` policy left `"policy-pending"`. */
  async executeApprovedLocalDeletion(signed: FedosSignedDeletionRequestV1): Promise<FedosDeletionRequestInboundOutcome> {
    return this.#inbound.executeApprovedLocalDeletion(signed);
  }

  /** Secure Runtime Alpha 6041-6120 — Host/Renderer-safe approval by canonical `requestId` only (never a raw signature). See `FedosDeletionRequestInboundCoordinator.executeApprovedLocalDeletionById()`'s own header for the disclosed in-memory-only limitation. */
  async approveReceivedDeletionRequest(requestId: string): Promise<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }> {
    return this.#inbound.executeApprovedLocalDeletionById(requestId);
  }

  /** Secure Runtime Alpha 6041-6120 — explicit human rejection of a `"policy-pending"` item, by canonical `requestId` only. */
  async rejectReceivedDeletionRequest(requestId: string): Promise<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }> {
    return this.#inbound.rejectReceivedDeletionRequest(requestId);
  }

  /**
   * Recipient side — builds an HONEST acknowledgement from an already-
   * recorded, TERMINAL `importDeletionRequestPayload()`/`executeApprovedLocalDeletion()`
   * outcome (never `"policy-pending"`/`"received"`/`"validated"`/
   * `"local-plan-ready"`, which have nothing final to acknowledge yet)
   * and publishes it through the real private transport.
   */
  async publishDeletionAcknowledgement(params: {
    readonly requestId: string;
    readonly decisionState: FedosDeletionRecipientDecisionState;
    readonly requestedScope: FedosDeletionRequestScope;
    readonly grantedScope: "local-history" | "local-history-and-index" | null;
    readonly recipientAccountRef: string;
    readonly recipientDeviceRef: string | null;
    readonly conversationId: FedosConversationId;
  }): Promise<FedosDeletionAcknowledgementOutboundOutcome> {
    if (params.decisionState === "received" || params.decisionState === "validated" || params.decisionState === "policy-pending" || params.decisionState === "local-plan-ready") {
      return { outcome: "invalid-input" };
    }
    const fields = acknowledgementFieldsForDecision(params.decisionState, params.requestedScope, params.grantedScope);
    const record: FedosDeletionAcknowledgementRecordV1 = {
      schemaVersion: 1,
      requestId: params.requestId,
      recipientAccountRef: params.recipientAccountRef,
      recipientDeviceRef: params.recipientDeviceRef,
      outcome: fields.outcome,
      appliedScopes: fields.appliedScopes,
      retainedScopes: fields.retainedScopes,
      evidenceClass: fields.evidenceClass,
      acknowledgedAt: this.#deps.clock(),
      protocolVersion: 1,
    };
    return this.#ackOutbound.publishAcknowledgement(record, params.conversationId);
  }

  /** Sender side — `content` is the already-unwrapped Rumor's own `content: string`. */
  async importDeletionAcknowledgement(content: string): Promise<FedosDeletionAcknowledgementInboundOutcome> {
    return this.#ackInbound.importAcknowledgementPayload(content);
  }

  /** Safe status only — never a raw signature, raw path, or internal `bodyHash`. `null` if this requester has no local record of `requestId` at all. */
  inspectDeletionRequestStatus(requestId: string): FedosDeletionRequestSafeStatusView | null {
    const snapshot = this.#deps.requestStatePersistence.getRecord(requestId);
    if (snapshot === null) return null;
    const ackOutcome = snapshot.lifecycleState === "acknowledged" ? this.#latestAcknowledgementOutcome(requestId) : null;
    return { requestId, safeStatus: safeStatusForFedosDeletionRequestLifecycle(snapshot.lifecycleState, ackOutcome) };
  }

  #latestAcknowledgementOutcome(requestId: string): FedosDeletionRequestAcknowledgementOutcome | null {
    const record = this.#deps.acknowledgementInbound.acknowledgementPersistence.getRecord(requestId);
    return record === null ? null : record.acknowledgement.outcome;
  }

  /** Secure Runtime Alpha 6041-6120 — public, safe (outcome enum only, never the whole ack record) accessor the Desktop per-Device aggregation model (Phase B) needs. `null` if no acknowledgement has been received for `requestId` yet. */
  getAcknowledgementOutcome(requestId: string): FedosDeletionRequestAcknowledgementOutcome | null {
    return this.#latestAcknowledgementOutcome(requestId);
  }

  /**
   * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
   * Device Aggregation and User Consent UI Arc) — Phase B/E: sender-side,
   * every Device-specific request this local sender has ever created for
   * one (conversationId, targetEnvelopeId) pair. Filters the requester's
   * own real `requestStatePersistence.listAllSnapshots()` (`5641-5720`,
   * unmodified) down to each `requestId`'s own LATEST snapshot only (the
   * log itself may contain many superseded snapshots per request).
   */
  listSentRequestsForTarget(conversationId: string, targetEnvelopeId: string): readonly FedosPersistedDeletionRequestStateRecordV1[] {
    const latestByRequestId = new Map<string, FedosPersistedDeletionRequestStateRecordV1>();
    for (const snapshot of this.#deps.requestStatePersistence.listAllSnapshots()) {
      if (snapshot.conversationId !== conversationId || snapshot.targetEnvelopeId !== targetEnvelopeId) continue;
      const existing = latestByRequestId.get(snapshot.requestId);
      if (existing === undefined || snapshot.recordedAt >= existing.recordedAt) latestByRequestId.set(snapshot.requestId, snapshot);
    }
    return [...latestByRequestId.values()];
  }

  /**
   * Recipient-side, Phase D: every received request this local Device has
   * a durable Inbox summary for (`6041-6120`'s own additive port), paired
   * with its own CURRENT decision state
   * (`FedosDeletionRecipientDecisionPersistence`, `5641-5720`, unmodified).
   * `null` (never omitted) when no decision record exists for a summary
   * that does — structurally unreachable in practice (the Inbound
   * Coordinator writes both in the same call), but this method fails
   * closed rather than assuming it.
   */
  listReceivedRequestSummaries(): readonly { readonly summary: FedosDeletionRequestInboxSummaryV1; readonly decisionState: FedosDeletionRecipientDecisionState | null }[] {
    const summaryPersistence = this.#deps.inbound.inboxSummaryPersistence;
    if (summaryPersistence === undefined) return [];
    return summaryPersistence.listSummaries().map((summary) => {
      const decision = this.#deps.inbound.recipientDecisionPersistence.getRecord(summary.requestId);
      return { summary, decisionState: decision === null ? null : decision.decisionState };
    });
  }
}
