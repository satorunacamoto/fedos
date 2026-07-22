/**
 * Secure Runtime Alpha 4901-4980 ("Desktop Settings, Relay Configuration,
 * and User Preferences Arc") — Phase B/C: the ONE versioned, NON-SECRET
 * desktop settings descriptor and its CLOSED preference vocabulary.
 *
 * This descriptor is local user-preference metadata, NOT identity,
 * credential, or crypto authority. It records exactly the closed set of
 * user-facing preferences this Arc's Phase C names — Theme, Language, Relay
 * List, Default Relay, Notification Enabled, Background Sync Enabled,
 * Archive Directory, Auto Start, Auto Lock Timeout, Window Layout — and
 * NOTHING else. There is no free-form key/value map anywhere in this file:
 * the vocabulary is a fixed, exhaustively-listed set of typed fields, and
 * the validator (`./fedos_settings_validator.ts`) rejects any object with
 * an unexpected key.
 *
 * Deliberately mirrors `src/desktop/onboarding/fedos_local_profile_descriptor.ts`'s
 * own established discipline (Alpha 4661-4740, the file-backed profile
 * descriptor Phase B requires this settings layer to REUSE, not reinvent):
 *   - one `schemaVersion` literal (`1`) that a decode fails closed against;
 *   - deterministic canonical encoding (fixed key order) lives in the codec;
 *   - deep-frozen, immutable value objects;
 *   - NEVER any secret byte — no passphrase, seed, private key, or bearer.
 *
 * This file owns ONLY the type + vocabulary + a pure default/`with*`
 * builder surface. Validation lives in `./fedos_settings_validator.ts`;
 * encode/decode in `./fedos_settings_codec.ts`; durability in
 * `./fedos_settings_persistence.ts`; orchestration in
 * `./fedos_settings_authority.ts`.
 */

/** Closed theme vocabulary. `"system"` follows the OS; never a free-form string. */
export type FedosSettingsTheme = "system" | "light" | "dark";
export const FEDOS_SETTINGS_THEMES: readonly FedosSettingsTheme[] = Object.freeze(["system", "light", "dark"]);

/** Closed UI language vocabulary — exactly the languages this desktop build ships. Never an arbitrary BCP-47 tag. */
export type FedosSettingsLanguage = "en" | "ja";
export const FEDOS_SETTINGS_LANGUAGES: readonly FedosSettingsLanguage[] = Object.freeze(["en", "ja"]);

/** Closed window-layout vocabulary. */
export type FedosSettingsWindowLayout = "standard" | "compact" | "wide";
export const FEDOS_SETTINGS_WINDOW_LAYOUTS: readonly FedosSettingsWindowLayout[] = Object.freeze([
  "standard",
  "compact",
  "wide",
]);

/** Hard structural bounds — restated here (not imported from a domain layer) since this settings layer sits above every domain and must reject an oversized value before it is ever persisted. */
export const FEDOS_SETTINGS_MAX_RELAY_COUNT = 32;
export const FEDOS_SETTINGS_MAX_RELAY_URL_LENGTH = 512;
export const FEDOS_SETTINGS_MAX_PATH_LENGTH = 4096;
/** Auto-lock timeout is expressed in minutes; `0` means "never auto-lock". Bounded to a sane ceiling (7 days) so a corrupt/huge value can never be persisted. */
export const FEDOS_SETTINGS_MAX_AUTO_LOCK_TIMEOUT_MINUTES = 60 * 24 * 7;

/**
 * The V1 settings descriptor. Every field is non-secret and drawn from the
 * closed Phase C vocabulary. `schemaVersion` is the shape version of THIS
 * descriptor (always `1` in this Arc). The exact key set here is the ONLY
 * accepted shape — the validator enforces this key count exactly, so no
 * extra/free-form key can ever ride along.
 */
export interface FedosSettingsDescriptorV1 {
  readonly schemaVersion: 1;
  /** Appearance: closed theme vocabulary. */
  readonly theme: FedosSettingsTheme;
  /** Appearance/General: closed UI language vocabulary. */
  readonly language: FedosSettingsLanguage;
  /** Relay: the ordered, de-duplicated list of configured relay URLs (`wss://`/`ws://`). */
  readonly relays: readonly string[];
  /** Relay: the default relay URL — the empty string means "no default selected", otherwise MUST be a member of `relays`. */
  readonly defaultRelay: string;
  /** Notification: master desktop-notification toggle. */
  readonly notificationsEnabled: boolean;
  /** Privacy/Advanced: background sync master toggle. */
  readonly backgroundSyncEnabled: boolean;
  /** Archive: durable directory for conversation archive export/restore. The empty string means "not configured". */
  readonly archiveDirectory: string;
  /** General: launch-on-login toggle. */
  readonly autoStart: boolean;
  /** Privacy: idle auto-lock timeout in minutes; `0` = never. */
  readonly autoLockTimeoutMinutes: number;
  /** Appearance: closed window-layout vocabulary. */
  readonly windowLayout: FedosSettingsWindowLayout;
}

/** The ONE canonical, non-secret default — a fresh profile's first-load settings (Phase H "first load"). Deep-frozen; every field a safe, closed-vocabulary default. */
export function defaultFedosSettingsDescriptorV1(): FedosSettingsDescriptorV1 {
  return Object.freeze({
    schemaVersion: 1,
    theme: "system",
    language: "en",
    relays: Object.freeze([]),
    defaultRelay: "",
    notificationsEnabled: true,
    backgroundSyncEnabled: true,
    archiveDirectory: "",
    autoStart: false,
    autoLockTimeoutMinutes: 15,
    windowLayout: "standard",
  }) as FedosSettingsDescriptorV1;
}

/** A partial patch — every field optional; `relays` replaced wholesale when present (never merged element-wise, so a removal is expressible). */
export interface FedosSettingsDescriptorPatch {
  readonly theme?: FedosSettingsTheme;
  readonly language?: FedosSettingsLanguage;
  readonly relays?: readonly string[];
  readonly defaultRelay?: string;
  readonly notificationsEnabled?: boolean;
  readonly backgroundSyncEnabled?: boolean;
  readonly archiveDirectory?: string;
  readonly autoStart?: boolean;
  readonly autoLockTimeoutMinutes?: number;
  readonly windowLayout?: FedosSettingsWindowLayout;
}

/**
 * Pure, immutable patch application — returns a NEW deep-frozen descriptor
 * with the supplied fields replaced, never mutating the input. Applies no
 * validation itself (the caller runs the descriptor through
 * `isWellFormedFedosSettingsDescriptorV1` / the authority's `save`); it only
 * guarantees the closed key shape and canonical `relays` freezing.
 */
export function withFedosSettings(
  base: FedosSettingsDescriptorV1,
  patch: FedosSettingsDescriptorPatch,
): FedosSettingsDescriptorV1 {
  return Object.freeze({
    schemaVersion: 1,
    theme: patch.theme ?? base.theme,
    language: patch.language ?? base.language,
    relays: Object.freeze([...(patch.relays ?? base.relays)]),
    defaultRelay: patch.defaultRelay ?? base.defaultRelay,
    notificationsEnabled: patch.notificationsEnabled ?? base.notificationsEnabled,
    backgroundSyncEnabled: patch.backgroundSyncEnabled ?? base.backgroundSyncEnabled,
    archiveDirectory: patch.archiveDirectory ?? base.archiveDirectory,
    autoStart: patch.autoStart ?? base.autoStart,
    autoLockTimeoutMinutes: patch.autoLockTimeoutMinutes ?? base.autoLockTimeoutMinutes,
    windowLayout: patch.windowLayout ?? base.windowLayout,
  }) as FedosSettingsDescriptorV1;
}
