/**
 * Secure Runtime Alpha 3241-3320 — Runtime Status ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.status()`/`start()`/`stop()`/
 * `deviceStatus()` -- the ONLY lifecycle/status surface the Shell exposes.
 * `deviceStatus()` remains honestly `"unavailable"` on this base (Device
 * Sync Foundation is real but wired into nothing, per that method's own
 * header) -- this ViewModel surfaces that fact, it does not paper over it.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import type { FedosDeviceStatusView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  fedosViewModelLoaded,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export interface FedosDesktopRuntimeStatusView {
  readonly runtimeStatus: "stopped" | "running";
  readonly deviceStatus: FedosDeviceStatusView | null;
}

export class FedosDesktopRuntimeStatusViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<FedosDesktopRuntimeStatusView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosDesktopRuntimeStatusView> {
    return this.#state;
  }

  /** Re-reads `status()` (always available) plus `deviceStatus()` (only meaningful while running -- `null` while stopped, never a fabricated reading). */
  async refresh(): Promise<FedosDesktopViewModelState<FedosDesktopRuntimeStatusView>> {
    this.#state = fedosViewModelLoading();
    const runtimeStatus = this.#shell.status();
    let deviceStatus: FedosDeviceStatusView | null = null;
    if (runtimeStatus === "running") {
      const deviceResult = this.#shell.deviceStatus();
      deviceStatus = deviceResult.outcome === "ok" ? deviceResult.value : null;
    }
    this.#state = fedosViewModelLoaded({ runtimeStatus, deviceStatus });
    return this.#state;
  }

  /** Thin pass-through to `shell.start()`, refreshing this ViewModel's own state afterward -- no lifecycle logic of its own. */
  async start(config: FedosDesktopRuntimeConfig): Promise<FedosDesktopViewModelState<FedosDesktopRuntimeStatusView>> {
    const result = await this.#shell.start(config);
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelFromShellResult(result);
      return this.#state;
    }
    return this.refresh();
  }

  /** Thin pass-through to `shell.stop()`, refreshing this ViewModel's own state afterward. */
  async stop(): Promise<FedosDesktopViewModelState<FedosDesktopRuntimeStatusView>> {
    const result = await this.#shell.stop();
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelFromShellResult(result);
      return this.#state;
    }
    return this.refresh();
  }
}
