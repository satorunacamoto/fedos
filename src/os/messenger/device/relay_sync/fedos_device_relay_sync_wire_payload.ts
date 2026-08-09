/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — the versioned Device Sync wire payload (Phase C).
 *
 * Carries ONLY safe routing/session facts plus the OPAQUE, already-real
 * `FedosDeviceTransferPackageV1` (`../transfer/fedos_device_transfer_package.ts`,
 * Alpha 3481–3560, UNMODIFIED) — this Arc adds NO new encryption, NO new
 * plaintext Sync record field, and NO secret material of any kind. The
 * Relay never sees anything beyond this payload's own routing facts and
 * one base64 string it cannot decrypt: `encryptedPackageBase64` is the
 * SAME bytes `serializeFedosDeviceTransferPackageToBytes()` already
 * produces (Alpha 3481–3560), never re-derived or re-shaped here.
 *
 * `packageContentHash` duplicates the value already bound inside the
 * Transfer Package's own Manifest — carried at the OUTER layer too so an
 * inbound handler (`../fedos_device_relay_sync_inbound_handler.ts`) can
 * cheaply detect a substituted/tampered payload BEFORE ever base64-decoding
 * or attempting to open the inner package, mirroring
 * `FedosDeviceTransferCoordinator`'s own "conflict" gate exactly.
 *
 * HARD GUARDRAILS:
 *   - No plaintext Sync record of any kind.
 *   - No private key, Master Seed, or Sender-Key secret field of any
 *     kind — every field here is either a public routing fact or opaque
 *     ciphertext bytes.
 *   - Pure, deterministic construction/parsing — no I/O, no signing (that
 *     happens one layer up, at the outer Nostr event, `fedos_device_relay_sync_event.ts`).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import {
  serializeFedosDeviceTransferPackageToBytes,
  deserializeFedosDeviceTransferPackageFromBytes,
  type FedosDeviceTransferPackageV1,
} from "../../../../device/transfer/fedos_device_transfer_package.js";

export const FEDOS_DEVICE_RELAY_SYNC_SCHEMA_VERSION = 1 as const;
/** The ONE route version this Arc freezes (Phase B) — a proprietary kind:1 + marker-tag route, NOT NIP-17. No silent fallback to any other route exists anywhere in this Arc. */
export const FEDOS_DEVICE_RELAY_SYNC_ROUTE_VERSION = 1 as const;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export interface FedosDeviceRelaySyncWirePayloadV1 {
  readonly schemaVersion: 1;
  readonly routeVersion: 1;
  readonly transferSessionId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly packageContentHash: string;
  /** The SAME bytes `serializeFedosDeviceTransferPackageToBytes()` produces, base64-encoded — opaque to the Relay, opaque to this file too (never parsed here). */
  readonly encryptedPackageBase64: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  /** The replay/delivery id this Arc's own dedup hierarchy uses as its innermost identity layer (`../persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts`). */
  readonly deliveryId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural + field-shape validation only — does NOT decrypt, does NOT check the LIVE Registry. Fails closed; never throws. */
export function isWellFormedFedosDeviceRelaySyncWirePayloadV1(candidate: unknown): candidate is FedosDeviceRelaySyncWirePayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 12) return false;
  if (value.schemaVersion !== FEDOS_DEVICE_RELAY_SYNC_SCHEMA_VERSION) return false;
  if (value.routeVersion !== FEDOS_DEVICE_RELAY_SYNC_ROUTE_VERSION) return false;
  if (!isNonEmptyString(value.transferSessionId) || !SESSION_ID_PATTERN.test(value.transferSessionId)) return false;
  if (!isNonEmptyString(value.sourceDeviceId) || !DEVICE_ID_PATTERN.test(value.sourceDeviceId)) return false;
  if (!isNonEmptyString(value.targetDeviceId) || !DEVICE_ID_PATTERN.test(value.targetDeviceId)) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (typeof value.packageContentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.packageContentHash)) return false;
  if (typeof value.encryptedPackageBase64 !== "string" || !BASE64_PATTERN.test(value.encryptedPackageBase64)) return false;
  if (!isValidUnixSeconds(value.createdAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.createdAt as number)) return false;
  if (!isNonEmptyString(value.deliveryId)) return false;
  return true;
}

export function isFedosDeviceRelaySyncWirePayloadExpired(payload: FedosDeviceRelaySyncWirePayloadV1, now: number): boolean {
  return now > payload.expiresAt;
}

/** sha256 hex over the SAME canonical JSON encoding `FedosDeviceTransferPackageV1` already uses for its own at-rest serialization — the outer-layer duplicate binding this file's own header describes. */
export function computeFedosDeviceRelaySyncPackageContentHash(transferPackage: FedosDeviceTransferPackageV1): string {
  return bytesToHex(sha256(serializeFedosDeviceTransferPackageToBytes(transferPackage)));
}

export interface FedosDeviceRelaySyncWirePayloadBuildInput {
  readonly transferPackage: FedosDeviceTransferPackageV1;
  readonly transferSessionId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly deliveryId: string;
}

export function buildFedosDeviceRelaySyncWirePayload(input: FedosDeviceRelaySyncWirePayloadBuildInput): FedosDeviceRelaySyncWirePayloadV1 {
  const encryptedPackageBase64 = Buffer.from(serializeFedosDeviceTransferPackageToBytes(input.transferPackage)).toString("base64");
  return Object.freeze({
    schemaVersion: FEDOS_DEVICE_RELAY_SYNC_SCHEMA_VERSION,
    routeVersion: FEDOS_DEVICE_RELAY_SYNC_ROUTE_VERSION,
    transferSessionId: input.transferSessionId,
    sourceDeviceId: input.sourceDeviceId,
    targetDeviceId: input.targetDeviceId,
    accountAuthority: input.accountAuthority,
    accountPublicIdentifier: input.accountPublicIdentifier,
    packageContentHash: computeFedosDeviceRelaySyncPackageContentHash(input.transferPackage),
    encryptedPackageBase64,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    deliveryId: input.deliveryId,
  });
}

/** `null` on ANY malformed base64/JSON/shape — fails closed, never throws. Does NOT decrypt or verify the inner package; only extracts it structurally (mirrors `deserializeFedosDeviceTransferPackageFromBytes()`'s own discipline one layer up). */
export function extractFedosDeviceTransferPackageFromWirePayload(payload: FedosDeviceRelaySyncWirePayloadV1): FedosDeviceTransferPackageV1 | null {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(payload.encryptedPackageBase64, "base64"));
  } catch {
    return null;
  }
  return deserializeFedosDeviceTransferPackageFromBytes(bytes);
}
