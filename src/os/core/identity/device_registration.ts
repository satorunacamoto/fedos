/**
 * Stage 127 — Device registration boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a device is named as belonging to an
 * actor" — a REGISTRATION RECORD, never a real pairing, key exchange, or
 * sync. This is separate from `./provider_types.ts`'s
 * `IdentityProviderBoundary` (an external auth REFERENCE) and from
 * `./types.ts`'s `PasskeyBoundary` (an unlock TRIGGER) — a device
 * registration names WHICH device an actor says they use, nothing about
 * how any of them authenticate.
 *
 * HARD GUARDRAILS (see `docs/device_identity_boundary.md`):
 *   - NO password, recovery phrase, mnemonic, seed, backup, export,
 *     import, sync, or authentication field of any kind, anywhere in this
 *     file. A `DeviceRegistrationDescriptor` names a device LABEL only.
 *   - `reviewDeviceRegistration` evaluates a decision ONLY — it never
 *     contacts `StorageBackend`, `IdentityProviderBoundary`, or
 *     `PasskeyBoundary`, and never pairs, syncs, or authenticates anything.
 *   - NO `content`/`body`/bytes field of any kind. `deviceRef`/`actorRef`
 *     are OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO pairing, sync, or authentication guarantee.
 *     Do not describe a `registered_placeholder` decision as "paired",
 *     "synced", or "authenticated".
 */

/** Coarse observable state of a device registration record — a label only. */
export type DeviceRegistrationState = "registered_placeholder" | "revoked_placeholder" | "rejected";

/**
 * A non-sensitive description of one device registration. Carries NO
 * password/recovery-phrase/mnemonic/seed/backup/export/import/sync/
 * authentication field of any kind — only opaque labels, a display
 * platform label, and metadata strings.
 */
export interface DeviceRegistrationDescriptor {
  /** OPAQUE label a real route would resolve to its own registration-record id. */
  readonly idRef?: string;
  /** OPAQUE label to the device — never a hardware id/fingerprint used for lookup. */
  readonly deviceRef?: string;
  /** OPAQUE label (e.g. a display name) — never a credential used for auth. */
  readonly actorRef?: string;
  /** Non-sensitive display label only, e.g. "desktop" / "mobile". */
  readonly platformLabel?: string;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewDeviceRegistration`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The result of reviewing a device registration. No pairing/sync/auth data is exposed at any state. */
export interface DeviceRegistrationDecision {
  readonly allowed: boolean;
  readonly state: DeviceRegistrationState;
  readonly reason: string;
}

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes the identity/device-specific prohibited family (`password`/
 * `recovery`/`phrase`/`mnemonic`/`seed`/`backup`/`export`/`import`/`sync`/
 * `auth`) on top of the conservative marker family used across this
 * codebase's other boundaries.
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
export function isSensitiveDeviceRegistrationValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveDeviceRegistrationValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether a device registration record may be handed to a (future)
 * route. Rejects (never throws) when `platformLabel`/`metadata` contains a
 * sensitive key/value. A clean record is `registered_placeholder` — a
 * PLACEHOLDER acceptance that pairs, syncs, and authenticates nothing.
 * Never mutates `device`, never contacts `StorageBackend`,
 * `IdentityProviderBoundary`, or `PasskeyBoundary`.
 */
export function reviewDeviceRegistration(
  device: DeviceRegistrationDescriptor,
): DeviceRegistrationDecision {
  if (device.platformLabel !== undefined && isSensitiveDeviceRegistrationValue(device.platformLabel)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "device platform label contains a sensitive value",
    };
  }
  if (hasSensitiveMetadata(device.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "device metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "registered_placeholder",
    reason: "device record carries only non-sensitive, opaque labels (nothing paired/synced/authenticated)",
  };
}
