/**
 * Secure Runtime Alpha 3401-3480 — Status Renderer.
 *
 * Consumes `FedosDesktopRuntimeStatusViewModel` ONLY -- a direct,
 * unreshaped projection of its `.state` (the ViewModel's own
 * `FedosDesktopRuntimeStatusView`, `{runtimeStatus, deviceStatus}`,
 * already presentation-ready).
 */

import type { FedosDesktopRuntimeStatusViewModel, FedosDesktopRuntimeStatusView } from "../presentation/fedos_desktop_runtime_status_view_model.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "./fedos_desktop_render_model.js";

export class FedosDesktopStatusRenderer {
  readonly #viewModel: FedosDesktopRuntimeStatusViewModel;

  constructor(viewModel: FedosDesktopRuntimeStatusViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosDesktopRuntimeStatusView> {
    return fedosRenderModel(this.#viewModel.state, (data) => data);
  }
}
