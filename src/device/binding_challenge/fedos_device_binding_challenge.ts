/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase C: the canonical, versioned Device Binding Challenge.
 *
 * This is the ONE payload both signatures this Arc defines are computed
 * over: the account's authorization signature
 * (`./fedos_device_binding_account_authorization.ts`, Phase D) and the
 * Device's proof of possession (`./fedos_device_binding_proof_of_possession.ts`,
 * Phase E). Every field that participates in EITHER signature lives here —
 * neither signer trusts a field supplied outside this struct.
 *
 * `domain` is a FIXED constant, never caller-supplied — it is this Arc's own
 * domain separator, preventing a signature produced for this protocol from
 * ever being replayed as authorization for a different protocol/purpose, and
 * vice versa (a legitimate kind:1 Nostr text note can never collide with this
 * shape, since `domain` would have to appear verbatim as this exact string).
 *
 * `action` fixes which of the two operations (Phase G/H) this challenge may
 * authorize — a "register-device" challenge can never be replayed to
 * authorize a revocation, or vice versa, because `action` is part of the
 * signed content.
 *
 * Canonical serialization (`serializeFedosDeviceBindingChallengeV1`) uses a
 * fixed-order ARRAY tuple — mirroring `src/nostr/event.ts`'s own
 * `serializeForId()` array-tuple convention exactly — so there is no object
 * key-ordering ambiguity and no canonical-JSON dependency is needed.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

export const FEDOS_DEVICE_BINDING_DOMAIN_V1 = "fedos:device-binding:v1";

export type FedosDeviceBindingChallengeAction = "register-device" | "revoke-device";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_HEX_PATTERN = /^[0-9a-f]{32,64}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;

export interface FedosDeviceBindingChallengeV1 {
  readonly schemaVersion: 1;
  /** Fixed domain separator — MUST equal `FEDOS_DEVICE_BINDING_DOMAIN_V1`. */
  readonly domain: string;
  readonly action: FedosDeviceBindingChallengeAction;
  readonly deviceId: string;
  /** The independent Device public key this challenge names — 64-char lowercase hex. */
  readonly devicePublicKeyHex: string;
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds; MUST be strictly greater than `issuedAt`. */
  readonly expiresAt: number;
  /** Unique per challenge — the replay key (`../persistence/fedos_persisted_device_binding_challenge_consumption_v1.ts`). 32-64 lowercase hex chars. */
  readonly nonce: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural + field-shape validation only — does NOT check signatures, expiry, or replay. Fails closed; never throws. */
export function isWellFormedFedosDeviceBindingChallengeV1(candidate: unknown): candidate is FedosDeviceBindingChallengeV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 8) return false;
  if (value.schemaVersion !== 1) return false;
  if (value.domain !== FEDOS_DEVICE_BINDING_DOMAIN_V1) return false;
  if (value.action !== "register-device" && value.action !== "revoke-device") return false;
  if (!isNonEmptyString(value.deviceId) || !DEVICE_ID_PATTERN.test(value.deviceId)) return false;
  if (typeof value.devicePublicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value.devicePublicKeyHex)) return false;
  if (!isValidUnixSeconds(value.issuedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt)) return false;
  if (value.expiresAt <= value.issuedAt) return false;
  if (typeof value.nonce !== "string" || !NONCE_HEX_PATTERN.test(value.nonce)) return false;
  return true;
}

/**
 * Deterministic, unambiguous canonical serialization — the exact preimage
 * both signers hash. A fixed-order array tuple (mirrors `src/nostr/event.ts`'s
 * `serializeForId()`), so no object-key-ordering concern exists. Callers MUST
 * validate with `isWellFormedFedosDeviceBindingChallengeV1()` first — this
 * function does not itself validate.
 */
export function serializeFedosDeviceBindingChallengeV1(challenge: FedosDeviceBindingChallengeV1): string {
  return JSON.stringify([
    challenge.domain,
    challenge.schemaVersion,
    challenge.action,
    challenge.deviceId,
    challenge.devicePublicKeyHex,
    challenge.issuedAt,
    challenge.expiresAt,
    challenge.nonce,
  ]);
}

export function isFedosDeviceBindingChallengeExpired(challenge: FedosDeviceBindingChallengeV1, now: number): boolean {
  return now > challenge.expiresAt;
}

/** Mints a fresh, opaque nonce suitable for `FedosDeviceBindingChallengeV1.nonce`. Mirrors `FedosConversationEnvelopeIdGenerator`'s own pure-interface shape. */
export interface FedosDeviceBindingChallengeNonceGenerator {
  generateNonce(): string;
}

/** The default generator: 16 bytes (128 bits) of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded — the same margin `FedosSecureRandomConversationEnvelopeIdGenerator` (Alpha 853) already uses. */
export class FedosSecureRandomDeviceBindingChallengeNonceGenerator implements FedosDeviceBindingChallengeNonceGenerator {
  generateNonce(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}
