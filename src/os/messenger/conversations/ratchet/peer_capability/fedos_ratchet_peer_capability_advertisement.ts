/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase C: the peer capability
 * advertisement record.
 *
 * Bound to sender/recipient account+Device identity, a Direct
 * Conversation, a schema version, a monotonic `revision`, `issuedAt`/
 * `expiresAt`, a replay nonce, and a real account-level signature (Phase
 * E) plus an optional, best-effort Device-level signature — exactly the
 * Phase C field list, no more. It carries NO private keys, NO root/
 * chain/message keys, NO sealed-record references, NO local paths, NO
 * Runtime handles, and its own `capabilities` array is bounded
 * (`FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES`).
 *
 * Canonical serialization (`canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent()`)
 * is a fixed-order array tuple, mirroring
 * `../fedos_direct_ratchet_session_reset_authentication.ts`'s own
 * technique exactly — no object-key-ordering ambiguity, deterministic
 * across any two conforming implementations. Its first element is a
 * fixed domain string distinct from every other signed-content shape in
 * this codebase (the Session Reset preimage, the Device Binding
 * challenge, and this Arc's own Lifecycle Notification content below),
 * so a signature over one can never be replayed as authenticating
 * another.
 *
 * Structural validation is exact-field-set and total/never-throwing,
 * matching every other codec Phase A inventoried
 * (`isWellFormedFedosDirectRatchetSessionResetRecordV1`,
 * `isWellFormedFedosDirectRatchetNip17Payload`). Unknown fields fail
 * closed.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import {
  FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES,
  FEDOS_RATCHET_PEER_CAPABILITY_SCHEMA_VERSION,
  isWellFormedFedosRatchetPeerCapabilityEntry,
  type FedosRatchetPeerCapabilityEntry,
} from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import { isWellFormedFedosRatchetPeerCapabilityNonce } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.js";
import type { FedosRatchetPeerCapabilityAccountAuthorizationV1 } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";

/** Distinct from every other signed-content domain in this codebase — see this file's own header. */
export const FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DOMAIN = "fedos-ratchet-peer-capability-advertisement-v1";

/** Distinct from the account-authorization domain string, for the OPTIONAL Device-level signature over the same content. */
export const FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX =
  "fedos-ratchet-peer-capability-advertisement-device-v1:";

export interface FedosRatchetPeerCapabilityAdvertisementSignableContentV1 {
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly senderDeviceRef: string;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: string;
  readonly revision: number;
  readonly capabilities: readonly FedosRatchetPeerCapabilityEntry[];
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export interface FedosRatchetPeerCapabilityAdvertisementV1 extends FedosRatchetPeerCapabilityAdvertisementSignableContentV1 {
  readonly schemaVersion: 1;
  readonly accountAuthorization: FedosRatchetPeerCapabilityAccountAuthorizationV1;
  /** OPTIONAL, best-effort — see Phase E. `null` whenever no Device signing keypair was supplied or no `devicePublicKeyRef` is on file. */
  readonly deviceSignatureHex: string | null;
}

function serializeEntry(entry: FedosRatchetPeerCapabilityEntry): readonly [string, string] {
  switch (entry.kind) {
    case "private-message-route":
      return [entry.kind, entry.route];
    case "ratchet-suite":
      return [entry.kind, entry.suite];
    case "lifecycle-capability":
      return [entry.kind, entry.capability];
  }
}

/** Fixed-order array tuple — see this file's own header. */
export function canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(
  content: FedosRatchetPeerCapabilityAdvertisementSignableContentV1,
): string {
  return JSON.stringify([
    FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DOMAIN,
    content.senderAccountRef.authority,
    content.senderAccountRef.publicIdentifier,
    content.senderAccountRef.identityId,
    content.senderDeviceRef,
    content.recipientAccountRef.authority,
    content.recipientAccountRef.publicIdentifier,
    content.recipientAccountRef.identityId,
    content.recipientDeviceRef,
    content.conversationId,
    content.revision,
    content.capabilities.map(serializeEntry),
    content.issuedAt,
    content.expiresAt,
    content.nonce,
  ]);
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

const MAX_ID_FIELD_LENGTH = 512;

function isSafeIdField(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= MAX_ID_FIELD_LENGTH;
}

const CONTENT_FIELDS = new Set<string>([
  "senderAccountRef",
  "senderDeviceRef",
  "recipientAccountRef",
  "recipientDeviceRef",
  "conversationId",
  "revision",
  "capabilities",
  "issuedAt",
  "expiresAt",
  "nonce",
]);

/** Validates only the VALUES of the content-shaped fields on `r` — the caller is responsible for the exact key-set check appropriate to its own shape (a bare content object vs. a full record carrying additional envelope fields). */
function isWellFormedContentFieldValues(r: Record<string, unknown>): boolean {
  if (!isWellFormedAccountRef(r.senderAccountRef)) return false;
  if (!isSafeIdField(r.senderDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.recipientAccountRef)) return false;
  if (!isSafeIdField(r.recipientDeviceRef)) return false;
  if (!isSafeIdField(r.conversationId)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!Array.isArray(r.capabilities)) return false;
  if (r.capabilities.length > FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES) return false;
  if (!r.capabilities.every((e) => isWellFormedFedosRatchetPeerCapabilityEntry(e))) return false;
  if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt) || r.expiresAt <= r.issuedAt) return false;
  if (!isWellFormedFedosRatchetPeerCapabilityNonce(r.nonce)) return false;
  return true;
}

/** Structural validation of a STANDALONE signable-content object (exact key set for content alone). Fails closed; never throws. */
export function isWellFormedFedosRatchetPeerCapabilityAdvertisementSignableContent(
  candidate: unknown,
): candidate is FedosRatchetPeerCapabilityAdvertisementSignableContentV1 {
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
export function isWellFormedFedosRatchetPeerCapabilityAdvertisementV1(
  candidate: unknown,
): candidate is FedosRatchetPeerCapabilityAdvertisementV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== RECORD_FIELDS.size || !keys.every((k) => RECORD_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_RATCHET_PEER_CAPABILITY_SCHEMA_VERSION) return false;
  if (!isWellFormedContentFieldValues(r)) return false;
  if (!isWellFormedAccountAuthorization(r.accountAuthorization)) return false;
  if (r.deviceSignatureHex !== null && (!isNonEmptyString(r.deviceSignatureHex) || !DEVICE_SIGNATURE_HEX_PATTERN.test(r.deviceSignatureHex))) {
    return false;
  }
  return true;
}

export function encodeFedosRatchetPeerCapabilityAdvertisementV1(record: FedosRatchetPeerCapabilityAdvertisementV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosRatchetPeerCapabilityAdvertisementV1(line: string): FedosRatchetPeerCapabilityAdvertisementV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosRatchetPeerCapabilityAdvertisementV1(parsed) ? parsed : null;
}
