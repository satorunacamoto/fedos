/**
 * Stage 60 — WebAuthn / Passkey provider ADAPTER skeleton (boundary only).
 *
 * A future browser provider that a real unlock flow would hand to the Stage 36
 * `PasskeyBoundary`. This stage ships the ADAPTER SEAM ONLY: it names the states
 * and capabilities a browser WebAuthn provider WOULD expose and models the
 * `idle → (placeholder) authenticated ↔ cancelled` UX — WITHOUT touching a
 * browser credential API, an authenticator, or any key.
 *
 * HARD GUARDRAILS (see `docs/vault_crypto_identity.md`):
 *   - Calls NO browser credential API (no `.create()`/`.get()` on any credential
 *     manager). Launches NO Face ID / Touch ID, contacts NO Secure Enclave /
 *     Android Keystore, and runs NO conditional-UI / autofill flow.
 *   - WebAuthn / Passkey / Apple ID / Google Account are UNLOCK TRIGGERS ONLY —
 *     NEVER a key-generation or key-derivation source. Nothing here turns a
 *     credential, challenge/response, attestation, assertion, JWT, or Apple/Google
 *     user id into key material.
 *   - Requests carry OPAQUE, non-secret labels ONLY (`reference`, `rpIdRef`,
 *     `userRef`) — never a challenge, credential id, rawId, response,
 *     attestation, assertion, token, or raw bytes. The adapter neither stores nor
 *     derives from them. Reports carry only a coarse status + non-sensitive reason.
 *   - Every method is total and never throws. `cancel()` only changes state.
 *   - This adapter makes NO security/privacy/"safe unlock" guarantee, and is NOT
 *     wired into the runtime or the Worker.
 */

import type {
  PasskeyAuthenticationKind,
  PasskeyAuthenticationRequest,
} from "./types.js";

/**
 * Coarse observable state of a WebAuthn adapter attempt. No credential,
 * challenge, token, or key is exposed at any state.
 */
export type WebAuthnAdapterStatus =
  | "unavailable" // no browser provider is present (the no-op default)
  | "idle" // ready but no request has been made
  | "waiting" // a request WOULD be in flight (never actually started here)
  | "authenticated_placeholder" // PLACEHOLDER "success" — the Vault is NOT unlocked
  | "cancelled" // the caller cancelled; nothing ran
  | "error"; // an attempt could not be served; recorded as state, never thrown

/**
 * A non-sensitive snapshot of the adapter. `reason` is human-readable and MUST
 * never contain a challenge, credential id, rawId, response, attestation,
 * assertion, token, or key material.
 */
export interface WebAuthnReport {
  readonly status: WebAuthnAdapterStatus;
  readonly reason: string;
}

/**
 * FUTURE browser surfaces a real adapter MIGHT expose — all PLACEHOLDERS in this
 * stage. Presence of a name is a label of intent, NOT a working, launched, or
 * safe feature. None of these is started, contacted, or implemented here.
 */
export type WebAuthnAdapterCapability =
  | "webauthn_placeholder" // future browser WebAuthn (no API called)
  | "platform_authenticator_placeholder" // future platform authenticator (Face ID/Touch ID) — not launched
  | "cross_platform_authenticator_placeholder" // future roaming/security-key authenticator — not contacted
  | "conditional_ui_placeholder"; // future conditional-UI / autofill — not run

/**
 * How a caller ASKS the adapter to act. `kind` names the WebAuthn operation
 * (`get` = assertion / `create` = registration) only; it selects no algorithm
 * and contacts no provider. `reference`/`rpIdRef`/`userRef` are OPAQUE,
 * non-secret labels (e.g. a UI slot id, a display name for the relying party, a
 * user handle label) — NEVER a challenge, credential id, rawId, response,
 * attestation, assertion, token, or raw bytes. The adapter derives nothing from
 * them.
 */
export interface WebAuthnAdapterRequest {
  readonly kind: "get" | "create";
  /** Optional OPAQUE, non-secret reference (e.g. a UI slot id). */
  readonly reference?: string;
  /** Optional OPAQUE, non-secret relying-party label — NOT an rpId secret/origin. */
  readonly rpIdRef?: string;
  /** Optional OPAQUE, non-secret user label — NOT a user handle/credential id. */
  readonly userRef?: string;
}

/**
 * The browser WebAuthn provider seam. Implementations MUST NOT call a browser
 * credential API, launch a biometric, contact a Secure Enclave/Keystore, or
 * generate/derive/store any key or credential. `begin`/`cancel` never throw —
 * they return a non-sensitive `WebAuthnReport` and move the state (including to
 * `error`). A successful `authenticated_placeholder` state is a PLACEHOLDER and
 * does NOT unlock the Vault. Constructing an implementation does nothing.
 */
export interface WebAuthnProvider {
  /** Current coarse status (pure read). */
  getStatus(): WebAuthnReport;
  /** The PLACEHOLDER capabilities this provider advertises (may be empty). */
  getCapabilities(): readonly WebAuthnAdapterCapability[];
  /**
   * Ask to begin a WebAuthn `get`/`create`. Starts NO real request, calls no
   * browser API, and does NOT unlock the Vault. Reads only the request `kind`;
   * derives nothing from the opaque labels. Returns a report; never throws.
   */
  begin(request: WebAuthnAdapterRequest): WebAuthnReport;
  /** Cancel any in-flight request. Only changes state; never throws. */
  cancel(): WebAuthnReport;
}

/** Every placeholder capability name (for mapping/documentation helpers). */
export const WEBAUTHN_ADAPTER_CAPABILITIES: readonly WebAuthnAdapterCapability[] = [
  "webauthn_placeholder",
  "platform_authenticator_placeholder",
  "cross_platform_authenticator_placeholder",
  "conditional_ui_placeholder",
];

/**
 * The permanently-`unavailable` default. It advertises nothing and every attempt
 * is denied. It calls no browser API, launches no biometric, and holds nothing.
 */
export class NoopWebAuthnProvider implements WebAuthnProvider {
  constructor() {
    // Does nothing: no provider present, no authenticator contacted.
  }

  getStatus(): WebAuthnReport {
    return { status: "unavailable", reason: "no WebAuthn browser provider is configured" };
  }

  getCapabilities(): readonly WebAuthnAdapterCapability[] {
    // No provider present -> advertises nothing.
    return [];
  }

  begin(_request: WebAuthnAdapterRequest): WebAuthnReport {
    // Reads nothing from the request; starts no request; unlocks no vault.
    return {
      status: "unavailable",
      reason: "no WebAuthn browser provider is configured (request not started)",
    };
  }

  cancel(): WebAuthnReport {
    return { status: "unavailable", reason: "no WebAuthn browser provider is configured" };
  }
}

/**
 * A dev/test adapter that models the WebAuthn UX states WITHOUT doing any of it.
 * `begin` returns a PLACEHOLDER `authenticated_placeholder` report — it calls no
 * browser API, launches no biometric, holds no credential/challenge, and does NOT
 * unlock the Vault. It retains ONLY a coarse `WebAuthnReport`.
 */
export class PlaceholderWebAuthnProvider implements WebAuthnProvider {
  #report: WebAuthnReport = { status: "idle", reason: "ready (no request made)" };

  constructor() {
    // Does nothing: state starts idle; no authenticator is contacted.
  }

  getStatus(): WebAuthnReport {
    return this.#report;
  }

  getCapabilities(): readonly WebAuthnAdapterCapability[] {
    // Advertises the placeholder surfaces it WOULD offer — none is launched.
    return [
      "webauthn_placeholder",
      "platform_authenticator_placeholder",
      "cross_platform_authenticator_placeholder",
      "conditional_ui_placeholder",
    ];
  }

  begin(request: WebAuthnAdapterRequest): WebAuthnReport {
    // Reads ONLY the request kind. Derives nothing from the opaque labels, holds
    // no credential/challenge/response, calls no browser API, and does NOT unlock
    // the Vault. The status is a placeholder label, not a real WebAuthn result.
    this.#report = {
      status: "authenticated_placeholder",
      reason: `placeholder ${request.kind} (no browser API called, vault NOT unlocked)`,
    };
    return this.#report;
  }

  cancel(): WebAuthnReport {
    this.#report = { status: "cancelled", reason: "request cancelled by caller" };
    return this.#report;
  }
}

/**
 * Pure bridge: a WebAuthn adapter request -> a Stage 36 `PasskeyAuthenticationRequest`.
 *
 * A future unlock flow would translate "the browser produced a WebAuthn get/create"
 * into "ask the Passkey boundary to authenticate". This helper is the pure,
 * side-effect-free glue: both `get` and `create` map to the `"webauthn"` unlock
 * TRIGGER (WebAuthn is never a key source), and the OPAQUE, non-secret `reference`
 * is passed through unchanged when present — the WebAuthn-specific `rpIdRef`/
 * `userRef` labels are deliberately NOT forwarded. It generates NO key, derives
 * NOTHING, holds no credential/challenge, does NOT unlock the Vault, and keeps its
 * dependency on the Passkey types TYPE-ONLY. Total and non-mutating: it returns a
 * new object and never touches the input.
 *
 * The produced kind is always one of `"webauthn"` / `"external"` (never
 * `apple_passkey`/`android_passkey` — the adapter cannot know the platform); a
 * browser WebAuthn adapter always triggers the `"webauthn"` factor.
 */
export function webauthnReportToPasskeyRequest(
  request: WebAuthnAdapterRequest,
): PasskeyAuthenticationRequest {
  const kind: PasskeyAuthenticationKind = "webauthn";
  return request.reference === undefined
    ? { kind }
    : { kind, reference: request.reference };
}
