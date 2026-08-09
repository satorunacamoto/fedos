/**
 * Secure Runtime Alpha 3801-3880 — Device List/Detail Renderer.
 *
 * Consumes `FedosDesktopDeviceInventoryViewModel` ONLY -- `renderList()`
 * projects `.listState` through `fedosRenderList()` (this directory's own
 * shared list-shaping helper); `renderDetail()` projects `.selectedState`
 * unreshaped (already presentation-ready).
 */

import type { FedosDesktopDeviceInventoryViewModel } from "../presentation/fedos_desktop_device_inventory_view_model.js";
import type { FedosDeviceSyncDeviceView } from "../runtime/fedos_device_sync_operational_facade.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopDeviceListRenderer {
  readonly #viewModel: FedosDesktopDeviceInventoryViewModel;

  constructor(viewModel: FedosDesktopDeviceInventoryViewModel) {
    this.#viewModel = viewModel;
  }

  renderList(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeviceSyncDeviceView>> {
    return fedosRenderModel(this.#viewModel.listState, (devices) => fedosRenderList(devices));
  }

  renderDetail(): FedosDesktopRenderModel<FedosDeviceSyncDeviceView> {
    return fedosRenderModel(this.#viewModel.selectedState, (device) => device);
  }
}
