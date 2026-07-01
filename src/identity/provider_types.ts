/**
 * Stage 37 — Identity Provider boundary (types only).
 *
 * A MINIMAL, future-facing seam that fixes Apple / Google / External identity
 * providers as OPAQUE AUTHENTICATION-REFERENCE providers that FEED the Passkey
 * unlock boundary and, through it, the Vault — NOT as key sources. It belongs to
 * the FedOS Vault / Crypto / Identity layer sketched in
 * `docs/vault_crypto_identity.md`. This file defines shapes ONLY — it starts no
 * sign-in, runs no OAuth, parses/stores no JWT, calls no WebAuthn/Apple/Google
 * API, launches no Face ID or Touch ID, and generates or derives no key. It exists
 * so a real provider flow can drop in later behind the same interface without the
 * current Nostr/Cloudflare core, the Passkey seam, the Vault seam, or the crypto
 * core depending on any of it.
 *
 * HARD GUARDRAILS (see the design notes):
 *   - Apple / Google / External are OPAQUE AUTHENTICATION REFERENCES ONLY. They
 *     are NEVER a key-generation or key-derivation source. Nothing here turns an
 *     OAuth token, JWT, credential, email, user profile, Apple `sub`/user id,
 *     seed, or secret into key material.
 *   - Requests and reports carry an OPAQUE, non-secret `reference` ONLY — never a
 *     JWT, OAuth token, credential, email, user profile, secret, key, or seed. The
 *     boundary neither stores nor derives from it.
 *   - NO OAuth, NO JWT parse/store, NO WebAuthn, NO Secure Enclave, NO Android
 *     Keystore, NO Face ID / Touch ID — none is contacted or implemented here.
 *   - This boundary makes NO security, privacy, or "safe sign-in" guarantee. Do
 *     not describe it as "safe", "zero-trace", or able to authenticate anyone.
 */

/**
 * The provider a caller ASKS to authenticate through. This names the surface only;
 * it selects no protocol and contacts no provider.
 */
export type IdentityProviderKind =
  | "apple" // Apple identity — an opaque reference source, NOT a key source
  | "google" // Google identity — an opaque reference source, NOT a key source
  | "external" // any external/self-hosted provider — an opaque reference source
  | "passkey"; // a platform passkey routed as a provider — NOT a key source

/**
 * Coarse observable state of a provider authentication attempt. No secret, token,
 * credential, profile, or key is exposed at any state.
 */
export type IdentityProviderStatus =
  | "idle" // ready but no authentication has been requested
  | "waiting" // an authentication WOULD be in flight (never actually started here)
  | "authenticated" // PLACEHOLDER "success" state only — no token/key is held
  | "cancelled" // the caller cancelled; no authentication ran
  | "unavailable" // no provider backend is present (the no-op default)
  | "error"; // an attempt could not be served; recorded as state, never thrown

/**
 * FUTURE providers this boundary MIGHT expose — all PLACEHOLDERS in this stage.
 * Presence of a name is a label of intent, NOT a working, wired, or safe feature.
 * None of these is started, contacted, or implemented here.
 */
export type IdentityProviderCapability =
  | "apple_placeholder" // future Apple provider (no Sign-In, no OAuth, no JWT)
  | "google_placeholder" // future Google provider (no Sign-In, no OAuth, no JWT)
  | "external_placeholder" // future external provider (no OAuth, no JWT)
  | "passkey_bridge_placeholder"; // future routing of a passkey through the provider seam

/**
 * How a caller ASKS to authenticate through a provider. The `kind` names the
 * provider; the optional `reference` is an OPAQUE, non-secret label (e.g. an
 * account handle or a UI slot id) — it is NEVER a JWT, OAuth token, credential,
 * email, user profile, secret, key, or seed, and the boundary derives nothing
 * from it.
 */
export interface IdentityProviderRequest {
  readonly kind: IdentityProviderKind;
  /**
   * Optional OPAQUE, non-secret reference. Must not carry any token, credential,
   * email, profile, key material, or seed — this boundary neither stores nor
   * derives from it.
   */
  readonly reference?: string;
}

/**
 * A non-sensitive snapshot of an attempt. Carries only a coarse `status`, the
 * echoed provider `kind`, the same OPAQUE `reference`, and a human-readable
 * `reason`. MUST never contain a token, credential, email, profile, seed, or key.
 */
export interface IdentityProviderReport {
  readonly status: IdentityProviderStatus;
  readonly kind?: IdentityProviderKind;
  /** The same OPAQUE, non-secret reference from the request, if any. Never a secret. */
  readonly reference?: string;
  readonly reason?: string;
}

/**
 * The Identity Provider boundary. Implementations MUST NOT start real sign-in, run
 * OAuth, parse/store a JWT, call WebAuthn/Apple/Google APIs, launch Face ID or
 * Touch ID, contact a Secure Enclave/Keystore, or generate/derive/store any key,
 * token, or credential. `begin`/`cancel` never throw — they return a non-sensitive
 * `IdentityProviderReport` and move the state (including to `error`). A successful
 * `authenticated` state is a PLACEHOLDER and unlocks nothing. Constructing an
 * implementation does nothing.
 */
export interface IdentityProviderBoundary {
  /** Current coarse status (pure read). */
  getStatus(): IdentityProviderReport;
  /** The PLACEHOLDER capabilities this boundary advertises (may be empty). */
  getCapabilities(): readonly IdentityProviderCapability[];
  /**
   * Ask to begin authentication. Starts NO real sign-in, runs no OAuth, parses no
   * JWT, calls no API, and unlocks nothing. Reads only the request `kind`; derives
   * nothing from `reference`. Returns a status report; never throws.
   */
  begin(request: IdentityProviderRequest): IdentityProviderReport;
  /** Cancel any in-flight request. Only changes state; never throws. */
  cancel(): IdentityProviderReport;
}

/** Every placeholder capability name (for mapping/documentation helpers). */
export const IDENTITY_PROVIDER_CAPABILITIES: readonly IdentityProviderCapability[] = [
  "apple_placeholder",
  "google_placeholder",
  "external_placeholder",
  "passkey_bridge_placeholder",
];

/** The provider kinds this boundary recognizes (defensive runtime check). */
export const IDENTITY_PROVIDER_KINDS: ReadonlySet<IdentityProviderKind> = new Set([
  "apple",
  "google",
  "external",
  "passkey",
]);
