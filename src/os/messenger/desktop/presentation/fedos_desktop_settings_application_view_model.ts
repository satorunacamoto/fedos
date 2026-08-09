/**
 * Secure Runtime Alpha 4981-5060 — Phase N: `FedosDesktopSettingsApplicationViewModel`.
 *
 * The presentation-state holder for the settings-APPLICATION screens. It
 * delegates every fact and mutation to `FedosDesktopSettingsApplicationCoordinator`
 * (`../settings/fedos_desktop_settings_application_coordinator.ts`) and
 * projects the honest effective state + last application outcome into ONE
 * closed, structured-clone-safe render content. It imports NO rendering
 * framework, NO browser global, NO Electron, NO Runtime, NO secret.
 *
 * The projection shows, per Phase N: saved (persisted) value, effective
 * value, pending value, application class, restart-required, application-
 * restart-required, unsupported/blocked reason, last application outcome, and
 * the confirmation requirement — a superset of the read-only distinctions the
 * Settings UI must render honestly.
 */

import type {
  FedosDesktopSettingsApplicationCoordinator,
  FedosSettingsApplicationReport,
  FedosSettingsApplicationTransactionOutcome,
} from "../settings/fedos_desktop_settings_application_coordinator.js";
import type { FedosSettingsApplicationPlan } from "../../../../settings/application/fedos_settings_application_plan.js";
import type {
  FedosSettingsEffectiveState,
  FedosSettingsFieldEffectiveEntry,
} from "../../../../settings/application/fedos_settings_effective_state.js";
import {
  fedosSettingsFieldApplication,
  fedosSettingsApplicationClassification,
  type FedosSettingsApplicableField,
  type FedosSettingsApplicationClass,
} from "../../../../settings/application/fedos_settings_application_class.js";
import { fedosSettingsValueSummary } from "../../../../settings/application/fedos_settings_application_plan.js";

/** One row per applicable field, honestly distinguishing saved / effective / pending. */
export interface FedosDesktopSettingsApplicationFieldRow {
  readonly field: FedosSettingsApplicableField;
  readonly applicationClass: FedosSettingsApplicationClass;
  readonly savedValueSummary: string;
  readonly effectiveValueSummary: string;
  readonly status: FedosSettingsFieldEffectiveEntry["status"];
  readonly restartRequired: boolean;
  readonly applicationRestartRequired: boolean;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
  readonly confirmationRequired: boolean;
}

export interface FedosDesktopSettingsApplicationRenderContent {
  readonly initialized: boolean;
  readonly rows: readonly FedosDesktopSettingsApplicationFieldRow[];
  readonly pendingRuntimeRestartFields: readonly FedosSettingsApplicableField[];
  readonly pendingApplicationRestartFields: readonly FedosSettingsApplicableField[];
  readonly blockedFields: readonly FedosSettingsApplicableField[];
  readonly failedFields: readonly FedosSettingsApplicableField[];
  readonly fullyEffective: boolean;
  /** The last apply outcome, or `null` if no apply has run this session. */
  readonly lastOutcome: FedosSettingsApplicationTransactionOutcome | null;
  readonly lastReason: string | null;
}

export class FedosDesktopSettingsApplicationViewModel {
  readonly #coordinator: FedosDesktopSettingsApplicationCoordinator;
  #lastReport: FedosSettingsApplicationReport | null = null;

  constructor(coordinator: FedosDesktopSettingsApplicationCoordinator) {
    this.#coordinator = coordinator;
  }

  /** Phase Q startup — seeds the live boundaries and effective state. */
  initialize(): FedosSettingsEffectiveState | null {
    const result = this.#coordinator.initialize();
    return result.outcome === "ok" ? result.value : null;
  }

  /** Preview the plan for a candidate without persisting or applying. */
  previewPlan(candidate: unknown): FedosSettingsApplicationPlan | null {
    const result = this.#coordinator.previewPlan(candidate);
    return result.outcome === "ok" ? result.value : null;
  }

  /** Save + apply a candidate, retaining the report for the projection. */
  async apply(candidate: unknown): Promise<FedosSettingsApplicationReport> {
    this.#lastReport = await this.#coordinator.apply(candidate);
    return this.#lastReport;
  }

  render(): FedosDesktopSettingsApplicationRenderContent {
    const state = this.#coordinator.effectiveState();
    if (state === null) {
      return Object.freeze({
        initialized: false,
        rows: Object.freeze([]),
        pendingRuntimeRestartFields: Object.freeze([]),
        pendingApplicationRestartFields: Object.freeze([]),
        blockedFields: Object.freeze([]),
        failedFields: Object.freeze([]),
        fullyEffective: true,
        lastOutcome: this.#lastReport?.outcome ?? null,
        lastReason: this.#lastReport?.reason ?? null,
      });
    }

    const statusByField = new Map(state.fields.map((f) => [f.field, f]));
    const rows: FedosDesktopSettingsApplicationFieldRow[] = fedosSettingsApplicationClassification().map((descriptor) => {
      const field = descriptor.field;
      const entry = statusByField.get(field)!;
      const blocked = entry.status === "blocked";
      return Object.freeze({
        field,
        applicationClass: descriptor.applicationClass,
        savedValueSummary: fedosSettingsValueSummary(state.persisted, field),
        effectiveValueSummary: entry.effectiveValueSummary,
        status: entry.status,
        restartRequired: entry.status === "pending-runtime-restart",
        applicationRestartRequired: entry.status === "pending-application-restart",
        blocked,
        blockedReason: blocked ? fedosSettingsFieldApplication(field).reason : null,
        confirmationRequired: descriptor.confirmationRequired,
      });
    });

    return Object.freeze({
      initialized: true,
      rows: Object.freeze(rows),
      pendingRuntimeRestartFields: state.pendingRuntimeRestartFields,
      pendingApplicationRestartFields: state.pendingApplicationRestartFields,
      blockedFields: state.blockedFields,
      failedFields: state.failedFields,
      fullyEffective: state.fullyEffective,
      lastOutcome: this.#lastReport?.outcome ?? null,
      lastReason: this.#lastReport?.reason ?? null,
    });
  }
}
