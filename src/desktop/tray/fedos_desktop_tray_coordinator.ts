/**
 * Secure Runtime Alpha 4261-4340 — Phase C: System Tray Boundary, Coordinator.
 *
 * `TrayCoordinator` is orchestration ONLY — validates a candidate tray
 * action (`./fedos_desktop_tray_types.ts`), then delegates to EXACTLY the
 * existing Registry/ViewModel call each action already names, never
 * inventing a new fact or mutation:
 *
 *   - `"open-window"`             -> reports which conversation id a caller
 *                                    should open/focus (the actual
 *                                    `BrowserWindow` creation stays the
 *                                    Electron adapter's job, Phase E — this
 *                                    file has no Electron import).
 *   - `"recent-conversations"`    -> `FedosDesktopConversationWindowRegistry.recentConversationIds`
 *                                    (Alpha 4181-4260, unmodified).
 *   - `"device-sync-status"`      -> `FedosDesktopDeviceSyncStatusViewModel.refresh()`.
 *   - `"pause-sync"`              -> `FedosDesktopDeviceSyncStatusViewModel.stop()`.
 *   - `"resume-sync"`             -> `FedosDesktopDeviceSyncStatusViewModel.start()`.
 *   - `"exit"`                    -> reports an "exit requested" outcome;
 *                                    the Electron adapter decides whether/
 *                                    how to actually call `app.quit()`
 *                                    (Phase D "clean shutdown" is the
 *                                    Background Lifecycle Coordinator's own
 *                                    job, not this file's).
 *
 * No persistence, no crypto, no transport, no Electron import of any kind.
 */

import type { FedosDesktopConversationWindowRegistry } from "../navigation/fedos_desktop_conversation_window_registry.js";
import type { FedosDesktopDeviceSyncStatusViewModel } from "../presentation/fedos_desktop_device_sync_status_view_model.js";
import type { FedosDesktopViewModelState } from "../presentation/fedos_desktop_view_model_state.js";
import type { FedosDeviceSyncSchedulerStatusView } from "../runtime/fedos_device_sync_operational_facade.js";
import { validateFedosDesktopTrayActionRequest } from "./fedos_desktop_tray_types.js";

/** The Registry surface this Coordinator actually reads -- never the whole class, per this codebase's own "narrowest dependency" discipline. */
export type FedosDesktopTrayRegistryView = Pick<FedosDesktopConversationWindowRegistry, "recentConversationIds" | "lastOpenedConversationId">;

export type FedosDesktopTrayActionOutcome =
  | { readonly action: "open-window"; readonly outcome: "ok"; readonly conversationId: string | null }
  | { readonly action: "recent-conversations"; readonly outcome: "ok"; readonly conversationIds: readonly string[] }
  | { readonly action: "device-sync-status"; readonly outcome: "ok" | "error"; readonly status: FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView> }
  | { readonly action: "pause-sync"; readonly outcome: "ok" | "error"; readonly status: FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView> }
  | { readonly action: "resume-sync"; readonly outcome: "ok" | "error"; readonly status: FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView> }
  | { readonly action: "exit"; readonly outcome: "ok" }
  | { readonly action: "rejected"; readonly outcome: "rejected"; readonly reason: string };

export class TrayCoordinator {
  readonly #registry: FedosDesktopTrayRegistryView;
  readonly #deviceSyncStatus: FedosDesktopDeviceSyncStatusViewModel;

  constructor(registry: FedosDesktopTrayRegistryView, deviceSyncStatus: FedosDesktopDeviceSyncStatusViewModel) {
    this.#registry = registry;
    this.#deviceSyncStatus = deviceSyncStatus;
  }

  /** Validates, then dispatches, one tray action. Never throws -- every branch returns a closed outcome. */
  async dispatch(candidate: unknown): Promise<FedosDesktopTrayActionOutcome> {
    const validated = validateFedosDesktopTrayActionRequest(candidate);
    if (validated === null) {
      return Object.freeze({ action: "rejected", outcome: "rejected", reason: "malformed or unrecognized tray action" });
    }

    switch (validated.action) {
      case "open-window":
        return Object.freeze({
          action: "open-window",
          outcome: "ok",
          conversationId: validated.conversationId ?? this.#registry.lastOpenedConversationId,
        });

      case "recent-conversations":
        return Object.freeze({ action: "recent-conversations", outcome: "ok", conversationIds: this.#registry.recentConversationIds });

      case "device-sync-status": {
        const status = await this.#deviceSyncStatus.refresh();
        return Object.freeze({ action: "device-sync-status", outcome: status.status === "error" ? "error" : "ok", status });
      }

      case "pause-sync": {
        const status = await this.#deviceSyncStatus.stop();
        return Object.freeze({ action: "pause-sync", outcome: status.status === "error" ? "error" : "ok", status });
      }

      case "resume-sync": {
        const status = await this.#deviceSyncStatus.start();
        return Object.freeze({ action: "resume-sync", outcome: status.status === "error" ? "error" : "ok", status });
      }

      case "exit":
        return Object.freeze({ action: "exit", outcome: "ok" });
    }
  }
}
