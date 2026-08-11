/**
 * Secure Runtime Alpha 4981-5060 — Phase B: the CLOSED Settings Application
 * Plan and the pure `FedosSettingsApplicationPlanner`.
 *
 * `planFedosSettingsApplication()` compares the currently-EFFECTIVE settings
 * against a newly-DESIRED descriptor and returns a deterministic, closed plan
 * — one entry per applicable field whose value changed, each carrying a
 * closed action name (never an arbitrary string), the field's application
 * class, a non-secret old/new value summary, the confirmation requirement,
 * the operation order, and rollback availability.
 *
 * This module is PURE (Phase B "a pure Settings application planner"): no
 * persistence, no Runtime, no subsystem, no Electron, no side effect. It
 * neither reads nor writes anything — it only DECIDES. Applying the plan is
 * the coordinator's job (`../../desktop/settings/fedos_desktop_settings_application_coordinator.ts`).
 *
 * NO SECRET or raw internal object ever appears in a plan: value summaries
 * are short, closed, non-secret strings (a boolean, a theme token, a relay
 * COUNT — never the relay URLs' credentials, never a path's contents).
 */

import type { FedosSettingsDescriptorV1 } from "../fedos_settings_descriptor.js";
import {
  FEDOS_SETTINGS_APPLICABLE_FIELDS,
  fedosSettingsFieldApplication,
  type FedosSettingsApplicableField,
  type FedosSettingsApplicationClass,
  type FedosSettingsApplicationClassReason,
} from "./fedos_settings_application_class.js";

/**
 * The CLOSED plan-action vocabulary (Phase B). No arbitrary string action
 * names anywhere. Every plan entry's `action` is drawn from exactly this set.
 */
export type FedosSettingsApplicationAction =
  | "no-change"
  | "apply-immediately"
  | "update-window-preferences"
  | "reconfigure-notifications"
  | "reconfigure-relays"
  | "start-background-sync"
  | "stop-background-sync"
  | "runtime-restart-required"
  | "application-restart-required"
  | "unsupported";

export const FEDOS_SETTINGS_APPLICATION_ACTIONS: readonly FedosSettingsApplicationAction[] = Object.freeze([
  "no-change",
  "apply-immediately",
  "update-window-preferences",
  "reconfigure-notifications",
  "reconfigure-relays",
  "start-background-sync",
  "stop-background-sync",
  "runtime-restart-required",
  "application-restart-required",
  "unsupported",
]);

export interface FedosSettingsApplicationPlanEntry {
  readonly field: FedosSettingsApplicableField;
  readonly applicationClass: FedosSettingsApplicationClass;
  readonly action: FedosSettingsApplicationAction;
  /** Non-secret summary of the currently-effective value (e.g. `"dark"`, `"enabled"`, `"3 relays"`). Never a raw value that could carry a secret. */
  readonly oldValueSummary: string;
  /** Non-secret summary of the newly-requested value. */
  readonly newValueSummary: string;
  readonly reason: FedosSettingsApplicationClassReason;
  readonly confirmationRequired: boolean;
  /** 1-based order the coordinator should apply this entry in (immediate first, then subsystem, then restart classes). */
  readonly operationOrder: number;
  readonly rollbackAvailable: boolean;
}

export interface FedosSettingsApplicationPlan {
  /** `true` iff no applicable field changed — the coordinator applies nothing. */
  readonly noChange: boolean;
  /** One entry per CHANGED applicable field, in deterministic operation order. */
  readonly entries: readonly FedosSettingsApplicationPlanEntry[];
  /** `true` iff any entry requires explicit confirmation. */
  readonly confirmationRequired: boolean;
  /** `true` iff any entry needs a Desktop Runtime restart to take effect. */
  readonly runtimeRestartRequired: boolean;
  /** `true` iff any entry needs an Electron application restart to take effect. */
  readonly applicationRestartRequired: boolean;
  /** Fields whose change is honestly unsupported (persisted, but no accepted application boundary). */
  readonly unsupportedFields: readonly FedosSettingsApplicableField[];
}

/** Non-secret, closed value summary for a field. Never echoes a secret/credential/path body. */
export function fedosSettingsValueSummary(
  descriptor: FedosSettingsDescriptorV1,
  field: FedosSettingsApplicableField,
): string {
  switch (field) {
    case "theme":
      return descriptor.theme;
    case "language":
      return descriptor.language;
    case "windowLayout":
      return descriptor.windowLayout;
    case "notificationsEnabled":
      return descriptor.notificationsEnabled ? "enabled" : "disabled";
    case "backgroundSyncEnabled":
      return descriptor.backgroundSyncEnabled ? "enabled" : "disabled";
    case "autoStart":
      return descriptor.autoStart ? "enabled" : "disabled";
    case "autoLockTimeoutMinutes":
      return descriptor.autoLockTimeoutMinutes === 0 ? "never" : `${descriptor.autoLockTimeoutMinutes}m`;
    case "relays":
      return `${descriptor.relays.length} relays`;
    case "defaultRelay":
      // Never the URL itself (may carry userinfo) — only whether one is set.
      return descriptor.defaultRelay.length === 0 ? "none" : "set";
    case "archiveDirectory":
      // Never the path body — only whether it is configured.
      return descriptor.archiveDirectory.length === 0 ? "not-configured" : "configured";
  }
}

/** Whether a field's value differs between two descriptors (order-sensitive for relays, exactly as persisted). */
function fieldChanged(
  a: FedosSettingsDescriptorV1,
  b: FedosSettingsDescriptorV1,
  field: FedosSettingsApplicableField,
): boolean {
  if (field === "relays") {
    if (a.relays.length !== b.relays.length) return true;
    for (let i = 0; i < a.relays.length; i += 1) {
      if (a.relays[i] !== b.relays[i]) return true;
    }
    return false;
  }
  return a[field] !== b[field];
}

/** Maps a field + its new value onto the CLOSED action vocabulary, per its static application class. */
function actionForField(
  field: FedosSettingsApplicableField,
  applicationClass: FedosSettingsApplicationClass,
  desired: FedosSettingsDescriptorV1,
): FedosSettingsApplicationAction {
  switch (applicationClass) {
    case "immediate":
      if (field === "windowLayout") return "update-window-preferences";
      if (field === "notificationsEnabled") return "reconfigure-notifications";
      return "apply-immediately";
    case "subsystem":
      // The only subsystem field is backgroundSyncEnabled.
      return desired.backgroundSyncEnabled ? "start-background-sync" : "stop-background-sync";
    case "runtime-restart":
      return "runtime-restart-required";
    case "application-restart":
      return "application-restart-required";
    case "unsupported":
      return "unsupported";
  }
}

/** Stable operation-order rank: immediate first, subsystem next, then restart/unsupported classes. */
function operationOrderRank(applicationClass: FedosSettingsApplicationClass): number {
  switch (applicationClass) {
    case "immediate":
      return 0;
    case "subsystem":
      return 1;
    case "runtime-restart":
      return 2;
    case "application-restart":
      return 3;
    case "unsupported":
      return 4;
  }
}

/**
 * Produces the deterministic closed plan comparing `effective` (currently in
 * force) against `desired` (newly requested). Entries appear only for
 * CHANGED applicable fields, ordered by application class then by the fixed
 * field order. Pure; no side effect.
 */
export function planFedosSettingsApplication(
  effective: FedosSettingsDescriptorV1,
  desired: FedosSettingsDescriptorV1,
): FedosSettingsApplicationPlan {
  const changed = FEDOS_SETTINGS_APPLICABLE_FIELDS.filter((field) => fieldChanged(effective, desired, field));

  const sorted = [...changed].sort((a, b) => {
    const ra = operationOrderRank(fedosSettingsFieldApplication(a).applicationClass);
    const rb = operationOrderRank(fedosSettingsFieldApplication(b).applicationClass);
    if (ra !== rb) return ra - rb;
    return FEDOS_SETTINGS_APPLICABLE_FIELDS.indexOf(a) - FEDOS_SETTINGS_APPLICABLE_FIELDS.indexOf(b);
  });

  const entries: FedosSettingsApplicationPlanEntry[] = sorted.map((field, index) => {
    const descriptor = fedosSettingsFieldApplication(field);
    return Object.freeze({
      field,
      applicationClass: descriptor.applicationClass,
      action: actionForField(field, descriptor.applicationClass, desired),
      oldValueSummary: fedosSettingsValueSummary(effective, field),
      newValueSummary: fedosSettingsValueSummary(desired, field),
      reason: descriptor.reason,
      confirmationRequired: descriptor.confirmationRequired,
      operationOrder: index + 1,
      rollbackAvailable: descriptor.rollbackAvailable,
    });
  });

  const unsupportedFields = Object.freeze(entries.filter((e) => e.applicationClass === "unsupported").map((e) => e.field));

  return Object.freeze({
    noChange: entries.length === 0,
    entries: Object.freeze(entries),
    confirmationRequired: entries.some((e) => e.confirmationRequired),
    runtimeRestartRequired: entries.some((e) => e.applicationClass === "runtime-restart"),
    applicationRestartRequired: entries.some((e) => e.applicationClass === "application-restart"),
    unsupportedFields,
  });
}

export class FedosSettingsApplicationPlanner {
  /** Instance wrapper over the pure planner — mirrors the codebase's authority/controller shape for callers that prefer an object. */
  plan(effective: FedosSettingsDescriptorV1, desired: FedosSettingsDescriptorV1): FedosSettingsApplicationPlan {
    return planFedosSettingsApplication(effective, desired);
  }
}
