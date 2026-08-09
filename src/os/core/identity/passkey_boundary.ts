/**
 * Stage 36 — Passkey/unlock boundary implementations.
 *
 * Two safe defaults for the `PasskeyBoundary` seam. NEITHER starts real
 * authentication, calls a WebAuthn/Passkey/Apple/Google API, launches Face ID or
 * Touch ID, touches a Secure Enclave/Keystore, generates/derives/stores a key, or
 * unlocks the Vault. Every method is total and never throws.
 *
 *   - `NoopPasskeyBoundary` is the permanently `unavailable` default: it
 *     advertises nothing and every attempt is denied.
 *   - `PlaceholderPasskeyBoundary` (dev/test) models an
 *     `idle → (placeholder) authenticated ↔ cancelled` lifecycle holding ONLY a
 *     coarse `PasskeyReport`. Its `authenticated` state is a LABEL — no credential
 *     is held and the Vault is NOT unlocked.
 *
 * These exist so callers can depend on the seam without a real unlock backend,
 * exactly as the app depends on mock/no-op defaults elsewhere. NEITHER is wired
 * into the runtime or Worker.
 */

import type {
  PasskeyAuthenticationRequest,
  PasskeyBoundary,
  PasskeyCapability,
  PasskeyReport,
} from "./types.js";

export class NoopPasskeyBoundary implements PasskeyBoundary {
  constructor() {
    // Does nothing: no authenticator contacted, no credential/key created.
  }

  getStatus(): PasskeyReport {
    return { status: "unavailable", reason: "no passkey/unlock backend is configured" };
  }

  getCapabilities(): readonly PasskeyCapability[] {
    // No backend present -> advertises nothing.
    return [];
  }

  beginAuthentication(_request: PasskeyAuthenticationRequest): PasskeyReport {
    // Reads nothing from the request; starts no authentication; unlocks no vault.
    return {
      status: "unavailable",
      reason: "no passkey/unlock backend is configured (authentication not started)",
    };
  }

  cancelAuthentication(): PasskeyReport {
    return { status: "unavailable", reason: "no passkey/unlock backend is configured" };
  }
}

/**
 * A dev/test boundary that models the unlock UX states WITHOUT doing any of it.
 * `beginAuthentication` returns a PLACEHOLDER `authenticated` report — it calls no
 * API, launches no biometric, holds no credential, and does NOT unlock the Vault.
 */
export class PlaceholderPasskeyBoundary implements PasskeyBoundary {
  #report: PasskeyReport = { status: "idle", reason: "ready (no authentication requested)" };

  constructor() {
    // Does nothing: state starts idle; no authenticator is contacted.
  }

  getStatus(): PasskeyReport {
    return this.#report;
  }

  getCapabilities(): readonly PasskeyCapability[] {
    // Advertises the placeholder surfaces it WOULD offer — none is launched.
    return [
      "faceid_placeholder",
      "touchid_placeholder",
      "passkey_placeholder",
      "external_webauthn_placeholder",
    ];
  }

  beginAuthentication(request: PasskeyAuthenticationRequest): PasskeyReport {
    // Reads ONLY the request kind. Derives nothing from `reference`, holds no
    // credential, calls no API, and does NOT unlock the Vault. The `authenticated`
    // status is a placeholder label, not a real authentication result.
    this.#report = {
      status: "authenticated",
      reason: `placeholder authentication for ${request.kind} (no API called, vault NOT unlocked)`,
    };
    return this.#report;
  }

  cancelAuthentication(): PasskeyReport {
    this.#report = { status: "cancelled", reason: "authentication cancelled by caller" };
    return this.#report;
  }
}
