/**
 * Secure Runtime Alpha 3321–3400 ("Device Registration Runtime Activation
 * and Local Device Sync Foundation") — the Device Sync Runtime.
 *
 * Activates the Registration Authority
 * (`../binding_challenge/fedos_device_binding_boundary_factory.ts`, Alpha
 * 3161–3240, unmodified) inside an actual callable Runtime facade — the
 * exact integration step that Arc's own Phase J named as its recommended
 * next step, but did not itself perform. Owns exactly:
 *
 *   - Runtime Device Registration/Activation — `mintChallenge()` +
 *     `registerDevice()`, thin delegations to the EXISTING
 *     `FedosDeviceBindingBoundary` (`createFedosDeviceBindingBoundary()`).
 *     Registration and Activation are ONE atomic call in the verified
 *     path: `AlreadyVerifiedFedosDeviceRegistrationAuthority` (internal to
 *     `FedosDeviceBindingRegistrationAuthority`) always resolves
 *     `capability: "verified"` once both signatures check out, so
 *     `registerDevice()` already reaches `"registered-trusted"` in one
 *     call — there is no separate `"pending"` state a caller must flip in
 *     this path (contrast the legacy `FedosDeviceTrustRuntime`'s own
 *     separate `confirmTrust()` step, which this Runtime does not use).
 *   - Runtime Device Revocation — `revokeDevice()`, delegates to the same
 *     boundary.
 *   - Local Device Inventory / Device Status Queries — read DIRECTLY from
 *     the injected `FedosDeviceRegistryPersistence` (the SAME instance the
 *     boundary itself was constructed over) via its own EXISTING
 *     `listBindings()`/`listBindingsForAccount()` — never re-derives
 *     Registry state, never adds a second, parallel inventory of its own.
 *   - Sync Session Preparation/Validation — thin delegations to
 *     `../sync_session/fedos_device_sync_session.ts`, over the SAME
 *     Registry persistence.
 *
 * Deliberately does NOT construct or expose the Encrypted Sync Package
 * Builder/Reader (`../sync_package/fedos_device_sync_package_encryption.ts`)
 * — that authority needs a `FedosMasterSeedAuthority` this Runtime has no
 * opinion about sourcing (mirrors how
 * `FedosWasmConversationArchiveEncryptionAuthority` itself is never
 * constructed BY any Runtime in this codebase either — a caller wires it,
 * injecting whichever Master Seed Authority instance it already manages).
 *
 * Deliberately does NOT touch Desktop Shell, Search, Archive, or
 * Sender-Key, and adds no new dependency — this Arc's own scope.
 */

import {
  createFedosDeviceBindingBoundary,
  type FedosDeviceBindingBoundary,
  type FedosDeviceBindingBoundaryDeps,
} from "../../../../device/binding_challenge/fedos_device_binding_boundary_factory.js";
import type { FedosDeviceBindingChallengeAction, FedosDeviceBindingChallengeV1 } from "../../../../device/binding_challenge/fedos_device_binding_challenge.js";
import type { FedosDeviceBindingAccountAuthorizationV1 } from "../../../../device/binding_challenge/fedos_device_binding_account_authorization.js";
import type { FedosDeviceBindingProofOfPossessionV1 } from "../../../../device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type {
  FedosDeviceBindingRegistrationResult,
  FedosDeviceBindingRevocationResult,
} from "../../../../device/binding_challenge/fedos_device_binding_registration_authority.js";
import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1 } from "../../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import {
  prepareFedosDeviceSyncSession,
  validateFedosDeviceSyncSession,
  type FedosDeviceSyncSessionPrepResult,
  type FedosDeviceSyncSessionValidationOutcome,
} from "../../../../device/sync_session/fedos_device_sync_session.js";

export interface FedosDeviceSyncDeviceStatusV1 {
  readonly deviceId: string;
  readonly found: boolean;
  readonly trustState: FedosDeviceBindingV1["trustState"] | "unknown";
  readonly active: boolean;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosDeviceSyncRuntime {
  readonly #boundary: FedosDeviceBindingBoundary;
  readonly #registryPersistence: FedosDeviceRegistryPersistence;
  readonly #now: () => number;

  constructor(deps: { boundary: FedosDeviceBindingBoundary; registryPersistence: FedosDeviceRegistryPersistence; now?: () => number }) {
    this.#boundary = deps.boundary;
    this.#registryPersistence = deps.registryPersistence;
    this.#now = deps.now ?? defaultNowSeconds;
  }

  /** Runtime Device Registration — mints a fresh challenge for `action` (`"register-device"`/`"revoke-device"`). Both the account authorization and Device proof of possession a caller collects afterward MUST cover this EXACT object. */
  mintChallenge(action: FedosDeviceBindingChallengeAction, deviceId: string, devicePublicKeyHex: string): FedosDeviceBindingChallengeV1 {
    return this.#boundary.mintChallenge(action, deviceId, devicePublicKeyHex);
  }

  /** Runtime Device Registration + Activation, atomically — see this file's own header for why there is no separate Activation step in the verified path. */
  async registerDevice(
    accountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    deviceProof: FedosDeviceBindingProofOfPossessionV1,
    now: number = this.#now(),
  ): Promise<FedosDeviceBindingRegistrationResult> {
    return this.#boundary.registrationAuthority.registerDevice(accountAuthorization, deviceProof, now);
  }

  /** Runtime Device Revocation — account-authorization-only, terminal. */
  async revokeDevice(
    accountAuthorization: FedosDeviceBindingAccountAuthorizationV1,
    now: number = this.#now(),
  ): Promise<FedosDeviceBindingRevocationResult> {
    return this.#boundary.registrationAuthority.revokeDevice(accountAuthorization, now);
  }

  /** Local Device Inventory — the current binding for one device id, `null` if never registered. */
  getDevice(deviceId: string): FedosDeviceBindingV1 | null {
    return this.#boundary.registrationAuthority.getBinding(deviceId);
  }

  /** Local Device Inventory — every binding this account currently owns, in any trust state. */
  listDevices(accountRef: FedosDeviceBindingAccountRef): readonly FedosDeviceBindingV1[] {
    return this.#registryPersistence.listBindingsForAccount(accountRef.authority, accountRef.publicIdentifier);
  }

  /** Local Device Inventory, filtered to currently `"trusted"` devices only. */
  listActiveDevices(accountRef: FedosDeviceBindingAccountRef): readonly FedosDeviceBindingV1[] {
    return this.listDevices(accountRef).filter((binding) => binding.trustState === "trusted");
  }

  /** Device Status Queries — one device's current status; `"unknown"`/`found: false` (never a thrown error) when the device has no Registry record at all. */
  deviceStatus(deviceId: string): FedosDeviceSyncDeviceStatusV1 {
    const binding = this.getDevice(deviceId);
    const trustState = binding?.trustState ?? "unknown";
    return Object.freeze({ deviceId, found: binding !== null, trustState, active: trustState === "trusted" });
  }

  /** Sync Session Preparation — refuses to prepare a session for a Device this Runtime's own Registry does not currently trust for `accountRef` (the "unauthorized Device" refusal). */
  prepareSyncSession(
    accountRef: FedosDeviceBindingAccountRef,
    targetDeviceId: string,
    now: number = this.#now(),
    ttlSeconds?: number,
  ): FedosDeviceSyncSessionPrepResult {
    return prepareFedosDeviceSyncSession({ registryPersistence: this.#registryPersistence, accountRef, targetDeviceId, now, ttlSeconds });
  }

  /** Sync Session Validation — re-checks a session against THIS Runtime's own LIVE Registry; never trusts the session's frozen snapshot at face value. */
  validateSyncSession(session: unknown, now: number = this.#now()): FedosDeviceSyncSessionValidationOutcome {
    return validateFedosDeviceSyncSession({ registryPersistence: this.#registryPersistence, session, now });
  }
}

/** The ONE construction point this Arc ships for the Runtime layer — mirrors `createFedosDeviceBindingBoundary()`'s own "inject persistence, no default production singleton" discipline one level up, adding the Registry Persistence reference the boundary alone does not expose. */
export function createFedosDeviceSyncRuntime(deps: FedosDeviceBindingBoundaryDeps): FedosDeviceSyncRuntime {
  const boundary = createFedosDeviceBindingBoundary(deps);
  return new FedosDeviceSyncRuntime({ boundary, registryPersistence: deps.registryPersistence, now: deps.now });
}
