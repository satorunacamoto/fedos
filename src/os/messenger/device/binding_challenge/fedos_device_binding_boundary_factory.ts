/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase J: Factory/Adapter Boundary.
 *
 * The ONE narrow construction point a future Desktop Runtime integration
 * step would call. Mirrors this codebase's own "inject persistence +
 * dependencies, no default production singleton" discipline
 * (`../persistence/persisted_fedos_device_trust_authority.ts`,
 * `../../desktop/runtime/fedos_device_trust_runtime.ts`).
 *
 * This Arc does NOT wire this factory into `fedos_desktop_runtime.ts` —
 * that file is explicitly off-limits to this Arc (Parallel Safety). The
 * exact future integration step is documented in
 * `docs/secure_runtime_alpha_3161_3240_execution_spec.md` (Phase J
 * section): `FedosRunningDesktopRuntime` would gain one opt-in flag
 * (mirroring `deviceTrustEnabled`) and one narrow `deviceBinding()`
 * accessor that calls `createFedosDeviceBindingBoundary()` once, exactly
 * like `deviceTrust()` already does for `PersistedFedosDeviceTrustAuthority`.
 * No alternative parallel authority tree is created here or anywhere else
 * in this Arc.
 */

import {
  FEDOS_DEVICE_BINDING_DOMAIN_V1,
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeAction,
  type FedosDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeV1,
} from "../../../../device/binding_challenge/fedos_device_binding_challenge.js";
import { FedosDeviceBindingRegistrationAuthority } from "../../../../device/binding_challenge/fedos_device_binding_registration_authority.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingChallengeReplayPersistence } from "../../../../device/persistence/fedos_device_binding_challenge_replay_persistence.js";

/** Explicit operational limits — no unbounded/implicit default. */
export interface FedosDeviceBindingBoundaryLimits {
  /** Challenge lifetime in whole seconds. Must be a positive integer. */
  readonly challengeTtlSeconds: number;
}

/** Conservative, explicitly-named default — 5 minutes, mirroring this codebase's other short-lived-request precedents. */
export const FEDOS_DEVICE_BINDING_DEFAULT_LIMITS: FedosDeviceBindingBoundaryLimits = Object.freeze({
  challengeTtlSeconds: 300,
});

export interface FedosDeviceBindingBoundaryDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly replayPersistence: FedosDeviceBindingChallengeReplayPersistence;
  /** Injected clock — defaults to wall-clock `Date.now()` seconds if omitted. */
  readonly now?: () => number;
  /** Injected nonce authority — defaults to the reviewed CSPRNG generator if omitted. Never `Math.random()`. */
  readonly nonceGenerator?: FedosDeviceBindingChallengeNonceGenerator;
  readonly limits?: FedosDeviceBindingBoundaryLimits;
}

export interface FedosDeviceBindingBoundary {
  /** The Phase G/H orchestrator — the only production entry point for registration/revocation in this Arc. */
  readonly registrationAuthority: FedosDeviceBindingRegistrationAuthority;
  /**
   * Mints a fresh, versioned, domain-bound challenge for `action` — the
   * one place `issuedAt`/`expiresAt`/`nonce` are ever produced for a
   * caller. Both the account authorization signature and the Device
   * proof of possession are computed over the EXACT object this returns.
   */
  mintChallenge(action: FedosDeviceBindingChallengeAction, deviceId: string, devicePublicKeyHex: string): FedosDeviceBindingChallengeV1;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * The one factory this Arc ships. Constructs a `FedosDeviceBindingRegistrationAuthority`
 * over caller-supplied persistence, plus a matching challenge minter using
 * the SAME clock/nonce authority and TTL — so a Runtime integrating this
 * boundary never has to duplicate that wiring itself.
 */
export function createFedosDeviceBindingBoundary(deps: FedosDeviceBindingBoundaryDeps): FedosDeviceBindingBoundary {
  const now = deps.now ?? defaultNowSeconds;
  const nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
  const limits = deps.limits ?? FEDOS_DEVICE_BINDING_DEFAULT_LIMITS;

  const registrationAuthority = new FedosDeviceBindingRegistrationAuthority({
    registryPersistence: deps.registryPersistence,
    replayPersistence: deps.replayPersistence,
  });

  return Object.freeze({
    registrationAuthority,
    mintChallenge(action: FedosDeviceBindingChallengeAction, deviceId: string, devicePublicKeyHex: string): FedosDeviceBindingChallengeV1 {
      const issuedAt = now();
      return Object.freeze({
        schemaVersion: 1 as const,
        domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
        action,
        deviceId,
        devicePublicKeyHex,
        issuedAt,
        expiresAt: issuedAt + limits.challengeTtlSeconds,
        nonce: nonceGenerator.generateNonce(),
      });
    },
  });
}
