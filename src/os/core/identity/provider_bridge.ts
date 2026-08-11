/**
 * Stage 37 — pure mapping from an Identity Provider request/report to the Passkey
 * unlock request and the Vault unlock request.
 *
 * A future flow would translate "the user authenticated through Apple/Google/an
 * external provider" into "route it through the Passkey unlock seam" and/or "ask
 * the Vault to unlock". These helpers are the pure, side-effect-free glue: they map
 * the provider `kind` to a `PasskeyAuthenticationKind` / `VaultUnlockKind` and pass
 * the OPAQUE, non-secret `reference` through unchanged. They derive NO key, create
 * NO seed from Apple / Google / External, hold NO token/credential/profile, run no
 * OAuth/JWT/WebAuthn, call no crypto, and touch no runtime. They take TYPE-ONLY
 * dependencies on the Passkey and Vault types; they do NOT wire the provider into
 * the passkey seam, the vault, the runtime, or the Worker.
 *
 * Apple / Google / External are OPAQUE AUTHENTICATION REFERENCES ONLY — never a key
 * source. The produced requests carry only a `kind` and the same opaque reference;
 * the Passkey and Vault boundaries derive nothing from them either.
 */

import type { VaultUnlockKind, VaultUnlockRequest } from "../vault/types.js";
import type {
  PasskeyAuthenticationKind,
  PasskeyAuthenticationRequest,
} from "./types.js";
import type {
  IdentityProviderKind,
  IdentityProviderReport,
  IdentityProviderRequest,
} from "./provider_types.js";

/** Accepts a provider request OR a provider report (both carry kind + reference). */
export type IdentityProviderBridgeInput =
  | IdentityProviderRequest
  | IdentityProviderReport;

/** Provider kind -> the Passkey authenticator it routes through. Labels only. */
const PROVIDER_TO_PASSKEY_KIND: Record<
  IdentityProviderKind,
  PasskeyAuthenticationKind
> = {
  apple: "apple_passkey",
  google: "android_passkey",
  external: "external",
  passkey: "webauthn",
};

/** Provider kind -> the Vault unlock factor it triggers. Labels only. */
const PROVIDER_TO_VAULT_KIND: Record<IdentityProviderKind, VaultUnlockKind> = {
  apple: "apple_id",
  google: "passkey",
  external: "external_signer",
  passkey: "passkey",
};

/**
 * Resolve the provider kind. A request always carries one; a report's kind is
 * optional, so an unknown/absent kind falls back to the most generic OPAQUE
 * provider (`external`). This fabricates no identity and derives nothing.
 */
function resolveKind(input: IdentityProviderBridgeInput): IdentityProviderKind {
  return input.kind ?? "external";
}

/**
 * Convert a provider request/report into a Passkey authentication request. Pure and
 * total: it does not mutate the input, derives no key, and returns a new object.
 * The opaque `reference` is passed through unchanged (only when present).
 */
export function identityProviderToPasskeyRequest(
  input: IdentityProviderBridgeInput,
): PasskeyAuthenticationRequest {
  const kind = PROVIDER_TO_PASSKEY_KIND[resolveKind(input)];
  return input.reference === undefined
    ? { kind }
    : { kind, reference: input.reference };
}

/**
 * Convert a provider request/report into a Vault unlock request. Pure and total: it
 * does not mutate the input, derives no key, and returns a new object. The opaque
 * `reference` is passed through unchanged (only when present); nothing secret is
 * transported or created, and the Vault is NOT unlocked here.
 */
export function identityProviderToVaultRequest(
  input: IdentityProviderBridgeInput,
): VaultUnlockRequest {
  const kind = PROVIDER_TO_VAULT_KIND[resolveKind(input)];
  return input.reference === undefined
    ? { kind }
    : { kind, reference: input.reference };
}
