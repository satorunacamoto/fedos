/**
 * Secure Runtime Alpha 5961–6040 (FedOS Identity Transition Peer
 * Notification and Ratchet Reset Integration Arc) — Phase B: the strict
 * versioned private control payload carrying Identity Transition
 * evidence to one specific recipient account+Device.
 *
 * Structure mirrors `../../ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.ts`'s
 * own `SignableContent` + `Record` split EXACTLY: a fixed-order canonical
 * array tuple (own domain string first, so a signature over this content
 * can never be replayed as authenticating an advertisement, a lifecycle
 * notification, a Device Binding challenge, or a Session Reset), wrapped
 * by a real account-level signature
 * (`../../ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts`,
 * REUSED verbatim, not reimplemented) plus an optional best-effort
 * Device-level signature.
 *
 * Carries the REAL evidence artifacts from the Identity Transition
 * Foundation (`../fedos_identity_transition_new_key_proof.ts` etc.)
 * inline, bounded — Phase B's own "must carry or reference the real
 * transition evidence" requirement, satisfied by embedding rather than
 * merely pointing at local-only state the recipient could never fetch.
 *
 * HARD GUARDRAILS: no private key, no Master Seed, no passphrase, no
 * root/chain/message key, no skipped key, no local path, no arbitrary
 * executable command, no user message plaintext.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import type { FedosRatchetPeerCapabilityAccountAuthorizationV1 } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";
import { isWellFormedFedosIdentityTransitionId } from "../../../../../conversation/identity_transition/fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../../../../../conversation/identity_transition/fedos_identity_transition_id_limits.js";
import {
  isWellFormedFedosIdentityTransitionNewKeyProofV1,
  type FedosIdentityTransitionNewKeyProofV1,
} from "../../../../../conversation/identity_transition/fedos_identity_transition_new_key_proof.js";
import {
  isWellFormedFedosIdentityTransitionContinuityEvidenceV1,
  type FedosIdentityTransitionContinuityEvidenceV1,
} from "../../../../../conversation/identity_transition/fedos_identity_transition_continuity_evidence.js";
import {
  isWellFormedFedosIdentityTransitionDeviceCorroborationV1,
  type FedosIdentityTransitionDeviceCorroborationV1,
} from "../../../../../conversation/identity_transition/fedos_identity_transition_device_corroboration.js";
import {
  isKnownFedosIdentityTransitionReasonCategory,
  type FedosIdentityTransitionReasonCategory,
} from "../../../../../conversation/identity_transition/fedos_identity_transition_vocabulary.js";
import {
  createFedosIdentityTransitionRecordV1,
  isWellFormedFedosIdentityTransitionRecordV1,
  type FedosIdentityTransitionRecordV1,
} from "../../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import { fedosIdentityTransitionBodyHash } from "../../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";

/** Distinct from every other signed-content domain in this codebase (peer-capability advertisement/lifecycle-notification, Session Reset, Device Binding challenge). */
export const FEDOS_IDENTITY_TRANSITION_NOTIFICATION_DOMAIN = "fedos-identity-transition-notification-v1";
export const FEDOS_IDENTITY_TRANSITION_NOTIFICATION_DEVICE_SIGNATURE_PREFIX =
  "fedos-identity-transition-notification-device-v1:";

/** A concrete, enforced ceiling — Absolute Prohibitions: strict evidence-count limits ("oversized evidence list" is a named Phase P failure case). */
export const FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS = 4;

export interface FedosIdentityTransitionNotificationEvidenceV1 {
  readonly newKeyProof: FedosIdentityTransitionNewKeyProofV1;
  /** `null` whenever the sender has no continuity evidence to offer (e.g. `identity-lost`/`recovery-unavailable`). */
  readonly continuityEvidence: FedosIdentityTransitionContinuityEvidenceV1 | null;
  readonly deviceCorroborations: readonly FedosIdentityTransitionDeviceCorroborationV1[];
}

export interface FedosIdentityTransitionNotificationSignableContentV1 {
  readonly notificationId: string;
  readonly transitionId: string;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  /** Not in this Arc's own Phase B literal field list, but REQUIRED for correct receiver-side evidence evaluation: the Foundation's own evaluator's compromise-reason gating (Phase G/I) needs to know the reason category to decide whether old-key-only continuity is sufficient. Transmitting it here is the only way the recipient can apply that gating at all; omitting it would silently make every transition evaluate as if `user-initiated-replacement`, which is exactly the "old key vouches for new key under compromise" failure mode this whole domain exists to prevent. */
  readonly reasonCategory: FedosIdentityTransitionReasonCategory;
  readonly revision: number;
  /** Reference to the predecessor transition, if any — forms the same lineage chain the Foundation's durable facts validate. */
  readonly previousTransitionId: string | null;
  /** The transition body's own `bodyHash` (`../fedos_identity_transition_canonical.ts`) — lets the recipient verify every evidence artifact's binding without needing the full transition record. */
  readonly transitionBodyHash: string;
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly senderDeviceRef: string;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly evidence: FedosIdentityTransitionNotificationEvidenceV1;
}

export interface FedosIdentityTransitionNotificationV1 extends FedosIdentityTransitionNotificationSignableContentV1 {
  readonly schemaVersion: 1;
  readonly accountAuthorization: FedosRatchetPeerCapabilityAccountAuthorizationV1;
  /** OPTIONAL, best-effort — mirrors the peer-capability advertisement's own posture exactly. */
  readonly deviceSignatureHex: string | null;
  readonly capabilityVersion: 1;
}

function serializeNewKeyProof(proof: FedosIdentityTransitionNewKeyProofV1): unknown {
  return [proof.schemaVersion, proof.transitionId, proof.revision, proof.bodyHash, proof.newNostrIdentity, proof.issuedAt, proof.expiresAt, proof.signatureHex];
}

function serializeContinuityEvidence(evidence: FedosIdentityTransitionContinuityEvidenceV1): unknown {
  return [
    evidence.schemaVersion,
    evidence.transitionId,
    evidence.revision,
    evidence.bodyHash,
    evidence.oldNostrIdentity,
    evidence.newNostrIdentity,
    evidence.issuedAt,
    evidence.expiresAt,
    evidence.signatureHex,
  ];
}

function serializeDeviceCorroboration(corroboration: FedosIdentityTransitionDeviceCorroborationV1): unknown {
  return [
    corroboration.schemaVersion,
    corroboration.transitionId,
    corroboration.revision,
    corroboration.bodyHash,
    corroboration.newNostrIdentity,
    corroboration.deviceId,
    corroboration.devicePublicKeyHex,
    corroboration.issuedAt,
    corroboration.expiresAt,
    corroboration.signatureHex,
  ];
}

function serializeEvidence(evidence: FedosIdentityTransitionNotificationEvidenceV1): unknown {
  return [
    serializeNewKeyProof(evidence.newKeyProof),
    evidence.continuityEvidence === null ? null : serializeContinuityEvidence(evidence.continuityEvidence),
    evidence.deviceCorroborations.map(serializeDeviceCorroboration),
  ];
}

/** Fixed-order array tuple — mirrors the advertisement's own canonical technique exactly. */
export function canonicalSerializeFedosIdentityTransitionNotificationContent(
  content: FedosIdentityTransitionNotificationSignableContentV1,
): string {
  return JSON.stringify([
    FEDOS_IDENTITY_TRANSITION_NOTIFICATION_DOMAIN,
    content.notificationId,
    content.transitionId,
    content.oldAccountIdentity.authority,
    content.oldAccountIdentity.publicIdentifier,
    content.oldAccountIdentity.identityId,
    content.newAccountIdentity.authority,
    content.newAccountIdentity.publicIdentifier,
    content.newAccountIdentity.identityId,
    content.oldNostrIdentity,
    content.newNostrIdentity,
    content.reasonCategory,
    content.revision,
    content.previousTransitionId,
    content.transitionBodyHash,
    content.senderAccountRef.authority,
    content.senderAccountRef.publicIdentifier,
    content.senderAccountRef.identityId,
    content.senderDeviceRef,
    content.recipientAccountRef.authority,
    content.recipientAccountRef.publicIdentifier,
    content.recipientAccountRef.identityId,
    content.recipientDeviceRef,
    content.issuedAt,
    content.expiresAt,
    content.nonce,
    serializeEvidence(content.evidence),
  ]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedIdentifier(value: unknown): value is string {
  return isNonEmptyString(value) && (value as string).length <= FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) {
    return false;
  }
  const r = candidate as Record<string, unknown>;
  return isBoundedIdentifier(r.authority) && isBoundedIdentifier(r.publicIdentifier) && (r.identityId === null || isBoundedIdentifier(r.identityId));
}

function isNostrPublicKeyHex(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

const NONCE_PATTERN = /^[0-9a-f]{32}$/;

export function isWellFormedFedosIdentityTransitionNotificationNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE_PATTERN.test(value);
}

const EVIDENCE_FIELDS = new Set<string>(["newKeyProof", "continuityEvidence", "deviceCorroborations"]);

function isWellFormedEvidence(candidate: unknown): candidate is FedosIdentityTransitionNotificationEvidenceV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== EVIDENCE_FIELDS.size || !keys.every((k) => EVIDENCE_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (!isWellFormedFedosIdentityTransitionNewKeyProofV1(r.newKeyProof)) return false;
  if (r.continuityEvidence !== null && !isWellFormedFedosIdentityTransitionContinuityEvidenceV1(r.continuityEvidence)) return false;
  if (!Array.isArray(r.deviceCorroborations)) return false;
  if (r.deviceCorroborations.length > FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS) return false;
  if (!r.deviceCorroborations.every((c) => isWellFormedFedosIdentityTransitionDeviceCorroborationV1(c))) return false;
  return true;
}

const CONTENT_FIELDS = new Set<string>([
  "notificationId",
  "transitionId",
  "oldAccountIdentity",
  "newAccountIdentity",
  "oldNostrIdentity",
  "newNostrIdentity",
  "reasonCategory",
  "revision",
  "previousTransitionId",
  "transitionBodyHash",
  "senderAccountRef",
  "senderDeviceRef",
  "recipientAccountRef",
  "recipientDeviceRef",
  "issuedAt",
  "expiresAt",
  "nonce",
  "evidence",
]);

function isWellFormedContentFieldValues(r: Record<string, unknown>): boolean {
  if (!isBoundedIdentifier(r.notificationId)) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isWellFormedAccountRef(r.oldAccountIdentity)) return false;
  if (!isWellFormedAccountRef(r.newAccountIdentity)) return false;
  if (!isNostrPublicKeyHex(r.oldNostrIdentity)) return false;
  if (!isNostrPublicKeyHex(r.newNostrIdentity)) return false;
  if (!isKnownFedosIdentityTransitionReasonCategory(r.reasonCategory)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (r.previousTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.previousTransitionId)) return false;
  if ((r.revision === 0) !== (r.previousTransitionId === null)) return false;
  if (!isBoundedIdentifier(r.transitionBodyHash)) return false;
  if (!isWellFormedAccountRef(r.senderAccountRef)) return false;
  if (!isBoundedIdentifier(r.senderDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.recipientAccountRef)) return false;
  if (!isBoundedIdentifier(r.recipientDeviceRef)) return false;
  if (!Number.isInteger(r.issuedAt) || (r.issuedAt as number) < 0) return false;
  if (!Number.isInteger(r.expiresAt) || (r.expiresAt as number) <= (r.issuedAt as number)) return false;
  if (!isWellFormedFedosIdentityTransitionNotificationNonce(r.nonce)) return false;
  if (!isWellFormedEvidence(r.evidence)) return false;
  return true;
}

/** Structural validation of a STANDALONE signable-content object (exact key set for content alone). Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionNotificationSignableContent(
  candidate: unknown,
): candidate is FedosIdentityTransitionNotificationSignableContentV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== CONTENT_FIELDS.size || !keys.every((k) => CONTENT_FIELDS.has(k))) return false;
  return isWellFormedContentFieldValues(candidate as Record<string, unknown>);
}

const RECORD_FIELDS = new Set<string>([...CONTENT_FIELDS, "schemaVersion", "accountAuthorization", "deviceSignatureHex", "capabilityVersion"]);

function isWellFormedAccountAuthorization(candidate: unknown): candidate is FedosRatchetPeerCapabilityAccountAuthorizationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 1 || !keys.includes("event")) return false;
  const event = (candidate as Record<string, unknown>).event;
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    isNonEmptyString(e.id) &&
    isNonEmptyString(e.pubkey) &&
    typeof e.created_at === "number" &&
    typeof e.kind === "number" &&
    Array.isArray(e.tags) &&
    typeof e.content === "string" &&
    isNonEmptyString(e.sig)
  );
}

const DEVICE_SIGNATURE_HEX_PATTERN = /^[0-9a-f]+$/;

/** Structural validation only, exact field set. Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionNotificationV1(candidate: unknown): candidate is FedosIdentityTransitionNotificationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== RECORD_FIELDS.size || !keys.every((k) => RECORD_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedContentFieldValues(r)) return false;
  if (!isWellFormedAccountAuthorization(r.accountAuthorization)) return false;
  if (r.deviceSignatureHex !== null && (!isNonEmptyString(r.deviceSignatureHex) || !DEVICE_SIGNATURE_HEX_PATTERN.test(r.deviceSignatureHex))) {
    return false;
  }
  if (r.capabilityVersion !== 1) return false;
  return true;
}

export function encodeFedosIdentityTransitionNotificationV1(record: FedosIdentityTransitionNotificationV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosIdentityTransitionNotificationV1(line: string): FedosIdentityTransitionNotificationV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionNotificationV1(parsed) ? parsed : null;
}

/**
 * Reconstructs a `FedosIdentityTransitionRecordV1`-shaped body from a
 * notification's OWN declared fields, so the receiver can run the
 * Foundation's own `verifyFedosIdentityTransitionNewKeyProof()`/
 * `verifyFedosIdentityTransitionContinuityEvidence()` without needing any
 * out-of-band copy of the sender's transition record. `devicePolicy`/
 * `ratchetPolicy`/`capabilityVersion` are fixed constants in the
 * Foundation (only one supported value each), so reconstructing them is
 * safe. Returns `null` (fail closed) if the reconstructed body's own
 * `bodyHash` does NOT match the notification's declared
 * `transitionBodyHash` — a mismatch means the notification is internally
 * inconsistent (tampered or malformed) and must never be evaluated.
 */
export function reconstructFedosIdentityTransitionRecordFromNotification(
  notification: FedosIdentityTransitionNotificationSignableContentV1,
): FedosIdentityTransitionRecordV1 | null {
  const record = createFedosIdentityTransitionRecordV1({
    transitionId: notification.transitionId,
    transitionType: "identity-replacement",
    oldAccountIdentity: notification.oldAccountIdentity,
    newAccountIdentity: notification.newAccountIdentity,
    oldNostrIdentity: notification.oldNostrIdentity,
    newNostrIdentity: notification.newNostrIdentity,
    reasonCategory: notification.reasonCategory,
    issuedAt: notification.issuedAt,
    expiresAt: notification.expiresAt,
    revision: notification.revision,
    previousTransitionId: notification.previousTransitionId,
  });
  if (!isWellFormedFedosIdentityTransitionRecordV1(record)) return null;
  if (fedosIdentityTransitionBodyHash(record) !== notification.transitionBodyHash) return null;
  return record;
}
