/**
 * Secure Runtime Alpha 4981-5060 ("Desktop Settings Runtime Application and
 * Safe Reconfiguration Arc") — Phase A/CORE DESIGN RULE: the CLOSED
 * application-class vocabulary and the ONE evidence-derived classification of
 * every `FedosSettingsDescriptorV1` field.
 *
 * Every setting belongs to EXACTLY ONE application class. The classification
 * below is NOT assumed from the spec's examples — it was derived by reading
 * the real ownership graph in THIS worktree (see
 * `docs/secure_runtime_alpha_4981_5060_phase_a_inventory.md`):
 *
 *   - `FedosConversationRelaySet` (relays/defaultRelay) is constructed once,
 *     inside `startFedosDesktopRuntime()`, from `config.conversationTransportRelays`
 *     and is immutable thereafter — no live "set relays" method exists on
 *     `FedosPrivateTransport`. Therefore relay changes are RUNTIME-RESTART.
 *   - Archive paths are bound at Runtime construction only — RUNTIME-RESTART.
 *   - `FedosDeviceSyncOperationalFacade.startSync()/stopSync()` IS a real,
 *     exposed live boundary — therefore `backgroundSyncEnabled` is SUBSYSTEM.
 *   - Theme / windowLayout have a genuine presentation-preference boundary
 *     applied WITHOUT reconstructing the Runtime — therefore IMMEDIATE.
 *   - Notification presentation can be gated additively over the existing
 *     Notification Port WITHOUT reconstructing the Runtime — IMMEDIATE.
 *   - No localization framework, no OS auto-start boundary, and no idle /
 *     user-activity boundary exist anywhere in this worktree — therefore
 *     `language`, `autoStart`, and `autoLockTimeoutMinutes` are honestly
 *     UNSUPPORTED (persisted, but no accepted application boundary exists).
 *
 * This module is PURE: no persistence, no Runtime, no Electron, no timer.
 */

/**
 * The CLOSED application-class vocabulary (spec CORE DESIGN RULE A–E). No
 * other value is ever produced. `unsupported` covers the spec's combined
 * "UNSUPPORTED / BLOCKED" class E — the per-field `reason` distinguishes
 * WHY (no localization boundary, no OS auto-start boundary, no idle boundary).
 */
export type FedosSettingsApplicationClass =
  | "immediate" //           A — applied without reconstructing Runtime/subsystem.
  | "subsystem" //           B — applied by reconfiguring one owned subsystem.
  | "runtime-restart" //     C — requires rebuilding the Desktop Runtime.
  | "application-restart" // D — requires restarting the Electron process.
  | "unsupported"; //        E — stored, but no accepted application boundary exists.

export const FEDOS_SETTINGS_APPLICATION_CLASSES: readonly FedosSettingsApplicationClass[] = Object.freeze([
  "immediate",
  "subsystem",
  "runtime-restart",
  "application-restart",
  "unsupported",
]);

/**
 * The CLOSED set of `FedosSettingsDescriptorV1` fields that carry an
 * application decision. `schemaVersion` is deliberately excluded — it is a
 * structural shape marker, never a user preference to "apply".
 */
export type FedosSettingsApplicableField =
  | "theme"
  | "language"
  | "relays"
  | "defaultRelay"
  | "notificationsEnabled"
  | "backgroundSyncEnabled"
  | "archiveDirectory"
  | "autoStart"
  | "autoLockTimeoutMinutes"
  | "windowLayout";

export const FEDOS_SETTINGS_APPLICABLE_FIELDS: readonly FedosSettingsApplicableField[] = Object.freeze([
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

/** A CLOSED, non-secret reason vocabulary — safe to display/log verbatim. */
export type FedosSettingsApplicationClassReason =
  | "presentation-preference"
  | "notification-presentation-gate"
  | "background-sync-scheduler"
  | "relay-set-construction-time-only"
  | "archive-path-construction-time-only"
  | "no-localization-boundary"
  | "no-os-auto-start-boundary"
  | "no-idle-activity-boundary";

export interface FedosSettingsFieldApplicationDescriptor {
  readonly field: FedosSettingsApplicableField;
  readonly applicationClass: FedosSettingsApplicationClass;
  /** Non-secret, closed reason this field carries this class — derived from real source ownership, not assumed. */
  readonly reason: FedosSettingsApplicationClassReason;
  /**
   * Whether applying a change to this field should require an explicit user
   * confirmation before the coordinator acts. Subsystem reconfiguration and
   * every restart class require confirmation (they interrupt live work);
   * immediate presentation preferences do not.
   */
  readonly confirmationRequired: boolean;
  /**
   * Whether a failed application of this field can be safely rolled back to
   * the previously-effective value. Immediate presentation sinks are
   * reversible; a restart/unsupported class has no in-process rollback.
   */
  readonly rollbackAvailable: boolean;
}

/**
 * The ONE evidence-derived classification table. Frozen. Every applicable
 * field appears exactly once.
 */
const FEDOS_SETTINGS_FIELD_APPLICATION: {
  readonly [K in FedosSettingsApplicableField]: FedosSettingsFieldApplicationDescriptor;
} = Object.freeze({
  theme: Object.freeze({
    field: "theme",
    applicationClass: "immediate",
    reason: "presentation-preference",
    confirmationRequired: false,
    rollbackAvailable: true,
  }),
  windowLayout: Object.freeze({
    field: "windowLayout",
    applicationClass: "immediate",
    reason: "presentation-preference",
    confirmationRequired: false,
    rollbackAvailable: true,
  }),
  notificationsEnabled: Object.freeze({
    field: "notificationsEnabled",
    applicationClass: "immediate",
    reason: "notification-presentation-gate",
    confirmationRequired: false,
    rollbackAvailable: true,
  }),
  backgroundSyncEnabled: Object.freeze({
    field: "backgroundSyncEnabled",
    applicationClass: "subsystem",
    reason: "background-sync-scheduler",
    confirmationRequired: true,
    rollbackAvailable: true,
  }),
  relays: Object.freeze({
    field: "relays",
    applicationClass: "runtime-restart",
    reason: "relay-set-construction-time-only",
    confirmationRequired: true,
    rollbackAvailable: false,
  }),
  defaultRelay: Object.freeze({
    field: "defaultRelay",
    applicationClass: "runtime-restart",
    reason: "relay-set-construction-time-only",
    confirmationRequired: true,
    rollbackAvailable: false,
  }),
  archiveDirectory: Object.freeze({
    field: "archiveDirectory",
    applicationClass: "runtime-restart",
    reason: "archive-path-construction-time-only",
    confirmationRequired: true,
    rollbackAvailable: false,
  }),
  language: Object.freeze({
    field: "language",
    applicationClass: "unsupported",
    reason: "no-localization-boundary",
    confirmationRequired: false,
    rollbackAvailable: false,
  }),
  autoStart: Object.freeze({
    field: "autoStart",
    applicationClass: "unsupported",
    reason: "no-os-auto-start-boundary",
    confirmationRequired: false,
    rollbackAvailable: false,
  }),
  autoLockTimeoutMinutes: Object.freeze({
    field: "autoLockTimeoutMinutes",
    applicationClass: "unsupported",
    reason: "no-idle-activity-boundary",
    confirmationRequired: false,
    rollbackAvailable: false,
  }),
});

/** Returns the frozen application descriptor for a field. Pure, total over the closed field vocabulary. */
export function fedosSettingsFieldApplication(
  field: FedosSettingsApplicableField,
): FedosSettingsFieldApplicationDescriptor {
  return FEDOS_SETTINGS_FIELD_APPLICATION[field];
}

/** The full, frozen classification table, in stable field order. */
export function fedosSettingsApplicationClassification(): readonly FedosSettingsFieldApplicationDescriptor[] {
  return Object.freeze(FEDOS_SETTINGS_APPLICABLE_FIELDS.map((f) => FEDOS_SETTINGS_FIELD_APPLICATION[f]));
}
