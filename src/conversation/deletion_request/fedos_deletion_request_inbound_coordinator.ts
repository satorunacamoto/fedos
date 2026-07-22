/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phases D, E, F:
 * the narrow recipient-side Inbound Request Coordinator, local recipient
 * policy application, and the Local Deletion Bridge, composed as one
 * pipeline over an already-decoded control payload.
 *
 * Required ordering (mission's own Phase D, restated) — steps 1-13 are
 * ALL delegated, unmodified, to `5641-5720`'s own real
 * `evaluateFedosDeletionRequestForRecipient()` (schema validation,
 * signature verification, account/Conversation binding, expiry/replay
 * via the durable persistence's own idempotency, requester Membership,
 * target authorship, recipient binding — every one of Phase D's steps
 * 2-13 this file does not re-implement). This file's own real, additive
 * work begins exactly where `5641-5720` deliberately stopped:
 * `"policy-pending"` (step 11's own "local capability assessment"
 * already ran inside that evaluation) through step 17
 * (acknowledgement construction, `fedos_deletion_acknowledgement_outbound_coordinator.ts`'s
 * own job, triggered by this file's caller — see the Runtime facade).
 *
 *   14. recipient policy decision — Phase E, `fedos_deletion_recipient_policy.ts`,
 *       LOCALLY CONFIGURED via `resolveLocalPolicy`, never caller-supplied
 *       on the wire.
 *   15. durable evaluation record — `recordFedosDeletionRecipientPolicyRejection()`
 *       (deny) or the granted path below (grant); `"await-review"` stops
 *       here, at `"policy-pending"`, exactly like an un-reviewed request
 *       always has.
 *   16-17. explicit local plan construction / execution authorization —
 *       a GRANTED request builds a real `b3b3a6d` plan
 *       (`buildFedosLocalPayloadDeletionPlan()` for the full scope, or a
 *       narrower hand-built single-step plan when local policy caps the
 *       grant to `"local-history"` alone — see `#planForGrantedScope()`'s
 *       own header) and marks it `"local-plan-ready"`
 *       (`markFedosDeletionRecipientLocalPlanReady()`) BEFORE execution,
 *       never after.
 *   18. execution through `b3b3a6d` — the REAL
 *       `executeFedosLocalPayloadDeletionPlan()`, this Arc's own ONE
 *       sanctioned call site for it (contrast `5641-5720`'s own
 *       structural guard, which forbade this call entirely — see this
 *       Arc's own updated structural-guards test for the honest boundary
 *       restatement).
 *   19. durable local outcome — `recordSuppliedFedosDeletionRecipientLocalOutcome()`,
 *       reused unmodified.
 *
 * Unauthorized callers never receive a target-existence oracle: every
 * terminal outcome this file can reach beyond `"recorded"` collapses to
 * the SAME `{ outcome: "recorded", decisionState }` shape the caller
 * already had from `evaluateFedosDeletionRequestForRecipient()` — this
 * file adds no NEW oracle-prone branch of its own.
 */
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import type { FedosConversationSearchIndex } from "../search/fedos_conversation_search_index.js";
import { assessFedosLocalPayloadDeletion } from "../deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan, type FedosDeletionPlan } from "../deletion/fedos_deletion_plan.js";
import { executeFedosLocalPayloadDeletionPlan } from "../deletion/fedos_deletion_execution_coordinator.js";
import type { FedosDeletionExecutionPersistence } from "../deletion/fedos_deletion_execution_persistence.js";
import { decodeFedosDeletionRequestControlPayloadFromContent } from "./fedos_deletion_request_control_payload.js";
import type { FedosSignedDeletionRequestV1 } from "./fedos_deletion_request_signing.js";
import type { FedosDeletionRequestAuthorizationAssessmentDependencies } from "./fedos_deletion_request_authorization_assessment.js";
import type { FedosDeletionRecipientDecisionPersistence } from "./fedos_deletion_recipient_decision_persistence.js";
import type { FedosDeletionRequestScope } from "./fedos_deletion_request_scope.js";
import type { FedosDeletionRecipientDecisionState } from "./fedos_deletion_recipient_decision_state.js";
import type { FedosDeletionRecipientSuppliedLocalOutcome } from "./fedos_persisted_deletion_recipient_decision_record_v1.js";
import {
  evaluateFedosDeletionRequestForRecipient,
  markFedosDeletionRecipientLocalPlanReady,
  recordFedosDeletionRecipientPolicyRejection,
  recordSuppliedFedosDeletionRecipientLocalOutcome,
} from "./fedos_deletion_request_recipient_evaluation.js";
import {
  evaluateFedosDeletionRecipientPolicy,
  type FedosDeletionRecipientPolicy,
} from "./fedos_deletion_recipient_policy.js";
import type { FedosDeletionRequestInboxSummaryPersistence, FedosDeletionRequestInboxSummaryV1 } from "./fedos_deletion_request_inbox_summary.js";

export interface FedosDeletionRequestInboundDependencies {
  readonly authorization: FedosDeletionRequestAuthorizationAssessmentDependencies;
  readonly recipientDecisionPersistence: FedosDeletionRecipientDecisionPersistence;
  /** Phase E — LOCAL configuration only. Never derived from the request itself. */
  readonly resolveLocalPolicy: (requesterAccountRef: string) => FedosDeletionRecipientPolicy;
  readonly clock: () => number;
  readonly retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" | "tombstonePayload" | "removeLocalPayload">;
  readonly searchIndex: Pick<FedosConversationSearchIndex, "reconcilePayloadRetention">;
  readonly localExecutionPersistence: FedosDeletionExecutionPersistence;
  /** Opaque, non-secret local authority reference recorded on the real Retention decision — never a secret, never a raw path. */
  readonly localAccountRef: string;
  /**
   * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
   * Device Aggregation and User Consent UI Arc) — OPTIONAL, additive.
   * When supplied, this coordinator durably records this domain's own new
   * `FedosDeletionRequestInboxSummaryV1` (safe display fields only) the
   * FIRST time a request is genuinely newly received (never on a
   * duplicate/replay) — the restart-safe source of truth the Desktop
   * consent Inbox reads from. Omitted, this coordinator's own behavior is
   * byte-for-byte unchanged from `5881-5960`.
   */
  readonly inboxSummaryPersistence?: FedosDeletionRequestInboxSummaryPersistence;
}

export type FedosDeletionRequestInboundOutcome =
  | { readonly outcome: "not-deletion-request-payload" }
  | { readonly outcome: "duplicate" | "conflicting-duplicate" | "persistence-failed" }
  | {
      readonly outcome: "recorded";
      readonly requestId: string;
      readonly decisionState: FedosDeletionRecipientDecisionState;
      readonly requestedScope: FedosDeletionRequestScope;
      /** Populated only once a real grant was actually evaluated (`"locally-applied"`/`"partially-applied"`/`"failed"` from the granted path) — `null` for a terminal denial or an `"await-review"` state, which never computed one. Lets a caller (the Runtime facade) build an honest acknowledgement without re-deriving policy from thinner durable state. */
      readonly grantedScope: "local-history" | "local-history-and-index" | null;
    };

/** The two-value closed local grant vocabulary, narrower than the general request scope, since a `"local-history"`-only grant must produce a plan WITHOUT a `purge-index` step. */
function planForGrantedScope(
  planId: string,
  payloadId: FedosConversationPayloadId,
  grantedScope: "local-history" | "local-history-and-index",
  assessment: ReturnType<typeof assessFedosLocalPayloadDeletion>,
): FedosDeletionPlan {
  if (grantedScope === "local-history-and-index") {
    return buildFedosLocalPayloadDeletionPlan(planId, payloadId, assessment);
  }
  // "local-history-only" grant — a real, but NARROWER, single-step plan (retention-transition
  // only, no purge-index) than the general two-step builder produces. Hand-built here, over the
  // SAME real `FedosDeletionAssessment`, rather than a second execution coordinator or a
  // redesign of `b3b3a6d`'s own plan builder — `executeFedosLocalPayloadDeletionPlan()` already
  // handles a `steps` array of any length/subset correctly, one step kind at a time.
  if (assessment.blocker === "not-found" || assessment.blocker === "already-terminal") {
    return { planId, kind: "local-payload-deletion", canonicalTargetRef: payloadId, steps: [], requiresExplicitConfirmation: false };
  }
  const currentlyTombstoned = assessment.observations.some((o) => o.target === "local-payload" && o.status === "locally-tombstoned");
  return {
    planId,
    kind: "local-payload-deletion",
    canonicalTargetRef: payloadId,
    steps: [{ kind: "retention-transition", target: "local-payload", operation: currentlyTombstoned ? "logical-delete" : "tombstone" }],
    requiresExplicitConfirmation: true,
  };
}

export class FedosDeletionRequestInboundCoordinator {
  readonly #deps: FedosDeletionRequestInboundDependencies;
  /** Secure Runtime Alpha 6041-6120 -- see `#importRequest()`'s own "await-review" branch for why this is in-memory only, never durable. */
  readonly #pendingReviewCache = new Map<string, FedosSignedDeletionRequestV1>();

  constructor(deps: FedosDeletionRequestInboundDependencies) {
    this.#deps = deps;
  }

  /** `true` only while this process still holds the signed request in memory for a `"policy-pending"` item -- never a durable fact. */
  hasPendingReviewRequest(requestId: string): boolean {
    return this.#pendingReviewCache.has(requestId);
  }

  /** `content` is the already-unwrapped Rumor's own `content: string` — the ONE inbound dispatch point (mirrors `FedosRatchetPeerCapabilityInboundCoordinator.importRumorContent()`). */
  async importRumorContent(content: string): Promise<FedosDeletionRequestInboundOutcome> {
    const payload = decodeFedosDeletionRequestControlPayloadFromContent(content);
    if (payload === null || payload.kind !== "deletion-request-v1") return { outcome: "not-deletion-request-payload" };
    return this.#importRequest(payload.request);
  }

  async #importRequest(signed: FedosSignedDeletionRequestV1): Promise<FedosDeletionRequestInboundOutcome> {
    const requestId = signed.record.requestId;
    const evaluation = evaluateFedosDeletionRequestForRecipient(signed, {
      authorization: this.#deps.authorization,
      persistence: this.#deps.recipientDecisionPersistence,
      clock: this.#deps.clock,
    });
    if (evaluation.outcome === "duplicate") return { outcome: "duplicate" };
    if (evaluation.outcome === "conflicting-duplicate") return { outcome: "conflicting-duplicate" };
    if (evaluation.outcome === "persistence-failed") return { outcome: "persistence-failed" };

    // Secure Runtime Alpha 6041-6120 -- record the restart-safe Inbox summary the FIRST time
    // this request is genuinely newly received (never on a duplicate, which already returned
    // above). Best-effort: a write failure here never blocks the real evaluation pipeline.
    if (this.#deps.inboxSummaryPersistence !== undefined) {
      const summary: FedosDeletionRequestInboxSummaryV1 = {
        schemaVersion: 1,
        requestId,
        conversationId: signed.record.conversationId,
        targetEnvelopeId: signed.record.targetEnvelopeId,
        requesterAccountRef: signed.record.requesterAccountRef,
        requesterDeviceRef: signed.record.requesterDeviceRef,
        recipientDeviceRef: signed.record.recipientDeviceRef,
        scope: signed.record.scope,
        issuedAt: signed.record.issuedAt,
        expiresAt: signed.record.expiresAt,
        reasonCode: signed.record.reasonCode,
        recordedAt: this.#deps.clock(),
      };
      this.#deps.inboxSummaryPersistence.putSummary(summary);
    }

    if (evaluation.decisionState !== "policy-pending") {
      return { outcome: "recorded", requestId, decisionState: evaluation.decisionState, requestedScope: signed.record.scope, grantedScope: null };
    }

    // Phase E — LOCAL policy only, never caller-/request-supplied.
    const policy = this.#deps.resolveLocalPolicy(signed.record.requesterAccountRef);
    const decision = evaluateFedosDeletionRecipientPolicy(policy, signed.record.scope);

    if (decision.decision === "deny") {
      const rejected = recordFedosDeletionRecipientPolicyRejection(requestId, this.#deps.recipientDecisionPersistence, this.#deps.clock);
      if (rejected.outcome !== "recorded") return { outcome: "persistence-failed" };
      return { outcome: "recorded", requestId, decisionState: rejected.decisionState, requestedScope: signed.record.scope, grantedScope: null };
    }
    if (decision.decision === "await-review") {
      // Secure Runtime Alpha 6041-6120 -- held IN-MEMORY ONLY (never written to disk) so a
      // later explicit human approval can look the signed request back up by `requestId` alone
      // (Host/Renderer boundary: "no raw signatures in UI" -- a caller-facing approval command
      // carries only the canonical id, never this object). Disclosed limitation: an item still
      // awaiting review does not survive a process restart -- the DISPLAY (Inbox summary +
      // decision state) is fully restart-safe; only the "click approve" action itself is not,
      // until the request is naturally redelivered (safe/idempotent by this protocol's own
      // design).
      this.#pendingReviewCache.set(requestId, signed);
      return { outcome: "recorded", requestId, decisionState: "policy-pending", requestedScope: signed.record.scope, grantedScope: null };
    }

    return this.#executeGrantedDeletion(signed, decision.grantedScope);
  }

  /**
   * The explicit local approval path for a request an `"always-review"`
   * local policy left at `"policy-pending"` — a human/caller-driven
   * decision, never automatic. Re-derives the grant through the SAME
   * `evaluateFedosDeletionRecipientPolicy()` this file's own live path
   * uses — the approval itself does not widen what local policy would
   * otherwise allow: a `"deny"`/`"unavailable"` policy still refuses (a
   * human cannot approve past an active denial this way), and an
   * `"allow-local-history-only"` policy still caps the grant exactly as
   * it always does. The ONE deliberate exception is `"always-review"`
   * ITSELF: reaching this method at all already IS the human review
   * `"always-review"` exists to require (Secure Runtime Alpha 6041-6120's
   * own Phase C, "Required explicit actions: approve") — re-evaluating
   * that SAME `"always-review"` policy a second time here would make
   * every `"always-review"` item permanently un-approvable (the policy
   * would forever re-decide `"await-review"`, never `"grant"`), silently
   * defeating the entire consent flow this method exists to serve. An
   * `"always-review"` policy therefore grants exactly the REQUEST's own
   * requested scope here — never more than what the request itself
   * asked for. `signed` is the caller's own already-received, already-
   * verified copy (this Arc's own disclosed limitation: no durable
   * review-queue of raw received request bodies exists yet — see the
   * completion declaration).
   */
  async executeApprovedLocalDeletion(signed: FedosSignedDeletionRequestV1): Promise<FedosDeletionRequestInboundOutcome> {
    const requestId = signed.record.requestId;
    const current = this.#deps.recipientDecisionPersistence.getRecord(requestId);
    if (current === null || current.decisionState !== "policy-pending") return { outcome: "conflicting-duplicate" };

    const policy = this.#deps.resolveLocalPolicy(signed.record.requesterAccountRef);
    const decision: ReturnType<typeof evaluateFedosDeletionRecipientPolicy> =
      policy === "always-review" ? { decision: "grant", grantedScope: signed.record.scope } : evaluateFedosDeletionRecipientPolicy(policy, signed.record.scope);
    if (decision.decision !== "grant") {
      const rejected = recordFedosDeletionRecipientPolicyRejection(requestId, this.#deps.recipientDecisionPersistence, this.#deps.clock);
      if (rejected.outcome !== "recorded") return { outcome: "persistence-failed" };
      return { outcome: "recorded", requestId, decisionState: rejected.decisionState, requestedScope: signed.record.scope, grantedScope: null };
    }
    return this.#executeGrantedDeletion(signed, decision.grantedScope);
  }

  /**
   * Secure Runtime Alpha 6041-6120 — the Host/Renderer-safe approval entry
   * point: takes ONLY the canonical `requestId` (never a raw signature),
   * looks the signed request back up from this process's own in-memory
   * pending-review cache, and delegates to `executeApprovedLocalDeletion()`.
   * `"unknown-request"` if this process never received/no longer holds a
   * `"policy-pending"` copy for `requestId` (including after a restart —
   * see this file's own disclosed limitation). Consumed exactly once: the
   * cache entry is removed regardless of outcome.
   */
  async executeApprovedLocalDeletionById(requestId: string): Promise<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }> {
    const signed = this.#pendingReviewCache.get(requestId);
    if (signed === undefined) return { outcome: "unknown-request" };
    this.#pendingReviewCache.delete(requestId);
    return this.executeApprovedLocalDeletion(signed);
  }

  /**
   * Secure Runtime Alpha 6041-6120 — the explicit human REJECTION path for
   * a `"policy-pending"` item, distinct from an automatic `"deny"` policy
   * decision (`#importRequest()`'s own `decision.decision === "deny"`
   * branch, unmodified) — a human choosing to reject an item local policy
   * would otherwise have left for review. Takes only the canonical
   * `requestId`. Consumes and drops the in-memory pending-review entry
   * (nothing further can ever be approved for this `requestId` once
   * rejected — `"policy-pending"->"policy-rejected"` is the only reachable
   * transition from here, matching the durable transition table).
   */
  async rejectReceivedDeletionRequest(requestId: string): Promise<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }> {
    const current = this.#deps.recipientDecisionPersistence.getRecord(requestId);
    if (current === null || current.decisionState !== "policy-pending") return { outcome: "unknown-request" };
    const summary = this.#deps.inboxSummaryPersistence?.getSummary(requestId) ?? null;
    const cached = this.#pendingReviewCache.get(requestId);
    const requestedScope = summary?.scope ?? cached?.record.scope ?? "local-history";
    this.#pendingReviewCache.delete(requestId);
    const rejected = recordFedosDeletionRecipientPolicyRejection(requestId, this.#deps.recipientDecisionPersistence, this.#deps.clock);
    if (rejected.outcome !== "recorded") return { outcome: "persistence-failed" };
    return { outcome: "recorded", requestId, decisionState: rejected.decisionState, requestedScope, grantedScope: null };
  }

  async #executeGrantedDeletion(
    signed: FedosSignedDeletionRequestV1,
    grantedScope: "local-history" | "local-history-and-index",
  ): Promise<FedosDeletionRequestInboundOutcome> {
    const requestId = signed.record.requestId;
    const envelope = this.#deps.authorization.envelopePersistence.getEnvelope(signed.record.targetEnvelopeId as FedosConversationEnvelopeId);

    // "policy-pending" -> "local-plan-ready" is unconditional once granted (the only reachable
    // predecessor of "locally-applied"/"partially-applied"/"failed") — recorded BEFORE the
    // envelope-null check below, so even the structurally-unreachable-in-practice failure path
    // stays on a valid transition rather than attempting "policy-pending->failed" directly.
    markFedosDeletionRecipientLocalPlanReady(requestId, this.#deps.recipientDecisionPersistence, this.#deps.clock);

    let suppliedOutcome: FedosDeletionRecipientSuppliedLocalOutcome;
    const payloadId: FedosConversationPayloadId | null = envelope === null ? null : toFedosConversationPayloadId(envelope.payloadId);
    if (payloadId === null) {
      // Structurally unreachable in practice (authorization already confirmed target existence,
      // and a real persisted envelope's own `payloadId` was already validated on construction),
      // but this coordinator fails closed rather than assuming it — never a thrown error, never
      // a silent no-op left un-recorded.
      suppliedOutcome = "failed";
    } else {
      const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority: this.#deps.retentionAuthority });
      const plan = planForGrantedScope(`deletion-request-plan:${requestId}`, payloadId, grantedScope, assessment);

      const executionOutcome = executeFedosLocalPayloadDeletionPlan(
        {
          plan,
          requestedBy: this.#deps.localAccountRef,
          confirmed: true,
          authorityReference: this.#deps.localAccountRef,
          reasonCode: "user_requested_placeholder",
        },
        {
          retentionAuthority: this.#deps.retentionAuthority,
          searchIndex: this.#deps.searchIndex,
          persistence: this.#deps.localExecutionPersistence,
          clock: this.#deps.clock,
        },
      );
      suppliedOutcome =
        executionOutcome.outcome === "confirmation-required" || executionOutcome.outcome === "conflicting-plan"
          ? "failed"
          : executionOutcome.record.status;
    }

    const recorded = recordSuppliedFedosDeletionRecipientLocalOutcome(requestId, suppliedOutcome, this.#deps.recipientDecisionPersistence, this.#deps.clock);
    if (recorded.outcome !== "recorded") return { outcome: "persistence-failed" };
    return { outcome: "recorded", requestId, decisionState: recorded.decisionState, requestedScope: signed.record.scope, grantedScope };
  }
}
