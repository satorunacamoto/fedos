/**
 * Secure Runtime Alpha 3801-3880 — Sync Status ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.deviceSyncStatus()`/`deviceSyncStart()`/
 * `deviceSyncStop()`/`deviceSyncNow()` only. Every mutating action
 * (`start()`/`stop()`/`triggerNow()`) refreshes this ViewModel's own state
 * afterward, mirroring `FedosDesktopRuntimeStatusViewModel`'s own
 * "action → refresh" discipline — this file never renders anything and
 * never claims a tick "delivered" beyond what the Shell itself reported.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceSyncSchedulerStatusView } from "../runtime/fedos_device_sync_operational_facade.js";
import type { FedosDeviceSyncTickEntry } from "../../device/sync_scheduler/fedos_device_sync_scheduler.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopDeviceSyncStatusViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView> = fedosViewModelIdle();
  #lastTickState: FedosDesktopViewModelState<readonly FedosDeviceSyncTickEntry[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView> {
    return this.#state;
  }

  get lastTickState(): FedosDesktopViewModelState<readonly FedosDeviceSyncTickEntry[]> {
    return this.#lastTickState;
  }

  async refresh(): Promise<FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView>> {
    this.#state = fedosViewModelLoading();
    this.#state = fedosViewModelFromShellResult(this.#shell.deviceSyncStatus());
    return this.#state;
  }

  async start(): Promise<FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView>> {
    const result = this.#shell.deviceSyncStart();
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelFromShellResult(result);
      return this.#state;
    }
    return this.refresh();
  }

  async stop(): Promise<FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView>> {
    const result = await this.#shell.deviceSyncStop();
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelFromShellResult(result);
      return this.#state;
    }
    return this.refresh();
  }

  /** Triggers one manual tick, records its own coarse per-target outcomes (`lastTickState`), then refreshes the aggregate status. */
  async triggerNow(): Promise<FedosDesktopViewModelState<FedosDeviceSyncSchedulerStatusView>> {
    this.#lastTickState = fedosViewModelLoading();
    const result = await this.#shell.deviceSyncNow();
    this.#lastTickState = fedosViewModelFromShellResult(result);
    return this.refresh();
  }
}
