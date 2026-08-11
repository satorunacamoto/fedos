/**
 * Secure Runtime Alpha 3321–3400 — the Encrypted Sync Package envelope.
 * Mirrors
 * `../../conversation/archive_cli/fedos_conversation_archive_cli_package.ts`'s
 * own "cleartext manifest + opaque ciphertext wire, packaged as one
 * addressable unit" shape exactly, applied to a Sync Session instead of a
 * Conversation Archive. `formatVersion` is kept independent of the inner
 * session's own `schemaVersion` and the Manifest's own `schemaVersion` —
 * three independently-versioned layers, matching the CLI Package's own
 * precedent.
 */

import type { AeadCiphertextWire } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import {
  isWellFormedFedosDeviceSyncPackageManifestV1,
  type FedosDeviceSyncPackageManifestV1,
} from "./fedos_device_sync_package_manifest.js";

export const FEDOS_DEVICE_SYNC_PACKAGE_FORMAT_VERSION = 1 as const;

export interface FedosDeviceSyncPackageV1 {
  readonly formatVersion: 1;
  readonly manifest: FedosDeviceSyncPackageManifestV1;
  readonly ciphertext: AeadCiphertextWire;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Structural validation only — does NOT decrypt or verify the ciphertext. Fails closed; never throws. */
export function isWellFormedFedosDeviceSyncPackageV1(candidate: unknown): candidate is FedosDeviceSyncPackageV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 3) return false;
  if (value.formatVersion !== FEDOS_DEVICE_SYNC_PACKAGE_FORMAT_VERSION) return false;
  if (!isWellFormedFedosDeviceSyncPackageManifestV1(value.manifest)) return false;
  if (!isNonEmptyString(value.ciphertext)) return false;
  return true;
}

/** Deterministic JSON encoding — a Package is a small, at-rest-storable unit (mirrors the CLI Package's own codec role). */
export function serializeFedosDeviceSyncPackageToBytes(pkg: FedosDeviceSyncPackageV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(pkg));
}

/** `null` on ANY malformed input — unparseable JSON, wrong shape, or an unknown field at any level. Never throws. */
export function deserializeFedosDeviceSyncPackageFromBytes(bytes: Uint8Array): FedosDeviceSyncPackageV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceSyncPackageV1(parsed)) return null;
  return Object.freeze({ ...parsed });
}
