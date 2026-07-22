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
// Secure Runtime Alpha 3801-3880 -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring this file's own established pattern.
import { FedosDesktopDeviceListRenderer } from "./fedos_desktop_device_list_renderer.js";
import { FedosDesktopDeviceSyncStatusRenderer } from "./fedos_desktop_device_sync_status_renderer.js";
import { FedosDesktopSyncScheduleRenderer } from "./fedos_desktop_sync_schedule_renderer.js";
import { FedosDesktopTransferSessionRenderer } from "./fedos_desktop_transfer_session_renderer.js";
import { FedosDesktopSyncConflictRenderer } from "./fedos_desktop_sync_conflict_renderer.js";
// Secure Runtime Alpha 3941-4020 (Desktop Device Management and Sync
// Operations UI Renderer Arc) -- every import/addition below this comment
// is ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FedosDeviceManagementRenderer } from "./device_management/fedos_device_management_renderer.js";
// Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
// Aggregation and User Consent UI Arc) -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring this file's own established pattern.
import { FedosDeletionRequestRenderer } from "./deletion_request/fedos_deletion_request_renderer.js";

export class FedosDesktopRenderer {
  readonly conversationList: FedosDesktopConversationListRenderer;
  readonly conversationDetail: FedosDesktopConversationDetailRenderer;
  readonly message: FedosDesktopMessageRenderer;
  readonly reply: FedosDesktopReplyRenderer;
  readonly search: FedosDesktopSearchRenderer;
  readonly archive: FedosDesktopArchiveRenderer;
  readonly membership: FedosDesktopMembershipRenderer;
  readonly status: FedosDesktopStatusRenderer;
  readonly deviceList: FedosDesktopDeviceListRenderer;
  readonly deviceSyncStatus: FedosDesktopDeviceSyncStatusRenderer;
  readonly syncSchedule: FedosDesktopSyncScheduleRenderer;
  readonly transferSession: FedosDesktopTransferSessionRenderer;
  readonly syncConflict: FedosDesktopSyncConflictRenderer;
  readonly deviceManagement: FedosDeviceManagementRenderer;
  readonly deletionRequests: FedosDeletionRequestRenderer;

  constructor(boundary: FedosDesktopConversationUiPresentationBoundary) {
    this.conversationList = new FedosDesktopConversationListRenderer(boundary.conversationList);
    this.conversationDetail = new FedosDesktopConversationDetailRenderer(boundary.conversationDetail);
    this.message = new FedosDesktopMessageRenderer(boundary.messageList, boundary.composeMessage, boundary.unreadCounter);
    this.reply = new FedosDesktopReplyRenderer(boundary.reply);
    this.search = new FedosDesktopSearchRenderer(boundary.search);
    this.archive = new FedosDesktopArchiveRenderer(boundary.archive);
    this.membership = new FedosDesktopMembershipRenderer(boundary.membership);
    this.status = new FedosDesktopStatusRenderer(boundary.runtimeStatus);
    this.deviceList = new FedosDesktopDeviceListRenderer(boundary.deviceInventory);
    this.deviceSyncStatus = new FedosDesktopDeviceSyncStatusRenderer(boundary.deviceSyncStatus);
    this.syncSchedule = new FedosDesktopSyncScheduleRenderer(boundary.syncSchedule);
    this.transferSession = new FedosDesktopTransferSessionRenderer(boundary.transferSession);
    this.syncConflict = new FedosDesktopSyncConflictRenderer(boundary.syncConflict);
    this.deviceManagement = new FedosDeviceManagementRenderer(boundary.deviceManagement);
    this.deletionRequests = new FedosDeletionRequestRenderer(boundary.deletionRequests);
  }
}

export function createFedosDesktopRenderer(boundary: FedosDesktopConversationUiPresentationBoundary): FedosDesktopRenderer {
  return new FedosDesktopRenderer(boundary);
}
