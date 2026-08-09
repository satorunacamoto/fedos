/**
 * Secure Runtime Alpha 3401-3480 — Reply Renderer.
 *
 * Consumes `FedosDesktopReplyViewModel` ONLY. `draft` (what the user is
 * currently typing, and to whom) and `send` (the outcome of the last real
 * `reply()` call) are independent facets, exactly mirroring
 * `FedosDesktopMessageRenderer`'s own `compose`/`messages` split.
 */

import type { FedosDesktopReplyViewModel } from "../presentation/fedos_desktop_reply_view_model.js";
import type { FedosMessageSendResultView } from "../shell/fedos_desktop_shell_view_models.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "./fedos_desktop_render_model.js";

export interface FedosDesktopReplyDraftRenderModel {
  readonly replyToMessageId: string | null;
  readonly body: string;
  readonly canSend: boolean;
}

export interface FedosDesktopReplyRenderModel {
  readonly draft: FedosDesktopReplyDraftRenderModel;
  readonly send: FedosDesktopRenderModel<FedosMessageSendResultView>;
}

export class FedosDesktopReplyRenderer {
  readonly #viewModel: FedosDesktopReplyViewModel;

  constructor(viewModel: FedosDesktopReplyViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopReplyRenderModel {
    return Object.freeze({
      draft: Object.freeze({
        replyToMessageId: this.#viewModel.replyToMessageId,
        body: this.#viewModel.body,
        canSend: this.#viewModel.replyToMessageId !== null && this.#viewModel.body.length > 0,
      }),
      send: fedosRenderModel(this.#viewModel.state, (data) => data),
    });
  }
}
