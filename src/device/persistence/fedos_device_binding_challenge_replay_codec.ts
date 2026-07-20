/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase F/I: Replay Record Codec.
 *
 * Mirrors `./fedos_device_binding_codec.ts`'s own exact discipline: fails
 * closed to `null` on anything malformed, off-schema, or carrying an unknown
 * top-level field. `schemaVersion` checked exactly against `1`.
 */

import type { FedosPersistedDeviceBindingChallengeConsumptionV1 } from "./fedos_persisted_device_binding_challenge_consumption_v1.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const RECORD_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "nonce",
  "domain",
  "action",
  "deviceId",
  "devicePublicKeyHex",
  "accountAuthority",
  "accountPublicIdentifier",
  "consumedAt",
  "outcomeSummary",
]);

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. Never throws. */
export function deserializeFedosDeviceBindingChallengeConsumption(
  record: unknown,
): FedosPersistedDeviceBindingChallengeConsumptionV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => RECORD_KEYS.has(key)) || keys.length !== RECORD_KEYS.size) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (!isNonEmptyString(value.nonce)) return null;
  if (!isNonEmptyString(value.domain)) return null;
  if (value.action !== "register-device" && value.action !== "revoke-device") return null;
  if (!isNonEmptyString(value.deviceId)) return null;
  if (!isNonEmptyString(value.devicePublicKeyHex)) return null;
  if (!isNonEmptyString(value.accountAuthority)) return null;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return null;
  if (!isValidTimestamp(value.consumedAt)) return null;
  if (!isNonEmptyString(value.outcomeSummary)) return null;

  return {
    schemaVersion: 1,
    nonce: value.nonce,
    domain: value.domain,
    action: value.action,
    deviceId: value.deviceId,
    devicePublicKeyHex: value.devicePublicKeyHex,
    accountAuthority: value.accountAuthority,
    accountPublicIdentifier: value.accountPublicIdentifier,
    consumedAt: value.consumedAt,
    outcomeSummary: value.outcomeSummary,
  };
}
