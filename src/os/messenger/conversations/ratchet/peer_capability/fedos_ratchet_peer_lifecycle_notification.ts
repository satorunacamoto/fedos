/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase D: closed authenticated Device
 * lifecycle notification types.
 *
 * Only the lifecycle facts Phase A confirmed are actually supported by
 * real source are implemented:
 *   - `"device-added"` / `"device-revoked"` — real, terminal Device Trust
 *     states (`fedos_device_binding.ts`).
 *   - `"device-replaced"` — the real register-then-revoke
 *     `FedosDeviceReplacementCoordinator` flow; carries the replacement's
 *     own `newDeviceRef` (a brand-new Device identity, never inherited).
 *   - `"ratchet-session-reset-required"` — an ADVISORY fact only, distinct
 *     from the Foundation Arc's own authenticated reset mechanism (the
 *     `session-init` NIP-17 payload's `resetReason`/`resetNonce` fields,
 *     which already carries a REAL reset). This notification never
 *     itself resets anything; it is evidence a local policy MAY act on
 *     by separately, explicitly invoking the existing, unchanged
 *     `resetDirectRatchetSession()`/`initializeDirectRatchetSession()`
 *     facade (Phase L). Its optional `reason` reuses the EXISTING closed
 *     `FedosDirectRatchetSessionResetReason` vocabulary verbatim rather
 *     than inventing a second one.
 *   - `"ratchet-session-generation-advanced"` — evidence the peer's own
 *     generation counter moved, reusing the existing `generation: number`
 *     concept from `fedos_direct_ratchet_session_id.ts` verbatim.
 *   - `"capability-superseded"` — evidence a peer's own prior
 *     Advertisement revision is no longer current.
 *
 * Deliberately NOT implemented: `"device-key-updated"` — Phase A found no
 * in-place Device key-rotation primitive anywhere in this codebase (only
 * register-then-revoke replacement exists); fabricating a fifth fact for
 * an unsupported operation would violate this Arc's own "Fail Closed over
 * fabrication" mandate. Key rotation is representable ONLY via
 * `"device-replaced"`.
 *
 * Schema/codec shape mirrors `./fedos_ratchet_peer_capability_advertisement.ts`
 * exactly (fixed-order canonical serialization, exact-field-set
 * structural validation, total/never-throwing decode) with its OWN,
 * distinct domain string so a signature over one record type can never
 * be replayed as authenticating the other.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSessionResetReason } from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_reason.js";
import { isWellFormedFedosRatchetPeerCapabilityNonce } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.js";
import type { FedosRatchetPeerCapabilityAccountAuthorizationV1 } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";

export const FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DOMAIN = "fedos-ratchet-peer-lifecycle-notification-v1";
export const FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DEVICE_SIGNATURE_PREFIX =
  "fedos-ratchet-peer-lifecycle-notification-device-v1:";

const KNOWN_RESET_REASONS: readonly FedosDirectRatchetSessionResetReason[] = [
  "missing-sealed-state",
  "corrupt-sealed-state",
  "excessive-skipped-key-gap",
  "suspected-compromise",
];

export type FedosRatchetPeerLifecycleFact =
  | { readonly kind: "device-added" }
  | { readonly kind: "device-revoked" }
  | { readonly kind: "device-replaced"; readonly newDeviceRef: string }
  | { readonly kind: "ratchet-session-reset-required"; readonly reason: FedosDirectRatchetSessionResetReason | null }
  | { readonly kind: "ratchet-session-generation-advanced"; readonly newGeneration: number }
  | { readonly kind: "capability-superseded"; readonly supersededRevision: number };

const MAX_ID_FIELD_LENGTH = 512;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSafeIdField(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= MAX_ID_FIELD_LENGTH;
}

const FACT_FIELDS_BY_KIND: Readonly<Record<FedosRatchetPeerLifecycleFact["kind"], ReadonlySet<string>>> = Object.freeze({
  "device-added": new Set(["kind"]),
  "device-revoked": new Set(["kind"]),
  "device-replaced": new Set(["kind", "newDeviceRef"]),
  "ratchet-session-reset-required": new Set(["kind", "reason"]),
  "ratchet-session-generation-advanced": new Set(["kind", "newGeneration"]),
  "capability-superseded": new Set(["kind", "supersededRevision"]),
});

/** Structural validation only, exact field set per kind. Fails closed; never throws. */
export function isWellFormedFedosRatchetPeerLifecycleFact(candidate: unknown): candidate is FedosRatchetPeerLifecycleFact {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (typeof r.kind !== "string") return false;
  const fields = FACT_FIELDS_BY_KIND[r.kind as FedosRatchetPeerLifecycleFact["kind"]];
  if (fields === undefined) return false;
  const keys = Object.keys(r);
  if (keys.length !== fields.size || !keys.every((k) => fields.has(k))) return false;
  switch (r.kind) {
    case "device-added":
    case "device-revoked":
      return true;
    case "device-replaced":
      return isSafeIdField(r.newDeviceRef);
    case "ratchet-session-reset-required":
      return r.reason === null || (typeof r.reason === "string" && KNOWN_RESET_REASONS.includes(r.reason as FedosDirectRatchetSessionResetReason));
    case "ratchet-session-generation-advanced":
      return Number.isInteger(r.newGeneration) && (r.newGeneration as number) >= 0;
    case "capability-superseded":
      return Number.isInteger(r.supersededRevision) && (r.supersededRevision as number) >= 0;
    default:
      return false;
  }
}

export interface FedosRatchetPeerLifecycleNotificationSignableContentV1 {
  /** A stable, caller-chosen logical id — reused verbatim as the Outbox `controlId` (Phase G) so exact-event retry never mints a second logical notification for the same fact. */
  readonly notificationId: string;
  readonly issuerAccountRef: FedosDeviceBindingAccountRef;
  readonly issuerDeviceRef: string;
  readonly targetAccountRef: FedosDeviceBindingAccountRef;
  readonly targetDeviceRef: string;
  /** The Device the fact is ABOUT — may differ from `issuerDeviceRef` (e.g. Alice's desktop announces Alice's tablet was added). */
  readonly affectedDeviceRef: string;
  readonly fact: FedosRatchetPeerLifecycleFact;
  readonly revision: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly supersedesNotificationId: string | null;
}

export interface FedosRatchetPeerLifecycleNotificationV1 extends FedosRatchetPeerLifecycleNotificationSignableContentV1 {
  readonly schemaVersion: 1;
  readonly accountAuthorization: FedosRatchetPeerCapabilityAccountAuthorizationV1;
  readonly deviceSignatureHex: string | null;
}

function serializeFact(fact: FedosRatchetPeerLifecycleFact): readonly unknown[] {
  switch (fact.kind) {
    case "device-added":
    case "device-revoked":
      return [fact.kind];
    case "device-replaced":
      return [fact.kind, fact.newDeviceRef];
    case "ratchet-session-reset-required":
      return [fact.kind, fact.reason];
    case "ratchet-session-generation-advanced":
      return [fact.kind, fact.newGeneration];
    case "capability-superseded":
      return [fact.kind, fact.supersededRevision];
  }
}

/** Fixed-order array tuple — see this file's own header. */
export function canonicalSerializeFedosRatchetPeerLifecycleNotificationContent(
  content: FedosRatchetPeerLifecycleNotificationSignableContentV1,
): string {
  return JSON.stringify([
    FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DOMAIN,
    content.notificationId,
    content.issuerAccountRef.authority,
    content.issuerAccountRef.publicIdentifier,
    content.issuerAccountRef.identityId,
    content.issuerDeviceRef,
    content.targetAccountRef.authority,
    content.targetAccountRef.publicIdentifier,
    content.targetAccountRef.identityId,
    content.targetDeviceRef,
    content.affectedDeviceRef,
    serializeFact(content.fact),
    content.revision,
    content.issuedAt,
    content.expiresAt,
    content.nonce,
    content.supersedesNotificationId,
  ]);
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

const CONTENT_FIELDS = new Set<string>([
  "notificationId",
  "issuerAccountRef",
  "issuerDeviceRef",
  "targetAccountRef",
  "targetDeviceRef",
  "affectedDeviceRef",
  "fact",
  "revision",
  "issuedAt",
  "expiresAt",
  "nonce",
  "supersedesNotificationId",
]);

function isWellFormedContentFieldValues(r: Record<string, unknown>): boolean {
  if (!isSafeIdField(r.notificationId)) return false;
  if (!isWellFormedAccountRef(r.issuerAccountRef)) return false;
  if (!isSafeIdField(r.issuerDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.targetAccountRef)) return false;
  if (!isSafeIdField(r.targetDeviceRef)) return false;
  if (!isSafeIdField(r.affectedDeviceRef)) return false;
  if (!isWellFormedFedosRatchetPeerLifecycleFact(r.fact)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt) || r.expiresAt <= r.issuedAt) return false;
  if (!isWellFormedFedosRatchetPeerCapabilityNonce(r.nonce)) return false;
  if (r.supersedesNotificationId !== null && !isSafeIdField(r.supersedesNotificationId)) return false;
  return true;
}

/** Structural validation of a STANDALONE signable-content object. Fails closed; never throws. */
export function isWellFormedFedosRatchetPeerLifecycleNotificationSignableContent(
  candidate: unknown,
): candidate is FedosRatchetPeerLifecycleNotificationSignableContentV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== CONTENT_FIELDS.size || !keys.every((k) => CONTENT_FIELDS.has(k))) return false;
  return isWellFormedContentFieldValues(candidate as Record<string, unknown>);
}

const RECORD_FIELDS = new Set<string>([...CONTENT_FIELDS, "schemaVersion", "accountAuthorization", "deviceSignatureHex"]);

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
export function isWellFormedFedosRatchetPeerLifecycleNotificationV1(
  candidate: unknown,
): candidate is FedosRatchetPeerLifecycleNotificationV1 {
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
  return true;
}

export function encodeFedosRatchetPeerLifecycleNotificationV1(record: FedosRatchetPeerLifecycleNotificationV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosRatchetPeerLifecycleNotificationV1(line: string): FedosRatchetPeerLifecycleNotificationV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosRatchetPeerLifecycleNotificationV1(parsed) ? parsed : null;
}
