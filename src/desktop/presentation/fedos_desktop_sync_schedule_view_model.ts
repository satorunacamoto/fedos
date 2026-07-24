/**
 * Secure Runtime Alpha 3801-3880 — Sync Schedule ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.syncSchedulesList()` only — a
 * read-only list of every durable Schedule this Runtime's own Scheduler
 * currently tracks (pending, in-progress, completed, failed,
 * operator-required), never a mutation surface of its own.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceSyncScheduleView } from "../runtime/fedos_device_sync_operational_facade.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopSyncScheduleViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<readonly FedosDeviceSyncScheduleView[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<readonly FedosDeviceSyncScheduleView[]> {
    return this.#state;
  }

  async refresh(): Promise<FedosDesktopViewModelState<readonly FedosDeviceSyncScheduleView[]>> {
    this.#state = fedosViewModelLoading();
    this.#state = fedosViewModelFromShellResult(this.#shell.syncSchedulesList());
    return this.#state;
  }
}
