/**
 * Secure Runtime Alpha 5721–5800 — Phase I: the durable peer-capability
 * observation record.
 *
 * Precedent-shaped (mirrors `../../../device/relay_sync/fedos_device_relay_sync_observation.ts`'s
 * `{id, subjectId, state, observedAt, reason}` convention and this same
 * Arc's own `fedos_direct_ratchet_session_reset_record.ts`'s "keyed fact,
 * insert-only, no delete" discipline), but genuinely new — Phase A
 * confirmed no existing type records a fact specifically about what a
 * REMOTE peer/Device has claimed/advertised about itself.
 *
 * Records ONLY safe, non-secret facts: peer account/Device, the fact's
 * own source kind/id/revision, the evidence level that authenticated it
 * (Phase E), the acceptance outcome the pure policy (Phase J) already
 * decided, an optional superseded-source reference, and observed/expiry
 * timestamps. NO raw payload plaintext beyond these fields, no
 * signatures, no keys.
 *
 * `localDeviceRef` is part of the record's own identity — Phase M's own
 * multi-device-isolation requirement means the SAME peer Device observed
 * by two different local Devices (e.g. Alice's desktop and Alice's
 * tablet, both talking to Bob) must never share a row.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import type { FedosRatchetPeerCapabilityEvidenceLevel } from "./fedos_ratchet_peer_capability_authentication.js";
import {
  FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ACCEPTANCE_OUTCOMES,
  type FedosRatchetPeerCapabilityAcceptanceOutcome,
} from "./fedos_ratchet_peer_capability_acceptance_outcome.js";
import {
  FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES,
  isKnownFedosRatchetPeerCapabilityRoute,
  type FedosRatchetPeerCapabilityRoute,
} from "./fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosRatchetPeerLifecycleFact } from "./fedos_ratchet_peer_lifecycle_notification.js";

const KNOWN_LIFECYCLE_FACT_KINDS: readonly FedosRatchetPeerLifecycleFact["kind"][] = [
  "device-added",
  "device-revoked",
  "device-replaced",
  "ratchet-session-reset-required",
  "ratchet-session-generation-advanced",
  "capability-superseded",
];

export type FedosRatchetPeerCapabilityObservationSourceKind = "advertisement" | "lifecycle-notification";

export const FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_OBSERVATION_SOURCE_KINDS: readonly FedosRatchetPeerCapabilityObservationSourceKind[] =
  Object.freeze(["advertisement", "lifecycle-notification"]);

export interface FedosRatchetPeerCapabilityObservationV1 {
  readonly schemaVersion: 1;
  /** Which LOCAL Device recorded this — see this file's own header on multi-device isolation. */
  readonly localDeviceRef: string;
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
  readonly sourceKind: FedosRatchetPeerCapabilityObservationSourceKind;
  /** The advertisement's `nonce` or the notification's `notificationId` — this record's own uniqueness key alongside the four identity fields above. */
  readonly sourceId: string;
  readonly revision: number;
  readonly evidenceLevel: FedosRatchetPeerCapabilityEvidenceLevel;
  readonly acceptanceOutcome: FedosRatchetPeerCapabilityAcceptanceOutcome;
  readonly supersededSourceId: string | null;
  readonly observedAt: number;
  readonly expiresAt: number;
  /** The route entries this fact claimed — empty for a lifecycle notification (which carries no capability list of its own). Non-secret; needed so downgrade detection (Phase K) survives a restart without re-importing the raw advertisement. Bounded by the same `FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES`. */
  readonly claimedRoutes: readonly FedosRatchetPeerCapabilityRoute[];
  /** `null` for an advertisement (which carries no lifecycle fact); the notification's own closed fact kind otherwise. Needed so `recommendFedosRatchetPeerSessionAction()` can be recomputed correctly from durable state alone — WITHOUT this, a restart/replay would lose which lifecycle fact a past acceptance was about, and every recommendation would silently degrade to the "no fact" case. */
  readonly factKind: FedosRatchetPeerLifecycleFact["kind"] | null;
}

/** Deterministic, order-stable key — one row per (local Device, peer account+Device, source kind, source id). */
export function fedosRatchetPeerCapabilityObservationKey(record: FedosRatchetPeerCapabilityObservationV1): string {
  return JSON.stringify([
    record.localDeviceRef,
    record.peerAccountRef.authority,
    record.peerAccountRef.publicIdentifier,
    record.peerAccountRef.identityId,
    record.peerDeviceRef,
    record.sourceKind,
    record.sourceId,
  ]);
}

/** The subject a `listObservationsForPeerDevice()` query groups by — deliberately narrower than the full record key (omits `sourceKind`/`sourceId`). */
export function fedosRatchetPeerCapabilityObservationSubjectKey(
  localDeviceRef: string,
  peerAccountRef: FedosDeviceBindingAccountRef,
  peerDeviceRef: string,
): string {
  return JSON.stringify([localDeviceRef, peerAccountRef.authority, peerAccountRef.publicIdentifier, peerAccountRef.identityId, peerDeviceRef]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Structural equality over every field — used to decide `"already-present"` (idempotent replay) vs `"conflict"` for a duplicate key. */
export function fedosRatchetPeerCapabilityObservationsAreEqual(
  a: FedosRatchetPeerCapabilityObservationV1,
  b: FedosRatchetPeerCapabilityObservationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    accountRefsEqual(a.peerAccountRef, b.peerAccountRef) &&
    a.peerDeviceRef === b.peerDeviceRef &&
    a.sourceKind === b.sourceKind &&
    a.sourceId === b.sourceId &&
    a.revision === b.revision &&
    a.evidenceLevel === b.evidenceLevel &&
    a.acceptanceOutcome === b.acceptanceOutcome &&
    a.supersededSourceId === b.supersededSourceId &&
    a.observedAt === b.observedAt &&
    a.expiresAt === b.expiresAt &&
    a.claimedRoutes.length === b.claimedRoutes.length &&
    a.claimedRoutes.every((route, i) => route === b.claimedRoutes[i]) &&
    a.factKind === b.factKind
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) {
    return false;
  }
  const r = candidate as Record<string, unknown>;
  return isNonEmptyString(r.authority) && isNonEmptyString(r.publicIdentifier) && (r.identityId === null || isNonEmptyString(r.identityId));
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "localDeviceRef",
  "peerAccountRef",
  "peerDeviceRef",
  "sourceKind",
  "sourceId",
  "revision",
  "evidenceLevel",
  "acceptanceOutcome",
  "supersededSourceId",
  "observedAt",
  "expiresAt",
  "claimedRoutes",
  "factKind",
]);

const KNOWN_EVIDENCE_LEVELS: readonly FedosRatchetPeerCapabilityEvidenceLevel[] = [
  "account-authenticated",
  "account-and-device-authenticated",
  "account-authenticated-device-proof-unavailable",
];

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosRatchetPeerCapabilityObservationV1(candidate: unknown): candidate is FedosRatchetPeerCapabilityObservationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyString(r.localDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.peerAccountRef)) return false;
  if (!isNonEmptyString(r.peerDeviceRef)) return false;
  if (!FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_OBSERVATION_SOURCE_KINDS.includes(r.sourceKind as FedosRatchetPeerCapabilityObservationSourceKind)) return false;
  if (!isNonEmptyString(r.sourceId)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!KNOWN_EVIDENCE_LEVELS.includes(r.evidenceLevel as FedosRatchetPeerCapabilityEvidenceLevel)) return false;
  if (!FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ACCEPTANCE_OUTCOMES.includes(r.acceptanceOutcome as FedosRatchetPeerCapabilityAcceptanceOutcome)) return false;
  if (r.supersededSourceId !== null && !isNonEmptyString(r.supersededSourceId)) return false;
  if (typeof r.observedAt !== "number" || !Number.isFinite(r.observedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt)) return false;
  if (!Array.isArray(r.claimedRoutes) || r.claimedRoutes.length > FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES) return false;
  if (!r.claimedRoutes.every((route) => isKnownFedosRatchetPeerCapabilityRoute(route))) return false;
  if (r.factKind !== null && !KNOWN_LIFECYCLE_FACT_KINDS.includes(r.factKind as FedosRatchetPeerLifecycleFact["kind"])) return false;
  return true;
}

export function encodeFedosRatchetPeerCapabilityObservationV1(record: FedosRatchetPeerCapabilityObservationV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosRatchetPeerCapabilityObservationV1(line: string): FedosRatchetPeerCapabilityObservationV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosRatchetPeerCapabilityObservationV1(parsed) ? parsed : null;
}
