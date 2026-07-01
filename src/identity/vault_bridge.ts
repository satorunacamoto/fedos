/**
 * Stage 36 — pure mapping from a Passkey authentication request to a Vault unlock
 * request.
 *
 * A future unlock flow would translate "the user passed a Passkey/biometric" into
 * "ask the Vault to unlock". This helper is the pure, side-effect-free glue: it
 * maps the authenticator `kind` to a `VaultUnlockKind` and passes through the
 * OPAQUE, non-secret `reference` unchanged. It derives NO key, creates NO seed
 * from Apple ID / Google / WebAuthn, holds NO credential, calls no crypto, and
 * touches no runtime. It takes a TYPE-ONLY dependency on the Vault types; it does
 * NOT wire passkey unlock into the vault, the runtime, or the Worker.
 *
 * Passkey / Apple ID / Google Account / WebAuthn are UNLOCK TRIGGERS ONLY — never
 * a key source. The produced `VaultUnlockRequest` carries only a `kind` and the
 * same opaque reference; the Vault boundary derives nothing from it either.
 */

import type { VaultUnlockKind, VaultUnlockRequest } from "../vault/types.js";
import type {
  PasskeyAuthenticationKind,
  PasskeyAuthenticationRequest,
} from "./types.js";

/** Authenticator kind -> the Vault unlock factor it triggers. Labels only. */
const PASSKEY_TO_VAULT_KIND: Record<PasskeyAuthenticationKind, VaultUnlockKind> = {
  apple_passkey: "passkey",
  android_passkey: "passkey",
  webauthn: "passkey",
  external: "external_signer",
};

/**
 * Convert a Passkey authentication request into a Vault unlock request. Pure and
 * total: it does not mutate the input, derives no key, and returns a new object.
 * The opaque `reference` is passed through unchanged (only when present); nothing
 * secret is transported or created.
 */
export function passkeyAuthenticationToVaultRequest(
  request: PasskeyAuthenticationRequest,
): VaultUnlockRequest {
  const kind = PASSKEY_TO_VAULT_KIND[request.kind];
  return request.reference === undefined
    ? { kind }
    : { kind, reference: request.reference };
}
