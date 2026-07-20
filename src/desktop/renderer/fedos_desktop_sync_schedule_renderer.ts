/**
 * Secure Runtime Alpha 3801-3880 — Sync Schedule Renderer.
 *
 * Consumes `FedosDesktopSyncScheduleViewModel` ONLY -- projects `.state`
 * through `fedosRenderList()`.
 */

import type { FedosDesktopSyncScheduleViewModel } from "../presentation/fedos_desktop_sync_schedule_view_model.js";
import type { FedosDeviceSyncScheduleView } from "../runtime/fedos_device_sync_operational_facade.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopSyncScheduleRenderer {
  readonly #viewModel: FedosDesktopSyncScheduleViewModel;

  constructor(viewModel: FedosDesktopSyncScheduleViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeviceSyncScheduleView>> {
    return fedosRenderModel(this.#viewModel.state, (schedules) => fedosRenderList(schedules));
  }
}
