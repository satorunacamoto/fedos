/**
 * Own-Device Sync Protocol Final Closure arc — Journal Package Manifest
 * and content-hash binding. Mirrors
 * `../sync_package/fedos_device_sync_package_manifest.ts` exactly, applied
 * to a Journal Batch instead of a Sync Session: travels ALONGSIDE the
 * ciphertext, in the clear, never itself AEAD-protected; Package Read
 * re-verifies it twice after a successful decrypt (Header: same account/
 * target Device; this file's own content hash: same batch bytes).
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { serializeFedosDeviceSyncJournalBatchToBytes } from "./fedos_device_sync_journal_batch_codec.js";
import type { FedosDeviceSyncJournalBatchV1 } from "./fedos_device_sync_journal_batch.js";

export const FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_MANIFEST_SCHEMA_VERSION = 1 as const;
const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosDeviceSyncJournalPackageManifestV1 {
  readonly schemaVersion: 1;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly targetDeviceId: string;
  readonly preparedAt: number;
  readonly expiresAt: number;
  readonly entryCount: number;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly contentHash: string;
}

export function computeFedosDeviceSyncJournalPackageContentHash(batch: FedosDeviceSyncJournalBatchV1): string {
  return bytesToHex(sha256(serializeFedosDeviceSyncJournalBatchToBytes(batch)));
}

export function buildFedosDeviceSyncJournalPackageManifest(batch: FedosDeviceSyncJournalBatchV1): FedosDeviceSyncJournalPackageManifestV1 {
  return Object.freeze({
    schemaVersion: FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_MANIFEST_SCHEMA_VERSION,
    accountAuthority: batch.accountAuthority,
    accountPublicIdentifier: batch.accountPublicIdentifier,
    targetDeviceId: batch.targetDeviceId,
    preparedAt: batch.preparedAt,
    expiresAt: batch.expiresAt,
    entryCount: batch.entries.length,
    fromSequence: batch.fromSequence,
    toSequence: batch.toSequence,
    contentHash: computeFedosDeviceSyncJournalPackageContentHash(batch),
  });
}

export function fedosDeviceSyncJournalPackageContentHashesAreEqual(a: string, b: string): boolean {
  return a === b;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function isWellFormedFedosDeviceSyncJournalPackageManifestV1(candidate: unknown): candidate is FedosDeviceSyncJournalPackageManifestV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 10) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (!isNonEmptyString(value.targetDeviceId)) return false;
  if (!isValidUnixSeconds(value.preparedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt)) return false;
  if (typeof value.entryCount !== "number" || !Number.isInteger(value.entryCount) || value.entryCount <= 0) return false;
  if (typeof value.fromSequence !== "number" || !Number.isInteger(value.fromSequence) || value.fromSequence <= 0) return false;
  if (typeof value.toSequence !== "number" || !Number.isInteger(value.toSequence) || value.toSequence < value.fromSequence) return false;
  if (typeof value.contentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.contentHash)) return false;
  return true;
}
