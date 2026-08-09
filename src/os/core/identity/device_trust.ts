/**
 * Stage 128 — Device trust label boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "what trust LABEL applies to a registered
 * device" — mirrors `../creator/profile.ts`'s `CreatorTrustLabel`
 * convention, applied to `./device_registration.ts`'s registration records
 * instead of creator profiles. NO real device attestation, fingerprinting,
 * or authentication of any kind is performed anywhere in this file.
 *
 * HARD GUARDRAILS:
 *   - NO password, recovery phrase, mnemonic, seed, backup, export,
 *     import, sync, or authentication field of any kind.
 *   - `reviewDeviceTrust` evaluates a decision ONLY — it never contacts
 *     `StorageBackend`, `IdentityProviderBoundary`, or `PasskeyBoundary`,
 *     and never performs real device attestation.
 *   - This boundary makes NO security guarantee. Do not describe an
 *     `accepted_placeholder` decision as "verified", "attested", or
 *     "authenticated".
 */

/**
 * A fixed device-trust category label — never a real attestation result.
 * Mirrors `../creator/profile.ts`'s `CreatorTrustLabel` naming convention.
 */
export type DeviceTrustLabel =
  | "unknown_placeholder"
  | "trusted_placeholder"
  | "new_device_placeholder"
  | "revoked_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one device trust assessment. Carries NO
 * password/recovery-phrase/mnemonic/seed/backup/export/import/sync/
 * authentication field of any kind — only opaque labels, a fixed trust
 * label, and metadata strings.
 */
export interface DeviceTrustDescriptor {
  /** OPAQUE label a real route would resolve to its own trust-record id. */
  readonly idRef?: string;
  /** OPAQUE label to the device (e.g. `DeviceRegistrationDescriptor.deviceRef`). */
  readonly deviceRef?: string;
  readonly label: DeviceTrustLabel;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewDeviceTrust`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of a trust review. No attestation data is exposed at any state. */
export type DeviceTrustState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing a device trust assessment. `accepted_placeholder`
 * means the LABEL is policy-clean — NOT that any real attestation,
 * fingerprinting, or authentication happened.
 */
export interface DeviceTrustDecision {
  readonly allowed: boolean;
  readonly state: DeviceTrustState;
  readonly reason: string;
}

/** Every device-trust-label value (for mapping/documentation helpers). */
export const DEVICE_TRUST_LABELS: readonly DeviceTrustLabel[] = [
  "unknown_placeholder",
  "trusted_placeholder",
  "new_device_placeholder",
  "revoked_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Mirrors `./device_registration.ts`'s identity/device-specific prohibited
 * family.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "password",
  "recovery",
  "phrase",
  "mnemonic",
  "backup",
  "export",
  "import",
  "sync",
  "auth",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/credential content. */
export function isSensitiveDeviceTrustValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveDeviceTrustValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether a device trust assessment may be handed to a (future)
 * route. Rejects (never throws) when `metadata` contains a sensitive
 * key/value. A clean assessment is `accepted_placeholder` — a PLACEHOLDER
 * acceptance that attests/authenticates nothing. Never mutates `trust`,
 * never contacts `StorageBackend`, `IdentityProviderBoundary`, or
 * `PasskeyBoundary`.
 */
export function reviewDeviceTrust(trust: DeviceTrustDescriptor): DeviceTrustDecision {
  if (hasSensitiveMetadata(trust.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "device trust metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "trust label carries only non-sensitive, opaque data (no real attestation performed)",
  };
}
