/**
 * Disaster Recovery / Portable Backup Arc — Recovery Bundle Manifest and
 * content-hash binding. Mirrors
 * `../../device/sync_package/fedos_device_sync_package_manifest.ts` (itself
 * mirroring the Conversation Archive's own Manifest/Integrity pair)
 * exactly: the Manifest travels ALONGSIDE the Data Part ciphertext, in
 * the clear, and is NEVER itself AEAD-protected — Restore independently
 * re-verifies it after a successful decrypt, via this file's own content
 * hash (content: same Data Part bytes), distinct from the Header's own
 * identity binding (`fedos_recovery_bundle_header.ts`).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const FEDOS_RECOVERY_BUNDLE_MANIFEST_SCHEMA_VERSION = 1 as const;

const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;
const LOG_NAME_PATTERN = /^[a-z0-9-]{1,128}$/;

export interface FedosRecoveryBundleManifestV1 {
  readonly schemaVersion: 1;
  readonly createdAt: number;
  readonly accountIndex: number;
  /** Sorted, deduplicated logical log names actually present in the Data Part — an echo of the builder's own inclusion decision, never itself trusted for restore-time policy. */
  readonly includedLogs: readonly string[];
  /** sha256 hex of the encoded Data Part bytes (`fedos_recovery_bundle_data_part_codec.ts`). */
  readonly contentHash: string;
}

export function computeFedosRecoveryBundleContentHash(dataPartBytes: Uint8Array): string {
  return bytesToHex(sha256(dataPartBytes));
}

export function buildFedosRecoveryBundleManifest(params: {
  readonly createdAt: number;
  readonly accountIndex: number;
  readonly includedLogs: readonly string[];
  readonly dataPartBytes: Uint8Array;
}): FedosRecoveryBundleManifestV1 {
  return Object.freeze({
    schemaVersion: FEDOS_RECOVERY_BUNDLE_MANIFEST_SCHEMA_VERSION,
    createdAt: params.createdAt,
    accountIndex: params.accountIndex,
    includedLogs: Object.freeze([...new Set(params.includedLogs)].sort()),
    contentHash: computeFedosRecoveryBundleContentHash(params.dataPartBytes),
  });
}

/** Byte/string equality — used to detect a decrypted Data Part whose content does not match the Manifest travelling alongside it. */
export function fedosRecoveryBundleContentHashesAreEqual(a: string, b: string): boolean {
  return a === b;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isValidAccountIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4_294_967_295;
}

function isWellFormedIncludedLogs(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !LOG_NAME_PATTERN.test(entry)) return false;
    if (seen.has(entry)) return false; // no duplicates
    seen.add(entry);
  }
  // must already be sorted -- a manifest is a canonical echo of the builder's own output, not a caller-reorderable list
  const sorted = [...value].sort();
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== value[i]) return false;
  }
  return true;
}

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosRecoveryBundleManifestV1(candidate: unknown): candidate is FedosRecoveryBundleManifestV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return false;
  if (value.schemaVersion !== FEDOS_RECOVERY_BUNDLE_MANIFEST_SCHEMA_VERSION) return false;
  if (!isValidUnixSeconds(value.createdAt)) return false;
  if (!isValidAccountIndex(value.accountIndex)) return false;
  if (!isWellFormedIncludedLogs(value.includedLogs)) return false;
  if (typeof value.contentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.contentHash)) return false;
  return true;
}
