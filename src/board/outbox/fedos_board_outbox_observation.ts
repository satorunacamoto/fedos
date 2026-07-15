/**
 * Secure Runtime Alpha 475 ("Outbox Observation Realization") — Stage 5
 * of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.
 *
 * Realizes a SUBSET of the Observation vocabulary Alpha 415 named but
 * deliberately left unimplemented
 * (`docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`,
 * "Candidate future observation kinds, named as VOCABULARY ONLY this
 * Arc"). Alpha 415 named six candidates: `queued`, `attempt-started`,
 * `delivered`, `rejected`, `failed`, `abandoned`. This Arc implements
 * exactly the FIVE that a `FedosPublishScheduler`
 * (`./fedos_publish_scheduler.ts`, Alpha 476) itself produces —
 * `attempt-started`, `delivered`, `rejected`, `failed`, `abandoned` —
 * and deliberately OMITS `queued`, since that observation belongs to
 * intent creation (Alpha 414's own `createFedosBoardOutboxIntent`), a
 * moment this Arc does not touch.
 *
 * Per Alpha 415 §3's own permanent rule ("Intent is an authoritative
 * delivery REQUEST. Observations are derived historical FACTS and never
 * rewrite the intent."), `FedosBoardOutboxObservation` is immutable,
 * carries its outbox id BY REFERENCE ONLY, and has no constructor path
 * other than `createFedosBoardOutboxObservation` below.
 *
 * Deliberately NOT persisted this Arc — no `putObservation`/
 * `listObservations` method is added to `FedosBoardOutboxPersistence`
 * (`./fedos_board_outbox_persistence.ts`). `FedosPublishScheduler` keeps
 * its own in-memory observation log and returns it from every `tick()`
 * call; see
 * `docs/secure_runtime_alpha_475_outbox_observation_realization.md` for
 * why durable Observation storage remains out of scope until a REAL
 * (not Mock) `FedosBoardOutboxPublisher` implementation exists to make
 * that persistence honestly load-bearing.
 *
 * HARD GUARDRAILS:
 *   - No mutation method, no setter.
 *   - No persistence import, no network, no Relay/Nostr reference.
 *   - `createFedosBoardOutboxObservation` is the ONLY constructor; fails
 *     closed to `null`, matching `createFedosBoardOutboxIntent`'s own
 *     convention (`./fedos_board_outbox_types.ts`, Alpha 414).
 */

import type { FedosBoardOutboxId } from "./fedos_board_outbox_types.js";

export type FedosBoardOutboxObservationKind = "attempt-started" | "delivered" | "rejected" | "failed" | "abandoned";

const OBSERVATION_KINDS: ReadonlySet<string> = new Set([
  "attempt-started",
  "delivered",
  "rejected",
  "failed",
  "abandoned",
]);

export function isFedosBoardOutboxObservationKind(value: string): value is FedosBoardOutboxObservationKind {
  return OBSERVATION_KINDS.has(value);
}

export interface FedosBoardOutboxObservation {
  readonly outboxId: FedosBoardOutboxId;
  readonly kind: FedosBoardOutboxObservationKind;
  readonly observedAt: number;
  readonly reason?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidObservedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * Fails closed to `null` for a malformed `outboxId`/`kind`/`observedAt`
 * — never throws. Result is `Object.freeze`d, matching
 * `createFedosBoardOutboxIntent`'s own convention.
 */
export function createFedosBoardOutboxObservation(
  outboxId: FedosBoardOutboxId,
  kind: FedosBoardOutboxObservationKind,
  observedAt: number,
  reason?: string,
): FedosBoardOutboxObservation | null {
  if (!isNonEmptyString(outboxId as unknown as string)) return null;
  if (!isFedosBoardOutboxObservationKind(kind)) return null;
  if (!isValidObservedAt(observedAt)) return null;
  if (reason !== undefined && !isNonEmptyString(reason)) return null;

  return Object.freeze(
    reason === undefined ? { outboxId, kind, observedAt } : { outboxId, kind, observedAt, reason },
  );
}
