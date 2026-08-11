/**
 * Secure Runtime Alpha 3401-3480 — Message Renderer.
 *
 * Consumes THREE ViewModels together — `FedosDesktopMessageListViewModel`,
 * `FedosDesktopComposeMessageViewModel`, and
 * `FedosDesktopUnreadCounterViewModel` — because a real message pane
 * renders exactly these three facets as one cohesive unit (the message
 * list, the compose box beneath it, and the unread badge for whichever
 * conversation is open). This Arc's own required renderer list names one
 * "MessageRenderer", not three separate ones — Reply gets its OWN renderer
 * (`./fedos_desktop_reply_renderer.ts`) because replying is a distinct,
 * contextual UI mode (tied to one specific message), never folded in here.
 *
 * The three facets are independent ViewModels with independent lifecycles
 * (the list can be `"loaded"` while a compose send is still `"loading"`),
 * so this renderer's own output is a plain composite of three INDEPENDENT
 * `FedosDesktopRenderModel`s — never one forced, artificial top-level
 * `kind`.
 */

import type { FedosDesktopMessageListViewModel } from "../presentation/fedos_desktop_message_list_view_model.js";
import type { FedosDesktopComposeMessageViewModel } from "../presentation/fedos_desktop_compose_message_view_model.js";
import type { FedosDesktopUnreadCounterViewModel, FedosDesktopUnreadCount } from "../presentation/fedos_desktop_unread_counter_view_model.js";
import type { FedosMessageView, FedosMessageSendResultView } from "../shell/fedos_desktop_shell_view_models.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export interface FedosDesktopComposeRenderModel {
  readonly body: string;
  readonly canSend: boolean;
  readonly send: FedosDesktopRenderModel<FedosMessageSendResultView>;
}

export interface FedosDesktopMessagePaneRenderModel {
  readonly messages: FedosDesktopRenderModel<FedosDesktopRenderList<FedosMessageView>>;
  readonly compose: FedosDesktopComposeRenderModel;
  readonly unread: FedosDesktopRenderModel<FedosDesktopUnreadCount>;
}

export class FedosDesktopMessageRenderer {
  readonly #messages: FedosDesktopMessageListViewModel;
  readonly #compose: FedosDesktopComposeMessageViewModel;
  readonly #unread: FedosDesktopUnreadCounterViewModel;

  constructor(messages: FedosDesktopMessageListViewModel, compose: FedosDesktopComposeMessageViewModel, unread: FedosDesktopUnreadCounterViewModel) {
    this.#messages = messages;
    this.#compose = compose;
    this.#unread = unread;
  }

  render(): FedosDesktopMessagePaneRenderModel {
    return Object.freeze({
      messages: fedosRenderModel(this.#messages.state, (items) => fedosRenderList(items)),
      compose: Object.freeze({
        body: this.#compose.body,
        canSend: this.#compose.body.length > 0,
        send: fedosRenderModel(this.#compose.state, (data) => data),
      }),
      unread: fedosRenderModel(this.#unread.state, (data) => data),
    });
  }
}
