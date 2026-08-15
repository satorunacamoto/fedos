/**
 * FedOS Peer Device Discovery Arc — internal composition detail. Mirrors
 * `../../device/binding_challenge/fedos_already_verified_device_registration_authority.ts`'s
 * own "an always-true injected check is an honestly labeled convenience,
 * never a default this file itself supplies" precedent exactly, applied to
 * cross-account bindings: safe ONLY because the ONLY caller that ever holds
 * a reference to the `PersistedFedosDeviceTrustAuthority` instance built
 * with it is `FedosPeerDeviceAnnouncementRegistrationAuthority` itself,
 * which never exposes that instance and never calls `registerDevice()`/
 * `confirmTrust()` without having already run real account-signature
 * verification for the exact announcement in hand.
 *
 * This is a SEPARATE, dedicated instance from same-account pairing's own
 * `AlreadyVerifiedFedosDeviceRegistrationAuthority` — never shared, never
 * imported outside `fedos_peer_device_announcement_registration_authority.ts`.
 */
import type { FedosDeviceBindingV1 } from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistrationAuthority, FedosDeviceRegistrationAuthorityDecision, FedosDeviceRegistrationRequest } from "../../device/fedos_device_registration_authority.js";

const REASON =
  "already verified by FedosPeerDeviceAnnouncementRegistrationAuthority's own real cross-account announcement account-signature check before this call was ever made";

export class AlreadyVerifiedFedosPeerDeviceRegistrationAuthority implements FedosDeviceRegistrationAuthority {
  authorizeRegistration(_request: FedosDeviceRegistrationRequest, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: true, capability: "verified", reason: REASON };
  }

  authorizeTrustConfirmation(_binding: FedosDeviceBindingV1, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: true, capability: "verified", reason: REASON };
  }
}
