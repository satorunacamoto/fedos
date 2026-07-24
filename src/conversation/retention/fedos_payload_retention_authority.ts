/**
 * Secure Runtime Alpha 796 ("Retention Authority Boundary") / Alpha 797
 * ("Retention Result Vocabulary") / Alpha 798 ("Retention Transition
 * Rules") / Alpha 799 ("Retention Security Claims") / Alpha 811
 * ("Retention Wiring") — Stages 6-7-8-9/21 of the Alpha 791–820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 *
 * The narrow authority connecting the Retention Decision Log
 * (`./fedos_payload_retention_persistence.ts`) to Payload Storage
 * (`../payload_storage/fedos_conversation_payload_storage.ts`) — Alpha
 * 811's own "connect narrowly" instruction: this class is the ONLY
 * place either concern is combined; neither port references the other
 * directly.
 *
 * Alpha 798 Transition Rules — enforced here, not by either port:
 *   active → tombstoned (allowed)
 *   tombstoned → payload-removed (allowed)
 *   payload-removed → active (FORBIDDEN — no restore; Alpha 798's own
 *     instruction: "Do not implement restore unless there is a
 *     reviewed source of retained bytes" — none exists)
 *   payload-removed → tombstoned (FORBIDDEN)
 *   tombstoned → active (FORBIDDEN)
 * A forbidden transition attempt surfaces `{ outcome: "conflict" }` —
 * reusing the existing `"conflict"` outcome (the requested change
 * disagrees with the current authoritative state) rather than
 * inventing a ninth outcome beyond Alpha 797's own named vocabulary.
 * `evaluatePayloadAccess()`/`readPayload()` are PURE previews (no
 * decision write); `tombstonePayload()`/`removeLocalPayload()` are the
 * only mutating operations — Alpha 796's own "separate pure preview
 * from mutation" instruction.
 *
 * Alpha 799 Security Claims — restated here as the load-bearing
 * contract this class's own behavior must never exceed:
 *
 *   MAY claim: once tombstoned or payload-removed, `readPayload()`
 *   will no longer return this payload's bytes through this Authority
 *   — a real, enforced, testable behavioral change.
 *
 *   MUST NOT claim: secure physical overwrite, SSD erasure, cloud
 *   backup deletion, remote peer deletion, cryptographic erasure
 *   without a key lifecycle (none exists in this Arc), or worldwide
 *   deletion. `removeLocalPayload()` records an ACCESS-STATE transition
 *   only — `FedosConversationPayloadStorage` (Alpha 804) has
 *   deliberately NO delete method, so the underlying backend's own raw
 *   bytes are NOT guaranteed physically removed by this call; for the
 *   append-only backend (Alpha 809) specifically, the byte-carrying
 *   JSON line remains on disk (matching every append-only backend's
 *   own "no delete/rewrite/compaction" discipline in this codebase) —
 *   `removeLocalPayload()` guarantees only that this Authority's own
 *   `readPayload()` will never again surface those bytes through the
 *   normal read path. A future Arc choosing a backend capable of real
 *   byte deletion (e.g. one file per payload) could strengthen this
 *   claim for that backend specifically; this Arc does not.
 */

import { validateFedosPayloadRetentionDecision, type FedosPayloadRetentionDecisionInput } from "./fedos_payload_retention_decision_validator.js";
import { serializeFedosPayloadRetentionDecision } from "./fedos_payload_retention_decision_codec.js";
import type { FedosPayloadRetentionReasonCode } from "./fedos_payload_retention_decision.js";
import type { FedosPayloadRetentionState } from "./fedos_payload_retention_state.js";
import type { FedosPayloadRetentionPersistence } from "./fedos_payload_retention_persistence.js";
import type { FedosConversationPayload, FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";

export interface FedosPayloadRetentionAuthorityDependencies {
  readonly retentionPersistence: FedosPayloadRetentionPersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  /** Optional; defaults to `() => Math.floor(Date.now() / 1000)`. */
  readonly clock?: () => number;
}

/** Alpha 797 — reachable outcomes only; no `"unavailable"` token is included since nothing in this synchronous design ever produces it. */
export type FedosPayloadRetentionResult =
  | { readonly outcome: "tombstoned" }
  | { readonly outcome: "already-tombstoned" }
  | { readonly outcome: "payload-removed" }
  | { readonly outcome: "already-removed" }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "failed" };

export type FedosPayloadAccessEvaluation =
  | { readonly outcome: "allowed" }
  | { readonly outcome: "denied"; readonly state: "tombstoned" | "payload-removed" }
  | { readonly outcome: "not-found" };

export type FedosGatedPayloadReadResult =
  | { readonly outcome: "found"; readonly payload: FedosConversationPayload }
  | { readonly outcome: "denied"; readonly state: "tombstoned" | "payload-removed" }
  | { readonly outcome: "not-found" };

function defaultClock(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosPayloadRetentionAuthority {
  readonly #retentionPersistence: FedosPayloadRetentionPersistence;
  readonly #payloadStorage: FedosConversationPayloadStorage;
  readonly #clock: () => number;

  constructor(dependencies: FedosPayloadRetentionAuthorityDependencies) {
    this.#retentionPersistence = dependencies.retentionPersistence;
    this.#payloadStorage = dependencies.payloadStorage;
    this.#clock = dependencies.clock ?? defaultClock;
  }

  #currentState(payloadId: FedosConversationPayloadId): FedosPayloadRetentionState {
    if (this.#retentionPersistence.getDecision(payloadId, "payload-removed") !== null) return "payload-removed";
    if (this.#retentionPersistence.getDecision(payloadId, "tombstoned") !== null) return "tombstoned";
    return "active";
  }

  /** Pure preview — no decision write. */
  evaluatePayloadAccess(payloadId: FedosConversationPayloadId): FedosPayloadAccessEvaluation {
    if (this.#payloadStorage.getDescriptor(payloadId) === null) return { outcome: "not-found" };
    const state = this.#currentState(payloadId);
    if (state === "active") return { outcome: "allowed" };
    return { outcome: "denied", state };
  }

  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — pure preview, checks
   * ONLY the retention decision log, deliberately WITHOUT
   * `evaluatePayloadAccess()`'s own payload-storage-existence gate.
   *
   * `evaluatePayloadAccess()` is correct for LIVE reads (a payload that
   * was never downloaded/stored has nothing to protect, so
   * `"not-found"` is the honest answer) but WRONG for Archive
   * restore-time re-evaluation: at the exact moment a fresh restore
   * checks whether to write a Payload, that Payload's own storage entry
   * does not exist YET on this device by construction (restore is the
   * one process that would create it) — so `evaluatePayloadAccess()`
   * would ALWAYS answer `"not-found"` during a fresh restore, even when
   * a real, durable retention decision already exists, silently
   * defeating the exact defense-in-depth restore is supposed to provide.
   * This method answers the question restore actually needs: "does this
   * device's own retention LOG say this payload is denied, regardless
   * of whether its bytes currently exist in storage."
   */
  evaluateRetentionDecisionOnly(payloadId: FedosConversationPayloadId): FedosPayloadRetentionState {
    return this.#currentState(payloadId);
  }

  /** Alpha 811 — the narrow gated read: retention state is checked BEFORE `payloadStorage.getPayload()` is ever called. */
  readPayload(payloadId: FedosConversationPayloadId): FedosGatedPayloadReadResult {
    const evaluation = this.evaluatePayloadAccess(payloadId);
    if (evaluation.outcome !== "allowed") return evaluation;
    const payload = this.#payloadStorage.getPayload(payloadId);
    if (payload === null) return { outcome: "not-found" };
    return { outcome: "found", payload };
  }

  #recordDecision(
    payloadId: FedosConversationPayloadId,
    action: "tombstoned" | "payload-removed",
    authorityReference: string | null,
    reasonCode: FedosPayloadRetentionReasonCode,
  ): "inserted" | "already-present" | "conflict" | "failed" {
    const candidate: FedosPayloadRetentionDecisionInput = {
      payloadId,
      action,
      decidedAt: this.#clock(),
      authorityReference,
      reasonCode,
    };
    const decision = validateFedosPayloadRetentionDecision(candidate);
    if (decision === null) {
      throw new Error(
        "FedosPayloadRetentionAuthority: invariant violated -- a decision this Authority just assembled itself failed FedosPayloadRetentionDecision validation.",
      );
    }
    return this.#retentionPersistence.putDecision(serializeFedosPayloadRetentionDecision(decision));
  }

  /** active → tombstoned. Idempotent if already tombstoned; `"conflict"` if already payload-removed (forbidden transition, Alpha 798). */
  tombstonePayload(
    payloadId: FedosConversationPayloadId,
    authorityReference: string | null,
    reasonCode: FedosPayloadRetentionReasonCode,
  ): FedosPayloadRetentionResult {
    if (this.#payloadStorage.getDescriptor(payloadId) === null) return { outcome: "not-found" };
    const state = this.#currentState(payloadId);
    if (state === "payload-removed") return { outcome: "conflict" };
    if (state === "tombstoned") return { outcome: "already-tombstoned" };

    const writeResult = this.#recordDecision(payloadId, "tombstoned", authorityReference, reasonCode);
    switch (writeResult) {
      case "inserted":
        return { outcome: "tombstoned" };
      case "already-present":
        return { outcome: "already-tombstoned" };
      case "conflict":
        return { outcome: "conflict" };
      case "failed":
        return { outcome: "failed" };
    }
  }

  /** tombstoned → payload-removed ONLY. `"conflict"` for an active (never-tombstoned) payload -- Alpha 798 names no active → payload-removed path. */
  removeLocalPayload(
    payloadId: FedosConversationPayloadId,
    authorityReference: string | null,
    reasonCode: FedosPayloadRetentionReasonCode,
  ): FedosPayloadRetentionResult {
    if (this.#payloadStorage.getDescriptor(payloadId) === null) return { outcome: "not-found" };
    const state = this.#currentState(payloadId);
    if (state === "active") return { outcome: "conflict" };
    if (state === "payload-removed") return { outcome: "already-removed" };

    const writeResult = this.#recordDecision(payloadId, "payload-removed", authorityReference, reasonCode);
    switch (writeResult) {
      case "inserted":
        return { outcome: "payload-removed" };
      case "already-present":
        return { outcome: "already-removed" };
      case "conflict":
        return { outcome: "conflict" };
      case "failed":
        return { outcome: "failed" };
    }
  }
}
