/**
 * Secure Runtime Alpha 3801-3880 — Device Sync Status Renderer.
 *
 * Consumes `FedosDesktopDeviceSyncStatusViewModel` ONLY. `renderStatus()`
 * projects `.state` (the Scheduler's own aggregate status) unreshaped;
 * `renderLastTick()` projects `.lastTickState` through `fedosRenderList()`
 * -- the per-target tick outcomes from the most recent manual/interval
 * tick, never re-labeled as a whole-runtime "synced" fact.
 */

import type { FedosDesktopDeviceSyncStatusViewModel } from "../presentation/fedos_desktop_device_sync_status_view_model.js";
import type { FedosDeviceSyncSchedulerStatusView } from "../runtime/fedos_device_sync_operational_facade.js";
import type { FedosDeviceSyncTickEntry } from "../../device/sync_scheduler/fedos_device_sync_scheduler.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopDeviceSyncStatusRenderer {
  readonly #viewModel: FedosDesktopDeviceSyncStatusViewModel;

  constructor(viewModel: FedosDesktopDeviceSyncStatusViewModel) {
    this.#viewModel = viewModel;
  }

  renderStatus(): FedosDesktopRenderModel<FedosDeviceSyncSchedulerStatusView> {
    return fedosRenderModel(this.#viewModel.state, (status) => status);
  }

  renderLastTick(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeviceSyncTickEntry>> {
    return fedosRenderModel(this.#viewModel.lastTickState, (entries) => fedosRenderList(entries));
  }
}
