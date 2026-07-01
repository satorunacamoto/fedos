/**
 * Stage 37 — Identity Provider boundary implementations.
 *
 * Two safe defaults for the `IdentityProviderBoundary` seam. NEITHER starts real
 * sign-in, runs OAuth, parses/stores a JWT, calls a WebAuthn/Apple/Google API,
 * launches Face ID or Touch ID, touches a Secure Enclave/Keystore,
 * generates/derives/stores a key, or unlocks anything. Every method is total and
 * never throws.
 *
 *   - `NoopIdentityProvider` is the permanently `unavailable` default: it
 *     advertises nothing and every attempt is denied.
 *   - `PlaceholderIdentityProvider` (dev/test) models an
 *     `idle → (placeholder) authenticated ↔ cancelled` lifecycle holding ONLY a
 *     coarse `IdentityProviderReport` (status + echoed kind + the same OPAQUE
 *     reference + a reason). Its `authenticated` state is a LABEL — no token,
 *     credential, or key is held and nothing is unlocked.
 *
 * These exist so callers can depend on the seam without a real provider backend,
 * exactly as the app depends on mock/no-op defaults elsewhere. NEITHER is wired
 * into the runtime or Worker.
 */

import type {
  IdentityProviderBoundary,
  IdentityProviderCapability,
  IdentityProviderReport,
  IdentityProviderRequest,
} from "./provider_types.js";

export class NoopIdentityProvider implements IdentityProviderBoundary {
  constructor() {
    // Does nothing: no provider contacted, no token/credential/key created.
  }

  getStatus(): IdentityProviderReport {
    return { status: "unavailable", reason: "no identity provider backend is configured" };
  }

  getCapabilities(): readonly IdentityProviderCapability[] {
    // No backend present -> advertises nothing.
    return [];
  }

  begin(_request: IdentityProviderRequest): IdentityProviderReport {
    // Reads nothing from the request; runs no OAuth/JWT/WebAuthn; unlocks nothing.
    return {
      status: "unavailable",
      reason: "no identity provider backend is configured (authentication not started)",
    };
  }

  cancel(): IdentityProviderReport {
    return { status: "unavailable", reason: "no identity provider backend is configured" };
  }
}

/**
 * A dev/test provider that models the sign-in UX states WITHOUT doing any of it.
 * `begin` returns a PLACEHOLDER `authenticated` report echoing only the provider
 * `kind` and the same OPAQUE `reference` — it runs no OAuth, parses no JWT, calls
 * no API, holds no token/credential/profile, and unlocks nothing.
 */
export class PlaceholderIdentityProvider implements IdentityProviderBoundary {
  #report: IdentityProviderReport = {
    status: "idle",
    reason: "ready (no authentication requested)",
  };

  constructor() {
    // Does nothing: state starts idle; no provider is contacted.
  }

  getStatus(): IdentityProviderReport {
    return this.#report;
  }

  getCapabilities(): readonly IdentityProviderCapability[] {
    // Advertises the placeholder providers it WOULD offer — none is started.
    return [
      "apple_placeholder",
      "google_placeholder",
      "external_placeholder",
      "passkey_bridge_placeholder",
    ];
  }

  begin(request: IdentityProviderRequest): IdentityProviderReport {
    // Reads ONLY the request kind and echoes the same OPAQUE reference. Derives
    // nothing, holds no token/credential/profile, runs no OAuth/JWT/WebAuthn, and
    // unlocks nothing. The `authenticated` status is a placeholder label.
    this.#report = {
      status: "authenticated",
      kind: request.kind,
      reference: request.reference,
      reason: `placeholder authentication for ${request.kind} (no OAuth/JWT/WebAuthn, nothing unlocked)`,
    };
    return this.#report;
  }

  cancel(): IdentityProviderReport {
    this.#report = { status: "cancelled", reason: "authentication cancelled by caller" };
    return this.#report;
  }
}
