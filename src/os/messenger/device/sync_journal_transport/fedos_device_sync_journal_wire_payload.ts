/**
 * Own-Device Sync Protocol Final Closure arc — the versioned Journal
 * Batch wire payload. Mirrors
 * `../relay_sync/fedos_device_relay_sync_wire_payload.ts` exactly: carries
 * only safe routing facts plus the OPAQUE, already-sealed
 * `FedosDeviceSyncJournalPackageV1` bytes -- no new encryption, no
 * plaintext record content, no secret material of any kind. The Relay
 * never sees anything beyond routing facts and one base64 string it
 * cannot decrypt.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Buffer } from "node:buffer";
import {
  serializeFedosDeviceSyncJournalPackageToBytes,
  deserializeFedosDeviceSyncJournalPackageFromBytes,
  type FedosDeviceSyncJournalPackageV1,
} from "./fedos_device_sync_journal_package.js";

export const FEDOS_DEVICE_SYNC_JOURNAL_WIRE_SCHEMA_VERSION = 1 as const;
export const FEDOS_DEVICE_SYNC_JOURNAL_ROUTE_VERSION = 1 as const;

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export interface FedosDeviceSyncJournalWirePayloadV1 {
  readonly schemaVersion: 1;
  readonly routeVersion: 1;
  readonly transferSessionId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly packageContentHash: string;
  readonly encryptedPackageBase64: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly deliveryId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function isWellFormedFedosDeviceSyncJournalWirePayloadV1(candidate: unknown): candidate is FedosDeviceSyncJournalWirePayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 14) return false;
  if (value.schemaVersion !== FEDOS_DEVICE_SYNC_JOURNAL_WIRE_SCHEMA_VERSION) return false;
  if (value.routeVersion !== FEDOS_DEVICE_SYNC_JOURNAL_ROUTE_VERSION) return false;
  if (!isNonEmptyString(value.transferSessionId)) return false;
  if (!isNonEmptyString(value.sourceDeviceId) || !DEVICE_ID_PATTERN.test(value.sourceDeviceId)) return false;
  if (!isNonEmptyString(value.targetDeviceId) || !DEVICE_ID_PATTERN.test(value.targetDeviceId)) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (typeof value.fromSequence !== "number" || !Number.isInteger(value.fromSequence) || value.fromSequence <= 0) return false;
  if (typeof value.toSequence !== "number" || !Number.isInteger(value.toSequence) || value.toSequence < value.fromSequence) return false;
  if (typeof value.packageContentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.packageContentHash)) return false;
  if (typeof value.encryptedPackageBase64 !== "string" || !BASE64_PATTERN.test(value.encryptedPackageBase64)) return false;
  if (!isValidUnixSeconds(value.createdAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.createdAt as number)) return false;
  if (!isNonEmptyString(value.deliveryId)) return false;
  return true;
}

export function isFedosDeviceSyncJournalWirePayloadExpired(payload: FedosDeviceSyncJournalWirePayloadV1, now: number): boolean {
  return now > payload.expiresAt;
}

export function computeFedosDeviceSyncJournalPackageContentHashForWire(pkg: FedosDeviceSyncJournalPackageV1): string {
  return bytesToHex(sha256(serializeFedosDeviceSyncJournalPackageToBytes(pkg)));
}

export interface FedosDeviceSyncJournalWirePayloadBuildInput {
  readonly package: FedosDeviceSyncJournalPackageV1;
  readonly transferSessionId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly deliveryId: string;
}

export function buildFedosDeviceSyncJournalWirePayload(input: FedosDeviceSyncJournalWirePayloadBuildInput): FedosDeviceSyncJournalWirePayloadV1 {
  const encryptedPackageBase64 = Buffer.from(serializeFedosDeviceSyncJournalPackageToBytes(input.package)).toString("base64");
  return Object.freeze({
    schemaVersion: FEDOS_DEVICE_SYNC_JOURNAL_WIRE_SCHEMA_VERSION,
    routeVersion: FEDOS_DEVICE_SYNC_JOURNAL_ROUTE_VERSION,
    transferSessionId: input.transferSessionId,
    sourceDeviceId: input.sourceDeviceId,
    targetDeviceId: input.targetDeviceId,
    accountAuthority: input.accountAuthority,
    accountPublicIdentifier: input.accountPublicIdentifier,
    fromSequence: input.fromSequence,
    toSequence: input.toSequence,
    packageContentHash: computeFedosDeviceSyncJournalPackageContentHashForWire(input.package),
    encryptedPackageBase64,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    deliveryId: input.deliveryId,
  });
}

export function extractFedosDeviceSyncJournalPackageFromWirePayload(payload: FedosDeviceSyncJournalWirePayloadV1): FedosDeviceSyncJournalPackageV1 | null {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(payload.encryptedPackageBase64, "base64"));
  } catch {
    return null;
  }
  return deserializeFedosDeviceSyncJournalPackageFromBytes(bytes);
}
