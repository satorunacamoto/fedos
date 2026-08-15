/**
 * FedOS Peer Device Discovery Arc — the orchestrator that turns an
 * ACCEPTED peer device announcement (already verified/policy-evaluated by
 * the Inbound Coordinator) into a real Device Registry write. Mirrors
 * `../../device/binding_challenge/fedos_device_binding_registration_authority.ts`'s
 * own shape: owns a PRIVATE `PersistedFedosDeviceTrustAuthority` instance,
 * constructed internally with `AlreadyVerifiedFedosPeerDeviceRegistrationAuthority`
 * — never exposed to any caller. Writes into the SAME, SHARED
 * `FedosDeviceRegistryPersistence` instance the Runtime already wires into
 * the Direct Ratchet resolver (`06_PROTOCOL_CONTRACT_FREEZE.md` §7) — never
 * a second, parallel Registry.
 *
 * Per `06` §7 item 3 / `07_MULTI_DEVICE_AND_CONFLICT_MODEL.md`: a
 * `deviceId` that already has a `"trusted"` binding under a DIFFERENT
 * `devicePublicKeyRef` is a re-keying conflict — this orchestrator refuses
 * to silently overwrite it (the acceptance policy one layer up already
 * classifies this case as `"conflicting"` and never calls this
 * orchestrator at all; this file's own `"conflict"` outcome is a second,
 * independent backstop for direct callers).
 */
import { PersistedFedosDeviceTrustAuthority } from "../../device/persistence/persisted_fedos_device_trust_authority.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1 } from "../../device/fedos_device_binding.js";
import { AlreadyVerifiedFedosPeerDeviceRegistrationAuthority } from "./fedos_already_verified_peer_device_registration_authority.js";

export type FedosPeerDeviceAnnouncementRegistrationOutcome = "registered-trusted" | "already-trusted" | "conflict" | "failed";

export interface FedosPeerDeviceAnnouncementRegistrationResult {
  readonly outcome: FedosPeerDeviceAnnouncementRegistrationOutcome;
  readonly binding: FedosDeviceBindingV1 | null;
}

export class FedosPeerDeviceAnnouncementRegistrationAuthority {
  readonly #trustAuthority: PersistedFedosDeviceTrustAuthority;

  constructor(deps: { registryPersistence: FedosDeviceRegistryPersistence }) {
    this.#trustAuthority = new PersistedFedosDeviceTrustAuthority({
      persistence: deps.registryPersistence,
      registrationAuthority: new AlreadyVerifiedFedosPeerDeviceRegistrationAuthority(),
    });
  }

  /**
   * Registers, and — in the same call — trust-confirms, a cross-account
   * peer Device binding. The caller (Inbound Coordinator) must have
   * already run real account-signature verification and the acceptance
   * policy for the exact announcement in hand; this method performs no
   * cryptographic verification of its own.
   */
  registerOrUpdate(deviceId: string, accountRef: FedosDeviceBindingAccountRef, devicePublicKeyHex: string, now: number): FedosPeerDeviceAnnouncementRegistrationResult {
    const existing = this.#trustAuthority.getBinding(deviceId);
    if (existing !== null && existing.trustState === "trusted") {
      if (existing.devicePublicKeyRef !== devicePublicKeyHex) {
        // Re-keying conflict -- refuse to silently overwrite an already-
        // trusted binding under a different key (06 §7 item 3). The
        // acceptance policy one layer up should already have classified
        // this as "conflicting" and never called this method at all --
        // this is a second, independent backstop.
        return { outcome: "conflict", binding: existing };
      }
      return { outcome: "already-trusted", binding: existing };
    }

    const registration = this.#trustAuthority.registerDevice({ deviceId, accountRef, devicePublicKeyRef: devicePublicKeyHex, label: null }, now);
    if (registration.outcome === "conflict") return { outcome: "conflict", binding: registration.binding };
    if (registration.outcome === "revoked") return { outcome: "conflict", binding: registration.binding };
    if (registration.outcome !== "registered" && registration.outcome !== "already-registered") {
      return { outcome: "failed", binding: registration.binding };
    }

    const confirmation = this.#trustAuthority.confirmTrust(deviceId, now);
    if (confirmation.outcome !== "trusted") {
      return { outcome: "failed", binding: confirmation.binding };
    }
    return { outcome: "registered-trusted", binding: confirmation.binding };
  }
}
