/**
 * FedOS Peer Device Discovery Arc — the durable peer-device-announcement
 * observation record. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts`'s
 * own "keyed fact, insert-only, no delete" discipline and its own
 * multi-device isolation requirement (`localDeviceRef` is part of the
 * record's own identity).
 *
 * Append-only; "current vs superseded" is NEVER a stored flag, always
 * derived at read time from the full fact set for a
 * `(localDeviceRef, peerAccountRef, deviceId)` key — mirrors
 * `identity_transition`'s `isFedosIdentityTransitionFactSuperseded()`
 * pattern (see `06_PROTOCOL_CONTRACT_FREEZE.md` §6).
 *
 * Records ONLY safe, non-secret facts. NO raw payload plaintext beyond
 * these fields, no signatures, no keys.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import {
  FEDOS_PEER_DEVICE_ANNOUNCEMENT_KNOWN_ACCEPTANCE_OUTCOMES,
  type FedosPeerDeviceAnnouncementAcceptanceOutcome,
} from "./fedos_peer_device_announcement_acceptance_outcome.js";
import type { FedosPeerDeviceAnnouncementEvidenceLevel } from "./fedos_peer_device_announcement_authentication.js";
import { FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES, isKnownFedosRatchetPeerCapabilityRoute, type FedosRatchetPeerCapabilityRoute } from "../ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";

export interface FedosPeerDeviceAnnouncementObservationV1 {
  readonly schemaVersion: 1;
  /** Which LOCAL device recorded this — multi-device isolation, mirrors peer_capability. */
  readonly localDeviceRef: string;
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  /** The announcement's own `nonce` — this record's own uniqueness key alongside the three identity fields above. */
  readonly sourceId: string;
  readonly epoch: number;
  readonly evidenceLevel: FedosPeerDeviceAnnouncementEvidenceLevel;
  readonly acceptanceOutcome: FedosPeerDeviceAnnouncementAcceptanceOutcome;
  readonly supersedesAnnouncementId: string | null;
  readonly observedAt: number;
  /** The route entries this fact claimed — non-secret; needed so a Registry write can pick the strongest observed device without re-importing the raw announcement. */
  readonly claimedRoutes: readonly FedosRatchetPeerCapabilityRoute[];
}

/** Deterministic, order-stable key — one row per (local device, peer account, device id, source id). */
export function fedosPeerDeviceAnnouncementObservationKey(record: FedosPeerDeviceAnnouncementObservationV1): string {
  return JSON.stringify([
    record.localDeviceRef,
    record.peerAccountRef.authority,
    record.peerAccountRef.publicIdentifier,
    record.peerAccountRef.identityId,
    record.deviceId,
    record.sourceId,
  ]);
}

/** The subject a `listObservationsForPeerDevice()` query groups by — deliberately narrower than the full record key (omits `sourceId`). */
export function fedosPeerDeviceAnnouncementObservationSubjectKey(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): string {
  return JSON.stringify([localDeviceRef, peerAccountRef.authority, peerAccountRef.publicIdentifier, peerAccountRef.identityId, deviceId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Structural equality over every field — used to decide `"already-present"` (idempotent replay) vs `"conflict"` for a duplicate key. */
export function fedosPeerDeviceAnnouncementObservationsAreEqual(a: FedosPeerDeviceAnnouncementObservationV1, b: FedosPeerDeviceAnnouncementObservationV1): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    accountRefsEqual(a.peerAccountRef, b.peerAccountRef) &&
    a.deviceId === b.deviceId &&
    a.devicePublicKeyHex === b.devicePublicKeyHex &&
    a.sourceId === b.sourceId &&
    a.epoch === b.epoch &&
    a.evidenceLevel === b.evidenceLevel &&
    a.acceptanceOutcome === b.acceptanceOutcome &&
    a.supersedesAnnouncementId === b.supersedesAnnouncementId &&
    a.observedAt === b.observedAt &&
    a.claimedRoutes.length === b.claimedRoutes.length &&
    a.claimedRoutes.every((route, i) => route === b.claimedRoutes[i])
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

const DEVICE_ID_HEX_PATTERN = /^[0-9a-f]{32}$/;
const DEVICE_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "localDeviceRef",
  "peerAccountRef",
  "deviceId",
  "devicePublicKeyHex",
  "sourceId",
  "epoch",
  "evidenceLevel",
  "acceptanceOutcome",
  "supersedesAnnouncementId",
  "observedAt",
  "claimedRoutes",
]);

const KNOWN_EVIDENCE_LEVELS: readonly FedosPeerDeviceAnnouncementEvidenceLevel[] = [
  "account-authenticated",
  "account-and-device-authenticated",
  "account-authenticated-device-proof-unavailable",
];

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosPeerDeviceAnnouncementObservationV1(candidate: unknown): candidate is FedosPeerDeviceAnnouncementObservationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyString(r.localDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.peerAccountRef)) return false;
  if (typeof r.deviceId !== "string" || !DEVICE_ID_HEX_PATTERN.test(r.deviceId)) return false;
  if (typeof r.devicePublicKeyHex !== "string" || !DEVICE_PUBLIC_KEY_HEX_PATTERN.test(r.devicePublicKeyHex)) return false;
  if (!isNonEmptyString(r.sourceId)) return false;
  if (!Number.isInteger(r.epoch) || (r.epoch as number) < 0) return false;
  if (!KNOWN_EVIDENCE_LEVELS.includes(r.evidenceLevel as FedosPeerDeviceAnnouncementEvidenceLevel)) return false;
  if (!FEDOS_PEER_DEVICE_ANNOUNCEMENT_KNOWN_ACCEPTANCE_OUTCOMES.includes(r.acceptanceOutcome as FedosPeerDeviceAnnouncementAcceptanceOutcome)) return false;
  if (r.supersedesAnnouncementId !== null && !isNonEmptyString(r.supersedesAnnouncementId)) return false;
  if (typeof r.observedAt !== "number" || !Number.isFinite(r.observedAt)) return false;
  if (!Array.isArray(r.claimedRoutes) || r.claimedRoutes.length > FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES) return false;
  if (!r.claimedRoutes.every((route) => isKnownFedosRatchetPeerCapabilityRoute(route))) return false;
  return true;
}

export function encodeFedosPeerDeviceAnnouncementObservationV1(record: FedosPeerDeviceAnnouncementObservationV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosPeerDeviceAnnouncementObservationV1(line: string): FedosPeerDeviceAnnouncementObservationV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosPeerDeviceAnnouncementObservationV1(parsed) ? parsed : null;
}
