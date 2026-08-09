/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the Transfer Package envelope.
 *
 * A thin binder around the EXISTING, unmodified `FedosDeviceSyncPackageV1`
 * (`../sync_package/fedos_device_sync_package.ts`, Alpha 3321–3400) — this
 * Arc adds NO new encryption, AEAD domain, or key-resolution logic of its
 * own; `syncPackage` is built and read by the SAME, unmodified
 * `FedosWasmDeviceSyncPackageEncryptionAuthority`. This file only adds the
 * `sessionId` binding a Transfer needs to route an incoming Package to the
 * correct `FedosDeviceTransferSessionV1` and to distinguish a genuine
 * resubmission (duplicate) from a different, unrelated Package
 * (`fedos_device_transfer_coordinator.ts`'s own `"conflict"` outcome).
 */

import { isWellFormedFedosDeviceSyncPackageV1, type FedosDeviceSyncPackageV1 } from "../../../../device/sync_package/fedos_device_sync_package.js";

export const FEDOS_DEVICE_TRANSFER_PACKAGE_FORMAT_VERSION = 1 as const;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;

export interface FedosDeviceTransferPackageV1 {
  readonly formatVersion: 1;
  readonly sessionId: string;
  readonly syncPackage: FedosDeviceSyncPackageV1;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Structural validation only — does NOT decrypt or verify the inner ciphertext. Fails closed; never throws. */
export function isWellFormedFedosDeviceTransferPackageV1(candidate: unknown): candidate is FedosDeviceTransferPackageV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 3) return false;
  if (value.formatVersion !== FEDOS_DEVICE_TRANSFER_PACKAGE_FORMAT_VERSION) return false;
  if (!isNonEmptyString(value.sessionId) || !SESSION_ID_PATTERN.test(value.sessionId)) return false;
  if (!isWellFormedFedosDeviceSyncPackageV1(value.syncPackage)) return false;
  return true;
}

/** Deterministic JSON encoding — a Transfer Package is a small, at-rest/local-transport-storable unit. */
export function serializeFedosDeviceTransferPackageToBytes(pkg: FedosDeviceTransferPackageV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(pkg));
}

/** `null` on ANY malformed input — unparseable JSON, wrong shape, or an unknown field at any level. Never throws. */
export function deserializeFedosDeviceTransferPackageFromBytes(bytes: Uint8Array): FedosDeviceTransferPackageV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceTransferPackageV1(parsed)) return null;
  return Object.freeze({ ...parsed });
}
