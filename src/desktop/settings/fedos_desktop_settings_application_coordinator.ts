/**
 * Secure Runtime Alpha 4981-5060 — Phase D: `FedosDesktopSettingsApplicationCoordinator`.
 *
 * The ONE application-level coordinator that turns a newly-DESIRED settings
 * descriptor into REAL live behavior through accepted boundaries. It:
 *   - loads current persisted settings (via the existing controller);
 *   - validates the new candidate (via the existing authority);
 *   - generates the closed application plan (Phase B planner);
 *   - persists the desired descriptor FIRST (accepted ordering, Phase E
 *     option C: persist desired -> apply supported actions -> report delta);
 *   - applies immediate presentation settings (theme / window layout);
 *   - reconfigures the notification presentation gate;
 *   - reconfigures the background-sync subsystem through its existing control;
 *   - records the honest effective state (persisted != effective);
 *   - reports restart-required / blocked / failed / rolled-back fields;
 *   - NEVER fabricates success.
 *
 * It owns NO business truth for Relays, Device Sync, notifications, Runtime
 * lifecycle, or file migration — it DELEGATES to the injected ports
 * (`./fedos_desktop_settings_application_ports.ts`) and the existing
 * controller. It constructs no Runtime, imports no Electron, holds no secret.
 *
 * TRANSACTION SEMANTICS (Phase E, chosen = option C). Rationale: the
 * file-backed Settings store is already the durable source of truth, and the
 * live subsystems are best-effort reconfiguration. A failed live application
 * must NOT discard the user's persisted intent, but must be reported honestly
 * as pending-restart / blocked / failed (never a false "applied"). So: the
 * desired descriptor is validated and persisted as one unit, then each
 * changed field is applied independently in operation order, and the result
 * is the honest per-field effective delta.
 */

import {
  defaultFedosSettingsDescriptorV1,
  type FedosSettingsDescriptorV1,
} from "../../settings/fedos_settings_descriptor.js";
import type { FedosSettingsResult } from "../../settings/fedos_settings_authority.js";
import type { FedosDesktopSettingsController } from "./fedos_desktop_settings_controller.js";
import {
  planFedosSettingsApplication,
  type FedosSettingsApplicationPlan,
  type FedosSettingsApplicationPlanEntry,
} from "../../settings/application/fedos_settings_application_plan.js";
import {
  fedosSettingsEffectiveStateFromLoaded,
  fedosSettingsEffectiveStateAfterApplication,
  fedosSettingsEffectiveStateView,
  type FedosSettingsEffectiveState,
  type FedosSettingsEffectiveStateView,
  type FedosSettingsFieldApplicationRecord,
  type FedosSettingsFieldApplicationStatus,
} from "../../settings/application/fedos_settings_effective_state.js";
import type {
  FedosSettingsPresentationSink,
  FedosSettingsNotificationPresentationGate,
  FedosSettingsBackgroundSyncControl,
  FedosSettingsPortOutcome,
} from "./fedos_desktop_settings_application_ports.js";

/** The CLOSED transaction-result vocabulary (Phase E). Never call a partially-applied change "success". */
export type FedosSettingsApplicationTransactionOutcome =
  | "rejected-before-persist"
  | "no-change"
  | "persisted-and-applied"
  | "persisted-pending-runtime-restart"
  | "persisted-pending-application-restart"
  | "persisted-but-blocked"
  | "partially-applied"
  | "application-failed"
  | "rolled-back"
  | "rollback-failed";

export interface FedosSettingsApplicationReport {
  readonly outcome: FedosSettingsApplicationTransactionOutcome;
  /** Non-secret reason string, safe to display/log verbatim. */
  readonly reason: string;
  /** The plan that was executed (empty entries when nothing changed). */
  readonly plan: FedosSettingsApplicationPlan;
  /**
   * The honest, BOUNDARY-SAFE effective-state view after this pass — carries
   * only per-field statuses and non-secret summaries, never the raw
   * descriptors. `null` only when rejected before persist.
   */
  readonly effectiveState: FedosSettingsEffectiveStateView | null;
  /** Per-changed-field application records. */
  readonly fieldRecords: readonly FedosSettingsFieldApplicationRecord[];
}

function report(
  outcome: FedosSettingsApplicationTransactionOutcome,
  reason: string,
  plan: FedosSettingsApplicationPlan,
  effectiveState: FedosSettingsEffectiveState | null,
  fieldRecords: readonly FedosSettingsFieldApplicationRecord[],
): FedosSettingsApplicationReport {
  return Object.freeze({
    outcome,
    reason,
    plan,
    effectiveState: effectiveState === null ? null : fedosSettingsEffectiveStateView(effectiveState),
    fieldRecords: Object.freeze([...fieldRecords]),
  });
}

export interface FedosDesktopSettingsApplicationCoordinatorDeps {
  readonly controller: FedosDesktopSettingsController;
  readonly presentationSink: FedosSettingsPresentationSink;
  readonly notificationGate: FedosSettingsNotificationPresentationGate;
  readonly backgroundSyncControl: FedosSettingsBackgroundSyncControl;
}

interface FieldApplyResult {
  readonly record: FedosSettingsFieldApplicationStatus;
  readonly rolledBack: boolean;
  readonly rollbackFailed: boolean;
}

export class FedosDesktopSettingsApplicationCoordinator {
  readonly #deps: FedosDesktopSettingsApplicationCoordinatorDeps;
  #effective: FedosSettingsEffectiveState | null = null;

  constructor(deps: FedosDesktopSettingsApplicationCoordinatorDeps) {
    this.#deps = deps;
  }

  /**
   * Phase Q startup application. Loads persisted settings and seeds the live
   * immediate boundaries (theme / window layout / notification gate) from
   * them, so the running process reflects the durable settings from the first
   * frame. Does NOT auto-start/stop background sync (a subsystem action that
   * goes through the plan/confirmation path). Fails closed on a corrupt store.
   */
  initialize(): FedosSettingsResult<FedosSettingsEffectiveState> {
    const load = this.#deps.controller.load();
    if (load.outcome !== "ok") return load as FedosSettingsResult<FedosSettingsEffectiveState>;
    const persisted = load.value;
    this.#deps.presentationSink.applyTheme(persisted.theme);
    this.#deps.presentationSink.applyWindowLayout(persisted.windowLayout);
    this.#deps.notificationGate.setPresentationEnabled(persisted.notificationsEnabled);
    this.#effective = fedosSettingsEffectiveStateFromLoaded(persisted);
    return Object.freeze({ outcome: "ok", value: this.#effective });
  }

  /** The last-computed effective state, or `null` if `initialize()` has not run. */
  effectiveState(): FedosSettingsEffectiveState | null {
    return this.#effective;
  }

  /**
   * Phase B preview. Validates the candidate, then produces the closed plan
   * comparing the currently-effective descriptor against the candidate.
   * Persists NOTHING and applies NOTHING.
   */
  previewPlan(candidate: unknown): FedosSettingsResult<FedosSettingsApplicationPlan> {
    const validated = this.#deps.controller.validate(candidate);
    if (validated.outcome !== "ok") return validated as FedosSettingsResult<FedosSettingsApplicationPlan>;
    const plan = planFedosSettingsApplication(this.#currentEffectiveDescriptor(), validated.value);
    return Object.freeze({ outcome: "ok", value: plan });
  }

  /**
   * Phase D/E apply. Validates -> persists desired -> applies supported
   * actions in operation order -> records honest effective state. Never
   * throws; never fabricates success.
   */
  async apply(candidate: unknown): Promise<FedosSettingsApplicationReport> {
    const previousEffective = this.#currentEffectiveDescriptor();

    const validated = this.#deps.controller.validate(candidate);
    if (validated.outcome !== "ok") {
      const emptyPlan = planFedosSettingsApplication(previousEffective, previousEffective);
      const reason =
        validated.outcome === "invalid"
          ? `settings rejected before persist: ${validated.errors.join(", ")}`
          : `settings rejected before persist: ${validated.reason}`;
      return report("rejected-before-persist", reason, emptyPlan, null, []);
    }
    const desired = validated.value;
    const plan = planFedosSettingsApplication(previousEffective, desired);

    if (plan.noChange) {
      this.#deps.controller.save(desired); // keep durable == desired (idempotent)
      this.#effective = fedosSettingsEffectiveStateFromLoaded(desired);
      return report("no-change", "no applicable field changed", plan, this.#effective, []);
    }

    // Persist desired FIRST (accepted ordering, option C).
    const saved = this.#deps.controller.save(desired);
    if (saved.outcome !== "ok") {
      const reason = saved.outcome === "invalid" ? `persist failed: ${saved.errors.join(", ")}` : `persist failed: ${saved.reason}`;
      return report("application-failed", reason, plan, this.#effective, []);
    }

    // Apply each changed field in operation order.
    const records: FedosSettingsFieldApplicationRecord[] = [];
    let anyApplied = false;
    let anyRolledBack = false;
    let anyRollbackFailed = false;
    for (const entry of plan.entries) {
      const result = await this.#applyEntry(entry, desired, previousEffective);
      records.push(Object.freeze({ field: entry.field, status: result.record }));
      if (result.record === "applied") anyApplied = true;
      if (result.rolledBack) anyRolledBack = true;
      if (result.rollbackFailed) anyRollbackFailed = true;
    }

    this.#effective = fedosSettingsEffectiveStateAfterApplication(previousEffective, desired, desired, records);

    const derived = this.#deriveOutcome({ records, anyApplied, anyRolledBack, anyRollbackFailed });
    return report(derived.outcome, derived.reason, plan, this.#effective, records);
  }

  // -- internals --------------------------------------------------------

  #currentEffectiveDescriptor(): FedosSettingsDescriptorV1 {
    if (this.#effective !== null) return this.#effective.effective;
    const load = this.#deps.controller.load();
    if (load.outcome === "ok") {
      this.#effective = fedosSettingsEffectiveStateFromLoaded(load.value);
      return load.value;
    }
    // Corrupt/failed store and never initialized: use the descriptor's own
    // canonical default as the diff baseline — never a fabricated value. Every
    // field then reads as "changed", so the apply pass still drives the live
    // boundaries honestly against the user's desired descriptor.
    return defaultFedosSettingsDescriptorV1();
  }

  async #applyEntry(
    entry: FedosSettingsApplicationPlanEntry,
    desired: FedosSettingsDescriptorV1,
    previousEffective: FedosSettingsDescriptorV1,
  ): Promise<FieldApplyResult> {
    switch (entry.applicationClass) {
      case "immediate":
        return this.#recordFromPortOutcome(this.#applyImmediate(entry, desired), entry, previousEffective);
      case "subsystem": {
        const outcome =
          entry.action === "start-background-sync"
            ? this.#deps.backgroundSyncControl.start()
            : await this.#deps.backgroundSyncControl.stop();
        if (outcome === "unavailable") {
          // No accepted scheduler boundary in this Runtime -> honestly blocked.
          return { record: "blocked", rolledBack: false, rollbackFailed: false };
        }
        return this.#recordFromPortOutcome(outcome, entry, previousEffective);
      }
      case "runtime-restart":
        return { record: "pending-runtime-restart", rolledBack: false, rollbackFailed: false };
      case "application-restart":
        return { record: "pending-application-restart", rolledBack: false, rollbackFailed: false };
      case "unsupported":
        return { record: "blocked", rolledBack: false, rollbackFailed: false };
    }
  }

  #applyImmediate(entry: FedosSettingsApplicationPlanEntry, desired: FedosSettingsDescriptorV1): FedosSettingsPortOutcome {
    switch (entry.field) {
      case "theme":
        return this.#deps.presentationSink.applyTheme(desired.theme);
      case "windowLayout":
        return this.#deps.presentationSink.applyWindowLayout(desired.windowLayout);
      case "notificationsEnabled":
        return this.#deps.notificationGate.setPresentationEnabled(desired.notificationsEnabled);
      default:
        return "failed";
    }
  }

  #recordFromPortOutcome(
    outcome: FedosSettingsPortOutcome,
    entry: FedosSettingsApplicationPlanEntry,
    previousEffective: FedosSettingsDescriptorV1,
  ): FieldApplyResult {
    if (outcome === "applied") return { record: "applied", rolledBack: false, rollbackFailed: false };
    if (outcome === "unchanged") return { record: "unchanged", rolledBack: false, rollbackFailed: false };
    // failed / unavailable -> attempt rollback where supported.
    if (entry.rollbackAvailable) {
      const reverted = this.#rollbackField(entry, previousEffective);
      if (reverted === "applied" || reverted === "unchanged") {
        return { record: "failed", rolledBack: true, rollbackFailed: false };
      }
      return { record: "failed", rolledBack: false, rollbackFailed: true };
    }
    return { record: "failed", rolledBack: false, rollbackFailed: false };
  }

  /** Re-asserts the previously-effective value on the live sink for a rollback-eligible field. Never throws. */
  #rollbackField(entry: FedosSettingsApplicationPlanEntry, previousEffective: FedosSettingsDescriptorV1): FedosSettingsPortOutcome {
    switch (entry.field) {
      case "theme":
        return this.#deps.presentationSink.applyTheme(previousEffective.theme);
      case "windowLayout":
        return this.#deps.presentationSink.applyWindowLayout(previousEffective.windowLayout);
      case "notificationsEnabled":
        return this.#deps.notificationGate.setPresentationEnabled(previousEffective.notificationsEnabled);
      case "backgroundSyncEnabled":
        return previousEffective.backgroundSyncEnabled ? this.#deps.backgroundSyncControl.start() : "unchanged";
      default:
        return "unavailable";
    }
  }

  #deriveOutcome(input: {
    readonly records: readonly FedosSettingsFieldApplicationRecord[];
    readonly anyApplied: boolean;
    readonly anyRolledBack: boolean;
    readonly anyRollbackFailed: boolean;
  }): { outcome: FedosSettingsApplicationTransactionOutcome; reason: string } {
    const has = (s: FedosSettingsFieldApplicationStatus): boolean => input.records.some((r) => r.status === s);
    const anyFailed = has("failed");
    const anyPendingRuntime = has("pending-runtime-restart");
    const anyPendingApp = has("pending-application-restart");
    const anyBlocked = has("blocked");
    const appliedOrUnchanged = input.records.every((r) => r.status === "applied" || r.status === "unchanged");

    if (input.anyRollbackFailed) return { outcome: "rollback-failed", reason: "a field failed to apply and its rollback also failed" };
    if (anyFailed && input.anyRolledBack && !input.anyApplied && !anyPendingRuntime && !anyPendingApp && !anyBlocked) {
      return { outcome: "rolled-back", reason: "a field failed to apply and was safely rolled back" };
    }
    if (anyFailed && !input.anyApplied && !anyPendingRuntime && !anyPendingApp && !anyBlocked) {
      return { outcome: "application-failed", reason: "one or more fields failed to apply" };
    }
    if (anyFailed) return { outcome: "partially-applied", reason: "some fields applied; at least one failed" };
    if (appliedOrUnchanged) return { outcome: "persisted-and-applied", reason: "all changed fields applied to live behavior" };
    if (input.anyApplied && (anyPendingRuntime || anyPendingApp || anyBlocked)) {
      return { outcome: "partially-applied", reason: "some fields applied live; others persisted pending restart or blocked" };
    }
    if (anyPendingRuntime && !anyPendingApp) {
      return { outcome: "persisted-pending-runtime-restart", reason: "persisted; a Desktop Runtime restart is required to apply" };
    }
    if (anyPendingApp) return { outcome: "persisted-pending-application-restart", reason: "persisted; an application restart is required to apply" };
    if (anyBlocked) return { outcome: "persisted-but-blocked", reason: "persisted; no accepted application boundary exists" };
    return { outcome: "persisted-and-applied", reason: "applied" };
  }
}
