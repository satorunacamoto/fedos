/**
 * Stage 109 — Nearby consent provider implementations.
 *
 * Two safe defaults for the `NearbyConsentProvider` seam (see `./types.js`).
 * NEITHER calls a browser geolocation API, requests an OS location
 * permission, computes an area id, or issues a `fetch`. Every method is
 * total and never throws, and NEITHER implementation ever returns
 * `allowed: true` — Nearby Discovery has no real, informed consent UI yet
 * (see `docs/nearby_consent_policy.md`), so nothing here may claim consent
 * was given.
 *
 *   - `NoopNearbyConsentProvider` is the permanently `unavailable` default:
 *     it advertises nothing and denies every attempt.
 *   - `PlaceholderNearbyConsentProvider` (dev/test) models the `denied` UX
 *     state and advertises the placeholder capabilities a future consent
 *     flow would offer — but its `requestConsent` STILL always resolves
 *     `denied`. Unlike every other placeholder in this codebase, this one
 *     never reaches an "accepted"-shaped state: granting consent without a
 *     real UI would misrepresent what the user agreed to.
 *
 * These exist so callers can depend on the seam without a real consent UI,
 * exactly as the app depends on mock/no-op defaults elsewhere. NEITHER is
 * wired into the runtime, the Worker, or `StorageBackend`.
 */

import type {
  NearbyConsentCapability,
  NearbyConsentDecision,
  NearbyConsentProvider,
  NearbyConsentRequest,
} from "./types.js";

export class NoopNearbyConsentProvider implements NearbyConsentProvider {
  constructor() {
    // Does nothing: no provider present, no permission API contacted.
  }

  getStatus(): NearbyConsentDecision {
    return {
      allowed: false,
      status: "unavailable",
      reason: "no Nearby consent provider is configured",
    };
  }

  getCapabilities(): readonly NearbyConsentCapability[] {
    // No provider present -> advertises nothing.
    return [];
  }

  async requestConsent(_request: NearbyConsentRequest): Promise<NearbyConsentDecision> {
    // Reads nothing from the request; starts no permission flow; grants nothing.
    return {
      allowed: false,
      status: "unavailable",
      reason: "no Nearby consent provider is configured (nothing requested)",
    };
  }

  async revokeConsent(): Promise<NearbyConsentDecision> {
    return {
      allowed: false,
      status: "unavailable",
      reason: "no Nearby consent provider is configured",
    };
  }

  isGranted(): boolean {
    return false;
  }
}

/**
 * A dev/test provider that models the Nearby consent UX state WITHOUT ever
 * granting anything. `requestConsent` reads only the opaque `reference` and
 * ALWAYS resolves `denied` — there is no real consent UI to grant through
 * yet, so claiming `allowed: true` here would misrepresent user consent (see
 * `docs/nearby_consent_policy.md` §2, §7). `revokeConsent` is a safe no-op.
 */
export class PlaceholderNearbyConsentProvider implements NearbyConsentProvider {
  #decision: NearbyConsentDecision = {
    allowed: false,
    status: "denied",
    reason: "Nearby Discovery has no consent UI yet; consent defaults to denied",
  };

  constructor() {
    // Does nothing: no permission API is contacted.
  }

  getStatus(): NearbyConsentDecision {
    return this.#decision;
  }

  getCapabilities(): readonly NearbyConsentCapability[] {
    // Advertises the placeholder surfaces a future consent flow WOULD offer —
    // none is launched, and none of them changes what requestConsent returns.
    return ["explicit_opt_in_placeholder", "revocation_placeholder", "area_indexing_placeholder"];
  }

  async requestConsent(_request: NearbyConsentRequest): Promise<NearbyConsentDecision> {
    // Deliberately ALWAYS denied: no browser/OS permission is requested, and
    // no UI exists to obtain informed consent through in this stage.
    this.#decision = {
      allowed: false,
      status: "denied",
      reason: "no consent UI exists yet; Nearby Discovery cannot be enabled in this stage",
    };
    return this.#decision;
  }

  async revokeConsent(): Promise<NearbyConsentDecision> {
    this.#decision = {
      allowed: false,
      status: "denied",
      reason: "consent revoked (was never granted)",
    };
    return this.#decision;
  }

  isGranted(): boolean {
    return false;
  }
}
