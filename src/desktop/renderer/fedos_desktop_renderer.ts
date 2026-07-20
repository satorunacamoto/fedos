/**
 * Secure Runtime Alpha 3401-3480 ("Desktop UI Renderer Boundary") — the
 * named top-level deliverable.
 *
 * `FedosDesktopRenderer` is the rendering-layer counterpart to
 * `FedosDesktopConversationUiPresentationBoundary`
 * (`../presentation/fedos_desktop_conversation_ui_presentation_boundary.ts`,
 * Alpha 3241-3320) — constructed FROM one presentation boundary, it owns
 * exactly one of each content Renderer in this directory, wired to that
 * SAME boundary's own ViewModel instances. Never a second, divergent
 * ViewModel or Shell.
 *
 * HARD GUARDRAILS (this Arc's own, restated from every renderer file this
 * class composes):
 *   - No business logic, no Runtime, no crypto, no persistence anywhere
 *     under `src/desktop/renderer/` — every renderer reads ONLY a
 *     ViewModel's own already-public getters.
 *   - No Electron/React/Tauri/rendering framework, no HTML/CSS/DOM, no
 *     browser global.
 *   - A closed, pure-data render-model vocabulary
 *     (`fedos_desktop_render_model.ts`) — never a raw `Error`, a
 *     persistence record, or a crypto handle.
 */

import type { FedosDesktopConversationUiPresentationBoundary } from "../presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { FedosDesktopConversationListRenderer } from "./fedos_desktop_conversation_list_renderer.js";
import { FedosDesktopConversationDetailRenderer } from "./fedos_desktop_conversation_detail_renderer.js";
import { FedosDesktopMessageRenderer } from "./fedos_desktop_message_renderer.js";
import { FedosDesktopReplyRenderer } from "./fedos_desktop_reply_renderer.js";
import { FedosDesktopSearchRenderer } from "./fedos_desktop_search_renderer.js";
import { FedosDesktopArchiveRenderer } from "./fedos_desktop_archive_renderer.js";
import { FedosDesktopMembershipRenderer } from "./fedos_desktop_membership_renderer.js";
import { FedosDesktopStatusRenderer } from "./fedos_desktop_status_renderer.js";

export class FedosDesktopRenderer {
  readonly conversationList: FedosDesktopConversationListRenderer;
  readonly conversationDetail: FedosDesktopConversationDetailRenderer;
  readonly message: FedosDesktopMessageRenderer;
  readonly reply: FedosDesktopReplyRenderer;
  readonly search: FedosDesktopSearchRenderer;
  readonly archive: FedosDesktopArchiveRenderer;
  readonly membership: FedosDesktopMembershipRenderer;
  readonly status: FedosDesktopStatusRenderer;

  constructor(boundary: FedosDesktopConversationUiPresentationBoundary) {
    this.conversationList = new FedosDesktopConversationListRenderer(boundary.conversationList);
    this.conversationDetail = new FedosDesktopConversationDetailRenderer(boundary.conversationDetail);
    this.message = new FedosDesktopMessageRenderer(boundary.messageList, boundary.composeMessage, boundary.unreadCounter);
    this.reply = new FedosDesktopReplyRenderer(boundary.reply);
    this.search = new FedosDesktopSearchRenderer(boundary.search);
    this.archive = new FedosDesktopArchiveRenderer(boundary.archive);
    this.membership = new FedosDesktopMembershipRenderer(boundary.membership);
    this.status = new FedosDesktopStatusRenderer(boundary.runtimeStatus);
  }
}

export function createFedosDesktopRenderer(boundary: FedosDesktopConversationUiPresentationBoundary): FedosDesktopRenderer {
  return new FedosDesktopRenderer(boundary);
}
