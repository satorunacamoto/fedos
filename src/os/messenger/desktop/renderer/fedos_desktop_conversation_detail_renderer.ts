/**
 * Secure Runtime Alpha 3401-3480 — Conversation Detail Renderer.
 *
 * Consumes `FedosDesktopConversationDetailViewModel` ONLY. No "empty"
 * concept for a single-entity renderer — a conversation either loaded or
 * did not (idle/loading/error); `content` is the Shell's own
 * `FedosConversationDetailView` verbatim, no field renamed or reshaped.
 */

import type { FedosDesktopConversationDetailViewModel } from "../presentation/fedos_desktop_conversation_detail_view_model.js";
import type { FedosConversationDetailView } from "../shell/fedos_desktop_shell_view_models.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "./fedos_desktop_render_model.js";

export class FedosDesktopConversationDetailRenderer {
  readonly #viewModel: FedosDesktopConversationDetailViewModel;

  constructor(viewModel: FedosDesktopConversationDetailViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosConversationDetailView> {
    return fedosRenderModel(this.#viewModel.state, (data) => data);
  }
}
