/**
 * Secure Runtime Alpha 3801-3880 — Device Inventory ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.devicesList()`/`deviceDetail()` only —
 * owns no Device Registry/Trust logic of its own. `refresh()` re-lists every
 * Device this account currently owns (any trust state, including revoked);
 * `selectDevice()` is a separate action loading one Device's own detail into
 * `#selected`, mirroring `FedosDesktopConversationDetailViewModel`'s own
 * "list + selected detail" composition one layer down.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceSyncDeviceView } from "../runtime/fedos_device_sync_operational_facade.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopDeviceInventoryViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #listState: FedosDesktopViewModelState<readonly FedosDeviceSyncDeviceView[]> = fedosViewModelIdle();
  #selectedState: FedosDesktopViewModelState<FedosDeviceSyncDeviceView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get listState(): FedosDesktopViewModelState<readonly FedosDeviceSyncDeviceView[]> {
    return this.#listState;
  }

  get selectedState(): FedosDesktopViewModelState<FedosDeviceSyncDeviceView> {
    return this.#selectedState;
  }

  async refresh(): Promise<FedosDesktopViewModelState<readonly FedosDeviceSyncDeviceView[]>> {
    this.#listState = fedosViewModelLoading();
    this.#listState = fedosViewModelFromShellResult(this.#shell.devicesList());
    return this.#listState;
  }

  async selectDevice(deviceId: string): Promise<FedosDesktopViewModelState<FedosDeviceSyncDeviceView>> {
    this.#selectedState = fedosViewModelLoading();
    this.#selectedState = fedosViewModelFromShellResult(this.#shell.deviceDetail(deviceId));
    return this.#selectedState;
  }
}
