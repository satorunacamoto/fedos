/**
 * Secure Runtime Alpha 5961–6040 (FedOS Identity Transition Peer
 * Notification and Ratchet Reset Integration Arc) — Phase F: the durable
 * peer transition observation.
 *
 * A dedicated, NEW append-only domain — never a reuse of generic Device
 * Sync (Phase F's own "do not reuse generic Device Sync for this
 * evidence" requirement) and never merged into the Identity Transition
 * Foundation's own `FedosIdentityTransitionFactV1` (that type records
 * the LOCAL account's own authored transitions; this one records what a
 * REMOTE peer has told THIS local Device about a transition).
 *
 * Multi-Device isolation mirrors
 * `../../ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts`'s
 * own discipline exactly (Phase M: "one Device observation is not
 * account-wide acceptance"): keyed by `(localDeviceRef, peerAccountRef,
 * peerDeviceRef, transitionId)` — the SAME transition observed by two
 * different local Devices (Bob's desktop and Bob's tablet), or reported
 * by two different peer Devices (Alice's old desktop and Alice's old
 * tablet), never share a row.
 *
 * Records ONLY safe, non-secret facts — no raw evidence, no signatures,
 * no keys.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import { FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_OUTCOMES, type FedosIdentityTransitionEvidenceOutcome } from "../../../../../conversation/identity_transition/fedos_identity_transition_evidence_evaluation.js";
import { FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES, type FedosIdentityTransitionAcceptanceState } from "../../../../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";
import { isWellFormedFedosIdentityTransitionId } from "../../../../../conversation/identity_transition/fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../../../../../conversation/identity_transition/fedos_identity_transition_id_limits.js";

export type FedosIdentityTransitionPeerObservationConflictState = "none" | "conflicting" | "rollback-detected";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_PEER_OBSERVATION_CONFLICT_STATES: readonly FedosIdentityTransitionPeerObservationConflictState[] =
  Object.freeze(["none", "conflicting", "rollback-detected"]);

export interface FedosIdentityTransitionPeerObservationV1 {
  readonly schemaVersion: 1;
  readonly localDeviceRef: string;
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
  readonly transitionId: string;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  readonly revision: number;
  readonly previousTransitionId: string | null;
  readonly sourceNotificationId: string;
  readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly conflictState: FedosIdentityTransitionPeerObservationConflictState;
  readonly observedAt: number;
  readonly expiresAt: number;
  /** Always `null` on a stored observation — this domain never rewrites an already-inserted row; supersession is derived at read time, mirroring the Foundation's own `fedos_identity_transition_fact.ts`. */
  readonly supersededByTransitionId: string | null;
}

/** Row key — see this file's own header on multi-Device isolation. */
export function fedosIdentityTransitionPeerObservationKey(o: FedosIdentityTransitionPeerObservationV1): string {
  return JSON.stringify([o.localDeviceRef, o.peerAccountRef.authority, o.peerAccountRef.publicIdentifier, o.peerAccountRef.identityId, o.peerDeviceRef, o.transitionId]);
}

/** The lineage a LOCAL Device's own observation belongs to — one lineage per (localDeviceRef, oldAccountIdentity). Deliberately scoped to the OBSERVING Device, never shared account-wide, so "Bob Device B observes independently" (Phase M) holds structurally, not just by convention. */
export function fedosIdentityTransitionPeerObservationLineageKey(o: FedosIdentityTransitionPeerObservationV1): string {
  return fedosIdentityTransitionPeerObservationLineageKeyParts(o.localDeviceRef, o.oldAccountIdentity.authority, o.oldAccountIdentity.publicIdentifier, o.oldAccountIdentity.identityId);
}

export function fedosIdentityTransitionPeerObservationLineageKeyParts(
  localDeviceRef: string,
  oldAccountAuthority: string,
  oldAccountPublicIdentifier: string,
  oldAccountIdentityId: string | null,
): string {
  return JSON.stringify([localDeviceRef, oldAccountAuthority, oldAccountPublicIdentifier, oldAccountIdentityId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Structural equality over every field — decides `"already-present"` vs `"conflict"` for a duplicate key. */
export function fedosIdentityTransitionPeerObservationsAreEqual(
  a: FedosIdentityTransitionPeerObservationV1,
  b: FedosIdentityTransitionPeerObservationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    accountRefsEqual(a.peerAccountRef, b.peerAccountRef) &&
    a.peerDeviceRef === b.peerDeviceRef &&
    a.transitionId === b.transitionId &&
    accountRefsEqual(a.oldAccountIdentity, b.oldAccountIdentity) &&
    accountRefsEqual(a.newAccountIdentity, b.newAccountIdentity) &&
    a.oldNostrIdentity === b.oldNostrIdentity &&
    a.newNostrIdentity === b.newNostrIdentity &&
    a.revision === b.revision &&
    a.previousTransitionId === b.previousTransitionId &&
    a.sourceNotificationId === b.sourceNotificationId &&
    a.evidenceOutcome === b.evidenceOutcome &&
    a.acceptanceState === b.acceptanceState &&
    a.conflictState === b.conflictState &&
    a.observedAt === b.observedAt &&
    a.expiresAt === b.expiresAt &&
    a.supersededByTransitionId === b.supersededByTransitionId
  );
}

function isNonEmptyBoundedString(value: unknown, maxLength = FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) return false;
  const r = candidate as Record<string, unknown>;
  return isNonEmptyBoundedString(r.authority) && isNonEmptyBoundedString(r.publicIdentifier) && (r.identityId === null || isNonEmptyBoundedString(r.identityId));
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "localDeviceRef",
  "peerAccountRef",
  "peerDeviceRef",
  "transitionId",
  "oldAccountIdentity",
  "newAccountIdentity",
  "oldNostrIdentity",
  "newNostrIdentity",
  "revision",
  "previousTransitionId",
  "sourceNotificationId",
  "evidenceOutcome",
  "acceptanceState",
  "conflictState",
  "observedAt",
  "expiresAt",
  "supersededByTransitionId",
]);

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionPeerObservationV1(candidate: unknown): candidate is FedosIdentityTransitionPeerObservationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyBoundedString(r.localDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.peerAccountRef)) return false;
  if (!isNonEmptyBoundedString(r.peerDeviceRef)) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isWellFormedAccountRef(r.oldAccountIdentity)) return false;
  if (!isWellFormedAccountRef(r.newAccountIdentity)) return false;
  if (!isNonEmptyBoundedString(r.oldNostrIdentity, 64)) return false;
  if (!isNonEmptyBoundedString(r.newNostrIdentity, 64)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (r.previousTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.previousTransitionId)) return false;
  if ((r.revision === 0) !== (r.previousTransitionId === null)) return false;
  if (!isNonEmptyBoundedString(r.sourceNotificationId)) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_OUTCOMES as readonly string[]).includes(r.evidenceOutcome as string)) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES as readonly string[]).includes(r.acceptanceState as string)) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_PEER_OBSERVATION_CONFLICT_STATES as readonly string[]).includes(r.conflictState as string)) return false;
  if (typeof r.observedAt !== "number" || !Number.isFinite(r.observedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt)) return false;
  if (r.supersededByTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.supersededByTransitionId)) return false;
  return true;
}

export function encodeFedosIdentityTransitionPeerObservationV1(o: FedosIdentityTransitionPeerObservationV1): string {
  return JSON.stringify(o);
}

/** `null` (never throws) for invalid JSON or a structurally malformed observation — fail closed. */
export function decodeFedosIdentityTransitionPeerObservationV1(line: string): FedosIdentityTransitionPeerObservationV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionPeerObservationV1(parsed) ? parsed : null;
}
