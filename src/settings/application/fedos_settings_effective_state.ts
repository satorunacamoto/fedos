/**
 * Secure Runtime Alpha 4981-5060 — Phase C: the read-only Effective Settings
 * State model.
 *
 * Persisted != Effective. This module makes that distinction FIRST-CLASS and
 * honest. It separates, per the spec:
 *   - PERSISTED  — the durable on-disk descriptor.
 *   - DESIRED    — what the user requested (== persisted after a save).
 *   - EFFECTIVE  — what is ACTUALLY in force in the live process right now.
 *   - PENDING-RESTART — fields whose desired value needs a Runtime or
 *                       application restart before it becomes effective.
 *   - BLOCKED    — fields whose desired value is unsupported (persisted, but
 *                  no accepted application boundary exists).
 *
 * The model is a plain, deep-frozen, structured-clone-safe value object — no
 * Runtime, no persistence, no Electron, no secret. It carries per-field
 * status so the Settings UI can display the distinction honestly (Phase C
 * "The Settings UI must display these distinctions honestly").
 *
 * It must SURVIVE (Phase C): a failed immediate application, a failed
 * subsystem reconfiguration, a Runtime restart cancellation, an application
 * restart requirement, and a partial multi-field save — every one of which
 * is representable as a per-field status here, never as a false "effective".
 */

import { withFedosSettings, type FedosSettingsDescriptorV1 } from "../fedos_settings_descriptor.js";
import {
  FEDOS_SETTINGS_APPLICABLE_FIELDS,
  type FedosSettingsApplicableField,
} from "./fedos_settings_application_class.js";
import { fedosSettingsValueSummary } from "./fedos_settings_application_plan.js";

/**
 * The CLOSED per-field effective-status vocabulary. `effective` means the
 * desired value IS in force. The others honestly record why it is not.
 */
export type FedosSettingsFieldEffectiveStatus =
  | "effective" //                  desired value is in force now.
  | "pending-runtime-restart" //    persisted; needs a Desktop Runtime restart.
  | "pending-application-restart" // persisted; needs an Electron restart.
  | "blocked" //                    persisted; unsupported — cannot ever apply here.
  | "application-failed"; //        applied attempt failed; effective kept the old value.

export interface FedosSettingsFieldEffectiveEntry {
  readonly field: FedosSettingsApplicableField;
  readonly status: FedosSettingsFieldEffectiveStatus;
  /** Non-secret summary of the value CURRENTLY in force for this field. */
  readonly effectiveValueSummary: string;
}

export interface FedosSettingsEffectiveState {
  readonly persisted: FedosSettingsDescriptorV1;
  readonly desired: FedosSettingsDescriptorV1;
  readonly effective: FedosSettingsDescriptorV1;
  readonly fields: readonly FedosSettingsFieldEffectiveEntry[];
  readonly pendingRuntimeRestartFields: readonly FedosSettingsApplicableField[];
  readonly pendingApplicationRestartFields: readonly FedosSettingsApplicableField[];
  readonly blockedFields: readonly FedosSettingsApplicableField[];
  readonly failedFields: readonly FedosSettingsApplicableField[];
  /** `true` iff every applicable field's desired value is genuinely in force. */
  readonly fullyEffective: boolean;
}

/**
 * The SANITIZED, boundary-safe projection of an effective state. It carries
 * ONLY per-field statuses + NON-SECRET value summaries and the field lists —
 * NEVER the raw persisted/desired/effective descriptors (which may embed a
 * relay URL's userinfo or a filesystem archive path). This is the ONLY shape
 * the Host Bridge sends toward the Renderer/IPC boundary.
 */
export interface FedosSettingsEffectiveStateView {
  readonly fields: readonly FedosSettingsFieldEffectiveEntry[];
  readonly pendingRuntimeRestartFields: readonly FedosSettingsApplicableField[];
  readonly pendingApplicationRestartFields: readonly FedosSettingsApplicableField[];
  readonly blockedFields: readonly FedosSettingsApplicableField[];
  readonly failedFields: readonly FedosSettingsApplicableField[];
  readonly fullyEffective: boolean;
}

/** Projects a rich effective state onto its boundary-safe view — drops the raw descriptors, keeps only summaries/statuses. */
export function fedosSettingsEffectiveStateView(state: FedosSettingsEffectiveState): FedosSettingsEffectiveStateView {
  return Object.freeze({
    fields: state.fields,
    pendingRuntimeRestartFields: state.pendingRuntimeRestartFields,
    pendingApplicationRestartFields: state.pendingApplicationRestartFields,
    blockedFields: state.blockedFields,
    failedFields: state.failedFields,
    fullyEffective: state.fullyEffective,
  });
}

/**
 * The initial effective state on a fresh load, BEFORE any application:
 * persisted == desired == effective, and every applicable field is
 * `effective` (nothing has been changed away from what is durable). This is
 * the honest startup baseline (Phase Q "expose effective state").
 */
export function fedosSettingsEffectiveStateFromLoaded(
  persisted: FedosSettingsDescriptorV1,
): FedosSettingsEffectiveState {
  const fields = FEDOS_SETTINGS_APPLICABLE_FIELDS.map((field) =>
    Object.freeze({
      field,
      status: "effective" as FedosSettingsFieldEffectiveStatus,
      effectiveValueSummary: fedosSettingsValueSummary(persisted, field),
    }),
  );
  return Object.freeze({
    persisted,
    desired: persisted,
    effective: persisted,
    fields: Object.freeze(fields),
    pendingRuntimeRestartFields: Object.freeze([]),
    pendingApplicationRestartFields: Object.freeze([]),
    blockedFields: Object.freeze([]),
    failedFields: Object.freeze([]),
    fullyEffective: true,
  });
}

/**
 * Per-field application results the coordinator produces, mapping a field to
 * whether its desired value actually took effect in the live process.
 */
export type FedosSettingsFieldApplicationStatus =
  | "applied"
  | "unchanged"
  | "pending-runtime-restart"
  | "pending-application-restart"
  | "blocked"
  | "failed";

export interface FedosSettingsFieldApplicationRecord {
  readonly field: FedosSettingsApplicableField;
  readonly status: FedosSettingsFieldApplicationStatus;
}

/**
 * Builds the honest effective state after an application pass. `previousEffective`
 * is the descriptor that WAS in force; `desired` is the newly-persisted target;
 * `records` says, per changed field, what actually happened. A field with an
 * `applied`/`unchanged` record takes its desired value in `effective`; every
 * other status keeps the PREVIOUS effective value for that field (never a false
 * "applied"), and is surfaced in the matching pending/blocked/failed list.
 */
export function fedosSettingsEffectiveStateAfterApplication(
  previousEffective: FedosSettingsDescriptorV1,
  persisted: FedosSettingsDescriptorV1,
  desired: FedosSettingsDescriptorV1,
  records: readonly FedosSettingsFieldApplicationRecord[],
): FedosSettingsEffectiveState {
  const statusByField = new Map<FedosSettingsApplicableField, FedosSettingsFieldApplicationStatus>();
  for (const record of records) statusByField.set(record.field, record.status);

  // Compute the effective descriptor field-by-field, starting from the desired
  // value and reverting any field that did NOT take effect back to the
  // previously-effective value.
  let effective = desired;
  const entries: FedosSettingsFieldEffectiveEntry[] = [];
  const pendingRuntimeRestart: FedosSettingsApplicableField[] = [];
  const pendingApplicationRestart: FedosSettingsApplicableField[] = [];
  const blocked: FedosSettingsApplicableField[] = [];
  const failed: FedosSettingsApplicableField[] = [];

  for (const field of FEDOS_SETTINGS_APPLICABLE_FIELDS) {
    const status = statusByField.get(field) ?? "unchanged";
    let fieldStatus: FedosSettingsFieldEffectiveStatus;
    switch (status) {
      case "applied":
      case "unchanged":
        fieldStatus = "effective";
        break;
      case "pending-runtime-restart":
        fieldStatus = "pending-runtime-restart";
        pendingRuntimeRestart.push(field);
        effective = revertField(effective, previousEffective, field);
        break;
      case "pending-application-restart":
        fieldStatus = "pending-application-restart";
        pendingApplicationRestart.push(field);
        effective = revertField(effective, previousEffective, field);
        break;
      case "blocked":
        fieldStatus = "blocked";
        blocked.push(field);
        effective = revertField(effective, previousEffective, field);
        break;
      case "failed":
        fieldStatus = "application-failed";
        failed.push(field);
        effective = revertField(effective, previousEffective, field);
        break;
    }
    entries.push(
      Object.freeze({
        field,
        status: fieldStatus,
        effectiveValueSummary: fedosSettingsValueSummary(effective, field),
      }),
    );
  }

  return Object.freeze({
    persisted,
    desired,
    effective,
    fields: Object.freeze(entries),
    pendingRuntimeRestartFields: Object.freeze(pendingRuntimeRestart),
    pendingApplicationRestartFields: Object.freeze(pendingApplicationRestart),
    blockedFields: Object.freeze(blocked),
    failedFields: Object.freeze(failed),
    fullyEffective:
      pendingRuntimeRestart.length === 0 &&
      pendingApplicationRestart.length === 0 &&
      blocked.length === 0 &&
      failed.length === 0,
  });
}

/** Returns a descriptor equal to `base` but with `field` reverted to `source`'s value. Uses the descriptor's own pure `with*` builder — never mutates. */
function revertField(
  base: FedosSettingsDescriptorV1,
  source: FedosSettingsDescriptorV1,
  field: FedosSettingsApplicableField,
): FedosSettingsDescriptorV1 {
  switch (field) {
    case "theme":
      return withFedosSettings(base, { theme: source.theme });
    case "language":
      return withFedosSettings(base, { language: source.language });
    case "relays":
      return withFedosSettings(base, { relays: source.relays });
    case "defaultRelay":
      return withFedosSettings(base, { defaultRelay: source.defaultRelay });
    case "notificationsEnabled":
      return withFedosSettings(base, { notificationsEnabled: source.notificationsEnabled });
    case "backgroundSyncEnabled":
      return withFedosSettings(base, { backgroundSyncEnabled: source.backgroundSyncEnabled });
    case "archiveDirectory":
      return withFedosSettings(base, { archiveDirectory: source.archiveDirectory });
    case "autoStart":
      return withFedosSettings(base, { autoStart: source.autoStart });
    case "autoLockTimeoutMinutes":
      return withFedosSettings(base, { autoLockTimeoutMinutes: source.autoLockTimeoutMinutes });
    case "windowLayout":
      return withFedosSettings(base, { windowLayout: source.windowLayout });
  }
}
