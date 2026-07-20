/**
 * Secure Runtime Alpha 3801-3880 — Transfer Session Renderer.
 *
 * Consumes `FedosDesktopTransferSessionViewModel` ONLY -- projects `.state`
 * through `fedosRenderList()`. Never re-derives `relayAccepted`/
 * `deviceImported` -- both already arrive as two independent booleans on
 * each `FedosDeviceSyncTransferSessionView` (see that type's own header).
 */

import type { FedosDesktopTransferSessionViewModel } from "../presentation/fedos_desktop_transfer_session_view_model.js";
import type { FedosDeviceSyncTransferSessionView } from "../runtime/fedos_device_sync_operational_facade.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopTransferSessionRenderer {
  readonly #viewModel: FedosDesktopTransferSessionViewModel;

  constructor(viewModel: FedosDesktopTransferSessionViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeviceSyncTransferSessionView>> {
    return fedosRenderModel(this.#viewModel.state, (sessions) => fedosRenderList(sessions));
  }
}
