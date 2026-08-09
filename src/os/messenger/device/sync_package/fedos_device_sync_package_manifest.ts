/**
 * Secure Runtime Alpha 3321–3400 — Encrypted Sync Package Manifest and
 * content-hash binding. Mirrors
 * `../../conversation/archive/fedos_conversation_archive_manifest.ts` +
 * `fedos_conversation_archive_integrity.ts` exactly: the Manifest travels
 * ALONGSIDE the ciphertext, in the clear, and is NEVER itself
 * AEAD-protected — Package Read independently re-verifies it twice after a
 * successful decrypt: once via the Package Header (identity: same
 * account/target Device), once via this file's own content hash (content:
 * same session bytes).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { serializeFedosDeviceSyncSessionToBytes } from "../sync_session/fedos_device_sync_session_codec.js";
import type { FedosDeviceSyncSessionV1 } from "../sync_session/fedos_device_sync_session.js";

export const FEDOS_DEVICE_SYNC_PACKAGE_MANIFEST_SCHEMA_VERSION = 1 as const;

const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosDeviceSyncPackageManifestV1 {
  readonly schemaVersion: 1;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly targetDeviceId: string;
  readonly preparedAt: number;
  readonly expiresAt: number;
  readonly deviceCount: number;
  /** sha256 hex of the canonical session bytes (`../sync_session/fedos_device_sync_session_codec.ts`). */
  readonly contentHash: string;
}

export function computeFedosDeviceSyncPackageContentHash(session: FedosDeviceSyncSessionV1): string {
  return bytesToHex(sha256(serializeFedosDeviceSyncSessionToBytes(session)));
}

export function buildFedosDeviceSyncPackageManifest(session: FedosDeviceSyncSessionV1): FedosDeviceSyncPackageManifestV1 {
  return Object.freeze({
    schemaVersion: FEDOS_DEVICE_SYNC_PACKAGE_MANIFEST_SCHEMA_VERSION,
    accountAuthority: session.accountAuthority,
    accountPublicIdentifier: session.accountPublicIdentifier,
    targetDeviceId: session.targetDeviceId,
    preparedAt: session.preparedAt,
    expiresAt: session.expiresAt,
    deviceCount: session.devices.length,
    contentHash: computeFedosDeviceSyncPackageContentHash(session),
  });
}

/** Byte/string equality — used to detect a decrypted session whose content does not match the Manifest travelling alongside it. */
export function fedosDeviceSyncPackageContentHashesAreEqual(a: string, b: string): boolean {
  return a === b;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosDeviceSyncPackageManifestV1(candidate: unknown): candidate is FedosDeviceSyncPackageManifestV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 8) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (!isNonEmptyString(value.targetDeviceId)) return false;
  if (!isValidUnixSeconds(value.preparedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt)) return false;
  if (typeof value.deviceCount !== "number" || !Number.isInteger(value.deviceCount) || value.deviceCount < 0) return false;
  if (typeof value.contentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.contentHash)) return false;
  return true;
}
