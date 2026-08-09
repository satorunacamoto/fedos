/**
 * Secure Runtime Alpha 4901-4980 — Phase B/C: the ONE strict settings
 * validator. Fail-closed, never-throws, closed-vocabulary-only.
 *
 * `isWellFormedFedosSettingsDescriptorV1` is the single authority on whether
 * an arbitrary `unknown` is a genuinely well-formed V1 settings descriptor.
 * It mirrors `isWellFormedFedosLocalProfileDescriptorV1`
 * (`src/desktop/onboarding/fedos_local_profile_descriptor.ts`) exactly in
 * discipline:
 *   - EXACT key-count check (11 keys) — an object carrying ANY extra key
 *     (the "free-form key/value" Phase C forbids) is rejected outright.
 *   - Every field checked against its CLOSED vocabulary / typed bound.
 *   - Cross-field invariants enforced (`defaultRelay` ∈ `relays` or empty;
 *     no duplicate relays; every relay a bounded `ws(s)://` URL).
 *   - Returns a boolean; NEVER throws.
 *
 * `fedosSettingsValidationErrors` is a caller-facing, non-secret,
 * closed-vocabulary diagnostic list (Phase H "validation error") — it names
 * WHICH field failed WITHOUT ever echoing an oversized/secret value back.
 */

import {
  FEDOS_SETTINGS_LANGUAGES,
  FEDOS_SETTINGS_MAX_AUTO_LOCK_TIMEOUT_MINUTES,
  FEDOS_SETTINGS_MAX_PATH_LENGTH,
  FEDOS_SETTINGS_MAX_RELAY_COUNT,
  FEDOS_SETTINGS_MAX_RELAY_URL_LENGTH,
  FEDOS_SETTINGS_THEMES,
  FEDOS_SETTINGS_WINDOW_LAYOUTS,
  type FedosSettingsDescriptorV1,
  type FedosSettingsLanguage,
  type FedosSettingsTheme,
  type FedosSettingsWindowLayout,
} from "./fedos_settings_descriptor.js";

/** The EXACT, closed key set a V1 descriptor may carry — no more, no fewer. Any deviation is the free-form/unknown-key case Phase C forbids. */
const FEDOS_SETTINGS_DESCRIPTOR_KEYS: readonly string[] = Object.freeze([
  "schemaVersion",
  "theme",
  "language",
  "relays",
  "defaultRelay",
  "notificationsEnabled",
  "backgroundSyncEnabled",
  "archiveDirectory",
  "autoStart",
  "autoLockTimeoutMinutes",
  "windowLayout",
]);

/** A closed, non-secret validation-error code vocabulary — safe to display/log verbatim. */
export type FedosSettingsValidationErrorCode =
  | "not-an-object"
  | "unknown-key"
  | "missing-key"
  | "schema-version"
  | "theme"
  | "language"
  | "relays"
  | "relay-url"
  | "relay-duplicate"
  | "relay-count"
  | "default-relay"
  | "notifications-enabled"
  | "background-sync-enabled"
  | "archive-directory"
  | "auto-start"
  | "auto-lock-timeout"
  | "window-layout";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** A relay URL is a bounded `ws://`/`wss://` string, no whitespace, that URL-parses. Never a free-form label. */
export function isValidFedosRelayUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > FEDOS_SETTINGS_MAX_RELAY_URL_LENGTH) return false;
  if (/\s/.test(value)) return false;
  if (!/^wss?:\/\//.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:";
  } catch {
    return false;
  }
}

function isValidRelayList(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > FEDOS_SETTINGS_MAX_RELAY_COUNT) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isValidFedosRelayUrl(entry)) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

function isBoundedPath(value: unknown): value is string {
  // The empty string ("not configured") is valid; a non-empty value is bounded and free of NUL / path-traversal segments.
  if (typeof value !== "string") return false;
  if (value.length > FEDOS_SETTINGS_MAX_PATH_LENGTH) return false;
  if (value.length === 0) return true;
  if (value.includes("\0")) return false;
  return !value.split(/[/\\]/).includes("..");
}

function isValidAutoLockTimeout(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= FEDOS_SETTINGS_MAX_AUTO_LOCK_TIMEOUT_MINUTES
  );
}

/**
 * Collects every closed-vocabulary validation error for a candidate, in a
 * stable field order. An empty array means the candidate is a well-formed
 * V1 descriptor. Never throws; never echoes an oversized/secret value.
 */
export function fedosSettingsValidationErrors(value: unknown): readonly FedosSettingsValidationErrorCode[] {
  const errors: FedosSettingsValidationErrorCode[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze(["not-an-object"]);
  }
  const record = value as Record<string, unknown>;

  const keys = Object.keys(record);
  for (const key of keys) {
    if (!FEDOS_SETTINGS_DESCRIPTOR_KEYS.includes(key)) errors.push("unknown-key");
  }
  for (const required of FEDOS_SETTINGS_DESCRIPTOR_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, required)) errors.push("missing-key");
  }
  // If the shape is already wrong, stop before per-field checks would double-report.
  if (errors.length > 0) return Object.freeze(errors);

  if (record.schemaVersion !== 1) errors.push("schema-version");
  if (!FEDOS_SETTINGS_THEMES.includes(record.theme as FedosSettingsTheme)) errors.push("theme");
  if (!FEDOS_SETTINGS_LANGUAGES.includes(record.language as FedosSettingsLanguage)) errors.push("language");

  if (!isValidRelayList(record.relays)) {
    if (Array.isArray(record.relays) && record.relays.length > FEDOS_SETTINGS_MAX_RELAY_COUNT) {
      errors.push("relay-count");
    } else if (Array.isArray(record.relays) && new Set(record.relays).size !== record.relays.length) {
      errors.push("relay-duplicate");
    } else {
      errors.push("relays");
    }
  }

  if (typeof record.defaultRelay !== "string") {
    errors.push("default-relay");
  } else if (record.defaultRelay.length > 0) {
    if (!isValidFedosRelayUrl(record.defaultRelay)) {
      errors.push("relay-url");
    } else if (Array.isArray(record.relays) && !record.relays.includes(record.defaultRelay)) {
      errors.push("default-relay");
    }
  }

  if (!isBoolean(record.notificationsEnabled)) errors.push("notifications-enabled");
  if (!isBoolean(record.backgroundSyncEnabled)) errors.push("background-sync-enabled");
  if (!isBoundedPath(record.archiveDirectory)) errors.push("archive-directory");
  if (!isBoolean(record.autoStart)) errors.push("auto-start");
  if (!isValidAutoLockTimeout(record.autoLockTimeoutMinutes)) errors.push("auto-lock-timeout");
  if (!FEDOS_SETTINGS_WINDOW_LAYOUTS.includes(record.windowLayout as FedosSettingsWindowLayout)) {
    errors.push("window-layout");
  }

  return Object.freeze(errors);
}

/** Strict type guard — `true` iff the candidate is a genuinely well-formed V1 settings descriptor. Never throws. */
export function isWellFormedFedosSettingsDescriptorV1(value: unknown): value is FedosSettingsDescriptorV1 {
  return fedosSettingsValidationErrors(value).length === 0;
}
