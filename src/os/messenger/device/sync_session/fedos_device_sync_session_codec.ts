/**
 * Secure Runtime Alpha 3321–3400 — canonical byte serialization for
 * `FedosDeviceSyncSessionV1` (`./fedos_device_sync_session.ts`). Mirrors
 * `../../conversation/archive/fedos_conversation_archive_bundle_codec.ts`'s
 * own "deterministic JSON, sorted lists, fail-closed to null" discipline
 * exactly: the Encrypted Sync Package Builder/Reader
 * (`../sync_package/fedos_device_sync_package_encryption.ts`) seals and
 * opens EXACTLY these bytes.
 */

import { isWellFormedFedosDeviceSyncSessionV1, type FedosDeviceSyncSessionV1 } from "../../../../device/sync_session/fedos_device_sync_session.js";

function compareDeviceIds(a: { readonly deviceId: string }, b: { readonly deviceId: string }): number {
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}

/** Deterministic — `devices` is re-sorted by `deviceId` even if the caller's own array was not. */
export function serializeFedosDeviceSyncSessionToBytes(session: FedosDeviceSyncSessionV1): Uint8Array {
  const sortedDevices = [...session.devices].sort(compareDeviceIds);
  const canonical = {
    schemaVersion: session.schemaVersion,
    accountAuthority: session.accountAuthority,
    accountPublicIdentifier: session.accountPublicIdentifier,
    targetDeviceId: session.targetDeviceId,
    preparedAt: session.preparedAt,
    expiresAt: session.expiresAt,
    nonce: session.nonce,
    devices: sortedDevices.map((entry) => ({
      deviceId: entry.deviceId,
      devicePublicKeyRef: entry.devicePublicKeyRef,
      trustState: entry.trustState,
    })),
  };
  return new TextEncoder().encode(JSON.stringify(canonical));
}

/** `null` on ANY malformed input — unparseable JSON, wrong shape, or an unknown top-level field. Never throws. */
export function deserializeFedosDeviceSyncSessionFromBytes(bytes: Uint8Array): FedosDeviceSyncSessionV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceSyncSessionV1(parsed)) return null;
  return Object.freeze({ ...parsed, devices: Object.freeze([...parsed.devices]) });
}
