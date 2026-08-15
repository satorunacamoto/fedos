/**
 * FedOS Peer Device Discovery Arc — the peer device announcement record.
 * Frozen contract:
 * `docs/reviews/fedos-peer-device-discovery-current/06_PROTOCOL_CONTRACT_FREEZE.md`.
 *
 * A signed object, published by an account, that says "here is a device I
 * control, with this public key" — discoverable and independently
 * verifiable by ANY other account that already shares a Direct Conversation
 * with the announcing account (bilateral addressing preserved, mandate
 * privacy bound). Deliberately NOT a reuse of
 * `FedosRatchetPeerCapabilityAdvertisementV1` (that type's mandatory
 * short expiry and recipient/conversation-bound acceptance model are wrong
 * for a durable, cross-account identity fact — see
 * `docs/reviews/fedos-peer-device-discovery-current/02_TRANSPORT_DISCOVERY_OPTIONS.md`
 * §2). No `conversationId` field: device identity is not a
 * conversation-scoped fact (see `06`'s own §10).
 *
 * Canonical serialization mirrors
 * `fedos_ratchet_peer_capability_advertisement.ts`'s own fixed-order array
 * tuple technique — no object-key-ordering ambiguity, and a distinct first
 * element (its own domain string) so a signature over this content can
 * never be replayed as authenticating any other signed shape in this
 * codebase.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import {
  FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES,
  isWellFormedFedosRatchetPeerCapabilityEntry,
  type FedosRatchetPeerCapabilityEntry,
} from "../ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import { isWellFormedFedosPeerDeviceAnnouncementNonce } from "./fedos_peer_device_announcement_nonce.js";
import type { FedosPeerDeviceAnnouncementAccountAuthorizationV1 } from "./fedos_peer_device_announcement_authentication.js";

/** Distinct from every other signed-content domain in this codebase. */
export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_DOMAIN = "fedos-peer-device-announcement-v1";

/** Distinct from the account-authorization domain, for the OPTIONAL device-level signature over the same content. */
export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_SIGNATURE_PREFIX = "fedos-peer-device-announcement-device-v1:";

export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_SCHEMA_VERSION = 1 as const;

const DEVICE_ID_HEX_PATTERN = /^[0-9a-f]{32}$/;
const DEVICE_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosPeerDeviceAnnouncementSignableContentV1 {
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  readonly capabilities: readonly FedosRatchetPeerCapabilityEntry[];
  readonly epoch: number;
  readonly supersedesAnnouncementId: string | null;
  readonly issuedAt: number;
  readonly nonce: string;
}

export interface FedosPeerDeviceAnnouncementV1 extends FedosPeerDeviceAnnouncementSignableContentV1 {
  readonly schemaVersion: 1;
  readonly accountAuthorization: FedosPeerDeviceAnnouncementAccountAuthorizationV1;
  /** OPTIONAL, best-effort — see `06` §3's corrected decision. `null` whenever no local device signing keypair was supplied for this call. */
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
export function canonicalSerializeFedosPeerDeviceAnnouncementContent(content: FedosPeerDeviceAnnouncementSignableContentV1): string {
  return JSON.stringify([
    FEDOS_PEER_DEVICE_ANNOUNCEMENT_DOMAIN,
    content.senderAccountRef.authority,
    content.senderAccountRef.publicIdentifier,
    content.senderAccountRef.identityId,
    content.recipientAccountRef.authority,
    content.recipientAccountRef.publicIdentifier,
    content.recipientAccountRef.identityId,
    content.deviceId,
    content.devicePublicKeyHex,
    content.capabilities.map(serializeEntry),
    content.epoch,
    content.supersedesAnnouncementId,
    content.issuedAt,
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

const CONTENT_FIELDS = new Set<string>([
  "senderAccountRef",
  "recipientAccountRef",
  "deviceId",
  "devicePublicKeyHex",
  "capabilities",
  "epoch",
  "supersedesAnnouncementId",
  "issuedAt",
  "nonce",
]);

/** Validates only the VALUES of the content-shaped fields — mirrors `fedos_ratchet_peer_capability_advertisement.ts`'s own split between content-value validation and exact-key-set validation. */
function isWellFormedContentFieldValues(r: Record<string, unknown>): boolean {
  if (!isWellFormedAccountRef(r.senderAccountRef)) return false;
  if (!isWellFormedAccountRef(r.recipientAccountRef)) return false;
  if (typeof r.deviceId !== "string" || !DEVICE_ID_HEX_PATTERN.test(r.deviceId)) return false;
  if (typeof r.devicePublicKeyHex !== "string" || !DEVICE_PUBLIC_KEY_HEX_PATTERN.test(r.devicePublicKeyHex)) return false;
  if (!Array.isArray(r.capabilities)) return false;
  if (r.capabilities.length > FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES) return false;
  if (!r.capabilities.every((e) => isWellFormedFedosRatchetPeerCapabilityEntry(e))) return false;
  if (!Number.isInteger(r.epoch) || (r.epoch as number) < 0) return false;
  if (r.supersedesAnnouncementId !== null && !isNonEmptyString(r.supersedesAnnouncementId)) return false;
  if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt)) return false;
  if (!isWellFormedFedosPeerDeviceAnnouncementNonce(r.nonce)) return false;
  return true;
}

/** Structural validation of a STANDALONE signable-content object. Fails closed; never throws. */
export function isWellFormedFedosPeerDeviceAnnouncementSignableContent(candidate: unknown): candidate is FedosPeerDeviceAnnouncementSignableContentV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== CONTENT_FIELDS.size || !keys.every((k) => CONTENT_FIELDS.has(k))) return false;
  return isWellFormedContentFieldValues(candidate as Record<string, unknown>);
}

const RECORD_FIELDS = new Set<string>([...CONTENT_FIELDS, "schemaVersion", "accountAuthorization", "deviceSignatureHex"]);

function isWellFormedAccountAuthorization(candidate: unknown): candidate is FedosPeerDeviceAnnouncementAccountAuthorizationV1 {
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
export function isWellFormedFedosPeerDeviceAnnouncementV1(candidate: unknown): candidate is FedosPeerDeviceAnnouncementV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== RECORD_FIELDS.size || !keys.every((k) => RECORD_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_PEER_DEVICE_ANNOUNCEMENT_SCHEMA_VERSION) return false;
  if (!isWellFormedContentFieldValues(r)) return false;
  if (!isWellFormedAccountAuthorization(r.accountAuthorization)) return false;
  if (r.deviceSignatureHex !== null && (!isNonEmptyString(r.deviceSignatureHex) || !DEVICE_SIGNATURE_HEX_PATTERN.test(r.deviceSignatureHex))) {
    return false;
  }
  return true;
}

export function encodeFedosPeerDeviceAnnouncementV1(record: FedosPeerDeviceAnnouncementV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosPeerDeviceAnnouncementV1(line: string): FedosPeerDeviceAnnouncementV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosPeerDeviceAnnouncementV1(parsed) ? parsed : null;
}
