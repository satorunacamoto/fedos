/**
 * Secure Runtime Alpha 4901-4980 — Phase B: the ONE deterministic settings
 * codec. Mirrors `encode/decodeFedosLocalProfileDescriptorV1`
 * (`src/desktop/onboarding/fedos_local_profile_descriptor.ts`) exactly:
 *   - `encode` produces ONE canonical, fixed-key-order JSON string; two
 *     equal descriptors always encode byte-identically.
 *   - `decode` round-trips it and, critically, fails CLOSED — returns `null`
 *     on ANY malformed input (JSON parse failure, wrong schema version,
 *     unknown key, failed field validation, tampered value), NEVER a
 *     partial or defaulted descriptor. Never throws.
 *
 * This is the boundary a corrupt/tampered on-disk settings file hits first
 * (Phase H "corrupted file" / "tampered JSON" / "version mismatch"): the
 * file backend reads raw bytes, hands them here, and a non-null result is
 * the ONLY way a descriptor is ever trusted downstream.
 */

import {
  type FedosSettingsDescriptorV1,
} from "./fedos_settings_descriptor.js";
import { isWellFormedFedosSettingsDescriptorV1 } from "./fedos_settings_validator.js";

/**
 * Encodes a descriptor to its ONE canonical JSON string — fixed key order,
 * `relays` copied into a plain array so no frozen-array identity leaks into
 * the serialized form. Assumes a well-formed input (the authority validates
 * before calling); the shape it writes is exactly the shape `decode`
 * accepts.
 */
export function encodeFedosSettingsDescriptorV1(descriptor: FedosSettingsDescriptorV1): string {
  return JSON.stringify({
    schemaVersion: descriptor.schemaVersion,
    theme: descriptor.theme,
    language: descriptor.language,
    relays: [...descriptor.relays],
    defaultRelay: descriptor.defaultRelay,
    notificationsEnabled: descriptor.notificationsEnabled,
    backgroundSyncEnabled: descriptor.backgroundSyncEnabled,
    archiveDirectory: descriptor.archiveDirectory,
    autoStart: descriptor.autoStart,
    autoLockTimeoutMinutes: descriptor.autoLockTimeoutMinutes,
    windowLayout: descriptor.windowLayout,
  });
}

/**
 * Decodes a descriptor from its canonical JSON string, or `null` on ANY
 * malformed input (parse failure OR failing the strict validator). Fails
 * closed; never throws. Returns a fresh, deep-frozen descriptor so no
 * caller can mutate the decoded value.
 */
export function decodeFedosSettingsDescriptorV1(serialized: unknown): FedosSettingsDescriptorV1 | null {
  if (typeof serialized !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!isWellFormedFedosSettingsDescriptorV1(parsed)) return null;
  const record = parsed as FedosSettingsDescriptorV1;
  return Object.freeze({
    schemaVersion: 1,
    theme: record.theme,
    language: record.language,
    relays: Object.freeze([...record.relays]),
    defaultRelay: record.defaultRelay,
    notificationsEnabled: record.notificationsEnabled,
    backgroundSyncEnabled: record.backgroundSyncEnabled,
    archiveDirectory: record.archiveDirectory,
    autoStart: record.autoStart,
    autoLockTimeoutMinutes: record.autoLockTimeoutMinutes,
    windowLayout: record.windowLayout,
  }) as FedosSettingsDescriptorV1;
}

/** True when two descriptors are byte-identical by their canonical encoding. */
export function fedosSettingsDescriptorsIdentical(
  a: FedosSettingsDescriptorV1,
  b: FedosSettingsDescriptorV1,
): boolean {
  return encodeFedosSettingsDescriptorV1(a) === encodeFedosSettingsDescriptorV1(b);
}
