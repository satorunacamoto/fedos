/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — internal composition detail of Phase G/H.
 *
 * INTERNAL. NOT a standalone production default. `PersistedFedosDeviceTrustAuthority`
 * (Alpha 2921–3000) requires ONE long-lived `FedosDeviceRegistrationAuthority`
 * at construction, but that port's own `FedosDeviceRegistrationRequest`/
 * `FedosDeviceBindingV1` shapes carry no room for a fresh cryptographic
 * signature — the real verification (account authorization, Phase D; Device
 * proof of possession, Phase E) MUST happen one layer up, in
 * `./fedos_device_binding_registration_authority.ts`, BEFORE it ever calls
 * into the Device Trust orchestrator. This class is what that orchestrator
 * injects: an unconditional "verified" answer, safe ONLY because the ONLY
 * caller that ever holds a reference to the `PersistedFedosDeviceTrustAuthority`
 * instance built with it is `FedosDeviceBindingRegistrationAuthority` itself,
 * which never exposes that instance and never calls `registerDevice()`/
 * `confirmTrust()` without having already run real signature verification
 * for the exact request in hand.
 *
 * Mirrors `../../../test/support/stub_verified_fedos_device_registration_authority.ts`'s
 * own documented precedent — "an always-true injected check is an honestly
 * labeled convenience, never a default this file itself supplies" — except
 * this one ships in `src/` because the gate that makes it safe (Phase D/E's
 * real crypto) also ships in `src/`, unlike the test stub's simulated check.
 *
 * Never import or construct this class anywhere outside
 * `fedos_device_binding_registration_authority.ts`.
 */

import type { FedosDeviceBindingV1 } from "../../../../device/fedos_device_binding.js";
import type {
  FedosDeviceRegistrationAuthority,
  FedosDeviceRegistrationAuthorityDecision,
  FedosDeviceRegistrationRequest,
} from "../../../../device/fedos_device_registration_authority.js";

const REASON =
  "already verified by FedosDeviceBindingRegistrationAuthority's own real account-signature + device-proof-of-possession check (Secure Runtime Alpha 3161-3240) before this call was ever made";

export class AlreadyVerifiedFedosDeviceRegistrationAuthority implements FedosDeviceRegistrationAuthority {
  authorizeRegistration(_request: FedosDeviceRegistrationRequest, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: true, capability: "verified", reason: REASON };
  }

  authorizeTrustConfirmation(_binding: FedosDeviceBindingV1, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: true, capability: "verified", reason: REASON };
  }
}
