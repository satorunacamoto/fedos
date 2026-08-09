/**
 * FedOS Identity Transition Foundation Arc — Phase N: the safe,
 * standalone facade.
 *
 * This is the ONLY entry point this Arc exposes for the domain. It never
 * leaks a private key, a raw signature/proof internal, a filesystem
 * path, a Ratchet secret, or a generic "mutate this identity" operation
 * (Absolute Prohibitions). Every method fails closed to `null` (never
 * throws for a caller-input problem) once `stop()` has been called —
 * Phase P's own "stopped facade" case.
 *
 * Ephemeral draft state (the record body plus attached-but-not-yet-
 * persisted evidence) lives in a process-memory `Map` — only
 * `persistTransition()` writes anything durable, through the injected
 * `FedosIdentityTransitionFactPersistence` port. This split matches
 * Phase J's own "durable facts store outcomes, not raw evidence" design:
 * a draft's raw proofs are never themselves written to disk by this Arc.
 */
import { fedosIdentityTransitionAccountRefsEqual, type FedosIdentityTransitionRecordV1, type FedosIdentityTransitionTimestampCheck } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import { createFedosIdentityTransitionRecordV1, isWellFormedFedosIdentityTransitionRecordV1, checkFedosIdentityTransitionTimestamps, type FedosIdentityTransitionRecordCreateInput } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../../../../conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash } from "../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";
import { verifyFedosIdentityTransitionNewKeyProof, type FedosIdentityTransitionNewKeyProofV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_new_key_proof.js";
import { verifyFedosIdentityTransitionContinuityEvidence, type FedosIdentityTransitionContinuityEvidenceV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_continuity_evidence.js";
import { verifyFedosIdentityTransitionDeviceCorroboration, type FedosIdentityTransitionDeviceCorroborationV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_device_corroboration.js";
import type { FedosDeviceBindingV1 } from "../../../../device/fedos_device_binding.js";
import {
  evaluateFedosIdentityTransitionEvidence,
  FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY,
  type FedosIdentityTransitionEvidenceOutcome,
  type FedosIdentityTransitionLocalPolicy,
} from "../../../../conversation/identity_transition/fedos_identity_transition_evidence_evaluation.js";
import { computeFedosIdentityTransitionAcceptanceState, type FedosIdentityTransitionAcceptanceState, type FedosIdentityTransitionExplicitLocalDecision } from "../../../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";
import { isFedosIdentityTransitionFactSuperseded, type FedosIdentityTransitionFactWriteOutcome } from "../../../../conversation/identity_transition/fedos_identity_transition_fact_conflict_detection.js";
import type { FedosIdentityTransitionFactV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_fact.js";
import type { FedosIdentityTransitionFactPersistence } from "../../../../conversation/identity_transition/persistence/fedos_identity_transition_fact_persistence.js";
import type { FedosIdentityTransitionSafeStatusV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_safe_status.js";
import { planFedosIdentityTransitionRatchetImpact, type FedosIdentityTransitionRatchetImpactPlanV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_ratchet_impact_plan.js";

const MAX_DEVICE_CORROBORATIONS_PER_TRANSITION = 8;

interface FedosIdentityTransitionDraftState {
  readonly record: FedosIdentityTransitionRecordV1;
  newKeyProofValid: boolean | null;
  continuityStatus: "absent" | ReturnType<typeof verifyFedosIdentityTransitionContinuityEvidence>;
  deviceCorroborationStatuses: Array<ReturnType<typeof verifyFedosIdentityTransitionDeviceCorroboration>>;
}

export interface FedosIdentityTransitionValidationResult {
  readonly structurallyValid: boolean;
  readonly timestampCheck: FedosIdentityTransitionTimestampCheck;
}

export class FedosIdentityTransitionFacade {
  readonly #persistence: FedosIdentityTransitionFactPersistence;
  readonly #localPolicy: FedosIdentityTransitionLocalPolicy;
  readonly #drafts = new Map<string, FedosIdentityTransitionDraftState>();
  #stopped = false;

  constructor(persistence: FedosIdentityTransitionFactPersistence, localPolicy: FedosIdentityTransitionLocalPolicy = FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY) {
    this.#persistence = persistence;
    this.#localPolicy = localPolicy;
  }

  /** Idempotent. After this, every method returns `null` (never throws). */
  stop(): void {
    this.#stopped = true;
  }

  createTransitionDraft(input: Omit<FedosIdentityTransitionRecordCreateInput, "transitionId">): FedosIdentityTransitionRecordV1 | null {
    if (this.#stopped) return null;
    if (fedosIdentityTransitionAccountRefsEqual(input.oldAccountIdentity, input.newAccountIdentity)) return null;
    const record = createFedosIdentityTransitionRecordV1({ ...input, transitionId: generateFedosIdentityTransitionId() });
    if (!isWellFormedFedosIdentityTransitionRecordV1(record)) return null;
    this.#drafts.set(record.transitionId, { record, newKeyProofValid: null, continuityStatus: "absent", deviceCorroborationStatuses: [] });
    return record;
  }

  validateTransition(record: FedosIdentityTransitionRecordV1, nowSeconds: number): FedosIdentityTransitionValidationResult | null {
    if (this.#stopped) return null;
    return {
      structurallyValid: isWellFormedFedosIdentityTransitionRecordV1(record),
      timestampCheck: checkFedosIdentityTransitionTimestamps(record, nowSeconds),
    };
  }

  verifyNewIdentityProof(transitionId: string, proof: FedosIdentityTransitionNewKeyProofV1): boolean | null {
    if (this.#stopped) return null;
    const draft = this.#drafts.get(transitionId);
    if (draft === undefined) return null;
    const valid = verifyFedosIdentityTransitionNewKeyProof(draft.record, proof);
    draft.newKeyProofValid = valid;
    return valid;
  }

  addContinuityEvidence(transitionId: string, evidence: FedosIdentityTransitionContinuityEvidenceV1) {
    if (this.#stopped) return null;
    const draft = this.#drafts.get(transitionId);
    if (draft === undefined) return null;
    const status = verifyFedosIdentityTransitionContinuityEvidence(draft.record, evidence);
    draft.continuityStatus = status;
    return status;
  }

  addDeviceCorroboration(transitionId: string, corroboration: FedosIdentityTransitionDeviceCorroborationV1, deviceBinding: FedosDeviceBindingV1) {
    if (this.#stopped) return null;
    const draft = this.#drafts.get(transitionId);
    if (draft === undefined) return null;
    if (draft.deviceCorroborationStatuses.length >= MAX_DEVICE_CORROBORATIONS_PER_TRANSITION) return null;
    const status = verifyFedosIdentityTransitionDeviceCorroboration(draft.record, corroboration, deviceBinding);
    draft.deviceCorroborationStatuses.push(status);
    return status;
  }

  /** `manualVerificationConfirmed` is the ONLY place an out-of-band human decision enters evaluation — never inferred from evidence alone. */
  evaluateTransitionEvidence(transitionId: string, nowSeconds: number, manualVerificationConfirmed = false): FedosIdentityTransitionEvidenceOutcome | null {
    if (this.#stopped) return null;
    const draft = this.#drafts.get(transitionId);
    if (draft === undefined) return null;
    if (draft.newKeyProofValid === null) return null;
    return evaluateFedosIdentityTransitionEvidence({
      structurallyValid: isWellFormedFedosIdentityTransitionRecordV1(draft.record),
      transitionType: draft.record.transitionType,
      reasonCategory: draft.record.reasonCategory,
      timestampCheck: checkFedosIdentityTransitionTimestamps(draft.record, nowSeconds),
      historyOutcome: "none",
      newKeyProofValid: draft.newKeyProofValid,
      continuityEvidenceStatus: draft.continuityStatus,
      deviceCorroborationStatuses: draft.deviceCorroborationStatuses,
      manualVerificationConfirmed,
      localPolicy: this.#localPolicy,
    });
  }

  /** Writes exactly one durable fact. Returns the persistence layer's own write outcome — the caller's authoritative signal for duplicate/conflict/rollback/cycle detection. */
  persistTransition(transitionId: string, evidenceOutcome: FedosIdentityTransitionEvidenceOutcome, recordedAt: number): FedosIdentityTransitionFactWriteOutcome | null {
    if (this.#stopped) return null;
    const draft = this.#drafts.get(transitionId);
    if (draft === undefined) return null;
    const fact: FedosIdentityTransitionFactV1 = Object.freeze({
      schemaVersion: 1,
      transitionId: draft.record.transitionId,
      bodyHash: fedosIdentityTransitionBodyHash(draft.record),
      oldAccountIdentity: draft.record.oldAccountIdentity,
      newAccountIdentity: draft.record.newAccountIdentity,
      oldNostrIdentity: draft.record.oldNostrIdentity,
      newNostrIdentity: draft.record.newNostrIdentity,
      revision: draft.record.revision,
      previousTransitionId: draft.record.previousTransitionId,
      evidenceOutcome,
      conflictState: "none" as const,
      supersededByTransitionId: null,
      recordedAt,
    });
    return this.#persistence.putFact(fact);
  }

  /** Explicit local human decision, layered on top of an already-persisted fact's evidence outcome. Cannot override a final (rejected/conflicting/stale/superseded/rollback-detected) state — see `fedos_identity_transition_acceptance_state.ts`. */
  recordLocalDecision(transitionId: string, decision: FedosIdentityTransitionExplicitLocalDecision): FedosIdentityTransitionAcceptanceState | null {
    if (this.#stopped) return null;
    const fact = this.#persistence.getFact(transitionId);
    if (fact === null) return null;
    return computeFedosIdentityTransitionAcceptanceState(fact.evidenceOutcome, decision);
  }

  /** Safe status DTO — no raw evidence, no keys, no signatures. */
  inspectTransition(transitionId: string, explicitLocalDecision: FedosIdentityTransitionExplicitLocalDecision = "none"): FedosIdentityTransitionSafeStatusV1 | null {
    if (this.#stopped) return null;
    const fact = this.#persistence.getFact(transitionId);
    if (fact === null) return null;
    const lineage = this.#persistence.listLineage(fact.oldAccountIdentity.authority, fact.oldAccountIdentity.publicIdentifier, fact.oldAccountIdentity.identityId);
    const superseded = isFedosIdentityTransitionFactSuperseded(fact, lineage);
    const acceptanceState = superseded ? "superseded" : computeFedosIdentityTransitionAcceptanceState(fact.evidenceOutcome, explicitLocalDecision);
    return Object.freeze({
      schemaVersion: 1,
      transitionId: fact.transitionId,
      revision: fact.revision,
      previousTransitionId: fact.previousTransitionId,
      oldAccountIdentity: fact.oldAccountIdentity,
      newAccountIdentity: fact.newAccountIdentity,
      evidenceOutcome: fact.evidenceOutcome,
      acceptanceState,
      superseded,
    });
  }

  /** Read-only Ratchet impact plan — never mutates Ratchet state (Phase L). */
  planTransitionImpact(transitionId: string, explicitLocalDecision: FedosIdentityTransitionExplicitLocalDecision = "none"): FedosIdentityTransitionRatchetImpactPlanV1 | null {
    if (this.#stopped) return null;
    const status = this.inspectTransition(transitionId, explicitLocalDecision);
    if (status === null) return null;
    return planFedosIdentityTransitionRatchetImpact(transitionId, status.acceptanceState);
  }
}
