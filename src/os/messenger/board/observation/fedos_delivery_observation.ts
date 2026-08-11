/**
 * Secure Runtime Alpha 462 ("Delivery Observation State Model") — Stage 2
 * of the Alpha 461–470 Canonical Delivery Observation Arc.
 *
 * `FedosDeliveryObservation` is a durable, immutable historical FACT about
 * one delivery attempt — never a mutable status field, never a queue
 * entry, never a retry directive. Per Alpha 461's own inventory, this Arc
 * builds a STANDALONE vocabulary, deliberately unrelated to the two other,
 * uncommitted Observation-shaped threads already present in this working
 * tree (`src/board/publish/nostr/*`'s Publisher and
 * `src/board/outbox/fedos_board_outbox_observation.ts`'s
 * `FedosBoardOutboxObservation`) — see
 * `docs/secure_runtime_alpha_461_existing_observation_vocabulary_inventory.md`
 * for why. `subjectId` is therefore an OPAQUE, caller-supplied string this
 * file neither derives from nor validates against any Board/Outbox
 * identifier — this Arc names no relationship between a
 * `FedosDeliveryObservation` and any real Publisher output.
 *
 * The five states (`queued`/`publishing`/`accepted`/`rejected`/`failed`,
 * this Arc's own required vocabulary) describe ONE delivery attempt's own
 * progress — never a retry count, backoff duration, or connection-pool
 * reference, all explicitly prohibited for this Arc.
 *
 * `id` is DETERMINISTICALLY derived from `subjectId + state + observedAt`
 * (mirroring `makeFedosBoardOutboxId`'s own Alpha 413 determinism
 * rationale), so recording the SAME logical observation twice always
 * yields the SAME id — the property `FedosDeliveryObservationPersistence`'s
 * own inserted/already-present/conflict write semantics (Alpha 464) is
 * built on.
 *
 * HARD GUARDRAILS:
 *   - No Board, Outbox, Publisher, Nostr, Relay, retry, backoff, pool, or
 *     GUI import of any kind anywhere in this file.
 *   - No mutation method, no setter.
 *   - `createFedosDeliveryObservation` is the ONLY constructor; fails
 *     closed to `null` for anything malformed, never throws. Its result is
 *     `Object.freeze`d.
 */

export type FedosDeliveryObservationState = "queued" | "publishing" | "accepted" | "rejected" | "failed";

const DELIVERY_OBSERVATION_STATES: ReadonlySet<string> = new Set([
  "queued",
  "publishing",
  "accepted",
  "rejected",
  "failed",
]);

export function isFedosDeliveryObservationState(value: string): value is FedosDeliveryObservationState {
  return DELIVERY_OBSERVATION_STATES.has(value);
}

/** Opaque, caller-supplied. Not derived from, and not validated against, any Board/Outbox/Publisher identifier. */
export type FedosDeliveryObservationSubjectId = string & { readonly __brand: "FedosDeliveryObservationSubjectId" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Brands an already-chosen, non-empty string. Returns `null` for anything else — no random generation. */
export function toFedosDeliveryObservationSubjectId(value: string): FedosDeliveryObservationSubjectId | null {
  return isNonEmptyString(value) ? (value as FedosDeliveryObservationSubjectId) : null;
}

export type FedosDeliveryObservationId = string & { readonly __brand: "FedosDeliveryObservationId" };

/**
 * Deterministic id derivation: `subjectId + state + observedAt`, joined by
 * a separator that cannot appear inside a non-empty `subjectId` or a
 * `FedosDeliveryObservationState` literal under this file's own
 * conventions. Two calls with logically identical inputs ALWAYS produce
 * the identical id — no randomness, no clock read.
 */
export function makeFedosDeliveryObservationId(
  subjectId: FedosDeliveryObservationSubjectId,
  state: FedosDeliveryObservationState,
  observedAt: number,
): FedosDeliveryObservationId {
  return `${subjectId}::${state}::${observedAt}` as FedosDeliveryObservationId;
}

export interface FedosDeliveryObservation {
  readonly id: FedosDeliveryObservationId;
  readonly subjectId: FedosDeliveryObservationSubjectId;
  readonly state: FedosDeliveryObservationState;
  readonly observedAt: number;
  readonly reason?: string;
}

function isValidObservedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * The ONLY constructor of a `FedosDeliveryObservation`. Fails closed to
 * `null` for a malformed `subjectId`/`state`/`observedAt`/`reason` —
 * never throws. Result is `Object.freeze`d.
 */
export function createFedosDeliveryObservation(
  subjectId: FedosDeliveryObservationSubjectId,
  state: FedosDeliveryObservationState,
  observedAt: number,
  reason?: string,
): FedosDeliveryObservation | null {
  if (!isNonEmptyString(subjectId as unknown as string)) return null;
  if (!isFedosDeliveryObservationState(state)) return null;
  if (!isValidObservedAt(observedAt)) return null;
  if (reason !== undefined && !isNonEmptyString(reason)) return null;

  return Object.freeze(
    reason === undefined
      ? { id: makeFedosDeliveryObservationId(subjectId, state, observedAt), subjectId, state, observedAt }
      : { id: makeFedosDeliveryObservationId(subjectId, state, observedAt), subjectId, state, observedAt, reason },
  );
}
