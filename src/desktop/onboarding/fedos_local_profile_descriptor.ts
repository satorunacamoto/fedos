/**
 * Secure Runtime Alpha 4661-4740 ("Master Seed Unlock, First-Run
 * Onboarding, and Local Profile Initialization Arc") — Phase B: the ONE
 * versioned, NON-SECRET local profile descriptor.
 *
 * This descriptor is metadata, NOT identity authority (Phase B's own
 * closing rule). It records enough for a fresh launch to detect a profile,
 * locate its sealed Master Seed material and durable data directories, and
 * validate a restored identity against the persisted public identity — and
 * NOTHING that could weaken the account's own crypto if the file were read
 * by anyone.
 *
 * HARD GUARDRAILS (enforced by `isWellFormedFedosLocalProfileDescriptorV1`
 * and asserted by real tests scanning the encoded bytes):
 *   - NEVER contains a Master Seed byte, a passphrase byte, a private key,
 *     a raw secret handle, a Device private key, a Sender-Key secret, or a
 *     bearer secret. The `sealedMasterSeedRef` is a FILE REFERENCE (a path
 *     string), never sealed bytes and never plaintext.
 *   - `accountPublicIdentityHex` is an x-only PUBLIC key (64 hex) — the
 *     value a restored authority is checked AGAINST, never a secret.
 *   - Deterministic codec: `encode` produces one canonical, fixed-key-order
 *     JSON string; `decode` round-trips it. No object-key-order ambiguity.
 *   - Corruption fails closed: `decode` returns `null` (never a partial or
 *     defaulted descriptor) on any malformed input.
 */

/** The closed set of coarse initialization states a descriptor records on disk. Mirrors the profile lifecycle vocabulary (`./fedos_profile_lifecycle_state.ts`) but persists only the durable-meaningful subset — a running-process-only state (`unlocking`, `unlocked`) is NEVER written to the descriptor. */
export type FedosLocalProfileInitializationState =
  | "initializing"
  | "ready"
  | "failed"
  | "recovery-required";

export const FEDOS_LOCAL_PROFILE_INITIALIZATION_STATES: readonly FedosLocalProfileInitializationState[] =
  Object.freeze(["initializing", "ready", "failed", "recovery-required"]);

/** A non-secret account public identity reference. `publicKeyHex` is x-only 64-hex — the value restored-identity validation checks against. */
export interface FedosLocalProfileAccountIdentity {
  readonly authority: "nostr";
  readonly publicKeyHex: string;
}

/**
 * The V1 local profile descriptor. Every field is non-secret. `schemaVersion`
 * and `migrationVersion` are distinct: `schemaVersion` is the shape version
 * of THIS descriptor (always 1 here); `migrationVersion` is the profile's own
 * data-directory migration generation, bumped by future data migrations
 * without changing the descriptor shape.
 */
export interface FedosLocalProfileDescriptorV1 {
  readonly schemaVersion: 1;
  /** Stable, non-secret, opaque profile identifier (hex). Never derived from a secret. */
  readonly profileId: string;
  /** Local, non-sensitive display label (e.g. "Alice's laptop"). Never a credential. */
  readonly displayLabel: string;
  /** The account PUBLIC identity this profile is for. Never a secret. */
  readonly accountPublicIdentity: FedosLocalProfileAccountIdentity;
  /** Stable, non-secret local Device identifier (this machine's own device id). */
  readonly localDeviceId: string;
  /** Unix milliseconds. */
  readonly createdAt: number;
  /** Unix milliseconds; equal to `createdAt` until the first successful unlock. */
  readonly lastOpenedAt: number;
  /** A FILE REFERENCE (path string) to the sealed Master Seed envelope — never sealed bytes, never plaintext. */
  readonly sealedMasterSeedRef: string;
  /** The durable data-directory root this profile owns. A path string; never a secret. */
  readonly dataDirectoryRoot: string;
  /** Coarse durable initialization state — never a running-process-only state. */
  readonly initializationState: FedosLocalProfileInitializationState;
  /** Data-directory migration generation. Always 1 in this Arc. */
  readonly migrationVersion: number;
}

export interface FedosLocalProfileDescriptorCreateInput {
  readonly profileId: string;
  readonly displayLabel: string;
  readonly accountPublicIdentity: FedosLocalProfileAccountIdentity;
  readonly localDeviceId: string;
  readonly createdAt: number;
  readonly sealedMasterSeedRef: string;
  readonly dataDirectoryRoot: string;
  readonly initializationState: FedosLocalProfileInitializationState;
}

const PROFILE_ID_PATTERN = /^[0-9a-f]{16,64}$/;
const ACCOUNT_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const MAX_DISPLAY_LABEL_LENGTH = 128;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_PATH_LENGTH = 4096;

/** These forbidden substrings would signal an accidental secret field being smuggled in. A structural guard, not a security boundary. */
const FORBIDDEN_DESCRIPTOR_KEYS: readonly string[] = Object.freeze([
  "passphrase",
  "secret",
  "privateKey",
  "seed",
  "nsec",
  "bearer",
]);

function isNonEmptyBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** Strict validator. Confirms the exact 11-key shape, every field's type/format, no forbidden key present. Never throws. */
export function isWellFormedFedosLocalProfileDescriptorV1(
  value: unknown,
): value is FedosLocalProfileDescriptorV1 {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  const keys = Object.keys(record);
  if (keys.length !== 11) return false;
  for (const forbidden of FORBIDDEN_DESCRIPTOR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, forbidden)) return false;
  }

  if (record.schemaVersion !== 1) return false;
  if (typeof record.profileId !== "string" || !PROFILE_ID_PATTERN.test(record.profileId)) return false;
  if (!isNonEmptyBoundedString(record.displayLabel, MAX_DISPLAY_LABEL_LENGTH)) return false;
  if (!isNonEmptyBoundedString(record.localDeviceId, MAX_DEVICE_ID_LENGTH)) return false;
  if (typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) || record.createdAt < 0) return false;
  if (typeof record.lastOpenedAt !== "number" || !Number.isFinite(record.lastOpenedAt) || record.lastOpenedAt < 0) {
    return false;
  }
  if (record.lastOpenedAt < record.createdAt) return false;
  if (!isNonEmptyBoundedString(record.sealedMasterSeedRef, MAX_PATH_LENGTH)) return false;
  if (!isNonEmptyBoundedString(record.dataDirectoryRoot, MAX_PATH_LENGTH)) return false;
  if (
    typeof record.migrationVersion !== "number" ||
    !Number.isInteger(record.migrationVersion) ||
    record.migrationVersion < 1
  ) {
    return false;
  }
  if (
    typeof record.initializationState !== "string" ||
    !FEDOS_LOCAL_PROFILE_INITIALIZATION_STATES.includes(
      record.initializationState as FedosLocalProfileInitializationState,
    )
  ) {
    return false;
  }

  const identity = record.accountPublicIdentity;
  if (identity === null || typeof identity !== "object") return false;
  const identityRecord = identity as Record<string, unknown>;
  if (Object.keys(identityRecord).length !== 2) return false;
  if (identityRecord.authority !== "nostr") return false;
  if (
    typeof identityRecord.publicKeyHex !== "string" ||
    !ACCOUNT_PUBLIC_KEY_HEX_PATTERN.test(identityRecord.publicKeyHex)
  ) {
    return false;
  }

  return true;
}

/** Builds a deep-frozen descriptor from validated input, or `null` if the result would be malformed. `lastOpenedAt` starts equal to `createdAt`; `migrationVersion` starts at 1. Never throws. */
export function createFedosLocalProfileDescriptorV1(
  input: FedosLocalProfileDescriptorCreateInput,
): FedosLocalProfileDescriptorV1 | null {
  const candidate: FedosLocalProfileDescriptorV1 = {
    schemaVersion: 1,
    profileId: input.profileId,
    displayLabel: input.displayLabel,
    accountPublicIdentity: Object.freeze({
      authority: input.accountPublicIdentity.authority,
      publicKeyHex: input.accountPublicIdentity.publicKeyHex,
    }),
    localDeviceId: input.localDeviceId,
    createdAt: input.createdAt,
    lastOpenedAt: input.createdAt,
    sealedMasterSeedRef: input.sealedMasterSeedRef,
    dataDirectoryRoot: input.dataDirectoryRoot,
    initializationState: input.initializationState,
    migrationVersion: 1,
  };
  if (!isWellFormedFedosLocalProfileDescriptorV1(candidate)) return null;
  return Object.freeze(candidate);
}

/** Returns a new descriptor with `initializationState` replaced (and, when moving to `"ready"`, `lastOpenedAt` refreshed). Never mutates the input. Returns `null` if the result would be malformed. */
export function withFedosLocalProfileInitializationState(
  descriptor: FedosLocalProfileDescriptorV1,
  state: FedosLocalProfileInitializationState,
  now: number,
): FedosLocalProfileDescriptorV1 | null {
  const candidate: FedosLocalProfileDescriptorV1 = {
    ...descriptor,
    accountPublicIdentity: Object.freeze({ ...descriptor.accountPublicIdentity }),
    initializationState: state,
    lastOpenedAt: state === "ready" ? Math.max(descriptor.lastOpenedAt, now) : descriptor.lastOpenedAt,
  };
  if (!isWellFormedFedosLocalProfileDescriptorV1(candidate)) return null;
  return Object.freeze(candidate);
}

/**
 * Deterministic codec — encodes to one canonical, fixed-key-order JSON
 * string (mirrors this codebase's `serializeForId`/append-only-record
 * discipline). Two byte-identical descriptors always encode to the exact
 * same string.
 */
export function encodeFedosLocalProfileDescriptorV1(descriptor: FedosLocalProfileDescriptorV1): string {
  return JSON.stringify({
    schemaVersion: descriptor.schemaVersion,
    profileId: descriptor.profileId,
    displayLabel: descriptor.displayLabel,
    accountPublicIdentity: {
      authority: descriptor.accountPublicIdentity.authority,
      publicKeyHex: descriptor.accountPublicIdentity.publicKeyHex,
    },
    localDeviceId: descriptor.localDeviceId,
    createdAt: descriptor.createdAt,
    lastOpenedAt: descriptor.lastOpenedAt,
    sealedMasterSeedRef: descriptor.sealedMasterSeedRef,
    dataDirectoryRoot: descriptor.dataDirectoryRoot,
    initializationState: descriptor.initializationState,
    migrationVersion: descriptor.migrationVersion,
  });
}

/** Decodes a descriptor from its canonical JSON string, or `null` on ANY malformed input (parse failure OR failing the strict validator). Fails closed; never throws. */
export function decodeFedosLocalProfileDescriptorV1(
  serialized: unknown,
): FedosLocalProfileDescriptorV1 | null {
  if (typeof serialized !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!isWellFormedFedosLocalProfileDescriptorV1(parsed)) return null;
  const record = parsed as FedosLocalProfileDescriptorV1;
  return Object.freeze({
    schemaVersion: 1,
    profileId: record.profileId,
    displayLabel: record.displayLabel,
    accountPublicIdentity: Object.freeze({
      authority: record.accountPublicIdentity.authority,
      publicKeyHex: record.accountPublicIdentity.publicKeyHex,
    }),
    localDeviceId: record.localDeviceId,
    createdAt: record.createdAt,
    lastOpenedAt: record.lastOpenedAt,
    sealedMasterSeedRef: record.sealedMasterSeedRef,
    dataDirectoryRoot: record.dataDirectoryRoot,
    initializationState: record.initializationState,
    migrationVersion: record.migrationVersion,
  });
}

/** True when two descriptors are byte-identical by their canonical encoding — the "identical duplicate" test (Phase B). */
export function fedosLocalProfileDescriptorsIdentical(
  a: FedosLocalProfileDescriptorV1,
  b: FedosLocalProfileDescriptorV1,
): boolean {
  return encodeFedosLocalProfileDescriptorV1(a) === encodeFedosLocalProfileDescriptorV1(b);
}
