/**
 * Secure Runtime Alpha 3801-3880 — Conflict List + Detail ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.syncConflictsList()`/`syncConflictDetail()`/
 * `syncConflictAcknowledge()` only. `acknowledge()` is the ONLY mutating
 * action this ViewModel exposes — the SAME safe, closed action vocabulary
 * the Shell/facade already enforce (`accept-identical`/`discard-invalid`/
 * `refresh-missing-dependency`/`acknowledge`); it refreshes the list
 * afterward, mirroring every other action ViewModel's own "action →
 * refresh" discipline.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceSyncConflictView } from "../runtime/fedos_device_sync_operational_facade.js";
import type { FedosDeviceSyncConflictResolutionAction } from "../../device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopSyncConflictViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #listState: FedosDesktopViewModelState<readonly FedosDeviceSyncConflictView[]> = fedosViewModelIdle();
  #selectedState: FedosDesktopViewModelState<FedosDeviceSyncConflictView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get listState(): FedosDesktopViewModelState<readonly FedosDeviceSyncConflictView[]> {
    return this.#listState;
  }

  get selectedState(): FedosDesktopViewModelState<FedosDeviceSyncConflictView> {
    return this.#selectedState;
  }

  async refresh(includeResolved = false): Promise<FedosDesktopViewModelState<readonly FedosDeviceSyncConflictView[]>> {
    this.#listState = fedosViewModelLoading();
    this.#listState = fedosViewModelFromShellResult(this.#shell.syncConflictsList(includeResolved));
    return this.#listState;
  }

  async selectConflict(conflictId: string): Promise<FedosDesktopViewModelState<FedosDeviceSyncConflictView>> {
    this.#selectedState = fedosViewModelLoading();
    this.#selectedState = fedosViewModelFromShellResult(this.#shell.syncConflictDetail(conflictId));
    return this.#selectedState;
  }

  /** Only the safe, existing Conflict Authority actions -- never a generic "resolve-any-conflict." Refreshes `listState` afterward. */
  async acknowledge(conflictId: string, action: FedosDeviceSyncConflictResolutionAction): Promise<FedosDesktopViewModelState<readonly FedosDeviceSyncConflictView[]>> {
    const result = this.#shell.syncConflictAcknowledge(conflictId, action);
    if (result.outcome !== "ok") {
      this.#listState = fedosViewModelFromShellResult(result);
      return this.#listState;
    }
    return this.refresh();
  }
}
