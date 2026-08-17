/**
 * Own-Device Sync Protocol Final Closure arc — the Encrypted Journal
 * Package envelope. Mirrors `../sync_package/fedos_device_sync_package.ts`
 * exactly: cleartext manifest + opaque ciphertext wire, packaged as one
 * addressable unit.
 */
import type { AeadCiphertextWire } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import {
  isWellFormedFedosDeviceSyncJournalPackageManifestV1,
  type FedosDeviceSyncJournalPackageManifestV1,
} from "./fedos_device_sync_journal_package_manifest.js";

export const FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_FORMAT_VERSION = 1 as const;

export interface FedosDeviceSyncJournalPackageV1 {
  readonly formatVersion: 1;
  readonly manifest: FedosDeviceSyncJournalPackageManifestV1;
  readonly ciphertext: AeadCiphertextWire;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isWellFormedFedosDeviceSyncJournalPackageV1(candidate: unknown): candidate is FedosDeviceSyncJournalPackageV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 3) return false;
  if (value.formatVersion !== FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_FORMAT_VERSION) return false;
  if (!isWellFormedFedosDeviceSyncJournalPackageManifestV1(value.manifest)) return false;
  if (!isNonEmptyString(value.ciphertext)) return false;
  return true;
}

export function serializeFedosDeviceSyncJournalPackageToBytes(pkg: FedosDeviceSyncJournalPackageV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(pkg));
}

export function deserializeFedosDeviceSyncJournalPackageFromBytes(bytes: Uint8Array): FedosDeviceSyncJournalPackageV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceSyncJournalPackageV1(parsed)) return null;
  return Object.freeze({ ...parsed });
}
