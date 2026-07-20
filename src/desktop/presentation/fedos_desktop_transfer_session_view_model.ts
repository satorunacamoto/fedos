/**
 * Secure Runtime Alpha 3801-3880 — Transfer Session ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.syncTransfersList()` only. Every
 * `FedosDeviceSyncTransferSessionView` this ViewModel surfaces already
 * carries `relayAccepted`/`deviceImported` as two INDEPENDENT booleans
 * (`../runtime/fedos_device_sync_operational_facade.ts`'s own header) —
 * this file never collapses them into one "synced" flag.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceSyncTransferSessionView } from "../runtime/fedos_device_sync_operational_facade.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopTransferSessionViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<readonly FedosDeviceSyncTransferSessionView[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<readonly FedosDeviceSyncTransferSessionView[]> {
    return this.#state;
  }

  async refresh(): Promise<FedosDesktopViewModelState<readonly FedosDeviceSyncTransferSessionView[]>> {
    this.#state = fedosViewModelLoading();
    this.#state = fedosViewModelFromShellResult(this.#shell.syncTransfersList());
    return this.#state;
  }
}
