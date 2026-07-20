/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — Device Sync Observation (Phase L).
 *
 * Mirrors `../../board/observation/fedos_delivery_observation.ts`'s own
 * "immutable historical fact, deterministic id, subjectId opaque and
 * caller-branded" shape EXACTLY — but as a NEW, small, Device-Sync-scoped
 * type, not a reuse of `FedosDeliveryObservationState` in place. That
 * existing union (`"queued"|"publishing"|"accepted"|"rejected"|"failed"`)
 * is OUTBOUND-publish-shaped only and is a closed literal type this Arc
 * must not widen (`../../board/observation/fedos_delivery_observation.ts`
 * is unmodified, unowned by this Arc) — Phase L's own required vocabulary
 * additionally needs INBOUND-shaped facts (`"received"`, `"imported"`,
 * `"denied"`, `"expired"`) that union has no room for. Building a new,
 * parallel type here (rather than editing the existing one) is this
 * codebase's own already-twice-established discipline (Board Outbox →
 * Conversation Outbox, neither ever generalized) applied one more time.
 *
 * Never collapses Relay-accepted and Device-imported into one state
 * (Phase L's own explicit instruction) — `"relay-accepted"` and
 * `"imported"` are two separate, independently-recorded facts, and a
 * caller reading `listBySubject()` sees both, in order, never merged.
 *
 * HARD GUARDRAILS:
 *   - No universal Relay reputation score of any kind — this file records
 *     per-subject facts only, never an aggregate trust/reputation value
 *     for a Relay itself.
 *   - Every fact is `Object.freeze`d and immutable once recorded — no
 *     mutation method of any kind exists on any type in this file.
 */

export type FedosDeviceRelaySyncObservationState =
  | "queued"
  | "publishing"
  | "relay-accepted"
  | "relay-rejected"
  | "relay-failed"
  | "received"
  | "imported"
  | "denied"
  | "expired";

export const FEDOS_DEVICE_RELAY_SYNC_OBSERVATION_STATES: readonly FedosDeviceRelaySyncObservationState[] = [
  "queued",
  "publishing",
  "relay-accepted",
  "relay-rejected",
  "relay-failed",
  "received",
  "imported",
  "denied",
  "expired",
];

export interface FedosDeviceRelaySyncObservationV1 {
  readonly id: string;
  /** Opaque, caller-branded subject id — this file neither derives nor validates it against any other identifier scheme. Callers in this Arc brand it `${transferSessionId}::${relayUrlOrLocal}`. */
  readonly subjectId: string;
  readonly state: FedosDeviceRelaySyncObservationState;
  readonly observedAt: number;
  readonly reason: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function fedosDeviceRelaySyncObservationId(subjectId: string, state: FedosDeviceRelaySyncObservationState, observedAt: number): string {
  return `${subjectId}::${state}::${observedAt}`;
}

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosDeviceRelaySyncObservationV1(candidate: unknown): candidate is FedosDeviceRelaySyncObservationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.subjectId)) return false;
  if (!FEDOS_DEVICE_RELAY_SYNC_OBSERVATION_STATES.includes(value.state as FedosDeviceRelaySyncObservationState)) return false;
  if (!isValidUnixSeconds(value.observedAt)) return false;
  if (value.reason !== null && !isNonEmptyString(value.reason)) return false;
  return true;
}

export type FedosDeviceRelaySyncObservationWriteResult = "recorded" | "already-present" | "conflict" | "failed";

export interface FedosDeviceRelaySyncObservationRepository {
  record(subjectId: string, state: FedosDeviceRelaySyncObservationState, observedAt: number, reason?: string | null): FedosDeviceRelaySyncObservationWriteResult;
  get(id: string): FedosDeviceRelaySyncObservationV1 | null;
  list(): readonly FedosDeviceRelaySyncObservationV1[];
  listBySubject(subjectId: string): readonly FedosDeviceRelaySyncObservationV1[];
}

/** Read-only status query by Transfer Session (Phase L's own "expose a read-only status query by Transfer Session"). Brands every subject id this Arc ever writes as `${transferSessionId}::${suffix}` and returns every recorded fact for that session across ALL suffixes (local outbound/inbound + every configured Relay), oldest first. */
export function queryFedosDeviceRelaySyncStatusForSession(
  repository: FedosDeviceRelaySyncObservationRepository,
  transferSessionId: string,
): readonly FedosDeviceRelaySyncObservationV1[] {
  const prefix = `${transferSessionId}::`;
  return repository
    .list()
    .filter((fact) => fact.subjectId === transferSessionId || fact.subjectId.startsWith(prefix))
    .slice()
    .sort((a, b) => a.observedAt - b.observedAt);
}
