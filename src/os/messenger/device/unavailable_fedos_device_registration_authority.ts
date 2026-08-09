/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Unavailable Device Registration Authority (Phase E).
 *
 * The ONLY production `FedosDeviceRegistrationAuthority` implementation
 * this Arc ships, because this codebase has no accepted cryptographic
 * boundary yet for independent, account-verifiable Device keys
 * (`../crypto/types.ts`, Stage 34, is a pure placeholder seam — "NO real
 * encryption... NO key generation/derivation here" — confirmed
 * unchanged by this Arc's own Phase A reconciliation). This is the exact
 * "stop at the boundary" adapter Phase E requires instead of faking
 * production Device keys.
 *
 * `authorizeRegistration()` still returns `allowed: true` — a Device
 * Registry that refuses to durably record even an unverified
 * registration ATTEMPT would be less honest, not more, than one that
 * records it plainly labeled `"unavailable"` (Phase D's own "durable
 * Device Registry" requirement; Phase B/C's own `createUnavailableFedosDeviceBinding`
 * producer exists for exactly this). What this adapter NEVER does is
 * return `capability: "verified"`, anywhere, under any input — so no
 * binding created through it can ever be promoted to `"trusted"` (see
 * `authorizeTrustConfirmation()` below, and
 * `./fedos_device_binding.ts`'s own `"pending"`-only trust-transition
 * guard). The practical guarantee this produces: a legitimate device and
 * an attacker-controlled device are EQUALLY unable to reach `"trusted"`
 * through this adapter — this Arc does not attempt to distinguish them,
 * because it cannot honestly do so yet.
 */

import type { FedosDeviceBindingV1 } from "../../../device/fedos_device_binding.js";
import type {
  FedosDeviceRegistrationAuthority,
  FedosDeviceRegistrationAuthorityDecision,
  FedosDeviceRegistrationRequest,
} from "../../../device/fedos_device_registration_authority.js";

const REGISTRATION_REASON =
  "no real account-to-device signature-verification boundary exists in this codebase (Secure Runtime Alpha 2921-3000 Phase E blocker) -- recorded as an unavailable-capability registration, never verified";

const TRUST_CONFIRMATION_REASON =
  "cannot confirm trust without real device-key signature verification -- see Secure Runtime Alpha 2921-3000 Phase E blocker; this binding can never be promoted past \"unavailable\" through this adapter";

export class UnavailableFedosDeviceRegistrationAuthority implements FedosDeviceRegistrationAuthority {
  authorizeRegistration(_request: FedosDeviceRegistrationRequest, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: true, capability: "unavailable", reason: REGISTRATION_REASON };
  }

  authorizeTrustConfirmation(_binding: FedosDeviceBindingV1, _now: number): FedosDeviceRegistrationAuthorityDecision {
    return { allowed: false, capability: "unavailable", reason: TRUST_CONFIRMATION_REASON };
  }
}
