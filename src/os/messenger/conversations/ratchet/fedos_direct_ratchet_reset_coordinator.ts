/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the Runtime Reset Coordinator. The ONE place both the
 * outbound (`./fedos_direct_ratchet_outbound_integration.ts`) and inbound
 * (`./fedos_direct_ratchet_inbound_integration.ts`) integrations call to
 * (a) evaluate an incoming reset/establishment via
 * `FedosDirectRatchetSessionResetAuthority`, (b) persist the durable
 * reset audit record ("durable reset records"), (c) supersede the prior
 * generation's session record via the EXISTING, UNCHANGED
 * `FedosDirectRatchetStateRuntime.markResetRequired()` (Alpha 5401–5480 —
 * this Arc adds no new lifecycle state; that Foundation Arc's own
 * `"reset-required"` state already IS the "superseded" state the
 * normative review named, per that state's own header: "reused here as
 * active/expired/reset-required/revoked — renamed ... superseded ->
 * reset-required"), and (d) apply the Device-revocation quarantine
 * consequence to every ratchet session a revoked Device participates in.
 *
 * Never itself constructs a session, never calls the Ratchet Core, never
 * touches the live session cache — strictly audit + lifecycle-transition
 * bookkeeping around an ALREADY-decided outcome. The evaluation itself
 * (`evaluate()`) is the real security boundary; `applyConsequences()` runs
 * only after a caller has already acted on that evaluation.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSuite } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionId } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";
import { FedosDirectRatchetStateRuntime } from "../../../../conversation/ratchet/fedos_direct_ratchet_state_runtime.js";
import type { FedosDirectRatchetSessionPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_persistence.js";
import {
  FedosDirectRatchetSessionResetAuthority,
  type FedosDirectRatchetSessionResetEvaluation,
  type FedosDirectRatchetSessionResetEvaluationRequest,
} from "../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_authority.js";
import type { FedosDirectRatchetSessionResetRecordPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.js";
import type { FedosDirectRatchetSessionResetInitiator, FedosDirectRatchetSessionResetOutcome } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_record.js";
import type { FedosDirectRatchetSessionResetReason } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_reason.js";

export interface FedosDirectRatchetResetCoordinatorDependencies {
  readonly stateRuntime: FedosDirectRatchetStateRuntime;
  readonly resetRecordPersistence: FedosDirectRatchetSessionResetRecordPersistence;
  readonly now: () => number;
}

export interface FedosDirectRatchetResetConsequenceParams {
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
  readonly conversationId: string;
  readonly suite: FedosDirectRatchetSuite;
  readonly previousGeneration: number | null;
  readonly newGeneration: number;
  readonly reason: FedosDirectRatchetSessionResetReason | null;
  readonly nonce: string;
  readonly initiator: FedosDirectRatchetSessionResetInitiator;
  readonly outcome: FedosDirectRatchetSessionResetOutcome;
  /** The PRIOR generation's own session id, when one existed — `null` for a tuple's very first (`generation === 0`) establishment. Superseded via the existing `markResetRequired()`; never re-derived here (the caller already resolved it while computing `previousGeneration`). */
  readonly previousSessionId: FedosDirectRatchetSessionId | null;
  /** `true` for an idempotent repeat of an already-recorded nonce — the audit record already exists and is never rewritten; only the (still-idempotent) supersede step runs. */
  readonly skipRecord?: boolean;
}

export class FedosDirectRatchetResetCoordinator {
  readonly #deps: FedosDirectRatchetResetCoordinatorDependencies;
  readonly #resetAuthority: FedosDirectRatchetSessionResetAuthority;

  constructor(deps: FedosDirectRatchetResetCoordinatorDependencies) {
    this.#deps = deps;
    this.#resetAuthority = new FedosDirectRatchetSessionResetAuthority(deps.resetRecordPersistence);
  }

  /** Delegates to `FedosDirectRatchetSessionResetAuthority.evaluate()` — the real security boundary. See that class's own header for the exact checks run. */
  evaluate(request: FedosDirectRatchetSessionResetEvaluationRequest): FedosDirectRatchetSessionResetEvaluation {
    return this.#resetAuthority.evaluate(request);
  }

  /**
   * Records the durable reset audit fact and, when `previousSessionId` is
   * supplied, best-effort supersedes it. Never throws; a supersede
   * transition that is already invalid (the prior session was already
   * `"revoked"`/`"corrupt"`, terminal) is silently ignored — this method
   * only ever ADDS a consequence, never reverses one.
   */
  applyConsequences(params: FedosDirectRatchetResetConsequenceParams): void {
    if (params.skipRecord !== true) {
      this.#deps.resetRecordPersistence.putResetRecord({
        schemaVersion: 1,
        nonce: params.nonce,
        localAccountRef: params.localAccountRef,
        localDeviceRef: params.localDeviceRef,
        remoteAccountRef: params.remoteAccountRef,
        remoteDeviceRef: params.remoteDeviceRef,
        conversationId: params.conversationId,
        suite: params.suite,
        previousGeneration: params.previousGeneration,
        newGeneration: params.newGeneration,
        reason: params.reason,
        initiator: params.initiator,
        outcome: params.outcome,
        recordedAt: this.#deps.now(),
      });
    }
    if (params.previousSessionId !== null) {
      this.#deps.stateRuntime.markResetRequired(params.previousSessionId);
    }
  }

  /**
   * Device-revocation quarantine sweep (review §06's chosen "quarantine,
   * not destroy, not retain-active" consequence): transitions EVERY
   * non-terminal ratchet session record where `deviceId` is either the
   * local or the remote Device to `"revoked"` (the EXISTING, already-
   * terminal lifecycle state `FedosDirectRatchetStateRuntime.revoke()`
   * already implements, Alpha 5401–5480, unchanged) — never destroys the
   * append-only sealed-secret records those sessions reference (that
   * store has no delete method by this codebase's own Absolute
   * Prohibitions). A caller (the Device revocation call site) invokes
   * this explicitly; nothing in this codebase automatically triggers it,
   * since no cross-subsystem event bus links Device Trust and the
   * Ratchet Runtime today — a disclosed, honest boundary, not an
   * oversight (see this Arc's own completion declaration).
   */
  applyDeviceRevocation(deviceId: string, sessionPersistence: FedosDirectRatchetSessionPersistence): readonly FedosDirectRatchetSessionId[] {
    const affected: FedosDirectRatchetSessionId[] = [];
    for (const record of sessionPersistence.listSessions()) {
      if (record.binding.localDeviceRef !== deviceId && record.binding.remoteDeviceRef !== deviceId) continue;
      const result = this.#deps.stateRuntime.revoke(record.binding.sessionId);
      if (result.outcome === "transitioned") affected.push(record.binding.sessionId);
    }
    return affected;
  }
}
