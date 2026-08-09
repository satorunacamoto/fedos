/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Device Registration Authority (Phase E).
 *
 * A Device registration must be authorized by the existing account
 * identity or an accepted capability flow — a caller can never gain a
 * `"trusted"` binding merely by supplying an account id that happens to
 * match (Phase E's own explicit prohibition: "Do not invent trust based
 * on matching text identifiers").
 *
 * This file defines the PORT only — mirrors
 * `../conversation/capability/fedos_conversation_capability_issuer_authority.ts`'s
 * own "injected, no default production implementation is supplied
 * anywhere in this Arc" discipline. `./unavailable_fedos_device_registration_authority.ts`
 * is the ONLY production adapter this Arc ships.
 *
 * `authorizeRegistration()` answers "may a binding record for this
 * device even be DURABLY CREATED" — separate from
 * `authorizeTrustConfirmation()`, which answers "may this ALREADY
 * created, `"pending"` binding be promoted to `"trusted"`." Splitting
 * these two lets an Authority honestly record that a device attempted
 * registration (durable, auditable, non-repudiable Device Registry —
 * Phase D) without ever having to claim it could verify who that device
 * really was.
 */

import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1 } from "../../../device/fedos_device_binding.js";

export interface FedosDeviceRegistrationRequest {
  readonly deviceId: string;
  readonly accountRef: FedosDeviceBindingAccountRef;
  /** OPAQUE reference only — never raw key bytes. */
  readonly devicePublicKeyRef: string | null;
  readonly label: string | null;
}

/**
 * `"verified"` — a real account-to-device signature/binding check ran
 * and passed. NEVER produced by `UnavailableFedosDeviceRegistrationAuthority`.
 * `"unavailable"` — no real verification boundary exists; the decision
 * carries no security guarantee of any kind.
 */
export type FedosDeviceRegistrationAuthorityCapability = "verified" | "unavailable";

export interface FedosDeviceRegistrationAuthorityDecision {
  readonly allowed: boolean;
  readonly capability: FedosDeviceRegistrationAuthorityCapability;
  /** Non-sensitive, human-readable explanation. Never echoes key material. */
  readonly reason: string;
}

export interface FedosDeviceRegistrationAuthority {
  /** Decides whether a NEW binding record may be durably created at all, and at what capability ceiling. Never mutates anything itself. */
  authorizeRegistration(request: FedosDeviceRegistrationRequest, now: number): FedosDeviceRegistrationAuthorityDecision;
  /** Decides whether an EXISTING `"pending"` binding may be promoted to `"trusted"`. A `"verified"` capability here is required before `trustFedosDeviceBinding()` may ever be called by an orchestrator. */
  authorizeTrustConfirmation(binding: FedosDeviceBindingV1, now: number): FedosDeviceRegistrationAuthorityDecision;
}
