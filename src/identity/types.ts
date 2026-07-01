/**
 * Stage 36 — Passkey Unlock boundary (types only).
 *
 * A MINIMAL, future-facing seam that fixes WebAuthn / Passkey / Face ID / Touch ID
 * as an AUTHENTICATION boundary that UNLOCKS the Vault — NOT as a key source. It
 * belongs to the FedOS Vault / Crypto / Identity layer sketched in
 * `docs/vault_crypto_identity.md`. This file defines shapes ONLY — it starts no
 * authentication, calls no WebAuthn/Passkey/Apple/Google API, launches no Face ID
 * or Touch ID, and generates or derives no key. It exists so a real unlock flow
 * can drop in later behind the same interface without the current Nostr/Cloudflare
 * core, the Vault seam, or the crypto core depending on any of it.
 *
 * HARD GUARDRAILS (see the design notes):
 *   - Passkey / Apple ID / Google Account / WebAuthn are UNLOCK TRIGGERS ONLY.
 *     They are NEVER a key-generation or key-derivation source. Nothing here turns
 *     a credential, JWT, Apple `sub`/user id, challenge/response, seed, or token
 *     into key material.
 *   - Requests carry an OPAQUE, non-secret `reference` ONLY — never a JWT,
 *     credential, secret, token, challenge response, private/public key, seed,
 *     passphrase, or raw bytes. The boundary neither stores nor derives from it.
 *   - NO Secure Enclave, NO Android Keystore, NO Credential Management API, NO
 *     OAuth, NO passkey storage — none is contacted or implemented here.
 *   - This boundary makes NO security, privacy, or "safe unlock" guarantee. Do not
 *     describe it as "safe", "zero-trace", or able to authenticate anyone.
 */

/**
 * Coarse observable state of a passkey/unlock authentication attempt. No secret,
 * credential, or key is exposed at any state.
 */
export type PasskeyStatus =
  | "idle" // ready but no authentication has been requested
  | "waiting" // an authentication WOULD be in flight (never actually started here)
  | "authenticated" // PLACEHOLDER "success" state only — the Vault is NOT unlocked
  | "cancelled" // the caller cancelled; no authentication ran
  | "unavailable" // no passkey/unlock backend is present (the no-op default)
  | "error"; // an attempt could not be served; recorded as state, never thrown

/**
 * A non-sensitive snapshot of the boundary. `reason` is human-readable and MUST
 * never contain secrets, credentials, tokens, seeds, or key material.
 */
export interface PasskeyReport {
  readonly status: PasskeyStatus;
  readonly reason: string;
}

/**
 * FUTURE authentication surfaces this boundary MIGHT expose — all PLACEHOLDERS in
 * this stage. Presence of a name is a label of intent, NOT a working, launched, or
 * safe feature. None of these is started, contacted, or implemented here.
 */
export type PasskeyCapability =
  | "faceid_placeholder" // future Face ID user-presence unlock trigger (not launched)
  | "touchid_placeholder" // future Touch ID user-presence unlock trigger (not launched)
  | "passkey_placeholder" // future platform passkey unlock trigger (no API called)
  | "external_webauthn_placeholder"; // future external WebAuthn authenticator (no API called)

/**
 * The KIND of authenticator a caller ASKS to unlock with. This names the surface
 * only; it selects no algorithm and contacts no provider.
 */
export type PasskeyAuthenticationKind =
  | "apple_passkey" // Apple platform passkey — an unlock trigger, NOT a key source
  | "android_passkey" // Android platform passkey — an unlock trigger, NOT a key source
  | "webauthn" // browser WebAuthn — an unlock trigger, NOT a key source
  | "external"; // an external authenticator/signer — an unlock trigger, NOT a key source

/**
 * How a caller ASKS to authenticate/unlock. The `kind` names the authenticator;
 * the optional `reference` is an OPAQUE, non-secret label (e.g. an account handle
 * or a UI slot id) — it is NEVER a JWT, credential, secret, token, challenge
 * response, private/public key, seed, passphrase, or raw bytes, and the boundary
 * derives nothing from it.
 */
export interface PasskeyAuthenticationRequest {
  readonly kind: PasskeyAuthenticationKind;
  /**
   * Optional OPAQUE, non-secret reference. Must not carry any credential, key
   * material, seed, passphrase, or raw token — this boundary neither stores nor
   * derives from it.
   */
  readonly reference?: string;
}

/**
 * The Passkey/unlock boundary. Implementations MUST NOT start real authentication,
 * call WebAuthn/Passkey/Apple/Google APIs, launch Face ID or Touch ID, contact a
 * Secure Enclave/Keystore, or generate/derive/store any key or credential.
 * `beginAuthentication`/`cancelAuthentication` never throw — they return a
 * non-sensitive `PasskeyReport` and move the state (including to `error`). A
 * successful `authenticated` state is a PLACEHOLDER and does NOT unlock the Vault.
 * Constructing an implementation does nothing.
 */
export interface PasskeyBoundary {
  /** Current coarse status (pure read). */
  getStatus(): PasskeyReport;
  /** The PLACEHOLDER capabilities this boundary advertises (may be empty). */
  getCapabilities(): readonly PasskeyCapability[];
  /**
   * Ask to begin authentication. Starts NO real authentication, calls no API, and
   * does NOT unlock the Vault. Reads only the request `kind`; derives nothing from
   * `reference`. Returns a status report; never throws.
   */
  beginAuthentication(request: PasskeyAuthenticationRequest): PasskeyReport;
  /** Cancel any in-flight request. Only changes state; never throws. */
  cancelAuthentication(): PasskeyReport;
}

/** Every placeholder capability name (for mapping/documentation helpers). */
export const PASSKEY_CAPABILITIES: readonly PasskeyCapability[] = [
  "faceid_placeholder",
  "touchid_placeholder",
  "passkey_placeholder",
  "external_webauthn_placeholder",
];

/** The authentication kinds this boundary recognizes (defensive runtime check). */
export const PASSKEY_AUTHENTICATION_KINDS: ReadonlySet<PasskeyAuthenticationKind> =
  new Set(["apple_passkey", "android_passkey", "webauthn", "external"]);
