/**
 * Secure Runtime Alpha 3801-3880 — Conflict List/Detail Renderer.
 *
 * Consumes `FedosDesktopSyncConflictViewModel` ONLY. `renderList()` projects
 * `.listState` through `fedosRenderList()`; `renderDetail()` projects
 * `.selectedState` unreshaped.
 */

import type { FedosDesktopSyncConflictViewModel } from "../presentation/fedos_desktop_sync_conflict_view_model.js";
import type { FedosDeviceSyncConflictView } from "../runtime/fedos_device_sync_operational_facade.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopSyncConflictRenderer {
  readonly #viewModel: FedosDesktopSyncConflictViewModel;

  constructor(viewModel: FedosDesktopSyncConflictViewModel) {
    this.#viewModel = viewModel;
  }

  renderList(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeviceSyncConflictView>> {
    return fedosRenderModel(this.#viewModel.listState, (conflicts) => fedosRenderList(conflicts));
  }

  renderDetail(): FedosDesktopRenderModel<FedosDeviceSyncConflictView> {
    return fedosRenderModel(this.#viewModel.selectedState, (conflict) => conflict);
  }
}
