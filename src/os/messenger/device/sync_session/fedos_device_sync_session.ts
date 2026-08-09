/**
 * Secure Runtime Alpha 3321–3400 ("Device Registration Runtime Activation
 * and Local Device Sync Foundation") — Sync Session Preparation and
 * Validation.
 *
 * A Sync Session is a LOCAL, at-rest snapshot of one account's currently
 * trusted Device inventory (`../persistence/fedos_device_registry_persistence.ts`,
 * Alpha 2921–3000/3161–3240, unmodified), addressed to one target Device
 * that is itself currently trusted. It carries no network/relay/cloud
 * behavior of any kind (explicitly out of scope for this Arc) — it is the
 * LOCAL data a future "Encrypted Device-to-Device Local Transfer" Arc would
 * hand to its own transport, and the ONE payload the Encrypted Sync
 * Package Builder/Reader (`../sync_package/`) seals and opens.
 *
 * `prepareFedosDeviceSyncSession()` refuses to prepare a session for a
 * target Device that is not currently `"trusted"` in the Registry — an
 * unauthorized/revoked/unknown Device can never receive one.
 * `validateFedosDeviceSyncSession()` re-checks a session against the LIVE
 * Registry at validation time (never trusting the snapshot's own frozen
 * `devices` list at face value) — a Device trusted when the session was
 * prepared but revoked since is caught as `"stale-device-list"`, and a
 * target Device revoked since preparation is caught as
 * `"target-not-trusted"`, independent of the session's own `expiresAt`.
 */

import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1, FedosDeviceTrustState } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import {
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeNonceGenerator,
} from "../binding_challenge/fedos_device_binding_challenge.js";

export const FEDOS_DEVICE_SYNC_SESSION_SCHEMA_VERSION = 1 as const;

const NONCE_HEX_PATTERN = /^[0-9a-f]{32,64}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const TRUST_STATES: readonly FedosDeviceTrustState[] = ["pending", "trusted", "revoked", "unavailable"];

export interface FedosDeviceSyncSessionDeviceEntryV1 {
  readonly deviceId: string;
  readonly devicePublicKeyRef: string | null;
  readonly trustState: FedosDeviceTrustState;
}

export interface FedosDeviceSyncSessionV1 {
  readonly schemaVersion: 1;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly targetDeviceId: string;
  readonly preparedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly devices: readonly FedosDeviceSyncSessionDeviceEntryV1[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isWellFormedDeviceEntry(candidate: unknown): candidate is FedosDeviceSyncSessionDeviceEntryV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 3) return false;
  if (!isNonEmptyString(value.deviceId) || !DEVICE_ID_PATTERN.test(value.deviceId)) return false;
  if (value.devicePublicKeyRef !== null && typeof value.devicePublicKeyRef !== "string") return false;
  if (!TRUST_STATES.includes(value.trustState as FedosDeviceTrustState)) return false;
  return true;
}

/** Structural + field-shape validation only — does NOT re-check the LIVE Registry. Fails closed; never throws. */
export function isWellFormedFedosDeviceSyncSessionV1(candidate: unknown): candidate is FedosDeviceSyncSessionV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 8) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (!isNonEmptyString(value.targetDeviceId) || !DEVICE_ID_PATTERN.test(value.targetDeviceId)) return false;
  if (!isValidUnixSeconds(value.preparedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.preparedAt as number)) return false;
  if (typeof value.nonce !== "string" || !NONCE_HEX_PATTERN.test(value.nonce)) return false;
  if (!Array.isArray(value.devices) || !value.devices.every(isWellFormedDeviceEntry)) return false;
  return true;
}

export function isFedosDeviceSyncSessionExpired(session: FedosDeviceSyncSessionV1, now: number): boolean {
  return now > session.expiresAt;
}

export type FedosDeviceSyncSessionPrepOutcome = "prepared" | "target-not-found" | "target-not-trusted";

export interface FedosDeviceSyncSessionPrepResult {
  readonly outcome: FedosDeviceSyncSessionPrepOutcome;
  readonly session: FedosDeviceSyncSessionV1 | null;
}

function deviceEntry(binding: FedosDeviceBindingV1): FedosDeviceSyncSessionDeviceEntryV1 {
  return Object.freeze({ deviceId: binding.deviceId, devicePublicKeyRef: binding.devicePublicKeyRef, trustState: binding.trustState });
}

function compareDeviceIds(a: { readonly deviceId: string }, b: { readonly deviceId: string }): number {
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}

/**
 * Prepares a Sync Session snapshot for `targetDeviceId`, refusing to do so
 * unless that Device is CURRENTLY `"trusted"` in `registryPersistence` for
 * `accountRef` — the "unauthorized Device" refusal this Arc's own test
 * matrix names. `devices` is every CURRENTLY `"trusted"` binding for
 * `accountRef` (never a revoked/pending/unavailable one), sorted by
 * `deviceId` for a deterministic snapshot.
 */
export function prepareFedosDeviceSyncSession(deps: {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly targetDeviceId: string;
  readonly now: number;
  readonly ttlSeconds?: number;
  readonly nonceGenerator?: FedosDeviceBindingChallengeNonceGenerator;
}): FedosDeviceSyncSessionPrepResult {
  const target = deps.registryPersistence.getBinding(deps.targetDeviceId);
  if (target === null) return { outcome: "target-not-found", session: null };
  if (
    target.accountRef.authority !== deps.accountRef.authority ||
    target.accountRef.publicIdentifier !== deps.accountRef.publicIdentifier
  ) {
    return { outcome: "target-not-found", session: null };
  }
  if (target.trustState !== "trusted") return { outcome: "target-not-trusted", session: null };

  const nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
  const ttlSeconds = deps.ttlSeconds ?? 300;
  const devices = deps.registryPersistence
    .listBindingsForAccount(deps.accountRef.authority, deps.accountRef.publicIdentifier)
    .filter((binding) => binding.trustState === "trusted")
    .map(deviceEntry)
    .slice()
    .sort(compareDeviceIds);

  const session: FedosDeviceSyncSessionV1 = Object.freeze({
    schemaVersion: FEDOS_DEVICE_SYNC_SESSION_SCHEMA_VERSION,
    accountAuthority: deps.accountRef.authority,
    accountPublicIdentifier: deps.accountRef.publicIdentifier,
    targetDeviceId: deps.targetDeviceId,
    preparedAt: deps.now,
    expiresAt: deps.now + ttlSeconds,
    nonce: nonceGenerator.generateNonce(),
    devices: Object.freeze(devices),
  });
  return { outcome: "prepared", session };
}

export type FedosDeviceSyncSessionValidationOutcome = "valid" | "malformed" | "expired" | "target-not-trusted" | "stale-device-list";

/**
 * Re-validates a Sync Session against the LIVE Registry — never trusts the
 * session's own frozen `devices` list at face value. A Device the session
 * lists as `"trusted"` that is no longer `"trusted"` live (revoked, or
 * absent entirely) fails as `"stale-device-list"`; the target Device
 * itself no longer being `"trusted"` live fails as `"target-not-trusted"`,
 * independent of `expiresAt`.
 */
export function validateFedosDeviceSyncSession(deps: {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly session: unknown;
  readonly now: number;
}): FedosDeviceSyncSessionValidationOutcome {
  if (!isWellFormedFedosDeviceSyncSessionV1(deps.session)) return "malformed";
  const session = deps.session;

  if (isFedosDeviceSyncSessionExpired(session, deps.now)) return "expired";

  const target = deps.registryPersistence.getBinding(session.targetDeviceId);
  if (
    target === null ||
    target.trustState !== "trusted" ||
    target.accountRef.authority !== session.accountAuthority ||
    target.accountRef.publicIdentifier !== session.accountPublicIdentifier
  ) {
    return "target-not-trusted";
  }

  for (const entry of session.devices) {
    if (entry.trustState !== "trusted") continue; // a session never claims a non-trusted entry is live-trusted; nothing to re-check
    const live = deps.registryPersistence.getBinding(entry.deviceId);
    if (
      live === null ||
      live.trustState !== "trusted" ||
      live.accountRef.authority !== session.accountAuthority ||
      live.accountRef.publicIdentifier !== session.accountPublicIdentifier
    ) {
      return "stale-device-list";
    }
  }

  return "valid";
}
