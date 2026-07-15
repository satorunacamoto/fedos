/**
 * Secure Runtime Alpha 525 ("Attempt Subject ID") — Stage 5 of the
 * Alpha 521–540 Durable Delivery Retry Coordination Arc.
 *
 * Resolves the `"invalid-transition"` collision Alpha 514 documented
 * (`docs/secure_runtime_alpha_514_failure_path_verification.md`
 * §"Discovered consequence") by giving EACH retry attempt of one
 * logical Outbox intent its OWN, fresh `FedosDeliveryObservationSubjectId`
 * (`./fedos_delivery_observation.js`, Alpha 462, UNCHANGED) — never by
 * loosening `isAllowedFedosDeliveryObservationTransition`
 * (`./fedos_delivery_observation_transition_graph.js`, Alpha 494,
 * UNCHANGED) or `FedosValidatingDeliveryObservationRepository` (Alpha
 * 495, UNCHANGED). Each attempt-scoped subject still receives EXACTLY
 * one `publishing` → terminal pair — the single-attempt-per-subject
 * model those two files already enforce, satisfied per attempt rather
 * than violated across attempts.
 *
 * HARD GUARDRAILS:
 *   - `makeFedosDeliveryAttemptSubjectId` and
 *     `parseFedosDeliveryAttemptSubjectId` are the ONLY exports.
 *   - Pure, synchronous, deterministic — the SAME `(originalSubjectId,
 *     attemptNumber)` pair always yields the SAME attempt subject id;
 *     no randomness, no clock read.
 *   - `attemptNumber` must be a positive integer (`>= 1`) — fails
 *     closed to `null` otherwise, never throws.
 *   - No import of `FedosDeliveryObservationRepository`,
 *     `FedosPublishScheduler`, or any Publisher type — this file is a
 *     pure string-identity helper only.
 */

import type { FedosDeliveryObservationSubjectId } from "./fedos_delivery_observation.js";

const ATTEMPT_SEPARATOR = "::attempt::";
const ATTEMPT_SUBJECT_PATTERN = /^(.+)::attempt::(\d+)$/;

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

/**
 * Derives the attempt-scoped subject id for attempt `attemptNumber` of
 * `originalSubjectId`. Fails closed to `null` for a non-positive-integer
 * `attemptNumber` — never throws.
 */
export function makeFedosDeliveryAttemptSubjectId(
  originalSubjectId: FedosDeliveryObservationSubjectId,
  attemptNumber: number,
): FedosDeliveryObservationSubjectId | null {
  if (!isPositiveInteger(attemptNumber)) return null;
  return `${originalSubjectId}${ATTEMPT_SEPARATOR}${attemptNumber}` as FedosDeliveryObservationSubjectId;
}

/**
 * The inverse of `makeFedosDeliveryAttemptSubjectId`. Fails closed to
 * `null` for anything not shaped like an attempt-scoped subject id —
 * never throws.
 */
export function parseFedosDeliveryAttemptSubjectId(
  attemptSubjectId: FedosDeliveryObservationSubjectId,
): { readonly originalSubjectId: FedosDeliveryObservationSubjectId; readonly attemptNumber: number } | null {
  const match = ATTEMPT_SUBJECT_PATTERN.exec(attemptSubjectId);
  if (match === null) return null;
  const attemptNumber = Number(match[2]);
  if (!isPositiveInteger(attemptNumber)) return null;
  return {
    originalSubjectId: match[1] as FedosDeliveryObservationSubjectId,
    attemptNumber,
  };
}
