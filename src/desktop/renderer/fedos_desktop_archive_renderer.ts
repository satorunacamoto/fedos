/**
 * Secure Runtime Alpha 3401-3480 — Archive Renderer.
 *
 * Consumes `FedosDesktopArchiveViewModel` ONLY. `content` is the Shell's
 * own `FedosContentAccessorArchiveValue` verbatim (already a closed,
 * per-operation union — `{operation:"inspect", result}` etc.) — no
 * reshaping, since it is already exactly the shape a future UI needs to
 * discriminate on `operation`.
 */

import type { FedosDesktopArchiveViewModel } from "../presentation/fedos_desktop_archive_view_model.js";
import type { FedosContentAccessorArchiveValue } from "../content_accessor/fedos_desktop_conversation_content_accessor_result.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "./fedos_desktop_render_model.js";

export class FedosDesktopArchiveRenderer {
  readonly #viewModel: FedosDesktopArchiveViewModel;

  constructor(viewModel: FedosDesktopArchiveViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosContentAccessorArchiveValue> {
    return fedosRenderModel(this.#viewModel.state, (data) => data);
  }
}
