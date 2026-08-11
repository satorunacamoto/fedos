/**
 * TEST-ONLY. Secure Runtime Alpha 2921–3000 — a `FedosDeviceRegistrationAuthority`
 * implementation that CAN return `capability: "verified"`, so this Arc's
 * `"pending" -> "trusted"` transition path and its account-ownership
 * check are exercised by a real test, not left completely unreachable.
 *
 * This is NOT real cryptography and ships nowhere in `src/` — mirrors
 * `../../src/conversation/capability/fedos_conversation_capability_issuer_authority.ts`'s
 * own documented precedent exactly: "an always-true injected check is an
 * honestly-labeled TEST convenience, never a default this file itself
 * supplies." `UnavailableFedosDeviceRegistrationAuthority`
 * (`../../src/device/unavailable_fedos_device_registration_authority.ts`)
 * remains the only PRODUCTION adapter this Arc ships.
 *
 * Simulates "verified" by comparing `devicePublicKeyRef` against a
 * caller-supplied expected value per account — a stand-in for a real
 * signature check, not one itself. A registration for a DIFFERENT
 * account than the one this stub was constructed for, or with a
 * mismatched key ref, is denied — proving the vocabulary/orchestrator
 * correctly refuses self-asserted ownership once a real Authority CAN
 * refuse it.
 */

import type { FedosDeviceBindingV1 } from "../../src/os/messenger/device/fedos_device_binding.js";
import type {
  FedosDeviceRegistrationAuthority,
  FedosDeviceRegistrationAuthorityDecision,
  FedosDeviceRegistrationRequest,
} from "../../src/os/messenger/device/fedos_device_registration_authority.js";

export class StubVerifiedFedosDeviceRegistrationAuthority implements FedosDeviceRegistrationAuthority {
  readonly #expectedAccountAuthority: string;
  readonly #expectedAccountPublicIdentifier: string;

  constructor(expectedAccountAuthority: string, expectedAccountPublicIdentifier: string) {
    this.#expectedAccountAuthority = expectedAccountAuthority;
    this.#expectedAccountPublicIdentifier = expectedAccountPublicIdentifier;
  }

  authorizeRegistration(request: FedosDeviceRegistrationRequest, _now: number): FedosDeviceRegistrationAuthorityDecision {
    if (
      request.accountRef.authority !== this.#expectedAccountAuthority ||
      request.accountRef.publicIdentifier !== this.#expectedAccountPublicIdentifier
    ) {
      return { allowed: false, capability: "verified", reason: "test stub: account does not match this authority's own expected account" };
    }
    if (request.devicePublicKeyRef === null) {
      return { allowed: false, capability: "verified", reason: "test stub: no devicePublicKeyRef supplied" };
    }
    return { allowed: true, capability: "verified", reason: "test stub: simulated signature check passed" };
  }

  authorizeTrustConfirmation(binding: FedosDeviceBindingV1, _now: number): FedosDeviceRegistrationAuthorityDecision {
    if (
      binding.accountRef.authority !== this.#expectedAccountAuthority ||
      binding.accountRef.publicIdentifier !== this.#expectedAccountPublicIdentifier
    ) {
      return { allowed: false, capability: "verified", reason: "test stub: account does not match this authority's own expected account" };
    }
    return { allowed: true, capability: "verified", reason: "test stub: simulated trust confirmation passed" };
  }
}
