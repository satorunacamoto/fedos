/**
 * Secure Runtime Alpha 3401-3480 — Conversation List Renderer.
 *
 * Consumes `FedosDesktopConversationListViewModel` ONLY — reads its
 * `.state` getter, calls no action method. No sorting/filtering logic of
 * any kind: `listConversations()` (Shell) already sorts/filters
 * deterministically; this file only projects the result into a render
 * model.
 */

import type { FedosDesktopConversationListViewModel } from "../presentation/fedos_desktop_conversation_list_view_model.js";
import type { FedosConversationSummaryView } from "../shell/fedos_desktop_shell_view_models.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export class FedosDesktopConversationListRenderer {
  readonly #viewModel: FedosDesktopConversationListViewModel;

  constructor(viewModel: FedosDesktopConversationListViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosConversationSummaryView>> {
    return fedosRenderModel(this.#viewModel.state, (items) => fedosRenderList(items));
  }
}
